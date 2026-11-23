/* ==========================================================================
   DUSKWOOD INN - Co-op Multiplayer Networking Engine (Host / Join Table)
   Dual-Transport Host-Authoritative Star Topology:
     1. ONLINE P2P (WebRTC DataChannel via PeerJS):
        - Works across different PCs, phones, Wi-Fi/4G networks, GitHub Pages,
          localhost, and even local index.html when online!
        - Host claims deterministic peer ID: "duskwood-inn-tbl-<CODE>"
        - Guests enter the 4-letter Table Code and connect directly to Host.
     2. LOCAL TAB SYNC (BroadcastChannel + localStorage Bus):
        - Instant 0ms co-op testing across 2-4 browser tabs on the same PC,
          even completely offline!
   - Handles: 4-seat lobby roster, character/name live sync, Ready/Unready,
     Host Kick, Difficulty sync, Lobby Chat, Match Launch sync, and smooth
     interpolated in-cabin player position/pose/lantern sync.
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const PEER_PREFIX = "duskwood-inn-tbl-v47-";
  const LOCAL_CHANNEL_NAME = "duskwood_inn_coop_bus_v47";
  const LS_BUS_KEY = "duskwood_inn_coop_ls_pkt_v47";
  const MAX_SEATS = 4;
  const STATE_SEND_INTERVAL_MS = 55; // ~18 Hz player movement/pose sync
  const HEARTBEAT_MS = 4000;
  const STALE_GUEST_MS = 14000;

  const PEERJS_CDNS = [
    "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"
  ];

  // Unique per-tab identity so multiple tabs in the same browser never collide
  const localPlayerId =
    "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

  let peerJsPromise = null;
  let peerInstance = null;
  let hostConn = null;          // Guest -> Host PeerJS DataConnection
  const guestConns = new Map(); // Host: playerId -> PeerJS DataConnection
  const guestLastSeen = new Map(); // Host: playerId -> timestamp ms

  // Local same-device multi-tab transport
  let localBC = null;
  let lsListenerBound = false;
  let localTransportReady = false;
  let joinTimeoutId = null;
  let heartbeatTimerId = null;
  let lastStateSentMs = 0;

  // Authoritative / Mirrored Session State
  const session = {
    role: "IDLE", // IDLE | HOST | GUEST
    status: "IDLE", // IDLE | CONNECTING | HOSTING | CONNECTED | ERROR
    statusText: "NOT CONNECTED",
    transport: "NONE", // NONE | P2P | LOCAL | HYBRID
    p2pAvailable: false,
    roomCode: "",
    difficulty: "NORMAL",
    inMatch: false,
    matchSeed: 0,
    localSeatIdx: -1,
    seats: [null, null, null, null], // Each: { playerId, seatIdx, name, isHost, ready, character, transport }
    chatLog: [] // Each: { id, sender, text, system, ts }
  };

  // Remote in-cabin players map: playerId -> interpolated live state
  const remotePlayers = new Map();

  // Event listeners
  const listeners = {
    lobbyChange: [],
    matchStart: [],
    kicked: [],
    hostClosed: [],
    gameMessage: [],
    toast: []
  };

  function emit(eventName, payload) {
    const arr = listeners[eventName];
    if (!arr) return;
    arr.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error("[Duskwood Net]", err); }
    });
  }

  function on(eventName, cb) {
    if (listeners[eventName] && typeof cb === "function") {
      listeners[eventName].push(cb);
    }
  }

  function cloneCharacter(ch) {
    const src = ch || (App.Config && App.Config.state && App.Config.state.character) || {};
    return {
      name: ((src.name || "SURVIVOR").trim() || "SURVIVOR").slice(0, 14).toUpperCase(),
      skin: Number(src.skin) || 0,
      hairStyle: Number(src.hairStyle) || 0,
      hairColor: Number(src.hairColor) || 0,
      eyeColor: Number(src.eyeColor) || 0,
      outfit: Number(src.outfit) || 0,
      shirtColor: Number(src.shirtColor) || 0,
      underColor: Number(src.underColor) || 0,
      pantsColor: Number(src.pantsColor) || 0,
      shoeColor: Number(src.shoeColor) || 0,
      accessory: Number(src.accessory) || 0,
      lantern: Boolean(src.lantern),
      facing: 1,
      walking: false
    };
  }

  function getLocalProfile() {
    const ch = cloneCharacter();
    return {
      playerId: localPlayerId,
      name: ch.name,
      character: ch
    };
  }

  function pushChatEntry(entry) {
    session.chatLog.push({
      id: entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: entry.sender || "",
      text: String(entry.text || "").slice(0, 120),
      system: Boolean(entry.system),
      ts: entry.ts || Date.now()
    });
    if (session.chatLog.length > 30) {
      session.chatLog = session.chatLog.slice(-30);
    }
  }

  function getOccupiedCount() {
    return session.seats.filter(Boolean).length;
  }

  function getSeatByPlayerId(pid) {
    return session.seats.find((s) => s && s.playerId === pid) || null;
  }

  // ==================== LAZY PEERJS LOADER (ZERO BLOCKING FOR SINGLEPLAYER) ====================
  function loadPeerJS() {
    if (typeof window.Peer === "function") {
      return Promise.resolve(window.Peer);
    }
    if (peerJsPromise) return peerJsPromise;

    peerJsPromise = new Promise((resolve) => {
      let idx = 0;
      const tryNext = () => {
        if (typeof window.Peer === "function") {
          resolve(window.Peer);
          return;
        }
        if (idx >= PEERJS_CDNS.length) {
          resolve(null);
          return;
        }
        const script = document.createElement("script");
        script.src = PEERJS_CDNS[idx++];
        script.async = true;
        const timer = setTimeout(() => {
          script.onerror = null;
          script.onload = null;
          tryNext();
        }, 4500);

        script.onload = () => {
          clearTimeout(timer);
          if (typeof window.Peer === "function") resolve(window.Peer);
          else tryNext();
        };
        script.onerror = () => {
          clearTimeout(timer);
          tryNext();
        };
        document.head.appendChild(script);
      };
      tryNext();
    });

    return peerJsPromise;
  }

  // ==================== LOCAL SAME-DEVICE BUS (BROADCASTCHANNEL + LOCALSTORAGE) ====================
  function ensureLocalBus() {
    if (!localBC && typeof BroadcastChannel !== "undefined") {
      try {
        localBC = new BroadcastChannel(LOCAL_CHANNEL_NAME);
        localBC.onmessage = (ev) => {
          if (ev && ev.data) handleLocalBusPacket(ev.data);
        };
        localTransportReady = true;
      } catch (_) {
        localBC = null;
      }
    }

    if (!lsListenerBound) {
      lsListenerBound = true;
      window.addEventListener("storage", (ev) => {
        if (ev.key !== LS_BUS_KEY || !ev.newValue) return;
        try {
          const pkt = JSON.parse(ev.newValue);
          handleLocalBusPacket(pkt);
        } catch (_) {}
      });
      localTransportReady = true;
    }
  }

  function sendLocalBus(roomCode, targetId, msg) {
    ensureLocalBus();
    const pkt = {
      roomCode,
      fromId: localPlayerId,
      targetId: targetId || "*",
      msg,
      nonce: Math.random().toString(36).slice(2)
    };
    if (localBC) {
      try { localBC.postMessage(pkt); } catch (_) {}
    } else {
      try { localStorage.setItem(LS_BUS_KEY, JSON.stringify(pkt)); } catch (_) {}
    }
  }

  function handleLocalBusPacket(pkt) {
    if (!pkt || pkt.fromId === localPlayerId) return;
    if (!session.roomCode || pkt.roomCode !== session.roomCode) return;
    if (pkt.targetId && pkt.targetId !== "*" && pkt.targetId !== localPlayerId) return;

    if (session.role === "HOST") {
      handleHostIncoming(pkt.fromId, pkt.msg, "LOCAL", null);
    } else if (session.role === "GUEST") {
      handleGuestIncoming(pkt.msg, "LOCAL");
    }
  }

  // ==================== LOW-LEVEL SEND HELPERS ====================
  function sendToGuest(playerId, msg) {
    const seat = getSeatByPlayerId(playerId);
    if (!seat) return;
    if (seat.transport === "P2P") {
      const conn = guestConns.get(playerId);
      if (conn && conn.open) {
        try { conn.send(msg); } catch (_) {}
      }
    } else {
      sendLocalBus(session.roomCode, playerId, msg);
    }
  }

  function broadcastFromHost(msg, excludePlayerId) {
    session.seats.forEach((seat) => {
      if (!seat || seat.isHost || seat.playerId === excludePlayerId) return;
      sendToGuest(seat.playerId, msg);
    });
  }

  function sendToHost(msg) {
    if (session.role !== "GUEST") return;
    if (session.transport === "P2P" && hostConn && hostConn.open) {
      try { hostConn.send(msg); } catch (_) {}
    } else {
      sendLocalBus(session.roomCode, "HOST", msg);
    }
  }

  // ==================== HOST AUTHORITATIVE LOGIC ====================
  function buildLobbySnapshot() {
    return {
      type: "LOBBY_STATE",
      roomCode: session.roomCode,
      difficulty: session.difficulty,
      inMatch: session.inMatch,
      seats: session.seats.map((s) => (s ? Object.assign({}, s) : null)),
      chatLog: session.chatLog.slice(-20)
    };
  }

  function broadcastLobbyState() {
    if (session.role !== "HOST") return;
    broadcastFromHost(buildLobbySnapshot());
    emit("lobbyChange", getPublicState());
  }

  function removeGuestById(playerId, reasonText) {
    if (session.role !== "HOST") return;
    const idx = session.seats.findIndex((s) => s && s.playerId === playerId);
    if (idx <= 0) return;

    const leaving = session.seats[idx];
    session.seats[idx] = null;
    guestLastSeen.delete(playerId);
    remotePlayers.delete(playerId);

    const conn = guestConns.get(playerId);
    if (conn) {
      try { conn.close(); } catch (_) {}
      guestConns.delete(playerId);
    }

    pushChatEntry({
      system: true,
      text: `${leaving.name} ${reasonText || "left the table"}.`
    });
    broadcastLobbyState();
    if (session.inMatch) {
      broadcastFromHost({ type: "PLAYER_LEFT", playerId, name: leaving.name });
      emit("toast", `${leaving.name} disconnected from the table.`);
    }
  }

  function handleHostIncoming(fromId, msg, transport, conn) {
    if (!msg || typeof msg.type !== "string") return;
    guestLastSeen.set(fromId, Date.now());

    if (msg.type === "JOIN_REQ") {
      // Check if player is already seated (dedupe dual-transport race!)
      const existing = getSeatByPlayerId(fromId);
      if (existing) {
        if (transport === "P2P" && conn) {
          guestConns.set(fromId, conn);
          existing.transport = "P2P";
        }
        sendToGuest(fromId, { type: "JOIN_ACCEPT", seatIdx: existing.seatIdx, state: buildLobbySnapshot() });
        return;
      }

      if (session.inMatch) {
        const reject = { type: "JOIN_REJECT", reason: "This table has already entered the cabin." };
        if (transport === "P2P" && conn && conn.open) conn.send(reject);
        else sendLocalBus(session.roomCode, fromId, reject);
        return;
      }

      const openIdx = session.seats.findIndex((s) => s === null);
      if (openIdx === -1) {
        const reject = { type: "JOIN_REJECT", reason: "Table is full (4/4 travelers)." };
        if (transport === "P2P" && conn && conn.open) conn.send(reject);
        else sendLocalBus(session.roomCode, fromId, reject);
        return;
      }

      const profile = msg.profile || {};
      const ch = cloneCharacter(profile.character);
      const seatObj = {
        playerId: fromId,
        seatIdx: openIdx,
        name: ch.name,
        isHost: false,
        ready: false,
        character: ch,
        transport
      };

      session.seats[openIdx] = seatObj;
      if (transport === "P2P" && conn) {
        guestConns.set(fromId, conn);
      }

      pushChatEntry({
        system: true,
        text: `${seatObj.name} took Seat ${openIdx + 1}.`
      });

      sendToGuest(fromId, {
        type: "JOIN_ACCEPT",
        seatIdx: openIdx,
        state: buildLobbySnapshot()
      });
      broadcastLobbyState();
      if (App.Audio && App.Audio.open) App.Audio.open();
      return;
    }

    const seat = getSeatByPlayerId(fromId);
    if (!seat) return;

    if (msg.type === "PING") {
      sendToGuest(fromId, { type: "PONG" });
      return;
    }

    if (msg.type === "LEAVE") {
      removeGuestById(fromId, "left the table");
      return;
    }

    if (msg.type === "SET_READY") {
      seat.ready = Boolean(msg.ready);
      broadcastLobbyState();
      return;
    }

    if (msg.type === "UPDATE_PROFILE") {
      const ch = cloneCharacter(msg.character);
      seat.name = ch.name;
      seat.character = ch;
      const rp = remotePlayers.get(fromId);
      if (rp) {
        rp.name = ch.name;
        rp.character = ch;
      }
      broadcastLobbyState();
      return;
    }

    if (msg.type === "CHAT") {
      const clean = String(msg.text || "").trim().slice(0, 100);
      if (!clean) return;
      pushChatEntry({ sender: seat.name, text: clean, system: false });
      broadcastLobbyState();
      return;
    }

    if (msg.type === "PLAYER_STATE" && session.inMatch) {
      upsertRemotePlayerState(fromId, seat, msg.state);
      // Relay to all other guests
      broadcastFromHost(
        {
          type: "REMOTE_STATE",
          playerId: fromId,
          seatIdx: seat.seatIdx,
          name: seat.name,
          character: seat.character,
          state: msg.state
        },
        fromId
      );
      return;
    }

    if (msg.type === "GAME_ACTION" && session.inMatch) {
      emit("gameMessage", { fromId, seatIdx: seat.seatIdx, action: msg.action, payload: msg.payload });
      broadcastFromHost(
        { type: "GAME_ACTION", fromId, seatIdx: seat.seatIdx, action: msg.action, payload: msg.payload },
        fromId
      );
    }
  }

  // ==================== GUEST LOGIC ====================
  function handleGuestIncoming(msg, transport) {
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "JOIN_ACCEPT") {
      clearTimeout(joinTimeoutId);
      joinTimeoutId = null;
      session.status = "CONNECTED";
      session.transport = transport;
      session.localSeatIdx = msg.seatIdx;
      session.statusText =
        transport === "P2P"
          ? `CONNECTED ONLINE TO TABLE ${session.roomCode}`
          : `CONNECTED (LOCAL) TO TABLE ${session.roomCode}`;

      // If connected via LOCAL while a P2P peer attempt is still lingering, keep clean
      if (msg.state) applyLobbySnapshot(msg.state);
      emit("lobbyChange", getPublicState());
      if (App.Audio && App.Audio.clockChime) App.Audio.clockChime();
      return;
    }

    if (msg.type === "JOIN_REJECT") {
      const reason = msg.reason || "Unable to join table.";
      leaveTable(true);
      session.status = "ERROR";
      session.statusText = reason;
      emit("lobbyChange", getPublicState());
      return;
    }

    if (msg.type === "KICKED") {
      const reason = msg.reason || "You were removed from the table by the Host.";
      leaveTable(true);
      emit("kicked", reason);
      return;
    }

    if (msg.type === "HOST_CLOSED") {
      leaveTable(true);
      emit("hostClosed", "The Host closed the table.");
      return;
    }

    if (msg.type === "LOBBY_STATE") {
      applyLobbySnapshot(msg);
      emit("lobbyChange", getPublicState());
      return;
    }

    if (msg.type === "MATCH_START") {
      session.inMatch = true;
      session.matchSeed = msg.seed || Date.now();
      session.difficulty = msg.difficulty || session.difficulty;
      if (Array.isArray(msg.seats)) {
        session.seats = msg.seats;
        const mine = getSeatByPlayerId(localPlayerId);
        if (mine) session.localSeatIdx = mine.seatIdx;
      }
      seedInitialRemotePlayers();
      emit("matchStart", {
        mode: "MULTIPLAYER",
        roomCode: session.roomCode,
        difficulty: session.difficulty,
        seed: session.matchSeed,
        localSeatIdx: session.localSeatIdx,
        isHost: false,
        seats: session.seats.slice()
      });
      return;
    }

    if (msg.type === "REMOTE_STATE" && session.inMatch) {
      if (msg.playerId === localPlayerId) return;
      const seat = getSeatByPlayerId(msg.playerId) || {
        seatIdx: msg.seatIdx,
        name: msg.name,
        character: msg.character
      };
      upsertRemotePlayerState(msg.playerId, seat, msg.state);
      return;
    }

    if (msg.type === "PLAYER_LEFT") {
      remotePlayers.delete(msg.playerId);
      if (msg.name) emit("toast", `${msg.name} left the cabin.`);
      return;
    }

    if (msg.type === "GAME_ACTION" && session.inMatch) {
      emit("gameMessage", {
        fromId: msg.fromId,
        seatIdx: msg.seatIdx,
        action: msg.action,
        payload: msg.payload
      });
    }
  }

  function applyLobbySnapshot(snap) {
    if (!snap) return;
    if (snap.difficulty) session.difficulty = snap.difficulty;
    if (typeof snap.inMatch === "boolean") session.inMatch = snap.inMatch;
    if (Array.isArray(snap.seats)) {
      session.seats = snap.seats;
      const mine = getSeatByPlayerId(localPlayerId);
      session.localSeatIdx = mine ? mine.seatIdx : -1;
    }
    if (Array.isArray(snap.chatLog)) {
      session.chatLog = snap.chatLog;
    }
  }

  // ==================== IN-CABIN REMOTE PLAYER INTERPOLATION ====================
  function seedInitialRemotePlayers() {
    remotePlayers.clear();
    const chairs = (App.GameRoom && App.GameRoom.CHAIRS) || [
      { id: 0, seatX: 68,  seatY: 128, facing: 1 },
      { id: 1, seatX: 140, seatY: 128, facing: -1 },
      { id: 2, seatX: 104, seatY: 94,  facing: 1 },
      { id: 3, seatX: 104, seatY: 157, facing: 1 }
    ];

    session.seats.forEach((seat) => {
      if (!seat || seat.playerId === localPlayerId) return;
      const ch = chairs[seat.seatIdx] || chairs[0];
      remotePlayers.set(seat.playerId, {
        playerId: seat.playerId,
        seatIdx: seat.seatIdx,
        name: seat.name,
        character: cloneCharacter(seat.character),
        x: ch.seatX,
        y: ch.seatY,
        targetX: ch.seatX,
        targetY: ch.seatY,
        roomX: 0,
        roomY: 0,
        facing: ch.facing,
        seated: true,
        chairId: ch.id,
        moving: false,
        sprinting: false,
        crouching: false,
        lanternOn: Boolean(seat.character && seat.character.lantern),
        facingCorner: false
      });
    });
  }

  function upsertRemotePlayerState(pid, seat, st) {
    if (!st || pid === localPlayerId) return;
    let rp = remotePlayers.get(pid);
    if (!rp) {
      rp = {
        playerId: pid,
        seatIdx: seat ? seat.seatIdx : 1,
        name: (seat && seat.name) || "TRAVELER",
        character: cloneCharacter(seat && seat.character),
        x: st.x,
        y: st.y,
        targetX: st.x,
        targetY: st.y,
        roomX: st.roomX || 0,
        roomY: st.roomY || 0,
        facing: st.facing || 1,
        seated: Boolean(st.seated),
        chairId: typeof st.chairId === "number" ? st.chairId : 0,
        moving: Boolean(st.moving),
        sprinting: Boolean(st.sprinting),
        crouching: Boolean(st.crouching),
        lanternOn: Boolean(st.lanternOn),
        facingCorner: Boolean(st.facingCorner)
      };
      remotePlayers.set(pid, rp);
      return;
    }

    const roomChanged = rp.roomX !== (st.roomX || 0) || rp.roomY !== (st.roomY || 0);
    rp.roomX = st.roomX || 0;
    rp.roomY = st.roomY || 0;
    rp.targetX = st.x;
    rp.targetY = st.y;
    if (roomChanged || Math.hypot(rp.x - st.x, rp.y - st.y) > 48) {
      rp.x = st.x;
      rp.y = st.y;
    }
    rp.facing = st.facing || 1;
    rp.seated = Boolean(st.seated);
    rp.chairId = typeof st.chairId === "number" ? st.chairId : rp.chairId;
    rp.moving = Boolean(st.moving);
    rp.sprinting = Boolean(st.sprinting);
    rp.crouching = Boolean(st.crouching);
    rp.lanternOn = Boolean(st.lanternOn);
    rp.facingCorner = Boolean(st.facingCorner);
    if (seat && seat.name) rp.name = seat.name;
    if (seat && seat.character) rp.character = cloneCharacter(seat.character);
  }

  function updateRemoteInterpolation(dt) {
    const alpha = Math.min(1, (dt || 0.016) * 14);
    remotePlayers.forEach((rp) => {
      rp.x += (rp.targetX - rp.x) * alpha;
      rp.y += (rp.targetY - rp.y) * alpha;
    });
  }

  function getRemotePlayersInRoom(roomX, roomY) {
    const list = [];
    remotePlayers.forEach((rp) => {
      if (rp.roomX === roomX && rp.roomY === roomY) list.push(rp);
    });
    return list;
  }

  function isChairOccupiedByRemote(chairId) {
    for (const rp of remotePlayers.values()) {
      if (rp.roomX === 0 && rp.roomY === 0 && rp.seated && rp.chairId === chairId) {
        return true;
      }
    }
    return false;
  }

  // ==================== PUBLIC HOST / JOIN / LEAVE API ====================
  function cleanupTransports() {
    clearTimeout(joinTimeoutId);
    joinTimeoutId = null;
    clearInterval(heartbeatTimerId);
    heartbeatTimerId = null;

    guestConns.forEach((c) => {
      try { c.close(); } catch (_) {}
    });
    guestConns.clear();
    guestLastSeen.clear();

    if (hostConn) {
      try { hostConn.close(); } catch (_) {}
      hostConn = null;
    }
    if (peerInstance) {
      try { peerInstance.destroy(); } catch (_) {}
      peerInstance = null;
    }
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimerId);
    heartbeatTimerId = setInterval(() => {
      if (session.role === "GUEST" && session.status === "CONNECTED") {
        sendToHost({ type: "PING" });
      } else if (session.role === "HOST") {
        const now = Date.now();
        session.seats.forEach((seat) => {
          if (!seat || seat.isHost) return;
          const last = guestLastSeen.get(seat.playerId) || now;
          if (now - last > STALE_GUEST_MS) {
            removeGuestById(seat.playerId, "timed out");
          }
        });
      }
    }, HEARTBEAT_MS);
  }

  function hostTable(code, difficulty) {
    leaveTable(true);
    ensureLocalBus();

    const cleanCode = String(code || "DUSK").trim().toUpperCase().slice(0, 4);
    const prof = getLocalProfile();

    session.role = "HOST";
    session.status = "CONNECTING";
    session.transport = "LOCAL";
    session.p2pAvailable = false;
    session.roomCode = cleanCode;
    session.difficulty = difficulty || (App.Config && App.Config.state.difficulty) || "NORMAL";
    session.inMatch = false;
    session.localSeatIdx = 0;
    session.seats = [
      {
        playerId: localPlayerId,
        seatIdx: 0,
        name: prof.name,
        isHost: true,
        ready: true,
        character: prof.character,
        transport: "HOST"
      },
      null,
      null,
      null
    ];
    session.chatLog = [];
    pushChatEntry({
      system: true,
      text: `Table ${cleanCode} opened. Share code "${cleanCode}" with friends!`
    });
    session.statusText = `OPENING TABLE ${cleanCode} (LOCAL READY, LINKING P2P...)`;
    emit("lobbyChange", getPublicState());

    startHeartbeat();

    // Initialize PeerJS so friends on ANY device/network can join via Table Code
    loadPeerJS().then((PeerCtor) => {
      if (session.role !== "HOST" || session.roomCode !== cleanCode) return;

      if (!PeerCtor) {
        session.status = "HOSTING";
        session.transport = "LOCAL";
        session.p2pAvailable = false;
        session.statusText = `HOSTING ${cleanCode} • LOCAL TABS ONLY (OFFLINE)`;
        emit("lobbyChange", getPublicState());
        return;
      }

      try {
        const peer = new PeerCtor(PEER_PREFIX + cleanCode, {
          debug: 0,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" }
            ]
          }
        });
        peerInstance = peer;

        peer.on("open", () => {
          if (peerInstance !== peer || session.role !== "HOST") return;
          session.status = "HOSTING";
          session.transport = "HYBRID";
          session.p2pAvailable = true;
          session.statusText = `ONLINE P2P READY • TABLE ${cleanCode}`;
          emit("lobbyChange", getPublicState());
        });

        peer.on("connection", (conn) => {
          let boundPlayerId = null;
          conn.on("data", (data) => {
            if (!data || typeof data !== "object") return;
            if (data.type === "JOIN_REQ" && data.profile && data.profile.playerId) {
              boundPlayerId = data.profile.playerId;
            }
            const pid = boundPlayerId || (data.profile && data.profile.playerId) || conn.peer;
            handleHostIncoming(pid, data, "P2P", conn);
          });
          conn.on("close", () => {
            if (boundPlayerId) removeGuestById(boundPlayerId, "disconnected");
          });
          conn.on("error", () => {
            if (boundPlayerId) removeGuestById(boundPlayerId, "lost connection");
          });
        });

        peer.on("error", (err) => {
          if (peerInstance !== peer || session.role !== "HOST") return;
          if (err && err.type === "unavailable-id") {
            session.status = "ERROR";
            session.statusText = `CODE "${cleanCode}" ALREADY IN USE — CLICK [NEW] FOR A FRESH CODE`;
          } else {
            session.status = "HOSTING";
            session.transport = "LOCAL";
            session.p2pAvailable = false;
            session.statusText = `HOSTING ${cleanCode} • LOCAL TABS ONLY`;
          }
          emit("lobbyChange", getPublicState());
        });
      } catch (_) {
        session.status = "HOSTING";
        session.transport = "LOCAL";
        session.statusText = `HOSTING ${cleanCode} • LOCAL TABS ONLY`;
        emit("lobbyChange", getPublicState());
      }
    });
  }

  function joinTable(code) {
    const cleanCode = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (cleanCode.length < 4) {
      session.status = "ERROR";
      session.statusText = "Please enter a valid 4-letter Table Code.";
      emit("lobbyChange", getPublicState());
      return;
    }

    leaveTable(true);
    ensureLocalBus();

    const prof = getLocalProfile();
    session.role = "GUEST";
    session.status = "CONNECTING";
    session.transport = "NONE";
    session.roomCode = cleanCode;
    session.inMatch = false;
    session.localSeatIdx = -1;
    session.seats = [null, null, null, null];
    session.chatLog = [];
    session.statusText = `SEARCHING FOR TABLE ${cleanCode}...`;
    emit("lobbyChange", getPublicState());

    // 1. Immediately probe same-device local tabs (0ms connect if Host is another tab!)
    sendLocalBus(cleanCode, "HOST", { type: "JOIN_REQ", profile: prof });

    // 2. Simultaneously attempt Online P2P connection via PeerJS
    loadPeerJS().then((PeerCtor) => {
      if (session.role !== "GUEST" || session.roomCode !== cleanCode) return;
      if (session.status === "CONNECTED") return; // Already joined via Local Tab!
      if (!PeerCtor) return;

      try {
        const peer = new PeerCtor(undefined, {
          debug: 0,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" }
            ]
          }
        });
        peerInstance = peer;

        peer.on("open", () => {
          if (peerInstance !== peer || session.role !== "GUEST" || session.status === "CONNECTED") return;
          const conn = peer.connect(PEER_PREFIX + cleanCode, { reliable: true });
          hostConn = conn;

          conn.on("open", () => {
            if (session.status === "CONNECTED" && session.transport === "LOCAL") {
              try { conn.close(); } catch (_) {}
              return;
            }
            conn.send({ type: "JOIN_REQ", profile: getLocalProfile() });
          });

          conn.on("data", (data) => {
            handleGuestIncoming(data, "P2P");
          });

          conn.on("close", () => {
            if (session.role === "GUEST" && session.transport === "P2P") {
              leaveTable(true);
              emit("hostClosed", "Connection to Host lost.");
            }
          });

          conn.on("error", () => {
            // Timeout handler will report friendly message if local also fails
          });
        });

        peer.on("error", (err) => {
          if (peerInstance !== peer || session.status === "CONNECTED") return;
          if (err && err.type === "peer-unavailable" && session.status === "CONNECTING") {
            clearTimeout(joinTimeoutId);
            leaveTable(true);
            session.status = "ERROR";
            session.statusText = `Table "${cleanCode}" not found. Ask your Host to verify the code.`;
            emit("lobbyChange", getPublicState());
          }
        });
      } catch (_) {}
    });

    startHeartbeat();

    // Connection timeout guard (9 seconds)
    joinTimeoutId = setTimeout(() => {
      if (session.role === "GUEST" && session.status === "CONNECTING") {
        leaveTable(true);
        session.status = "ERROR";
        session.statusText = `Could not reach Table "${cleanCode}". Make sure the Host has opened it.`;
        emit("lobbyChange", getPublicState());
      }
    }, 9000);
  }

  function leaveTable(silent) {
    if (session.role === "HOST" && session.roomCode) {
      broadcastFromHost({ type: "HOST_CLOSED" });
    } else if (session.role === "GUEST" && session.roomCode) {
      sendToHost({ type: "LEAVE" });
    }

    cleanupTransports();
    remotePlayers.clear();

    session.role = "IDLE";
    session.status = "IDLE";
    session.statusText = "NOT CONNECTED";
    session.transport = "NONE";
    session.p2pAvailable = false;
    session.roomCode = "";
    session.inMatch = false;
    session.localSeatIdx = -1;
    session.seats = [null, null, null, null];
    session.chatLog = [];

    if (!silent) {
      emit("lobbyChange", getPublicState());
    }
  }

  function toggleReady() {
    if (session.role !== "GUEST" || session.status !== "CONNECTED") return;
    const mine = getSeatByPlayerId(localPlayerId);
    if (!mine) return;
    const nextReady = !mine.ready;
    mine.ready = nextReady;
    sendToHost({ type: "SET_READY", ready: nextReady });
    emit("lobbyChange", getPublicState());
  }

  function setDifficulty(diff) {
    const clean = diff === "NIGHTMARE" ? "NIGHTMARE" : "NORMAL";
    if (session.role === "HOST") {
      session.difficulty = clean;
      broadcastLobbyState();
    }
  }

  function kickSeat(seatIdx) {
    if (session.role !== "HOST" || seatIdx <= 0 || seatIdx >= MAX_SEATS) return;
    const target = session.seats[seatIdx];
    if (!target) return;
    sendToGuest(target.playerId, { type: "KICKED", reason: "Removed from the table by the Host." });
    removeGuestById(target.playerId, "was removed by the Host");
  }

  function sendChat(text) {
    const clean = String(text || "").trim().slice(0, 100);
    if (!clean) return;
    if (session.role === "HOST") {
      const hostSeat = session.seats[0];
      pushChatEntry({ sender: hostSeat ? hostSeat.name : "HOST", text: clean, system: false });
      broadcastLobbyState();
    } else if (session.role === "GUEST" && session.status === "CONNECTED") {
      sendToHost({ type: "CHAT", text: clean });
    }
  }

  function syncLocalProfile() {
    if (session.role === "IDLE") return;
    const prof = getLocalProfile();
    if (session.role === "HOST") {
      if (session.seats[0]) {
        session.seats[0].name = prof.name;
        session.seats[0].character = prof.character;
        broadcastLobbyState();
      }
    } else if (session.role === "GUEST" && session.status === "CONNECTED") {
      sendToHost({ type: "UPDATE_PROFILE", character: prof.character });
    }
  }

  function startMatch() {
    if (session.role !== "HOST") return false;
    session.inMatch = true;
    session.matchSeed = Math.floor(Math.random() * 1000000000);
    seedInitialRemotePlayers();

    const payload = {
      type: "MATCH_START",
      roomCode: session.roomCode,
      difficulty: session.difficulty,
      seed: session.matchSeed,
      seats: session.seats.map((s) => (s ? Object.assign({}, s) : null))
    };
    broadcastFromHost(payload);

    emit("matchStart", {
      mode: "MULTIPLAYER",
      roomCode: session.roomCode,
      difficulty: session.difficulty,
      seed: session.matchSeed,
      localSeatIdx: 0,
      isHost: true,
      seats: session.seats.slice()
    });
    return true;
  }

  function sendPlayerState(stateObj, forceNow) {
    if (!session.inMatch || session.role === "IDLE") return;
    const now = performance.now();
    if (!forceNow && now - lastStateSentMs < STATE_SEND_INTERVAL_MS) return;
    lastStateSentMs = now;

    if (session.role === "HOST") {
      const hostSeat = session.seats[0];
      broadcastFromHost({
        type: "REMOTE_STATE",
        playerId: localPlayerId,
        seatIdx: 0,
        name: hostSeat ? hostSeat.name : "HOST",
        character: hostSeat ? hostSeat.character : cloneCharacter(),
        state: stateObj
      });
    } else if (session.role === "GUEST") {
      sendToHost({ type: "PLAYER_STATE", state: stateObj });
    }
  }

  function sendGameAction(action, payload) {
    if (!session.inMatch || session.role === "IDLE") return;
    if (session.role === "HOST") {
      broadcastFromHost({
        type: "GAME_ACTION",
        fromId: localPlayerId,
        seatIdx: 0,
        action,
        payload
      });
    } else {
      sendToHost({ type: "GAME_ACTION", action, payload });
    }
  }

  function getPublicState() {
    return {
      localPlayerId,
      role: session.role,
      status: session.status,
      statusText: session.statusText,
      transport: session.transport,
      p2pAvailable: session.p2pAvailable,
      roomCode: session.roomCode,
      difficulty: session.difficulty,
      inMatch: session.inMatch,
      localSeatIdx: session.localSeatIdx,
      occupiedCount: getOccupiedCount(),
      seats: session.seats.map((s) => (s ? Object.assign({}, s) : null)),
      chatLog: session.chatLog.slice()
    };
  }

  // Graceful cleanup when tab closes
  window.addEventListener("beforeunload", () => {
    if (session.role !== "IDLE") {
      leaveTable(true);
    }
  });

  App.Network = {
    on,
    hostTable,
    joinTable,
    leaveTable,
    toggleReady,
    setDifficulty,
    kickSeat,
    sendChat,
    syncLocalProfile,
    startMatch,
    sendPlayerState,
    sendGameAction,
    updateRemoteInterpolation,
    getRemotePlayersInRoom,
    isChairOccupiedByRemote,
    getState: getPublicState,
    isMultiplayerMatch: () => session.inMatch && session.role !== "IDLE",
    isHost: () => session.role === "HOST",
    getLocalPlayerId: () => localPlayerId
  };
})(window.Duskwood);
