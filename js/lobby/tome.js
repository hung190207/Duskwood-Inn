/* ==========================================================================
   DUSKWOOD INN - Survivor's Tome (Rules Book & 5-Category Card Codex)
   - Reads directly from App.CardsDB (40 cards across 5 official categories)
   - Undiscovered cards display as pure black silhouettes with a white "?"
   - Discovered cards reveal full mechanics, tags, sub-effects & lore
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const STORAGE_KEY_CODEX = "duskwood_codex_v2";

  let discoveredSet = new Set();
  let activeFilter = "ALL";
  let selectedCardId = "bp_cellar";

  function getCatalog() {
    return App.CardsDB ? App.CardsDB.CARD_CATALOG : [];
  }

  function loadDiscovered() {
    const defaults = App.CardsDB ? App.CardsDB.DEFAULT_DISCOVERED_IDS : [];
    const validIds = new Set(getCatalog().map((c) => c.id));
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CODEX);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((id) => validIds.has(id));
          if (clean.length > 0) {
            discoveredSet = new Set(clean);
            return;
          }
        }
      }
    } catch (_) {}
    discoveredSet = new Set(defaults);
  }

  function saveDiscovered() {
    try {
      localStorage.setItem(STORAGE_KEY_CODEX, JSON.stringify(Array.from(discoveredSet)));
    } catch (_) {}
  }

  function updateCountBadge() {
    const badge = document.getElementById("codex-count-badge");
    if (badge) {
      badge.textContent = `${discoveredSet.size}/${getCatalog().length}`;
    }
  }

  function renderGrid() {
    const grid = document.getElementById("codex-card-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const catalog = getCatalog();
    const filtered = catalog.filter(
      (c) => activeFilter === "ALL" || c.type === activeFilter
    );

    if (!filtered.some((c) => c.id === selectedCardId) && filtered.length) {
      selectedCardId = filtered[0].id;
    }

    filtered.forEach((card) => {
      const known = discoveredSet.has(card.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "codex-card " +
        (known ? `type-${card.type}` : "undiscovered") +
        (card.id === selectedCardId ? " selected" : "");

      if (known) {
        btn.innerHTML = `
          <span class="codex-card-glyph">${card.glyph}</span>
          <span class="codex-card-name">${card.name}</span>
        `;
      } else {
        btn.innerHTML = `
          <span class="unknown-q">?</span>
          <span class="codex-card-name">???</span>
        `;
      }

      btn.addEventListener("click", () => {
        selectedCardId = card.id;
        App.Audio.click();
        renderGrid();
        renderInspector();
      });

      grid.appendChild(btn);
    });
  }

  function buildMetaPills(card) {
    const pills = [];
    const m = card.meta || {};
    if (m.mandatoryFirst) pills.push("OPENING CARD 1");
    if (m.mandatorySecond) pills.push("OPENING CARD 2");
    if (m.delayTurns) pills.push(`DELAY: ${m.delayTurns} TURNS`);
    if (m.shape && App.CardsDB.ROOM_SHAPES[m.shape]) {
      pills.push(App.CardsDB.ROOM_SHAPES[m.shape].label);
    }
    if (m.exits) pills.push(`${m.exits} DOOR${m.exits > 1 ? "S" : ""}`);
    if (m.canBeDecoy) pills.push("POSSIBLE DECOY");
    if (m.outcomes) pills.push("2 OUTCOMES: X / O");
    if (m.multiplayerOnly) pills.push("MULTIPLAYER ONLY");
    if (m.monsterName) pills.push(`MONSTER: ${m.monsterName}`);
    if (m.delayedEvent) pills.push("DELAYED EVENT");
    if (m.penaltyHours) pills.push(`FAIL: +${m.penaltyHours}H`);
    if (!pills.length) return "";
    return `<div class="codex-meta-row">${pills.map((p) => `<span class="codex-pill">${p}</span>`).join("")}</div>`;
  }

  function buildSubEffectsHtml(card) {
    const subs = card.meta && card.meta.subEffects;
    if (!Array.isArray(subs) || !subs.length) return "";
    const items = subs
      .map((s) => `<li><strong>${s.name}:</strong> ${s.detail}</li>`)
      .join("");
    return `
      <div class="inspector-box">
        <span class="inspector-label">4 POSSIBLE BOARD EFFECTS</span>
        <ol class="codex-sublist">${items}</ol>
      </div>
    `;
  }

  function renderInspector() {
    const pane = document.getElementById("codex-detail-pane");
    if (!pane) return;

    const catalog = getCatalog();
    const card = catalog.find((c) => c.id === selectedCardId) || catalog[0];
    if (!card) return;

    const known = discoveredSet.has(card.id);
    const typeInfo = App.CardsDB.CARD_TYPES[card.type] || { label: card.type };

    if (!known) {
      pane.innerHTML = `
        <div class="page-chapter">CARD DETAILS &bull; LOCKED</div>
        <div class="inspector-wrap">
          <div class="inspector-card-art undiscovered">
            <span class="big-q">?</span>
          </div>
          <div class="inspector-title">UNDISCOVERED CARD</div>
          <div class="codex-meta-row">
            <span class="deck-tag tag-${card.type.toLowerCase()}">${typeInfo.label}</span>
          </div>
          <div class="inspector-box">
            <span class="inspector-label">STATUS</span>
            <p class="inspector-effect">
              This card has not been encountered yet. Draw or trigger it inside
              <strong>Duskwood Inn</strong> to record its details in your tome.
            </p>
          </div>
        </div>
        <div class="page-num">IV</div>
      `;
      return;
    }

    const tagClass = `tag-${card.type.toLowerCase()}`;
    pane.innerHTML = `
      <div class="page-chapter">CARD DETAILS &bull; RECORDED</div>
      <div class="inspector-wrap">
        <div class="inspector-card-art type-${card.type}${card.type === "BLUEPRINT" ? " is-room-art" : ""}">
          <span class="deck-tag ${tagClass}">${typeInfo.label}</span>
          ${
            card.type === "BLUEPRINT" && card.meta && card.meta.shape
              ? App.CardsDB.buildRoomDirectionSVG(App.CardsDB.getRotatedDoors(card.meta.shape, 0), card.glyph)
              : card.type === "HEX" && App.Events && card.meta && card.meta.monsterId
                ? `<div class="codex-monster-art">${App.Events.getMonsterPortraitSVG(card.meta.monsterId)}</div>`
                : `<span class="big-glyph">${card.glyph}</span>`
          }
        </div>
        <div class="inspector-title">${card.name}</div>
        ${buildMetaPills(card)}
        <div class="inspector-box">
          <span class="inspector-label">CARD EFFECT</span>
          <p class="inspector-effect">${card.effect}</p>
        </div>
        ${buildSubEffectsHtml(card)}
        <div class="inspector-box">
          <span class="inspector-label">FIELD NOTES</span>
          <p class="inspector-lore">"${card.lore}"</p>
        </div>
      </div>
      <div class="page-num">IV</div>
    `;
  }

  function switchBookTab(tabName) {
    const rulesEl = document.getElementById("book-tab-rules");
    const codexEl = document.getElementById("book-tab-codex");
    if (!rulesEl || !codexEl) return;

    rulesEl.classList.toggle("hidden", tabName !== "rules");
    codexEl.classList.toggle("hidden", tabName !== "codex");

    document.querySelectorAll("[data-book-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-book-tab") === tabName);
    });

    if (tabName === "codex") {
      renderGrid();
      renderInspector();
    }
  }

  function discoverCard(cardId) {
    if (!App.CardsDB || !App.CardsDB.getById(cardId)) return;
    if (!discoveredSet.has(cardId)) {
      discoveredSet.add(cardId);
      saveDiscovered();
      updateCountBadge();
      renderGrid();
      renderInspector();
    }
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("[data-book-tab]");
      if (tabBtn) {
        App.Audio.pageFlip();
        switchBookTab(tabBtn.getAttribute("data-book-tab"));
        return;
      }

      const filterBtn = e.target.closest("[data-codex-filter]");
      if (filterBtn) {
        activeFilter = filterBtn.getAttribute("data-codex-filter");
        document.querySelectorAll("[data-codex-filter]").forEach((b) => {
          b.classList.toggle("active", b === filterBtn);
        });
        App.Audio.pageFlip();
        renderGrid();
        renderInspector();
      }
    });
  }

  function init() {
    loadDiscovered();
    updateCountBadge();
    renderGrid();
    renderInspector();
    bindEvents();
  }

  App.GuideUI = {
    init,
    switchBookTab,
    discoverCard
  };
})(window.Duskwood);
