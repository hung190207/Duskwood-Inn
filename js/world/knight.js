/* ==========================================================================
   DUSKWOOD INN - THE KNIGHT (`hx_knight`) Turn-Based Chess Event Engine
   - Trigger: Spawns 1 Demon Statue (Green), 1 Armored Knight (Red), and
     1 Destination Room (Blue) in random cabin rooms.
   - Table Radar: On The Dining Room round table (and Close-Up Table Glance),
     3 bright glowing colored light orbs reveal their exact rooms:
       * RED   : The Knight (Bộ giáp)
       * BLUE  : Destination (Đích đến)
       * GREEN : Demon Statue (Bức tượng quỷ)
   - Turn Cycle:
       * PLAYER TURN (10 seconds, Lights ON):
         - Player can move at most 1 room per turn.
         - Press [E] near the Demon Statue (when in the same room) to rotate it
           clockwise (N -> E -> S -> W), playing `audio/moving.mp3` (first 2.0s).
       * KNIGHT & STATUE TURN (Lights OFF, ~2.1s):
         - Demon Statue slides 1 room in the direction it faces, continuing turn
           after turn until hitting a dead end OR reaching Destination (= WIN!).
         - The Knight advances 1 room toward the player via BFS, playing
           `audio/knight_footstep_sfx.mp3` (strictly first 2.0s looped per move).
         - Sharing a room with The Knight at any point = KILLED (+1 HOUR, Cellar).
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const PLAYER_TURN_SEC = 10.0;
  const KNIGHT_TURN_SEC = 2.15;

  const DIRS = ["N", "E", "S", "W"];
  const DIR_LABELS = { N: "NORTH", E: "EAST", S: "SOUTH", W: "WEST" };
  const DIR_STEPS = [
    { dir: "N", opp: "S", dx: 0,  dy: -1 },
    { dir: "E", opp: "W", dx: 1,  dy: 0  },
    { dir: "S", opp: "N", dx: 0,  dy: 1  },
    { dir: "W", opp: "E", dx: -1, dy: 0  }
  ];

  let tableGlanceOpen = false;

  // Offscreen Demon Statue Sprite (24x32px — horned obsidian gargoyle bust on wheeled plinth)
  const statueBuf = document.createElement("canvas");
  statueBuf.width = 24;
  statueBuf.height = 32;
  const sctx = statueBuf.getContext("2d");
  sctx.imageSmoothingEnabled = false;

  // Offscreen Armored Knight Sprite (26x40px — towering dark plate armor + crimson visor + greatsword)
  const armorBuf = document.createElement("canvas");
  armorBuf.width = 26;
  armorBuf.height = 40;
  const kctx = armorBuf.getContext("2d");
  kctx.imageSmoothingEnabled = false;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function snapshotRoomLights(matchState) {
    const snap = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      if (k === "0,0") {
        snap[k] = !(matchState.roomLightStates && matchState.roomLightStates[k] === false);
      } else {
        snap[k] = Boolean(matchState.roomLightStates && matchState.roomLightStates[k] === true);
      }
    });
    return snap;
  }

  function restoreRoomLights(matchState, snap) {
    if (App.Events && App.Events.turnAllLightsOn) {
      App.Events.turnAllLightsOn(matchState);
      return;
    }
    matchState.roomLightStates = { "0,0": true };
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });
  }

  function getSafeCenterForRoom(room, slotOffset) {
    if (!room) return { x: 104, y: 126 };
    if (room.id === "dining_room") {
      // Avoid central round table (104, 126)
      const spots = [
        { x: 46,  y: 96  },
        { x: 162, y: 96  },
        { x: 46,  y: 168 },
        { x: 162, y: 168 }
      ];
      return spots[(slotOffset || 0) % spots.length];
    }
    return { x: 104, y: 126 };
  }

  function getConnectedNeighborKey(roomMap, fromKey, dir) {
    const room = roomMap && roomMap[fromKey];
    if (!room || !room.doors || !room.doors[dir]) return null;
    const step = DIR_STEPS.find((d) => d.dir === dir);
    if (!step) return null;
    const nk = `${room.x + step.dx},${room.y + step.dy}`;
    const nb = roomMap[nk];
    if (!nb || !nb.doors || !nb.doors[step.opp]) return null;
    return nk;
  }

  function getReachableRoomKeys(roomMap, startKey) {
    const queue = [startKey];
    const visited = new Set([startKey]);
    const distMap = { [startKey]: 0 };
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      const room = roomMap[cur];
      if (!room || !room.doors) continue;
      for (let i = 0; i < DIR_STEPS.length; i++) {
        const d = DIR_STEPS[i];
        const nk = getConnectedNeighborKey(roomMap, cur, d.dir);
        if (!nk || visited.has(nk)) continue;
        visited.add(nk);
        distMap[nk] = distMap[cur] + 1;
        queue.push(nk);
      }
    }
    return { keys: Array.from(visited), distMap };
  }

  function findBfsNextRoom(roomMap, fromKey, toKey) {
    if (!roomMap || fromKey === toKey) return null;
    const queue = [fromKey];
    const visited = new Set([fromKey]);
    const parent = {};
    let found = false;
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === toKey) { found = true; break; }
      for (let i = 0; i < DIR_STEPS.length; i++) {
        const d = DIR_STEPS[i];
        const nk = getConnectedNeighborKey(roomMap, cur, d.dir);
        if (!nk || visited.has(nk)) continue;
        visited.add(nk);
        parent[nk] = cur;
        queue.push(nk);
      }
    }
    if (!found) return null;
    let step = toKey;
    while (parent[step] && parent[step] !== fromKey) {
      step = parent[step];
    }
    return step;
  }

  // ==================== 1. PIXEL-ART SPRITES (DEMON STATUE, ARMOR KNIGHT, DESTINATION) ====================
  function drawDemonStatueSprite(ctx, x, y, facingDir, timeSec, canAdvance, activated) {
    const pulse = 0.65 + Math.sin(timeSec * 5.0) * 0.35;
    sctx.clearRect(0, 0, 24, 32);

    // Carved marble & iron square sliding pedestal base
    px(sctx, 3,  24, 18, 7, "#18161a");
    px(sctx, 4,  25, 16, 5, "#464952");
    px(sctx, 5,  25, 14, 2, "#6a707d");
    px(sctx, 6,  28, 12, 1, "#2a2d33");

    // Curved obsidian demon wings flaring behind shoulders
    px(sctx, 1,  12, 5, 10, "#121016");
    px(sctx, 2,  13, 3, 7,  "#2a2633");
    px(sctx, 18, 12, 5, 10, "#121016");
    px(sctx, 19, 13, 3, 7,  "#2a2633");

    // Sculpted obsidian-stone demon torso & carved emerald chest rune
    px(sctx, 6,  13, 12, 12, "#121016");
    px(sctx, 7,  14, 10, 10, "#2f2c38");
    px(sctx, 8,  14, 3,  9,  "#464252");
    px(sctx, 11, 17, 2,  4,  pulse > 0.65 ? "#6ef29e" : "#32b866"); // Glowing green chest sigil!

    // Horned demon gargoyle head!
    px(sctx, 7,  5,  10, 9, "#121016");
    px(sctx, 8,  6,  8,  7, "#363342");
    // Swept curled demon horns
    px(sctx, 5,  2,  3,  4, "#1a1721");
    px(sctx, 6,  3,  2,  3, "#545063");
    px(sctx, 16, 2,  3,  4, "#1a1721");
    px(sctx, 16, 3,  2,  3, "#545063");

    // Directional eyes / face profile based on facingDir (N = back of head, S = front, W/E = side!)
    if (facingDir === "S") {
      px(sctx, 9,  9,  2, 2, "#6ef29e");
      px(sctx, 13, 9,  2, 2, "#6ef29e");
      px(sctx, 10, 12, 4, 1, "#100d14");
    } else if (facingDir === "W") {
      px(sctx, 8,  9,  2, 2, "#6ef29e");
      px(sctx, 8,  12, 2, 1, "#100d14");
    } else if (facingDir === "E") {
      px(sctx, 14, 9,  2, 2, "#6ef29e");
      px(sctx, 14, 12, 2, 1, "#100d14");
    } else {
      // Facing NORTH (looking away toward North doorway — carved spine & nape runes)
      px(sctx, 11, 8,  2, 3, "#49bf76");
    }

    ctx.save();
    // Glowing directional floor arrow pointing strictly along `facingDir`!
    const arrowCol = !activated ? `rgba(180, 190, 205, ${(0.45 * pulse).toFixed(2)})` : canAdvance ? `rgba(82, 245, 134, ${(0.75 * pulse).toFixed(2)})` : `rgba(255, 140, 82, ${(0.68 * pulse).toFixed(2)})`;
    const vx = facingDir === "E" ? 1 : facingDir === "W" ? -1 : 0;
    const vy = facingDir === "S" ? 1 : facingDir === "N" ? -1 : 0;
    const ax0 = Math.round(x + vx * 11);
    const ay0 = Math.round(y - 2 + vy * 10);
    const ax1 = Math.round(x + vx * 23);
    const ay1 = Math.round(y - 2 + vy * 22);

    ctx.strokeStyle = arrowCol;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ax0, ay0);
    ctx.lineTo(ax1, ay1);
    ctx.stroke();

    // Arrowhead triangle
    ctx.fillStyle = arrowCol;
    ctx.beginPath();
    ctx.moveTo(ax1 + vx * 4, ay1 + vy * 4);
    ctx.lineTo(ax1 - vx * 2 - vy * 4, ay1 - vy * 2 + vx * 4);
    ctx.lineTo(ax1 - vx * 2 + vy * 4, ay1 - vy * 2 - vx * 4);
    ctx.closePath();
    ctx.fill();

    // Floor contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(Math.round(x - 10), Math.round(y - 2), 20, 5);
    ctx.drawImage(statueBuf, Math.round(x - 12), Math.round(y - 29));
    ctx.restore();
  }

  function drawKnightArmorSprite(ctx, x, y, timeSec) {
    const breath = Math.sin(timeSec * 3.0) > 0.4 ? 1 : 0;
    kctx.clearRect(0, 0, 26, 40);

    // Tattered dark crimson cape behind armor
    px(kctx, 5,  13, 16, 22, "#380d12");
    px(kctx, 6,  14, 14, 19, "#59151d");

    // Heavy iron armored greaves & sabaton boots
    px(kctx, 8,  27, 4, 11, "#14161a");
    px(kctx, 9,  27, 2, 10, "#6e7885");
    px(kctx, 14, 27, 4, 11, "#14161a");
    px(kctx, 15, 27, 2, 10, "#6e7885");

    // Broad dark steel breastplate & spiked pauldrons!
    px(kctx, 5,  13 + breath, 16, 15, "#14161a");
    px(kctx, 6,  14 + breath, 14, 13, "#4e5661");
    px(kctx, 8,  15 + breath, 10, 10, "#75808f");
    px(kctx, 12, 15 + breath, 2,  10, "#9aa6b8"); // Steel chest ridge
    // Spiked shoulder pauldrons
    px(kctx, 3,  12 + breath, 5,  6, "#14161a");
    px(kctx, 4,  13 + breath, 3,  4, "#8591a1");
    px(kctx, 18, 12 + breath, 5,  6, "#14161a");
    px(kctx, 19, 13 + breath, 3,  4, "#8591a1");

    // Great medieval steel broadsword planted at right side!
    px(kctx, 21, 14 + breath, 3, 24, "#171a1f");
    px(kctx, 22, 15 + breath, 1, 22, "#c8d4e3");
    px(kctx, 19, 18 + breath, 7, 2,  "#c9a44c"); // Brass crossguard

    // Towering visored Great Helm with glowing crimson eye slit & crimson plume!
    px(kctx, 11, 1 + breath, 4,  4, "#9e1c26"); // Red helm crest plume
    px(kctx, 8,  4 + breath, 10, 10, "#14161a");
    px(kctx, 9,  5 + breath, 8,  8, "#6b7582");
    px(kctx, 10, 5 + breath, 6,  2, "#9aa6b8");
    // Blazing crimson visor slit!
    px(kctx, 9,  9 + breath, 8,  2, "#0d0608");
    px(kctx, 10, 9 + breath, 2,  1, "#ff2e2e");
    px(kctx, 14, 9 + breath, 2,  1, "#ff2e2e");

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(Math.round(x - 10), Math.round(y - 2), 20, 5);
    ctx.drawImage(armorBuf, Math.round(x - 13), Math.round(y - 37));
    ctx.restore();
  }

  function drawDestinationMarker(ctx, x, y, timeSec) {
    const pulse = 0.65 + Math.sin(timeSec * 4.2) * 0.35;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 2, x, y, 22);
    g.addColorStop(0, `rgba(62, 166, 255, ${(0.45 * pulse).toFixed(3)})`);
    g.addColorStop(0.65, `rgba(42, 120, 235, ${(0.18 * pulse).toFixed(3)})`);
    g.addColorStop(1, "rgba(20, 80, 200, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 22, 44, 44);

    ctx.strokeStyle = `rgba(118, 205, 255, ${(0.85 * pulse).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y, 13, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(185, 235, 255, ${(0.72 * pulse).toFixed(2)})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ==================== 2. START / ROTATE / TURN RESOLUTION / WIN / DEATH ====================
  function startKnightEvent(matchState) {
    if (!matchState) return null;

    const savedLights = snapshotRoomLights(matchState);
    // Lights ON during the 10-second Player Turn!
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    const { keys, distMap } = getReachableRoomKeys(matchState.roomMap || {}, "0,0");
    const nonStart = keys.filter((k) => k !== "0,0");

    // 1. Pick Knight spawn room (strictly != "0,0" when possible; prefer dist >= 2!)
    const farKnight = nonStart.filter((k) => (distMap[k] || 0) >= 2);
    const knightPool = farKnight.length ? farKnight : (nonStart.length ? nonStart : ["0,0"]);
    const knightRoomKey = knightPool[Math.floor(Math.random() * knightPool.length)];

    // 2. Pick Demon Statue spawn room (prefer != knightRoomKey!)
    const statuePool = keys.filter((k) => k !== knightRoomKey);
    const statueRoomKey = statuePool.length
      ? statuePool[Math.floor(Math.random() * statuePool.length)]
      : "0,0";

    // 3. Pick Destination room (strictly != statueRoomKey!)
    const destPool = keys.filter((k) => k !== statueRoomKey);
    const destRoomKey = destPool.length
      ? destPool[Math.floor(Math.random() * destPool.length)]
      : "0,0";

    // Pick initial facing direction for Statue (avoid accidentally facing directly into Destination on turn 1!)
    const nonInstantDirs = DIRS.filter((d) => getConnectedNeighborKey(matchState.roomMap, statueRoomKey, d) !== destRoomKey);
    const initDir = nonInstantDirs.length
      ? nonInstantDirs[Math.floor(Math.random() * nonInstantDirs.length)]
      : DIRS[Math.floor(Math.random() * DIRS.length)];

    const statuePos = getSafeCenterForRoom(matchState.roomMap[statueRoomKey], 0);
    const knightPos = getSafeCenterForRoom(matchState.roomMap[knightRoomKey], 1);
    const destPos   = getSafeCenterForRoom(matchState.roomMap[destRoomKey], 2);

    matchState.knightEvent = {
      active: true,
      stage: "PLAYER_TURN", // PLAYER_TURN (10s) -> KNIGHT_TURN (~2.15s) -> repeat
      savedLights,
      turnNumber: 1,
      turnTimer: PLAYER_TURN_SEC,
      playerMovesLeft: 1,
      destRoomKey,
      destPos,
      statue: {
        roomKey: statueRoomKey,
        x: statuePos.x,
        y: statuePos.y,
        facingDir: initDir,
        activated: false // Remains stationary at spawn until player interacts/rotates it the first time!
      },
      knight: {
        roomKey: knightRoomKey,
        x: knightPos.x,
        y: knightPos.y
      },
      notice: "CHECK THE ROUND TABLE! RED=KNIGHT • BLUE=DESTINATION • GREEN=STATUE (10s/TURN)",
      noticeTimer: 6.0
    };

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE KNIGHT\nGUIDE THE DEMON STATUE (GREEN) TO THE DESTINATION (BLUE) & AVOID THE KNIGHT (RED)!\n1 ROOM PER TURN (10S) • PRESS [E] TO ROTATE STATUE • CHECK THE TABLE FOR POSITIONS!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5800);
    }

    return matchState.knightEvent;
  }

  function rotateStatue(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active || kn.stage !== "PLAYER_TURN") return false;

    const wasDormant = !kn.statue.activated;
    kn.statue.activated = true;
    const idx = DIRS.indexOf(kn.statue.facingDir);
    kn.statue.facingDir = DIRS[(idx + 1) % DIRS.length];

    // Play audio/moving.mp3 strictly taking the first 2.0 seconds!
    if (App.Audio && App.Audio.playPawnMove) {
      App.Audio.playPawnMove(2.0);
    }

    const nextKey = getConnectedNeighborKey(matchState.roomMap, kn.statue.roomKey, kn.statue.facingDir);
    const nextName = nextKey && matchState.roomMap[nextKey]
      ? (matchState.roomMap[nextKey].fullName || matchState.roomMap[nextKey].name)
      : null;

    kn.notice = nextName
      ? `${wasDormant ? "STATUE AWAKENED & " : "STATUE "}ROTATED -> ${DIR_LABELS[kn.statue.facingDir]} (OPEN -> ${nextName})`
      : `${wasDormant ? "STATUE AWAKENED & " : "STATUE "}ROTATED -> ${DIR_LABELS[kn.statue.facingDir]} (DEAD END — WILL STOP!)`;
    kn.noticeTimer = 3.2;

    if (tableGlanceOpen) renderTableGlanceModal(matchState);
    return true;
  }

  function canPlayerChangeRoom(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return true;
    return kn.stage === "PLAYER_TURN" && kn.playerMovesLeft > 0;
  }

  function onPlayerEnteredRoom(matchState, enteredRoom) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active || !enteredRoom) return;

    kn.playerMovesLeft = Math.max(0, kn.playerMovesLeft - 1);
    const rk = `${enteredRoom.x},${enteredRoom.y}`;

    if (rk === kn.knight.roomKey) {
      triggerKnightDeath(matchState, "YOU WALKED RIGHT INTO THE KNIGHT'S ROOM!");
      return;
    }

    if (rk === kn.statue.roomKey) {
      kn.notice = "YOU FOUND THE DEMON STATUE! PRESS [E] NEAR IT TO ROTATE ITS DIRECTION!";
      kn.noticeTimer = 3.5;
    } else {
      kn.notice = "1 / 1 ROOM MOVED THIS TURN — WAIT FOR THE KNIGHT TO MOVE...";
      kn.noticeTimer = 2.6;
    }
  }

  function executeKnightAndStatueTurn(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return;

    closeTableGlanceModal(true);
    kn.stage = "KNIGHT_TURN";
    kn.turnTimer = KNIGHT_TURN_SEC;

    // 1. Demon Statue ONLY moves once player has interacted/rotated it at least once!
    let statueMoved = false;
    if (kn.statue.activated) {
      const nextStatueKey = getConnectedNeighborKey(matchState.roomMap, kn.statue.roomKey, kn.statue.facingDir);
      if (nextStatueKey && kn.statue.roomKey !== kn.destRoomKey) {
        statueMoved = true;
        kn.statue.roomKey = nextStatueKey;
        const sp = getSafeCenterForRoom(matchState.roomMap[nextStatueKey], 0);
        kn.statue.x = sp.x;
        kn.statue.y = sp.y;

        if (kn.statue.roomKey === kn.destRoomKey) {
          triggerKnightWin(matchState);
          return;
        }
      }
    }

    // 2. The Knight (Bộ giáp) advances 1 room toward the player via BFS!
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const nextKnightKey = findBfsNextRoom(matchState.roomMap, kn.knight.roomKey, pRoomKey);
    if (nextKnightKey) {
      kn.knight.roomKey = nextKnightKey;
      const kp = getSafeCenterForRoom(matchState.roomMap[nextKnightKey], 1);
      kn.knight.x = kp.x;
      kn.knight.y = kp.y;
    }

    // Play audio/knight_footstep_sfx.mp3 strictly first 2.0s looped every time Knight moves!
    if (App.Audio && App.Audio.playKnightFootstep) {
      App.Audio.playKnightFootstep(2.0);
    }

    const knightRoomName = matchState.roomMap[kn.knight.roomKey]?.fullName || "THE DARK";
    kn.notice = `LIGHTS OUT — HEAVY ARMOR FOOTSTEPS ECHO (${!kn.statue.activated ? "STATUE DORMANT — ROTATE IT [E] FIRST" : statueMoved ? "STATUE SLID 1 ROOM" : "STATUE AT DEAD END"})...`;
    kn.noticeTimer = 2.2;

    // 3. Same-Room Kill Check!
    if (kn.knight.roomKey === pRoomKey) {
      setTimeout(() => {
        if (matchState.knightEvent && matchState.knightEvent.active) {
          triggerKnightDeath(matchState, `THE KNIGHT STEPPED INTO ${knightRoomName} WITH YOU!`);
        }
      }, 650);
    }
  }

  function triggerKnightWin(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn) return;

    closeTableGlanceModal(true);
    if (App.Audio && App.Audio.stopKnightFootstep) App.Audio.stopKnightFootstep();
    if (App.Audio && App.Audio.stopPawnMove) App.Audio.stopPawnMove();

    restoreRoomLights(matchState, kn.savedLights);
    kn.active = false;
    matchState.knightEvent = null;

    App.Audio.clockChime();
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE DEMON STATUE REACHED THE DESTINATION!\nTHE ARMORED KNIGHT COLLAPSES INTO EMPTY STEEL.",
        { success: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3800);
    }
  }

  function triggerKnightDeath(matchState, reasonMsg) {
    const kn = matchState && matchState.knightEvent;
    if (!kn) return;

    closeTableGlanceModal(true);
    if (App.Audio && App.Audio.stopKnightFootstep) App.Audio.stopKnightFootstep();
    if (App.Audio && App.Audio.stopPawnMove) App.Audio.stopPawnMove();

    const flash = document.getElementById("knight-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 860);
    }

    App.Audio.hexAlert();
    restoreRoomLights(matchState, kn.savedLights);
    kn.active = false;
    matchState.knightEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `${reasonMsg || "THE KNIGHT KILLED YOU!"}\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
    }
  }

  function update(dt, matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return;

    if (kn.noticeTimer > 0) {
      kn.noticeTimer = Math.max(0, kn.noticeTimer - dt);
      if (kn.noticeTimer === 0) kn.notice = "";
    }

    if (kn.stage === "PLAYER_TURN") {
      kn.turnTimer -= dt;
      if (tableGlanceOpen) {
        const timerEl = document.getElementById("knight-map-timer");
        if (timerEl) timerEl.textContent = `YOUR TURN: ${Math.max(0, Math.ceil(kn.turnTimer))}S`;
      }
      if (kn.turnTimer <= 0) {
        executeKnightAndStatueTurn(matchState);
      }
      return;
    }

    if (kn.stage === "KNIGHT_TURN") {
      kn.turnTimer -= dt;
      if (kn.turnTimer <= 0) {
        // Back to 10-second Player Turn!
        kn.stage = "PLAYER_TURN";
        kn.turnTimer = PLAYER_TURN_SEC;
        kn.playerMovesLeft = 1;
        kn.turnNumber += 1;

        Object.keys(matchState.roomMap || {}).forEach((k) => {
          matchState.roomLightStates[k] = true;
        });

        kn.notice = `TURN ${kn.turnNumber} — YOUR TURN (10S)! MOVE 1 ROOM OR ROTATE STATUE [E].`;
        kn.noticeTimer = 3.2;
        App.Audio.lightSwitch();
      }
    }
  }

  // ==================== 3. 3 GLOWING ORBS ON THE DINING ROOM ROUND TABLE + TACTICAL MAP MODAL ====================
  function renderTableOrbsOnParlorTable(ctx, cx, cy, timeSec, matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return;
    const map = matchState.roomMap || {};
    const pulse = 0.72 + Math.sin(timeSec * 6.5) * 0.28;

    const markers = [
      { key: kn.destRoomKey,     col: "#3ea6ff", rgb: "62, 166, 255",  offX: -1, offY: 0 }, // Blue: Destination
      { key: kn.statue.roomKey,  col: "#4df278", rgb: "77, 242, 120",  offX: 1,  offY: 0 }, // Green: Demon Statue
      { key: kn.knight.roomKey,  col: "#ff3b3b", rgb: "255, 59, 59",   offX: 0,  offY: -1 } // Red: Armored Knight
    ];

    markers.forEach((m) => {
      const r = map[m.key];
      if (!r) return;
      const rx = Math.max(cx - 13, Math.min(cx + 13, cx + r.x * 4 + m.offX));
      const ry = Math.max(cy - 10, Math.min(cy + 10, cy + r.y * 4 + m.offY));

      const g = ctx.createRadialGradient(rx, ry, 0.5, rx, ry, 5.5);
      g.addColorStop(0, `rgba(${m.rgb}, ${(0.95 * pulse).toFixed(2)})`);
      g.addColorStop(1, `rgba(${m.rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(rx - 6, ry - 6, 12, 12);
      px(ctx, rx - 1, ry - 1, 2, 2, m.col);
    });
  }

  function renderTableGlanceModal(matchState) {
    const kn = matchState && matchState.knightEvent;
    const gridEl = document.getElementById("knight-map-grid");
    const timerEl = document.getElementById("knight-map-timer");
    const legendEl = document.getElementById("knight-map-status");
    if (!kn || !gridEl) return;

    const map = matchState.roomMap || {};
    const rooms = Object.values(map);
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    rooms.forEach((r) => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y);
    });

    const cols = Math.max(1, maxX - minX + 1);
    const rows = Math.max(1, maxY - minY + 1);
    const step = Math.min(60, Math.floor(330 / Math.max(cols, rows, 3)));
    const tileSz = Math.max(38, step - 4);
    const cxOff = ((minX + maxX) / 2) * step;
    const cyOff = ((minY + maxY) / 2) * step;

    const dirArrows = { N: "▲", E: "▶", S: "▼", W: "◀" };

    gridEl.innerHTML = rooms.map((r) => {
      const rk = `${r.x},${r.y}`;
      const lx = r.x * step - cxOff;
      const ly = r.y * step - cyOff;
      const d = r.doors || {};
      const dots = [];
      if (rk === kn.knight.roomKey) dots.push(`<span class="kn-orb is-red" title="THE KNIGHT (DANGER!)"></span>`);
      if (rk === kn.destRoomKey)    dots.push(`<span class="kn-orb is-blue" title="DESTINATION"></span>`);
      if (rk === kn.statue.roomKey) dots.push(`<span class="kn-orb is-green" title="DEMON STATUE (Facing ${DIR_LABELS[kn.statue.facingDir]})">${dirArrows[kn.statue.facingDir]}</span>`);
      if (rk === pRoomKey)          dots.push(`<span class="kn-orb is-you" title="YOU"></span>`);

      return `
        <div class="kn-map-tile${rk === pRoomKey ? " is-player-room" : ""}" style="width:${tileSz}px;height:${tileSz}px;left:calc(50% + ${lx}px);top:calc(50% + ${ly}px);">
          ${d.N ? `<span class="kn-door d-n"></span>` : ""}
          ${d.E ? `<span class="kn-door d-e"></span>` : ""}
          ${d.S ? `<span class="kn-door d-s"></span>` : ""}
          ${d.W ? `<span class="kn-door d-w"></span>` : ""}
          <span class="kn-tile-lbl">${r.name}</span>
          <div class="kn-orb-row">${dots.join("")}</div>
        </div>`;
    }).join("");

    if (timerEl) timerEl.textContent = `YOUR TURN: ${Math.max(0, Math.ceil(kn.turnTimer))}S`;
    if (legendEl) {
      const sName = map[kn.statue.roomKey]?.name || kn.statue.roomKey;
      const dName = map[kn.destRoomKey]?.name || kn.destRoomKey;
      const kName = map[kn.knight.roomKey]?.name || kn.knight.roomKey;
      legendEl.innerHTML = `
        <span class="kn-leg-red">● KNIGHT: ${kName}</span>
        <span class="kn-leg-blue">● DESTINATION: ${dName}</span>
        <span class="kn-leg-green">● STATUE: ${sName} (${DIR_LABELS[kn.statue.facingDir]})</span>
      `;
    }
  }

  function openTableGlanceModal(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active || kn.stage !== "PLAYER_TURN") return false;
    tableGlanceOpen = true;
    renderTableGlanceModal(matchState);
    document.getElementById("knight-table-modal")?.classList.remove("hidden");
    App.Audio.open();
    return true;
  }

  function closeTableGlanceModal(silent) {
    if (!tableGlanceOpen) return;
    tableGlanceOpen = false;
    document.getElementById("knight-table-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  // ==================== 4. ROOM RENDERABLES, HIGHLIGHTS & PROMPTS ====================
  function getRoomRenderables(ctx, roomKey, timeSec, matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return [];
    const list = [];

    if (kn.destRoomKey === roomKey) {
      list.push({
        y: kn.destPos.y - 30,
        draw: () => drawDestinationMarker(ctx, kn.destPos.x, kn.destPos.y, timeSec)
      });
    }

    if (kn.statue.roomKey === roomKey) {
      const canAdv = Boolean(getConnectedNeighborKey(matchState.roomMap, kn.statue.roomKey, kn.statue.facingDir));
      list.push({
        y: kn.statue.y,
        draw: () => drawDemonStatueSprite(ctx, kn.statue.x, kn.statue.y, kn.statue.facingDir, timeSec, canAdv, kn.statue.activated)
      });
    }

    if (kn.knight.roomKey === roomKey) {
      list.push({
        y: kn.knight.y,
        draw: () => drawKnightArmorSprite(ctx, kn.knight.x, kn.knight.y, timeSec)
      });
    }

    return list;
  }

  function renderRoomHighlights(ctx, roomKey, timeSec, matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return;

    // 1. In The Dining Room, highlight the 3 glowing colored light orbs on the round table!
    if (roomKey === "0,0") {
      renderTableOrbsOnParlorTable(ctx, 104, 126, timeSec, matchState);
    }

    // 2. Subtle post-darkness rune glow on Destination & Statue eyes
    const pulse = 0.72 + Math.sin(timeSec * 5.0) * 0.28;
    if (kn.destRoomKey === roomKey) {
      const g = ctx.createRadialGradient(kn.destPos.x, kn.destPos.y, 2, kn.destPos.x, kn.destPos.y, 20);
      g.addColorStop(0, `rgba(74, 178, 255, ${(0.34 * pulse).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(kn.destPos.x - 20, kn.destPos.y - 20, 40, 40);
    }
    if (kn.statue.roomKey === roomKey) {
      const g = ctx.createRadialGradient(kn.statue.x, kn.statue.y - 12, 2, kn.statue.x, kn.statue.y - 12, 22);
      g.addColorStop(0, `rgba(77, 242, 120, ${(0.32 * pulse).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(kn.statue.x - 22, kn.statue.y - 34, 44, 44);
    }
  }

  function getRoomInteractable(roomKey, matchState, player) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active || kn.stage !== "PLAYER_TURN") return null;

    // 1. Demon Statue rotation prompt when in the same room!
    if (kn.statue.roomKey === roomKey && Math.hypot(player.x - kn.statue.x, player.y - kn.statue.y) <= 28) {
      const nextK = getConnectedNeighborKey(matchState.roomMap, kn.statue.roomKey, kn.statue.facingDir);
      const status = nextK ? `-> ${matchState.roomMap[nextK]?.name || "OPEN"}` : "(DEAD END)";
      return {
        type: "rotate_demon_statue",
        prompt: kn.statue.activated ? `[E] ROTATE DEMON STATUE (FACING ${DIR_LABELS[kn.statue.facingDir]} ${status})` : `[E] ROTATE & ACTIVATE DEMON STATUE (DORMANT)`
      };
    }

    // 2. Dining Room Round Table glance prompt to inspect the 3 glowing light dots closely!
    if (roomKey === "0,0" && Math.hypot(player.x - 104, player.y - 126) <= 44) {
      return {
        type: "knight_table_glance",
        prompt: "[E / T] CHECK TABLE LIGHTS (RED=KNIGHT • BLUE=DEST • GREEN=STATUE)"
      };
    }

    return null;
  }

  function getHudSummary(matchState) {
    const kn = matchState && matchState.knightEvent;
    if (!kn || !kn.active) return null;

    if (kn.stage === "KNIGHT_TURN") {
      return {
        title: `THE KNIGHT • TURN ${kn.turnNumber} • THE KNIGHT IS MOVING...`,
        sub: "LIGHTS OUT! HEAVY FOOTSTEPS IN THE DARK...",
        notice: kn.notice || ""
      };
    }

    const movesTxt = kn.playerMovesLeft > 0 ? "MOVES LEFT: 1 ROOM" : "MOVES LEFT: 0 (WAIT FOR TURN END)";
    return {
      title: `THE KNIGHT • TURN ${kn.turnNumber} • YOUR TURN: ${Math.max(0, Math.ceil(kn.turnTimer))}S`,
      sub: `${movesTxt}  |  CHECK TABLE IN DINING ROOM (RED/BLUE/GREEN)`,
      notice: kn.notice || ""
    };
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.knightEvent && matchState.knightEvent.active);
  }

  function isDarkPhase(matchState) {
    const kn = matchState && matchState.knightEvent;
    return Boolean(kn && kn.active && kn.stage === "KNIGHT_TURN");
  }

  function cleanup(matchState) {
    closeTableGlanceModal(true);
    if (App.Audio && App.Audio.stopKnightFootstep) App.Audio.stopKnightFootstep();
    document.getElementById("knight-jumpscare-flash")?.classList.add("hidden");
    if (matchState) matchState.knightEvent = null;
  }

  App.Knight = {
    startKnightEvent,
    rotateStatue,
    canPlayerChangeRoom,
    onPlayerEnteredRoom,
    openTableGlanceModal,
    closeTableGlanceModal,
    isTableGlanceOpen: () => tableGlanceOpen,
    update,
    getRoomRenderables,
    renderRoomHighlights,
    renderTableOrbsOnParlorTable,
    getRoomInteractable,
    getHudSummary,
    isActive,
    isDarkPhase,
    cleanup
  };
})(window.Duskwood);
