/* ==========================================================================
   DUSKWOOD INN - Antique Cabin Portraits & Paintings Gallery (Public Domain)
   - Real historical oil portraits & eerie dark landscapes via Wikimedia Commons
     (Met Museum CC0 / Public Domain archives) matching The Cabin Game's aesthetic
   - Automatic offline oil-canvas SVG fallback if played without internet
   - Supports live CORRUPT PAINTING Clue transformation!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  function wm(file) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;
  }

  const PAINTINGS = {
    dining_founder: {
      id: "dining_founder",
      title: "PORTRAIT OF A GENTLEMAN",
      artist: "Pierre Troubetskoy (19th Century)",
      url: wm("Pierre_Troubetskoy_-_Portrait_of_a_Gentleman.jpg"),
      note: "A stern oil portrait of the inn's original draftsman overlooking the round table. His eyes seem fixed on the XII mark.",
      palette: ["#26211c", "#4d3d2f", "#c9b396"]
    },
    hall_rembrandt: {
      id: "hall_rembrandt",
      title: "PORTRAIT OF A MAN",
      artist: "Rembrandt van Rijn (1650s)",
      url: wm("Portrait_of_a_Man_MET_DP145947.jpg"),
      note: "A shadowy figure emerging from heavy umber darkness. The varnish has cracked into fine spiderwebs across his forehead.",
      palette: ["#1b1612", "#473527", "#bfa384"]
    },
    hall_lady_black: {
      id: "hall_lady_black",
      title: "LADY IN BLACK",
      artist: "William Merritt Chase (1888)",
      url: wm("Lady_in_Black_MET_DT262020.jpg"),
      note: "A solitary woman in mourning black turned half away. The brass nameplate beneath the frame has been scratched off.",
      palette: ["#18181c", "#35343d", "#d6c3aa"]
    },
    bedroom_lady: {
      id: "bedroom_lady",
      title: "LADY IN A DARK DRESS",
      artist: "Unknown Artist (c. 1845)",
      url: wm("Portrait_of_Lady_in_a_Dark_Dress_(gcf02594).jpg"),
      note: "A pale Victorian woman framed in tarnished gilt. Her gaze feels uncomfortably steady in the dim bedroom lamplight.",
      palette: ["#241b1e", "#4a363c", "#d9c4b0"]
    },
    study_gloves: {
      id: "study_gloves",
      title: "MAN HOLDING GLOVES",
      artist: "Rembrandt Circle (17th Century)",
      url: wm("Rembrandt_-_Portrait_of_a_Man_Holding_Gloves.JPG"),
      note: "A scholar gripping dark leather gloves. Someone has underlined the dates on the back of the frame in red ink.",
      palette: ["#1e1a16", "#42372c", "#c7b195"]
    },
    living_abbey: {
      id: "living_abbey",
      title: "THE ABBEY IN THE OAKWOOD",
      artist: "Caspar David Friedrich (1810)",
      url: wm("The_Abbey_in_the_Oakwood.jpg"),
      note: "Gnarled leafless oaks surrounding dark ruins in winter mist — eerily identical to the dead forest outside Duskwood Inn.",
      palette: ["#1c2024", "#4d5254", "#b8b4a0"]
    },
    thall_chasseur: {
      id: "thall_chasseur",
      title: "THE CHASSEUR IN THE FOREST",
      artist: "Caspar David Friedrich (1814)",
      url: wm("Caspar_David_Friedrich_-_The_Chasseur_in_the_Forest_-_WGA8247.jpg"),
      note: "A lone traveler facing an impenetrable wall of black pines while a raven perches on a dead stump in the snow.",
      palette: ["#151d1a", "#32423a", "#c9c4b2"]
    },
    hall2_goya: {
      id: "hall2_goya",
      title: "SELF-PORTRAIT WITH SPECTACLES",
      artist: "Francisco de Goya (c. 1798)",
      url: wm("Goya_Self_portrait_with_spectacles_(Musee_Goya_Castres).jpg"),
      note: "Sharp eyes peer over silver spectacles. The canvas smells faintly of soot and damp cellar air.",
      palette: ["#211c18", "#4f4034", "#d1bea3"]
    },
    kitchen_carriage: {
      id: "kitchen_carriage",
      title: "GENTLEMAN IN A CARRIAGE",
      artist: "American School (19th Century)",
      url: wm("Portrait_of_a_Gentleman_in_a_Carriage_MET_ap1973.323.1.jpg"),
      note: "A dusty carriage traveler hung beside the pantry shelves, darkened by years of stove smoke.",
      palette: ["#261f18", "#54412e", "#cfb898"]
    },
    corrupt_omen: {
      id: "corrupt_omen",
      title: "PORTRAIT",
      artist: "Oil on Canvas (Something feels deeply off...)",
      url: "",
      note: "At first glance it looks like an ordinary antique portrait — yet the facial proportions, waxy skin, and fixed unblinking gaze feel disturbingly almost-human.",
      palette: ["#1c1714", "#3d332c", "#c8bca8"],
      isCorrupt: true
    }
  };

  // Official Corrupt Painting Clue local artworks (image/cp.jpg & image/cp_1.jpg) with artist credits
  const CORRUPT_PAINTINGS = [
    {
      id: "corrupt_cp",
      title: "RELATIONSHIP (关系)",
      artist: "Relationship (关系), 2016 - Zhang Yunyao",
      url: "image/cp.jpg",
      note: "The portrait has warped into something deeply uncanny — a Corrupt Painting clue has manifested in this room.",
      palette: ["#1c1714", "#3d332c", "#c8bca8"],
      isCorrupt: true
    },
    {
      id: "corrupt_cp_1",
      title: "TRAGIC FORMS",
      artist: "Tragic Forms Album - Ken Currie",
      url: "image/cp_1.jpg",
      note: "A haunting, distorted visage stares back from inside the frame — a Corrupt Painting clue has manifested in this room.",
      palette: ["#181416", "#382c30", "#c4b6a8"],
      isCorrupt: true
    }
  ];

  function getCorruptVariant(variantIdx) {
    const idx = Math.abs(Number(variantIdx) || 0) % CORRUPT_PAINTINGS.length;
    return CORRUPT_PAINTINGS[idx];
  }

  // Dedicated UNCANNY VALLEY classical oil-portrait generator (4 museum-style variants):
  // Pure psychological Uncanny Valley — NO blood, NO ghosts, NO gore, NO monster fangs!
  // Uses eerie subtle anatomical wrongness: overly wide-set/large glassy eyes with visible
  // upper sclera (Sanpaku stare), waxy porcelain doll shading, rigid symmetrical mannequin
  // smile, elongated neck/philtrum, and deadpan direct eye contact locked onto the viewer.
  function buildUncannyPortraitDataUrl(originalPainting) {
    const pid = (originalPainting && originalPainting.id) || "dining_founder";
    let hash = 0;
    for (let i = 0; i < pid.length; i++) hash = (hash * 31 + pid.charCodeAt(i)) >>> 0;
    const variant = hash % 4;

    if (variant === 0) {
      // VARIANT 0: "The Porcelain Gentleman" — waxy overly smooth symmetrical Victorian face,
      // slightly too-large glossy human eyes set slightly too far apart, uncanny deadpan stillness
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 340">
          <defs>
            <radialGradient id="uv0bg" cx="50%" cy="38%" r="68%">
              <stop offset="0%" stop-color="#3d342b"/>
              <stop offset="62%" stop-color="#211c18"/>
              <stop offset="100%" stop-color="#0f0c0a"/>
            </radialGradient>
            <radialGradient id="uv0skin" cx="50%" cy="40%" r="52%">
              <stop offset="0%" stop-color="#e3d5c3"/>
              <stop offset="68%" stop-color="#bfa992"/>
              <stop offset="100%" stop-color="#7a6858"/>
            </radialGradient>
          </defs>
          <rect width="280" height="340" fill="url(#uv0bg)"/>
          <!-- Formal dark Victorian coat & crisp high collar -->
          <path d="M24,340 C38,248 82,226 140,226 C198,226 242,248 256,340 Z" fill="#181514"/>
          <path d="M116,226 L140,284 L164,226 Z" fill="#dcd4c4"/>
          <path d="M135,232 L140,282 L145,232 Z" fill="#231e1c"/>
          <!-- Subtly over-elongated stiff neck -->
          <rect x="123" y="184" width="34" height="48" fill="#a8937e"/>
          <ellipse cx="140" cy="224" rx="22" ry="7" fill="#786655" opacity="0.55"/>
          <!-- Smooth waxy mannequin-like oval head (unnaturally perfect bilateral symmetry) -->
          <path d="M84,116 C82,58 198,58 196,116 C194,162 174,202 140,206 C106,202 86,162 84,116 Z" fill="url(#uv0skin)"/>
          <!-- Neatly parted antique oil hair -->
          <path d="M82,114 C78,48 112,34 140,36 C168,34 202,48 198,114 C191,84 176,68 140,68 C104,68 89,84 82,114 Z" fill="#241c17"/>
          <!-- Wax-like forehead sheen & faint hollow temple shade -->
          <ellipse cx="140" cy="90" rx="34" ry="12" fill="#f2e6d5" opacity="0.28"/>
          <!-- Uncanny overly-wide arched brows & slightly oversized unblinking eyes (Sanpaku sclera) -->
          <path d="M94,106 Q110,98 124,106" fill="none" stroke="#362921" stroke-width="2.4"/>
          <path d="M156,106 Q170,98 186,106" fill="none" stroke="#362921" stroke-width="2.4"/>
          <!-- Visible upper & lower sclera around hyper-focused glassy pale-blue irises -->
          <ellipse cx="109" cy="123" rx="14.5" ry="9.5" fill="#ede9df" stroke="#45372e" stroke-width="1.6"/>
          <ellipse cx="171" cy="123" rx="14.5" ry="9.5" fill="#ede9df" stroke="#45372e" stroke-width="1.6"/>
          <circle cx="110" cy="124" r="5.6" fill="#6b7e8a" stroke="#2c373d" stroke-width="1"/>
          <circle cx="170" cy="124" r="5.6" fill="#6b7e8a" stroke="#2c373d" stroke-width="1"/>
          <circle cx="110" cy="124" r="2.6" fill="#0d1012"/>
          <circle cx="170" cy="124" r="2.6" fill="#0d1012"/>
          <circle cx="112" cy="122" r="1.4" fill="#ffffff"/>
          <circle cx="172" cy="122" r="1.4" fill="#ffffff"/>
          <!-- Subtly stretched long nose bridge & blank elongated philtrum -->
          <path d="M140,118 L136,154 L144,154" fill="none" stroke="#786353" stroke-width="1.8"/>
          <path d="M133,155 Q140,159 147,155" fill="none" stroke="#59473b" stroke-width="1.5"/>
          <!-- Unnaturally wide, thin, polite closed-lip smile that doesn't reach the eyes -->
          <path d="M111,176 Q140,185 169,176" fill="none" stroke="#63453d" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M111,176 Q140,179 169,176" fill="none" stroke="#a67c70" stroke-width="1.2"/>
          <path d="M108,173 Q111,177 114,179 M172,173 Q169,177 166,179" fill="none" stroke="#7d6758" stroke-width="1.2"/>
          <rect x="4" y="4" width="272" height="332" fill="none" stroke="rgba(215,196,162,0.16)" stroke-width="3"/>
        </svg>`.trim();
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    if (variant === 1) {
      // VARIANT 1: "The Waxen Lady" — classical 19th-century portrait with mannequin stillness,
      // slightly mismatched iris scale, overly smooth porcelain cheeks, and stiff fixed Mona-Lisa smile
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 340">
          <defs>
            <radialGradient id="uv1bg" cx="50%" cy="36%" r="68%">
              <stop offset="0%" stop-color="#35312e"/>
              <stop offset="65%" stop-color="#1b1817"/>
              <stop offset="100%" stop-color="#0d0b0b"/>
            </radialGradient>
            <radialGradient id="uv1skin" cx="48%" cy="42%" r="52%">
              <stop offset="0%" stop-color="#ece0d2"/>
              <stop offset="72%" stop-color="#c9b6a3"/>
              <stop offset="100%" stop-color="#877362"/>
            </radialGradient>
          </defs>
          <rect width="280" height="340" fill="url(#uv1bg)"/>
          <!-- High-collared mourning gown -->
          <path d="M30,340 C48,256 92,232 140,232 C188,232 232,256 250,340 Z" fill="#171518"/>
          <path d="M118,224 Q140,240 162,224 L158,248 Q140,260 122,248 Z" fill="#cfc7ba" opacity="0.72"/>
          <circle cx="140" cy="248" r="5" fill="#9c8250" stroke="#3b2d18" stroke-width="1.5"/>
          <!-- Long porcelain neck -->
          <rect x="125" y="182" width="30" height="48" fill="#baa592"/>
          <!-- Dark swept Victorian updo framing slightly too-narrow oval face -->
          <ellipse cx="140" cy="70" rx="56" ry="38" fill="#1f1918"/>
          <ellipse cx="140" cy="126" rx="50" ry="68" fill="url(#uv1skin)"/>
          <path d="M88,120 C90,74 114,62 140,68 C166,62 190,74 192,120 C184,90 168,78 140,78 C112,78 96,90 88,120 Z" fill="#1f1918"/>
          <!-- Soft artificial porcelain doll blush -->
          <ellipse cx="106" cy="148" rx="12" ry="7" fill="#c98f87" opacity="0.28"/>
          <ellipse cx="174" cy="148" rx="12" ry="7" fill="#c98f87" opacity="0.28"/>
          <!-- Thin high brows + subtly mismatched pupil sizes staring intensely forward -->
          <path d="M100,108 Q114,102 128,107" fill="none" stroke="#3b2d26" stroke-width="1.6"/>
          <path d="M152,107 Q166,102 180,108" fill="none" stroke="#3b2d26" stroke-width="1.6"/>
          <ellipse cx="114" cy="124" rx="13" ry="8.5" fill="#f0ece4" stroke="#4a3c35" stroke-width="1.5"/>
          <ellipse cx="166" cy="124" rx="13.5" ry="9.5" fill="#f0ece4" stroke="#4a3c35" stroke-width="1.5"/>
          <circle cx="115" cy="124" r="5.0" fill="#4c3e35"/>
          <circle cx="165" cy="124" r="6.2" fill="#4c3e35"/>
          <circle cx="115" cy="124" r="2.2" fill="#0c0a09"/>
          <circle cx="165" cy="124" r="3.1" fill="#0c0a09"/>
          <circle cx="117" cy="122" r="1.3" fill="#ffffff"/>
          <circle cx="167" cy="122" r="1.4" fill="#ffffff"/>
          <!-- Tiny delicate nose + eerily rigid slightly-too-wide serene smile -->
          <path d="M140,124 L138,148 L143,148" fill="none" stroke="#857061" stroke-width="1.4"/>
          <path d="M114,171 Q140,183 166,171 Q140,174 114,171 Z" fill="#9c6862" stroke="#5e3a36" stroke-width="1.2"/>
          <path d="M114,171 Q140,177 166,171" fill="none" stroke="#4f2f2c" stroke-width="1.1"/>
          <rect x="4" y="4" width="272" height="332" fill="none" stroke="rgba(215,196,162,0.16)" stroke-width="3"/>
        </svg>`.trim();
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    if (variant === 2) {
      // VARIANT 2: "The Side-Glancing Scholar" — head posed 3/4 to the left,
      // yet BOTH wide glossy eyes have rotated unnaturally far right to lock directly onto you!
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 340">
          <defs>
            <radialGradient id="uv2bg" cx="46%" cy="38%" r="68%">
              <stop offset="0%" stop-color="#383226"/>
              <stop offset="64%" stop-color="#1e1b16"/>
              <stop offset="100%" stop-color="#0c0a08"/>
            </radialGradient>
            <radialGradient id="uv2skin" cx="44%" cy="42%" r="54%">
              <stop offset="0%" stop-color="#dfd0b8"/>
              <stop offset="70%" stop-color="#b09c82"/>
              <stop offset="100%" stop-color="#695847"/>
            </radialGradient>
          </defs>
          <rect width="280" height="340" fill="url(#uv2bg)"/>
          <!-- Dark Rembrandt cloak -->
          <path d="M20,340 C40,244 82,222 140,222 C198,222 242,244 260,340 Z" fill="#181410"/>
          <path d="M110,222 Q132,246 154,222 L150,240 Q132,256 114,240 Z" fill="#cfc3ad"/>
          <rect x="122" y="186" width="32" height="42" fill="#9e8971"/>
          <!-- Head angled slightly left while eyes dart hard toward viewer -->
          <ellipse cx="136" cy="126" rx="52" ry="66" fill="url(#uv2skin)"/>
          <path d="M84,124 C80,58 112,42 140,44 C172,46 194,68 188,128 C184,96 170,76 136,74 C106,74 92,94 84,124 Z" fill="#2b211a"/>
          <!-- Subtle vertical eye-height offset (uncanny anatomical asymmetry) -->
          <path d="M94,108 Q106,103 118,108" fill="none" stroke="#3b2d22" stroke-width="2"/>
          <path d="M144,104 Q158,99 172,104" fill="none" stroke="#3b2d22" stroke-width="2"/>
          <!-- Wide white sclera with irises slid sharply sideways staring straight at viewer -->
          <ellipse cx="106" cy="123" rx="12.5" ry="8" fill="#ede8dc" stroke="#47382c" stroke-width="1.5"/>
          <ellipse cx="158" cy="119" rx="13.5" ry="8.8" fill="#ede8dc" stroke="#47382c" stroke-width="1.5"/>
          <circle cx="113" cy="123" r="4.8" fill="#4f5e52"/>
          <circle cx="165" cy="119" r="5.1" fill="#4f5e52"/>
          <circle cx="113.5" cy="123" r="2.3" fill="#0d0f0d"/>
          <circle cx="165.5" cy="119" r="2.4" fill="#0d0f0d"/>
          <circle cx="115" cy="121.5" r="1.2" fill="#ffffff"/>
          <circle cx="167" cy="117.5" r="1.2" fill="#ffffff"/>
          <!-- Subtle nose & tight flat expressionless lips -->
          <path d="M128,120 L121,150 L132,151" fill="none" stroke="#6e5a48" stroke-width="1.8"/>
          <path d="M112,174 Q130,176 152,172" fill="none" stroke="#5c4239" stroke-width="2.1"/>
          <rect x="4" y="4" width="272" height="332" fill="none" stroke="rgba(215,196,162,0.16)" stroke-width="3"/>
        </svg>`.trim();
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    // VARIANT 3: "The Smooth Twin" — eerie high-forehead classical portrait with subtly doubled eyelid creases,
    // overly bright unblinking eyes, and mannequin-smooth unwrinkled skin despite gray hair
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 340">
        <defs>
          <radialGradient id="uv3bg" cx="50%" cy="38%" r="68%">
            <stop offset="0%" stop-color="#35383a"/>
            <stop offset="65%" stop-color="#1c1e21"/>
            <stop offset="100%" stop-color="#0b0c0e"/>
          </radialGradient>
          <radialGradient id="uv3skin" cx="50%" cy="42%" r="54%">
            <stop offset="0%" stop-color="#e8dfd4"/>
            <stop offset="72%" stop-color="#c4b8aa"/>
            <stop offset="100%" stop-color="#7c7268"/>
          </radialGradient>
        </defs>
        <rect width="280" height="340" fill="url(#uv3bg)"/>
        <path d="M26,340 C42,248 84,226 140,226 C196,226 238,248 254,340 Z" fill="#17181c"/>
        <path d="M120,226 L140,276 L160,226 Z" fill="#e0dbd0"/>
        <rect x="124" y="188" width="32" height="42" fill="#b3a698"/>
        <!-- Unnaturally tall smooth forehead & pale silver-grey swept hair -->
        <ellipse cx="140" cy="124" rx="51" ry="70" fill="url(#uv3skin)"/>
        <path d="M88,112 C86,52 114,40 140,40 C166,40 194,52 192,112 C186,78 168,62 140,62 C112,62 94,78 88,112 Z" fill="#8f8d88"/>
        <!-- Uncanny low-placed eyes with overly wide open eyelids & faint smile -->
        <path d="M98,118 Q112,113 126,118" fill="none" stroke="#6b645c" stroke-width="1.6"/>
        <path d="M154,118 Q168,113 182,118" fill="none" stroke="#6b645c" stroke-width="1.6"/>
        <ellipse cx="112" cy="133" rx="14" ry="9" fill="#f2efe8" stroke="#4a433d" stroke-width="1.5"/>
        <ellipse cx="168" cy="133" rx="14" ry="9" fill="#f2efe8" stroke="#4a433d" stroke-width="1.5"/>
        <path d="M98,128 Q112,121 126,128 M154,128 Q168,121 182,128" fill="none" stroke="#786d63" stroke-width="1.1"/>
        <circle cx="112" cy="133" r="5.2" fill="#59636b"/>
        <circle cx="168" cy="133" r="5.2" fill="#59636b"/>
        <circle cx="112" cy="133" r="2.2" fill="#0b0c0d"/>
        <circle cx="168" cy="133" r="2.2" fill="#0b0c0d"/>
        <circle cx="113.5" cy="131.5" r="1.4" fill="#ffffff"/>
        <circle cx="169.5" cy="131.5" r="1.4" fill="#ffffff"/>
        <path d="M140,130 L137,156 L144,156" fill="none" stroke="#7d7268" stroke-width="1.6"/>
        <path d="M116,177 Q140,186 164,177" fill="none" stroke="#6e544d" stroke-width="2"/>
        <rect x="4" y="4" width="272" height="332" fill="none" stroke="rgba(215,196,162,0.16)" stroke-width="3"/>
      </svg>`.trim();
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // Offline procedural SVG oil-portrait fallback so inspection NEVER shows a broken image!
  function buildFallbackDataUrl(painting, isCorrupt) {
    if (isCorrupt) return buildUncannyPortraitDataUrl(painting);
    const pal = painting.palette || ["#1c1714", "#47372a", "#cab598"];
    const eyeCol = isCorrupt ? "#ff3b3b" : "#181412";
    const bg2 = isCorrupt ? "#3d090e" : pal[1];
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300">
        <defs>
          <radialGradient id="g" cx="50%" cy="38%" r="65%">
            <stop offset="0%" stop-color="${bg2}"/>
            <stop offset="100%" stop-color="${pal[0]}"/>
          </radialGradient>
        </defs>
        <rect width="240" height="300" fill="url(#g)"/>
        <ellipse cx="120" cy="250" rx="76" ry="70" fill="#141114"/>
        <path d="M98,178 L120,218 L142,178 Z" fill="#dfd5c3" opacity="${isCorrupt ? 0.35 : 0.85}"/>
        <ellipse cx="120" cy="126" rx="38" ry="48" fill="${isCorrupt ? '#8f7268' : pal[2]}"/>
        <ellipse cx="120" cy="96" rx="40" ry="26" fill="#181312"/>
        <circle cx="105" cy="126" r="${isCorrupt ? 6 : 4}" fill="${eyeCol}"/>
        <circle cx="135" cy="126" r="${isCorrupt ? 6 : 4}" fill="${eyeCol}"/>
        ${
          isCorrupt
            ? `<ellipse cx="120" cy="154" rx="16" ry="18" fill="#1a0406"/>
               <line x1="70" y1="60" x2="175" y2="230" stroke="#7a0e14" stroke-width="5" opacity="0.7"/>`
            : `<path d="M107,150 Q120,156 133,150" stroke="#4f392c" stroke-width="3" fill="none"/>`
        }
        <rect x="6" y="6" width="228" height="288" fill="none" stroke="rgba(255,235,190,0.16)" stroke-width="3"/>
      </svg>
    `.trim();
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function getById(id) {
    return PAINTINGS[id] || PAINTINGS.hall_rembrandt;
  }

  App.PaintingsDB = {
    PAINTINGS,
    CORRUPT_PAINTINGS,
    getById,
    getCorruptVariant,
    buildFallbackDataUrl,
    buildUncannyPortraitDataUrl
  };
})(window.Duskwood);
