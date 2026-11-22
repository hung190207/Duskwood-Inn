/* ==========================================================================
   DUSKWOOD INN - Character Customizer UI Controller
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let containerEl = null;
  let nameInput = null;
  let saveStatusEl = null;
  let saveTimer = null;

  function showSavedNotice() {
    if (!saveStatusEl) return;
    saveStatusEl.textContent = "SURVIVOR SAVED";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveStatusEl.textContent = "CHANGES SAVED AUTOMATICALLY";
    }, 1400);
  }

  function syncHeaderAndBadges() {
    const ch = App.Config.state.character;
    const cleanName = (ch.name || "SURVIVOR").trim() || "SURVIVOR";

    const footerName = document.getElementById("footer-player-name");
    const spName = document.getElementById("sp-player-name");
    const mpSeat1 = document.getElementById("mp-seat-1-name");
    if (footerName) footerName.textContent = cleanName;
    if (spName) spName.textContent = cleanName;
    if (mpSeat1) mpSeat1.textContent = cleanName;

    const flipBtn = document.getElementById("btn-flip-dir");
    if (flipBtn) flipBtn.textContent = ch.facing === 1 ? "FACE: RIGHT" : "FACE: LEFT";

    const walkBtn = document.getElementById("btn-toggle-walk");
    if (walkBtn) walkBtn.textContent = ch.walking ? "ANIM: WALK" : "ANIM: IDLE";

    const lanBtn = document.getElementById("btn-toggle-lantern");
    if (lanBtn) lanBtn.textContent = ch.lantern ? "LANTERN: ON" : "LANTERN: OFF";
  }

  function createStepperCard(title, list, stateKey) {
    const card = document.createElement("div");
    card.className = "cust-card";

    const head = document.createElement("div");
    head.className = "cust-card-head";
    head.innerHTML = `<span class="cust-card-title">${title}</span>`;
    card.appendChild(head);

    const row = document.createElement("div");
    row.className = "stepper-row";

    const prevBtn = document.createElement("button");
    prevBtn.className = "silver-btn step-btn";
    prevBtn.textContent = "<";

    const valBox = document.createElement("div");
    valBox.className = "step-value";
    valBox.textContent = list[App.Config.state.character[stateKey]] || list[0];

    const nextBtn = document.createElement("button");
    nextBtn.className = "silver-btn step-btn";
    nextBtn.textContent = ">";

    function shift(delta) {
      const ch = App.Config.state.character;
      ch[stateKey] = (ch[stateKey] + delta + list.length) % list.length;
      valBox.textContent = list[ch[stateKey]];
      App.Config.saveCharacter(ch);
      App.Audio.click();
      showSavedNotice();
    }

    prevBtn.addEventListener("click", () => shift(-1));
    nextBtn.addEventListener("click", () => shift(1));

    row.append(prevBtn, valBox, nextBtn);
    card.appendChild(row);
    return card;
  }

  function createSwatchCard(title, paletteList, stateKey) {
    const card = document.createElement("div");
    card.className = "cust-card";

    const labelEl = document.createElement("span");
    labelEl.className = "cust-card-title";
    const curIdx = App.Config.state.character[stateKey] || 0;
    labelEl.textContent = `${title}: ${(paletteList[curIdx]?.name || "").toUpperCase()}`;

    const head = document.createElement("div");
    head.className = "cust-card-head";
    head.appendChild(labelEl);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "swatch-grid";

    paletteList.forEach((item, idx) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "swatch-btn" + (idx === curIdx ? " active" : "");
      sw.style.backgroundColor = item.base;
      sw.title = item.name;
      sw.setAttribute("aria-label", `${title} ${item.name}`);

      sw.addEventListener("click", () => {
        const ch = App.Config.state.character;
        ch[stateKey] = idx;
        grid.querySelectorAll(".swatch-btn").forEach((b, i) => {
          b.classList.toggle("active", i === idx);
        });
        labelEl.textContent = `${title}: ${item.name.toUpperCase()}`;
        App.Config.saveCharacter(ch);
        App.Audio.swatch();
        showSavedNotice();
      });

      grid.appendChild(sw);
    });

    card.appendChild(grid);
    return card;
  }

  function buildControls() {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    const cfg = App.Config;
    const sections = [
      createStepperCard("HAIR STYLE", cfg.HAIR_STYLES, "hairStyle"),
      createSwatchCard("HAIR COLOR", cfg.PALETTES.hair, "hairColor"),
      createSwatchCard("SKIN TONE", cfg.PALETTES.skin, "skin"),
      createSwatchCard("EYE COLOR", cfg.PALETTES.eye, "eyeColor"),
      createStepperCard("OUTFIT", cfg.OUTFIT_STYLES, "outfit"),
      createSwatchCard("SHIRT / JACKET", cfg.PALETTES.shirt, "shirtColor"),
      createSwatchCard("UNDERSHIRT", cfg.PALETTES.undershirt, "underColor"),
      createSwatchCard("PANTS", cfg.PALETTES.pants, "pantsColor"),
      createSwatchCard("BOOTS", cfg.PALETTES.shoes, "shoeColor"),
      createStepperCard("ACCESSORY", cfg.ACCESSORIES, "accessory")
    ];

    sections.forEach((sec) => containerEl.appendChild(sec));
  }

  function randomize() {
    const cfg = App.Config;
    const ch = cfg.state.character;
    const pick = (arr) => Math.floor(Math.random() * arr.length);

    ch.skin = pick(cfg.PALETTES.skin);
    ch.hairStyle = pick(cfg.HAIR_STYLES);
    ch.hairColor = pick(cfg.PALETTES.hair);
    ch.eyeColor = pick(cfg.PALETTES.eye);
    ch.outfit = pick(cfg.OUTFIT_STYLES);
    ch.shirtColor = pick(cfg.PALETTES.shirt);
    ch.underColor = pick(cfg.PALETTES.undershirt);
    ch.pantsColor = pick(cfg.PALETTES.pants);
    ch.shoeColor = pick(cfg.PALETTES.shoes);
    ch.accessory = pick(cfg.ACCESSORIES);

    cfg.saveCharacter(ch);
    buildControls();
    syncHeaderAndBadges();
    App.Audio.random();
    showSavedNotice();
  }

  function resetToDefault() {
    const currentName = App.Config.state.character.name;
    Object.assign(App.Config.state.character, App.Config.DEFAULT_CHARACTER, {
      name: currentName || "SURVIVOR"
    });
    App.Config.saveCharacter(App.Config.state.character);
    buildControls();
    syncHeaderAndBadges();
    App.Audio.click();
    showSavedNotice();
  }

  function init() {
    containerEl = document.getElementById("customizer-controls");
    nameInput = document.getElementById("player-name-input");
    saveStatusEl = document.getElementById("cust-save-status");

    if (nameInput) {
      nameInput.value = App.Config.state.character.name || "SURVIVOR";
      nameInput.addEventListener("input", () => {
        const val = nameInput.value.toUpperCase().replace(/[^A-Z0-9 _-]/g, "");
        nameInput.value = val;
        App.Config.state.character.name = val.trim() || "SURVIVOR";
        App.Config.saveCharacter(App.Config.state.character);
        syncHeaderAndBadges();
      });
    }

    buildControls();
    syncHeaderAndBadges();
  }

  App.CustomizerUI = {
    init,
    randomize,
    resetToDefault,
    syncHeaderAndBadges
  };
})(window.Duskwood);
