/* ==========================================================================
   DUSKWOOD INN - Game Config, Character Palettes & Persistence
   Character Art Standard: Terraria Side-Profile 16x24 Pixel Sprite
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const STORAGE_KEY_CHAR = "duskwood_survivor_v2";
  const STORAGE_KEY_OPTS = "duskwood_options_v3";

  const PALETTES = {
    skin: [
      { name: "Classic Peach", base: "#eb885e" },
      { name: "Fair Ivory",    base: "#f5be9f" },
      { name: "Warm Sand",     base: "#df9f74" },
      { name: "Olive Tan",     base: "#c98556" },
      { name: "Chestnut",      base: "#9e623d" },
      { name: "Deep Umber",    base: "#6b3e26" }
    ],
    hair: [
      { name: "Guide Chestnut", base: "#a85c16" },
      { name: "Midnight Black", base: "#2f303b" },
      { name: "Ash Brown",      base: "#6e472d" },
      { name: "Golden Blonde",  base: "#d8a43b" },
      { name: "Rust Copper",    base: "#b84426" },
      { name: "Silver Frost",   base: "#b8c2cf" },
      { name: "Pine Moss",      base: "#3c754d" },
      { name: "Cobalt Dusk",    base: "#3a5f9e" },
      { name: "Plum Violet",    base: "#7a448c" },
      { name: "Crimson Wine",   base: "#9e2b3e" }
    ],
    eye: [
      { name: "Dark Brown",   base: "#523e33" },
      { name: "Slate Blue",   base: "#37679e" },
      { name: "Forest Green", base: "#357849" },
      { name: "Amber Gold",   base: "#b87a24" },
      { name: "Charcoal",     base: "#24262e" },
      { name: "Violet",       base: "#6d4294" }
    ],
    shirt: [
      { name: "Olive Khaki",    base: "#96997a" },
      { name: "Forest Wool",    base: "#486b52" },
      { name: "Burgundy Coat",  base: "#8a3642" },
      { name: "Slate Navy",     base: "#435975" },
      { name: "Charcoal Linen", base: "#4d525c" },
      { name: "Ochre Flannel",  base: "#b8823c" },
      { name: "Cream Tunic",    base: "#cfc7b2" },
      { name: "Plum Cloak",     base: "#64446e" },
      { name: "Rust Leather",   base: "#8f4e32" },
      { name: "Teal Waxcloth",  base: "#386f73" }
    ],
    undershirt: [
      { name: "Sage Gray",    base: "#7a7d68" },
      { name: "Warm Cream",   base: "#d8d1be" },
      { name: "Dark Slate",   base: "#3b404a" },
      { name: "Deep Crimson", base: "#6e2934" },
      { name: "Muted Gold",   base: "#a68544" },
      { name: "Steel Blue",   base: "#546b87" }
    ],
    pants: [
      { name: "Classic Denim", base: "#5b7496" },
      { name: "Charcoal",      base: "#3b3f47" },
      { name: "Earth Brown",   base: "#634836" },
      { name: "Moss Cargo",    base: "#485942" },
      { name: "Dark Indigo",   base: "#2f3d5c" },
      { name: "Khaki Chino",   base: "#9e8e6e" },
      { name: "Wine Wool",     base: "#5e2f3a" },
      { name: "Ash Grey",      base: "#6b707a" }
    ],
    shoes: [
      { name: "Iron Boots",   base: "#363734" },
      { name: "Worn Leather", base: "#5c3b28" },
      { name: "Pitch Black",  base: "#23252a" },
      { name: "Timber Tan",   base: "#825c3a" },
      { name: "Steel Grey",   base: "#5e6570" }
    ]
  };

  const HAIR_STYLES = [
    "SHAGGY CLASSIC",
    "SPIKY REBEL",
    "SWEPT BANGS",
    "LONG FLOW",
    "SHORT CROP",
    "PONYTAIL",
    "CURLY MOP",
    "SIDE PART"
  ];

  const OUTFIT_STYLES = [
    "CLASSIC SHIRT",
    "OPEN VEST",
    "WINTER COAT",
    "TRAVELER HOODIE",
    "STRIPED SWEATER",
    "OVERALLS"
  ];

  const ACCESSORIES = [
    "NONE",
    "GLASSES",
    "SCARF",
    "BEANIE",
    "EXPLORER HAT",
    "BANDANA"
  ];

  const DEFAULT_CHARACTER = {
    name: "SURVIVOR",
    skin: 0,
    hairStyle: 0,
    hairColor: 0,
    eyeColor: 0,
    outfit: 0,
    shirtColor: 0,
    underColor: 0,
    pantsColor: 0,
    shoeColor: 0,
    accessory: 0,
    lantern: true,
    facing: 1,
    walking: false
  };

  const DEFAULT_OPTIONS = {
    bgmVolume: 0.55,
    sfxVolume: 0.65,
    particles: true,
    scanlines: false
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return Object.assign({}, fallback);
      return Object.assign({}, fallback, JSON.parse(raw));
    } catch (_) {
      return Object.assign({}, fallback);
    }
  }

  function saveCharacter(charState) {
    try {
      localStorage.setItem(STORAGE_KEY_CHAR, JSON.stringify(charState));
    } catch (_) {}
  }

  function saveOptions(optState) {
    try {
      localStorage.setItem(STORAGE_KEY_OPTS, JSON.stringify(optState));
    } catch (_) {}
  }

  App.Config = {
    PALETTES,
    HAIR_STYLES,
    OUTFIT_STYLES,
    ACCESSORIES,
    DEFAULT_CHARACTER,
    DEFAULT_OPTIONS,
    state: {
      character: loadJSON(STORAGE_KEY_CHAR, DEFAULT_CHARACTER),
      options: loadJSON(STORAGE_KEY_OPTS, DEFAULT_OPTIONS),
      difficulty: "NORMAL",
      roomCode: "DUSK"
    },
    saveCharacter,
    saveOptions
  };
})(window.Duskwood);
