/* ==========================================================================
   DUSKWOOD INN - Singleplayer World Controller (Square Stardew Cabin + FP Table)
   - Spatial Grandfather Clock audio (`audio/clock_tick.mp3`) fades with distance
   - Crisp pixel-font Player Nameplate floating directly above the character's head
   - Sitting at any chair ([E]) switches straight into First-Person Table View
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let active = false;
  let paused = false;
  let dialogueOpen = false;
  let paintingOpen = false;
  let neighborModalOpen = false;
  let worldCanvas = null;
  let worldCtx = null;

  const roomBuffer = document.createElement("canvas");
  let rbCtx = null;

  const keys = {};
  let stepCooldown = 0;
  let roomTransitionAlpha = 0;
  let roomTransitionCooldown = 0;

  const DOOR_PORTALS = [
    { dir: "N", dx: 0,  dy: -1, opp: "S", x: 104, y: 56,  trigger: (px, py) => Math.abs(px - 104) <= 12 && py <= 58,  spawnX: 104, spawnY: 66,  inwardFacing: 1 },
    { dir: "S", dx: 0,  dy:  1, opp: "N", x: 104, y: 190, trigger: (px, py) => Math.abs(px - 104) <= 12 && py >= 188, spawnX: 104, spawnY: 178, inwardFacing: 1 },
    { dir: "W", dx: -1, dy:  0, opp: "E", x: 20,  y: 126, trigger: (px, py) => px <= 22 && Math.abs(py - 126) <= 12,  spawnX: 30,  spawnY: 126, inwardFacing: 1 },
    { dir: "E", dx: 1,  dy:  0, opp: "W", x: 188, y: 126, trigger: (px, py) => px >= 186 && Math.abs(py - 126) <= 12, spawnX: 178, spawnY: 126, inwardFacing: -1 }
  ];

  function getCurrentRoomObj() {
    if (!gameState.roomMap) return null;
    const k = `${gameState.currentRoomCoord.x},${gameState.currentRoomCoord.y}`;
    return gameState.roomMap[k] || gameState.roomMap["0,0"] || null;
  }

  function isInDiningRoom() {
    return gameState.currentRoomCoord.x === 0 && gameState.currentRoomCoord.y === 0;
  }

  function getConnectedNeighbor(dir) {
    const cur = getCurrentRoomObj();
    if (!cur || !cur.doors || !cur.doors[dir]) return null;
    const portal = DOOR_PORTALS.find((p) => p.dir === dir);
    if (!portal) return null;
    const nx = cur.x + portal.dx;
    const ny = cur.y + portal.dy;
    const nb = gameState.roomMap[`${nx},${ny}`];
    if (!nb || !nb.doors || !nb.doors[portal.opp]) return null;
    // The Cellar is strictly a 1-way room: you can ONLY exit FROM The Cellar, never walk INTO it!
    if (nb.id === "bp_cellar" && cur.id !== "bp_cellar") return null;
    return { room: nb, portal };
  }

  function enterMatchedRoom(dir) {
    if (App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(gameState)) {
      App.Audio.close();
      return false;
    }
    if (App.Endgame && App.Endgame.isLockedInChosenRoom(gameState)) {
      return false;
    }
    if (App.Knight && App.Knight.isActive(gameState) && !App.Knight.canPlayerChangeRoom(gameState)) {
      App.Audio.close();
      return false;
    }
    const conn = getConnectedNeighbor(dir);
    if (!conn) return false;

    const entryPortal = DOOR_PORTALS.find((p) => p.dir === conn.portal.opp);
    gameState.currentRoomCoord = { x: conn.room.x, y: conn.room.y };
    player.seated = false;
    player.x = entryPortal ? entryPortal.spawnX : 104;
    player.y = entryPortal ? entryPortal.spawnY : 126;
    if (entryPortal) player.facing = entryPortal.inwardFacing;

    if (App.Events && App.Events.exitSpectateToCellar) {
      App.Events.exitSpectateToCellar(gameState, true);
    }
    roomTransitionAlpha = 0.92;
    roomTransitionCooldown = 0.35;
    closeDialogue();
    App.Audio.doorTransition();
    if (App.Knight && App.Knight.isActive(gameState)) {
      App.Knight.onPlayerEnteredRoom(gameState, conn.room);
    }
    syncHud();
    return true;
  }

  const gameState = {
    mode: "SINGLEPLAYER",
    difficulty: "NORMAL",
    setupPhase: "INTRO",
    tableIntroDone: false,
    clockMinutes: 0,
    harvesterCardPlayed: false,
    harvesterSpawned: false,
    harvesterMinutes: 0,
    harvesterDelayTurns: 3,
    turnCount: 0,
    activeOmen: null,
    roomsBuilt: 1,
    roomMap: null,
    rimPlayedCards: [],
    archFlickerLight: 1.0,
    seatLabel: "SEAT 1",
    currentRoomCoord: { x: 0, y: 0 }
  };

  const player = {
    x: 68,
    y: 128,
    facing: 1,
    seated: true,
    chairId: 0,
    facingCorner: false,
    cornerLock: null,
    moving: false,
    sprinting: false,
    crouching: false,
    lanternOn: true,
    stamina: 100
  };

  function formatClock(minutesFromStart) {
    const totalMins = (12 * 60 + Math.round(minutesFromStart)) % (24 * 60);
    let h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  // Distance-based attenuation from the Grandfather Clock in Main Parlor (room 0,0)
  // Mutes clock ticking completely while any Event is active, restoring once event finishes (win/lose)!
  function updateSpatialClockAudio() {
    const eventRunning = Boolean(
      App.Events && App.Events.isAnyEventActive && App.Events.isAnyEventActive(gameState)
    );
    if (!active || paused || eventRunning) {
      App.Audio.setClockTickAttenuation(0);
      return;
    }

    const clock = App.GameRoom.CLOCK;
    const globalX = gameState.currentRoomCoord.x * App.GameRoom.ROOM_W + player.x;
    const globalY = gameState.currentRoomCoord.y * App.GameRoom.ROOM_H + player.y;
    const dist = Math.hypot(globalX - clock.x, globalY - clock.y);

    // Full volume right beside the clock (<=24px), noticeably softer across Parlor,
    // faint in adjacent rooms, completely silent beyond ~400px away from Main Parlor.
    const minDist = 24;
    const maxDist = 400;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const attenuation = Math.pow(1 - t, 1.65);

    App.Audio.setClockTickAttenuation(attenuation);
  }

  // Crisp pixel nameplate drawn directly above any character's head (local or Co-op teammate)
  function drawNameplateAt(worldX, worldY, rawName, ox, oy, scale, lightLevel, camX, camY, isTeammate) {
    if (lightLevel <= 0.12) return;
    const name = ((rawName || "SURVIVOR").trim() || "SURVIVOR").toUpperCase();

    const screenX = Math.round(ox + (worldX - (camX || 0)) * scale);
    const screenY = Math.round(oy + (worldY - (camY || 0) - 26.5) * scale);
    const fontSize = Math.max(11, Math.min(17, Math.round(scale * 3.8)));

    worldCtx.save();
    worldCtx.globalAlpha = Math.max(0, Math.min(1, (lightLevel - 0.1) / 0.65));
    worldCtx.font = `700 ${fontSize}px "Pixelify Sans", monospace`;
    worldCtx.textAlign = "center";
    worldCtx.textBaseline = "bottom";

    const textW = Math.ceil(worldCtx.measureText(name).width);
    const padX = 6;
    const padY = 2;
    const boxW = textW + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = Math.round(screenX - boxW / 2);
    const boxY = Math.round(screenY - boxH);

    worldCtx.fillStyle = isTeammate ? "rgba(12, 22, 34, 0.72)" : "rgba(8, 10, 15, 0.66)";
    worldCtx.fillRect(boxX, boxY, boxW, boxH);
    worldCtx.strokeStyle = isTeammate ? "rgba(130, 212, 255, 0.70)" : "rgba(188, 198, 212, 0.55)";
    worldCtx.lineWidth = 1;
    worldCtx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    worldCtx.fillStyle = "#07090d";
    const tx = screenX;
    const ty = screenY - padY + 1;
    worldCtx.fillText(name, tx - 1, ty);
    worldCtx.fillText(name, tx + 1, ty);
    worldCtx.fillText(name, tx, ty - 1);
    worldCtx.fillText(name, tx, ty + 1);

    worldCtx.fillStyle = isTeammate ? "#d8f2ff" : "#ffffff";
    worldCtx.fillText(name, tx, ty);
    worldCtx.restore();
  }

  function drawPlayerNameplate(ox, oy, scale, lightLevel, camX, camY) {
    drawNameplateAt(
      player.x,
      player.y,
      App.Config.state.character.name || "SURVIVOR",
      ox,
      oy,
      scale,
      lightLevel,
      camX,
      camY,
      false
    );
  }

  function syncHud() {
    const roomNameEl = document.getElementById("hud-room-name");
    const stateBadge = document.getElementById("hud-state-badge");
    const diffTag = document.getElementById("hud-diff-tag");
    const clockEl = document.getElementById("hud-clock-time");

    const inAttic = Boolean(App.Attic && App.Attic.isPlayerInAttic(gameState));
    const inBasement = Boolean(App.Basement && App.Basement.isActive(gameState));
    const inForest = Boolean(App.Endgame && App.Endgame.isInForestExit(gameState));
    const curRoom = getCurrentRoomObj();
    if (roomNameEl) {
      roomNameEl.textContent = inForest
        ? "DUSKWOOD FOREST (DAWN)"
        : inBasement
          ? "THE BASEMENT (UNDERGROUND)"
          : inAttic
            ? "THE ATTIC (MAZE)"
            : curRoom && curRoom.fullName ? curRoom.fullName : "THE DINING ROOM";
    }
    if (stateBadge) {
      stateBadge.textContent = inAttic
        ? "NO LANTERNS • RITUAL"
        : gameState.pendingPenaltyAnim
          ? "TIME LOST — RETURN TO TABLE [E]"
          : player.seated
            ? "SEATED AT TABLE"
            : player.crouching
              ? "CROUCHING (SILENT)"
              : "EXPLORING CABIN";
    }
    syncAtticHud();
    if (diffTag) {
      if (gameState.mode === "MULTIPLAYER" && App.Network && App.Network.isMultiplayerMatch()) {
        const netSt = App.Network.getState();
        diffTag.textContent = `CO-OP ${netSt.roomCode} (${netSt.occupiedCount}/4) • ${gameState.difficulty}`;
      } else {
        diffTag.textContent = gameState.difficulty;
      }
    }
    if (clockEl) clockEl.textContent = formatClock(gameState.clockMinutes);
  }

  function syncAtticHud() {
    const bar = document.getElementById("attic-hud-bar");
    if (!bar) return;

    const specHud = App.Events && App.Events.getSpectatorHudInfo
      ? App.Events.getSpectatorHudInfo(gameState)
      : null;

    if (specHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = specHud.title;
      if (heldEl) heldEl.textContent = specHud.sub;
      if (msgEl) {
        msgEl.textContent = "";
        msgEl.classList.add("hidden");
      }
      return;
    }

    const endgameHud = App.Endgame && App.Endgame.getHudSummary
      ? App.Endgame.getHudSummary(gameState)
      : null;

    if (endgameHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = endgameHud.title;
      if (heldEl) heldEl.textContent = endgameHud.sub;
      if (msgEl) {
        msgEl.textContent = endgameHud.notice || "";
        msgEl.classList.toggle("hidden", !endgameHud.notice);
      }
      return;
    }

    const knightHud = App.Knight && App.Knight.getHudSummary
      ? App.Knight.getHudSummary(gameState)
      : null;

    if (knightHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = knightHud.title;
      if (heldEl) heldEl.textContent = knightHud.sub;
      if (msgEl) {
        msgEl.textContent = knightHud.notice || "";
        msgEl.classList.toggle("hidden", !knightHud.notice);
      }
      return;
    }

    const stayLitHud = App.StayLit && App.StayLit.getHudSummary
      ? App.StayLit.getHudSummary(gameState)
      : null;

    if (stayLitHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = stayLitHud.title;
      if (heldEl) heldEl.textContent = stayLitHud.sub;
      if (msgEl) {
        msgEl.textContent = stayLitHud.notice || "";
        msgEl.classList.toggle("hidden", !stayLitHud.notice);
      }
      return;
    }

    const basementHud = App.Basement && App.Basement.getHudSummary
      ? App.Basement.getHudSummary(gameState, player)
      : null;

    if (basementHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = basementHud.title;
      if (heldEl) heldEl.textContent = basementHud.sub;
      if (msgEl) {
        msgEl.textContent = basementHud.notice || "";
        msgEl.classList.toggle("hidden", !basementHud.notice);
      }
      return;
    }

    const musicalHud = App.Musical && App.Musical.getHudSummary
      ? App.Musical.getHudSummary(gameState)
      : null;

    if (musicalHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = musicalHud.title;
      if (heldEl) heldEl.textContent = musicalHud.sub;
      if (msgEl) {
        msgEl.textContent = musicalHud.notice || "";
        msgEl.classList.toggle("hidden", !musicalHud.notice);
      }
      return;
    }

    const stalkerHud = App.Stalkers && App.Stalkers.getHudSummary
      ? App.Stalkers.getHudSummary(gameState, player)
      : null;

    if (stalkerHud) {
      bar.classList.remove("hidden");
      const progEl = document.getElementById("attic-hud-progress");
      const heldEl = document.getElementById("attic-hud-held");
      const msgEl = document.getElementById("attic-hud-notice");
      if (progEl) progEl.textContent = stalkerHud.title;
      if (heldEl) heldEl.textContent = stalkerHud.sub;
      if (msgEl) {
        msgEl.textContent = stalkerHud.notice || "";
        msgEl.classList.toggle("hidden", !stalkerHud.notice);
      }
      return;
    }

    const att = gameState.atticEvent;
    const show = Boolean(att && att.active);
    bar.classList.toggle("hidden", !show);
    if (!show) return;

    const progEl = document.getElementById("attic-hud-progress");
    const heldEl = document.getElementById("attic-hud-held");
    const msgEl = document.getElementById("attic-hud-notice");

    if (att.inAttic) {
      if (progEl) {
        progEl.textContent = att.won
          ? "RITUAL COMPLETE (5/5) — CLIMB DOWN [E]"
          : `TOTEMS PLACED: ${att.placedCount} / 5`;
      }
      if (heldEl) {
        const parts = [];
        if (att.holdingCandle) parts.push("CANDLE");
        if (att.heldTotemId) {
          const t = att.totems.find((x) => (x.uid || x.id) === att.heldTotemId);
          if (t) parts.push(t.name);
        }
        heldEl.textContent = parts.length
          ? `HOLDING: ${parts.join(" + ")}  |  [F] PICK/PLACE  [X] DROP`
          : "HANDS EMPTY  |  [F] PICK UP CANDLE / TOTEM";
      }
    } else {
      if (progEl) progEl.textContent = `THE ATTIC ACTIVE • LADDER IN ${att.ladderRoomName}`;
      if (heldEl) heldEl.textContent = `FIND THE PULL-DOWN LADDER AND CLIMB UP [E] (${att.placedCount}/5 TOTEMS)`;
    }

    if (msgEl) {
      msgEl.textContent = att.statusNotice || "";
      msgEl.classList.toggle("hidden", !att.statusNotice);
    }
  }

  function showDialogue(text) {
    dialogueOpen = true;
    const box = document.getElementById("hud-dialogue");
    const p = document.getElementById("hud-dialogue-text");
    if (p) p.textContent = text;
    if (box) box.classList.remove("hidden");
    App.Audio.open();
  }

  function closeDialogue() {
    if (!dialogueOpen) return;
    dialogueOpen = false;
    document.getElementById("hud-dialogue")?.classList.add("hidden");
    App.Audio.close();
  }

  function openPaintingModal(paintingId, roomId) {
    if (!App.PaintingsDB) return;
    const modal = document.getElementById("painting-inspect-modal");
    const imgEl = document.getElementById("painting-modal-img");
    const titleEl = document.getElementById("painting-modal-title");
    const artistEl = document.getElementById("painting-modal-artist");
    const noteEl = document.getElementById("painting-modal-note");
    const frameEl = document.getElementById("painting-frame-box");
    if (!modal || !imgEl) return;

    // Check if CORRUPT PAINTING clue has actually manifested in THIS room!
    const isCorrupted = App.Clues
      ? App.Clues.isRoomPaintingCorrupted(roomId, gameState)
      : false;

    const origArt = App.PaintingsDB.getById(paintingId);
    const corruptIdx = isCorrupted && App.Clues && App.Clues.getCorruptPaintingVariant
      ? App.Clues.getCorruptPaintingVariant(roomId, gameState)
      : 0;
    const art = isCorrupted
      ? (App.PaintingsDB.getCorruptVariant
          ? App.PaintingsDB.getCorruptVariant(corruptIdx)
          : App.PaintingsDB.getById("corrupt_omen"))
      : origArt;

    const fallbackUrl = App.PaintingsDB.buildFallbackDataUrl(origArt, isCorrupted);
    imgEl.onerror = () => {
      imgEl.onerror = null;
      imgEl.src = fallbackUrl;
    };
    imgEl.src = art.url || fallbackUrl;
    imgEl.alt = art.title;

    if (titleEl) titleEl.textContent = art.title;
    if (artistEl) artistEl.textContent = art.artist;
    if (noteEl) noteEl.textContent = art.note;
    if (frameEl) frameEl.classList.toggle("is-corrupted", isCorrupted);

    closeDialogue();
    paintingOpen = true;
    modal.classList.remove("hidden");
    if (isCorrupted) App.Audio.hexAlert();
    else App.Audio.open();
  }

  function closePaintingModal() {
    if (!paintingOpen) return;
    paintingOpen = false;
    neighborModalOpen = false;
    document.getElementById("painting-inspect-modal")?.classList.add("hidden");
    document.getElementById("neighbor-fp-modal")?.classList.add("hidden");
    document.getElementById("attic-hud-bar")?.classList.add("hidden");
    if (App.Jumpscare) App.Jumpscare.stop();
    App.Audio.close();
  }

  const NEIGHBOR_DIALOGUE_LINES = [
    "Hello, players...",
    "I am The Neighbor",
    "I am here to aid you in your game",
    "You may pick one of three options, but...",
    "only the person who played me gets to pick"
  ];

  let nbDialogueTimers = [];
  let nbTypeInterval = null;
  let nbLineIdx = 0;
  let nbCardsReady = false;
  let nbHandsOpenTarget = 0;
  let nbHandsOpenProgress = 0;

  function clearNeighborSeqTimers() {
    nbDialogueTimers.forEach((id) => clearTimeout(id));
    nbDialogueTimers = [];
    clearInterval(nbTypeInterval);
    nbTypeInterval = null;
    if (App.Audio && App.Audio.stopTypingSfx) App.Audio.stopTypingSfx();
  }

  function onNeighborDoorOpened(doorDir) {
    const dirNames = { S: "front (South)", N: "North", W: "West", E: "East" };
    showDialogue(
      `Knock, knock, knock... Someone is knocking at the ${dirNames[doorDir] || "front"} cabin door! Walk over and press [E] to open it.`
    );
  }

  function revealNeighborOptionCards() {
    nbHandsOpenTarget = 1;
    const cardsRow = document.getElementById("neighbor-choice-cards");
    if (!cardsRow) return;
    const cards = Array.from(cardsRow.querySelectorAll(".nb-option-card"));

    // Deal & flip each card sequentially from The Neighbor's hands (Card 1 -> Card 2 -> Card 3)!
    cards.forEach((cardEl, idx) => {
      const tDeal = setTimeout(() => {
        if (!neighborModalOpen) return;
        cardEl.classList.add("is-dealt");
        if (App.Audio && App.Audio.cardDraw) App.Audio.cardDraw();
      }, idx * 240);

      const tFlip = setTimeout(() => {
        if (!neighborModalOpen) return;
        cardEl.classList.add("is-flipped");
        if (App.Audio && App.Audio.cardDeal) App.Audio.cardDeal();
        if (idx === cards.length - 1) {
          nbCardsReady = true;
        }
      }, 540 + idx * 460);

      nbDialogueTimers.push(tDeal, tFlip);
    });
  }

  function playNeighborDialogueLine(idx) {
    clearNeighborSeqTimers();
    if (!neighborModalOpen) return;
    nbLineIdx = idx;

    const textEl = document.getElementById("neighbor-bottom-text");
    const skipHint = document.getElementById("neighbor-skip-hint");
    const fullLine = NEIGHBOR_DIALOGUE_LINES[idx] || "";
    if (!textEl) return;

    textEl.textContent = "";
    let shown = 0;
    const isFinalLine = idx >= NEIGHBOR_DIALOGUE_LINES.length - 1;
    if (skipHint) skipHint.classList.toggle("hidden", isFinalLine);

    const revealMs = Math.min(2400, Math.max(1050, fullLine.length * 48));
    const stepMs = Math.max(24, Math.floor(revealMs / Math.max(1, fullLine.length)));

    if (App.Audio && App.Audio.playTypingSfx) {
      App.Audio.playTypingSfx(revealMs / 1000 + 0.2);
    }

    nbTypeInterval = setInterval(() => {
      shown += 1;
      textEl.textContent = fullLine.slice(0, shown);
      if (shown >= fullLine.length) {
        clearInterval(nbTypeInterval);
        nbTypeInterval = null;
        if (App.Audio && App.Audio.stopTypingSfx) App.Audio.stopTypingSfx();

        if (isFinalLine) {
          // Final line reached ("only the person who played me gets to pick") -> Deal & Flip 3 cards from The Neighbor's hands!
          const tCard = setTimeout(() => revealNeighborOptionCards(), 260);
          nbDialogueTimers.push(tCard);
        } else {
          // Pause briefly so player reads the line, then advance automatically to the next line!
          const tNext = setTimeout(() => playNeighborDialogueLine(idx + 1), 1350);
          nbDialogueTimers.push(tNext);
        }
      }
    }, stepMs);
  }

  function advanceNeighborDialogueManually() {
    if (!neighborModalOpen || nbCardsReady) return;
    if (nbLineIdx < NEIGHBOR_DIALOGUE_LINES.length - 1) {
      playNeighborDialogueLine(nbLineIdx + 1);
    } else if (nbTypeInterval) {
      clearNeighborSeqTimers();
      const textEl = document.getElementById("neighbor-bottom-text");
      if (textEl) textEl.textContent = NEIGHBOR_DIALOGUE_LINES[NEIGHBOR_DIALOGUE_LINES.length - 1];
      revealNeighborOptionCards();
    }
  }

  function openNeighborModal() {
    const nb = gameState.neighborEncounter;
    if (!nb || !nb.active) return;

    // Opening the door for The Neighbor -> Stop knock SFX & play 5s audio/door_open_sfx.mp3!
    if (!nb.doorOpened) {
      nb.doorOpened = true;
      if (App.Audio && App.Audio.stopDoorKnock) App.Audio.stopDoorKnock();
      if (App.Audio && App.Audio.playDoorOpen) App.Audio.playDoorOpen(5.0);
    }

    const modal = document.getElementById("neighbor-fp-modal");
    const cardsRow = document.getElementById("neighbor-choice-cards");
    if (!modal || !cardsRow) return;

    const ORNATE_GOLD_FRAME = `
      <svg viewBox="0 0 220 230" preserveAspectRatio="none" class="nb-card-frame" aria-hidden="true">
        <path d="M28,8 L192,8 Q194,20 206,20 L212,20 L212,34 Q202,38 202,50 L202,180 Q202,192 212,196 L212,210 L206,210 Q194,210 192,222 L28,222 Q26,210 14,210 L8,210 L8,196 Q18,192 18,180 L18,50 Q18,38 8,34 L8,20 L14,20 Q26,20 28,8 Z"
              fill="none" stroke="#855b14" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M33,14 L187,14 Q190,25 201,25 L206,25 L206,33 Q196,38 196,50 L196,180 Q196,192 206,197 L206,205 L201,205 Q190,205 187,216 L33,216 Q30,205 19,205 L14,205 L14,197 Q24,192 24,180 L24,50 Q24,38 14,33 L14,25 L19,25 Q30,25 33,14 Z"
              fill="none" stroke="#fce29a" stroke-width="1.6"/>
      </svg>`;

    const CARD_BACK_EMBLEM = `
      <svg viewBox="0 0 120 150" class="nb-back-svg" aria-hidden="true">
        <rect x="8" y="8" width="104" height="134" rx="5" fill="none" stroke="#d9a848" stroke-width="3"/>
        <rect x="15" y="15" width="90" height="120" rx="3" fill="none" stroke="#8c6320" stroke-width="1.5"/>
        <circle cx="60" cy="75" r="26" fill="none" stroke="#e8be63" stroke-width="2.2"/>
        <path d="M60,36 L74,75 L60,114 L46,75 Z" fill="#8c6320" stroke="#f5d587" stroke-width="1.6"/>
        <circle cx="60" cy="75" r="7" fill="#1a120a" stroke="#f5d587" stroke-width="1.8"/>
      </svg>`;

    cardsRow.innerHTML = (nb.options || [])
      .map(
        (opt, idx) => `
        <button type="button" class="nb-option-card nb-slot-${idx}" data-neighbor-option="${opt.id}">
          <div class="nb-card-3d-inner">
            <div class="nb-card-face nb-card-back">
              ${CARD_BACK_EMBLEM}
            </div>
            <div class="nb-card-face nb-card-front">
              ${ORNATE_GOLD_FRAME}
              <span class="nb-opt-key">${idx + 1}</span>
              <span class="nb-opt-title">${opt.title}</span>
              <span class="nb-opt-desc">${opt.desc}</span>
            </div>
          </div>
        </button>`
      )
      .join("");

    closeDialogue();
    nbCardsReady = false;
    nbHandsOpenTarget = 0;
    nbHandsOpenProgress = 0;
    neighborModalOpen = true;
    modal.classList.remove("hidden");

    // Start the 5-line bottom ink-smudge dialogue sequence right after the door swings open!
    const tStart = setTimeout(() => playNeighborDialogueLine(0), 650);
    nbDialogueTimers.push(tStart);
  }

  function closeNeighborModal(silent) {
    if (!neighborModalOpen) return;
    clearNeighborSeqTimers();
    nbCardsReady = false;
    nbHandsOpenTarget = 0;
    nbHandsOpenProgress = 0;
    neighborModalOpen = false;
    document.getElementById("neighbor-fp-modal")?.classList.add("hidden");
    if (App.Audio && App.Audio.stopDoorOpen) App.Audio.stopDoorOpen();
    if (!silent) App.Audio.close();
  }

  function pickNeighborOption(optionId) {
    if (!neighborModalOpen || !nbCardsReady) return;
    closeNeighborModal(true);
    App.Audio.clockChime();
    const summary = App.TableView && App.TableView.resolveNeighborBargain
      ? App.TableView.resolveNeighborBargain(optionId)
      : "";
    App.Audio.doorTransition();
    syncHud();
    if (summary) {
      showDialogue(`The front door clicks shut. ${summary}`);
    }
  }

  function enterFirstPersonTable() {
    if (App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(gameState)) {
      showDialogue("You are dead and locked inside The Cellar until the event ends! Press [P] to spectate living players (Q / E to switch).");
      return;
    }
    if (App.Events && App.Events.isCuttingCornersActive(gameState)) {
      return;
    }
    if (gameState.neighborEncounter && gameState.neighborEncounter.active) {
      showDialogue("The front door is wide open. Stand up [E] and inspect The Neighbor outside first.");
      return;
    }
    if (App.Attic && App.Attic.isAtticActive(gameState)) {
      const rn = gameState.atticEvent?.ladderRoomName || "the cabin";
      showDialogue(`The Attic ritual is active! Climb the pull-down ladder in ${rn} and banish the Ghost first.`);
      return;
    }
    if (App.Stalkers && App.Stalkers.isTallManActive(gameState)) {
      showDialogue("The Tall Man is hunting! Switch OFF every room light across the cabin first.");
      return;
    }
    if (App.Stalkers && App.Stalkers.isRedBalloonsActive(gameState)) {
      showDialogue("Red Balloons is active! Crouch [C], use your Lantern [F], and pop the Golden Balloon first.");
      return;
    }
    if (App.Stalkers && App.Stalkers.isFeelingSmallActive && App.Stalkers.isFeelingSmallActive(gameState)) {
      showDialogue("Feeling Small? is active! Follow the Toy Train sound and deliver all 4 shapes first.");
      return;
    }
    if (App.Musical && App.Musical.isActive && App.Musical.isActive(gameState)) {
      showDialogue("Musical Rooms is active! Throw 20 popcorns [F] into the box — when the music stops, hide in the glowing Red Room!");
      return;
    }
    if (App.Basement && App.Basement.isActive && App.Basement.isActive(gameState)) {
      showDialogue("The Basement is active! Repair all 5 red fuse boxes [HOLD F] first.");
      return;
    }
    if (App.StayLit && App.StayLit.isActive && App.StayLit.isActive(gameState)) {
      showDialogue("Stay in the Light is active! Survive in the 2 lit rooms for 90 seconds first.");
      return;
    }
    if (App.Knight && App.Knight.isActive && App.Knight.isActive(gameState)) {
      if (isInDiningRoom()) {
        if (App.Knight.isTableGlanceOpen()) App.Knight.closeTableGlanceModal(false);
        else App.Knight.openTableGlanceModal(gameState);
      } else {
        showDialogue("Return to The Dining Room to check the 3 glowing lights on the round table!");
      }
      return;
    }
    if (App.Endgame && App.Endgame.isEndgameActive(gameState)) {
      if (!App.Endgame.canInspectTableMap || !App.Endgame.canInspectTableMap(gameState)) {
        showDialogue("12:00 AM — The game has ended. Find your way out!");
        return;
      }
    }
    if (!isInDiningRoom()) {
      showDialogue("Return to The Dining Room and sit at the round table first.");
      return;
    }
    if (!player.seated) {
      showDialogue("Walk up to a chair and press [E] to sit at the round table first.");
      return;
    }
    closeDialogue();
    gameState.seatLabel = gameState.mode === "MULTIPLAYER"
      ? `SEAT ${(gameState.localSeatIdx || 0) + 1}`
      : App.GameRoom.CHAIRS[player.chairId].label;
    App.TableView.open(
      gameState,
      () => standUp(),
      () => syncHud()
    );
  }

  function setPaused(val) {
    paused = val;
    document.getElementById("pause-overlay")?.classList.toggle("hidden", !paused);
    if (paused) {
      if (App.Audio.setAtticGhostAttenuation) App.Audio.setAtticGhostAttenuation(0);
      if (App.Audio.setToyTrainAttenuation) App.Audio.setToyTrainAttenuation(0);
      if (App.Audio.setMonkeySfxAttenuation) App.Audio.setMonkeySfxAttenuation(0);
      if (App.Audio.setChainsawAttenuation) App.Audio.setChainsawAttenuation(0);
      if (App.Audio.setBalloonsSfxAttenuation) App.Audio.setBalloonsSfxAttenuation(0);
    }
    updateSpatialClockAudio();
    if (paused) App.Audio.open();
    else App.Audio.close();
  }

  function standUp() {
    if (App.TableView.isOpen()) App.TableView.close(true);
    if (!player.seated) return;

    const chair = App.GameRoom.CHAIRS[player.chairId];
    player.seated = false;
    if (chair.dir === "W") { player.x = chair.x - 14; player.y = chair.y + 2; }
    else if (chair.dir === "E") { player.x = chair.x + 14; player.y = chair.y + 2; }
    else if (chair.dir === "N") { player.x = chair.x; player.y = chair.y - 12; }
    else { player.x = chair.x; player.y = chair.y + 14; }

    App.Audio.chairCreak();
    syncHud();
  }

  function forceStandUpForEvent() {
    if (App.TableView.isOpen()) App.TableView.close(true);
    closeDialogue();
    closePaintingModal();
    if (player.seated) {
      standUp();
    }
  }

  function respawnInCellar() {
    const map = gameState.roomMap || {};
    const cellar = Object.values(map).find((r) => r.id === "bp_cellar");
    player.seated = false;
    player.facingCorner = false;
    player.cornerLock = null;
    if (cellar) {
      gameState.currentRoomCoord = { x: cellar.x, y: cellar.y };
      player.x = 104;
      player.y = 126;
      player.facing = 1;
    } else {
      gameState.currentRoomCoord = { x: 0, y: 0 };
      player.x = 42;
      player.y = 132;
    }
    roomTransitionAlpha = 0.96;
    roomTransitionCooldown = 0.45;
    syncHud();
  }

  function sitAtChair(chair, openFirstPerson) {
    player.seated = true;
    player.chairId = chair.id;
    player.x = chair.seatX;
    player.y = chair.seatY;
    player.facing = chair.facing;
    player.moving = false;
    player.sprinting = false;
    player.crouching = false;
    App.Audio.chairCreak();
    syncHud();

    if (openFirstPerson) {
      enterFirstPersonTable();
    }
  }

  function findNearestTarget() {
    if (App.Endgame && App.Endgame.isCutsceneBlocking(gameState)) {
      return null;
    }
    if (App.Endgame && App.Endgame.isInForestExit(gameState)) {
      return App.Endgame.getForestPrompt(gameState, player);
    }
    if (App.Endgame && App.Endgame.isLocalDeadSpectator && App.Endgame.isLocalDeadSpectator(gameState)) {
      return null;
    }
    if (App.Endgame && App.Endgame.isDaylightWinMode(gameState) && isInDiningRoom()) {
      const sp = DOOR_PORTALS.find((p) => p.dir === "S");
      if (sp && Math.hypot(player.x - sp.x, player.y - sp.y) <= 28) {
        return { type: "dawn_exit_door", prompt: "[E] STEP OUTSIDE INTO THE MORNING FOREST" };
      }
    }
    if (App.Attic && App.Attic.isPlayerInAttic(gameState)) {
      return App.Attic.getAtticPrompt(gameState, player);
    }
    if (App.Basement && App.Basement.isActive(gameState)) {
      return App.Basement.getPrompt(gameState, player);
    }

    const cc = gameState.events && gameState.events.cuttingCorners;
    if (cc && cc.stage === "SCRAMBLE") {
      if (player.facingCorner) {
        return { type: "corner_leave", prompt: "FACING CORNER  |  [E] STEP AWAY" };
      }
      const curRoom = getCurrentRoomObj();
      if (curRoom && App.Events) {
        const corners = App.Events.getValidCornersForRoom(curRoom, gameState.roomMap);
        for (const cPt of corners) {
          if (Math.hypot(player.x - cPt.x, player.y - cPt.y) <= 22) {
            return { type: "corner_face", corner: cPt, prompt: "[E] FACE CORNER" };
          }
        }
      }
    }
    if (cc && (cc.stage === "QUESTION" || cc.stage === "FEEDBACK" || cc.stage === "DEATH" || cc.stage === "SURVIVED")) {
      return null;
    }

    if (player.seated && isInDiningRoom()) {
      if (gameState.neighborEncounter && gameState.neighborEncounter.active) {
        return { type: "seated", prompt: "[E] STAND UP & ANSWER THE DOOR" };
      }
      if (App.Endgame && App.Endgame.canInspectTableMap && App.Endgame.canInspectTableMap(gameState)) {
        return { type: "seated", prompt: "[T] CHECK ROOM MAP   |   [E] STAND UP" };
      }
      return { type: "seated", prompt: "[T] FIRST-PERSON TABLE VIEW   |   [E] STAND UP" };
    }

    // Check THE NEIGHBOR waiting at the open Main Parlor door!
    if (isInDiningRoom() && gameState.neighborEncounter && gameState.neighborEncounter.active) {
      const nbDir = gameState.neighborEncounter.doorDir || "S";
      const nbPortal = DOOR_PORTALS.find((p) => p.dir === nbDir);
      if (nbPortal && Math.hypot(player.x - nbPortal.x, player.y - nbPortal.y) <= 28) {
        return {
          type: "neighbor_door",
          prompt: gameState.neighborEncounter.doorOpened
            ? "[E] SPEAK TO THE NEIGHBOR"
            : "[E] OPEN DOOR FOR THE NEIGHBOR"
        };
      }
    }

    // 00. Check Musical Rooms popcorn pickup / oblique throw prompt!
    if (App.Musical && App.Musical.getPrompt) {
      const mPrompt = App.Musical.getPrompt(gameState, player);
      if (mPrompt) return mPrompt;
    }

    // 00b. Check The Knight event Demon Statue [E] or Round Table 3-lights glance!
    if (App.Knight && App.Knight.getRoomInteractable) {
      const curRK = `${gameState.currentRoomCoord.x},${gameState.currentRoomCoord.y}`;
      const kTarget = App.Knight.getRoomInteractable(curRK, gameState, player);
      if (kTarget) return kTarget;
    }

    // 0a. Check Red / Golden Balloon to pop with [E] in current room!
    if (App.Stalkers && App.Stalkers.getRoomInteractable) {
      const curRK = `${gameState.currentRoomCoord.x},${gameState.currentRoomCoord.y}`;
      const bTarget = App.Stalkers.getRoomInteractable(curRK, gameState, player);
      if (bTarget) return bTarget;
    }

    // 0. Check spawned Pull-Down Attic Ladder in the current room!
    if (App.Attic && App.Attic.isAtticActive(gameState)) {
      const ladderIt = App.Attic.getRoomLadderInteractable(getCurrentRoomObj(), gameState);
      if (ladderIt && Math.hypot(player.x - ladderIt.x, player.y - ladderIt.y) <= ladderIt.r) {
        return { type: "attic_ladder_up", prompt: ladderIt.prompt };
      }
    }

    // 1. Check connected open doorways first (works in ALL rooms, sealed during Final Judgment or MP Cellar Lockdown!)
    if (!(App.Endgame && App.Endgame.isLockedInChosenRoom(gameState)))
    for (const portal of DOOR_PORTALS) {
      const conn = getConnectedNeighbor(portal.dir);
      if (!conn) continue;
      const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
      if (dist <= 22) {
        if (App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(gameState)) {
          return { type: "cellar_locked", prompt: "CELLAR DOOR LOCKED UNTIL EVENT ENDS  |  PRESS [P] TO SPECTATE" };
        }
        if (App.Knight && App.Knight.isActive(gameState) && !App.Knight.canPlayerChangeRoom(gameState)) {
          return { type: "knight_move_spent", prompt: "1 / 1 ROOM MOVED — WAIT FOR NEXT TURN" };
        }
        const destName = conn.room.fullName || conn.room.name;
        return { type: "portal", dir: portal.dir, prompt: `[E] ENTER ${destName}` };
      }
    }

    // 1b. Check revealed Clue Focus-Inspect points in current room (Dining Room OR any Cabin Room!)
    const curRoomForClues = getCurrentRoomObj();
    if (curRoomForClues && App.Clues) {
      const clueItems = App.Clues.getRoomClueInteractables(curRoomForClues, gameState);
      for (const item of clueItems) {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist <= item.r) {
          return { type: "prop", item, prompt: item.prompt };
        }
      }
    }

    // 2. Dining Room chairs & props
    if (isInDiningRoom()) {
      const egActive = Boolean(App.Endgame && App.Endgame.isEndgameActive(gameState));
      const egCanMap = Boolean(App.Endgame && App.Endgame.canInspectTableMap && App.Endgame.canInspectTableMap(gameState));
      if (!egActive || egCanMap) {
        const isMp = gameState.mode === "MULTIPLAYER";
        const myChairId = typeof gameState.localChairId === "number" ? gameState.localChairId : 0;
        const mySeatNum = (gameState.localSeatIdx || 0) + 1;
        for (const chair of App.GameRoom.CHAIRS) {
          const dist = Math.hypot(player.x - chair.x, player.y - chair.y);
          if (dist > 22) continue;

          if (isMp && chair.id !== myChairId) {
            return {
              type: "chair_locked",
              chair,
              prompt: `FIXED SEAT — GO TO YOUR CHAIR (SEAT ${mySeatNum})`
            };
          }
          if (App.Network && App.Network.isMultiplayerMatch() && App.Network.isChairOccupiedByRemote(chair.id)) {
            continue;
          }
          return {
            type: "chair",
            chair,
            prompt: egCanMap
              ? `[E] CHECK ROOM MAP (SEAT ${mySeatNum})`
              : isMp
                ? `[E] SIT AT YOUR CHAIR (SEAT ${mySeatNum})`
                : `[E] SIT AT TABLE (${chair.label})`
          };
        }
      }

      for (const item of App.GameRoom.INTERACTABLES) {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist <= item.r) {
          let label = item.prompt;
          if (item.type === "light_switch") {
            const isOn = !(gameState.roomLightStates && gameState.roomLightStates["0,0"] === false);
            label = isOn ? "[E] TURN LIGHT OFF" : "[E] TURN LIGHT ON";
          }
          return { type: "prop", item, prompt: label };
        }
      }
      return null;
    }

    // 3. Current non-Dining room interactables (Portraits & Light Switches)
    const curRoom = getCurrentRoomObj();
    if (curRoom && App.CabinRooms) {
      const rData = App.CabinRooms.getRoomData(curRoom, gameState.roomMap);
      for (const item of rData.interactables || []) {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist <= item.r) {
          let label = item.prompt;
          if (item.type === "light_switch") {
            const rk = `${curRoom.x},${curRoom.y}`;
            const isOn = !(gameState.roomLightStates && gameState.roomLightStates[rk] === false);
            label = isOn ? "[E] TURN LIGHT OFF" : "[E] TURN LIGHT ON";
          }
          return { type: "prop", item, prompt: label };
        }
      }
    }
    return null;
  }

  function handleInteract() {
    if (App.Clues && App.Clues.isInspectOpen()) {
      App.Clues.closeInspectModal(false);
      return;
    }
    if (paintingOpen) {
      closePaintingModal();
      return;
    }
    if (dialogueOpen) {
      closeDialogue();
      return;
    }
    if (player.seated && isInDiningRoom()) {
      standUp();
      return;
    }
    const target = findNearestTarget();
    if (!target) return;

    if (target.type === "corner_face") {
      player.x = target.corner.x;
      player.y = target.corner.y;
      player.facingCorner = true;
      player.cornerLock = target.corner;
      player.moving = false;
      App.Audio.click();
    } else if (target.type === "corner_leave") {
      player.facingCorner = false;
      player.cornerLock = null;
      App.Audio.click();
    } else if (target.type === "neighbor_door") {
      const nb = gameState.neighborEncounter;
      if (
        gameState.mode === "MULTIPLAYER" &&
        nb &&
        typeof nb.ownerSeatId === "number" &&
        nb.ownerSeatId !== (gameState.localSeatIdx || 0)
      ) {
        const ownerName = (App.Network && App.Network.getSeatName)
          ? App.Network.getSeatName(nb.ownerSeatId)
          : `SEAT ${nb.ownerSeatId + 1}`;
        showDialogue(`Only ${ownerName} (who played The Neighbor) may answer and pick the bargain.`);
      } else {
        openNeighborModal();
      }
    } else if (target.type === "attic_ladder_up") {
      if (App.Attic && App.Attic.enterAttic(gameState, player)) {
        roomTransitionAlpha = 0.94;
        syncHud();
      }
    } else if (target.type === "attic_ladder_down") {
      const res = App.Attic && App.Attic.exitAtticDownLadder(gameState, player);
      if (res) {
        roomTransitionAlpha = 0.94;
        syncHud();
        if (res.finishedWin) {
          showDialogue("The Attic Stalker has been banished! The ladder folds back into the ceiling.");
        }
      }
    } else if (target.type === "attic_place") {
      if (App.Attic) App.Attic.handlePickUpOrPlace(gameState, player);
      syncHud();
    } else if (target.type === "pop_balloon") {
      if (App.Stalkers) App.Stalkers.popBalloon(gameState, target.balloonId);
      syncHud();
    } else if (target.type === "rotate_demon_statue") {
      if (App.Knight) App.Knight.rotateStatue(gameState);
      syncHud();
    } else if (target.type === "knight_table_glance") {
      if (App.Knight) App.Knight.openTableGlanceModal(gameState);
    } else if (target.type === "pickup_shape" || target.type === "toy_train") {
      if (App.Stalkers) App.Stalkers.handleFeelingSmallInteract(gameState, player, target);
      syncHud();
    } else if (target.type === "dawn_exit_door") {
      if (App.Endgame && App.Endgame.enterForestExitMap(gameState, player)) {
        roomTransitionAlpha = 0.92;
        syncHud();
      }
    } else if (target.type === "escape_car") {
      if (App.Endgame && App.Endgame.startCarEscapeDrive(gameState, player)) {
        syncHud();
      }
    } else if (target.type === "portal") {
      enterMatchedRoom(target.dir);
    } else if (target.type === "chair_locked") {
      showDialogue(`Every guest has a fixed seat! Walk to your assigned chair (SEAT ${(gameState.localSeatIdx || 0) + 1}).`);
    } else if (target.type === "chair") {
      if (App.Events && App.Events.isCuttingCornersActive(gameState)) return;
      sitAtChair(target.chair, true);
    } else if (target.type === "prop") {
      if (target.item.clueInspect && App.Clues) {
        closeDialogue();
        App.Clues.openInspectModal(target.item.clueInspect, gameState);
      } else if (target.item.paintingId) {
        openPaintingModal(target.item.paintingId, target.item.roomId || "dining_room");
      } else if (target.item.type === "light_switch") {
        if ((App.Events && App.Events.isGlobalLightsOut(gameState)) || (App.StayLit && App.StayLit.isActive(gameState))) {
          App.Audio.lightSwitch();
          return;
        }
        const rk = `${gameState.currentRoomCoord.x},${gameState.currentRoomCoord.y}`;
        gameState.roomLightStates = gameState.roomLightStates || { "0,0": true };
        const isCurrentlyOn = gameState.roomLightStates[rk] !== false;
        gameState.roomLightStates[rk] = !isCurrentlyOn;
        if (gameState.mode === "MULTIPLAYER" && App.Network && App.Network.isMultiplayerMatch()) {
          App.Network.sendGameAction("MP_LIGHT_SWITCH", { rk, isOn: gameState.roomLightStates[rk] });
        }
        App.Audio.lightSwitch();
        if (App.Stalkers && App.Stalkers.onLightSwitchToggled) {
          App.Stalkers.onLightSwitchToggled(gameState);
        }
        syncHud();
      } else if (target.item.id === "grandfather_clock") {
        const nowStr = formatClock(gameState.clockMinutes);
        const harvMsg = !gameState.tableIntroDone
          ? "Sit at the round table and look down to begin the ritual."
          : !gameState.harvesterCardPlayed
            ? "The groove at XII is quiet — for now."
            : !gameState.harvesterSpawned
              ? `Something scratches beneath XII — ${gameState.harvesterDelayTurns} turn(s) remain.`
              : `The Hollow Harvester trails ${Math.max(0, gameState.clockMinutes - gameState.harvesterMinutes)} minutes behind your piece.`;
        showDialogue(`The antique grandfather clock reads ${nowStr}. ${harvMsg}`);
      } else {
        showDialogue(target.item.text);
      }
    }
  }

  function collidesAt(nx, ny) {
    if (App.Endgame && App.Endgame.isInForestExit(gameState)) {
      return App.Endgame.collidesInForest(nx, ny, gameState);
    }
    if (App.Attic && App.Attic.isPlayerInAttic(gameState)) {
      return App.Attic.collidesInAttic(nx, ny);
    }
    if (App.Basement && App.Basement.isInBasementMap(gameState)) {
      return App.Basement.collidesInBasement(nx, ny);
    }
    let colliders = [];

    if (isInDiningRoom()) {
      const b = App.GameRoom.FLOOR_BOUNDS;
      if (nx < b.minX || nx > b.maxX || ny < b.minY || ny > b.maxY) return true;
      colliders = App.GameRoom.COLLIDERS.concat(
        App.Events && App.Events.getParlorColliders ? App.Events.getParlorColliders(gameState) : []
      );
    } else {
      const curRoom = getCurrentRoomObj();
      if (!curRoom || !App.CabinRooms) return true;
      const rData = App.CabinRooms.getRoomData(curRoom, gameState.roomMap);
      const walkRects = rData.walkRects || [App.GameRoom.FLOOR_BOUNDS];
      const insideFloor = walkRects.some(
        (r) => nx >= r.minX && nx <= r.maxX && ny >= r.minY && ny <= r.maxY
      );
      if (!insideFloor) return true;
      colliders = rData.colliders || [];
    }

    const footW = 10;
    const footH = 6;
    const px1 = nx - footW / 2;
    const py1 = ny - footH;
    const px2 = nx + footW / 2;
    const py2 = ny;

    for (const col of colliders) {
      if (col.shape === "ellipse") {
        const ex = (nx - col.cx) / (col.rx + 4);
        const ey = (ny - 3 - col.cy) / (col.ry + 2);
        if (ex * ex + ey * ey < 1.0) return true;
      } else if (px1 < col.x + col.w && px2 > col.x && py1 < col.y + col.h && py2 > col.y) {
        return true;
      }
    }
    return false;
  }

  function updateMovement(dt) {
    const ccStage = gameState.events && gameState.events.cuttingCorners && gameState.events.cuttingCorners.stage;
    if (
      player.seated ||
      player.facingCorner ||
      ccStage === "QUESTION" ||
      ccStage === "FEEDBACK" ||
      ccStage === "DEATH" ||
      ccStage === "SURVIVED" ||
      paused ||
      dialogueOpen ||
      paintingOpen ||
      neighborModalOpen ||
      (App.FieldBook && App.FieldBook.isOpen()) ||
      (App.Clues && App.Clues.isInspectOpen()) ||
      (App.Knight && App.Knight.isTableGlanceOpen()) ||
      App.TableView.isOpen() ||
      App.GameIntro.isBlockingInput() ||
      (App.Jumpscare && App.Jumpscare.isActive()) ||
      (App.Events && App.Events.isSpectatingActive && App.Events.isSpectatingActive(gameState)) ||
      (App.Endgame && (App.Endgame.isCutsceneBlocking(gameState) || (App.Endgame.isLocalDeadSpectator && App.Endgame.isLocalDeadSpectator(gameState)) || (App.Endgame.isLocalInCar && App.Endgame.isLocalInCar(gameState)))) ||
      (App.Basement && (App.Basement.isSlideCutscene(gameState) || App.Basement.isRepairModalOpen(gameState)))
    ) {
      player.moving = false;
      player.sprinting = false;
      player.stamina = Math.min(100, player.stamina + 18 * dt);
      return;
    }

    let dx = 0;
    let dy = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) dy -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) dy += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) dx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    player.moving = dx !== 0 || dy !== 0;
    const wantSprint = (keys["ShiftLeft"] || keys["ShiftRight"]) && player.moving;
    if (wantSprint && player.crouching) player.crouching = false;
    player.sprinting = wantSprint;

    if (dx < 0) player.facing = -1;
    if (dx > 0) player.facing = 1;

    const speed = player.crouching ? 32 : wantSprint ? 88 : 54;
    const stepX = dx * speed * dt;
    const stepY = dy * speed * dt;

    if (stepX !== 0 && !collidesAt(player.x + stepX, player.y)) {
      player.x += stepX;
    }
    if (stepY !== 0 && !collidesAt(player.x, player.y + stepY)) {
      player.y += stepY;
    }

    if (roomTransitionCooldown > 0) {
      roomTransitionCooldown = Math.max(0, roomTransitionCooldown - dt);
    }

    // Seamless Stardew-style walk-through into any matched connected room (or Morning Forest at Dawn!)
    if (player.moving && roomTransitionCooldown <= 0 && !(App.Attic && App.Attic.isPlayerInAttic(gameState)) && !(App.Basement && App.Basement.isActive(gameState)) && !(App.Endgame && App.Endgame.isInForestExit(gameState))) {
      if (App.Endgame && App.Endgame.isDaylightWinMode(gameState) && isInDiningRoom()) {
        const sp = DOOR_PORTALS.find((p) => p.dir === "S");
        if (sp && sp.trigger(player.x, player.y)) {
          if (App.Endgame.enterForestExitMap(gameState, player)) {
            roomTransitionAlpha = 0.92;
            roomTransitionCooldown = 0.4;
            syncHud();
            return;
          }
        }
      }
      if (!(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(gameState)) && !(App.Endgame && App.Endgame.isLockedInChosenRoom(gameState)) && (!App.Knight || !App.Knight.isActive(gameState) || App.Knight.canPlayerChangeRoom(gameState))) {
        for (const portal of DOOR_PORTALS) {
          if (portal.trigger(player.x, player.y) && getConnectedNeighbor(portal.dir)) {
            enterMatchedRoom(portal.dir);
            return;
          }
        }
      }
    }

    if (player.moving && !player.crouching) {
      stepCooldown -= dt;
      if (stepCooldown <= 0) {
        App.Audio.woodStep();
        stepCooldown = wantSprint ? 0.23 : 0.36;
      }
    } else {
      stepCooldown = 0.08;
    }
  }

  function updatePromptUI() {
    const promptEl = document.getElementById("hud-prompt");
    const promptText = document.getElementById("hud-prompt-text");
    if (!promptEl || !promptText) return;

    if (dialogueOpen || paintingOpen || neighborModalOpen || (App.Events && App.Events.isSpectatingActive && App.Events.isSpectatingActive(gameState)) || (App.FieldBook && App.FieldBook.isOpen()) || (App.Clues && App.Clues.isInspectOpen()) || (App.Knight && App.Knight.isTableGlanceOpen()) || App.TableView.isOpen() || paused || App.GameIntro.isBlockingInput()) {
      promptEl.classList.add("hidden");
      return;
    }

    const target = findNearestTarget();
    if (target) {
      promptText.textContent = target.prompt;
      promptEl.classList.remove("hidden");
    } else {
      promptEl.classList.add("hidden");
    }
  }

  function resizeCanvas() {
    if (!worldCanvas) return;
    worldCanvas.width = window.innerWidth;
    worldCanvas.height = window.innerHeight;
  }

  function renderFrame(timeSec, dt) {
    if (!active || !worldCanvas || !worldCtx) return;

    // Keep spatial Main Parlor clock tick smoothly updated every frame
    updateSpatialClockAudio();

    // Update & render active fullscreen pixel-art jumpscare at full frame rate
    if (App.Jumpscare && App.Jumpscare.isActive()) {
      App.Jumpscare.updateAndRender(dt);
    }

    if (App.TableView.isOpen()) {
      if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch()) {
        App.Network.updateRemoteInterpolation(dt);
        App.Network.sendPlayerState({
          x: player.x,
          y: player.y,
          facing: player.facing,
          roomX: gameState.currentRoomCoord.x,
          roomY: gameState.currentRoomCoord.y,
          seated: player.seated,
          chairId: player.chairId,
          moving: false,
          sprinting: false,
          crouching: false,
          lanternOn: player.lanternOn,
          facingCorner: false
        });
      }
      App.TableView.renderFrame(timeSec, dt);
      if (App.Events && App.Events.update && !paused) {
        App.Events.update(dt, gameState, player, getCurrentRoomObj());
      }
      if (App.Endgame && App.Endgame.update && !paused) {
        App.Endgame.update(dt, gameState, player);
      }
      return;
    }

    if (App.TableView && App.TableView.updateBackground && !paused) {
      App.TableView.updateBackground(dt);
    }

    // Live-render Pixel-Art The Neighbor canvas (cupped hands -> open spreading hands offering 3 options!) while modal is open!
    if (neighborModalOpen && App.Endgame && App.Endgame.renderNeighborPixelCanvas) {
      const handSpeed = 1.65;
      if (nbHandsOpenProgress < nbHandsOpenTarget) {
        nbHandsOpenProgress = Math.min(nbHandsOpenTarget, nbHandsOpenProgress + dt * handSpeed);
      } else if (nbHandsOpenProgress > nbHandsOpenTarget) {
        nbHandsOpenProgress = Math.max(nbHandsOpenTarget, nbHandsOpenProgress - dt * handSpeed);
      }
      App.Endgame.renderNeighborPixelCanvas(document.getElementById("neighbor-fp-canvas"), timeSec, nbHandsOpenProgress);
    }

    // Auto-trigger Midnight 12:00 AM Endgame if clock reaches 720 (wait if a Death Penalty table glide is pending so player watches the pieces advance to XII first!)
    if (
      gameState.clockMinutes >= 720 &&
      gameState.tableIntroDone &&
      !gameState.pendingPenaltyAnim &&
      App.Endgame &&
      !App.Endgame.isEndgameActive(gameState) &&
      !(App.Events && App.Events.isAnyEventActive(gameState))
    ) {
      App.Endgame.startMidnightEndgame(gameState, player);
    }

    const baseLight = App.GameIntro.update();
    const egFlick = App.Endgame && App.Endgame.getGlobalFlickerMultiplier
      ? App.Endgame.getGlobalFlickerMultiplier(gameState, timeSec)
      : 1.0;
    const stFlick = App.Stalkers && App.Stalkers.getGlobalFlickerMultiplier
      ? App.Stalkers.getGlobalFlickerMultiplier(gameState, timeSec)
      : 1.0;
    const mrFlick = App.Musical && App.Musical.getLightMultiplier
      ? App.Musical.getLightMultiplier(gameState, timeSec)
      : 1.0;
    const slFlick = App.StayLit && App.StayLit.getGlobalFlickerMultiplier
      ? App.StayLit.getGlobalFlickerMultiplier(gameState, timeSec)
      : 1.0;
    const lightLevel = baseLight * (typeof gameState.archFlickerLight === "number" ? gameState.archFlickerLight : 1.0) * egFlick * stFlick * mrFlick * slFlick;
    updateMovement(dt);
    if (App.Events && App.Events.update && !paused) {
      App.Events.update(dt, gameState, player, getCurrentRoomObj());
    }
    if (App.Attic && App.Attic.update && !paused) {
      App.Attic.update(dt, gameState, player);
    }
    if (App.Stalkers && App.Stalkers.update && !paused) {
      App.Stalkers.update(dt, gameState, player);
    }
    if (App.Musical && App.Musical.update && !paused) {
      App.Musical.update(dt, gameState, player);
    }
    if (App.Basement && App.Basement.update && !paused) {
      App.Basement.update(dt, gameState, player);
    }
    if (App.StayLit && App.StayLit.update && !paused) {
      App.StayLit.update(dt, gameState, player);
    }
    if (App.Knight && App.Knight.update && !paused) {
      App.Knight.update(dt, gameState);
    }
    if (App.Endgame && App.Endgame.update && !paused) {
      App.Endgame.update(dt, gameState, player);
    }
    syncHud();
    updatePromptUI();

    let camOffX = 0;
    let camOffY = 0;
    const specTarget = (App.Events && App.Events.getSpectateTarget) ? App.Events.getSpectateTarget(gameState) : null;
    const inAtticNow = Boolean(App.Attic && App.Attic.isPlayerInAttic(gameState));
    const inBasementNow = Boolean(App.Basement && (App.Basement.isLocalInBasementView ? App.Basement.isLocalInBasementView(gameState) : App.Basement.isActive(gameState)));
    const inForestNow = Boolean(App.Endgame && App.Endgame.isInForestExit(gameState));

    if (specTarget) {
      // Spectating a living teammate while dead & locked inside The Cellar!
      const specProxy = {
        spectatePlayerId: specTarget.playerId,
        x: specTarget.x,
        y: specTarget.y,
        facing: specTarget.facing || 1,
        seated: Boolean(specTarget.seated),
        chairId: typeof specTarget.chairId === "number" ? specTarget.chairId : 0,
        moving: Boolean(specTarget.moving),
        sprinting: Boolean(specTarget.sprinting),
        crouching: Boolean(specTarget.crouching),
        lanternOn: Boolean(specTarget.lanternOn),
        facingCorner: Boolean(specTarget.facingCorner)
      };
      if (specTarget.inAttic && App.Attic && App.Attic.renderViewport) {
        const cam = App.Attic.renderViewport(rbCtx, timeSec, specProxy, specTarget.character, gameState);
        camOffX = cam.camX || 0;
        camOffY = cam.camY || 0;
      } else if (specTarget.inBasement && App.Basement && App.Basement.renderViewport) {
        const cam = App.Basement.renderViewport(rbCtx, timeSec, specProxy, specTarget.character, gameState);
        camOffX = cam.camX || 0;
        camOffY = cam.camY || 0;
      } else if ((specTarget.roomX || 0) === 0 && (specTarget.roomY || 0) === 0) {
        App.GameRoom.render(rbCtx, timeSec, lightLevel, specProxy, specTarget.character, gameState);
      } else {
        const specRoom = (gameState.roomMap && gameState.roomMap[`${specTarget.roomX || 0},${specTarget.roomY || 0}`]) || getCurrentRoomObj();
        App.CabinRooms.renderRoom(rbCtx, specRoom, timeSec, lightLevel, specProxy, specTarget.character, gameState);
      }
    } else if (inForestNow) {
      App.Endgame.renderForestExitViewport(rbCtx, timeSec, player, App.Config.state.character, gameState);
    } else if (inBasementNow) {
      const cam = App.Basement.renderViewport(rbCtx, timeSec, player, App.Config.state.character, gameState);
      camOffX = cam.camX || 0;
      camOffY = cam.camY || 0;
    } else if (inAtticNow) {
      const cam = App.Attic.renderViewport(rbCtx, timeSec, player, App.Config.state.character, gameState);
      camOffX = cam.camX || 0;
      camOffY = cam.camY || 0;
    } else if (isInDiningRoom()) {
      App.GameRoom.render(rbCtx, timeSec, lightLevel, player, App.Config.state.character, gameState);
    } else {
      const curRoom = getCurrentRoomObj();
      App.CabinRooms.renderRoom(rbCtx, curRoom, timeSec, lightLevel, player, App.Config.state.character, gameState);
    }

    const cw = worldCanvas.width;
    const ch = worldCanvas.height;
    worldCtx.imageSmoothingEnabled = false;
    worldCtx.fillStyle = inForestNow ? "#5d8f56" : "#050508";
    worldCtx.fillRect(0, 0, cw, ch);

    const egShake = App.Endgame && App.Endgame.getEarthquakeOffset
      ? App.Endgame.getEarthquakeOffset(gameState, timeSec)
      : { x: 0, y: 0 };
    const bmShake = App.Basement && App.Basement.getShakeOffset
      ? App.Basement.getShakeOffset(gameState, timeSec)
      : { x: 0, y: 0 };
    const shake = { x: egShake.x + bmShake.x, y: egShake.y + bmShake.y };
    const rawScale = Math.min(cw / App.GameRoom.ROOM_W, ch / App.GameRoom.ROOM_H);
    const scale = rawScale >= 2 ? Math.floor(rawScale) : rawScale;
    const drawW = Math.floor(App.GameRoom.ROOM_W * scale);
    const drawH = Math.floor(App.GameRoom.ROOM_H * scale);
    const ox = Math.floor((cw - drawW) / 2) + shake.x;
    const oy = Math.floor((ch - drawH) / 2) + shake.y;

    worldCtx.drawImage(roomBuffer, ox, oy, drawW, drawH);

    // Sync local position/pose & interpolate remote Co-op teammates
    const localDeadSpec = Boolean(App.Endgame && App.Endgame.isLocalDeadSpectator && App.Endgame.isLocalDeadSpectator(gameState));
    const localDeadEvent = Boolean(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(gameState));
    const localInCar = Boolean(App.Endgame && App.Endgame.isLocalInCar && App.Endgame.isLocalInCar(gameState));
    if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch()) {
      App.Network.updateRemoteInterpolation(dt);
      App.Network.sendPlayerState({
        x: player.x,
        y: player.y,
        facing: player.facing,
        roomX: gameState.currentRoomCoord.x,
        roomY: gameState.currentRoomCoord.y,
        seated: player.seated,
        chairId: player.chairId,
        moving: player.moving,
        sprinting: player.sprinting,
        crouching: player.crouching,
        lanternOn: player.lanternOn,
        facingCorner: player.facingCorner,
        inForest: inForestNow,
        inCar: localInCar,
        inAttic: inAtticNow,
        inBasement: inBasementNow,
        deadInEvent: localDeadEvent,
        deadSpectator: localDeadSpec
      });
    }

    // Draw crisp high-res player name above local & remote Co-op characters (hide during car/slide cutscenes!)
    if (!(App.Endgame && App.Endgame.isCutsceneBlocking(gameState)) && !(App.Basement && App.Basement.isSlideCutscene(gameState))) {
      const viewInAttic = specTarget ? Boolean(specTarget.inAttic) : inAtticNow;
      const viewInBasement = specTarget ? Boolean(specTarget.inBasement) : inBasementNow;
      const nameLight = (viewInAttic || viewInBasement || inForestNow) ? 0.95 : lightLevel;
      const viewRoomX = specTarget ? (specTarget.roomX || 0) : gameState.currentRoomCoord.x;
      const viewRoomY = specTarget ? (specTarget.roomY || 0) : gameState.currentRoomCoord.y;

      if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch() && !viewInAttic && !viewInBasement) {
        if (inForestNow && App.Network.getAllRemotePlayers) {
          App.Network.getAllRemotePlayers().forEach((rp) => {
            if (!rp.inForest || rp.inCar || rp.deadSpectator) return;
            drawNameplateAt(rp.x, rp.y, rp.name, ox, oy, scale, nameLight, camOffX, camOffY, true);
          });
        } else if (!inForestNow) {
          App.Network.getRemotePlayersInRoom(viewRoomX, viewRoomY).forEach((rp) => {
            if (rp.deadSpectator || rp.inForest || rp.inCar || rp.inAttic || rp.inBasement) return;
            if (rp.deadInEvent && specTarget) return;
            drawNameplateAt(rp.x, rp.y, rp.name, ox, oy, scale, nameLight, camOffX, camOffY, true);
          });
        }
      }
      if (specTarget) {
        drawNameplateAt(specTarget.x, specTarget.y, specTarget.name, ox, oy, scale, nameLight, camOffX, camOffY, true);
      } else if (!localDeadSpec && !localInCar) {
        drawPlayerNameplate(ox, oy, scale, nameLight, camOffX, camOffY);
      }
    }

    // Quick Stardew-style black blink transition when crossing doorways between rooms
    if (roomTransitionAlpha > 0.01) {
      worldCtx.fillStyle = `rgba(3, 3, 5, ${roomTransitionAlpha.toFixed(3)})`;
      worldCtx.fillRect(0, 0, cw, ch);
      roomTransitionAlpha = Math.max(0, roomTransitionAlpha - dt * 5.2);
    }
  }

  function startMatchCommon(opts) {
    const o = opts || {};
    const ch = App.Config.state.character;
    gameState.mode = o.mode === "MULTIPLAYER" ? "MULTIPLAYER" : "SINGLEPLAYER";
    gameState.difficulty = o.difficulty || App.Config.state.difficulty || "NORMAL";
    gameState.roomCode = o.roomCode || "";
    gameState.localSeatIdx = typeof o.localSeatIdx === "number" ? o.localSeatIdx : 0;
    gameState.currentRoomCoord = { x: 0, y: 0 };
    roomTransitionAlpha = 0;
    roomTransitionCooldown = 0;
    if (App.CabinRooms) App.CabinRooms.clearCache();
    App.TableView.resetTableMatch(gameState);

    if (gameState.mode === "MULTIPLAYER" && Array.isArray(o.seats)) {
      const activeSeats = [];
      o.seats.forEach((s, i) => { if (s) activeSeats.push(i); });
      gameState.playerSeats = activeSeats.length ? activeSeats : [0];
    }

    const chairIdx = (gameState.mode === "MULTIPLAYER" && App.Network && App.Network.getChairIdForSeat)
      ? App.Network.getChairIdForSeat(gameState.localSeatIdx, gameState.playerSeats)
      : Math.max(0, Math.min(App.GameRoom.CHAIRS.length - 1, gameState.localSeatIdx));
    const startChair = App.GameRoom.CHAIRS[chairIdx] || App.GameRoom.CHAIRS[0];
    gameState.localChairId = startChair.id;
    gameState.seatLabel = `SEAT ${(gameState.localSeatIdx || 0) + 1}`;
    player.seated = true;
    player.chairId = startChair.id;
    player.facingCorner = false;
    player.cornerLock = null;
    player.x = startChair.seatX;
    player.y = startChair.seatY;
    player.facing = startChair.facing;
    player.moving = false;
    player.sprinting = false;
    player.crouching = false;
    player.lanternOn = Boolean(ch.lantern);
    player.stamina = 100;

    paused = false;
    dialogueOpen = false;
    paintingOpen = false;
    neighborModalOpen = false;
    document.getElementById("painting-inspect-modal")?.classList.add("hidden");
    document.getElementById("neighbor-fp-modal")?.classList.add("hidden");
    document.getElementById("attic-hud-bar")?.classList.add("hidden");
    if (App.Jumpscare) App.Jumpscare.stop();
    if (App.FieldBook) { App.FieldBook.close(true); App.FieldBook.resetNotes(); }
    if (App.Clues) App.Clues.closeInspectModal(true);
    if (App.Audio.stopGrandfatherClockClue) App.Audio.stopGrandfatherClockClue();
    App.TableView.close(true);
    App.Audio.stopClockTick();
    if (App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    if (App.Audio.stopExorcismSfx) App.Audio.stopExorcismSfx();

    const hud = document.getElementById("game-hud");
    if (hud) {
      hud.classList.remove("hidden");
      hud.classList.add("hud-hidden");
    }
    document.getElementById("pause-overlay")?.classList.add("hidden");
    document.getElementById("hud-dialogue")?.classList.add("hidden");

    App.GameIntro.start(
      () => {
        active = true;
        document.getElementById("app-shell")?.classList.add("hidden");
        document.getElementById("game-stage")?.classList.remove("hidden");
        resizeCanvas();
        syncHud();
        updateSpatialClockAudio();
        App.Audio.startClockTick();
      },
      () => {
        if (hud) hud.classList.remove("hud-hidden");
      }
    );
  }

  function startSingleplayer() {
    if (App.Network && App.Network.getState().role !== "IDLE") {
      App.Network.leaveTable(true);
    }
    startMatchCommon({ mode: "SINGLEPLAYER", localSeatIdx: 0 });
  }

  function startMultiplayer(mpConfig) {
    startMatchCommon({
      mode: "MULTIPLAYER",
      roomCode: mpConfig && mpConfig.roomCode,
      difficulty: mpConfig && mpConfig.difficulty,
      localSeatIdx: mpConfig && typeof mpConfig.localSeatIdx === "number" ? mpConfig.localSeatIdx : 0,
      seats: mpConfig && mpConfig.seats
    });
  }

  function exitToLobby() {
    if (App.Network && App.Network.getState().role !== "IDLE") {
      App.Network.leaveTable(true);
    }
    active = false;
    paused = false;
    dialogueOpen = false;
    paintingOpen = false;
    neighborModalOpen = false;
    document.getElementById("painting-inspect-modal")?.classList.add("hidden");
    document.getElementById("neighbor-fp-modal")?.classList.add("hidden");
    document.getElementById("attic-hud-bar")?.classList.add("hidden");
    if (App.Jumpscare) App.Jumpscare.stop();
    if (App.FieldBook) { App.FieldBook.close(true); App.FieldBook.resetNotes(); }
    if (App.Clues) App.Clues.closeInspectModal(true);
    if (App.Audio.stopGrandfatherClockClue) App.Audio.stopGrandfatherClockClue();
    App.TableView.close(true);
    App.GameIntro.cancel();
    App.Audio.stopClockTick();
    if (App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    if (App.Audio.stopExorcismSfx) App.Audio.stopExorcismSfx();
    if (App.Audio.stopHumanIntro) App.Audio.stopHumanIntro();
    if (App.Audio.stopRimTurn) App.Audio.stopRimTurn();
    if (App.Audio.stopPawnMove) App.Audio.stopPawnMove();
    if (App.Audio.stopEventDraw) App.Audio.stopEventDraw();
    if (App.Audio.stopTypingSfx) App.Audio.stopTypingSfx();
    if (App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
    if (App.Audio.stopBalloonsSfxLoop) App.Audio.stopBalloonsSfxLoop();
    if (App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
    if (App.Stalkers && App.Stalkers.cleanup) App.Stalkers.cleanup(gameState);
    if (App.Musical && App.Musical.cleanup) App.Musical.cleanup(gameState);
    if (App.Basement && App.Basement.cleanup) App.Basement.cleanup(gameState);
    if (App.StayLit && App.StayLit.cleanup) App.StayLit.cleanup(gameState);
    if (App.Knight && App.Knight.cleanup) App.Knight.cleanup(gameState);
    if (App.Audio.stopDoorKnock) App.Audio.stopDoorKnock();
    if (App.Audio.stopDoorOpen) App.Audio.stopDoorOpen();
    clearNeighborSeqTimers();
    if (App.Endgame && App.Endgame.cleanup) App.Endgame.cleanup(gameState);

    document.getElementById("game-stage")?.classList.add("hidden");
    document.getElementById("pause-overlay")?.classList.add("hidden");
    document.getElementById("hud-dialogue")?.classList.add("hidden");
    document.getElementById("app-shell")?.classList.remove("hidden");

    App.Audio.startLobbyBgm();
  }

  function bindEvents() {
    window.addEventListener("resize", () => {
      if (active) resizeCanvas();
    });

    document.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (!active || App.GameIntro.isBlockingInput() || (App.Jumpscare && App.Jumpscare.isActive())) return;

      const extOpen = document.querySelector("#modal-howto:not(.hidden), #modal-options:not(.hidden)");
      if (extOpen) return;

      if (e.code === "Escape") {
        e.preventDefault();
        if (App.Events && App.Events.isSpectatingActive && App.Events.isSpectatingActive(gameState)) {
          App.Events.exitSpectateToCellar(gameState, false);
          syncHud();
        } else if (App.Basement && App.Basement.isRepairModalOpen(gameState)) App.Basement.closeBreakerModal(gameState, false);
        else if (App.Knight && App.Knight.isTableGlanceOpen()) App.Knight.closeTableGlanceModal(false);
        else if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(false);
        else if (App.Clues && App.Clues.isInspectOpen()) App.Clues.closeInspectModal(false);
        else if (neighborModalOpen) closeNeighborModal(false);
        else if (paintingOpen) closePaintingModal();
        else if (dialogueOpen) closeDialogue();
        else if (App.TableView.isOpen()) {
          if (!App.TableView.isBusy()) App.TableView.close(false);
        } else {
          setPaused(!paused);
        }
        return;
      }

      if (paused) return;

      if (e.code === "KeyB") {
        e.preventDefault();
        if (App.FieldBook) App.FieldBook.toggle();
        return;
      }

      if (App.FieldBook && App.FieldBook.isOpen()) return;

      if (App.TableView.isOpen()) {
        if (App.TableView.isBusy()) return;
        if (e.code === "KeyE") {
          e.preventDefault();
          standUp();
        } else if (e.code === "KeyT") {
          e.preventDefault();
          App.TableView.close(false);
        }
        return;
      }

      if (App.Clues && App.Clues.isInspectOpen() && (e.code === "Space" || e.code === "KeyE" || e.code === "Enter")) {
        e.preventDefault();
        App.Clues.closeInspectModal(false);
        return;
      }

      if (App.Knight && App.Knight.isTableGlanceOpen() && (e.code === "Space" || e.code === "KeyE" || e.code === "Enter")) {
        e.preventDefault();
        App.Knight.closeTableGlanceModal(false);
        return;
      }

      if (neighborModalOpen) {
        const nb = gameState.neighborEncounter;
        if (!nbCardsReady && (e.code === "Space" || e.code === "Enter" || e.code === "KeyE")) {
          e.preventDefault();
          advanceNeighborDialogueManually();
          return;
        }
        if (nbCardsReady && nb && nb.options) {
          if (e.code === "Digit1" && nb.options[0]) { e.preventDefault(); pickNeighborOption(nb.options[0].id); }
          else if (e.code === "Digit2" && nb.options[1]) { e.preventDefault(); pickNeighborOption(nb.options[1].id); }
          else if (e.code === "Digit3" && nb.options[2]) { e.preventDefault(); pickNeighborOption(nb.options[2].id); }
        }
        return;
      }

      if (paintingOpen && (e.code === "Space" || e.code === "KeyE" || e.code === "Enter")) {
        e.preventDefault();
        closePaintingModal();
        return;
      }

      if (dialogueOpen && (e.code === "Space" || e.code === "KeyE" || e.code === "Enter")) {
        e.preventDefault();
        closeDialogue();
        return;
      }

      // Multiplayer Cellar Spectate Controls: [P] enter/exit Spectate, [Q] Prev player, [E] Next player
      if (App.Events && App.Events.canSpectateInCellar && (App.Events.canSpectateInCellar(gameState) || (App.Events.isSpectatingActive && App.Events.isSpectatingActive(gameState)))) {
        if (e.code === "KeyP") {
          e.preventDefault();
          App.Events.toggleSpectateMode(gameState);
          syncHud();
          return;
        }
        if (App.Events.isSpectatingActive && App.Events.isSpectatingActive(gameState)) {
          if (e.code === "KeyQ") {
            e.preventDefault();
            App.Events.cycleSpectateTarget(gameState, -1);
            syncHud();
            return;
          }
          if (e.code === "KeyE") {
            e.preventDefault();
            App.Events.cycleSpectateTarget(gameState, 1);
            syncHud();
            return;
          }
        }
      }

      if (e.code === "KeyT") {
        e.preventDefault();
        enterFirstPersonTable();
        return;
      }

      const ccNow = gameState.events && gameState.events.cuttingCorners;
      if (ccNow && ccNow.stage === "QUESTION") {
        if (e.code === "KeyQ" || e.code === "Digit1") {
          e.preventDefault();
          App.Events.submitCuttingCornersChoice(gameState, player, true);
        } else if (e.code === "KeyE" || e.code === "Digit2") {
          e.preventDefault();
          App.Events.submitCuttingCornersChoice(gameState, player, false);
        }
        return;
      }

      if (e.code === "KeyE") {
        e.preventDefault();
        if (App.Basement && App.Basement.isRepairModalOpen(gameState)) {
          App.Basement.closeBreakerModal(gameState, false);
          syncHud();
        } else {
          handleInteract();
        }
      } else if (e.code === "KeyF") {
        if (e.repeat) return;
        if (App.Attic && App.Attic.isPlayerInAttic(gameState)) {
          e.preventDefault();
          App.Attic.handlePickUpOrPlace(gameState, player);
          syncHud();
        } else if (App.Musical && App.Musical.isActive && App.Musical.isActive(gameState)) {
          e.preventDefault();
          const consumed = App.Musical.onKeyFDown(gameState, player);
          if (!consumed) {
            player.lanternOn = !player.lanternOn;
            App.Audio.lanternClick();
          }
          syncHud();
        } else if (App.Basement && App.Basement.isInBasementMap && App.Basement.isInBasementMap(gameState)) {
          e.preventDefault();
          const consumed = App.Basement.onKeyFDown(gameState, player);
          if (!consumed && !App.Basement.isRepairModalOpen(gameState)) {
            player.lanternOn = !player.lanternOn;
            App.Audio.lanternClick();
          }
          syncHud();
        } else {
          player.lanternOn = !player.lanternOn;
          App.Audio.lanternClick();
          syncHud();
        }
      } else if (e.code === "KeyX") {
        if (App.Attic && App.Attic.isPlayerInAttic(gameState)) {
          e.preventDefault();
          App.Attic.handleDropItem(gameState, player);
          syncHud();
        } else if (App.Stalkers && App.Stalkers.isFeelingSmallActive && App.Stalkers.isFeelingSmallActive(gameState)) {
          e.preventDefault();
          App.Stalkers.handleFeelingSmallDrop(gameState, player);
          syncHud();
        }
      } else if (e.code === "KeyC") {
        if (!player.seated && !player.facingCorner) {
          e.preventDefault();
          player.crouching = !player.crouching;
          syncHud();
        }
      } else if (e.code === "KeyJ") {
        if (App.MenuUI && App.MenuUI.openModal) {
          App.MenuUI.openModal("modal-howto");
        }
      }
    });

    document.addEventListener("pointerdown", (e) => {
      if (!active || paused) return;
      if (e.target.closest && e.target.closest("#bm-hold-repair-btn") && App.Basement && App.Basement.isRepairModalOpen(gameState)) {
        App.Basement.onKeyFDown(gameState, player);
      }
    });
    document.addEventListener("pointerup", () => {
      if (active && App.Basement && App.Basement.isRepairModalOpen(gameState)) {
        App.Basement.onKeyFUp(gameState);
      }
    });

    document.addEventListener("keyup", (e) => {
      keys[e.code] = false;
      if (e.code === "KeyF" && active && !paused && App.Musical && App.Musical.isActive && App.Musical.isActive(gameState)) {
        App.Musical.onKeyFUp(gameState, player);
        syncHud();
      }
      if (e.code === "KeyF" && active && !paused && App.Basement && App.Basement.isActive && App.Basement.isActive(gameState)) {
        App.Basement.onKeyFUp(gameState);
        syncHud();
      }
    });

    document.addEventListener("click", (e) => {
      if (!active) return;

      if (e.target.closest("#hud-dialogue")) {
        closeDialogue();
        return;
      }

      const nbOptBtn = e.target.closest("[data-neighbor-option]");
      if (nbOptBtn) {
        pickNeighborOption(nbOptBtn.getAttribute("data-neighbor-option"));
        return;
      }
      if (neighborModalOpen && !nbCardsReady && e.target.closest("#neighbor-fp-modal")) {
        advanceNeighborDialogueManually();
        return;
      }

      const btn = e.target.closest("[data-game-action]");
      if (!btn) return;
      const act = btn.getAttribute("data-game-action");

      if (act === "toggle-lantern") {
        player.lanternOn = !player.lanternOn;
        App.Audio.lanternClick();
        syncHud();
      } else if (act === "enter-table-view") {
        enterFirstPersonTable();
      } else if (act === "toggle-sit") {
        handleInteract();
      } else if (act === "open-tome") {
        if (App.GuideUI) App.GuideUI.switchBookTab("rules");
        if (App.MenuUI) App.MenuUI.openModal("modal-howto");
      } else if (act === "open-options") {
        if (App.MenuUI) App.MenuUI.openModal("modal-options");
      } else if (act === "close-painting") {
        closePaintingModal();
      } else if (act === "close-clue-inspect") {
        if (App.Clues) App.Clues.closeInspectModal(false);
      } else if (act === "resume-game") {
        setPaused(false);
      } else if (act === "cc-turn-around") {
        if (App.Events) App.Events.submitCuttingCornersChoice(gameState, player, true);
      } else if (act === "cc-stay-corner") {
        if (App.Events) App.Events.submitCuttingCornersChoice(gameState, player, false);
      } else if (act === "retry-endgame") {
        if (App.Endgame) App.Endgame.cleanup(gameState);
        startSingleplayer();
      } else if (act === "close-breaker-modal") {
        if (App.Basement) App.Basement.closeBreakerModal(gameState, false);
        syncHud();
      } else if (act === "close-knight-map") {
        if (App.Knight) App.Knight.closeTableGlanceModal(false);
      } else if (act === "exit-to-lobby") {
        exitToLobby();
      }
    });
  }

  function init() {
    worldCanvas = document.getElementById("world-canvas");
    if (worldCanvas) {
      worldCtx = worldCanvas.getContext("2d");
      worldCtx.imageSmoothingEnabled = false;
    }
    roomBuffer.width = App.GameRoom.ROOM_W;
    roomBuffer.height = App.GameRoom.ROOM_H;
    rbCtx = roomBuffer.getContext("2d");
    rbCtx.imageSmoothingEnabled = false;

    if (App.FieldBook) App.FieldBook.init();
    if (App.TableView) App.TableView.init();

    if (App.Network && App.Network.on) {
      App.Network.on("gameMessage", (msg) => {
        if (!active || !msg || !msg.action) return;
        const p = msg.payload || {};
        if (msg.action === "MP_LIGHT_SWITCH" && p.rk) {
          gameState.roomLightStates = gameState.roomLightStates || { "0,0": true };
          gameState.roomLightStates[p.rk] = Boolean(p.isOn);
          App.Audio.lightSwitch();
          if (App.Stalkers && App.Stalkers.onLightSwitchToggled) {
            App.Stalkers.onLightSwitchToggled(gameState);
          }
          syncHud();
          return;
        }
        if (msg.action.startsWith("MP_EVENT_")) {
          if (App.Events && App.Events.handleMpEventNetwork) {
            App.Events.handleMpEventNetwork(msg.action, p, gameState);
            syncHud();
          }
          return;
        }
        if (msg.action.startsWith("MP_ATTIC_")) {
          if (App.Attic && App.Attic.handleNetworkMessage) {
            App.Attic.handleNetworkMessage(msg.action, p, gameState);
            syncHud();
          }
          return;
        }
        if (msg.action.startsWith("MP_MUSICAL_")) {
          if (App.Musical && App.Musical.handleNetworkMessage) {
            App.Musical.handleNetworkMessage(msg.action, p, gameState);
            syncHud();
          }
          return;
        }
        if (
          msg.action.startsWith("MP_ENDGAME_") ||
          msg.action.startsWith("MP_CAR_") ||
          msg.action.startsWith("MP_FOREST_") ||
          msg.action === "MP_HARVESTER_LOSE"
        ) {
          if (App.Endgame && App.Endgame.handleNetworkMessage) {
            App.Endgame.handleNetworkMessage(msg.action, p, gameState, player);
            syncHud();
          }
          return;
        }
        if (App.TableView && App.TableView.handleNetworkMessage) {
          App.TableView.handleNetworkMessage(msg.action, p, msg.seatIdx);
        }
      });
    }

    bindEvents();
  }

  function startMusicalRooms() {
    if (App.Musical && App.Musical.startMusicalRoomsEvent) {
      App.Musical.startMusicalRoomsEvent(gameState, player);
    }
  }

  function startBasementEvent() {
    if (App.Basement && App.Basement.startBasementEvent) {
      App.Basement.startBasementEvent(gameState, player);
    }
  }

  function triggerMidnightEndgame() {
    if (App.Endgame && App.Endgame.startMidnightEndgame) {
      App.Endgame.startMidnightEndgame(gameState, player);
    }
  }

  App.GameWorld = {
    init,
    startSingleplayer,
    startMultiplayer,
    exitToLobby,
    forceStandUpForEvent,
    respawnInCellar,
    onNeighborDoorOpened,
    startMusicalRooms,
    startBasementEvent,
    triggerMidnightEndgame,
    renderFrame,
    getLocalSeatedInfo: () => ({
      seated: Boolean(player.seated),
      roomCoord: gameState.currentRoomCoord || { x: 0, y: 0 }
    }),
    isActive: () => active
  };
})(window.Duskwood);
