/* ==========================================================================
   DUSKWOOD INN - Main Menu, Play Mode Selector, Lobby & Options Controller
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let activeModalId = null;
  let launchInterval = null;

  const DIFFICULTY_TEXT = {
    NORMAL: "Standard Hollow Harvester pace. Balanced Omen deck.",
    NIGHTMARE: "Harvester advances faster. Hex Events strike more often."
  };

  function openModal(id) {
    closeAllModals(true);
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("hidden");
    activeModalId = id;
    if (id === "modal-howto") App.Audio.pageFlip();
    else App.Audio.open();
  }

  function closeAllModals(silent) {
    document.querySelectorAll("#modal-play, #modal-howto, #modal-customize, #modal-options, #modal-credits").forEach((m) => {
      m.classList.add("hidden");
    });
    if (activeModalId && !silent) {
      App.Audio.close();
    }
    activeModalId = null;
  }

  function showPlayStep(step) {
    const modeSelect = document.getElementById("play-mode-select");
    const singlePanel = document.getElementById("play-single-panel");
    const multiPanel = document.getElementById("play-multi-panel");
    const titleEl = document.getElementById("play-title");

    modeSelect.classList.toggle("hidden", step !== "modes");
    singlePanel.classList.toggle("hidden", step !== "single");
    multiPanel.classList.toggle("hidden", step !== "multi");

    if (step === "modes") titleEl.textContent = "SELECT MODE";
    if (step === "single") titleEl.textContent = "SINGLEPLAYER";
    if (step === "multi") titleEl.textContent = "MULTIPLAYER TABLE";
  }

  function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    App.Config.state.roomCode = code;
    const codeEl = document.getElementById("host-room-code");
    if (codeEl) codeEl.textContent = code;
  }

  function startMultiplayerPlaceholder(modeLabel, subLabel) {
    closeAllModals(true);
    App.Audio.stopLobbyBgm();

    const screen = document.getElementById("launch-screen");
    const heading = document.getElementById("launch-heading");
    const subtext = document.getElementById("launch-subtext");
    const fill = document.getElementById("launch-progress-fill");
    const returnBtn = document.getElementById("btn-return-title");

    heading.textContent = modeLabel;
    subtext.textContent = subLabel;
    fill.style.width = "0%";
    returnBtn.classList.add("hidden");
    screen.classList.remove("hidden");

    App.Audio.launch();

    let progress = 0;
    clearInterval(launchInterval);
    launchInterval = setInterval(() => {
      progress += 20;
      fill.style.width = `${Math.min(progress, 100)}%`;
      if (progress >= 100) {
        clearInterval(launchInterval);
        heading.textContent = "MULTIPLAYER COMING IN PHASE 5";
        subtext.textContent = "Try Singleplayer mode to enter the Stardew Cabin now!";
        returnBtn.classList.remove("hidden");
      }
    }, 240);
  }

  function cancelLaunch() {
    clearInterval(launchInterval);
    document.getElementById("launch-screen").classList.add("hidden");
    App.Audio.close();
    App.Audio.startLobbyBgm();
  }

  function syncOptionsUI() {
    const opts = App.Config.state.options;
    const bgmSlider = document.getElementById("opt-bgm-vol");
    const bgmLabel = document.getElementById("opt-bgm-label");
    const sfxSlider = document.getElementById("opt-sfx-vol");
    const sfxLabel = document.getElementById("opt-sfx-label");
    const partBtn = document.getElementById("opt-toggle-particles");
    const scanBtn = document.getElementById("opt-toggle-scanlines");

    if (bgmSlider) bgmSlider.value = Math.round(opts.bgmVolume * 100);
    if (bgmLabel) bgmLabel.textContent = `${Math.round(opts.bgmVolume * 100)}%`;
    if (sfxSlider) sfxSlider.value = Math.round(opts.sfxVolume * 100);
    if (sfxLabel) sfxLabel.textContent = `${Math.round(opts.sfxVolume * 100)}%`;
    if (partBtn) partBtn.textContent = opts.particles ? "ON" : "OFF";
    if (scanBtn) scanBtn.textContent = opts.scanlines ? "ON" : "OFF";
    document.body.classList.toggle("scanlines-on", Boolean(opts.scanlines));
  }

  function bindEvents() {
    const unlockOnce = () => {
      if (App.Audio.warmUpPageTurn) App.Audio.warmUpPageTurn();
      if (App.Audio.warmUpDrawCard) App.Audio.warmUpDrawCard();
      if (App.Audio.warmUpNeighborAudio) App.Audio.warmUpNeighborAudio();
      if (App.Audio.warmUpAtticAudio) App.Audio.warmUpAtticAudio();
      if (!App.GameWorld || !App.GameWorld.isActive()) {
        App.Audio.unlockLobbyAudio();
      }
    };
    document.addEventListener("pointerdown", unlockOnce, { passive: true });
    document.addEventListener("keydown", unlockOnce, { passive: true });

    document.addEventListener("pointerenter", (e) => {
      if (e.target.closest && e.target.closest(".silver-btn, .icon-close-btn")) {
        App.Audio.hover();
      }
    }, true);

    document.addEventListener("click", (e) => {
      const closeBtn = e.target.closest("[data-close]");
      if (closeBtn) {
        closeAllModals(false);
        return;
      }

      if (e.target.closest("#active-survivor-pill")) {
        openModal("modal-customize");
        return;
      }

      if (e.target.classList.contains("modal-backdrop") && e.target.id.startsWith("modal-")) {
        closeAllModals(false);
        return;
      }

      const diffBtn = e.target.closest("[data-difficulty]");
      if (diffBtn) {
        const diff = diffBtn.getAttribute("data-difficulty");
        App.Config.state.difficulty = diff;
        document.querySelectorAll("[data-difficulty]").forEach((b) => {
          b.classList.toggle("active", b === diffBtn);
        });
        document.getElementById("difficulty-note").textContent = DIFFICULTY_TEXT[diff];
        App.Audio.click();
        return;
      }

      const mpTab = e.target.closest("[data-mp-tab]");
      if (mpTab) {
        const tab = mpTab.getAttribute("data-mp-tab");
        document.querySelectorAll("[data-mp-tab]").forEach((b) => {
          b.classList.toggle("active", b === mpTab);
        });
        document.getElementById("mp-host-view").classList.toggle("hidden", tab !== "host");
        document.getElementById("mp-join-view").classList.toggle("hidden", tab !== "join");
        document.getElementById("btn-launch-mp").classList.toggle("hidden", tab !== "host");
        App.Audio.click();
        return;
      }

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      handleAction(actionEl.getAttribute("data-action"));
    });

    const bgmSlider = document.getElementById("opt-bgm-vol");
    if (bgmSlider) {
      bgmSlider.addEventListener("input", () => {
        App.Config.state.options.bgmVolume = Number(bgmSlider.value) / 100;
        App.Config.saveOptions(App.Config.state.options);
        App.Audio.syncBgmVolume();
        syncOptionsUI();
      });
    }

    const sfxSlider = document.getElementById("opt-sfx-vol");
    if (sfxSlider) {
      sfxSlider.addEventListener("input", () => {
        App.Config.state.options.sfxVolume = Number(sfxSlider.value) / 100;
        App.Config.saveOptions(App.Config.state.options);
        if (App.Audio.syncSfxVolume) App.Audio.syncSfxVolume();
        syncOptionsUI();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const launch = document.getElementById("launch-screen");
      if (launch && !launch.classList.contains("hidden")) {
        cancelLaunch();
        return;
      }
      if (activeModalId) {
        closeAllModals(false);
      }
    });
  }

  function handleAction(action) {
    const ch = App.Config.state.character;
    const opts = App.Config.state.options;

    switch (action) {
      case "open-play":
        showPlayStep("modes");
        openModal("modal-play");
        break;
      case "open-howto":
        if (App.GuideUI) App.GuideUI.switchBookTab("rules");
        openModal("modal-howto");
        break;
      case "open-customize":
        openModal("modal-customize");
        break;
      case "open-options":
        openModal("modal-options");
        break;
      case "open-credits":
        openModal("modal-credits");
        break;

      case "select-single":
        App.Audio.click();
        showPlayStep("single");
        break;
      case "select-multi":
        App.Audio.click();
        showPlayStep("multi");
        break;
      case "back-to-modes":
        App.Audio.close();
        showPlayStep("modes");
        break;

      case "start-single":
        App.Audio.click();
        closeAllModals(true);
        App.GameWorld.startSingleplayer();
        break;
      case "start-multi":
        startMultiplayerPlaceholder(
          "OPENING CO-OP TABLE...",
          `TABLE ${App.Config.state.roomCode} • HOST: ${ch.name}`
        );
        break;
      case "cancel-launch":
        cancelLaunch();
        break;

      case "copy-code":
        App.Audio.click();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(App.Config.state.roomCode).catch(() => {});
        }
        break;
      case "regen-code":
        App.Audio.click();
        generateRoomCode();
        break;
      case "join-room": {
        const input = document.getElementById("join-code-input");
        const fb = document.getElementById("join-feedback");
        const code = (input.value || "").trim().toUpperCase();
        if (code.length < 4) {
          fb.textContent = "Please enter a valid 4-letter table code.";
          App.Audio.close();
        } else {
          fb.textContent = `Connecting to table ${code}...`;
          startMultiplayerPlaceholder("JOINING TABLE...", `TABLE ${code} • TRAVELER: ${ch.name}`);
        }
        break;
      }

      case "flip-dir":
        ch.facing = ch.facing === 1 ? -1 : 1;
        App.Config.saveCharacter(ch);
        App.CustomizerUI.syncHeaderAndBadges();
        App.Audio.click();
        break;
      case "toggle-walk":
        ch.walking = !ch.walking;
        App.Config.saveCharacter(ch);
        App.CustomizerUI.syncHeaderAndBadges();
        App.Audio.click();
        break;
      case "toggle-lantern":
        ch.lantern = !ch.lantern;
        App.Config.saveCharacter(ch);
        App.CustomizerUI.syncHeaderAndBadges();
        App.Audio.click();
        break;
      case "randomize-char":
        App.CustomizerUI.randomize();
        break;
      case "reset-char":
        App.CustomizerUI.resetToDefault();
        break;

      case "toggle-particles":
        opts.particles = !opts.particles;
        App.Config.saveOptions(opts);
        syncOptionsUI();
        App.Audio.click();
        break;
      case "toggle-scanlines":
        opts.scanlines = !opts.scanlines;
        App.Config.saveOptions(opts);
        syncOptionsUI();
        App.Audio.click();
        break;
    }
  }

  function init() {
    generateRoomCode();
    syncOptionsUI();
    bindEvents();
    App.Audio.startLobbyBgm();
  }

  App.MenuUI = { init, openModal, closeAllModals };
})(window.Duskwood);
