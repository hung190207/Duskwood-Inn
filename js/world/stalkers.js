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
        if (!nb || !nb.doors || !nb.doors[d.opp]) continue;
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
    const keys = Object.keys(roomMap || {});
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

    const savedLights = snapshotRoomLights(matchState);
    // Turn ALL built rooms' light switches ON (including Main Parlor / Dining Room!)
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
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
      totalSwitches: Object.keys(matchState.roomMap || {}).length,
      litRemaining: Object.keys(matchState.roomMap || {}).length,
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
      noticeTimer: 5.5
    };

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
    Object.keys(matchState.roomMap || {}).forEach((k) => {
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

    const flash = document.getElementById("tallman-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 820);
    }

    App.Audio.hexAlert();
    restoreRoomLights(matchState, tm.savedLights);
    matchState.archFlickerLight = 1.0;
    matchState.tallManEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE TALL MAN FOUND YOU IN THE LIGHT!\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
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
      }
      return;
    }

    tm.litRemaining = countRemainingLitRooms(matchState);
    if (tm.litRemaining <= 0) {
      onLightSwitchToggled(matchState);
      return;
    }

    const m = tm.monster;
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const roomIsLit = Boolean(matchState.roomLightStates && matchState.roomLightStates[pRoomKey] === true);
    const playerVisibleInLight = roomIsLit || Boolean(player.lanternOn);

    if (playerVisibleInLight) {
      if (m.state !== "CHASE") {
        m.state = "CHASE";
        tm.notice = roomIsLit
          ? "HE SEES YOU IN THE LIT ROOM! TURN OFF THE SWITCH OR RUN!"
          : "HE SEES YOUR LANTERN! PRESS [F] TO HIDE IN THE DARK!";
        tm.noticeTimer = 2.8;
      }
      // Moderate chase speed (41 px/s — threatening but slower than player's 54 walk / 88 sprint!)
      moveEntityAcrossCabin(m, pRoomKey, player.x, player.y, 41, dt, matchState.roomMap);

      // Can ONLY catch player when player is in light or holding lit lantern!
      if (m.roomKey === pRoomKey && Math.hypot(m.x - player.x, m.y - player.y) <= 13.5) {
        triggerTallManDeath(matchState);
      }
    } else {
      // Player is hidden in darkness (room light OFF & lantern OFF) -> Tall Man loses sight & patrols lit rooms!
      if (m.state === "CHASE") {
        m.state = "PATROL";
        m.retargetTimer = 0.2;
        tm.notice = "YOU ARE HIDDEN IN THE DARK — HE CANNOT SEE YOU.";
        tm.noticeTimer = 2.4;
      }

      m.retargetTimer -= dt;
      const arrived = moveEntityAcrossCabin(m, m.patrolRoomKey, m.patrolX, m.patrolY, 27, dt, matchState.roomMap);
      if (arrived || m.retargetTimer <= 0) {
        const litKeys = Object.keys(matchState.roomMap || {}).filter(
          (k) => matchState.roomLightStates && matchState.roomLightStates[k] === true
        );
        const pool = litKeys.length ? litKeys : Object.keys(matchState.roomMap || {});
        const nextK = pool[Math.floor(Math.random() * pool.length)] || "0,0";
        const pt = getSafeCenterForRoom(matchState.roomMap[nextK]);
        m.patrolRoomKey = nextK;
        m.patrolX = pt.x;
        m.patrolY = pt.y;
        m.retargetTimer = 4.5 + Math.random() * 3.0;
      }
    }
  }

  // ==================== 3. RED BALLOONS EVENT ENGINE ====================
  function spawnBalloonsAcrossRooms(roomMap) {
    const keys = Object.keys(roomMap || {});
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
      noticeTimer: 5.5
    };

    // Start clown_laugh.mp3 looping 0.0s -> 9.0s from event start until event end!
    if (App.Audio && App.Audio.playClownLaughLoop) {
      App.Audio.playClownLaughLoop();
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

  function popBalloon(matchState, balloonId) {
    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb || !rb.active) return false;
    const b = rb.balloons.find((x) => x.id === balloonId && !x.popped);
    if (!b) return false;

    b.popped = true;
    if (App.Audio && App.Audio.balloonPop) App.Audio.balloonPop(b.isGold);
    rb.popBursts.push({ roomKey: b.roomKey, x: b.x, y: b.y - 16, isGold: b.isGold, age: 0, maxAge: 0.48 });

    // GOLDEN BALLOON POPPED -> PLAYER WINS!
    if (b.isGold) {
      if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();
      restoreRoomLights(matchState, rb.savedLights);
      rb.active = false;
      matchState.redBalloonsEvent = null;

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

    return true;
  }

  function triggerRedBalloonsDeath(matchState) {
    const rb = matchState && matchState.redBalloonsEvent;
    if (!rb) return;

    if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();

    const flash = document.getElementById("clown-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 840);
    }

    App.Audio.hexAlert();
    restoreRoomLights(matchState, rb.savedLights);
    rb.active = false;
    matchState.redBalloonsEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE JACK-IN-THE-BOX CAUGHT YOU!\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
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

    // Grace period at event start so player can hit [C] to Crouch
    if (rb.crouchGraceTimer > 0) {
      rb.crouchGraceTimer = Math.max(0, rb.crouchGraceTimer - dt);
    }

    // Monster Spawn Trigger: spawns whenever any player is NOT crouching (after grace OR moving uncrouched)!
    const isNotCrouching = !player.crouching;
    if (!rb.clown.spawned && isNotCrouching && (rb.crouchGraceTimer <= 0 || player.moving)) {
      spawnJackInTheBoxClown(rb, matchState, pRoomKey, player.x, player.y);
    }

    if (!rb.clown.spawned) return;

    const cl = rb.clown;
    if (cl.noiseCooldown > 0) cl.noiseCooldown = Math.max(0, cl.noiseCooldown - dt);

    // Standing / walking / sprinting without Crouch emits noise that attracts the Clown!
    if (isNotCrouching && cl.noiseCooldown <= 0 && (player.moving || cl.roomKey === pRoomKey)) {
      alertClownToSound(rb, pRoomKey, player.x, player.y, null);
      cl.noiseCooldown = 0.55;
    }

    const speed = cl.state === "INVESTIGATE" ? 44 : 26;
    const arrived = moveEntityAcrossCabin(cl, cl.targetRoomKey, cl.targetX, cl.targetY, speed, dt, matchState.roomMap);

    cl.retargetTimer -= dt;
    if (arrived || cl.retargetTimer <= 0) {
      // Pick a random room to patrol quietly until the next sound!
      cl.state = "PATROL";
      const allKeys = Object.keys(matchState.roomMap || {});
      const nextK = allKeys[Math.floor(Math.random() * allKeys.length)] || "0,0";
      const pt = getSafeCenterForRoom(matchState.roomMap[nextK]);
      cl.targetRoomKey = nextK;
      cl.targetX = pt.x;
      cl.targetY = pt.y;
      cl.retargetTimer = 5.0 + Math.random() * 3.0;
    }

    // Lethal Contact Check
    if (cl.roomKey === pRoomKey && Math.hypot(cl.x - player.x, cl.y - player.y) <= 13.0) {
      triggerRedBalloonsDeath(matchState);
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
  function drawToyTrainSprite(ctx, train, reqShapeId, placedShapes, timeSec) {
    const cx = Math.round(train.x);
    const cy = Math.round(train.y);
    const chugBob = Math.sin(timeSec * 12) > 0 ? 0 : -1;
    const dir = train.facing === 1 ? 1 : -1; // Default sprite faces left (-1); flip when heading right (+1)

    ctx.save();
    // Little animated white pixel steam puffs rising from the wooden engine chimney!
    for (let p = 0; p < 3; p++) {
      const cyc = ((timeSec * 2.2 + p * 0.33) % 1);
      const puffX = cx + (dir > 0 ? 17 : -17) - dir * Math.round(cyc * 9);
      const puffY = cy - 13 - Math.round(cyc * 12);
      ctx.fillStyle = `rgba(245, 248, 255, ${(0.65 * (1 - cyc)).toFixed(2)})`;
      ctx.fillRect(puffX, puffY, cyc < 0.5 ? 2 : 3, 2);
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
    const keys = Object.keys(roomMap || {});
    const near = keys.filter((k) => {
      const r = roomMap[k];
      return Math.abs(r.x) + Math.abs(r.y) <= 1; // Dining Room (0,0) + all directly surrounding rooms!
    });
    return near.length ? near : ["0,0"];
  }

  function pickShapeSpawnSpots(roomMap) {
    const allKeys = Object.keys(roomMap || {});
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
          delivered: false
        });
      });
    }

    return { turnOrder: order, shapes };
  }

  function startFeelingSmallEvent(matchState) {
    if (!matchState) return null;

    const savedLights = snapshotRoomLights(matchState);
    // Turn ALL built rooms' lights ON so they all flicker together for 10 seconds!
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    const { turnOrder, shapes } = pickShapeSpawnSpots(matchState.roomMap);

    // Spawn the Toy Train in an adjacent room to Dining Room (or Dining Room if only 1 room)
    // so the player tracks its spatial `toy_train_sfx.mp3` across rooms!
    const nearKeys = getDiningAndNeighborRoomKeys(matchState.roomMap);
    const adjOnly = nearKeys.filter((k) => k !== "0,0");
    const trainRoomKey = adjOnly.length
      ? adjOnly[Math.floor(Math.random() * adjOnly.length)]
      : "0,0";
    const trainCenter = trainRoomKey === "0,0"
      ? { x: 104, y: 174 }
      : getSafeCenterForRoom(matchState.roomMap[trainRoomKey]);

    matchState.feelingSmallEvent = {
      active: true,
      stage: "FLICKER_INTRO", // FLICKER_INTRO (10s) -> PLAYING (4 turns x 10s) -> CHASE
      savedLights,
      introTimer: 10.0,
      turnOrder,
      turnIndex: 0,
      turnTimer: 10.0,
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
        targetX: 104,
        targetY: 170,
        retargetTimer: 0.4,
        pauseTimer: 0
      },
      notice: "A PUPPET HAS APPEARED IN THE DINING ROOM — LIGHTS FLICKERING (10s)!",
      noticeTimer: 5.5
    };

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "FEELING SMALL?\nTHE PUPPET DESCENDS IN THE DINING ROOM...\nLISTEN FOR THE TOY TRAIN & INSERT EACH SHAPE WITHIN 10 SECONDS!",
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

  function triggerFeelingSmallDeath(matchState) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs) return;

    if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();

    const flash = document.getElementById("puppet-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 840);
    }

    App.Audio.hexAlert();
    restoreRoomLights(matchState, fs.savedLights);
    fs.active = false;
    matchState.feelingSmallEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE PUPPET CAUGHT YOU!\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
    }
  }

  function handleFeelingSmallInteract(matchState, player, target) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || fs.stage === "CHASE") return false;

    if (target.type === "pickup_shape") {
      const sh = fs.shapes.find((s) => s.id === target.shapeItemId && !s.collected && !s.delivered);
      if (!sh) return false;
      // If player already holds a different shape, drop the old one right at their feet!
      if (fs.heldShape) {
        const old = fs.shapes.find((s) => s.id === fs.heldShape.id);
        if (old) {
          old.collected = false;
          old.roomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
          old.x = player.x;
          old.y = player.y;
        }
      }
      sh.collected = true;
      fs.heldShape = { id: sh.id, shapeId: sh.shapeId };
      App.Audio.open();
      const def = getShapeDef(sh.shapeId);
      fs.notice = `PICKED UP ${def.name}! BRING IT TO THE TOY TRAIN!`;
      fs.noticeTimer = 2.8;
      return true;
    }

    if (target.type === "toy_train") {
      const reqId = fs.turnOrder[fs.turnIndex];
      const reqDef = getShapeDef(reqId);

      if (!fs.heldShape) {
        fs.notice = `THE TOY TRAIN NEEDS: ${reqDef.name}!`;
        fs.noticeTimer = 2.5;
        App.Audio.click();
        return true;
      }

      if (fs.heldShape.shapeId !== reqId) {
        const heldDef = getShapeDef(fs.heldShape.shapeId);
        fs.notice = `WRONG SHAPE (${heldDef.short})! THE TRAIN NEEDS ${reqDef.name}!`;
        fs.noticeTimer = 2.8;
        App.Audio.close();
        return true;
      }

      // MATCHING SHAPE INSERTED!
      const shObj = fs.shapes.find((s) => s.id === fs.heldShape.id);
      if (shObj) shObj.delivered = true;
      fs.heldShape = null;
      fs.placedShapes.push(reqId);
      fs.turnIndex += 1;

      const won = fs.turnIndex >= fs.turnOrder.length;
      if (App.Audio && App.Audio.shapeInsert) App.Audio.shapeInsert(won);

      if (won) {
        // PLAYER WINS FEELING SMALL?!
        if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
        restoreRoomLights(matchState, fs.savedLights);
        fs.active = false;
        matchState.feelingSmallEvent = null;

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

      // Brief stop pause as train accepts the shape before chugging onward!
      if (fs.train) fs.train.pauseTimer = 1.0;
      // Next Turn (reset 10s countdown for the next shape!)
      fs.turnTimer = 10.0;
      const nextDef = getShapeDef(fs.turnOrder[fs.turnIndex]);
      fs.notice = `TURN ${fs.turnIndex + 1}/4: FIND & INSERT ${nextDef.name} (10s)!`;
      fs.noticeTimer = 3.8;
      return true;
    }

    return false;
  }

  function handleFeelingSmallDrop(matchState, player) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active || !fs.heldShape) return false;
    const old = fs.shapes.find((s) => s.id === fs.heldShape.id);
    if (old) {
      old.collected = false;
      old.roomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
      old.x = player.x + player.facing * 5;
      old.y = player.y;
    }
    fs.heldShape = null;
    App.Audio.click();
    return true;
  }

  function updateFeelingSmall(dt, matchState, player) {
    const fs = matchState && matchState.feelingSmallEvent;
    if (!fs || !fs.active) return;

    if (fs.noticeTimer > 0) {
      fs.noticeTimer = Math.max(0, fs.noticeTimer - dt);
      if (fs.noticeTimer === 0) fs.notice = "";
    }

    if (fs.stage === "FLICKER_INTRO") {
      fs.introTimer -= dt;
      if (fs.introTimer <= 0) {
        fs.stage = "PLAYING";
        fs.turnIndex = 0;
        fs.turnTimer = 10.0;
        fs.train.spawned = true;
        const reqDef = getShapeDef(fs.turnOrder[0]);
        const tRoomName = (matchState.roomMap && matchState.roomMap[fs.train.roomKey]?.fullName) || "THE CABIN";
        fs.notice = `TOY TRAIN SPAWNED (${tRoomName})! TURN 1/4: INSERT ${reqDef.name} IN 10s!`;
        fs.noticeTimer = 5.0;
        App.Audio.clockChime();
        syncToyTrainSpatialAudio(fs, matchState, player);
      }
      return;
    }

    // Toy Train actively roams ALL ACROSS the entire built cabin map via connected doorways!
    if (fs.train.spawned) {
      const tr = fs.train;
      const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
      const nearPlayer = tr.roomKey === pRoomKey && Math.hypot(tr.x - player.x, tr.y - player.y) <= 28;

      if (tr.pauseTimer > 0) {
        tr.pauseTimer = Math.max(0, tr.pauseTimer - dt);
      } else {
        // Gently slow down when player is right beside the train so pressing [E] is crisp & fair!
        const trainSpeed = nearPlayer ? 12 : 34;
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
          const allKeys = Object.keys(matchState.roomMap || {});
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
        // 10 seconds elapsed without inserting the shape -> THE PUPPET CHASES & KILLS THE PLAYER!
        fs.stage = "CHASE";
        fs.puppet.chasing = true;
        App.Audio.hexAlert();
        fs.notice = "TIME'S UP! THE PUPPET IS COMING FOR YOU!";
        fs.noticeTimer = 6.0;
      }
      return;
    }

    if (fs.stage === "CHASE") {
      const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
      // Relentless fast marionette chase across rooms (98 px/s > player sprint!)
      moveEntityAcrossCabin(fs.puppet, pRoomKey, player.x, player.y, 98, dt, matchState.roomMap);
      if (fs.puppet.roomKey === pRoomKey && Math.hypot(fs.puppet.x - player.x, fs.puppet.y - player.y) <= 14.0) {
        triggerFeelingSmallDeath(matchState);
      }
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

      // Draw held wooden shape block right next to the player so they always see what they carry!
      if (fs.heldShape && player) {
        drawShapeBlock(ctx, player.x - player.facing * 8, player.y - 10, fs.heldShape.shapeId, 0.9);
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

  function cleanup(matchState) {
    if (App.Audio && App.Audio.stopClownLaughLoop) App.Audio.stopClownLaughLoop();
    if (App.Audio && App.Audio.stopToyTrainLoop) App.Audio.stopToyTrainLoop();
    if (matchState) {
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
    cleanup
  };
})(window.Duskwood);
