/* ==========================================================================
   DUSKWOOD INN - Compact Square Stardew Valley Parlor (208x208)
   - Strictly SQUARE room (13x13 tiles @ 16px = 208x208)
   - Authentic Stardew Valley Top-Down 3/4 interior perspective
   - Central ROUND Draftsman's Table + Lowered Overhead Hanging Bulb
   - Animated Antique Grandfather Clock on North Wall (synced hands + swinging pendulum)
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const TILE = 16;
  const COLS = 13;
  const ROWS = 13;
  const ROOM_W = COLS * TILE;
  const ROOM_H = ROWS * TILE;

  const FLOOR_BOUNDS = {
    minX: 20,
    maxX: ROOM_W - 20,
    minY: 56,
    maxY: ROOM_H - 18
  };

  // Central ROUND Draftsman's Table
  const TABLE = {
    cx: ROOM_W / 2, // 104
    cy: 126,
    rx: 30,
    ry: 24,
    colRx: 32,
    colRy: 24
  };

  // Antique Grandfather Clock anchor on the North Wall (sound emitter source!)
  const CLOCK = {
    x: 126,
    y: 54,
    left: 118,
    top: 13,
    w: 16,
    h: 45
  };

  const CHAIRS = [
    { id: 0, dir: "W", x: 64,  y: 126, facing: 1,  seatX: 68,  seatY: 128, label: "SEAT 1" },
    { id: 1, dir: "E", x: 144, y: 126, facing: -1, seatX: 140, seatY: 128, label: "SEAT 2" },
    { id: 2, dir: "N", x: 104, y: 92,  facing: 1,  seatX: 104, seatY: 94,  label: "SEAT 3" },
    { id: 3, dir: "S", x: 104, y: 158, facing: 1,  seatX: 104, seatY: 157, label: "SEAT 4" }
  ];

  // Solid prop hitboxes
  const COLLIDERS = [
    { shape: "ellipse", cx: TABLE.cx, cy: TABLE.cy + 2, rx: TABLE.colRx, ry: TABLE.colRy },
    { x: 18,  y: 50, w: 30, h: 12 }, // Fireplace hearth
    { x: 118, y: 50, w: 16, h: 11 }, // Grandfather Clock base
    { x: 152, y: 48, w: 24, h: 15 }, // Small Upright Parlor Piano + Stool (leaves NE corner open!)
    { x: 15,  y: 74, w: 14, h: 28 }, // West Wall Side Bookshelf (clear of fireplace & West door!)
    { x: 18,  y: 146, w: 16, h: 18 }, // Side Barrel (leaves SW corner open!)
    { x: 174, y: 146, w: 16, h: 18 }  // Side Plant Stand (leaves SE corner open!)
  ];

  // Keep ONLY clue-relevant inspectables in The Dining Room (Portrait for Corrupt Painting)!
  // (Chairs & Open Connected Doors are handled directly by GameWorld.)
  const INTERACTABLES = [
    {
      id: "dining_portrait",
      x: 82, y: 58, r: 24,
      prompt: "[E] INSPECT PAINTING",
      paintingId: "dining_founder",
      roomId: "dining_room",
      text: "A dark oil portrait of the inn's draftsman."
    },
    {
      id: "dining_light_switch",
      x: 50, y: 58, r: 22,
      type: "light_switch",
      swX: 48, swY: 36,
      prompt: "[E] TURN LIGHT OFF"
    }
  ];

  // Offscreen darkness mask when Dining Room light switch is OFF
  const parlorMask = document.createElement("canvas");
  parlorMask.width = ROOM_W;
  parlorMask.height = ROOM_H;
  const pmctx = parlorMask.getContext("2d");

  function drawDiningLightSwitch(c, x, y, isOn) {
    px(c, x, y, 5, 7, "#242220");
    px(c, x + 1, y + 1, 3, 5, "#d4ccb8");
    px(c, x + 2, isOn ? y + 2 : y + 4, 1, 2, isOn ? "#5c4a32" : "#24201c");
  }

  let staticFloorCanvas = null;

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

  function buildStaticRoom() {
    staticFloorCanvas = document.createElement("canvas");
    staticFloorCanvas.width = ROOM_W;
    staticFloorCanvas.height = ROOM_H;
    const c = staticFloorCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    // 1. Exterior dark border
    px(c, 0, 0, ROOM_W, ROOM_H, "#08070b");

    // 2. Stardew Warm Honey-Oak Floorboards
    const plankColors = ["#8f5e39", "#865633", "#96653e", "#7d4f2e"];
    for (let y = 52; y < ROOM_H - 12; y += 8) {
      const rowIdx = Math.floor((y - 52) / 8);
      for (let x = 14; x < ROOM_W - 14; x += 22) {
        const shift = (rowIdx % 2) * 11;
        const pxX = Math.max(14, x - shift);
        const w = Math.min(22, ROOM_W - 14 - pxX);
        const col = plankColors[(rowIdx * 3 + Math.floor(x / 22)) % plankColors.length];
        px(c, pxX, y, w, 7, col);
        px(c, pxX, y + 7, w, 1, "#5c3920");
        px(c, pxX, y, 1, 7, "#633d22");
        px(c, pxX + 4, y + 2, Math.max(2, w - 9), 1, "#a37148");
      }
    }

    // 3. Stardew 3/4 North Wall (y = 10..52)
    px(c, 10, 8, ROOM_W - 20, 6, "#2c1c14");
    px(c, 12, 10, ROOM_W - 24, 3, "#4a3022");

    px(c, 14, 14, ROOM_W - 28, 22, "#57483d");
    for (let x = 14; x < ROOM_W - 14; x += 8) {
      px(c, x, 14, 1, 22, "#453830");
      px(c, x + 2, 16, 4, 18, "#615145");
    }

    px(c, 14, 36, ROOM_W - 28, 3, "#784d2e");
    px(c, 14, 37, ROOM_W - 28, 1, "#9c6a43");
    px(c, 14, 39, ROOM_W - 28, 12, "#593822");
    for (let x = 18; x < ROOM_W - 18; x += 12) {
      px(c, x, 41, 8, 8, "#6b452b");
      px(c, x + 1, 42, 6, 6, "#4d301d");
    }
    px(c, 14, 51, ROOM_W - 28, 3, "#362115");
    px(c, 14, 54, ROOM_W - 28, 4, "rgba(0, 0, 0, 0.28)");

    // Side & South Cutaway Walls
    px(c, 8, 10, 6, ROOM_H - 20, "#2c1c14");
    px(c, 10, 12, 3, ROOM_H - 24, "#4f3423");
    px(c, ROOM_W - 14, 10, 6, ROOM_H - 20, "#2c1c14");
    px(c, ROOM_W - 13, 12, 3, ROOM_H - 24, "#4f3423");
    px(c, 8, ROOM_H - 12, ROOM_W - 16, 6, "#2c1c14");
    px(c, 10, ROOM_H - 10, ROOM_W - 20, 3, "#4f3423");

    // 4. Four Doors
    px(c, 92, 22, 24, 31, "#332014");
    px(c, 95, 25, 18, 28, "#4d311e");
    px(c, 97, 27, 6, 9, "#3b2516");
    px(c, 105, 27, 6, 9, "#3b2516");
    px(c, 97, 39, 14, 10, "#3b2516");
    px(c, 110, 38, 2, 2, "#d4b05c");
    px(c, 94, 54, 20, 5, "#4a3228");

    px(c, 10, 114, 5, 24, "#332014");
    px(c, 11, 116, 3, 20, "#5c3b24");
    px(c, 15, 118, 4, 16, "#4a3228");

    px(c, ROOM_W - 15, 114, 5, 24, "#332014");
    px(c, ROOM_W - 14, 116, 3, 20, "#5c3b24");
    px(c, ROOM_W - 19, 118, 4, 16, "#4a3228");

    px(c, 92, ROOM_H - 13, 24, 7, "#3b2517");
    px(c, 95, ROOM_H - 11, 18, 3, "#6b472d");
    px(c, 94, ROOM_H - 19, 20, 6, "#5e2b2b");
    px(c, 96, ROOM_H - 18, 16, 4, "#7d3b3b");

    // 5. Two Compact Night Forest Windows (leaves clean bare NE corner for Cutting Corners!)
    [54, 134].forEach((wx) => {
      px(c, wx, 18, 18, 18, "#332014");
      px(c, wx + 2, 20, 14, 14, "#16202e");
      px(c, wx + 3, 27, 5, 7, "#0e151d");
      px(c, wx + 10, 25, 5, 9, "#0c1218");
      px(c, wx + 12, 22, 2, 2, "#dce6f5");
      px(c, wx + 8, 20, 2, 14, "#4f3220");
      px(c, wx + 2, 26, 14, 2, "#4f3220");
      px(c, wx - 1, 36, 20, 2, "#6b452b");
    });

    // 6. Top-Left Brick Fireplace
    px(c, 18, 14, 28, 41, "#4c3b36");
    px(c, 20, 16, 24, 37, "#6b5046");
    for (let by = 16; by < 48; by += 5) {
      px(c, 20, by, 24, 1, "#45332d");
    }
    px(c, 17, 34, 30, 3, "#402617");
    px(c, 18, 35, 28, 1, "#7d5133");
    px(c, 24, 41, 16, 13, "#171211");
    px(c, 26, 49, 12, 3, "#472c1b");
    px(c, 18, 54, 28, 5, "#594842");

    // 6b. Framed Founder Oil Portrait on North Wall (inspectable with [E]!)
    px(c, 74, 18, 16, 17, "#24140b");
    px(c, 75, 19, 14, 15, "#a68544");
    px(c, 76, 20, 12, 13, "#1d1a18");
    px(c, 77, 21, 10, 8, "#3b3027");
    px(c, 81, 22, 3, 3, "#cbb496");
    px(c, 79, 25, 7, 7, "#161417");

    // 7. Small Upright Parlor Piano & Cushioned Stool (North-Right, leaves NE corner open!)
    const pnX = 152;
    const pnY = 24;
    // Contact shadow on floorboards
    c.fillStyle = "rgba(0, 0, 0, 0.36)";
    c.fillRect(pnX - 1, pnY + 32, 26, 6);
    // Upper dark mahogany upright piano cabinet + polished lid edge
    px(c, pnX,     pnY,     24, 32, "#1c0f09");
    px(c, pnX + 1, pnY + 1, 22, 3,  "#5e3722"); // Top lid highlight
    px(c, pnX + 2, pnY + 4, 20, 12, "#3d2215"); // Upper front wood panel
    px(c, pnX + 3, pnY + 5, 18, 10, "#4f2d1c");
    // Tiny brass candleholders on top lid + open white sheet music on music desk!
    px(c, pnX + 3,  pnY - 2, 2, 3, "#c9a44c");
    px(c, pnX + 19, pnY - 2, 2, 3, "#c9a44c");
    px(c, pnX + 8,  pnY + 6, 8, 6, "#efe6cf"); // Open sheet music pages
    px(c, pnX + 11, pnY + 6, 1, 6, "#9e8e74"); // Center fold
    px(c, pnX + 9,  pnY + 8, 2, 1, "#2b211a"); // Music staff notes
    px(c, pnX + 13, pnY + 8, 2, 1, "#2b211a");
    px(c, pnX + 9,  pnY + 10, 2, 1, "#2b211a");
    // Iconic horizontal White Ivory & Black Ebony Piano Keyboard!
    px(c, pnX,     pnY + 15, 24, 7, "#24130b"); // Cheek blocks & keybed frame
    px(c, pnX + 2, pnY + 16, 20, 5, "#f5f0e2"); // White ivory keys
    for (let kx = pnX + 4; kx < pnX + 21; kx += 2) {
      px(c, kx, pnY + 19, 1, 2, "#cfc6b4");     // Subtle white-key dividers
    }
    // Authentic black-key groupings (2-3-2 pattern!)
    [3, 5, 9, 11, 13, 17, 19].forEach((off) => {
      px(c, pnX + off, pnY + 16, 1, 3, "#141110");
    });
    // Lower kneeboard, legs & gleaming brass foot pedals
    px(c, pnX + 2, pnY + 22, 20, 9, "#361e12");
    px(c, pnX + 4, pnY + 23, 16, 7, "#472819");
    px(c, pnX + 9, pnY + 29, 2, 2, "#d9b45a");  // Left brass pedal
    px(c, pnX + 13, pnY + 29, 2, 2, "#d9b45a"); // Right brass pedal
    // Small cushioned wooden Piano Stool tucked neatly in front of the keyboard!
    px(c, pnX + 6, pnY + 33, 12, 6, "#1f120b");
    px(c, pnX + 7, pnY + 34, 10, 3, "#7a2c35"); // Crimson velvet cushion
    px(c, pnX + 8, pnY + 34, 8,  1, "#9c3e49");
    px(c, pnX + 7, pnY + 37, 2,  3, "#4d2e1b"); // Stool legs
    px(c, pnX + 15, pnY + 37, 2, 3, "#4d2e1b");

    // 7b. Cozy Side Bookshelf relocated neatly against West Wall (x=15..29, y=72..102)
    px(c, 15, 72, 14, 30, "#26160e");
    px(c, 16, 73, 12, 28, "#543520");
    px(c, 17, 74, 10, 3,  "#754c2e"); // Top shelf cap
    const bookColors = ["#8f333b", "#395c82", "#3f704d", "#a8833c", "#684478"];
    [79, 86, 93].forEach((sy, sIdx) => {
      px(c, 17, sy, 10, 5, "#1f120b");
      for (let b = 0; b < 3; b++) {
        px(c, 18 + b * 3, sy + 1, 2, 4, bookColors[(b + sIdx) % bookColors.length]);
      }
      px(c, 16, sy + 5, 12, 2, "#6e462a");
    });

    // 8. Round Woven Crimson & Gold Rug centered under Round Table
    fillPixelEllipse(c, TABLE.cx, TABLE.cy + 2, 52, 42, "#542228");
    fillPixelEllipse(c, TABLE.cx, TABLE.cy + 2, 48, 38, "#783139");
    fillPixelEllipse(c, TABLE.cx, TABLE.cy + 2, 44, 34, "#b58d4a");
    fillPixelEllipse(c, TABLE.cx, TABLE.cy + 2, 41, 31, "#632830");
    fillPixelEllipse(c, TABLE.cx, TABLE.cy + 2, 36, 27, "#7d343d");

    // 9. Side Wooden Barrel & Potted Plant (leaving SW & SE two-wall corners clean!)
    px(c, 20, 146, 14, 17, "#3b2416");
    px(c, 21, 147, 12, 15, "#754c2e");
    px(c, 21, 151, 12, 2, "#454a52");
    px(c, 21, 158, 12, 2, "#454a52");

    px(c, 174, 148, 14, 15, "#382214");
    px(c, 175, 149, 12, 9, "#70482b");
    px(c, 177, 144, 8, 5, "#426e45");
    px(c, 179, 142, 4, 3, "#5b9459");
  }

  // Animated Stardew-Style Antique Grandfather Clock on North Wall
  function drawGrandfatherClock(c, timeSec, matchState) {
    const x = CLOCK.left; // 118
    const y = CLOCK.top;  // 13
    const cx = CLOCK.x;   // 126

    // Floor contact shadow
    c.fillStyle = "rgba(0, 0, 0, 0.36)";
    c.fillRect(x - 1, y + 44, 18, 4);

    // Ornate Stepped Crown & Brass Finial
    px(c, cx - 1, y - 2, 2, 2, "#d9b45a"); // Brass spire
    px(c, x + 2, y, 12, 2, "#2b180e");
    px(c, x + 3, y + 1, 10, 1, "#6b4129");
    px(c, x, y + 2, 16, 3, "#2b180e");
    px(c, x + 1, y + 3, 14, 1, "#825234");

    // Upper Clock Hood & Carved Trunk
    px(c, x + 1, y + 5, 14, 14, "#2b180e");
    px(c, x + 2, y + 6, 12, 12, "#593520");
    px(c, x + 2, y + 19, 12, 21, "#2b180e");
    px(c, x + 3, y + 20, 10, 19, "#663d25");
    px(c, x + 3, y + 20, 1, 19, "#825234"); // Wood highlight trim

    // Plinth Base
    px(c, x, y + 40, 16, 6, "#2b180e");
    px(c, x + 1, y + 41, 14, 4, "#54321e");
    px(c, x + 2, y + 41, 12, 1, "#7d4e31");

    // Brass-Rimmed Ivory Clock Face (centered at cx = 126, cy = 25)
    const dialX = cx;
    const dialY = y + 12;
    fillPixelEllipse(c, dialX, dialY, 5, 5, "#c9a44c");
    fillPixelEllipse(c, dialX, dialY, 4, 4, "#efe4c8");
    // 12 / 3 / 6 / 9 markers
    px(c, dialX, dialY - 3, 1, 1, "#33261b");
    px(c, dialX + 3, dialY, 1, 1, "#33261b");
    px(c, dialX, dialY + 3, 1, 1, "#33261b");
    px(c, dialX - 3, dialY, 1, 1, "#33261b");

    // Live Hands synced to Match Time (12:00 PM + matchState.clockMinutes)
    const mins = matchState ? matchState.clockMinutes : 0;
    const totalHours = 12 + mins / 60;
    const hourAng = -Math.PI / 2 + ((totalHours % 12) / 12) * Math.PI * 2;
    const minAng = -Math.PI / 2 + ((mins % 60) / 60) * Math.PI * 2;

    drawPixelLine(c, dialX, dialY, dialX + Math.cos(hourAng) * 2.4, dialY + Math.sin(hourAng) * 2.4, "#1c1512");
    drawPixelLine(c, dialX, dialY, dialX + Math.cos(minAng) * 3.5, dialY + Math.sin(minAng) * 3.5, "#3b2318");
    px(c, dialX, dialY, 1, 1, "#b83232"); // Center pin

    // Glass Pendulum Window + Swinging Brass Pendulum (1 beat / sec)
    px(c, x + 5, y + 21, 6, 16, "#14100e");
    px(c, x + 6, y + 22, 4, 14, "#1d1a19");
    // Glass glint
    px(c, x + 6, y + 23, 1, 4, "rgba(215, 228, 248, 0.22)");

    const swing = Math.sin(timeSec * Math.PI) * 1.9;
    const bobX = Math.round(cx - 0.5 + swing);
    const bobY = y + 33;
    drawPixelLine(c, cx - 0.5, y + 22, bobX, bobY, "#b59142");
    px(c, bobX - 1, bobY - 1, 3, 3, "#e8c468");
    px(c, bobX, bobY, 1, 1, "#fff6c7");
  }

  function drawChair(c, chair) {
    const x = chair.x;
    const y = chair.y;
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.fillRect(x - 6, y + 3, 12, 4);

    if (chair.dir === "W") {
      px(c, x - 6, y - 11, 4, 17, "#362013");
      px(c, x - 5, y - 10, 2, 15, "#784c2e");
      px(c, x - 3, y - 4, 10, 9, "#362013");
      px(c, x - 2, y - 3, 8, 7, "#915f3b");
      px(c, x - 1, y - 2, 6, 5, "#6b2e35");
      px(c, x + 4, y + 4, 2, 3, "#362013");
    } else if (chair.dir === "E") {
      px(c, x + 2, y - 11, 4, 17, "#362013");
      px(c, x + 3, y - 10, 2, 15, "#784c2e");
      px(c, x - 7, y - 4, 10, 9, "#362013");
      px(c, x - 6, y - 3, 8, 7, "#915f3b");
      px(c, x - 5, y - 2, 6, 5, "#6b2e35");
      px(c, x - 6, y + 4, 2, 3, "#362013");
    } else if (chair.dir === "N") {
      px(c, x - 6, y - 11, 12, 9, "#362013");
      px(c, x - 5, y - 10, 10, 7, "#784c2e");
      px(c, x - 5, y - 3, 10, 7, "#915f3b");
      px(c, x - 4, y - 2, 8, 5, "#6b2e35");
    } else {
      px(c, x - 6, y - 6, 12, 11, "#362013");
      px(c, x - 5, y - 5, 10, 7, "#875635");
      px(c, x - 4, y - 3, 8, 4, "#6b4227");
      px(c, x - 5, y + 4, 2, 3, "#362013");
      px(c, x + 3, y + 4, 2, 3, "#362013");
    }
  }

  function drawRoundTable(c, timeSec, matchState) {
    const cx = TABLE.cx;
    const cy = TABLE.cy;
    const rx = TABLE.rx; // 30
    const ry = TABLE.ry; // 24

    // 1. Floor contact shadow & central oak pedestal leg
    fillPixelEllipse(c, cx, cy + 10, 28, 20, "rgba(0, 0, 0, 0.42)");
    px(c, cx - 6, cy + 14, 12, 12, "#2b190f");
    px(c, cx - 4, cy + 15, 8, 10, "#422717");

    // 2. Thick oak skirt & outer beveled rim
    fillPixelEllipse(c, cx, cy + 5, rx, ry, "#24140b");
    fillPixelEllipse(c, cx, cy + 3, rx - 1, ry - 1, "#452917");
    fillPixelEllipse(c, cx, cy, rx, ry, "#2b180e");
    fillPixelEllipse(c, cx, cy, rx - 2, ry - 2, "#634129");

    // 3. Bare weathered oak wood plank tabletop (matches First-Person Wooden Table — NO green felt!)
    c.save();
    c.beginPath();
    c.ellipse(cx, cy, rx - 3, ry - 2, 0, 0, Math.PI * 2);
    c.clip();

    const plankCols = ["#6e4b30", "#634229", "#755134", "#5c3d26"];
    for (let x = cx - rx; x <= cx + rx; x += 5) {
      const idx = Math.abs(Math.floor(x / 5));
      px(c, x, cy - ry, 5, ry * 2 + 2, plankCols[idx % plankCols.length]);
      px(c, x, cy - ry, 1, ry * 2 + 2, "#3f2718");
    }

    // 4. Recessed carved circular clock groove (middle ring)
    const gOuterRx = rx - 8;  // 22
    const gOuterRy = ry - 6;  // 18
    const gInnerRx = rx - 12; // 18
    const gInnerRy = ry - 9;  // 15
    const gMidRx = (gOuterRx + gInnerRx) / 2; // 20
    const gMidRy = (gOuterRy + gInnerRy) / 2; // 16.5

    c.beginPath();
    c.ellipse(cx, cy, gOuterRx, gOuterRy, 0, 0, Math.PI * 2);
    c.ellipse(cx, cy, gInnerRx, gInnerRy, 0, 0, Math.PI * 2, true);
    c.fillStyle = "rgba(28, 16, 9, 0.45)";
    c.fill("evenodd");

    c.strokeStyle = "#2b180d";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(cx, cy, gOuterRx, gOuterRy, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(cx, cy, gInnerRx, gInnerRy, 0, 0, Math.PI * 2);
    c.stroke();

    // 12 warm ivory carved hour notches (XII at 6 o'clock, advancing clockwise)
    for (let i = 0; i < 12; i++) {
      const ang = Math.PI / 2 + (i * Math.PI * 2) / 12;
      const mx = Math.round(cx + Math.cos(ang) * gMidRx);
      const my = Math.round(cy + Math.sin(ang) * gMidRy);
      px(c, mx, my, 1, 1, i === 0 ? "#fae6b4" : "#d4ba88");
    }

    // 5. Curved outer-rim parchment played cards (synced to matchState.rimAngleOffset!)
    const rimOff = (matchState && matchState.rimAngleOffset) || 0;
    const rimCards = (matchState && matchState.rimPlayedCards) || [];
    const cardRx = rx - 5; // 25
    const cardRy = ry - 4; // 20
    const startAng = Math.PI * 0.37 + rimOff;
    const stepAng = 0.24;
    rimCards.slice(0, 14).forEach((card, idx) => {
      const ang = startAng - idx * stepAng;
      const kx = Math.round(cx + Math.cos(ang) * cardRx);
      const ky = Math.round(cy + Math.sin(ang) * cardRy);
      px(c, kx - 2, ky - 2, 4, 4, "#24170e");
      px(c, kx - 1, ky - 1, 2, 2, card.type === "HEX" ? "#e8bfb4" : "#f2e6c9");
    });

    // 6. Center bare wood: miniature cream parchment Room Cards (with walls & doorways!)
    const roomMap = matchState && matchState.roomMap
      ? matchState.roomMap
      : { "0,0": { id: "dining_room", x: 0, y: 0, isParlor: true } };
    Object.values(roomMap).forEach((room) => {
      const tx = cx - 2 + room.x * 4;
      const ty = cy - 2 + room.y * 4;
      if (Math.abs(tx - cx) > 13 || Math.abs(ty - cy) > 10) return;
      const border = room.id === "bp_cellar" ? "#6b2220" : "#2b1c12";
      const fill = room.isParlor ? "#fff3d4" : room.id === "bp_cellar" ? "#e8cbc0" : "#f0e3c2";
      px(c, tx, ty, 4, 4, border);
      px(c, tx + 1, ty + 1, 2, 2, fill);
      // Tiny open-door notch hints on edges
      if (room.doors) {
        if (room.doors.N) px(c, tx + 1, ty, 2, 1, fill);
        if (room.doors.S) px(c, tx + 1, ty + 3, 2, 1, fill);
        if (room.doors.W) px(c, tx, ty + 1, 1, 2, fill);
        if (room.doors.E) px(c, tx + 3, ty + 1, 1, 2, fill);
      }
    });

    if (App.Knight && App.Knight.renderTableOrbsOnParlorTable) {
      App.Knight.renderTableOrbsOnParlorTable(c, cx, cy, timeSec, matchState);
    }

    c.restore();

    // 7. Rotating Wooden Card Pedestal (rides on outer rim at 6 o'clock + rimAngleOffset!)
    const pedAng = Math.PI / 2 + rimOff;
    const pedX = Math.round(cx + Math.cos(pedAng) * (rx - 5)) - 4;
    const pedY = Math.round(cy + Math.sin(pedAng) * (ry - 4)) - 3;
    px(c, pedX - 1, pedY - 1, 10, 8, "#1c1009");
    px(c, pedX, pedY, 8, 5, "#4a2f1d");
    // Top graveyard slot (shows parchment card if an Omen is active!)
    if (matchState && matchState.activeOmen) {
      px(c, pedX + 1, pedY + 1, 6, 3, "#f4e8cb");
      px(c, pedX + 3, pedY + 2, 2, 1, "#1f7a5a");
    } else {
      px(c, pedX + 1, pedY + 1, 6, 3, "#2b1a10");
    }
    // Protruding parchment Draw Slot lip at bottom front of pedestal
    px(c, pedX + 1, pedY + 6, 6, 2, "#ebdcc0");
    px(c, pedX + 2, pedY + 6, 4, 1, "#fff6de");

    // 8. Upright Physical Pawns inside the carved clock groove (exact 720-min sync)
    if (!matchState || matchState.tableIntroDone) {
      const pFrac = matchState ? ((matchState.clockMinutes || 0) % 720) / 720 : 0;
      const lAng = Math.PI / 2 + pFrac * Math.PI * 2;
      const lx = Math.round(cx + Math.cos(lAng) * gMidRx);
      const ly = Math.round(cy + Math.sin(lAng) * gMidRy);
      px(c, lx - 1, ly - 4, 3, 5, "#241914");
      px(c, lx, ly - 3, 2, 3, "#f7eed6");
      px(c, lx + 1, ly - 2, 1, 1, "#ffe680");
    }

    if (matchState && matchState.harvesterSpawned) {
      const hFrac = ((matchState.harvesterMinutes || 0) % 720) / 720;
      const hAng = Math.PI / 2 + hFrac * Math.PI * 2;
      const hx = Math.round(cx + Math.cos(hAng) * gMidRx);
      const hy = Math.round(cy + Math.sin(hAng) * gMidRy);
      px(c, hx - 1, hy - 5, 3, 6, "#110d14");
      px(c, hx, hy - 4, 1, 1, "#ff4d4d");
    }
  }

  function drawFireplaceEmbers(c, timeSec) {
    const pulse = Math.sin(timeSec * 5.2) * 0.5 + 0.5;
    px(c, 28, 48, 8, 3, pulse > 0.45 ? "#c95328" : "#8f3218");
    px(c, 30, 47, 4, 2, pulse > 0.6 ? "#f7b552" : "#d97530");
  }

  function drawLightingAndLowBulb(c, timeSec, lightLevel, player, lanternOn) {
    if (lightLevel <= 0.01) {
      c.fillStyle = "#000000";
      c.fillRect(0, 0, ROOM_W, ROOM_H);
      return;
    }

    const swayX = Math.sin(timeSec * 1.15) * 0.8;
    const bulbX = TABLE.cx + swayX;
    const bulbY = 82;

    const darkness = Math.max(0, Math.min(1, 1 - lightLevel));
    const ambientDark = 0.46 + darkness * 0.54;
    const radius = 48 + lightLevel * 94;

    const grad = c.createRadialGradient(TABLE.cx, TABLE.cy - 12, 8, TABLE.cx, TABLE.cy - 6, radius);
    grad.addColorStop(0, `rgba(255, 222, 150, ${0.18 * lightLevel})`);
    grad.addColorStop(0.48, `rgba(14, 12, 18, ${0.10 + darkness * 0.90})`);
    grad.addColorStop(1, `rgba(4, 4, 8, ${Math.min(0.98, ambientDark + 0.36)})`);

    c.fillStyle = grad;
    c.fillRect(0, 0, ROOM_W, ROOM_H);

    if (lanternOn && player && !player.seated && lightLevel > 0.5) {
      const lx = player.x + player.facing * 8;
      const ly = player.y - 8;
      const flick = 0.22 + Math.sin(timeSec * 9.5) * 0.03;
      const lgrad = c.createRadialGradient(lx, ly, 2, lx, ly, 38);
      lgrad.addColorStop(0, `rgba(255, 216, 130, ${flick})`);
      lgrad.addColorStop(1, "rgba(255, 180, 80, 0)");
      c.fillStyle = lgrad;
      c.fillRect(lx - 40, ly - 40, 80, 80);
    }

    c.fillStyle = "#121116";
    c.fillRect(Math.round(bulbX), 0, 1, bulbY - 5);
    px(c, bulbX - 4, bulbY - 6, 9, 2, "#24272e");
    px(c, bulbX - 6, bulbY - 4, 13, 2, "#3a3f4a");
    px(c, bulbX - 2, bulbY - 2, 5, 2, "#595240");

    if (lightLevel > 0.1) {
      const bGrad = c.createRadialGradient(bulbX, bulbY + 2, 1, bulbX, bulbY + 2, 18 * lightLevel + 5);
      bGrad.addColorStop(0, `rgba(255, 250, 215, ${0.95 * lightLevel})`);
      bGrad.addColorStop(0.45, `rgba(255, 212, 120, ${0.44 * lightLevel})`);
      bGrad.addColorStop(1, "rgba(255, 190, 90, 0)");
      c.fillStyle = bGrad;
      c.fillRect(bulbX - 24, bulbY - 20, 48, 48);
    }
    px(c, bulbX - 1, bulbY, 3, 4, lightLevel > 0.35 ? "#fffbe0" : "#5e5a4d");
    px(c, bulbX, bulbY + 1, 1, 2, lightLevel > 0.6 ? "#ffffff" : "#787262");
  }

  function isDirConnected(matchState, dir) {
    const map = matchState && matchState.roomMap;
    if (!map) return false;
    const here = map["0,0"];
    if (!here || !here.doors || !here.doors[dir]) return false;
    const delta = { N: [0, -1, "S"], E: [1, 0, "W"], S: [0, 1, "N"], W: [-1, 0, "E"] }[dir];
    if (!delta) return false;
    const nb = map[`${delta[0]},${delta[1]}`];
    // The Cellar is strictly 1-way (enter only by dying, exit out into Dining Room)
    if (!nb || nb.id === "bp_cellar") return false;
    return Boolean(nb.doors && nb.doors[delta[2]]);
  }

  function drawOpenMatchedDoors(c, timeSec, matchState) {
    const pulse = 0.65 + Math.sin(timeSec * 3.2) * 0.2;

    // North Door open archway (x=92..116, y=22..54)
    if (isDirConnected(matchState, "N")) {
      px(c, 92, 22, 24, 31, "#2b190f");
      px(c, 95, 25, 18, 29, "#0b090c"); // Open dark passageway into matched room
      px(c, 95, 25, 2, 29, "#1c130e");  // Inner doorframe depth
      px(c, 111, 25, 2, 29, "#1c130e");
      // Subtle floor mat / transition threshold
      px(c, 95, 53, 18, 5, "#6b472d");
      c.fillStyle = `rgba(247, 208, 128, ${(0.22 * pulse).toFixed(2)})`;
      c.fillRect(96, 52, 16, 4);
    }

    // West Door open passage (x=10..16, y=114..138)
    if (isDirConnected(matchState, "W")) {
      px(c, 8, 113, 8, 26, "#2b190f");
      px(c, 8, 116, 7, 20, "#0b090c");
      px(c, 15, 117, 4, 18, "#6b472d");
      c.fillStyle = `rgba(247, 208, 128, ${(0.22 * pulse).toFixed(2)})`;
      c.fillRect(14, 118, 4, 16);
    }

    // East Door open passage (x=192..200, y=114..138)
    if (isDirConnected(matchState, "E")) {
      px(c, ROOM_W - 16, 113, 8, 26, "#2b190f");
      px(c, ROOM_W - 15, 116, 7, 20, "#0b090c");
      px(c, ROOM_W - 19, 117, 4, 18, "#6b472d");
      c.fillStyle = `rgba(247, 208, 128, ${(0.22 * pulse).toFixed(2)})`;
      c.fillRect(ROOM_W - 18, 118, 4, 16);
    }

    // South Door open passage (x=92..116, y=194..202)
    if (isDirConnected(matchState, "S")) {
      px(c, 92, ROOM_H - 14, 24, 9, "#2b190f");
      px(c, 95, ROOM_H - 13, 18, 8, "#0b090c");
      px(c, 95, ROOM_H - 17, 18, 4, "#6b472d");
      c.fillStyle = `rgba(247, 208, 128, ${(0.22 * pulse).toFixed(2)})`;
      c.fillRect(96, ROOM_H - 16, 16, 3);
    }

    // WIN DAWN MODE: Bright morning daylight through the two windows & wide-open sunlit South exit door!
    if (App.Endgame && App.Endgame.isDaylightWinMode && App.Endgame.isDaylightWinMode(matchState)) {
      // Bright morning sky & green sunlit pines inside both Dining Room windows!
      [54, 134].forEach((wx) => {
        px(c, wx + 2, 20, 14, 14, "#8fd0f5"); // Bright morning blue sky
        px(c, wx + 2, 28, 14, 6, "#fce09d");  // Golden sunrise horizon
        px(c, wx + 3, 27, 5, 7, "#3a6e3e");   // Sunlit pines
        px(c, wx + 10, 26, 5, 8, "#2d5932");
        px(c, wx + 8, 20, 2, 14, "#4f3220");  // Window mullions
        px(c, wx + 2, 26, 14, 2, "#4f3220");
      });

      // Wide-open sunlit South door leading to the Morning Forest & Getaway Car!
      px(c, 91, ROOM_H - 15, 26, 15, "#3b2515");
      px(c, 94, ROOM_H - 14, 20, 14, "#fce4a4"); // Warm golden sunlight outside!
      px(c, 84, ROOM_H - 27, 10, 14, "#30231a"); // Door swung open inward
      px(c, 85, ROOM_H - 26, 8, 12, "#8c613d");
      const sg = c.createRadialGradient(104, ROOM_H - 10, 3, 104, ROOM_H - 22, 46);
      sg.addColorStop(0, "rgba(255, 240, 180, 0.56)");
      sg.addColorStop(1, "rgba(255, 224, 145, 0)");
      c.fillStyle = sg;
      c.fillRect(58, ROOM_H - 64, 92, 64);
    }

    // THE NEIGHBOR ENCOUNTER: Entrance door swings wide open into the cold moonlit porch
    // with the hooded Grim Reaper silhouette standing right on the threshold! (image_7c2561.jpg)
    const nb = matchState && matchState.neighborEncounter;
    if (nb && nb.active && !nb.doorOpened) {
      // Someone is knocking on the CLOSED cabin door! Show subtle knock vibration + sound ripples!
      const dir = nb.doorDir || "S";
      const pt = dir === "S" ? { x: 104, y: ROOM_H - 11 }
        : dir === "N" ? { x: 104, y: 40 }
        : dir === "W" ? { x: 13, y: 126 }
        : { x: ROOM_W - 13, y: 126 };
      const pulse = (timeSec * 1.45) % 1;
      const rad = 5 + pulse * 18;
      c.save();
      c.strokeStyle = `rgba(247, 224, 165, ${(0.72 * (1 - pulse)).toFixed(2)})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    } else if (nb && nb.active && nb.doorOpened) {
      const dir = nb.doorDir || "S";
      const glowA = (0.34 + Math.sin(timeSec * 3.4) * 0.12).toFixed(2);
      if (dir === "S") {
        // Moonlit porch threshold & swung-open white/oak glass cabin door!
        px(c, 91, ROOM_H - 15, 26, 15, "#111824");
        px(c, 94, ROOM_H - 14, 20, 14, "#1b283b"); // Cool blue moonlight porch planks
        // Swung-open door panel angled inward-left
        px(c, 84, ROOM_H - 27, 10, 14, "#30231a");
        px(c, 85, ROOM_H - 26, 8, 12, "#d8d1c2");
        px(c, 86, ROOM_H - 25, 3, 4, "#1e2c40");
        px(c, 90, ROOM_H - 25, 2, 4, "#1e2c40");
        // Cool moonlight spill onto Dining Room floorboards
        const mg = c.createRadialGradient(104, ROOM_H - 12, 2, 104, ROOM_H - 18, 28);
        mg.addColorStop(0, `rgba(140, 188, 245, ${glowA})`);
        mg.addColorStop(1, "rgba(60, 100, 160, 0)");
        c.fillStyle = mg;
        c.fillRect(74, ROOM_H - 44, 60, 44);
        // Hooded Grim Reaper silhouette waiting right outside on the threshold!
        px(c, 100, ROOM_H - 16, 8, 12, "#291310");
        px(c, 101, ROOM_H - 19, 6, 4, "#3b1c17"); // Mahogany Hood
        px(c, 102, ROOM_H - 17, 4, 2, "#020203"); // Hollow dark cowl
        px(c, 101, ROOM_H - 11, 2, 2, "#9e867c"); // Clasped pale bony hands
        px(c, 105, ROOM_H - 11, 2, 2, "#9e867c");
      } else if (dir === "N") {
        px(c, 92, 22, 24, 32, "#141f2e");
        px(c, 95, 25, 18, 29, "#1c2b40");
        // Hooded Reaper standing in the open moonlit North doorway!
        px(c, 100, 31, 8, 21, "#07070a");
        px(c, 101, 28, 6, 5, "#15151c");
        px(c, 102, 30, 4, 2, "#020203");
        px(c, 102, 39, 4, 2, "#a88f84");
        const mg = c.createRadialGradient(104, 52, 2, 104, 56, 26);
        mg.addColorStop(0, `rgba(140, 188, 245, ${glowA})`);
        mg.addColorStop(1, "rgba(60, 100, 160, 0)");
        c.fillStyle = mg;
        c.fillRect(78, 30, 52, 52);
      } else if (dir === "W") {
        px(c, 8, 113, 9, 26, "#1b283b");
        px(c, 9, 118, 6, 16, "#07070a");
        px(c, 10, 116, 4, 4, "#15151c");
        const mg = c.createRadialGradient(16, 126, 2, 20, 126, 24);
        mg.addColorStop(0, `rgba(140, 188, 245, ${glowA})`);
        mg.addColorStop(1, "rgba(60, 100, 160, 0)");
        c.fillStyle = mg;
        c.fillRect(8, 102, 36, 48);
      } else {
        px(c, ROOM_W - 17, 113, 9, 26, "#1b283b");
        px(c, ROOM_W - 15, 118, 6, 16, "#07070a");
        px(c, ROOM_W - 14, 116, 4, 4, "#15151c");
        const mg = c.createRadialGradient(ROOM_W - 16, 126, 2, ROOM_W - 20, 126, 24);
        mg.addColorStop(0, `rgba(140, 188, 245, ${glowA})`);
        mg.addColorStop(1, "rgba(60, 100, 160, 0)");
        c.fillStyle = mg;
        c.fillRect(ROOM_W - 44, 102, 36, 48);
      }
    }
  }

  function render(ctx, timeSec, lightLevel, player, charConfig, matchState) {
    if (!staticFloorCanvas) buildStaticRoom();

    ctx.drawImage(staticFloorCanvas, 0, 0);
    drawOpenMatchedDoors(ctx, timeSec, matchState);
    drawFireplaceEmbers(ctx, timeSec);
    drawGrandfatherClock(ctx, timeSec, matchState);
    if (App.Clues) {
      const diningObj = (matchState && matchState.roomMap && matchState.roomMap["0,0"]) || { id: "dining_room", doors: { N: true, E: true, S: true, W: true } };
      App.Clues.renderRoomClues(ctx, diningObj, timeSec, matchState);
    }
    if (App.Attic && App.Attic.renderRoomLadder) {
      const diningObj = (matchState && matchState.roomMap && matchState.roomMap["0,0"]) || { id: "dining_room", x: 0, y: 0, doors: { N: true, E: true, S: true, W: true } };
      App.Attic.renderRoomLadder(ctx, diningObj, timeSec, matchState);
    }

    const renderables = [
      { y: CHAIRS[2].y, draw: () => drawChair(ctx, CHAIRS[2]) },
      { y: CHAIRS[0].y, draw: () => drawChair(ctx, CHAIRS[0]) },
      { y: CHAIRS[1].y, draw: () => drawChair(ctx, CHAIRS[1]) },
      {
        y: TABLE.cy + 14,
        draw: () => {
          if (App.Musical && App.Musical.isBoxMode && App.Musical.isBoxMode(matchState)) {
            App.Musical.drawCardboardBox(ctx, timeSec, matchState);
          } else {
            drawRoundTable(ctx, timeSec, matchState);
          }
        }
      },
      { y: CHAIRS[3].y, draw: () => drawChair(ctx, CHAIRS[3]) },
      {
        y: CHAIRS[3].y + 1,
        draw: () => {
          if (App.Endgame && App.Endgame.renderDawnTableCorpses) {
            App.Endgame.renderDawnTableCorpses(ctx, timeSec, matchState);
          }
        }
      },
      {
        y: player.seated ? CHAIRS[player.chairId].y + 1 : player.y,
        draw: () => {
          if (App.Endgame && App.Endgame.isLocalDeadSpectator && App.Endgame.isLocalDeadSpectator(matchState)) {
            return;
          }
          const spriteCfg = Object.assign({}, charConfig, {
            facing: player.facing,
            walking: player.moving,
            lantern: player.lanternOn
          });
          if (player.facingCorner && App.Character.drawBackCornerInWorld) {
            App.Character.drawBackCornerInWorld(ctx, player.x, player.y, spriteCfg, timeSec);
          } else {
            App.Character.drawInWorld(ctx, player.x, player.y, spriteCfg, timeSec, {
              seated: player.seated,
              sprinting: player.sprinting,
              crouching: player.crouching,
              hideShadow: player.seated
            });
          }
        }
      }
    ];

    if (App.Events && App.Events.getParlorRenderables) {
      App.Events.getParlorRenderables(ctx, timeSec, matchState).forEach((evR) => renderables.push(evR));
    }
    if (App.Stalkers && App.Stalkers.getRoomRenderables) {
      App.Stalkers.getRoomRenderables(ctx, "0,0", timeSec, matchState).forEach((sr) => renderables.push(sr));
    }
    if (App.Musical && App.Musical.getRoomRenderables) {
      App.Musical.getRoomRenderables(ctx, "0,0", timeSec, matchState).forEach((mrR) => renderables.push(mrR));
    }
    if (App.StayLit && App.StayLit.getRoomRenderables) {
      App.StayLit.getRoomRenderables(ctx, "0,0", timeSec, matchState).forEach((slR) => renderables.push(slR));
    }
    if (App.Knight && App.Knight.getRoomRenderables) {
      App.Knight.getRoomRenderables(ctx, "0,0", timeSec, matchState).forEach((knR) => renderables.push(knR));
    }
    if (App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch()) {
      App.Network.getRemotePlayersInRoom(0, 0).forEach((rp) => {
        if (rp.deadSpectator || rp.deadInEvent || rp.inForest || rp.inCar || rp.inAttic || rp.inBasement) return;
        if (player && player.spectatePlayerId && rp.playerId === player.spectatePlayerId) return;
        const chairObj = CHAIRS[rp.chairId] || CHAIRS[0];
        renderables.push({
          y: rp.seated ? chairObj.y + 1 : rp.y,
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
                seated: rp.seated,
                sprinting: rp.sprinting,
                crouching: rp.crouching,
                hideShadow: rp.seated
              });
            }
          }
        });
      });
    }

    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach((item) => item.draw());

    const diningObj = (matchState && matchState.roomMap && matchState.roomMap["0,0"]) || { id: "dining_room", x: 0, y: 0, doors: { N: true, E: true, S: true, W: true } };
    const globalBlackout = App.Events && App.Events.isGlobalLightsOut && App.Events.isGlobalLightsOut(matchState);
    const diningShattered = App.Endgame && App.Endgame.isRoomShattered && App.Endgame.isRoomShattered("0,0", matchState);
    const isDawn = App.Endgame && App.Endgame.isDaylightWinMode && App.Endgame.isDaylightWinMode(matchState);
    const diningSwitchOn = isDawn || (!globalBlackout && !diningShattered && !(matchState && matchState.roomLightStates && matchState.roomLightStates["0,0"] === false));

    // Draw live Dining Room wall light switch next to fireplace (48, 36)
    drawDiningLightSwitch(ctx, 48, 36, diningSwitchOn);

    if (isDawn) {
      // Bright warm morning sunlight filling The Dining Room!
      const dawnWash = ctx.createLinearGradient(0, 0, 0, ROOM_H);
      dawnWash.addColorStop(0, "rgba(255, 240, 195, 0.16)");
      dawnWash.addColorStop(1, "rgba(255, 228, 165, 0.24)");
      ctx.fillStyle = dawnWash;
      ctx.fillRect(0, 0, ROOM_W, ROOM_H);
    } else if (diningSwitchOn) {
      drawLightingAndLowBulb(ctx, timeSec, lightLevel, player, player.lanternOn);
    } else {
      // Dining Room Light OFF (manual toggle, Cutting Corners blackout, or Red Balloons!)
      const effDark = Math.min(0.96, 0.85 + (1 - lightLevel) * 0.11);
      pmctx.globalCompositeOperation = "source-over";
      pmctx.clearRect(0, 0, ROOM_W, ROOM_H);
      pmctx.fillStyle = `rgba(3, 3, 6, ${effDark.toFixed(3)})`;
      pmctx.fillRect(0, 0, ROOM_W, ROOM_H);

      pmctx.globalCompositeOperation = "destination-out";

      // Musical Rooms 10s Intro: Dim circular table visibility just enough to see Giant Monkey beside player!
      if (App.Musical && App.Musical.isIntroDarkStage && App.Musical.isIntroDarkStage(matchState)) {
        const tg = pmctx.createRadialGradient(TABLE.cx, TABLE.cy - 4, 8, TABLE.cx, TABLE.cy - 4, 68);
        tg.addColorStop(0, "rgba(0,0,0,0.68)");
        tg.addColorStop(0.60, "rgba(0,0,0,0.34)");
        tg.addColorStop(1, "rgba(0,0,0,0)");
        pmctx.fillStyle = tg;
        pmctx.fillRect(TABLE.cx - 70, TABLE.cy - 74, 140, 140);
      }

      // Soft fireplace ember glow
      const fg = pmctx.createRadialGradient(32, 48, 3, 32, 48, 32);
      fg.addColorStop(0, "rgba(0,0,0,0.58)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      pmctx.fillStyle = fg;
      pmctx.fillRect(0, 16, 64, 64);

      // Handheld Lantern (primary light in the dark!)
      if (player && player.lanternOn) {
        const lx = player.x + player.facing * 7;
        const ly = player.y - 8;
        const flick = 1.0 + Math.sin(timeSec * 9.5) * 0.04;
        const rad = 60 * flick;
        const lg = pmctx.createRadialGradient(lx, ly, 6, lx, ly, rad);
        lg.addColorStop(0, "rgba(0,0,0,0.96)");
        lg.addColorStop(0.55, "rgba(0,0,0,0.68)");
        lg.addColorStop(1, "rgba(0,0,0,0)");
        pmctx.fillStyle = lg;
        pmctx.fillRect(lx - rad - 2, ly - rad - 2, rad * 2 + 4, rad * 2 + 4);
      } else if (player) {
        const dg = pmctx.createRadialGradient(player.x, player.y - 8, 2, player.x, player.y - 8, 22);
        dg.addColorStop(0, "rgba(0,0,0,0.40)");
        dg.addColorStop(1, "rgba(0,0,0,0)");
        pmctx.fillStyle = dg;
        pmctx.fillRect(player.x - 24, player.y - 32, 48, 48);
      }

      // Faint switch pinpoint so player can locate the Dining Room light switch in the dark
      const sg = pmctx.createRadialGradient(50, 39, 1, 50, 39, 14);
      sg.addColorStop(0, "rgba(0,0,0,0.68)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      pmctx.fillStyle = sg;
      pmctx.fillRect(36, 25, 28, 28);

      if (App.Clues && App.Clues.getClueLightPoints) {
        App.Clues.getClueLightPoints(diningObj, matchState).forEach((cl) => {
          const cg = pmctx.createRadialGradient(cl.x, cl.y, 4, cl.x, cl.y, cl.r);
          cg.addColorStop(0, `rgba(0,0,0,${(cl.strength || 0.84).toFixed(2)})`);
          cg.addColorStop(1, "rgba(0,0,0,0)");
          pmctx.fillStyle = cg;
          pmctx.fillRect(cl.x - cl.r - 2, cl.y - cl.r - 2, cl.r * 2 + 4, cl.r * 2 + 4);
        });
      }

      ctx.drawImage(parlorMask, 0, 0);

      // Tiny warm switch locator dot + hanging bulb cord (broken & sparking if shattered!)
      px(ctx, 50, 41, 1, 1, "#ffdb8c");
      const swayX = Math.sin(timeSec * (diningShattered ? 6.5 : 1.15)) * (diningShattered ? 2.2 : 0.8);
      const bulbX = TABLE.cx + swayX;
      ctx.fillStyle = "#121116";
      ctx.fillRect(Math.round(bulbX), 0, 1, 77);
      px(ctx, bulbX - 4, 76, 9, 2, "#24272e");
      px(ctx, bulbX - 6, 78, 13, 2, "#323740");
      if (diningShattered) {
        // Shattered empty socket & jagged broken glass collar + crackling electric spark!
        px(ctx, bulbX - 1, 80, 3, 2, "#6a7582");
        if (Math.sin(timeSec * 42) > 0.25) {
          px(ctx, bulbX - 2, 82, 2, 2, "#d8f6ff");
          px(ctx, bulbX + 1, 83, 2, 1, "#ffe896");
        }
      } else {
        px(ctx, bulbX - 1, 82, 3, 4, "#4b4840");
      }

      if (player && player.lanternOn) {
        const lx = player.x + player.facing * 7;
        const ly = player.y - 8;
        const wg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
        wg.addColorStop(0, "rgba(255, 212, 125, 0.22)");
        wg.addColorStop(1, "rgba(255, 180, 80, 0)");
        ctx.fillStyle = wg;
        ctx.fillRect(lx - 48, ly - 48, 96, 96);
      }
    }

    if (App.Clues && lightLevel > 0.12) {
      App.Clues.renderRoomClueHighlights(ctx, diningObj, timeSec, matchState);
    }
    if (App.Events && App.Events.renderRoomEventHighlights) {
      App.Events.renderRoomEventHighlights(ctx, diningObj, timeSec, matchState);
    }
    if (App.Stalkers && App.Stalkers.renderRoomHighlights) {
      App.Stalkers.renderRoomHighlights(ctx, "0,0", timeSec, matchState, player);
    }
    if (App.Musical && App.Musical.renderRoomOverlays) {
      App.Musical.renderRoomOverlays(ctx, "0,0", timeSec, matchState, player);
    }
    if (App.StayLit && App.StayLit.renderRoomHighlights) {
      App.StayLit.renderRoomHighlights(ctx, "0,0", timeSec, matchState);
    }
    if (App.Knight && App.Knight.renderRoomHighlights) {
      App.Knight.renderRoomHighlights(ctx, "0,0", timeSec, matchState);
    }
    if (App.Endgame && App.Endgame.renderGlassShardsOverlay) {
      App.Endgame.renderGlassShardsOverlay(ctx, matchState);
    }
  }

  App.GameRoom = {
    ROOM_W,
    ROOM_H,
    FLOOR_BOUNDS,
    TABLE,
    CLOCK,
    CHAIRS,
    COLLIDERS,
    INTERACTABLES,
    render
  };
})(window.Duskwood);
