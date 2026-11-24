/* ==========================================================================
   DUSKWOOD INN - Main Menu, Play Mode Selector, Co-op Table Lobby & Options
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let activeModalId = null;
  let activeMpTab = "host"; // "host" | "join"

  const DIFFICULTY_TEXT = {
    NORMAL: "Standard Hollow Harvester pace. Balanced Omen deck.",
    NIGHTMARE: "Harvester advances faster. Hex Events strike more often."
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .split('"').join("&quot;");
  }

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
    // If closing the Play modal while hosting or seated in a lobby (not in match), leave table cleanly!
    const playModal = document.getElementById("modal-play");
    const wasPlayOpen = playModal && !playModal.classList.contains("hidden");
    if (wasPlayOpen && App.Network && !App.Network.isMultiplayerMatch()) {
      const st = App.Network.getState();
      if (st.role !== "IDLE") {
        App.Network.leaveTable(true);
      }
    }

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
    const boxEl = document.querySelector("#modal-play .modal-box");

    modeSelect.classList.toggle("hidden", step !== "modes");
    singlePanel.classList.toggle("hidden", step !== "single");
    multiPanel.classList.toggle("hidden", step !== "multi");
    if (boxEl) boxEl.classList.toggle("is-multi-wide", step === "multi");

    if (step === "modes") {
      titleEl.textContent = "SELECT MODE";
      if (App.Network && !App.Network.isMultiplayerMatch() && App.Network.getState().role !== "IDLE") {
        App.Network.leaveTable(true);
      }
    }
    if (step === "single") titleEl.textContent = "SINGLEPLAYER";
    if (step === "multi") titleEl.textContent = "CO-OP TABLE";
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
    return code;
  }

  // ==================== CO-OP MULTIPLAYER LOBBY UI SYNC ====================
  function setMpTab(tab) {
    activeMpTab = tab;
    document.querySelectorAll("[data-mp-tab]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-mp-tab") === tab);
    });

    if (tab === "host") {
      const code = App.Config.state.roomCode || generateRoomCode();
      if (App.Network) {
        const st = App.Network.getState();
        if (st.role !== "HOST" || st.roomCode !== code) {
          App.Network.hostTable(code, App.Config.state.difficulty || "NORMAL");
        }
      }
    } else {
      // Switching to Join tab: stop hosting so we can join someone else's code
      if (App.Network) {
        const st = App.Network.getState();
        if (st.role === "HOST") {
          App.Network.leaveTable(false);
        }
      }
      const fb = document.getElementById("join-feedback");
      if (fb) {
        fb.textContent = "Ask your host for their 4-letter table code — works online (P2P) & across local browser tabs.";
      }
    }
    renderMpLobbyUI();
  }

  function renderMpLobbyUI() {
    const net = App.Network ? App.Network.getState() : null;
    const isGuestConnected = Boolean(net && net.role === "GUEST" && net.status === "CONNECTED");
    const isHost = Boolean(net && net.role === "HOST");
    const showTableView = isHost || isGuestConnected;

    const tabRow = document.getElementById("mp-tab-row");
    const hostView = document.getElementById("mp-host-view");
    const joinView = document.getElementById("mp-join-view");
    const connBar = document.getElementById("mp-conn-bar");
    const connText = document.getElementById("mp-conn-text");
    const codeEl = document.getElementById("host-room-code");
    const regenBtn = document.getElementById("btn-regen-code");
    const launchBtn = document.getElementById("btn-launch-mp");
    const readyBtn = document.getElementById("btn-mp-ready");
    const backBtn = document.getElementById("btn-mp-back");
    const joinBtn = document.getElementById("btn-join-room");
    const joinFb = document.getElementById("join-feedback");

    // Hide Host/Join tab switcher once Guest successfully enters a Host's table
    if (tabRow) tabRow.classList.toggle("hidden", isGuestConnected);
    if (hostView) hostView.classList.toggle("hidden", !showTableView);
    if (joinView) joinView.classList.toggle("hidden", showTableView || activeMpTab !== "join");

    // Connection Status Bar
    if (connBar && connText && net) {
      connBar.classList.remove("is-online", "is-local", "is-connecting", "is-error");
      if (net.status === "ERROR") {
        connBar.classList.add("is-error");
        connText.textContent = net.statusText || "CONNECTION ERROR";
      } else if (net.status === "CONNECTING") {
        connBar.classList.add("is-connecting");
        connText.textContent = net.statusText || "CONNECTING...";
      } else if (net.status === "HOSTING" || net.status === "CONNECTED") {
        if (net.p2pAvailable || net.transport === "P2P" || net.transport === "HYBRID") {
          connBar.classList.add("is-online");
        } else {
          connBar.classList.add("is-local");
        }
        connText.textContent = net.statusText;
      } else {
        connText.textContent = activeMpTab === "join"
          ? "ENTER A 4-LETTER TABLE CODE TO JOIN"
          : "READY TO HOST";
      }
    }

    if (joinBtn && net) {
      const joining = net.role === "GUEST" && net.status === "CONNECTING";
      joinBtn.disabled = joining;
      joinBtn.textContent = joining ? "[ JOINING... ]" : "[ JOIN ]";
    }
    if (joinFb && net && !isGuestConnected && activeMpTab === "join") {
      if (net.status === "ERROR" || (net.role === "GUEST" && net.status === "CONNECTING")) {
        joinFb.textContent = net.statusText;
      }
    }

    if (codeEl && net) {
      codeEl.textContent = net.roomCode || App.Config.state.roomCode || "DUSK";
    }
    if (regenBtn) regenBtn.classList.toggle("hidden", !isHost);

    // Difficulty buttons (interactive for Host, read-only synced display for Guests)
    document.querySelectorAll("[data-mp-difficulty]").forEach((btn) => {
      const d = btn.getAttribute("data-mp-difficulty");
      const activeDiff = (net && net.difficulty) || App.Config.state.difficulty || "NORMAL";
      btn.classList.toggle("active", d === activeDiff);
      btn.disabled = !isHost;
    });

    // Render Live 4-Seat Table Grid with Mini Pixel Avatars!
    const grid = document.getElementById("mp-seat-grid");
    if (grid && net && showTableView) {
      grid.innerHTML = net.seats
        .map((seat, idx) => {
          if (!seat) {
            return `
              <div class="seat-card">
                <span class="seat-num">SEAT ${idx + 1}</span>
                <span>EMPTY CHAIR</span>
                <span class="seat-status">WAITING...</span>
              </div>`;
          }
          const isMe = seat.playerId === net.localPlayerId;
          const seatLabel = seat.isHost ? `SEAT ${idx + 1} (HOST)` : `SEAT ${idx + 1}${isMe ? " (YOU)" : ""}`;
          const kickHtml = isHost && !seat.isHost
            ? `<button type="button" class="seat-kick-btn" data-mp-kick="${idx}" title="Remove player from table">X</button>`
            : "";
          const statusCls = seat.ready ? "ready" : "not-ready";
          const statusTxt = seat.ready ? "READY" : "NOT READY";
          return `
            <div class="seat-card occupied${isMe ? " is-me" : ""}">
              ${kickHtml}
              <div class="seat-card-row">
                <div class="seat-avatar-box">
                  <canvas class="seat-avatar-canvas" data-seat-avatar="${idx}" width="32" height="42"></canvas>
                </div>
                <div class="seat-meta">
                  <span class="seat-num">${seatLabel}</span>
                  <strong>${escapeHtml(seat.name)}</strong>
                  <span class="seat-status ${statusCls}">${statusTxt}</span>
                </div>
              </div>
            </div>`;
        })
        .join("");

      // Immediately draw avatars once on render so there is no blank flash
      renderSeatAvatars(performance.now() * 0.001);
    }

    // Render Lobby Chat Log
    const chatLogEl = document.getElementById("mp-chat-log");
    if (chatLogEl && net && showTableView) {
      chatLogEl.innerHTML = (net.chatLog || [])
        .map((entry) => {
          if (entry.system) {
            return `<div class="mp-chat-line is-sys">* ${escapeHtml(entry.text)}</div>`;
          }
          return `<div class="mp-chat-line"><span class="mp-chat-sender">${escapeHtml(entry.sender)}:</span>${escapeHtml(entry.text)}</div>`;
        })
        .join("");
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    // Action Footer Buttons (Host vs Guest vs Join Input)
    if (backBtn) {
      backBtn.textContent = isGuestConnected ? "[ LEAVE TABLE ]" : "[ BACK ]";
    }
    if (launchBtn) {
      const count = net ? net.occupiedCount : 1;
      launchBtn.classList.toggle("hidden", !isHost);
      launchBtn.textContent = `[ START TABLE (${count}/4) ]`;
    }
    if (readyBtn) {
      readyBtn.classList.toggle("hidden", !isGuestConnected);
      if (isGuestConnected && net) {
        const mine = net.seats[net.localSeatIdx];
        const isRdy = Boolean(mine && mine.ready);
        readyBtn.classList.toggle("is-ready-active", isRdy);
        readyBtn.textContent = isRdy ? "[ READY ✓ ]" : "[ READY UP ]";
      }
    }
  }

  // Called every frame from js/main.js while #modal-play is open to animate seat sprites!
  function renderSeatAvatars(timeSec) {
    if (!App.Network || !App.Character) return;
    const panel = document.getElementById("play-multi-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    const net = App.Network.getState();
    if (!net || !net.seats) return;

    net.seats.forEach((seat, idx) => {
      if (!seat || !seat.character) return;
      const cvs = document.querySelector(`canvas[data-seat-avatar="${idx}"]`);
      if (cvs) {
        App.Character.renderToCanvas(cvs, seat.character, timeSec, { hideLantern: true });
      }
    });
  }

  function copyTableCodeOrInvite() {
    const code = (App.Network && App.Network.getState().roomCode) || App.Config.state.roomCode || "DUSK";
    const copyBtn = document.getElementById("btn-copy-code");
    let textToCopy = code;
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      const base = window.location.origin + window.location.pathname;
      textToCopy = `${base}?join=${code}`;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    if (copyBtn) {
      const prev = copyBtn.textContent;
      copyBtn.textContent = "COPIED!";
      setTimeout(() => { copyBtn.textContent = prev; }, 1200);
    }
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

  function bindNetworkCallbacks() {
    if (!App.Network) return;

    App.Network.on("lobbyChange", () => {
      renderMpLobbyUI();
    });

    App.Network.on("matchStart", (cfg) => {
      closeAllModals(true);
      if (App.GameWorld && App.GameWorld.startMultiplayer) {
        App.GameWorld.startMultiplayer(cfg);
      }
    });

    App.Network.on("kicked", (reason) => {
      if (App.GameWorld && App.GameWorld.isActive()) {
        App.GameWorld.exitToLobby();
      }
      openModal("modal-play");
      showPlayStep("multi");
      activeMpTab = "join";
      renderMpLobbyUI();
      const fb = document.getElementById("join-feedback");
      if (fb) fb.textContent = reason;
      App.Audio.hexAlert();
    });

    App.Network.on("hostClosed", (reason) => {
      if (App.GameWorld && App.GameWorld.isActive()) {
        App.GameWorld.exitToLobby();
      }
      openModal("modal-play");
      showPlayStep("multi");
      activeMpTab = "join";
      renderMpLobbyUI();
      const fb = document.getElementById("join-feedback");
      if (fb) fb.textContent = reason;
      App.Audio.close();
    });
  }

  function checkAutoJoinUrlParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = (params.get("join") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      if (joinCode.length === 4) {
        openModal("modal-play");
        showPlayStep("multi");
        activeMpTab = "join";
        const input = document.getElementById("join-code-input");
        if (input) input.value = joinCode;
        renderMpLobbyUI();
        if (App.Network) App.Network.joinTable(joinCode);
      }
    } catch (_) {}
  }

  function bindEvents() {
    const unlockOnce = () => {
      if (App.Audio.warmUpPageTurn) App.Audio.warmUpPageTurn();
      if (App.Audio.warmUpDrawCard) App.Audio.warmUpDrawCard();
      if (App.Audio.warmUpNeighborAudio) App.Audio.warmUpNeighborAudio();
      if (App.Audio.warmUpAtticAudio) App.Audio.warmUpAtticAudio();
      if (App.Audio.warmUpJumpscare) App.Audio.warmUpJumpscare();
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

    const chatForm = document.getElementById("mp-chat-form");
    if (chatForm) {
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("mp-chat-input");
        if (!input) return;
        const txt = input.value.trim();
        if (!txt) return;
        input.value = "";
        if (App.Network) App.Network.sendChat(txt);
        App.Audio.click();
      });
    }

    const joinInput = document.getElementById("join-code-input");
    if (joinInput) {
      joinInput.addEventListener("input", () => {
        joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      });
      joinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAction("join-room");
        }
      });
    }

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

      const mpDiffBtn = e.target.closest("[data-mp-difficulty]");
      if (mpDiffBtn && !mpDiffBtn.disabled) {
        const diff = mpDiffBtn.getAttribute("data-mp-difficulty");
        App.Config.state.difficulty = diff;
        if (App.Network) App.Network.setDifficulty(diff);
        App.Audio.click();
        return;
      }

      const kickBtn = e.target.closest("[data-mp-kick]");
      if (kickBtn) {
        const sIdx = Number(kickBtn.getAttribute("data-mp-kick"));
        if (App.Network) App.Network.kickSeat(sIdx);
        App.Audio.close();
        return;
      }

      const mpTab = e.target.closest("[data-mp-tab]");
      if (mpTab) {
        const tab = mpTab.getAttribute("data-mp-tab");
        App.Audio.click();
        setMpTab(tab);
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
      if (document.activeElement && document.activeElement.id === "ig-chat-input") return;
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
        setMpTab("host");
        break;
      case "back-to-modes": {
        App.Audio.close();
        const st = App.Network ? App.Network.getState() : null;
        if (st && st.role === "GUEST" && st.status === "CONNECTED") {
          // Guest clicking [ LEAVE TABLE ] returns cleanly to Join Table tab
          App.Network.leaveTable(false);
          setMpTab("join");
        } else {
          showPlayStep("modes");
        }
        break;
      }

      case "start-single":
        App.Audio.click();
        closeAllModals(true);
        App.GameWorld.startSingleplayer();
        break;
      case "start-multi":
        App.Audio.click();
        if (App.Network && App.Network.isHost()) {
          App.Network.startMatch();
        }
        break;
      case "toggle-mp-ready":
        App.Audio.click();
        if (App.Network) App.Network.toggleReady();
        break;

      case "copy-code":
        App.Audio.click();
        copyTableCodeOrInvite();
        break;
      case "regen-code": {
        App.Audio.click();
        const fresh = generateRoomCode();
        if (App.Network) App.Network.hostTable(fresh, App.Config.state.difficulty || "NORMAL");
        break;
      }
      case "join-room": {
        const input = document.getElementById("join-code-input");
        const fb = document.getElementById("join-feedback");
        const code = (input ? input.value : "").trim().toUpperCase();
        if (code.length < 4) {
          if (fb) fb.textContent = "Please enter a valid 4-letter table code.";
          App.Audio.close();
        } else {
          App.Audio.click();
          if (fb) fb.textContent = `Connecting to table ${code}...`;
          if (App.Network) App.Network.joinTable(code);
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
    bindNetworkCallbacks();
    bindEvents();
    App.Audio.startLobbyBgm();
    checkAutoJoinUrlParam();
  }

  App.MenuUI = { init, openModal, closeAllModals, renderSeatAvatars };
})(window.Duskwood);
