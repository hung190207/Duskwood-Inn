/* ==========================================================================
   DUSKWOOD INN - Authentic Vintage Cabin Game Manual & Deduction Book ([B])
   Faithfully styled after the 5 reference pages:
   - Spread 0 (Pages 0-1): Game Manual Title & Running Peg Figure | Clickable Table of Contents
   - Spread 1 (Pages 2-3): QUICK HOW-TO (Ornate cards & wood-table groove vignettes)
   - Spread 2 (Pages 4-5): CLUE OVERVIEW & DISCOVERED CLUES (Interactive Deduction!)
       * Left-Click Clue  : Painterly dark-crimson ink CIRCLE (Confirmed Present)
       * Right-Click Clue : Painterly dark-crimson ink X (Ruled Out)
       * Eliminated room scroll banners fade smoothly to translucent ink!
   - Spread 3 (Pages 6-7): CLUE TYPES (6 vintage ink illustrations & rules)
   - Spread 4 (Pages 8-9): STEALTH MECHANICS & GENERAL TIPS
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const CLUE_ITEMS = [
    { id: "clock",            label: "THE GRANDFATHER<br>CLOCK", omenId: "om_grandfather_clock", row: 1 },
    { id: "past_player",      label: "THE PAST PLAYER",          omenId: "om_past_traveler",     row: 1 },
    { id: "corrupt_painting", label: "CORRUPT PAINTING",         omenId: "om_corrupt_painting",  row: 1 },
    { id: "paranormal_alt",   label: "PARANORMAL<br>ALTERATION", omenId: "om_paranormal_alt",    row: 2 },
    { id: "chicken_decor",    label: "CHICKEN DECOR",            omenId: "om_rooster_decor",     row: 2 },
    { id: "winning_x",        label: "WINNING X SYMBOL",         omenId: "om_chalk_grid",        row: 2 },
    { id: "winning_o",        label: "WINNING O SYMBOL",         omenId: "om_chalk_grid",        row: 2 }
  ];

  const EXIT_ROOMS = [
    { id: "dining_room",    name: "THE DINING ROOM",  col: 0, clues: ["clock", "past_player", "corrupt_painting"] },
    { id: "bp_kitchen",     name: "THE KITCHEN",      col: 0, clues: ["winning_x", "chicken_decor", "paranormal_alt"] },
    { id: "bp_bathroom",    name: "THE BATHROOM",     col: 0, clues: ["past_player", "paranormal_alt", "winning_o"] },
    { id: "bp_furnace",     name: "THE FURNACE ROOM", col: 0, clues: ["clock", "past_player", "winning_o"] },
    { id: "bp_study",       name: "THE STUDY",        col: 0, clues: ["clock", "corrupt_painting", "paranormal_alt"] },
    { id: "bp_bedroom",     name: "THE BEDROOM",      col: 0, clues: ["corrupt_painting", "chicken_decor", "winning_o"] },
    { id: "bp_living_room", name: "THE LIVING ROOM",  col: 1, clues: ["clock", "chicken_decor", "paranormal_alt"] },
    { id: "bp_t_hallway_1", name: "T-HALL I",         col: 1, clues: ["clock", "past_player", "chicken_decor"] },
    { id: "bp_t_hallway_2", name: "T-HALL II",        col: 1, clues: ["winning_x", "corrupt_painting", "past_player"] },
    { id: "bp_hallway_1",   name: "HALL I",           col: 1, clues: ["corrupt_painting", "paranormal_alt", "winning_o"] },
    { id: "bp_hallway_2",   name: "HALL II",          col: 1, clues: ["winning_x", "clock", "corrupt_painting"] },
    { id: "bp_l_hallway",   name: "L-HALL",           col: 1, clues: ["past_player", "chicken_decor", "paranormal_alt"] }
  ];

  const EXIT_ROOM_MAP = {};
  EXIT_ROOMS.forEach((r) => {
    EXIT_ROOM_MAP[r.id] = r;
  });

  const TOTAL_SPREADS = 5;

  let isOpen = false;
  let currentSpread = 0;
  let clueMarks = {};
  let roomManualMarks = {};

  function resetNotes() {
    clueMarks = {};
    roomManualMarks = {};
    if (isOpen && currentSpread === 2) renderSpread2();
  }

  const FILIGREE_FLOURISH = `
    <svg viewBox="0 0 260 24" class="fb-flourish-svg" aria-hidden="true">
      <g fill="none" stroke="#221912" stroke-linecap="round">
        <path d="M22,6 C58,14 96,4 130,15 C164,4 202,14 238,6" stroke-width="1.35"/>
        <path d="M56,11 C88,16 112,18 130,13 C148,18 172,16 204,11" stroke-width="1.05"/>
        <path d="M44,10 C32,12 28,21 38,22 C46,23 49,17 44,14 C40,12 37,15 39,18" stroke-width="1.45"/>
        <path d="M26,7 C18,6 13,4 9,2" stroke-width="1.2"/>
        <path d="M216,10 C228,12 232,21 222,22 C214,23 211,17 216,14 C220,12 223,15 221,18" stroke-width="1.45"/>
        <path d="M234,7 C242,6 247,4 251,2" stroke-width="1.2"/>
        <path d="M114,15 Q130,22 146,15 Q130,9 114,15 Z" stroke-width="1.15" fill="#221912" fill-opacity="0.12"/>
        <circle cx="130" cy="15" r="2.2" fill="#221912"/>
        <circle cx="44" cy="4" r="1.4" fill="#221912"/>
        <circle cx="216" cy="4" r="1.4" fill="#221912"/>
      </g>
    </svg>
  `;

  function pageHeader(title) {
    return `
      <div class="fb-header">
        <h3 class="fb-heading">${title}</h3>
        ${FILIGREE_FLOURISH}
      </div>
    `;
  }

  const BRUSH_CIRCLE_SVG = `
    <svg viewBox="0 0 110 116" class="fb-brush-circle-svg" aria-hidden="true">
      <path d="M58,8 C88,6 104,28 103,58 C102,88 84,108 54,108 C22,108 7,86 8,55 C9,24 29,9 62,10 C86,11 98,28 97,52"
            fill="none" stroke="#6e1616" stroke-width="6.2" stroke-linecap="round" opacity="0.72"/>
      <path d="M52,12 C24,14 11,34 12,60 C13,86 30,104 58,103 C84,102 99,82 98,54 C97,29 81,13 55,13"
            fill="none" stroke="#8a2020" stroke-width="3.2" stroke-linecap="round" opacity="0.65"/>
    </svg>
  `;

  const BRUSH_X_SVG = `
    <svg viewBox="0 0 110 116" class="fb-brush-x-svg" aria-hidden="true">
      <path d="M14,16 C38,44 72,76 96,102" fill="none" stroke="#731717" stroke-width="7.5" stroke-linecap="round" opacity="0.82"/>
      <path d="M94,14 C68,46 38,76 15,103" fill="none" stroke="#851c1c" stroke-width="7.0" stroke-linecap="round" opacity="0.80"/>
    </svg>
  `;

  const CARD_CORNERS_SVG = `
    <svg viewBox="0 0 100 112" preserveAspectRatio="none" class="fb-card-frame-svg" aria-hidden="true">
      <rect x="4" y="4" width="92" height="104" rx="2" fill="none" stroke="#241b13" stroke-width="1.8"/>
      <rect x="7.5" y="7.5" width="85" height="97" rx="1" fill="none" stroke="#3d2e21" stroke-width="0.8"/>
      <path d="M4,16 C4,9 9,4 16,4 M8,12 C10,9 12,8 14,8" fill="none" stroke="#1e150e" stroke-width="1.8"/>
      <path d="M84,4 C91,4 96,9 96,16 M86,8 C88,8 90,9 92,12" fill="none" stroke="#1e150e" stroke-width="1.8"/>
      <path d="M4,96 C4,103 9,108 16,108 M8,100 C10,103 12,104 14,104" fill="none" stroke="#1e150e" stroke-width="1.8"/>
      <path d="M84,108 C91,108 96,103 96,96 M86,104 C88,104 90,103 92,100" fill="none" stroke="#1e150e" stroke-width="1.8"/>
      <circle cx="8" cy="8" r="1.8" fill="#1e150e"/>
      <circle cx="92" cy="8" r="1.8" fill="#1e150e"/>
      <circle cx="8" cy="104" r="1.8" fill="#1e150e"/>
      <circle cx="92" cy="104" r="1.8" fill="#1e150e"/>
    </svg>
  `;

  const COVER_RUNNER_SVG = `
    <svg viewBox="0 0 90 120" class="fb-cover-runner-svg" aria-hidden="true">
      <g fill="#18120d">
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

  function getClueArtSVG(id) {
    if (id === "clock") {
      return `
        <svg viewBox="0 0 64 82" class="fb-ink-svg" aria-hidden="true">
          <path d="M20,10 Q32,1 44,10 L47,16 L17,16 Z" fill="#2b241e" stroke="#140f0b" stroke-width="1.6"/>
          <rect x="20" y="16" width="24" height="20" fill="#3a3129" stroke="#140f0b" stroke-width="1.6"/>
          <circle cx="32" cy="26" r="7.5" fill="#ede4ce" stroke="#140f0b" stroke-width="1.5"/>
          <line x1="32" y1="26" x2="32" y2="20.5" stroke="#140f0b" stroke-width="1.6"/>
          <line x1="32" y1="26" x2="36.5" y2="26" stroke="#140f0b" stroke-width="1.3"/>
          <rect x="22" y="36" width="20" height="33" fill="#332a22" stroke="#140f0b" stroke-width="1.6"/>
          <rect x="26" y="40" width="12" height="25" fill="#171310"/>
          <line x1="32" y1="41" x2="33.5" y2="57" stroke="#d9c8a2" stroke-width="1.3"/>
          <circle cx="33.5" cy="58.5" r="3" fill="#d9c8a2"/>
          <rect x="17" y="69" width="30" height="9" fill="#29221b" stroke="#140f0b" stroke-width="1.6"/>
        </svg>`;
    }
    if (id === "past_player") {
      return `
        <svg viewBox="0 0 76 78" class="fb-ink-svg" aria-hidden="true">
          <text x="38" y="23" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-style="italic" font-weight="700" font-size="16" fill="#18120d" transform="rotate(-6 38 23)">Help us</text>
          <path d="M22,49 C20,35 28,28 38,28 C48,28 56,35 54,49 C53,55 49,58 47,63 L47,70 L29,70 L29,63 C27,58 23,55 22,49 Z" fill="#dfd5be" stroke="#18120d" stroke-width="2.1"/>
          <ellipse cx="31" cy="46" rx="5" ry="5.8" fill="#18120d"/>
          <ellipse cx="45" cy="46" rx="5" ry="5.8" fill="#18120d"/>
          <path d="M38,51 L35,57 L41,57 Z" fill="#18120d"/>
          <line x1="33" y1="63" x2="33" y2="70" stroke="#18120d" stroke-width="1.7"/>
          <line x1="38" y1="63" x2="38" y2="70" stroke="#18120d" stroke-width="1.7"/>
          <line x1="43" y1="63" x2="43" y2="70" stroke="#18120d" stroke-width="1.7"/>
        </svg>`;
    }
    if (id === "corrupt_painting") {
      return `
        <svg viewBox="0 0 76 76" class="fb-ink-svg" aria-hidden="true">
          <rect x="6" y="7" width="64" height="62" fill="#211a14" stroke="#120d09" stroke-width="2.6"/>
          <rect x="12" y="13" width="52" height="50" fill="#eee5d0" stroke="#120d09" stroke-width="1.4"/>
          <path d="M17,63 C20,48 28,43 38,43 C48,43 56,48 59,63 Z" fill="#161311"/>
          <ellipse cx="38" cy="30" rx="9.5" ry="11.5" fill="#d9cdb3" stroke="#161311" stroke-width="1.6"/>
          <path d="M29,26 C30,17 46,17 47,26 C43,22 33,22 29,26 Z" fill="#161311"/>
          <path d="M32,37 Q38,46 44,37 L42,44 L34,44 Z" fill="#161311"/>
          <circle cx="34.5" cy="29.5" r="1.5" fill="#161311"/>
          <circle cx="41.5" cy="29.5" r="1.5" fill="#161311"/>
        </svg>`;
    }
    if (id === "paranormal_alt") {
      return `
        <svg viewBox="0 0 80 76" class="fb-ink-svg" aria-hidden="true">
          <g transform="translate(4,6) rotate(-14 22 28)">
            <ellipse cx="18" cy="36" rx="9" ry="12" fill="#d9ceb6" stroke="#1c1510" stroke-width="2.3"/>
            <line x1="15" y1="25" x2="15" y2="47" stroke="#1c1510" stroke-width="1.2"/>
            <line x1="21" y1="25" x2="21" y2="47" stroke="#1c1510" stroke-width="1.2"/>
            <rect x="14" y="21" width="22" height="5" fill="#2b221a"/>
            <line x1="17" y1="21" x2="15" y2="4" stroke="#1c1510" stroke-width="2.3"/>
            <line x1="33" y1="21" x2="31" y2="4" stroke="#1c1510" stroke-width="2.3"/>
          </g>
          <g transform="translate(42,10) rotate(8 18 30)">
            <ellipse cx="18" cy="16" rx="9" ry="12" fill="#d9ceb6" stroke="#1c1510" stroke-width="2.3"/>
            <line x1="15" y1="5" x2="15" y2="27" stroke="#1c1510" stroke-width="1.2"/>
            <line x1="21" y1="5" x2="21" y2="27" stroke="#1c1510" stroke-width="1.2"/>
            <rect x="4" y="28" width="24" height="5.5" fill="#2b221a"/>
            <line x1="7" y1="33" x2="5" y2="54" stroke="#1c1510" stroke-width="2.3"/>
            <line x1="25" y1="33" x2="27" y2="54" stroke="#1c1510" stroke-width="2.3"/>
            <line x1="16" y1="33" x2="16" y2="50" stroke="#1c1510" stroke-width="1.8"/>
          </g>
        </svg>`;
    }
    if (id === "chicken_decor") {
      return `
        <svg viewBox="0 0 80 78" class="fb-ink-svg" aria-hidden="true">
          <path d="M22,22 C19,14 26,11 29,15 C32,10 38,13 36,19 C34,25 36,31 43,33 C52,35 60,25 69,28 C64,35 69,40 61,45 C56,52 46,56 35,55 C24,54 17,45 19,35 C20,30 22,26 22,22 Z" fill="#261f19" stroke="#140f0b" stroke-width="1.7"/>
          <path d="M20,24 L13,27.5 L20,30 Z" fill="#261f19"/>
          <circle cx="25" cy="23" r="1.6" fill="#f3ead4"/>
          <path d="M31,39 Q42,36 49,44 Q39,50 31,39 Z" fill="#52463a"/>
          <line x1="34" y1="55" x2="32" y2="68" stroke="#18120d" stroke-width="2.4"/>
          <line x1="43" y1="55" x2="45" y2="68" stroke="#18120d" stroke-width="2.4"/>
          <path d="M26,68 L36,68 M40,68 L51,68" stroke="#18120d" stroke-width="2.1"/>
        </svg>`;
    }
    if (id === "winning_x") {
      return `
        <svg viewBox="0 0 76 76" class="fb-ink-svg" aria-hidden="true">
          <line x1="27" y1="10" x2="27" y2="66" stroke="#1b140f" stroke-width="2.1"/>
          <line x1="49" y1="10" x2="49" y2="66" stroke="#1b140f" stroke-width="2.1"/>
          <line x1="10" y1="27" x2="66" y2="27" stroke="#1b140f" stroke-width="2.1"/>
          <line x1="10" y1="49" x2="66" y2="49" stroke="#1b140f" stroke-width="2.1"/>
          <path d="M13,13 L23,23 M23,13 L13,23" stroke="#1b140f" stroke-width="2.5"/>
          <path d="M33,33 L43,43 M43,33 L33,43" stroke="#1b140f" stroke-width="2.5"/>
          <path d="M53,53 L63,63 M63,53 L53,63" stroke="#1b140f" stroke-width="2.5"/>
          <line x1="11" y1="11" x2="65" y2="65" stroke="#24180f" stroke-width="2.2" stroke-linecap="round"/>
        </svg>`;
    }
    if (id === "ttt_demo") {
      return `
        <svg viewBox="0 0 84 78" class="fb-ink-svg" aria-hidden="true">
          <g transform="rotate(-11 42 39)" stroke="#1b140f" stroke-linecap="round" fill="none">
            <line x1="30" y1="10" x2="30" y2="68" stroke-width="2.4"/>
            <line x1="54" y1="10" x2="54" y2="68" stroke-width="2.4"/>
            <line x1="10" y1="29" x2="74" y2="29" stroke-width="2.4"/>
            <line x1="10" y1="50" x2="74" y2="50" stroke-width="2.4"/>
            <path d="M14,13 L24,24 M24,13 L14,24" stroke-width="2.6"/>
            <path d="M37,34 L47,45 M47,34 L37,45" stroke-width="2.6"/>
            <path d="M60,54 L70,65 M70,54 L60,65" stroke-width="2.6"/>
            <ellipse cx="42" cy="19" rx="5" ry="6.5" stroke-width="2.4"/>
            <ellipse cx="64" cy="19" rx="5" ry="6.5" stroke-width="2.4"/>
            <ellipse cx="64" cy="39" rx="5" ry="6.5" stroke-width="2.4"/>
            <path d="M14,55 L24,65 M24,55 L14,65" stroke-width="2.4"/>
            <line x1="11" y1="10" x2="73" y2="68" stroke-width="2.4"/>
          </g>
        </svg>`;
    }
    return `
      <svg viewBox="0 0 76 76" class="fb-ink-svg" aria-hidden="true">
        <line x1="27" y1="10" x2="27" y2="66" stroke="#1b140f" stroke-width="2.1"/>
        <line x1="49" y1="10" x2="49" y2="66" stroke="#1b140f" stroke-width="2.1"/>
        <line x1="10" y1="27" x2="66" y2="27" stroke="#1b140f" stroke-width="2.1"/>
        <line x1="10" y1="49" x2="66" y2="49" stroke="#1b140f" stroke-width="2.1"/>
        <circle cx="58" cy="18" r="5.8" fill="none" stroke="#1b140f" stroke-width="2.4"/>
        <circle cx="38" cy="38" r="5.8" fill="none" stroke="#1b140f" stroke-width="2.4"/>
        <circle cx="18" cy="58" r="5.8" fill="none" stroke="#1b140f" stroke-width="2.4"/>
        <line x1="65" y1="11" x2="11" y2="65" stroke="#24180f" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
  }

  function woodVignetteSVG(kind) {
    if (kind === "player_track") {
      return `
        <svg viewBox="0 0 150 105" class="fb-photo-svg" aria-hidden="true">
          <defs>
            <radialGradient id="wd1" cx="50%" cy="48%" r="58%">
              <stop offset="0%" stop-color="#9c734c"/>
              <stop offset="68%" stop-color="#6b4a2e"/>
              <stop offset="100%" stop-color="#362213"/>
            </radialGradient>
          </defs>
          <rect width="150" height="105" fill="url(#wd1)"/>
          <path d="M-10,20 Q75,5 160,22" fill="none" stroke="#2b180c" stroke-width="3" opacity="0.45"/>
          <path d="M-10,58 Q75,78 160,55" fill="none" stroke="#361f10" stroke-width="8" opacity="0.48"/>
          <path d="M-10,58 Q75,78 160,55" fill="none" stroke="#1c0f08" stroke-width="1.6"/>
          <ellipse cx="74" cy="78" rx="18" ry="6" fill="rgba(16,8,4,0.68)"/>
          <g fill="#f5ecd8" stroke="#59432c" stroke-width="1.2">
            <circle cx="72" cy="26" r="8"/>
            <path d="M67,35 L77,35 L79,55 L66,55 Z"/>
            <path d="M67,37 L54,42 L57,49 L67,44 Z"/>
            <path d="M77,37 L91,34 L91,42 L77,45 Z"/>
            <path d="M66,54 L57,68 L64,71 L72,58 Z"/>
            <path d="M75,54 L88,61 L84,74 L77,72 L79,63 L72,59 Z"/>
          </g>
        </svg>`;
    }
    if (kind === "harvester_track") {
      return `
        <svg viewBox="0 0 150 105" class="fb-photo-svg" aria-hidden="true">
          <defs>
            <radialGradient id="wd2" cx="50%" cy="50%" r="58%">
              <stop offset="0%" stop-color="#9e7650"/>
              <stop offset="70%" stop-color="#69482d"/>
              <stop offset="100%" stop-color="#301e11"/>
            </radialGradient>
          </defs>
          <rect width="150" height="105" fill="url(#wd2)"/>
          <path d="M65,-5 Q102,48 52,110" fill="none" stroke="#2c190d" stroke-width="14" opacity="0.32"/>
          <path d="M65,-5 Q102,48 52,110" fill="none" stroke="#1a0e07" stroke-width="1.8"/>
          <path d="M84,-5 Q118,48 70,110" fill="none" stroke="#1a0e07" stroke-width="1.4" opacity="0.65"/>
          <path d="M72,82 L22,102" stroke="rgba(12,6,4,0.65)" stroke-width="5" stroke-linecap="round"/>
          <g fill="none" stroke="#120e12" stroke-width="2.6" stroke-linecap="round">
            <ellipse cx="74" cy="22" rx="6.5" ry="9" fill="#181218"/>
            <path d="M74,31 C70,45 78,56 73,68"/>
            <path d="M72,38 C60,44 52,58 46,66"/>
            <path d="M75,38 C89,44 96,56 102,65"/>
            <path d="M73,68 L62,84 M73,68 L83,83"/>
          </g>
        </svg>`;
    }
    if (kind === "midnight_track") {
      return `
        <svg viewBox="0 0 150 105" class="fb-photo-svg" aria-hidden="true">
          <defs>
            <radialGradient id="wd3" cx="50%" cy="50%" r="58%">
              <stop offset="0%" stop-color="#a37a52"/>
              <stop offset="70%" stop-color="#6b4a2e"/>
              <stop offset="100%" stop-color="#2e1c0f"/>
            </radialGradient>
          </defs>
          <rect width="150" height="105" fill="url(#wd3)"/>
          <path d="M-8,82 Q75,68 158,34" fill="none" stroke="#2e1a0e" stroke-width="12" opacity="0.35"/>
          <path d="M-8,82 Q75,68 158,34" fill="none" stroke="#1a0e07" stroke-width="1.6"/>
          <ellipse cx="44" cy="83" rx="14" ry="5" fill="rgba(16,8,4,0.6)"/>
          <g transform="translate(12,16) scale(0.72)" fill="#f5ecd8" stroke="#59432c" stroke-width="1.2">
            <circle cx="44" cy="26" r="8"/><path d="M39,35 L49,35 L51,55 L38,55 Z"/>
            <path d="M39,37 L27,42 L30,49 L39,44 Z"/><path d="M49,37 L63,34 L63,42 L49,45 Z"/>
            <path d="M38,54 L29,68 L36,71 L44,58 Z"/><path d="M47,54 L60,61 L56,74 L49,72 L51,63 L44,59 Z"/>
          </g>
          <g fill="none" stroke="#120e12" stroke-width="2.2" stroke-linecap="round">
            <ellipse cx="116" cy="24" rx="5.5" ry="7.5" fill="#181218"/>
            <path d="M116,32 L114,62 M115,38 L100,54 M117,38 L130,54 M114,62 L106,74 M114,62 L122,74"/>
          </g>
        </svg>`;
    }
    if (kind === "graveyard_pedestal") {
      return `
        <svg viewBox="0 0 155 108" class="fb-photo-svg" aria-hidden="true">
          <defs>
            <radialGradient id="wd4" cx="50%" cy="48%" r="58%">
              <stop offset="0%" stop-color="#9e754d"/>
              <stop offset="72%" stop-color="#5c3d24"/>
              <stop offset="100%" stop-color="#29180d"/>
            </radialGradient>
          </defs>
          <rect width="155" height="108" fill="url(#wd4)"/>
          <polygon points="40,30 100,14 128,58 68,78" fill="#4f331e" stroke="#1c1008" stroke-width="2.2"/>
          <polygon points="68,78 128,58 128,74 68,94" fill="#331e10" stroke="#140b05" stroke-width="2"/>
          <polygon points="40,30 68,78 68,94 40,46" fill="#26160c" stroke="#140b05" stroke-width="2"/>
          <polygon points="50,33 96,21 116,53 70,66" fill="#f3ebd6" stroke="#24180f" stroke-width="1.6"/>
          <circle cx="83" cy="43" r="6" fill="#2b2016" opacity="0.8"/>
          <polygon points="78,86 118,73 122,80 82,93" fill="#f7eed8" stroke="#24180f" stroke-width="1.4"/>
          <text x="98" y="75" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-size="8" fill="#e6cfa0" transform="rotate(-18 98 75)">It is Your Turn</text>
        </svg>`;
    }
    return `
      <svg viewBox="0 0 155 108" class="fb-photo-svg" aria-hidden="true">
        <defs>
          <radialGradient id="wd5" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#9c744c"/>
            <stop offset="62%" stop-color="#4d321d"/>
            <stop offset="100%" stop-color="#140d09"/>
          </radialGradient>
        </defs>
        <rect width="155" height="108" fill="url(#wd5)"/>
        <path d="M8,16 Q77,64 147,16" fill="none" stroke="#24140a" stroke-width="18" opacity="0.45"/>
        <rect x="44" y="24" width="18" height="24" rx="1" fill="#f3ebd4" stroke="#24180f" stroke-width="1.4"/>
        <rect x="68" y="26" width="18" height="24" rx="1" fill="#f3ebd4" stroke="#24180f" stroke-width="1.4"/>
        <rect x="92" y="24" width="18" height="24" rx="1" fill="#f3ebd4" stroke="#24180f" stroke-width="1.4"/>
        <g transform="translate(77,94)">
          <rect x="-26" y="-26" width="22" height="30" fill="#efe4c8" stroke="#24180f" stroke-width="1.5" transform="rotate(-18)"/>
          <rect x="-11" y="-29" width="22" height="30" fill="#f6eed8" stroke="#24180f" stroke-width="1.5"/>
          <rect x="4" y="-26" width="22" height="30" fill="#efe4c8" stroke="#24180f" stroke-width="1.5" transform="rotate(18)"/>
        </g>
      </svg>`;
  }

  function computeRoomEliminationState(room) {
    let autoEliminated = false;
    for (const c of CLUE_ITEMS) {
      const m = clueMarks[c.id] || 0;
      const roomHasClue = room.clues.includes(c.id);
      if (m === 1 && !roomHasClue) {
        autoEliminated = true;
        break;
      }
      if (m === -1 && roomHasClue) {
        autoEliminated = true;
        break;
      }
    }
    const manual = roomManualMarks[room.id] || 0;
    return {
      autoEliminated,
      manual,
      isEliminated: autoEliminated || manual === -1,
      isPinned: !autoEliminated && manual === 1
    };
  }

  function renderSpread0(leftEl, rightEl) {
    leftEl.innerHTML = `
      <div class="fb-cover-page">
        <div class="fb-cover-logo">
          <span class="fb-logo-small">duskwood</span>
          <span class="fb-logo-mid">inn</span>
        </div>
        <div class="fb-cover-sub">game manual</div>
        <div class="fb-cover-art">${COVER_RUNNER_SVG}</div>
      </div>
    `;

    const tocEntries = [
      { label: "quick how-to",      page: 2, spread: 1 },
      { label: "clue overview",     page: 4, spread: 2 },
      { label: "discovered clues",  page: 5, spread: 2 },
      { label: "clue types",        page: 6, spread: 3 },
      { label: "stealth mechanics", page: 8, spread: 4 },
      { label: "general tips",      page: 9, spread: 4 }
    ];

    rightEl.innerHTML = `
      ${pageHeader("TABLE OF CONTENTS")}
      <div class="fb-toc-list">
        ${tocEntries
          .map(
            (e) => `
          <button type="button" class="fb-toc-row" data-book-jump="${e.spread}">
            <span class="fb-toc-label">${e.label}</span>
            <span class="fb-toc-dots" aria-hidden="true"></span>
            <span class="fb-toc-num">${e.page}</span>
          </button>`
          )
          .join("")}
      </div>
    `;
  }

  function renderSpread1(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${pageHeader("QUICK HOW-TO")}
      <p class="fb-lead"><strong class="fb-ink-red">objective:</strong> reveal 3 clues to find the exit room.</p>
      <p class="fb-bullet">&bull;there are 3 types of playable cards.</p>

      <div class="fb-howto-cards-row">
        <div class="fb-howto-card-col">
          <div class="fb-ornate-mini-card">
            ${CARD_CORNERS_SVG}
            <span class="fb-omc-head">CATCHING UP</span>
            <span class="fb-omc-body">ADVANCE +30<br>MINUTES</span>
            <span class="fb-omc-badge">30m</span>
          </div>
          <span class="fb-howto-card-cap">progress<br>cards</span>
        </div>

        <div class="fb-howto-card-col">
          <div class="fb-ornate-mini-card">
            ${CARD_CORNERS_SVG}
            <span class="fb-omc-head">PARANORMAL</span>
            <div class="fb-omc-art">${getClueArtSVG("paranormal_alt")}</div>
          </div>
          <span class="fb-howto-card-cap">clue<br>cards</span>
        </div>

        <div class="fb-howto-card-col">
          <div class="fb-ornate-mini-card is-room-sample">
            ${CARD_CORNERS_SVG}
            <span class="fb-omc-head">L-HALLWAY</span>
            <svg viewBox="0 0 60 60" class="fb-omc-room-svg" aria-hidden="true">
              <path d="M8,6 L34,6 L34,30 L54,30 L54,54 L8,54 Z" fill="#efe6cf" stroke="#36281c" stroke-width="2.2"/>
              <rect x="34" y="6" width="20" height="24" fill="#c7b591" opacity="0.65"/>
            </svg>
          </div>
          <span class="fb-howto-card-cap">room<br>cards</span>
        </div>
      </div>

      <div class="fb-howto-event-row">
        <div class="fb-ornate-mini-card is-event-sample">
          ${CARD_CORNERS_SVG}
          <span class="fb-omc-head is-red">THE TALL MAN</span>
          <span class="fb-omc-body">TURN OFF ALL LIGHTS<br>SO IT CANNOT SEE</span>
        </div>
        <p class="fb-bullet">&bull;watch out for<br>event cards!</p>
      </div>

      <div class="fb-death-warn-row">
        <svg viewBox="0 0 44 44" class="fb-clock-sketch" aria-hidden="true">
          <circle cx="22" cy="22" r="18" fill="#ede4ce" stroke="#221912" stroke-width="2.2"/>
          <circle cx="22" cy="22" r="14.5" fill="none" stroke="#221912" stroke-width="1"/>
          <line x1="22" y1="22" x2="22" y2="11" stroke="#221912" stroke-width="2"/>
          <line x1="22" y1="22" x2="30" y2="25" stroke="#221912" stroke-width="1.6"/>
          <circle cx="22" cy="22" r="2" fill="#221912"/>
        </svg>
        <p class="fb-death-warn-text">you will lose time for every<br>death.</p>
      </div>
    `;

    rightEl.innerHTML = `
      ${pageHeader("QUICK HOW-TO")}
      <div class="fb-stagger-stack">
        <div class="fb-stagger-row">
          <div class="fb-feathered-photo">${woodVignetteSVG("player_track")}</div>
          <p class="fb-bullet">&bull;progress the player piece by playing progress cards.</p>
        </div>

        <div class="fb-stagger-row">
          <p class="fb-bullet">&bull;don't let the harvester catch up or it will be game over.</p>
          <div class="fb-feathered-photo">${woodVignetteSVG("harvester_track")}</div>
        </div>

        <div class="fb-stagger-row">
          <div class="fb-feathered-photo">${woodVignetteSVG("midnight_track")}</div>
          <p class="fb-bullet">&bull;the game ends once the player piece reaches 12 o' clock.</p>
        </div>
      </div>
    `;
  }

  function renderSpread2() {
    const leftEl = document.getElementById("fb-page-left-body");
    const rightEl = document.getElementById("fb-page-right-body");
    if (!leftEl || !rightEl) return;

    leftEl.innerHTML = `
      ${pageHeader("CLUE OVERVIEW")}
      <p class="fb-bullet">&bull;reveal 3 clues to find the exit room.</p>

      <div class="fb-stagger-row compact-gap">
        <p class="fb-bullet">&bull;place a clue card in the graveyard to check for it.</p>
        <div class="fb-feathered-photo">${woodVignetteSVG("graveyard_pedestal")}</div>
      </div>

      <p class="fb-crimson-rule">only the TOP clue will get checked every turn!</p>

      <div class="fb-stagger-row compact-gap">
        <div class="fb-feathered-photo">${woodVignetteSVG("graveyard_hand")}</div>
        <p class="fb-bullet">&bull;on your turn, you can swap out a clue from the graveyard instead of drawing a new card.</p>
      </div>

      <p class="fb-crimson-footnote">*a clue will not appear if the room it spawns in does not exist.</p>
    `;

    const row1 = CLUE_ITEMS.filter((c) => c.row === 1);
    const row2 = CLUE_ITEMS.filter((c) => c.row === 2);

    const buildClueCardHtml = (c) => {
      const m = clueMarks[c.id] || 0;
      const cls = m === 1 ? " is-circled" : m === -1 ? " is-crossed" : "";
      return `
        <button type="button" class="fb-clue-card${cls}" data-clue-id="${c.id}" title="Left-Click: Circle (Confirmed) | Right-Click: Mark X (Ruled Out)">
          ${CARD_CORNERS_SVG}
          <span class="fb-clue-card-title">${c.label}</span>
          <div class="fb-clue-card-art">${getClueArtSVG(c.id)}</div>
          <span class="fb-ink-circle" aria-hidden="true">${BRUSH_CIRCLE_SVG}</span>
          <span class="fb-ink-x" aria-hidden="true">${BRUSH_X_SVG}</span>
        </button>
      `;
    };

    const col0 = EXIT_ROOMS.filter((r) => r.col === 0);
    const col1 = EXIT_ROOMS.filter((r) => r.col === 1);

    const buildRoomBannerHtml = (r) => {
      const st = computeRoomEliminationState(r);
      const cls =
        (st.isEliminated ? " is-eliminated" : "") +
        (st.isPinned ? " is-pinned" : "");
      return `
        <button type="button" class="fb-room-ribbon${cls}" data-room-id="${r.id}" title="Left-Click: Highlight Suspected Room | Right-Click: Rule Out">
          <span class="fb-ribbon-tail left" aria-hidden="true"></span>
          <span class="fb-ribbon-body">${r.name}</span>
          <span class="fb-ribbon-tail right" aria-hidden="true"></span>
        </button>
      `;
    };

    rightEl.innerHTML = `
      ${pageHeader("DISCOVERED CLUES")}
      <div class="fb-clue-grid-row row-3">${row1.map(buildClueCardHtml).join("")}</div>
      <div class="fb-clue-grid-row row-4">${row2.map(buildClueCardHtml).join("")}</div>

      <div class="fb-exit-title">THE EXIT ROOM WILL BE...</div>
      <div class="fb-rooms-two-col">
        <div class="fb-room-col">${col0.map(buildRoomBannerHtml).join("")}</div>
        <div class="fb-room-col">${col1.map(buildRoomBannerHtml).join("")}</div>
      </div>
    `;
  }

  function renderSpread3(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${pageHeader("CLUE TYPES")}
      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;the grandfather clock</h4>
          <p class="fb-desc">when revealed, the player will hear the clock strike.</p>
        </div>
        <div class="fb-doc-art tilt-right">${getClueArtSVG("clock")}</div>
      </div>

      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;evidence of a past player</h4>
          <p class="fb-desc">usually shows up in the form of written text on a wall, but can also be a body part or skeletal remains.</p>
        </div>
        <div class="fb-doc-art">${getClueArtSVG("past_player")}</div>
      </div>

      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;corrupt painting</h4>
          <p class="fb-desc">a portrait that changes into something more ominous.</p>
        </div>
        <div class="fb-doc-art is-portrait-art">${getClueArtSVG("corrupt_painting")}</div>
      </div>
    `;

    rightEl.innerHTML = `
      ${pageHeader("CLUE TYPES")}
      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;paranormal alteration</h4>
          <p class="fb-desc">a room's furniture, fixtures or wallpaper will change.</p>
        </div>
        <div class="fb-doc-art">${getClueArtSVG("paranormal_alt")}</div>
      </div>

      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;tic tac toe</h4>
          <p class="fb-desc">will appear across 5 different rooms in the form of an X or an O. Whichever symbol appears 3 times is the winning symbol.</p>
        </div>
        <div class="fb-doc-art">${getClueArtSVG("ttt_demo")}</div>
      </div>

      <div class="fb-clue-doc-row">
        <div class="fb-doc-text">
          <h4 class="fb-sub-red">&bull;the chicken decor</h4>
          <p class="fb-desc">a symbol of a chicken will appear on a wall, however sometimes it can be a fake clue. A fake chicken will lose its head, but only when the 3rd and final clue has been revealed.</p>
        </div>
        <div class="fb-doc-art">${getClueArtSVG("chicken_decor")}</div>
      </div>
    `;
  }

  function renderSpread4(leftEl, rightEl) {
    leftEl.innerHTML = `
      ${pageHeader("STEALTH MECHANICS")}
      <div class="fb-tips-stack">
        <div>
          <h4 class="fb-sub-red">&bull;you are hidden in the dark</h4>
          <p class="fb-desc">toggle room light switches with [E] and be careful about keeping your lantern [F] lit during survival events.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;hide behind furniture</h4>
          <p class="fb-desc">use beds, sofas, desks, and cellar crates to break line of sight whenever something stalks the halls.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;footsteps make noise</h4>
          <p class="fb-desc">sprinting with [SHIFT] echoes louder across wooden floorboards than walking quietly over rugs.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;stay out of the way</h4>
          <p class="fb-desc">some entities can still catch you if they bump directly into you in the dark.</p>
        </div>
      </div>
    `;

    rightEl.innerHTML = `
      ${pageHeader("GENERAL TIPS")}
      <div class="fb-tips-stack">
        <div>
          <h4 class="fb-sub-red">&bull;flip room light switches</h4>
          <p class="fb-desc">newly built rooms start dark — press [E] on wall switches to illuminate the room as brightly as The Dining Room.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;create loops &amp; manage rooms</h4>
          <p class="fb-desc">rotate room cards with [R] to link T-Hallways, L-Hallways, and Living Rooms into safe escape loops.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;inspect wall portraits</h4>
          <p class="fb-desc">press [E] near framed portraits to inspect them closely for the Corrupt Painting clue.</p>
        </div>
        <div>
          <h4 class="fb-sub-red">&bull;mark clues on page 5</h4>
          <p class="fb-desc">left-click confirmed clues to circle them in red ink and right-click ruled-out clues to cross them off.</p>
        </div>
      </div>
    `;
  }

  function renderCurrentSpread() {
    const leftEl = document.getElementById("fb-page-left-body");
    const rightEl = document.getElementById("fb-page-right-body");
    const leftNum = document.getElementById("fb-num-left");
    const rightNum = document.getElementById("fb-num-right");
    const prevBtn = document.getElementById("fb-prev-btn");
    const nextBtn = document.getElementById("fb-next-btn");
    const clearBtn = document.getElementById("fb-clear-btn");
    if (!leftEl || !rightEl) return;

    if (currentSpread === 0) renderSpread0(leftEl, rightEl);
    else if (currentSpread === 1) renderSpread1(leftEl, rightEl);
    else if (currentSpread === 2) renderSpread2();
    else if (currentSpread === 3) renderSpread3(leftEl, rightEl);
    else renderSpread4(leftEl, rightEl);

    if (leftNum) leftNum.textContent = String(currentSpread * 2);
    if (rightNum) rightNum.textContent = String(currentSpread * 2 + 1);
    if (prevBtn) prevBtn.classList.toggle("is-disabled", currentSpread <= 0);
    if (nextBtn) nextBtn.classList.toggle("is-disabled", currentSpread >= TOTAL_SPREADS - 1);
    if (clearBtn) clearBtn.classList.toggle("hidden", currentSpread !== 2);

    document.querySelectorAll("[data-book-jump]").forEach((b) => {
      if (b.classList.contains("fb-tab-btn")) {
        b.classList.toggle("active", Number(b.getAttribute("data-book-jump")) === currentSpread);
      }
    });
  }

  function goToSpread(idx) {
    const clamped = Math.max(0, Math.min(TOTAL_SPREADS - 1, idx));
    if (clamped === currentSpread) return;
    currentSpread = clamped;
    App.Audio.pageFlip();
    renderCurrentSpread();
  }

  function open(startSpread) {
    if (typeof startSpread === "number") {
      currentSpread = Math.max(0, Math.min(TOTAL_SPREADS - 1, startSpread));
    }
    isOpen = true;
    document.getElementById("field-book-modal")?.classList.remove("hidden");
    renderCurrentSpread();
    App.Audio.pageFlip();
  }

  function close(silent) {
    if (!isOpen) return;
    isOpen = false;
    document.getElementById("field-book-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  function toggle() {
    if (isOpen) close(false);
    else open();
  }

  function bindEvents() {
    const modal = document.getElementById("field-book-modal");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        close(false);
        return;
      }

      const jumpBtn = e.target.closest("[data-book-jump]");
      if (jumpBtn) {
        goToSpread(Number(jumpBtn.getAttribute("data-book-jump")));
        return;
      }

      const actBtn = e.target.closest("[data-book-action]");
      if (actBtn) {
        const act = actBtn.getAttribute("data-book-action");
        if (act === "close") close(false);
        else if (act === "prev") goToSpread(currentSpread - 1);
        else if (act === "next") goToSpread(currentSpread + 1);
        else if (act === "reset-notes") {
          App.Audio.click();
          resetNotes();
        }
        return;
      }

      const clueBtn = e.target.closest("[data-clue-id]");
      if (clueBtn) {
        const cid = clueBtn.getAttribute("data-clue-id");
        clueMarks[cid] = clueMarks[cid] === 1 ? 0 : 1;
        App.Audio.inkMark(false);
        renderSpread2();
        return;
      }

      const roomBtn = e.target.closest("[data-room-id]");
      if (roomBtn) {
        const rid = roomBtn.getAttribute("data-room-id");
        roomManualMarks[rid] = roomManualMarks[rid] === 1 ? 0 : 1;
        App.Audio.inkMark(false);
        renderSpread2();
      }
    });

    modal.addEventListener("contextmenu", (e) => {
      const clueBtn = e.target.closest("[data-clue-id]");
      if (clueBtn) {
        e.preventDefault();
        const cid = clueBtn.getAttribute("data-clue-id");
        clueMarks[cid] = clueMarks[cid] === -1 ? 0 : -1;
        App.Audio.inkMark(true);
        renderSpread2();
        return;
      }

      const roomBtn = e.target.closest("[data-room-id]");
      if (roomBtn) {
        e.preventDefault();
        const rid = roomBtn.getAttribute("data-room-id");
        roomManualMarks[rid] = roomManualMarks[rid] === -1 ? 0 : -1;
        App.Audio.inkMark(true);
        renderSpread2();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        goToSpread(currentSpread - 1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        goToSpread(currentSpread + 1);
      }
    });
  }

  function init() {
    bindEvents();
  }

  App.FieldBook = {
    CLUE_ITEMS,
    EXIT_ROOMS,
    EXIT_ROOM_MAP,
    init,
    open,
    close,
    toggle,
    resetNotes,
    getClueArtSVG,
    isOpen: () => isOpen
  };
})(window.Duskwood);
