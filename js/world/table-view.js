/* ==========================================================================
   DUSKWOOD INN - First-Person Wooden Round Table (v0.10 Intro & Turn Engine)
   Preserves the exact v0.9 weathered oak round table, carved groove, 6 o'clock
   pedestal, outer-rim curved cards & parchment hand, and adds:
   - Table Intro (triggered once all players sit & enter Table View):
       1) Player Cutout Pawn rises from underneath the wooden groove at XII
       2) Player Pawn glides 1 full clockwise lap around the clock track -> XII
       3) Pedestal deals ONLY ROOT CELLAR (no cards in hand before this!)
   - Turn 1: Place ROOT CELLAR adjacent to Main Parlor -> deals 3 random cards
             + Player Pawn advances +15 minutes.
   - Turn 2: Guaranteed draw of THE HOLLOW HARVESTER -> place down on rim ->
             starts 3-turn spawn countdown (+15 min for player).
   - 3 turns later: Hollow Harvester RISES UP from beneath the table at XII
             (the exact spawn point of the player!) with rising animation, then
             hunts every turn identically to The Visitor (+30 min/turn, 1 Last
             Chance turn when caught).
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

// ==================== 480x270 PIXEL-ART WOODEN ROUND TABLE CANVAS ====================
(function (App) {
  const W = 480;
  const H = 270;

  const TABLE_GEO = {
    W,
    H,
    cx: 240,
    cy: 122,
    outerRx: 196,
    outerRy: 108,
    rimRx: 189,
    rimRy: 103,
    grooveOuterRx: 140,
    grooveOuterRy: 75,
    grooveInnerRx: 124,
    grooveInnerRy: 66,
    grooveMidRx: 132,
    grooveMidRy: 70.5,
    cardRingRx: 164,
    cardRingRy: 89
  };

  let canvas = null;
  let ctx = null;
  let staticTableCanvas = null;
  let outerRimRingCanvas = null;

  function createRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

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

  function strokePixelEllipse(c, cx, cy, rx, ry, color, thickness) {
    c.fillStyle = color;
    const steps = 420;
    const t = thickness || 1;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      c.fillRect(x, y, t, t);
    }
  }

  function drawSlattedChair(c, side) {
    if (side === "top") {
      const x = 204, y = 0;
      px(c, x, y, 72, 26, "#140c08");
      px(c, x + 2, y, 68, 22, "#2e1d13");
      for (let i = 0; i < 6; i++) {
        px(c, x + 6 + i * 11, y + 3, 6, 19, "#462d1e");
        px(c, x + 7 + i * 11, y + 3, 2, 19, "#5c3c28");
      }
      px(c, x - 2, y, 76, 4, "#4f3422");
      return;
    }

    if (side === "left") {
      c.save();
      c.translate(30, 82);
      c.rotate(-0.34);
      px(c, -26, -68, 52, 132, "#120a07");
      px(c, -23, -64, 46, 124, "#2d1c12");
      for (let i = 0; i < 4; i++) {
        px(c, -18 + i * 11, -56, 7, 108, "#472d1d");
        px(c, -17 + i * 11, -56, 2, 108, "#613f29");
      }
      px(c, -26, -68, 52, 9, "#543623");
      px(c, -26, 42, 52, 8, "#3d2618");
      c.restore();
      return;
    }

    c.save();
    c.translate(W - 30, 82);
    c.rotate(0.34);
    px(c, -26, -68, 52, 132, "#120a07");
    px(c, -23, -64, 46, 124, "#2d1c12");
    for (let i = 0; i < 4; i++) {
      px(c, -18 + i * 11, -56, 7, 108, "#472d1d");
      px(c, -17 + i * 11, -56, 2, 108, "#613f29");
    }
    px(c, -26, -68, 52, 9, "#543623");
    px(c, -26, 42, 52, 8, "#3d2618");
    c.restore();
  }

  function buildStaticWoodenTable() {
    staticTableCanvas = document.createElement("canvas");
    staticTableCanvas.width = W;
    staticTableCanvas.height = H;
    const c = staticTableCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    const rng = createRng(48219);
    const g = TABLE_GEO;

    // 1. Dark Parlor Floorboards & Subtle Carpet
    px(c, 0, 0, W, H, "#0a0807");
    for (let y = 0; y < H; y += 12) {
      px(c, 0, y, W, 11, y % 24 === 0 ? "#120e0b" : "#0e0b09");
      px(c, 0, y + 11, W, 1, "#060505");
    }
    for (let i = 0; i < 240; i++) {
      const rx = Math.floor(rng() * W);
      const ry = Math.floor(rng() * H);
      px(c, rx, ry, 2, 1, "#1a1410");
    }
    px(c, 340, 0, 44, 24, "#1a1512");
    px(c, 344, 0, 36, 20, "#241d18");

    // 2. Three Slatted Wooden Chairs
    drawSlattedChair(c, "top");
    drawSlattedChair(c, "left");
    drawSlattedChair(c, "right");

    // 3. Contact Shadow & Carved Oak Skirt
    fillPixelEllipse(c, g.cx, g.cy + 15, g.outerRx + 6, g.outerRy + 7, "rgba(0, 0, 0, 0.78)");
    fillPixelEllipse(c, g.cx, g.cy + 8, g.outerRx, g.outerRy, "#1d110a");
    fillPixelEllipse(c, g.cx, g.cy + 4, g.outerRx - 1, g.outerRy - 1, "#3b2415");

    // 4. Outer Beveled Rim
    fillPixelEllipse(c, g.cx, g.cy, g.outerRx, g.outerRy, "#2a190f");
    fillPixelEllipse(c, g.cx, g.cy, g.outerRx - 3, g.outerRy - 2, "#61412a");
    fillPixelEllipse(c, g.cx, g.cy, g.rimRx, g.rimRy, "#332013");

    // 5. Clipped Weathered Oak Wood Planks Tabletop
    c.save();
    c.beginPath();
    c.ellipse(g.cx, g.cy, g.rimRx - 1, g.rimRy - 1, 0, 0, Math.PI * 2);
    c.clip();

    const plankPalette = ["#6e4b30", "#65442b", "#755134", "#5c3d26", "#704d31"];
    const plankW = 20;
    for (let x = g.cx - g.rimRx - 10; x < g.cx + g.rimRx + 10; x += plankW) {
      const idx = Math.abs(Math.floor(x / plankW));
      const base = plankPalette[idx % plankPalette.length];
      px(c, x, g.cy - g.rimRy, plankW, g.rimRy * 2 + 4, base);
      px(c, x, g.cy - g.rimRy, 1, g.rimRy * 2 + 4, "#3b2516");
      px(c, x + 1, g.cy - g.rimRy, 1, g.rimRy * 2 + 4, "#855e3e");

      for (let s = 0; s < 14; s++) {
        const gx = x + 2 + Math.floor(rng() * (plankW - 4));
        const gy = g.cy - g.rimRy + Math.floor(rng() * (g.rimRy * 2));
        const gh = 8 + Math.floor(rng() * 32);
        px(c, gx, gy, 1, gh, s % 3 === 0 ? "#8a6240" : "#523520");
      }
      if (idx % 2 === 0) {
        const jy = g.cy - 45 + Math.floor(rng() * 90);
        px(c, x, jy, plankW, 1, "#3b2516");
      }
    }

    const woodGlow = c.createRadialGradient(g.cx, g.cy - 18, 12, g.cx, g.cy, g.rimRx);
    woodGlow.addColorStop(0, "rgba(255, 224, 168, 0.24)");
    woodGlow.addColorStop(0.58, "rgba(255, 200, 130, 0.04)");
    woodGlow.addColorStop(1, "rgba(18, 10, 6, 0.42)");
    c.fillStyle = woodGlow;
    c.fillRect(g.cx - g.rimRx, g.cy - g.rimRy, g.rimRx * 2, g.rimRy * 2);

    // 6. Carved Recessed Circular Clock Groove
    strokePixelEllipse(c, g.cx, g.cy, g.grooveOuterRx + 1, g.grooveOuterRy + 1, "#331e12", 2);
    strokePixelEllipse(c, g.cx, g.cy, g.grooveOuterRx - 1, g.grooveOuterRy - 1, "#87613f", 1);

    c.save();
    c.beginPath();
    c.ellipse(g.cx, g.cy, g.grooveOuterRx - 1, g.grooveOuterRy - 1, 0, 0, Math.PI * 2);
    c.ellipse(g.cx, g.cy, g.grooveInnerRx + 1, g.grooveInnerRy + 1, 0, 0, Math.PI * 2, true);
    c.fillStyle = "rgba(32, 19, 11, 0.34)";
    c.fill("evenodd");
    c.restore();

    strokePixelEllipse(c, g.cx, g.cy, g.grooveInnerRx + 1, g.grooveInnerRy + 1, "#2b190e", 2);
    strokePixelEllipse(c, g.cx, g.cy, g.grooveInnerRx - 1, g.grooveInnerRy - 1, "#8c6543", 1);

    // 7. Etched 12-Hour Clock Groove divided into 48 exact 15-minute notches (720 min total)
    //    Each hour (60m) has its Roman numeral + 3 radial carved ticks (:15, :30, :45)
    const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
    c.font = "700 7px 'Pixelify Sans', monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";

    for (let i = 0; i < 48; i++) {
      const ang = Math.PI / 2 + (i * Math.PI * 2) / 48;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const mx = g.cx + cosA * g.grooveMidRx;
      const my = g.cy + sinA * g.grooveMidRy;

      // Outward normal direction of the ellipse at angle ang
      const nxRaw = cosA / g.grooveMidRx;
      const nyRaw = sinA / g.grooveMidRy;
      const nLen = Math.hypot(nxRaw, nyRaw) || 1;
      const nx = nxRaw / nLen;
      const ny = nyRaw / nLen;

      if (i % 4 === 0) {
        // Full Hour Mark (:00) — Carved Roman Numeral + outer/inner alignment pin
        const num = ROMAN[i / 4];
        c.fillStyle = "#24140a";
        c.fillText(num, Math.round(mx) + 1, Math.round(my) + 1);
        c.fillStyle = i === 0 ? "#fae6b4" : "#e3cb9b";
        c.fillText(num, Math.round(mx), Math.round(my));

        // Tiny crisp indicator notch on the outer groove lip for exact hour alignment
        const ox = Math.round(g.cx + cosA * (g.grooveOuterRx - 2));
        const oy = Math.round(g.cy + sinA * (g.grooveOuterRy - 2));
        px(c, ox, oy, 1, 1, "#e3cb9b");
      } else {
        // Quarter-hour (:15 / :45) & Half-hour (:30) radial carved tick lines inside groove
        const isHalfHour = i % 4 === 2;
        const halfSpan = isHalfHour ? 3.2 : 2.0;
        const x1 = mx - nx * halfSpan;
        const y1 = my - ny * halfSpan;
        const x2 = mx + nx * halfSpan;
        const y2 = my + ny * halfSpan;

        // Carved dark groove shadow + warm ivory highlight stroke
        c.save();
        c.lineWidth = isHalfHour ? 1.5 : 1.1;
        c.strokeStyle = "#26150b";
        c.beginPath();
        c.moveTo(x1 + 0.8, y1 + 0.8);
        c.lineTo(x2 + 0.8, y2 + 0.8);
        c.stroke();

        c.strokeStyle = isHalfHour ? "#dec796" : "#b89d6d";
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        c.restore();
      }
    }

    c.restore();

    c.save();
    c.beginPath();
    c.ellipse(g.cx, g.cy, g.outerRx - 2, g.outerRy - 2, 0, Math.PI * 1.15, Math.PI * 1.85);
    c.strokeStyle = "rgba(255, 224, 165, 0.25)";
    c.lineWidth = 2;
    c.stroke();
    c.restore();

    buildOuterRimRingSprite();
  }

  // Builds a crisp pixel-art circular wooden turntable ring (24 segmented oak rim wedges + brass pins)
  // that physically rotates around the fixed inner clock & map disc!
  function buildOuterRimRingSprite() {
    const g = TABLE_GEO;
    const S = g.rimRx * 2 + 8; // 386x386
    const cx = S / 2;
    const cy = S / 2;
    const outerR = g.rimRx;
    const innerR = g.grooveOuterRx + 2;

    outerRimRingCanvas = document.createElement("canvas");
    outerRimRingCanvas.width = S;
    outerRimRingCanvas.height = S;
    const rc = outerRimRingCanvas.getContext("2d");
    rc.imageSmoothingEnabled = false;

    const segCount = 24;
    const woodTones = ["#6e4b30", "#614128", "#755134", "#593b24"];

    for (let i = 0; i < segCount; i++) {
      const a0 = (i * Math.PI * 2) / segCount;
      const a1 = ((i + 1) * Math.PI * 2) / segCount;

      // Radial weathered oak wedge plank
      rc.beginPath();
      rc.arc(cx, cy, outerR, a0, a1);
      rc.arc(cx, cy, innerR, a1, a0, true);
      rc.closePath();
      rc.fillStyle = woodTones[i % woodTones.length];
      rc.fill();

      // Subtle mid-plank lighter wood grain highlight strip
      const midA = (a0 + a1) * 0.5;
      rc.strokeStyle = i % 2 === 0 ? "rgba(168, 122, 78, 0.28)" : "rgba(42, 24, 13, 0.22)";
      rc.lineWidth = 2;
      rc.beginPath();
      rc.moveTo(cx + Math.cos(midA) * (innerR + 5), cy + Math.sin(midA) * (innerR + 5));
      rc.lineTo(cx + Math.cos(midA) * (outerR - 6), cy + Math.sin(midA) * (outerR - 6));
      rc.stroke();

      // Dark carved wood plank seam between wedges (makes the table rim rotation unmistakable!)
      rc.strokeStyle = "#2b180d";
      rc.lineWidth = 2;
      rc.beginPath();
      rc.moveTo(cx + Math.cos(a0) * innerR, cy + Math.sin(a0) * innerR);
      rc.lineTo(cx + Math.cos(a0) * outerR, cy + Math.sin(a0) * outerR);
      rc.stroke();

      // Crisp highlight lip right beside each wedge seam
      const hA = a0 + 0.015;
      rc.strokeStyle = "rgba(186, 140, 92, 0.35)";
      rc.lineWidth = 1;
      rc.beginPath();
      rc.moveTo(cx + Math.cos(hA) * (innerR + 2), cy + Math.sin(hA) * (innerR + 2));
      rc.lineTo(cx + Math.cos(hA) * (outerR - 3), cy + Math.sin(hA) * (outerR - 3));
      rc.stroke();

      // Outer edge brass rivets & carved turntable gear notches
      const pinR = outerR - 7;
      const pxPos = Math.round(cx + Math.cos(midA) * pinR);
      const pyPos = Math.round(cy + Math.sin(midA) * pinR);
      const isMajor = i % 3 === 0;
      px(rc, pxPos - 2, pyPos - 2, 4, 4, "#24140a");
      px(rc, pxPos - 1, pyPos - 1, 2, 2, isMajor ? "#d4ab59" : "#87613f");
    }

    // Concentric wooden trim rings inlaid on the rotating outer wheel
    rc.strokeStyle = "#362013";
    rc.lineWidth = 2;
    rc.beginPath();
    rc.arc(cx, cy, outerR - 12, 0, Math.PI * 2);
    rc.stroke();

    rc.strokeStyle = "rgba(168, 126, 82, 0.32)";
    rc.lineWidth = 1;
    rc.beginPath();
    rc.arc(cx, cy, innerR + 6, 0, Math.PI * 2);
    rc.stroke();
  }

  // Exact (x, y) position in carved groove from continuous minutes (0 = XII, 720 = full 12h lap back to XII)
  function getGroovePointFromMinutes(minutes) {
    const g = TABLE_GEO;
    const norm = (((minutes % 720) + 720) % 720) / 720;
    const ang = Math.PI / 2 + norm * Math.PI * 2;
    return {
      x: g.cx + Math.cos(ang) * g.grooveMidRx,
      y: g.cy + Math.sin(ang) * g.grooveMidRy,
      ang
    };
  }

  // Subtle trembling shadow fissure at XII while Harvester countdown (3 -> 1 turns) ticks down
  function drawDormantFissureAtSpawn(c, timeSec, turnsLeft) {
    const pt = getGroovePointFromMinutes(0);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const urgency = (4 - turnsLeft) / 3; // 0.33 -> 0.66 -> 1.0
    const pulse = 0.55 + Math.sin(timeSec * (4 + urgency * 8)) * 0.35;

    const grad = c.createRadialGradient(x, y, 1, x, y, 8 + urgency * 6);
    grad.addColorStop(0, `rgba(12, 4, 8, ${0.75 * urgency})`);
    grad.addColorStop(0.55, `rgba(180, 34, 42, ${0.28 * urgency * pulse})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = grad;
    c.fillRect(x - 16, y - 16, 32, 32);

    // Small recessed wooden slit at XII
    px(c, x - 5, y - 1, 10, 2, "#0c0707");
    if (turnsLeft === 1) {
      // Faint red glint peeking from under the slot when 1 turn remains!
      px(c, x - 1, y - 1, 2, 1, pulse > 0.6 ? "#ff5252" : "#801b22");
    }
  }

  // Physical Player Cutout Pawn with smooth rising-from-below-table clipping!
  function drawPlayerCutoutPawn(c, pt, timeSec, riseProgress) {
    const rise = Math.max(0, Math.min(1, riseProgress));
    if (rise <= 0.001) return;

    const x = Math.round(pt.x);
    const y = Math.round(pt.y);

    // Dark recessed trapdoor slot in groove while emerging
    if (rise < 0.99) {
      px(c, x - 6, y - 1, 12, 3, "#0d0705");
      px(c, x - 5, y, 10, 1, "#26150c");
    }

    // Cast shadow fades in smoothly as piece emerges
    const sx = Math.sign(pt.x - TABLE_GEO.cx) || -1;
    const sy = Math.sign(pt.y - TABLE_GEO.cy) || 1;
    c.fillStyle = `rgba(10, 6, 4, ${(0.56 * rise).toFixed(2)})`;
    c.fillRect(x + sx * 2 - 4, y + sy * 2 - 2, Math.round(9 * rise), 4);
    c.fillRect(x + sx * 4 - 3, y + sy * 3 - 1, Math.round(6 * rise), 3);

    // Clip cleanly at the wooden groove floor line (y + 1) so the piece emerges from underneath!
    c.save();
    c.beginPath();
    c.rect(x - 16, y - 28, 32, 29);
    c.clip();

    const sinkOffset = Math.round((1 - rise) * 18);
    const py = y + sinkOffset;

    // Brass stand base
    px(c, x - 4, py - 1, 8, 2, "#3b2615");
    px(c, x - 3, py - 2, 6, 2, "#c79e4c");

    const bob = rise >= 0.99 && Math.sin(timeSec * 3.5) > 0.65 ? -1 : 0;
    // Head
    px(c, x - 1, py - 14 + bob, 4, 4, "#241914");
    px(c, x, py - 13 + bob, 2, 2, "#f5ecd8");
    // Torso & running limbs
    px(c, x - 1, py - 10 + bob, 3, 5, "#f0e5cc");
    px(c, x - 4, py - 9 + bob, 3, 2, "#e3d6b8");
    px(c, x + 2, py - 10 + bob, 3, 2, "#f5ecd8");
    px(c, x - 3, py - 5 + bob, 2, 3, "#e3d6b8");
    px(c, x + 1, py - 5 + bob, 2, 4, "#f5ecd8");
    px(c, x + 4, py - 9 + bob, 2, 2, "#ffe680");

    c.restore();
  }

  // Tall Wire-Shadow Hollow Harvester Pawn with dramatic rising-from-below-table animation!
  function drawHarvesterWirePawn(c, pt, timeSec, riseProgress) {
    const rise = Math.max(0, Math.min(1, riseProgress));
    if (rise <= 0.001) return;

    const x = Math.round(pt.x);
    const y = Math.round(pt.y);

    // Dark smoky rift opening beneath the groove while Harvester rises!
    if (rise < 0.99) {
      const aura = c.createRadialGradient(x, y, 1, x, y, 18);
      aura.addColorStop(0, `rgba(180, 28, 36, ${(0.55 * (1 - rise * 0.4)).toFixed(2)})`);
      aura.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = aura;
      c.fillRect(x - 18, y - 18, 36, 36);
      px(c, x - 7, y - 1, 14, 3, "#090507");
    }

    // Long sinister cast shadow stretching across oak planks
    const dirX = Math.cos(pt.ang);
    const dirY = Math.sin(pt.ang);
    c.save();
    c.strokeStyle = `rgba(8, 5, 4, ${(0.54 * rise).toFixed(2)})`;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dirX * 19 * rise, y + dirY * 12 * rise);
    c.stroke();
    c.restore();

    // Clip at groove line (y + 1) so the tall Harvester physically emerges out of the wood!
    c.save();
    c.beginPath();
    c.rect(x - 18, y - 34, 36, 35);
    c.clip();

    const sinkOffset = Math.round((1 - rise) * 25);
    const tremble = rise < 0.99 ? Math.round(Math.sin(timeSec * 46) * 1) : 0;
    const twitch = rise >= 0.99 && Math.sin(timeSec * 14) > 0.72 ? 1 : 0;
    const hx = x + tremble;
    const hy = y + sinkOffset;
    const h = 23;

    // Base stand
    px(c, hx - 3, hy - 1, 6, 2, "#0c090d");
    // Spindly legs
    px(c, hx - 2, hy - 7, 1, 7, "#110d12");
    px(c, hx + 1, hy - 7, 1, 7, "#110d12");
    // Arched spine
    px(c, hx - 1 + twitch, hy - h + 5, 2, h - 11, "#120e14");
    // Long dangling spindly arms
    px(c, hx - 4 + twitch, hy - h + 7, 3, 1, "#120e14");
    px(c, hx - 4 + twitch, hy - h + 8, 1, 7, "#120e14");
    px(c, hx + 1 + twitch, hy - h + 7, 3, 1, "#120e14");
    px(c, hx + 3 + twitch, hy - h + 8, 1, 7, "#120e14");
    // Hollow elongated head
    px(c, hx - 2 + twitch, hy - h, 5, 6, "#0d0a10");
    px(c, hx - 1 + twitch, hy - h + 1, 3, 4, "#1c1621");
    // Glowing crimson eyes
    px(c, hx - 1 + twitch, hy - h + 2, 1, 1, "#ff4d4d");
    px(c, hx + 1 + twitch, hy - h + 2, 1, 1, "#ff4d4d");

    c.restore();
  }

  function render(timeSec, matchState, animState) {
    if (!ctx) return;
    if (!staticTableCanvas) buildStaticWoodenTable();

    ctx.drawImage(staticTableCanvas, 0, 0);

    // Physically rotate the 3D pixel-art outer wooden table rim ring (annulus outside the clock groove)!
    const rimOff = animState ? (animState.rimAngleOffset || 0) : 0;
    const g = TABLE_GEO;
    if (outerRimRingCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(g.cx, g.cy, g.rimRx - 1, g.rimRy - 1, 0, 0, Math.PI * 2);
      ctx.ellipse(g.cx, g.cy, g.grooveOuterRx + 2, g.grooveOuterRy + 2, 0, 0, Math.PI * 2, true);
      ctx.clip("evenodd");

      // Squash circular wooden rim sprite to the exact 3/4 table perspective & spin by rimOff!
      ctx.save();
      ctx.translate(g.cx, g.cy);
      ctx.scale(1, g.rimRy / g.rimRx);
      ctx.rotate(rimOff);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        outerRimRingCanvas,
        -outerRimRingCanvas.width / 2,
        -outerRimRingCanvas.height / 2
      );
      ctx.restore();

      // Fixed directional overhead lamp shading & 3D beveled lip depth on the rotating outer ring
      const ringShade = ctx.createRadialGradient(g.cx, g.cy - 22, 70, g.cx, g.cy, g.rimRx);
      ringShade.addColorStop(0, "rgba(255, 224, 168, 0.14)");
      ringShade.addColorStop(0.68, "rgba(255, 200, 130, 0.02)");
      ringShade.addColorStop(1, "rgba(16, 9, 5, 0.50)");
      ctx.fillStyle = ringShade;
      ctx.fillRect(g.cx - g.rimRx, g.cy - g.rimRy, g.rimRx * 2, g.rimRy * 2);

      // Dark mechanical seam separating the rotating outer rim ring from the stationary inner clock disc!
      strokePixelEllipse(ctx, g.cx, g.cy, g.grooveOuterRx + 3, g.grooveOuterRy + 3, "#1a0e08", 2);
      strokePixelEllipse(ctx, g.cx, g.cy, g.rimRx - 2, g.rimRy - 2, "#24140a", 2);
      ctx.restore();

      // Crisp 3D pixel-art cast shadow base directly beneath the rotating Graveyard pedestal
      const pedAng = Math.PI / 2 + rimOff;
      const pedX = g.cx + Math.cos(pedAng) * g.cardRingRx;
      const pedY = g.cy + Math.sin(pedAng) * g.cardRingRy;
      fillPixelEllipse(ctx, pedX + 2, pedY + 8, 22, 11, "rgba(8, 4, 2, 0.54)");
    }

    // Draw dormant fissure at XII if Harvester card has been played & countdown is active
    if (
      matchState &&
      matchState.harvesterCardPlayed &&
      !matchState.harvesterSpawned &&
      matchState.harvesterDelayTurns > 0
    ) {
      drawDormantFissureAtSpawn(ctx, timeSec, matchState.harvesterDelayTurns);
    }

    const pRise = animState ? animState.playerRise : 1;
    const pMin = animState ? animState.visualPlayerMinutes : (matchState ? matchState.clockMinutes : 0);
    const hRise = animState ? animState.harvesterRise : 0;
    const hMin = animState ? animState.visualHarvesterMinutes : 0;

    const pPt = getGroovePointFromMinutes(pMin);
    const hPt = getGroovePointFromMinutes(hMin);

    const harvVisible = hRise > 0.001;
    const rawDelta = Math.abs((pMin % 720) - (hMin % 720));
    const sameSpot = harvVisible && Math.min(rawDelta, 720 - rawDelta) < 10;
    const pDrawPt = sameSpot ? { x: pPt.x - 6, y: pPt.y, ang: pPt.ang } : pPt;
    const hDrawPt = sameSpot ? { x: hPt.x + 6, y: hPt.y, ang: hPt.ang } : hPt;

    // Depth sort standing pawns by Y
    const pawns = [];
    if (pRise > 0.001) {
      pawns.push({ y: pDrawPt.y, draw: () => drawPlayerCutoutPawn(ctx, pDrawPt, timeSec, pRise) });
    }
    if (harvVisible) {
      pawns.push({ y: hDrawPt.y, draw: () => drawHarvesterWirePawn(ctx, hDrawPt, timeSec, hRise) });
    }
    pawns.sort((a, b) => a.y - b.y);
    pawns.forEach((p) => p.draw());

    // Overhead warm lamp vignette + silent architecture-shift bulb flicker!
    const archLight = animState && typeof animState.archFlickerLight === "number"
      ? animState.archFlickerLight
      : 1.0;
    const isDanger =
      (matchState && matchState.setupPhase === "LAST_CHANCE") ||
      (animState && animState.harvesterRisingNow);
    const flick = (0.94 + Math.sin(timeSec * (isDanger ? 20 : 6.2)) * (isDanger ? 0.08 : 0.03)) * archLight;
    const vig = ctx.createRadialGradient(240, 108, 42, 240, 130, 265);
    if (isDanger) {
      vig.addColorStop(0, `rgba(255, 135, 110, ${0.11 * flick})`);
      vig.addColorStop(0.6, "rgba(18, 4, 6, 0.18)");
      vig.addColorStop(1, "rgba(4, 1, 2, 0.80)");
    } else {
      vig.addColorStop(0, `rgba(255, 228, 165, ${0.09 * flick})`);
      vig.addColorStop(0.62, "rgba(10, 6, 4, 0.12)");
      vig.addColorStop(1, "rgba(4, 3, 3, 0.76)");
    }
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Extra canvas darkness pass synced to silent architecture flicker
    if (archLight < 0.99) {
      ctx.fillStyle = `rgba(3, 2, 4, ${Math.min(0.88, (1 - archLight) * 0.92).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  App.TableCanvas = {
    GEO: TABLE_GEO,
    init(canvasEl) {
      canvas = canvasEl;
      if (!canvas) return;
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
    },
    render
  };
})(window.Duskwood);

// ==================== FIRST-PERSON ROUND TABLE GAMEPLAY CONTROLLER ====================
(function (App) {
  const MAX_ROOM_DISTANCE = 6;
  const CLOCK_TOTAL_MINUTES = 720;    // Full 12-hour clock (12:00 PM -> 12:00 AM), 48 x 15-min notches!
  const PASSIVE_PLAYER_STEP_MIN = 15; // Every turn, player pawn moves 15 minutes (1 notch)!
  const HARVESTER_STEP_MIN = 30;      // Harvester advances +30 min (2 notches) per turn like The Visitor!
  const INTRO_TOTAL_SEC = 11.0;       // Synced to audio/human_intro.mp3 (11 seconds)

  let isOpen = false;
  let matchStateRef = null;
  let onStandUpCallback = null;
  let onStateChangeCallback = null;

  let turnStep = 1; // 1 = Draw/Reclaim, 2 = Play a Card
  let deck = [];
  let hand = [];
  let candleTray = [];
  let rimPlayedCards = [];

  let selectedHandIdx = -1;
  let selectedRotation = 0; // 0=0°, 1=90°, 2=180°, 3=270° clockwise for selected Room Card
  let pendingDrawnCard = null;
  let hexInterrupted = false;
  let dealTimeouts = [];
  let dealAnimIndices = new Set(); // Only animate newly dealt/drawn cards once
  let drawPity = { sinceRoom: 0, sinceClue: 0, sinceEvent: 0 };
  let uniqueDrawnCardIds = new Set(); // Guarantees strictly 1x The Thief & 1x The Neighbor per match!

  function recordUniqueCardIfNeeded(card) {
    if (!card) return;
    const list = (App.CardsDB && App.CardsDB.UNIQUE_ONCE_PER_MATCH_IDS) || ["ch_the_thief", "ch_the_neighbor"];
    if (list.includes(card.id)) {
      uniqueDrawnCardIds.add(card.id);
      if (matchStateRef) matchStateRef.uniqueDrawnCardIds = Array.from(uniqueDrawnCardIds);
    }
  }
  let thiefWheelActive = false;
  let thiefWheelSpinning = false;
  let thiefCurrentAngle = 0;

  // Canonical table seat angles (clockwise from 6 o'clock = 0 rad)
  const SEAT_ANGLES = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

  // Animation State for Table Intro, Very Slow Pawn Gliding, Outer Rim Turn Rotation & Light Flicker
  const anim = {
    introStage: "WAITING", // WAITING | PLAYER_RISE | PLAYER_ORBIT | DEAL_CELLAR | DONE
    introTimer: 0,
    lastOrbitTickIdx: -1,
    playerRise: 0,
    visualPlayerMinutes: 0,
    harvesterRise: 0,
    harvesterRisingNow: false,
    visualHarvesterMinutes: 0,
    dealingCards: false,
    archFlickerActive: false,
    archFlickerElapsed: 0,
    archFlickerLight: 1.0,
    drawAnimating: false,
    shuffleAnimating: false,
    // Sequential Turn Animation Queue (Slow Notch-by-Notch Pawn Glides -> Deal -> Rim Turn)
    stepQueue: [],
    activeStep: null,
    // Outer Rim Turntable Rotation (Graveyard Pedestal + Played Outer-Rim Cards)
    rimAngleOffset: 0,
    rimRotating: false,
    rimElapsed: 0,
    rimDuration: 7.0,
    rimStartAngle: 0,
    rimTargetAngle: 0,
    rimLastTickIdx: 0
  };

  // Pan & Zoom for center wooden room-card layout
  let mapZoom = 1.0;
  let mapPanX = 0;
  let mapPanY = 0;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panMoved = false;

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeInOutSine(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }

  // Deliberate, very slow mechanical glide durations synced to 4.0s audio/moving.mp3!
  function computePawnMoveDuration(deltaMinutes) {
    const abs = Math.abs(deltaMinutes || 0);
    if (abs <= 0.1) return 0;
    if (abs <= 15) return 1.35; // 1 notch (15m): plays 1.35s of moving.mp3
    if (abs <= 30) return 2.45; // 2 notches (30m): plays 2.45s of moving.mp3
    if (abs <= 45) return 3.30; // 3 notches (45m): plays 3.30s of moving.mp3
    if (abs <= 60) return 4.00; // 4 notches (60m): plays exact full 4.0s of moving.mp3!
    return Math.min(6.0, 1.35 + (abs / 15) * 0.68);
  }

  function clearStepQueue() {
    anim.stepQueue = [];
    anim.activeStep = null;
    if (App.Audio && App.Audio.stopPawnMove) App.Audio.stopPawnMove();
  }

  function startNextQueuedStep() {
    if (anim.activeStep || anim.stepQueue.length === 0) return;

    while (anim.stepQueue.length > 0 && !anim.activeStep) {
      const next = anim.stepQueue.shift();

      if (next.type === "CALLBACK") {
        if (typeof next.fn === "function") next.fn();
        continue;
      }

      if (next.type === "MOVE_PLAYER" || next.type === "MOVE_HARVESTER") {
        const delta = Math.abs(next.toMin - next.fromMin);
        if (delta <= 0.1) {
          if (next.type === "MOVE_PLAYER") anim.visualPlayerMinutes = next.toMin;
          else anim.visualHarvesterMinutes = next.toMin;
          continue;
        }
        next.elapsed = 0;
        next.duration = next.duration || computePawnMoveDuration(delta);
        next.lastNotchIdx = Math.floor(next.fromMin / 15);
        anim.activeStep = next;
        if (App.Audio && App.Audio.playPawnMove) {
          App.Audio.playPawnMove(next.duration);
        }
        syncUI();
        return;
      }

      if (next.type === "RISE_HARVESTER") {
        next.elapsed = 0;
        next.duration = 1.45;
        anim.activeStep = next;
        triggerHarvesterEmergence();
        syncUI();
        return;
      }

      if (next.type === "DEAL_STARTER_3") {
        anim.activeStep = next;
        anim.dealingCards = true;
        syncUI();
        const cards = next.cards || [];
        cards.forEach((card, i) => {
          const id = setTimeout(() => {
            hand.push(card);
            dealAnimIndices = new Set([hand.length - 1]);
            if (App.GuideUI) App.GuideUI.discoverCard(card.id);
            // Play audio/draw_card.mp3 3 times consecutively for the 3 initial cards!
            App.Audio.cardDraw();
            if (i === cards.length - 1) {
              anim.dealingCards = false;
              anim.activeStep = null;
              syncUI();
              if (onStateChangeCallback) onStateChangeCallback();
              // Brief pause after 3rd draw_card.mp3 hit before next queued step (rim rotation)
              const finishId = setTimeout(() => {
                startNextQueuedStep();
              }, 380);
              dealTimeouts.push(finishId);
              return;
            }
            syncUI();
            if (onStateChangeCallback) onStateChangeCallback();
          }, 160 + i * 520);
          dealTimeouts.push(id);
        });
        return;
      }
    }
  }

  function enqueueTurnSteps(steps) {
    steps.forEach((s) => {
      if (s) anim.stepQueue.push(s);
    });
    if (!anim.activeStep) {
      startNextQueuedStep();
    }
  }

  function easeOutBack(t) {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function clearDealTimers() {
    dealTimeouts.forEach((id) => clearTimeout(id));
    dealTimeouts = [];
    anim.dealingCards = false;
  }

  function formatClock(minutesFromStart) {
    // 0 min = 12:00 PM (XII), 60 min = 1:00 PM (I), ..., 720 min = 12:00 AM Midnight (XII)
    const totalMins = (12 * 60 + Math.round(minutesFromStart)) % (24 * 60);
    let h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }



  function isMidnightMapOnly() {
    return Boolean(matchStateRef && matchStateRef.setupPhase === "MIDNIGHT");
  }

  function isInputLocked() {
    return (
      anim.introStage !== "DONE" ||
      anim.harvesterRisingNow ||
      anim.dealingCards ||
      anim.rimRotating ||
      anim.drawAnimating ||
      anim.shuffleAnimating ||
      Boolean(pendingDrawnCard) ||
      thiefWheelActive ||
      Boolean(anim.activeStep) ||
      anim.stepQueue.length > 0
    );
  }

  function resetTableMatch(matchState) {
    clearDealTimers();
    clearStepQueue();
    if (App.Audio && App.Audio.stopHumanIntro) App.Audio.stopHumanIntro();
    if (App.Audio && App.Audio.stopRimTurn) App.Audio.stopRimTurn();
    if (App.Audio && App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio && App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    matchStateRef = matchState;

    // ZERO cards in hand before the Table Intro completes!
    hand = [];
    deck = new Array(40).fill(null); // 40-card pedestal shoe counter (exact weighted draws)
    candleTray = [];
    rimPlayedCards = [];
    selectedHandIdx = -1;
    selectedRotation = 0;
    pendingDrawnCard = null;
    hexInterrupted = false;
    turnStep = 1;
    drawPity = { sinceRoom: 0, sinceClue: 0, sinceEvent: 0 };
    uniqueDrawnCardIds = new Set();
    thiefWheelActive = false;
    thiefWheelSpinning = false;
    anim.shuffleAnimating = false;
    document.getElementById("fp-thief-modal")?.classList.add("hidden");
    document.getElementById("fp-shuffle-hand-overlay")?.classList.add("hidden");

    mapZoom = 1.0;
    mapPanX = 0;
    mapPanY = 0;

    // Reset Table Intro, Pawn & Silent Light Flicker animations
    anim.introStage = "WAITING";
    anim.introTimer = 0;
    anim.lastOrbitTickIdx = -1;
    anim.playerRise = 0;
    anim.visualPlayerMinutes = 0;
    anim.harvesterRise = 0;
    anim.harvesterRisingNow = false;
    anim.visualHarvesterMinutes = 0;
    anim.dealingCards = false;
    anim.archFlickerActive = false;
    anim.archFlickerElapsed = 0;
    anim.archFlickerLight = 1.0;

    // Match State:
    // setupPhase: INTRO -> TURN_1_CELLAR -> TURN_2_HARVESTER -> PLAYING | LAST_CHANCE | MIDNIGHT | GAME_OVER
    matchStateRef.setupPhase = "INTRO";
    matchStateRef.tableIntroDone = false;
    matchStateRef.clockMinutes = 0;
    matchStateRef.harvesterCardPlayed = false;
    matchStateRef.harvesterSpawned = false;
    matchStateRef.harvesterMinutes = 0;
    matchStateRef.harvesterDelayTurns = 3;
    matchStateRef.harvesterFrozenTurns = 0;
    matchStateRef.bannedGraveyardWipe = false;
    matchStateRef.neighborEncounter = null;
    matchStateRef.uniqueDrawnCardIds = [];
    matchStateRef.eventCooldownTurns = 0;
    matchStateRef.drawnEventCardIds = [];
    matchStateRef.atticEvent = null;
    anim.rimAngleOffset = 0;
    anim.rimRotating = false;
    anim.rimElapsed = 0;
    anim.rimStartAngle = 0;
    anim.rimTargetAngle = 0;
    anim.rimLastTickIdx = 0;
    if (App.Audio && App.Audio.stopRimTurn) App.Audio.stopRimTurn();

    matchStateRef.turnCount = 0;
    matchStateRef.activeOmen = null;
    matchStateRef.activeOmenId = null;
    matchStateRef.roomsBuilt = 1;
    matchStateRef.rimPlayedCards = rimPlayedCards;
    matchStateRef.rimAngleOffset = 0;
    matchStateRef.archFlickerLight = 1.0;
    matchStateRef.playerSeats = matchStateRef.mode === "MULTIPLAYER" ? [0, 1, 2, 3] : [0];
    matchStateRef.activeSeatIdx = 0;
    matchStateRef.roomLightStates = { "0,0": true };
    matchStateRef.tallManEvent = null;
    matchStateRef.redBalloonsEvent = null;
    if (App.Stalkers && App.Stalkers.cleanup) App.Stalkers.cleanup(matchStateRef);
    matchStateRef.endgame = null;
    if (App.Endgame && App.Endgame.cleanup) App.Endgame.cleanup(matchStateRef);
    if (App.Musical && App.Musical.cleanup) App.Musical.cleanup(matchStateRef);
    if (App.Basement && App.Basement.cleanup) App.Basement.cleanup(matchStateRef);
    if (App.StayLit && App.StayLit.cleanup) App.StayLit.cleanup(matchStateRef);
    if (App.Knight && App.Knight.cleanup) App.Knight.cleanup(matchStateRef);

    // Initialize authentic Cabin Game Clue Manifest (secret Exit Room + 3 clues + room spawns + fake chicken!)
    if (App.Audio && App.Audio.stopGrandfatherClockClue) App.Audio.stopGrandfatherClockClue();
    if (App.Clues) {
      App.Clues.initMatchClues(matchStateRef);
    }
    if (App.Events) {
      App.Events.initMatchEvents(matchStateRef);
    }

    matchStateRef.roomMap = {
      "0,0": {
        x: 0,
        y: 0,
        id: "dining_room",
        glyph: "DR",
        name: "DINING",
        fullName: "THE DINING ROOM",
        shape: "cross",
        rotation: 0,
        doors: { N: true, E: true, S: true, W: true },
        isParlor: true,
        deadEnd: false
      }
    };
  }

  // ==================== TABLE INTRO ANIMATION (11s SYNCED TO audio/human_intro.mp3) ====================
  function beginTableIntro() {
    if (!matchStateRef || matchStateRef.tableIntroDone) return;
    if (anim.introStage !== "WAITING") return;

    anim.introStage = "PLAYER_RISE";
    anim.introTimer = 0;
    anim.playerRise = 0;
    anim.visualPlayerMinutes = 0;
    anim.lastOrbitTickIdx = 0;

    App.Audio.playHumanIntro();
    syncUI();
  }

  function updateAnimations(dt) {
    if (!matchStateRef) return;

    // 1. 11-Second Table Intro synced to audio/human_intro.mp3:
    //    0.0s -> 2.0s  : Player piece rises slowly from underneath XII
    //    2.0s -> 2.4s  : Brief settle beat at XII
    //    2.4s -> 10.3s : Slower, smooth 1 full clockwise lap (7.9s for 12 hours / 48 notches)
    //    10.3s -> 11.0s: Final pause at XII -> deal ONLY Root Cellar -> unlock Turn 1!
    if (anim.introStage !== "DONE" && anim.introStage !== "WAITING") {
      const t = App.Audio.getHumanIntroTime();

      if (t < 2.0) {
        anim.introStage = "PLAYER_RISE";
        const p = Math.max(0, Math.min(1, t / 2.0));
        anim.playerRise = Math.min(1, easeOutBack(p));
        anim.visualPlayerMinutes = 0;
        return;
      }

      if (t < 2.4) {
        anim.playerRise = 1;
        anim.visualPlayerMinutes = 0;
        if (anim.introStage !== "PLAYER_ORBIT") {
          anim.introStage = "PLAYER_ORBIT";
          syncUI();
        }
        return;
      }

      if (t < 10.3) {
        anim.playerRise = 1;
        anim.introStage = "PLAYER_ORBIT";
        const p = Math.max(0, Math.min(1, (t - 2.4) / 7.9));
        // Intro ONLY: glide 1 full lap COUNTER-CLOCKWISE around all 48 notches (XII -> XI -> X -> ... -> XII)!
        const eased = easeInOutCubic(p);
        anim.visualPlayerMinutes = (1 - eased) * CLOCK_TOTAL_MINUTES;

        // Only play synth groove clicks if human_intro.mp3 is missing (so we don't clash with the MP3!)
        if (App.Audio.isHumanIntroUsingFallback()) {
          const tickIdx = Math.floor(eased * 12);
          if (tickIdx > anim.lastOrbitTickIdx && tickIdx <= 12) {
            anim.lastOrbitTickIdx = tickIdx;
            App.Audio.grooveTick();
          }
        }
        return;
      }

      if (t < INTRO_TOTAL_SEC) {
        anim.playerRise = 1;
        anim.visualPlayerMinutes = 0;
        anim.introStage = "DEAL_CELLAR";
        return;
      }

      // 11.0s reached: Intro complete -> Deal ONLY The Cellar with draw_card.mp3 SFX!
      anim.playerRise = 1;
      anim.visualPlayerMinutes = 0;
      anim.introStage = "DONE";
      App.Audio.stopHumanIntro();
      matchStateRef.tableIntroDone = true;
      matchStateRef.setupPhase = "TURN_1_CELLAR";
      matchStateRef.turnCount = 1;

      const cellar = App.CardsDB.getById("bp_cellar");
      hand = [cellar];
      dealAnimIndices = new Set([0]);
      if (App.GuideUI) App.GuideUI.discoverCard(cellar.id);
      App.Audio.cardDraw();
      syncUI();
      if (onStateChangeCallback) onStateChangeCallback();
      return;
    }

    // 2. Sequential Turn Step Runner (Very Slow Notch-by-Notch Player & Harvester Glides!)
    if (anim.activeStep) {
      const st = anim.activeStep;

      if (st.type === "MOVE_PLAYER" || st.type === "MOVE_HARVESTER") {
        st.elapsed += dt;
        const p = Math.max(0, Math.min(1, st.elapsed / Math.max(0.1, st.duration)));
        const eased = easeInOutSine(p);
        const curMin = st.fromMin + (st.toMin - st.fromMin) * eased;

        if (st.type === "MOVE_PLAYER") {
          anim.visualPlayerMinutes = curMin;
          // Live update the clock readout notch-by-notch as the player pawn slowly glides!
          const clockEl = document.getElementById("fp-clock-time");
          if (clockEl) {
            const snapped = Math.round(curMin / 15) * 15;
            clockEl.textContent = formatClock(snapped);
          }
        } else {
          anim.visualHarvesterMinutes = curMin;
        }

        // If human_intro.mp3 is unavailable, click softly on each 15-min notch crossed
        if (App.Audio.isPawnMoveUsingFallback && App.Audio.isPawnMoveUsingFallback()) {
          const curNotch = Math.floor(curMin / 15);
          if (curNotch !== st.lastNotchIdx) {
            st.lastNotchIdx = curNotch;
            App.Audio.grooveTick();
          }
        }

        if (p >= 1) {
          if (st.type === "MOVE_PLAYER") anim.visualPlayerMinutes = st.toMin;
          else anim.visualHarvesterMinutes = st.toMin;
          if (App.Audio && App.Audio.stopPawnMove) App.Audio.stopPawnMove();
          anim.activeStep = null;
          syncUI();
          if (onStateChangeCallback) onStateChangeCallback();
          startNextQueuedStep();
        }
      } else if (st.type === "RISE_HARVESTER") {
        st.elapsed += dt;
        const p = Math.max(0, Math.min(1, st.elapsed / st.duration));
        anim.harvesterRise = p;
        if (p >= 1) {
          anim.harvesterRise = 1;
          anim.harvesterRisingNow = false;
          anim.activeStep = null;
          syncUI();
          startNextQueuedStep();
        }
      }
    } else if (!anim.dealingCards && !anim.rimRotating) {
      // Keep visual minutes aligned when idle
      anim.visualPlayerMinutes = matchStateRef.clockMinutes;
      if (matchStateRef.harvesterSpawned) {
        anim.visualHarvesterMinutes = matchStateRef.harvesterMinutes;
      }
    }

    // 4. Silent Overhead Bulb Flicker whenever a matched Room Card alters cabin architecture (NO SFX)
    if (anim.archFlickerActive) {
      anim.archFlickerElapsed += dt;
      const ft = anim.archFlickerElapsed;
      let lvl = 1.0;
      if (ft < 0.08) lvl = 0.14;
      else if (ft < 0.16) lvl = 0.88;
      else if (ft < 0.27) lvl = 0.05;
      else if (ft < 0.39) lvl = 0.94;
      else if (ft < 0.49) lvl = 0.20;
      else if (ft < 0.62) lvl = 0.84;
      else if (ft < 0.72) lvl = 0.30;
      else if (ft < 1.12) lvl = 0.30 + ((ft - 0.72) / 0.40) * 0.70;
      else {
        lvl = 1.0;
        anim.archFlickerActive = false;
      }
      anim.archFlickerLight = Math.max(0.04, Math.min(1.0, lvl));
      matchStateRef.archFlickerLight = anim.archFlickerLight;

      const veil = document.getElementById("fp-flicker-veil");
      if (veil) {
        const darkness = (1 - anim.archFlickerLight) * 0.82;
        veil.style.opacity = darkness > 0.01 ? darkness.toFixed(3) : "0";
      }
    }

    // 5. Outer Rim Turntable Rotation (Graveyard Pedestal + Played Outer-Rim Cards)
    if (anim.rimRotating) {
      anim.rimElapsed += dt;
      const p = Math.max(0, Math.min(1, anim.rimElapsed / Math.max(0.1, anim.rimDuration)));
      const eased = easeInOutCubic(p);
      anim.rimAngleOffset = anim.rimStartAngle + (anim.rimTargetAngle - anim.rimStartAngle) * eased;
      matchStateRef.rimAngleOffset = anim.rimAngleOffset;

      if (App.Audio.isRimTurnUsingFallback && App.Audio.isRimTurnUsingFallback()) {
        const ticks = Math.floor((eased * (anim.rimTargetAngle - anim.rimStartAngle)) / (Math.PI / 6));
        if (ticks > anim.rimLastTickIdx) {
          anim.rimLastTickIdx = ticks;
          App.Audio.grooveTick();
        }
      }

      updateRimElementsPosition();

      if (p >= 1) {
        anim.rimRotating = false;
        anim.rimAngleOffset = ((anim.rimTargetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        matchStateRef.rimAngleOffset = anim.rimAngleOffset;
        App.Audio.stopRimTurn();
        syncUI();
        if (onStateChangeCallback) onStateChangeCallback();
      }
    }
  }

  // Triggers a purely visual overhead light flicker (NO audio SFX) when a Room Card is matched
  function triggerArchitectureFlicker() {
    anim.archFlickerActive = true;
    anim.archFlickerElapsed = 0;
    anim.archFlickerLight = 0.14;
    if (matchStateRef) matchStateRef.archFlickerLight = 0.14;
  }

  // Smoothly positions the Graveyard Pedestal & all Played Outer-Rim Cards along the rotating outer rim
  function updateRimElementsPosition() {
    const g = App.TableCanvas.GEO;
    const rimOff = anim.rimAngleOffset || 0;

    // 1. Position 3D Pixel-Art Graveyard Pedestal locked flush onto the rotating outer wooden rim
    const pedEl = document.getElementById("fp-pedestal-box");
    if (pedEl) {
      const pedAng = Math.PI / 2 + rimOff;
      const pxPct = ((g.cx + Math.cos(pedAng) * g.cardRingRx) / g.W) * 100;
      const pyPct = ((g.cy + Math.sin(pedAng) * g.cardRingRy) / g.H) * 100;
      const depthNorm = (Math.sin(pedAng) + 1) * 0.5;
      const depthScale = 0.82 + 0.18 * depthNorm;
      const tiltDeg = (rimOff * 180) / Math.PI;
      pedEl.style.left = `${pxPct.toFixed(3)}%`;
      pedEl.style.top = `${pyPct.toFixed(3)}%`;
      pedEl.style.transform =
        `translate(-50%, -50%) perspective(360px) rotateX(16deg) rotateZ(${tiltDeg.toFixed(2)}deg) scale(${depthScale.toFixed(3)})`;
    }

    // 2. Position every played outer-rim card riding on the exact same rotating turntable!
    const rimEl = document.getElementById("fp-rim-cards");
    if (rimEl && rimPlayedCards.length > 0) {
      const cardEls = rimEl.children;
      const startAngle = Math.PI * 0.40 + rimOff;
      const maxArc = Math.PI * 1.38;
      const baseStep = 0.145;
      const stepAng =
        rimPlayedCards.length > 1
          ? Math.min(baseStep, maxArc / Math.max(1, rimPlayedCards.length - 1))
          : baseStep;

      for (let idx = 0; idx < cardEls.length; idx++) {
        const ang = startAngle - idx * stepAng;
        const xPct = ((g.cx + Math.cos(ang) * g.cardRingRx) / g.W) * 100;
        const yPct = ((g.cy + Math.sin(ang) * g.cardRingRy) / g.H) * 100;
        const deg = (ang * 180) / Math.PI - 90;
        const el = cardEls[idx];
        el.style.left = `${xPct.toFixed(3)}%`;
        el.style.top = `${yPct.toFixed(3)}%`;
        el.style.transform = `translate(-50%, -50%) perspective(420px) rotateX(24deg) rotateZ(${deg.toFixed(1)}deg)`;
      }
    }
  }

  // Starts the outer-rim turntable rotation every turn!
  // - Singleplayer (1 player): rotates 1 FULL 360° lap, duration EQUAL to human_intro.mp3 (11s)
  // - Multiplayer (2-4 players): rotates directly to target player's seat center, SHORTER proportional duration!
  function startRimTurnRotation(forcedRandomSeat) {
    if (!matchStateRef) return;
    const seats = matchStateRef.playerSeats && matchStateRef.playerSeats.length ? matchStateRef.playerSeats : [0];
    const isSingleplayer = seats.length <= 1;
    // Shortened rim SFX: uses ONLY 4.0s -> 11.0s (7.0s) of human_intro.mp3 for SP, and shorter for MP!
    const fullDur = App.Audio.getRimClipDuration ? App.Audio.getRimClipDuration() : 7.0;

    const currentNorm = ((anim.rimAngleOffset % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let deltaRad = Math.PI * 2;

    if (isSingleplayer) {
      // Singleplayer: exact 1 full clockwise revolution back to 6 o'clock (duration = human_intro.mp3)
      deltaRad = Math.PI * 2;
      matchStateRef.activeSeatIdx = 0;
    } else {
      // Multiplayer: advance to next seat (or random seat on Shifting Seat card)
      let nextIdx = (matchStateRef.activeSeatIdx + 1) % seats.length;
      if (forcedRandomSeat && seats.length > 1) {
        const others = seats.map((_, i) => i).filter((i) => i !== matchStateRef.activeSeatIdx);
        nextIdx = others[Math.floor(Math.random() * others.length)];
      }
      matchStateRef.activeSeatIdx = nextIdx;
      const targetSeatId = seats[nextIdx] || 0;
      const targetAngle = SEAT_ANGLES[targetSeatId % SEAT_ANGLES.length] || 0;
      deltaRad = ((targetAngle - currentNorm) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (deltaRad < 0.05) deltaRad = Math.PI * 2;
      matchStateRef.seatLabel = `SEAT ${targetSeatId + 1}`;
    }

    const durationSec = isSingleplayer
      ? fullDur
      : Math.max(1.75, fullDur * (deltaRad / (Math.PI * 2)));

    anim.rimRotating = true;
    anim.rimElapsed = 0;
    anim.rimDuration = durationSec;
    anim.rimStartAngle = currentNorm;
    anim.rimTargetAngle = currentNorm + deltaRad;
    anim.rimLastTickIdx = 0;

    App.Audio.playRimTurn(durationSec);
    syncUI();
  }

  function triggerHarvesterEmergence() {
    matchStateRef.harvesterSpawned = true;
    matchStateRef.harvesterMinutes = 0; // Exact player spawn point (XII / 12:00 PM)!
    anim.visualHarvesterMinutes = 0;
    anim.harvesterRise = 0.01;
    anim.harvesterRisingNow = true;

    App.Audio.harvesterRise();
  }

  // ==================== ROOM DIRECTIONAL DOOR-MATCHING LOGIC ====================
  const DIR_DELTAS = [
    { dir: "N", opp: "S", dx: 0,  dy: -1 },
    { dir: "E", opp: "W", dx: 1,  dy: 0  },
    { dir: "S", opp: "N", dx: 0,  dy: 1  },
    { dir: "W", opp: "E", dx: -1, dy: 0  }
  ];

  function getActivePlacingRoomCard() {
    if (!matchStateRef || isInputLocked()) return null;
    if (matchStateRef.setupPhase === "TURN_1_CELLAR") {
      return App.CardsDB.getById("bp_cellar");
    }
    if (
      (matchStateRef.setupPhase === "PLAYING" || matchStateRef.setupPhase === "LAST_CHANCE") &&
      turnStep === 2 &&
      selectedHandIdx >= 0 &&
      hand[selectedHandIdx] &&
      hand[selectedHandIdx].type === "BLUEPRINT"
    ) {
      return hand[selectedHandIdx];
    }
    return null;
  }

  // Checks if placing `card` with `rotationSteps` at `(x, y)` cleanly matches open doors
  function canPlaceRoomWithRotation(card, x, y, rotationSteps) {
    const map = matchStateRef.roomMap;
    if (map[keyOf(x, y)]) return false;
    if (Math.abs(x) + Math.abs(y) > MAX_ROOM_DISTANCE) return false;

    const newDoors = App.CardsDB.getRotatedDoors(card.meta?.shape || "dead_end", rotationSteps);
    let connectedOpenDoor = false;
    let connectedToParlor = false;

    for (const d of DIR_DELTAS) {
      const nb = map[keyOf(x + d.dx, y + d.dy)];
      if (!nb) continue;
      const nbDoors = nb.doors || { N: true, E: true, S: true, W: true };
      const nbHasDoorToUs = Boolean(nbDoors[d.opp]);
      const weHaveDoorToNb = Boolean(newDoors[d.dir]);

      // New room's open door MUST NOT slam into an existing room's solid wall
      if (weHaveDoorToNb && !nbHasDoorToUs) return false;

      if (weHaveDoorToNb && nbHasDoorToUs) {
        connectedOpenDoor = true;
        if (nb.isParlor) connectedToParlor = true;
      }
    }

    if (card.id === "bp_cellar") return connectedToParlor;
    return connectedOpenDoor;
  }

  function findValidRotationsForSlot(card, x, y) {
    const valid = [];
    for (let r = 0; r < 4; r++) {
      if (canPlaceRoomWithRotation(card, x, y, r)) valid.push(r);
    }
    return valid;
  }

  // Returns candidate open slots adjacent to any existing open doorway (within MAX_ROOM_DISTANCE)
  function getCandidateRoomSlots(card) {
    const map = matchStateRef.roomMap;
    const slots = new Map();

    Object.values(map).forEach((room) => {
      if (card.id === "bp_cellar" && !room.isParlor) return;
      const rDoors = room.doors || { N: true, E: true, S: true, W: true };

      DIR_DELTAS.forEach((d) => {
        if (!rDoors[d.dir]) return; // Only expand through actual open doorways!
        const nx = room.x + d.dx;
        const ny = room.y + d.dy;
        const dist = Math.abs(nx) + Math.abs(ny);
        if (dist > MAX_ROOM_DISTANCE) return;
        const k = keyOf(nx, ny);
        if (map[k] || slots.has(k)) return;

        const validRots = findValidRotationsForSlot(card, nx, ny);
        if (validRots.length > 0) {
          slots.set(k, {
            x: nx,
            y: ny,
            dist,
            validRots,
            matchesCurrent: validRots.includes(selectedRotation)
          });
        }
      });
    });

    return slots;
  }

  function rotateSelectedRoom(delta) {
    const placingCard = getActivePlacingRoomCard();
    if (!placingCard) return;
    selectedRotation = (selectedRotation + (delta || 1) + 4) % 4;
    App.Audio.click();
    syncUI();
  }

  // ==================== 1. RENDER CENTER WOODEN ROOM CARDS (WITH REAL WALLS & DOORS) ====================
  function renderCabinMap() {
    const stageEl = document.getElementById("fp-map-canvas-inner");
    const countEl = document.getElementById("fp-map-count");
    if (!stageEl || !matchStateRef) return;
    stageEl.innerHTML = "";

    const map = matchStateRef.roomMap;
    const rooms = Object.values(map);
    if (countEl) countEl.textContent = `${rooms.length} ROOM${rooms.length > 1 ? "S" : ""}`;

    const placingCard = getActivePlacingRoomCard();
    const placeable = placingCard ? getCandidateRoomSlots(placingCard) : new Map();

    const tileW = 46;
    const tileH = 46;
    const stepX = tileW + 2;
    const stepY = tileH + 2;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    rooms.forEach((r) => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y);
    });
    placeable.forEach((s) => {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    });

    const spanCols = Math.max(3, maxX - minX + 1);
    const spanRows = Math.max(3, maxY - minY + 1);
    const autoScale = Math.min(1.0, 250 / (spanCols * stepX), 156 / (spanRows * stepY));
    const finalScale = Math.max(0.34, Math.min(1.38, autoScale * mapZoom));

    const centerOffsetX = ((minX + maxX) / 2) * stepX;
    const centerOffsetY = ((minY + maxY) / 2) * stepY;

    stageEl.style.transform =
      `translate(calc(-50% + ${mapPanX}px), calc(-50% + ${mapPanY}px)) scale(${finalScale})`;

    // 1. Render placed parchment Room Cards with real doorway openings on their 4 sides
    rooms.forEach((r) => {
      const doors = r.doors || { N: true, E: true, S: true, W: true };
      const tile = document.createElement("div");
      tile.className =
        "fp-wood-room-card" +
        (r.isParlor ? " is-parlor" : "") +
        (r.id === "bp_cellar" ? " is-cellar" : "") +
        (doors.N ? " door-n" : "") +
        (doors.E ? " door-e" : "") +
        (doors.S ? " door-s" : "") +
        (doors.W ? " door-w" : "");
      tile.style.left = `${r.x * stepX - centerOffsetX}px`;
      tile.style.top = `${r.y * stepY - centerOffsetY}px`;
      tile.title = `${r.fullName || r.name} (${r.x}, ${r.y})${r.id === "bp_cellar" ? " — Event Respawn Room" : ""}`;

      // Visual doorway cutouts + directional notch bars on each open side
      const doorMarks =
        (doors.N ? `<span class="tile-door-gap gap-n"></span>` : "") +
        (doors.E ? `<span class="tile-door-gap gap-e"></span>` : "") +
        (doors.S ? `<span class="tile-door-gap gap-s"></span>` : "") +
        (doors.W ? `<span class="tile-door-gap gap-w"></span>` : "");

      tile.innerHTML = `
        ${doorMarks}
        <span class="fp-parch-glyph">${r.glyph}</span>
        <span class="fp-parch-name">${r.name}</span>
      `;
      stageEl.appendChild(tile);
    });

    // 2. Render interactive placeable slots (bright green/gold when rotation matches, softer amber if needs [R])
    placeable.forEach((slot) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const previewRot = slot.matchesCurrent ? selectedRotation : slot.validRots[0];
      const previewDoors = App.CardsDB.getRotatedDoors(placingCard.meta?.shape || "dead_end", previewRot);

      btn.className =
        "fp-wood-room-slot" +
        (slot.matchesCurrent ? " slot-matched" : " slot-needs-rotate") +
        (placingCard.id === "bp_cellar" ? " is-cellar-slot" : "");
      btn.style.left = `${slot.x * stepX - centerOffsetX}px`;
      btn.style.top = `${slot.y * stepY - centerOffsetY}px`;
      btn.title = slot.matchesCurrent
        ? `Matched! Click to place ${placingCard.name} here (Dist ${slot.dist}/${MAX_ROOM_DISTANCE})`
        : `Click or press [R] to rotate ${placingCard.name} to match this doorway`;

      btn.innerHTML = slot.matchesCurrent
        ? App.CardsDB.buildRoomDirectionSVG(previewDoors, "+", {
            compact: true,
            ghost: true,
            arrowColor: "#7be89b"
          })
        : `<span class="fp-slot-plus">↻</span><span class="fp-slot-mini">ROT [R]</span>`;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (panMoved || isInputLocked()) return;

        // If current rotation doesn't match this doorway, auto-rotate to match so player can verify & place!
        if (!slot.matchesCurrent) {
          selectedRotation = slot.validRots[0];
          App.Audio.click();
          syncUI();
          return;
        }

        if (matchStateRef.setupPhase === "TURN_1_CELLAR") {
          placeTurn1CellarAt(slot.x, slot.y, selectedRotation);
        } else {
          playBlueprintAtCoord(slot.x, slot.y, selectedRotation);
        }
      });
      stageEl.appendChild(btn);
    });
  }

  // ==================== 2. RENDER CURVED OUTER-RIM PLAYED CARDS ====================
  function renderOuterRimCards() {
    const rimEl = document.getElementById("fp-rim-cards");
    const tooltip = document.getElementById("fp-rim-tooltip");
    if (!rimEl) return;
    rimEl.innerHTML = "";

    const g = App.TableCanvas.GEO;
    const startAngle = Math.PI * 0.40;
    const maxArc = Math.PI * 1.38;
    const baseStep = 0.145;
    const stepAng =
      rimPlayedCards.length > 1
        ? Math.min(baseStep, maxArc / Math.max(1, rimPlayedCards.length - 1))
        : baseStep;

    rimPlayedCards.forEach((card, idx) => {
      const ang = startAngle - idx * stepAng;
      const xPct = ((g.cx + Math.cos(ang) * g.cardRingRx) / g.W) * 100;
      const yPct = ((g.cy + Math.sin(ang) * g.cardRingRy) / g.H) * 100;
      const deg = (ang * 180) / Math.PI - 90;
      const typeInfo = App.CardsDB.CARD_TYPES[card.type] || { label: card.type };

      const el = document.createElement("div");
      el.className = `fp-rim-card type-${card.type}`;
      el.style.left = `${xPct}%`;
      el.style.top = `${yPct}%`;
      el.style.transform = `translate(-50%, -50%) perspective(420px) rotateX(24deg) rotateZ(${deg.toFixed(1)}deg)`;
      el.innerHTML = `
        <span class="fp-rim-title">${card.name}</span>
        <span class="fp-rim-glyph">${card.glyph}</span>
        <span class="fp-rim-type">${typeInfo.label}</span>
      `;

      el.addEventListener("pointerenter", () => {
        if (!tooltip) return;
        tooltip.innerHTML = `
          <strong>${card.name}</strong> <span class="fp-tt-tag">${typeInfo.label}</span>
          <p>${card.effect}</p>
        `;
        tooltip.classList.remove("hidden");
      });
      el.addEventListener("pointerleave", () => {
        if (tooltip) tooltip.classList.add("hidden");
      });

      rimEl.appendChild(el);
    });
    updateRimElementsPosition();
  }

  // ==================== 3. RENDER 6 O'CLOCK WOODEN PEDESTAL ====================
  function renderPedestal() {
    const phase = matchStateRef.setupPhase;
    const mapOnly = isMidnightMapOnly();
    const locked = isInputLocked() || mapOnly;
    const canDrawNormal = !locked && (phase === "PLAYING" || phase === "LAST_CHANCE") && turnStep === 1;
    const canDrawTurn2 = !locked && phase === "TURN_2_HARVESTER" && turnStep === 1;
    const canDraw = canDrawNormal || canDrawTurn2;

    const plaque = document.getElementById("fp-pedestal-plaque");
    const deckBtn = document.getElementById("fp-deck-btn");
    const deckCount = document.getElementById("fp-deck-count");
    const trayBtn = document.getElementById("fp-tray-btn");
    const trayPrev = document.getElementById("fp-tray-preview");
    const harvBtn = document.getElementById("fp-harvester-groove-btn");

    if (plaque) {
      if (anim.introStage !== "DONE") plaque.textContent = "The Game Begins...";
      else if (anim.activeStep && anim.activeStep.type === "MOVE_PLAYER") plaque.textContent = "Moving Piece...";
      else if (anim.activeStep && anim.activeStep.type === "MOVE_HARVESTER") plaque.textContent = "Harvester Moving...";
      else if (anim.dealingCards) plaque.textContent = "Dealing 3 Cards...";
      else if (anim.rimRotating) plaque.textContent = "Turning Table...";
      else if (anim.harvesterRisingNow) plaque.textContent = "IT HAS ARRIVED";
      else if (phase === "TURN_1_CELLAR") plaque.textContent = "Place The Cellar";
      else if (phase === "TURN_2_HARVESTER") plaque.textContent = turnStep === 1 ? "Draw Turn 2 Card" : "Play Harvester";
      else if (phase === "LAST_CHANCE") plaque.textContent = "LAST CHANCE!";
      else if (phase === "MIDNIGHT") plaque.textContent = "12:00 AM - MAP ONLY";
      else if (phase === "GAME_OVER") plaque.textContent = "Turn Ended";
      else plaque.textContent = turnStep === 1 ? "It is Your Turn" : "Play a Card";
    }

    if (deckCount) {
      deckCount.textContent = mapOnly
        ? "GAME ENDED"
        : canDrawTurn2
          ? "DRAW HARVESTER"
          : `DRAW (${deck.length})`;
    }
    if (deckBtn) {
      deckBtn.classList.toggle("draw-ready", canDraw);
      deckBtn.classList.toggle("draw-dim", !canDraw);
    }

    if (trayBtn) trayBtn.classList.toggle("tray-ready", canDrawNormal && candleTray.length > 0);
    if (trayPrev) {
      const topOmen = candleTray.length ? candleTray[candleTray.length - 1] : null;
      trayPrev.classList.toggle("has-active-clue", Boolean(topOmen));
      if (topOmen) {
        trayPrev.innerHTML = `
          <span class="fp-ped-card-title">${topOmen.name}</span>
          <span class="fp-ped-card-glyph">${topOmen.glyph}</span>
          <span class="fp-ped-card-sub">ACTIVE CLUE (${candleTray.length})</span>
        `;
      } else {
        trayPrev.innerHTML = `<span class="fp-pedestal-empty">GRAVEYARD</span>`;
      }
    }

    // Show clickable groove prompt ONLY when Turn 2 Harvester is drawn & ready to be placed down
    if (harvBtn) {
      const showHarvBtn = !locked && phase === "TURN_2_HARVESTER" && turnStep === 2;
      harvBtn.classList.toggle("hidden", !showHarvBtn);
    }
    updateRimElementsPosition();
  }

  // ==================== 4. RENDER FANNED VINTAGE PARCHMENT HAND (DOUBLE-CLICK TO PLAY) ====================
  function canCardPlayImmediately(card) {
    if (!card || !matchStateRef || isInputLocked()) return false;
    const phase = matchStateRef.setupPhase;
    if (phase === "TURN_2_HARVESTER" && turnStep === 2 && card.id === "hx_harvester") {
      return true;
    }
    if ((phase === "PLAYING" || phase === "LAST_CHANCE") && turnStep === 2 && card.type !== "BLUEPRINT") {
      return true;
    }
    return false;
  }

  function updateHandSelectionVisuals() {
    const bar = document.getElementById("fp-hand-cards");
    if (!bar) return;
    const phase = matchStateRef.setupPhase;
    const locked = isInputLocked() || phase === "GAME_OVER";
    const buttons = bar.querySelectorAll(".fp-parchment-hand-card");

    buttons.forEach((btn, idx) => {
      const card = hand[idx];
      if (!card) return;
      const isForcedCellar = phase === "TURN_1_CELLAR" && card.id === "bp_cellar";
      const isTurn2OtherLocked = phase === "TURN_2_HARVESTER" && card.id !== "hx_harvester";
      const isSelected = isForcedCellar || (!locked && !isTurn2OtherLocked && idx === selectedHandIdx);
      btn.classList.toggle("selected", isSelected);
    });

    const rotateKeyPrompt = document.getElementById("fp-key-rotate-btn");
    if (rotateKeyPrompt) {
      rotateKeyPrompt.classList.toggle("hidden", !getActivePlacingRoomCard());
    }
  }

  function renderHandAndPrompt() {
    const bar = document.getElementById("fp-hand-cards");
    if (!bar) return;

    bar.innerHTML = "";
    const phase = matchStateRef.setupPhase;
    const mapOnly = isMidnightMapOnly();
    const locked = isInputLocked() || phase === "GAME_OVER" || mapOnly;

    const drawKeyPrompt = document.getElementById("fp-key-draw-btn");
    if (drawKeyPrompt) {
      drawKeyPrompt.classList.toggle("hidden", mapOnly);
    }

    if (mapOnly) {
      const rotateKeyPrompt = document.getElementById("fp-key-rotate-btn");
      if (rotateKeyPrompt) rotateKeyPrompt.classList.add("hidden");
      return;
    }

    const total = hand.length;
    const mid = (total - 1) / 2;

    hand.forEach((card, idx) => {
      const typeInfo = App.CardsDB.CARD_TYPES[card.type] || { label: card.type };
      const isForcedCellar = phase === "TURN_1_CELLAR" && card.id === "bp_cellar";
      const isForcedHarv = phase === "TURN_2_HARVESTER" && turnStep === 2 && card.id === "hx_harvester";
      const isTurn2OtherLocked = phase === "TURN_2_HARVESTER" && card.id !== "hx_harvester";
      const isImmediatePlayable = canCardPlayImmediately(card);

      // Turn 1 Cellar stays active so its 4 Dining Room slots show immediately;
      // Turn 2 Harvester & all other immediate cards require 2 consecutive clicks (1st select, 2nd play)!
      const isSelected =
        isForcedCellar ||
        (!locked && !isTurn2OtherLocked && idx === selectedHandIdx);

      const offset = idx - mid;
      const fanRot = total > 1 ? offset * 7.5 : 0;
      const fanY = total > 1 ? Math.abs(offset) * 7 : 0;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        `fp-parchment-hand-card type-${card.type}` +
        (isSelected ? " selected" : "") +
        (isForcedCellar || isForcedHarv ? " mandatory-active" : "") +
        (locked || isTurn2OtherLocked ? " card-locked" : "") +
        (dealAnimIndices.has(idx) ? " card-just-dealt" : "");
      btn.style.setProperty("--fan-rot", `${fanRot}deg`);
      btn.style.setProperty("--fan-y", `${fanY}px`);

      if (isImmediatePlayable) {
        btn.title = "Click twice (double-click) to play";
      }

      const topBanner = isForcedCellar
        ? `<span class="fp-parch-forced">TURN 1</span>`
        : isForcedHarv
          ? `<span class="fp-parch-forced">TURN 2</span>`
          : `<span class="fp-parch-type">${typeInfo.label}</span>`;

      if (card.type === "BLUEPRINT" && card.meta && card.meta.shape) {
        const cardRot = isSelected ? selectedRotation : 0;
        const cardDoors = App.CardsDB.getRotatedDoors(card.meta.shape, cardRot);
        const shapeInfo = App.CardsDB.ROOM_SHAPES[card.meta.shape];
        const shapeLbl = shapeInfo ? `${shapeInfo.label} • ${shapeInfo.doorsCount}D` : "";
        btn.classList.add("is-room-hand-card");
        btn.innerHTML = `
          <div class="fp-parch-inner">
            ${topBanner}
            <span class="fp-parch-title">${card.name}</span>
            <div class="fp-room-dir-wrap">
              ${App.CardsDB.buildRoomDirectionSVG(cardDoors, card.glyph, { compact: true })}
            </div>
            <span class="fp-parch-shape-tag">${shapeLbl}${isSelected && cardRot > 0 ? ` (${cardRot * 90}°)` : ""}</span>
          </div>
        `;
      } else {
        btn.innerHTML = `
          <div class="fp-parch-inner">
            ${topBanner}
            <span class="fp-parch-title">${card.name}</span>
            <span class="fp-parch-emblem">${card.glyph}</span>
            <span class="fp-parch-desc">${card.shortEffect || ""}</span>
          </div>
        `;
      }

      btn.addEventListener("click", () => {
        if (locked) return;
        if (isForcedCellar) return;
        if (isTurn2OtherLocked) {
          App.Audio.close();
          return;
        }

        // 2nd consecutive click / double-click on an immediately playable card -> PLAY IT!
        if (selectedHandIdx === idx) {
          if (canCardPlayImmediately(card)) {
            if (isForcedHarv) {
              playTurn2Harvester();
            } else {
              confirmPlaySelected();
            }
            return;
          }
          // Non-immediate cards (Room cards or Step 1): clicking again deselects cleanly
          const wasRoom = card.type === "BLUEPRINT";
          selectedHandIdx = -1;
          selectedRotation = 0;
          App.Audio.click();
          if (wasRoom) syncUI();
          else updateHandSelectionVisuals();
          return;
        }

        // 1st click: select & raise card (preserve DOM element for immediate playable cards so fast dblclick always lands!)
        const prevCard = selectedHandIdx >= 0 ? hand[selectedHandIdx] : null;
        selectedHandIdx = idx;
        selectedRotation = 0;
        App.Audio.click();

        if (card.type === "BLUEPRINT" || (prevCard && prevCard.type === "BLUEPRINT")) {
          syncUI();
        } else {
          updateHandSelectionVisuals();
        }
      });

      bar.appendChild(btn);
    });

    // Clear one-shot deal animations so subsequent clicks never re-trigger slide-in
    dealAnimIndices.clear();

    // Update [R] ROTATE 90° shortcut visibility in bottom-right corner
    const rotateKeyPrompt = document.getElementById("fp-key-rotate-btn");
    if (rotateKeyPrompt) {
      rotateKeyPrompt.classList.toggle("hidden", locked || !getActivePlacingRoomCard());
    }
  }

  function syncUI() {
    if (!matchStateRef) return;
    const ch = App.Config.state.character;
    const phase = matchStateRef.setupPhase;

    const stepTag = document.getElementById("fp-step-tag");
    const stepDesc = document.getElementById("fp-step-desc");
    const clockEl = document.getElementById("fp-clock-time");
    const harvEl = document.getElementById("fp-harv-text");
    const pName = document.getElementById("fp-player-name");
    const seatLabel = document.getElementById("fp-seat-label");
    const gameOverModal = document.getElementById("fp-gameover-modal");

    if (anim.introStage !== "DONE") {
      stepTag.textContent = "INTRO";
      stepDesc.textContent =
        anim.introStage === "PLAYER_RISE"
          ? "Your piece rises from beneath the table..."
          : "Completing the opening circuit around the clock track...";
    } else if (anim.activeStep && anim.activeStep.type === "MOVE_PLAYER") {
      stepTag.textContent = "ADVANCING";
      stepDesc.textContent = "Your piece glides slowly along the carved clock groove...";
    } else if (anim.activeStep && anim.activeStep.type === "MOVE_HARVESTER") {
      stepTag.textContent = "HARVESTER";
      stepDesc.textContent = "The Hollow Harvester glides slowly along the clock groove...";
    } else if (anim.dealingCards) {
      stepTag.textContent = "DEALING";
      stepDesc.textContent = "Drawing your 3 starting cards from the pedestal...";
    } else if (anim.rimRotating) {
      stepTag.textContent = "TURNING";
      stepDesc.textContent = "Rotating the table rim to the next turn...";
    } else if (anim.harvesterRisingNow) {
      stepTag.textContent = "AWAKENED!";
      stepDesc.textContent = "The Hollow Harvester rises out of the carved groove at XII!";
    } else if (phase === "TURN_1_CELLAR") {
      stepTag.textContent = "TURN 1";
      stepDesc.textContent = "Place The Cellar adjacent to Main Parlor (3 cards dealt after)";
    } else if (phase === "TURN_2_HARVESTER") {
      stepTag.textContent = `TURN 2 • STEP ${turnStep}/2`;
      stepDesc.textContent =
        turnStep === 1
          ? "Draw the guaranteed Hollow Harvester card from the pedestal"
          : "Lay down The Hollow Harvester (spawns at XII after 3 turns)";
    } else if (phase === "LAST_CHANCE") {
      stepTag.textContent = "LAST CHANCE!";
      stepDesc.textContent = "Harvester caught you! Play Progress or Ward this turn or lose!";
    } else if (phase === "MIDNIGHT") {
      const eg = matchStateRef.endgame;
      const secs = eg && eg.stage === "CHOOSE_20S" ? Math.max(0, Math.ceil(eg.countdown || 0)) : null;
      stepTag.textContent = secs !== null ? `12:00 AM • ${secs}S` : "12:00 AM • MAP";
      stepDesc.textContent = "Map View Only — Check your room layout (drag/scroll), then Stand Up [E] & head to the Exit Room!";
    } else if (phase === "GAME_OVER") {
      stepTag.textContent = "CAUGHT";
      stepDesc.textContent = "The Hollow Harvester claimed the table";
    } else {
      stepTag.textContent = `TURN ${matchStateRef.turnCount} • STEP ${turnStep}/2`;
      stepDesc.textContent =
        turnStep === 1
          ? "Draw from Pedestal [D] or reclaim a Graveyard Clue [G]"
          : "Double-click a card to play, or place a Room on the table";
    }

    if (stepTag) {
      stepTag.classList.toggle(
        "tag-danger",
        phase === "LAST_CHANCE" || phase === "MIDNIGHT" || phase === "GAME_OVER" || anim.harvesterRisingNow
      );
    }
    if (clockEl) clockEl.textContent = formatClock(anim.activeStep && anim.activeStep.type === 'MOVE_PLAYER' ? Math.round(anim.visualPlayerMinutes / 15) * 15 : matchStateRef.clockMinutes);
    if (harvEl) {
      if (!matchStateRef.harvesterCardPlayed) {
        harvEl.textContent = "HARVESTER: NOT DRAWN";
      } else if (!matchStateRef.harvesterSpawned) {
        harvEl.textContent = `SPAWNS IN: ${matchStateRef.harvesterDelayTurns}T`;
      } else {
        const gapMin = matchStateRef.clockMinutes - matchStateRef.harvesterMinutes;
        const frz = matchStateRef.harvesterFrozenTurns || 0;
        harvEl.textContent = frz > 0
          ? `HARVESTER: DELAYED ${frz}T`
          : gapMin <= 0
            ? "HARVESTER: CAUGHT UP!"
            : `HARVESTER: -${gapMin}M`;
      }
    }

    if (pName) pName.textContent = (ch.name || "SURVIVOR").toUpperCase();
    if (seatLabel && matchStateRef.seatLabel) seatLabel.textContent = matchStateRef.seatLabel;
    if (gameOverModal) gameOverModal.classList.toggle("hidden", phase !== "GAME_OVER");

    renderCabinMap();
    renderOuterRimCards();
    renderPedestal();
    renderHandAndPrompt();
  }

  // ==================== TURN 1: PLACE CELLAR -> DEAL 3 RANDOM CARDS ====================
  function placeTurn1CellarAt(x, y, rotationSteps) {
    if (matchStateRef.setupPhase !== "TURN_1_CELLAR") return;
    const cellar = App.CardsDB.getById("bp_cellar");
    const rot = rotationSteps || 0;
    const doors = App.CardsDB.getRotatedDoors(cellar.meta.shape, rot);

    hand = hand.filter((c) => c.id !== "bp_cellar");
    matchStateRef.roomMap[keyOf(x, y)] = {
      x,
      y,
      id: cellar.id,
      glyph: cellar.glyph,
      name: cellar.shortName,
      fullName: cellar.name,
      shape: cellar.meta.shape,
      rotation: rot,
      doors,
      isParlor: false,
      deadEnd: true
    };
    matchStateRef.roomLightStates = matchStateRef.roomLightStates || { "0,0": true };
    matchStateRef.roomLightStates[keyOf(x, y)] = true;
    matchStateRef.roomsBuilt = Object.keys(matchStateRef.roomMap).length;
    selectedRotation = 0;

    // Player pawn glides slowly +15 minutes after Turn 1, then deals 3 cards with 3x draw_card.mp3!
    const startMin = anim.visualPlayerMinutes;
    matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + PASSIVE_PLAYER_STEP_MIN);
    matchStateRef.turnCount = 2;
    matchStateRef.setupPhase = "TURN_2_HARVESTER";
    turnStep = 1;

    // Unlock all draw_card.mp3 audio slots inside this direct click gesture so all 3 starter cards play cleanly!
    if (App.Audio.warmUpDrawCard) App.Audio.warmUpDrawCard();

    // Silent overhead bulb flicker signals the cabin architecture physically shifted! (NO extra SFX)
    triggerArchitectureFlicker();
    App.Audio.cardPlay();

    const starter3 = App.CardsDB.buildStartingHand(
      3,
      Object.values(matchStateRef.roomMap || {}).map((r) => r.id),
      [],
      drawPity,
      uniqueDrawnCardIds
    );
    starter3.forEach(recordUniqueCardIfNeeded);
    enqueueTurnSteps([
      { type: "MOVE_PLAYER", fromMin: startMin, toMin: matchStateRef.clockMinutes },
      { type: "DEAL_STARTER_3", cards: starter3 },
      { type: "CALLBACK", fn: () => startRimTurnRotation(false) }
    ]);
    if (onStateChangeCallback) onStateChangeCallback();
  }

  // ==================== TURN 2: PLAY GUARANTEED HARVESTER CARD ====================
  function playTurn2Harvester() {
    if (matchStateRef.setupPhase !== "TURN_2_HARVESTER" || turnStep !== 2) return;
    const hIdx = hand.findIndex((c) => c.id === "hx_harvester");
    const harvCard = hIdx >= 0 ? hand.splice(hIdx, 1)[0] : App.CardsDB.getById("hx_harvester");

    rimPlayedCards.push(harvCard);
    matchStateRef.harvesterCardPlayed = true;
    matchStateRef.harvesterSpawned = false;
    matchStateRef.harvesterDelayTurns = 3; // Harvester rises at XII after 3 turns!

    // Complete Turn 2: Player pawn glides slowly +15 min (now at 12:30 PM), then rim turns!
    const startMin = anim.visualPlayerMinutes;
    matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + PASSIVE_PLAYER_STEP_MIN);
    matchStateRef.turnCount = 3;
    matchStateRef.setupPhase = "PLAYING";
    turnStep = 1;
    selectedHandIdx = -1;

    App.Audio.hexAlert();
    enqueueTurnSteps([
      { type: "MOVE_PLAYER", fromMin: startMin, toMin: matchStateRef.clockMinutes },
      { type: "CALLBACK", fn: () => startRimTurnRotation(false) }
    ]);
    if (onStateChangeCallback) onStateChangeCallback();
  }

  // ==================== END-OF-TURN RESOLUTION (SLOW GLIDE QUEUE FOR PLAYER & HARVESTER) ====================
  function resolveEndOfTurn(wasInterruptedByHex, playedEscapeCard, turnOpts) {
    const opts = typeof turnOpts === "object" && turnOpts !== null
      ? turnOpts
      : { forcedRandomSeat: Boolean(turnOpts) };
    const forcedRandomSeat = Boolean(opts.forcedRandomSeat);
    const freezeHarvester = Boolean(opts.freezeHarvester);
    const skipPassiveStep = Boolean(opts.skipPassiveStep);

    const startPlayerMin = anim.visualPlayerMinutes;
    const startHarvMin = anim.visualHarvesterMinutes;
    const steps = [];

    selectedHandIdx = -1;
    turnStep = 1;

    // 1. Passive +15 min player pawn movement on normal non-Progress turns
    //    (Progress +30m/+60m cards move the player exact +30m/+60m instead of stacking +15m;
    //     during LAST_CHANCE you are pinned — must play Progress or Ward to escape!)
    if (matchStateRef.setupPhase === "PLAYING" && !wasInterruptedByHex && !skipPassiveStep) {
      matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + PASSIVE_PLAYER_STEP_MIN);
    }

    const endPlayerMin = Math.max(0, Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes));
    matchStateRef.clockMinutes = endPlayerMin;

    // Queue very slow Player Pawn glide along every intermediate notch!
    if (Math.abs(endPlayerMin - startPlayerMin) > 0.1) {
      steps.push({
        type: "MOVE_PLAYER",
        fromMin: startPlayerMin,
        toMin: endPlayerMin
      });
    }

    // 2. Check 12:00 AM Midnight Escape Milestone (fires right after player glides to XII!)
    if (matchStateRef.clockMinutes >= CLOCK_TOTAL_MINUTES) {
      steps.push({
        type: "CALLBACK",
        fn: () => {
          matchStateRef.setupPhase = "MIDNIGHT";
          if (App.GameWorld && App.GameWorld.triggerMidnightEndgame) {
            App.GameWorld.triggerMidnightEndgame();
          } else {
            App.Audio.clockChime();
            syncUI();
          }
          if (onStateChangeCallback) onStateChangeCallback();
        }
      });
      enqueueTurnSteps(steps);
      return;
    }

    // 3. Last Chance survival check (Exact Visitor rule from The Cabin Game)
    if (matchStateRef.setupPhase === "LAST_CHANCE") {
      if (!wasInterruptedByHex && playedEscapeCard && matchStateRef.clockMinutes > matchStateRef.harvesterMinutes) {
        matchStateRef.setupPhase = "PLAYING";
      } else {
        steps.push({
          type: "CALLBACK",
          fn: () => {
            matchStateRef.setupPhase = "GAME_OVER";
            if (App.Endgame && App.Endgame.startHarvesterLoseCutscene) {
              close(true);
              App.Endgame.startHarvesterLoseCutscene(matchStateRef);
            } else {
              App.Audio.hexAlert();
              if (App.Audio && App.Audio.startGameOverBgm) App.Audio.startGameOverBgm();
              syncUI();
            }
            if (onStateChangeCallback) onStateChangeCallback();
          }
        });
        enqueueTurnSteps(steps);
        return;
      }
    }

    matchStateRef.turnCount += 1;
    if (!wasInterruptedByHex && (matchStateRef.eventCooldownTurns || 0) > 0) {
      matchStateRef.eventCooldownTurns = Math.max(0, matchStateRef.eventCooldownTurns - 1);
    }

    // 3b. Exact Cabin Game Clue Check: ONLY the TOP Clue Card on the Graveyard is checked every turn!
    //     (Spawns clue if its assigned room exists; rings Grandfather Clock 3s->11s SFX on reveal!)
    if (App.Clues && matchStateRef.activeOmenId) {
      App.Clues.evaluateTopGraveyardClue(matchStateRef);
    }

    // 4. Harvester 3-Turn Spawn Countdown -> Emergence at XII -> Slow Glide Hunting (+30m/turn)
    //    NOTE: When a +30m / +60m Progress card is played (`freezeHarvester === true`),
    //          ONLY the player piece moves — the spawned Harvester stays still this turn!
    if (matchStateRef.harvesterCardPlayed) {
      if (!matchStateRef.harvesterSpawned) {
        matchStateRef.harvesterDelayTurns = Math.max(0, matchStateRef.harvesterDelayTurns - 1);
        if (matchStateRef.harvesterDelayTurns === 0) {
          steps.push({ type: "RISE_HARVESTER" });
        }
      } else {
        const delayedByNeighbor = (matchStateRef.harvesterFrozenTurns || 0) > 0;
        if (delayedByNeighbor) {
          matchStateRef.harvesterFrozenTurns = Math.max(0, matchStateRef.harvesterFrozenTurns - 1);
        }
        if (!freezeHarvester && !delayedByNeighbor) {
          matchStateRef.harvesterMinutes = Math.min(
            matchStateRef.clockMinutes,
            matchStateRef.harvesterMinutes + HARVESTER_STEP_MIN
          );
        }
        const endHarvMin = matchStateRef.harvesterMinutes;
        if (Math.abs(endHarvMin - startHarvMin) > 0.1) {
          steps.push({
            type: "MOVE_HARVESTER",
            fromMin: startHarvMin,
            toMin: endHarvMin
          });
        }
        if (!freezeHarvester && endHarvMin >= matchStateRef.clockMinutes) {
          steps.push({
            type: "CALLBACK",
            fn: () => {
              matchStateRef.setupPhase = "LAST_CHANCE";
              App.Audio.hexAlert();
              syncUI();
            }
          });
        }
      }
    }

    // 5. After pawns finish their slow mechanical glide, rotate the outer rim!
    steps.push({
      type: "CALLBACK",
      fn: () => {
        startRimTurnRotation(forcedRandomSeat);
        if (onStateChangeCallback) onStateChangeCallback();
      }
    });

    enqueueTurnSteps(steps);
    if (onStateChangeCallback) onStateChangeCallback();
  }

  // ==================== DRAW / VINTAGE CARD VIEW (image_71b117) / FLY ANIMATION ====================
  const VINTAGE_BORDER_SVG = `
    <svg viewBox="0 0 400 380" preserveAspectRatio="none" class="vc-frame-svg" aria-hidden="true">
      <!-- Outer bold stepped scalloped Victorian border matching image_71b117.jpg -->
      <path d="M52,10 L348,10 Q352,26 368,26 L388,26 L388,48 Q372,54 372,68 L372,312 Q372,326 388,332 L388,354 L368,354 Q352,354 348,370 L52,370 Q48,354 32,354 L12,354 L12,332 Q28,326 28,312 L28,68 Q28,54 12,48 L12,26 L32,26 Q48,26 52,10 Z"
            fill="none" stroke="#110c09" stroke-width="6.5" stroke-linejoin="round"/>
      <!-- Inner crisp thin frame line -->
      <path d="M58,18 L342,18 Q348,34 364,34 L380,34 L380,46 Q364,52 364,68 L364,312 Q364,328 380,334 L380,346 L364,346 Q348,346 342,362 L58,362 Q52,346 36,346 L20,346 L20,334 Q36,328 36,312 L36,68 Q36,52 20,46 L20,34 L36,34 Q52,34 58,18 Z"
            fill="none" stroke="#1b140f" stroke-width="2.1"/>
      <!-- Decorative inward scroll curls at all 4 corners -->
      <g fill="none" stroke="#110c09" stroke-width="3.2" stroke-linecap="round">
        <path d="M26,42 C38,40 44,48 38,54 C33,58 27,54 30,49"/>
        <path d="M374,42 C362,40 356,48 362,54 C367,58 373,54 370,49"/>
        <path d="M26,338 C38,340 44,332 38,326 C33,322 27,326 30,331"/>
        <path d="M374,338 C362,340 356,332 362,326 C367,322 373,326 370,331"/>
      </g>
    </svg>
  `;

  const VINTAGE_TOP_ORNAMENT_SVG = `
    <svg viewBox="0 0 260 44" class="vc-top-orn-svg" aria-hidden="true">
      <g fill="none" stroke="#1b140f" stroke-linecap="round">
        <!-- Left swirling filigree -->
        <path d="M112,24 C92,10 74,10 60,22 C48,32 34,28 24,20" stroke-width="2.0"/>
        <path d="M108,30 C92,36 78,34 68,24 C62,18 52,18 48,25 C45,30 51,34 55,31" stroke-width="1.5"/>
        <path d="M98,16 C86,8 72,8 62,13" stroke-width="1.2"/>
        <!-- Right swirling filigree -->
        <path d="M148,24 C168,10 186,10 200,22 C212,32 226,28 236,20" stroke-width="2.0"/>
        <path d="M152,30 C168,36 182,34 192,24 C198,18 208,18 212,25 C215,30 209,34 205,31" stroke-width="1.5"/>
        <path d="M162,16 C174,8 188,8 198,13" stroke-width="1.2"/>
      </g>
      <!-- Center antique hourglass -->
      <g transform="translate(119,3)">
        <rect x="2" y="1" width="18" height="3" rx="1" fill="#1b140f"/>
        <rect x="2" y="34" width="18" height="3" rx="1" fill="#1b140f"/>
        <line x1="4" y1="4" x2="4" y2="34" stroke="#1b140f" stroke-width="1.6"/>
        <line x1="18" y1="4" x2="18" y2="34" stroke="#1b140f" stroke-width="1.6"/>
        <path d="M5,4 C5,14 11,17 11,19 C11,21 5,24 5,34 L17,34 C17,24 11,21 11,19 C11,17 17,14 17,4 Z"
              fill="#e8dfc9" stroke="#1b140f" stroke-width="1.4"/>
        <!-- Falling sand -->
        <path d="M7,9 L15,9 L11,17 Z" fill="#3a2f27"/>
        <path d="M6,34 L16,34 L11,26 Z" fill="#1b140f"/>
        <line x1="11" y1="18" x2="11" y2="27" stroke="#1b140f" stroke-width="1" stroke-dasharray="1.5,1.5"/>
      </g>
    </svg>
  `;

  const VINTAGE_BOTTOM_ORNAMENT_SVG = `
    <svg viewBox="0 0 240 34" class="vc-bot-orn-svg" aria-hidden="true">
      <g fill="none" stroke="#1b140f" stroke-linecap="round">
        <path d="M120,18 C108,8 92,8 78,20 C64,30 46,26 32,16" stroke-width="2.1"/>
        <path d="M120,18 C132,8 148,8 162,20 C176,30 194,26 208,16" stroke-width="2.1"/>
        <path d="M112,24 C98,30 82,26 74,16 C68,10 58,12 56,19" stroke-width="1.4"/>
        <path d="M128,24 C142,30 158,26 166,16 C172,10 182,12 184,19" stroke-width="1.4"/>
        <path d="M114,17 Q120,10 126,17 Q120,25 114,17 Z" fill="#1b140f"/>
      </g>
    </svg>
  `;

  const VINTAGE_TITLE_DIVIDER_SVG = `
    <svg viewBox="0 0 240 12" class="vc-divider-svg" aria-hidden="true">
      <line x1="12" y1="6" x2="108" y2="6" stroke="#3d2c20" stroke-width="1.1"/>
      <line x1="132" y1="6" x2="228" y2="6" stroke="#3d2c20" stroke-width="1.1"/>
      <circle cx="120" cy="6" r="3" fill="none" stroke="#3d2c20" stroke-width="1.2"/>
      <circle cx="111" cy="6" r="1.3" fill="#3d2c20"/>
      <circle cx="129" cy="6" r="1.3" fill="#3d2c20"/>
    </svg>
  `;

  function buildCornerBadgeSVG(card) {
    if (card.id === "hx_attic" || card.id === "hx_tall_stalker") {
      // Exact crossed-out golden lantern icon from image_71b117.jpg!
      return `
        <div class="vc-corner-badge" title="${card.id === "hx_attic" ? "No Lanterns Allowed" : "Turn Off All Lights"}">
          <svg viewBox="0 0 40 44" aria-hidden="true">
            <path d="M15,8 Q20,2 25,8" fill="none" stroke="#594119" stroke-width="2"/>
            <rect x="13" y="8" width="14" height="4" rx="1" fill="#c9a236" stroke="#3b280d" stroke-width="1.4"/>
            <rect x="11" y="12" width="18" height="19" rx="3" fill="#e6c44e" stroke="#3b280d" stroke-width="1.5"/>
            <rect x="14" y="15" width="12" height="13" rx="1.5" fill="#fff4b8" stroke="#7d5d1a" stroke-width="1"/>
            <ellipse cx="20" cy="22" rx="2.5" ry="4" fill="#f09c2b"/>
            <rect x="10" y="31" width="20" height="5" rx="1.5" fill="#b8902a" stroke="#3b280d" stroke-width="1.4"/>
            <!-- Bold diagonal crimson-brown slash -->
            <line x1="6" y1="9" x2="34" y2="36" stroke="#5c1714" stroke-width="4.2" stroke-linecap="round"/>
            <line x1="6" y1="9" x2="34" y2="36" stroke="#8f241f" stroke-width="2.0" stroke-linecap="round"/>
          </svg>
        </div>`;
    }
    if (card.type === "CHIME" && card.meta && card.meta.deltaMinutes) {
      return `<div class="vc-corner-pill">+${card.meta.deltaMinutes}M</div>`;
    }
    if (card.type === "WARD" && card.meta && card.meta.harvesterBackSteps) {
      return `<div class="vc-corner-pill is-ward">-${card.meta.harvesterBackSteps * 30}M</div>`;
    }
    if (card.type === "BLUEPRINT" && card.meta && card.meta.exits) {
      return `<div class="vc-corner-pill is-room">${card.meta.exits} DOOR${card.meta.exits > 1 ? "S" : ""}</div>`;
    }
    return "";
  }

  // Authentic multi-paragraph vintage card copy matching image_71b117.jpg!
  const VINTAGE_CARD_COPY = {
    hx_harvester: {
      paragraphs: [
        "GUARANTEED TURN 2 EVENT.",
        "LAY THIS CARD DOWN ON THE TABLE. AFTER 3 TURNS, THE HOLLOW HARVESTER RISES FROM BENEATH XII.",
        "IT ADVANCES +30 MINUTES EVERY TURN. DO NOT LET IT CATCH YOUR PIECE."
      ],
      warning: "3-TURN DELAY BEFORE EMERGENCE."
    },
    hx_corners: {
      paragraphs: [
        "A FIGURE APPEARS IN THE CORNER OF THE DINING ROOM, FACING THE WALL.",
        "ONCE 5 TO 6 ROOMS EXIST, ALL LIGHTS SHUT OFF. YOU HAVE 10 SECONDS TO FACE ANY VALID WALL CORNER.",
        "READ EACH CONDITION CAREFULLY: TURN AROUND ONLY IF IT IS TRUE."
      ],
      warning: "DO NOT TURN AROUND IF FALSE."
    },
    hx_attic: {
      paragraphs: [
        "ONLY ONE PERSON ALLOWED AT A TIME. COMPLETE THE RITUAL BY FINDING THE 5 TOTEMS. PLACE THEM ON THEIR SYMBOL AND LIGHT THE CANDLES.",
        "IF YOU GET CAUGHT, DO NOT LOOK AT IT, DROP THE CANDLE, AND RUN INTO THE DARK AND HIDE."
      ],
      warning: "NO LANTERNS ALLOWED."
    },
    hx_tall_stalker: {
      paragraphs: [
        "HE HAS NO EYES, SO HE SEES THROUGH YOURS.",
        "TURN OFF ALL LIGHTS SO HE CAN SEE NO MORE."
      ],
      warning: "TURN OFF EVERY LIGHT SWITCH."
    },
    hx_balloons: {
      paragraphs: [
        "POP THE BALLOONS UNTIL THE GOLD ONE APPEARS, THEN POP THAT ONE TO END YOUR FEARS.",
        "IF YOU WISH TO NOT BE FOUND, MOVE SLOW AND DON'T MAKE A SOUND..."
      ],
      warning: "PRESS [C] TO CROUCH."
    },
    hx_knight: {
      paragraphs: [
        "CHECK THE DINING TABLE FOR 3 GLOWING LIGHTS: RED (KNIGHT), BLUE (DESTINATION), GREEN (DEMON STATUE).",
        "EVERY 10 SECONDS YOU MAY MOVE 1 ROOM AND PRESS [E] TO ROTATE THE STATUE. THE STATUE ONLY STARTS MOVING AFTER YOU ROTATE IT ONCE."
      ],
      warning: "NEVER SHARE A ROOM WITH THE KNIGHT."
    },
    hx_tiny_toys: {
      paragraphs: [
        "A STRINGED PUPPET DESCENDS INTO THE DINING ROOM AS EVERY LIGHT FLICKERS FOR 10 SECONDS.",
        "FOLLOW THE TOY TRAIN'S SOUND AND INSERT EACH REQUESTED SHAPE ACROSS 4 TURNS."
      ],
      warning: "10 SECONDS PER SHAPE — OR THE PUPPET HUNTS YOU."
    },
    hx_musical_rooms: {
      paragraphs: [
        "A GIANT MONKEY APPEARS BESIDE YOU IN THE DARK. AFTER 10 SECONDS, THE DINING TABLE BECOMES A CARDBOARD BOX.",
        "PICK UP POPCORN [F] AND HOLD/RELEASE [F] TO THROW 10 POPCORNS INTO THE BOX WITHIN 35 SECONDS."
      ],
      warning: "WHEN THE MUSIC STOPS, THE MONKEY HUNTS."
    },
    hx_cellar_breakers: {
      paragraphs: [
        "THE DINING ROOM SHAKES AND SLIDES UNDERGROUND INTO A DARK BASEMENT MAZE.",
        "REPAIR ALL 5 SPARKING RED FUSE BOXES BY HOLDING [F]. DUCK INTO RECESSED WALL ALCOVES WHEN YOU HEAR THE CHAINSAW."
      ],
      warning: "FIX ALL 5 BOXES TO RISE BACK UP."
    },
    hx_stay_lit: {
      paragraphs: [
        "ALL LIGHTS FLICKER FOR 5 SECONDS, THEN ONLY 2 RANDOM ROOMS REMAIN LIT (SWITCHING EVERY 10 SECONDS).",
        "A GLOWING FOUR-LEGGED BEAST HUNTS EVERY DARK ROOM AND VANISHES IF IT TOUCHES THE LIGHT."
      ],
      warning: "SURVIVE FOR 90 SECONDS."
    },
    ch_the_thief: {
      paragraphs: [
        "SPIN THE CURSED WHEEL OF THE THIEF.",
        "ITS NEEDLE ALTERS ONE OF FOUR CABIN SYSTEMS: CLUES, ROOMS, TIME, OR THE GRAVEYARD."
      ],
      warning: "FORTUNE FAVORS THE BOLD."
    },
    ch_the_neighbor: {
      paragraphs: [
        "THREE HEAVY KNOCKS ECHO AT THE FRONT CABIN DOOR.",
        "WALK TO THE DOOR AND PRESS [E] TO OPEN IT FOR THE NEIGHBOR."
      ],
      warning: "ONLY THE PERSON WHO PLAYED ME GETS TO PICK."
    }
  };

  function getOmenBookKey(omenId) {
    const map = {
      om_grandfather_clock: "clock",
      om_past_traveler: "past_player",
      om_corrupt_painting: "corrupt_painting",
      om_paranormal_alt: "paranormal_alt",
      om_rooster_decor: "chicken_decor",
      om_chalk_grid: "ttt_demo"
    };
    return map[omenId] || null;
  }

  function buildVintageCardMarkup(card, opts) {
    const isFlyer = Boolean(opts && opts.isFlyer);
    const isHex = card.type === "HEX";
    const typeInfo = App.CardsDB.CARD_TYPES[card.type] || { label: card.type };
    const badgeHtml = buildCornerBadgeSVG(card);

    let centerContent = "";

    if (card.type === "BLUEPRINT" && card.meta && card.meta.shape) {
      const d = App.CardsDB.getRotatedDoors(card.meta.shape, 0);
      const shapeInfo = App.CardsDB.ROOM_SHAPES[card.meta.shape];
      centerContent = `
        <div class="vc-visual-box is-room">
          ${App.CardsDB.buildRoomDirectionSVG(d, card.glyph)}
        </div>
        <p class="vc-body-p">${(card.effect || "").toUpperCase()}</p>
        <p class="vc-warn-line">${shapeInfo ? `${shapeInfo.label} ROOM — PRESS [R] TO ROTATE.` : "PLACE ON AN OPEN DOORWAY."}</p>
      `;
    } else if (card.type === "OMEN") {
      const bookKey = getOmenBookKey(card.id);
      const artSvg = bookKey && App.FieldBook && App.FieldBook.getClueArtSVG
        ? App.FieldBook.getClueArtSVG(bookKey)
        : `<span class="vc-big-glyph">${card.glyph}</span>`;
      centerContent = `
        <div class="vc-visual-box is-clue">${artSvg}</div>
        <p class="vc-body-p">${(card.effect || "").toUpperCase()}</p>
        <p class="vc-warn-line">PLACE IN GRAVEYARD TO CHECK EVERY TURN.</p>
      `;
    } else if (VINTAGE_CARD_COPY[card.id]) {
      const copy = VINTAGE_CARD_COPY[card.id];
      const mon = App.Events && App.Events.getMonsterForCard(card);
      centerContent = `
        <div class="vc-text-stack">
          ${copy.paragraphs.map((p) => `<p class="vc-body-p">${p}</p>`).join("")}
        </div>
        <p class="vc-warn-line">${copy.warning}</p>
        ${mon && !isFlyer ? `<div class="vc-monster-foot">ENTITY: ${mon.name}</div>` : ""}
      `;
    } else {
      // CHIME (Progress) or WARD (Lifesaver)
      centerContent = `
        <div class="vc-medallion">${card.glyph}</div>
        <p class="vc-body-p">${(card.effect || "").toUpperCase()}</p>
        <p class="vc-warn-line">${
          card.type === "WARD"
            ? "LIFESAVER CARD — DRIVES BACK THE HARVESTER."
            : card.meta && card.meta.freezeHarvester
              ? "PROGRESS CARD — ONLY YOUR PIECE ADVANCES."
              : `${typeInfo.label} CARD.`
        }</p>
      `;
    }

    return `
      ${VINTAGE_BORDER_SVG}
      ${badgeHtml}
      <div class="vc-inner">
        ${VINTAGE_TOP_ORNAMENT_SVG}
        <h2 class="vc-title${isHex ? " is-crimson" : ""}">${card.name}</h2>
        ${VINTAGE_TITLE_DIVIDER_SVG}
        <div class="vc-content">${centerContent}</div>
        ${VINTAGE_BOTTOM_ORNAMENT_SVG}
      </div>
    `;
  }

  // Smooth physical animation: Pedestal Draw Slot -> Center of Screen (flip & scale up!)
  function animateCardFromDeckToCenter(card, onArrive) {
    const flyer = document.getElementById("fp-draw-flyer");
    const deckBtn = document.getElementById("fp-deck-btn");
    if (!flyer || !deckBtn) {
      if (onArrive) onArrive();
      return;
    }

    anim.drawAnimating = true;
    const dRect = deckBtn.getBoundingClientRect();
    const startX = dRect.left + dRect.width / 2;
    const startY = dRect.top + dRect.height / 2;
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight * 0.47;

    flyer.className = `fp-draw-flyer fp-vintage-card type-${card.type}`;
    flyer.innerHTML = buildVintageCardMarkup(card, { isFlyer: true });
    flyer.style.transition = "none";
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.opacity = "0.90";
    flyer.style.transform = "translate(-50%, -50%) scale(0.22) rotateY(180deg)";
    flyer.classList.remove("hidden");

    void flyer.offsetWidth;

    requestAnimationFrame(() => {
      flyer.style.transition =
        "left 0.50s cubic-bezier(0.22, 1, 0.36, 1), top 0.50s cubic-bezier(0.22, 1, 0.36, 1), transform 0.52s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease";
      flyer.style.left = `${targetX}px`;
      flyer.style.top = `${targetY}px`;
      flyer.style.opacity = "1";
      flyer.style.transform = "translate(-50%, -50%) scale(1.0) rotateY(0deg)";
    });

    const id = setTimeout(() => {
      flyer.classList.add("hidden");
      anim.drawAnimating = false;
      if (onArrive) onArrive();
    }, 530);
    dealTimeouts.push(id);
  }

  // Smooth physical animation: Center of Screen -> Player's Hand Fan (or Outer Rim for Events!)
  function animateCardFromCenterToTarget(card, toRim, onArrive) {
    const flyer = document.getElementById("fp-draw-flyer");
    const cardEl = document.getElementById("fp-drawn-card");
    const handEl = document.getElementById("fp-hand-cards");
    const rimEl = document.getElementById("fp-rim-cards");

    if (!flyer || !cardEl) {
      if (onArrive) onArrive();
      return;
    }

    anim.drawAnimating = true;
    const cRect = cardEl.getBoundingClientRect();
    const startX = cRect.width > 0 ? cRect.left + cRect.width / 2 : window.innerWidth / 2;
    const startY = cRect.height > 0 ? cRect.top + cRect.height / 2 : window.innerHeight * 0.47;

    let endX = window.innerWidth / 2;
    let endY = window.innerHeight - 64;
    let endScale = 0.32;
    let endRot = 0;

    if (toRim && rimEl) {
      const rRect = rimEl.getBoundingClientRect();
      endX = rRect.left + rRect.width * 0.72;
      endY = rRect.top + rRect.height * 0.66;
      endScale = 0.16;
      endRot = -22;
    } else if (handEl) {
      const hRect = handEl.getBoundingClientRect();
      endX = hRect.left + hRect.width / 2 + Math.min(80, hand.length * 14);
      endY = hRect.top + Math.max(40, hRect.height * 0.45);
      endScale = 0.30;
      endRot = 6;
    }

    flyer.className = `fp-draw-flyer fp-vintage-card type-${card.type}`;
    flyer.innerHTML = buildVintageCardMarkup(card, { isFlyer: true });
    flyer.style.transition = "none";
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    flyer.style.opacity = "1";
    flyer.style.transform = "translate(-50%, -50%) scale(1.0) rotate(0deg)";
    flyer.classList.remove("hidden");

    void flyer.offsetWidth;

    requestAnimationFrame(() => {
      flyer.style.transition =
        "left 0.42s cubic-bezier(0.32, 0.94, 0.6, 1), top 0.42s cubic-bezier(0.32, 0.94, 0.6, 1), transform 0.42s cubic-bezier(0.32, 0.94, 0.6, 1), opacity 0.38s ease";
      flyer.style.left = `${endX}px`;
      flyer.style.top = `${endY}px`;
      flyer.style.opacity = toRim ? "0.45" : "0.95";
      flyer.style.transform = `translate(-50%, -50%) scale(${endScale}) rotate(${endRot}deg)`;
    });

    const id = setTimeout(() => {
      flyer.classList.add("hidden");
      anim.drawAnimating = false;
      if (onArrive) onArrive();
    }, 430);
    dealTimeouts.push(id);
  }

  function showDrawnSpotlight(card, isHex, isTurn2Harvester) {
    pendingDrawnCard = card;
    hexInterrupted = isHex;

    const spot = document.getElementById("fp-drawn-spotlight");
    const cardEl = document.getElementById("fp-drawn-card");
    const btn = spot ? spot.querySelector("button[data-table-action='dismiss-drawn']") : null;
    if (!spot || !cardEl) return;

    cardEl.className = `fp-vintage-card type-${card.type}`;
    cardEl.innerHTML = buildVintageCardMarkup(card, { isFlyer: false });

    if (btn) {
      btn.textContent = isTurn2Harvester
        ? "[ TAKE TO HAND ]"
        : isHex
          ? "[ CONTINUE ]"
          : "[ ADD TO HAND ]";
    }

    spot.classList.remove("hidden");
  }

  function handleDrawDeck() {
    if (pendingDrawnCard || anim.drawAnimating || isInputLocked() || isMidnightMapOnly()) return;
    if (App.Audio.warmUpDrawCard) App.Audio.warmUpDrawCard();
    const phase = matchStateRef.setupPhase;

    // Turn 2: Guaranteed Draw of THE HOLLOW HARVESTER!
    if (phase === "TURN_2_HARVESTER" && turnStep === 1) {
      const harvCard = App.CardsDB.getById("hx_harvester");
      if (App.GuideUI) App.GuideUI.discoverCard(harvCard.id);
      App.Audio.cardDraw();
      if (App.Audio.playEventDraw) App.Audio.playEventDraw();
      animateCardFromDeckToCenter(harvCard, () => {
        showDrawnSpotlight(harvCard, false, true);
      });
      return;
    }

    if ((phase !== "PLAYING" && phase !== "LAST_CHANCE") || turnStep !== 1) {
      App.Audio.close();
      return;
    }
    if (deck.length === 0) {
      deck = new Array(40).fill(null);
    }
    deck.pop();

    const excludeRoomIds = [
      ...Object.values(matchStateRef.roomMap || {}).map((r) => r.id),
      ...hand.filter((c) => c.type === "BLUEPRINT").map((c) => c.id)
    ];
    // Pass already-held & Graveyard Clue IDs to drastically reduce duplicate Clues!
    const ownedOmenIds = [
      ...hand.filter((c) => c.type === "OMEN").map((c) => c.id),
      ...candleTray.map((c) => c.id)
    ];

    const totalRoomsBuilt = Object.keys(matchStateRef.roomMap || {}).length;
    const card = App.CardsDB.drawWeightedCard({
      allowHex: true,
      isMultiplayer: matchStateRef.mode === "MULTIPLAYER",
      excludeRoomIds,
      excludeCardIds: uniqueDrawnCardIds,
      ownedOmenIds,
      pityState: drawPity,
      totalRooms: totalRoomsBuilt,
      eventCooldownTurns: matchStateRef.eventCooldownTurns || 0,
      drawnEventCardIds: matchStateRef.drawnEventCardIds || []
    });
    recordUniqueCardIfNeeded(card);
    if (App.GuideUI) App.GuideUI.discoverCard(card.id);

    App.Audio.cardDraw();
    if (card.type === "HEX") {
      // Anti-consecutive event cooldown: no back-to-back events for the next 2 turns!
      matchStateRef.eventCooldownTurns = 2;
      matchStateRef.drawnEventCardIds = matchStateRef.drawnEventCardIds || [];
      if (!matchStateRef.drawnEventCardIds.includes(card.id)) {
        matchStateRef.drawnEventCardIds.push(card.id);
      }
      // Play audio/event_draw.mp3 (4 seconds) whenever an Event card is drawn!
      if (App.Audio.playEventDraw) App.Audio.playEventDraw();
      if (App.Events) App.Events.onEventCardDrawn(card, matchStateRef);
      animateCardFromDeckToCenter(card, () => {
        showDrawnSpotlight(card, true, false);
      });
    } else {
      animateCardFromDeckToCenter(card, () => {
        showDrawnSpotlight(card, false, false);
      });
    }
  }

  function dismissDrawn() {
    if (anim.drawAnimating) return;
    if (!pendingDrawnCard) {
      document.getElementById("fp-drawn-spotlight")?.classList.add("hidden");
      return;
    }

    const wasHex = hexInterrupted;
    const card = pendingDrawnCard;
    pendingDrawnCard = null;
    hexInterrupted = false;
    App.Audio.click();

    // Animate physical card flying from center -> Player's Hand Fan (or Outer Rim for HEX events)!
    animateCardFromCenterToTarget(card, wasHex, () => {
      if (wasHex) {
        rimPlayedCards.push(card);
        App.Audio.cardPlay();
        if (App.Clues && matchStateRef.activeOmenId) {
          App.Clues.evaluateTopGraveyardClue(matchStateRef);
        }
        if (card.id === "hx_attic" && App.Attic && App.Attic.startAtticEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.Attic.startAtticEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_tall_stalker" && App.Stalkers && App.Stalkers.startTallManEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.Stalkers.startTallManEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_balloons" && App.Stalkers && App.Stalkers.startRedBalloonsEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.Stalkers.startRedBalloonsEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_tiny_toys" && App.Stalkers && App.Stalkers.startFeelingSmallEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.Stalkers.startFeelingSmallEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_musical_rooms" && App.Musical && App.Musical.startMusicalRoomsEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          if (App.GameWorld && App.GameWorld.startMusicalRooms) {
            App.GameWorld.startMusicalRooms();
          } else {
            App.Musical.startMusicalRoomsEvent(matchStateRef, null);
          }
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_cellar_breakers" && App.Basement && App.Basement.startBasementEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          if (App.GameWorld && App.GameWorld.startBasementEvent) {
            App.GameWorld.startBasementEvent();
          } else {
            App.Basement.startBasementEvent(matchStateRef, null);
          }
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_stay_lit" && App.StayLit && App.StayLit.startStayInLightEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.StayLit.startStayInLightEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        if (card.id === "hx_knight" && App.Knight && App.Knight.startKnightEvent) {
          selectedHandIdx = -1;
          turnStep = 1;
          matchStateRef.turnCount += 1;
          close(true);
          if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
            App.GameWorld.forceStandUpForEvent();
          }
          App.Knight.startKnightEvent(matchStateRef);
          if (onStateChangeCallback) onStateChangeCallback();
          return;
        }
        resolveEndOfTurn(true, false);
      } else {
        hand.push(card);
        dealAnimIndices = new Set([hand.length - 1]);
        turnStep = 2;
        App.Audio.cardDeal();
        syncUI();
        if (onStateChangeCallback) onStateChangeCallback();
      }
    });

    document.getElementById("fp-drawn-spotlight")?.classList.add("hidden");
  }

  function openTrayModal() {
    if (pendingDrawnCard || anim.drawAnimating || isInputLocked()) return;
    const modal = document.getElementById("fp-tray-modal");
    const list = document.getElementById("fp-tray-list");
    const hint = document.getElementById("fp-tray-hint");
    if (!modal || !list) return;

    const phase = matchStateRef.setupPhase;
    const canReclaim = (phase === "PLAYING" || phase === "LAST_CHANCE") && turnStep === 1;

    list.innerHTML = "";
    if (!candleTray.length) {
      list.innerHTML = `<p class="helper-note">No Clue / Omen Cards placed on the Graveyard Pedestal yet.</p>`;
    } else {
      candleTray.forEach((card, idx) => {
        const isTop = idx === candleTray.length - 1;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fp-parchment-hand-card type-OMEN modal-card-flat";
        btn.innerHTML = `
          <div class="fp-parch-inner">
            <span class="fp-parch-type">${isTop ? "ACTIVE CLUE" : "CLUE"}</span>
            <span class="fp-parch-title">${card.name}</span>
            <span class="fp-parch-emblem">${card.glyph}</span>
            <span class="fp-parch-desc">${canReclaim ? "Click to Reclaim" : "Preview Only"}</span>
          </div>
        `;
        btn.addEventListener("click", () => {
          if (!canReclaim) return;
          candleTray.splice(idx, 1);
          hand.push(card);
          const newTop = candleTray.length ? candleTray[candleTray.length - 1] : null;
          matchStateRef.activeOmen = newTop ? newTop.name : null;
          matchStateRef.activeOmenId = newTop ? newTop.id : null;
          turnStep = 2;
          modal.classList.add("hidden");
          App.Audio.cardDraw();
          syncUI();
          if (onStateChangeCallback) onStateChangeCallback();
        });
        list.appendChild(btn);
      });
    }

    if (hint) {
      hint.textContent = canReclaim
        ? "CLICK A CLUE CARD TO RECLAIM IT TO HAND (COUNTS AS STEP 1)"
        : "PREVIEWING GRAVEYARD DOES NOT SPEND YOUR TURN";
    }

    modal.classList.remove("hidden");
    App.Audio.open();
  }

  function closeTrayModal() {
    document.getElementById("fp-tray-modal")?.classList.add("hidden");
    App.Audio.close();
  }

  function playBlueprintAtCoord(x, y, rotationSteps) {
    if (isInputLocked() || turnStep !== 2 || selectedHandIdx < 0) return;
    const card = hand[selectedHandIdx];
    if (!card || card.type !== "BLUEPRINT") return;

    const rot = rotationSteps || 0;
    const doors = App.CardsDB.getRotatedDoors(card.meta?.shape || "dead_end", rot);

    hand.splice(selectedHandIdx, 1);
    matchStateRef.roomMap[keyOf(x, y)] = {
      x,
      y,
      id: card.id,
      glyph: card.glyph,
      name: card.shortName || card.name.split(" ")[0],
      fullName: card.name,
      shape: card.meta?.shape || "dead_end",
      rotation: rot,
      doors,
      isParlor: false,
      deadEnd: card.meta?.shape === "dead_end"
    };
    matchStateRef.roomLightStates = matchStateRef.roomLightStates || { "0,0": true };
    matchStateRef.roomLightStates[keyOf(x, y)] = true;
    matchStateRef.roomsBuilt = Object.keys(matchStateRef.roomMap).length;
    selectedRotation = 0;

    // Silent overhead bulb flicker signals the cabin architecture changed! (NO extra SFX)
    triggerArchitectureFlicker();
    App.Audio.cardPlay();

    // Check Cutting Corners trigger (5-6 total rooms including Main Parlor & Cellar!)
    if (App.Events && App.Events.checkCuttingCornersTrigger(matchStateRef)) {
      selectedHandIdx = -1;
      turnStep = 1;
      matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + PASSIVE_PLAYER_STEP_MIN);
      matchStateRef.turnCount += 1;
      if ((matchStateRef.eventCooldownTurns || 0) > 0) {
        matchStateRef.eventCooldownTurns = Math.max(0, matchStateRef.eventCooldownTurns - 1);
      }
      if (App.Clues && matchStateRef.activeOmenId) {
        App.Clues.evaluateTopGraveyardClue(matchStateRef);
      }
      if (onStateChangeCallback) onStateChangeCallback();
      return;
    }

    resolveEndOfTurn(false, false);
  }

  function applyRandomBoardEffect() {
    let effects = App.CardsDB.RANDOM_BOARD_EFFECTS;
    if (matchStateRef && matchStateRef.bannedGraveyardWipe) {
      effects = effects.filter((e) => e.id !== "tray_wipe");
    }
    const pick = effects[Math.floor(Math.random() * effects.length)];
    let escaped = false;

    if (pick.id === "lose_30") {
      matchStateRef.clockMinutes = Math.max(0, matchStateRef.clockMinutes - 30);
    } else if (pick.id === "gain_30") {
      matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + 30);
      escaped = true;
    } else if (pick.id === "tray_wipe") {
      candleTray = [];
      matchStateRef.activeOmen = null;
      matchStateRef.activeOmenId = null;
    } else if (pick.id === "harvester_back_30") {
      if (matchStateRef.harvesterSpawned) {
        matchStateRef.harvesterMinutes = Math.max(0, matchStateRef.harvesterMinutes - 30);
        escaped = true;
      } else if (matchStateRef.harvesterCardPlayed) {
        matchStateRef.harvesterDelayTurns += 1;
      }
    }

    return escaped;
  }

  // ==================== SHUFFLE CARD: UNDER-THE-TABLE HAND ANIMATION (EXACT CABIN GAME POV!) ====================
  function runShuffleHandAnimation(onComplete) {
    // Capture the EXACT cards currently remaining in the player's hand after Shuffle was played!
    const takenCards = hand.slice();
    const swapCount = takenCards.length;
    const overlay = document.getElementById("fp-shuffle-hand-overlay");
    const handFan = document.getElementById("fp-hand-cards");
    const statusEl = document.getElementById("fp-shuffle-hand-label");
    const cardsInGrip = document.getElementById("fp-shuffle-grip-cards");

    const newCards = swapCount > 0
      ? App.CardsDB.buildStartingHand(
          swapCount,
          Object.values(matchStateRef.roomMap || {}).map((r) => r.id),
          candleTray.map((c) => c.id),
          drawPity,
          uniqueDrawnCardIds
        )
      : [];
    newCards.forEach(recordUniqueCardIfNeeded);
    newCards.forEach((c) => {
      if (App.GuideUI) App.GuideUI.discoverCard(c.id);
    });

    if (!overlay || swapCount === 0) {
      hand = newCards;
      if (onComplete) onComplete();
      return;
    }

    anim.shuffleAnimating = true;
    selectedHandIdx = -1;
    syncUI();

    const buildGripCardsHtml = (cardList, isFresh) => {
      const mid = (cardList.length - 1) / 2;
      return cardList
        .map((c, i) => {
          const rot = ((i - mid) * 10).toFixed(1);
          const dy = Math.round(Math.abs(i - mid) * 6);
          return `
            <div class="sh-grip-card${isFresh ? " is-fresh" : ""}" style="--gr:${rot}deg;--gy:${dy}px">
              <span class="sh-grip-card-title">${c.name}</span>
              <span class="sh-grip-card-glyph">${c.glyph}</span>
              <span class="sh-grip-card-title">${isFresh ? "NEW" : "OLD"}</span>
            </div>`;
        })
        .join("");
    };

    // Stage 1 (image_aa9942): Creepy hand reaches DOWNWARD out from beneath the wooden table rim over player's cards!
    if (cardsInGrip) cardsInGrip.innerHTML = "";
    if (statusEl) statusEl.textContent = "A HAND REACHES OUT FROM BENEATH THE TABLE...";
    overlay.className = "fp-shuffle-overlay";
    overlay.classList.remove("hidden");
    void overlay.offsetWidth;
    overlay.classList.add("stage-reach");
    App.Audio.chairCreak();

    // Stage 2 (image_aa9968): Hand clamps onto the exact held cards and pulls them UP underneath the table!
    const t1 = setTimeout(() => {
      if (handFan) handFan.classList.add("is-taken");
      if (cardsInGrip) cardsInGrip.innerHTML = buildGripCardsHtml(takenCards, false);
      if (statusEl) statusEl.textContent = `TAKING ${swapCount} CARD${swapCount > 1 ? "S" : ""} UNDER THE TABLE...`;
      overlay.className = "fp-shuffle-overlay stage-pull";
      App.Audio.cardDraw();
    }, 520);

    // Stage 3 (image_aa9983 & image_aa999d): Brief shuffle in darkness -> Hand reaches BACK OUT sliding exact same count of NEW cards!
    const t2 = setTimeout(() => {
      hand = [];
      renderHandAndPrompt();
      if (handFan) {
        handFan.classList.remove("is-taken");
        handFan.classList.add("is-receiving");
      }
      if (cardsInGrip) cardsInGrip.innerHTML = buildGripCardsHtml(newCards, true);
      if (statusEl) statusEl.textContent = `RETURNING ${swapCount} NEW CARD${swapCount > 1 ? "S" : ""}...`;
      overlay.className = "fp-shuffle-overlay stage-return";
      App.Audio.cardDraw();
    }, 1150);

    // Stage 4: Release fresh cards into the player's hand fan & retract creepy hand back beneath the table!
    const t3 = setTimeout(() => {
      hand = newCards;
      dealAnimIndices = new Set(newCards.map((_, idx) => idx));
      renderHandAndPrompt();
      if (handFan) handFan.classList.remove("is-receiving");
      if (cardsInGrip) cardsInGrip.innerHTML = "";
      App.Audio.cardDeal();
      overlay.className = "fp-shuffle-overlay stage-retract";
    }, 1780);

    // Stage 5: Cleanup & continue turn
    const t4 = setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.className = "fp-shuffle-overlay hidden";
      anim.shuffleAnimating = false;
      if (onComplete) onComplete();
    }, 2240);

    dealTimeouts.push(t1, t2, t3, t4);
  }

  // ==================== THE THIEF: SPIN THE CURSED WHEEL (4 CABIN SYSTEMS) ====================
  const THIEF_WEDGES = [
    { id: "clue_reveal",   sys: "CLUES",     label: "REVEAL CLUE",   color: "#225c54", desc: "Manifests 1 hidden clue in an existing room (or deals a Clue card)." },
    { id: "time_lose",     sys: "TIME",      label: "-30 MINUTES",   color: "#6b262a", desc: "The Thief steals 30 minutes from the night clock." },
    { id: "room_free",     sys: "ROOMS",     label: "FREE ROOM",     color: "#2b4d70", desc: "Slips 1 unbuilt Room card directly into your hand." },
    { id: "gy_wipe",       sys: "GRAVEYARD", label: "WIPE GRAVEYARD",color: "#572230", desc: "Sweeps every Clue card off the Graveyard pedestal." },
    { id: "time_gain",     sys: "TIME",      label: "+30 MINUTES",   color: "#7a5b24", desc: "Pushes your piece +30 minutes closer to Midnight!" },
    { id: "room_blackout", sys: "ROOMS",     label: "LIGHTS OUT",    color: "#343045", desc: "Snaps off every room light switch across the cabin." },
    { id: "gy_reclaim",    sys: "GRAVEYARD", label: "PUSH HARVESTER",color: "#245c38", desc: "Drives The Hollow Harvester back 30 minutes (or +1 turn delay)." },
    { id: "clue_gain",     sys: "CLUES",     label: "RECEIVE CLUE",  color: "#1e5261", desc: "Deals 1 unowned Clue card straight into your hand." }
  ];

  function buildThiefWheelSVG() {
    const n = THIEF_WEDGES.length;
    const step = (Math.PI * 2) / n;
    let slices = "";
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * step;
      const a1 = a0 + step;
      const x0 = 150 + Math.cos(a0) * 138;
      const y0 = 150 + Math.sin(a0) * 138;
      const x1 = 150 + Math.cos(a1) * 138;
      const y1 = 150 + Math.sin(a1) * 138;
      const midDeg = ((i + 0.5) * 360) / n;
      const w = THIEF_WEDGES[i];
      slices += `
        <path d="M150,150 L${x0.toFixed(1)},${y0.toFixed(1)} A138,138 0 0,1 ${x1.toFixed(1)},${y1.toFixed(1)} Z"
              fill="${w.color}" stroke="#1a120c" stroke-width="2.4"/>
        <g transform="rotate(${midDeg.toFixed(1)} 150 150)">
          <text x="150" y="42" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-size="10.5" font-weight="700" fill="#f7eed8">${w.sys}</text>
          <text x="150" y="58" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-size="8.5" font-weight="700" fill="#e8cfa0">${w.label}</text>
        </g>`;
    }
    return `
      <svg viewBox="0 0 300 300" class="thief-wheel-svg" aria-hidden="true">
        <circle cx="150" cy="150" r="144" fill="#2b1b10" stroke="#c9a452" stroke-width="4"/>
        ${slices}
        <circle cx="150" cy="150" r="24" fill="#1e130c" stroke="#e3c068" stroke-width="3"/>
        <text x="150" y="154" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-size="11" font-weight="700" fill="#f7e3b2">THIEF</text>
      </svg>`;
  }

  function applyThiefOutcome(wedge) {
    let escaped = false;
    if (wedge.id === "clue_reveal") {
      const rev = App.Clues && App.Clues.forceRevealOneClue ? App.Clues.forceRevealOneClue(matchStateRef) : null;
      if (!rev) {
        const owned = [...hand.filter((c) => c.type === "OMEN").map((c) => c.id), ...candleTray.map((c) => c.id)];
        const pool = App.CardsDB.getByType("OMEN").filter((c) => !owned.includes(c.id));
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : App.CardsDB.getByType("OMEN")[0];
        if (pick) { hand.push(pick); if (App.GuideUI) App.GuideUI.discoverCard(pick.id); }
      }
    } else if (wedge.id === "time_lose") {
      matchStateRef.clockMinutes = Math.max(0, matchStateRef.clockMinutes - 30);
    } else if (wedge.id === "time_gain") {
      matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + 30);
      escaped = true;
    } else if (wedge.id === "room_free") {
      const taken = new Set([
        "bp_cellar",
        ...Object.values(matchStateRef.roomMap || {}).map((r) => r.id),
        ...hand.filter((c) => c.type === "BLUEPRINT").map((c) => c.id)
      ]);
      const avail = App.CardsDB.getByType("BLUEPRINT").filter((c) => !taken.has(c.id));
      if (avail.length) {
        const roomCard = avail[Math.floor(Math.random() * avail.length)];
        hand.push(roomCard);
        if (App.GuideUI) App.GuideUI.discoverCard(roomCard.id);
      }
    } else if (wedge.id === "gy_wipe") {
      if (!matchStateRef.bannedGraveyardWipe) {
        candleTray = [];
        matchStateRef.activeOmen = null;
        matchStateRef.activeOmenId = null;
      }
    } else if (wedge.id === "room_blackout") {
      matchStateRef.roomLightStates = { "0,0": true };
    matchStateRef.tallManEvent = null;
    matchStateRef.redBalloonsEvent = null;
    if (App.Stalkers && App.Stalkers.cleanup) App.Stalkers.cleanup(matchStateRef);
      Object.keys(matchStateRef.roomMap || {}).forEach((k) => { matchStateRef.roomLightStates[k] = false; });
    } else if (wedge.id === "gy_reclaim") {
      if (matchStateRef.harvesterSpawned) {
        matchStateRef.harvesterMinutes = Math.max(0, matchStateRef.harvesterMinutes - 30);
        escaped = true;
      } else if (matchStateRef.harvesterCardPlayed) {
        matchStateRef.harvesterDelayTurns += 1;
      }
    } else if (wedge.id === "clue_gain") {
      const owned = [...hand.filter((c) => c.type === "OMEN").map((c) => c.id), ...candleTray.map((c) => c.id)];
      const pool = App.CardsDB.getByType("OMEN").filter((c) => !owned.includes(c.id));
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : App.CardsDB.getByType("OMEN")[0];
      if (pick) {
        hand.push(pick);
        if (App.GuideUI) App.GuideUI.discoverCard(pick.id);
      }
    }
    return escaped;
  }

  function openThiefWheelModal() {
    const modal = document.getElementById("fp-thief-modal");
    const wheelWrap = document.getElementById("fp-thief-wheel-rotor");
    const resultEl = document.getElementById("fp-thief-result");
    const spinBtn = document.getElementById("fp-thief-spin-btn");
    if (!modal || !wheelWrap) {
      const w = THIEF_WEDGES[Math.floor(Math.random() * THIEF_WEDGES.length)];
      const esc = applyThiefOutcome(w);
      resolveEndOfTurn(false, esc);
      return;
    }

    thiefWheelActive = true;
    thiefWheelSpinning = false;
    wheelWrap.innerHTML = buildThiefWheelSVG();
    wheelWrap.style.transition = "none";
    wheelWrap.style.transform = `rotate(${thiefCurrentAngle}deg)`;
    if (resultEl) resultEl.textContent = "CLUES • ROOMS • TIME • GRAVEYARD";
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.textContent = "[ SPIN THE WHEEL ]";
    }

    modal.classList.remove("hidden");
    App.Audio.open();
    syncUI();
  }

  function spinThiefWheel() {
    if (!thiefWheelActive || thiefWheelSpinning) return;
    thiefWheelSpinning = true;

    const wheelWrap = document.getElementById("fp-thief-wheel-rotor");
    const resultEl = document.getElementById("fp-thief-result");
    const spinBtn = document.getElementById("fp-thief-spin-btn");
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.textContent = "SPINNING...";
    }

    // Pick outcome (respect bannedGraveyardWipe if The Neighbor removed it!)
    const validIndices = THIEF_WEDGES.map((w, i) => ({ w, i }))
      .filter((x) => !(matchStateRef.bannedGraveyardWipe && x.w.id === "gy_wipe"))
      .map((x) => x.i);
    const chosenIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
    const wedge = THIEF_WEDGES[chosenIdx];

    const sliceDeg = 360 / THIEF_WEDGES.length;
    const centerDeg = (chosenIdx + 0.5) * sliceDeg;
    const jitter = (Math.random() - 0.5) * (sliceDeg * 0.55);
    const targetMod = (360 - centerDeg + jitter + 360) % 360;
    const baseTurns = 5 * 360;
    const curMod = ((thiefCurrentAngle % 360) + 360) % 360;
    const delta = baseTurns + ((targetMod - curMod + 360) % 360);
    thiefCurrentAngle += delta;

    // Rhythmic wheel peg ticks while decelerating
    [0, 120, 250, 400, 580, 780, 1020, 1300, 1620, 2000, 2450, 2950].forEach((ms) => {
      const tid = setTimeout(() => {
        if (thiefWheelActive) App.Audio.grooveTick();
      }, ms);
      dealTimeouts.push(tid);
    });

    if (wheelWrap) {
      void wheelWrap.offsetWidth;
      wheelWrap.style.transition = "transform 3.3s cubic-bezier(0.14, 0.85, 0.22, 1)";
      wheelWrap.style.transform = `rotate(${thiefCurrentAngle.toFixed(1)}deg)`;
    }

    const doneId = setTimeout(() => {
      App.Audio.clockChime();
      if (resultEl) {
        resultEl.innerHTML = `<strong>${wedge.sys}: ${wedge.label}</strong><br>${wedge.desc}`;
      }
      const escaped = applyThiefOutcome(wedge);

      const closeId = setTimeout(() => {
        document.getElementById("fp-thief-modal")?.classList.add("hidden");
        thiefWheelActive = false;
        thiefWheelSpinning = false;
        resolveEndOfTurn(false, escaped, {
          freezeHarvester: wedge.id === "time_gain",
          skipPassiveStep: wedge.id === "time_gain"
        });
      }, 1750);
      dealTimeouts.push(closeId);
    }, 3400);
    dealTimeouts.push(doneId);
  }

  // ==================== THE NEIGHBOR: OPEN FRONT DOOR -> 1ST-PERSON GRIM REAPER ====================
  const NEIGHBOR_OPTION_POOL = [
    {
      id: "clear_graveyard",
      title: "CLEAR GRAVEYARD",
      desc: "WIPES ALL CLUE CARDS CURRENTLY RESTING ON THE GRAVEYARD."
    },
    {
      id: "delay_harvester_3",
      title: "DELAY HARVESTER",
      desc: "STOPS THE HOLLOW HARVESTER FROM ADVANCING FOR 3 FULL TURNS."
    },
    {
      id: "receive_clue",
      title: "RECEIVE A CLUE",
      desc: "PLACES 1 UNOWNED CLUE CARD DIRECTLY INTO YOUR HAND."
    },
    {
      id: "rewind_clock_1h",
      title: "REWIND THE CLOCK",
      desc: "REWINDS THE NIGHT CLOCK BACK BY 1 FULL HOUR (-60 MINUTES)."
    },
    {
      id: "remove_gy_wipe",
      title: "REMOVE GRAVEYARD WIPE",
      desc: "BANISHES THE GRAVEYARD WIPE EFFECT FROM THE DECK FOR THIS MATCH."
    },
    {
      id: "reveal_clue_now",
      title: "REVEAL A CLUE",
      desc: "FORCES 1 HIDDEN CLUE TO MANIFEST INSIDE AN EXISTING ROOM."
    },
    {
      id: "advance_30m",
      title: "BORROW TIME",
      desc: "MOVES YOUR PIECE +30 MINUTES FORWARD WHILE THE HARVESTER STAYS STILL."
    },
    {
      id: "receive_room",
      title: "BLUEPRINT GIFT",
      desc: "ADDS 1 UNBUILT ROOM CARD DIRECTLY INTO YOUR HAND."
    }
  ];

  function pickNeighborThreeOptions() {
    const shuffled = NEIGHBOR_OPTION_POOL.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
  }

  function pickNeighborDoorDir() {
    const map = matchStateRef.roomMap || {};
    // Prefer South front entrance door of Main Parlor first!
    const pref = [
      ["S", 0, 1],
      ["N", 0, -1],
      ["W", -1, 0],
      ["E", 1, 0]
    ];
    for (const [dir, dx, dy] of pref) {
      if (!map[`${dx},${dy}`]) return dir;
    }
    return "S";
  }

  function triggerNeighborCard() {
    const doorDir = pickNeighborDoorDir();
    const options = pickNeighborThreeOptions();
    matchStateRef.neighborEncounter = {
      active: true,
      doorOpened: false,
      doorDir,
      options,
      knockStartMs: performance.now()
    };

    selectedHandIdx = -1;
    turnStep = 1;

    // Exit First-Person Table View back to 3rd-Person Main Parlor & play 5s door_knock_sfx.mp3!
    close(true);
    if (App.Audio && App.Audio.playDoorKnock) {
      App.Audio.playDoorKnock(5.0);
    }
    if (App.GameWorld && App.GameWorld.onNeighborDoorOpened) {
      App.GameWorld.onNeighborDoorOpened(doorDir);
    }
    if (onStateChangeCallback) onStateChangeCallback();
  }

  function resolveNeighborBargain(optionId) {
    if (!matchStateRef) return "";
    let summary = "";

    if (optionId === "clear_graveyard") {
      candleTray = [];
      matchStateRef.activeOmen = null;
      matchStateRef.activeOmenId = null;
      summary = "The Neighbor swept every card off the Graveyard.";
    } else if (optionId === "delay_harvester_3") {
      if (matchStateRef.harvesterSpawned) {
        matchStateRef.harvesterFrozenTurns = (matchStateRef.harvesterFrozenTurns || 0) + 3;
        summary = "The Hollow Harvester has been delayed for 3 full turns!";
      } else if (matchStateRef.harvesterCardPlayed) {
        matchStateRef.harvesterDelayTurns += 3;
        summary = "The Hollow Harvester's emergence is delayed by +3 turns!";
      } else {
        matchStateRef.harvesterFrozenTurns = (matchStateRef.harvesterFrozenTurns || 0) + 3;
        summary = "The Hollow Harvester will remain delayed for 3 turns once it rises!";
      }
    } else if (optionId === "receive_clue") {
      const owned = [...hand.filter((c) => c.type === "OMEN").map((c) => c.id), ...candleTray.map((c) => c.id)];
      const pool = App.CardsDB.getByType("OMEN").filter((c) => !owned.includes(c.id));
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : App.CardsDB.getByType("OMEN")[0];
      if (pick) {
        hand.push(pick);
        if (App.GuideUI) App.GuideUI.discoverCard(pick.id);
        summary = `The Neighbor slipped "${pick.name}" into your hand.`;
      }
    } else if (optionId === "rewind_clock_1h") {
      matchStateRef.clockMinutes = Math.max(0, (matchStateRef.clockMinutes || 0) - 60);
      anim.visualPlayerMinutes = matchStateRef.clockMinutes;
      summary = "The night clock rewound 1 full hour (-60 minutes).";
    } else if (optionId === "remove_gy_wipe") {
      matchStateRef.bannedGraveyardWipe = true;
      summary = "Graveyard Wipe has been banished from this match.";
    } else if (optionId === "reveal_clue_now") {
      const rev = App.Clues && App.Clues.forceRevealOneClue ? App.Clues.forceRevealOneClue(matchStateRef) : null;
      if (rev) {
        summary = "A hidden clue has manifested inside one of the built rooms!";
      } else {
        const owned = [...hand.filter((c) => c.type === "OMEN").map((c) => c.id), ...candleTray.map((c) => c.id)];
        const pool = App.CardsDB.getByType("OMEN").filter((c) => !owned.includes(c.id));
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : App.CardsDB.getByType("OMEN")[0];
        if (pick) hand.push(pick);
        summary = "No hidden room clue was ready — The Neighbor handed you a Clue card instead.";
      }
    } else if (optionId === "advance_30m") {
      matchStateRef.clockMinutes = Math.min(CLOCK_TOTAL_MINUTES, (matchStateRef.clockMinutes || 0) + 30);
      anim.visualPlayerMinutes = matchStateRef.clockMinutes;
      summary = "Your piece stepped +30 minutes closer to Midnight.";
    } else if (optionId === "receive_room") {
      const taken = new Set([
        "bp_cellar",
        ...Object.values(matchStateRef.roomMap || {}).map((r) => r.id),
        ...hand.filter((c) => c.type === "BLUEPRINT").map((c) => c.id)
      ]);
      const avail = App.CardsDB.getByType("BLUEPRINT").filter((c) => !taken.has(c.id));
      if (avail.length) {
        const roomCard = avail[Math.floor(Math.random() * avail.length)];
        hand.push(roomCard);
        if (App.GuideUI) App.GuideUI.discoverCard(roomCard.id);
        summary = `The Neighbor handed you "${roomCard.name}".`;
      } else {
        summary = "Every room is already drawn — the Neighbor nods silently.";
      }
    }

    // Complete The Neighbor's turn cleanly (advance turn count, tick event cooldown & check top Graveyard clue!)
    matchStateRef.neighborEncounter = null;
    matchStateRef.turnCount += 1;
    if ((matchStateRef.eventCooldownTurns || 0) > 0) {
      matchStateRef.eventCooldownTurns = Math.max(0, matchStateRef.eventCooldownTurns - 1);
    }
    turnStep = 1;
    if (App.Clues && matchStateRef.activeOmenId) {
      App.Clues.evaluateTopGraveyardClue(matchStateRef);
    }
    if (onStateChangeCallback) onStateChangeCallback();
    return summary;
  }

  function confirmPlaySelected() {
    if (isInputLocked() || isMidnightMapOnly()) return;
    if (matchStateRef.setupPhase === "TURN_2_HARVESTER" && turnStep === 2) {
      playTurn2Harvester();
      return;
    }

    if (turnStep !== 2 || selectedHandIdx < 0) return;
    const card = hand[selectedHandIdx];
    if (!card || card.type === "BLUEPRINT") return;

    hand.splice(selectedHandIdx, 1);
    const meta = card.meta || {};
    let playedEscape = false;

    let isShiftingSeat = false;
    let freezeHarvester = false;
    let skipPassiveStep = false;

    if (card.type === "OMEN") {
      candleTray.push(card);
      matchStateRef.activeOmen = card.name;
      matchStateRef.activeOmenId = card.id;
      App.Audio.cardPlay();
    } else if (card.type === "WARD") {
      rimPlayedCards.push(card);
      const backMins = (meta.harvesterBackSteps || 1) * 30;
      if (matchStateRef.harvesterSpawned) {
        matchStateRef.harvesterMinutes = Math.max(0, matchStateRef.harvesterMinutes - backMins);
        playedEscape = true;
      } else if (matchStateRef.harvesterCardPlayed) {
        matchStateRef.harvesterDelayTurns += meta.harvesterBackSteps || 1;
      }
      App.Audio.clockChime();
    } else if (card.type === "CHIME") {
      rimPlayedCards.push(card);
      if (meta.freezeHarvester) freezeHarvester = true;
      if (meta.skipPassiveStep) skipPassiveStep = true;

      if (meta.action === "the_thief") {
        App.Audio.cardPlay();
        selectedHandIdx = -1;
        openThiefWheelModal();
        return;
      }

      if (meta.action === "the_neighbor") {
        App.Audio.cardPlay();
        triggerNeighborCard();
        return;
      }

      if (meta.action === "shuffle_hand") {
        if (meta.deltaMinutes) {
          matchStateRef.clockMinutes = Math.max(
            0,
            Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + meta.deltaMinutes)
          );
          if (meta.deltaMinutes > 0) playedEscape = true;
        }
        App.Audio.cardPlay();
        runShuffleHandAnimation(() => {
          resolveEndOfTurn(false, playedEscape, {
            forcedRandomSeat: false,
            freezeHarvester: true,
            skipPassiveStep: true
          });
        });
        return;
      }

      if (meta.deltaMinutes) {
        matchStateRef.clockMinutes = Math.max(
          0,
          Math.min(CLOCK_TOTAL_MINUTES, matchStateRef.clockMinutes + meta.deltaMinutes)
        );
        if (meta.deltaMinutes > 0) playedEscape = true;
      }
      if (meta.action === "random_board") {
        App.Audio.clockChime();
        if (applyRandomBoardEffect()) playedEscape = true;
      } else if (meta.action === "random_turn") {
        isShiftingSeat = true;
        App.Audio.cardPlay();
      } else {
        App.Audio.clockChime();
      }
    }

    resolveEndOfTurn(false, playedEscape, {
      forcedRandomSeat: isShiftingSeat,
      freezeHarvester,
      skipPassiveStep
    });
  }

  // ==================== LIFECYCLE & EVENTS ====================
  function open(matchState, onStandUp, onStateChange) {
    matchStateRef = matchState;
    onStandUpCallback = onStandUp;
    onStateChangeCallback = onStateChange;
    isOpen = true;

    document.getElementById("table-fp-stage")?.classList.remove("hidden");
    document.getElementById("game-hud")?.classList.add("hidden");

    // Unlock the Table Intro as soon as all seated players enter Table View!
    if (!matchStateRef.tableIntroDone && anim.introStage === "WAITING") {
      beginTableIntro();
    } else {
      syncUI();
      App.Audio.open();
    }
  }

  function close(silent) {
    if (!isOpen) return;
    isOpen = false;
    if (App.Audio && App.Audio.stopHumanIntro) App.Audio.stopHumanIntro();
    if (App.Audio && App.Audio.stopRimTurn) App.Audio.stopRimTurn();
    if (App.Audio && App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio && App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    clearDealTimers();
    clearStepQueue();
    selectedHandIdx = -1;
    document.getElementById("table-fp-stage")?.classList.add("hidden");
    document.getElementById("fp-tray-modal")?.classList.add("hidden");
    document.getElementById("fp-drawn-spotlight")?.classList.add("hidden");
    document.getElementById("fp-gameover-modal")?.classList.add("hidden");
    document.getElementById("fp-rim-tooltip")?.classList.add("hidden");
    document.getElementById("fp-draw-flyer")?.classList.add("hidden");
    anim.drawAnimating = false;
    document.getElementById("fp-thief-modal")?.classList.add("hidden");
    document.getElementById("fp-shuffle-hand-overlay")?.classList.add("hidden");
    thiefWheelActive = false;
    thiefWheelSpinning = false;
    anim.shuffleAnimating = false;
    anim.archFlickerActive = false;
    anim.archFlickerLight = 1.0;
    if (matchStateRef) matchStateRef.archFlickerLight = 1.0;
    const veil = document.getElementById("fp-flicker-veil");
    if (veil) veil.style.opacity = "0";
    document.getElementById("game-hud")?.classList.remove("hidden");
    if (!silent) App.Audio.close();
  }

  function renderFrame(timeSec, dt) {
    if (!isOpen) return;
    updateAnimations(dt || 0.016);
    App.TableCanvas.render(timeSec, matchStateRef, anim);

    const pCanvas = document.getElementById("fp-player-canvas");
    if (pCanvas) {
      const ch = App.Config.state.character;
      const seatedPreview = Object.assign({}, ch, { walking: false, facing: 1 });
      App.Character.renderToCanvas(pCanvas, seatedPreview, timeSec, {
        seated: true,
        hideLantern: true
      });
    }
  }

  function bindMapPanZoom() {
    const viewport = document.getElementById("fp-map-viewport");
    if (!viewport) return;

    viewport.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      isPanning = true;
      panMoved = false;
      panStartX = e.clientX - mapPanX;
      panStartY = e.clientY - mapPanY;
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener("pointermove", (e) => {
      if (!isPanning) return;
      const nx = e.clientX - panStartX;
      const ny = e.clientY - panStartY;
      if (Math.hypot(nx - mapPanX, ny - mapPanY) > 3) panMoved = true;
      mapPanX = Math.max(-180, Math.min(180, nx));
      mapPanY = Math.max(-140, Math.min(140, ny));
      renderCabinMap();
    });

    const stopPan = () => {
      isPanning = false;
      setTimeout(() => { panMoved = false; }, 20);
    };
    viewport.addEventListener("pointerup", stopPan);
    viewport.addEventListener("pointercancel", stopPan);

    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.14 : -0.14;
      mapZoom = Math.max(0.5, Math.min(1.65, mapZoom + delta));
      renderCabinMap();
    }, { passive: false });

    viewport.addEventListener("contextmenu", (e) => {
      if (!isOpen || isInputLocked()) return;
      if (getActivePlacingRoomCard()) {
        e.preventDefault();
        rotateSelectedRoom(1);
      }
    });
  }

  function bindEvents() {
    bindMapPanZoom();

    document.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      if (App.FieldBook && App.FieldBook.isOpen()) return;
      if (pendingDrawnCard) {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          dismissDrawn();
        } else if (e.code === "KeyD" || e.code === "KeyG" || e.code === "KeyR") {
          e.preventDefault();
        }
        return;
      }
      if (isInputLocked()) return;
      if (e.code === "KeyD") {
        if (isMidnightMapOnly()) return;
        e.preventDefault();
        handleDrawDeck();
      } else if (e.code === "KeyG") {
        e.preventDefault();
        openTrayModal();
      } else if (e.code === "KeyR") {
        if (isMidnightMapOnly()) return;
        e.preventDefault();
        rotateSelectedRoom(1);
      }
    });

    document.addEventListener("click", (e) => {
      if (!isOpen) return;
      if (e.target && e.target.id === "fp-drawn-spotlight" && pendingDrawnCard) {
        dismissDrawn();
        return;
      }
      const btn = e.target.closest("[data-table-action]");
      if (!btn) return;
      const act = btn.getAttribute("data-table-action");

      if (act === "stand-up") {
        if (anim.introStage !== "DONE" || anim.dealingCards) return;
        close(true);
        if (onStandUpCallback) onStandUpCallback();
      } else if (act === "draw-deck") {
        handleDrawDeck();
      } else if (act === "dismiss-drawn") {
        dismissDrawn();
      } else if (act === "open-book") {
        if (App.FieldBook) App.FieldBook.toggle();
      } else if (act === "inspect-tray") {
        openTrayModal();
      } else if (act === "close-tray-modal") {
        closeTrayModal();
      } else if (act === "rotate-room") {
        rotateSelectedRoom(1);
      } else if (act === "summon-harvester") {
        if (matchStateRef.setupPhase === "TURN_2_HARVESTER" && turnStep === 2) {
          playTurn2Harvester();
        }
      } else if (act === "zoom-in") {
        mapZoom = Math.min(1.65, mapZoom + 0.18);
        App.Audio.click();
        renderCabinMap();
      } else if (act === "zoom-out") {
        mapZoom = Math.max(0.5, mapZoom - 0.18);
        App.Audio.click();
        renderCabinMap();
      } else if (act === "zoom-reset") {
        mapZoom = 1.0;
        mapPanX = 0;
        mapPanY = 0;
        App.Audio.click();
        renderCabinMap();
      } else if (act === "retry-match") {
        App.Audio.click();
        resetTableMatch(matchStateRef);
        beginTableIntro();
        if (onStateChangeCallback) onStateChangeCallback();
      } else if (act === "spin-thief-wheel") {
        spinThiefWheel();
      } else if (act === "exit-lobby") {
        App.GameWorld.exitToLobby();
      }
    });
  }

  function init() {
    App.TableCanvas.init(document.getElementById("table-fp-canvas"));
    bindEvents();
  }

  App.TableView = {
    init,
    resetTableMatch,
    open,
    close,
    renderFrame,
    resolveNeighborBargain,
    isOpen: () => isOpen,
    isBusy: () => anim.introStage !== "DONE" || anim.dealingCards || anim.harvesterRisingNow || anim.rimRotating || anim.drawAnimating || anim.shuffleAnimating || Boolean(pendingDrawnCard) || thiefWheelActive || Boolean(anim.activeStep) || anim.stepQueue.length > 0
  };
})(window.Duskwood);
