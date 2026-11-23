/* ==========================================================================
   DUSKWOOD INN - Survivor's Tome (Game Manual + 5-Category Card Codex)
   - RULES Tab: Mirrors the in-game Game Manual (Contents, Quick How-To,
     Clue Overview + Opening/Controls, Clue Types, Stealth & General Tips)
     while omitting the in-match Discovered Clues & Exit Room prediction page.
   - CARDS Tab: Reads directly from App.CardsDB (5 official categories);
     undiscovered cards display as pure black silhouettes with a white "?".
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const STORAGE_KEY_CODEX = "duskwood_codex_v2";
  const TOTAL_RULES_SPREADS = 5;

  let discoveredSet = new Set();
  let activeBookTab = "rules";
  let currentRulesSpread = 0;
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

  // ==================== RULES TAB: IN-GAME GAME MANUAL MIRROR (NO DEDUCTION PAGE) ====================
  const TOME_FLOURISH = `
    <svg viewBox="0 0 260 22" class="tome-flourish-svg" aria-hidden="true">
      <g fill="none" stroke="#bcc6d4" stroke-linecap="round" opacity="0.72">
        <path d="M22,6 C58,13 96,4 130,14 C164,4 202,13 238,6" stroke-width="1.3"/>
        <path d="M56,11 C88,16 112,17 130,13 C148,17 172,16 204,11" stroke-width="1.0"/>
        <path d="M114,14 Q130,20 146,14 Q130,9 114,14 Z" stroke-width="1.1" fill="#bcc6d4" fill-opacity="0.16"/>
        <circle cx="130" cy="14" r="2.1" fill="#eef3fa"/>
        <circle cx="44" cy="4" r="1.3" fill="#bcc6d4"/>
        <circle cx="216" cy="4" r="1.3" fill="#bcc6d4"/>
      </g>
    </svg>
  `;

  const TOME_RUNNER_SVG = `
    <svg viewBox="0 0 90 120" class="tome-cover-runner-svg" aria-hidden="true">
      <g fill="#eef3fa" stroke="#080a0e" stroke-width="2">
        <circle cx="42" cy="24" r="9.5"/>
        <path d="M36,34 L48,34 L50,58 L35,58 Z"/>
        <path d="M36,36 L22,42 L25,52 L32,48 L36,44 Z"/>
        <path d="M48,36 L66,31 L67,41 L50,45 Z"/>
        <path d="M36,56 L24,72 L33,77 L43,62 Z"/>
        <path d="M45,56 L62,64 L58,82 L49,80 L52,68 L42,64 Z"/>
        <path d="M43,66 L49,114 L46.5,114.5 L40.5,66 Z"/>
      </g>
    </svg>
  `;

  function tomeHeader(title) {
    return `
      <div class="tome-header">
        <h3 class="tome-heading">${title}</h3>
        ${TOME_FLOURISH}
      </div>
    `;
  }

  function getCardCorners() {
    return (App.FieldBook && App.FieldBook.CARD_CORNERS_SVG) || "";
  }

  function getClueArt(id) {
    return App.FieldBook && App.FieldBook.getClueArtSVG ? App.FieldBook.getClueArtSVG(id) : "";
  }

  function getWoodVignette(kind) {
    return App.FieldBook && App.FieldBook.woodVignetteSVG
      ? App.FieldBook.woodVignetteSVG(kind, "tome_")
      : "";
  }

  function renderRulesSpread0(leftEl, rightEl) {
    leftEl.innerHTML = `
      <div class="tome-cover-page">
        <div class="tome-cover-kicker">OFFICIAL CABIN HANDBOOK</div>
        <div class="tome-cover-title">DUSKWOOD INN</div>
        <div class="tome-cover-sub">GAME MANUAL</div>
        <div class="tome-cover-art">${TOME_RUNNER_SVG}</div>
        <p class="tome-cover-note">
          Use the chapter tabs or page arrows to read the rules.<br/>
          Switch to <strong>CARDS</strong> above to browse the Card Codex.
        </p>
      </div>
    `;

    const tocEntries = [
      { label: "quick how-to",       page: 2, spread: 1 },
      { label: "clue overview",      page: 4, spread: 2 },
      { label: "opening & controls", page: 5, spread: 2 },
      { label: "clue types",         page: 6, spread: 3 },
      { label: "stealth mechanics",  page: 8, spread: 4 },
      { label: "general tips",       page: 9, spread: 4 }
    ];

    rightEl.innerHTML = `
      ${tomeHeader("TABLE OF CONTENTS")}
      <div class="tome-toc-list">
        ${tocEntries
          .map(
            (e) => `
          <button type="button" class="tome-toc-row" data-tome-jump="${e.spread}">
            <span class="tome-toc-label">${e.label}</span>
            <span class="tome-toc-dots" aria-hidden="true"></span>
            <span class="tome-toc-num">${e.page}</span>
          </button>`
          )
          .join("")}
      </div>
      <p class="tome-footnote">
        *During a match, press <strong>[B]</strong> to open your interactive Clue &amp; Exit Room deduction book.
      </p>
    `;
  }

  function renderRulesSpread1(leftEl, rightEl) {
    const corners = getCardCorners();
    leftEl.innerHTML = `
      ${tomeHeader("QUICK HOW-TO")}
      <p class="tome-lead"><strong class="tome-accent-red">OBJECTIVE:</strong> reveal 3 clues to find the exit room.</p>
      <p class="tome-bullet">&bull; there are 3 main types of playable cards (plus Lifesaver wards).</p>

      <div class="tome-howto-cards-row">
        <div class="tome-howto-card-col">
          <div class="fb-ornate-mini-card tome-mini-card">
            ${corners}
            <span class="fb-omc-head">CATCHING UP</span>
            <span class="fb-omc-body">ADVANCE +30<br>MINUTES</span>
            <span class="fb-omc-badge">30m</span>
          </div>
          <span class="tome-card-cap">progress<br>cards</span>
        </div>

        <div class="tome-howto-card-col">
          <div class="fb-ornate-mini-card tome-mini-card">
            ${corners}
            <span class="fb-omc-head">PARANORMAL</span>
            <div class="fb-omc-art">${getClueArt("paranormal_alt")}</div>
          </div>
          <span class="tome-card-cap">clue<br>cards</span>
        </div>

        <div class="tome-howto-card-col">
          <div class="fb-ornate-mini-card tome-mini-card">
            ${corners}
            <span class="fb-omc-head">L-HALLWAY</span>
            <svg viewBox="0 0 60 60" class="fb-omc-room-svg" aria-hidden="true">
              <path d="M8,6 L34,6 L34,30 L54,30 L54,54 L8,54 Z" fill="#efe6cf" stroke="#36281c" stroke-width="2.2"/>
              <rect x="34" y="6" width="20" height="24" fill="#c7b591" opacity="0.65"/>
            </svg>
          </div>
          <span class="tome-card-cap">room<br>cards</span>
        </div>
      </div>

      <div class="tome-howto-event-row">
        <div class="fb-ornate-mini-card is-event-sample tome-mini-card">
          ${corners}
          <span class="fb-omc-head is-red">THE TALL MAN</span>
          <span class="fb-omc-body">TURN OFF ALL LIGHTS<br>SO IT CANNOT SEE</span>
        </div>
        <p class="tome-bullet">&bull; watch out for<br>event cards!</p>
      </div>

      <div class="tome-death-warn-row">
        <svg viewBox="0 0 44 44" class="fb-clock-sketch" aria-hidden="true">
          <circle cx="22" cy="22" r="18" fill="#ede4ce" stroke="#221912" stroke-width="2.2"/>
          <circle cx="22" cy="22" r="14.5" fill="none" stroke="#221912" stroke-width="1"/>
          <line x1="22" y1="22" x2="22" y2="11" stroke="#221912" stroke-width="2"/>
          <line x1="22" y1="22" x2="30" y2="25" stroke="#221912" stroke-width="1.6"/>
          <circle cx="22" cy="22" r="2" fill="#221912"/>
        </svg>
        <p class="tome-death-warn-text">you will lose time (+1 HOUR in solo) for every death.</p>
      </div>
    `;

    rightEl.innerHTML = `
      ${tomeHeader("QUICK HOW-TO")}
      <div class="tome-stagger-stack">
        <div class="tome-stagger-row">
          <div class="tome-vignette">${getWoodVignette("player_track")}</div>
          <p class="tome-bullet">&bull; progress the player piece by playing progress cards.</p>
        </div>

        <div class="tome-stagger-row">
          <p class="tome-bullet">&bull; don't let the harvester catch up or it will be game over.</p>
          <div class="tome-vignette">${getWoodVignette("harvester_track")}</div>
        </div>

        <div class="tome-stagger-row">
          <div class="tome-vignette">${getWoodVignette("midnight_track")}</div>
          <p class="tome-bullet">&bull; the game ends once the player piece reaches 12 o' clock — head to your chosen exit room!</p>
        </div>
      </div>
    `;
  }

  function renderRulesSpread2(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${tomeHeader("CLUE OVERVIEW")}
      <p class="tome-bullet">&bull; reveal 3 clues to find the exit room.</p>

      <div class="tome-stagger-row compact-gap">
        <p class="tome-bullet">&bull; place a clue card in the graveyard to check for it.</p>
        <div class="tome-vignette">${getWoodVignette("graveyard_pedestal")}</div>
      </div>

      <p class="tome-crimson-rule">only the TOP clue will get checked every turn!</p>

      <div class="tome-stagger-row compact-gap">
        <div class="tome-vignette">${getWoodVignette("graveyard_hand")}</div>
        <p class="tome-bullet">&bull; on your turn, you can swap out a clue from the graveyard instead of drawing a new card.</p>
      </div>

      <p class="tome-footnote">*a clue will not appear if the room it spawns in does not exist.</p>
    `;

    rightEl.innerHTML = `
      ${tomeHeader("OPENING & CONTROLS")}
      <ol class="tome-open-list">
        <li><strong>Table Intro:</strong> Sit at the round table <strong>[E]</strong> — your piece rises from XII and circles the track before dealing <strong>The Cellar</strong>.</li>
        <li><strong>Turn 1:</strong> Place <strong>The Cellar</strong> beside The Dining Room. You are dealt <strong>3 cards</strong>, and your piece moves <strong>+15m</strong> each turn after.</li>
        <li><strong>Turn 2:</strong> Guaranteed draw of <strong>The Hollow Harvester</strong>. After <strong>3 turns</strong>, it rises at XII and hunts <strong>+30m/turn</strong>.</li>
      </ol>

      <div class="tome-controls-grid">
        <div class="tome-key-row"><kbd>WASD</kbd><span>Move</span></div>
        <div class="tome-key-row"><kbd>SHIFT</kbd><span>Sprint</span></div>
        <div class="tome-key-row"><kbd>C</kbd><span>Crouch (Silent)</span></div>
        <div class="tome-key-row"><kbd>E</kbd><span>Sit / Inspect</span></div>
        <div class="tome-key-row"><kbd>T</kbd><span>Table View</span></div>
        <div class="tome-key-row"><kbd>F</kbd><span>Lantern / Action</span></div>
        <div class="tome-key-row"><kbd>R</kbd><span>Rotate Room 90&deg;</span></div>
        <div class="tome-key-row"><kbd>B</kbd><span>Clue Book</span></div>
      </div>

      <p class="tome-footnote">
        *At <strong>12:00 AM</strong>, sit at the table <strong>[E]</strong> to check your room map before running to the Exit Room!
      </p>
    `;
  }

  function renderRulesSpread3(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${tomeHeader("CLUE TYPES")}
      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; the grandfather clock</h4>
          <p class="tome-desc">when revealed, the player will hear the clock strike.</p>
        </div>
        <div class="tome-art-plate tilt-right">${getClueArt("clock")}</div>
      </div>

      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; evidence of a past player</h4>
          <p class="tome-desc">usually shows up in the form of written text on a wall, but can also be a body part or skeletal remains.</p>
        </div>
        <div class="tome-art-plate">${getClueArt("past_player")}</div>
      </div>

      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; corrupt painting</h4>
          <p class="tome-desc">a portrait that changes into something more ominous.</p>
        </div>
        <div class="tome-art-plate">${getClueArt("corrupt_painting")}</div>
      </div>
    `;

    rightEl.innerHTML = `
      ${tomeHeader("CLUE TYPES")}
      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; paranormal alteration</h4>
          <p class="tome-desc">a room's furniture, fixtures or wallpaper will change.</p>
        </div>
        <div class="tome-art-plate">${getClueArt("paranormal_alt")}</div>
      </div>

      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; tic tac toe</h4>
          <p class="tome-desc">will appear across 5 different rooms in the form of an X or an O. Whichever symbol appears 3 times is the winning symbol.</p>
        </div>
        <div class="tome-art-plate">${getClueArt("ttt_demo")}</div>
      </div>

      <div class="tome-clue-doc-row">
        <div class="tome-doc-text">
          <h4 class="tome-sub-accent">&bull; the chicken decor</h4>
          <p class="tome-desc">a symbol of a chicken will appear on a wall, however sometimes it can be a fake clue. A fake chicken will lose its head, but only when the 3rd and final clue has been revealed.</p>
        </div>
        <div class="tome-art-plate">${getClueArt("chicken_decor")}</div>
      </div>
    `;
  }

  function renderRulesSpread4(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${tomeHeader("STEALTH MECHANICS")}
      <div class="tome-tips-stack">
        <div>
          <h4 class="tome-sub-accent">&bull; you are hidden in the dark</h4>
          <p class="tome-desc">toggle room light switches with [E] and be careful about keeping your lantern [F] lit during survival events.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; hide behind furniture</h4>
          <p class="tome-desc">use beds, sofas, desks, wall alcoves, and cellar crates to break line of sight whenever something stalks the halls.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; footsteps make noise</h4>
          <p class="tome-desc">sprinting with [SHIFT] echoes louder across wooden floorboards; press [C] to crouch and move silently.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; stay out of the way</h4>
          <p class="tome-desc">some entities can still catch you if they bump directly into you in the dark.</p>
        </div>
      </div>
    `;

    rightEl.innerHTML = `
      ${tomeHeader("GENERAL TIPS")}
      <div class="tome-tips-stack">
        <div>
          <h4 class="tome-sub-accent">&bull; flip room light switches</h4>
          <p class="tome-desc">press [E] on wall switches to toggle room lights whenever an event demands darkness or illumination.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; create loops &amp; manage rooms</h4>
          <p class="tome-desc">rotate room cards with [R] to link T-Hallways, L-Hallways, and Living Rooms into safe escape loops.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; inspect wall portraits</h4>
          <p class="tome-desc">press [E] near framed portraits to inspect them closely for the Corrupt Painting clue.</p>
        </div>
        <div>
          <h4 class="tome-sub-accent">&bull; track clues in-game with [B]</h4>
          <p class="tome-desc">left-click confirmed clues to circle them in red ink and right-click ruled-out clues to cross them off.</p>
        </div>
      </div>
    `;
  }

  function renderRulesSpread() {
    const leftEl = document.getElementById("tome-rules-left");
    const rightEl = document.getElementById("tome-rules-right");
    const numLeft = document.getElementById("tome-num-left");
    const numRight = document.getElementById("tome-num-right");
    const prevBtn = document.getElementById("tome-prev-btn");
    const nextBtn = document.getElementById("tome-next-btn");
    if (!leftEl || !rightEl) return;

    if (currentRulesSpread === 0) renderRulesSpread0(leftEl, rightEl);
    else if (currentRulesSpread === 1) renderRulesSpread1(leftEl, rightEl);
    else if (currentRulesSpread === 2) renderRulesSpread2(leftEl, rightEl);
    else if (currentRulesSpread === 3) renderRulesSpread3(leftEl, rightEl);
    else renderRulesSpread4(leftEl, rightEl);

    if (numLeft) numLeft.textContent = String(currentRulesSpread * 2);
    if (numRight) numRight.textContent = String(currentRulesSpread * 2 + 1);
    if (prevBtn) prevBtn.disabled = currentRulesSpread <= 0;
    if (nextBtn) nextBtn.disabled = currentRulesSpread >= TOTAL_RULES_SPREADS - 1;

    document.querySelectorAll(".tome-chapter-btn[data-tome-jump]").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.getAttribute("data-tome-jump")) === currentRulesSpread);
    });
  }

  function goToRulesSpread(idx) {
    const clamped = Math.max(0, Math.min(TOTAL_RULES_SPREADS - 1, idx));
    if (clamped === currentRulesSpread) return;
    currentRulesSpread = clamped;
    App.Audio.pageFlip();
    renderRulesSpread();
  }

  // ==================== CARDS TAB: CARD CODEX ====================
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

    activeBookTab = tabName;
    rulesEl.classList.toggle("hidden", tabName !== "rules");
    codexEl.classList.toggle("hidden", tabName !== "codex");

    document.querySelectorAll("[data-book-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-book-tab") === tabName);
    });

    if (tabName === "codex") {
      renderGrid();
      renderInspector();
    } else {
      renderRulesSpread();
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

      const jumpBtn = e.target.closest("[data-tome-jump]");
      if (jumpBtn) {
        goToRulesSpread(Number(jumpBtn.getAttribute("data-tome-jump")));
        return;
      }

      const navBtn = e.target.closest("[data-tome-nav]");
      if (navBtn) {
        const dir = navBtn.getAttribute("data-tome-nav");
        goToRulesSpread(currentRulesSpread + (dir === "next" ? 1 : -1));
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

    document.addEventListener("keydown", (e) => {
      const modal = document.getElementById("modal-howto");
      if (!modal || modal.classList.contains("hidden") || activeBookTab !== "rules") return;
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        goToRulesSpread(currentRulesSpread - 1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        goToRulesSpread(currentRulesSpread + 1);
      }
    });
  }

  function init() {
    loadDiscovered();
    updateCountBadge();
    renderRulesSpread();
    renderGrid();
    renderInspector();
    bindEvents();
  }

  App.GuideUI = {
    init,
    switchBookTab,
    goToRulesSpread,
    discoverCard
  };
})(window.Duskwood);
