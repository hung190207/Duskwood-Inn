/* ==========================================================================
   DUSKWOOD INN - Cabin-Wide Stalker Events Engine
   1. THE TALL MAN (`hx_tall_stalker`)
      - All built rooms' lights switch ON (including The Dining Room!)
      - Towering eyeless monstrous Tall Man stalks the cabin at moderate speed
      - Can detect & catch player whenever player is in a lit room OR holding Lantern ON
      - Switching ALL lights OFF wins -> plays `broken_light.mp3` & restores exact pre-event lights!
   2. RED BALLOONS (`hx_balloons`)
      - All cabin lights shut OFF; player navigates using Lantern `[F]`
      - Loops `audio/clown_laugh.mp3` (0.0s -> 9.0s) until event concludes
      - Pop all Red Balloons with `[E]` -> spawns 1 Golden Balloon -> pop it to win!
      - Monster: Jack-in-the-Box Clown spawns if any player is NOT crouching (`[C]`)
      - Once spawned, every balloon pop & uncrouched footstep emits sound drawing the Clown there!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
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

  // Offscreen sprite buffers
  const tallBuf = document.createElement("canvas");
  tallBuf.width = 24;
  tallBuf.height = 40;
  const tctx = tallBuf.getContext("2d");
  tctx.imageSmoothingEnabled = false;

  const clownBuf = document.createElement("canvas");
  clownBuf.width = 24;
  clownBuf.height = 30;
  const cctx = clownBuf.getContext("2d");
  cctx.imageSmoothingEnabled = false;

  const puppetBuf = document.createElement("canvas");
  puppetBuf.width = 26;
  puppetBuf.height = 34;
  const pctx = puppetBuf.getContext("2d");
  pctx.imageSmoothingEnabled = false;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function isMpMode(matchState) {
    return Boolean(App.Events && App.Events.isMpEventMode && App.Events.isMpEventMode(matchState));
  }
  function isMpHost(matchState) {
    return !App.Events || !App.Events.isMpHost || App.Events.isMpHost(matchState);
  }
  function isMpGuest(matchState) {
    return Boolean(App.Events && App.Events.isMpGuest && App.Events.isMpGuest(matchState));
  }
  function getLocalPid() {
    return (App.Network && App.Network.getLocalPlayerId) ? App.Network.getLocalPlayerId() : "local";
  }
  function getRoomGlobalDist(roomMap, rkA, ax, ay, rkB, bx, by) {
    const rA = (roomMap && roomMap[rkA]) || { x: 0, y: 0 };
    const rB = (roomMap && roomMap[rkB]) || { x: 0, y: 0 };
    return Math.hypot((rA.x * 208 + ax) - (rB.x * 208 + bx), (rA.y * 208 + ay) - (rB.y * 208 + by));
  }

  // ==================== SHARED CABIN GRAPH BFS & SAFE ANCHORS ====================
  function getSafeCenterForRoom(room) {
    if (!room) return { x: 104, y: 126 };
    if (room.id === "dining_room") {
      // Avoid central round table (104, 126)
      const spots = [
        { x: 46,  y: 102 },
        { x: 162, y: 102 },
        { x: 46,  y: 170 },
        { x: 162, y: 170 }
      ];
      return spots[Math.floor(Math.random() * spots.length)];
    }
    if (room.id === "bp_bathroom") return { x: 104, y: 126 };
    if (room.id === "bp_furnace") return { x: 104, y: 126 };
    if (room.id === "bp_study") return { x: 104, y: 126 };
    if (room.id === "bp_kitchen" || room.id === "bp_bedroom") return { x: 104, y: 124 };
    if (room.id === "bp_living_room") return { x: 104, y: 124 };
    return { x: 104, y: 126 };
  }

  function getEventRoomKeys(roomMap) {
    const keys = Object.keys(roomMap || {}).filter((k) => roomMap[k] && roomMap[k].id !== "bp_cellar");
    return keys.length ? keys : ["0,0"];
  }

  function findNextStepRoom(roomMap, fromKey, toKey) {
    if (!roomMap || fromKey === toKey) return null;
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
        visited.add(nk);
        parent[nk] = { prev: cur, dir: d.dir, opp: d.opp };
        queue.push(nk);
      }
    }

    if (!found) return null;

    // Backtrack to find the first doorway out of `fromKey`
    let stepKey = toKey;
    while (parent[stepKey] && parent[stepKey].prev !== fromKey) {
      stepKey = parent[stepKey].prev;
    }
    const edge = parent[stepKey];
    if (!edge) return null;
    return { nextRoomKey: stepKey, exitDir: edge.dir, enterDir: edge.opp };
  }

  function pickFarRoomKey(roomMap, avoidCoord) {
    const keys = getEventRoomKeys(roomMap);
    if (keys.length <= 1) return keys[0] || "0,0";
    const ax = avoidCoord ? avoidCoord.x : 0;
    const ay = avoidCoord ? avoidCoord.y : 0;
    const far = keys.filter((k) => {
      const r = roomMap[k];
      return Math.abs(r.x - ax) + Math.abs(r.y - ay) >= 2;
    });
    if (far.length) return far[Math.floor(Math.random() * far.length)];
    const other = keys.filter((k) => k !== `${ax},${ay}`);
    return other.length ? other[Math.floor(Math.random() * other.length)] : "0,0";
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

  function moveEntityAcrossCabin(entity, targetRoomKey, targetX, targetY, speed, dt, roomMap) {
    if (entity.roomKey === targetRoomKey) {
      const dx = targetX - entity.x;
      const dy = targetY - entity.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 3) return true;
      entity.x += (dx / dist) * speed * dt;
      entity.y += (dy / dist) * speed * dt;
      if (Math.abs(dx) > 0.3) entity.facing = dx >= 0 ? 1 : -1;
      return false;
    }

    // Move toward the doorway leading to the next room along BFS path
    const step = findNextStepRoom(roomMap, entity.roomKey, targetRoomKey);
    if (!step) return true;

    const exitPt = DOOR_POS[step.exitDir] || { x: 104, y: 126 };
    const dx = exitPt.x - entity.x;
    const dy = exitPt.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 5) {
      // Cross doorway into adjacent room!
      entity.roomKey = step.nextRoomKey;
      const enterPt = DOOR_POS[step.enterDir] || { x: 104, y: 126 };
      entity.x = enterPt.x;
      entity.y = enterPt.y;
      return false;
    }
    entity.x += (dx / dist) * speed * dt;
    entity.y += (dy / dist) * speed * dt;
    if (Math.abs(dx) > 0.3) entity.facing = dx >= 0 ? 1 : -1;
    return false;
  }

  // ==================== 1. PIXEL-ART MONSTER SPRITES ====================
  // Towering Eyeless Monstrous Tall Man (24x40px — looms high above 22px player!)
  function drawTallManSprite(ctx, x, y, timeSec, facing, isChasing) {
    const stride = Math.sin(timeSec * (isChasing ? 9.5 : 5.2));
    const sway = Math.sin(timeSec * 3.2) * 1.1;
    const legL = Math.round(stride * 2.2);
    const legR = -legL;

    tctx.clearRect(0, 0, 24, 40);

    // Shadowy elongated monstrous legs (tall!)
    px(tctx, 8, 25, 3, 12 + legL, "#09080c");
    px(tctx, 13, 25, 3, 12 + legR, "#09080c");
    px(tctx, 9, 25, 1, 11, "#1c1921");
    px(tctx, 14, 25, 1, 11, "#1c1921");

    // Gaunt hunched rib-like dark coat torso
    px(tctx, 6, 11, 12, 15, "#0d0b10");
    px(tctx, 7, 12, 10, 13, "#1a1720");
    px(tctx, 9, 13, 6, 10, "#24202b");
    // Pale jagged tattered ribs/lapels
    px(tctx, 8, 15, 2, 1, "#3d3642");
    px(tctx, 14, 15, 2, 1, "#3d3642");
    px(tctx, 9, 18, 2, 1, "#3d3642");
    px(tctx, 13, 18, 2, 1, "#3d3642");

    // Absurdly long drooping monstrous clawed arms reaching past knees!
    const armSwing = Math.round(stride * 2.0);
    px(tctx, 3, 12, 3, 16 + armSwing, "#0b090e");
    px(tctx, 4, 13, 1, 14 + armSwing, "#231e29");
    px(tctx, 2, 27 + armSwing, 4, 4, "#8a7f78"); // Pale hooked claws
    px(tctx, 2, 30 + armSwing, 1, 2, "#cfc3b8");
    px(tctx, 5, 30 + armSwing, 1, 2, "#cfc3b8");

    px(tctx, 18, 12, 3, 16 - armSwing, "#0b090e");
    px(tctx, 19, 13, 1, 14 - armSwing, "#231e29");
    px(tctx, 18, 27 - armSwing, 4, 4, "#8a7f78");
    px(tctx, 18, 30 - armSwing, 1, 2, "#cfc3b8");
    px(tctx, 21, 30 - armSwing, 1, 2, "#cfc3b8");

    // Pale, elongated, EYELESS monstrous head tilted forward
    px(tctx, 8, 1, 8, 10, "#120e12");
    px(tctx, 9, 2, 6, 8, "#c2b6aa");
    px(tctx, 10, 2, 4, 3, "#d6cbc0");
    // Smooth sunken eyeless indentations (NO EYES!)
    px(tctx, 9, 5, 2, 2, "#8c7f74");
    px(tctx, 13, 5, 2, 2, "#8c7f74");
    // Wide dark jagged monstrous maw when hunting!
    if (isChasing) {
      px(tctx, 10, 8, 4, 3, "#120608");
      px(tctx, 10, 8, 1, 1, "#e6dfd3");
      px(tctx, 13, 8, 1, 1, "#e6dfd3");
    } else {
      px(tctx, 10, 8, 4, 1, "#453a36");
    }

    ctx.save();
    // Floor contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.56)";
    ctx.fillRect(Math.round(x - 8), Math.round(y - 2), 16, 5);

    const dx = Math.round(x - 12 + sway);
    const dy = Math.round(y - 37);
    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tallBuf, Math.round(x - 12 - sway), dy);
    } else {
      ctx.drawImage(tallBuf, dx, dy);
    }
    ctx.restore();
  }

  // Creepy Jack-in-the-Box Clown Monster (`Hộp Hề`, 24x30px)
  function drawClownBoxSprite(ctx, x, y, timeSec, facing, isAlert) {
    const hop = Math.abs(Math.sin(timeSec * (isAlert ? 11.0 : 6.2))) * 2.6;
    const wobble = Math.round(Math.sin(timeSec * (isAlert ? 16 : 8)) * 1.4);

    cctx.clearRect(0, 0, 24, 30);

    // Ornate antique carnival Wooden Box base (bottom half)
    px(cctx, 4, 17, 16, 11, "#1c0e0c");
    px(cctx, 5, 18, 14, 9, "#8a2229"); // Crimson carnival stripes
    px(cctx, 7, 18, 3, 9, "#e6c45a");  // Gold stripe
    px(cctx, 14, 18, 3, 9, "#e6c45a");
    px(cctx, 5, 18, 14, 2, "#4a2a18"); // Open box rim
    // Side brass crank handle
    px(cctx, 20, 21, 3, 2, "#c9a44c");
    px(cctx, 22, 19, 2, 4, "#f0d378");

    // Coiled metal spring bouncing out of the box!
    px(cctx, 10 + wobble, 13, 4, 1, "#8c96a6");
    px(cctx, 11, 14, 3, 1, "#c4cedb");
    px(cctx, 9 + wobble, 15, 5, 1, "#8c96a6");
    px(cctx, 10, 16, 4, 1, "#c4cedb");

    // Ruffled jester collar
    px(cctx, 6 + wobble, 11, 12, 3, "#e8e2d5");
    px(cctx, 7 + wobble, 12, 2, 2, "#b82834");
    px(cctx, 15 + wobble, 12, 2, 2, "#28598a");

    // Pale sinister grinning clown head
    px(cctx, 7 + wobble, 4, 10, 8, "#171316");
    px(cctx, 8 + wobble, 5, 8, 6, "#f2eee6");
    // Hollow dark diamond eyes with glowing red pinpricks
    px(cctx, 9 + wobble, 6, 2, 2, "#140c10");
    px(cctx, 13 + wobble, 6, 2, 2, "#140c10");
    if (isAlert) {
      px(cctx, 10 + wobble, 6, 1, 1, "#ff3b3b");
      px(cctx, 13 + wobble, 6, 1, 1, "#ff3b3b");
    }
    // Bright crimson clown nose & wide blood-red grin
    px(cctx, 11 + wobble, 8, 2, 2, "#d91e2b");
    px(cctx, 9 + wobble, 10, 6, 1, "#9e141f");

    // Dual-pronged jester hat with golden bells!
    px(cctx, 5 + wobble, 2, 6, 3, "#b8222e");
    px(cctx, 13 + wobble, 2, 6, 3, "#24547a");
    px(cctx, 4 + wobble, 4, 2, 2, "#ffdf6b"); // Left bell
    px(cctx, 18 + wobble, 4, 2, 2, "#ffdf6b"); // Right bell

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.54)";
    ctx.fillRect(Math.round(x - 9), Math.round(y - 2), 18, 4);
    ctx.drawImage(clownBuf, Math.round(x - 12), Math.round(y - 28 - hop));
    ctx.restore();
  }

  // Glossy Red / Golden Helium Balloon Sprite
  function drawBalloonSprite(ctx, b, timeSec) {
    const bob = Math.sin(timeSec * 3.4 + b.phase) * 2.2;
    const x = Math.round(b.x);
    const y = Math.round(b.y - 16 + bob);

    // Subtle ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.fillRect(x - 3, Math.round(b.y) + 1, 6, 2);

    // Curly white string descending to floor
    ctx.strokeStyle = "rgba(232, 226, 212, 0.72)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.quadraticCurveTo(x + 2, y + 12, x - 1, Math.round(b.y) + 1);
    ctx.stroke();

    // Balloon body
    const outCol  = b.isGold ? "#593e0c" : "#4a0a10";
    const mainCol = b.isGold ? "#f2c43d" : "#c9202e";
    const hiCol   = b.isGold ? "#fff5b8" : "#ff6b78";

    px(ctx, x - 4, y - 5, 9, 10, outCol);
    px(ctx, x - 5, y - 3, 11, 6, outCol);
    px(ctx, x - 3, y - 4, 7, 8, mainCol);
    px(ctx, x - 4, y - 2, 9, 4, mainCol);
    px(ctx, x - 2, y - 3, 2, 3, hiCol); // Gloss highlight
    px(ctx, x - 1, y + 5, 3, 2, mainCol); // Knot
  }

  // ==================== 2. THE TALL MAN EVENT ENGINE ====================
  function startTallManEvent(matchState) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "tall_man");

    const savedLights = snapshotRoomLights(matchState);
    // Turn ALL non-Cellar built rooms' light switches ON (Cellar has no light switch & does not count!)
    const eventKeys = getEventRoomKeys(matchState.roomMap);
    matchState.roomLightStates = {};
    eventKeys.forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    const spawnKey = pickFarRoomKey(matchState.roomMap, matchState.currentRoomCoord);
    const spawnRoom = matchState.roomMap[spawnKey];
    const sp = getSafeCenterForRoom(spawnRoom);

    matchState.tallManEvent = {
      active: true,
      restoringLights: false,
      restoreTimer: 0,
      savedLights,
      totalSwitches: eventKeys.length,
      litRemaining: eventKeys.length,
      monster: {
        roomKey: spawnKey,
        x: sp.x,
        y: sp.y,
        facing: 1,
        state: "PATROL", // PATROL | CHASE
        patrolRoomKey: spawnKey,
        patrolX: sp.x,
        patrolY: sp.y,
        retargetTimer: 1.5
      },
      notice: "ALL CABIN LIGHTS SNAPPED ON! SWITCH OFF EVERY LIGHT — HE HUNTS THE LIGHT!",
      noticeTimer: 5.5,
      syncAccum: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE TALL MAN\nHE HAS NO EYES, SO HE SEES THROUGH YOURS.\nTURN OFF ALL LIGHTS SO HE CAN SEE NO MORE.",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5400);
    }

    return matchState.tallManEvent;
  }

  function countRemainingLitRooms(matchState) {
    let count = 0;
    getEventRoomKeys(matchState.roomMap).forEach((k) => {
      if (matchState.roomLightStates && matchState.roomLightStates[k] === true) {
        count += 1;
      }
    });
    return count;
  }

  function onLightSwitchToggled(matchState) {
    const tm = matchState && matchState.tallManEvent;
    if (!tm || !tm.active || tm.restoringLights) return;

    tm.litRemaining = countRemainingLitRooms(matchState);

    if (tm.litRemaining <= 0) {
      // PLAYER WINS THE TALL MAN!
      tm.restoringLights = true;
      tm.restoreTimer = 0;
      tm.notice = "ALL LIGHTS OFF! THE TALL MAN VANISHES — LIGHTS FLICKERING BACK ON...";
      tm.noticeTimer = 4.5;

      // Play broken_light.mp3 & restore exact pre-event light states!
      if (App.Audio && App.Audio.playBrokenLight) {
        App.Audio.playBrokenLight();
      }
      if (App.Events && App.Events.showSmudgeBanner) {
        App.Events.showSmudgeBanner("ALL LIGHTS EXTINGUISHED!\nTHE TALL MAN HAS VANISHED.", {
          success: true,
          typingDurationSec: 2.6,
          showChoices: false
        });
        setTimeout(() => {
          if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
        }, 3600);
      }
    } else {
      tm.notice = `${tm.litRemaining} ROOM LIGHT${tm.litRemaining === 1 ? "" : "S"} STILL ON!`;
      tm.noticeTimer = 2.6;
    }
  }

  function triggerTallManDeath(matchState) {
    const tm = matchState && matchState.tallManEvent;
    if (!tm) return;

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "tall_man", "tall_man", "THE TALL MAN FOUND YOU IN THE LIGHT!")
      : { keepEventRunning: false };

    if (!res.keepEventRunning) {
      restoreRoomLights(matchState, tm.savedLights);
      matchState.archFlickerLight = 1.0;
      tm.active = false;
      matchState.tallManEvent = null;
    }
  }

  function updateTallMan(dt, matchState, player) {
    const tm = matchState && matchState.tallManEvent;
    if (!tm || !tm.active) return;

    if (tm.noticeTimer > 0) {
      tm.noticeTimer = Math.max(0, tm.noticeTimer - dt);
      if (tm.noticeTimer === 0) tm.notice = "";
    }

    // Victory phase: flicker overhead lights smoothly with `broken_light.mp3` then restore exact pre-event lights!
    if (tm.restoringLights) {
      tm.restoreTimer += dt;
      const t = App.Audio && App.Audio.getBrokenLightTime ? App.Audio.getBrokenLightTime() : tm.restoreTimer;

      // Flicker bulbs on around 2.0s -> 3.85s matching broken_light.mp3!
      if (t >= 2.0 && !tm.lightsRestoredApplied) {
        restoreRoomLights(matchState, tm.savedLights);
        tm.lightsRestoredApplied = true;
      }

      if (t < 2.0) {
        matchState.archFlickerLight = 1.0;
      } else if (t < 3.85) {
        const flick = Math.sin(t * 48) > 0 ? 0.85 : 0.16;
        matchState.archFlickerLight = flick;
      } else {
        matchState.archFlickerLight = 1.0;
        restoreRoomLights(matchState, tm.savedLights);
        tm.active = false;
        matchState.tallManEvent = null;
        if (App.Events && App.Events.onEventWonBroadcast) {
          App.Events.onEventWonBroadcast(matchState, "tall_man", "ALL LIGHTS EXTINGUISHED!\nTHE TALL MAN HAS VANISHED — CELLAR UNLOCKED.");
        }
      }
      return;
    }

    tm.litRemaining = countRemainingLitRooms(matchState);
    if (tm.litRemaining <= 0) {
      onLightSwitchToggled(matchState);
      return;
    }

    const localLocked = Boolean(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState));
    const m = tm.monster;
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const pRoomObj = matchState.roomMap && matchState.roomMap[pRoomKey];
    const inCellar = Boolean(pRoomObj && pRoomObj.id === "bp_cellar");
    const roomIsLit = !inCellar && Boolean(matchState.roomLightStates && matchState.roomLightStates[pRoomKey] === true);
    const playerVisibleInLight = !localLocked && !inCellar && (roomIsLit || Boolean(player.lanternOn));

    // GUEST: strictly uses Host-synced Tall Man position & checks local catch when alive!
    if (isMpGuest(matchState)) {
      if (playerVisibleInLight && m.roomKey === pRoomKey && Math.hypot(m.x - player.x, m.y - player.y) <= 14.5) {
        triggerTallManDeath(matchState);
      }
      return;
    }

    // HOST / SP: check ALL living players (Host + remote teammates) for visibility in light!
    const living = (App.Events && App.Events.getAllLivingPlayers)
      ? App.Events.getAllLivingPlayers(matchState, player)
      : [{ isLocal: true, roomKey: pRoomKey, x: player.x, y: player.y, lanternOn: player.lanternOn }];

    let bestTarget = null;
    let bestDist = Infinity;
    living.forEach((lp) => {
      const rObj = matchState.roomMap && matchState.roomMap[lp.roomKey];
      if (!rObj || rObj.id === "bp_cellar") return;
      const rLit = Boolean(matchState.roomLightStates && matchState.roomLightStates[lp.roomKey] === true);
      if (!rLit && !lp.lanternOn) return;
      const d = getRoomGlobalDist(matchState.roomMap, m.roomKey, m.x, m.y, lp.roomKey, lp.x, lp.y);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = Object.assign({}, lp, { rLit });
      }
    });

    if (bestTarget) {
      if (m.state !== "CHASE") {
        m.state = "CHASE";
        tm.notice = bestTarget.rLit
          ? "HE SEES SOMEONE IN A LIT ROOM! TURN OFF THE SWITCH OR RUN!"
          : "HE SEES A LANTERN! PRESS [F] TO HIDE IN THE DARK!";
        tm.noticeTimer = 2.8;
      }
      moveEntityAcrossCabin(m, bestTarget.roomKey, bestTarget.x, bestTarget.y, 41, dt, matchState.roomMap);

      // Host-authoritative kill check across ALL visible living players (Host + remote Guests!)
      living.forEach((lp) => {
        const rObj = matchState.roomMap && matchState.roomMap[lp.roomKey];
        if (!rObj || rObj.id === "bp_cellar") return;
        const rLit = Boolean(matchState.roomLightStates && matchState.roomLightStates[lp.roomKey] === true);
        if (!rLit && !lp.lanternOn) return;
        if (m.roomKey !== lp.roomKey || Math.hypot(m.x - lp.x, m.y - lp.y) > 14.5) return;
        if (lp.isLocal) {
          if (playerVisibleInLight) triggerTallManDeath(matchState);
        } else if (App.Events && App.Events.hostKillRemotePlayer) {
          App.Events.hostKillRemotePlayer(matchState, lp.playerId, "tall_man", "tall_man", "THE TALL MAN FOUND YOU IN THE LIGHT!");
        }
      });
    } else {
      if (m.state === "CHASE") {
        m.state = "PATROL";
        m.retargetTimer = 0.2;
        tm.notice = "EVERYONE IS HIDDEN IN THE DARK — HE CANNOT SEE YOU.";
        tm.noticeTimer = 2.4;
      }

      m.retargetTimer -= dt;
      const arrived = moveEntityAcrossCabin(m, m.patrolRoomKey, m.patrolX, m.patrolY, 27, dt, matchState.roomMap);
      if (arrived || m.retargetTimer <= 0) {
        const evKeys = getEventRoomKeys(matchState.roomMap);
        const litKeys = evKeys.filter(
          (k) => matchState.roomLightStates && matchState.roomLightStates[k] === true
        );
        const pool = litKeys.length ? litKeys : evKeys;
        const nextK = pool[Math.floor(Math.random() * pool.length)] || "0,0";
        const pt = getSafeCenterForRoom(matchState.roomMap[nextK]);
        m.patrolRoomKey = nextK;
        m.patrolX = pt.x;
        m.patrolY = pt.y;
        m.retargetTimer = 4.5 + Math.random() * 3.0;
      }
    }

    if (isMpMode(matchState)) {
      tm.syncAccum = (tm.syncAccum || 0) + dt;
      if (tm.syncAccum >= 0.085) {
        tm.syncAccum = 0;
        broadcastStateNow(matchState);
      }
    }
  }

  // ==================== 3. RED BALLOONS EVENT ENGINE ====================
  function spawnBalloonsAcrossRooms(roomMap) {
    const keys = getEventRoomKeys(roomMap);
    const shuffled = keys.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const targetCount = Math.min(5, Math.max(3, keys.length - 1));
    const list = [];
    for (let i = 0; i < targetCount; i++) {
      const rk = shuffled[i % shuffled.length];
      const pt = getSafeCenterForRoom(roomMap[rk]);
      list.push({
        id: `red_balloon_${i}`,
        roomKey: rk,
        x: pt.x + (Math.random() - 0.5) * 14,
        y: pt.y + (Math.random() - 0.5) * 10,
        isGold: false,
        popped: false,
        phase: Math.random() * Math.PI * 2
      });
    }
    return list;
  }

  function startRedBalloonsEvent(matchState) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "red_balloons");

    const savedLights = snapshotRoomLights(matchState);
    // Turn ALL room lights OFF — player can ONLY use handheld Lantern `[F]`!
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = false;
    });

    const balloons = spawnBalloonsAcrossRooms(matchState.roomMap);

    matchState.redBalloonsEvent = {
      active: true,
      savedLights,
      balloons,
      redTotal: balloons.length,
      redPopped: 0,
      goldSpawned: false,
      crouchGraceTimer: 2.5, // Brief grace period right when event triggers so player can press [C] to Crouch!
      popBursts: [],
      soundPings: [],
      clown: {
        spawned: false,
        roomKey: "0,0",
        x: 104,
        y: 126,
        facing: 1,
        state: "PATROL", // PATROL | INVESTIGATE
        targetRoomKey: "0,0",
        targetX: 104,
        targetY: 126,
        retargetTimer: 2.0,
        noiseCooldown: 0
      },
      notice: "PRESS [C] TO CROUCH! USE LANTERN [F] & POP RED BALLOONS [E]!",
      noticeTimer: 5.5,
      syncAccum: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    // Start clown_laugh.mp3 + spatial balloons_sfx.mp3 proximity loop (audible across adjacent rooms!)
    if (App.Audio && App.Audio.playClownLaughLoop) {
      App.Audio.playClownLaughLoop();
    }
    if (App.Audio && App.Audio.startBalloonsSfxLoop) {
      App.Audio.setBalloonsSfxAttenuation(0);
      App.Audio.startBalloonsSfxLoop();
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "RED BALLOONS\nPOP THE BALLOONS UNTIL THE GOLD ONE APPEARS.\nPRESS [C] TO CROUCH — MOVE SLOW AND DON'T MAKE A SOUND...",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5400);
    }

    return matchState.redBalloonsEvent;
  }

  function spawnJackInTheBoxClown(rb, matchState, noiseRoomKey, noiseX, noiseY) {
    if (rb.clown.spawned) return;
    const spKey = pickFarRoomKey(matchState.roomMap, matchState.currentRoomCoord);
    const sp = getSafeCenterForRoom(matchState.roomMap[spKey]);
    rb.clown.spawned = true;
    rb.clown.roomKey = spKey;
    rb.clown.x = sp.x;
    rb.clown.y = sp.y;
    rb.clown.state = "INVESTIGATE";
    rb.clown.targetRoomKey = noiseRoomKey;
    rb.clown.targetX = noiseX;
    rb.clown.targetY = noiseY;
    rb.clown.retargetTimer = 7.0;

    App.Audio.hexAlert();
    rb.notice = "YOU MADE NOISE! THE JACK-IN-THE-BOX CLOWN HAS SPAWNED — CROUCH [C]!";
    rb.noticeTimer = 4.6;
  }

  function alertClownToSound(rb, roomKey, x, y, reason) {
    if (!rb || !rb.clown || !rb.clown.spawned) return;
    rb.clown.state = "INVESTIGATE";
    rb.clown.targetRoomKey = roomKey;
    rb.clown.targetX = x;
    rb.clown.targetY = y;
    rb.clown.retargetTimer = 7.0;
    rb.soundPings.push({ roomKey, x, y, age: 0, maxAge: 1.1 });
    if (reason) {
      rb.notice = reason;
      rb.noticeTimer = 3.2;
    }
  }

  function popBalloon(matchState, balloonId, fromNetworkAction) {
    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb || !rb.active) return false;
    // Guest forwards balloon pop to Host so Host authoritatively updates & syncs to all players!
    if (isMpGuest(matchState) && !fromNetworkAction) {
      App.Network.sendGameAction("MP_STALKER_ACTION", { kind: "red_balloons", action: "pop", balloonId });
      return true;
    }
    const b = rb.balloons.find((x) => x.id === balloonId && !x.popped);
    if (!b) return false;

    b.popped = true;
    if (App.Audio && App.Audio.balloonPop) App.Audio.balloonPop(b.isGold);
    rb.popBursts.push({ roomKey: b.roomKey, x: b.x, y: b.y - 16, isGold: b.isGold, age: 0, maxAge: 0.48 });

    // GOLDEN BALLOON POPPED -> PLAYER WINS!
    if (b.isGold) {
      if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();
      if (App.Audio && App.Audio.stopBalloonsSfxLoop) App.Audio.stopBalloonsSfxLoop();
      restoreRoomLights(matchState, rb.savedLights);
      rb.active = false;
      matchState.redBalloonsEvent = null;
      if (App.Events && App.Events.onEventWonBroadcast) {
        App.Events.onEventWonBroadcast(matchState, "red_balloons", "GOLDEN BALLOON POPPED!\nTHE CLOWN VANISHES — CELLAR DOOR UNLOCKED.");
      }

      if (App.Events && App.Events.showSmudgeBanner) {
        App.Events.showSmudgeBanner("GOLDEN BALLOON POPPED!\nTHE CLOWN VANISHES INTO SILENCE.", {
          success: true,
          typingDurationSec: 2.8,
          showChoices: false
        });
        setTimeout(() => {
          if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
        }, 3600);
      }
      return true;
    }

    // RED BALLOON POPPED
    rb.redPopped += 1;

    // If Jack-in-the-Box Clown has already spawned, popping creates a LOUD SOUND & attracts it right here!
    if (rb.clown.spawned) {
      alertClownToSound(rb, b.roomKey, b.x, b.y, "POP! THE CLOWN HEARD THE BALLOON AND IS HEADING THERE!");
    } else {
      rb.notice = `RED BALLOONS POPPED: ${rb.redPopped} / ${rb.redTotal}`;
      rb.noticeTimer = 2.6;
    }

    // All Red Balloons popped -> spawn the GOLDEN BALLOON!
    if (rb.redPopped >= rb.redTotal && !rb.goldSpawned) {
      rb.goldSpawned = true;
      const gKey = pickFarRoomKey(matchState.roomMap, matchState.currentRoomCoord);
      const gp = getSafeCenterForRoom(matchState.roomMap[gKey]);
      rb.balloons.push({
        id: "gold_balloon",
        roomKey: gKey,
        x: gp.x,
        y: gp.y,
        isGold: true,
        popped: false,
        phase: 0
      });
      App.Audio.clockChime();
      const gRoomName = matchState.roomMap[gKey]?.fullName || "A CABIN ROOM";
      rb.notice = `THE GOLDEN BALLOON HAS APPEARED IN ${gRoomName}! POP IT TO WIN!`;
      rb.noticeTimer = 5.5;
    }

    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }
    return true;
  }

  function triggerRedBalloonsDeath(matchState) {
    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb) return;

    if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();
    if (App.Audio && App.Audio.stopBalloonsSfxLoop) App.Audio.stopBalloonsSfxLoop();

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "red_balloons", "balloon_stalker", "THE JACK-IN-THE-BOX CAUGHT YOU!")
      : { keepEventRunning: false };

    if (!res.keepEventRunning) {
      restoreRoomLights(matchState, rb.savedLights);
      rb.active = false;
      matchState.redBalloonsEvent = null;
    }
  }

  function updateRedBalloons(dt, matchState, player) {
    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb || !rb.active) return;

    if (rb.noticeTimer > 0) {
      rb.noticeTimer = Math.max(0, rb.noticeTimer - dt);
      if (rb.noticeTimer === 0) rb.notice = "";
    }

    // Update pop bursts & sound ripples
    rb.popBursts = rb.popBursts.filter((pb) => {
      pb.age += dt;
      return pb.age < pb.maxAge;
    });
    rb.soundPings = rb.soundPings.filter((sp) => {
      sp.age += dt;
      return sp.age < sp.maxAge;
    });

    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;

    // Spatial distance attenuation for audio/balloons_sfx.mp3:
    // Computes global pixel distance across ALL built rooms so players hear balloons even from adjacent rooms!
    if (App.Audio && App.Audio.setBalloonsSfxAttenuation) {
      const ROOM_SZ = 208;
      const pgx = (matchState.currentRoomCoord.x || 0) * ROOM_SZ + player.x;
      const pgy = (matchState.currentRoomCoord.y || 0) * ROOM_SZ + player.y;
      let minDist = Infinity;

      for (const b of rb.balloons) {
        if (b.popped) continue;
        const rObj = matchState.roomMap && matchState.roomMap[b.roomKey];
        if (!rObj) continue;
        const bgx = rObj.x * ROOM_SZ + b.x;
        const bgy = rObj.y * ROOM_SZ + b.y;
        const d = Math.hypot(pgx - bgx, pgy - bgy);
        if (d < minDist) minDist = d;
      }

      if (minDist < Infinity) {
        const minAud = 24;
        const maxAud = 385; // ~1.85 rooms -> clearly audible in same room AND adjacent rooms when nearby!
        const t = Math.max(0, Math.min(1, (minDist - minAud) / (maxAud - minAud)));
        const att = Math.pow(1 - t, 1.55);
        App.Audio.setBalloonsSfxAttenuation(att);
      } else {
        App.Audio.setBalloonsSfxAttenuation(0);
      }
    }

    // Grace period at event start so player can hit [C] to Crouch
    if (rb.crouchGraceTimer > 0) {
      rb.crouchGraceTimer = Math.max(0, rb.crouchGraceTimer - dt);
    }

    const localLocked = Boolean(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState));
    if (localLocked && App.Audio && App.Audio.setBalloonsSfxAttenuation) {
      App.Audio.setBalloonsSfxAttenuation(0);
    }

    // GUEST: strictly checks lethal contact against Host-synced Clown when alive!
    if (isMpGuest(matchState)) {
      if (localLocked) return;
      const cl = rb.clown;
      if (cl && cl.spawned && cl.roomKey === pRoomKey && Math.hypot(cl.x - player.x, cl.y - player.y) <= 14.5) {
        triggerRedBalloonsDeath(matchState);
      }
      return;
    }

    // HOST / SP: check ALL living players for uncrouched noise!
    const living = (App.Events && App.Events.getAllLivingPlayers)
      ? App.Events.getAllLivingPlayers(matchState, player)
      : [{ isLocal: true, roomKey: pRoomKey, x: player.x, y: player.y, crouching: player.crouching, moving: player.moving }];

    if (!rb.clown.spawned) {
      const noisy = living.find((lp) => !lp.crouching && (rb.crouchGraceTimer <= 0 || lp.moving));
      if (noisy) {
        spawnJackInTheBoxClown(rb, matchState, noisy.roomKey, noisy.x, noisy.y);
      }
    }

    if (rb.clown.spawned) {
      const cl = rb.clown;
      if (cl.noiseCooldown > 0) cl.noiseCooldown = Math.max(0, cl.noiseCooldown - dt);

      if (cl.noiseCooldown <= 0) {
        let noisyTarget = null;
        let bestD = Infinity;
        living.forEach((lp) => {
          if (lp.crouching) return;
          if (!lp.moving && cl.roomKey !== lp.roomKey) return;
          const d = getRoomGlobalDist(matchState.roomMap, cl.roomKey, cl.x, cl.y, lp.roomKey, lp.x, lp.y);
          if (d < bestD) { bestD = d; noisyTarget = lp; }
        });
        if (noisyTarget) {
          alertClownToSound(rb, noisyTarget.roomKey, noisyTarget.x, noisyTarget.y, null);
          cl.noiseCooldown = 0.55;
        }
      }

      const speed = cl.state === "INVESTIGATE" ? 44 : 26;
      const arrived = moveEntityAcrossCabin(cl, cl.targetRoomKey, cl.targetX, cl.targetY, speed, dt, matchState.roomMap);

      cl.retargetTimer -= dt;
      if (arrived || cl.retargetTimer <= 0) {
        cl.state = "PATROL";
        const allKeys = getEventRoomKeys(matchState.roomMap);
        const nextK = allKeys[Math.floor(Math.random() * allKeys.length)] || "0,0";
        const pt = getSafeCenterForRoom(matchState.roomMap[nextK]);
        cl.targetRoomKey = nextK;
        cl.targetX = pt.x;
        cl.targetY = pt.y;
        cl.retargetTimer = 5.0 + Math.random() * 3.0;
      }

      // Host-authoritative kill check across ALL living players (Host + remote Guests!)
      living.forEach((lp) => {
        if (cl.roomKey !== lp.roomKey || Math.hypot(cl.x - lp.x, cl.y - lp.y) > 14.5) return;
        if (lp.isLocal) {
          if (!localLocked) triggerRedBalloonsDeath(matchState);
        } else if (App.Events && App.Events.hostKillRemotePlayer) {
          App.Events.hostKillRemotePlayer(matchState, lp.playerId, "red_balloons", "balloon_stalker", "THE JACK-IN-THE-BOX CAUGHT YOU!");
        }
      });
    }

    if (isMpMode(matchState)) {
      rb.syncAccum = (rb.syncAccum || 0) + dt;
      if (rb.syncAccum >= 0.085) {
        rb.syncAccum = 0;
        broadcastStateNow(matchState);
      }
    }
  }

  // ==================== 3b. FEELING SMALL? (PUPPET + TOY TRAIN + 4 SHAPES) ====================
  const SHAPE_DEFS = [
    { id: "square",   name: "GREEN SQUARE",  short: "SQUARE",   color: "#2ea84a", hi: "#78eb8c", out: "#103b1a" },
    { id: "circle",   name: "BLUE CIRCLE",   short: "CIRCLE",   color: "#2b78d6", hi: "#78b8ff", out: "#102a4d" },
    { id: "triangle", name: "RED TRIANGLE",  short: "TRIANGLE", color: "#d62b38", hi: "#ff7882", out: "#4d0e13" },
    { id: "star",     name: "YELLOW STAR",   short: "STAR",     color: "#ebbf24", hi: "#fff08c", out: "#574308" }
  ];

  function getShapeDef(id) {
    return SHAPE_DEFS.find((s) => s.id === id) || SHAPE_DEFS[0];
  }

  function drawShapeBlock(ctx, x, y, shapeId, scale) {
    const s = getShapeDef(shapeId);
    const cx = Math.round(x);
    const cy = Math.round(y);
    const sz = scale || 1;

    if (shapeId === "square") {
      px(ctx, cx - 4 * sz, cy - 4 * sz, 8 * sz, 8 * sz, s.out);
      px(ctx, cx - 3 * sz, cy - 3 * sz, 6 * sz, 6 * sz, s.color);
      px(ctx, cx - 3 * sz, cy - 3 * sz, 5 * sz, 2 * sz, s.hi);
    } else if (shapeId === "circle") {
      px(ctx, cx - 3 * sz, cy - 4 * sz, 6 * sz, 8 * sz, s.out);
      px(ctx, cx - 4 * sz, cy - 3 * sz, 8 * sz, 6 * sz, s.out);
      px(ctx, cx - 2 * sz, cy - 3 * sz, 4 * sz, 6 * sz, s.color);
      px(ctx, cx - 3 * sz, cy - 2 * sz, 6 * sz, 4 * sz, s.color);
      px(ctx, cx - 2 * sz, cy - 2 * sz, 2 * sz, 2 * sz, s.hi);
    } else if (shapeId === "triangle") {
      px(ctx, cx - 4 * sz, cy + 2 * sz, 8 * sz, 2 * sz, s.out);
      px(ctx, cx - 3 * sz, cy,          6 * sz, 2 * sz, s.out);
      px(ctx, cx - 2 * sz, cy - 2 * sz, 4 * sz, 2 * sz, s.out);
      px(ctx, cx - 1 * sz, cy - 4 * sz, 2 * sz, 2 * sz, s.out);
      px(ctx, cx - 3 * sz, cy + 1 * sz, 6 * sz, 2 * sz, s.color);
      px(ctx, cx - 2 * sz, cy - 1 * sz, 4 * sz, 2 * sz, s.color);
      px(ctx, cx - 1 * sz, cy - 3 * sz, 2 * sz, 2 * sz, s.hi);
    } else {
      // Star block
      px(ctx, cx - 1 * sz, cy - 4 * sz, 2 * sz, 8 * sz, s.out);
      px(ctx, cx - 4 * sz, cy - 1 * sz, 8 * sz, 2 * sz, s.out);
      px(ctx, cx - 3 * sz, cy - 3 * sz, 6 * sz, 6 * sz, s.out);
      px(ctx, cx - 1 * sz, cy - 3 * sz, 2 * sz, 6 * sz, s.color);
      px(ctx, cx - 3 * sz, cy - 1 * sz, 6 * sz, 2 * sz, s.color);
      px(ctx, cx - 2 * sz, cy - 2 * sz, 4 * sz, 4 * sz, s.hi);
    }
  }

  // Creepy Wooden Marionette Puppet with taut strings attached to head, arms & legs!
  function drawPuppetSprite(ctx, x, y, timeSec, facing, isChasing) {
    const sway = Math.sin(timeSec * (isChasing ? 14 : 4.2)) * (isChasing ? 1.8 : 1.2);
    const armL = Math.round(Math.sin(timeSec * (isChasing ? 16 : 5.0)) * 2.5);
    const armR = -armL;
    const legL = Math.round(Math.cos(timeSec * (isChasing ? 16 : 5.0)) * 2.2);
    const legR = -legL;

    pctx.clearRect(0, 0, 26, 34);

    // Jointed wooden dangling legs
    px(pctx, 9,  22, 3, 9 + legL, "#241610");
    px(pctx, 10, 22, 1, 8 + legL, "#b89672");
    px(pctx, 8,  29 + legL, 4, 3, "#141012");

    px(pctx, 14, 22, 3, 9 + legR, "#241610");
    px(pctx, 15, 22, 1, 8 + legR, "#b89672");
    px(pctx, 14, 29 + legR, 4, 3, "#141012");

    // Striped vintage marionette tunic torso (crimson & charcoal-gold)
    px(pctx, 7, 12, 12, 11, "#180d0e");
    px(pctx, 8, 13, 10, 9,  "#7d1d28");
    px(pctx, 9, 13, 2,  9,  "#d9b65c");
    px(pctx, 15, 13, 2, 9,  "#d9b65c");
    px(pctx, 10, 12, 6, 2,  "#e8dfd0"); // Ruffled doll collar

    // Jointed wooden marionette arms raised by strings!
    px(pctx, 3, 13 + armL, 5, 3, "#241610");
    px(pctx, 4, 14 + armL, 3, 2, "#c7a682");
    px(pctx, 2, 12 + armL, 2, 3, "#e0c5a4"); // Left hand attached to string

    px(pctx, 18, 13 + armR, 5, 3, "#241610");
    px(pctx, 19, 14 + armR, 3, 2, "#c7a682");
    px(pctx, 22, 12 + armR, 2, 3, "#e0c5a4"); // Right hand attached to string

    // Pale cracked wooden ventriloquist/marionette head
    px(pctx, 8, 3, 10, 9, "#1c120d");
    px(pctx, 9, 4, 8,  7, "#e6d8c3");
    px(pctx, 10, 4, 6, 2, "#f5ecdc");
    // Painted rosy cheeks & hollow black staring eyes (glowing red when chasing!)
    px(pctx, 9,  8, 1, 1, "#d95b66");
    px(pctx, 16, 8, 1, 1, "#d95b66");
    px(pctx, 10, 6, 2, 2, "#120c0e");
    px(pctx, 14, 6, 2, 2, "#120c0e");
    if (isChasing) {
      px(pctx, 11, 6, 1, 1, "#ff2e2e");
      px(pctx, 14, 6, 1, 1, "#ff2e2e");
    }
    // Hinged wooden puppet jaw line
    px(pctx, 10, 9, 6, 1, "#33221a");
    px(pctx, 10, 10, 1, 1, "#5c4335");
    px(pctx, 15, 10, 1, 1, "#5c4335");

    const drawX = Math.round(x - 13 + sway);
    const drawY = Math.round(y - 31);

    ctx.save();
    // TAUT MARIONETTE STRINGS extending straight upward from head, both hands & both legs to the ceiling!
    ctx.strokeStyle = isChasing ? "rgba(255, 210, 210, 0.72)" : "rgba(220, 218, 210, 0.62)";
    ctx.lineWidth = 0.9;
    const strTopY = Math.max(0, drawY - 42);
    const strPts = [
      [drawX + 3,  drawY + 13 + armL], // Left hand string
      [drawX + 23, drawY + 13 + armR], // Right hand string
      [drawX + 13, drawY + 4],         // Head crown string
      [drawX + 10, drawY + 28 + legL], // Left leg string
      [drawX + 16, drawY + 28 + legR]  // Right leg string
    ];
    strPts.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(Math.round(x + (sx - x) * 0.45), strTopY);
      ctx.stroke();
    });
    // Small wooden marionette control cross high overhead
    px(ctx, x - 8, strTopY, 16, 2, "#4a2e1b");

    // Floor contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(Math.round(x - 8), Math.round(y - 2), 16, 4);

    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(puppetBuf, Math.round(x - 13 - sway), drawY);
    } else {
      ctx.drawImage(puppetBuf, drawX, drawY);
    }
    ctx.restore();
  }

  // Colorful Wooden Toy Train (modeled directly after image_98e60c.png!)
  // Shows Engine (blue hood, yellow cab, red roof, red wheels) + Cargo Car displaying needed shape!
  function drawToyTrainSprite(ctx, train, reqShapeId, placedShapes, timeSec, isStaticProp) {
    const cx = Math.round(train.x);
    const cy = Math.round(train.y);
    const chugBob = isStaticProp ? 0 : (Math.sin(timeSec * 12) > 0 ? 0 : -1);
    const dir = train.facing === 1 ? 1 : -1; // Default sprite faces left (-1); flip when heading right (+1)

    ctx.save();
    // Little animated white pixel steam puffs rising from the wooden engine chimney (only while running!)
    if (!isStaticProp) {
      for (let p = 0; p < 3; p++) {
        const cyc = ((timeSec * 2.2 + p * 0.33) % 1);
        const puffX = cx + (dir > 0 ? 17 : -17) - dir * Math.round(cyc * 9);
        const puffY = cy - 13 - Math.round(cyc * 12);
        ctx.fillStyle = `rgba(245, 248, 255, ${(0.65 * (1 - cyc)).toFixed(2)})`;
        ctx.fillRect(puffX, puffY, cyc < 0.5 ? 2 : 3, 2);
      }
    }
    if (dir > 0) {
      ctx.translate(cx * 2, 0);
      ctx.scale(-1, 1);
    }
    // Ground contact shadow beneath train
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(cx - 24, cy + 2, 48, 5);

    // Subtle red pull-string curling at front left (matching image_98e60c.png!)
    ctx.strokeStyle = "#d93232";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 23, cy + 1);
    ctx.quadraticCurveTo(cx - 30, cy + 5, cx - 26, cy + 7);
    ctx.stroke();

    // --- 1. FRONT WOODEN ENGINE (left side: cx - 23 .. cx - 4) ---
    px(ctx, cx - 23, cy - 4 + chugBob, 19, 5, "#2b1a0e");
    px(ctx, cx - 22, cy - 3 + chugBob, 17, 3, "#e0bc80"); // Natural pale oak base
    // Blue wooden front boiler hood
    px(ctx, cx - 21, cy - 9 + chugBob, 9, 6, "#164682");
    px(ctx, cx - 20, cy - 8 + chugBob, 7, 4, "#2975d9");
    px(ctx, cx - 19, cy - 8 + chugBob, 5, 1, "#6eb0ff");
    px(ctx, cx - 18, cy - 11 + chugBob, 3, 2, "#e0bc80"); // Wooden chimney peg
    // Yellow wooden cab + Red flat roof
    px(ctx, cx - 12, cy - 11 + chugBob, 7, 8, "#a67c14");
    px(ctx, cx - 11, cy - 10 + chugBob, 5, 6, "#f2c938");
    px(ctx, cx - 9,  cy - 8 + chugBob,  2, 2, "#3b2615"); // Round wooden window hole
    px(ctx, cx - 13, cy - 13 + chugBob, 9, 3, "#8a161e");
    px(ctx, cx - 12, cy - 12 + chugBob, 7, 2, "#e02b37");
    // Red wooden wheels (engine)
    px(ctx, cx - 20, cy + chugBob, 4, 4, "#9e171f");
    px(ctx, cx - 19, cy + 1 + chugBob, 2, 2, "#f03a47");
    px(ctx, cx - 10, cy + chugBob, 4, 4, "#9e171f");
    px(ctx, cx - 9,  cy + 1 + chugBob, 2, 2, "#f03a47");

    // Coupling peg linking engine to shape-sorter car
    px(ctx, cx - 4, cy - 2 + chugBob, 3, 1, "#8f6538");

    // --- 2. SHAPE-SORTER CARGO CAR (right side: cx - 1 .. cx + 23) ---
    px(ctx, cx - 1, cy - 4, 24, 5, "#2b1a0e");
    px(ctx, cx,     cy - 3, 22, 3, "#e0bc80"); // Natural oak flatbed
    // Wooden display cradle / compartment showing the REQUIRED SHAPE clearly!
    px(ctx, cx + 1, cy - 14, 12, 11, "#2b1a0e");
    px(ctx, cx + 2, cy - 13, 10, 9,  "#1a1412");
    if (reqShapeId) {
      drawShapeBlock(ctx, cx + 7, cy - 9, reqShapeId, 1);
    }

    // Second peg on rear of car showing stacked completed shapes!
    px(ctx, cx + 17, cy - 13, 2, 10, "#c79e61");
    (placedShapes || []).forEach((shId, idx) => {
      const sd = getShapeDef(shId);
      px(ctx, cx + 14, cy - 6 - idx * 2, 8, 2, sd.color);
    });

    // Red wooden wheels (cargo car)
    px(ctx, cx + 2,  cy, 4, 4, "#9e171f");
    px(ctx, cx + 3,  cy + 1, 2, 2, "#f03a47");
    px(ctx, cx + 16, cy, 4, 4, "#9e171f");
    px(ctx, cx + 17, cy + 1, 2, 2, "#f03a47");

    ctx.restore();
  }

  function getDiningAndNeighborRoomKeys(roomMap) {
    const keys = getEventRoomKeys(roomMap);
    const near = keys.filter((k) => {
      const r = roomMap[k];
      return Math.abs(r.x) + Math.abs(r.y) <= 1; // Dining Room (0,0) + non-Cellar surrounding rooms!
    });
    return near.length ? near : ["0,0"];
  }

  function pickShapeSpawnSpots(roomMap) {
    const allKeys = getEventRoomKeys(roomMap);
    const nearKeys = getDiningAndNeighborRoomKeys(roomMap);
    const diningSpots = [
      { x: 42,  y: 94  },
      { x: 166, y: 94  },
      { x: 42,  y: 172 },
      { x: 164, y: 172 },
      { x: 104, y: 72  },
      { x: 104, y: 178 }
    ];
    let dIdx = 0;

    // Shuffle 4 distinct shapes for the 4 turns!
    const order = SHAPE_DEFS.map((s) => s.id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // Spawn ABUNDANT shapes: 3 copies of EVERY shape type (12 shapes total!) spread across the whole map!
    const shapes = [];
    let uid = 0;
    const COPIES_PER_SHAPE = 3;

    for (let copy = 0; copy < COPIES_PER_SHAPE; copy++) {
      order.forEach((shapeId, idx) => {
        let rk;
        if (copy === 0) {
          // Copy 0: right in Dining Room & directly adjacent rooms for fast opening turn!
          rk = nearKeys[(idx + copy) % nearKeys.length] || "0,0";
        } else {
          // Copies 1 & 2: scattered broadly across ALL built rooms on the cabin map!
          rk = allKeys[(uid * 3 + copy) % allKeys.length] || "0,0";
        }

        let pt;
        if (rk === "0,0") {
          const base = diningSpots[dIdx % diningSpots.length];
          dIdx += 1;
          pt = {
            x: Math.max(26, Math.min(182, base.x + (Math.random() - 0.5) * 12)),
            y: Math.max(66, Math.min(182, base.y + (Math.random() - 0.5) * 10))
          };
        } else {
          const base = getSafeCenterForRoom(roomMap[rk]);
          pt = {
            x: Math.max(30, Math.min(178, base.x + (Math.random() - 0.5) * 28)),
            y: Math.max(70, Math.min(178, base.y + (Math.random() - 0.5) * 24))
          };
        }

        shapes.push({
          id: `toy_shape_${shapeId}_${uid++}`,
          shapeId,
          roomKey: rk,
          x: pt.x,
          y: pt.y,
          collected: false,
          heldByPlayerId: null,
          delivered: false
        });
      });
    }

    return { turnOrder: order, shapes };
  }

  function startFeelingSmallEvent(matchState) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "feeling_small");

    const savedLights = snapshotRoomLights(matchState);
    // Turn ALL non-Cellar built rooms' lights ON so they flicker together for 10 seconds!
    matchState.roomLightStates = {};
    getEventRoomKeys(matchState.roomMap).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    const { turnOrder, shapes } = pickShapeSpawnSpots(matchState.roomMap);

    // ALWAYS spawn the Toy Train inside THE DINING ROOM ("0,0") first so players spot it right away!
    const trainRoomKey = "0,0";
    const trainCenter = { x: 104, y: 174 };
    const FEELING_SMALL_TURN_SEC = 18.0;

    matchState.feelingSmallEvent = {
      active: true,
      stage: "FLICKER_INTRO", // FLICKER_INTRO (10s) -> PLAYING (4 turns x 18s) -> CHASE
      savedLights,
      introTimer: 10.0,
      turnDurationSec: FEELING_SMALL_TURN_SEC,
      turnOrder,
      turnIndex: 0,
      turnTimer: FEELING_SMALL_TURN_SEC,
      placedShapes: [],
      shapes,
      heldShape: null,
      puppet: {
        roomKey: "0,0",
        x: 104,
        y: 80, // Hanging menacingly above/behind the round table in The Dining Room!
        facing: 1,
        chasing: false
      },
      train: {
        spawned: false,
        roomKey: trainRoomKey,
        x: trainCenter.x,
        y: trainCenter.y,
        facing: 1,
        targetRoomKey: "0,0",
        targetX: 162,
        targetY: 170,
        retargetTimer: 2.2,
        pauseTimer: 1.6
      },
      notice: "A PUPPET HAS APPEARED IN THE DINING ROOM — LIGHTS FLICKERING (10s)!",
      noticeTimer: 5.5,
      syncAccum: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "FEELING SMALL?\nTHE PUPPET DESCENDS IN THE DINING ROOM...\nTHE TOY TRAIN SPAWNS IN THE DINING ROOM — INSERT EACH SHAPE WITHIN 18 SECONDS!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5400);
    }

    return matchState.feelingSmallEvent;
  }

  function syncToyTrainSpatialAudio(fs, matchState, player) {
    if (!App.Audio || !App.Audio.setToyTrainAttenuation) return;
    if (!fs || !fs.active || !fs.train || !fs.train.spawned) {
      if (App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
      return;
    }

    const trainRoom = (matchState.roomMap && matchState.roomMap[fs.train.roomKey]) || { x: 0, y: 0 };
    const pCoord = matchState.currentRoomCoord || { x: 0, y: 0 };
    const pGlobX = pCoord.x * 208 + player.x;
    const pGlobY = pCoord.y * 208 + player.y;
    const tGlobX = trainRoom.x * 208 + fs.train.x;
    const tGlobY = trainRoom.y * 208 + fs.train.y;

    const dist = Math.hypot(pGlobX - tGlobX, pGlobY - tGlobY);
    // Audible across rooms (~480px reach = ~2.3 rooms away), full volume right beside the train!
    const minDist = 22;
    const maxDist = 480;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const attenuation = Math.pow(1 - t, 1.45);

    if (App.Audio.startToyTrainLoop) App.Audio.startToyTrainLoop();
    App.Audio.setToyTrainAttenuation(attenuation);
  }

  function savePersistentFeelingSmallProps(matchState, fs) {
    if (!matchState || !fs) return;
    matchState.persistentEventProps = matchState.persistentEventProps || {};
    const remainingShapes = (fs.shapes || [])
      .filter((s) => !s.delivered && !s.collected)
      .map((s) => ({ roomKey: s.roomKey, x: s.x, y: s.y, shapeId: s.shapeId }));
    if (fs.heldShape && matchState.currentRoomCoord) {
      remainingShapes.push({
        roomKey: `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`,
        x: 104,
        y: 132,
        shapeId: fs.heldShape.shapeId
      });
    }
    matchState.persistentEventProps.feelingSmall = {
      train: fs.train
        ? {
            spawned: Boolean(fs.train.spawned),
            roomKey: fs.train.roomKey || "0,0",
            x: fs.train.x,
            y: fs.train.y,
            facing: fs.train.facing || 1
          }
        : null,
      placedShapes: (fs.placedShapes || []).slice(),
      shapes: remainingShapes
    };
  }

  function triggerFeelingSmallDeath(matchState) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs) return;

    if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "feeling_small", "ceiling_crawler", "THE PUPPET CAUGHT YOU!")
      : { keepEventRunning: false };

    if (!res.keepEventRunning) {
      // Keep the Toy Train (with stacked shapes) & remaining wooden shape blocks in the cabin!
      savePersistentFeelingSmallProps(matchState, fs);
      restoreRoomLights(matchState, fs.savedLights);
      fs.active = false;
      matchState.feelingSmallEvent = null;
    }
  }

  function executeFeelingSmallActionOnHost(matchState, actorPid, actorRoomKey, actorX, actorY, action, shapeItemId) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || fs.stage === "CHASE") return false;
    const isLocalActor = actorPid === getLocalPid();
    const curHeld = fs.shapes.find((s) => s.heldByPlayerId === actorPid && !s.delivered) || null;

    if (action === "pickup") {
      const sh = fs.shapes.find((s) => s.id === shapeItemId && !s.collected && !s.delivered);
      if (!sh) return false;
      if (curHeld) {
        curHeld.collected = false;
        curHeld.heldByPlayerId = null;
        curHeld.roomKey = actorRoomKey;
        curHeld.x = actorX;
        curHeld.y = actorY;
      }
      sh.collected = true;
      sh.heldByPlayerId = actorPid;
      if (isLocalActor) {
        fs.heldShape = { id: sh.id, shapeId: sh.shapeId };
        App.Audio.open();
      }
      const def = getShapeDef(sh.shapeId);
      fs.notice = `PICKED UP ${def.name}! BRING IT TO THE TOY TRAIN!`;
      fs.noticeTimer = 2.8;
      if (isMpMode(matchState)) broadcastStateNow(matchState);
      return true;
    }

    if (action === "drop") {
      if (!curHeld) return false;
      curHeld.collected = false;
      curHeld.heldByPlayerId = null;
      curHeld.roomKey = actorRoomKey;
      curHeld.x = actorX;
      curHeld.y = actorY;
      if (isLocalActor) {
        fs.heldShape = null;
        App.Audio.click();
      }
      if (isMpMode(matchState)) broadcastStateNow(matchState);
      return true;
    }

    if (action === "deliver") {
      const reqId = fs.turnOrder[fs.turnIndex];
      const reqDef = getShapeDef(reqId);
      if (!curHeld) {
        if (isLocalActor) {
          fs.notice = `THE TOY TRAIN NEEDS: ${reqDef.name}!`;
          fs.noticeTimer = 2.5;
          App.Audio.click();
        }
        return true;
      }
      if (curHeld.shapeId !== reqId) {
        if (isLocalActor) {
          const heldDef = getShapeDef(curHeld.shapeId);
          fs.notice = `WRONG SHAPE (${heldDef.short})! THE TRAIN NEEDS ${reqDef.name}!`;
          fs.noticeTimer = 2.8;
          App.Audio.close();
        }
        return true;
      }

      // MATCHING SHAPE INSERTED — advances turn & resets 18s timer for ALL players simultaneously!
      curHeld.delivered = true;
      curHeld.heldByPlayerId = null;
      if (isLocalActor) fs.heldShape = null;
      fs.placedShapes.push(reqId);
      fs.turnIndex += 1;

      const won = fs.turnIndex >= fs.turnOrder.length;
      if (App.Audio && App.Audio.shapeInsert) App.Audio.shapeInsert(won);

      if (won) {
        if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
        savePersistentFeelingSmallProps(matchState, fs);
        restoreRoomLights(matchState, fs.savedLights);
        fs.active = false;
        matchState.feelingSmallEvent = null;
        if (App.Events && App.Events.onEventWonBroadcast) {
          App.Events.onEventWonBroadcast(matchState, "feeling_small", "ALL 4 SHAPES DELIVERED!\nTHE PUPPET COLLAPSES — CELLAR DOOR UNLOCKED.");
        }
        if (App.Events && App.Events.showSmudgeBanner) {
          App.Events.showSmudgeBanner(
            "ALL 4 SHAPES DELIVERED!\nTHE PUPPET'S STRINGS SNAP AND IT COLLAPSES.",
            { success: true, typingDurationSec: 2.8, showChoices: false }
          );
          setTimeout(() => {
            if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
          }, 3600);
        }
        return true;
      }

      if (fs.train) fs.train.pauseTimer = 1.2;
      fs.turnTimer = fs.turnDurationSec || 18.0;
      const nextDef = getShapeDef(fs.turnOrder[fs.turnIndex]);
      fs.notice = `TURN ${fs.turnIndex + 1}/4: FIND & INSERT ${nextDef.name} (${Math.round(fs.turnTimer)}s)!`;
      fs.noticeTimer = 3.8;
      if (isMpMode(matchState)) broadcastStateNow(matchState);
      return true;
    }

    return false;
  }

  function handleFeelingSmallInteract(matchState, player, target) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || fs.stage === "CHASE") return false;
    const rk = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const pid = getLocalPid();

    if (target.type === "pickup_shape") {
      if (isMpGuest(matchState)) {
        App.Network.sendGameAction("MP_STALKER_ACTION", {
          kind: "feeling_small", action: "pickup", shapeItemId: target.shapeItemId,
          playerId: pid, roomKey: rk, x: player.x, y: player.y
        });
        App.Audio.open();
        return true;
      }
      return executeFeelingSmallActionOnHost(matchState, pid, rk, player.x, player.y, "pickup", target.shapeItemId);
    }

    if (target.type === "toy_train") {
      if (isMpGuest(matchState)) {
        App.Network.sendGameAction("MP_STALKER_ACTION", {
          kind: "feeling_small", action: "deliver",
          playerId: pid, roomKey: rk, x: player.x, y: player.y
        });
        return true;
      }
      return executeFeelingSmallActionOnHost(matchState, pid, rk, player.x, player.y, "deliver", null);
    }

    return false;
  }

  function handleFeelingSmallDrop(matchState, player) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || !fs.heldShape) return false;
    const rk = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const pid = getLocalPid();
    if (isMpGuest(matchState)) {
      App.Network.sendGameAction("MP_STALKER_ACTION", {
        kind: "feeling_small", action: "drop",
        playerId: pid, roomKey: rk, x: player.x + player.facing * 5, y: player.y
      });
      App.Audio.click();
      return true;
    }
    return executeFeelingSmallActionOnHost(matchState, pid, rk, player.x + player.facing * 5, player.y, "drop", null);
  }

  function updateFeelingSmall(dt, matchState, player) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active) return;

    if (fs.noticeTimer > 0) {
      fs.noticeTimer = Math.max(0, fs.noticeTimer - dt);
      if (fs.noticeTimer === 0) fs.notice = "";
    }

    // GUEST: never runs independent timers or Puppet CHASE transitions! Follows Host MP_STALKER_STATE 100%!
    if (isMpGuest(matchState)) {
      if (fs.train && fs.train.spawned) {
        syncToyTrainSpatialAudio(fs, matchState, player);
      }
      if (
        fs.stage === "CHASE" &&
        !(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState))
      ) {
        const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
        if (fs.puppet && fs.puppet.roomKey === pRoomKey && Math.hypot(fs.puppet.x - player.x, fs.puppet.y - player.y) <= 14.0) {
          triggerFeelingSmallDeath(matchState);
        }
      }
      return;
    }

    if (fs.stage === "FLICKER_INTRO") {
      fs.introTimer -= dt;
      if (fs.introTimer <= 0) {
        fs.stage = "PLAYING";
        fs.turnIndex = 0;
        fs.turnTimer = fs.turnDurationSec || 18.0;
        fs.train.spawned = true;
        const reqDef = getShapeDef(fs.turnOrder[0]);
        const tRoomName = (matchState.roomMap && matchState.roomMap[fs.train.roomKey]?.fullName) || "THE DINING ROOM";
        fs.notice = `TOY TRAIN SPAWNED IN ${tRoomName}! TURN 1/4: INSERT ${reqDef.name} IN ${Math.round(fs.turnTimer)}s!`;
        fs.noticeTimer = 5.0;
        App.Audio.clockChime();
        syncToyTrainSpatialAudio(fs, matchState, player);
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        fs.syncAccum = (fs.syncAccum || 0) + dt;
        if (fs.syncAccum >= 0.25) { fs.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    const living = (App.Events && App.Events.getAllLivingPlayers)
      ? App.Events.getAllLivingPlayers(matchState, player)
      : [{ isLocal: true, roomKey: `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`, x: player.x, y: player.y }];

    if (fs.train.spawned) {
      const tr = fs.train;
      const nearAny = living.some((lp) => tr.roomKey === lp.roomKey && Math.hypot(tr.x - lp.x, tr.y - lp.y) <= 28);

      if (tr.pauseTimer > 0) {
        tr.pauseTimer = Math.max(0, tr.pauseTimer - dt);
      } else {
        const trainSpeed = nearAny ? 12 : 34;
        tr.retargetTimer -= dt;
        const arrived = moveEntityAcrossCabin(
          tr,
          tr.targetRoomKey,
          tr.targetX,
          tr.targetY,
          trainSpeed,
          dt,
          matchState.roomMap
        );
        if (arrived || tr.retargetTimer <= 0) {
          const allKeys = getEventRoomKeys(matchState.roomMap);
          const otherKeys = allKeys.filter((k) => k !== tr.roomKey);
          const pool = otherKeys.length ? otherKeys : allKeys;
          const nextK = pool[Math.floor(Math.random() * pool.length)] || "0,0";
          const nextPt = nextK === "0,0"
            ? [{ x: 44, y: 102 }, { x: 164, y: 102 }, { x: 44, y: 170 }, { x: 164, y: 170 }][Math.floor(Math.random() * 4)]
            : getSafeCenterForRoom(matchState.roomMap[nextK]);
          tr.targetRoomKey = nextK;
          tr.targetX = nextPt.x;
          tr.targetY = nextPt.y;
          tr.retargetTimer = 7.5;
        }
      }
      syncToyTrainSpatialAudio(fs, matchState, player);
    }

    if (fs.stage === "PLAYING") {
      fs.turnTimer -= dt;
      if (fs.turnTimer <= 0) {
        fs.stage = "CHASE";
        fs.puppet.chasing = true;
        App.Audio.hexAlert();
        fs.notice = "TIME'S UP! THE PUPPET IS COMING FOR YOU!";
        fs.noticeTimer = 6.0;
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        fs.syncAccum = (fs.syncAccum || 0) + dt;
        if (fs.syncAccum >= 0.085) { fs.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    if (fs.stage === "CHASE") {
      // Chase nearest living player across the cabin!
      let target = null;
      let bestD = Infinity;
      living.forEach((lp) => {
        const d = getRoomGlobalDist(matchState.roomMap, fs.puppet.roomKey, fs.puppet.x, fs.puppet.y, lp.roomKey, lp.x, lp.y);
        if (d < bestD) { bestD = d; target = lp; }
      });
      if (target) {
        moveEntityAcrossCabin(fs.puppet, target.roomKey, target.x, target.y, 98, dt, matchState.roomMap);
      }
      if (isMpMode(matchState)) {
        fs.syncAccum = (fs.syncAccum || 0) + dt;
        if (fs.syncAccum >= 0.085) { fs.syncAccum = 0; broadcastStateNow(matchState); }
      }
      const localLocked = Boolean(App.Events && App.Events.isLocalLockedInCellar && App.Events.isLocalLockedInCellar(matchState));
      living.forEach((lp) => {
        if (fs.puppet.roomKey !== lp.roomKey || Math.hypot(fs.puppet.x - lp.x, fs.puppet.y - lp.y) > 15.0) return;
        if (lp.isLocal) {
          if (!localLocked) triggerFeelingSmallDeath(matchState);
        } else if (App.Events && App.Events.hostKillRemotePlayer) {
          App.Events.hostKillRemotePlayer(matchState, lp.playerId, "feeling_small", "ceiling_crawler", "THE PUPPET CAUGHT YOU!");
        }
      });
    }
  }

  function getGlobalFlickerMultiplier(matchState, timeSec) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || fs.stage !== "FLICKER_INTRO") return 1.0;
    // Dramatic 10-second all-room flickering right before Feeling Small? begins!
    const v = Math.sin(timeSec * 31) * Math.cos(timeSec * 17);
    if (v < -0.35) return 0.16;
    if (v < 0.05) return 0.48;
    return 1.0;
  }

  // ==================== 4. SHARED RENDERING, PROMPTS & LIFECYCLE ====================
  function update(dt, matchState, player) {
    updateTallMan(dt, matchState, player);
    updateRedBalloons(dt, matchState, player);
    updateFeelingSmall(dt, matchState, player);
  }

  function getRoomRenderables(ctx, roomKey, timeSec, matchState) {
    const list = [];

    const tm = matchState && matchState.tallManEvent;
    if (tm && tm.active && !tm.restoringLights && tm.monster && tm.monster.roomKey === roomKey) {
      const m = tm.monster;
      list.push({
        y: m.y,
        draw: () => drawTallManSprite(ctx, m.x, m.y, timeSec, m.facing, m.state === "CHASE")
      });
    }

    const rb = matchState && matchState.redBalloonsEvent;
    if (rb && rb.active) {
      rb.balloons.forEach((b) => {
        if (b.popped || b.roomKey !== roomKey) return;
        list.push({
          y: b.y,
          draw: () => drawBalloonSprite(ctx, b, timeSec)
        });
      });

      if (rb.clown && rb.clown.spawned && rb.clown.roomKey === roomKey) {
        const cl = rb.clown;
        list.push({
          y: cl.y,
          draw: () => drawClownBoxSprite(ctx, cl.x, cl.y, timeSec, cl.facing, cl.state === "INVESTIGATE")
        });
      }
    }

    const fs = matchState && matchState.feelingSmallEvent;
    if (fs && fs.active) {
      // Puppet entity
      if (fs.puppet && fs.puppet.roomKey === roomKey) {
        const p = fs.puppet;
        list.push({
          y: p.y,
          draw: () => drawPuppetSprite(ctx, p.x, p.y, timeSec, p.facing, p.chasing)
        });
      }
      // Toy Train entity (once spawned after 10s flicker intro)
      if (fs.train && fs.train.spawned && fs.train.roomKey === roomKey) {
        const reqId = fs.turnOrder[fs.turnIndex];
        list.push({
          y: fs.train.y,
          draw: () => drawToyTrainSprite(ctx, fs.train, reqId, fs.placedShapes, timeSec)
        });
      }
      // Scattered wooden shape blocks on the floor
      fs.shapes.forEach((sh) => {
        if (sh.collected || sh.delivered || sh.roomKey !== roomKey) return;
        list.push({
          y: sh.y,
          draw: () => {
            ctx.fillStyle = "rgba(0,0,0,0.42)";
            ctx.fillRect(Math.round(sh.x - 4), Math.round(sh.y + 2), 8, 3);
            drawShapeBlock(ctx, sh.x, sh.y - 2 + Math.sin(timeSec * 3.8) * 1.1, sh.shapeId, 1);
          }
        });
      });
    } else {
      // Persistent Toy Train & scattered wooden shape blocks left behind after Feeling Small? ends!
      const pfs = matchState && matchState.persistentEventProps && matchState.persistentEventProps.feelingSmall;
      if (pfs) {
        if (pfs.train && pfs.train.spawned && pfs.train.roomKey === roomKey) {
          list.push({
            y: pfs.train.y,
            draw: () => drawToyTrainSprite(ctx, pfs.train, null, pfs.placedShapes, timeSec, true)
          });
        }
        (pfs.shapes || []).forEach((sh) => {
          if (sh.roomKey !== roomKey) return;
          list.push({
            y: sh.y,
            draw: () => {
              ctx.fillStyle = "rgba(0,0,0,0.40)";
              ctx.fillRect(Math.round(sh.x - 4), Math.round(sh.y + 2), 8, 3);
              drawShapeBlock(ctx, sh.x, sh.y - 1, sh.shapeId, 1);
            }
          });
        });
      }
    }

    return list;
  }

  function renderRoomHighlights(ctx, roomKey, timeSec, matchState, player) {
    // 1. Red & Golden Balloons subtle glint & pop burst particles + sound waves (post-darkness!)
    const rb = matchState && matchState.redBalloonsEvent;
    if (rb && rb.active) {
      const pulse = 0.65 + Math.sin(timeSec * 5.0) * 0.35;
      rb.balloons.forEach((b) => {
        if (b.popped || b.roomKey !== roomKey) return;
        const d = player ? Math.hypot(player.x - b.x, player.y - b.y) : 999;
        // Balloon glints gently inside/near lantern reach (Golden Balloon shimmers even further!)
        const maxVis = b.isGold ? 110 : (player && player.lanternOn ? 78 : 34);
        if (d > maxVis) return;
        const prox = 1 - Math.max(0, (d - 20) / Math.max(1, maxVis - 20));
        const gx = b.x;
        const gy = b.y - 16;
        const rad = b.isGold ? 24 : 18;
        const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, rad);
        g.addColorStop(
          0,
          b.isGold
            ? `rgba(255, 224, 102, ${(0.52 * prox * pulse).toFixed(3)})`
            : `rgba(255, 76, 86, ${(0.36 * prox * pulse).toFixed(3)})`
        );
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
      });

      // Pop particle bursts
      rb.popBursts.forEach((pb) => {
        if (pb.roomKey !== roomKey) return;
        const frac = pb.age / pb.maxAge;
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const dist = 4 + frac * 18;
          const fx = Math.round(pb.x + Math.cos(ang) * dist);
          const fy = Math.round(pb.y + Math.sin(ang) * dist);
          ctx.fillStyle = pb.isGold ? "#ffe47a" : "#ff4d5a";
          ctx.globalAlpha = Math.max(0, 1 - frac);
          ctx.fillRect(fx, fy, 2, 2);
        }
        ctx.globalAlpha = 1;
      });

      // Sound ripple rings attracting the Clown
      rb.soundPings.forEach((sp) => {
        if (sp.roomKey !== roomKey) return;
        const frac = sp.age / sp.maxAge;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 196, 120, ${(0.68 * (1 - frac)).toFixed(2)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4 + frac * 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // Faint ominous glint on Clown Box's red eyes when nearby in the dark
      if (rb.clown && rb.clown.spawned && rb.clown.roomKey === roomKey) {
        const cx = Math.round(rb.clown.x);
        const cy = Math.round(rb.clown.y - 22);
        ctx.fillStyle = "#ff4545";
        ctx.fillRect(cx - 2, cy, 1, 1);
        ctx.fillRect(cx + 1, cy, 1, 1);
      }
    }

    // 2. Feeling Small?: Subtle bright shimmer on scattered shapes, Toy Train compartment & held shape!
    const fs = matchState && matchState.feelingSmallEvent;
    if (fs && fs.active) {
      const pulse = 0.65 + Math.sin(timeSec * 5.2) * 0.35;
      fs.shapes.forEach((sh) => {
        if (sh.collected || sh.delivered || sh.roomKey !== roomKey) return;
        const g = ctx.createRadialGradient(sh.x, sh.y - 2, 1, sh.x, sh.y - 2, 14);
        g.addColorStop(0, `rgba(255, 245, 200, ${(0.34 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(sh.x - 14, sh.y - 16, 28, 28);
      });

      if (fs.train && fs.train.spawned && fs.train.roomKey === roomKey) {
        const g = ctx.createRadialGradient(fs.train.x, fs.train.y - 6, 2, fs.train.x, fs.train.y - 6, 30);
        g.addColorStop(0, `rgba(255, 232, 150, ${(0.28 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(fs.train.x - 30, fs.train.y - 36, 60, 60);
      }

      // Draw held wooden shape block right next to the local (or spectated) player AND all teammates in this room!
      if (player) {
        if (player.spectatePlayerId) {
          const specHeld = fs.shapes.find((s) => s.heldByPlayerId === player.spectatePlayerId && !s.delivered);
          if (specHeld) {
            drawShapeBlock(ctx, player.x - (player.facing || 1) * 8, player.y - 10, specHeld.shapeId, 0.9);
          }
        } else if (fs.heldShape) {
          drawShapeBlock(ctx, player.x - (player.facing || 1) * 8, player.y - 10, fs.heldShape.shapeId, 0.9);
        }
      }
      if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch() && App.Network.getRemotePlayersInRoom) {
        const parts = String(roomKey || "0,0").split(",");
        const rX = Number(parts[0]) || 0;
        const rY = Number(parts[1]) || 0;
        App.Network.getRemotePlayersInRoom(rX, rY).forEach((rp) => {
          if (!rp || rp.deadInEvent || rp.deadSpectator || rp.inAttic || rp.inBasement) return;
          if (player && player.spectatePlayerId && rp.playerId === player.spectatePlayerId) return;
          const rHeld = fs.shapes.find((s) => s.heldByPlayerId === rp.playerId && !s.delivered);
          if (rHeld) {
            drawShapeBlock(ctx, rp.x - (rp.facing || 1) * 8, rp.y - 10, rHeld.shapeId, 0.9);
          }
        });
      }
    }
  }

  function getRoomInteractable(roomKey, matchState, player) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (fs && fs.active && fs.stage !== "CHASE") {
      // 1. Check Toy Train interaction first when spawned in this room
      if (fs.train && fs.train.spawned && fs.train.roomKey === roomKey) {
        if (Math.hypot(player.x - fs.train.x, player.y - fs.train.y) <= 28) {
          const reqDef = getShapeDef(fs.turnOrder[fs.turnIndex]);
          const hasMatch = fs.heldShape && fs.heldShape.shapeId === reqDef.id;
          return {
            type: "toy_train",
            prompt: hasMatch
              ? `[E] INSERT ${reqDef.name} INTO TOY TRAIN (${fs.turnIndex + 1}/4)`
              : `[E] TOY TRAIN NEEDS: ${reqDef.name}`
          };
        }
      }
      // 2. Check scattered shapes in this room
      for (const sh of fs.shapes) {
        if (sh.collected || sh.delivered || sh.roomKey !== roomKey) continue;
        if (Math.hypot(player.x - sh.x, player.y - sh.y) <= 22) {
          const def = getShapeDef(sh.shapeId);
          return {
            type: "pickup_shape",
            shapeItemId: sh.id,
            prompt: `[E] PICK UP ${def.name}`
          };
        }
      }
    }

    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb || !rb.active) return null;
    for (const b of rb.balloons) {
      if (b.popped || b.roomKey !== roomKey) continue;
      if (Math.hypot(player.x - b.x, player.y - b.y) <= 24) {
        return {
          type: "pop_balloon",
          balloonId: b.id,
          prompt: b.isGold ? "[E] POP GOLDEN BALLOON!" : "[E] POP RED BALLOON"
        };
      }
    }
    return null;
  }

  function isTallManActive(matchState) {
    return Boolean(matchState && matchState.tallManEvent && matchState.tallManEvent.active);
  }

  function isRedBalloonsActive(matchState) {
    return Boolean(matchState && matchState.redBalloonsEvent && matchState.redBalloonsEvent.active);
  }

  function isFeelingSmallActive(matchState) {
    return Boolean(matchState && matchState.feelingSmallEvent && matchState.feelingSmallEvent.active);
  }

  function isAnyStalkerActive(matchState) {
    return isTallManActive(matchState) || isRedBalloonsActive(matchState) || isFeelingSmallActive(matchState);
  }

  function getHudSummary(matchState, player) {
    const tm = matchState && matchState.tallManEvent;
    if (tm && tm.active) {
      return {
        title: tm.restoringLights
          ? "THE TALL MAN BANISHED — RESTORING POWER..."
          : `THE TALL MAN • LIGHTS STILL ON: ${tm.litRemaining} / ${tm.totalSwitches}`,
        sub: player && player.lanternOn
          ? "LANTERN IS ON! PRESS [F] TO HIDE IN DARK ROOMS"
          : "FIND EVERY WALL LIGHT SWITCH [E] & TURN THEM OFF",
        notice: tm.notice || ""
      };
    }

    const rb = matchState && matchState.redBalloonsEvent;
    if (rb && rb.active) {
      const crouchTag = player && player.crouching ? "CROUCHING (SILENT)" : "STANDING (NOISY! PRESS [C])";
      return {
        title: rb.goldSpawned
          ? "RED BALLOONS • FIND & POP THE GOLDEN BALLOON [E]!"
          : `RED BALLOONS POPPED: ${rb.redPopped} / ${rb.redTotal}`,
        sub: `${crouchTag}  |  CLOWN: ${rb.clown.spawned ? "HUNTING SOUNDS!" : "DORMANT"}`,
        notice: rb.notice || ""
      };
    }

    const fs = matchState && matchState.feelingSmallEvent;
    if (fs && fs.active) {
      if (fs.stage === "FLICKER_INTRO") {
        return {
          title: `FEELING SMALL? • STARTING IN ${Math.max(1, Math.ceil(fs.introTimer))}S`,
          sub: "THE PUPPET HANGS IN THE DINING ROOM — LIGHTS FLICKERING...",
          notice: fs.notice || ""
        };
      }
      if (fs.stage === "CHASE") {
        return {
          title: "FEELING SMALL? • TIME EXPIRED!",
          sub: "THE PUPPET IS CHASING YOU!",
          notice: fs.notice || ""
        };
      }
      const reqDef = getShapeDef(fs.turnOrder[fs.turnIndex]);
      const heldTag = fs.heldShape ? `HOLDING: ${getShapeDef(fs.heldShape.shapeId).short} ([X] DROP)` : "HANDS EMPTY";
      return {
        title: `FEELING SMALL? • TURN ${fs.turnIndex + 1}/4 • NEED: ${reqDef.name} (${Math.max(0, Math.ceil(fs.turnTimer))}S)`,
        sub: `${heldTag}  |  FOLLOW THE TOY TRAIN SOUND`,
        notice: fs.notice || ""
      };
    }

    return null;
  }

  function broadcastStateNow(matchState) {
    if (!matchState || !isMpMode(matchState) || !isMpHost(matchState)) return;

    const tm = matchState.tallManEvent;
    if (tm && tm.active) {
      App.Network.sendGameAction("MP_STALKER_STATE", {
        kind: "tall_man",
        restoringLights: Boolean(tm.restoringLights),
        litRemaining: tm.litRemaining,
        totalSwitches: tm.totalSwitches,
        monster: {
          roomKey: tm.monster.roomKey,
          x: Math.round(tm.monster.x * 10) / 10,
          y: Math.round(tm.monster.y * 10) / 10,
          facing: tm.monster.facing,
          state: tm.monster.state
        },
        notice: tm.notice || "",
        noticeTimer: tm.noticeTimer || 0
      });
    }

    const rb = matchState.redBalloonsEvent;
    if (rb && rb.active) {
      App.Network.sendGameAction("MP_STALKER_STATE", {
        kind: "red_balloons",
        redTotal: rb.redTotal,
        redPopped: rb.redPopped,
        goldSpawned: Boolean(rb.goldSpawned),
        crouchGraceTimer: rb.crouchGraceTimer || 0,
        balloons: rb.balloons.map((b) => ({
          id: b.id, roomKey: b.roomKey, x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10,
          isGold: Boolean(b.isGold), popped: Boolean(b.popped), phase: b.phase || 0
        })),
        clown: {
          spawned: Boolean(rb.clown.spawned),
          roomKey: rb.clown.roomKey,
          x: Math.round(rb.clown.x * 10) / 10,
          y: Math.round(rb.clown.y * 10) / 10,
          facing: rb.clown.facing,
          state: rb.clown.state
        },
        notice: rb.notice || "",
        noticeTimer: rb.noticeTimer || 0
      });
    }

    const fs = matchState.feelingSmallEvent;
    if (fs && fs.active) {
      App.Network.sendGameAction("MP_STALKER_STATE", {
        kind: "feeling_small",
        stage: fs.stage,
        introTimer: Math.round((fs.introTimer || 0) * 10) / 10,
        turnOrder: fs.turnOrder.slice(),
        turnIndex: fs.turnIndex,
        turnTimer: Math.round((fs.turnTimer || 0) * 10) / 10,
        placedShapes: fs.placedShapes.slice(),
        shapes: fs.shapes.map((s) => ({
          id: s.id, shapeId: s.shapeId, roomKey: s.roomKey,
          x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10,
          collected: Boolean(s.collected), heldByPlayerId: s.heldByPlayerId || null, delivered: Boolean(s.delivered)
        })),
        puppet: {
          roomKey: fs.puppet.roomKey,
          x: Math.round(fs.puppet.x * 10) / 10,
          y: Math.round(fs.puppet.y * 10) / 10,
          facing: fs.puppet.facing,
          chasing: Boolean(fs.puppet.chasing)
        },
        train: {
          spawned: Boolean(fs.train.spawned),
          roomKey: fs.train.roomKey,
          x: Math.round(fs.train.x * 10) / 10,
          y: Math.round(fs.train.y * 10) / 10,
          facing: fs.train.facing
        },
        notice: fs.notice || "",
        noticeTimer: fs.noticeTimer || 0
      });
    }
  }

  function handleNetworkMessage(action, payload, matchState) {
    if (!matchState || !action) return false;
    const p = payload || {};

    // Host processes Guest interaction actions!
    if (action === "MP_STALKER_ACTION") {
      if (!isMpHost(matchState)) return true;
      if (p.kind === "red_balloons" && p.action === "pop") {
        popBalloon(matchState, p.balloonId, true);
        return true;
      }
      if (p.kind === "feeling_small") {
        executeFeelingSmallActionOnHost(matchState, p.playerId, p.roomKey || "0,0", p.x || 104, p.y || 126, p.action, p.shapeItemId);
        return true;
      }
      return true;
    }

    // Guest applies Host authoritative snapshots!
    if (action === "MP_STALKER_STATE") {
      if (!isMpGuest(matchState)) return true;

      if (p.kind === "tall_man") {
        if (!matchState.tallManEvent) startTallManEvent(matchState);
        const tm = matchState.tallManEvent;
        if (!tm) return true;
        tm.restoringLights = Boolean(p.restoringLights);
        tm.litRemaining = typeof p.litRemaining === "number" ? p.litRemaining : tm.litRemaining;
        tm.totalSwitches = typeof p.totalSwitches === "number" ? p.totalSwitches : tm.totalSwitches;
        if (p.monster) Object.assign(tm.monster, p.monster);
        if (p.notice) { tm.notice = p.notice; tm.noticeTimer = p.noticeTimer || 2.5; }
        return true;
      }

      if (p.kind === "red_balloons") {
        if (!matchState.redBalloonsEvent) startRedBalloonsEvent(matchState);
        const rb = matchState.redBalloonsEvent;
        if (!rb) return true;
        const prevPoppedIds = new Set(rb.balloons.filter((b) => b.popped).map((b) => b.id));
        const wasGold = rb.goldSpawned;
        const wasClown = rb.clown.spawned;
        rb.redTotal = p.redTotal;
        rb.redPopped = p.redPopped;
        rb.goldSpawned = Boolean(p.goldSpawned);
        rb.crouchGraceTimer = p.crouchGraceTimer || 0;
        if (Array.isArray(p.balloons)) {
          p.balloons.forEach((nb) => {
            if (nb.popped && !prevPoppedIds.has(nb.id)) {
              if (App.Audio && App.Audio.balloonPop) App.Audio.balloonPop(nb.isGold);
              rb.popBursts.push({ roomKey: nb.roomKey, x: nb.x, y: nb.y - 16, isGold: nb.isGold, age: 0, maxAge: 0.48 });
            }
          });
          rb.balloons = p.balloons.map((b) => Object.assign({}, b));
        }
        if (rb.goldSpawned && !wasGold) App.Audio.clockChime();
        if (p.clown) {
          Object.assign(rb.clown, p.clown);
          if (rb.clown.spawned && !wasClown) App.Audio.hexAlert();
        }
        if (p.notice) { rb.notice = p.notice; rb.noticeTimer = p.noticeTimer || 2.5; }
        return true;
      }

      if (p.kind === "feeling_small") {
        if (!matchState.feelingSmallEvent) startFeelingSmallEvent(matchState);
        const fs = matchState.feelingSmallEvent;
        if (!fs) return true;
        const prevStage = fs.stage;
        const prevTurn = fs.turnIndex;
        fs.stage = p.stage;
        fs.introTimer = p.introTimer;
        if (Array.isArray(p.turnOrder)) fs.turnOrder = p.turnOrder.slice();
        fs.turnIndex = p.turnIndex;
        fs.turnTimer = p.turnTimer;
        if (Array.isArray(p.placedShapes)) fs.placedShapes = p.placedShapes.slice();
        if (Array.isArray(p.shapes)) {
          fs.shapes = p.shapes.map((s) => Object.assign({}, s));
          const mine = fs.shapes.find((s) => s.heldByPlayerId === getLocalPid() && !s.delivered);
          fs.heldShape = mine ? { id: mine.id, shapeId: mine.shapeId } : null;
        }
        if (p.puppet) Object.assign(fs.puppet, p.puppet);
        if (p.train) Object.assign(fs.train, p.train);
        if (p.notice) { fs.notice = p.notice; fs.noticeTimer = p.noticeTimer || 2.5; }
        if (prevStage === "FLICKER_INTRO" && fs.stage === "PLAYING") App.Audio.clockChime();
        if (prevStage !== "CHASE" && fs.stage === "CHASE") App.Audio.hexAlert();
        if (fs.turnIndex > prevTurn && App.Audio && App.Audio.shapeInsert) App.Audio.shapeInsert(false);
        return true;
      }
    }
    return false;
  }

  function cleanup(matchState) {
    if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();
    if (App.Audio && App.Audio.stopBalloonsSfxLoop) App.Audio.stopBalloonsSfxLoop();
    if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
    if (matchState) {
      if (matchState.feelingSmallEvent) savePersistentFeelingSmallProps(matchState, matchState.feelingSmallEvent);
      matchState.tallManEvent = null;
      matchState.redBalloonsEvent = null;
      matchState.feelingSmallEvent = null;
    }
  }

  App.Stalkers = {
    startTallManEvent,
    onLightSwitchToggled,
    startRedBalloonsEvent,
    popBalloon,
    startFeelingSmallEvent,
    handleFeelingSmallInteract,
    handleFeelingSmallDrop,
    getGlobalFlickerMultiplier,
    update,
    getRoomRenderables,
    renderRoomHighlights,
    getRoomInteractable,
    isTallManActive,
    isRedBalloonsActive,
    isFeelingSmallActive,
    isAnyStalkerActive,
    getHudSummary,
    broadcastStateNow,
    handleNetworkMessage,
    cleanup
  };
})(window.Duskwood);
