/* ==========================================================================
   DUSKWOOD INN - STAY IN THE LIGHT (`hx_stay_lit`) Event Engine
   - Trigger: Exits Table View; ALL cabin lights flicker wildly for 5 seconds!
   - After 5 seconds: Random 2 rooms turn ON while all other rooms turn OFF,
     accompanied by `audio/light_switch_sfx.mp3` (4 seconds).
   - Every 10 seconds: Automatically switches OFF/ON picking 2 new random rooms
     (`audio/light_switch_sfx.mp3`, 4s). Survive for 90 seconds to WIN!
   - Monster: Four-legged Shadow Hound that GLOWS brightly in the dark:
       * Roams freely across ALL dark rooms and relentlessly chases any player
         caught inside a dark room!
       * The instant it touches/enters ANY lit room -> VANISHES in a burst of
         glowing light particles, then re-emerges in a dark room a few seconds later!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const FLICKER_DURATION = 5.0;  // 5s all-room flicker before lights split
  const SURVIVE_DURATION = 90.0; // Survive 90 seconds to win!
  const SWITCH_CYCLE = 10.0;     // Every 10 seconds randomly re-pick 2 lit rooms!
  const LIT_ROOMS_COUNT = 2;

  const DOOR_POS = {
    N: { x: 104, y: 60 },
    S: { x: 104, y: 184 },
    W: { x: 24,  y: 126 },
    E: { x: 184, y: 126 }
  };

  const DIR_STEPS = [
    { dir: "N", opp: "S", dx: 0,  dy: -1 },
    { dir: "E", opp: "W", dx: 1,  dy: 0  },
    { dir: "S", opp: "N", dx: 0,  dy: 1  },
    { dir: "W", opp: "E", dx: -1, dy: 0  }
  ];

  // Offscreen Quadruped Bioluminescent Shadow Hound Sprite (34x24px)
  const houndBuf = document.createElement("canvas");
  houndBuf.width = 34;
  houndBuf.height = 24;
  const hctx = houndBuf.getContext("2d");
  hctx.imageSmoothingEnabled = false;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }
  function isMpMode(m) { return Boolean(App.Events && App.Events.isMpEventMode && App.Events.isMpEventMode(m)); }
  function isMpHost(m) { return !App.Events || !App.Events.isMpHost || App.Events.isMpHost(m); }
  function isMpGuest(m) { return Boolean(App.Events && App.Events.isMpGuest && App.Events.isMpGuest(m)); }

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

  function getSafeSpotForRoom(room) {
    if (!room) return { x: 104, y: 126 };
    if (room.id === "dining_room") {
      const spots = [
        { x: 42,  y: 96  },
        { x: 166, y: 98  },
        { x: 44,  y: 170 },
        { x: 164, y: 170 }
      ];
      return spots[Math.floor(Math.random() * spots.length)];
    }
    return { x: 104, y: 126 };
  }

  function getEventRoomKeys(roomMap) {
    const keys = Object.keys(roomMap || {}).filter((k) => roomMap[k] && roomMap[k].id !== "bp_cellar");
    return keys.length ? keys : ["0,0"];
  }

  // BFS across cabin graph. If `avoidLitSet` is passed, strongly prefers dark rooms!
  function findNextStepRoom(roomMap, fromKey, toKey, avoidLitSet) {
    if (!roomMap || fromKey === toKey) return null;

    function runBfs(respectLit) {
      const queue = [fromKey];
      const visited = new Set([fromKey]);
      const parent = {};
      let found = false;
      let head = 0;

      while (head < queue.length) {
        const cur = queue[head++];
        if (cur === toKey) { found = true; break; }
        const room = roomMap[cur];
        if (!room || !room.doors) continue;
        for (let i = 0; i < DIR_STEPS.length; i++) {
          const d = DIR_STEPS[i];
          if (!room.doors[d.dir]) continue;
          const nk = `${room.x + d.dx},${room.y + d.dy}`;
          const nb = roomMap[nk];
          if (!nb || nb.id === "bp_cellar" || !nb.doors || !nb.doors[d.opp]) continue;
          if (visited.has(nk)) continue;
          if (respectLit && avoidLitSet && avoidLitSet.has(nk) && nk !== toKey) continue;
          visited.add(nk);
          parent[nk] = { prev: cur, dir: d.dir, opp: d.opp };
          queue.push(nk);
        }
      }
      if (!found) return null;
      let stepKey = toKey;
      while (parent[stepKey] && parent[stepKey].prev !== fromKey) {
        stepKey = parent[stepKey].prev;
      }
      const edge = parent[stepKey];
      if (!edge) return null;
      return { nextRoomKey: stepKey, exitDir: edge.dir, enterDir: edge.opp };
    }

    // First try strictly dark-room detour; if target is only reachable across a lit room, cross it (which vanishes on contact!)
    return runBfs(true) || runBfs(false);
  }

  // ==================== 1. FOUR-LEGGED GLOWING SHADOW HOUND SPRITE (34x24) ====================
  function drawQuadrupedHoundSprite(ctx, x, y, timeSec, facing, isChasing) {
    const stride = Math.sin(timeSec * (isChasing ? 16.0 : 9.5));
    const lA = Math.round(stride * 3.0);
    const lB = -lA;
    const pulse = Math.sin(timeSec * 8.0) > 0;
    const glowCore = pulse ? "#e6ffff" : "#a6f4ff";
    const glowEdge = isChasing ? "#52d9ff" : "#78c8f5";

    hctx.clearRect(0, 0, 34, 24);

    // 4 Splayed Quadruped Shadow Limbs (Rear-far, Rear-near, Front-far, Front-near!)
    // Rear Far Leg
    px(hctx, 6 + lB,  13, 3, 7, "#07090f");
    px(hctx, 7 + lB,  19, 2, 2, glowEdge); // Glowing claw tip!
    // Front Far Leg
    px(hctx, 20 + lA, 13, 3, 7, "#07090f");
    px(hctx, 21 + lA, 19, 2, 2, glowEdge);

    // Arched lean quadrupedal shadow-beast spine & ribcage
    px(hctx, 6,  8, 17, 7, "#06070c");
    px(hctx, 8,  7, 13, 7, "#111521");
    // Glowing bioluminescent spinal vertebrae & rib slats!
    px(hctx, 9,  7, 2, 1, glowCore);
    px(hctx, 13, 6, 2, 2, glowCore);
    px(hctx, 17, 7, 2, 1, glowCore);
    px(hctx, 11, 10, 1, 3, glowEdge);
    px(hctx, 14, 10, 1, 3, glowEdge);
    px(hctx, 17, 10, 1, 3, glowEdge);

    // Whip-like glowing shadow tail curving behind
    const tailWag = Math.round(Math.sin(timeSec * 12) * 1.5);
    px(hctx, 2, 8 + tailWag, 5, 2, "#0a0d14");
    px(hctx, 1, 7 + tailWag, 2, 2, glowEdge);

    // Rear Near Leg & Front Near Leg (prominent articulated knees + glowing claws!)
    px(hctx, 8 + lA,  12, 3, 9, "#0b0e17");
    px(hctx, 9 + lA,  13, 1, 6, "#1f2b3d");
    px(hctx, 8 + lA,  20, 3, 2, glowCore);

    px(hctx, 19 + lB, 12, 3, 9, "#0b0e17");
    px(hctx, 20 + lB, 13, 1, 6, "#1f2b3d");
    px(hctx, 20 + lB, 20, 3, 2, glowCore);

    // Low predatory quadruped hound skull jutting forward on right!
    px(hctx, 22, 6, 10, 8, "#06070c");
    px(hctx, 23, 7, 8,  6, "#141a29");
    px(hctx, 22, 4, 2,  3, "#0d111c"); // Swept sharp ear/horn
    px(hctx, 25, 4, 2,  3, "#0d111c");
    // Piercing glowing bioluminescent eyes + luminous fanged jaws!
    px(hctx, 27, 8,  2, 2, "#ffffff");
    px(hctx, 29, 8,  1, 2, glowCore);
    px(hctx, 26, 11, 5, 2, "#050608");
    px(hctx, 27, 11, 1, 1, glowCore); // Glowing fangs
    px(hctx, 29, 11, 1, 1, glowCore);
    px(hctx, 31, 11, 1, 1, glowCore);

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.56)";
    ctx.fillRect(Math.round(x - 13), Math.round(y - 2), 26, 4);

    const drawX = Math.round(x - 17);
    const drawY = Math.round(y - 21);
    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(houndBuf, drawX, drawY);
    } else {
      ctx.drawImage(houndBuf, drawX, drawY);
    }
    ctx.restore();
  }

  // ==================== 2. RANDOM 2 LIT ROOMS PICKER ====================
  function pickTwoRandomLitRooms(matchState, prevLitKeys) {
    const allKeys = getEventRoomKeys(matchState.roomMap);
    if (allKeys.length <= LIT_ROOMS_COUNT) return new Set(allKeys);

    const prevSet = prevLitKeys || new Set();
    // Prefer rooms that were NOT lit in the previous 10s cycle so players stay on the move!
    const freshPool = allKeys.filter((k) => !prevSet.has(k));
    const pool = freshPool.length >= LIT_ROOMS_COUNT ? freshPool.slice() : allKeys.slice();

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return new Set(pool.slice(0, LIT_ROOMS_COUNT));
  }

  function applyLitRoomsToCabin(sl, matchState, playSfx) {
    const nextLit = pickTwoRandomLitRooms(matchState, sl.litRoomKeys);
    sl.litRoomKeys = nextLit;
    sl.cycleTimer = SWITCH_CYCLE;

    matchState.roomLightStates = {};
    getEventRoomKeys(matchState.roomMap).forEach((k) => {
      matchState.roomLightStates[k] = nextLit.has(k);
    });

    if (playSfx && App.Audio && App.Audio.playLightSwitchSurge) {
      App.Audio.playLightSwitchSurge(4.0);
    }

    // If the 4-legged Shadow Hound is currently inside a room that JUST LIT UP -> VANISH IMMEDIATELY!
    if (sl.hound.active && nextLit.has(sl.hound.roomKey)) {
      vanishHoundOnLightContact(sl, sl.hound.roomKey, sl.hound.x, sl.hound.y);
    }

    const litNames = Array.from(nextLit)
      .map((k) => matchState.roomMap[k]?.fullName || matchState.roomMap[k]?.name || k)
      .join(" & ");
    sl.notice = `LIGHTS SHIFTED! STAY INSIDE: ${litNames}`;
    sl.noticeTimer = 4.2;
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState, { lightShift: true });
    }
  }

  function vanishHoundOnLightContact(sl, roomKey, x, y) {
    sl.hound.active = false;
    sl.hound.respawnTimer = 3.5; // Re-materializes in a dark room after 3.5s
    sl.vanishBursts.push({ roomKey, x, y: y - 10, age: 0, maxAge: 0.72 });
    if (App.Audio && App.Audio.shadowHoundVanish) App.Audio.shadowHoundVanish();
    sl.notice = "THE SHADOW BEAST TOUCHED THE LIGHT AND VANISHED!";
    sl.noticeTimer = 2.6;
  }

  function spawnHoundInDarkRoom(sl, matchState) {
    const allKeys = getEventRoomKeys(matchState.roomMap);
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const darkKeys = allKeys.filter((k) => !sl.litRoomKeys.has(k));
    if (!darkKeys.length) return;

    // Prefer a dark room not right on top of the player
    const farDark = darkKeys.filter((k) => k !== pRoomKey);
    const chosenKey = farDark.length
      ? farDark[Math.floor(Math.random() * farDark.length)]
      : darkKeys[0];
    const sp = getSafeSpotForRoom(matchState.roomMap[chosenKey]);

    sl.hound.active = true;
    sl.hound.roomKey = chosenKey;
    sl.hound.x = sp.x;
    sl.hound.y = sp.y;
    sl.hound.facing = 1;
    sl.hound.state = "PATROL";
    sl.hound.patrolRoomKey = chosenKey;
    sl.hound.patrolX = sp.x;
    sl.hound.patrolY = sp.y;
    sl.hound.retargetTimer = 1.8;
  }

  // ==================== 3. START / WIN / DEATH / UPDATE ====================
  function startStayInLightEvent(matchState) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "stay_in_the_light");

    const savedLights = snapshotRoomLights(matchState);

    // Turn ALL non-Cellar lights ON so every room flickers wildly during the 5-second warning!
    matchState.roomLightStates = {};
    getEventRoomKeys(matchState.roomMap).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    matchState.stayLitEvent = {
      active: true,
      stage: "FLICKER_5S", // FLICKER_5S (5s) -> SURVIVE_90S (90s)
      savedLights,
      flickerTimer: FLICKER_DURATION,
      surviveTimer: SURVIVE_DURATION,
      cycleTimer: SWITCH_CYCLE,
      litRoomKeys: new Set(),
      vanishBursts: [],
      hound: {
        active: false,
        respawnTimer: 1.0,
        roomKey: "0,0",
        x: 104,
        y: 126,
        facing: 1,
        state: "PATROL",
        patrolRoomKey: "0,0",
        patrolX: 104,
        patrolY: 126,
        retargetTimer: 2.0
      },
      notice: "ALL LIGHTS ARE FLICKERING! STAY IN THE 2 LIT ROOMS FOR 90 SECONDS!",
      noticeTimer: 5.0,
      syncAccum: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "STAY IN THE LIGHT\nALL LIGHTS ARE SURGING... IN 5 SECONDS ONLY 2 ROOMS WILL STAY LIT!\nAVOID THE GLOWING SHADOW BEAST IN THE DARK FOR 90 SECONDS!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5400);
    }

    return matchState.stayLitEvent;
  }

  function triggerStayLitWin(matchState) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl) return;

    if (App.Audio && App.Audio.stopLightSwitchSurge) App.Audio.stopLightSwitchSurge();
    restoreRoomLights(matchState, sl.savedLights);
    sl.active = false;
    matchState.stayLitEvent = null;
    if (App.Events && App.Events.onEventWonBroadcast) {
      App.Events.onEventWonBroadcast(matchState, "stay_in_the_light", "90 SECONDS SURVIVED!\nTHE SHADOW BEAST FADES — CELLAR DOOR UNLOCKED.");
    }

    App.Audio.clockChime();
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "90 SECONDS SURVIVED!\nTHE CABIN POWER STABILIZES AND THE SHADOW BEAST FADES AWAY.",
        { success: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3800);
    }
  }

  function triggerStayLitDeath(matchState) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl) return;

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "stay_in_the_light", "shadow_hunter", "THE SHADOW BEAST CAUGHT YOU IN THE DARK!")
      : { keepEventRunning: false };

    if (!res.keepEventRunning) {
      if (App.Audio && App.Audio.stopLightSwitchSurge) App.Audio.stopLightSwitchSurge();
      restoreRoomLights(matchState, sl.savedLights);
      sl.active = false;
      matchState.stayLitEvent = null;
    }
  }

  function moveHoundStep(sl, targetRoomKey, targetX, targetY, speed, dt, roomMap) {
    const h = sl.hound;
    if (h.roomKey === targetRoomKey) {
      const dx = targetX - h.x;
      const dy = targetY - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 3.0) return true;
      h.x += (dx / dist) * speed * dt;
      h.y += (dy / dist) * speed * dt;
      if (Math.abs(dx) > 0.3) h.facing = dx >= 0 ? 1 : -1;
      return false;
    }

    const step = findNextStepRoom(roomMap, h.roomKey, targetRoomKey, sl.litRoomKeys);
    if (!step) return true;

    const exitPt = DOOR_POS[step.exitDir] || { x: 104, y: 126 };
    const dx = exitPt.x - h.x;
    const dy = exitPt.y - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 5.0) {
      h.roomKey = step.nextRoomKey;
      const enterPt = DOOR_POS[step.enterDir] || { x: 104, y: 126 };
      h.x = enterPt.x;
      h.y = enterPt.y;

      // Touched a LIT room upon stepping through doorway -> VANISH immediately!
      if (sl.litRoomKeys.has(h.roomKey)) {
        vanishHoundOnLightContact(sl, h.roomKey, h.x, h.y);
        return true;
      }
      return false;
    }
    h.x += (dx / dist) * speed * dt;
    h.y += (dy / dist) * speed * dt;
    if (Math.abs(dx) > 0.3) h.facing = dx >= 0 ? 1 : -1;
    return false;
  }

  function update(dt, matchState, player) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl || !sl.active) return;

    if (sl.noticeTimer > 0) {
      sl.noticeTimer = Math.max(0, sl.noticeTimer - dt);
      if (sl.noticeTimer === 0) sl.notice = "";
    }

    sl.vanishBursts = sl.vanishBursts.filter((vb) => {
      vb.age += dt;
      return vb.age < vb.maxAge;
    });

    // GUEST: strictly mirrors Host's 2 lit rooms, timers & Shadow Hound! Only checks local catch in dark!
    if (isMpGuest(matchState)) {
      if (
        sl.stage === "SURVIVE_90S" &&
        sl.hound &&
        sl.hound.active &&
        !(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState))
      ) {
        const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
        if (!sl.litRoomKeys.has(pRoomKey) && sl.hound.roomKey === pRoomKey && Math.hypot(sl.hound.x - player.x, sl.hound.y - player.y) <= 13.5) {
          triggerStayLitDeath(matchState);
        }
      }
      return;
    }

    // 1. 5-Second All-Lights Flicker Phase (HOST / SP)
    if (sl.stage === "FLICKER_5S") {
      sl.flickerTimer -= dt;
      if (sl.flickerTimer <= 0) {
        sl.stage = "SURVIVE_90S";
        sl.surviveTimer = SURVIVE_DURATION;
        applyLitRoomsToCabin(sl, matchState, true);
        spawnHoundInDarkRoom(sl, matchState);
        if (isMpMode(matchState)) broadcastStateNow(matchState, { lightShift: true });
      } else if (isMpMode(matchState)) {
        sl.syncAccum = (sl.syncAccum || 0) + dt;
        if (sl.syncAccum >= 0.25) { sl.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 2. 90-Second Survival + 10-Second Random Light Cycle!
    sl.surviveTimer -= dt;
    if (sl.surviveTimer <= 0) {
      triggerStayLitWin(matchState);
      return;
    }

    sl.cycleTimer -= dt;
    if (sl.cycleTimer <= 0) {
      applyLitRoomsToCabin(sl, matchState, true);
    }

    // 3. Quadruped Shadow Hound AI (tracks ALL living players caught in dark rooms!)
    const h = sl.hound;
    if (!h.active) {
      h.respawnTimer -= dt;
      if (h.respawnTimer <= 0) {
        spawnHoundInDarkRoom(sl, matchState);
      }
    } else if (sl.litRoomKeys.has(h.roomKey)) {
      vanishHoundOnLightContact(sl, h.roomKey, h.x, h.y);
      if (isMpMode(matchState)) broadcastStateNow(matchState, { vanished: { roomKey: h.roomKey, x: h.x, y: h.y } });
    } else {
      const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
      const living = (App.Events && App.Events.getAllLivingPlayers)
        ? App.Events.getAllLivingPlayers(matchState, player)
        : [{ isLocal: true, roomKey: pRoomKey, x: player.x, y: player.y }];

      let bestDarkTarget = null;
      let bestDist = Infinity;
      const hRoomObj = (matchState.roomMap && matchState.roomMap[h.roomKey]) || { x: 0, y: 0 };
      living.forEach((lp) => {
        const rObj = matchState.roomMap && matchState.roomMap[lp.roomKey];
        if (!rObj || rObj.id === "bp_cellar") return;
        if (sl.litRoomKeys.has(lp.roomKey)) return;
        const d = Math.hypot((hRoomObj.x * 208 + h.x) - (rObj.x * 208 + lp.x), (hRoomObj.y * 208 + h.y) - (rObj.y * 208 + lp.y));
        if (d < bestDist) { bestDist = d; bestDarkTarget = lp; }
      });

      if (bestDarkTarget) {
        if (h.state !== "CHASE") {
          h.state = "CHASE";
          sl.notice = "SOMEONE IS IN THE DARK! THE GLOWING SHADOW BEAST IS HUNTING — FIND A LIT ROOM!";
          sl.noticeTimer = 2.8;
        }
        moveHoundStep(sl, bestDarkTarget.roomKey, bestDarkTarget.x, bestDarkTarget.y, 58, dt, matchState.roomMap);

        if (h.active) {
          const localLocked = Boolean(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState));
          living.forEach((lp) => {
            if (sl.litRoomKeys.has(lp.roomKey)) return;
            if (h.roomKey !== lp.roomKey || Math.hypot(h.x - lp.x, h.y - lp.y) > 14.5) return;
            if (lp.isLocal) {
              if (!localLocked) triggerStayLitDeath(matchState);
            } else if (App.Events && App.Events.hostKillRemotePlayer) {
              App.Events.hostKillRemotePlayer(matchState, lp.playerId, "stay_in_the_light", "shadow_hunter", "THE SHADOW BEAST CAUGHT YOU IN THE DARK!");
            }
          });
        }
      } else {
        if (h.state === "CHASE") {
          h.state = "PATROL";
          h.retargetTimer = 0.25;
        }
        h.retargetTimer -= dt;
        const arrived = moveHoundStep(sl, h.patrolRoomKey, h.patrolX, h.patrolY, 40, dt, matchState.roomMap);
        if (h.active && (arrived || h.retargetTimer <= 0)) {
          const darkKeys = getEventRoomKeys(matchState.roomMap).filter((k) => !sl.litRoomKeys.has(k));
          if (darkKeys.length) {
            const nextK = darkKeys[Math.floor(Math.random() * darkKeys.length)];
            const sp = getSafeSpotForRoom(matchState.roomMap[nextK]);
            h.patrolRoomKey = nextK;
            h.patrolX = sp.x;
            h.patrolY = sp.y;
          }
          h.retargetTimer = 3.2 + Math.random() * 2.4;
        }
      }
    }

    if (isMpMode(matchState)) {
      sl.syncAccum = (sl.syncAccum || 0) + dt;
      if (sl.syncAccum >= 0.085) {
        sl.syncAccum = 0;
        broadcastStateNow(matchState);
      }
    }
  }

  // ==================== 4. RENDERING, GLOWING IN THE DARK & LIT-DOOR SPILLS ====================
  function getGlobalFlickerMultiplier(matchState, timeSec) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl || !sl.active || sl.stage !== "FLICKER_5S") return 1.0;
    const v = Math.sin(timeSec * 39) * Math.cos(timeSec * 23);
    if (v < -0.35) return 0.14;
    if (v < 0.08) return 0.44;
    return 1.0;
  }

  function getRoomRenderables(ctx, roomKey, timeSec, matchState) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl || !sl.active || sl.stage !== "SURVIVE_90S") return [];
    const h = sl.hound;
    if (!h || !h.active || h.roomKey !== roomKey) return [];
    return [
      {
        y: h.y,
        draw: () => drawQuadrupedHoundSprite(ctx, h.x, h.y, timeSec, h.facing, h.state === "CHASE")
      }
    ];
  }

  // Post-darkness overlay:
  //   1) Bioluminescent GLOWING Shadow Hound shining brightly right through pitch blackness!
  //   2) Warm golden light spill peeking through doorways that lead directly into a LIT room!
  //   3) Radiant light-dissolve sparks when the Hound vanishes upon touching light!
  function renderRoomHighlights(ctx, roomKey, timeSec, matchState) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl || !sl.active || sl.stage !== "SURVIVE_90S") return;

    const room = matchState.roomMap && matchState.roomMap[roomKey];

    // 1. Warm doorway light spills whenever an adjacent connected room is LIT!
    if (room && room.doors && !sl.litRoomKeys.has(roomKey)) {
      const pulse = 0.72 + Math.sin(timeSec * 4.5) * 0.24;
      DIR_STEPS.forEach((d) => {
        if (!room.doors[d.dir]) return;
        const nk = `${room.x + d.dx},${room.y + d.dy}`;
        const nb = matchState.roomMap[nk];
        if (!nb || !nb.doors || !nb.doors[d.opp]) return;
        if (!sl.litRoomKeys.has(nk)) return;

        const pt = DOOR_POS[d.dir];
        const g = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 30);
        g.addColorStop(0, `rgba(255, 232, 150, ${(0.58 * pulse).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(255, 200, 100, ${(0.22 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(255, 180, 80, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(pt.x - 30, pt.y - 30, 60, 60);
      });
    }

    // 2. Bioluminescent 4-legged Shadow Hound GLOWING IN THE DARK (drawn OVER darkness mask!)
    const h = sl.hound;
    if (h && h.active && h.roomKey === roomKey) {
      const pulse = 0.76 + Math.sin(timeSec * 9.0) * 0.24;
      const gx = h.x;
      const gy = h.y - 10;

      // Eerie bioluminescent cyan-white halo glowing in pitch darkness!
      const aura = ctx.createRadialGradient(gx, gy, 3, gx, gy, 30);
      aura.addColorStop(0, `rgba(148, 245, 255, ${(0.52 * pulse).toFixed(3)})`);
      aura.addColorStop(0.50, `rgba(68, 175, 255, ${(0.24 * pulse).toFixed(3)})`);
      aura.addColorStop(1, "rgba(30, 90, 200, 0)");
      ctx.fillStyle = aura;
      ctx.fillRect(gx - 30, gy - 30, 60, 60);

      // Re-draw glowing silhouette on top of darkness so its glowing eyes, spine & 4 claws shine vividly!
      drawQuadrupedHoundSprite(ctx, h.x, h.y, timeSec, h.facing, h.state === "CHASE");
    }

    // 3. Radiant dissolve particle bursts when Hound touches light and vanishes!
    sl.vanishBursts.forEach((vb) => {
      if (vb.roomKey !== roomKey) return;
      const frac = vb.age / vb.maxAge;
      const rad = 8 + frac * 34;
      const bg = ctx.createRadialGradient(vb.x, vb.y, 1, vb.x, vb.y, rad);
      bg.addColorStop(0, `rgba(255, 250, 220, ${(0.85 * (1 - frac)).toFixed(3)})`);
      bg.addColorStop(0.55, `rgba(128, 238, 255, ${(0.45 * (1 - frac)).toFixed(3)})`);
      bg.addColorStop(1, "rgba(80, 180, 255, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(vb.x - rad, vb.y - rad, rad * 2, rad * 2);

      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + frac * 1.4;
        const dist = 4 + frac * 28;
        ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#8ceeff";
        ctx.globalAlpha = Math.max(0, 1 - frac);
        ctx.fillRect(Math.round(vb.x + Math.cos(ang) * dist), Math.round(vb.y + Math.sin(ang) * dist), 2, 2);
      }
      ctx.globalAlpha = 1;
    });
  }

  function getHudSummary(matchState) {
    const sl = matchState && matchState.stayLitEvent;
    if (!sl || !sl.active) return null;

    if (sl.stage === "FLICKER_5S") {
      return {
        title: `STAY IN THE LIGHT • LIGHTS SPLITTING IN ${Math.max(1, Math.ceil(sl.flickerTimer))}S`,
        sub: "PREPARE TO RUN INTO THE 2 LIT ROOMS!",
        notice: sl.notice || ""
      };
    }

    const pKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const safe = sl.litRoomKeys.has(pKey);
    const litNames = Array.from(sl.litRoomKeys)
      .map((k) => matchState.roomMap[k]?.name || k)
      .join(" + ");

    return {
      title: `STAY IN THE LIGHT • SURVIVE: ${Math.max(0, Math.ceil(sl.surviveTimer))}S • NEXT SHIFT: ${Math.max(1, Math.ceil(sl.cycleTimer))}S`,
      sub: safe
        ? `SAFE IN LIGHT!  |  LIT ROOMS: ${litNames}`
        : `IN THE DARK — DANGER!  |  LIT ROOMS: ${litNames}`,
      notice: sl.notice || ""
    };
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.stayLitEvent && matchState.stayLitEvent.active);
  }

  function broadcastStateNow(matchState, extra) {
    if (!matchState || !isMpMode(matchState) || !isMpHost(matchState)) return;
    const sl = matchState.stayLitEvent;
    if (!sl || !sl.active) return;
    App.Network.sendGameAction("MP_STAYLIT_STATE", Object.assign({
      stage: sl.stage,
      flickerTimer: Math.round((sl.flickerTimer || 0) * 10) / 10,
      surviveTimer: Math.round((sl.surviveTimer || 0) * 10) / 10,
      cycleTimer: Math.round((sl.cycleTimer || 0) * 10) / 10,
      litRoomKeys: Array.from(sl.litRoomKeys || []),
      hound: {
        active: Boolean(sl.hound.active),
        roomKey: sl.hound.roomKey,
        x: Math.round(sl.hound.x * 10) / 10,
        y: Math.round(sl.hound.y * 10) / 10,
        facing: sl.hound.facing,
        state: sl.hound.state
      },
      notice: sl.notice || "",
      noticeTimer: sl.noticeTimer || 0
    }, extra || {}));
  }

  function handleNetworkMessage(action, payload, matchState) {
    if (action !== "MP_STAYLIT_STATE" || !matchState || !isMpGuest(matchState)) return false;
    const p = payload || {};
    if (!matchState.stayLitEvent) startStayInLightEvent(matchState);
    const sl = matchState.stayLitEvent;
    if (!sl) return true;

    sl.stage = p.stage || sl.stage;
    sl.flickerTimer = typeof p.flickerTimer === "number" ? p.flickerTimer : sl.flickerTimer;
    sl.surviveTimer = typeof p.surviveTimer === "number" ? p.surviveTimer : sl.surviveTimer;
    sl.cycleTimer = typeof p.cycleTimer === "number" ? p.cycleTimer : sl.cycleTimer;
    if (Array.isArray(p.litRoomKeys)) {
      sl.litRoomKeys = new Set(p.litRoomKeys);
      if (sl.stage === "SURVIVE_90S") {
        matchState.roomLightStates = {};
        getEventRoomKeys(matchState.roomMap).forEach((k) => {
          matchState.roomLightStates[k] = sl.litRoomKeys.has(k);
        });
      }
    }
    if (p.lightShift && App.Audio && App.Audio.playLightSwitchSurge) {
      App.Audio.playLightSwitchSurge(4.0);
    }
    if (p.vanished) {
      sl.vanishBursts.push({ roomKey: p.vanished.roomKey, x: p.vanished.x, y: p.vanished.y - 10, age: 0, maxAge: 0.72 });
      if (App.Audio && App.Audio.shadowHoundVanish) App.Audio.shadowHoundVanish();
    }
    if (p.hound) Object.assign(sl.hound, p.hound);
    if (p.notice) { sl.notice = p.notice; sl.noticeTimer = p.noticeTimer || 2.5; }
    return true;
  }

  function cleanup(matchState, opts) {
    if (App.Audio && App.Audio.stopLightSwitchSurge) App.Audio.stopLightSwitchSurge();
    if (App.Jumpscare && !(opts && opts.keepJumpscare)) App.Jumpscare.stop();
    if (matchState) matchState.stayLitEvent = null;
  }

  App.StayLit = {
    startStayInLightEvent,
    update,
    getGlobalFlickerMultiplier,
    getRoomRenderables,
    renderRoomHighlights,
    getHudSummary,
    isActive,
    broadcastStateNow,
    handleNetworkMessage,
    cleanup
  };
})(window.Duskwood);
