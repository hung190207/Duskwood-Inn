/* ==========================================================================
   DUSKWOOD INN - Match Loading Screen & Flickering Bulb Entry Cutscene
   Sequence:
   1. Lobby / Ending BGM stops immediately, audio assets warm up in background.
   2. Pure black Pixel Art Loading Screen displays:
        - Survival Tip (e.g. "TIME IS VALUABLE. CONSIDER NOT DYING.")
        - Crisp white horizontal pixel line with an animated Pixel Survivor
          sprinting ahead of the wire-frame Hollow Harvester + "Loading..."
   3. Loading Screen fades cleanly to pure black, then `audio/broken_light.mp3`
      (6s) plays while the overhead ceiling bulb flickers ON (2.0s -> 3.82s).
   4. Once steady (~4.15s), HUD fades in and player controls unlock!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let stage = "IDLE"; // IDLE | FADE_TO_LOAD | LOADING | DARK_INTRO | DONE
  let onRevealCallback = null;
  let hudRevealed = false;
  let fadeTimer = null;
  let loadTimer = null;
  let loadRafId = 0;
  let loadStartMs = 0;
  let tipIndex = 0;

  const LOADING_DURATION_MS = 2650;

  const LOADING_TIPS = [
    "TIME IS VALUABLE. CONSIDER NOT DYING.",
    "THE HOLLOW HARVESTER ALWAYS RISES AT XII. WATCH THE GROOVE.",
    "ONLY THE TOP CLUE CARD IN THE GRAVEYARD CAN MANIFEST.",
    "WHEN THE LIGHTS CUT OUT, FIND A CORNER AND READ CAREFULLY.",
    "IN THE ATTIC, DROP THE CANDLE [X] AND HIDE IN THE DARK.",
    "NO EYES MEANS HE SEES THROUGH YOURS. KILL EVERY LIGHT SWITCH.",
    "MOVE SLOW AND CROUCH [C] WHEN YOU HEAR THE CLOWN LAUGH.",
    "TRUST YOUR NOTES. AT 12:00 AM, ONLY ONE ROOM IS SAFE."
  ];

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function drawLoadingRunnerCanvas(timeSec) {
    const cvs = document.getElementById("loading-runner-canvas");
    if (!cvs) return;
    const c = cvs.getContext("2d");
    c.imageSmoothingEnabled = false;
    const W = cvs.width;  // 216
    const H = cvs.height; // 46
    const groundY = 39;

    c.clearRect(0, 0, W, H);

    // 1. Crisp solid pure-white horizontal ground line
    px(c, 4, groundY, W - 8, 2, "#ffffff");

    // 2. Subtle pixel-art speed dashes skimming backward across the white line
    for (let i = 0; i < 6; i++) {
      const sx = W - 10 - (((timeSec * 82 + i * 38) % (W - 20)));
      px(c, sx, groundY - 3 - (i % 2), 4, 1, "rgba(255,255,255,0.34)");
    }

    // 3. Running positions along the white line (smooth subtle chase oscillation!)
    const chaseBob = Math.sin(timeSec * 3.1) * 5;
    const playerX = 148 + Math.round(Math.sin(timeSec * 2.2) * 4);
    const harvX = 68 + Math.round(chaseBob);

    // 4. Pixel-Art Wire-Frame Hollow Harvester chasing behind on the white line!
    {
      const stride = Math.sin(timeSec * 12.5);
      const stepL = Math.round(stride * 3.5);
      const stepR = -stepL;
      const lunge = Math.abs(stride) > 0.55 ? -1 : 0;
      const hx = harvX;
      const hy = groundY;

      // Spindly wire legs pumping fast
      px(c, hx - 3 + stepL, hy - 11, 2, 11, "#d8d8df");
      px(c, hx - 1 + stepL, hy - 6,  2, 6,  "#ffffff");
      px(c, hx + 2 + stepR, hy - 11, 2, 11, "#9b9ba8");
      px(c, hx + 3 + stepR, hy - 6,  2, 6,  "#d8d8df");

      // Hunched wire-frame ribcage / arched spine leaning forward toward survivor!
      px(c, hx - 2, hy - 22 + lunge, 4, 12, "#ffffff");
      px(c, hx - 1, hy - 21 + lunge, 2, 10, "#0b0b0f");
      px(c, hx - 2, hy - 19 + lunge, 5, 1,  "#e8e8f0");
      px(c, hx - 2, hy - 16 + lunge, 5, 1,  "#e8e8f0");
      px(c, hx - 1, hy - 13 + lunge, 4, 1,  "#c8c8d4");

      // Long outstretched spindly wire arms reaching forward!
      const armReach = Math.round(Math.cos(timeSec * 12.5) * 2.2);
      px(c, hx + 2, hy - 21 + lunge, 9 + armReach, 2, "#ffffff");
      px(c, hx + 10 + armReach, hy - 19 + lunge, 2, 5, "#ffffff"); // Hooked reaching claw
      px(c, hx - 5 - armReach, hy - 20 + lunge, 4, 2, "#b5b5c2");
      px(c, hx - 6 - armReach, hy - 18 + lunge, 2, 6, "#b5b5c2");

      // Elongated hollow wire-frame head with bright glowing crimson eyes!
      px(c, hx + 1, hy - 31 + lunge, 8, 9, "#ffffff");
      px(c, hx + 2, hy - 30 + lunge, 6, 7, "#09090d");
      px(c, hx + 5, hy - 28 + lunge, 2, 2, "#ff3b3b"); // Piercing red eye!
      px(c, hx + 8, hy - 28 + lunge, 1, 2, "#ff6e6e");

      // Tiny trailing shadow wisps off Harvester
      if (Math.sin(timeSec * 18) > 0) {
        px(c, hx - 10, hy - 18, 2, 1, "rgba(255,255,255,0.45)");
        px(c, hx - 14, hy - 12, 3, 1, "rgba(255,70,70,0.45)");
      }
    }

    // 5. Pixel-Art Survivor sprinting briskly ahead on the white line!
    {
      const stride = Math.sin(timeSec * 14.0);
      const bob = Math.abs(stride) > 0.55 ? -1 : 0;
      const legA = Math.round(stride * 4);
      const legB = -legA;
      const armA = -Math.round(stride * 3);
      const armB = -armA;
      const sx = playerX;
      const sy = groundY;

      // Kick-up pixel dust behind runner's heels
      const dustPhase = (timeSec * 5.2) % 1;
      px(c, sx - 8 - Math.round(dustPhase * 10), sy - 2 - Math.round(dustPhase * 3), 2, 2, `rgba(255,255,255,${(0.7 * (1 - dustPhase)).toFixed(2)})`);
      px(c, sx - 13 - Math.round(dustPhase * 8), sy - 1 - Math.round(dustPhase * 2), 1, 1, `rgba(255,255,255,${(0.5 * (1 - dustPhase)).toFixed(2)})`);

      // Back arm & back leg
      px(c, sx - 2 + armB, sy - 14 + bob, 3, 5, "#b8b4aa");
      px(c, sx - 1 + legB, sy - 8,  3, 8, "#b8b4aa");
      px(c, sx + 1 + legB, sy - 2,  3, 2, "#d4d0c5");

      // Torso (leaned slightly forward while sprinting)
      px(c, sx - 2, sy - 16 + bob, 6, 9, "#ffffff");
      px(c, sx - 1, sy - 15 + bob, 4, 7, "#ebe6da");

      // Head & hair silhouette
      px(c, sx - 2, sy - 23 + bob, 7, 7, "#ffffff");
      px(c, sx - 1, sy - 22 + bob, 5, 5, "#f5efe0");
      px(c, sx + 3, sy - 20 + bob, 1, 1, "#121212"); // Focused forward eye

      // Front leg & pumping front arm + tiny warm brass lantern glint!
      px(c, sx + 1 + legA, sy - 8, 3, 8, "#ffffff");
      px(c, sx + 3 + legA, sy - 2, 3, 2, "#ffffff");
      px(c, sx + 2 + armA, sy - 14 + bob, 4, 3, "#ffffff");
      // Tiny glowing lantern held forward
      px(c, sx + 6 + armA, sy - 13 + bob, 2, 3, "#ffd76e");
      px(c, sx + 6 + armA, sy - 12 + bob, 1, 1, "#ffffff");
    }

    // 6. Animate "Loading." -> "Loading.." -> "Loading..."
    const labelEl = document.getElementById("loading-label-text");
    if (labelEl) {
      const dotCount = (Math.floor(timeSec * 2.6) % 3) + 1;
      labelEl.textContent = "Loading" + ".".repeat(dotCount);
    }
  }

  function stopLoadingLoop() {
    if (loadRafId) {
      cancelAnimationFrame(loadRafId);
      loadRafId = 0;
    }
  }

  function startLoadingLoop() {
    stopLoadingLoop();
    const tick = () => {
      if (stage !== "LOADING") return;
      const t = (performance.now() - loadStartMs) * 0.001;
      drawLoadingRunnerCanvas(t);
      loadRafId = requestAnimationFrame(tick);
    };
    loadRafId = requestAnimationFrame(tick);
  }

  function computeBulbLight(t) {
    // 0.0s -> 2.0s: Complete pitch darkness before bulb starts sputtering
    if (t < 2.0) return 0.0;

    // 2.0s -> 3.82s: Irregular broken incandescent bulb flicker synced to broken_light.mp3
    if (t < 2.14) return 0.68;
    if (t < 2.28) return 0.0;
    if (t < 2.38) return 0.48;
    if (t < 2.55) return 0.03;
    if (t < 2.74) return 0.72 + Math.sin(t * 95) * 0.12;
    if (t < 2.92) return 0.0;
    if (t < 3.04) return 0.58;
    if (t < 3.16) return 0.04;
    if (t < 3.36) return 0.84 + Math.sin(t * 110) * 0.1;
    if (t < 3.48) return 0.08;
    if (t < 3.58) return 0.92;
    if (t < 3.65) return 0.18;
    if (t < 3.74) return 0.88;
    if (t < 3.82) return 0.12;

    // 3.82s+: Bulb clicks fully ON (brief warm surge settling to steady 1.0)
    if (t < 4.05) {
      const k = (t - 3.82) / 0.23;
      return 1.0 + (1 - k) * 0.08;
    }
    return 1.0;
  }

  function start(onWorldReady, onControlsReady) {
    cancel();
    stage = "FADE_TO_LOAD";
    hudRevealed = false;
    onRevealCallback = onControlsReady;

    // 1. Cut Lobby & Ending BGM immediately + pre-warm key match audio assets during Loading Screen
    App.Audio.stopLobbyBgm();
    if (App.Audio.stopGoodEndBgm) App.Audio.stopGoodEndBgm();
    if (App.Audio.stopGameOverBgm) App.Audio.stopGameOverBgm();
    if (App.Audio.warmUpDrawCard) App.Audio.warmUpDrawCard();
    if (App.Audio.warmUpEventAudio) App.Audio.warmUpEventAudio();
    if (App.Audio.warmUpPageTurn) App.Audio.warmUpPageTurn();
    if (App.Audio.warmUpNeighborAudio) App.Audio.warmUpNeighborAudio();
    if (App.Audio.warmUpAtticAudio) App.Audio.warmUpAtticAudio();
    if (App.Audio.warmUpJumpscare) App.Audio.warmUpJumpscare();

    const curtain = document.getElementById("fade-curtain");
    const loadEl = document.getElementById("loading-screen");
    const tipEl = document.getElementById("loading-tip-text");

    // Pick survival tip (always shows the iconic tip on first match, then cycles cleanly!)
    if (tipEl) {
      tipEl.textContent = LOADING_TIPS[tipIndex % LOADING_TIPS.length];
      tipIndex = (tipIndex + 1) % LOADING_TIPS.length;
    }

    // 2. Smoothly black out screen, then show Pixel Art Loading Screen!
    if (curtain) curtain.classList.add("active");

    fadeTimer = setTimeout(() => {
      if (typeof onWorldReady === "function") onWorldReady();

      if (curtain) {
        curtain.style.transition = "none";
        curtain.classList.remove("active");
        requestAnimationFrame(() => {
          curtain.style.transition = "";
        });
      }

      if (loadEl) {
        stage = "LOADING";
        loadStartMs = performance.now();
        loadEl.classList.remove("hidden");
        requestAnimationFrame(() => {
          loadEl.classList.add("is-visible");
        });
        startLoadingLoop();

        // 3. After ~2.65s Loading Screen, fade smoothly into pure dark & launch flickering ceiling bulb!
        loadTimer = setTimeout(() => {
          loadEl.classList.remove("is-visible");
          fadeTimer = setTimeout(() => {
            stopLoadingLoop();
            loadEl.classList.add("hidden");
            stage = "DARK_INTRO";
            App.Audio.playBrokenLight();
          }, 360);
        }, LOADING_DURATION_MS);
      } else {
        stage = "DARK_INTRO";
        App.Audio.playBrokenLight();
      }
    }, 340);
  }

  function update() {
    if (stage === "IDLE" || stage === "FADE_TO_LOAD" || stage === "LOADING") return 0.0;
    if (stage === "DONE") return 1.0;

    const t = App.Audio.getBrokenLightTime();
    const light = computeBulbLight(t);

    // Reveal Stardew HUD & unlock player controls right after the light stabilizes
    if (!hudRevealed && t >= 4.15) {
      hudRevealed = true;
      if (typeof onRevealCallback === "function") {
        onRevealCallback();
      }
    }

    // Complete 6.0s broken_light.mp3 lifecycle
    if (t >= 6.0) {
      stage = "DONE";
    }

    return light;
  }

  function isBlockingInput() {
    return (
      stage === "FADE_TO_LOAD" ||
      stage === "LOADING" ||
      (stage === "DARK_INTRO" && !hudRevealed)
    );
  }

  function cancel() {
    clearTimeout(fadeTimer);
    fadeTimer = null;
    clearTimeout(loadTimer);
    loadTimer = null;
    stopLoadingLoop();
    stage = "IDLE";
    hudRevealed = false;
    App.Audio.stopBrokenLight();
    const curtain = document.getElementById("fade-curtain");
    if (curtain) {
      curtain.style.transition = "";
      curtain.classList.remove("active");
    }
    const loadEl = document.getElementById("loading-screen");
    if (loadEl) {
      loadEl.classList.remove("is-visible");
      loadEl.classList.add("hidden");
    }
  }

  App.GameIntro = {
    start,
    update,
    isBlockingInput,
    cancel
  };
})(window.Duskwood);
