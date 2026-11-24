/* ==========================================================================
   DUSKWOOD INN - Application Bootstrap & Main Render Loop
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let lastTime = 0;

  function tick(timestamp) {
    const timeSec = timestamp * 0.001;
    const dt = Math.min(0.05, lastTime ? (timestamp - lastTime) * 0.001 : 0.016);
    lastTime = timestamp;

    // When inside the Stardew Cabin, render the 2D Game World instead of the Lobby
    if (App.GameWorld && App.GameWorld.isActive()) {
      try {
        App.GameWorld.renderFrame(timeSec, dt);
      } catch (err) {
        console.error("[Duskwood Render]", err);
      }
      requestAnimationFrame(tick);
      return;
    }

    App.Background.render(timeSec, dt);

    const ch = App.Config.state.character;

    const miniCanvas = document.getElementById("mini-avatar-canvas");
    if (miniCanvas) {
      App.Character.renderToCanvas(miniCanvas, ch, timeSec, { hideLantern: true });
    }

    const custModal = document.getElementById("modal-customize");
    if (custModal && !custModal.classList.contains("hidden")) {
      const charCanvas = document.getElementById("character-canvas");
      App.Character.renderToCanvas(charCanvas, ch, timeSec);
    }

    const playModal = document.getElementById("modal-play");
    if (playModal && !playModal.classList.contains("hidden") && App.MenuUI && App.MenuUI.renderSeatAvatars) {
      App.MenuUI.renderSeatAvatars(timeSec);
    }

    requestAnimationFrame(tick);
  }

  function boot() {
    const bgCanvas = document.getElementById("bg-canvas");
    App.Background.init(bgCanvas);
    App.CustomizerUI.init();
    if (App.GuideUI) App.GuideUI.init();
    if (App.GameWorld) App.GameWorld.init();
    App.MenuUI.init();
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.Duskwood);
