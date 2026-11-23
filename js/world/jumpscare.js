/* ==========================================================================
   DUSKWOOD INN - Fullscreen High-Impact Pixel-Art Jumpscare Engine
   - Shared SFX: audio/jumpscare.mp3 (4.0 seconds) via App.Audio.playJumpscare()
   - 9 Bespoke Animated Pixel-Art Monster Jumpscares (1 per Event Monster):
       1. corner_man      (Cutting Corners)
       2. attic_stalker   (The Attic — Spectral Ghost)
       3. tall_man        (The Tall Man — Eyeless Monstrosity)
       4. balloon_stalker (Red Balloons — Jack-in-the-Box Clown)
       5. ceiling_crawler (Feeling Small? — Stringed Marionette Puppet)
       6. giant_monkey    (Musical Rooms — Giant Cymbal Monkey)
       7. sparky          (The Basement — Tall Chainsaw-Head Monster)
       8. shadow_hunter   (Stay in the Light — Glowing 4-Legged Shadow Beast)
       9. the_knight      (The Knight — Armored Knight Broadsword Slash)
   - Maximum Startle Design:
       * Frame-0 instant blackout -> blinding strobe cut -> violent lunge zoom
         (0.62x -> 1.34x in 85ms) right into the player's face!
       * 24fps 3-frame animated jaws/eyes/claws/blades + violent snap shake +
         micro-tilt + horizontal VHS glitch tears + RGB chromatic split +
         blood-red/white strobe flashes -> crunching static blackout!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const OUT_W = 240;
  const OUT_H = 135;
  const ART_W = 160;
  const ART_H = 112;

  const ACTIVE_DURATION = 1.65; // Intense animated pixel lunge & thrash
  const TOTAL_DURATION  = 2.08; // Static crunch & blackout cut (jumpscare.mp3 rings 4s)

  // Offscreen crisp pixel-art monster portrait buffer
  const artCanvas = document.createElement("canvas");
  artCanvas.width = ART_W;
  artCanvas.height = ART_H;
  const actx = artCanvas.getContext("2d");
  actx.imageSmoothingEnabled = false;

  // Secondary buffer for horizontal VHS glitch-tear & chromatic RGB split pass
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = OUT_W;
  tmpCanvas.height = OUT_H;
  const tctx = tmpCanvas.getContext("2d");
  tctx.imageSmoothingEnabled = false;

  let active = false;
  let monsterId = "corner_man";
  let elapsed = 0;
  let onCompleteCb = null;

  function px(c, x, y, w, h, col) {
    c.fillStyle = col;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function ell(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    const iry = Math.ceil(ry);
    for (let dy = -iry; dy <= iry; dy++) {
      const r = 1 - (dy * dy) / (ry * ry);
      if (r < 0) continue;
      const sp = Math.floor(rx * Math.sqrt(r));
      c.fillRect(Math.floor(cx - sp), Math.floor(cy + dy), sp * 2 + 1, 1);
    }
  }

  function tri(c, x1, y1, x2, y2, x3, y3, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(Math.round(x1), Math.round(y1));
    c.lineTo(Math.round(x2), Math.round(y2));
    c.lineTo(Math.round(x3), Math.round(y3));
    c.closePath();
    c.fill();
  }

  function drawDitherShade(c, x, y, w, h, col) {
    c.fillStyle = col;
    for (let yy = Math.floor(y); yy < y + h; yy += 2) {
      const off = (yy % 4 === 0) ? 0 : 1;
      for (let xx = Math.floor(x) + off; xx < x + w; xx += 2) {
        c.fillRect(xx, yy, 1, 1);
      }
    }
  }

  // ==================== 1. THE CORNER MAN (CUTTING CORNERS) ====================
  function drawCornerManArt(c, frame, t) {
    const jaw = frame === 1 ? 10 : frame === 2 ? 6 : 2;
    const eyeJit = frame === 2 ? 1 : frame === 1 ? -1 : 0;

    // Claustrophobic dark hallway corner snapping behind him
    px(c, 0, 0, 80, ART_H, "#140b0b");
    px(c, 80, 0, 80, ART_H, "#0c0708");
    px(c, 79, 0, 2, ART_H, "#040203");
    // Peeling vertical wallpaper stripes
    for (let x = 6; x < ART_W; x += 14) {
      px(c, x, 0, 2, ART_H, "rgba(45, 22, 22, 0.35)");
    }

    // Hunched dark shoulders & twisted neck snapping 180 deg backward!
    ell(c, 80, 114, 58, 28, "#161a16");
    ell(c, 80, 112, 48, 22, "#242922");
    px(c, 69, 82, 22, 24, "#6e564e");
    px(c, 72, 84, 4, 20, "#3b2926");
    px(c, 84, 84, 4, 20, "#3b2926");

    // Stretched corpse-pale twisted head lunging straight at the lens
    ell(c, 80, 52, 40, 44, "#080506");
    ell(c, 80, 52, 37, 41, "#b8a89a");
    ell(c, 80, 48, 32, 34, "#cfc0b2");
    ell(c, 80, 40, 24, 18, "#ded2c6");
    drawDitherShade(c, 46, 56, 68, 34, "rgba(38, 20, 22, 0.35)");

    // Wild messy dark hair crowning forehead
    ell(c, 80, 18, 39, 16, "#140e0c");
    for (let i = 0; i < 9; i++) {
      tri(c, 44 + i * 9, 18, 49 + i * 9, 32 + (i % 3) * 4, 54 + i * 9, 18, "#140e0c");
    }

    // Deep sunken pitch-black eye sockets + piercing wide white sclera & pinhole pupils!
    ell(c, 62, 46, 13, 10, "#12090b");
    ell(c, 98, 46, 13, 10, "#12090b");
    ell(c, 62, 46, 10, 7, "#f7f4ec");
    ell(c, 98, 46, 10, 7, "#f7f4ec");
    // Bloodshot eye corners
    px(c, 53, 45, 3, 2, "#a81924");
    px(c, 104, 45, 3, 2, "#a81924");
    // Hypnotic pinpoint staring pupils darting violently
    px(c, 61 + eyeJit, 45, 3, 3, "#060405");
    px(c, 97 - eyeJit, 45, 3, 3, "#060405");
    px(c, 62 + eyeJit, 46, 1, 1, frame === 1 ? "#ff2626" : "#ffffff");
    px(c, 98 - eyeJit, 46, 1, 1, frame === 1 ? "#ff2626" : "#ffffff");

    // Stretched cheek-to-cheek pitch-black shrieking grin!
    ell(c, 80, 74 + jaw * 0.4, 29, 12 + jaw, "#090204");
    ell(c, 80, 75 + jaw * 0.4, 25, 9 + jaw * 0.85, "#1a0408");
    // Uncanny cramped rows of sharp yellowed teeth (upper & lower)
    for (let tx = 56; tx <= 102; tx += 5) {
      const th = 5 + ((tx * 7) % 3);
      px(c, tx, 64 - jaw * 0.15, 4, th, "#ebe2cc");
      px(c, tx + 1, 64 - jaw * 0.15, 2, th - 2, "#fffbf0");
      px(c, tx, 80 + jaw * 0.8 - th, 4, th, "#d9ceb4");
    }

    // Clawed pale hands slamming onto both sides of the screen!
    const handIn = frame === 1 ? 8 : frame === 2 ? 14 : 2;
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 12 + handIn : ART_W - 12 - handIn;
      ell(c, bx, 96, 14, 18, "#8c7a6e");
      for (let f = 0; f < 4; f++) {
        const fx = bx + side * (4 + f * 3);
        const fy = 66 + f * 5;
        px(c, fx - 2, fy, 4, 24, "#a89688");
        px(c, fx - 1, fy - 4, 2, 5, "#1c1210"); // Sharp blackened fingernails
      }
    }
  }

  // ==================== 2. ATTIC GHOST (THE ATTIC) ====================
  function drawAtticGhostArt(c, frame, t) {
    const shriek = frame === 1 ? 9 : frame === 2 ? 5 : 1;
    const hairWhip = frame === 1 ? -4 : frame === 2 ? 4 : 0;

    // Cold spectral abyss backdrop
    px(c, 0, 0, ART_W, ART_H, "#04050a");
    ell(c, 80, 56, 74, 58, "#0b0e18");

    // Massive cascading tangle of pitch-black pixel hair filling the frame
    ell(c, 80, 58, 56, 56, "#06050a");
    for (let i = 0; i < 16; i++) {
      const hx = 22 + i * 8 + hairWhip;
      px(c, hx, 10 + (i % 4) * 5, 6, 98, i % 2 === 0 ? "#090810" : "#12101c");
    }

    // Corpse-pale blue-grey floating spectral face
    ell(c, 80, 54, 34, 42, "#07060b");
    ell(c, 80, 54, 31, 39, "#9aa5b5");
    ell(c, 80, 48, 25, 29, "#bcc6d6");
    ell(c, 80, 42, 18, 14, "#d8e1ed");
    drawDitherShade(c, 50, 58, 60, 32, "rgba(18, 22, 36, 0.38)");

    // Hollow weeping black eye voids with eerie glowing spectral pinpoint dots & dark tear streaks
    ell(c, 65, 48, 10, 13, "#050408");
    ell(c, 95, 48, 10, 13, "#050408");
    // Black ichor weeping down cheeks
    px(c, 63, 58, 4, 16 + frame * 3, "#100f18");
    px(c, 93, 58, 4, 15 + frame * 2, "#100f18");
    px(c, 65, 48, 2, 2, "#eef6ff");
    px(c, 95, 48, 2, 2, "#eef6ff");
    if (frame === 1) {
      px(c, 64, 47, 4, 4, "rgba(180, 225, 255, 0.5)");
      px(c, 94, 47, 4, 4, "rgba(180, 225, 255, 0.5)");
    }

    // Unhinged screaming pitch-black oval jaw!
    ell(c, 80, 76 + shriek * 0.3, 17 + frame * 2, 16 + shriek, "#040308");
    ell(c, 80, 76 + shriek * 0.3, 12 + frame, 11 + shriek * 0.8, "#140812");
    for (let tx = 68; tx <= 90; tx += 4) {
      px(c, tx, 64, 2, 5, "#cdd6e3");
      px(c, tx, 86 + shriek * 0.6, 2, 4, "#aeb8c7");
    }

    // Draped black hair strands whipping right across forehead & cheeks!
    for (let s = 0; s < 6; s++) {
      const sx = 54 + s * 11 + (s % 2 === 0 ? hairWhip : -hairWhip);
      px(c, sx, 12, 3, 28 + (s % 3) * 14, "#07060c");
    }

    // Outstretched bony spectral claws tearing toward the camera!
    const lunge = frame === 1 ? 12 : frame === 2 ? 6 : 0;
    for (const side of [-1, 1]) {
      const hx = side < 0 ? 18 + lunge : ART_W - 18 - lunge;
      ell(c, hx, 92, 12, 16, "#8d98a8");
      for (let f = 0; f < 4; f++) {
        const fx = hx + side * (2 + f * 4);
        const fy = 54 + f * 6 - lunge * 0.5;
        px(c, fx - 2, fy, 4, 30, "#b4bfcf");
        px(c, fx - 1, fy - 6, 2, 7, "#1b1c26");
      }
    }
  }

  // ==================== 3. THE TALL MAN (EYELESS MONSTROSITY) ====================
  function drawTallManArt(c, frame, t) {
    const maw = frame === 1 ? 14 : frame === 2 ? 8 : 3;

    // Pitch dark cabin void + stark overhead bulb flare behind his towering silhouette
    px(c, 0, 0, ART_W, ART_H, "#050407");
    ell(c, 80, 30, 68, 42, "rgba(180, 170, 150, 0.14)");

    // Towering black tattered coat shoulders looming across full bottom
    tri(c, -10, ART_H, 80, 68, ART_W + 10, ART_H, "#0a080d");
    px(c, 22, 84, 116, 28, "#14111a");

    // Unnaturally elongated smooth pale EYELESS head!
    ell(c, 80, 52, 34, 52, "#09070b");
    ell(c, 80, 52, 31, 49, "#bfb4a6");
    ell(c, 80, 44, 26, 38, "#d4cac0");
    ell(c, 80, 32, 18, 18, "#e6ded4");

    // DEEP HOLLOW BRUISED EYELESS INDENTATIONS (STRICTLY ZERO EYES!)
    ell(c, 65, 42, 11, 8, "#8c7f73");
    ell(c, 95, 42, 11, 8, "#8c7f73");
    ell(c, 65, 43, 8, 5, "#6b5e54");
    ell(c, 95, 43, 8, 5, "#6b5e54");
    // Stretched vertical skin creases over empty eye hollows
    px(c, 61, 39, 8, 1, "#574b42");
    px(c, 91, 39, 8, 1, "#574b42");
    px(c, 62, 46, 7, 1, "#574b42");
    px(c, 92, 46, 7, 1, "#574b42");

    // GIGANTIC VERTICAL SPLITTING JAGGED FANG MAW!
    ell(c, 80, 74 + maw * 0.25, 22 + frame * 2, 18 + maw, "#0d0406");
    ell(c, 80, 75 + maw * 0.25, 17 + frame * 2, 14 + maw * 0.85, "#2b080d");
    // Needle-like jagged fangs ripping downward & upward!
    for (let tx = 62; tx <= 96; tx += 5) {
      const len = 7 + ((tx * 3) % 5);
      tri(c, tx, 58 - maw * 0.1, tx + 2, 58 + len, tx + 4, 58 - maw * 0.1, "#ece3d5");
      tri(c, tx, 90 + maw * 0.75, tx + 2, 90 + maw * 0.75 - len, tx + 4, 90 + maw * 0.75, "#d6cab8");
    }

    // Absurdly long pale spider-clawed fingers lunging inward from both sides!
    const reach = frame === 1 ? 16 : frame === 2 ? 10 : 3;
    for (const side of [-1, 1]) {
      for (let f = 0; f < 4; f++) {
        const y0 = 18 + f * 20;
        const xTip = side < 0 ? 34 + reach + (f % 2) * 8 : ART_W - 34 - reach - (f % 2) * 8;
        const xBase = side < 0 ? -4 : ART_W + 4;
        tri(c, xBase, y0 - 4, xBase, y0 + 5, xTip, y0 + 2, "#8f837a");
        tri(c, xBase, y0 - 2, xBase, y0 + 3, xTip, y0 + 2, "#c7bbb0");
        px(c, xTip - (side > 0 ? 4 : 0), y0 + 1, 4, 2, "#1c1214");
      }
    }
  }

  // ==================== 4. JACK-IN-THE-BOX CLOWN (RED BALLOONS) ====================
  function drawClownBoxArt(c, frame, t) {
    const snap = frame === 1 ? 11 : frame === 2 ? 6 : 2;
    const tilt = frame === 1 ? -3 : frame === 2 ? 3 : 0;

    // Dark crimson carnival tent stripes behind
    px(c, 0, 0, ART_W, ART_H, "#120306");
    for (let x = 0; x < ART_W; x += 18) {
      px(c, x, 0, 9, ART_H, "#26080e");
    }

    // Coiled steel spring bursting upward from below
    for (let sy = 92; sy < ART_H; sy += 5) {
      px(c, 58 + (sy % 10 === 0 ? -4 : 4), sy, 44, 3, "#7a8594");
      px(c, 62 + (sy % 10 === 0 ? -4 : 4), sy, 36, 1, "#dce6f2");
    }

    // Dual-pronged tattered red/blue Jester Hat with golden bells!
    tri(c, 52, 26, 14 + tilt, 6, 38, 48, "#a81924");
    tri(c, 108, 26, 146 + tilt, 6, 122, 48, "#1c4875");
    ell(c, 16 + tilt, 10, 7, 7, "#ffdb5c");
    ell(c, 144 + tilt, 10, 7, 7, "#ffdb5c");

    // Ruffled blood-stained jester collar
    for (let cx = 34; cx <= 126; cx += 12) {
      ell(c, cx, 98, 10, 8, "#ded6c8");
    }

    // Cracked white porcelain clown skull
    ell(c, 80, 56, 42, 40, "#120608");
    ell(c, 80, 56, 39, 37, "#f0eae0");
    ell(c, 80, 48, 33, 28, "#ffffff");
    // Jagged porcelain cracks across forehead & cheek
    px(c, 66, 20, 2, 10, "#24191c");
    px(c, 68, 30, 2, 8, "#24191c");
    px(c, 102, 58, 8, 2, "#24191c");

    // Sharp black painted diamond eye-makeup + blazing crimson pupils!
    for (const ex of [62, 98]) {
      tri(c, ex, 30, ex - 12, 46, ex + 12, 46, "#14090d");
      tri(c, ex, 62, ex - 12, 46, ex + 12, 46, "#14090d");
      ell(c, ex, 46, 5, 5, "#ffffff");
      ell(c, ex + (frame === 2 ? 1 : -1), 46, 3, 3, "#ff1e26");
      px(c, ex, 45, 1, 1, "#fff6b8");
    }

    // Glossy giant crimson bulb nose
    ell(c, 80, 58, 10, 9, "#4a060c");
    ell(c, 80, 58, 8, 7, "#e01b28");
    ell(c, 77, 55, 3, 2, "#ff8c94");

    // Huge crimson-painted shark-toothed snapping grin!
    ell(c, 80, 78 + snap * 0.3, 31, 12 + snap, "#9e111d");
    ell(c, 80, 78 + snap * 0.3, 26, 9 + snap * 0.85, "#140306");
    for (let tx = 57; tx <= 101; tx += 6) {
      tri(c, tx, 70 - snap * 0.1, tx + 3, 79 + snap * 0.25, tx + 6, 70 - snap * 0.1, "#f7f0dc");
      tri(c, tx, 86 + snap * 0.8, tx + 3, 78 + snap * 0.55, tx + 6, 86 + snap * 0.8, "#e3d8be");
    }
  }

  // ==================== 5. THE PUPPET (FEELING SMALL?) ====================
  function drawPuppetArt(c, frame, t) {
    const jawDrop = frame === 1 ? 14 : frame === 2 ? 8 : 2;
    const strShake = frame === 1 ? -3 : frame === 2 ? 3 : 0;

    px(c, 0, 0, ART_W, ART_H, "#080407");

    // Taut glistening marionette strings snapping violently from the ceiling!
    for (const [x0, x1] of [[24, 46], [56, 62], [80, 80], [104, 98], [136, 114]]) {
      c.strokeStyle = frame === 1 ? "#ffffff" : "#cfc6b8";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x0 + strShake, 0);
      c.lineTo(x1, 56);
      c.stroke();
    }

    // Striped crimson/gold puppet shoulders
    px(c, 34, 90, 92, 24, "#5c121b");
    for (let sx = 42; sx < 120; sx += 14) px(c, sx, 90, 5, 24, "#bfa04c");

    // Cracked antique wooden ventriloquist puppet head!
    ell(c, 80, 54, 38, 44, "#140b08");
    ell(c, 80, 54, 35, 41, "#d9c6a5");
    ell(c, 80, 46, 29, 31, "#ede0c7");
    // Painted glossy wooden sheen & deep fracture crack down left brow
    px(c, 68, 14, 2, 12, "#2e1c14");
    px(c, 70, 26, 2, 10, "#2e1c14");
    px(c, 68, 36, 2, 8, "#2e1c14");

    // Bright circular painted red puppet cheeks
    ell(c, 52, 62, 7, 6, "#cc3542");
    ell(c, 108, 62, 7, 6, "#cc3542");

    // Hollow black eye cavities with blazing red pinpoint LED-like glare
    ell(c, 64, 46, 10, 12, "#090406");
    ell(c, 96, 46, 10, 12, "#090406");
    ell(c, 64, 46, 3, 3, "#ff2424");
    ell(c, 96, 46, 3, 3, "#ff2424");
    px(c, 64, 45, 1, 1, "#fff2b8");
    px(c, 96, 45, 1, 1, "#fff2b8");

    // Iconic HINGED WOODEN DUMMY JAW snapped straight down!
    px(c, 58, 64, 44, 26 + jawDrop, "#120608");
    // Deep vertical hinge seams slicing down both sides of the chin
    px(c, 57, 64, 3, 36 + jawDrop * 0.5, "#1a0e0a");
    px(c, 100, 64, 3, 36 + jawDrop * 0.5, "#1a0e0a");
    // Lower wooden chin block hanging open
    px(c, 60, 84 + jawDrop, 40, 12, "#c9b38f");
    px(c, 62, 86 + jawDrop, 36, 8, "#dfd0b4");
    // Square clacking wooden puppet teeth!
    for (let tx = 62; tx <= 94; tx += 7) {
      px(c, tx, 65, 5, 8, "#f5eedc");
      px(c, tx, 78 + jawDrop, 5, 7, "#e0d4bc");
    }
  }

  // ==================== 6. THE GIANT MONKEY (MUSICAL ROOMS) ====================
  function drawGiantMonkeyArt(c, frame, t) {
    const roar = frame === 1 ? 11 : frame === 2 ? 6 : 2;
    const cym = frame === 1 ? 12 : frame === 2 ? 20 : 2;

    px(c, 0, 0, ART_W, ART_H, "#120404");
    ell(c, 80, 58, 76, 54, "#290c0a");

    // Giant round monkey ears
    ell(c, 22, 54, 18, 20, "#381f12");
    ell(c, 22, 54, 10, 12, "#ad8664");
    ell(c, 138, 54, 18, 20, "#381f12");
    ell(c, 138, 54, 10, 12, "#ad8664");

    // Massive shaggy brown fur skull + crooked crimson fez hat!
    ell(c, 80, 58, 52, 48, "#140905");
    ell(c, 80, 58, 48, 44, "#4d2b18");
    ell(c, 80, 52, 42, 36, "#613821");
    // Crooked Red Fez & Gold Tassel
    px(c, 62, 4, 36, 16, "#8f141e");
    px(c, 64, 6, 32, 10, "#bd1e2b");
    px(c, 96, 10, 8, 5, "#ffdb5c");

    // Huge tan monkey muzzle
    ell(c, 80, 78, 40, 26, "#24120a");
    ell(c, 80, 78, 37, 23, "#c49f7a");
    ell(c, 80, 72, 31, 15, "#d9b894");

    // Huge unblinking bloodshot eyes with blazing crimson irises!
    for (const ex of [59, 101]) {
      ell(c, ex, 46, 14, 13, "#140808");
      ell(c, ex, 46, 11, 10, "#f5ecd8");
      ell(c, ex, 46, 6, 6, "#ff1c1c");
      ell(c, ex, 46, 2.5, 2.5, "#0d0404");
      px(c, ex + 2, 43, 2, 2, "#ffffff");
    }

    // Roaring wide jaws filled with giant ivory fangs & crimson tongue!
    ell(c, 80, 82 + roar * 0.2, 30, 14 + roar, "#140406");
    ell(c, 80, 89 + roar * 0.4, 18, 7, "#a82430");
    for (let tx = 54; tx <= 102; tx += 7) {
      px(c, tx, 70 - roar * 0.1, 5, 9, "#f7f0dc");
      px(c, tx, 86 + roar * 0.7, 5, 8, "#e6dcc2");
    }

    // Giant gleaming Brass Cymbals slamming inward from both edges!
    ell(c, -2 + cym, 92, 18, 32, "#8c6618");
    ell(c, -2 + cym, 92, 13, 24, "#f5cf5b");
    ell(c, ART_W + 2 - cym, 92, 18, 32, "#8c6618");
    ell(c, ART_W + 2 - cym, 92, 13, 24, "#f5cf5b");
  }

  // ==================== 7. CHAINSAW-HEAD MONSTER (THE BASEMENT) ====================
  function drawChainsawMonsterArt(c, frame, t) {
    const rev = frame === 1 ? -3 : frame === 2 ? 3 : 0;
    const toothShift = frame * 3;

    // Dark blood-spattered subterranean concrete backdrop
    px(c, 0, 0, ART_W, ART_H, "#100505");
    for (let y = 0; y < ART_H; y += 16) px(c, 0, y, ART_W, 1, "#241111");

    // Towering oil-stained shoulders & bloodied butcher apron behind
    px(c, 16, 76, 128, 38, "#1b1d22");
    px(c, 36, 80, 88, 34, "#3b2019");
    px(c, 48, 86, 22, 18, "#8c141c");

    // Industrial rusted-orange Chainsaw Motor Engine Skull!
    px(c, 34 + rev, 56, 92, 48, "#140a06");
    px(c, 38 + rev, 60, 84, 40, "#bf4215");
    px(c, 42 + rev, 62, 76, 8, "#e86e33");
    px(c, 48 + rev, 74, 64, 18, "#1a1c22");
    // Blazing furious crimson furnace eye-vents!
    ell(c, 62 + rev, 83, 8, 6, "#ff2222");
    ell(c, 98 + rev, 83, 8, 6, "#ff2222");
    px(c, 61 + rev, 82, 3, 2, "#fff0a8");
    px(c, 97 + rev, 82, 3, 2, "#fff0a8");

    // MASSIVE SPINNING STEEL CHAINSAW GUIDE BAR THRUSTING DEAD-CENTER INTO THE CAMERA!
    tri(c, 58 + rev, 76, 102 + rev, 76, 94 + rev, 4, "#6f7a87");
    tri(c, 58 + rev, 76, 66 + rev, 4, 94 + rev, 4, "#9aa6b5");
    // Blood-red groove down the center of the steel bar
    px(c, 75 + rev, 10, 10, 62, "#8c1119");
    px(c, 78 + rev, 10, 4, 62, "#c91c28");

    // Spinning razor-sharp white steel teeth along BOTH sides of the bar!
    for (let y = 6 + toothShift; y < 74; y += 10) {
      tri(c, 64 + rev, y, 52 + rev, y + 4, 64 + rev, y + 8, "#f5f9ff");
      tri(c, 96 + rev, y, 108 + rev, y + 4, 96 + rev, y + 8, "#f5f9ff");
    }

    // Flying orange/white electric sparks & crimson spray!
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 29 + frame * 37) % (ART_W - 12)) + 6;
      const sy = ((i * 19 + frame * 23) % (ART_H - 12)) + 6;
      px(c, sx, sy, 3, 2, i % 3 === 0 ? "#fff6b0" : i % 3 === 1 ? "#ff8826" : "#d91e28");
    }
  }

  // ==================== 8. GLOWING 4-LEGGED SHADOW BEAST (STAY IN THE LIGHT) ====================
  function drawShadowBeastArt(c, frame, t) {
    const snap = frame === 1 ? 13 : frame === 2 ? 7 : 2;
    const glowBright = frame === 1 ? "#ffffff" : "#78f0ff";

    // Pitch-black abyss + blinding bioluminescent cyan aura!
    px(c, 0, 0, ART_W, ART_H, "#02040a");
    ell(c, 80, 56, 72, 54, "rgba(48, 196, 255, 0.16)");
    ell(c, 80, 56, 52, 38, "rgba(110, 238, 255, 0.22)");

    // Swept razor-sharp predatory shadow ears
    tri(c, 28, 46, 12, 4, 58, 26, "#060912");
    tri(c, 132, 46, 148, 4, 102, 26, "#060912");
    tri(c, 26, 40, 17, 11, 50, 27, "#3ec8f5");
    tri(c, 134, 40, 143, 11, 110, 27, "#3ec8f5");

    // Predatory dark hound skull with electric cyan outline!
    ell(c, 80, 56, 48, 42, "#4edcff");
    ell(c, 80, 56, 45, 39, "#05070e");
    // Glowing cyan neural/vein lines across brow
    px(c, 79, 20, 2, 16, "#58e2ff");
    px(c, 64, 28, 14, 2, "#35a8d9");
    px(c, 82, 28, 14, 2, "#35a8d9");

    // BLINDING BIOLUMINESCENT SLIT EYES!
    ell(c, 58, 46, 14, 8, glowBright);
    ell(c, 102, 46, 14, 8, glowBright);
    px(c, 57, 40, 3, 12, "#06101c");
    px(c, 100, 40, 3, 12, "#06101c");

    // Wide fanged glowing beast jaws snapping straight at the camera!
    ell(c, 80, 78 + snap * 0.25, 36, 14 + snap, "#52e0ff");
    ell(c, 80, 78 + snap * 0.25, 33, 11 + snap * 0.85, "#03050a");
    for (let tx = 50; tx <= 106; tx += 9) {
      tri(c, tx, 68 - snap * 0.1, tx + 4, 81 + snap * 0.25, tx + 8, 68 - snap * 0.1, "#e6ffff");
      tri(c, tx, 89 + snap * 0.75, tx + 4, 78 + snap * 0.5, tx + 8, 89 + snap * 0.75, "#9cf2ff");
    }

    // Glowing cyan claw slashes ripping across the corners!
    if (frame !== 0) {
      c.strokeStyle = "#d9ffff";
      c.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(6 + k * 10, 6);
        c.lineTo(42 + k * 10, 52);
        c.stroke();
      }
    }
  }

  // ==================== 9. THE KNIGHT (ARMORED KNIGHT BROADSWORD SLASH) ====================
  function drawKnightArt(c, frame, t) {
    const slashShift = frame === 1 ? -10 : frame === 2 ? 12 : 0;

    // Dark blood-crimson medieval stone backdrop
    px(c, 0, 0, ART_W, ART_H, "#0d0305");
    ell(c, 80, 56, 74, 52, "#24080c");

    // Massive dark iron pauldrons filling the bottom corners
    ell(c, 26, 104, 34, 24, "#2c313b");
    ell(c, 134, 104, 34, 24, "#2c313b");
    ell(c, 26, 100, 26, 16, "#4f5866");
    ell(c, 134, 100, 26, 16, "#4f5866");

    // Crimson helm crest plume flaring behind helmet
    tri(c, 64, 20, 80, 0, 96, 20, "#a81824");

    // Towering battle-scarred Steel Great Helm filling the screen!
    px(c, 36, 18, 88, 88, "#101216");
    px(c, 40, 20, 80, 84, "#4b5361");
    px(c, 46, 20, 22, 84, "#677282"); // Left metallic bevel shine
    // Central reinforced steel nose ridge & rivets
    px(c, 75, 16, 10, 92, "#8d99ab");
    px(c, 78, 16, 4, 92, "#b8c4d6");
    for (const [rx, ry] of [[46, 28], [110, 28], [46, 94], [110, 94]]) {
      px(c, rx, ry, 4, 4, "#22262e");
      px(c, rx + 1, ry + 1, 2, 2, "#a3b0c2");
    }

    // Pitch-black horizontal visor slit with BLAZING FURNACE-RED EYES!
    px(c, 44, 46, 72, 18, "#070305");
    px(c, 46, 48, 68, 14, "#140407");
    ell(c, 62, 55, 10, 4, "#ff1e26");
    ell(c, 98, 55, 10, 4, "#ff1e26");
    px(c, 60, 54, 4, 2, "#fff2a8");
    px(c, 96, 54, 4, 2, "#fff2a8");

    // Vertical helmet breathing vents
    for (let vx = 50; vx <= 106; vx += 8) {
      if (vx > 70 && vx < 88) continue;
      px(c, vx, 72, 4, 22, "#0d0e12");
    }

    // GIGANTIC GLEAMING BROADSWORD SLASHING DIAGONALLY ACROSS THE CAMERA!
    c.save();
    c.fillStyle = frame === 1 ? "#ffffff" : "#dce6f2";
    c.beginPath();
    c.moveTo(148 + slashShift, -8);
    c.lineTo(164 + slashShift, 8);
    c.lineTo(24 + slashShift, ART_H + 8);
    c.lineTo(6 + slashShift, ART_H - 8);
    c.closePath();
    c.fill();

    c.fillStyle = "#ff2430";
    c.beginPath();
    c.moveTo(156 + slashShift, 2);
    c.lineTo(166 + slashShift, 10);
    c.lineTo(26 + slashShift, ART_H + 10);
    c.lineTo(18 + slashShift, ART_H + 2);
    c.closePath();
    c.fill();
    c.restore();
  }

  function renderMonsterPortrait(id, frame, t) {
    actx.clearRect(0, 0, ART_W, ART_H);
    if (id === "attic_stalker")        drawAtticGhostArt(actx, frame, t);
    else if (id === "tall_man")        drawTallManArt(actx, frame, t);
    else if (id === "balloon_stalker") drawClownBoxArt(actx, frame, t);
    else if (id === "ceiling_crawler") drawPuppetArt(actx, frame, t);
    else if (id === "giant_monkey")    drawGiantMonkeyArt(actx, frame, t);
    else if (id === "sparky")          drawChainsawMonsterArt(actx, frame, t);
    else if (id === "shadow_hunter")   drawShadowBeastArt(actx, frame, t);
    else if (id === "the_knight")      drawKnightArt(actx, frame, t);
    else                               drawCornerManArt(actx, frame, t);
  }

  // ==================== FULLSCREEN HIGH-IMPACT COMPOSITOR ====================
  function renderFrameToCanvas(outCanvas) {
    if (!outCanvas) return;
    if (outCanvas.width !== OUT_W || outCanvas.height !== OUT_H) {
      outCanvas.width = OUT_W;
      outCanvas.height = OUT_H;
    }
    const c = outCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    const t = elapsed;
    const isCyanMonster = monsterId === "shadow_hunter";
    const accentRgb = isCyanMonster ? "80, 230, 255" : "255, 22, 34";

    // 1. Frame-0 Instant Blackout Slam (0.00s -> 0.03s) -> Blinding Impact Strobe (0.03s -> 0.065s)!
    if (t < 0.028) {
      px(c, 0, 0, OUT_W, OUT_H, "#000000");
      return;
    }
    if (t < 0.062) {
      px(c, 0, 0, OUT_W, OUT_H, isCyanMonster ? "#ccfaff" : "#ffffff");
      return;
    }

    // 2. Final CRT Horror Static Crunch & Blackout Cut (ACTIVE_DURATION -> TOTAL_DURATION)
    if (t >= ACTIVE_DURATION) {
      const fadeFrac = Math.min(1, (t - ACTIVE_DURATION) / (TOTAL_DURATION - ACTIVE_DURATION));
      px(c, 0, 0, OUT_W, OUT_H, "#030204");
      if (fadeFrac < 0.72) {
        for (let y = 0; y < OUT_H; y += 2) {
          for (let x = 0; x < OUT_W; x += 3) {
            const v = Math.random();
            if (v > 0.62) {
              const b = Math.floor(v * 235 * (1 - fadeFrac));
              c.fillStyle = v > 0.93 ? `rgb(${b}, 20, 26)` : `rgb(${b}, ${b}, ${b})`;
              c.fillRect(x, y, 3, 2);
            }
          }
        }
      }
      return;
    }

    // 3. Draw animated 24fps 3-frame pixel-art monster into offscreen artCanvas
    const frame = Math.floor(t * 25) % 3;
    renderMonsterPortrait(monsterId, frame, t);

    // 4. Composite onto tmpCanvas with VIOLENT LUNGE ZOOM + HIGH-FREQUENCY SHAKE + MICRO-TILT!
    const lungeT = Math.min(1, (t - 0.06) / 0.11); // Slams forward in 110ms!
    const lungeEase = 1 - Math.pow(1 - lungeT, 3);
    const pulseZoom = 1.0 + Math.sin(t * 42) * 0.065 + (frame === 1 ? 0.08 : 0);
    const scale = (0.72 + lungeEase * 0.66) * pulseZoom; // Looms up to ~1.48x filling entire screen!

    const shakeMag = lungeT < 1 ? 16 : 11.5;
    const shakeX = Math.round((Math.random() * 2 - 1) * shakeMag);
    const shakeY = Math.round((Math.random() * 2 - 1) * (shakeMag * 0.78));
    const tiltRad = ((Math.random() * 2 - 1) * 6.5 * Math.PI) / 180;

    tctx.fillStyle = "#040204";
    tctx.fillRect(0, 0, OUT_W, OUT_H);

    // Radiating panic speed-lines behind the lunging monster!
    tctx.save();
    tctx.strokeStyle = frame === 1 ? `rgba(${accentRgb}, 0.55)` : "rgba(255, 255, 255, 0.22)";
    tctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + (t * 4);
      tctx.beginPath();
      tctx.moveTo(OUT_W / 2 + Math.cos(ang) * 28, OUT_H / 2 + Math.sin(ang) * 20);
      tctx.lineTo(OUT_W / 2 + Math.cos(ang) * 140, OUT_H / 2 + Math.sin(ang) * 100);
      tctx.stroke();
    }
    tctx.restore();

    const drawW = Math.round(ART_W * scale * 1.18);
    const drawH = Math.round(ART_H * scale * 1.18);

    tctx.save();
    tctx.translate(OUT_W / 2 + shakeX, OUT_H / 2 + shakeY);
    tctx.rotate(tiltRad);
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(artCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
    tctx.restore();

    // 5. Copy tmpCanvas to output with HORIZONTAL VHS GLITCH SLICES & CHROMATIC RGB SPLIT!
    c.drawImage(tmpCanvas, 0, 0);

    // Random jagged pixel horizontal tear slices
    const tearCount = frame === 1 ? 6 : 3;
    for (let s = 0; s < tearCount; s++) {
      const sy = Math.floor(Math.random() * (OUT_H - 12));
      const sh = 3 + Math.floor(Math.random() * 9);
      const shift = Math.round((Math.random() * 2 - 1) * 14);
      c.drawImage(tmpCanvas, 0, sy, OUT_W, sh, shift, sy, OUT_W, sh);
    }

    // Subtle red/cyan RGB offset ghosting on peak frames
    if (frame === 1) {
      c.save();
      c.globalAlpha = 0.22;
      c.globalCompositeOperation = "lighter";
      c.drawImage(tmpCanvas, -4, 0);
      c.drawImage(tmpCanvas, 4, 0);
      c.restore();
    }

    // 6. Rapid Horror Strobe Flashes (Crimson / White / Pitch-Black Impact Beats!)
    const strobeTick = Math.floor(t * 28);
    if (strobeTick === 2 || strobeTick === 7 || strobeTick === 15 || strobeTick === 26 || strobeTick === 36) {
      c.fillStyle = `rgba(${accentRgb}, 0.42)`;
      c.fillRect(0, 0, OUT_W, OUT_H);
    } else if (strobeTick === 4 || strobeTick === 19 || strobeTick === 31) {
      c.fillStyle = "rgba(255, 255, 255, 0.34)";
      c.fillRect(0, 0, OUT_W, OUT_H);
    }

    // Crisp CRT horror scanlines + closing blood-black vignette
    c.fillStyle = "rgba(0, 0, 0, 0.24)";
    for (let y = 0; y < OUT_H; y += 3) {
      c.fillRect(0, y, OUT_W, 1);
    }

    const vig = c.createRadialGradient(OUT_W / 2, OUT_H / 2, 26, OUT_W / 2, OUT_H / 2, 138);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.68, `rgba(${accentRgb}, 0.16)`);
    vig.addColorStop(1, "rgba(0,0,0,0.86)");
    c.fillStyle = vig;
    c.fillRect(0, 0, OUT_W, OUT_H);
  }

  // ==================== PUBLIC CONTROLLER API ====================
  function trigger(mId, opts) {
    active = true;
    monsterId = mId || "corner_man";
    elapsed = 0;
    onCompleteCb = (opts && typeof opts.onComplete === "function") ? opts.onComplete : null;

    // Immediately hide any open banner/modals so NOTHING obscures the jumpscare!
    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
    if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(true);
    if (App.Clues && App.Clues.isInspectOpen()) App.Clues.closeInspectModal(true);

    const stage = document.getElementById("pixel-jumpscare-stage");
    const cvs = document.getElementById("pixel-jumpscare-canvas");
    if (stage) stage.classList.remove("hidden");

    // Fire shared 4-second jumpscare.mp3 instantaneously on frame 0!
    if (App.Audio && App.Audio.playJumpscare) {
      App.Audio.playJumpscare(4.0);
    }

    if (cvs) renderFrameToCanvas(cvs);
  }

  function updateAndRender(dt) {
    if (!active) return;
    elapsed += Math.min(0.05, dt || 0.016);
    const cvs = document.getElementById("pixel-jumpscare-canvas");
    if (cvs) renderFrameToCanvas(cvs);

    if (elapsed >= TOTAL_DURATION) {
      const cb = onCompleteCb;
      active = false;
      onCompleteCb = null;
      document.getElementById("pixel-jumpscare-stage")?.classList.add("hidden");
      if (typeof cb === "function") cb();
    }
  }

  function stop() {
    active = false;
    elapsed = 0;
    onCompleteCb = null;
    document.getElementById("pixel-jumpscare-stage")?.classList.add("hidden");
    if (App.Audio && App.Audio.stopJumpscare) App.Audio.stopJumpscare();
  }

  App.Jumpscare = {
    trigger,
    updateAndRender,
    stop,
    isActive: () => active
  };
})(window.Duskwood);
