/* ==========================================================================
   DUSKWOOD INN - THE BASEMENT (`hx_cellar_breakers`) Event Engine
   - Trigger: Exits Table View + violent earthquake shake in The Dining Room!
     The Dining Room gradually slides DOWN underground into the Basement Map
     over 14 seconds synced to `audio/basement_start_sfx.mp3`!
   - 5 seconds after landing underground (`PRE_START_5S`): Event begins!
   - Basement Map (`25x21` concrete maze, 208x208 follow-camera):
       * Thick industrial concrete/brick walls with 10 TRUE 3-walled recessed
         hiding alcoves (`A`) placed right near every breaker/fuse box!
       * 5 Electrical / Fuse Boxes glowing bright RED with crackling electric
         leakage arcs in the dark -> turn bright GREEN once repaired!
       * Press [F] near a box -> opens First-Person Close-Up Repair View facing
         the fuse box; HOLD [F] to fill the repair progress bar!
       * Monster: Tall Chainsaw-Head Monster patrolling a predefined closed-loop
         corridor route at moderate speed (`40 px/s`) with spatial
         `audio/chainsaw_sfx.mp3` (11s)! Duck into recessed wall alcoves to evade!
   - Victory (5/5 boxes repaired): Reverses the descent — violently shakes &
     slides the Basement/Dining Room back UPWARD over 14 seconds with
     `audio/basement_start_sfx.mp3`, returning to normal cabin gameplay!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const TILE = 16;
  const COLS = 25;
  const ROWS = 21;
  const WORLD_W = COLS * TILE; // 400
  const WORLD_H = ROWS * TILE; // 336
  const VIEW_W = 208;
  const VIEW_H = 208;

  const SLIDE_DURATION = 14.0;   // Synced to audio/basement_start_sfx.mp3 (14s)!
  const PRE_START_DELAY = 5.0;   // 5 seconds after sliding down finishes!
  const REPAIR_DURATION = 4.2;   // Seconds of holding [F] per breaker box

  // 100% BFS-Verified 25x21 Basement Maze:
  // '#' = Concrete/brick wall
  // '.' = Walkable industrial corridor
  // 'A' = TRUE 3-walled recessed hiding alcove indented into wall (10 total, right next to breakers!)
  // 'H' = Central hydraulic lift platform where The Dining Room lands!
  const MAZE_LINES = [
    "#########################", // 0
    "#####A#####A#######A#####", // 1  North wall recessed alcoves: (5,1), (11,1), (19,1)
    "#.......................#", // 2  North corridor (Breakers NW & NE)
    "#.###.#####.#.#####.###.#", // 3
    "#.#...#...#.#.#...#...#.#", // 4
    "#.#.#.#.#.#...#.#.#.#.#.#", // 5
    "#.....#.#.##.##.#.#.....#", // 6
    "###.###.#.......#.###.###", // 7
    "##A.#...#.HHHHH.#...#.A##", // 8  West/East recessed alcoves (2,8) & (22,8)
    "###.#.###.HHHHH.###.#.###", // 9
    "###.......HHHHH.......###", // 10 Central Shaft Hub (10..14, 8..12) + Breakers W & E!
    "###.#.###.HHHHH.###.#.###", // 11
    "##A.#...#.HHHHH.#...#.A##", // 12 West/East recessed alcoves (2,12) & (22,12)
    "###.###.#.......#.###.###", // 13
    "#.....#.#.##.##.#.#.....#", // 14
    "#.#.#.#.#.#...#.#.#.#.#.#", // 15
    "#.#...#...#.#.#...#...#.#", // 16
    "#.###.#####.#.#####.###.#", // 17
    "#.......................#", // 18 South corridor (Breaker S)
    "#####A#####A#####A#######", // 19 South wall recessed alcoves: (5,19), (11,19), (17,19)
    "#########################"  // 20
  ];

  const HUB_CENTER = { x: 12 * TILE + 8, y: 10 * TILE + 8 }; // (200, 168)

  // 5 Breaker / Fuse Boxes mounted cleanly on corridor walls, each 2-3 steps from a recessed hiding alcove!
  const BREAKER_SPECS = [
    { id: "brk_nw", label: "NW FUSE BOX",    col: 3,  row: 2,  wall: "N" },
    { id: "brk_ne", label: "NE FUSE BOX",    col: 21, row: 2,  wall: "N" },
    { id: "brk_w",  label: "WEST BREAKER",   col: 3,  row: 10, wall: "W" },
    { id: "brk_e",  label: "EAST BREAKER",   col: 21, row: 10, wall: "E" },
    { id: "brk_s",  label: "SOUTH FUSE BOX", col: 12, row: 18, wall: "S" }
  ];

  // Predefined closed-loop corridor patrol route for the Tall Chainsaw-Head Monster
  // Sweeps right past ALL 5 Breaker Boxes while NEVER entering any recessed 'A' wall alcove!
  const PATROL_WAYPOINTS = [
    { col: 1,  row: 2  },
    { col: 23, row: 2  },
    { col: 23, row: 6  },
    { col: 21, row: 6  },
    { col: 21, row: 14 },
    { col: 23, row: 14 },
    { col: 23, row: 18 },
    { col: 1,  row: 18 },
    { col: 1,  row: 14 },
    { col: 3,  row: 14 },
    { col: 3,  row: 6  },
    { col: 1,  row: 6  }
  ];

  let staticMazeCanvas = null;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const mctx = maskCanvas.getContext("2d");

  // Offscreen Dining Room snapshot buffer used for the smooth vertical slide-down / slide-up animation!
  const diningSlideBuf = document.createElement("canvas");
  diningSlideBuf.width = VIEW_W;
  diningSlideBuf.height = VIEW_H;
  const dsctx = diningSlideBuf.getContext("2d");
  dsctx.imageSmoothingEnabled = false;

  // Offscreen Tall Chainsaw-Head Monster Sprite Buffer (28x44px — towering industrial horror!)
  const sawBuf = document.createElement("canvas");
  sawBuf.width = 28;
  sawBuf.height = 44;
  const sctx = sawBuf.getContext("2d");
  sctx.imageSmoothingEnabled = false;

  let repairSparkTimer = 0;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }
  function isMpMode(m) { return Boolean(App.Events && App.Events.isMpEventMode && App.Events.isMpEventMode(m)); }
  function isMpHost(m) { return !App.Events || !App.Events.isMpHost || App.Events.isMpHost(m); }
  function isMpGuest(m) { return Boolean(App.Events && App.Events.isMpGuest && App.Events.isMpGuest(m)); }

  function tileChar(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return "#";
    return MAZE_LINES[row][col];
  }

  function isWallTile(col, row) {
    return tileChar(col, row) === "#";
  }

  function isAlcoveTile(col, row) {
    return tileChar(col, row) === "A";
  }

  function isPlayerInAlcove(player) {
    if (!player) return false;
    const col = Math.floor(player.x / TILE);
    const row = Math.floor((player.y - 3) / TILE);
    return isAlcoveTile(col, row);
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

  // ==================== 1. BUILD STATIC INDUSTRIAL CONCRETE BASEMENT MAZE ====================
  function buildStaticBasementMaze() {
    staticMazeCanvas = document.createElement("canvas");
    staticMazeCanvas.width = WORLD_W;
    staticMazeCanvas.height = WORLD_H;
    const c = staticMazeCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    // 1. Cold damp basement concrete slabs
    const slabCols = ["#2e3034", "#292b2f", "#33363b", "#26282c"];
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const ch = tileChar(col, r);
        const x = col * TILE;
        const y = r * TILE;

        if (ch === "#") {
          // Heavy concrete/cinderblock subterranean basement wall
          px(c, x, y, TILE, TILE, "#121316");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#3a3d42");
          px(c, x + 1, y + 1, TILE - 2, 3, "#4e5259"); // Top concrete wall bevel
          // Cinderblock seam lines
          px(c, x + 1, y + 8, TILE - 2, 1, "#222429");
          px(c, x + 8, y + 2, 1, 6, "#222429");
          px(c, x + 4, y + 9, 1, 6, "#222429");
          // Cast dark vertical drop shadow onto south floor
          if (!isWallTile(col, r + 1)) {
            c.fillStyle = "rgba(0,0,0,0.48)";
            c.fillRect(x, y + TILE, TILE, 4);
          }
          continue;
        }

        if (ch === "H") {
          // Central steel hydraulic lift platform where The Dining Room rests underground!
          px(c, x, y, TILE, TILE, "#363330");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#4a433d");
          px(c, x + 2, y + 2, 2, 2, "#24211e"); // Floor bolts
          px(c, x + 12, y + 12, 2, 2, "#24211e");
          // Yellow/black industrial hazard rim around the 5x5 hydraulic platform edge!
          if (tileChar(col, r - 1) !== "H") px(c, x, y, TILE, 2, (col % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col, r + 1) !== "H") px(c, x, y + TILE - 2, TILE, 2, (col % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col - 1, r) !== "H") px(c, x, y, 2, TILE, (r % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col + 1, r) !== "H") px(c, x + TILE - 2, y, 2, TILE, (r % 2 === 0) ? "#c79a2e" : "#1c1917");
          continue;
        }

        if (ch === "A") {
          // Recessed 3-walled Hiding Alcove indented into concrete wall!
          px(c, x, y, TILE, TILE, "#1b1e24"); // Deep shadowy hiding niche
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#232730");
          // Subtle blue-slate safety dashed floor border so players spot hiding nooks quickly!
          px(c, x + 2, y + 2, TILE - 4, 1, "#4c6278");
          px(c, x + 2, y + TILE - 3, TILE - 4, 1, "#4c6278");
          px(c, x + 2, y + 2, 1, TILE - 4, "#4c6278");
          px(c, x + TILE - 3, y + 2, 1, TILE - 4, "#4c6278");
          continue;
        }

        // Standard damp basement corridor floor slab
        const colIdx = (col * 3 + r * 5) % slabCols.length;
        px(c, x, y, TILE, TILE, slabCols[colIdx]);
        px(c, x, y + TILE - 1, TILE, 1, "#1e2024");
        px(c, x + TILE - 1, y, 1, TILE, "#1e2024");
        if ((col + r) % 4 === 0) {
          px(c, x + 4, y + 5, 5, 2, "rgba(18, 22, 28, 0.35)"); // Damp floor stain
        }
      }
    }

    // Rust-stained ceiling pipes running along main north/south corridors for basement atmosphere
    for (let x = TILE; x < WORLD_W - TILE; x += 16) {
      px(c, x, TILE * 2 - 2, 16, 2, "#593b29");
      px(c, x, TILE * 18 + TILE, 16, 2, "#593b29");
    }
  }

  // ==================== 2. TALL CHAINSAW-HEAD MONSTER SPRITE (28x44) ====================
  function drawChainsawMonsterSprite(ctx, x, y, timeSec, facing) {
    const stride = Math.sin(timeSec * 8.2);
    const revVib = Math.sin(timeSec * 48) > 0 ? 1 : 0;
    const legL = Math.round(stride * 2.4);
    const legR = -legL;
    const chainTick = Math.floor(timeSec * 24) % 2;

    sctx.clearRect(0, 0, 28, 44);

    // Tall heavy work boots & towering dark legs
    px(sctx, 9,  29, 4, 12 + legL, "#0d0b0e");
    px(sctx, 10, 29, 2, 11 + legL, "#242129");
    px(sctx, 8,  39 + legL, 5, 3,  "#141012");

    px(sctx, 15, 29, 4, 12 + legR, "#0d0b0e");
    px(sctx, 16, 29, 2, 11 + legR, "#242129");
    px(sctx, 15, 39 + legR, 5, 3,  "#141012");

    // Towering hunched oil-stained coveralls & bloodied leather butcher apron!
    px(sctx, 6,  14, 16, 16, "#0d0a0c");
    px(sctx, 7,  15, 14, 14, "#24272c"); // Dark charcoal mechanic coveralls
    px(sctx, 9,  16, 10, 13, "#3b231b"); // Heavy dark leather apron
    px(sctx, 10, 19, 3,  4,  "#7a141c"); // Dried crimson stain on apron
    px(sctx, 15, 22, 3,  5,  "#630e15");

    // Long muscular arms hanging by sides with stained gloves
    const armSw = Math.round(stride * 2.0);
    px(sctx, 3,  15, 4, 14 + armSw, "#121318");
    px(sctx, 4,  16, 2, 12 + armSw, "#2e3238");
    px(sctx, 3,  28 + armSw, 4, 3,  "#4f382e");

    px(sctx, 21, 15, 4, 14 - armSw, "#121318");
    px(sctx, 22, 16, 2, 12 - armSw, "#2e3238");
    px(sctx, 21, 28 - armSw, 4, 3,  "#4f382e");

    // === ICONIC CHAINSAW HEAD (Orange/Rust Industrial Engine Casing + Protruding Spinning Blade!) ===
    // Thick mechanical neck collar + exhaust pipe puffing smoke
    px(sctx, 11, 12, 6, 3, "#1a1718");
    px(sctx, 12, 12, 4, 2, "#595e66");
    // Rear chainsaw engine motor housing (head skull replacement!)
    px(sctx, 5,  4 + revVib, 11, 9, "#1a0e09");
    px(sctx, 6,  5 + revVib, 9,  7, "#c94a1c"); // Rusted industrial orange chainsaw motor!
    px(sctx, 7,  5 + revVib, 7,  2, "#eb7338"); // Top highlight
    px(sctx, 7,  8 + revVib, 5,  3, "#26282e"); // Vented engine grill slats
    px(sctx, 4,  6 + revVib, 2,  5, "#3a3e45"); // Top handle bar & starter pull-cord
    // Glowing red vent eye-slit on motor casing
    px(sctx, 13, 6 + revVib, 2,  2, "#ff2626");

    // Long protruding steel chainsaw guide bar jutting forward out of the head!
    px(sctx, 16, 6 + revVib, 11, 5, "#17191d");
    px(sctx, 16, 7 + revVib, 10, 3, "#9aa4b0"); // Steel guide bar
    px(sctx, 17, 8 + revVib, 7,  1, "#8c141c"); // Crimson streak along bar!
    // Animated spinning razor teeth along top & bottom edges of the chainsaw bar!
    for (let tx = 16 + chainTick; tx <= 26; tx += 2) {
      px(sctx, tx, 5 + revVib,  1, 1, "#f2f6fa");
      px(sctx, tx, 11 + revVib, 1, 1, "#f2f6fa");
    }

    ctx.save();
    // Floor contact shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(Math.round(x - 10), Math.round(y - 2), 20, 5);

    const drawX = Math.round(x - 14);
    const drawY = Math.round(y - 41);
    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sawBuf, drawX, drawY);
    } else {
      ctx.drawImage(sawBuf, drawX, drawY);
    }
    ctx.restore();
  }

  // ==================== 3. BREAKER / FUSE BOX SPRITES & ELECTRIC LEAK ARCS ====================
  function drawBreakerBoxInMaze(ctx, bx, by, fixed, timeSec) {
    const x = Math.round(bx);
    const y = Math.round(by);
    // Heavy steel electrical wall cabinet
    px(ctx, x - 6, y - 8, 12, 14, "#14161a");
    px(ctx, x - 5, y - 7, 10, 12, "#4a515c");
    px(ctx, x - 4, y - 6, 8,  10, "#353b45");
    // Glowing RED (faulty) or GREEN (fixed) indicator lamp & fuse window!
    const lampCol = fixed ? "#4df286" : (Math.sin(timeSec * 12) > -0.2 ? "#ff2e2e" : "#8f1414");
    px(ctx, x - 2, y - 5, 4, 3, lampCol);
    px(ctx, x - 3, y - 1, 6, 4, fixed ? "#1f4d30" : "#4d1818");
    px(ctx, x - 2, y,     2, 2, fixed ? "#78ffaa" : "#ff6b6b");
    px(ctx, x + 1, y,     2, 2, fixed ? "#78ffaa" : "#ff6b6b");
  }

  function drawElectricLeakArcs(ctx, bx, by, timeSec, seed) {
    // Crackling jagged cyan/amber electric leakage sparks (`hiệu ứng rỉ điện`)!
    const burst = Math.sin(timeSec * 14 + seed * 3.1);
    if (burst < -0.15) return;
    ctx.save();
    ctx.strokeStyle = burst > 0.55 ? "#d8f8ff" : "#7be0ff";
    ctx.lineWidth = 1.2;
    const ang = ((Math.floor(timeSec * 18) + seed * 7) % 8) * (Math.PI / 4);
    const mx = bx + Math.cos(ang) * 7 + (Math.sin(timeSec * 40) * 2);
    const my = by - 2 + Math.sin(ang) * 7;
    const ex = bx + Math.cos(ang + 0.3) * 14;
    const ey = by - 2 + Math.sin(ang + 0.3) * 13;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#fff8b8";
    ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2);
    ctx.restore();
  }

  // ==================== 4. FIRST-PERSON BREAKER / FUSE BOX REPAIR MODAL ====================
  function buildBreakerModalSVG(box, timeSec) {
    const fixed = box.fixed;
    const prog = Math.round((box.progress || 0) * 100);
    const ledCol = fixed ? "#4df286" : "#ff3333";
    const ledGlow = fixed ? "rgba(77,242,134,0.45)" : "rgba(255,48,48,0.52)";
    const sparkVis = !fixed;

    // 4 Ceramic Fuses inside the open steel panel — light up GREEN sequentially as progress hits 25/50/75/100%!
    const fuseHtml = [0, 1, 2, 3].map((i) => {
      const fx = 66 + i * 48;
      const lit = fixed || prog >= (i + 1) * 25;
      const fCol = lit ? "#52f28d" : "#ff4545";
      return `
        <rect x="${fx}" y="114" width="30" height="58" rx="3" fill="#181c22" stroke="#596270" stroke-width="2"/>
        <rect x="${fx + 6}" y="120" width="18" height="10" fill="#b89852"/>
        <rect x="${fx + 6}" y="156" width="18" height="10" fill="#b89852"/>
        <rect x="${fx + 8}" y="130" width="14" height="26" fill="${lit ? "#d9ffe6" : "#3a1b1e"}" stroke="#262a30" stroke-width="1.5"/>
        <line x1="${fx + 15}" y1="130" x2="${fx + 15}" y2="156" stroke="${fCol}" stroke-width="3"/>
        <circle cx="${fx + 15}" cy="186" r="5" fill="${fCol}"/>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 320 240" class="bm-fp-svg" aria-hidden="true">
        <rect width="320" height="240" fill="#14161a"/>
        <!-- Concrete basement wall behind cabinet -->
        <line x1="0" y1="60" x2="320" y2="60" stroke="#1f2228" stroke-width="2"/>
        <line x1="0" y1="120" x2="320" y2="120" stroke="#1f2228" stroke-width="2"/>
        <line x1="0" y1="180" x2="320" y2="180" stroke="#1f2228" stroke-width="2"/>
        <!-- Steel electrical conduits -->
        <rect x="148" y="0" width="24" height="26" fill="#464d57" stroke="#1b1e24" stroke-width="2"/>
        <!-- Open Heavy Industrial Breaker Box Cabinet -->
        <rect x="34" y="20" width="252" height="202" rx="6" fill="#3a404a" stroke="#121418" stroke-width="4"/>
        <rect x="44" y="30" width="232" height="182" rx="3" fill="#23272e" stroke="#5b6370" stroke-width="2"/>
        <!-- Top Status Header Plate & Red/Green Indicator Light -->
        <rect x="56" y="42" width="208" height="46" rx="3" fill="#16191f" stroke="#454c57" stroke-width="2"/>
        <circle cx="88" cy="65" r="15" fill="${ledGlow}"/>
        <circle cx="88" cy="65" r="9" fill="${ledCol}" stroke="#121418" stroke-width="2"/>
        <text x="180" y="61" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="9" fill="#e8eef7">${box.label}</text>
        <text x="180" y="77" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-size="12" font-weight="700" fill="${ledCol}">${fixed ? "POWER RESTORED" : "SHORT CIRCUIT — LEAKING"}</text>
        <!-- 4 Ceramic Fuse Cartridges -->
        ${fuseHtml}
        <!-- Copper bus wires -->
        <path d="M56,102 L264,102" stroke="#b5713c" stroke-width="4"/>
        <path d="M56,202 L264,202" stroke="#46738c" stroke-width="3"/>
        ${
          sparkVis
            ? `<g class="bm-spark-arcs" stroke="#8ceeff" stroke-width="2.4" fill="none" stroke-linecap="round">
                 <polyline points="82,102 96,118 86,130 104,144"/>
                 <polyline points="222,102 210,116 226,126 212,140"/>
               </g>`
            : ""
        }
      </svg>`;
  }

  function syncBreakerModalUI(bm) {
    const modal = document.getElementById("basement-breaker-modal");
    if (!modal || !bm || !bm.repairingBoxId) return;
    const box = bm.breakers.find((b) => b.id === bm.repairingBoxId);
    if (!box) return;

    const artEl = document.getElementById("bm-breaker-art");
    const fillEl = document.getElementById("bm-progress-fill");
    const pctEl = document.getElementById("bm-progress-pct");
    const hintEl = document.getElementById("bm-repair-hint");

    const pct = Math.min(100, Math.round((box.progress || 0) * 100));
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
      fillEl.classList.toggle("is-done", box.fixed);
    }
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (hintEl) {
      hintEl.textContent = box.fixed
        ? "BREAKER REPAIRED!"
        : bm.holdingRepairF
          ? "REPAIRING... KEEP HOLDING [F] (LISTEN FOR THE CHAINSAW!)"
          : "HOLD [F] TO REPAIR FUSE BOX  •  [E / ESC] STEP BACK & HIDE";
    }
    if (artEl) {
      const bucket = Math.floor(pct / 25);
      if (artEl.dataset.lastBucket !== `${box.id}_${bucket}_${box.fixed}`) {
        artEl.dataset.lastBucket = `${box.id}_${bucket}_${box.fixed}`;
        artEl.innerHTML = buildBreakerModalSVG(box, performance.now() * 0.001);
      }
    }
  }

  function openBreakerModal(matchState, box) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !box || box.fixed) return false;
    bm.repairingBoxId = box.id;
    bm.holdingRepairF = true; // Pressing & holding [F] seamlessly starts repairing right away!
    const modal = document.getElementById("basement-breaker-modal");
    const artEl = document.getElementById("bm-breaker-art");
    if (artEl) artEl.dataset.lastBucket = "";
    syncBreakerModalUI(bm);
    if (modal) modal.classList.remove("hidden");
    App.Audio.open();
    return true;
  }

  function closeBreakerModal(matchState, silent) {
    const bm = matchState && matchState.basementEvent;
    if (bm) {
      bm.repairingBoxId = null;
      bm.holdingRepairF = false;
    }
    document.getElementById("basement-breaker-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  // ==================== 5. START / UPDATE / WIN / LOSE LIFECYCLE ====================
  function startBasementEvent(matchState, player) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "the_basement");
    if (!staticMazeCanvas) buildStaticBasementMaze();

    const savedLights = snapshotRoomLights(matchState);

    const breakers = BREAKER_SPECS.map((s, idx) => ({
      id: s.id,
      label: s.label,
      col: s.col,
      row: s.row,
      wall: s.wall,
      x: s.col * TILE + 8,
      y: s.row * TILE + 8,
      progress: 0,
      fixed: false,
      seed: idx + 1
    }));

    // Spawn Chainsaw-Head Monster at waypoint 0 (far NW corner away from center hub!)
    const startWp = PATROL_WAYPOINTS[0];

    matchState.basementEvent = {
      active: true,
      stage: "DESCENDING", // DESCENDING (14s) -> PRE_START_5S (5s) -> PLAYING -> ASCENDING (14s)
      savedLights,
      slideTimer: 0,
      preStartTimer: PRE_START_DELAY,
      breakers,
      fixedCount: 0,
      repairingBoxId: null,
      holdingRepairF: false,
      monster: {
        active: false,
        x: startWp.col * TILE + 8,
        y: startWp.row * TILE + 8,
        facing: 1,
        wpIdx: 1,
        speed: 40 // Moderate patrol speed (slower than player's 54 walk / 88 sprint!)
      },
      notice: "THE FLOOR IS SHAKING! THE DINING ROOM IS SINKING INTO THE BASEMENT...",
      noticeTimer: 6.0,
      syncAccum: 0,
      repairSendAccum: 0,
      pendingGuestDelta: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    // Place player safely in The Dining Room during descent
    matchState.currentRoomCoord = { x: 0, y: 0 };
    if (player) {
      player.seated = false;
      player.crouching = false;
      player.x = 54;
      player.y = 132;
      player.facing = 1;
    }

    // Play 14-second basement_start_sfx.mp3 during violent shaking descent!
    if (App.Audio && App.Audio.playBasementSlide) {
      App.Audio.playBasementSlide(SLIDE_DURATION);
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE BASEMENT\nTHE DINING ROOM IS SLIDING UNDERGROUND...\nREPAIR ALL 5 RED FUSE BOXES [HOLD F] & HIDE IN WALL ALCOVES!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 6000);
    }

    return matchState.basementEvent;
  }

  function finishDescentIntoBasement(bm, player) {
    bm.stage = "PRE_START_5S";
    bm.preStartTimer = PRE_START_DELAY;
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();

    // Land player right in the center hydraulic shaft hub of the Basement Maze!
    if (player) {
      player.x = HUB_CENTER.x;
      player.y = HUB_CENTER.y;
      player.facing = 1;
    }
    bm.notice = "LANDED IN THE BASEMENT! EVENT BEGINS IN 5 SECONDS — LOOK FOR RED FUSE BOXES!";
    bm.noticeTimer = 5.0;
    App.Audio.clockChime();
  }

  function beginBasementHunt(bm) {
    bm.stage = "PLAYING";
    bm.monster.active = true;
    const wp0 = PATROL_WAYPOINTS[0];
    bm.monster.x = wp0.col * TILE + 8;
    bm.monster.y = wp0.row * TILE + 8;
    bm.monster.wpIdx = 1;
    bm.notice = "THE CHAINSAW ROARS TO LIFE! FIX ALL 5 RED BOXES [HOLD F] & DUCK INTO WALL ALCOVES!";
    bm.noticeTimer = 5.0;
    App.Audio.hexAlert();
  }

  function startVictoryAscent(bm, matchState, player) {
    closeBreakerModal(matchState, true);
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    bm.monster.active = false;
    bm.stage = "ASCENDING";
    bm.slideTimer = 0;

    // Reverse slide upward + same violent shake + audio/basement_start_sfx.mp3 (14s)!
    if (App.Audio && App.Audio.playBasementSlide) {
      App.Audio.playBasementSlide(SLIDE_DURATION);
    }
    bm.notice = "ALL 5 FUSE BOXES RESTORED! RISING BACK UP TO THE DINING ROOM...";
    bm.noticeTimer = 6.5;

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "ALL 5 FUSE BOXES REPAIRED!\nTHE BASEMENT LIFTS YOU BACK TO THE DINING ROOM...",
        { success: true, typingDurationSec: 3.2, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 4600);
    }
  }

  function finishVictoryAscent(bm, matchState, player) {
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    restoreRoomLights(matchState, bm.savedLights);

    bm.active = false;
    matchState.basementEvent = null;
    if (App.Events && App.Events.onEventWonBroadcast) {
      App.Events.onEventWonBroadcast(matchState, "the_basement", "ALL 5 FUSE BOXES REPAIRED!\nTHE BASEMENT LIFTS BACK UP — CELLAR DOOR UNLOCKED.");
    }
    matchState.currentRoomCoord = { x: 0, y: 0 };
    if (player) {
      player.seated = false;
      player.x = 54;
      player.y = 132;
      player.facing = 1;
    }
    App.Audio.clockChime();
  }

  function triggerChainsawDeath(matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm) return;

    closeBreakerModal(matchState, true);
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "the_basement", "sparky", "THE CHAINSAW MONSTER CAUGHT YOU!")
      : { keepEventRunning: false };

    if (res.keepEventRunning) {
      // Dead local player exits Basement maze to locked Cellar while teammates keep fixing fuse boxes!
      bm.localDeadInCellar = true;
    } else {
      restoreRoomLights(matchState, bm.savedLights);
      bm.active = false;
      matchState.basementEvent = null;
    }
  }

  function forceEndFromNetwork(matchState) {
    cleanup(matchState);
  }

  function syncChainsawSpatialAudio(bm, player) {
    if (!App.Audio || !App.Audio.setChainsawAttenuation) return;
    if (!bm || !bm.active || !bm.monster || !bm.monster.active) {
      if (App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
      return;
    }
    const dist = Math.hypot(player.x - bm.monster.x, player.y - bm.monster.y);
    const minDist = 18;
    const maxDist = 235;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const att = Math.pow(1 - t, 1.45);
    if (App.Audio.startChainsawLoop) App.Audio.startChainsawLoop();
    App.Audio.setChainsawAttenuation(att);
  }

  function update(dt, matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.localDeadInCellar) {
      if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
      return;
    }

    if (bm.noticeTimer > 0) {
      bm.noticeTimer = Math.max(0, bm.noticeTimer - dt);
      if (bm.noticeTimer === 0) bm.notice = "";
    }

    // GUEST: sends repair ticks to Host & follows Host's authoritative timers, breakers & Chainsaw position!
    if (isMpGuest(matchState)) {
      if (bm.stage === "DESCENDING" || bm.stage === "ASCENDING") {
        bm.slideTimer = Math.min(SLIDE_DURATION, bm.slideTimer + dt);
        return;
      }
      if (bm.stage === "PRE_START_5S") {
        bm.preStartTimer = Math.max(0, bm.preStartTimer - dt);
        return;
      }
      if (bm.repairingBoxId && bm.holdingRepairF) {
        const box = bm.breakers.find((b) => b.id === bm.repairingBoxId);
        if (box && !box.fixed) {
          const delta = dt / REPAIR_DURATION;
          box.progress = Math.min(0.99, box.progress + delta);
          bm.pendingGuestDelta = (bm.pendingGuestDelta || 0) + delta;
          bm.repairSendAccum = (bm.repairSendAccum || 0) + dt;
          repairSparkTimer -= dt;
          if (repairSparkTimer <= 0) {
            repairSparkTimer = 0.24;
            if (App.Audio && App.Audio.electricRepairTick) App.Audio.electricRepairTick();
          }
          syncBreakerModalUI(bm);
          if (bm.repairSendAccum >= 0.12) {
            App.Network.sendGameAction("MP_BASEMENT_REPAIR", { boxId: box.id, delta: bm.pendingGuestDelta });
            bm.repairSendAccum = 0;
            bm.pendingGuestDelta = 0;
          }
        }
      }
      if (bm.monster && bm.monster.active) {
        syncChainsawSpatialAudio(bm, player);
        if (!isPlayerInAlcove(player) && Math.hypot(bm.monster.x - player.x, bm.monster.y - player.y) <= 13.5) {
          triggerChainsawDeath(matchState);
        }
      }
      return;
    }

    // 1. 14-Second Violent Shaking Descent (HOST / SP)
    if (bm.stage === "DESCENDING") {
      bm.slideTimer += dt;
      if (bm.slideTimer >= SLIDE_DURATION) {
        finishDescentIntoBasement(bm, player);
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.35) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 2. 5-Second Calm Before Chainsaw Awakens
    if (bm.stage === "PRE_START_5S") {
      bm.preStartTimer -= dt;
      if (bm.preStartTimer <= 0) {
        beginBasementHunt(bm);
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.30) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 3. 14-Second Reverse Shaking Ascent After Win
    if (bm.stage === "ASCENDING") {
      bm.slideTimer += dt;
      if (bm.slideTimer >= SLIDE_DURATION) {
        finishVictoryAscent(bm, matchState, player);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.35) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 4. PLAYING STAGE: Repair Progress + Predefined Chainsaw Patrol!
    if (bm.repairingBoxId && bm.holdingRepairF) {
      applyHostBreakerDelta(matchState, player, bm.repairingBoxId, dt / REPAIR_DURATION, true);
    }

    const m = bm.monster;
    if (m.active) {
      const wp = PATROL_WAYPOINTS[m.wpIdx % PATROL_WAYPOINTS.length];
      const tx = wp.col * TILE + 8;
      const ty = wp.row * TILE + 8;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 3.0) {
        m.x = tx;
        m.y = ty;
        m.wpIdx = (m.wpIdx + 1) % PATROL_WAYPOINTS.length;
      } else {
        m.x += (dx / dist) * m.speed * dt;
        m.y += (dy / dist) * m.speed * dt;
        if (Math.abs(dx) > 0.3) m.facing = dx >= 0 ? 1 : -1;
      }

      syncChainsawSpatialAudio(bm, player);

      if (!isPlayerInAlcove(player)) {
        const catchDist = Math.hypot(m.x - player.x, m.y - player.y);
        if (catchDist <= 13.5) {
          triggerChainsawDeath(matchState);
        }
      }
    }

    if (isMpMode(matchState)) {
      bm.syncAccum = (bm.syncAccum || 0) + dt;
      if (bm.syncAccum >= 0.085) {
        bm.syncAccum = 0;
        broadcastStateNow(matchState);
      }
    }
  }

  // ==================== 6. CONTROLS, COLLISION & SHAKE ====================
  function onKeyFDown(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING") return false;

    if (bm.repairingBoxId) {
      bm.holdingRepairF = true;
      syncBreakerModalUI(bm);
      return true;
    }

    // Check nearby unrepaired breaker/fuse box!
    for (const box of bm.breakers) {
      if (box.fixed) continue;
      if (Math.hypot(player.x - box.x, player.y - box.y) <= 24) {
        return openBreakerModal(matchState, box);
      }
    }
    return false;
  }

  function onKeyFUp(matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || !bm.repairingBoxId) return false;
    bm.holdingRepairF = false;
    syncBreakerModalUI(bm);
    return true;
  }

  function collidesInBasement(nx, ny) {
    const halfW = 3.5;
    const pts = [
      [nx - halfW, ny - 5],
      [nx + halfW, ny - 5],
      [nx - halfW, ny + 1],
      [nx + halfW, ny + 1]
    ];
    for (let i = 0; i < pts.length; i++) {
      const col = Math.floor(pts[i][0] / TILE);
      const row = Math.floor(pts[i][1] / TILE);
      if (isWallTile(col, row)) return true;
    }
    return false;
  }

  function getShakeOffset(matchState, timeSec) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return { x: 0, y: 0 };
    if (bm.stage !== "DESCENDING" && bm.stage !== "ASCENDING") return { x: 0, y: 0 };
    // Violent subterranean hydraulic earthquake shake throughout the 14s slide!
    const frac = Math.min(1, bm.slideTimer / SLIDE_DURATION);
    const ramp = Math.sin(frac * Math.PI); // Smooth violent swell peaking in middle of slide
    const amp = 4.5 + ramp * 6.5;
    return {
      x: Math.round((Math.sin(timeSec * 61) + Math.cos(timeSec * 47)) * amp * 0.55),
      y: Math.round((Math.cos(timeSec * 53) + Math.sin(timeSec * 79)) * amp * 0.55)
    };
  }

  function getPrompt(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING" || bm.repairingBoxId) return null;

    for (const box of bm.breakers) {
      if (box.fixed) continue;
      if (Math.hypot(player.x - box.x, player.y - box.y) <= 24) {
        return { type: "basement_breaker", prompt: `[F] INSPECT & REPAIR ${box.label}` };
      }
    }
    if (isPlayerInAlcove(player)) {
      return { type: "basement_alcove", prompt: "HIDDEN IN WALL ALCOVE — SAFE FROM CHAINSAW" };
    }
    return null;
  }

  // ==================== 7. RENDERER (DESCENT / MAZE / REVERSE ASCENT) ====================
  function renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, overrideCenter) {
    const bm = matchState && matchState.basementEvent;
    if (!staticMazeCanvas) buildStaticBasementMaze();

    const focusX = overrideCenter ? overrideCenter.x : player.x;
    const focusY = overrideCenter ? overrideCenter.y : player.y;
    const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, Math.round(focusX - VIEW_W / 2)));
    const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, Math.round(focusY - VIEW_H / 2)));

    // 1. Draw Basement Maze floor & concrete walls
    ctx.drawImage(staticMazeCanvas, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    // 2. Draw all 5 Breaker/Fuse Boxes mounted on their walls
    if (bm && bm.breakers) {
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY;
        if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) return;
        drawBreakerBoxInMaze(ctx, sx, sy, b.fixed, timeSec);
      });
    }

    // 3. Depth-sort Player & Tall Chainsaw-Head Monster
    const actors = [];
    if (player && !overrideCenter) {
      actors.push({
        y: player.y,
        draw: () => {
          const spriteCfg = Object.assign({}, charConfig, {
            facing: player.facing,
            walking: player.moving,
            lantern: player.lanternOn
          });
          App.Character.drawInWorld(ctx, player.x - camX, player.y - camY, spriteCfg, timeSec, {
            seated: false,
            sprinting: player.sprinting,
            crouching: player.crouching
          });
        }
      });
    }
    if (bm && bm.monster && bm.monster.active) {
      const m = bm.monster;
      actors.push({
        y: m.y,
        draw: () => drawChainsawMonsterSprite(ctx, m.x - camX, m.y - camY, timeSec, m.facing)
      });
    }
    actors.sort((a, b) => a.y - b.y);
    actors.forEach((a) => a.draw());

    // 4. Deep Subterranean Darkness Mask
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, VIEW_W, VIEW_H);
    mctx.fillStyle = "rgba(3, 4, 7, 0.92)";
    mctx.fillRect(0, 0, VIEW_W, VIEW_H);

    mctx.globalCompositeOperation = "destination-out";

    // (a) Player handheld lantern or faint close-range halo
    if (player && !overrideCenter) {
      const pxv = player.x - camX;
      const pyv = player.y - camY - 8;
      const rad = player.lanternOn ? 58 : 26;
      const lg = mctx.createRadialGradient(pxv, pyv, 4, pxv, pyv, rad);
      lg.addColorStop(0, player.lanternOn ? "rgba(0,0,0,0.96)" : "rgba(0,0,0,0.58)");
      lg.addColorStop(0.55, player.lanternOn ? "rgba(0,0,0,0.62)" : "rgba(0,0,0,0.25)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = lg;
      mctx.fillRect(pxv - rad - 2, pyv - rad - 2, rad * 2 + 4, rad * 2 + 4);
    }

    // (b) Central shaft hub overhead dim light
    const hx = HUB_CENTER.x - camX;
    const hy = HUB_CENTER.y - camY;
    const hg = mctx.createRadialGradient(hx, hy, 6, hx, hy, 44);
    hg.addColorStop(0, "rgba(0,0,0,0.72)");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = hg;
    mctx.fillRect(hx - 46, hy - 46, 92, 92);

    // (c) Breaker Boxes punch clearly through darkness so RED/GREEN beacons shine across corridors!
    if (bm && bm.breakers) {
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY - 2;
        if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) return;
        const br = b.fixed ? 28 : 34;
        const bg = mctx.createRadialGradient(sx, sy, 3, sx, sy, br);
        bg.addColorStop(0, "rgba(0,0,0,0.92)");
        bg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = bg;
        mctx.fillRect(sx - br, sy - br, br * 2, br * 2);
      });
    }

    // (d) Faint ominous reveal around Chainsaw Monster so its silhouette & chainsaw teeth gleam!
    if (bm && bm.monster && bm.monster.active) {
      const mx = bm.monster.x - camX;
      const my = bm.monster.y - camY - 18;
      const mg = mctx.createRadialGradient(mx, my, 3, mx, my, 28);
      mg.addColorStop(0, "rgba(0,0,0,0.72)");
      mg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = mg;
      mctx.fillRect(mx - 28, my - 28, 56, 56);
    }

    ctx.drawImage(maskCanvas, 0, 0);

    // 5. Post-darkness colored lighting:
    //    - RED glow + crackling electric leak arcs (`rỉ điện`) on unrepaired boxes!
    //    - Bright GREEN glow on repaired boxes!
    if (bm && bm.breakers) {
      const pulse = 0.70 + Math.sin(timeSec * 6.0) * 0.30;
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY - 2;
        if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) return;

        const rad = b.fixed ? 24 : 30;
        const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad);
        if (b.fixed) {
          glow.addColorStop(0, "rgba(74, 245, 134, 0.44)");
          glow.addColorStop(1, "rgba(40, 200, 95, 0)");
        } else {
          glow.addColorStop(0, `rgba(255, 42, 42, ${(0.52 * pulse).toFixed(3)})`);
          glow.addColorStop(0.55, `rgba(210, 22, 22, ${(0.22 * pulse).toFixed(3)})`);
          glow.addColorStop(1, "rgba(180, 0, 0, 0)");
        }
        ctx.fillStyle = glow;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);

        if (!b.fixed) {
          drawElectricLeakArcs(ctx, sx, sy, timeSec, b.seed);
        }
      });
    }

    // Subtle warm lantern tint
    if (player && !overrideCenter && player.lanternOn) {
      const lx = player.x - camX + player.facing * 7;
      const ly = player.y - camY - 8;
      const wg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 44);
      wg.addColorStop(0, "rgba(255, 212, 128, 0.20)");
      wg.addColorStop(1, "rgba(255, 180, 80, 0)");
      ctx.fillStyle = wg;
      ctx.fillRect(lx - 44, ly - 44, 88, 88);
    }

    return { camX, camY };
  }

  // Dramatic 14-Second Vertical Slide Transition (DESCENDING down into Basement OR ASCENDING back up!)
  function renderSlideCutscene(ctx, timeSec, player, charConfig, matchState) {
    const bm = matchState && matchState.basementEvent;
    const isAscending = bm && bm.stage === "ASCENDING";
    const rawFrac = bm ? Math.max(0, Math.min(1, bm.slideTimer / SLIDE_DURATION)) : 0;
    const ease = rawFrac < 0.5 ? 2 * rawFrac * rawFrac : 1 - Math.pow(-2 * rawFrac + 2, 2) / 2;

    // 1. Render Dining Room into offscreen buffer
    const flick = 0.55 + Math.sin(timeSec * 29) * 0.35;
    App.GameRoom.render(dsctx, timeSec, Math.max(0.18, flick), player, charConfig, matchState);

    // 2. Render Basement Hub directly underneath (or behind during reverse ascent!)
    renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, HUB_CENTER);

    // 3. Draw vertical subterranean shaft stripes & sliding Dining Room!
    //    - DESCENDING: Dining Room starts at y=0 and gradually slides DOWN (y = 0 -> +208) shrinking slightly into the shaft,
    //      then opens up into the Basement Hub as dust & concrete walls rush past!
    //    - ASCENDING: Exact reverse! Dining Room slides UP from below / descends back into full frame (y = +208 -> 0)!
    const progressDown = isAscending ? (1 - ease) : ease;

    // Sliding vertical shaft dust & rock strata moving past edges
    const wallShift = Math.floor((timeSec * (isAscending ? -130 : 130)) % 24);
    ctx.fillStyle = "rgba(18, 16, 15, 0.72)";
    ctx.fillRect(0, 0, 14, VIEW_H);
    ctx.fillRect(VIEW_W - 14, 0, 14, VIEW_H);
    for (let y = -24; y < VIEW_H + 24; y += 24) {
      const sy = y + wallShift;
      px(ctx, 2, sy, 10, 4, "#3b3834");
      px(ctx, VIEW_W - 12, sy, 10, 4, "#3b3834");
      px(ctx, 13, sy, 2, 24, "#6b5426"); // Steel elevator guide rail
      px(ctx, VIEW_W - 15, sy, 2, 24, "#6b5426");
    }

    // Dining Room visibly slides vertically along the hydraulic shaft!
    const slideOffsetY = Math.round(progressDown * VIEW_H);
    const diningAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, (progressDown - 0.68) / 0.32)));

    if (diningAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = diningAlpha;
      // Draw Dining Room sliding down out of frame (or rising back up into frame on reverse!)
      ctx.drawImage(diningSlideBuf, 0, slideOffsetY);
      // Heavy iron hydraulic floor seam bar across top edge of sliding room
      px(ctx, 0, slideOffsetY - 4, VIEW_W, 5, "#262320");
      for (let hx = 0; hx < VIEW_W; hx += 16) {
        px(ctx, hx, slideOffsetY - 3, 8, 3, "#d4a238");
      }
      ctx.restore();
    }

    // Falling dust motes during violent descent/ascent
    for (let i = 0; i < 16; i++) {
      const dx = (i * 37 + Math.floor(timeSec * 19)) % VIEW_W;
      const dy = ((i * 53 + Math.floor(timeSec * (isAscending ? -95 : 95))) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.fillStyle = "rgba(195, 185, 165, 0.45)";
      ctx.fillRect(dx, dy, 2, 2);
    }

    return { camX: 0, camY: 0 };
  }

  function renderViewport(ctx, timeSec, player, charConfig, matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return { camX: 0, camY: 0 };
    if (bm.stage === "DESCENDING" || bm.stage === "ASCENDING") {
      return renderSlideCutscene(ctx, timeSec, player, charConfig, matchState);
    }
    return renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, null);
  }

  // ==================== 8. HUD & STATE HELPERS ====================
  function getHudSummary(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return null;

    if (bm.stage === "DESCENDING") {
      return {
        title: `THE BASEMENT • DESCENDING (${Math.max(1, Math.ceil(SLIDE_DURATION - bm.slideTimer))}S)`,
        sub: "THE DINING ROOM IS SLIDING UNDERGROUND...",
        notice: bm.notice || ""
      };
    }
    if (bm.stage === "PRE_START_5S") {
      return {
        title: `THE BASEMENT • STARTING IN ${Math.max(1, Math.ceil(bm.preStartTimer))}S`,
        sub: "LOCATE THE RED FUSE BOXES & NEARBY RECESSED WALL ALCOVES!",
        notice: bm.notice || ""
      };
    }
    if (bm.stage === "ASCENDING") {
      return {
        title: `THE BASEMENT CLEARED • RISING UP (${Math.max(1, Math.ceil(SLIDE_DURATION - bm.slideTimer))}S)`,
        sub: "SLIDING BACK UP TO THE DINING ROOM...",
        notice: bm.notice || ""
      };
    }
    const hiddenTag = isPlayerInAlcove(player) ? "HIDDEN IN WALL ALCOVE (SAFE)" : "IN CORRIDOR (WATCH FOR CHAINSAW!)";
    return {
      title: `THE BASEMENT • FUSE BOXES REPAIRED: ${bm.fixedCount} / ${bm.breakers.length}`,
      sub: `${hiddenTag}  |  [F] REPAIR BOX`,
      notice: bm.notice || ""
    };
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.basementEvent && matchState.basementEvent.active);
  }

  function isInBasementMap(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && !bm.localDeadInCellar && (bm.stage === "PRE_START_5S" || bm.stage === "PLAYING"));
  }

  function isLocalInBasementView(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && !bm.localDeadInCellar);
  }

  function isSlideCutscene(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && (bm.stage === "DESCENDING" || bm.stage === "ASCENDING"));
  }

  function isRepairModalOpen(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && bm.repairingBoxId);
  }

  function applyHostBreakerDelta(matchState, player, boxId, delta, isLocalHost) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING") return;
    const box = bm.breakers.find((b) => b.id === boxId);
    if (!box || box.fixed) return;

    box.progress = Math.min(1.0, (box.progress || 0) + Math.max(0, delta || 0));
    if (isLocalHost) {
      repairSparkTimer -= (delta || 0) * REPAIR_DURATION;
      if (repairSparkTimer <= 0) {
        repairSparkTimer = 0.24;
        if (App.Audio && App.Audio.electricRepairTick) App.Audio.electricRepairTick();
      }
      syncBreakerModalUI(bm);
    }

    if (box.progress >= 1.0) {
      box.fixed = true;
      bm.fixedCount = bm.breakers.filter((b) => b.fixed).length;
      const allDone = bm.fixedCount >= bm.breakers.length;
      if (App.Audio && App.Audio.breakerFixed) App.Audio.breakerFixed(allDone);
      if (bm.repairingBoxId === box.id) {
        syncBreakerModalUI(bm);
        bm.holdingRepairF = false;
      }
      if (isMpMode(matchState)) broadcastStateNow(matchState, { fixedBoxId: box.id });

      if (allDone) {
        setTimeout(() => {
          if (matchState.basementEvent && matchState.basementEvent.active) {
            startVictoryAscent(matchState.basementEvent, matchState, player);
            if (isMpMode(matchState)) broadcastStateNow(matchState);
          }
        }, 420);
      } else {
        bm.notice = `${box.label} REPAIRED (${bm.fixedCount}/5)!`;
        bm.noticeTimer = 3.0;
        if (bm.repairingBoxId === box.id) {
          setTimeout(() => {
            if (matchState.basementEvent && matchState.basementEvent.repairingBoxId === box.id) {
              closeBreakerModal(matchState, true);
            }
          }, 340);
        }
      }
    }
  }

  function broadcastStateNow(matchState, extra) {
    if (!matchState || !isMpMode(matchState) || !isMpHost(matchState)) return;
    const bm = matchState.basementEvent;
    if (!bm || !bm.active) return;
    App.Network.sendGameAction("MP_BASEMENT_STATE", Object.assign({
      stage: bm.stage,
      slideTimer: Math.round((bm.slideTimer || 0) * 10) / 10,
      preStartTimer: Math.round((bm.preStartTimer || 0) * 10) / 10,
      fixedCount: bm.fixedCount || 0,
      breakers: bm.breakers.map((b) => ({ id: b.id, progress: Math.round((b.progress || 0) * 100) / 100, fixed: Boolean(b.fixed) })),
      monster: {
        active: Boolean(bm.monster.active),
        x: Math.round(bm.monster.x * 10) / 10,
        y: Math.round(bm.monster.y * 10) / 10,
        facing: bm.monster.facing
      },
      notice: bm.notice || "",
      noticeTimer: bm.noticeTimer || 0
    }, extra || {}));
  }

  function handleNetworkMessage(action, payload, matchState, player) {
    if (!matchState || !action) return false;
    const p = payload || {};

    if (action === "MP_BASEMENT_REPAIR") {
      if (isMpHost(matchState) && p.boxId && typeof p.delta === "number") {
        applyHostBreakerDelta(matchState, player, p.boxId, p.delta, false);
      }
      return true;
    }

    if (action === "MP_BASEMENT_STATE") {
      if (!isMpGuest(matchState)) return true;
      if (!matchState.basementEvent) startBasementEvent(matchState, player);
      const bm = matchState.basementEvent;
      if (!bm) return true;

      const prevStage = bm.stage;
      bm.stage = p.stage || bm.stage;
      bm.slideTimer = typeof p.slideTimer === "number" ? p.slideTimer : bm.slideTimer;
      bm.preStartTimer = typeof p.preStartTimer === "number" ? p.preStartTimer : bm.preStartTimer;
      bm.fixedCount = typeof p.fixedCount === "number" ? p.fixedCount : bm.fixedCount;

      if (Array.isArray(p.breakers)) {
        p.breakers.forEach((nb) => {
          const loc = bm.breakers.find((x) => x.id === nb.id);
          if (!loc) return;
          const wasFixed = loc.fixed;
          loc.progress = Math.max(loc.progress || 0, nb.progress || 0);
          if (nb.fixed) {
            loc.progress = 1.0;
            loc.fixed = true;
            if (!wasFixed) {
              if (App.Audio && App.Audio.breakerFixed) App.Audio.breakerFixed(bm.fixedCount >= 5);
              if (bm.repairingBoxId === loc.id) {
                syncBreakerModalUI(bm);
                bm.holdingRepairF = false;
                setTimeout(() => {
                  if (matchState.basementEvent && matchState.basementEvent.repairingBoxId === loc.id) {
                    closeBreakerModal(matchState, true);
                  }
                }, 300);
              }
            }
          }
        });
        if (bm.repairingBoxId) syncBreakerModalUI(bm);
      }

      if (p.monster) Object.assign(bm.monster, p.monster);
      if (p.notice) { bm.notice = p.notice; bm.noticeTimer = p.noticeTimer || 2.5; }

      if (prevStage === "DESCENDING" && bm.stage === "PRE_START_5S" && !bm.localDeadInCellar) {
        finishDescentIntoBasement(bm, player);
      } else if (prevStage === "PRE_START_5S" && bm.stage === "PLAYING") {
        bm.monster.active = true;
        App.Audio.hexAlert();
      } else if (prevStage !== "ASCENDING" && bm.stage === "ASCENDING") {
        startVictoryAscent(bm, matchState, player);
      }
      return true;
    }
    return false;
  }

  function cleanup(matchState) {
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    document.getElementById("basement-breaker-modal")?.classList.add("hidden");
    if (App.Jumpscare) App.Jumpscare.stop();
    if (matchState) matchState.basementEvent = null;
  }

  App.Basement = {
    startBasementEvent,
    onKeyFDown,
    onKeyFUp,
    closeBreakerModal,
    update,
    collidesInBasement,
    getShakeOffset,
    getPrompt,
    renderViewport,
    getHudSummary,
    forceEndFromNetwork,
    isActive,
    isLocalInBasementView,
    isInBasementMap,
    isSlideCutscene,
    isRepairModalOpen,
    isPlayerInAlcove,
    broadcastStateNow,
    handleNetworkMessage,
    cleanup
  };
})(window.Duskwood);
