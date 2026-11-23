/* ==========================================================================
   DUSKWOOD INN - Pixel-Art Grim Reaper & Full Midnight 12:00 AM Endgame Engine
   1. THE NEIGHBOR Pixel-Art Grim Reaper Renderer (`renderNeighborPixelCanvas`)
   2. MIDNIGHT 12:00 AM ENDGAME:
      - Forces 3rd-person view + plays `audio/end_game_alarm.mp3` 3 times
      - Displays Cutting-Corners-style ragged ink-smudge banner + 20s countdown
        to choose & stand inside the true Exit Room
      - After 20s: locks player inside their chosen room (free movement inside room,
        cannot leave!), violent earthquake shake + all cabin lights flicker wildly!
      - Every 5 seconds: shatters light bulbs in WRONG rooms (`audio/light_break.mp3` 5s)
        until ONLY the true Exit Room remains!
      - LOSE CUTSCENE: Close-up top-down pixel shot of headless bloody player slumped
        over the round table -> zooms slowly out through the open front door -> Game Over!
      - WIN SEQUENCE: Bright morning daylight breaks, clears all other rooms leaving
        ONLY The Dining Room with 1 sunlit open door -> step outside into a playable
        sunlit Forest with a getaway Car (`[E]`) -> drive away -> Game Credits!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function fillPixelEllipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const ratio = 1 - (dy * dy) / (ry * ry);
      if (ratio < 0) continue;
      const span = Math.floor(rx * Math.sqrt(ratio));
      c.fillRect(Math.floor(cx - span), Math.floor(cy + dy), span * 2 + 1, 1);
    }
  }

  // ==================== 1. PIXEL-ART GRIM REAPER FOR THE NEIGHBOR (240x135) ====================
  function drawPixelPine(c, cx, baseY, h, col) {
    for (let i = 0; i < h; i++) {
      const hw = Math.max(1, Math.floor((i / h) * (h * 0.36)) - (i % 5 === 0 ? 1 : 0));
      px(c, cx - hw, baseY - h + i, hw * 2 + 1, 1, col);
    }
  }

  // Preload 1:1 Authentic Pixel-Art Sprite Layers for The Neighbor (1366x768)
  const neighborSprites = {
    body: null,
    handL: null,
    handR: null,
    sleeves: null,
    initDone: false
  };

  function ensureNeighborSprites() {
    if (neighborSprites.initDone) return;
    neighborSprites.initDone = true;
    const loadImg = (src) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    neighborSprites.body    = loadImg("image/the_neighbor_body.jpg");
    neighborSprites.handL   = loadImg("image/the_neighbor_hand_l.png");
    neighborSprites.handR   = loadImg("image/the_neighbor_hand_r.png");
    neighborSprites.sleeves = loadImg("image/the_neighbor_sleeves.png");
  }
  ensureNeighborSprites();

  function renderNeighborPixelCanvas(canvasEl, timeSec, openFactor) {
    if (!canvasEl) return;
    ensureNeighborSprites();

    const W = 1366;
    const H = 768;
    if (canvasEl.width !== W || canvasEl.height !== H) {
      canvasEl.width = W;
      canvasEl.height = H;
    }
    const c = canvasEl.getContext("2d");

    // Smooth eased 0 (cupped inward) -> 1 (spread wide open toward player presenting 3 options!)
    const rawOpen = Math.max(0, Math.min(1, typeof openFactor === "number" ? openFactor : 0));
    const open = rawOpen * rawOpen * (3 - 2 * rawOpen);
    const breatheY = Math.sin(timeSec * 1.55) * 3.5;

    // 1. Base stormy blue-slate backdrop fallback while image decodes
    c.fillStyle = "#182433";
    c.fillRect(0, 0, W, H);

    // 2. Draw 100% Authentic 1:1 Pixel-Art Hood, Mahogany Cloak & Stormy Mist Backdrop!
    const bodyImg = neighborSprites.body;
    if (bodyImg && bodyImg.complete && bodyImg.naturalWidth > 0) {
      c.imageSmoothingEnabled = false;
      c.drawImage(bodyImg, 0, Math.round(breatheY), W, H);
      // Fill tiny 4px top strip when breathing shifts downward
      if (breatheY > 0) {
        c.drawImage(bodyImg, 0, 0, W, 6, 0, 0, W, Math.ceil(breatheY) + 1);
      }
    }

    // 3. Subtle slow drifting mist wisps across far left & right margins for atmosphere
    const drift = (timeSec * 16) % 260;
    c.save();
    for (let i = 0; i < 8; i++) {
      const mx = ((i * 210 + (i % 2 === 0 ? drift : -drift)) % (W + 320) + (W + 320)) % (W + 320) - 160;
      const my = 70 + (i * 93) % (H - 120);
      const mg = c.createRadialGradient(mx, my, 12, mx, my, 150);
      mg.addColorStop(0, "rgba(110, 142, 175, 0.06)");
      mg.addColorStop(1, "rgba(110, 142, 175, 0)");
      c.fillStyle = mg;
      c.fillRect(mx - 150, my - 150, 300, 300);
    }
    c.restore();

    // 4. Warm golden offering aura + rising sparkles between his palms as hands open for the 3 options!
    if (open > 0.04) {
      const pulse = 0.80 + Math.sin(timeSec * 4.0) * 0.20;
      const gRad = 175 + open * 165;
      const glow = c.createRadialGradient(683, 560 + breatheY, 18, 683, 515 + breatheY, gRad);
      glow.addColorStop(0, `rgba(255, 218, 126, ${(0.28 * open * pulse).toFixed(3)})`);
      glow.addColorStop(0.52, `rgba(218, 150, 48, ${(0.11 * open * pulse).toFixed(3)})`);
      glow.addColorStop(1, "rgba(190, 120, 30, 0)");
      c.fillStyle = glow;
      c.fillRect(683 - gRad, 515 + breatheY - gRad, gRad * 2, gRad * 2);

      for (let m = 0; m < 16; m++) {
        const cyc = (timeSec * 0.42 + m * 0.083) % 1;
        const mx = 683 + Math.sin(m * 2.1 + timeSec * 1.4) * (95 + open * 155);
        const my = 625 - cyc * 310 + breatheY;
        const sz = (m % 3 === 0) ? 5 : 3;
        c.fillStyle = `rgba(255, 232, 162, ${(0.62 * open * (1 - cyc)).toFixed(2)})`;
        c.fillRect(Math.round(mx), Math.round(my), sz, sz);
      }
    }

    // 5. Draw 100% Authentic Extracted Left & Right Hands pivoted right inside the sleeve cuffs!
    //    - open = 0: Cupped closely inward toward each other (chụm lại)
    //    - open = 1: Smoothly swung outward & reaching forward toward the player (xòe ra hướng về người chơi!)
    const drawExactHand = (img, rectX, rectY, pivotX, pivotY, side) => {
      if (!img || !img.complete || img.naturalWidth <= 0) return;
      // Note: In Canvas 2D, positive angle rotates clockwise!
      // Left hand (side = -1): cupped inward = -5° (CCW), open outward = +16° (CW swinging outward/downward-forward!)
      // Right hand (side = +1): mirror! cupped inward = +5° (CW), open outward = -16° (CCW)
      const deg = side * (5.0 * (1 - open) - 16.0 * open);
      const rad = (deg * Math.PI) / 180;
      const sc = 1.0 + 0.08 * open;
      const driftY = Math.sin(timeSec * 2.1 + (side > 0 ? 0.4 : 0)) * 2.5;

      c.save();
      c.imageSmoothingEnabled = false;
      c.translate(pivotX + side * 4 * open, pivotY + breatheY + 4 * open + driftY);
      c.rotate(rad);
      c.scale(sc, sc);
      c.drawImage(img, rectX - pivotX, rectY - pivotY);
      c.restore();
    };

    drawExactHand(neighborSprites.handL, 474, 526, 492, 548, -1);
    drawExactHand(neighborSprites.handR, 687, 530, 866, 550, +1);

    // 6. Redraw the exact tattered brown sleeve cuffs over the wrist entry seams (ZERO detached wrists!)
    const slImg = neighborSprites.sleeves;
    if (slImg && slImg.complete && slImg.naturalWidth > 0) {
      c.imageSmoothingEnabled = false;
      c.drawImage(slImg, 433, Math.round(470 + breatheY));
    }

    // 7. Subtle atmospheric dark blue-black outer edge vignette
    const vig = c.createRadialGradient(W / 2, H * 0.46, 260, W / 2, H * 0.50, 780);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(5, 9, 16, 0.55)");
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  // ==================== 2. MIDNIGHT 12:00 AM ENDGAME STATE MACHINE ====================
  function isEndgameActive(matchState) {
    return Boolean(matchState && matchState.endgame && matchState.endgame.active);
  }

  function isLockedInChosenRoom(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(
      eg &&
      eg.active &&
      (eg.stage === "JUDGMENT_SHAKE" || eg.stage === "PRE_LOSE_DARK" || eg.stage === "PRE_MIXED_DARK")
    );
  }

  function isLocalDeadSpectator(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && eg.deadSpectator);
  }

  function isLocalInCar(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && (eg.localBoardedCar || eg.stage === "WIN_CAR_DRIVE" || eg.stage === "WIN_CREDITS"));
  }

  function canInspectTableMap(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && (eg.stage === "ALARM_3X" || eg.stage === "CHOOSE_20S"));
  }

  function isDaylightWinMode(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && (eg.stage === "WIN_DAWN_CABIN" || eg.stage === "WIN_FOREST" || eg.stage === "WIN_CAR_DRIVE" || eg.stage === "WIN_CREDITS"));
  }

  function isInForestExit(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && (eg.stage === "WIN_FOREST" || eg.stage === "WIN_CAR_DRIVE"));
  }

  function isCutsceneBlocking(matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.active && (eg.stage === "LOSE_CUTSCENE" || eg.stage === "WIN_CAR_DRIVE" || eg.stage === "WIN_CREDITS"));
  }

  function isRoomShattered(roomKey, matchState) {
    const eg = matchState && matchState.endgame;
    return Boolean(eg && eg.shatteredRooms && eg.shatteredRooms.has(roomKey));
  }

  function getEarthquakeOffset(matchState, timeSec) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active || eg.stage !== "JUDGMENT_SHAKE") return { x: 0, y: 0 };
    const intensity = eg.shatterFlashTimer > 0 ? 11.5 : 6.2;
    return {
      x: Math.round((Math.sin(timeSec * 67) + Math.cos(timeSec * 43)) * intensity * 0.55),
      y: Math.round((Math.cos(timeSec * 59) + Math.sin(timeSec * 83)) * intensity * 0.55)
    };
  }

  function getGlobalFlickerMultiplier(matchState, timeSec) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active || eg.stage !== "JUDGMENT_SHAKE") return 1.0;
    if (eg.shatterFlashTimer > 0) return 1.15;
    // Rapid erratic electrical surge flickering across all intact rooms!
    const v = Math.sin(timeSec * 37) * Math.cos(timeSec * 19);
    if (v < -0.45) return 0.14;
    if (v < 0.0) return 0.42;
    if (v > 0.6) return 1.05;
    return 0.78;
  }

  function startMidnightEndgame(matchState, player) {
    if (!matchState || (matchState.endgame && matchState.endgame.active)) return false;

    // Clean up any other running events cleanly
    if (App.Stalkers && App.Stalkers.cleanup) App.Stalkers.cleanup(matchState);
    if (App.Musical && App.Musical.cleanup) App.Musical.cleanup(matchState);
    if (App.Basement && App.Basement.cleanup) App.Basement.cleanup(matchState);
    if (App.StayLit && App.StayLit.cleanup) App.StayLit.cleanup(matchState);
    if (App.Knight && App.Knight.cleanup) App.Knight.cleanup(matchState);
    if (App.Thief && App.Thief.cleanup) App.Thief.cleanup(matchState);
    if (matchState.atticEvent) {
      matchState.atticEvent.active = false;
      matchState.atticEvent.inAttic = false;
      matchState.atticEvent = null;
    }
    if (matchState.events && matchState.events.cuttingCorners) {
      matchState.events.cuttingCorners.stage = "DONE";
      matchState.events.globalLightsOut = false;
    }

    // Force player out of First-Person Table View into 3rd-person cabin exploration!
    if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
      App.GameWorld.forceStandUpForEvent();
    }
    if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(true);
    if (App.Clues && App.Clues.isInspectOpen()) App.Clues.closeInspectModal(true);

    matchState.setupPhase = "MIDNIGHT";
    matchState.clockMinutes = 720;

    matchState.endgame = {
      active: true,
      stage: "ALARM_3X", // ALARM_3X -> CHOOSE_20S -> JUDGMENT_SHAKE -> PRE_LOSE_DARK | PRE_MIXED_DARK -> LOSE_CUTSCENE | WIN_DAWN_CABIN -> WIN_FOREST -> WIN_CAR_DRIVE -> WIN_CREDITS
      countdown: 20.0,
      chosenRoomKey: null,
      chosenRoomId: null,
      playerWon: false,
      survivors: [],
      deadPlayers: [],
      mpChoiceMap: {},
      judgmentSyncedFromHost: false,
      deadSpectator: false,
      localBoardedCar: false,
      boardedCarIds: new Set(),
      shatterWaves: [],
      shatterWaveIdx: 0,
      shatterTimer: 5.0,
      shatterFlashTimer: 0,
      shatteredRooms: new Set(),
      glassShards: [],
      preLoseTimer: 0,
      cutsceneElapsed: 0,
      losePanelShown: false,
      carX: 114,
      carY: 136,
      carDriveTimer: 0,
      notice: "12:00 AM — MIDNIGHT ALARM SOUNDING..."
    };

    // Play end_game_alarm.mp3 3 times -> then reveal the Cutting-Corners-style 20s banner!
    if (App.Audio && App.Audio.playEndGameAlarm3x) {
      App.Audio.playEndGameAlarm3x(() => {
        if (!matchState.endgame || !matchState.endgame.active || matchState.endgame.stage !== "ALARM_3X") return;
        beginChooseRoom20s(matchState);
      });
    } else {
      beginChooseRoom20s(matchState);
    }

    return true;
  }

  function beginChooseRoom20s(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;
    eg.stage = "CHOOSE_20S";
    eg.countdown = 20.0;
    eg.notice = "CHOOSE THE EXIT ROOM BEFORE THE 20-SECOND TIMER ENDS!";

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE GAME HAS ENDED.\nCHOOSE THE EXIT ROOM WITHIN 20 SECONDS (SIT AT THE TABLE [E] TO CHECK YOUR MAP)...",
        {
          subtag: "12:00 AM — FINAL CHOICE",
          countdown: 20,
          typingDurationSec: 4.5,
          showChoices: false
        }
      );
    }
  }

  function getTrueExitRoomId(matchState) {
    if (!matchState) return "";
    return (
      (matchState.clueManifest && matchState.clueManifest.exitRoomId) ||
      matchState.sanctuaryRoomId ||
      ""
    );
  }

  function isMultiplayerMatch(matchState) {
    return Boolean(
      matchState &&
      matchState.mode === "MULTIPLAYER" &&
      App.Network &&
      App.Network.isMultiplayerMatch &&
      App.Network.isMultiplayerMatch()
    );
  }

  function getLocalPlayerEntry(matchState, chosenRoomKey, chosenRoomId, trueExitId) {
    const ch = (App.Config && App.Config.state && App.Config.state.character) || {};
    const localPid = (App.Network && App.Network.getLocalPlayerId) ? App.Network.getLocalPlayerId() : "local";
    const seatIdx = typeof matchState.localSeatIdx === "number" ? matchState.localSeatIdx : 0;
    const chairId = typeof matchState.localChairId === "number" ? matchState.localChairId : 0;
    return {
      playerId: localPid,
      seatIdx,
      chairId,
      name: (ch.name || "SURVIVOR").toUpperCase(),
      character: Object.assign({}, ch),
      roomKey: chosenRoomKey,
      roomId: chosenRoomId,
      survived: Boolean(trueExitId && chosenRoomId === trueExitId)
    };
  }

  function buildAllMatchPlayersSnapshot(matchState, localEntry, choiceMap) {
    const trueExitId = getTrueExitRoomId(matchState);
    const roomMap = matchState.roomMap || {};
    if (!isMultiplayerMatch(matchState)) {
      return [localEntry];
    }

    const seats = (App.Network && App.Network.getAllMatchSeats) ? App.Network.getAllMatchSeats() : [];
    const remotes = (App.Network && App.Network.getAllRemotePlayers) ? App.Network.getAllRemotePlayers() : [];
    const remoteById = new Map(remotes.map((r) => [r.playerId, r]));
    const localPid = localEntry.playerId;

    const entries = [];
    seats.forEach((s) => {
      if (s.playerId === localPid) {
        entries.push(localEntry);
        return;
      }
      const explicit = choiceMap && choiceMap[s.playerId];
      if (explicit) {
        entries.push({
          playerId: s.playerId,
          seatIdx: s.seatIdx,
          chairId: s.chairId,
          name: s.name,
          character: s.character,
          roomKey: explicit.roomKey,
          roomId: explicit.roomId,
          survived: Boolean(trueExitId && explicit.roomId === trueExitId)
        });
        return;
      }
      const rp = remoteById.get(s.playerId);
      const rk = rp ? `${rp.roomX || 0},${rp.roomY || 0}` : "0,0";
      const rObj = roomMap[rk] || { id: "dining_room" };
      entries.push({
        playerId: s.playerId,
        seatIdx: s.seatIdx,
        chairId: s.chairId,
        name: s.name,
        character: s.character,
        roomKey: rk,
        roomId: rObj.id,
        survived: Boolean(trueExitId && rObj.id === trueExitId)
      });
    });

    return entries.length ? entries : [localEntry];
  }

  function buildWrongRoomShatterWaves(matchState, occupiedWrongKeys) {
    const sanctuaryId = getTrueExitRoomId(matchState);
    const roomMap = matchState.roomMap || {};
    const wrongKeys = Object.keys(roomMap).filter((k) => roomMap[k].id !== sanctuaryId && roomMap[k].id !== "bp_cellar");
    const occSet = new Set((occupiedWrongKeys || []).filter((k) => wrongKeys.includes(k)));

    // Shuffle unoccupied wrong rooms first so occupied wrong rooms shatter dramatically on the FINAL wave!
    const otherWrong = wrongKeys.filter((k) => !occSet.has(k));
    for (let i = otherWrong.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherWrong[i], otherWrong[j]] = [otherWrong[j], otherWrong[i]];
    }

    const waves = [];

    if (otherWrong.length <= 3) {
      otherWrong.forEach((k) => waves.push([k]));
    } else {
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) waves.push([]);
      otherWrong.forEach((k, idx) => {
        waves[idx % waveCount].push(k);
      });
    }

    // Put ALL occupied wrong rooms on the final wave so players in wrong rooms stay in suspense until the end!
    if (occSet.size > 0) {
      waves.push(Array.from(occSet));
    }

    return waves.filter((w) => w.length > 0);
  }

  function resolveRoleForPlayer(matchState, eg, pid) {
    const fromChoice = eg && eg.mpChoiceMap && eg.mpChoiceMap[pid] && eg.mpChoiceMap[pid].roles;
    if (fromChoice) return fromChoice;
    const fromState = matchState && matchState.heldRolesByPlayer && matchState.heldRolesByPlayer[pid];
    if (fromState) return fromState;
    const localPid = (App.Network && App.Network.getLocalPlayerId) ? App.Network.getLocalPlayerId() : "local";
    if (pid === localPid && App.TableView && App.TableView.getLocalHeldRoleState) {
      return App.TableView.getLocalHeldRoleState();
    }
    return { hasTraitor: false, traitorDefective: false, hasSacrifice: false };
  }

  function applyLocalVerdictFields(eg, matchState) {
    const localPid = (App.Network && App.Network.getLocalPlayerId) ? App.Network.getLocalPlayerId() : "local";
    const localSurv = (eg.survivors || []).find((e) => e.playerId === localPid);
    const localDead = (eg.deadPlayers || []).find((e) => e.playerId === localPid);
    const mine = localSurv || localDead || null;
    if (mine) {
      eg.playerWon = Boolean(mine.survived);
      eg.localSavedByTraitor = Boolean(mine.savedByTraitor);
      eg.localSavedBySacrifice = Boolean(mine.savedBySacrifice);
      eg.localDiedBySacrifice = Boolean(mine.diedBySacrifice);
      eg.localSacrificeDefective = Boolean(mine.sacrificeDefective);
      eg.localPickedCorrectRoom = Boolean(mine.pickedCorrectRoom);
    }
  }

  function recomputeGeneralVerdict(matchState, broadcastIfHost) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;

    const trueExitId = getTrueExitRoomId(matchState);
    const localEntry = getLocalPlayerEntry(matchState, eg.chosenRoomKey, eg.chosenRoomId, trueExitId);
    const allEntries = buildAllMatchPlayersSnapshot(matchState, localEntry, eg.mpChoiceMap);

    // 1. Annotate every player with raw room correctness & held Multiplayer Special Role cards!
    const isMp = isMultiplayerMatch(matchState);
    allEntries.forEach((e) => {
      e.pickedCorrectRoom = Boolean(trueExitId && e.roomId === trueExitId);
      const roles = isMp ? resolveRoleForPlayer(matchState, eg, e.playerId) : { hasTraitor: false, traitorDefective: false, hasSacrifice: false };
      e.hasTraitorActive = Boolean(roles.hasTraitor && !roles.traitorDefective);
      e.hasSacrifice = Boolean(roles.hasSacrifice);
      e.savedByTraitor = false;
      e.savedBySacrifice = false;
      e.diedBySacrifice = false;
      e.sacrificeDefective = false;
      // Base survival: THE TRAITOR (when held & non-defective) guarantees Good Ending even on a wrong room!
      if (e.hasTraitorActive) {
        e.survived = true;
        e.savedByTraitor = !e.pickedCorrectRoom;
      } else {
        e.survived = e.pickedCorrectRoom;
      }
    });

    // 2. Apply THE SACRIFICE (Multiplayer only — DEFECTIVE if anyone holds an active THE TRAITOR card!)
    const anyActiveTraitor = allEntries.some((e) => e.hasTraitorActive);
    if (isMp) {
      allEntries.forEach((holder) => {
        if (!holder.hasSacrifice) return;
        if (anyActiveTraitor) {
          holder.sacrificeDefective = true;
          return;
        }
        const deadOthers = allEntries.filter((o) => o.playerId !== holder.playerId && !o.survived);
        if (deadOthers.length > 0) {
          // Pick 1 random dead teammate (keep stable pick if already chosen this judgment!)
          let rescued = eg.sacrificeRescuedId
            ? deadOthers.find((o) => o.playerId === eg.sacrificeRescuedId)
            : null;
          if (!rescued) {
            rescued = deadOthers[Math.floor(Math.random() * deadOthers.length)];
            eg.sacrificeRescuedId = rescued.playerId;
          }
          // Even if the Sacrifice holder picked the RIGHT room, it becomes a life-swap:
          // holder dies (headless bloody corpse on Good Ending table) and the rescued teammate enters Good Ending!
          rescued.survived = true;
          rescued.savedBySacrifice = true;
          holder.survived = false;
          holder.diedBySacrifice = true;
        }
      });
    }

    eg.survivors = allEntries.filter((e) => e.survived);
    eg.deadPlayers = allEntries.filter((e) => !e.survived);
    applyLocalVerdictFields(eg, matchState);

    const occupiedWrongKeys = eg.deadPlayers.map((d) => d.roomKey).filter(Boolean);
    if (!eg.judgmentSyncedFromHost || (isMp && App.Network.isHost())) {
      eg.shatterWaves = buildWrongRoomShatterWaves(matchState, occupiedWrongKeys);
    }

    if (broadcastIfHost && isMp && App.Network.isHost()) {
      App.Network.sendGameAction("MP_ENDGAME_JUDGMENT", {
        trueExitId,
        waves: eg.shatterWaves,
        survivors: eg.survivors,
        deadPlayers: eg.deadPlayers,
        sacrificeRescuedId: eg.sacrificeRescuedId || null
      });
    }
  }

  function beginJudgmentLockdown(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;

    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
    if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(true);
    if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
      App.GameWorld.forceStandUpForEvent();
    }

    const rk = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const chosenRoom = (matchState.roomMap && matchState.roomMap[rk]) || { id: "dining_room", fullName: "THE DINING ROOM" };
    const trueExitId = getTrueExitRoomId(matchState);

    eg.stage = "JUDGMENT_SHAKE";
    eg.chosenRoomKey = rk;
    eg.chosenRoomId = chosenRoom.id;
    eg.playerWon = Boolean(trueExitId && chosenRoom.id === trueExitId);
    eg.deadSpectator = false;
    eg.localBoardedCar = false;
    eg.boardedCarIds = new Set();
    eg.sacrificeRescuedId = null;

    // Turn ALL built rooms' lights ON so every single room flickers violently together!
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    if (isMultiplayerMatch(matchState)) {
      const localPid = App.Network.getLocalPlayerId();
      const localRoles = (App.TableView && App.TableView.getLocalHeldRoleState)
        ? App.TableView.getLocalHeldRoleState()
        : { hasTraitor: false, traitorDefective: false, hasSacrifice: false };
      eg.mpChoiceMap[localPid] = { roomKey: rk, roomId: chosenRoom.id, roles: localRoles };
      App.Network.sendGameAction("MP_ENDGAME_CHOICE", {
        playerId: localPid,
        roomKey: rk,
        roomId: chosenRoom.id,
        roles: localRoles
      });
    }

    recomputeGeneralVerdict(matchState, true);
    eg.shatterWaveIdx = 0;
    eg.shatterTimer = 5.0; // First wrong-room shatter hits after 5 seconds, then every 5 seconds!
    eg.notice = `LOCKED IN ${chosenRoom.fullName || chosenRoom.name} — THE CABIN IS SHAKING VIOLENTLY!`;

    App.Audio.hexAlert();
  }

  function spawnGlassShards(eg, isDining) {
    const cx = 104;
    const cy = isDining ? 82 : 44; // Exact Dining Room hanging bulb coordinate (104, 82)!
    for (let i = 0; i < 34; i++) {
      eg.glassShards.push({
        x: cx + (Math.random() - 0.5) * (isDining ? 14 : 62),
        y: cy + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 76,
        vy: -16 + Math.random() * 68,
        size: Math.random() > 0.50 ? 2 : 1,
        life: 1.5 + Math.random() * 0.8
      });
    }
  }

  function shatterPlayerRoomAndLose(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg) return;
    eg.shatteredRooms.add(eg.chosenRoomKey);
    matchState.roomLightStates[eg.chosenRoomKey] = false;
    if (player) player.lanternOn = false; // Plunge the shattered room cleanly into darkness!
    spawnGlassShards(eg, eg.chosenRoomKey === "0,0");

    // GENERAL / COMBINED ENDING CHECK:
    // - If at least 1 teammate survived -> Dead player enters mixed Dawn Good Ending as a headless corpse on the table!
    // - If NOBODY survived (0 survivors) -> Full Bad Ending Lose Cutscene with all corpses slumped on the table!
    if (isMultiplayerMatch(matchState) && eg.survivors && eg.survivors.length > 0) {
      eg.deadSpectator = true;
      eg.notice = eg.localDiedBySacrifice
        ? "THE SACRIFICE ACTIVATED — YOU GAVE YOUR LIFE TO SPARE A TEAMMATE!"
        : `YOUR ROOM SHATTERED — YOU DIED! (${eg.survivors.length} TEAMMATE${eg.survivors.length > 1 ? "S" : ""} SURVIVED...)`;
      eg.stage = "PRE_MIXED_DARK";
      eg.preLoseTimer = eg.localDiedBySacrifice && eg.localPickedCorrectRoom ? 2.4 : 5.0;
    } else {
      eg.notice = "YOUR ROOM'S LIGHT BULB SHATTERED! THIS WAS THE WRONG ROOM...";
      eg.stage = "PRE_LOSE_DARK";
      eg.preLoseTimer = 2.4;
    }
  }

  function triggerNextWrongRoomShatter(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;

    if (eg.shatterWaveIdx >= eg.shatterWaves.length) {
      // Every wrong room has shattered -> check final survival (including THE TRAITOR & THE SACRIFICE)!
      if (eg.playerWon) {
        enterDawnWinCabin(matchState, player);
      } else {
        // Wrong room OR Sacrifice holder who traded their life on the right room -> shatter bulb now!
        if (App.Audio && App.Audio.playLightBreak) App.Audio.playLightBreak(5.0);
        eg.shatterFlashTimer = 0.32;
        shatterPlayerRoomAndLose(matchState, player);
      }
      return;
    }

    const wave = eg.shatterWaves[eg.shatterWaveIdx++];
    // Play audio/light_break.mp3 (5 seconds)!
    if (App.Audio && App.Audio.playLightBreak) {
      App.Audio.playLightBreak(5.0);
    }

    eg.shatterFlashTimer = 0.30;
    const names = [];
    let hitPlayerRoom = false;

    wave.forEach((rk) => {
      // If local player is shielded by THE TRAITOR or spared by THE SACRIFICE while in a wrong room,
      // keep their bulb glowing instead of plunging them into death!
      if (rk === eg.chosenRoomKey && eg.playerWon) {
        eg.notice = eg.localSavedByTraitor
          ? "THE TRAITOR SHIELDED YOU — YOUR LIGHT REFUSES TO BREAK!"
          : eg.localSavedBySacrifice
            ? "THE SACRIFICE SPARED YOUR LIFE — YOUR LIGHT HOLDS STRONG!"
            : eg.notice;
        return;
      }
      eg.shatteredRooms.add(rk);
      matchState.roomLightStates[rk] = false;
      const rObj = matchState.roomMap && matchState.roomMap[rk];
      if (rObj) names.push(rObj.fullName || rObj.name);
      if (rk === eg.chosenRoomKey) hitPlayerRoom = true;
    });

    if (hitPlayerRoom && !eg.playerWon) {
      shatterPlayerRoomAndLose(matchState, player);
      return;
    }

    if (names.length === 1) {
      eg.notice = `${names[0]}'S LIGHT BULB SHATTERED!`;
    } else if (names.length > 1) {
      eg.notice = `${names.length} WRONG ROOMS' LIGHT BULBS SHATTERED!`;
    }

    // Schedule next wave in 5 seconds (or win transition after 5s if that was the final wrong room wave!)
    eg.shatterTimer = 5.0;
  }

  // ==================== 3. LOSE CUTSCENE (BLOODY HEADLESS CORPSE ON TABLE -> ZOOM OUT) ====================
  function enterLoseCutscene(matchState, customReason) {
    const eg = matchState && matchState.endgame;
    if (!eg) return;

    if (App.Audio && App.Audio.stopLightBreak) App.Audio.stopLightBreak();
    if (App.Audio && App.Audio.stopClockTick) App.Audio.stopClockTick();
    if (App.Audio && App.Audio.stopPawnMove) App.Audio.stopPawnMove();
    if (App.Audio && App.Audio.stopRimTurn) App.Audio.stopRimTurn();
    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();

    eg.stage = "LOSE_CUTSCENE";
    eg.cutsceneElapsed = 0;
    eg.losePanelShown = false;
    if (customReason) eg.loseReason = customReason;

    const stageEl = document.getElementById("endgame-cutscene-stage");
    const overlayEl = document.getElementById("endgame-lose-overlay");
    const reasonEl = document.getElementById("endgame-lose-reason");
    const truthEl = document.getElementById("endgame-true-room-reveal");
    if (overlayEl) overlayEl.classList.add("hidden");
    if (reasonEl) {
      reasonEl.textContent =
        eg.loseReason ||
        (isMultiplayerMatch(matchState)
          ? "NO ONE CHOSE THE TRUE EXIT ROOM AT MIDNIGHT."
          : "YOU CHOSE THE WRONG EXIT ROOM AT MIDNIGHT.");
    }
    if (truthEl) {
      const trueId = getTrueExitRoomId(matchState);
      const trueObj = App.FieldBook && App.FieldBook.EXIT_ROOM_MAP
        ? App.FieldBook.EXIT_ROOM_MAP[trueId]
        : null;
      truthEl.textContent = `THE TRUE EXIT ROOM WAS: ${trueObj ? trueObj.name : "UNKNOWN"}`;
    }
    if (stageEl) stageEl.classList.remove("hidden");

    App.Audio.hexAlert();
    if (App.Audio && App.Audio.startGameOverBgm) App.Audio.startGameOverBgm();
  }

  function getPaletteColors(charCfg) {
    const ch = charCfg || (App.Config && App.Config.state && App.Config.state.character) || {};
    const pal = App.Config ? App.Config.PALETTES : null;
    return {
      shirtCol: (pal && pal.shirt[ch.shirtColor]?.base) || "#96997a",
      pantsCol: (pal && pal.pants[ch.pantsColor]?.base) || "#5b7496",
      shoeCol:  (pal && pal.shoes[ch.shoeColor]?.base) || "#363734",
      skinCol:  (pal && pal.skin[ch.skin]?.base) || "#eb885e"
    };
  }

  function getLoseCutsceneCorpses(matchState) {
    const eg = matchState && matchState.endgame;
    if (eg && Array.isArray(eg.deadPlayers) && eg.deadPlayers.length > 0) {
      return eg.deadPlayers;
    }
    if (isMultiplayerMatch(matchState) && App.Network && App.Network.getAllMatchSeats) {
      return App.Network.getAllMatchSeats();
    }
    const ch = (App.Config && App.Config.state && App.Config.state.character) || {};
    return [{
      playerId: "local",
      seatIdx: 0,
      chairId: typeof matchState?.localChairId === "number" ? matchState.localChairId : 0,
      name: (ch.name || "SURVIVOR").toUpperCase(),
      character: ch
    }];
  }

  // Draws ONE bloody headless pixel corpse slumped face-down over the round table from ANY fixed chair (0=W, 1=E, 2=N, 3=S)!
  // Center of table is (cx, cy). Used in BOTH top-down LOSE_CUTSCENE (120, 54) AND playable Good Ending Dining Room (104, 126)!
  function drawSlumpedHeadlessCorpseAtChair(c, cx, cy, chairId, charCfg, spread, scaleMode) {
    const cols = getPaletteColors(charCfg);
    const sp = Math.max(0, Math.min(1, typeof spread === "number" ? spread : 1));
    const isDawnRoom = scaleMode === "DAWN_PARLOR";

    // Offset slightly inward for 3/4 Parlor table (rx=30, ry=24) vs top-down Lose Cutscene table (rx=25, ry=19)
    const rxOff = isDawnRoom ? 2 : 0;
    const ryOff = isDawnRoom ? 2 : 0;

    if (chairId === 0) {
      // WEST CHAIR -> Slumped face-down EAST across the left side of the round table!
      const bx = cx - 4 - rxOff;
      const by = cy - 1;
      fillPixelEllipse(c, bx + 2, by, Math.round(7 + sp * 6), Math.round(5 + sp * 4), "#4f070c");
      fillPixelEllipse(c, bx + 3, by - 1, Math.round(5 + sp * 4), Math.round(3 + sp * 3), "#7a0c14");
      fillPixelEllipse(c, bx + 4, by - 1, Math.round(2 + sp * 2), Math.round(2 + sp * 1.5), "#9e141e");
      px(c, bx + 8, by - 4, 3, 2, "#780c14");
      px(c, bx - 3, by + 11, 3, 5, "#5c080e");
      px(c, bx - 4, by + 17, 4, 3, "#47060a");

      // Legs & boots hanging back on West chair
      px(c, cx - 35 - rxOff, cy - 3, 9, 5, "#1a1414");
      px(c, cx - 34 - rxOff, cy - 2, 7, 3, cols.pantsCol);
      px(c, cx - 38 - rxOff, cy - 2, 4, 4, cols.shoeCol);
      // Slumped torso collapsed forward onto table
      px(c, cx - 27 - rxOff, cy - 7, 17, 13, "#141010");
      px(c, cx - 26 - rxOff, cy - 6, 15, 11, cols.shirtCol);
      px(c, cx - 25 - rxOff, cy - 5, 13, 3, "rgba(0,0,0,0.22)");
      // Limp arms splayed forward on blood-soaked planks
      px(c, cx - 15 - rxOff, cy - 11, 11, 4, cols.shirtCol);
      px(c, cx - 4 - rxOff,  cy - 11, 4, 3, cols.skinCol);
      px(c, cx - 14 - rxOff, cy + 4,  10, 4, cols.shirtCol);
      px(c, cx - 4 - rxOff,  cy + 5,  4, 3, cols.skinCol);
      // Severed crimson neck stump — HEAD COMPLETELY GONE!
      px(c, cx - 11 - rxOff, cy - 4, 4, 6, "#54080d");
      px(c, cx - 10 - rxOff, cy - 3, 3, 4, "#96121c");
      px(c, cx - 9 - rxOff,  cy - 2, 1, 2, "#d9c9b8");
      return;
    }

    if (chairId === 1) {
      // EAST CHAIR -> Slumped face-down WEST across the right side of the round table!
      const bx = cx + 4 + rxOff;
      const by = cy - 1;
      fillPixelEllipse(c, bx - 2, by, Math.round(7 + sp * 6), Math.round(5 + sp * 4), "#4f070c");
      fillPixelEllipse(c, bx - 3, by - 1, Math.round(5 + sp * 4), Math.round(3 + sp * 3), "#7a0c14");
      fillPixelEllipse(c, bx - 4, by - 1, Math.round(2 + sp * 2), Math.round(2 + sp * 1.5), "#9e141e");
      px(c, bx - 10, by + 3, 3, 2, "#780c14");
      px(c, bx + 2, by + 11, 3, 5, "#5c080e");
      px(c, bx + 2, by + 17, 4, 3, "#47060a");

      // Legs & boots hanging back on East chair
      px(c, cx + 26 + rxOff, cy - 3, 9, 5, "#1a1414");
      px(c, cx + 27 + rxOff, cy - 2, 7, 3, cols.pantsCol);
      px(c, cx + 34 + rxOff, cy - 2, 4, 4, cols.shoeCol);
      // Slumped torso collapsed forward onto table
      px(c, cx + 10 + rxOff, cy - 7, 17, 13, "#141010");
      px(c, cx + 11 + rxOff, cy - 6, 15, 11, cols.shirtCol);
      px(c, cx + 12 + rxOff, cy - 5, 13, 3, "rgba(0,0,0,0.22)");
      // Limp arms splayed forward on blood-soaked planks
      px(c, cx + 4 + rxOff, cy - 11, 11, 4, cols.shirtCol);
      px(c, cx + 0 + rxOff, cy - 11, 4, 3, cols.skinCol);
      px(c, cx + 4 + rxOff, cy + 4,  10, 4, cols.shirtCol);
      px(c, cx + 0 + rxOff, cy + 5,  4, 3, cols.skinCol);
      // Severed crimson neck stump — HEAD COMPLETELY GONE!
      px(c, cx + 7 + rxOff, cy - 4, 4, 6, "#54080d");
      px(c, cx + 7 + rxOff, cy - 3, 3, 4, "#96121c");
      px(c, cx + 8 + rxOff, cy - 2, 1, 2, "#d9c9b8");
      return;
    }

    if (chairId === 2) {
      // NORTH CHAIR -> Slumped face-down SOUTH across the top side of the round table!
      const bx = cx;
      const by = cy - 4 - ryOff;
      fillPixelEllipse(c, bx, by + 2, Math.round(6 + sp * 5), Math.round(5 + sp * 4), "#4f070c");
      fillPixelEllipse(c, bx, by + 3, Math.round(4 + sp * 4), Math.round(3 + sp * 3), "#7a0c14");
      fillPixelEllipse(c, bx, by + 4, Math.round(2 + sp * 2), Math.round(2 + sp * 1.5), "#9e141e");
      px(c, bx + 5, by + 7, 2, 3, "#780c14");

      // Legs & boots hanging back on North chair
      px(c, cx - 3, cy - 29 - ryOff, 6, 8, "#1a1414");
      px(c, cx - 2, cy - 28 - ryOff, 4, 6, cols.pantsCol);
      px(c, cx - 2, cy - 32 - ryOff, 4, 4, cols.shoeCol);
      // Slumped torso collapsed downward onto table
      px(c, cx - 7, cy - 22 - ryOff, 14, 14, "#141010");
      px(c, cx - 6, cy - 21 - ryOff, 12, 12, cols.shirtCol);
      px(c, cx - 5, cy - 20 - ryOff, 10, 3, "rgba(0,0,0,0.22)");
      // Limp arms splayed downward onto table
      px(c, cx - 10, cy - 13 - ryOff, 4, 10, cols.shirtCol);
      px(c, cx - 10, cy - 3 - ryOff,  3, 3, cols.skinCol);
      px(c, cx + 6,  cy - 13 - ryOff, 4, 10, cols.shirtCol);
      px(c, cx + 7,  cy - 3 - ryOff,  3, 3, cols.skinCol);
      // Severed crimson neck stump — HEAD COMPLETELY GONE!
      px(c, cx - 3, cy - 9 - ryOff, 6, 4, "#54080d");
      px(c, cx - 2, cy - 8 - ryOff, 4, 3, "#96121c");
      px(c, cx - 1, cy - 7 - ryOff, 2, 1, "#d9c9b8");
      return;
    }

    // SOUTH CHAIR (chairId === 3) -> Slumped face-down NORTH across the bottom side of the round table!
    const bx = cx;
    const by = cy + 4 + ryOff;
    fillPixelEllipse(c, bx, by - 2, Math.round(6 + sp * 5), Math.round(5 + sp * 4), "#4f070c");
    fillPixelEllipse(c, bx, by - 3, Math.round(4 + sp * 4), Math.round(3 + sp * 3), "#7a0c14");
    fillPixelEllipse(c, bx, by - 4, Math.round(2 + sp * 2), Math.round(2 + sp * 1.5), "#9e141e");
    px(c, bx - 6, by + 12, 3, 4, "#5c080e");
    px(c, bx - 6, by + 17, 4, 3, "#47060a");

    // Legs & boots hanging back on South chair
    px(c, cx - 3, cy + 21 + ryOff, 6, 8, "#1a1414");
    px(c, cx - 2, cy + 22 + ryOff, 4, 6, cols.pantsCol);
    px(c, cx - 2, cy + 28 + ryOff, 4, 4, cols.shoeCol);
    // Slumped torso collapsed upward onto table
    px(c, cx - 7, cy + 8 + ryOff, 14, 14, "#141010");
    px(c, cx - 6, cy + 9 + ryOff, 12, 12, cols.shirtCol);
    px(c, cx - 5, cy + 10 + ryOff, 10, 3, "rgba(0,0,0,0.22)");
    // Limp arms splayed upward onto table
    px(c, cx - 10, cy + 3 + ryOff, 4, 10, cols.shirtCol);
    px(c, cx - 10, cy + 0 + ryOff, 3, 3, cols.skinCol);
    px(c, cx + 6,  cy + 3 + ryOff, 4, 10, cols.shirtCol);
    px(c, cx + 7,  cy + 0 + ryOff, 3, 3, cols.skinCol);
    // Severed crimson neck stump — HEAD COMPLETELY GONE!
    px(c, cx - 3, cy + 5 + ryOff, 6, 4, "#54080d");
    px(c, cx - 2, cy + 5 + ryOff, 4, 3, "#96121c");
    px(c, cx - 1, cy + 6 + ryOff, 2, 1, "#d9c9b8");
  }

  // Draws the bloody headless corpses of DEAD players directly on the sunlit Round Table in the Good Ending Dining Room!
  function renderDawnTableCorpses(ctx, timeSec, matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active || eg.stage !== "WIN_DAWN_CABIN") return;
    if (!Array.isArray(eg.deadPlayers) || eg.deadPlayers.length === 0) return;

    const tbl = (App.GameRoom && App.GameRoom.TABLE) || { cx: 104, cy: 126 };
    // Sort corpses cleanly by chair Y depth: North (2) -> West (0) / East (1) -> South (3)
    const order = { 2: 0, 0: 1, 1: 2, 3: 3 };
    const sorted = eg.deadPlayers.slice().sort((a, b) => (order[a.chairId] || 0) - (order[b.chairId] || 0));
    sorted.forEach((dead) => {
      drawSlumpedHeadlessCorpseAtChair(ctx, tbl.cx, tbl.cy, dead.chairId || 0, dead.character, 1.0, "DAWN_PARLOR");
    });
  }

  // Triggered when The Hollow Harvester catches & eliminates the player(s) on the clock track!
  function startHarvesterLoseCutscene(matchState, fromNetwork) {
    if (!matchState) return false;
    if (matchState.endgame && matchState.endgame.active && matchState.endgame.stage === "LOSE_CUTSCENE") {
      return true;
    }

    if (App.Stalkers && App.Stalkers.cleanup) App.Stalkers.cleanup(matchState);
    if (App.Musical && App.Musical.cleanup) App.Musical.cleanup(matchState);
    if (App.Basement && App.Basement.cleanup) App.Basement.cleanup(matchState);
    if (App.StayLit && App.StayLit.cleanup) App.StayLit.cleanup(matchState);
    if (App.Knight && App.Knight.cleanup) App.Knight.cleanup(matchState);
    if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(true);
    if (App.Clues && App.Clues.isInspectOpen()) App.Clues.closeInspectModal(true);
    if (App.TableView && App.TableView.isOpen()) App.TableView.close(true);

    const allDead = isMultiplayerMatch(matchState) && App.Network && App.Network.getAllMatchSeats
      ? App.Network.getAllMatchSeats()
      : [getLocalPlayerEntry(matchState, "0,0", "dining_room", "")];

    matchState.setupPhase = "GAME_OVER";
    matchState.endgame = {
      active: true,
      stage: "LOSE_CUTSCENE",
      loseReason: "THE HOLLOW HARVESTER CAUGHT YOU ON THE CLOCK TRACK.",
      countdown: 0,
      chosenRoomKey: "0,0",
      chosenRoomId: "dining_room",
      playerWon: false,
      survivors: [],
      deadPlayers: allDead,
      mpChoiceMap: {},
      judgmentSyncedFromHost: true,
      deadSpectator: false,
      localBoardedCar: false,
      boardedCarIds: new Set(),
      shatterWaves: [],
      shatterWaveIdx: 0,
      shatterTimer: 0,
      shatterFlashTimer: 0,
      shatteredRooms: new Set(),
      glassShards: [],
      preLoseTimer: 0,
      cutsceneElapsed: 0,
      losePanelShown: false,
      carX: 114,
      carY: 136,
      carDriveTimer: 0,
      notice: ""
    };

    if (!fromNetwork && isMultiplayerMatch(matchState)) {
      App.Network.sendGameAction("MP_HARVESTER_LOSE", {
        deadPlayers: allDead,
        loseReason: matchState.endgame.loseReason
      });
    }

    enterLoseCutscene(matchState, matchState.endgame.loseReason);
    return true;
  }

  function renderLoseCutsceneCanvas(canvasEl, timeSec, matchState) {
    if (!canvasEl) return;
    const W = 240;
    const H = 135;
    if (canvasEl.width !== W || canvasEl.height !== H) {
      canvasEl.width = W;
      canvasEl.height = H;
    }
    const c = canvasEl.getContext("2d");
    c.imageSmoothingEnabled = false;

    const eg = matchState && matchState.endgame;
    const t = eg ? eg.cutsceneElapsed : 0;

    // Smooth cinematic pull-back: starts tight close-up on the bloody round table (zoom 2.35x)
    // and slowly zooms out & pans south toward the swung-open front cabin door!
    const frac = Math.min(1, t / 8.2);
    const ease = frac < 0.5 ? 2 * frac * frac : 1 - Math.pow(-2 * frac + 2, 2) / 2;
    const zoom = 2.35 - ease * 1.48; // 2.35 -> 0.87
    const camCenterX = 120;
    const camCenterY = 54 + ease * 36; // Pulls from table center (54) toward open front door (90)!

    px(c, 0, 0, W, H, "#040407");

    c.save();
    c.translate(W / 2, H / 2);
    c.scale(zoom, zoom);
    c.translate(-camCenterX, -camCenterY);

    // 1. Dark Night Forest visible outside the open South cabin door (y = 116..180)
    px(c, 0, 114, 240, 80, "#08101c");
    [28, 54, 78, 162, 186, 214].forEach((tx) => {
      drawPixelPine(c, tx, 178, 56, "#04080f");
    });
    // Porch planks outside open doorway
    px(c, 92, 114, 56, 20, "#241912");
    px(c, 92, 122, 56, 1, "#140d09");
    px(c, 92, 129, 56, 1, "#140d09");

    // 2. Top-Down Dining Room Floorboards (x = 40..200, y = 4..114)
    px(c, 36, 0, 168, 118, "#1c110a");
    for (let y = 4; y < 114; y += 6) {
      px(c, 40, y, 160, 5, y % 12 === 0 ? "#5e3c25" : "#543520");
      px(c, 40, y + 5, 160, 1, "#331f13");
    }

    // Swung-open front cabin door at South wall (x = 104..136, y = 112)
    px(c, 102, 110, 36, 8, "#08101c"); // Open doorway to night forest
    // Door panel swung wide open inward-left
    px(c, 88, 96, 15, 16, "#2b1a0e");
    px(c, 90, 98, 11, 12, "#634129");

    // Crimson & gold woven round rug beneath table
    fillPixelEllipse(c, 120, 54, 42, 34, "#3b171c");
    fillPixelEllipse(c, 120, 54, 37, 29, "#7d5e31");
    fillPixelEllipse(c, 120, 54, 34, 26, "#4d1d24");

    // 4 Chairs around table
    px(c, 82, 48, 10, 12, "#382114");  // West chair (0)
    px(c, 150, 48, 10, 12, "#382114"); // East chair (1)
    px(c, 114, 20, 12, 10, "#382114"); // North chair (2)
    px(c, 114, 78, 12, 10, "#382114"); // South chair (3)

    // 3. Round Wooden Dining Table (top-down view, center 120, 54)
    fillPixelEllipse(c, 120, 56, 28, 22, "rgba(0,0,0,0.55)");
    fillPixelEllipse(c, 120, 54, 27, 21, "#24140b");
    fillPixelEllipse(c, 120, 54, 25, 19, "#6e4b30");
    // Wood plank lines & carved groove ring
    for (let x = 96; x <= 144; x += 6) {
      px(c, x, 36, 1, 36, "rgba(38, 22, 12, 0.35)");
    }
    c.strokeStyle = "#331e12";
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(120, 54, 19, 14, 0, 0, Math.PI * 2);
    c.stroke();

    // 4. ALL DEAD PLAYERS' HEADLESS BLOODY CORPSES SLUMPED OVER THE ROUND TABLE AT THEIR EXACT SEATS!
    const spread = Math.min(1, t / 3.5);
    const corpses = getLoseCutsceneCorpses(matchState);
    const order = { 2: 0, 0: 1, 1: 2, 3: 3 };
    corpses
      .slice()
      .sort((a, b) => (order[a.chairId] || 0) - (order[b.chairId] || 0))
      .forEach((dead) => {
        drawSlumpedHeadlessCorpseAtChair(c, 120, 54, dead.chairId || 0, dead.character, spread, "TOP_DOWN");
      });

    c.restore();

    // 5. Dim flickering dim-bulb overhead cone + cold moonlight from open front door
    const flick = 0.88 + Math.sin(timeSec * 14) * 0.12;
    const vig = c.createRadialGradient(W / 2, H * 0.45, 18, W / 2, H * 0.5, 145);
    vig.addColorStop(0, `rgba(255, 196, 132, ${(0.07 * flick).toFixed(3)})`);
    vig.addColorStop(0.55, "rgba(6, 4, 8, 0.35)");
    vig.addColorStop(1, "rgba(2, 2, 4, 0.90)");
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  // ==================== 4. WIN SEQUENCE: MORNING DAWN + SINGLE-DOOR DINING ROOM -> FOREST & CAR ====================
  function enterDawnWinCabin(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg) return;

    if (App.Audio && App.Audio.stopLightBreak) App.Audio.stopLightBreak();
    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();

    eg.stage = "WIN_DAWN_CABIN";
    eg.shatteredRooms.clear();
    matchState.persistentEventProps = {};
    matchState.archFlickerLight = 1.0;

    // ERASE ALL OTHER ROOMS! Create a single map with ONLY The Dining Room & 1 sunlit exit door (South)!
    matchState.roomMap = {
      "0,0": {
        x: 0,
        y: 0,
        id: "dining_room",
        glyph: "DR",
        name: "DINING",
        fullName: "THE DINING ROOM (DAWN)",
        shape: "dead_end",
        rotation: 2,
        doors: { N: false, E: false, S: true, W: false },
        isParlor: true,
        deadEnd: true
      }
    };
    matchState.roomsBuilt = 1;
    matchState.roomLightStates = { "0,0": true };
    matchState.currentRoomCoord = { x: 0, y: 0 };

    // Place living survivors in the sunlit Dining Room; keep dead players spectating their headless corpse on the table!
    if (player) {
      player.seated = false;
      player.crouching = false;
      const seatOffset = ((matchState.localSeatIdx || 0) - 1) * 12;
      player.x = Math.max(40, Math.min(168, 104 + (isMultiplayerMatch(matchState) ? seatOffset : 0)));
      player.y = 168;
      player.facing = 1;
    }

    const deadCount = Array.isArray(eg.deadPlayers) ? eg.deadPlayers.length : 0;
    if (eg.deadSpectator) {
      eg.notice = eg.localDiedBySacrifice
        ? `THE SACRIFICE CLAIMED YOUR LIFE AT THE TABLE — WATCHING ${eg.survivors.length} SURVIVOR${eg.survivors.length > 1 ? "S" : ""} ESCAPE!`
        : `YOU DIED AT THE TABLE — WATCHING ${eg.survivors.length} SURVIVOR${eg.survivors.length > 1 ? "S" : ""} ESCAPE AT DAWN...`;
    } else if (eg.localSavedByTraitor) {
      eg.notice = "THE TRAITOR GUARANTEED YOUR ESCAPE! STEP OUTSIDE THROUGH THE SUNLIT FRONT DOOR!";
    } else if (eg.localSavedBySacrifice) {
      eg.notice = "ANOTHER GUEST SACRIFICED THEIR LIFE FOR YOU! STEP OUTSIDE TO THE CAR!";
    } else if (deadCount > 0) {
      eg.notice = `DAWN HAS BROKEN! ${deadCount} GUEST${deadCount > 1 ? "S" : ""} DID NOT MAKE IT — STEP OUTSIDE TO THE CAR!`;
    } else {
      eg.notice = "YOU CHOSE THE RIGHT ROOM! MORNING HAS BROKEN — STEP OUTSIDE THROUGH THE FRONT DOOR!";
    }
    App.Audio.clockChime();
    if (App.Audio && App.Audio.startGoodEndBgm) App.Audio.startGoodEndBgm();
  }

  function getActiveSurvivorCount(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !isMultiplayerMatch(matchState)) return 1;
    const currentSeats = (App.Network && App.Network.getAllMatchSeats) ? App.Network.getAllMatchSeats() : [];
    const connectedIds = new Set(currentSeats.map((s) => s.playerId));
    const activeSurvs = (eg.survivors || []).filter((s) => connectedIds.has(s.playerId));
    return Math.max(1, activeSurvs.length);
  }

  function getBoardedActiveCount(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.boardedCarIds) return 0;
    if (!isMultiplayerMatch(matchState)) return eg.localBoardedCar ? 1 : 0;
    const currentSeats = (App.Network && App.Network.getAllMatchSeats) ? App.Network.getAllMatchSeats() : [];
    const connectedIds = new Set(currentSeats.map((s) => s.playerId));
    const survIds = new Set((eg.survivors || []).filter((s) => connectedIds.has(s.playerId)).map((s) => s.playerId));
    let count = 0;
    eg.boardedCarIds.forEach((pid) => {
      if (survIds.has(pid)) count += 1;
    });
    return count;
  }

  function launchCarDriveNow(matchState, player, fromNetwork) {
    const eg = matchState && matchState.endgame;
    if (!eg || eg.stage === "WIN_CAR_DRIVE" || eg.stage === "WIN_CREDITS") return;

    eg.stage = "WIN_CAR_DRIVE";
    eg.carDriveTimer = 0;
    if (player) player.moving = false;
    eg.notice = "ALL SURVIVORS IN THE CAR — ESCAPING DUSKWOOD INN!";
    if (!fromNetwork && isMultiplayerMatch(matchState)) {
      App.Network.sendGameAction("MP_CAR_DRIVE_START", {});
    }
    if (App.Audio && App.Audio.carEngineStart) App.Audio.carEngineStart();
  }

  function checkAllSurvivorsBoarded(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg || eg.stage !== "WIN_FOREST") return;
    const needed = getActiveSurvivorCount(matchState);
    const boarded = getBoardedActiveCount(matchState);
    if (boarded >= needed) {
      launchCarDriveNow(matchState, player, false);
    } else if (eg.localBoardedCar) {
      eg.notice = `IN THE CAR (${boarded}/${needed} SURVIVORS) — WAITING FOR EVERYONE TO BOARD...`;
    }
  }

  function enterForestExitMap(matchState, player, fromSpectatorFollow) {
    const eg = matchState && matchState.endgame;
    if (!eg || eg.stage !== "WIN_DAWN_CABIN") return false;
    if (eg.deadSpectator && !fromSpectatorFollow) return false;

    eg.stage = "WIN_FOREST";
    eg.carX = 114;
    eg.carY = 136;
    if (player && !eg.deadSpectator) {
      player.seated = false;
      player.crouching = false;
      player.lanternOn = false;
      const seatOffset = ((matchState.localSeatIdx || 0) - 1) * 10;
      player.x = Math.max(60, Math.min(148, 104 + (isMultiplayerMatch(matchState) ? seatOffset : 0)));
      player.y = 66;
      player.facing = 1;
    }

    if (!fromSpectatorFollow && isMultiplayerMatch(matchState)) {
      App.Network.sendGameAction("MP_FOREST_ENTER", {
        playerId: App.Network.getLocalPlayerId()
      });
    }

    const needed = getActiveSurvivorCount(matchState);
    eg.notice = eg.deadSpectator
      ? `SPECTATING SURVIVORS OUTSIDE (${getBoardedActiveCount(matchState)}/${needed} IN CAR)...`
      : needed > 1
        ? `WALK TO THE CAR AND PRESS [E] — ALL ${needed} SURVIVORS MUST BOARD TO DRIVE!`
        : "WALK TO THE CAR AND PRESS [E] TO ESCAPE DUSKWOOD INN!";
    App.Audio.doorTransition();
    return true;
  }

  function startCarEscapeDrive(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg || eg.stage !== "WIN_FOREST") return false;
    if (eg.deadSpectator || eg.localBoardedCar) return false;

    if (!isMultiplayerMatch(matchState)) {
      eg.localBoardedCar = true;
      launchCarDriveNow(matchState, player, false);
      return true;
    }

    // Multiplayer: board the car & wait until ALL surviving players are inside!
    const localPid = App.Network.getLocalPlayerId();
    eg.localBoardedCar = true;
    eg.boardedCarIds = eg.boardedCarIds || new Set();
    eg.boardedCarIds.add(localPid);
    if (player) player.moving = false;

    App.Network.sendGameAction("MP_CAR_BOARD", { playerId: localPid });
    App.Audio.doorTransition();
    checkAllSurvivorsBoarded(matchState, player);
    return true;
  }

  function showVictoryCredits(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg) return;
    eg.stage = "WIN_CREDITS";

    const modal = document.getElementById("endgame-credits-modal");
    const badgeEl = modal ? modal.querySelector(".eg-credits-badge") : null;
    const roomEl = document.getElementById("credits-exit-room");
    const turnsEl = document.getElementById("credits-turns-survived");

    if (badgeEl) {
      if (isMultiplayerMatch(matchState)) {
        const sCnt = (eg.survivors && eg.survivors.length) || 0;
        const dCnt = (eg.deadPlayers && eg.deadPlayers.length) || 0;
        badgeEl.textContent = dCnt > 0
          ? `PARTIAL ESCAPE • ${sCnt} SURVIVED, ${dCnt} LOST AT THE TABLE`
          : `DAWN SURVIVED • ALL ${sCnt} PLAYERS ESCAPED!`;
      } else {
        badgeEl.textContent = "DAWN SURVIVED • YOU ESCAPED!";
      }
    }
    if (roomEl) {
      const trueObj = App.FieldBook && App.FieldBook.EXIT_ROOM_MAP
        ? App.FieldBook.EXIT_ROOM_MAP[matchState.sanctuaryRoomId]
        : null;
      roomEl.textContent = trueObj ? trueObj.name : "SANCTUARY ROOM";
    }
    if (turnsEl) {
      turnsEl.textContent = `${matchState.turnCount || 0} TURNS SURVIVED`;
    }
    if (modal) modal.classList.remove("hidden");
    App.Audio.clockChime();
  }

  // ==================== 5. PLAYABLE BRIGHT MORNING FOREST & GETAWAY CAR (208x208) ====================
  function drawGetawayCar(c, x, y, timeSec, driving) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const vib = driving ? (Math.sin(timeSec * 36) > 0 ? 1 : 0) : 0;

    // Ground shadow
    c.fillStyle = "rgba(20, 28, 18, 0.45)";
    c.fillRect(cx - 27, cy + 7, 54, 6);

    // Exhaust dust puffs when driving away!
    if (driving) {
      for (let i = 0; i < 4; i++) {
        const p = ((timeSec * 4 + i * 0.25) % 1);
        const dx = cx - 28 - Math.round(p * 22);
        const dy = cy + 4 - Math.round(p * 7);
        c.fillStyle = `rgba(225, 212, 186, ${(0.75 * (1 - p)).toFixed(2)})`;
        c.fillRect(dx, dy, 4, 3);
      }
    }

    // Classic Stardew/Retro Cabin Getaway Sedan (52x22)
    px(c, cx - 26, cy - 4 + vib, 52, 12, "#1c2229");
    px(c, cx - 25, cy - 3 + vib, 50, 10, "#3b5e78"); // Slate-teal vintage sedan body
    px(c, cx - 25, cy - 3 + vib, 50, 3, "#5a86a6");  // Morning sunlit roof/hood highlight
    px(c, cx - 25, cy + 4 + vib, 50, 3, "#273f52");

    // Upper cabin roof & bright sunlit glass windows
    px(c, cx - 14, cy - 12 + vib, 28, 9, "#1c2229");
    px(c, cx - 13, cy - 11 + vib, 26, 8, "#4c7594");
    px(c, cx - 12, cy - 11 + vib, 24, 2, "#7ca8c9");
    // Rear & front windows
    px(c, cx - 11, cy - 9 + vib, 10, 5, "#b8dcf2");
    px(c, cx + 1, cy - 9 + vib, 11, 5, "#cde9fa");
    px(c, cx + 3, cy - 8 + vib, 4, 2, "#ffffff"); // Sun glint

    // Headlights & red taillights
    px(c, cx + 24, cy - 1 + vib, 2, 4, driving ? "#fff8b8" : "#e8d58a");
    px(c, cx - 26, cy - 1 + vib, 2, 4, "#c93232");

    // Bumpers
    px(c, cx - 28, cy + 4 + vib, 4, 3, "#aeb8c4");
    px(c, cx + 24, cy + 4 + vib, 4, 3, "#aeb8c4");

    // Wheels
    px(c, cx - 18, cy + 4 + vib, 9, 7, "#14161a");
    px(c, cx - 16, cy + 6 + vib, 5, 3, "#7a8594");
    px(c, cx + 9, cy + 4 + vib, 9, 7, "#14161a");
    px(c, cx + 11, cy + 6 + vib, 5, 3, "#7a8594");
  }

  function renderForestExitViewport(ctx, timeSec, player, charConfig, matchState) {
    const W = 208;
    const H = 208;
    const eg = matchState && matchState.endgame;

    // 1. Bright warm sunrise sky strip at top + lush morning grass meadow!
    px(ctx, 0, 0, W, 24, "#8fc4e8");
    px(ctx, 0, 14, W, 12, "#f5d796"); // Golden dawn horizon glow
    px(ctx, 0, 24, W, H - 24, "#4b7844"); // Lush sunlit morning grass
    for (let y = 26; y < H; y += 8) {
      for (let x = (y % 16 === 0 ? 6 : 14); x < W; x += 22) {
        px(ctx, x, y, 4, 2, "#5c8f52");
        px(ctx, x + 2, y - 1, 1, 2, "#6fa660");
      }
    }

    // 2. Cabin front porch facade & sunlit open front door at North edge (y = 8..50)
    px(ctx, 56, 8, 96, 34, "#4a301e");
    px(ctx, 58, 10, 92, 30, "#69452c");
    for (let ry = 14; ry < 38; ry += 5) px(ctx, 58, ry, 92, 1, "#452c1b");
    // Open front door back to cabin + bright sunlit porch steps
    px(ctx, 94, 18, 20, 24, "#24160e");
    px(ctx, 96, 20, 16, 22, "#1c1410");
    px(ctx, 84, 42, 40, 14, "#8c613d");
    px(ctx, 84, 46, 40, 1, "#5c3d24");
    px(ctx, 84, 51, 40, 1, "#5c3d24");

    // 3. Sunlit dirt path from porch to wide dirt forest road!
    px(ctx, 92, 56, 24, 66, "#b59162");
    px(ctx, 94, 56, 20, 66, "#c4a070");
    // Wide horizontal sunlit forest escape road (y = 120..162)
    px(ctx, 0, 120, W, 42, "#9e7b50");
    px(ctx, 0, 123, W, 36, "#ba9566");
    px(ctx, 0, 134, W, 2, "#a88356");
    px(ctx, 0, 148, W, 2, "#a88356");

    // 4. Sunlit Pine Trees framing left, right & foreground edges
    const drawSunlitPine = (tx, ty) => {
      px(ctx, tx - 2, ty - 6, 4, 10, "#4a301c");
      for (let i = 0; i < 20; i++) {
        const hw = Math.max(1, Math.floor((i / 20) * 10));
        px(ctx, tx - hw, ty - 24 + i, hw * 2 + 1, 1, i % 3 === 0 ? "#244729" : "#336136");
        px(ctx, tx - hw, ty - 24 + i, Math.max(1, Math.floor(hw * 0.6)), 1, "#4c8046");
      }
    };
    [[22, 60], [42, 82], [20, 108], [182, 62], [166, 86], [190, 108], [26, 196], [76, 200], [148, 198], [188, 194]].forEach(([tx, ty]) => {
      drawSunlitPine(tx, ty);
    });

    // Wildflowers
    [[64, 72, "#ffe678"], [78, 98, "#ff9ca8"], [136, 80, "#fff2a6"], [144, 104, "#9cd6ff"], [62, 178, "#ffe678"]].forEach(([fx, fy, fc]) => {
      px(ctx, fx, fy, 2, 2, fc);
    });

    // 5. Depth-sorted Getaway Car & Player (player hides inside car once WIN_CAR_DRIVE starts!)
    const driving = eg && eg.stage === "WIN_CAR_DRIVE";
    const carX = eg ? eg.carX : 114;
    const carY = eg ? eg.carY : 136;

    const actors = [
      { y: carY + 8, draw: () => drawGetawayCar(ctx, carX, carY, timeSec, driving) }
    ];

    if (!driving && player && !(eg && (eg.deadSpectator || eg.localBoardedCar))) {
      actors.push({
        y: player.y,
        draw: () => {
          const spriteCfg = Object.assign({}, charConfig, {
            facing: player.facing,
            walking: player.moving,
            lantern: false
          });
          App.Character.drawInWorld(ctx, player.x, player.y, spriteCfg, timeSec, {
            seated: false,
            sprinting: player.sprinting,
            crouching: player.crouching
          });
        }
      });
    }

    // Also render all living Co-op teammates who are walking in the Morning Forest & haven't boarded the car yet!
    if (!driving && isMultiplayerMatch(matchState) && App.Network && App.Network.getAllRemotePlayers) {
      App.Network.getAllRemotePlayers().forEach((rp) => {
        if (!rp.inForest || rp.inCar || rp.deadSpectator) return;
        actors.push({
          y: rp.y,
          draw: () => {
            const rCfg = Object.assign({}, rp.character, {
              facing: rp.facing,
              walking: rp.moving,
              lantern: false
            });
            App.Character.drawInWorld(ctx, rp.x, rp.y, rCfg, timeSec, {
              seated: false,
              sprinting: rp.sprinting,
              crouching: rp.crouching
            });
          }
        });
      });
    }

    actors.sort((a, b) => a.y - b.y);
    actors.forEach((a) => a.draw());

    // 6. Warm golden morning sunbeams diagonal wash!
    const sunGrad = ctx.createLinearGradient(0, 0, W, H);
    sunGrad.addColorStop(0, "rgba(255, 236, 175, 0.22)");
    sunGrad.addColorStop(0.55, "rgba(255, 224, 148, 0.08)");
    sunGrad.addColorStop(1, "rgba(255, 206, 120, 0.0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, H);

    // Gentle fade to warm sunrise white at end of car drive before Credits roll
    if (driving && eg.carDriveTimer > 1.8) {
      const f = Math.min(1, (eg.carDriveTimer - 1.8) / 1.1);
      ctx.fillStyle = `rgba(255, 246, 220, ${f.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function collidesInForest(nx, ny, matchState) {
    if (nx < 16 || nx > 192 || ny < 50 || ny > 186) return true;
    // Car collider (stop walking right through car body, leave driver door accessible!)
    const eg = matchState && matchState.endgame;
    const cx = eg ? eg.carX : 114;
    const cy = eg ? eg.carY : 136;
    if (nx > cx - 26 && nx < cx + 26 && ny > cy - 2 && ny < cy + 12) return true;
    return false;
  }

  function getForestPrompt(matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg || eg.stage !== "WIN_FOREST") return null;
    if (eg.deadSpectator) return null;
    if (eg.localBoardedCar) {
      const b = getBoardedActiveCount(matchState);
      const n = getActiveSurvivorCount(matchState);
      return { type: "car_waiting", prompt: `IN CAR (${b}/${n}) — WAITING FOR SURVIVING TEAMMATES...` };
    }
    if (Math.hypot(player.x - eg.carX, player.y - eg.carY) <= 34) {
      if (isMultiplayerMatch(matchState)) {
        const b = getBoardedActiveCount(matchState);
        const n = getActiveSurvivorCount(matchState);
        return { type: "escape_car", prompt: `[E] BOARD GETAWAY CAR (${b}/${n} SURVIVORS)` };
      }
      return { type: "escape_car", prompt: "[E] ENTER CAR & ESCAPE DUSKWOOD INN!" };
    }
    return null;
  }

  // ==================== 6. PER-FRAME ENDGAME UPDATE & HUD SUMMARY ====================
  function update(dt, matchState, player) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;

    if (eg.shatterFlashTimer > 0) {
      eg.shatterFlashTimer = Math.max(0, eg.shatterFlashTimer - dt);
    }

    if (eg.glassShards.length) {
      eg.glassShards = eg.glassShards.filter((s) => {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 90 * dt;
        s.life -= dt;
        return s.life > 0;
      });
    }

    if (eg.stage === "CHOOSE_20S") {
      eg.countdown -= dt;
      const secs = Math.max(0, Math.ceil(eg.countdown));
      const countEl = document.getElementById("event-smudge-count");
      if (countEl) {
        countEl.textContent = String(secs);
        countEl.classList.remove("hidden");
      }
      if (App.TableView && App.TableView.isOpen && App.TableView.isOpen()) {
        const tagEl = document.getElementById("fp-step-tag");
        if (tagEl) tagEl.textContent = `12:00 AM • ${secs}S`;
      }
      if (eg.countdown <= 0) {
        beginJudgmentLockdown(matchState);
      }
      return;
    }

    if (eg.stage === "JUDGMENT_SHAKE") {
      eg.shatterTimer -= dt;
      if (eg.shatterTimer <= 0) {
        triggerNextWrongRoomShatter(matchState, player);
      }
      return;
    }

    if (eg.stage === "PRE_LOSE_DARK") {
      eg.preLoseTimer -= dt;
      if (eg.preLoseTimer <= 0) {
        enterLoseCutscene(matchState);
      }
      return;
    }

    if (eg.stage === "PRE_MIXED_DARK") {
      eg.preLoseTimer -= dt;
      if (eg.preLoseTimer <= 0) {
        enterDawnWinCabin(matchState, player);
      }
      return;
    }

    if (eg.stage === "WIN_FOREST" && isMultiplayerMatch(matchState) && eg.boardedCarIds && eg.boardedCarIds.size > 0) {
      // Continuously verify in case a surviving teammate disconnected while others waited inside the car
      checkAllSurvivorsBoarded(matchState, player);
    }

    if (eg.stage === "LOSE_CUTSCENE") {
      eg.cutsceneElapsed += dt;
      const cvs = document.getElementById("endgame-cutscene-canvas");
      renderLoseCutsceneCanvas(cvs, performance.now() * 0.001, matchState);
      if (!eg.losePanelShown && eg.cutsceneElapsed >= 7.6) {
        eg.losePanelShown = true;
        document.getElementById("endgame-lose-overlay")?.classList.remove("hidden");
      }
      return;
    }

    if (eg.stage === "WIN_CAR_DRIVE") {
      eg.carDriveTimer += dt;
      // Accelerate car down the sunlit forest road to the right!
      if (eg.carDriveTimer > 0.45) {
        const accel = (eg.carDriveTimer - 0.45) * 78;
        eg.carX += (36 + accel) * dt;
      }
      if (eg.carDriveTimer >= 3.0) {
        showVictoryCredits(matchState);
      }
    }
  }

  function renderGlassShardsOverlay(ctx, matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return;

    if (eg.shatterFlashTimer > 0) {
      ctx.fillStyle = `rgba(255, 248, 224, ${(eg.shatterFlashTimer * 1.4).toFixed(2)})`;
      ctx.fillRect(0, 0, 208, 208);
    }

    eg.glassShards.forEach((s) => {
      ctx.fillStyle = s.size > 1 ? "#e6f2ff" : "#a8c7e0";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    });
  }

  function getHudSummary(matchState) {
    const eg = matchState && matchState.endgame;
    if (!eg || !eg.active) return null;
    if (eg.stage === "CHOOSE_20S" || eg.stage === "LOSE_CUTSCENE" || eg.stage === "WIN_CREDITS") return null;

    if (eg.stage === "ALARM_3X") {
      return {
        title: "12:00 AM — MIDNIGHT!",
        sub: "THE CABIN ALARM IS RINGING...",
        notice: eg.notice || ""
      };
    }
    if (eg.stage === "JUDGMENT_SHAKE" || eg.stage === "PRE_LOSE_DARK") {
      const leftWaves = Math.max(0, eg.shatterWaves.length - eg.shatterWaveIdx);
      return {
        title: "FINAL JUDGMENT — DOORS SEALED!",
        sub: eg.stage === "PRE_LOSE_DARK"
          ? "YOUR ROOM'S LIGHT SHATTERED..."
          : `EARTHQUAKE & SURGE • NEXT LIGHT SHATTERS IN ${Math.max(1, Math.ceil(eg.shatterTimer))}S (${leftWaves} WAVE${leftWaves === 1 ? "" : "S"} LEFT)`,
        notice: eg.notice || ""
      };
    }
    if (eg.stage === "WIN_DAWN_CABIN") {
      return {
        title: eg.deadSpectator ? "YOU DIED AT THE TABLE (SPECTATING)" : "DAWN HAS BROKEN — YOU SURVIVED!",
        sub: eg.deadSpectator
          ? "WATCHING SURVIVING TEAMMATES LEAVE THE CABIN..."
          : "STEP OUT THROUGH THE SUNLIT FRONT DOOR",
        notice: eg.notice || ""
      };
    }
    if (eg.stage === "WIN_FOREST") {
      const b = getBoardedActiveCount(matchState);
      const n = getActiveSurvivorCount(matchState);
      return {
        title: eg.deadSpectator ? "SPECTATING ESCAPE — MORNING FOREST" : "MORNING FOREST — GETAWAY CAR",
        sub: isMultiplayerMatch(matchState)
          ? (eg.localBoardedCar
              ? `BOARDED (${b}/${n}) — CAR DEPARTS WHEN ALL SURVIVORS BOARD`
              : eg.deadSpectator
                ? `SURVIVORS IN CAR: ${b}/${n}`
                : `BOARD THE CAR [E] — ${b}/${n} SURVIVORS INSIDE`)
          : "WALK TO THE CAR AND PRESS [E] TO ESCAPE",
        notice: eg.notice || ""
      };
    }
    return null;
  }

  function handleNetworkMessage(action, payload, matchState, player) {
    if (!matchState || !action) return;
    const p = payload || {};

    if (action === "MP_HARVESTER_LOSE") {
      startHarvesterLoseCutscene(matchState, true);
      if (matchState.endgame && Array.isArray(p.deadPlayers)) {
        matchState.endgame.deadPlayers = p.deadPlayers;
      }
      return;
    }

    const eg = matchState.endgame;
    if (!eg || !eg.active) return;

    if (action === "MP_ENDGAME_CHOICE" && p.playerId) {
      eg.mpChoiceMap = eg.mpChoiceMap || {};
      eg.mpChoiceMap[p.playerId] = { roomKey: p.roomKey, roomId: p.roomId, roles: p.roles || null };
      if (eg.stage === "JUDGMENT_SHAKE") {
        recomputeGeneralVerdict(matchState, true);
      }
      return;
    }

    if (action === "MP_ENDGAME_JUDGMENT") {
      eg.judgmentSyncedFromHost = true;
      if (p.sacrificeRescuedId) eg.sacrificeRescuedId = p.sacrificeRescuedId;
      if (Array.isArray(p.survivors)) eg.survivors = p.survivors;
      if (Array.isArray(p.deadPlayers)) eg.deadPlayers = p.deadPlayers;
      if (Array.isArray(p.waves) && eg.stage === "JUDGMENT_SHAKE" && eg.shatterWaveIdx === 0) {
        eg.shatterWaves = p.waves;
      }
      applyLocalVerdictFields(eg, matchState);
      return;
    }

    if (action === "MP_FOREST_ENTER") {
      // Dead spectators automatically follow the first survivor outside into the Morning Forest!
      if (eg.deadSpectator && eg.stage === "WIN_DAWN_CABIN") {
        enterForestExitMap(matchState, player, true);
      }
      return;
    }

    if (action === "MP_CAR_BOARD" && p.playerId) {
      eg.boardedCarIds = eg.boardedCarIds || new Set();
      eg.boardedCarIds.add(p.playerId);
      checkAllSurvivorsBoarded(matchState, player);
      return;
    }

    if (action === "MP_CAR_DRIVE_START") {
      if (eg.stage === "WIN_DAWN_CABIN") {
        enterForestExitMap(matchState, player, true);
      }
      launchCarDriveNow(matchState, player, true);
    }
  }

  function cleanup(matchState) {
    if (App.Audio && App.Audio.stopEndGameAlarm) App.Audio.stopEndGameAlarm();
    if (App.Audio && App.Audio.stopLightBreak) App.Audio.stopLightBreak();
    if (App.Audio && App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio && App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    document.getElementById("endgame-cutscene-stage")?.classList.add("hidden");
    document.getElementById("endgame-lose-overlay")?.classList.add("hidden");
    document.getElementById("endgame-credits-modal")?.classList.add("hidden");
    if (matchState) matchState.endgame = null;
  }

  App.Endgame = {
    renderNeighborPixelCanvas,
    startMidnightEndgame,
    startHarvesterLoseCutscene,
    enterForestExitMap,
    startCarEscapeDrive,
    update,
    renderForestExitViewport,
    renderDawnTableCorpses,
    renderGlassShardsOverlay,
    handleNetworkMessage,
    collidesInForest,
    getForestPrompt,
    getHudSummary,
    getEarthquakeOffset,
    getGlobalFlickerMultiplier,
    isEndgameActive,
    isLockedInChosenRoom,
    isLocalDeadSpectator,
    isLocalInCar,
    canInspectTableMap,
    isDaylightWinMode,
    isInForestExit,
    isCutsceneBlocking,
    isRoomShattered,
    cleanup
  };
})(window.Duskwood);
