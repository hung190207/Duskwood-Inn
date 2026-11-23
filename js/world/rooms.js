/* ==========================================================================
   DUSKWOOD INN - All 12 Authentic Cabin Rooms (Variable Non-Square Shapes)
   Modeled after The Cabin Game (Twisted Corridor):
   - Non-square rectilinear room geometry via `floorRects` & `walkRects`
   - Bespoke Stardew-style 3/4 pixel interiors & inspectable furniture for all 12 rooms:
       1. THE CELLAR         (Dead-end)  : Full dark storage basement, stairs, crates, barrels, shelves
       2. THE FURNACE ROOM   (Dead-end)  : Compact industrial boiler room, glowing furnace, pipes, coal
       3. THE BATHROOM       (Dead-end)  : Super narrow rectangular room, tub/shower, toilet, sink/mirror
       4. THE KITCHEN        (L-shaped)  : True L-shaped kitchen, fridge, stove, counters, drawers, sink
       5. THE BEDROOM        (L-shaped)  : True L-shaped bedroom, double bed, lamp, wardrobe, portrait
       6. L-HALLWAY          (L-shaped)  : Narrow 90° corridor, crimson runner, wall sconces, portraits
       7. THE STUDY          (I-shaped)  : Elongated library, oak desk, banker's lamp, bookcases, globe
       8. STRAIGHT HALLWAY I (I-shaped)  : Narrow straight corridor, crimson runner, sconces, coat rack
       9. STRAIGHT HALLWAY II(I-shaped)  : Narrow straight corridor, teal runner, eerie wall graffiti
      10. THE LIVING ROOM    (T-shaped)  : Spacious T-parlor, sofa, coffee table, grandfather clock, hearth
      11. T-HALLWAY I        (T-shaped)  : Narrow 3-way T-junction, crimson T-runner, portraits, sconces
      12. T-HALLWAY II       (T-shaped)  : Narrow 3-way T-junction, olive T-runner, mirror & wall tallies
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const ROOM_W = 208;
  const ROOM_H = 208;
  const WALL_H = 38; // 3/4 Stardew North-facing wall height above any top floor edge

  const roomCache = new Map();

  // Reusable offscreen darkness mask canvas (zero per-frame allocations)
  const lightMask = document.createElement("canvas");
  lightMask.width = ROOM_W;
  lightMask.height = ROOM_H;
  const mctx = lightMask.getContext("2d");

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function fillPixelEllipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      if (span >= 0) {
        c.fillRect(Math.floor(cx - span), Math.floor(cy + dy), span * 2 + 1, 1);
      }
    }
  }

  function drawPixelLine(c, x0, y0, x1, y1, color) {
    c.fillStyle = color;
    let ix0 = Math.round(x0), iy0 = Math.round(y0);
    const ix1 = Math.round(x1), iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      c.fillRect(ix0, iy0, 1, 1);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; ix0 += sx; }
      if (e2 < dx)  { err += dx; iy0 += sy; }
    }
  }

  function createRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function getConnectedDoors(room, roomMap) {
    const res = { N: false, E: false, S: false, W: false };
    if (!room || !roomMap) return res;
    const doors = room.doors || {};
    const dirs = [
      ["N", 0, -1, "S"],
      ["E", 1,  0, "W"],
      ["S", 0,  1, "N"],
      ["W", -1, 0, "E"]
    ];
    dirs.forEach(([d, dx, dy, opp]) => {
      if (!doors[d]) return;
      const nb = roomMap[`${room.x + dx},${room.y + dy}`];
      if (!nb || !nb.doors || !nb.doors[opp]) return;
      // The Cellar is strictly a 1-way room: normal rooms cannot open a doorway INTO bp_cellar!
      if (nb.id === "bp_cellar" && room.id !== "bp_cellar") return;
      res[d] = true;
    });
    return res;
  }

  // ==================== VARIABLE NON-SQUARE ROOM GEOMETRIES ====================
  function computeRoomGeometry(room) {
    const id = room.id;
    const d = room.doors || { N: true };
    const isVertDeadEnd = d.N || d.S;
    const isVertStraight = d.N && d.S;

    let floorRects = [];

    if (id === "bp_cellar") {
      // Full dark storage basement
      floorRects = [{ x1: 14, y1: 52, x2: 194, y2: 194 }];
    } else if (id === "bp_bathroom") {
      // SUPER NARROW RECTANGULAR BATHROOM (1 door — authentic to The Cabin Game!)
      if (isVertDeadEnd) {
        floorRects = [{ x1: 74, y1: 52, x2: 134, y2: 194 }]; // 60px wide x 142px deep!
      } else {
        floorRects = [{ x1: 14, y1: 98, x2: 194, y2: 154 }]; // 180px wide x 56px tall!
      }
    } else if (id === "bp_furnace") {
      // COMPACT INDUSTRIAL RECTANGULAR FURNACE ROOM (1 door)
      if (isVertDeadEnd) {
        floorRects = [{ x1: 50, y1: 52, x2: 158, y2: 194 }]; // 108px x 142px
      } else {
        floorRects = [{ x1: 14, y1: 82, x2: 194, y2: 170 }]; // 180px x 88px
      }
    } else if (id === "bp_study") {
      // ELONGATED RECTANGULAR STUDY (I-shaped, 2 opposite doors)
      if (isVertStraight) {
        floorRects = [{ x1: 48, y1: 52, x2: 160, y2: 194 }]; // 112px x 142px
      } else {
        floorRects = [{ x1: 14, y1: 76, x2: 194, y2: 176 }]; // 180px x 100px
      }
    } else if (id === "bp_hallway_1" || id === "bp_hallway_2") {
      // SUPER NARROW STRAIGHT CORRIDOR (52px wide!)
      if (isVertStraight) {
        floorRects = [{ x1: 78, y1: 52, x2: 130, y2: 194 }];
      } else {
        floorRects = [{ x1: 14, y1: 100, x2: 194, y2: 152 }];
      }
    } else if (id === "bp_kitchen" || id === "bp_bedroom") {
      // TRUE THICK L-SHAPED ROOM (2 perpendicular doors, unmistakable L cutout!)
      if (d.N && d.E) {
        floorRects = [
          { x1: 52, y1: 52, x2: 146, y2: 166 }, // North arm
          { x1: 52, y1: 86, x2: 194, y2: 166 }  // East arm
        ];
      } else if (d.E && d.S) {
        floorRects = [
          { x1: 52, y1: 82, x2: 146, y2: 194 }, // South arm
          { x1: 52, y1: 82, x2: 194, y2: 162 }  // East arm
        ];
      } else if (d.S && d.W) {
        floorRects = [
          { x1: 62, y1: 82, x2: 156, y2: 194 }, // South arm
          { x1: 14, y1: 82, x2: 156, y2: 162 }  // West arm
        ];
      } else {
        // W & N
        floorRects = [
          { x1: 62, y1: 52, x2: 156, y2: 166 }, // North arm
          { x1: 14, y1: 86, x2: 156, y2: 166 }  // West arm
        ];
      }
    } else if (id === "bp_l_hallway") {
      // NARROW 90-DEGREE L-CORRIDOR (48px wide!)
      if (d.N && d.E) {
        floorRects = [
          { x1: 80, y1: 52, x2: 128, y2: 150 },
          { x1: 80, y1: 102, x2: 194, y2: 150 }
        ];
      } else if (d.E && d.S) {
        floorRects = [
          { x1: 80, y1: 102, x2: 128, y2: 194 },
          { x1: 80, y1: 102, x2: 194, y2: 150 }
        ];
      } else if (d.S && d.W) {
        floorRects = [
          { x1: 80, y1: 102, x2: 128, y2: 194 },
          { x1: 14, y1: 102, x2: 128, y2: 150 }
        ];
      } else {
        // W & N
        floorRects = [
          { x1: 80, y1: 52, x2: 128, y2: 150 },
          { x1: 14, y1: 102, x2: 128, y2: 150 }
        ];
      }
    } else if (id === "bp_living_room") {
      // SPACIOUS T-SHAPED PARLOR (3 broad wings + cozy alcove opposite the T-stem!)
      if (!d.W) {
        // N, E, S open; West closed
        floorRects = [
          { x1: 42, y1: 52, x2: 156, y2: 194 },
          { x1: 42, y1: 82, x2: 194, y2: 168 }
        ];
      } else if (!d.N) {
        // E, S, W open; North closed
        floorRects = [
          { x1: 14, y1: 72, x2: 194, y2: 164 },
          { x1: 54, y1: 72, x2: 154, y2: 194 }
        ];
      } else if (!d.E) {
        // S, W, N open; East closed
        floorRects = [
          { x1: 52, y1: 52, x2: 166, y2: 194 },
          { x1: 14, y1: 82, x2: 166, y2: 168 }
        ];
      } else {
        // W, N, E open; South closed
        floorRects = [
          { x1: 14, y1: 84, x2: 194, y2: 174 },
          { x1: 54, y1: 52, x2: 154, y2: 174 }
        ];
      }
    } else if (id === "bp_t_hallway_1" || id === "bp_t_hallway_2") {
      // NARROW 3-WAY T-JUNCTION CORRIDOR (48px wide!)
      if (!d.W) {
        floorRects = [
          { x1: 80, y1: 52, x2: 128, y2: 194 },
          { x1: 80, y1: 102, x2: 194, y2: 150 }
        ];
      } else if (!d.N) {
        floorRects = [
          { x1: 14, y1: 102, x2: 194, y2: 150 },
          { x1: 80, y1: 102, x2: 128, y2: 194 }
        ];
      } else if (!d.E) {
        floorRects = [
          { x1: 80, y1: 52, x2: 128, y2: 194 },
          { x1: 14, y1: 102, x2: 128, y2: 150 }
        ];
      } else {
        floorRects = [
          { x1: 14, y1: 102, x2: 194, y2: 150 },
          { x1: 80, y1: 52, x2: 128, y2: 150 }
        ];
      }
    } else {
      floorRects = [{ x1: 14, y1: 52, x2: 194, y2: 194 }];
    }

    // Derive exact collision walkable rectangles inset cleanly from walls (matches player footbox)
    const walkRects = floorRects.map((r) => ({
      minX: r.x1 + 6,
      maxX: r.x2 - 6,
      minY: r.y1 + 4,
      maxY: r.y2 - 4
    }));

    return { floorRects, walkRects };
  }

  function isPointInRects(rects, x, y) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2) return true;
    }
    return false;
  }

  // ==================== UNIVERSAL RECTILINEAR STARDEW SHELL RENDERER ====================
  function drawRectilinearShell(c, floorRects, style, doors, connectedDoors, rng) {
    // 1. Exterior void
    px(c, 0, 0, ROOM_W, ROOM_H, "#050508");

    // 2. Outer dark structural wall silhouettes (floor + 3/4 North walls)
    floorRects.forEach((r) => {
      px(c, r.x1 - 6, r.y1 - WALL_H - 6, r.x2 - r.x1 + 12, r.y2 - r.y1 + WALL_H + 12, style.outerFrame || "#24160f");
      px(c, r.x1 - 4, r.y1 - WALL_H - 4, r.x2 - r.x1 + 8, r.y2 - r.y1 + WALL_H + 8, style.cutawayTrim || "#4a3020");
    });

    // 3. Draw 3/4 North-facing interior walls above EVERY floor rect (lower overlap gets masked by floor in step 4)
    floorRects.forEach((r) => {
      const wx = r.x1;
      const wy = r.y1 - WALL_H;
      const ww = r.x2 - r.x1;

      // Upper wallpaper / tile / brick band (22px)
      px(c, wx, wy, ww, 22, style.wallUpper);
      if (style.wallStyle === "brick") {
        const bCols = style.brickCols || ["#4a433d", "#3f3934", "#524a43", "#38332f"];
        for (let by = wy; by < r.y1; by += 6) {
          const row = Math.floor((by - wy) / 6);
          for (let bx = wx; bx < r.x2; bx += 14) {
            const shift = (row % 2) * 7;
            const rx = Math.max(wx, bx - shift);
            const rw = Math.min(14, r.x2 - rx);
            px(c, rx, by, rw, 5, bCols[(row * 3 + Math.floor(bx / 14)) % bCols.length]);
            px(c, rx, by + 5, rw, 1, "#211d1a");
            px(c, rx, by, 1, 5, "#26221f");
          }
        }
      } else if (style.wallStyle === "tile") {
        // Subway ceramic bathroom tiles
        for (let by = wy; by < wy + 22; by += 5) {
          const shift = ((by - wy) / 5) % 2 ? 4 : 0;
          px(c, wx, by + 4, ww, 1, "#4e5c61");
          for (let bx = wx + shift; bx < r.x2; bx += 8) {
            px(c, bx, by, 1, 4, "#57676d");
          }
        }
        px(c, wx, wy + 22, ww, 3, style.chairRail);
        px(c, wx, wy + 25, ww, 11, style.wainscot);
        for (let bx = wx + 2; bx < r.x2 - 2; bx += 6) {
          px(c, bx, wy + 26, 4, 9, style.wainscotPanel || "#506369");
        }
      } else {
        // Striped wallpaper + chair rail + wooden wainscoting
        for (let bx = wx; bx < r.x2; bx += 8) {
          px(c, bx, wy, 1, 22, "rgba(0,0,0,0.16)");
          px(c, bx + 2, wy + 1, 4, 20, "rgba(255,255,255,0.04)");
        }
        px(c, wx, wy + 22, ww, 3, style.chairRail || "#784d2e");
        px(c, wx, wy + 23, ww, 1, "rgba(255,235,200,0.22)");
        px(c, wx, wy + 25, ww, 11, style.wainscot || "#543520");
        for (let bx = wx + 4; bx < r.x2 - 8; bx += 12) {
          px(c, bx, wy + 27, 8, 7, style.wainscotPanel || "#664128");
          px(c, bx + 1, wy + 28, 6, 5, style.wainscot || "#482c1a");
        }
      }
      px(c, wx, r.y1 - 2, ww, 2, "#24160e");
    });

    // 4. Clipped Floor Surface (Union of all `floorRects`)
    c.save();
    c.beginPath();
    floorRects.forEach((r) => c.rect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1));
    c.clip();

    if (style.floorStyle === "checker") {
      const sz = style.tileSize || 8;
      for (let y = 48; y < ROOM_H; y += sz) {
        for (let x = 10; x < ROOM_W; x += sz) {
          const even = (Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0;
          px(c, x, y, sz, sz, even ? style.floorCols[0] : style.floorCols[1]);
          px(c, x, y + sz - 1, sz, 1, "rgba(0,0,0,0.12)");
          px(c, x + sz - 1, y, 1, sz, "rgba(0,0,0,0.10)");
        }
      }
    } else if (style.floorStyle === "stone") {
      const fCols = style.floorCols;
      for (let y = 50; y < ROOM_H; y += 12) {
        const rIdx = Math.floor((y - 50) / 12);
        for (let x = 10; x < ROOM_W; x += 16) {
          const shift = (rIdx % 2) * 8;
          const fx = x - shift;
          const col = fCols[(rIdx * 5 + Math.abs(Math.floor(x / 16))) % fCols.length];
          px(c, fx, y, 16, 11, col);
          px(c, fx, y + 11, 16, 1, "#221f1d");
          px(c, fx, y, 1, 11, "#25211f");
          if (rng && rng() > 0.55) px(c, fx + 3, y + 3, 10, 2, "rgba(255,255,255,0.06)");
        }
      }
    } else {
      // Classic Stardew Honey/Walnut/Ash Wood Planks
      const fCols = style.floorCols;
      for (let y = 48; y < ROOM_H; y += 8) {
        const row = Math.floor((y - 48) / 8);
        for (let x = 8; x < ROOM_W; x += 22) {
          const shift = (row % 2) * 11;
          const fx = x - shift;
          const col = fCols[(row * 3 + Math.abs(Math.floor(x / 22))) % fCols.length];
          px(c, fx, y, 22, 7, col);
          px(c, fx, y + 7, 22, 1, "rgba(0,0,0,0.32)");
          px(c, fx, y, 1, 7, "rgba(0,0,0,0.22)");
          px(c, fx + 4, y + 2, 12, 1, "rgba(255,230,190,0.08)");
        }
      }
    }

    // 5. Baseboard drop shadow along EVERY exposed top floor edge (works on L & T shapes!)
    for (let x = 14; x < ROOM_W - 14; x++) {
      for (let y = 52; y < ROOM_H - 12; y++) {
        if (isPointInRects(floorRects, x, y) && !isPointInRects(floorRects, x, y - 1)) {
          c.fillStyle = "rgba(0, 0, 0, 0.34)";
          c.fillRect(x, y, 1, 4);
        }
      }
    }

    c.restore();

    // 6. Crisp dark inner boundary lip around floor edges (left/right/bottom)
    for (let y = 52; y < ROOM_H - 12; y++) {
      for (let x = 14; x < ROOM_W - 14; x++) {
        if (!isPointInRects(floorRects, x, y)) continue;
        if (!isPointInRects(floorRects, x - 1, y)) px(c, x - 2, y, 2, 1, "#21140d");
        if (!isPointInRects(floorRects, x + 1, y)) px(c, x + 1, y, 2, 1, "#21140d");
        if (!isPointInRects(floorRects, x, y + 1)) px(c, x, y + 1, 1, 2, "#21140d");
      }
    }

    // 7. Draw Real Doorways on N / S / W / E where this room has a door
    ["N", "E", "S", "W"].forEach((dir) => {
      if (!doors || !doors[dir]) return;
      const open = Boolean(connectedDoors && connectedDoors[dir]);
      if (dir === "N") {
        px(c, 92, 22, 24, 31, "#29180e");
        px(c, 95, 25, 18, 28, open ? "#09080c" : "#4d311e");
        if (open) {
          px(c, 95, 25, 2, 28, "#1b120d");
          px(c, 111, 25, 2, 28, "#1b120d");
          px(c, 95, 52, 18, 5, "#6b472d");
        } else {
          px(c, 97, 27, 6, 9, "#3b2516");
          px(c, 105, 27, 6, 9, "#3b2516");
          px(c, 110, 38, 2, 2, "#d4b05c");
        }
      } else if (dir === "S") {
        px(c, 92, ROOM_H - 14, 24, 9, "#29180e");
        px(c, 95, ROOM_H - 13, 18, 8, open ? "#09080c" : "#5e3b24");
        if (open) px(c, 95, ROOM_H - 17, 18, 4, "#6b472d");
      } else if (dir === "W") {
        px(c, 8, 113, 8, 26, "#29180e");
        px(c, 8, 116, 7, 20, open ? "#09080c" : "#5c3b24");
        if (open) px(c, 15, 117, 4, 18, "#6b472d");
      } else if (dir === "E") {
        px(c, ROOM_W - 16, 113, 8, 26, "#29180e");
        px(c, ROOM_W - 15, 116, 7, 20, open ? "#09080c" : "#5c3b24");
        if (open) px(c, ROOM_W - 19, 117, 4, 18, "#6b472d");
      }
    });
  }

  // ==================== SHARED PIXEL FURNITURE SPRITES ====================
  function drawWoodenCrate(c, x, y, w, h, darkTone) {
    const out = darkTone ? "#1a110b" : "#26180f";
    const frame = darkTone ? "#543722" : "#6e492d";
    const hi = darkTone ? "#6e4b30" : "#875c3a";
    const inner = darkTone ? "#3b2517" : "#4f3320";
    c.fillStyle = "rgba(0,0,0,0.42)";
    c.fillRect(x - 1, y + h - 2, w + 2, 4);
    px(c, x, y, w, h, out);
    px(c, x + 1, y + 1, w - 2, h - 2, frame);
    px(c, x + 1, y + 1, w - 2, 2, hi);
    px(c, x + 3, y + 4, w - 6, h - 7, inner);
    for (let sy = y + 6; sy < y + h - 4; sy += 3) px(c, x + 3, sy, w - 6, 1, "#2b1a10");
    const steps = Math.min(w - 6, h - 7);
    for (let i = 0; i < steps; i++) px(c, x + 3 + i, y + 4 + i, 2, 1, frame);
  }

  function drawOakBarrel(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(x - 1, y + 13, 14, 4);
    px(c, x, y + 1, 12, 14, "#1a110b");
    px(c, x + 1, y, 10, 16, "#1a110b");
    px(c, x + 1, y + 1, 10, 14, "#593822");
    px(c, x + 2, y + 1, 3, 14, "#70482c");
    px(c, x + 8, y + 1, 2, 14, "#402717");
    px(c, x + 2, y + 1, 8, 3, "#472c1b");
    px(c, x + 1, y + 5, 10, 2, "#353940");
    px(c, x + 1, y + 11, 10, 2, "#353940");
  }

  function drawCellarStorageShelf(c, x, y, w, h) {
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(x - 1, y + h - 1, w + 2, 4);
    px(c, x, y, w, h, "#170f0a");
    px(c, x + 1, y + 1, w - 2, h - 2, "#382315");
    px(c, x + 1, y + 1, 3, h - 2, "#593822");
    px(c, x + w - 4, y + 1, 3, h - 2, "#4a2e1b");
    [y + 3, y + 13, y + 23].forEach((sy, idx) => {
      if (sy + 9 > y + h) return;
      px(c, x + 4, sy, w - 8, 8, "#1b120d");
      px(c, x + 2, sy + 8, w - 4, 2, "#69442a");
      if (idx === 0) {
        px(c, x + 5, sy + 2, 8, 6, "#664329");
        px(c, x + 15, sy + 3, 3, 5, "#46635c");
        px(c, x + 19, sy + 4, 3, 4, "#5d4e3e");
      } else if (idx === 1) {
        px(c, x + 5, sy + 1, 10, 7, "#5e3e27");
        px(c, x + 17, sy + 2, 7, 6, "#75654e");
      } else {
        px(c, x + 5, sy + 2, 7, 6, "#4d311e");
        px(c, x + 14, sy + 1, 9, 7, "#69452a");
      }
    });
  }

  function drawCobweb(c, x, y, flipX, flipY) {
    c.save();
    c.translate(x, y);
    c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    c.fillStyle = "rgba(185, 192, 200, 0.22)";
    for (let i = 0; i < 11; i++) {
      c.fillRect(i, 0, 1, 1);
      c.fillRect(0, i, 1, 1);
      if (i < 8) c.fillRect(i, i, 1, 1);
    }
    c.fillRect(2, 5, 4, 1);
    c.fillRect(5, 2, 1, 4);
    c.restore();
  }

  function drawWallPortrait(c, x, y, w, h, accent) {
    px(c, x, y, w, h, "#2b1a0e");
    px(c, x + 1, y + 1, w - 2, h - 2, "#a38343");
    px(c, x + 2, y + 2, w - 4, h - 4, "#1e2229");
    px(c, x + 3, y + 3, w - 6, Math.floor((h - 6) * 0.6), accent || "#3a4a5e");
    // Tiny eerie silhouette inside portrait
    px(c, x + Math.floor(w / 2) - 1, y + 4, 3, 3, "#c9b89c");
    px(c, x + Math.floor(w / 2) - 2, y + 7, 5, Math.max(2, h - 10), "#14161c");
  }

  function drawWallSconce(c, x, y) {
    px(c, x - 2, y, 4, 7, "#3a352e");
    px(c, x - 1, y + 1, 2, 4, "#c9a452");
    px(c, x - 1, y - 2, 2, 3, "#fff1b8");
  }

  function drawWallLightSwitch(c, x, y, isOn) {
    px(c, x, y, 5, 7, "#242220");
    px(c, x + 1, y + 1, 3, 5, "#d4ccb8");
    px(c, x + 2, isOn ? y + 2 : y + 4, 1, 2, isOn ? "#5c4a32" : "#24201c");
  }

  function drawMedicineCabinet(c, x, y) {
    px(c, x, y, 12, 14, "#242c33");
    px(c, x + 1, y + 1, 10, 12, "#dbe3e8");
    px(c, x + 2, y + 2, 8, 10, "#9ab0bd");
    px(c, x + 5, y + 4, 2, 6, "#c43b3b"); // Red cross emblem
    px(c, x + 3, y + 6, 6, 2, "#c43b3b");
  }

  function drawRoosterOrnament(c, x, y) {
    // Carved wooden farmhouse rooster statue (CHICKEN DECOR clue!)
    px(c, x - 3, y + 5, 7, 2, "#4a2e1a"); // Base pedestal
    px(c, x - 2, y + 1, 5, 4, "#e6d8bd"); // Plump body
    px(c, x + 2, y - 1, 3, 3, "#e6d8bd"); // Neck/head
    px(c, x + 2, y - 3, 3, 2, "#c92e2e"); // Red comb
    px(c, x + 5, y, 2, 1, "#e6a832");     // Beak
    px(c, x - 4, y, 2, 3, "#8c3b2b");     // Tail feathers
  }

  function drawPhantomClockOverlay(c, x, y, timeSec) {
    const glow = 0.55 + Math.sin(timeSec * 4.5) * 0.25;
    c.save();
    c.globalAlpha = 0.88;
    px(c, x, y, 14, 34, "#1a1421");
    px(c, x + 1, y + 1, 12, 32, "#392c47");
    fillPixelEllipse(c, x + 7, y + 8, 4, 4, "#d8f5ed");
    px(c, x + 7, y + 5, 1, 3, "#142421");
    px(c, x + 7, y + 8, 3, 1, "#142421");
    px(c, x + 5, y + 15, 4, 13, "#0d0a12");
    const sw = Math.round(Math.sin(timeSec * 5) * 1.4);
    px(c, x + 6 + sw, y + 23, 2, 3, "#7be8d8");
    c.globalAlpha = 0.28 * glow;
    c.fillStyle = "#5bd4be";
    c.fillRect(x - 2, y - 2, 18, 38);
    c.restore();
  }

  function drawChalkSymbol(c, x, y, sym) {
    c.save();
    c.strokeStyle = "rgba(218, 52, 58, 0.85)";
    c.lineWidth = 2.5;
    c.beginPath();
    if (sym === "X") {
      c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7);
      c.moveTo(x + 7, y - 7); c.lineTo(x - 7, y + 7);
    } else {
      c.arc(x, y, 7, 0, Math.PI * 2);
    }
    c.stroke();
    c.restore();
  }

  function drawBreakerBox(c, x, y) {
    px(c, x, y, 12, 15, "#24282e");
    px(c, x + 1, y + 1, 10, 13, "#5a636e");
    px(c, x + 2, y + 2, 8, 11, "#454d57");
    px(c, x + 4, y + 4, 4, 3, "#d9a938"); // Caution voltage stripe
    px(c, x + 5, y + 5, 2, 1, "#1e1e22");
    px(c, x + 9, y + 7, 1, 3, "#212429"); // Latch
  }

  // ==================== 1. THE CELLAR (BESPOKE BASEMENT) ====================
  function drawCellarStaircase(c, doorDir) {
    if (doorDir === "N") {
      px(c, 88, 22, 32, 62, "#1c120c");
      px(c, 91, 24, 26, 58, "#261810");
      for (let i = 0; i < 7; i++) {
        const sy = 26 + i * 8;
        px(c, 92, sy, 24, 5, i < 2 ? "#7a5335" : i < 4 ? "#66442b" : "#543722");
        px(c, 92, sy, 24, 1, "#8c6240");
        px(c, 92, sy + 5, 24, 3, "#2b1a10");
      }
      px(c, 89, 24, 3, 60, "#472d1c");
      px(c, 116, 24, 3, 60, "#472d1c");
      px(c, 88, 79, 5, 6, "#754d30");
      px(c, 115, 79, 5, 6, "#754d30");
    } else if (doorDir === "S") {
      px(c, 88, 144, 32, 54, "#1c120c");
      px(c, 91, 146, 26, 50, "#24170f");
      for (let i = 0; i < 6; i++) {
        const sy = 148 + i * 8;
        px(c, 92, sy, 24, 6, i > 3 ? "#7a5335" : i > 1 ? "#634129" : "#523521");
        px(c, 92, sy, 24, 1, "#8a603e");
        px(c, 92, sy + 6, 24, 2, "#29180f");
      }
      px(c, 89, 144, 3, 54, "#472d1c");
      px(c, 116, 144, 3, 54, "#472d1c");
      px(c, 88, 143, 5, 6, "#754d30");
      px(c, 115, 143, 5, 6, "#754d30");
    } else if (doorDir === "W") {
      px(c, 10, 110, 52, 32, "#1c120c");
      px(c, 12, 113, 48, 26, "#24170f");
      for (let i = 0; i < 6; i++) {
        const sx = 14 + i * 8;
        px(c, sx, 114, 6, 24, i < 2 ? "#7a5335" : i < 4 ? "#634129" : "#523521");
        px(c, sx, 114, 1, 24, "#8a603e");
        px(c, sx + 6, 114, 2, 24, "#29180f");
      }
      px(c, 10, 110, 52, 3, "#4f3220");
      px(c, 10, 139, 52, 3, "#4f3220");
      px(c, 58, 109, 5, 5, "#754d30");
      px(c, 58, 138, 5, 5, "#754d30");
    } else {
      px(c, 146, 110, 52, 32, "#1c120c");
      px(c, 148, 113, 48, 26, "#24170f");
      for (let i = 0; i < 6; i++) {
        const sx = 148 + i * 8;
        px(c, sx, 114, 6, 24, i > 3 ? "#7a5335" : i > 1 ? "#634129" : "#523521");
        px(c, sx + 5, 114, 1, 24, "#8a603e");
        px(c, sx + 6, 114, 2, 24, "#29180f");
      }
      px(c, 146, 110, 52, 3, "#4f3220");
      px(c, 146, 139, 52, 3, "#4f3220");
      px(c, 145, 109, 5, 5, "#754d30");
      px(c, 145, 138, 5, 5, "#754d30");
    }
  }

  function populateCellar(c, room, geo) {
    const rng = createRng(77123);
    const d = room.doors || { N: true };
    const doorDir = d.N ? "N" : d.S ? "S" : d.W ? "W" : "E";

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#1a1716",
        cutawayTrim: "#3b3530",
        wallStyle: "brick",
        wallUpper: "#4a433d",
        brickCols: ["#4a433d", "#3f3934", "#524a43", "#38332f"],
        floorStyle: "stone",
        floorCols: ["#3d3834", "#36312e", "#453f3a", "#302c29", "#423b35"]
      },
      d,
      room.connectedDoors,
      rng
    );

    // Timber beams + barred air vent + breaker box on North wall
    [28, 76, 132, 178].forEach((bx) => {
      if (doorDir === "N" && bx > 80 && bx < 130) return;
      px(c, bx, 14, 5, 38, "#2b1c12");
      px(c, bx + 1, 14, 2, 38, "#452e1e");
    });

    const ventX = doorDir === "N" ? 50 : 94;
    px(c, ventX, 20, 18, 12, "#121010");
    px(c, ventX + 1, 21, 16, 10, "#1d1a19");
    for (let vx = ventX + 3; vx < ventX + 16; vx += 3) px(c, vx, 21, 1, 10, "#4a4e54");
    px(c, ventX + 1, 25, 16, 2, "#393d42");

    // Wall breaker panel (Cellar Breakers event reference!)
    const brkX = doorDir === "N" ? 138 : 60;
    drawBreakerBox(c, brkX, 24);

    drawCobweb(c, 15, 54, false, false);
    drawCobweb(c, ROOM_W - 15, 54, true, false);
    drawCobweb(c, 15, ROOM_H - 13, false, true);
    drawCobweb(c, ROOM_W - 15, ROOM_H - 13, true, true);

    drawCellarStaircase(c, doorDir);

    const colliders = [];
    const interactables = [];
    const stairClearZone =
      doorDir === "N" ? { x: 80, y: 18, w: 48, h: 74 } :
      doorDir === "S" ? { x: 80, y: 136, w: 48, h: 66 } :
      doorDir === "W" ? { x: 10, y: 100, w: 60, h: 48 } :
                        { x: 138, y: 100, w: 60, h: 48 };

    const overlapsStairs = (x, y, w, h) =>
      x < stairClearZone.x + stairClearZone.w &&
      x + w > stairClearZone.x &&
      y < stairClearZone.y + stairClearZone.h &&
      y + h > stairClearZone.y;

    if (!overlapsStairs(18, 22, 34, 34)) {
      drawCellarStorageShelf(c, 18, 22, 34, 34);
      colliders.push({ x: 18, y: 44, w: 34, h: 14 });
    }
    if (!overlapsStairs(154, 22, 36, 34)) {
      drawCellarStorageShelf(c, 154, 22, 36, 34);
      colliders.push({ x: 154, y: 44, w: 36, h: 14 });
    }
    if (!overlapsStairs(20, 154, 36, 36)) {
      drawWoodenCrate(c, 20, 166, 20, 18, false);
      drawWoodenCrate(c, 39, 170, 16, 15, true);
      drawWoodenCrate(c, 23, 153, 15, 14, true);
      colliders.push({ x: 20, y: 164, w: 35, h: 22 });
    }
    if (!overlapsStairs(158, 156, 32, 32)) {
      drawOakBarrel(c, 174, 156);
      drawOakBarrel(c, 160, 168);
      drawOakBarrel(c, 175, 170);
      colliders.push({ x: 160, y: 160, w: 28, h: 26 });
    }
    if (!overlapsStairs(20, 96, 20, 32)) {
      drawWoodenCrate(c, 20, 98, 18, 16, false);
      drawOakBarrel(c, 21, 116);
      colliders.push({ x: 20, y: 100, w: 18, h: 32 });
    }
    if (!overlapsStairs(168, 96, 22, 32)) {
      drawWoodenCrate(c, 170, 98, 18, 16, true);
      drawWoodenCrate(c, 172, 114, 16, 14, false);
      colliders.push({ x: 170, y: 100, w: 18, h: 28 });
    }

    const stairGlow =
      doorDir === "N" ? { x: 104, y: 28 } :
      doorDir === "S" ? { x: 104, y: 194 } :
      doorDir === "W" ? { x: 16,  y: 126 } :
                        { x: 192, y: 126 };


    return {
      colliders,
      interactables,
      isCellar: true,
      darknessLevel: 0.72,
      lights: [{ x: stairGlow.x, y: stairGlow.y, r: 62, color: "255, 214, 140", strength: 0.72, halo: 0.18, alwaysOn: true }]
    };
  }

  // ==================== 2. THE BATHROOM (SUPER NARROW RECTANGLE!) ====================
  function drawBathtub(c, x, y, vertical) {
    if (vertical) {
      // Narrow vertical clawfoot tub with shower curtain rod (24x44)
      px(c, x, y, 24, 44, "#242c33");
      px(c, x + 1, y + 1, 22, 42, "#d8e0e6");
      px(c, x + 3, y + 3, 18, 38, "#9fb4bf");
      px(c, x + 4, y + 4, 16, 36, "#b7cbd4");
      // Chrome faucet & drain
      px(c, x + 10, y + 3, 4, 3, "#5a6770");
      px(c, x + 11, y + 36, 2, 2, "#3a454d");
      // Semi-drawn shower curtain across upper half
      px(c, x - 1, y + 14, 26, 2, "#7e8a94");
      px(c, x + 1, y + 16, 14, 10, "rgba(235, 232, 220, 0.72)");
      px(c, x + 5, y + 16, 2, 10, "rgba(180, 175, 162, 0.6)");
    } else {
      // Horizontal clawfoot tub along far end (42x22)
      px(c, x, y, 42, 22, "#242c33");
      px(c, x + 1, y + 1, 40, 20, "#d8e0e6");
      px(c, x + 3, y + 3, 36, 16, "#9fb4bf");
      px(c, x + 4, y + 4, 34, 14, "#b7cbd4");
      px(c, x + 3, y + 9, 3, 4, "#5a6770");
      px(c, x + 34, y + 10, 2, 2, "#3a454d");
      px(c, x + 16, y - 1, 2, 24, "#7e8a94");
      px(c, x + 18, y + 1, 10, 16, "rgba(235, 232, 220, 0.72)");
    }
  }

  function drawToilet(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.28)";
    c.fillRect(x, y + 13, 12, 3);
    // Porcelain tank
    px(c, x, y, 12, 6, "#2c343b");
    px(c, x + 1, y + 1, 10, 4, "#e6edf2");
    px(c, x + 9, y + 2, 2, 1, "#7b8994"); // Chrome flush handle
    // Bowl
    px(c, x + 1, y + 5, 10, 9, "#2c343b");
    px(c, x + 2, y + 6, 8, 7, "#dce5eb");
    px(c, x + 3, y + 7, 6, 5, "#8da3b0");
    px(c, x + 4, y + 8, 4, 3, "#5d7482");
  }

  function drawBathroomSinkAndMirror(c, x, y) {
    // Wall mirror above sink (drawn on North wall / upper wall!)
    px(c, x + 1, y - 22, 14, 15, "#2b2018");
    px(c, x + 2, y - 21, 12, 13, "#7c94a3");
    px(c, x + 3, y - 20, 10, 11, "#9cb6c4");
    px(c, x + 4, y - 19, 3, 4, "#cde0eb"); // Mirror glint
    // Porcelain pedestal sink
    px(c, x, y, 16, 11, "#2a333b");
    px(c, x + 1, y + 1, 14, 9, "#dbe4eb");
    px(c, x + 3, y + 2, 10, 6, "#8fa5b3");
    px(c, x + 7, y + 1, 2, 3, "#5a6670"); // Faucet
  }

  function populateBathroom(c, room, geo) {
    const rng = createRng(4109);
    const d = room.doors || { N: true };
    const doorDir = d.N ? "N" : d.S ? "S" : d.W ? "W" : "E";
    const isVert = doorDir === "N" || doorDir === "S";

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#1b2226",
        cutawayTrim: "#4a5861",
        wallStyle: "tile",
        wallUpper: "#6d7d82",
        chairRail: "#49575c",
        wainscot: "#56686e",
        wainscotPanel: "#63777d",
        floorStyle: "checker",
        tileSize: 8,
        floorCols: ["#c7cfd4", "#5c6d75"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];

    if (isVert) {
      // Super narrow vertical bathroom (x: 74..134, y: 52..194)
      // Walkable corridor center x: 80..128! Keep center lane clear, hug props to walls & far end!
      if (doorDir === "N") {
        // Door at North (104,56) -> Bathtub across far South end, Toilet on West, Sink on East
        drawBathtub(c, 82, 168, false);
        colliders.push({ x: 82, y: 170, w: 42, h: 20 });

        drawToilet(c, 76, 118);
        colliders.push({ x: 76, y: 120, w: 12, h: 12 });

        // Compact side sink on East wall
        px(c, 122, 96, 11, 16, "#2a333b");
        px(c, 123, 97, 9, 14, "#dce5eb");
        px(c, 125, 99, 6, 10, "#8fa5b3");
        colliders.push({ x: 122, y: 97, w: 11, h: 15 });

        // Bath mat in center
        px(c, 92, 146, 22, 12, "#4d6b73");
        px(c, 94, 148, 18, 8, "#63858f");
      } else {
        // Door at South (104,190) -> Vanity Sink + Mirror on North wall, Bathtub tucked NW, Toilet on East
        drawBathroomSinkAndMirror(c, 110, 48);
        colliders.push({ x: 110, y: 50, w: 16, h: 10 });

        drawBathtub(c, 76, 56, true);
        colliders.push({ x: 76, y: 58, w: 23, h: 42 });

        drawToilet(c, 120, 120);
        colliders.push({ x: 120, y: 122, w: 12, h: 12 });

        px(c, 92, 112, 20, 12, "#4d6b73");
        px(c, 94, 114, 16, 8, "#63858f");
      }
    } else {
      // Super narrow HORIZONTAL bathroom (x: 14..194, y: 98..154; North wall y: 60..98)
      const tubX = doorDir === "W" ? 166 : 18;
      drawBathtub(c, tubX, 104, true);
      colliders.push({ x: tubX, y: 106, w: 24, h: 42 });

      // Sink & Wall Mirror on North wall (y = 94)
      const sinkX = 96;
      drawBathroomSinkAndMirror(c, sinkX, 94);
      colliders.push({ x: sinkX, y: 96, w: 16, h: 10 });

      // Toilet along North wall next to sink
      const toiletX = doorDir === "W" ? 132 : 64;
      drawToilet(c, toiletX, 96);
      colliders.push({ x: toiletX, y: 98, w: 12, h: 12 });

      // Bath mat
      px(c, 84, 128, 34, 12, "#4d6b73");
      px(c, 86, 130, 30, 8, "#63858f");
    }

    // Wall Medicine Cabinet & Light Switch in Bathroom
    const medX = isVert ? (doorDir === "N" ? 116 : 80) : 146;
    const medY = isVert ? 20 : 66;
    drawMedicineCabinet(c, medX, medY);

    const swX = isVert ? 80 : 34;
    const swY = isVert ? 34 : 78;
    drawWallLightSwitch(c, swX, swY, false);
    interactables.push({
      id: "room_light_switch", x: swX + 2, y: isVert ? 58 : 104, r: 20,
      type: "light_switch",
      swX: swX, swY: swY,
      prompt: "[E] TURN LIGHT ON"
    });

    return {
      colliders,
      interactables,
      darknessLevel: 0.62,
      lights: [{ x: 104, y: 120, r: 78, color: "205, 232, 240", strength: 0.72, halo: 0.14 }]
    };
  }

  // ==================== 3. THE FURNACE ROOM (COMPACT INDUSTRIAL BOILER) ====================
  function drawCastIronFurnace(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.48)";
    c.fillRect(x - 2, y + 26, 36, 6);
    // Heavy exhaust flue rising to ceiling
    px(c, x + 12, y - 22, 8, 24, "#232529");
    px(c, x + 14, y - 22, 3, 24, "#42464f");
    // Cast-iron cylindrical boiler body
    px(c, x, y, 32, 28, "#16171a");
    px(c, x + 2, y + 2, 28, 24, "#35383e");
    px(c, x + 4, y + 3, 6, 22, "#4d525c");
    // Iron rivets & pressure gauge
    px(c, x + 2, y + 7, 28, 2, "#232529");
    px(c, x + 2, y + 20, 28, 2, "#232529");
    px(c, x + 22, y + 3, 5, 5, "#c9a452");
    px(c, x + 23, y + 4, 3, 3, "#f0ead6");
    // Firebox grate door (glowing embers animated in renderRoom!)
    px(c, x + 9, y + 11, 14, 9, "#140b09");
    px(c, x + 10, y + 12, 12, 7, "#8f2714");
    px(c, x + 12, y + 13, 8, 5, "#e06224");
    px(c, x + 13, y + 12, 1, 7, "#1a1414");
    px(c, x + 16, y + 12, 1, 7, "#1a1414");
    px(c, x + 19, y + 12, 1, 7, "#1a1414");
  }

  function drawCoalBin(c, x, y) {
    px(c, x, y, 22, 16, "#1f140d");
    px(c, x + 1, y + 1, 20, 14, "#4a301e");
    px(c, x + 3, y + 3, 16, 10, "#17181c");
    px(c, x + 5, y + 4, 5, 4, "#2d3038");
    px(c, x + 11, y + 5, 6, 5, "#26282e");
    px(c, x + 8, y + 8, 5, 4, "#363a42");
  }

  function populateFurnaceRoom(c, room, geo) {
    const rng = createRng(5521);
    const d = room.doors || { N: true };
    const doorDir = d.N ? "N" : d.S ? "S" : d.W ? "W" : "E";
    const isVert = doorDir === "N" || doorDir === "S";

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#181414",
        cutawayTrim: "#3d3330",
        wallStyle: "brick",
        wallUpper: "#453733",
        brickCols: ["#4a3a35", "#3d302c", "#52403a", "#362b28"],
        floorStyle: "stone",
        floorCols: ["#332e2c", "#2d2827", "#3b3533", "#292423"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];
    let emberPos = { x: 104, y: 120 };

    if (isVert) {
      // Compact industrial rectangle (x: 50..158, y: 52..194)
      // Horizontal copper steam pipe along North wall
      if (doorDir !== "N") {
        px(c, 52, 22, 104, 3, "#7a4c2d");
        px(c, 52, 23, 104, 1, "#b57445");
        px(c, 74, 20, 5, 7, "#b83232"); // Red valve wheel
      }
      drawBreakerBox(c, doorDir === "N" ? 64 : 134, 24);

      if (doorDir === "N") {
        drawCastIronFurnace(c, 88, 158);
        emberPos = { x: 104, y: 172 };
        colliders.push({ x: 88, y: 162, w: 32, h: 24 });

        drawCoalBin(c, 54, 108);
        colliders.push({ x: 54, y: 110, w: 22, h: 14 });
        drawOakBarrel(c, 142, 108);
        colliders.push({ x: 142, y: 110, w: 12, h: 14 });
      } else {
        // Door at South -> Furnace proudly against North wall!
        drawCastIronFurnace(c, 88, 44);
        emberPos = { x: 104, y: 58 };
        colliders.push({ x: 88, y: 50, w: 32, h: 22 });

        drawCoalBin(c, 54, 108);
        colliders.push({ x: 54, y: 110, w: 22, h: 14 });
        drawOakBarrel(c, 142, 108);
        colliders.push({ x: 142, y: 110, w: 12, h: 14 });
      }
    } else {
      // Horizontal rectangular Furnace Room (x: 14..194, y: 82..170; North wall y: 44..82)
      px(c, 18, 54, 172, 3, "#7a4c2d");
      px(c, 18, 55, 172, 1, "#b57445");
      px(c, 92, 52, 5, 7, "#b83232");
      drawBreakerBox(c, 120, 56);

      const fX = doorDir === "W" ? 154 : 22;
      drawCastIronFurnace(c, fX, 112);
      emberPos = { x: fX + 16, y: 126 };
      colliders.push({ x: fX, y: 116, w: 32, h: 24 });

      drawCoalBin(c, 68, 78);
      colliders.push({ x: 68, y: 82, w: 22, h: 12 });
      drawOakBarrel(c, 112, 150);
      colliders.push({ x: 112, y: 152, w: 12, h: 14 });
    }

    const fBrkX = isVert ? (doorDir === "N" ? 64 : 134) : 120;
    const fBrkY = isVert ? 58 : 90;

    const fSwX = isVert ? (doorDir === "N" ? 80 : 120) : 138;
    const fSwY = isVert ? 34 : 62;
    drawWallLightSwitch(c, fSwX, fSwY, false);
    interactables.push({
      id: "room_light_switch", x: fSwX + 2, y: isVert ? 58 : 90, r: 20,
      type: "light_switch",
      swX: fSwX, swY: fSwY,
      prompt: "[E] TURN LIGHT ON"
    });

    return {
      colliders,
      interactables,
      switchPos: { x: fSwX, y: fSwY },
      darknessLevel: 0.78,
      emberPos,
      lights: [
        { x: emberPos.x, y: emberPos.y, r: 74, color: "255, 128, 54", strength: 0.85, halo: 0.28, flicker: true, alwaysOn: true }
      ]
    };
  }

  // ==================== 4. THE KITCHEN (TRUE L-SHAPED ROOM!) ====================
  function drawVintageFridge(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.38)";
    c.fillRect(x - 1, y + 26, 20, 4);
    px(c, x, y, 18, 28, "#2a3338");
    px(c, x + 1, y + 1, 16, 26, "#d7e0dc");
    px(c, x + 2, y + 2, 14, 9, "#e6efe9");  // Freezer door
    px(c, x + 2, y + 12, 14, 14, "#cfd9d4"); // Main fridge door
    px(c, x + 2, y + 11, 14, 1, "#6d7a75");
    px(c, x + 13, y + 5, 2, 4, "#7a8580");   // Chrome handles
    px(c, x + 13, y + 15, 2, 6, "#7a8580");
  }

  function drawKitchenStove(c, x, y) {
    px(c, x, y, 22, 20, "#1c1d21");
    px(c, x + 1, y + 1, 20, 18, "#383b42");
    px(c, x + 2, y + 2, 18, 8, "#26282e");
    // 4 cast-iron burners + copper kettle on burner
    px(c, x + 4, y + 3, 4, 3, "#141517");
    px(c, x + 13, y + 3, 4, 3, "#141517");
    px(c, x + 4, y + 7, 4, 2, "#141517");
    px(c, x + 13, y + 7, 4, 2, "#141517");
    px(c, x + 13, y + 1, 5, 4, "#b86b35"); // Copper kettle
    // Oven door front
    px(c, x + 3, y + 12, 16, 6, "#212329");
    px(c, x + 5, y + 13, 12, 1, "#9aa3ad");
  }

  function drawKitchenCounter(c, x, y, w, h, hasSink) {
    c.fillStyle = "rgba(0,0,0,0.34)";
    c.fillRect(x, y + h - 1, w, 3);
    px(c, x, y, w, h, "#2b1a0f");
    px(c, x + 1, y + 1, w - 2, 6, "#d9ccb4"); // Butcher-block/stone counter top
    px(c, x + 1, y + 7, w - 2, h - 8, "#6e472b"); // Wooden cupboards
    for (let cx = x + 4; cx < x + w - 5; cx += 10) {
      px(c, cx, y + 9, 8, h - 12, "#54341e");
      px(c, cx + 3, y + 10, 2, 1, "#d4b05c"); // Brass drawer pull
    }
    if (hasSink) {
      px(c, x + Math.floor(w / 2) - 5, y + 2, 10, 4, "#748c99");
      px(c, x + Math.floor(w / 2) - 1, y + 1, 2, 2, "#b5c2c9");
    }
  }

  function populateKitchen(c, room, geo) {
    const rng = createRng(6210);
    const d = room.doors || { N: true, E: true };

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#291a10",
        cutawayTrim: "#593b25",
        wallStyle: "wood",
        wallUpper: "#6e6151",
        chairRail: "#7d5133",
        wainscot: "#573822",
        wainscotPanel: "#6b452a",
        floorStyle: "checker",
        tileSize: 8,
        floorCols: ["#c9b896", "#8c6142"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];

    // Place Fridge, Stove & Counters strictly along CLOSED walls of this L-orientation!
    if (d.N && d.E) {
      // Floor: x 52..146 (y 52..166) U x 52..194 (y 86..166)
      // Closed walls: West (x=52), South (y=166), East-arm North (x=148..194, y=86)
      drawVintageFridge(c, 56, 36);
      colliders.push({ x: 56, y: 50, w: 18, h: 14 });

      drawKitchenStove(c, 152, 74);
      colliders.push({ x: 152, y: 84, w: 22, h: 12 });

      drawKitchenCounter(c, 74, 148, 56, 16, true);
      colliders.push({ x: 74, y: 150, w: 56, h: 14 });
    } else if (d.E && d.S) {
      // Floor: x 52..146 (y 82..194) U x 52..194 (y 82..162)
      // Closed walls: Full North (x=52..194, y=82), West (x=52)
      drawVintageFridge(c, 58, 66);
      colliders.push({ x: 58, y: 80, w: 18, h: 14 });

      drawKitchenCounter(c, 80, 74, 54, 16, true);
      colliders.push({ x: 80, y: 80, w: 54, h: 12 });

      drawKitchenStove(c, 138, 72);
      colliders.push({ x: 138, y: 80, w: 22, h: 12 });
    } else if (d.S && d.W) {
      // Floor: x 62..156 (y 82..194) U x 14..156 (y 82..162)
      // Closed walls: Full North (x=14..156, y=82), East (x=156)
      drawVintageFridge(c, 132, 66);
      colliders.push({ x: 132, y: 80, w: 18, h: 14 });

      drawKitchenCounter(c, 72, 74, 54, 16, true);
      colliders.push({ x: 72, y: 80, w: 54, h: 12 });

      drawKitchenStove(c, 42, 72);
      colliders.push({ x: 42, y: 80, w: 22, h: 12 });
    } else {
      // W & N: Floor x 62..156 (y 52..166) U x 14..156 (y 86..166)
      drawVintageFridge(c, 134, 36);
      colliders.push({ x: 134, y: 50, w: 18, h: 14 });

      drawKitchenStove(c, 32, 74);
      colliders.push({ x: 32, y: 84, w: 22, h: 12 });

      drawKitchenCounter(c, 78, 148, 56, 16, true);
      colliders.push({ x: 78, y: 150, w: 56, h: 14 });
    }

    // Framed antique painting & wall light switch in Kitchen
    const kpX = (d.N && d.E) ? 162 : (d.E && d.S) ? 104 : (d.S && d.W) ? 88 : 26;
    const kpY = (d.N && d.E) ? 54 : (d.E && d.S) ? 50 : (d.S && d.W) ? 50 : 54;
    drawWallPortrait(c, kpX, kpY, 16, 15, "#54412e");
    interactables.push({
      id: "kitchen_painting", x: kpX + 8, y: kpY + 40, r: 24,
      prompt: "[E] INSPECT PAINTING",
      paintingId: "kitchen_carriage",
      roomId: room.id
    });
    const kSwX = (d.N && d.E) ? 136 : (d.W && d.N) ? 72 : 122;
    const kSwY = (d.N && d.E) || (d.W && d.N) ? 32 : 66;
    drawWallLightSwitch(c, kSwX, kSwY, false);
    interactables.push({
      id: "room_light_switch", x: kSwX + 2, y: kSwY + 26, r: 20,
      type: "light_switch",
      swX: kSwX, swY: kSwY,
      prompt: "[E] TURN LIGHT ON"
    });

    return {
      colliders,
      interactables,
      darknessLevel: 0.56,
      lights: [{ x: 104, y: 118, r: 94, color: "255, 226, 168", strength: 0.78, halo: 0.14 }]
    };
  }

  // ==================== 5. THE BEDROOM (TRUE L-SHAPED ROOM!) ====================
  function drawDoubleBed(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.40)";
    c.fillRect(x - 1, y + 32, 34, 4);
    // Wooden headboard & frame
    px(c, x, y, 32, 34, "#24150d");
    px(c, x + 1, y + 1, 30, 6, "#5c3922");
    px(c, x + 2, y + 2, 28, 3, "#784c2e");
    // Two cream pillows
    px(c, x + 3, y + 7, 12, 7, "#e8dfd0");
    px(c, x + 17, y + 7, 12, 7, "#e8dfd0");
    px(c, x + 4, y + 8, 10, 5, "#f5efe4");
    px(c, x + 18, y + 8, 10, 5, "#f5efe4");
    // Burgundy quilted blanket + folded white sheet trim
    px(c, x + 2, y + 14, 28, 3, "#d6cbb8");
    px(c, x + 2, y + 17, 28, 15, "#7d2c36");
    px(c, x + 4, y + 19, 24, 11, "#943843");
    // Patchwork quilt pattern
    px(c, x + 8, y + 21, 5, 4, "#b88c48");
    px(c, x + 19, y + 24, 5, 4, "#b88c48");
    // Footboard posts
    px(c, x, y + 31, 4, 4, "#4a2c1a");
    px(c, x + 28, y + 31, 4, 4, "#4a2c1a");
  }

  function drawNightstandLamp(c, x, y) {
    px(c, x, y, 13, 14, "#24150d");
    px(c, x + 1, y + 1, 11, 12, "#6b4328");
    px(c, x + 2, y + 6, 9, 5, "#4f301c");
    px(c, x + 6, y + 8, 1, 1, "#d9b45a");
    // Warm shaded table lamp
    px(c, x + 5, y - 3, 3, 5, "#a38343");
    px(c, x + 3, y - 7, 7, 5, "#f0d38b");
    px(c, x + 4, y - 6, 5, 3, "#fff6cc");
  }

  function drawWardrobe(c, x, y) {
    c.fillStyle = "rgba(0,0,0,0.40)";
    c.fillRect(x - 1, y + 22, 24, 4);
    px(c, x, y, 22, 24, "#1f120b");
    px(c, x + 1, y + 1, 20, 22, "#54341e");
    px(c, x + 2, y + 3, 8, 18, "#694227");
    px(c, x + 12, y + 3, 8, 18, "#694227");
    px(c, x + 9, y + 11, 1, 2, "#d9b45a");
    px(c, x + 12, y + 11, 1, 2, "#d9b45a");
  }

  function populateBedroom(c, room, geo) {
    const rng = createRng(8842);
    const d = room.doors || { N: true, E: true };

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#261610",
        cutawayTrim: "#573724",
        wallStyle: "wood",
        wallUpper: "#593e44",
        chairRail: "#784d2e",
        wainscot: "#4d301e",
        wainscotPanel: "#633f28",
        floorStyle: "wood",
        floorCols: ["#7d5236", "#734a30", "#85583b", "#6b432b"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];
    let lampPos = { x: 104, y: 120 };

    // Cozy braided bedroom rug in center
    fillPixelEllipse(c, 104, 124, 24, 16, "#4d2630");
    fillPixelEllipse(c, 104, 124, 20, 12, "#8f6942");
    fillPixelEllipse(c, 104, 124, 16, 9, "#69323f");

    if (d.N && d.E) {
      // Closed: West (x=52), South (y=166), East-arm North (x=148..194, y=86)
      drawDoubleBed(c, 58, 124);
      colliders.push({ x: 58, y: 128, w: 32, h: 30 });

      drawNightstandLamp(c, 92, 146);
      lampPos = { x: 98, y: 142 };
      colliders.push({ x: 92, y: 148, w: 13, h: 12 });

      drawWardrobe(c, 158, 66);
      colliders.push({ x: 158, y: 78, w: 22, h: 14 });
      drawWallPortrait(c, 66, 20, 18, 16, "#543a4f");
    } else if (d.E && d.S) {
      // Closed: Full North (x=52..194, y=82), West (x=52)
      drawDoubleBed(c, 60, 76);
      colliders.push({ x: 60, y: 82, w: 32, h: 28 });

      drawNightstandLamp(c, 96, 78);
      lampPos = { x: 102, y: 76 };
      colliders.push({ x: 96, y: 82, w: 13, h: 10 });

      drawWardrobe(c, 148, 64);
      colliders.push({ x: 148, y: 76, w: 22, h: 14 });
      drawWallPortrait(c, 118, 50, 18, 16, "#543a4f");
    } else if (d.S && d.W) {
      // Closed: Full North (x=14..156, y=82), East (x=156)
      drawDoubleBed(c, 118, 76);
      colliders.push({ x: 118, y: 82, w: 32, h: 28 });

      drawNightstandLamp(c, 100, 78);
      lampPos = { x: 106, y: 76 };
      colliders.push({ x: 100, y: 82, w: 13, h: 10 });

      drawWardrobe(c, 36, 64);
      colliders.push({ x: 36, y: 76, w: 22, h: 14 });
      drawWallPortrait(c, 70, 50, 18, 16, "#543a4f");
    } else {
      // W & N: Closed East (x=156), South (y=166), West-arm North (x=14..62, y=86)
      drawDoubleBed(c, 118, 124);
      colliders.push({ x: 118, y: 128, w: 32, h: 30 });

      drawNightstandLamp(c, 102, 146);
      lampPos = { x: 108, y: 142 };
      colliders.push({ x: 102, y: 148, w: 13, h: 12 });

      drawWardrobe(c, 26, 66);
      colliders.push({ x: 26, y: 78, w: 22, h: 14 });
      drawWallPortrait(c, 126, 20, 18, 16, "#543a4f");
    }

    // Make Bedroom Wall Portrait inspectable -> opens real Victorian Lady painting!
    const bpX = (d.N && d.E) ? 66 : (d.E && d.S) ? 118 : (d.S && d.W) ? 70 : 126;
    const bpY = (d.N && d.E) || (d.W && d.N) ? 20 : 50;
    interactables.push({
      id: "bedroom_portrait", x: bpX + 9, y: bpY + 42, r: 24,
      prompt: "[E] INSPECT PORTRAIT",
      paintingId: "bedroom_lady",
      roomId: room.id
    });

    // Attic pull-cord hatch on ceiling/floor (The Attic / Hayloft Ritual reference!)
    const hatX = 104;
    const hatY = (d.E && d.S) || (d.S && d.W) ? 100 : 108;
    px(c, hatX - 6, hatY - 6, 12, 12, "rgba(25, 16, 12, 0.35)");
    px(c, hatX - 1, hatY - 4, 2, 7, "#c9b389");

    const bSwX = (d.N && d.E) ? 132 : (d.W && d.N) ? 74 : 138;
    const bSwY = (d.N && d.E) || (d.W && d.N) ? 34 : 66;
    drawWallLightSwitch(c, bSwX, bSwY, false);
    interactables.push({
      id: "room_light_switch", x: bSwX + 2, y: bSwY + 24, r: 20,
      type: "light_switch",
      swX: bSwX, swY: bSwY,
      prompt: "[E] TURN LIGHT ON"
    });

    return {
      colliders,
      interactables,
      darknessLevel: 0.68,
      lights: [
        { x: lampPos.x, y: lampPos.y, r: 78, color: "255, 208, 130", strength: 0.82, halo: 0.22 }
      ]
    };
  }

  // ==================== 6. THE STUDY (ELONGATED RECTANGULAR LIBRARY) ====================
  function drawStudyDesk(c, x, y, vertical) {
    c.fillStyle = "rgba(0,0,0,0.40)";
    if (vertical) {
      c.fillRect(x - 1, y + 30, 20, 4);
      px(c, x, y, 18, 32, "#1f120b");
      px(c, x + 1, y + 1, 16, 30, "#593720");
      px(c, x + 2, y + 2, 14, 28, "#70472b");
      // Open leather ledger
      px(c, x + 5, y + 11, 8, 10, "#ebe0c7");
      px(c, x + 9, y + 11, 1, 10, "#a89879");
      // Classic green Banker's Lamp!
      px(c, x + 6, y + 4, 5, 4, "#297a4b");
      px(c, x + 7, y + 5, 3, 2, "#6ef29e");
    } else {
      c.fillRect(x - 1, y + 17, 36, 4);
      px(c, x, y, 34, 18, "#1f120b");
      px(c, x + 1, y + 1, 32, 16, "#593720");
      px(c, x + 2, y + 2, 30, 10, "#70472b");
      // Open leather ledger
      px(c, x + 12, y + 4, 10, 7, "#ebe0c7");
      px(c, x + 17, y + 4, 1, 7, "#a89879");
      // Classic green Banker's Lamp!
      px(c, x + 4, y + 3, 6, 4, "#297a4b");
      px(c, x + 5, y + 4, 4, 2, "#6ef29e");
    }
  }

  function drawStudyBookshelf(c, x, y, w) {
    px(c, x, y, w, 34, "#26160e");
    px(c, x + 1, y + 1, w - 2, 32, "#4f311d");
    const bCols = ["#8c2e38", "#35557a", "#386b49", "#a88238", "#5f3e70"];
    [y + 3, y + 13, y + 23].forEach((sy, sIdx) => {
      px(c, x + 3, sy, w - 6, 7, "#1a100a");
      for (let bx = x + 4; bx < x + w - 6; bx += 4) {
        px(c, bx, sy + 1, 3, 6, bCols[(bx + sIdx) % bCols.length]);
      }
      px(c, x + 2, sy + 7, w - 4, 2, "#6e462a");
    });
  }

  function populateStudy(c, room, geo) {
    const rng = createRng(9931);
    const d = room.doors || { N: true, S: true };
    const isVert = d.N && d.S;

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#1f130c",
        cutawayTrim: "#4a301e",
        wallStyle: "wood",
        wallUpper: "#364d3e", // Classic forest-green study wallpaper
        chairRail: "#6e4629",
        wainscot: "#422918",
        wainscotPanel: "#593822",
        floorStyle: "wood",
        floorCols: ["#69442b", "#5e3c25", "#70492f", "#573722"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];
    let lampPos = { x: 104, y: 120 };

    if (isVert) {
      // Elongated vertical Study (x: 48..160, y: 52..194)
      // Persian runner rug down the center between N & S doors
      px(c, 88, 66, 32, 114, "#3b5944");
      px(c, 90, 68, 28, 110, "#9e8144");
      px(c, 92, 70, 24, 106, "#2c4534");

      // Bookcases flanking North door
      drawStudyBookshelf(c, 52, 20, 32);
      colliders.push({ x: 52, y: 46, w: 32, h: 10 });
      drawStudyBookshelf(c, 124, 20, 32);
      colliders.push({ x: 124, y: 46, w: 32, h: 10 });

      // Heavy Oak Desk + Banker's Lamp on West wall (keeping center x=86..126 totally clear!)
      drawStudyDesk(c, 52, 104, true);
      lampPos = { x: 61, y: 110 };
      colliders.push({ x: 52, y: 106, w: 18, h: 30 });

      // Globe & armchair on East side
      px(c, 144, 106, 10, 12, "#2b190f");
      fillPixelEllipse(c, 149, 105, 5, 5, "#467582");
      px(c, 147, 104, 4, 2, "#5b8f59");
      colliders.push({ x: 144, y: 104, w: 12, h: 14 });
    } else {
      // Elongated horizontal Study (x: 14..194, y: 76..176; North wall y: 38..76)
      px(c, 32, 110, 144, 32, "#3b5944");
      px(c, 34, 112, 140, 28, "#9e8144");
      px(c, 36, 114, 136, 24, "#2c4534");

      drawStudyBookshelf(c, 28, 44, 34);
      colliders.push({ x: 28, y: 70, w: 34, h: 10 });
      drawStudyBookshelf(c, 144, 44, 34);
      colliders.push({ x: 144, y: 70, w: 34, h: 10 });
      drawWallPortrait(c, 94, 46, 20, 16, "#3a5c46");

      // Heavy Oak Desk along South wall
      drawStudyDesk(c, 88, 152, false);
      lampPos = { x: 95, y: 156 };
      colliders.push({ x: 88, y: 154, w: 34, h: 16 });
    }

    if (isVert) {
      drawWallPortrait(c, 52, 54, 16, 15, "#3a4a3f");
      interactables.push({
        id: "study_portrait", x: 64, y: 74, r: 22,
        prompt: "[E] INSPECT PORTRAIT",
        paintingId: "study_gloves",
        roomId: room.id
      });
      drawWallLightSwitch(c, 84, 34, false);
      interactables.push({
        id: "room_light_switch", x: 86, y: 58, r: 20,
        type: "light_switch",
        swX: 84, swY: 34,
        prompt: "[E] TURN LIGHT ON"
      });
    } else {
      interactables.push({
        id: "study_portrait", x: 104, y: 84, r: 24,
        prompt: "[E] INSPECT PORTRAIT",
        paintingId: "study_gloves",
        roomId: room.id
      });
      drawWallLightSwitch(c, 74, 56, false);
      interactables.push({
        id: "room_light_switch", x: 76, y: 84, r: 20,
        type: "light_switch",
        swX: 74, swY: 56,
        prompt: "[E] TURN LIGHT ON"
      });
    }

    return {
      colliders,
      interactables,
      darknessLevel: 0.66,
      lights: [
        { x: lampPos.x, y: lampPos.y, r: 78, color: "160, 245, 185", strength: 0.80, halo: 0.22 }
      ]
    };
  }

  // ==================== 7. THE LIVING ROOM (SPACIOUS T-SHAPED PARLOR!) ====================
  function drawLivingSofa(c, x, y, horizontal) {
    if (horizontal) {
      c.fillStyle = "rgba(0,0,0,0.40)";
      c.fillRect(x - 1, y + 17, 46, 4);
      px(c, x, y, 44, 18, "#291418");
      px(c, x + 1, y + 1, 42, 7, "#7d2c36"); // Plush backrest
      px(c, x + 2, y + 2, 40, 4, "#963944");
      px(c, x + 1, y + 7, 5, 10, "#66222a"); // Left armrest
      px(c, x + 38, y + 7, 5, 10, "#66222a"); // Right armrest
      // 3 plump velvet seat cushions
      px(c, x + 6, y + 8, 10, 8, "#8c333e");
      px(c, x + 17, y + 8, 10, 8, "#8c333e");
      px(c, x + 28, y + 8, 10, 8, "#8c333e");
      px(c, x + 7, y + 9, 8, 2, "#a84450");
      px(c, x + 18, y + 9, 8, 2, "#a84450");
      px(c, x + 29, y + 9, 8, 2, "#a84450");
    } else {
      c.fillStyle = "rgba(0,0,0,0.40)";
      c.fillRect(x - 1, y + 40, 20, 4);
      px(c, x, y, 18, 42, "#291418");
      px(c, x + 1, y + 1, 6, 40, "#7d2c36");
      px(c, x + 1, y + 1, 16, 5, "#66222a");
      px(c, x + 1, y + 36, 16, 5, "#66222a");
      px(c, x + 7, y + 6, 9, 9, "#8c333e");
      px(c, x + 7, y + 16, 9, 10, "#8c333e");
      px(c, x + 7, y + 27, 9, 9, "#8c333e");
    }
  }

  function drawCoffeeTable(c, x, y, w, h) {
    c.fillStyle = "rgba(0,0,0,0.34)";
    c.fillRect(x, y + h - 1, w, 3);
    px(c, x, y, w, h, "#29170d");
    px(c, x + 1, y + 1, w - 2, h - 3, "#784c2e");
    px(c, x + 2, y + 2, w - 4, h - 5, "#8f5d3a");
    px(c, x + 4, y + 3, 6, 5, "#d6ccb4"); // Open book on coffee table
  }

  function drawStandingClockStatic(c, x, y) {
    px(c, x + 1, y, 12, 34, "#24130a");
    px(c, x + 2, y + 1, 10, 32, "#593520");
    fillPixelEllipse(c, x + 7, y + 8, 4, 4, "#efe4c8");
    px(c, x + 7, y + 6, 1, 3, "#1c1512");
    px(c, x + 7, y + 8, 2, 1, "#1c1512");
    px(c, x + 5, y + 15, 4, 13, "#14100e");
    px(c, x + 6, y + 23, 2, 3, "#e8c468");
  }

  function populateLivingRoom(c, room, geo) {
    const rng = createRng(3318);
    const d = room.doors || { N: true, E: true, S: true };

    drawRectilinearShell(
      c,
      geo.floorRects,
      {
        outerFrame: "#29180f",
        cutawayTrim: "#573823",
        wallStyle: "wood",
        wallUpper: "#5c4d40",
        chairRail: "#825434",
        wainscot: "#573721",
        wainscotPanel: "#6e472c",
        floorStyle: "wood",
        floorCols: ["#8a5b37", "#805331", "#91613b", "#784c2c"]
      },
      d,
      room.connectedDoors,
      rng
    );

    const colliders = [];
    const interactables = [];

    // Large warm woven parlor rug in center
    px(c, 74, 96, 60, 56, "#4d2228");
    px(c, 77, 99, 54, 50, "#b58d4a");
    px(c, 80, 102, 48, 44, "#6e2c35");

    // Place Sofa, Coffee Table & Standing Clock cleanly against the 1 closed side of the T!
    if (!d.W) {
      // Closed West wall (x=42) -> Vertical Sofa + Coffee Table on West, Standing Clock on North-Left!
      drawLivingSofa(c, 46, 104, false);
      colliders.push({ x: 46, y: 106, w: 18, h: 38 });

      drawCoffeeTable(c, 68, 114, 14, 22);
      colliders.push({ x: 68, y: 116, w: 14, h: 18 });

      drawStandingClockStatic(c, 58, 22);
      colliders.push({ x: 58, y: 46, w: 14, h: 10 });
      drawWallPortrait(c, 126, 20, 20, 16, "#5c4333");
    } else if (!d.N) {
      // Closed North wall (y=72) -> Horizontal Sofa + Coffee Table against North wall, Clock beside it!
      drawLivingSofa(c, 82, 68, true);
      colliders.push({ x: 82, y: 74, w: 44, h: 12 });

      drawCoffeeTable(c, 89, 92, 30, 12);
      colliders.push({ x: 89, y: 94, w: 30, h: 10 });

      drawStandingClockStatic(c, 140, 42);
      colliders.push({ x: 140, y: 66, w: 14, h: 10 });
      drawWallPortrait(c, 52, 42, 20, 16, "#5c4333");
    } else if (!d.E) {
      // Closed East wall (x=166) -> Vertical Sofa on East, Clock on North-Right
      drawLivingSofa(c, 144, 104, false);
      colliders.push({ x: 144, y: 106, w: 18, h: 38 });

      drawCoffeeTable(c, 126, 114, 14, 22);
      colliders.push({ x: 126, y: 116, w: 14, h: 18 });

      drawStandingClockStatic(c, 134, 22);
      colliders.push({ x: 134, y: 46, w: 14, h: 10 });
      drawWallPortrait(c, 62, 20, 20, 16, "#5c4333");
    } else {
      // Closed South wall (y=174) -> Horizontal Sofa + Coffee Table along South wall, Clock on North-Left!
      drawLivingSofa(c, 82, 152, true);
      colliders.push({ x: 82, y: 154, w: 44, h: 16 });

      drawCoffeeTable(c, 89, 134, 30, 12);
      colliders.push({ x: 89, y: 136, w: 30, h: 10 });

      drawStandingClockStatic(c, 64, 22);
      colliders.push({ x: 64, y: 46, w: 14, h: 10 });
      drawWallPortrait(c, 126, 20, 20, 16, "#5c4333");
    }

    const lpX = !d.W ? 126 : !d.N ? 52 : !d.E ? 62 : 126;
    const lpY = !d.N ? 42 : 20;
    interactables.push({
      id: "living_painting", x: lpX + 10, y: lpY + 42, r: 24,
      prompt: "[E] INSPECT PAINTING",
      paintingId: "living_abbey",
      roomId: room.id
    });

    // Vintage wooden radio on small side stand in Living Room (Musical Rooms reference!)
    const radX = !d.W ? 136 : !d.E ? 58 : 162;
    const radY = !d.N ? 142 : !d.S ? 96 : 154;
    px(c, radX, radY, 12, 10, "#24150d");
    px(c, radX + 1, radY + 1, 10, 8, "#6e4427");
    px(c, radX + 2, radY + 2, 6, 4, "#b89c6a"); // Speaker grill
    px(c, radX + 9, radY + 3, 1, 1, "#d9b45a"); // Tuning dial
    px(c, radX + 9, radY + 5, 1, 1, "#d9b45a");
    colliders.push({ x: radX, y: radY + 1, w: 12, h: 9 });

    const lSwX = !d.N ? 126 : 118;
    const lSwY = !d.N ? 54 : 34;
    drawWallLightSwitch(c, lSwX, lSwY, false);
    interactables.push({
      id: "room_light_switch", x: lSwX + 2, y: lSwY + 24, r: 20,
      type: "light_switch",
      swX: lSwX, swY: lSwY,
      prompt: "[E] TURN LIGHT ON"
    });

    return {
      colliders,
      interactables,
      darknessLevel: 0.54,
      lights: [{ x: 104, y: 118, r: 102, color: "255, 220, 152", strength: 0.84, halo: 0.16 }]
    };
  }

  // ==================== 8-12. HALLWAYS (L-HALL, STRAIGHT I & II, T-HALL I & II) ====================
  function populateHallway(c, room, geo) {
    const isVariant2 = room.id === "bp_hallway_2" || room.id === "bp_t_hallway_2";
    const rng = createRng(isVariant2 ? 2122 : 1121);
    const d = room.doors || {};

    drawRectilinearShell(
      c,
      geo.floorRects,
      isVariant2
        ? {
            outerFrame: "#1b1a1c",
            cutawayTrim: "#3f3b3a",
            wallStyle: "wood",
            wallUpper: "#464a4f",
            chairRail: "#5c4d3e",
            wainscot: "#382d26",
            wainscotPanel: "#4a3b32",
            floorStyle: "wood",
            floorCols: ["#5e5348", "#544a40", "#665a4e", "#4d433a"]
          }
        : {
            outerFrame: "#24160e",
            cutawayTrim: "#4d311f",
            wallStyle: "wood",
            wallUpper: "#57463b",
            chairRail: "#754b2d",
            wainscot: "#4d301e",
            wainscotPanel: "#613d26",
            floorStyle: "wood",
            floorCols: ["#734c30", "#69442a", "#7a5234", "#613e26"]
          },
      d,
      room.connectedDoors,
      rng
    );

    // Draw narrow woven runner carpets along every corridor arm!
    const rugOuter = isVariant2 ? "#2d4547" : "#5e222a";
    const rugTrim = isVariant2 ? "#9e8e5c" : "#b8914a";
    const rugInner = isVariant2 ? "#3a5759" : "#782b35";

    geo.floorRects.forEach((r) => {
      const rw = r.x2 - r.x1;
      const rh = r.y2 - r.y1;
      if (rh > rw) {
        // Vertical corridor runner
        px(c, r.x1 + 14, r.y1 + 6, rw - 28, rh - 12, rugOuter);
        px(c, r.x1 + 16, r.y1 + 8, rw - 32, rh - 16, rugTrim);
        px(c, r.x1 + 18, r.y1 + 10, rw - 36, rh - 20, rugInner);
      } else {
        // Horizontal corridor runner
        px(c, r.x1 + 6, r.y1 + 14, rw - 12, rh - 28, rugOuter);
        px(c, r.x1 + 8, r.y1 + 16, rw - 16, rh - 32, rugTrim);
        px(c, r.x1 + 10, r.y1 + 18, rw - 20, rh - 36, rugInner);
      }
    });

    const lights = [];
    const interactables = [];

    // Wall sconces, REAL inspectable framed portraits (open Painting Modal with [E]!), Light Switch & Hallway Furniture!
    const portraitMap = {
      bp_l_hallway:   "hall_lady_black",
      bp_hallway_1:   "hall_rembrandt",
      bp_hallway_2:   "hall2_goya",
      bp_t_hallway_1: "thall_chasseur",
      bp_t_hallway_2: "dining_founder"
    };
    const hallPaintingId = portraitMap[room.id] || "hall_rembrandt";
    const hasHorizNorthWall = !d.N && geo.floorRects.some((r) => r.y1 > 80);

    if (hasHorizNorthWall) {
      // Horizontal corridor wing with long North wall at y=64..102!
      const leftBound = geo.floorRects.reduce((m, r) => Math.min(m, r.x1), 208);
      const rightBound = geo.floorRects.reduce((m, r) => Math.max(m, r.x2), 0);
      const midX = Math.round((leftBound + rightBound) / 2);

      // Left & right sconces
      const sc1 = Math.max(leftBound + 18, midX - 42);
      const sc2 = Math.min(rightBound - 18, midX + 42);
      drawWallSconce(c, sc1, 76);
      drawWallSconce(c, sc2, 76);
      lights.push({ x: sc1, y: 84, r: 56, color: "255, 206, 128", strength: 0.74, halo: 0.18 });
      lights.push({ x: sc2, y: 84, r: 56, color: "255, 206, 128", strength: 0.74, halo: 0.18 });

      // Framed Oil Portrait on North wall (ALWAYS inspectable -> opens Painting Modal!)
      const pX = isVariant2 ? Math.max(leftBound + 26, midX - 30) : midX - 9;
      drawWallPortrait(c, pX, 68, 18, 16, isVariant2 ? "#3d464f" : "#4a3832");
      interactables.push({
        id: "hall_portrait", x: pX + 9, y: 112, r: 26,
        prompt: "[E] INSPECT PORTRAIT",
        paintingId: hallPaintingId,
        roomId: room.id
      });

      // Wall Light Switch
      const swX = Math.min(rightBound - 28, midX + 26);
      drawWallLightSwitch(c, swX, 82, false);
      interactables.push({
        id: "room_light_switch", x: swX + 2, y: 110, r: 20,
        type: "light_switch",
        swX: swX, swY: 82,
        prompt: "[E] TURN LIGHT ON"
      });

      if (isVariant2) {
        // Eerie scratched wall text + wall mirror on Variant II corridors
        const gx = Math.min(rightBound - 32, midX + 22);
        c.fillStyle = "rgba(218, 212, 198, 0.48)";
        c.font = "700 5px 'Pixelify Sans', monospace";
        c.textAlign = "center";
        c.fillText("WELCOME TO", gx, 72);
        c.fillText("REALITY", gx, 79);
      } else {
        // Second small companion portrait further down the hall
        const p2X = Math.max(leftBound + 14, sc1 - 8);
        if (Math.abs(p2X - pX) > 22) {
          drawWallPortrait(c, p2X, 68, 14, 14, "#3b4754");
          interactables.push({
            id: "hall_portrait_2", x: p2X + 7, y: 112, r: 20,
            prompt: "[E] INSPECT PORTRAIT",
            paintingId: "hall_lady_black",
            roomId: room.id
          });
        }
      }
    } else {
      // Vertical corridor (N+S) or North-connected L/T corridor!
      // Place inspectable Framed Portrait right on an accessible North wall segment (flanking N door or side arm)!
      if (d.E || d.W) {
        const armX = d.E ? 154 : 38;
        drawWallPortrait(c, armX, 68, 18, 16, isVariant2 ? "#3d464f" : "#4a3832");
        drawWallSconce(c, d.E ? 136 : 70, 76);
        drawWallLightSwitch(c, d.E ? 176 : 26, 82, false);
        lights.push({ x: d.E ? 136 : 70, y: 84, r: 62, color: "255, 208, 132", strength: 0.74, halo: 0.16 });
        interactables.push({
          id: "hall_portrait", x: armX + 9, y: 112, r: 26,
          prompt: "[E] INSPECT PORTRAIT",
          paintingId: hallPaintingId,
          roomId: room.id
        });
        interactables.push({
          id: "room_light_switch", x: d.E ? 176 : 28, y: 110, r: 20,
          type: "light_switch",
          swX: d.E ? 176 : 26, swY: 82,
          prompt: "[E] TURN LIGHT ON"
        });
      } else {
        // Pure vertical Straight Hallway (N & S doors only; x: 78..130)
        // Put Framed Portrait on West/East wall edge (hanging on vertical wall lip) + Wall Sconce + Switch!
        px(c, 74, 108, 4, 18, "#2b1a0e");
        px(c, 75, 110, 2, 14, "#a68544"); // Side-profile framed portrait mounted on West wall!
        px(c, 130, 108, 4, 18, "#2b1a0e");
        px(c, 131, 110, 2, 14, "#a68544"); // Opposite framed portrait on East wall!
        drawWallSconce(c, 84, 30);
        drawWallLightSwitch(c, 120, 32, false);
        lights.push({ x: 104, y: 120, r: 74, color: "255, 208, 132", strength: 0.74, halo: 0.16 });
        interactables.push({
          id: "hall_portrait", x: 86, y: 118, r: 24,
          prompt: "[E] INSPECT PORTRAIT",
          paintingId: hallPaintingId,
          roomId: room.id
        });
        interactables.push({
          id: "hall_portrait_east", x: 122, y: 118, r: 22,
          prompt: "[E] INSPECT PORTRAIT",
          paintingId: isVariant2 ? "thall_chasseur" : "bedroom_lady",
          roomId: room.id
        });
        interactables.push({
          id: "room_light_switch", x: 120, y: 58, r: 20,
          type: "light_switch",
          swX: 120, swY: 32,
          prompt: "[E] TURN LIGHT ON"
        });
      }
    }

    return {
      colliders: [],
      interactables,
      darknessLevel: isVariant2 ? 0.74 : 0.68,
      lights
    };
  }

  // ==================== ROOM CACHE & DISPATCHER ====================
  function getRoomData(room, roomMap) {
    const connected = getConnectedDoors(room, roomMap);
    const sig = `${room.id}:${room.x},${room.y}:r${room.rotation || 0}:${connected.N ? 1 : 0}${connected.E ? 1 : 0}${connected.S ? 1 : 0}${connected.W ? 1 : 0}`;
    if (roomCache.has(sig)) return roomCache.get(sig);

    const geo = computeRoomGeometry(room);
    const cvs = document.createElement("canvas");
    cvs.width = ROOM_W;
    cvs.height = ROOM_H;
    const c = cvs.getContext("2d");
    c.imageSmoothingEnabled = false;

    const roomWithConn = Object.assign({}, room, { connectedDoors: connected });
    let details;

    if (room.id === "bp_cellar") details = populateCellar(c, roomWithConn, geo);
    else if (room.id === "bp_bathroom") details = populateBathroom(c, roomWithConn, geo);
    else if (room.id === "bp_furnace") details = populateFurnaceRoom(c, roomWithConn, geo);
    else if (room.id === "bp_kitchen") details = populateKitchen(c, roomWithConn, geo);
    else if (room.id === "bp_bedroom") details = populateBedroom(c, roomWithConn, geo);
    else if (room.id === "bp_study") details = populateStudy(c, roomWithConn, geo);
    else if (room.id === "bp_living_room") details = populateLivingRoom(c, roomWithConn, geo);
    else details = populateHallway(c, roomWithConn, geo);

    const data = Object.assign(
      {
        canvas: cvs,
        floorRects: geo.floorRects,
        walkRects: geo.walkRects,
        connectedDoors: connected,
        colliders: [],
        interactables: [],
        lights: [],
        darknessLevel: 0.68
      },
      details
    );

    roomCache.set(sig, data);
    return data;
  }

  // ==================== LIVE ROOM RENDERER (PROPS + DYNAMIC LIGHTS + LANTERN) ====================
  function renderRoom(ctx, room, timeSec, lightLevel, player, charConfig, matchState) {
    const data = getRoomData(room, matchState ? matchState.roomMap : null);

    // 1. Static bespoke room layout & furniture
    ctx.drawImage(data.canvas, 0, 0);

    // Animated Furnace Firebox Embers
    if (data.emberPos) {
      const p = Math.sin(timeSec * 8.5) * 0.5 + 0.5;
      px(ctx, data.emberPos.x - 5, data.emberPos.y - 2, 10, 5, p > 0.5 ? "#f5892a" : "#c7431a");
      px(ctx, data.emberPos.x - 3, data.emberPos.y - 1, 6, 3, p > 0.65 ? "#ffe37a" : "#f06e24");
    }

    // 1b. LIVE REVEALED CLUES IN THIS ROOM (visible without inspecting + focusable via [E]!)
    if (App.Clues) {
      App.Clues.renderRoomClues(ctx, room, timeSec, matchState);
    }
    if (App.Attic && App.Attic.renderRoomLadder) {
      App.Attic.renderRoomLadder(ctx, room, timeSec, matchState);
    }

    // 2. Depth-sorted Player + Stalker Entities / Balloons inside the room
    const roomKeyForRender = `${room.x},${room.y}`;
    const spriteCfg = Object.assign({}, charConfig, {
      facing: player.facing,
      walking: player.moving,
      lantern: player.lanternOn
    });
    const roomActors = [
      {
        y: player.y,
        draw: () => {
          if (player.facingCorner && App.Character.drawBackCornerInWorld) {
            App.Character.drawBackCornerInWorld(ctx, player.x, player.y, spriteCfg, timeSec);
          } else {
            App.Character.drawInWorld(ctx, player.x, player.y, spriteCfg, timeSec, {
              seated: false,
              sprinting: player.sprinting,
              crouching: player.crouching
            });
          }
        }
      }
    ];
    if (App.Stalkers && App.Stalkers.getRoomRenderables) {
      App.Stalkers.getRoomRenderables(ctx, roomKeyForRender, timeSec, matchState).forEach((sr) => roomActors.push(sr));
    }
    if (App.Musical && App.Musical.getRoomRenderables) {
      App.Musical.getRoomRenderables(ctx, roomKeyForRender, timeSec, matchState).forEach((mrR) => roomActors.push(mrR));
    }
    if (App.StayLit && App.StayLit.getRoomRenderables) {
      App.StayLit.getRoomRenderables(ctx, roomKeyForRender, timeSec, matchState).forEach((slR) => roomActors.push(slR));
    }
    if (App.Knight && App.Knight.getRoomRenderables) {
      App.Knight.getRoomRenderables(ctx, roomKeyForRender, timeSec, matchState).forEach((knR) => roomActors.push(knR));
    }
    if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch()) {
      App.Network.getRemotePlayersInRoom(room.x, room.y).forEach((rp) => {
        if (rp.deadSpectator || rp.inForest || rp.inCar || rp.inAttic || rp.inBasement) return;
        if (rp.deadInEvent && room.id !== "bp_cellar") return;
        if (player && player.spectatePlayerId && rp.playerId === player.spectatePlayerId) return;
        roomActors.push({
          y: rp.y,
          draw: () => {
            const rCfg = Object.assign({}, rp.character, {
              facing: rp.facing,
              walking: rp.moving,
              lantern: rp.lanternOn
            });
            if (rp.facingCorner && App.Character.drawBackCornerInWorld) {
              App.Character.drawBackCornerInWorld(ctx, rp.x, rp.y, rCfg, timeSec);
            } else {
              App.Character.drawInWorld(ctx, rp.x, rp.y, rCfg, timeSec, {
                seated: false,
                sprinting: rp.sprinting,
                crouching: rp.crouching
              });
            }
          }
        });
      });
    }
    roomActors.sort((a, b) => a.y - b.y);
    roomActors.forEach((a) => a.draw());

    const roomKey = `${room.x},${room.y}`;
    const globalBlackout = App.Events && App.Events.isGlobalLightsOut && App.Events.isGlobalLightsOut(matchState);
    const roomShattered = App.Endgame && App.Endgame.isRoomShattered && App.Endgame.isRoomShattered(roomKey, matchState);
    // The Cellar has no light switch/bulb (always ambient stair glow + lantern); other rooms start lit unless switched off/blackout/shattered
    const roomLightsOn = !data.isCellar && !globalBlackout && !roomShattered && !(matchState && matchState.roomLightStates && matchState.roomLightStates[roomKey] === false);

    // Live-draw the wall light switch toggle lever right on the room wall (ON = up, OFF = down)
    const swItem = (data.interactables || []).find((it) => it.type === "light_switch");
    if (swItem && typeof swItem.swX === "number") {
      drawWallLightSwitch(ctx, swItem.swX, swItem.swY, roomLightsOn);
    }

    // 3. Lighting Pass:
    //    - When Light Switch is ON : Exact Main Parlor-level bright warm ceiling illumination!
    //    - When Light Switch is OFF: Deep cabin darkness lit only by player lantern, embers & clues!
    if (roomLightsOn && lightLevel > 0.01) {
      const darkness = Math.max(0, Math.min(1, 1 - lightLevel));
      const ambientDark = 0.44 + darkness * 0.56;
      const radius = 52 + lightLevel * 100;
      const cx = 104;
      const cy = 114;

      const grad = ctx.createRadialGradient(cx, cy - 8, 10, cx, cy, radius);
      grad.addColorStop(0, `rgba(255, 224, 154, ${(0.20 * lightLevel).toFixed(3)})`);
      grad.addColorStop(0.54, `rgba(14, 12, 18, ${(0.08 + darkness * 0.90).toFixed(3)})`);
      grad.addColorStop(1, `rgba(4, 4, 8, ${Math.min(0.96, ambientDark + 0.34).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);

      (data.lights || []).forEach((lt) => {
        if (!lt.halo) return;
        const f = lt.flicker ? 0.88 + Math.sin(timeSec * 10.5) * 0.12 : 1.0;
        const rad = lt.r * 0.72;
        const tg = ctx.createRadialGradient(lt.x, lt.y, 2, lt.x, lt.y, rad);
        tg.addColorStop(0, `rgba(${lt.color}, ${(lt.halo * 0.78 * f * lightLevel).toFixed(3)})`);
        tg.addColorStop(1, `rgba(${lt.color}, 0)`);
        ctx.fillStyle = tg;
        ctx.fillRect(lt.x - rad - 2, lt.y - rad - 2, rad * 2 + 4, rad * 2 + 4);
      });
    } else {
      const baseDark = data.isCellar ? 0.72 : 0.84;
      const effDark = Math.min(0.96, baseDark + (1 - lightLevel) * 0.12);

      mctx.globalCompositeOperation = "source-over";
      mctx.clearRect(0, 0, ROOM_W, ROOM_H);
      mctx.fillStyle = `rgba(3, 3, 6, ${effDark.toFixed(3)})`;
      mctx.fillRect(0, 0, ROOM_W, ROOM_H);

      mctx.globalCompositeOperation = "destination-out";

      const alwaysOnLights = (data.lights || []).filter((l) => l.flicker || l.alwaysOn);
      alwaysOnLights.forEach((lt) => {
        const f = lt.flicker ? 0.92 + Math.sin(timeSec * 10.5) * 0.08 : 1.0;
        const rad = lt.r * f * lightLevel;
        if (rad <= 1) return;
        const g = mctx.createRadialGradient(lt.x, lt.y, 4, lt.x, lt.y, rad);
        g.addColorStop(0, `rgba(0,0,0,${(lt.strength || 0.72).toFixed(2)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = g;
        mctx.fillRect(lt.x - rad - 2, lt.y - rad - 2, rad * 2 + 4, rad * 2 + 4);
      });

      if (player && player.lanternOn) {
        const lx = player.x + player.facing * 7;
        const ly = player.y - 8;
        const flick = 1.0 + Math.sin(timeSec * 9.5) * 0.04;
        const rad = (data.isCellar ? 64 : 58) * flick;
        const lg = mctx.createRadialGradient(lx, ly, 6, lx, ly, rad);
        lg.addColorStop(0, "rgba(0,0,0,0.96)");
        lg.addColorStop(0.55, "rgba(0,0,0,0.68)");
        lg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = lg;
        mctx.fillRect(lx - rad - 2, ly - rad - 2, rad * 2 + 4, rad * 2 + 4);
      } else if (player) {
        const dg = mctx.createRadialGradient(player.x, player.y - 8, 2, player.x, player.y - 8, 22);
        dg.addColorStop(0, "rgba(0,0,0,0.40)");
        dg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = dg;
        mctx.fillRect(player.x - 24, player.y - 32, 48, 48);
      }

      if (swItem && typeof swItem.swX === "number") {
        const sg = mctx.createRadialGradient(swItem.swX + 2, swItem.swY + 3, 1, swItem.swX + 2, swItem.swY + 3, 16);
        sg.addColorStop(0, "rgba(0,0,0,0.72)");
        sg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = sg;
        mctx.fillRect(swItem.swX - 15, swItem.swY - 14, 34, 34);
      }

      if (App.Clues && App.Clues.getClueLightPoints) {
        const clueLights = App.Clues.getClueLightPoints(room, matchState);
        clueLights.forEach((cl) => {
          const cr = cl.r * Math.max(0.75, lightLevel);
          const cg = mctx.createRadialGradient(cl.x, cl.y, 4, cl.x, cl.y, cr);
          cg.addColorStop(0, `rgba(0,0,0,${(cl.strength || 0.84).toFixed(2)})`);
          cg.addColorStop(1, "rgba(0,0,0,0)");
          mctx.fillStyle = cg;
          mctx.fillRect(cl.x - cr - 2, cl.y - cr - 2, cr * 2 + 4, cr * 2 + 4);
        });
      }

      ctx.drawImage(lightMask, 0, 0);

      if (swItem && typeof swItem.swX === "number") {
        px(ctx, swItem.swX + 2, swItem.swY + 5, 1, 1, "#ffdb8c");
      }

      alwaysOnLights.forEach((lt) => {
        if (!lt.halo) return;
        const f = lt.flicker ? 0.88 + Math.sin(timeSec * 10.5) * 0.12 : 1.0;
        const rad = lt.r * 0.68;
        const tg = ctx.createRadialGradient(lt.x, lt.y, 2, lt.x, lt.y, rad);
        tg.addColorStop(0, `rgba(${lt.color}, ${(lt.halo * f * lightLevel).toFixed(3)})`);
        tg.addColorStop(1, `rgba(${lt.color}, 0)`);
        ctx.fillStyle = tg;
        ctx.fillRect(lt.x - rad - 2, lt.y - rad - 2, rad * 2 + 4, rad * 2 + 4);
      });
    }

    if (App.Clues && App.Clues.renderRoomClueHighlights && lightLevel > 0.15) {
      App.Clues.renderRoomClueHighlights(ctx, room, timeSec, matchState);
    }
    if (App.Events && App.Events.renderRoomEventHighlights) {
      App.Events.renderRoomEventHighlights(ctx, room, timeSec, matchState);
    }
    if (App.Stalkers && App.Stalkers.renderRoomHighlights) {
      App.Stalkers.renderRoomHighlights(ctx, roomKey, timeSec, matchState, player);
    }
    if (App.Musical && App.Musical.renderRoomOverlays) {
      App.Musical.renderRoomOverlays(ctx, roomKey, timeSec, matchState, player);
    }
    if (App.StayLit && App.StayLit.renderRoomHighlights) {
      App.StayLit.renderRoomHighlights(ctx, roomKey, timeSec, matchState);
    }
    if (App.Knight && App.Knight.renderRoomHighlights) {
      App.Knight.renderRoomHighlights(ctx, roomKey, timeSec, matchState);
    }
    if (App.Endgame && App.Endgame.renderGlassShardsOverlay) {
      App.Endgame.renderGlassShardsOverlay(ctx, matchState);
    }

    if (player && player.lanternOn) {
      const lx = player.x + player.facing * 7;
      const ly = player.y - 8;
      const flick = 0.22 + Math.sin(timeSec * 9.5) * 0.03;
      const wg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
      wg.addColorStop(0, `rgba(255, 212, 125, ${flick.toFixed(3)})`);
      wg.addColorStop(1, "rgba(255, 180, 80, 0)");
      ctx.fillStyle = wg;
      ctx.fillRect(lx - 48, ly - 48, 96, 96);
    }
  }

  function clearCache() {
    roomCache.clear();
  }

  App.CabinRooms = {
    ROOM_W,
    ROOM_H,
    computeRoomGeometry,
    getConnectedDoors,
    getRoomData,
    renderRoom,
    clearCache
  };
})(window.Duskwood);
