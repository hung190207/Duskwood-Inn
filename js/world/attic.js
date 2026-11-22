/* ==========================================================================
   DUSKWOOD INN - THE ATTIC Event Engine (Warehouse Maze + 5 Totems + Ghost)
   - Triggers immediately when `hx_attic` is drawn (only eligible when >6 rooms!)
   - Spawns a pull-down wooden Attic Ladder in a random built cabin room
   - Climbing up enters a dark 23x19 (368x304) Warehouse Maze viewed through
     a tight 208x208 Stardew camera (no Lantern allowed; dim flickering candle!)
   - Center of Attic: Summoning Circle + Ritual Candle + Attic Hatch/Ladder
   - 5 Distinct Totems randomly placed on crates, shelves, barrels & floors:
       1) SKULL (Đầu sọ)
       2) BLACK ROSE (Bông hồng đen)
       3) STRAW DOLL (Người rơm nhỏ)
       4) TABLE SALT (Muối ăn)
       5) HAND MIRROR (Gương cầm tay)
     * Totems emit a soft pale-blue shimmer when player passes nearby holding the Candle!
   - Controls in the Attic:
       [F] Pick up Candle / Totem, or Place held Totem onto the Summoning Circle
       [X] Drop held item (holds BOTH Candle & Totem; 1st X drops Candle, 2nd X drops Totem!)
       [E] Climb Ladder down to the room below (or Place Totem at Circle)
   - Ghost Stalker (pixel-art specter matching image_7d1121.png):
       * Spawns at random intervals & hunts player relentlessly via BFS maze pathfinding
         while player holds the Candle!
       * If player drops the Candle ([X]) and runs into a dark corner away from candlelight,
         the Ghost loses target, drifts briefly, and dissolves back into the shadows!
       * Placing all 5 Totems triggers the Ghost Burning exorcism animation in the center
         Summoning Circle -> Player Wins & climbs back down the same ladder!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const TILE = 16;
  const COLS = 23;
  const ROWS = 19;
  const WORLD_W = COLS * TILE; // 368
  const WORLD_H = ROWS * TILE; // 304
  const VIEW_W = 208;
  const VIEW_H = 208;

  // Handcrafted 23x19 Attic Warehouse Maze (100% BFS-verified connected, rich loops & dark hiding corners!)
  const MAZE_LINES = [
    "#######################", // 0
    "#.....#.......#.......#", // 1
    "#.###.#.#####.#.#####.#", // 2
    "#.#...#.....#...#.....#", // 3
    "#.#.#######.###.#.###.#", // 4
    "#.#.......#.....#.#...#", // 5
    "#.#######.#.#####.#.###", // 6
    "#.......#...C...#.....#", // 7
    "###.###.#.CCCCC.#.###.#", // 8
    "#...#.....CCCCC.....#.#", // 9  (Center Circle = col 11, row 9 => 184, 152)
    "#.###.###.CCCCC.###.#.#", // 10
    "#.#.....#.CCCCC.#.....#", // 11
    "#.#.###.#...L...#.###.#", // 12 (Ladder Hatch = col 11, row 12 => 184, 200)
    "#...#...###.#.###...#.#", // 13
    "#.###.#.....#.....#.#.#", // 14
    "#.....#.###.#.###.#...#", // 15
    "#.#####.#...#...#.###.#", // 16
    "#.......#.......#.....#", // 17
    "#######################"  // 18
  ];

  const CIRCLE_CENTER = { x: 11 * TILE + 8, y: 9 * TILE + 8 }; // (184, 152)
  const LADDER_POS    = { x: 11 * TILE + 8, y: 12 * TILE + 8 }; // (184, 200)

  // 5 Pentagram Pedestal Slots around the Summoning Circle
  const CIRCLE_SLOTS = [
    { x: CIRCLE_CENTER.x,      y: CIRCLE_CENTER.y - 20 },
    { x: CIRCLE_CENTER.x + 19, y: CIRCLE_CENTER.y - 6  },
    { x: CIRCLE_CENTER.x + 12, y: CIRCLE_CENTER.y + 17 },
    { x: CIRCLE_CENTER.x - 12, y: CIRCLE_CENTER.y + 17 },
    { x: CIRCLE_CENTER.x - 19, y: CIRCLE_CENTER.y - 6  }
  ];

  const TOTEM_DEFS = [
    { id: "skull",       name: "SKULL",       short: "SKULL"  },
    { id: "black_rose",  name: "BLACK ROSE",  short: "ROSE"   },
    { id: "straw_doll",  name: "STRAW DOLL",  short: "DOLL"   },
    { id: "salt",        name: "TABLE SALT",  short: "SALT"   },
    { id: "hand_mirror", name: "HAND MIRROR", short: "MIRROR" }
  ];

  // 20 diverse warehouse hiding spots across all 4 wings (crates, shelves, barrels, dusty floors)
  const TOTEM_CANDIDATE_SPOTS = [
    { col: 1,  row: 1,  surface: "crate",  wing: "NW" },
    { col: 5,  row: 1,  surface: "floor",  wing: "NW" },
    { col: 11, row: 1,  surface: "shelf",  wing: "N"  },
    { col: 17, row: 1,  surface: "barrel", wing: "NE" },
    { col: 21, row: 1,  surface: "crate",  wing: "NE" },
    { col: 3,  row: 3,  surface: "shelf",  wing: "NW" },
    { col: 11, row: 3,  surface: "crate",  wing: "N"  },
    { col: 21, row: 3,  surface: "floor",  wing: "NE" },
    { col: 1,  row: 7,  surface: "barrel", wing: "W"  },
    { col: 21, row: 7,  surface: "crate",  wing: "E"  },
    { col: 1,  row: 9,  surface: "crate",  wing: "W"  },
    { col: 21, row: 11, surface: "shelf",  wing: "E"  },
    { col: 1,  row: 13, surface: "floor",  wing: "SW" },
    { col: 7,  row: 14, surface: "crate",  wing: "SW" },
    { col: 15, row: 14, surface: "barrel", wing: "SE" },
    { col: 1,  row: 17, surface: "crate",  wing: "SW" },
    { col: 7,  row: 17, surface: "shelf",  wing: "S"  },
    { col: 11, row: 17, surface: "floor",  wing: "S"  },
    { col: 15, row: 17, surface: "crate",  wing: "SE" },
    { col: 21, row: 17, surface: "barrel", wing: "SE" }
  ];

  let staticMazeCanvas = null;

  // Reusable darkness mask canvas for the 208x208 camera viewport
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const mctx = maskCanvas.getContext("2d");

  // Offscreen ghost sprite canvas (24x28 pixel art modeled after image_7d1121.png!)
  const ghostBuf = document.createElement("canvas");
  ghostBuf.width = 24;
  ghostBuf.height = 28;
  const gctx = ghostBuf.getContext("2d");
  gctx.imageSmoothingEnabled = false;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function isWallTile(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
    return MAZE_LINES[row][col] === "#";
  }

  // ==================== 1. BUILD STATIC WAREHOUSE ATTIC MAZE CANVAS ====================
  function buildStaticMaze() {
    staticMazeCanvas = document.createElement("canvas");
    staticMazeCanvas.width = WORLD_W;
    staticMazeCanvas.height = WORLD_H;
    const c = staticMazeCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    // 1. Dusty aged attic floorboards across entire warehouse
    const plankCols = ["#4a3423", "#422d1e", "#523a27", "#3c291b"];
    for (let y = 0; y < WORLD_H; y += 8) {
      const rowIdx = Math.floor(y / 8);
      for (let x = 0; x < WORLD_W; x += 24) {
        const shift = (rowIdx % 2) * 12;
        const col = plankCols[(rowIdx * 3 + Math.abs(Math.floor(x / 24))) % plankCols.length];
        px(c, x - shift, y, 24, 7, col);
        px(c, x - shift, y + 7, 24, 1, "#26180f");
        px(c, x - shift, y, 1, 7, "#2e1e13");
      }
    }

    // 2. Draw warehouse obstacles on every '#' tile (stacked shipping crates, wooden storage racks, dusty beams)
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        if (!isWallTile(col, r)) continue;
        const x = col * TILE;
        const y = r * TILE;
        const isBorder = r === 0 || r === ROWS - 1 || col === 0 || col === COLS - 1;
        const hash = (col * 31 + r * 17) % 5;

        if (isBorder) {
          // Heavy timber attic eaves & dark sloped perimeter wall
          px(c, x, y, TILE, TILE, "#1a110b");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#2b1c12");
          px(c, x + 2, y + 2, TILE - 4, 4, "#3b2619");
          px(c, x, y + TILE - 2, TILE, 2, "#120b07");
        } else if (hash === 0 || hash === 2) {
          // Stacked Warehouse Wooden Shipping Crates!
          px(c, x, y, TILE, TILE, "#180f0a");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#5c3b23");
          px(c, x + 1, y + 1, TILE - 2, 2, "#785032");
          px(c, x + 3, y + 4, TILE - 6, TILE - 7, "#3f2717");
          // Diagonal crate brace
          for (let d = 0; d < 8; d++) {
            px(c, x + 3 + d, y + 4 + d, 2, 1, "#664228");
          }
          // Subtle drop shadow below crate onto south floor
          if (!isWallTile(col, r + 1)) {
            c.fillStyle = "rgba(0,0,0,0.42)";
            c.fillRect(x, y + TILE, TILE, 3);
          }
        } else if (hash === 1 || hash === 3) {
          // Tall Industrial Warehouse Storage Shelving Rack with dusty boxes & tarps
          px(c, x, y, TILE, TILE, "#16110e");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#34271e");
          px(c, x + 1, y + 1, 2, TILE - 2, "#594230");
          px(c, x + TILE - 3, y + 1, 2, TILE - 2, "#4a3626");
          // Shelf planks & clutter boxes
          px(c, x + 3, y + 3, 5, 5, "#6b4b32");
          px(c, x + 9, y + 4, 4, 4, "#4b5954");
          px(c, x + 2, y + 8, TILE - 4, 2, "#6e4c30");
          px(c, x + 4, y + 10, 8, 4, "#543a27");
          if (!isWallTile(col, r + 1)) {
            c.fillStyle = "rgba(0,0,0,0.45)";
            c.fillRect(x, y + TILE, TILE, 3);
          }
        } else {
          // Tarp-draped antique storage stack & barrels
          px(c, x, y, TILE, TILE, "#181412");
          px(c, x + 1, y + 2, TILE - 2, TILE - 3, "#454b4f");
          px(c, x + 2, y + 3, TILE - 4, 4, "#5d656b");
          px(c, x + 3, y + 8, TILE - 6, 4, "#363b3e");
          if (!isWallTile(col, r + 1)) {
            c.fillStyle = "rgba(0,0,0,0.40)";
            c.fillRect(x, y + TILE, TILE, 3);
          }
        }
      }
    }

    // 3. Draw Center Ritual Summoning Circle on the attic floor (184, 152)
    c.save();
    c.strokeStyle = "#8a2929";
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(CIRCLE_CENTER.x, CIRCLE_CENTER.y, 26, 0, Math.PI * 2);
    c.stroke();

    c.strokeStyle = "#b54238";
    c.lineWidth = 1.1;
    c.beginPath();
    c.arc(CIRCLE_CENTER.x, CIRCLE_CENTER.y, 22, 0, Math.PI * 2);
    c.stroke();

    // Inner chalk pentagram connecting the 5 totem pedestal slots
    c.strokeStyle = "rgba(218, 180, 140, 0.52)";
    c.lineWidth = 1.1;
    const order = [0, 2, 4, 1, 3, 0];
    c.beginPath();
    order.forEach((idx, i) => {
      const pt = CIRCLE_SLOTS[idx];
      if (i === 0) c.moveTo(pt.x, pt.y);
      else c.lineTo(pt.x, pt.y);
    });
    c.stroke();

    // 5 small rune slot rings around the circle
    CIRCLE_SLOTS.forEach((pt) => {
      c.fillStyle = "#261412";
      c.beginPath();
      c.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#b88a52";
      c.lineWidth = 1;
      c.stroke();
    });
    c.restore();

    // 4. Draw Open Attic Hatch & Wooden Pull-Down Ladder at LADDER_POS (184, 200)
    const lx = LADDER_POS.x - 8;
    const ly = LADDER_POS.y - 7;
    px(c, lx - 1, ly - 1, 18, 16, "#1f120a");
    px(c, lx, ly, 16, 14, "#08070a"); // Deep stair shaft going downstairs
    // Wooden ladder side rails & rungs
    px(c, lx + 2, ly + 1, 2, 13, "#8a5c38");
    px(c, lx + 12, ly + 1, 2, 13, "#8a5c38");
    px(c, lx + 4, ly + 3, 8, 2, "#a87448");
    px(c, lx + 4, ly + 7, 8, 2, "#a87448");
    px(c, lx + 4, ly + 11, 8, 2, "#a87448");
  }

  // ==================== 2. PIXEL-ART TOTEMS, CANDLE & SURFACE PROPS ====================
  function drawRestingSurfaceProp(c, x, y, surface) {
    if (surface === "crate") {
      // Small low storage crate prop that the totem rests on top of!
      px(c, x - 6, y - 2, 12, 9, "#1c110a");
      px(c, x - 5, y - 1, 10, 7, "#694429");
      px(c, x - 5, y - 1, 10, 2, "#875c3a");
      px(c, x - 3, y + 1, 6, 4, "#472c1a");
    } else if (surface === "barrel") {
      px(c, x - 5, y - 2, 10, 9, "#1a110b");
      px(c, x - 4, y - 1, 8, 7, "#5e3c24");
      px(c, x - 4, y + 1, 8, 1, "#3b4047");
      px(c, x - 4, y + 4, 8, 1, "#3b4047");
    } else if (surface === "shelf") {
      // Low wooden storage stool / shelf edge
      px(c, x - 6, y - 2, 12, 7, "#24160d");
      px(c, x - 5, y - 1, 10, 4, "#754c2e");
      px(c, x - 5, y + 3, 2, 3, "#472b19");
      px(c, x + 3, y + 3, 2, 3, "#472b19");
    }
    // "floor" rests directly on dusty floorboards
  }

  function drawTotemSprite(c, x, y, totemId) {
    const cx = Math.round(x);
    const cy = Math.round(y);

    if (totemId === "skull") {
      // Đầu sọ (Pale ivory skull)
      px(c, cx - 3, cy - 5, 7, 6, "#1a1412");
      px(c, cx - 2, cy - 4, 5, 4, "#f2ebd9");
      px(c, cx - 1, cy, 3, 2, "#dcd2bc");
      px(c, cx - 2, cy - 2, 2, 2, "#1c1512");
      px(c, cx + 1, cy - 2, 2, 2, "#1c1512");
    } else if (totemId === "black_rose") {
      // Bông hồng đen (Obsidian black rose with dark green thorny stem)
      px(c, cx, cy - 1, 1, 5, "#24472c");
      px(c, cx - 2, cy + 1, 2, 1, "#2f5e39");
      px(c, cx - 3, cy - 5, 7, 5, "#0d090f");
      px(c, cx - 2, cy - 4, 5, 3, "#26172b");
      px(c, cx - 1, cy - 3, 3, 2, "#4a243d");
      px(c, cx, cy - 3, 1, 1, "#6e3148");
    } else if (totemId === "straw_doll") {
      // Người rơm nhỏ (Miniature tied golden straw effigy)
      px(c, cx - 1, cy - 6, 3, 3, "#d6b05c"); // Head
      px(c, cx - 4, cy - 3, 9, 2, "#c49b45"); // Outstretched straw arms
      px(c, cx - 1, cy - 3, 3, 5, "#cfa54e"); // Body
      px(c, cx - 2, cy + 2, 2, 3, "#b58b38"); // Legs
      px(c, cx + 1, cy + 2, 2, 3, "#b58b38");
      px(c, cx - 1, cy - 1, 3, 1, "#7d2929"); // Red twine waist tie
    } else if (totemId === "salt") {
      // Muối ăn (Ceramic salt jar / burlap pouch overflowing with white salt)
      px(c, cx - 3, cy - 4, 7, 7, "#241b16");
      px(c, cx - 2, cy - 3, 5, 5, "#8c7258");
      px(c, cx - 2, cy - 4, 5, 2, "#ffffff"); // Bright white salt heap on top
      px(c, cx - 1, cy - 5, 3, 1, "#eef5ff");
      px(c, cx - 2, cy - 1, 5, 1, "#d9cfc0"); // Label stripe
    } else {
      // Gương cầm tay (Ornate antique silver hand mirror)
      px(c, cx, cy, 2, 5, "#594126"); // Handle
      px(c, cx - 3, cy - 6, 7, 7, "#828c99"); // Silver oval frame
      px(c, cx - 2, cy - 5, 5, 5, "#b8d6e6"); // Reflective glass
      px(c, cx - 1, cy - 4, 2, 2, "#ffffff"); // Specular glint
    }
  }

  function drawCandleSprite(c, x, y, timeSec) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const flick = Math.sin(timeSec * 14) > 0 ? 1 : 0;
    px(c, cx - 2, cy + 1, 5, 2, "#5c4320"); // Brass saucer holder
    px(c, cx - 1, cy - 4, 3, 5, "#f0e6cc"); // Melting wax column
    px(c, cx, cy - 6 - flick, 1, 2 + flick, "#ffbe3b"); // Warm flame
    px(c, cx, cy - 5, 1, 1, "#fff8c4");
  }

  // ==================== 3. PIXEL-ART GHOST SPRITE (MATCHING image_7d1121.png!) ====================
  function drawGhostSprite(ctx, x, y, timeSec, opts) {
    const isBurning = Boolean(opts && opts.burning);
    const burnFrac = (opts && opts.burnFrac) || 0;
    const facing = (opts && opts.facing) || 1;
    const alpha = typeof (opts && opts.alpha) === "number" ? opts.alpha : 0.92;

    const bob = Math.sin(timeSec * 3.8) * 1.8;
    const flutter = Math.sin(timeSec * 9.0) > 0 ? 1 : 0;
    const tremble = isBurning ? Math.round(Math.sin(timeSec * 52) * 1.6) : 0;

    gctx.clearRect(0, 0, 24, 28);

    const hairDark = isBurning ? "#2b120e" : "#0b0910";
    const hairMid  = isBurning ? "#4d1e14" : "#181421";
    const skinCol  = isBurning ? "#ffe3b8" : "#9ba3ae";
    const gownDark = isBurning ? "#d95b26" : "#6b7380";
    const gownMid  = isBurning ? "#f79c3b" : "#9aa4b2";
    const gownHi   = isBurning ? "#fff4c2" : "#cfd7e3";

    // Flowing pitch-black hair cascading over head & back shoulder (matching image_7d1121.png!)
    px(gctx, 7, 2, 9, 4, hairDark);
    px(gctx, 5, 4, 10, 6, hairDark);
    px(gctx, 4, 7, 7, 7, hairDark);
    px(gctx, 5, 6, 4, 6, hairMid);
    px(gctx, 11, 5, 4, 5, skinCol); // Pale grey side-facing face peeking out of black hair
    px(gctx, 13, 6, 1, 1, "#100e14"); // Hollow dark eye

    // Crooked outstretched spectral arms & reaching fingers (left back arm + right forward arm)
    px(gctx, 4, 12, 3, 2, gownMid);
    px(gctx, 3, 13, 2, 3, skinCol); // Left drooping clawed hand
    px(gctx, 14, 11, 5, 2, gownMid);
    px(gctx, 18, 10, 3, 3, gownHi); // Right outstretched pale spectral hand!
    px(gctx, 19, 11, 1, 2, skinCol);

    // Torso & tattered ragged grey-white spectral gown with fluttering jagged tails!
    px(gctx, 9, 10, 6, 7, gownMid);
    px(gctx, 11, 10, 3, 6, gownHi);
    px(gctx, 8, 12, 2, 5, gownDark);
    // Flowing flared ragged skirt
    px(gctx, 6, 16, 12, 4, gownMid);
    px(gctx, 11, 16, 6, 4, gownHi);
    px(gctx, 4 + flutter, 19, 15, 3, gownMid);
    px(gctx, 12, 19, 6, 3, gownHi);
    // Jagged tattered hems + floating detached spectral pixel wisps at bottom (exact image_7d1121 detail!)
    px(gctx, 4 + flutter, 22, 3, 2, gownDark);
    px(gctx, 8, 22, 3, 3, gownMid);
    px(gctx, 12, 22, 3, 3, gownHi);
    px(gctx, 16 - flutter, 22, 3, 2, gownMid);
    // Detached ghostly mist pixels under the ragged dress
    px(gctx, 5 + flutter, 25, 1, 1, gownHi);
    px(gctx, 10, 26, 1, 1, gownMid);
    px(gctx, 14, 26, 1, 1, gownHi);
    px(gctx, 18 - flutter, 25, 1, 1, gownMid);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (isBurning ? Math.max(0.15, 1 - burnFrac * 0.85) : 1)));
    const drawX = Math.round(x + tremble);
    const drawY = Math.round(y - 24 + bob);

    if (facing < 0) {
      ctx.translate(drawX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(ghostBuf, -12, drawY);
    } else {
      ctx.drawImage(ghostBuf, drawX - 12, drawY);
    }

    // Roaring pixel flames & rising embers engulfing the Ghost during 5-Totem Victory Exorcism!
    if (isBurning) {
      const fCount = 14;
      for (let i = 0; i < fCount; i++) {
        const phase = (timeSec * 8 + i * 0.7) % 1;
        const fx = drawX - 11 + ((i * 5) % 22) + Math.sin(timeSec * 15 + i) * 2;
        const fy = Math.round(y - 2 - phase * 28);
        const sz = phase < 0.45 ? 3 : 2;
        ctx.fillStyle = phase < 0.3 ? "#fff8c4" : phase < 0.65 ? "#ff9e2c" : "#d93420";
        ctx.fillRect(Math.round(fx), fy, sz, sz);
      }
    }
    ctx.restore();
  }

  // ==================== 4. PULL-DOWN WOODEN ATTIC LADDER IN RANDOM CABIN ROOM ====================
  function getLadderAnchorForRoom(room) {
    if (!room) return { x: 104, y: 126 };
    if (room.id === "dining_room") return { x: 46, y: 112 };
    if (room.id === "bp_bathroom") return { x: 104, y: 126 };
    if (room.id === "bp_furnace") return { x: 104, y: 126 };
    return { x: 104, y: 126 };
  }

  function renderRoomLadder(ctx, room, timeSec, matchState) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !room) return;
    const roomKey = `${room.x},${room.y}`;
    if (roomKey !== att.ladderRoomKey) return;

    const pt = att.ladderPos;
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const pulse = 0.65 + Math.sin(timeSec * 4.0) * 0.30;

    // Subtle cool-amber ceiling hatch glow spilling down onto the room floor
    const glow = ctx.createRadialGradient(x, y - 4, 2, x, y - 4, 24);
    glow.addColorStop(0, `rgba(255, 224, 152, ${(0.32 * pulse).toFixed(2)})`);
    glow.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 24, y - 28, 48, 48);

    // Floor shadow under pull-down ladder feet
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(x - 8, y + 3, 16, 4);

    // Open dark ceiling trapdoor frame high above
    px(ctx, x - 9, y - 34, 18, 9, "#24150c");
    px(ctx, x - 7, y - 32, 14, 6, "#060508");

    // Wooden pull-down Attic Ladder descending cleanly to floor!
    px(ctx, x - 6, y - 30, 2, 35, "#2b190e");
    px(ctx, x - 5, y - 30, 1, 35, "#a67144");
    px(ctx, x + 4, y - 30, 2, 35, "#2b190e");
    px(ctx, x + 5, y - 30, 1, 35, "#a67144");
    for (let ry = y - 26; ry <= y + 1; ry += 5) {
      px(ctx, x - 4, ry, 8, 2, "#8f5e36");
      px(ctx, x - 4, ry, 8, 1, "#c48d5a");
    }
  }

  function getRoomLadderInteractable(room, matchState) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !room) return null;
    const roomKey = `${room.x},${room.y}`;
    if (roomKey !== att.ladderRoomKey) return null;
    return {
      id: "attic_ladder_up",
      x: att.ladderPos.x,
      y: att.ladderPos.y,
      r: 24,
      prompt: "[E] CLIMB UP TO THE ATTIC"
    };
  }

  // ==================== 5. START / ENTER / EXIT THE ATTIC EVENT ====================
  function pickRandomTotemSpots(count) {
    const want = count || 10;
    const shuffled = TOTEM_CANDIDATE_SPOTS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = [];
    const usedWings = new Set();
    for (const s of shuffled) {
      if (chosen.length >= want) break;
      if (!usedWings.has(s.wing)) {
        chosen.push(s);
        usedWings.add(s.wing);
      }
    }
    for (const s of shuffled) {
      if (chosen.length >= want) break;
      if (!chosen.includes(s)) chosen.push(s);
    }
    return chosen;
  }

  function startAtticEvent(matchState) {
    if (!matchState) return null;
    if (!staticMazeCanvas) buildStaticMaze();

    // Choose a random built room for the pull-down Attic Ladder (exclude underground Cellar if other rooms exist!)
    const builtRooms = Object.values(matchState.roomMap || {});
    const candidates = builtRooms.filter((r) => r.id !== "bp_cellar");
    const pool = candidates.length ? candidates : builtRooms;
    const chosenRoom = pool[Math.floor(Math.random() * pool.length)] || { x: 0, y: 0, id: "dining_room", fullName: "THE DINING ROOM" };
    const ladderRoomKey = `${chosenRoom.x},${chosenRoom.y}`;
    const ladderPos = getLadderAnchorForRoom(chosenRoom);

    // Spawn 2 copies of EACH of the 5 totem types (10 totems across the warehouse maze!)
    const spots = pickRandomTotemSpots(10);
    const totems = [];
    let spotIdx = 0;
    for (let copy = 0; copy < 2; copy++) {
      TOTEM_DEFS.forEach((def, i) => {
        const sp = spots[spotIdx % spots.length];
        spotIdx += 1;
        totems.push({
          uid: `${def.id}_${copy}`,
          id: def.id,
          name: def.name,
          short: def.short,
          x: sp.col * TILE + 8,
          y: sp.row * TILE + 9,
          surface: sp.surface,
          origX: sp.col * TILE + 8,
          origY: sp.row * TILE + 9,
          placed: false,
          held: false,
          obsolete: false,
          slotIdx: i
        });
      });
    }

    matchState.atticEvent = {
      active: true,
      inAttic: false,
      won: false,
      ladderRoomKey,
      ladderRoomCoord: { x: chosenRoom.x, y: chosenRoom.y },
      ladderRoomName: chosenRoom.fullName || chosenRoom.name || "CABIN ROOM",
      ladderPos,
      // Candle starts sitting right next to the central Summoning Circle!
      candle: {
        x: CIRCLE_CENTER.x,
        y: CIRCLE_CENTER.y + 18,
        held: false
      },
      holdingCandle: false,
      heldTotemId: null,
      totems,
      placedCount: 0,
      // Ghost Stalker AI
      ghost: {
        active: false,
        state: "IDLE", // IDLE | HUNTING | SEARCHING | BURNING | VANISHED
        x: 24,
        y: 24,
        facing: 1,
        alpha: 0,
        nextSpawnTimer: 10.0 + Math.random() * 6.0,
        searchTimer: 0,
        searchTargetX: CIRCLE_CENTER.x,
        searchTargetY: CIRCLE_CENTER.y,
        path: [],
        pathTimer: 0,
        burnTimer: 0,
        burnDuration: 3.6
      },
      statusNotice: "",
      statusTimer: 0
    };

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE ATTIC\nA PULL-DOWN LADDER HAS DROPPED IN ${matchState.atticEvent.ladderRoomName}.\nCLIMB UP, FIND 5 TOTEMS & BANISH THE GHOST.`,
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner && (!matchState.atticEvent || !matchState.atticEvent.inAttic)) {
          App.Events.hideSmudgeBanner();
        }
      }, 6200);
    }

    return matchState.atticEvent;
  }

  function enterAttic(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active) return false;
    if (!staticMazeCanvas) buildStaticMaze();

    att.inAttic = true;
    // Save return position downstairs & force player's handheld Lantern OFF!
    att.returnCoord = { x: matchState.currentRoomCoord.x, y: matchState.currentRoomCoord.y };
    att.returnX = att.ladderPos.x;
    att.returnY = Math.min(184, att.ladderPos.y + 8);
    att.prevLanternState = player.lanternOn;

    player.lanternOn = false; // NO LANTERNS ALLOWED IN THE ATTIC!
    player.seated = false;
    player.x = LADDER_POS.x;
    player.y = LADDER_POS.y - 6;
    player.facing = 1;

    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
    setNotice(att, "NO LANTERNS ALLOWED — PRESS [F] TO PICK UP THE CANDLE & 5 TOTEMS.", 5.0);
    App.Audio.doorTransition();
    return true;
  }

  function exitAtticDownLadder(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.inAttic) return false;

    att.inAttic = false;
    player.lanternOn = Boolean(att.prevLanternState);
    matchState.currentRoomCoord = { x: att.ladderRoomCoord.x, y: att.ladderRoomCoord.y };
    player.x = att.returnX || att.ladderPos.x;
    player.y = att.returnY || att.ladderPos.y;

    const didWin = Boolean(att.won);
    if (didWin) {
      // Completed the ritual and climbed back down via the same ladder -> Event Finished!
      att.active = false;
      matchState.atticEvent = null;
    }

    if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
    if (App.Audio && App.Audio.stopExorcismSfx) App.Audio.stopExorcismSfx();
    App.Audio.doorTransition();
    return { finishedWin: didWin };
  }

  function setNotice(att, msg, duration) {
    if (!att) return;
    att.statusNotice = msg;
    att.statusTimer = duration || 3.2;
  }

  // ==================== 6. INVENTORY CONTROLS: [F] PICK UP / PLACE & [X] DROP ====================
  function getHeldTotem(att) {
    if (!att || !att.heldTotemId) return null;
    return att.totems.find((t) => (t.uid || t.id) === att.heldTotemId) || null;
  }

  function handlePickUpOrPlace(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !att.inAttic) return false;
    if (att.ghost.state === "BURNING") return false;

    const heldTotem = getHeldTotem(att);

    // 1. If holding a Totem & near the central Summoning Circle -> PLACE IT ON ITS RUNE!
    if (heldTotem && Math.hypot(player.x - CIRCLE_CENTER.x, player.y - CIRCLE_CENTER.y) <= 32) {
      const slot = CIRCLE_SLOTS[heldTotem.slotIdx];
      heldTotem.held = false;
      heldTotem.placed = true;
      heldTotem.x = slot.x;
      heldTotem.y = slot.y;
      att.heldTotemId = null;
      // Dissolve any unplaced duplicate copies of this same totem type!
      att.totems.forEach((t) => {
        if (t !== heldTotem && t.id === heldTotem.id && !t.placed) {
          t.obsolete = true;
        }
      });
      att.placedCount = att.totems.filter((t) => t.placed).length;

      App.Audio.clockChime();

      if (att.placedCount >= 5) {
        triggerRitualVictoryBurn(att);
      } else {
        setNotice(att, `PLACED ${heldTotem.name} ON THE CIRCLE (${att.placedCount}/5)!`, 2.8);
      }
      return true;
    }

    // 2. Gather nearby ground pickup candidates (Candle & unplaced Totems within 22px)
    const candidates = [];
    if (!att.holdingCandle) {
      const cd = Math.hypot(player.x - att.candle.x, player.y - att.candle.y);
      if (cd <= 24) candidates.push({ kind: "candle", dist: cd });
    }
    if (!heldTotem) {
      att.totems.forEach((t) => {
        if (t.placed || t.held || t.obsolete) return;
        const td = Math.hypot(player.x - t.x, player.y - t.y);
        if (td <= 24) candidates.push({ kind: "totem", totem: t, dist: td });
      });
    }

    if (!candidates.length) {
      if (heldTotem) {
        setNotice(att, `CARRYING ${heldTotem.name} — BRING IT TO THE CENTER CIRCLE!`, 2.2);
      }
      return false;
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const best = candidates[0];

    if (best.kind === "candle") {
      att.holdingCandle = true;
      att.candle.held = true;
      App.Audio.lanternClick();
      setNotice(att, "PICKED UP THE CANDLE — PRESS [X] TO DROP IT IF THE GHOST HUNTS YOU.", 3.0);
      return true;
    }

    if (best.kind === "totem") {
      best.totem.held = true;
      att.heldTotemId = best.totem.uid || best.totem.id;
      App.Audio.open();
      setNotice(att, `PICKED UP ${best.totem.name} — BRING IT TO THE SUMMONING CIRCLE!`, 2.8);
      return true;
    }

    return false;
  }

  // [X] Drop held item:
  //   - Holding BOTH Candle & Totem -> 1st press drops Candle (instant stealth!), 2nd press drops Totem!
  //   - Holding only 1 item -> drops that item right at player's feet!
  function handleDropItem(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !att.inAttic) return false;

    const heldTotem = getHeldTotem(att);

    if (att.holdingCandle) {
      att.holdingCandle = false;
      att.candle.held = false;
      att.candle.x = player.x + player.facing * 5;
      att.candle.y = player.y - 2;
      App.Audio.click();
      setNotice(
        att,
        heldTotem
          ? `DROPPED CANDLE! RUN INTO A DARK CORNER! (PRESS [X] AGAIN TO DROP ${heldTotem.short})`
          : "DROPPED CANDLE! HIDE IN THE DARK UNTIL THE GHOST PASSES.",
        2.8
      );
      return true;
    }

    if (heldTotem) {
      heldTotem.held = false;
      heldTotem.x = player.x - player.facing * 4;
      heldTotem.y = player.y - 1;
      heldTotem.surface = "floor";
      att.heldTotemId = null;
      App.Audio.click();
      setNotice(att, `DROPPED ${heldTotem.name} ON THE FLOOR.`, 2.2);
      return true;
    }

    return false;
  }

  function triggerRitualVictoryBurn(att) {
    att.ghost.active = true;
    att.ghost.state = "BURNING";
    att.ghost.x = CIRCLE_CENTER.x;
    att.ghost.y = CIRCLE_CENTER.y + 4;
    att.ghost.alpha = 1.0;
    att.ghost.burnTimer = 0;
    att.ghost.path = [];
    if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
    if (App.Audio && App.Audio.playExorcismSfx) App.Audio.playExorcismSfx();
    else App.Audio.harvesterRise();
    setNotice(att, "ALL 5 TOTEMS PLACED! EXORCISING THE ATTIC GHOST!", 3.6);
  }

  // ==================== 7. COLLISION & BFS MAZE PATHFINDING ====================
  function collidesInAttic(nx, ny) {
    const halfW = 3.5;
    const minX = nx - halfW;
    const maxX = nx + halfW;
    const minY = ny - 5;
    const maxY = ny + 1;

    const pts = [
      [minX, minY],
      [maxX, minY],
      [minX, maxY],
      [maxX, maxY]
    ];
    for (let i = 0; i < pts.length; i++) {
      const col = Math.floor(pts[i][0] / TILE);
      const row = Math.floor(pts[i][1] / TILE);
      if (isWallTile(col, row)) return true;
    }
    return false;
  }

  function computeMazePath(fromX, fromY, toX, toY) {
    const sc = Math.max(1, Math.min(COLS - 2, Math.floor(fromX / TILE)));
    const sr = Math.max(1, Math.min(ROWS - 2, Math.floor(fromY / TILE)));
    const tc = Math.max(1, Math.min(COLS - 2, Math.floor(toX / TILE)));
    const tr = Math.max(1, Math.min(ROWS - 2, Math.floor(toY / TILE)));
    if (sc === tc && sr === tr) return [{ x: toX, y: toY }];

    const startKey = sr * COLS + sc;
    const targetKey = tr * COLS + tc;
    const prev = new Int16Array(COLS * ROWS).fill(-1);
    const visited = new Uint8Array(COLS * ROWS);
    const queue = [startKey];
    visited[startKey] = 1;
    let head = 0;
    let found = false;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === targetKey) { found = true; break; }
      const cr = Math.floor(cur / COLS);
      const cc = cur % COLS;
      for (let i = 0; i < 4; i++) {
        const nc = cc + dirs[i][0];
        const nr = cr + dirs[i][1];
        if (isWallTile(nc, nr)) continue;
        const nk = nr * COLS + nc;
        if (visited[nk]) continue;
        visited[nk] = 1;
        prev[nk] = cur;
        queue.push(nk);
      }
    }

    if (!found) return [{ x: toX, y: toY }];

    const path = [];
    let cur = targetKey;
    while (cur !== startKey && cur !== -1) {
      const cr = Math.floor(cur / COLS);
      const cc = cur % COLS;
      path.push({ x: cc * TILE + 8, y: cr * TILE + 8 });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  function pickGhostSpawnPoint(player) {
    const valid = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let col = 1; col < COLS - 1; col++) {
        if (isWallTile(col, r)) continue;
        const wx = col * TILE + 8;
        const wy = r * TILE + 8;
        const d = Math.hypot(wx - player.x, wy - player.y);
        if (d >= 108 && d <= 185) {
          valid.push({ x: wx, y: wy });
        }
      }
    }
    if (!valid.length) return { x: 24, y: 24 };
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // ==================== 8. PER-FRAME ATTIC & GHOST AI UPDATE ====================
  function syncAtticGhostSpatialAudio(att, player) {
    if (!App.Audio || !App.Audio.setAtticGhostAttenuation) return;
    if (!att || !att.active || !att.inAttic || !att.ghost || !att.ghost.active || att.ghost.state === "BURNING") {
      if (App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
      return;
    }
    const g = att.ghost;
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    const minDist = 16;
    const maxDist = 195;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const attenuation = Math.pow(1 - t, 1.85);
    App.Audio.setAtticGhostAttenuation(attenuation);
    if (App.Audio.startAtticGhostLoop) App.Audio.startAtticGhostLoop();
  }

  function update(dt, matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !att.inAttic) {
      if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
      return;
    }

    // Enforce NO LANTERNS in the Attic at all times
    if (player.lanternOn) player.lanternOn = false;

    if (att.statusTimer > 0) {
      att.statusTimer = Math.max(0, att.statusTimer - dt);
      if (att.statusTimer === 0) att.statusNotice = "";
    }

    // Keep held candle/totem coordinates synced with player
    if (att.holdingCandle) {
      att.candle.x = player.x + player.facing * 6;
      att.candle.y = player.y - 6;
    }
    const heldTotem = getHeldTotem(att);
    if (heldTotem) {
      heldTotem.x = player.x - player.facing * 5;
      heldTotem.y = player.y - 6;
    }

    const g = att.ghost;

    // 1. Victory Ghost-Burning Exorcism Animation (5/5 Totems Placed!)
    if (g.state === "BURNING") {
      g.burnTimer += dt;
      if (g.burnTimer >= g.burnDuration) {
        g.state = "VANISHED";
        g.active = false;
        att.won = true;
        if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
        App.Audio.clockChime();
        setNotice(att, "THE GHOST HAS BURNED AWAY! CLIMB DOWN THE LADDER [E] TO RETURN.", 8.0);
      } else if (App.Audio && App.Audio.stopAtticGhostLoop) {
        App.Audio.stopAtticGhostLoop();
      }
      return;
    }

    if (att.won) {
      if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
      return;
    }

    // 2. Random Ghost Spawn Countdown
    if (!g.active) {
      if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
      g.nextSpawnTimer -= dt;
      if (g.nextSpawnTimer <= 0) {
        const sp = pickGhostSpawnPoint(player);
        g.active = true;
        g.x = sp.x;
        g.y = sp.y;
        g.alpha = 0.05;
        g.pathTimer = 0;

        const playerInCandleLight =
          att.holdingCandle ||
          Math.hypot(player.x - att.candle.x, player.y - att.candle.y) <= 36;

        if (playerInCandleLight) {
          g.state = "HUNTING";
          setNotice(att, "THE GHOST SEES YOUR CANDLE! DROP IT [X] AND HIDE IN THE DARK!", 3.8);
        } else {
          g.state = "SEARCHING";
          g.searchTimer = 5.0;
          g.searchTargetX = att.candle.x;
          g.searchTargetY = att.candle.y;
          setNotice(att, "SOMETHING DRIFTS THROUGH THE DARKNESS... STAY HIDDEN!", 3.2);
        }
        App.Audio.hexAlert();
        syncAtticGhostSpatialAudio(att, player);
      }
      return;
    }

    // Fade ghost in smoothly
    g.alpha = Math.min(0.94, g.alpha + dt * 1.4);

    // 3. Target Detection & Stealth Check:
    //    - Holding Candle => Ghost locks onto player & chases relentlessly!
    //    - Dropped Candle & ran into a dark corner (>38px away from dropped candle) => Ghost LOSES target!
    const distToCandle = Math.hypot(player.x - att.candle.x, player.y - att.candle.y);
    const isLitUp = att.holdingCandle || distToCandle <= 36;

    if (isLitUp) {
      if (g.state !== "HUNTING") {
        g.state = "HUNTING";
        g.pathTimer = 0;
        setNotice(att, "SHE SEES THE CANDLELIGHT! DROP IT [X] AND FLEE INTO THE DARK!", 3.0);
      }
    } else if (g.state === "HUNTING") {
      // Player dropped the candle & slipped into darkness -> Ghost loses target!
      g.state = "SEARCHING";
      g.searchTimer = 4.6;
      g.searchTargetX = att.candle.x;
      g.searchTargetY = att.candle.y;
      g.pathTimer = 0;
      setNotice(att, "YOU SLIPPED INTO THE DARK — STAY OUT OF HER PATH!", 2.8);
    }

    // 4. Move Ghost along BFS Maze Path
    const targetX = g.state === "HUNTING" ? player.x : g.searchTargetX;
    const targetY = g.state === "HUNTING" ? player.y : g.searchTargetY;
    const speed = g.state === "HUNTING" ? 45 : 26;

    g.pathTimer -= dt;
    if (g.pathTimer <= 0 || !g.path.length) {
      g.path = computeMazePath(g.x, g.y, targetX, targetY);
      g.pathTimer = 0.32;
    }

    if (g.path.length > 0) {
      const wp = g.path[0];
      const dx = wp.x - g.x;
      const dy = wp.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 3.5) {
        g.path.shift();
      } else {
        g.x += (dx / dist) * speed * dt;
        g.y += (dy / dist) * speed * dt;
        if (Math.abs(dx) > 0.4) g.facing = dx >= 0 ? 1 : -1;
      }
    }

    // In SEARCHING mode, Ghost lingers briefly near the dropped candle then dissolves back into shadows!
    if (g.state === "SEARCHING") {
      g.searchTimer -= dt;
      if (g.searchTimer <= 0) {
        g.active = false;
        g.state = "IDLE";
        g.alpha = 0;
        g.nextSpawnTimer = 11.0 + Math.random() * 10.0;
        if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
        setNotice(att, "THE ATTIC FALLS SILENT AGAIN...", 2.6);
        return;
      }
    }

    // 4b. Update Spatial Ghost Audio (1.0s -> 3.0s loop) based on exact distance to player!
    syncAtticGhostSpatialAudio(att, player);

    // 5. Lethal Contact Check (Ghost catches player!)
    const catchDist = Math.hypot(g.x - player.x, g.y - player.y);
    if (catchDist <= 11.5) {
      triggerAtticDeath(matchState, player);
    }
  }

  function triggerAtticDeath(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att) return;

    // Brief spectral jumpscare flash!
    const flash = document.getElementById("attic-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 820);
    }

    if (App.Audio && App.Audio.stopAtticGhostLoop) App.Audio.stopAtticGhostLoop();
    App.Audio.hexAlert();

    // End Attic event with +1 HOUR penalty & Cellar respawn (consistent with all fatal Events!)
    att.inAttic = false;
    att.active = false;
    player.lanternOn = Boolean(att.prevLanternState);
    matchState.atticEvent = null;
    const pen = (App.Events && App.Events.applyDeathTimePenalty)
      ? App.Events.applyDeathTimePenalty(matchState)
      : { label: "+1 HOUR" };

    if (App.GameWorld && App.GameWorld.respawnInCellar) {
      App.GameWorld.respawnInCellar();
    }
    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE ATTIC STALKER CAUGHT YOU!\nRESPAWNING IN THE CELLAR (${pen.label})...`,
        { danger: true, typingDurationSec: 2.8, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 3600);
    }
  }

  // ==================== 9. CONTEXTUAL PROMPT & HUD SUMMARY ====================
  function getAtticPrompt(matchState, player) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active || !att.inAttic) return null;
    if (att.ghost.state === "BURNING") return null;

    const heldTotem = getHeldTotem(att);

    // 1. Place held totem onto center Summoning Circle
    if (heldTotem && Math.hypot(player.x - CIRCLE_CENTER.x, player.y - CIRCLE_CENTER.y) <= 32) {
      return { type: "attic_place", prompt: `[F] PLACE ${heldTotem.name} ON SUMMONING CIRCLE (${att.placedCount}/5)` };
    }

    // 2. Ladder back down
    if (Math.hypot(player.x - LADDER_POS.x, player.y - LADDER_POS.y) <= 19) {
      return {
        type: "attic_ladder_down",
        prompt: att.won
          ? `[E] CLIMB DOWN TO ${att.ladderRoomName} (RITUAL COMPLETE!)`
          : `[E] CLIMB DOWN TO ${att.ladderRoomName}`
      };
    }

    // 3. Nearby Candle or Totem to pick up with [F]
    if (!att.holdingCandle && Math.hypot(player.x - att.candle.x, player.y - att.candle.y) <= 24) {
      return { type: "attic_pickup", prompt: "[F] PICK UP RITUAL CANDLE" };
    }
    if (!heldTotem) {
      for (const t of att.totems) {
        if (t.placed || t.held || t.obsolete) continue;
        if (Math.hypot(player.x - t.x, player.y - t.y) <= 24) {
          return { type: "attic_pickup", prompt: `[F] PICK UP ${t.name}` };
        }
      }
    }

    return null;
  }

  // ==================== 10. CAMERA VIEWPORT RENDERER (208x208 FOLLOW CAMERA) ====================
  function getCameraOrigin(player) {
    const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, Math.round(player.x - VIEW_W / 2)));
    const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, Math.round(player.y - VIEW_H / 2)));
    return { camX, camY };
  }

  function renderViewport(ctx, timeSec, player, charConfig, matchState) {
    const att = matchState && matchState.atticEvent;
    if (!att || !att.active) return { camX: 0, camY: 0 };
    if (!staticMazeCanvas) buildStaticMaze();

    const { camX, camY } = getCameraOrigin(player);

    // 1. Draw cropped warehouse maze floor & crate/shelf walls into 208x208 viewport
    ctx.drawImage(staticMazeCanvas, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    // 2. Active Ritual Circle glow (intensifies as more totems are placed, blazes during burning!)
    const ccx = CIRCLE_CENTER.x - camX;
    const ccy = CIRCLE_CENTER.y - camY;
    const circleIntensity = att.ghost.state === "BURNING"
      ? 0.58 + Math.sin(timeSec * 18) * 0.14
      : att.won
        ? 0.34
        : 0.08 + att.placedCount * 0.05;
    const cg = ctx.createRadialGradient(ccx, ccy, 3, ccx, ccy, att.ghost.state === "BURNING" ? 56 : 34);
    cg.addColorStop(0, att.ghost.state === "BURNING"
      ? `rgba(255, 165, 62, ${circleIntensity.toFixed(2)})`
      : `rgba(225, 108, 72, ${circleIntensity.toFixed(2)})`);
    cg.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cg;
    ctx.fillRect(ccx - 58, ccy - 58, 116, 116);

    // 3. Draw Resting Surface Props (crates/barrels/shelves) + Unheld/Placed Totems + Unheld Candle
    att.totems.forEach((t) => {
      if (t.held || t.obsolete) return;
      const sx = t.x - camX;
      const sy = t.y - camY;
      if (sx < -24 || sx > VIEW_W + 24 || sy < -24 || sy > VIEW_H + 24) return;
      if (!t.placed) {
        drawRestingSurfaceProp(ctx, sx, sy, t.surface);
      }
      drawTotemSprite(ctx, sx, sy - (t.placed ? 0 : t.surface === "floor" ? 0 : 3), t.id);
    });

    if (!att.holdingCandle) {
      drawCandleSprite(ctx, att.candle.x - camX, att.candle.y - camY, timeSec);
    }

    // 4. Depth-sort Player & Ghost
    const pxView = player.x - camX;
    const pyView = player.y - camY;
    const actors = [
      {
        y: player.y,
        draw: () => {
          const spriteCfg = Object.assign({}, charConfig, {
            facing: player.facing,
            walking: player.moving,
            lantern: false // NO LANTERNS IN ATTIC!
          });
          App.Character.drawInWorld(ctx, pxView, pyView, spriteCfg, timeSec, {
            seated: false,
            sprinting: player.sprinting
          });
          // Draw held Ritual Candle & held Totem right in the player's hands!
          if (att.holdingCandle) {
            drawCandleSprite(ctx, pxView + player.facing * 7, pyView - 7, timeSec);
          }
          const heldT = getHeldTotem(att);
          if (heldT) {
            drawTotemSprite(ctx, pxView - player.facing * 6, pyView - 7, heldT.id);
          }
        }
      }
    ];

    const g = att.ghost;
    if (g.active) {
      actors.push({
        y: g.y,
        draw: () => {
          drawGhostSprite(ctx, g.x - camX, g.y - camY, timeSec, {
            facing: g.facing,
            alpha: g.alpha,
            burning: g.state === "BURNING",
            burnFrac: g.burnTimer / Math.max(0.1, g.burnDuration)
          });
        }
      });
    }

    actors.sort((a, b) => a.y - b.y);
    actors.forEach((a) => a.draw());

    // 5. Heavy Attic Darkness Mask (dim, narrow candlelight makes maze disorienting!)
    const baseDark = att.won ? 0.56 : att.ghost.state === "BURNING" ? 0.68 : 0.96;
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, VIEW_W, VIEW_H);
    mctx.fillStyle = `rgba(2, 3, 6, ${baseDark.toFixed(2)})`;
    mctx.fillRect(0, 0, VIEW_W, VIEW_H);

    mctx.globalCompositeOperation = "destination-out";

    // (a) Dim flickering Candle light (held or resting on floor) — deliberately tight radius!
    const candX = (att.holdingCandle ? player.x + player.facing * 6 : att.candle.x) - camX;
    const candY = (att.holdingCandle ? player.y - 8 : att.candle.y - 4) - camY;
    const flick = 1.0 + Math.sin(timeSec * 12.4) * 0.045 + Math.sin(timeSec * 23.1) * 0.025;
    const candR = (att.holdingCandle ? 46 : 34) * flick;
    const cGrad = mctx.createRadialGradient(candX, candY, 3, candX, candY, candR);
    cGrad.addColorStop(0, "rgba(0,0,0,0.95)");
    cGrad.addColorStop(0.50, "rgba(0,0,0,0.58)");
    cGrad.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = cGrad;
    mctx.fillRect(candX - candR - 2, candY - candR - 2, candR * 2 + 4, candR * 2 + 4);

    // (b) Very faint self-awareness halo when hiding in the dark without the candle
    if (!att.holdingCandle) {
      const selfR = 17;
      const sg = mctx.createRadialGradient(pxView, pyView - 8, 2, pxView, pyView - 8, selfR);
      sg.addColorStop(0, "rgba(0,0,0,0.42)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = sg;
      mctx.fillRect(pxView - selfR, pyView - 8 - selfR, selfR * 2, selfR * 2);
    }

    // (c) Faint ambient visibility around the central Summoning Circle & Hatch (stronger when burning/won!)
    const centerR = att.ghost.state === "BURNING" ? 76 : att.won ? 64 : 26;
    const rGrad = mctx.createRadialGradient(ccx, ccy, 3, ccx, ccy, centerR);
    rGrad.addColorStop(0, att.ghost.state === "BURNING" ? "rgba(0,0,0,0.96)" : "rgba(0,0,0,0.56)");
    rGrad.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = rGrad;
    mctx.fillRect(ccx - centerR, ccy - centerR, centerR * 2, centerR * 2);

    // (d) Faint ladder hatch light
    const lhx = LADDER_POS.x - camX;
    const lhy = LADDER_POS.y - camY;
    const lhGrad = mctx.createRadialGradient(lhx, lhy, 2, lhx, lhy, 20);
    lhGrad.addColorStop(0, "rgba(0,0,0,0.52)");
    lhGrad.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = lhGrad;
    mctx.fillRect(lhx - 20, lhy - 20, 40, 40);

    // (e) Soft blue reveal punch for unplaced Totems ONLY when player passes nearby HOLDING THE CANDLE!
    if (att.holdingCandle) {
      att.totems.forEach((t) => {
        if (t.placed || t.held || t.obsolete) return;
        const d = Math.hypot(player.x - t.x, player.y - t.y);
        if (d > 74) return;
        const proximity = 1 - Math.max(0, (d - 22) / 52);
        const tx = t.x - camX;
        const ty = t.y - camY - 2;
        const br = 18 * (0.65 + proximity * 0.35);
        const bg = mctx.createRadialGradient(tx, ty, 2, tx, ty, br);
        bg.addColorStop(0, `rgba(0,0,0,${(0.76 * proximity).toFixed(2)})`);
        bg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = bg;
        mctx.fillRect(tx - br, ty - br, br * 2, br * 2);
      });
    }

    // (f) Eerie subtle silhouette reveal around the Ghost so player can just barely spot her stalking in the gloom!
    if (g.active) {
      const gx = g.x - camX;
      const gy = g.y - camY - 12;
      const gr = g.state === "BURNING" ? 44 : 24;
      const gg = mctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
      gg.addColorStop(0, g.state === "BURNING" ? "rgba(0,0,0,0.98)" : "rgba(0,0,0,0.62)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = gg;
      mctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }

    ctx.drawImage(maskCanvas, 0, 0);

    // 6. Post-darkness colored light tints:
    //    (a) Warm dim amber candle glow
    const warmG = ctx.createRadialGradient(candX, candY, 2, candX, candY, candR * 0.85);
    warmG.addColorStop(0, "rgba(255, 198, 108, 0.24)");
    warmG.addColorStop(1, "rgba(255, 150, 60, 0)");
    ctx.fillStyle = warmG;
    ctx.fillRect(candX - candR, candY - candR, candR * 2, candR * 2);

    //    (b) Soft Pale-Blue Totem Shimmer (`ánh sáng xanh dương nhẹ`) when passing nearby with the Candle!
    if (att.holdingCandle) {
      const bluePulse = 0.72 + Math.sin(timeSec * 5.2) * 0.28;
      att.totems.forEach((t) => {
        if (t.placed || t.held || t.obsolete) return;
        const d = Math.hypot(player.x - t.x, player.y - t.y);
        if (d > 74) return;
        const prox = 1 - Math.max(0, (d - 20) / 54);
        const tx = t.x - camX;
        const ty = t.y - camY - 2;
        const bg = ctx.createRadialGradient(tx, ty, 1, tx, ty, 18);
        bg.addColorStop(0, `rgba(115, 200, 255, ${(0.44 * prox * bluePulse).toFixed(3)})`);
        bg.addColorStop(0.55, `rgba(72, 155, 240, ${(0.18 * prox * bluePulse).toFixed(3)})`);
        bg.addColorStop(1, "rgba(60, 140, 235, 0)");
        ctx.fillStyle = bg;
        ctx.fillRect(tx - 18, ty - 18, 36, 36);
      });
    }

    //    (c) Bright fiery halo during Ghost Burning Victory Exorcism!
    if (g.active && g.state === "BURNING") {
      const fg = ctx.createRadialGradient(ccx, ccy - 8, 4, ccx, ccy - 8, 52);
      fg.addColorStop(0, "rgba(255, 224, 130, 0.45)");
      fg.addColorStop(0.5, "rgba(255, 118, 40, 0.25)");
      fg.addColorStop(1, "rgba(255, 60, 20, 0)");
      ctx.fillStyle = fg;
      ctx.fillRect(ccx - 52, ccy - 60, 104, 104);
    }

    return { camX, camY };
  }

  function isAtticActive(matchState) {
    return Boolean(matchState && matchState.atticEvent && matchState.atticEvent.active);
  }

  function isPlayerInAttic(matchState) {
    return Boolean(matchState && matchState.atticEvent && matchState.atticEvent.active && matchState.atticEvent.inAttic);
  }

  App.Attic = {
    WORLD_W,
    WORLD_H,
    VIEW_W,
    VIEW_H,
    TOTEM_DEFS,
    startAtticEvent,
    enterAttic,
    exitAtticDownLadder,
    handlePickUpOrPlace,
    handleDropItem,
    collidesInAttic,
    update,
    getAtticPrompt,
    getRoomLadderInteractable,
    renderRoomLadder,
    renderViewport,
    isAtticActive,
    isPlayerInAttic
  };
})(window.Duskwood);
