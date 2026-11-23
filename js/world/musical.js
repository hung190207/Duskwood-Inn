/* ==========================================================================
   DUSKWOOD INN - MUSICAL ROOMS (`hx_musical_rooms`) Event Engine
   - Trigger: Spawns a Giant Monkey standing right beside a player in The Dining Room.
     All lights shut OFF leaving only a dim glow around the table to see the Monkey.
   - After 10 seconds: Lights flicker, Dining Room transforms:
       * Soft warm orange lighting pulsing/flickering slowly on a 3-second cycle
       * Central wooden round table transforms into an open Cardboard Box!
       * Plays `audio/music_rooms_sfx.mp3` (first 20 seconds of the 28s file)
       * Giant Monkey stands motionless in The Dining Room during the 20s
   - Gameplay:
       * Popcorns spawn scattered across Dining Room & cabin rooms
       * Tap [F] near popcorn to pick it up
       * Hold [F] to charge oblique parabolic throw power bar & trajectory arc
       * Release [F] to throw popcorn in a parabolic arc into the Cardboard Box
       * 10 popcorns scored in the Cardboard Box = WIN!
   - Failure (>20s without 10 popcorns):
       * Music stops! Giant Monkey chases & kills player across rooms
       * Plays `audio/monkey_sfx.mp3` (9s) spatially bound to the Giant Monkey!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const TARGET_POPCORNS = 10;
  const INTRO_DURATION = 10.0;
  const MUSIC_DURATION = 35.0;
  const BOX_X = 104;
  const BOX_Y = 126;

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

  // Offscreen Giant Monkey Sprite Buffer (34x42 — towering broad-shouldered horror cymbal monkey!)
  const monkeyBuf = document.createElement("canvas");
  monkeyBuf.width = 34;
  monkeyBuf.height = 42;
  const mctx = monkeyBuf.getContext("2d");
  mctx.imageSmoothingEnabled = false;

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

  function getSafeSpotsForRoom(room) {
    if (!room) return [{ x: 104, y: 126 }];
    if (room.id === "dining_room") {
      return [
        { x: 34,  y: 84  },
        { x: 174, y: 86  },
        { x: 32,  y: 132 },
        { x: 176, y: 134 },
        { x: 40,  y: 178 },
        { x: 168, y: 178 },
        { x: 104, y: 72  },
        { x: 104, y: 180 }
      ];
    }
    if (room.id === "bp_bathroom") return [{ x: 104, y: 126 }, { x: 104, y: 146 }];
    if (room.id === "bp_furnace") return [{ x: 104, y: 126 }, { x: 88, y: 140 }];
    if (room.id === "bp_study") return [{ x: 104, y: 126 }, { x: 124, y: 146 }];
    if (room.id === "bp_kitchen" || room.id === "bp_bedroom") return [{ x: 104, y: 124 }, { x: 124, y: 138 }];
    if (room.id === "bp_living_room") return [{ x: 104, y: 124 }, { x: 86, y: 142 }];
    return [{ x: 104, y: 126 }];
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
    let stepKey = toKey;
    while (parent[stepKey] && parent[stepKey].prev !== fromKey) {
      stepKey = parent[stepKey].prev;
    }
    const edge = parent[stepKey];
    if (!edge) return null;
    return { nextRoomKey: stepKey, exitDir: edge.dir, enterDir: edge.opp };
  }

  function moveMonkeyAcrossCabin(mon, targetRoomKey, targetX, targetY, speed, dt, roomMap) {
    if (mon.roomKey === targetRoomKey) {
      const dx = targetX - mon.x;
      const dy = targetY - mon.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 3) return true;
      mon.x += (dx / dist) * speed * dt;
      mon.y += (dy / dist) * speed * dt;
      if (Math.abs(dx) > 0.3) mon.facing = dx >= 0 ? 1 : -1;
      return false;
    }

    const step = findNextStepRoom(roomMap, mon.roomKey, targetRoomKey);
    if (!step) return true;

    const exitPt = DOOR_POS[step.exitDir] || { x: 104, y: 126 };
    const dx = exitPt.x - mon.x;
    const dy = exitPt.y - mon.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 5) {
      mon.roomKey = step.nextRoomKey;
      const enterPt = DOOR_POS[step.enterDir] || { x: 104, y: 126 };
      mon.x = enterPt.x;
      mon.y = enterPt.y;
      return false;
    }
    mon.x += (dx / dist) * speed * dt;
    mon.y += (dy / dist) * speed * dt;
    if (Math.abs(dx) > 0.3) mon.facing = dx >= 0 ? 1 : -1;
    return false;
  }

  // ==================== 1. GIANT HORROR MONKEY, CARDBOARD BOX & POPCORN SPRITES ====================
  function drawGiantMonkeySprite(ctx, x, y, timeSec, facing, isChasing) {
    const stride = isChasing ? Math.sin(timeSec * 12.0) : 0;
    const breath = isChasing ? Math.round(Math.abs(stride) * 2) : (Math.sin(timeSec * 2.2) > 0.5 ? 1 : 0);
    const armBang = isChasing ? Math.round(Math.sin(timeSec * 16) * 2.4) : 0;
    const legL = Math.round(stride * 2.4);
    const legR = -legL;

    mctx.clearRect(0, 0, 34, 42);

    // Massive hunched fur legs
    px(mctx, 9,  30, 6, 10 + legL, "#1a0f0a");
    px(mctx, 10, 30, 4, 9 + legL,  "#452819");
    px(mctx, 19, 30, 6, 10 + legR, "#1a0f0a");
    px(mctx, 20, 30, 4, 9 + legR,  "#452819");

    // Huge barrel-chested brown fur body + tattered red-gold carnival vest!
    px(mctx, 6,  14 + breath, 22, 18, "#170d08");
    px(mctx, 7,  15 + breath, 20, 16, "#4d2c1b");
    px(mctx, 9,  16 + breath, 16, 14, "#613823");
    // Tattered crimson carnival vest with brass buttons
    px(mctx, 8,  15 + breath, 5, 13, "#7a1b24");
    px(mctx, 21, 15 + breath, 5, 13, "#7a1b24");
    px(mctx, 12, 18 + breath, 1, 1,  "#e8c25a");
    px(mctx, 21, 18 + breath, 1, 1,  "#e8c25a");
    px(mctx, 12, 22 + breath, 1, 1,  "#e8c25a");
    px(mctx, 21, 22 + breath, 1, 1,  "#e8c25a");

    // Thick long muscular monkey arms + gleaming brass cymbals!
    px(mctx, 1,  16 + breath + armBang, 6, 15, "#170d08");
    px(mctx, 2,  17 + breath + armBang, 4, 13, "#54311e");
    px(mctx, 27, 16 + breath - armBang, 6, 15, "#170d08");
    px(mctx, 28, 17 + breath - armBang, 4, 13, "#54311e");
    // Brass toy cymbals clutched in massive fists
    px(mctx, 1,  27 + breath + armBang, 7, 5, "#8a681e");
    px(mctx, 2,  28 + breath + armBang, 5, 3, "#f2ce63");
    px(mctx, 26, 27 + breath - armBang, 7, 5, "#8a681e");
    px(mctx, 27, 28 + breath - armBang, 5, 3, "#f2ce63");

    // Large round ears flanking head
    px(mctx, 5,  6 + breath, 4, 6, "#24140d");
    px(mctx, 6,  7 + breath, 2, 4, "#a88362");
    px(mctx, 25, 6 + breath, 4, 6, "#24140d");
    px(mctx, 26, 7 + breath, 2, 4, "#a88362");

    // Huge eerie monkey head + tiny red fez hat!
    px(mctx, 8,  2 + breath, 18, 14, "#170d08");
    px(mctx, 9,  3 + breath, 16, 12, "#54311e");
    // Tiny crooked red fez cap on top
    px(mctx, 13, 0 + breath, 8, 3, "#9e1c26");
    px(mctx, 14, 0 + breath, 6, 1, "#d93440");
    px(mctx, 19, 1 + breath, 2, 2, "#f2cf66"); // Gold tassel

    // Pale tan monkey muzzle & unblinking glowing crimson eyes
    px(mctx, 10, 9 + breath, 14, 6, "#b89674");
    px(mctx, 11, 10 + breath, 12, 4, "#cfb08e");
    // Wide unblinking white-ringed eyes with glowing red irises
    px(mctx, 11, 5 + breath, 4, 4, "#140b0a");
    px(mctx, 19, 5 + breath, 4, 4, "#140b0a");
    px(mctx, 12, 6 + breath, 2, 2, isChasing ? "#ff2626" : "#d94141");
    px(mctx, 20, 6 + breath, 2, 2, isChasing ? "#ff2626" : "#d94141");
    // Wide bared toothy grin!
    px(mctx, 11, 12 + breath, 12, 3, "#1a0a0c");
    for (let tx = 12; tx <= 21; tx += 2) {
      px(mctx, tx, 12 + breath, 1, 2, "#f5ecd6");
    }

    ctx.save();
    // Heavy contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(Math.round(x - 13), Math.round(y - 2), 26, 6);

    const dx = Math.round(x - 17);
    const dy = Math.round(y - 39);
    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(monkeyBuf, dx, dy);
    } else {
      ctx.drawImage(monkeyBuf, dx, dy);
    }
    ctx.restore();
  }

  // Open Corrugated Cardboard Box replacing the Round Table in The Dining Room!
  function drawCardboardBox(ctx, timeSec, matchState) {
    const mr = matchState && matchState.musicalEvent;
    const scored = mr ? mr.scored : 0;
    const cx = BOX_X;
    const cy = BOX_Y;

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.52)";
    ctx.fillRect(cx - 26, cy + 12, 52, 9);

    // Back open cardboard flaps tilted outward
    px(ctx, cx - 23, cy - 22, 46, 8, "#382414");
    px(ctx, cx - 22, cy - 21, 44, 6, "#b5854f");
    px(ctx, cx - 21, cy - 20, 42, 2, "#cfa068");

    // Left & right flared cardboard side flaps
    px(ctx, cx - 29, cy - 14, 7, 22, "#382414");
    px(ctx, cx - 28, cy - 13, 6, 20, "#a87946");
    px(ctx, cx + 22, cy - 14, 7, 22, "#382414");
    px(ctx, cx + 22, cy - 13, 6, 20, "#a87946");

    // Main hollow interior opening of the cardboard box!
    px(ctx, cx - 22, cy - 15, 44, 21, "#2b1a0e");
    px(ctx, cx - 20, cy - 13, 40, 17, "#4d321c"); // Dark shadowed cardboard interior
    px(ctx, cx - 18, cy - 11, 36, 13, "#362213");

    // Accumulating pile of golden-white Popcorn kernels inside the box!
    const moundSpots = [
      [-12, -2], [10, -2], [0, -3], [-6, -5], [6, -5],
      [-13, -7], [12, -7], [0, -8], [-5, -10], [5, -10]
    ];
    for (let i = 0; i < Math.min(scored, moundSpots.length); i++) {
      const [ox, oy] = moundSpots[i];
      drawPopcornSprite(ctx, cx + ox, cy + oy, 0);
    }

    // Front corrugated kraft-paper wall of the box
    px(ctx, cx - 23, cy + 2, 46, 15, "#2b1a0e");
    px(ctx, cx - 22, cy + 3, 44, 13, "#ba8b54");
    px(ctx, cx - 22, cy + 3, 44, 2,  "#d6a972"); // Top rim highlight
    // Brown packing tape & "BOX" / counter stencil
    px(ctx, cx - 4, cy + 3, 8, 6, "#8c6336");
    ctx.fillStyle = "#362010";
    ctx.font = "700 6px 'Pixelify Sans', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${scored}/${TARGET_POPCORNS}`, cx, cy + 13);

    // Subtle pulsing warm target ring inside opening so players clearly know where to throw!
    const pulse = 0.45 + Math.sin(timeSec * 5.0) * 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 224, 135, ${pulse.toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 19, cy - 12, 38, 15);
    ctx.restore();
  }

  function drawPopcornSprite(ctx, x, y, z) {
    const cx = Math.round(x);
    const cy = Math.round(y - (z || 0));

    // Ground shadow directly beneath the popcorn's floor position
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fillRect(Math.round(x) - 3, Math.round(y) + 2, 6, 2);

    // Fluffy golden-butter popped corn cluster (pixel art!)
    px(ctx, cx - 3, cy - 2, 6, 5, "#4a3316");
    px(ctx, cx - 2, cy - 3, 4, 6, "#4a3316");
    px(ctx, cx - 2, cy - 2, 4, 4, "#f7e7a6");
    px(ctx, cx - 1, cy - 2, 3, 2, "#fffbe0"); // Fluffy white highlight puff
    px(ctx, cx,     cy,     2, 2, "#e8b948"); // Golden buttered kernel core
  }

  // ==================== 2. START / SPAWN POPCORN / CONTROLS ====================
  function spawnPopcorns(roomMap) {
    const keys = Object.keys(roomMap || {});
    const list = [];
    let uid = 0;

    // 1. Place 12 popcorns generously around The Dining Room so players can throw continuously!
    const dSpots = getSafeSpotsForRoom(roomMap["0,0"] || { id: "dining_room" });
    for (let i = 0; i < 12; i++) {
      const sp = dSpots[i % dSpots.length];
      list.push({
        id: `pop_${uid++}`,
        roomKey: "0,0",
        x: Math.max(24, Math.min(184, sp.x + (Math.random() - 0.5) * 14)),
        y: Math.max(66, Math.min(184, sp.y + (Math.random() - 0.5) * 12)),
        collected: false,
        delivered: false
      });
    }

    // 2. Scatter 16 more popcorns generously across ALL built rooms (28 popcorns total!)
    const otherKeys = keys.filter((k) => k !== "0,0");
    for (let i = 0; i < 16; i++) {
      const rk = otherKeys.length ? otherKeys[i % otherKeys.length] : "0,0";
      const spots = getSafeSpotsForRoom(roomMap[rk]);
      const sp = spots[i % spots.length];
      list.push({
        id: `pop_${uid++}`,
        roomKey: rk,
        x: Math.max(26, Math.min(182, sp.x + (Math.random() - 0.5) * 20)),
        y: Math.max(68, Math.min(182, sp.y + (Math.random() - 0.5) * 18)),
        collected: false,
        delivered: false
      });
    }
    return list;
  }

  function startMusicalRoomsEvent(matchState, player) {
    if (!matchState) return null;

    const savedLights = snapshotRoomLights(matchState);
    // Shut OFF all cabin lights during the 10-second Giant Monkey reveal!
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = false;
    });

    // Place Giant Monkey standing right beside the player in The Dining Room!
    const pX = player ? player.x : 54;
    const pY = player ? player.y : 128;
    const monX = pX < 104 ? Math.max(28, pX - 18) : Math.min(180, pX + 18);
    const monY = Math.max(76, Math.min(176, pY - 2));

    matchState.musicalEvent = {
      active: true,
      stage: "INTRO_10S", // INTRO_10S (10s) -> PLAYING_20S (20s) -> CHASE
      savedLights,
      introTimer: INTRO_DURATION,
      musicTimer: MUSIC_DURATION,
      transitionFlickerTimer: 0,
      orangeCycleTime: 0,
      scored: 0,
      target: TARGET_POPCORNS,
      popcorns: [],
      holdingPopcornId: null,
      charging: false,
      chargePower: 0,
      chargeDir: 1,
      justPickedWithF: false,
      projectiles: [],
      monkey: {
        roomKey: `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`,
        x: monX,
        y: monY,
        facing: pX >= monX ? 1 : -1,
        chasing: false
      },
      notice: "A GIANT MONKEY APPEARED RIGHT BESIDE YOU! (10s...)",
      noticeTimer: 5.5
    };

    // Silent during intro & throwing phase — monkey_sfx.mp3 plays ONLY if Chase Phase starts!

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "MUSICAL ROOMS\nA GIANT MONKEY LOOMS BESIDE YOU IN THE DARK...\nPREPARE TO GATHER 10 POPCORNS & THROW THEM INTO THE BOX!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 5400);
    }

    return matchState.musicalEvent;
  }

  function beginMusical20sPhase(matchState) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return;

    mr.stage = "PLAYING_20S";
    mr.musicTimer = MUSIC_DURATION;
    mr.transitionFlickerTimer = 1.1; // Quick dramatic flicker right as Dining Room transforms!
    mr.orangeCycleTime = 0;
    mr.popcorns = spawnPopcorns(matchState.roomMap);

    // Turn Dining Room & cabin lights ON in warm orange pulse mode!
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });

    // Move Giant Monkey to stand motionless inside The Dining Room watching the Cardboard Box!
    mr.monkey.roomKey = "0,0";
    mr.monkey.x = 156;
    mr.monkey.y = 88;
    mr.monkey.facing = -1;
    mr.monkey.chasing = false;

    // Stop intro monkey growl & play 20 seconds of audio/music_rooms_sfx.mp3!
    if (App.Audio && App.Audio.stopMonkeySfx) App.Audio.stopMonkeySfx();
    if (App.Audio && App.Audio.playMusicalBox20s) App.Audio.playMusicalBox20s(MUSIC_DURATION);

    mr.notice = "TAP [F] TO PICK UP POPCORN • HOLD & RELEASE [F] TO THROW INTO THE BOX (10 NEEDED)!";
    mr.noticeTimer = 5.5;
  }

  // Computes aim direction & oblique parabolic landing point for current chargePower (0..1)
  function computeObliqueAim(matchState, player, power) {
    const inDining = matchState.currentRoomCoord.x === 0 && matchState.currentRoomCoord.y === 0;
    let dx = player.facing >= 0 ? 1 : -1;
    let dy = 0;

    if (inDining) {
      // Automatically aim toward the central Cardboard Box so player focuses on power timing!
      const toX = BOX_X - player.x;
      const toY = (BOX_Y - 4) - player.y;
      const len = Math.hypot(toX, toY);
      if (len > 1) {
        dx = toX / len;
        dy = toY / len;
      }
    }

    const minDist = 20;
    const maxDist = 112;
    const dist = minDist + Math.max(0, Math.min(1, power)) * (maxDist - minDist);
    const landX = player.x + dx * dist;
    const landY = player.y + dy * dist;
    const peakHeight = 14 + power * 36; // Classic oblique parabolic height!
    const willScore = inDining && Math.hypot(landX - BOX_X, landY - (BOX_Y - 4)) <= 27;

    // Compute exact ideal power (0..1) needed to hit box center from current position
    let idealPower = -1;
    if (inDining) {
      const boxDist = Math.hypot(BOX_X - player.x, (BOX_Y - 4) - player.y);
      idealPower = Math.max(0, Math.min(1, (boxDist - minDist) / (maxDist - minDist)));
    }

    return { dx, dy, dist, landX, landY, peakHeight, willScore, idealPower };
  }

  function onKeyFDown(matchState, player) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active || mr.stage !== "PLAYING_20S") return false;

    // 1. If holding a popcorn -> start charging the oblique throw power bar!
    if (mr.holdingPopcornId) {
      if (!mr.charging) {
        mr.charging = true;
        mr.chargePower = 0.08;
        mr.chargeDir = 1;
        mr.justPickedWithF = false;
      }
      return true;
    }

    // 2. Hands empty -> check for nearest popcorn in current room to pick up with [F]!
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    let best = null;
    let bestDist = 28;
    for (const p of mr.popcorns) {
      if (p.collected || p.delivered || p.roomKey !== pRoomKey) continue;
      const d = Math.hypot(player.x - p.x, player.y - p.y);
      if (d <= bestDist) {
        bestDist = d;
        best = p;
      }
    }

    if (best) {
      best.collected = true;
      mr.holdingPopcornId = best.id;
      mr.justPickedWithF = true;
      mr.charging = false;
      App.Audio.open();
      mr.notice = "GOT POPCORN! HOLD & RELEASE [F] IN THE DINING ROOM TO THROW INTO THE BOX!";
      mr.noticeTimer = 2.6;
      return true;
    }

    return false;
  }

  function onKeyFUp(matchState, player) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return false;

    if (mr.justPickedWithF) {
      mr.justPickedWithF = false;
      return true;
    }

    if (!mr.charging || !mr.holdingPopcornId) return false;

    // Launch popcorn along oblique parabolic arc!
    const aim = computeObliqueAim(matchState, player, mr.chargePower);
    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    const flightDuration = 0.42 + mr.chargePower * 0.28;

    mr.projectiles.push({
      popId: mr.holdingPopcornId,
      roomKey: pRoomKey,
      startX: player.x,
      startY: player.y - 6,
      landX: Math.max(22, Math.min(186, aim.landX)),
      landY: Math.max(60, Math.min(186, aim.landY)),
      peakH: aim.peakHeight,
      elapsed: 0,
      duration: flightDuration,
      x: player.x,
      y: player.y - 6,
      z: 6
    });

    mr.holdingPopcornId = null;
    mr.charging = false;
    mr.chargePower = 0;

    if (App.Audio && App.Audio.popcornThrow) App.Audio.popcornThrow();
    return true;
  }

  function ensureEnoughPopcorns(mr, roomMap) {
    const remainingNeeded = TARGET_POPCORNS - mr.scored;
    const available = mr.popcorns.filter((p) => !p.delivered).length;
    if (available < remainingNeeded + 8) {
      const dSpots = getSafeSpotsForRoom(roomMap["0,0"] || { id: "dining_room" });
      const sp = dSpots[Math.floor(Math.random() * dSpots.length)];
      mr.popcorns.push({
        id: `pop_extra_${Date.now()}_${Math.random()}`,
        roomKey: "0,0",
        x: sp.x + (Math.random() - 0.5) * 10,
        y: sp.y + (Math.random() - 0.5) * 10,
        collected: false,
        delivered: false
      });
    }
  }

  function triggerMusicalWin(matchState) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr) return;

    if (App.Audio && App.Audio.stopMusicalBox) App.Audio.stopMusicalBox();
    if (App.Audio && App.Audio.stopMonkeySfx) App.Audio.stopMonkeySfx();
    restoreRoomLights(matchState, mr.savedLights);
    mr.active = false;
    matchState.musicalEvent = null;

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "10 POPCORNS DELIVERED!\nTHE MUSIC FADES AND THE GIANT MONKEY VANISHES.",
        { success: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
    }
  }

  function triggerMusicalDeath(matchState) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr) return;

    if (App.Audio && App.Audio.stopMusicalBox) App.Audio.stopMusicalBox();
    if (App.Audio && App.Audio.stopMonkeySfx) App.Audio.stopMonkeySfx();

    const flash = document.getElementById("monkey-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 860);
    }

    App.Audio.hexAlert();
    restoreRoomLights(matchState, mr.savedLights);
    mr.active = false;
    matchState.musicalEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE GIANT MONKEY CAUGHT YOU!\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
    }
  }

  // ==================== 3. PER-FRAME UPDATE, LIGHTING & VISUAL OVERLAYS ====================
  function syncMonkeySpatialAudio(mr, matchState, player) {
    if (!App.Audio || !App.Audio.setMonkeySfxAttenuation) return;
    const mRoom = (matchState.roomMap && matchState.roomMap[mr.monkey.roomKey]) || { x: 0, y: 0 };
    const pCoord = matchState.currentRoomCoord || { x: 0, y: 0 };
    const dist = Math.hypot(
      (pCoord.x * 208 + player.x) - (mRoom.x * 208 + mr.monkey.x),
      (pCoord.y * 208 + player.y) - (mRoom.y * 208 + mr.monkey.y)
    );
    const t = Math.max(0, Math.min(1, (dist - 20) / 380));
    App.Audio.setMonkeySfxAttenuation(Math.pow(1 - t, 1.4));
  }

  function update(dt, matchState, player) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return;

    if (mr.noticeTimer > 0) {
      mr.noticeTimer = Math.max(0, mr.noticeTimer - dt);
      if (mr.noticeTimer === 0) mr.notice = "";
    }

    if (mr.transitionFlickerTimer > 0) {
      mr.transitionFlickerTimer = Math.max(0, mr.transitionFlickerTimer - dt);
    }

    // 1. 10-second Intro Stage (lights off, dim table glow showing Giant Monkey right next to player)
    if (mr.stage === "INTRO_10S") {
      mr.introTimer -= dt;
      if (mr.introTimer <= 0) {
        beginMusical20sPhase(matchState);
      }
      return;
    }

    mr.orangeCycleTime += dt;

    // 2. Update airborne oblique-throw popcorn projectiles
    if (mr.projectiles.length) {
      const remaining = [];
      for (const proj of mr.projectiles) {
        proj.elapsed += dt;
        const frac = Math.min(1, proj.elapsed / Math.max(0.05, proj.duration));
        proj.x = proj.startX + (proj.landX - proj.startX) * frac;
        proj.y = proj.startY + (proj.landY - proj.startY) * frac;
        proj.z = 4 * proj.peakH * frac * (1 - frac) + 6 * (1 - frac);

        if (frac >= 1) {
          const popObj = mr.popcorns.find((p) => p.id === proj.popId);
          const landedInBox =
            proj.roomKey === "0,0" &&
            Math.hypot(proj.landX - BOX_X, proj.landY - (BOX_Y - 4)) <= 31;

          if (landedInBox) {
            if (popObj) popObj.delivered = true;
            mr.scored += 1;
            const won = mr.scored >= TARGET_POPCORNS;
            if (App.Audio && App.Audio.popcornScore) App.Audio.popcornScore(won);
            mr.notice = `SCORED! POPCORNS IN BOX: ${mr.scored} / ${TARGET_POPCORNS}`;
            mr.noticeTimer = 2.4;
            if (won) {
              triggerMusicalWin(matchState);
              return;
            }
            ensureEnoughPopcorns(mr, matchState.roomMap);
          } else {
            // Missed box -> popcorn lands right on the floor so player can pick it up again!
            if (popObj) {
              popObj.collected = false;
              popObj.roomKey = proj.roomKey;
              popObj.x = proj.landX;
              popObj.y = proj.landY;
            }
            App.Audio.click();
            mr.notice = "MISSED THE BOX! PICK IT UP [F] AND ADJUST YOUR THROW POWER!";
            mr.noticeTimer = 2.0;
          }
        } else {
          remaining.push(proj);
        }
      }
      mr.projectiles = remaining;
    }

    // 3. 20-Second Music Box & Popcorn Throwing Stage
    if (mr.stage === "PLAYING_20S") {
      if (mr.charging) {
        // Smooth oscillating power gauge (0.08 <-> 1.0) while holding [F]
        mr.chargePower += mr.chargeDir * dt * 0.92;
        if (mr.chargePower >= 1.0) {
          mr.chargePower = 1.0;
          mr.chargeDir = -1;
        } else if (mr.chargePower <= 0.08) {
          mr.chargePower = 0.08;
          mr.chargeDir = 1;
        }
      }

      mr.musicTimer -= dt;
      if (mr.musicTimer <= 0) {
        // 20 SECONDS UP -> MUSIC STOPS & GIANT MONKEY CHASES AND KILLS PLAYER!
        mr.stage = "CHASE";
        mr.charging = false;
        mr.monkey.chasing = true;
        if (App.Audio && App.Audio.stopMusicalBox) App.Audio.stopMusicalBox();
        if (App.Audio && App.Audio.playMonkeySfx) App.Audio.playMonkeySfx(true);
        App.Audio.hexAlert();
        mr.notice = "THE MUSIC STOPPED! THE GIANT MONKEY IS HUNTING YOU!";
        mr.noticeTimer = 6.0;
      }
      return;
    }

    // 4. Giant Monkey Relentless Chase Stage
    if (mr.stage === "CHASE") {
      const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
      moveMonkeyAcrossCabin(mr.monkey, pRoomKey, player.x, player.y, 96, dt, matchState.roomMap);
      syncMonkeySpatialAudio(mr, matchState, player);

      if (mr.monkey.roomKey === pRoomKey && Math.hypot(mr.monkey.x - player.x, mr.monkey.y - player.y) <= 15.0) {
        triggerMusicalDeath(matchState);
      }
    }
  }

  // Slow 3-second orange lighting pulse & initial room-transform flicker!
  function getLightMultiplier(matchState, timeSec) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return 1.0;

    if (mr.transitionFlickerTimer > 0) {
      return Math.sin(timeSec * 42) > 0 ? 0.95 : 0.14;
    }
    if (mr.stage === "PLAYING_20S") {
      // Exact 3.0-second slow flickering cycle!
      const cyc = (mr.orangeCycleTime % 3.0) / 3.0;
      const slowWave = 0.5 + 0.5 * Math.cos(cyc * Math.PI * 2); // 1.0 -> 0.0 -> 1.0 every 3.0s
      const softDip = cyc > 0.42 && cyc < 0.58 ? 0.72 : 1.0;
      return (0.48 + slowWave * 0.48) * softDip;
    }
    if (mr.stage === "CHASE") {
      return 0.35 + Math.sin(timeSec * 22) * 0.12;
    }
    return 1.0;
  }

  function getRoomRenderables(ctx, roomKey, timeSec, matchState) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return [];
    const list = [];

    if (mr.monkey && mr.monkey.roomKey === roomKey) {
      const m = mr.monkey;
      list.push({
        y: m.y,
        draw: () => drawGiantMonkeySprite(ctx, m.x, m.y, timeSec, m.facing, m.chasing)
      });
    }

    if (mr.stage === "PLAYING_20S" || mr.stage === "CHASE") {
      mr.popcorns.forEach((p) => {
        if (p.collected || p.delivered || p.roomKey !== roomKey) return;
        list.push({
          y: p.y,
          draw: () => drawPopcornSprite(ctx, p.x, p.y, Math.sin(timeSec * 4.0 + p.x) * 1.1)
        });
      });

      mr.projectiles.forEach((proj) => {
        if (proj.roomKey !== roomKey) return;
        list.push({
          y: proj.y + 4,
          draw: () => drawPopcornSprite(ctx, proj.x, proj.y, proj.z)
        });
      });
    }

    return list;
  }

  // Draws soft warm orange wash, oblique parabolic throw preview, power tension bar & popcorn shimmers!
  function renderRoomOverlays(ctx, roomKey, timeSec, matchState, player) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return;

    // 1. Soft warm orange atmospheric lighting tint during PLAYING_20S (3s slow cycle!)
    if (mr.stage === "PLAYING_20S") {
      const cyc = (mr.orangeCycleTime % 3.0) / 3.0;
      const pulse = 0.5 + 0.5 * Math.cos(cyc * Math.PI * 2);
      const alpha = roomKey === "0,0" ? (0.14 + pulse * 0.16) : (0.08 + pulse * 0.08);
      ctx.fillStyle = `rgba(255, 148, 56, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, 208, 208);
    } else if (mr.stage === "CHASE") {
      ctx.fillStyle = "rgba(180, 32, 24, 0.18)";
      ctx.fillRect(0, 0, 208, 208);
    }

    // 2. Subtle shimmer on floor popcorns so they're easy to spot in warm orange gloom
    if (mr.stage === "PLAYING_20S") {
      const shPulse = 0.65 + Math.sin(timeSec * 5.2) * 0.35;
      mr.popcorns.forEach((p) => {
        if (p.collected || p.delivered || p.roomKey !== roomKey) return;
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 12);
        g.addColorStop(0, `rgba(255, 240, 165, ${(0.34 * shPulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
      });
    }

    // 3. Held popcorn sprite next to player
    if (mr.holdingPopcornId && player) {
      drawPopcornSprite(ctx, player.x + player.facing * 7, player.y - 8, 0);
    }

    // 4. OBLIQUE PARABOLIC THROW TRAJECTORY + POWER TENSION BAR (while holding [F]!)
    if (mr.stage === "PLAYING_20S" && mr.charging && player) {
      const aim = computeObliqueAim(matchState, player, mr.chargePower);
      const arcCol = aim.willScore ? "#6ef29e" : "#ffd26b";

      // (a) Parabolic Oblique Throw Dotted Arc (`hình ném xiên`)!
      const dots = 12;
      for (let i = 1; i <= dots; i++) {
        const t = i / dots;
        const ax = player.x + (aim.landX - player.x) * t;
        const ay = (player.y - 6) + (aim.landY - (player.y - 6)) * t;
        const az = 4 * aim.peakHeight * t * (1 - t) + 6 * (1 - t);
        const sz = i === dots ? 3 : 2;
        ctx.fillStyle = arcCol;
        ctx.fillRect(Math.round(ax - sz / 2), Math.round(ay - az - sz / 2), sz, sz);
      }

      // (b) Landing Target Ring on the floor / box
      ctx.save();
      ctx.strokeStyle = arcCol;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(aim.landX, aim.landY, 7, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // (c) Crisp Tension Power Gauge Bar right below/beside the player!
      const barW = 36;
      const barH = 5;
      const bx = Math.max(6, Math.min(208 - barW - 6, Math.round(player.x - barW / 2)));
      const by = Math.max(8, Math.round(player.y + 5));

      px(ctx, bx - 1, by - 1, barW + 2, barH + 2, "#140d0a");
      px(ctx, bx, by, barW, barH, "#2b221e");

      // Ideal box-landing sweet-spot marker on the tension bar!
      if (aim.idealPower >= 0) {
        const swX = bx + Math.round(aim.idealPower * (barW - 4));
        px(ctx, swX, by, 5, barH, "rgba(110, 242, 158, 0.45)");
      }

      const fillW = Math.max(1, Math.round(mr.chargePower * barW));
      px(ctx, bx, by, fillW, barH, aim.willScore ? "#6ef29e" : "#ff9e3b");
    }
  }

  function getHudSummary(matchState) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active) return null;

    if (mr.stage === "INTRO_10S") {
      return {
        title: `MUSICAL ROOMS • STARTING IN ${Math.max(1, Math.ceil(mr.introTimer))}S`,
        sub: "THE GIANT MONKEY STANDS RIGHT BESIDE YOU IN THE DARK...",
        notice: mr.notice || ""
      };
    }
    if (mr.stage === "CHASE") {
      return {
        title: "MUSICAL ROOMS • THE MUSIC STOPPED!",
        sub: "THE GIANT MONKEY IS CHASING YOU!",
        notice: mr.notice || ""
      };
    }
    const holdSub = mr.charging
      ? `CHARGING THROW POWER: ${Math.round(mr.chargePower * 100)}% — RELEASE [F] TO THROW!`
      : mr.holdingPopcornId
        ? "HOLD [F] TO AIM OBLIQUE THROW • RELEASE [F] TO TOSS INTO BOX"
        : "PRESS [F] NEAR POPCORN TO PICK UP";
    return {
      title: `MUSICAL ROOMS • POPCORNS: ${mr.scored}/${TARGET_POPCORNS} • MUSIC: ${Math.max(0, Math.ceil(mr.musicTimer))}S`,
      sub: holdSub,
      notice: mr.notice || ""
    };
  }

  function getPrompt(matchState, player) {
    const mr = matchState && matchState.musicalEvent;
    if (!mr || !mr.active || mr.stage !== "PLAYING_20S") return null;

    if (mr.holdingPopcornId) {
      const inDining = matchState.currentRoomCoord.x === 0 && matchState.currentRoomCoord.y === 0;
      return {
        type: "musical_throw_hint",
        prompt: mr.charging
          ? `HOLDING [F] (${Math.round(mr.chargePower * 100)}%) — RELEASE [F] TO THROW!`
          : inDining
            ? "[HOLD F] CHARGE & THROW POPCORN INTO CARDBOARD BOX"
            : "BRING POPCORN TO THE DINING ROOM BOX ([HOLD F] TO THROW)"
      };
    }

    const pRoomKey = `${matchState.currentRoomCoord.x},${matchState.currentRoomCoord.y}`;
    for (const p of mr.popcorns) {
      if (p.collected || p.delivered || p.roomKey !== pRoomKey) continue;
      if (Math.hypot(player.x - p.x, player.y - p.y) <= 26) {
        return { type: "musical_pickup_hint", prompt: "[F] PICK UP POPCORN" };
      }
    }
    return null;
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.musicalEvent && matchState.musicalEvent.active);
  }

  function isIntroDarkStage(matchState) {
    const mr = matchState && matchState.musicalEvent;
    return Boolean(mr && mr.active && mr.stage === "INTRO_10S");
  }

  function isBoxMode(matchState) {
    const mr = matchState && matchState.musicalEvent;
    return Boolean(mr && mr.active && (mr.stage === "PLAYING_20S" || mr.stage === "CHASE"));
  }

  function cleanup(matchState) {
    if (App.Audio && App.Audio.stopMusicalBox) App.Audio.stopMusicalBox();
    if (App.Audio && App.Audio.stopMonkeySfx) App.Audio.stopMonkeySfx();
    if (matchState) matchState.musicalEvent = null;
  }

  App.Musical = {
    TARGET_POPCORNS,
    startMusicalRoomsEvent,
    onKeyFDown,
    onKeyFUp,
    update,
    drawCardboardBox,
    getLightMultiplier,
    getRoomRenderables,
    renderRoomOverlays,
    getHudSummary,
    getPrompt,
    isActive,
    isIntroDarkStage,
    isBoxMode,
    cleanup
  };
})(window.Duskwood);
