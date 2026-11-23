/* ==========================================================================
   DUSKWOOD INN - Complete Cards Database (5 Categories)
   v0.50 Card Visual & Content Update:
   1. BLUEPRINT  (Room Cards)            — Vintage hatched floorplan + icon + name + direction ONLY (no details)
   2. OMEN       (Clue Cards)            — Authentic vintage clue art + evocative subtitle
   3. CHIME      (Progress Cards)        — Roleplay flavor +30/+60/+15 cards (keeps +30/+60 icon when unzoomed)
   4. WARD       (Lifesaver Cards)       — 2 anti-Harvester safety cards
   5. HEX        (Event Cards)           — 10 event cards (Harvester + 9 monster trials)
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const CARD_TYPES = {
    BLUEPRINT: {
      id: "BLUEPRINT",
      label: "ROOM",
      fullLabel: "BLUEPRINT CARD",
      color: "#6b9cd6",
      description: "Builds rooms and connecting hallways onto the cabin layout."
    },
    OMEN: {
      id: "OMEN",
      label: "CLUE",
      fullLabel: "OMEN CARD",
      color: "#5bd4be",
      description: "Placed on the Candle Tray to manifest and investigate clues inside rooms."
    },
    CHIME: {
      id: "CHIME",
      label: "PROGRESS",
      fullLabel: "CHIME CARD",
      color: "#e0be6b",
      description: "Advances the night clock and triggers special board or hand effects."
    },
    WARD: {
      id: "WARD",
      label: "LIFESAVER",
      fullLabel: "WARD CARD",
      color: "#6ee08a",
      description: "Pushes the Hollow Harvester back on the clock track to buy safety."
    },
    HEX: {
      id: "HEX",
      label: "EVENT",
      fullLabel: "HEX CARD",
      color: "#d95b6a",
      description: "Immediately interrupts the turn and triggers a lethal survival trial."
    }
  };

  // Sub-effects for Wheel of Fate (Random Board Effect)
  const RANDOM_BOARD_EFFECTS = [
    {
      id: "lose_30",
      name: "Lose 30 Minutes",
      detail: "Rewinds the shared Lantern pawn back by 30 minutes."
    },
    {
      id: "gain_30",
      name: "Gain 30 Minutes",
      detail: "Advances the shared Lantern pawn forward by 30 minutes."
    },
    {
      id: "tray_wipe",
      name: "Candle Tray Wipe",
      detail: "Clears every Omen Card currently resting on the Candle Tray."
    },
    {
      id: "harvester_back_30",
      name: "Harvester Back 30 Minutes",
      detail: "Pushes the Hollow Harvester back by 30 minutes (1 step) along the track."
    }
  ];

  // Verified Cabin Room Shapes (matching The Cabin Game top-down floorplans)
  const ROOM_SHAPES = {
    dead_end: { label: "DEAD-END", doorsCount: 1, baseDoors: ["N"] },
    l_shape:  { label: "L-SHAPED", doorsCount: 2, baseDoors: ["N", "E"] },
    i_shape:  { label: "I-SHAPED", doorsCount: 2, baseDoors: ["N", "S"] },
    t_shape:  { label: "T-SHAPED", doorsCount: 3, baseDoors: ["N", "E", "S"] },
    cross:    { label: "CROSS",    doorsCount: 4, baseDoors: ["N", "E", "S", "W"] }
  };

  const DIR_RING = ["N", "E", "S", "W"];
  let roomSvgSeq = 0;

  function getRotatedDoors(shapeOrList, rotationSteps) {
    const base = Array.isArray(shapeOrList)
      ? shapeOrList
      : (ROOM_SHAPES[shapeOrList]?.baseDoors || ["N"]);
    const rot = ((rotationSteps || 0) % 4 + 4) % 4;
    const doors = { N: false, E: false, S: false, W: false };
    base.forEach((d) => {
      const idx = DIR_RING.indexOf(d);
      if (idx >= 0) doors[DIR_RING[(idx + rot) % 4]] = true;
    });
    return doors;
  }

  // ==================== VINTAGE ROOM ICON & FLOORPLAN SVG (Matches image_41d75b & image_41d77c) ====================
  const HALLWAY_ROOM_IDS = new Set([
    "bp_l_hallway",
    "bp_hallway_1",
    "bp_hallway_2",
    "bp_t_hallway_1",
    "bp_t_hallway_2"
  ]);

  function getRoomCenterIconSVG(roomId) {
    // 1. The Furnace Room — Crossed Wrench & Screwdriver
    if (roomId === "bp_furnace") {
      return `
        <g stroke="#2a2119" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
          <g transform="rotate(42 50 50)">
            <rect x="46.5" y="27" width="7" height="16" rx="2.5" fill="#c9bfa9"/>
            <line x1="48.5" y1="29" x2="48.5" y2="41" stroke="#473b2f" stroke-width="1"/>
            <line x1="51.5" y1="29" x2="51.5" y2="41" stroke="#473b2f" stroke-width="1"/>
            <rect x="48.6" y="43" width="2.8" height="23" fill="#dfd7c3"/>
            <polygon points="47.5,66 52.5,66 51.5,73 48.5,73" fill="#b8ae99"/>
          </g>
          <g transform="rotate(-42 50 50)">
            <rect x="47.4" y="34" width="5.2" height="32" rx="1.2" fill="#d9d0bb"/>
            <path d="M43.5,33 C42.5,27 46,24 48,26 L48,30.5 L52,30.5 L52,26 C54,24 57.5,27 56.5,33 C55.8,36.2 53,37.2 50,37.2 C47,37.2 44.2,36.2 43.5,33 Z" fill="#cfc5ae"/>
            <circle cx="50" cy="67.5" r="4.5" fill="#cfc5ae"/>
            <circle cx="50" cy="67.5" r="1.9" fill="#f3ebd6"/>
          </g>
        </g>`;
    }

    // 2. The Bedroom — Top-down wooden bed with pillows & blanket
    if (roomId === "bp_bedroom") {
      return `
        <g stroke="#2a2119" stroke-width="1.6" stroke-linejoin="round">
          <g transform="rotate(-14 50 50)">
            <rect x="33" y="31" width="34" height="39" rx="1.5" fill="#cbbda2"/>
            <rect x="31" y="29" width="38" height="6" rx="1" fill="#8b7d68"/>
            <rect x="36" y="37" width="12.5" height="8" rx="2" fill="#f5efe0"/>
            <rect x="51.5" y="37" width="12.5" height="8" rx="2" fill="#f5efe0"/>
            <path d="M34,47 L66,47 L66,68 L34,68 Z" fill="#ded5c0"/>
            <path d="M34,47 L49,54 L66,47" fill="none" stroke="#473b2f" stroke-width="1.3"/>
            <line x1="36" y1="59" x2="64" y2="59" stroke="#5c4e3e" stroke-width="1.1"/>
            <line x1="36" y1="64" x2="64" y2="64" stroke="#5c4e3e" stroke-width="1.1"/>
          </g>
        </g>`;
    }

    // 3. The Kitchen — Top-down vintage refrigerator
    if (roomId === "bp_kitchen") {
      return `
        <g stroke="#2a2119" stroke-width="1.6" stroke-linejoin="round">
          <rect x="36" y="28" width="28" height="44" rx="3" fill="#cfc6b2"/>
          <line x1="36" y1="45" x2="64" y2="45" stroke="#2a2119" stroke-width="1.8"/>
          <rect x="39" y="31" width="22" height="11" rx="1" fill="#e5decb" stroke="#615445" stroke-width="1"/>
          <rect x="39" y="48" width="22" height="21" rx="1" fill="#ddd5c2" stroke="#615445" stroke-width="1"/>
          <rect x="57.5" y="35" width="2.5" height="6" rx="1" fill="#2a2119"/>
          <rect x="57.5" y="51" width="2.5" height="9" rx="1" fill="#2a2119"/>
        </g>`;
    }

    // 4. The Study — Top-down writing desk, chair & inkwell
    if (roomId === "bp_study") {
      return `
        <g stroke="#2a2119" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
          <rect x="33" y="32" width="34" height="20" rx="1.2" fill="#d3c8b2"/>
          <rect x="42" y="36" width="14" height="11" fill="#f5efe0" stroke="#473b2f" stroke-width="1.1"/>
          <line x1="49" y1="36" x2="49" y2="47" stroke="#473b2f" stroke-width="1"/>
          <circle cx="61" cy="40" r="2.3" fill="#2a2119"/>
          <path d="M61,39 L66,31" stroke="#2a2119" stroke-width="1.4"/>
          <rect x="40" y="55" width="20" height="13" rx="2" fill="#bfb39c"/>
          <rect x="38" y="65" width="24" height="4.5" rx="1.5" fill="#9a8d77"/>
        </g>`;
    }

    // 5. The Living Room — Top-down plush sofa
    if (roomId === "bp_living_room") {
      return `
        <g stroke="#2a2119" stroke-width="1.6" stroke-linejoin="round">
          <path d="M29,39 C29,34 33,31 38,31 L62,31 C67,31 71,34 71,39 L71,61 C71,65 67,68 63,68 L37,68 C33,68 29,65 29,61 Z" fill="#c9bfa9"/>
          <path d="M35,38 L65,38 L65,61 L35,61 Z" fill="#e5decb"/>
          <line x1="50" y1="39" x2="50" y2="61" stroke="#473b2f" stroke-width="1.3"/>
          <rect x="29" y="39" width="7" height="25" rx="3" fill="#b7ab94"/>
          <rect x="64" y="39" width="7" height="25" rx="3" fill="#b7ab94"/>
          <rect x="34" y="31" width="32" height="8" rx="3" fill="#b7ab94"/>
        </g>`;
    }

    // 6. The Cellar — Cluster of wooden wine barrels
    if (roomId === "bp_cellar") {
      return `
        <g stroke="#2a2119" stroke-width="1.4" stroke-linejoin="round">
          <ellipse cx="41" cy="36" rx="9" ry="5.5" fill="#d7ccb5"/>
          <ellipse cx="41" cy="46" rx="9.5" ry="6" fill="#cfc3aa"/>
          <ellipse cx="41" cy="57" rx="9.5" ry="6" fill="#d7ccb5"/>
          <line x1="33" y1="36" x2="49" y2="36" stroke="#594b3b" stroke-width="0.9"/>
          <line x1="32.5" y1="46" x2="49.5" y2="46" stroke="#594b3b" stroke-width="0.9"/>
          <line x1="32.5" y1="57" x2="49.5" y2="57" stroke="#594b3b" stroke-width="0.9"/>
          <ellipse cx="59" cy="41" rx="9" ry="5.5" fill="#cfc3aa"/>
          <ellipse cx="59" cy="52" rx="9.5" ry="6" fill="#d7ccb5"/>
          <ellipse cx="59" cy="63" rx="9" ry="5.5" fill="#c7bba2"/>
          <line x1="51" y1="41" x2="67" y2="41" stroke="#594b3b" stroke-width="0.9"/>
          <line x1="50.5" y1="52" x2="67.5" y2="52" stroke="#594b3b" stroke-width="0.9"/>
          <line x1="51" y1="63" x2="67" y2="63" stroke="#594b3b" stroke-width="0.9"/>
        </g>`;
    }

    // 7. The Bathroom — Top-down clawfoot bathtub
    if (roomId === "bp_bathroom") {
      return `
        <g stroke="#2a2119" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
          <path d="M35,32 C35,28 39,26 44,26 L56,26 C61,26 65,28 65,32 L65,64 C65,70 59,74 50,74 C41,74 35,70 35,64 Z" fill="#d5cbb6"/>
          <path d="M39,34 C39,31 42,30 45,30 L55,30 C58,30 61,31 61,34 L61,62 C61,66 57,69 50,69 C43,69 39,66 39,62 Z" fill="#f5efe0"/>
          <rect x="47" y="25" width="6" height="5" rx="1" fill="#7a6d5c"/>
          <line x1="50" y1="30" x2="50" y2="35" stroke="#2a2119" stroke-width="2"/>
          <circle cx="50" cy="62" r="2.2" fill="#473b2f"/>
        </g>`;
    }

    // 8. The Dining Room — Round table + 4 chairs
    if (roomId === "dining_room") {
      return `
        <g stroke="#2a2119" stroke-width="1.5" stroke-linejoin="round">
          <rect x="44" y="25" width="12" height="7" rx="1.5" fill="#c7bba2"/>
          <rect x="44" y="68" width="12" height="7" rx="1.5" fill="#c7bba2"/>
          <rect x="25" y="44" width="7" height="12" rx="1.5" fill="#c7bba2"/>
          <rect x="68" y="44" width="7" height="12" rx="1.5" fill="#c7bba2"/>
          <circle cx="50" cy="50" r="14.5" fill="#d8cdb6"/>
          <circle cx="50" cy="50" r="10.5" fill="none" stroke="#5a4c3b" stroke-width="1" stroke-dasharray="2.5,2"/>
          <circle cx="50" cy="50" r="2.5" fill="#473b2f"/>
        </g>`;
    }

    return "";
  }

  // Ornate black Victorian corner flourishes for Room cards (matches image_41d75b & image_41d77c)
  const ROOM_CORNER_FLOURISHES = `
    <g fill="#140f0b" stroke="#140f0b" stroke-width="0.6">
      <path d="M1,1 L15,1 C11,3 9,6 10,9 C11,11 8,12 6,10 C4,8 3,11 1,15 Z"/>
      <path d="M99,1 L85,1 C89,3 91,6 90,9 C89,11 92,12 94,10 C96,8 97,11 99,15 Z"/>
      <path d="M1,99 L15,99 C11,97 9,94 10,91 C11,89 8,88 6,90 C4,92 3,89 1,85 Z"/>
      <path d="M99,99 L85,99 C89,97 91,94 90,91 C89,89 92,88 94,90 C96,92 97,89 99,85 Z"/>
    </g>
  `;

  // Vintage Room Card SVG: diagonal hatched walls, open doorways/corridors, center icon, & name ribbon
  // Strictly NO details text — ONLY icon + name + direction!
  function buildRoomCardSVG(roomId, doors, opts) {
    const o = opts || {};
    const d = doors || { N: true, E: true, S: true, W: true };
    const isHallway = HALLWAY_ROOM_IDS.has(roomId);
    const showName = o.showName !== false && Boolean(o.name);
    const isTile = Boolean(o.tile);
    const isZoom = Boolean(o.zoom);
    const patId = `rm_hatch_${++roomSvgSeq}`;
    const strokeW = isTile ? 2.4 : 2.1;

    // Corridor / doorway opening spans [33..67] (34 units wide, perfectly symmetric across tiles!)
    const c0 = 33;
    const c1 = 67;
    const cw = 34;

    let openFloor = "";
    let wallEdges = "";

    if (isHallway) {
      openFloor += `<rect x="${c0}" y="${c0}" width="${cw}" height="${cw}" fill="#f4eee0"/>`;
      if (d.N) openFloor += `<rect x="${c0}" y="0" width="${cw}" height="${c0 + 2}" fill="#f4eee0"/>`;
      if (d.S) openFloor += `<rect x="${c0}" y="${c1 - 2}" width="${cw}" height="${100 - c1 + 2}" fill="#f4eee0"/>`;
      if (d.W) openFloor += `<rect x="0" y="${c0}" width="${c0 + 2}" height="${cw}" fill="#f4eee0"/>`;
      if (d.E) openFloor += `<rect x="${c1 - 2}" y="${c0}" width="${100 - c1 + 2}" height="${cw}" fill="#f4eee0"/>`;

      if (!d.N) wallEdges += `<line x1="${c0}" y1="${c0}" x2="${c1}" y2="${c0}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      else {
        wallEdges += `<line x1="${c0}" y1="0" x2="${c0}" y2="${c0}" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<line x1="${c1}" y1="0" x2="${c1}" y2="${c0}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (!d.S) wallEdges += `<line x1="${c0}" y1="${c1}" x2="${c1}" y2="${c1}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      else {
        wallEdges += `<line x1="${c0}" y1="${c1}" x2="${c0}" y2="100" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<line x1="${c1}" y1="${c1}" x2="${c1}" y2="100" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (!d.W) wallEdges += `<line x1="${c0}" y1="${c0}" x2="${c0}" y2="${c1}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      else {
        wallEdges += `<line x1="0" y1="${c0}" x2="${c0}" y2="${c0}" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<line x1="0" y1="${c1}" x2="${c0}" y2="${c1}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (!d.E) wallEdges += `<line x1="${c1}" y1="${c0}" x2="${c1}" y2="${c1}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      else {
        wallEdges += `<line x1="${c1}" y1="${c0}" x2="100" y2="${c0}" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<line x1="${c1}" y1="${c1}" x2="100" y2="${c1}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
    } else {
      const m = 10;
      openFloor += `<rect x="${m}" y="${m}" width="${100 - m * 2}" height="${100 - m * 2}" fill="#f4eee0"/>`;
      if (d.N) openFloor += `<rect x="${c0}" y="0" width="${cw}" height="${m + 2}" fill="#f4eee0"/>`;
      if (d.S) openFloor += `<rect x="${c0}" y="${100 - m - 2}" width="${cw}" height="${m + 2}" fill="#f4eee0"/>`;
      if (d.W) openFloor += `<rect x="0" y="${c0}" width="${m + 2}" height="${cw}" fill="#f4eee0"/>`;
      if (d.E) openFloor += `<rect x="${100 - m - 2}" y="${c0}" width="${m + 2}" height="${cw}" fill="#f4eee0"/>`;

      if (d.N) {
        wallEdges += `<polyline points="${c0},0 ${c0},${m} ${m},${m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<polyline points="${c1},0 ${c1},${m} ${100 - m},${m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
      } else {
        wallEdges += `<line x1="${m}" y1="${m}" x2="${100 - m}" y2="${m}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (d.S) {
        wallEdges += `<polyline points="${c0},100 ${c0},${100 - m} ${m},${100 - m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<polyline points="${c1},100 ${c1},${100 - m} ${100 - m},${100 - m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
      } else {
        wallEdges += `<line x1="${m}" y1="${100 - m}" x2="${100 - m}" y2="${100 - m}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (d.W) {
        wallEdges += `<polyline points="0,${c0} ${m},${c0} ${m},${m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<polyline points="0,${c1} ${m},${c1} ${m},${100 - m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
      } else {
        wallEdges += `<line x1="${m}" y1="${m}" x2="${m}" y2="${100 - m}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
      if (d.E) {
        wallEdges += `<polyline points="100,${c0} ${100 - m},${c0} ${100 - m},${m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
        wallEdges += `<polyline points="100,${c1} ${100 - m},${c1} ${100 - m},${100 - m}" fill="none" stroke="#16100b" stroke-width="${strokeW}"/>`;
      } else {
        wallEdges += `<line x1="${100 - m}" y1="${m}" x2="${100 - m}" y2="${100 - m}" stroke="#16100b" stroke-width="${strokeW}"/>`;
      }
    }

    let outerEdge = "";
    if (d.N) {
      outerEdge += `<line x1="1" y1="1" x2="${c0}" y2="1" stroke="#16100b" stroke-width="2.2"/>`;
      outerEdge += `<line x1="${c1}" y1="1" x2="99" y2="1" stroke="#16100b" stroke-width="2.2"/>`;
    } else {
      outerEdge += `<line x1="1" y1="1" x2="99" y2="1" stroke="#16100b" stroke-width="2.2"/>`;
    }
    if (d.S) {
      outerEdge += `<line x1="1" y1="99" x2="${c0}" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
      outerEdge += `<line x1="${c1}" y1="99" x2="99" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    } else {
      outerEdge += `<line x1="1" y1="99" x2="99" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    }
    if (d.W) {
      outerEdge += `<line x1="1" y1="1" x2="1" y2="${c0}" stroke="#16100b" stroke-width="2.2"/>`;
      outerEdge += `<line x1="1" y1="${c1}" x2="1" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    } else {
      outerEdge += `<line x1="1" y1="1" x2="1" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    }
    if (d.E) {
      outerEdge += `<line x1="99" y1="1" x2="99" y2="${c0}" stroke="#16100b" stroke-width="2.2"/>`;
      outerEdge += `<line x1="99" y1="${c1}" x2="99" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    } else {
      outerEdge += `<line x1="99" y1="1" x2="99" y2="99" stroke="#16100b" stroke-width="2.2"/>`;
    }

    // Subtle directional chevrons right inside each open doorway when inspecting/holding
    let dirChevrons = "";
    if (!isTile) {
      const chCol = "#4c3b2a";
      if (d.N) dirChevrons += `<polyline points="46,7 50,3 54,7" fill="none" stroke="${chCol}" stroke-width="1.5" stroke-linecap="round"/>`;
      if (d.S) dirChevrons += `<polyline points="46,93 50,97 54,93" fill="none" stroke="${chCol}" stroke-width="1.5" stroke-linecap="round"/>`;
      if (d.W) dirChevrons += `<polyline points="7,46 3,50 7,54" fill="none" stroke="${chCol}" stroke-width="1.5" stroke-linecap="round"/>`;
      if (d.E) dirChevrons += `<polyline points="93,46 97,50 93,54" fill="none" stroke="${chCol}" stroke-width="1.5" stroke-linecap="round"/>`;
    }

    // Vintage scroll ribbon banner with Room Name (matches image_41d75b & image_41d77c!)
    let ribbonMarkup = "";
    if (showName) {
      const label = String(o.name);
      const fontSize = isZoom ? (label.length > 14 ? 6.2 : 7.2) : isTile ? (label.length > 10 ? 7.0 : 8.2) : 6.8;
      const bw = Math.min(82, Math.max(46, label.length * (fontSize * 0.66) + 12));
      const bh = isZoom ? 13 : isTile ? 14 : 12.5;
      const bx = 50 - bw / 2;
      const by = isHallway ? (d.S && !d.N ? 15 : 74) : (isTile ? 75 : 76);

      ribbonMarkup = `
        <g class="rm-name-ribbon">
          <polygon points="${bx - 4},${by + 2} ${bx + 2},${by + 2} ${bx + 2},${by + bh - 1} ${bx - 4},${by + bh - 1} ${bx - 1},${by + bh * 0.55}" fill="#e6dcbe" stroke="#36281c" stroke-width="0.9"/>
          <polygon points="${bx + bw + 4},${by + 2} ${bx + bw - 2},${by + 2} ${bx + bw - 2},${by + bh - 1} ${bx + bw + 4},${by + bh - 1} ${bx + bw + 1},${by + bh * 0.55}" fill="#e6dcbe" stroke="#36281c" stroke-width="0.9"/>
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="1" fill="#f7f1e1" stroke="#36281c" stroke-width="1.1"/>
          <text x="50" y="${by + bh * 0.70}" text-anchor="middle" font-family="'Pixelify Sans', Georgia, serif" font-weight="700" font-size="${fontSize}" fill="#23180f" letter-spacing="0.2">${label}</text>
        </g>`;
    }

    const iconTransform = showName && !isHallway ? `transform="translate(0, -6) scale(0.94)" transform-origin="50 50"` : "";
    const centerIcon = !isHallway
      ? `<g ${iconTransform}>${getRoomCenterIconSVG(roomId)}</g>`
      : "";

    const bgTint = roomId === "bp_cellar" ? "#efe2d9" : roomId === "dining_room" ? "#f9f2df" : "#f3ebd7";
    const hatchCol = roomId === "bp_cellar" ? "#5a312c" : "#2e241b";

    return `
      <svg class="room-blueprint-svg${isTile ? " is-tile" : ""}${isZoom ? " is-zoom" : ""}" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <pattern id="${patId}" width="5.2" height="5.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5.2" height="5.2" fill="${bgTint}"/>
            <line x1="0" y1="0" x2="0" y2="5.2" stroke="${hatchCol}" stroke-width="1.35"/>
          </pattern>
        </defs>
        <rect x="0.5" y="0.5" width="99" height="99" fill="url(#${patId})"/>
        ${openFloor}
        ${wallEdges}
        ${outerEdge}
        ${ROOM_CORNER_FLOURISHES}
        ${dirChevrons}
        ${centerIcon}
        ${ribbonMarkup}
      </svg>
    `;
  }

  // Translucent top-down Room Direction preview SVG (used for green ghost placement slots!)
  function buildRoomDirectionSVG(doors, centerGlyph, opts) {
    const compact = Boolean(opts && opts.compact);
    const ghost = Boolean(opts && opts.ghost);
    const arrowCol = (opts && opts.arrowColor) || (ghost ? "#7be89b" : "#1f7a5a");
    const wallCol = ghost ? "rgba(246, 232, 198, 0.85)" : "#4c3624";
    const wallInner = ghost ? "rgba(246, 232, 198, 0.16)" : "#d9c7a0";
    const frameStroke = ghost ? "rgba(246, 232, 198, 0.65)" : "#24170e";

    const walls = [];
    if (doors.N) {
      walls.push(`<rect x="16" y="16" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="47" y="16" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="33" y="16" width="14" height="6" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="16" width="48" height="6" fill="${wallCol}"/>`);
    }
    if (doors.S) {
      walls.push(`<rect x="16" y="58" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="47" y="58" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="33" y="58" width="14" height="6" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="58" width="48" height="6" fill="${wallCol}"/>`);
    }
    if (doors.W) {
      walls.push(`<rect x="16" y="16" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="16" y="47" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="16" y="33" width="6" height="14" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="16" width="6" height="48" fill="${wallCol}"/>`);
    }
    if (doors.E) {
      walls.push(`<rect x="58" y="16" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="58" y="47" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="58" y="33" width="6" height="14" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="58" y="16" width="6" height="48" fill="${wallCol}"/>`);
    }

    const arrows = [];
    const sw = compact ? 3.2 : 2.8;
    if (doors.N) {
      arrows.push(
        `<line x1="40" y1="27" x2="40" y2="6" stroke="${arrowCol}" stroke-width="${sw}" stroke-dasharray="3,2"/>` +
        `<polyline points="34,11 40,4 46,11" fill="none" stroke="${arrowCol}" stroke-width="${sw}" stroke-linecap="square"/>`
      );
    }
    if (doors.S) {
      arrows.push(
        `<line x1="40" y1="53" x2="40" y2="74" stroke="${arrowCol}" stroke-width="${sw}" stroke-dasharray="3,2"/>` +
        `<polyline points="34,69 40,76 46,69" fill="none" stroke="${arrowCol}" stroke-width="${sw}" stroke-linecap="square"/>`
      );
    }
    if (doors.W) {
      arrows.push(
        `<line x1="27" y1="40" x2="6" y2="40" stroke="${arrowCol}" stroke-width="${sw}" stroke-dasharray="3,2"/>` +
        `<polyline points="11,34 4,40 11,46" fill="none" stroke="${arrowCol}" stroke-width="${sw}" stroke-linecap="square"/>`
      );
    }
    if (doors.E) {
      arrows.push(
        `<line x1="53" y1="40" x2="74" y2="40" stroke="${arrowCol}" stroke-width="${sw}" stroke-dasharray="3,2"/>` +
        `<polyline points="69,34 76,40 69,46" fill="none" stroke="${arrowCol}" stroke-width="${sw}" stroke-linecap="square"/>`
      );
    }

    const glyphMarkup = centerGlyph
      ? `<text x="40" y="43" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="${compact ? 11 : 10}" fill="${ghost ? '#fff8de' : '#1f140d'}">${centerGlyph}</text>`
      : "";

    return `
      <svg class="room-dir-svg${compact ? " compact" : ""}" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="18" y="18" width="44" height="44" fill="${wallInner}" stroke="${frameStroke}" stroke-width="1.2"/>
        ${walls.join("")}
        ${arrows.join("")}
        ${glyphMarkup}
      </svg>
    `;
  }

  const CARD_CATALOG = [
    // =========================================================================
    // 1. BLUEPRINT CARDS (12 Room Cards — Icon + Name + Direction ONLY, no details)
    // =========================================================================
    {
      id: "bp_cellar",
      type: "BLUEPRINT",
      glyph: "CE",
      name: "THE CELLAR",
      shortName: "THE CELLAR",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], mandatoryFirst: true, holdsDowned: true, roomStyle: "cellar" }
    },
    {
      id: "bp_furnace",
      type: "BLUEPRINT",
      glyph: "FR",
      name: "THE FURNACE ROOM",
      shortName: "FURNACE",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], roomStyle: "furnace" }
    },
    {
      id: "bp_bathroom",
      type: "BLUEPRINT",
      glyph: "BR",
      name: "THE BATHROOM",
      shortName: "BATHROOM",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], eventProps: true, roomStyle: "bathroom" }
    },
    {
      id: "bp_kitchen",
      type: "BLUEPRINT",
      glyph: "KT",
      name: "THE KITCHEN",
      shortName: "KITCHEN",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], eventProps: true, roomStyle: "kitchen" }
    },
    {
      id: "bp_bedroom",
      type: "BLUEPRINT",
      glyph: "BD",
      name: "THE BEDROOM",
      shortName: "BEDROOM",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], roomStyle: "bedroom" }
    },
    {
      id: "bp_l_hallway",
      type: "BLUEPRINT",
      glyph: "LH",
      name: "L-HALLWAY",
      shortName: "L-HALL",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], isHallway: true }
    },
    {
      id: "bp_study",
      type: "BLUEPRINT",
      glyph: "ST",
      name: "THE STUDY",
      shortName: "STUDY",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], roomStyle: "study" }
    },
    {
      id: "bp_hallway_1",
      type: "BLUEPRINT",
      glyph: "H1",
      name: "STRAIGHT HALLWAY I",
      shortName: "HALL I",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], isHallway: true }
    },
    {
      id: "bp_hallway_2",
      type: "BLUEPRINT",
      glyph: "H2",
      name: "STRAIGHT HALLWAY II",
      shortName: "HALL II",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], isHallway: true }
    },
    {
      id: "bp_living_room",
      type: "BLUEPRINT",
      glyph: "LR",
      name: "THE LIVING ROOM",
      shortName: "LIVING",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], hasClock: true, roomStyle: "living_room" }
    },
    {
      id: "bp_t_hallway_1",
      type: "BLUEPRINT",
      glyph: "T1",
      name: "T-HALLWAY I",
      shortName: "T-HALL I",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], isHallway: true }
    },
    {
      id: "bp_t_hallway_2",
      type: "BLUEPRINT",
      glyph: "T2",
      name: "T-HALLWAY II",
      shortName: "T-HALL II",
      shortEffect: "",
      effect: "",
      lore: "",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], isHallway: true }
    },

    // =========================================================================
    // 2. CLUE CARDS (Exact Cabin Game Visuals & Subtitles — 6 clue families)
    // =========================================================================
    {
      id: "om_grandfather_clock",
      type: "OMEN",
      glyph: "GC",
      name: "THE GRANDFATHER CLOCK",
      subtitle: "WHEN THE CLOCK STRIKES",
      shortEffect: "When the clock strikes",
      effect: "When placed on top of the Graveyard, The Grandfather Clock manifests in its room and strikes a resonant chime.",
      lore: "You hear the brass toll before you ever see the tall mahogany cabinet.",
      meta: { clueGroup: "grandfather_clock" }
    },
    {
      id: "om_past_traveler",
      type: "OMEN",
      glyph: "PP",
      name: "THE PAST PLAYER",
      subtitle: "EVIDENCE OF A PAST PLAYER",
      shortEffect: "Evidence of a past player",
      effect: "When placed on top of the Graveyard, Evidence of a Past Player appears in its room as wall writing ('Help us') or skeletal remains.",
      lore: "Someone stayed in this cabin before you — and left a final plea behind.",
      meta: { clueGroup: "past_player" }
    },
    {
      id: "om_corrupt_painting",
      type: "OMEN",
      glyph: "CP",
      name: "CORRUPT PAINTING",
      subtitle: "A PORTRAIT TURNED OMINOUS",
      shortEffect: "A portrait turned ominous",
      effect: "When placed on top of the Graveyard, a framed painting in its room twists into an uncanny portrait when inspected with [E].",
      lore: "The eyes stretch far too wide, staring directly back at your lantern.",
      meta: { clueGroup: "corrupt_painting" }
    },
    {
      id: "om_paranormal_alt",
      type: "OMEN",
      glyph: "PA",
      name: "PARANORMAL ALTERATION",
      subtitle: "SOMETHING IN THE ROOM HAS CHANGED",
      shortEffect: "The room has shifted",
      effect: "When placed on top of the Graveyard, a room's furniture, fixtures, or wallpaper shifts unnaturally — leaving chairs hovering upside-down.",
      lore: "Gravity seems to forget one corner of the cabin.",
      meta: { clueGroup: "paranormal_alteration" }
    },
    {
      id: "om_rooster_decor",
      type: "OMEN",
      glyph: "CD",
      name: "CHICKEN DECOR",
      subtitle: "A FAMILIAR ROOSTER ON THE WALL",
      shortEffect: "A rooster upon the wall",
      effect: "When placed on top of the Graveyard, a Chicken Decor appears in a room. Beware: a fake chicken loses its head once the 3rd clue is revealed.",
      lore: "A carved farmhouse rooster — check its head once three clues have surfaced.",
      meta: { clueGroup: "chicken_decor", canBeDecoy: true }
    },
    {
      id: "om_chalk_grid",
      type: "OMEN",
      glyph: "XO",
      name: "TIC-TAC-TOE",
      subtitle: "WINNING X OR O SYMBOL",
      shortEffect: "Winning X or O symbol",
      effect: "When placed on top of the Graveyard, X or O marks appear across 5 rooms. Whichever symbol appears 3 times is the winning clue.",
      lore: "An unfinished game etched across five rooms — count every X and O carefully.",
      meta: { clueGroup: "tic_tac_toe", outcomes: ["WINNING X", "WINNING O"] }
    },

    // =========================================================================
    // 3. CHIME CARDS (Progress Cards — Roleplay Flavor +30/+60/+15 & Special Cards)
    //    Unzoomed hand/rim keeps +30 / +60 / +15 icon; zoomed shows immersive flavor!
    // =========================================================================
    {
      id: "ch_plus_15",
      type: "CHIME",
      glyph: "+15",
      name: "BRIEF RESPITE",
      shortEffect: "Brief Respite",
      flavorBody: "CATCHES YOUR BREATH BESIDE THE HEARTH WHILE THE CABIN HOLDS ITS SILENCE.",
      effect: "Catches your breath beside the hearth while the cabin holds its silence. (Advances the player piece by 15 minutes.)",
      lore: "A quiet quarter-hour around the warm embers before the next turn.",
      meta: { deltaMinutes: 15, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    // --- +30 MINUTES ROLEPLAY PROGRESS CARDS (4 immersive variants, identical +30m player-only mechanic) ---
    {
      id: "ch_plus_30",
      type: "CHIME",
      glyph: "+30",
      name: "JUNK REMOVAL",
      shortEffect: "Junk Removal",
      flavorBody: "CLEARS A RANDOM CLOSET OF JUNK TO ALLOW THE PLAYER TO HIDE IN IT.",
      effect: "Clears a random closet of junk to allow the player to hide in it. (Advances the player piece by 30 minutes.)",
      lore: "Pushing aside dusty crates buys precious space — and half an hour closer to midnight.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_plus_30_matches",
      type: "CHIME",
      glyph: "+30",
      name: "SPARE MATCHES",
      shortEffect: "Spare Matches",
      flavorBody: "TUCKS A DRY BOX OF MATCHES BY THE MANTEL FOR WHEN THE CABIN LIGHTS FAIL.",
      effect: "Tucks a dry box of matches by the mantel for when the cabin lights fail. (Advances the player piece by 30 minutes.)",
      lore: "A single sulfur flare steadies shaking fingers in the dark.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_plus_30_hinges",
      type: "CHIME",
      glyph: "+30",
      name: "OILED HINGES",
      shortEffect: "Oiled Hinges",
      flavorBody: "SILENCES A CREAKING DOORFRAME SO YOUR STEPS CARRY LESS THROUGH THE HALLS.",
      effect: "Silences a creaking doorframe so your steps carry less through the halls. (Advances the player piece by 30 minutes.)",
      lore: "A drop of lamp oil keeps old iron quiet when footsteps pass nearby.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_plus_30_candle",
      type: "CHIME",
      glyph: "+30",
      name: "FRESH TALLOW",
      shortEffect: "Fresh Tallow",
      flavorBody: "TRIMS THE WICK OF A BURNING CANDLE TO STEADY THE SHADOWS ACROSS THE ROOM.",
      effect: "Trims the wick of a burning candle to steady the shadows across the room. (Advances the player piece by 30 minutes.)",
      lore: "A cleaner flame keeps the corners of the room from creeping inward.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    // --- +60 MINUTES ROLEPLAY PROGRESS CARDS (3 immersive variants, identical +60m player-only mechanic) ---
    {
      id: "ch_plus_60",
      type: "CHIME",
      glyph: "+60",
      name: "REINFORCED LATCH",
      shortEffect: "Reinforced Latch",
      flavorBody: "WEDGES AN IRON PIN INTO THE PORCH FRAME TO BUY A FULL HOUR OF STILLNESS.",
      effect: "Wedges an iron pin into the porch frame to buy a full hour of stillness. (Advances the player piece by 60 minutes.)",
      lore: "Heavy timber holds firm while the grandfather clock skips a whole hour.",
      meta: { deltaMinutes: 60, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_plus_60_corridor",
      type: "CHIME",
      glyph: "+60",
      name: "CLEARED CORRIDOR",
      shortEffect: "Cleared Corridor",
      flavorBody: "SHOVES TOPPLED CHAIRS BACK AGAINST THE WALL TO OPEN A CLEAN PATH TOWARD MIDNIGHT.",
      effect: "Shoves toppled chairs back against the wall to open a clean path toward midnight. (Advances the player piece by 60 minutes.)",
      lore: "An unobstructed hallway makes every sprint toward dawn feel shorter.",
      meta: { deltaMinutes: 60, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_plus_60_shutters",
      type: "CHIME",
      glyph: "+60",
      name: "BOLTED SHUTTERS",
      shortEffect: "Bolted Shutters",
      flavorBody: "LATCHES THE STORM SHUTTERS AGAINST THE PINE WIND AS THE CLOCK SKIPS A FULL HOUR.",
      effect: "Latches the storm shutters against the pine wind as the clock skips a full hour. (Advances the player piece by 60 minutes.)",
      lore: "With the gale shut outside, the cabin feels calm for an entire hour.",
      meta: { deltaMinutes: 60, freezeHarvester: true, skipPassiveStep: true, flavorProgress: true }
    },
    {
      id: "ch_rewind_30",
      type: "CHIME",
      glyph: "-30",
      name: "BORROWED TIME",
      shortEffect: "Clock -30m (Harvester stays)",
      effect: "Rewinds the player pawn back 30 minutes away from 12:00 AM Midnight while keeping the Hollow Harvester frozen this turn, buying extra turns to investigate.",
      lore: "A loose pendulum pin slips backward, stretching the dark night just a little longer.",
      meta: { deltaMinutes: -30, freezeHarvester: true, skipPassiveStep: true }
    },
    {
      id: "ch_shuffle",
      type: "CHIME",
      glyph: "SH",
      name: "SHUFFLE HAND",
      shortEffect: "Player +30m & redraw hand",
      effect: "Advances ONLY the player pawn by 30 minutes (the Hollow Harvester does not move this turn) and replaces your hand with freshly drawn cards.",
      lore: "The deck slips through your fingers and deals a brand new fate.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true, action: "shuffle_hand" }
    },
    {
      id: "ch_traitor",
      type: "CHIME",
      glyph: "TR",
      name: "THE TRAITOR",
      shortEffect: "Hold: Block 3rd Clue & escape | Play: +30m",
      effect: "Prevents the final clue from appearing, but guarantees your escape. This card will only activate if left in your hand by the end of the game; otherwise it plays as a normal +30 Minutes Progress card. (Defective if the final clue has already been revealed.)",
      lore: "Someone at the table blew out their match before the final secret could surface.",
      meta: { multiplayerOnly: true, passiveRole: "traitor", rare: true, deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true }
    },
    {
      id: "ch_sacrifice",
      type: "CHIME",
      glyph: "SC",
      name: "THE SACRIFICE",
      shortEffect: "Hold: Trade life to save 1 | Play: +30m",
      effect: "Sacrifice your life at the end of the game to spare the life of another. This card will only activate if left in your hand by the end of the game; otherwise it plays as a normal +30 Minutes Progress card. (Defective if someone is holding 'The Traitor' card.)",
      lore: "Stay behind at the round table so another traveler may step into the dawn.",
      meta: { multiplayerOnly: true, passiveRole: "sacrifice", rare: true, deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true }
    },
    {
      id: "ch_random_board",
      type: "CHIME",
      glyph: "??",
      name: "WHEEL OF FATE",
      shortEffect: "1 of 4 random table effects",
      effect: "Triggers one of four random board effects: Lose 30 Minutes, Gain 30 Minutes, Candle Tray Wipe, or Harvester Back 30 Minutes.",
      lore: "Spin the brass dial at the table's edge and live with where it stops.",
      meta: { action: "random_board", subEffects: RANDOM_BOARD_EFFECTS }
    },
    {
      id: "ch_random_turn",
      type: "CHIME",
      glyph: "RT",
      name: "SHIFTING SEAT",
      shortEffect: "MP: Next turn to random player",
      effect: "Multiplayer only. When played, the card pedestal spins to a randomly chosen seated survivor for the next turn.",
      lore: "The brass turntable groans and stops before an unexpected chair.",
      meta: { multiplayerOnly: true, action: "random_turn", deltaMinutes: 0 }
    },
    {
      id: "ch_the_thief",
      type: "CHIME",
      glyph: "TH",
      name: "THE THIEF",
      shortEffect: "Spin the Thief's Wheel",
      effect: "Spins a cursed wheel that alters one of four cabin systems: Clues, Rooms, Time, or the Graveyard.",
      lore: "A shadowed gambler spins the brass wheel — sometimes generous, sometimes cruel.",
      meta: { action: "the_thief", deltaMinutes: 0, specialProgress: true }
    },
    {
      id: "ch_the_neighbor",
      type: "CHIME",
      glyph: "NB",
      name: "THE NEIGHBOR",
      shortEffect: "Knocks on door • 3 offers",
      effect: "A heavy knock echoes at the cabin's entrance door. Walk over and press [E] to open the door for The Neighbor, listen to his words, and pick 1 of 3 flipped bargain cards.",
      lore: "Three heavy knocks echo from the porch. Only the one who played me gets to pick.",
      meta: { action: "the_neighbor", deltaMinutes: 0, specialProgress: true }
    },

    // =========================================================================
    // 4. WARD CARDS (Lifesaver Cards — push Hollow Harvester back)
    // =========================================================================
    {
      id: "wd_salt_circle",
      type: "WARD",
      glyph: "W1",
      name: "SALT WARD",
      shortEffect: "Harvester back 30 min",
      effect: "Pushes the Hollow Harvester back 30 minutes (1 step) on the clock track without advancing your own Lantern, buying extra turns to investigate.",
      lore: "A crisp line of coarse salt keeps cold footsteps away from the table.",
      meta: { harvesterBackSteps: 1 }
    },
    {
      id: "wd_silver_chime",
      type: "WARD",
      glyph: "W2",
      name: "SILVER REPELLENT",
      shortEffect: "Harvester back 60 min",
      effect: "Pushes the Hollow Harvester back 60 minutes (2 full steps) along the clock track, creating crucial breathing room in an emergency.",
      lore: "A clear silver ring drives the mist back into the pines.",
      meta: { harvesterBackSteps: 2 }
    },

    // =========================================================================
    // 5. HEX CARDS (Event Cards — Hollow Harvester + 9 Verified Monster Events)
    // =========================================================================
    {
      id: "hx_harvester",
      type: "HEX",
      glyph: "HH",
      name: "THE HOLLOW HARVESTER",
      shortEffect: "Turn 2: Rises after 3 turns",
      effect: "Guaranteed draw on Turn 2. Once placed down, the Hollow Harvester emerges at the starting mark (XII) after 3 turns and advances +30 min each turn to hunt your piece.",
      lore: "Three quiet turns pass before dark fingers pry open the groove at XII.",
      meta: { mandatorySecond: true, delayTurns: 3, isHarvesterCard: true, monsterId: "hollow_harvester", monsterName: "THE HOLLOW HARVESTER" }
    },
    {
      id: "hx_corners",
      type: "HEX",
      glyph: "CC",
      name: "CUTTING CORNERS",
      shortEffect: "Delayed: Spawns Corner NPC",
      effect: "Delayed Event: Spawns a motionless player-like figure facing straight into the corner wall of The Dining Room. Normal turns continue until the figure turns around.",
      lore: "He looks just like one of you — standing dead still with his forehead pressed to the wallpaper.",
      meta: { eventKey: "cutting_corners", delayedEvent: true, delayTurns: 3, monsterId: "corner_man", monsterName: "THE CORNER MAN", penaltyHours: 1 }
    },
    {
      id: "hx_attic",
      type: "HEX",
      glyph: "AT",
      name: "THE ATTIC",
      shortEffect: "5 totems & candles • Attic Stalker",
      effect: "Event: Climb into the dark attic one at a time, gather 5 glowing totems onto the ritual table, and light the ritual candles while evading the Attic Stalker.",
      lore: "Five straw idols keep the rafters from swallowing whoever climbs the ladder.",
      meta: { eventKey: "the_attic", totemCount: 5, monsterId: "attic_stalker", monsterName: "ATTIC STALKER", penaltyHours: 1 }
    },
    {
      id: "hx_tall_stalker",
      type: "HEX",
      glyph: "TM",
      name: "THE TALL MAN",
      shortEffect: "Turn off all lights • The Tall Man",
      effect: "Event: Switch off every room light across the cabin while evading The Tall Man. He has no eyes, yet detects every active light source and handheld lantern.",
      lore: "Its headless-looking pale silhouette brushes the beams wherever a bulb stays lit.",
      meta: { eventKey: "tall_man", monsterId: "tall_man", monsterName: "THE TALL MAN", penaltyHours: 1 }
    },
    {
      id: "hx_balloons",
      type: "HEX",
      glyph: "RB",
      name: "RED BALLOONS",
      shortEffect: "Pop red balloons, then gold",
      effect: "Event: Track and pop red balloons in the dark using their music-box hum, then pop the final golden balloon while evading the sound-hunting Balloon Stalker.",
      lore: "A faint music box plays just before each red rubber sphere bursts.",
      meta: { eventKey: "red_balloons", monsterId: "balloon_stalker", monsterName: "THE BALLOON STALKER", penaltyHours: 1 }
    },
    {
      id: "hx_knight",
      type: "HEX",
      glyph: "KN",
      name: "THE KNIGHT",
      shortEffect: "Guide Demon Statue • 1 room/10s",
      effect: "Event: Spawns a Demon Statue (Green), Armored Knight (Red), and Destination (Blue) shown as 3 glowing dots on the round table. Move 1 room per 10s turn, press [E] to rotate the Statue so it slides to Destination, and never share a room with The Knight!",
      lore: "Heavy iron greaves scrape across the oak planks every time your 10 seconds run out.",
      meta: { eventKey: "the_knight", statueCount: 1, monsterId: "the_knight", monsterName: "THE KNIGHT", penaltyHours: 1 }
    },
    {
      id: "hx_tiny_toys",
      type: "HEX",
      glyph: "FS",
      name: "FEELING SMALL?",
      shortEffect: "4 shapes in 18s • The Puppet",
      effect: "Event: A stringed Puppet spawns in The Dining Room as all lights flicker for 10s. The Toy Train starts in The Dining Room — follow its sound and insert 4 requested shapes (18s each) before The Puppet hunts you down.",
      lore: "Taut strings creak above the dining table while a wooden toy train whistles in the dark.",
      meta: { eventKey: "feeling_small", targetToys: 4, monsterId: "ceiling_crawler", monsterName: "THE PUPPET", penaltyHours: 1 }
    },
    {
      id: "hx_musical_rooms",
      type: "HEX",
      glyph: "MR",
      name: "MUSICAL ROOMS",
      shortEffect: "Throw 20 popcorns • Red Safe Room",
      effect: "Event: A Giant Monkey spawns beside you in the dark (10s). Then the table becomes a cardboard box — tap [F] to grab & hold/release [F] to throw 20 popcorns! Whenever the music stops (25s), a random room glows RED: all survivors must find & enter the Red Room to halt the Monkey and resume throwing with your progress saved!",
      lore: "When the music box stops, sprint for the crimson light before heavy knuckles reach you.",
      meta: { eventKey: "musical_rooms", monsterId: "giant_monkey", monsterName: "THE GIANT MONKEY", penaltyHours: 1 }
    },
    {
      id: "hx_cellar_breakers",
      type: "HEX",
      glyph: "CB",
      name: "THE BASEMENT",
      shortEffect: "Fix 5 fuse boxes • Chainsaw",
      effect: "Event: The Dining Room shakes and slides underground into a dark concrete basement maze. Repair all 5 sparking red fuse boxes [HOLD F] while ducking into recessed wall alcoves to evade the Chainsaw Monster!",
      lore: "Hydraulic gears groan beneath the oak floorboards as a chainsaw roars in the tunnels below.",
      meta: { eventKey: "the_basement", monsterId: "sparky", monsterName: "CHAINSAW STALKER", penaltyHours: 1 }
    },
    {
      id: "hx_stay_lit",
      type: "HEX",
      glyph: "SL",
      name: "STAY IN THE LIGHT",
      shortEffect: "2 lit rooms (10s) • 90s survive",
      effect: "Event: All cabin lights flicker for 5s, then only 2 random rooms stay lit and rotate every 10s for 90s. Stay inside lit rooms — a glowing four-legged Shadow Beast hunts the dark and vanishes on contact with light!",
      lore: "Four glowing eyes prowl every dark hallway the instant the breaker snaps.",
      meta: { eventKey: "stay_in_the_light", monsterId: "shadow_hunter", monsterName: "THE SHADOW HUNTER", penaltyHours: 1 }
    }
  ];

  const DEFAULT_DISCOVERED_IDS = [
    "bp_cellar",
    "bp_furnace",
    "bp_t_hallway_1",
    "hx_harvester",
    "om_grandfather_clock",
    "om_past_traveler",
    "ch_plus_30",
    "ch_plus_60",
    "ch_the_thief",
    "ch_the_neighbor",
    "wd_salt_circle",
    "hx_corners"
  ];

  function getById(id) {
    return CARD_CATALOG.find((c) => c.id === id) || null;
  }

  function getByType(type) {
    return CARD_CATALOG.filter((c) => c.type === type);
  }

  function shuffleArray(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const DRAW_WEIGHTS = {
    CHIME:     0.42,
    BLUEPRINT: 0.23,
    OMEN:      0.105,
    HEX:       0.155,
    WARD:      0.09
  };

  const DRAW_WEIGHTS_MP = {
    CHIME:     0.41,
    BLUEPRINT: 0.24,
    OMEN:      0.095,
    HEX:       0.155,
    WARD:      0.10
  };

  // Preserves exact +15 (0.22), +30 (0.27 across 4 roleplay cards), +60 (0.10 across 3 roleplay cards) balance!
  const CHIME_CARD_WEIGHTS = {
    ch_plus_15:          0.22,
    ch_plus_30:          0.075,
    ch_plus_30_matches:  0.065,
    ch_plus_30_hinges:   0.065,
    ch_plus_30_candle:   0.065,
    ch_rewind_30:        0.08,
    ch_plus_60:          0.036,
    ch_plus_60_corridor: 0.032,
    ch_plus_60_shutters: 0.032,
    ch_shuffle:          0.12,
    ch_random_board:     0.09,
    ch_random_turn:      0.08,
    ch_traitor:          0.020,
    ch_sacrifice:        0.020,
    ch_the_thief:        0.06,
    ch_the_neighbor:     0.06
  };

  function pickWeightedFromList(entries) {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    if (total <= 0) return entries[0]?.item || null;
    let roll = Math.random() * total;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i].weight;
      if (roll <= 0) return entries[i].item;
    }
    return entries[entries.length - 1].item;
  }

  const UNIQUE_ONCE_PER_MATCH_IDS = ["ch_the_thief", "ch_the_neighbor", "ch_traitor", "ch_sacrifice"];

  function pickProgressCard(isMultiplayer, excludeCardIds) {
    const excluded = excludeCardIds instanceof Set ? excludeCardIds : new Set(excludeCardIds || []);
    const pool = getByType("CHIME").filter((c) => {
      if (!isMultiplayer && c.meta && c.meta.multiplayerOnly) return false;
      if (excluded.has(c.id)) return false;
      return true;
    });
    const weighted = pool.map((c) => ({
      item: c,
      weight: CHIME_CARD_WEIGHTS[c.id] || 0.05
    }));
    return pickWeightedFromList(weighted) || getById("ch_plus_15");
  }

  function drawWeightedCard(opts) {
    const options = opts || {};
    const allowHex = options.allowHex !== false;
    const isMultiplayer = Boolean(options.isMultiplayer);
    const excludeRoomIds = new Set(options.excludeRoomIds || []);
    excludeRoomIds.add("bp_cellar");
    const excludeCardIds = options.excludeCardIds instanceof Set
      ? options.excludeCardIds
      : new Set(options.excludeCardIds || []);

    const ownedOmenCounts = {};
    (options.ownedOmenIds || []).forEach((id) => {
      ownedOmenCounts[id] = (ownedOmenCounts[id] || 0) + 1;
    });
    const strictNoDupOmen = Boolean(options.strictNoDupOmen);
    const forbidOmen = Boolean(options.forbidOmen);

    const totalRooms = typeof options.totalRooms === "number" ? options.totalRooms : 7;
    const eventCooldownTurns = options.eventCooldownTurns || 0;
    const drawnEventIds = options.drawnEventCardIds instanceof Set
      ? options.drawnEventCardIds
      : new Set(options.drawnEventCardIds || []);

    const EARLY_OK_EVENTS = new Set(["hx_corners", "hx_cellar_breakers", "hx_musical_rooms"]);
    const eligibleHexes = (!allowHex || eventCooldownTurns > 0)
      ? []
      : getByType("HEX").filter((c) => {
          if (c.id === "hx_harvester") return false;
          if (drawnEventIds.has(c.id)) return false;
          if (totalRooms < 3 && !EARLY_OK_EVENTS.has(c.id)) return false;
          return true;
        });

    const canDrawHex = eligibleHexes.length > 0;
    const availableRooms = getByType("BLUEPRINT").filter((c) => !excludeRoomIds.has(c.id));
    const allOmens = getByType("OMEN");
    const canDrawRoom = availableRooms.length > 0;
    const canDrawClue = !forbidOmen && (!strictNoDupOmen || allOmens.some((c) => !ownedOmenCounts[c.id]));

    const roomPityCap = 3;
    const cluePityCap = isMultiplayer ? 6 : 5;
    const eventPityCap = 5;

    const pity = options.pityState || null;
    let chosenType = null;

    if (pity) {
      const sr = pity.sinceRoom || 0;
      const sc = pity.sinceClue || 0;
      const se = pity.sinceEvent || 0;

      if (canDrawClue && sc >= cluePityCap) {
        chosenType = "OMEN";
      } else if (canDrawRoom && sr >= roomPityCap) {
        chosenType = "BLUEPRINT";
      } else if (canDrawHex && se >= eventPityCap) {
        chosenType = "HEX";
      }
    }

    if (!chosenType) {
      const baseW = isMultiplayer ? DRAW_WEIGHTS_MP : DRAW_WEIGHTS;
      let wChime = baseW.CHIME;
      let wRoom  = canDrawRoom ? baseW.BLUEPRINT : 0;
      let wOmen  = canDrawClue ? baseW.OMEN : 0;
      let wHex   = canDrawHex ? baseW.HEX : 0;
      let wWard  = baseW.WARD;

      if (wRoom === 0) {
        wChime = 0.56;
        wOmen  = canDrawClue ? (isMultiplayer ? 0.11 : 0.13) : 0;
        wHex   = canDrawHex ? 0.21 : 0;
        wWard  = 0.10;
      }

      const catEntries = [
        { item: "CHIME",     weight: wChime },
        { item: "BLUEPRINT", weight: wRoom },
        { item: "OMEN",      weight: wOmen },
        { item: "HEX",       weight: wHex },
        { item: "WARD",      weight: wWard }
      ].filter((e) => e.weight > 0);

      chosenType = pickWeightedFromList(catEntries);
    }

    if (pity) {
      pity.sinceRoom = chosenType === "BLUEPRINT" ? 0 : (pity.sinceRoom || 0) + 1;
      pity.sinceClue = chosenType === "OMEN" ? 0 : (pity.sinceClue || 0) + 1;
      if (chosenType === "HEX") {
        pity.sinceEvent = 0;
      } else if (allowHex && canDrawHex) {
        pity.sinceEvent = (pity.sinceEvent || 0) + 1;
      }
    }

    if (chosenType === "CHIME") {
      return pickProgressCard(isMultiplayer, excludeCardIds);
    }
    if (chosenType === "BLUEPRINT") {
      return availableRooms[Math.floor(Math.random() * availableRooms.length)];
    }
    if (chosenType === "OMEN") {
      const weightedOmens = allOmens.map((c) => {
        const cnt = ownedOmenCounts[c.id] || 0;
        let w = 1.0;
        if (cnt > 0) w = strictNoDupOmen ? 0 : (cnt === 1 ? 0.18 : 0.05);
        return { item: c, weight: w };
      }).filter((e) => e.weight > 0);
      return pickWeightedFromList(weightedOmens) || allOmens[Math.floor(Math.random() * allOmens.length)];
    }
    if (chosenType === "WARD") {
      const wards = getByType("WARD");
      return wards[Math.floor(Math.random() * wards.length)];
    }
    if (!eligibleHexes.length) return pickProgressCard(isMultiplayer, excludeCardIds);
    const weightedHex = eligibleHexes.map((c) => ({
      item: c,
      weight: (c.id === "hx_attic" || c.id === "hx_tall_stalker" || c.id === "hx_balloons" || c.id === "hx_tiny_toys" || c.id === "hx_musical_rooms" || c.id === "hx_cellar_breakers" || c.id === "hx_stay_lit" || c.id === "hx_knight")
        ? 2.6
        : c.id === "hx_corners"
          ? 1.5
          : 0.7
    }));
    return pickWeightedFromList(weightedHex) || eligibleHexes[0];
  }

  function buildStartingHand(count, excludeRoomIds, existingOmenIds, pityState, excludeCardIds, isMultiplayer) {
    const n = count || 3;
    const pickedRooms = new Set(excludeRoomIds || []);
    pickedRooms.add("bp_cellar");
    const pickedOmens = (existingOmenIds || []).slice();
    const pickedUnique = new Set(excludeCardIds || []);
    const localPity = pityState || { sinceRoom: 0, sinceClue: 0, sinceEvent: 0 };
    const result = [];
    let omensDealtHere = 0;

    for (let i = 0; i < n; i++) {
      const availRooms = getByType("BLUEPRINT").filter((c) => !pickedRooms.has(c.id));
      let card = null;
      if (i === n - 1 && n >= 3 && !result.some((c) => c.type === "BLUEPRINT") && availRooms.length > 0) {
        card = availRooms[Math.floor(Math.random() * availRooms.length)];
        localPity.sinceRoom = 0;
        localPity.sinceClue = (localPity.sinceClue || 0) + 1;
      } else {
        card = drawWeightedCard({
          allowHex: false,
          isMultiplayer: Boolean(isMultiplayer),
          excludeRoomIds: Array.from(pickedRooms),
          excludeCardIds: pickedUnique,
          ownedOmenIds: pickedOmens,
          strictNoDupOmen: true,
          forbidOmen: omensDealtHere >= 1,
          pityState: localPity
        });
      }
      if (card) {
        if (card.type === "BLUEPRINT") pickedRooms.add(card.id);
        if (card.type === "OMEN") {
          pickedOmens.push(card.id);
          omensDealtHere += 1;
        }
        if (UNIQUE_ONCE_PER_MATCH_IDS.includes(card.id)) pickedUnique.add(card.id);
        result.push(card);
      }
    }
    return result;
  }

  function buildSingleplayerDeck() {
    const cards = [];
    const usedUnique = new Set();
    for (let i = 0; i < 40; i++) {
      const c = drawWeightedCard({ allowHex: true, isMultiplayer: false, excludeCardIds: usedUnique });
      if (c && UNIQUE_ONCE_PER_MATCH_IDS.includes(c.id)) usedUnique.add(c.id);
      cards.push(c);
    }
    return cards;
  }

  App.CardsDB = {
    CARD_TYPES,
    DRAW_WEIGHTS,
    UNIQUE_ONCE_PER_MATCH_IDS,
    ROOM_SHAPES,
    RANDOM_BOARD_EFFECTS,
    CARD_CATALOG,
    DEFAULT_DISCOVERED_IDS,
    getById,
    getByType,
    getRotatedDoors,
    getRoomCenterIconSVG,
    buildRoomCardSVG,
    buildRoomDirectionSVG,
    drawWeightedCard,
    buildStartingHand,
    buildSingleplayerDeck
  };
})(window.Duskwood);
