/* ==========================================================================
   DUSKWOOD INN - Procedural 320x180 Pixel-Art Dead Forest & Abandoned Cabin
   No characters in background — atmospheric fog, cabin glow, fence & car.
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const W = 320;
  const H = 180;

  let canvas = null;
  let ctx = null;
  let staticLayer = null;
  let mistParticles = [];
  let ashParticles = [];

  // Deterministic PRNG so the forest & cabin stay consistent
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

  function drawSkyAndMountains(c, rng) {
    // Overcast desaturated twilight sky bands
    const bands = [
      [0, 14, "#5d625e"],
      [14, 16, "#696e67"],
      [30, 16, "#757970"],
      [46, 18, "#676b64"],
      [64, 24, "#535854"],
      [88, 92, "#242826"]
    ];
    bands.forEach(([y, h, col]) => px(c, 0, y, W, h, col));

    // Soft pixel clouds
    for (let i = 0; i < 18; i++) {
      const cx = rng() * W;
      const cy = 6 + rng() * 32;
      const cw = 26 + rng() * 54;
      const ch = 4 + rng() * 7;
      px(c, cx, cy, cw, ch, i % 2 === 0 ? "#7e8277" : "#626760");
      px(c, cx + 6, cy - 2, cw * 0.65, 3, "#898c80");
    }

    // Far misty mountain ridge
    for (let x = 0; x < W; x++) {
      const m1 = 44 + Math.sin(x * 0.032) * 11 + Math.sin(x * 0.085) * 5;
      px(c, x, m1, 1, 70, "#505652");
      const m2 = 54 + Math.sin(x * 0.047 + 1.8) * 10 + Math.cos(x * 0.11) * 4;
      px(c, x, m2, 1, 70, "#3e4441");
    }
  }

  function drawPineTree(c, cx, baseY, height, color) {
    for (let i = 0; i < height; i++) {
      const ratio = i / height;
      const halfW = Math.max(1, Math.floor(ratio * (height * 0.34)) - (i % 4 === 0 ? 1 : 0));
      px(c, cx - halfW, baseY - height + i, halfW * 2 + 1, 1, color);
    }
  }

  function drawDeadBranch(c, x, y, dx, dy, steps, color) {
    let cx = x;
    let cy = y;
    for (let i = 0; i < steps; i++) {
      px(c, cx, cy, 1, 1, color);
      cx += dx;
      cy += dy;
    }
  }

  function drawDeadForest(c, rng) {
    // Back silhouettes of dead conifers
    for (let x = -4; x < W + 6; x += 13) {
      const h = 38 + Math.floor(rng() * 34);
      drawPineTree(c, x + rng() * 6, 128, h, "#2c312e");
    }

    // Midground darker conifers & gnarled leafless trees
    for (let x = 0; x < W + 8; x += 17) {
      const h = 36 + Math.floor(rng() * 38);
      drawPineTree(c, x + rng() * 7, 136, h, "#1e2220");
    }

    // Bare dead twisted trees flanking cabin & right horizon
    const deadSpots = [14, 46, 168, 206, 252, 286, 308];
    deadSpots.forEach((tx) => {
      const trunkH = 44 + Math.floor(rng() * 34);
      const baseY = 136;
      px(c, tx, baseY - trunkH, 3, trunkH, "#141716");
      px(c, tx + 1, baseY - trunkH, 1, trunkH, "#1f2321");

      // Gnarled branches
      for (let b = 0; b < 5; b++) {
        const by = baseY - trunkH + 6 + b * 7;
        const dir = b % 2 === 0 ? -1 : 1;
        const len = 10 + Math.floor(rng() * 14);
        drawDeadBranch(c, tx + 1, by, dir * 0.85, -0.55, len, "#141716");
        drawDeadBranch(
          c,
          tx + 1 + dir * len * 0.5,
          by - len * 0.25,
          dir * 0.5,
          -0.8,
          7,
          "#141716"
        );
      }
    });
  }

  function drawAbandonedCabin(c, rng) {
    const x = 18;
    const y = 78;

    // Ground shadow
    px(c, x - 6, y + 60, 114, 8, "#101311");

    // Cabin main dark timber walls
    px(c, x + 8, y + 20, 88, 42, "#24221e");
    for (let row = 0; row < 42; row += 4) {
      px(c, x + 8, y + 20 + row, 88, 1, "#171512");
      px(c, x + 8, y + 21 + row, 88, 1, "#2f2c26");
    }

    // Side wing / shadowed depth
    px(c, x + 64, y + 22, 32, 40, "#191815");
    for (let row = 0; row < 40; row += 4) {
      px(c, x + 64, y + 22 + row, 32, 1, "#11100e");
    }

    // Pitched sagging roof
    for (let i = 0; i < 24; i++) {
      const rw = 16 + i * 3.8;
      const rx = x + 36 - i * 1.45;
      px(c, rx, y - 2 + i, Math.min(rw, 102), 1, i % 3 === 0 ? "#181916" : "#252621");
    }
    // Roof ridge + stone chimney
    px(c, x + 62, y - 8, 9, 18, "#292a27");
    px(c, x + 61, y - 9, 11, 2, "#393b36");
    px(c, x + 63, y - 7, 3, 14, "#363834");

    // Broken porch door on right half of cabin
    px(c, x + 70, y + 36, 15, 26, "#100f0d");
    px(c, x + 71, y + 37, 13, 25, "#1d1a16");
    px(c, x + 72, y + 38, 11, 23, "#131210");
    px(c, x + 70, y + 35, 16, 2, "#35312a");

    // Moss & creeping vines hanging over roof and walls
    for (let v = 0; v < 26; v++) {
      const vx = x + 10 + Math.floor(rng() * 82);
      const vy = y + 8 + Math.floor(rng() * 24);
      const vLen = 5 + Math.floor(rng() * 16);
      for (let k = 0; k < vLen; k++) {
        px(c, vx + ((k % 3) - 1), vy + k, 2, 1, k % 2 === 0 ? "#2f3d28" : "#445435");
      }
    }

    // Window frame (glow itself animated dynamically)
    px(c, x + 23, y + 33, 16, 16, "#14120f");
    px(c, x + 24, y + 34, 14, 14, "#382f1b");
  }

  function drawGroundAndFence(c, rng) {
    // Foggy mud & dead grass ground plane
    px(c, 0, 136, W, 44, "#1a1e1b");
    px(c, 0, 142, W, 38, "#151816");
    px(c, 0, 156, W, 24, "#0f1210");

    // Grass tufts & dead reeds across ground
    for (let i = 0; i < 160; i++) {
      const gx = Math.floor(rng() * W);
      const gy = 136 + Math.floor(rng() * 42);
      const gh = 2 + Math.floor(rng() * 5);
      px(c, gx, gy - gh, 1, gh, i % 3 === 0 ? "#2c3328" : "#111512");
    }

    // Broken wooden fence bottom-left
    const posts = [
      [8, 152, 22, 0],
      [22, 154, 21, 0],
      [36, 156, 20, 1],
      [50, 158, 19, 1],
      [64, 161, 18, 2],
      [80, 166, 14, 4]
    ];
    // Fence horizontal rails
    for (let i = 0; i < 84; i++) {
      const ry = 158 + Math.floor(i * 0.14);
      px(c, 6 + i, ry, 2, 2, "#29221b");
      px(c, 6 + i, ry + 7, 2, 2, "#1f1914");
    }
    posts.forEach(([fx, fy, fh, tilt]) => {
      for (let p = 0; p < fh; p++) {
        const shift = Math.floor((p / fh) * tilt);
        px(c, fx + shift, fy + p, 3, 1, "#17130f");
        px(c, fx + shift + 1, fy + p, 1, 1, "#382d23");
      }
    });
  }

  function drawRustedCar(c, rng) {
    // Overgrown rusted sedan in bottom-right (no characters!)
    const x = 208;
    const y = 140;

    // Ground shadow
    px(c, x + 2, y + 26, 92, 7, "#090b0a");

    // Lower body chassis
    px(c, x + 4, y + 12, 86, 14, "#3b2c25");
    px(c, x + 4, y + 12, 86, 3, "#4e3c32");
    px(c, x + 6, y + 22, 82, 3, "#241b17");

    // Cabin roof & pillars
    px(c, x + 24, y + 2, 42, 11, "#332620");
    px(c, x + 26, y + 1, 38, 2, "#4b3b31");

    // Broken dark windows
    px(c, x + 28, y + 4, 15, 7, "#111517");
    px(c, x + 46, y + 4, 16, 7, "#14191b");
    px(c, x + 31, y + 5, 4, 2, "#2b3336");

    // Rusted hood cracks & bumper
    px(c, x + 2, y + 20, 7, 4, "#2d2f30");
    px(c, x + 86, y + 20, 6, 4, "#2d2f30");
    px(c, x + 6, y + 15, 4, 3, "#6b5432"); // Dead headlight bezel

    // Flat tires
    px(c, x + 15, y + 20, 13, 10, "#121314");
    px(c, x + 18, y + 22, 7, 6, "#2c2e30");
    px(c, x + 64, y + 20, 13, 10, "#121314");
    px(c, x + 67, y + 22, 7, 6, "#2c2e30");

    // Rust patches & overgrown vines on car
    for (let i = 0; i < 22; i++) {
      const rx = x + 8 + Math.floor(rng() * 76);
      const ry = y + 3 + Math.floor(rng() * 20);
      px(c, rx, ry, 3, 2, i % 2 === 0 ? "#5a3220" : "#304028");
    }

    // Foreground dead weeds silhouette along bottom edge
    for (let wx = 0; wx < W; wx += 4) {
      const wh = 4 + Math.floor(rng() * 10);
      px(c, wx, H - wh, 2, wh, "#0a0c0b");
    }
  }

  function buildStaticScene() {
    staticLayer = document.createElement("canvas");
    staticLayer.width = W;
    staticLayer.height = H;
    const sctx = staticLayer.getContext("2d");
    sctx.imageSmoothingEnabled = false;

    const rng = createRng(90421);
    drawSkyAndMountains(sctx, rng);
    drawDeadForest(sctx, rng);
    drawAbandonedCabin(sctx, rng);
    drawGroundAndFence(sctx, rng);
    drawRustedCar(sctx, rng);
  }

  function initParticles() {
    mistParticles = [];
    for (let i = 0; i < 14; i++) {
      mistParticles.push({
        x: Math.random() * W,
        y: 118 + Math.random() * 44,
        w: 44 + Math.random() * 76,
        h: 5 + Math.random() * 7,
        speed: 2.5 + Math.random() * 4.5,
        alpha: 0.04 + Math.random() * 0.06
      });
    }

    ashParticles = [];
    for (let i = 0; i < 28; i++) {
      ashParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: -4 - Math.random() * 6,
        vy: 5 + Math.random() * 9,
        size: Math.random() > 0.72 ? 2 : 1,
        alpha: 0.25 + Math.random() * 0.45
      });
    }
  }

  function init(canvasEl) {
    canvas = canvasEl;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    buildStaticScene();
    initParticles();
  }

  function render(timeSec, dt) {
    if (!ctx || !staticLayer) return;

    ctx.drawImage(staticLayer, 0, 0);

    // Warm flickering lantern glow inside the cabin window
    const flicker =
      0.86 +
      Math.sin(timeSec * 6.5) * 0.07 +
      Math.sin(timeSec * 15.3) * 0.05;

    const wx = 42;
    const wy = 112;

    // Soft halo outside window
    const grad = ctx.createRadialGradient(wx + 7, wy + 7, 2, wx + 7, wy + 7, 34);
    grad.addColorStop(0, `rgba(245, 198, 108, ${0.32 * flicker})`);
    grad.addColorStop(1, "rgba(245, 198, 108, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(wx - 28, wy - 28, 70, 70);

    // Window panes
    ctx.fillStyle = flicker > 0.88 ? "#e8c474" : "#cfa858";
    ctx.fillRect(wx, wy, 14, 14);
    ctx.fillStyle = "#fff1b8";
    ctx.fillRect(wx + 2, wy + 2, 4, 4);
    ctx.fillRect(wx + 8, wy + 8, 4, 4);

    // Cross muntins
    ctx.fillStyle = "#1a1712";
    ctx.fillRect(wx + 6, wy, 2, 14);
    ctx.fillRect(wx, wy + 6, 14, 2);

    // Optional drifting mist & falling ash
    const showParticles = App.Config ? App.Config.state.options.particles : true;
    if (!showParticles) return;

    mistParticles.forEach((m) => {
      m.x += m.speed * dt;
      if (m.x > W + 10) m.x = -m.w - 10;
      ctx.fillStyle = `rgba(182, 192, 186, ${m.alpha})`;
      ctx.fillRect(Math.floor(m.x), Math.floor(m.y), Math.floor(m.w), Math.floor(m.h));
    });

    ashParticles.forEach((a) => {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.y > H) {
        a.y = -2;
        a.x = Math.random() * (W + 40);
      }
      if (a.x < -4) a.x = W + 2;
      ctx.fillStyle = `rgba(205, 212, 216, ${a.alpha})`;
      ctx.fillRect(Math.floor(a.x), Math.floor(a.y), a.size, a.size);
    });
  }

  App.Background = { init, render };
})(window.Duskwood);
