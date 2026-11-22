/* ==========================================================================
   DUSKWOOD INN - Singleplayer Entry Cutscene Controller
   Sequence:
   1. Lobby BGM stops immediately, screen fades smoothly to pitch black.
   2. Once completely dark, `audio/broken_light.mp3` (6s total) starts.
   3. Overhead bulb flickers rapidly between 2.0s and ~3.82s in sync with audio.
   4. At ~3.82s the bulb clicks steadily ON, illuminating the seated player
      at the Draftsman's Table, and HUD fades in smoothly.
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let stage = "IDLE"; // IDLE | FADE_OUT | DARK_INTRO | DONE
  let onRevealCallback = null;
  let hudRevealed = false;
  let fadeTimer = null;

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
    stage = "FADE_OUT";
    hudRevealed = false;
    onRevealCallback = onControlsReady;

    // 1. Cut lobby BGM immediately
    App.Audio.stopLobbyBgm();

    // 2. Fade screen smoothly to pure black
    const curtain = document.getElementById("fade-curtain");
    if (curtain) curtain.classList.add("active");

    // 3. Once pitch black (950ms), swap to the dark cabin canvas & start broken_light.mp3
    fadeTimer = setTimeout(() => {
      if (typeof onWorldReady === "function") onWorldReady();

      // Remove curtain instantaneously while canvas itself draws pitch black (light = 0)
      if (curtain) {
        curtain.style.transition = "none";
        curtain.classList.remove("active");
        // Restore transition on next frame
        requestAnimationFrame(() => {
          curtain.style.transition = "";
        });
      }

      stage = "DARK_INTRO";
      App.Audio.playBrokenLight();
    }, 980);
  }

  function update() {
    if (stage === "IDLE" || stage === "FADE_OUT") return 0.0;
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
    return stage === "FADE_OUT" || (stage === "DARK_INTRO" && !hudRevealed);
  }

  function cancel() {
    clearTimeout(fadeTimer);
    fadeTimer = null;
    stage = "IDLE";
    hudRevealed = false;
    App.Audio.stopBrokenLight();
    const curtain = document.getElementById("fade-curtain");
    if (curtain) {
      curtain.style.transition = "";
      curtain.classList.remove("active");
    }
  }

  App.GameIntro = {
    start,
    update,
    isBlockingInput,
    cancel
  };
})(window.Duskwood);
