/* ==========================================================================
   DUSKWOOD INN - Complete Cards Database (5 Categories, 37 Cards)
   100% faithful mechanics mapped to copyright-safe Duskwood Inn lore:
   1. BLUEPRINT  (Room Cards)            — 12 rooms & hallways
   2. OMEN       (Investigation / Clues) — 6 clue families (Chalk Grid has X/O)
   3. CHIME      (Progress Cards)        — 7 clock & special table cards
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

  // Builds a crisp top-down Room Direction diagram SVG (walls + door openings + directional arrows)
  function buildRoomDirectionSVG(doors, centerGlyph, opts) {
    const compact = Boolean(opts && opts.compact);
    const ghost = Boolean(opts && opts.ghost);
    const arrowCol = (opts && opts.arrowColor) || (ghost ? "#7be89b" : "#1f7a5a");
    const wallCol = ghost ? "rgba(246, 232, 198, 0.85)" : "#4c3624";
    const wallInner = ghost ? "rgba(246, 232, 198, 0.16)" : "#d9c7a0";
    const frameStroke = ghost ? "rgba(246, 232, 198, 0.65)" : "#24170e";

    // Room square sits inside [16..64] x [16..64] of an 80x80 viewBox so arrows extend cleanly outward
    // Wall thickness = 6; doorway gap spans [33..47] (14 units centered at 40)
    const walls = [];
    // Top wall (y = 16..22)
    if (doors.N) {
      walls.push(`<rect x="16" y="16" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="47" y="16" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="33" y="16" width="14" height="6" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="16" width="48" height="6" fill="${wallCol}"/>`);
    }
    // Bottom wall (y = 58..64)
    if (doors.S) {
      walls.push(`<rect x="16" y="58" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="47" y="58" width="17" height="6" fill="${wallCol}"/>`);
      walls.push(`<rect x="33" y="58" width="14" height="6" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="58" width="48" height="6" fill="${wallCol}"/>`);
    }
    // Left wall (x = 16..22)
    if (doors.W) {
      walls.push(`<rect x="16" y="16" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="16" y="47" width="6" height="17" fill="${wallCol}"/>`);
      walls.push(`<rect x="16" y="33" width="6" height="14" fill="rgba(31,122,90,0.22)"/>`);
    } else {
      walls.push(`<rect x="16" y="16" width="6" height="48" fill="${wallCol}"/>`);
    }
    // Right wall (x = 58..64)
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
    // 1. BLUEPRINT CARDS (12 Verified Room Cards — synced to The Cabin Game)
    //    THE DINING ROOM (Cross-shaped, 4 doors) starts pre-placed at (0,0).
    // =========================================================================
    // --- DEAD-END (1 Door — 3 Cards) ---
    {
      id: "bp_cellar",
      type: "BLUEPRINT",
      glyph: "CE",
      name: "THE CELLAR",
      shortName: "CELLAR",
      shortEffect: "1-way • Respawn Room (Turn 1)",
      effect: "One-way dead-end room (enter ONLY by dying in an Event, then exit back out). Counts as a room ONLY for Cutting Corners — excluded from all other Events.",
      lore: "Cold stone steps descend into damp earth where fallen guests await the dawn.",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], mandatoryFirst: true, holdsDowned: true, roomStyle: "cellar" }
    },
    {
      id: "bp_furnace",
      type: "BLUEPRINT",
      glyph: "FR",
      name: "THE FURNACE ROOM",
      shortName: "FURNACE",
      shortEffect: "1 door • Dead-end",
      effect: "Dead-end boiler room (1 door) with iron pipes and coal grates. Can be rotated 90°, 180°, or 270° to match any open doorway.",
      lore: "The cast-iron grate breathes warm soot even though the coals are black.",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], roomStyle: "furnace" }
    },
    {
      id: "bp_bathroom",
      type: "BLUEPRINT",
      glyph: "BR",
      name: "THE BATHROOM",
      shortName: "BATHROOM",
      shortEffect: "1 door • Dead-end",
      effect: "Dead-end bathroom (1 door) with basin, mirror, and clawfoot tub. Certain Hex Events require fixtures inside this room.",
      lore: "The faucet drips in steady beats, never quite matching the dining room clock.",
      meta: { exits: 1, shape: "dead_end", baseDoors: ["N"], eventProps: true, roomStyle: "bathroom" }
    },

    // --- L-SHAPED (2 Perpendicular Doors — 3 Cards) ---
    {
      id: "bp_kitchen",
      type: "BLUEPRINT",
      glyph: "KT",
      name: "THE KITCHEN",
      shortName: "KITCHEN",
      shortEffect: "2 doors • L-shaped",
      effect: "L-shaped cabin kitchen (2 perpendicular doors) stocked with interactive counters and utensils used during Hex Events.",
      lore: "Iron skillets sway gently above a cold stove as though stirred by drafts.",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], eventProps: true, roomStyle: "kitchen" }
    },
    {
      id: "bp_bedroom",
      type: "BLUEPRINT",
      glyph: "BD",
      name: "THE BEDROOM",
      shortName: "BEDROOM",
      shortEffect: "2 doors • L-shaped",
      effect: "L-shaped timber bedroom (2 perpendicular doors) with a canopy bed, dresser, and wall portrait for clue checks.",
      lore: "Fresh sheets remain neatly folded for travelers who never checked out.",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], roomStyle: "bedroom" }
    },
    {
      id: "bp_l_hallway",
      type: "BLUEPRINT",
      glyph: "LH",
      name: "L-HALL",
      shortName: "L-HALL",
      shortEffect: "2 doors • L-shaped turn",
      effect: "L-shaped wooden corner hallway (2 perpendicular doors) that turns the cabin layout around a 90° bend.",
      lore: "Around the blind corner, the floorboards creak a step behind your boots.",
      meta: { exits: 2, shape: "l_shape", baseDoors: ["N", "E"], isHallway: true }
    },

    // --- I-SHAPED (2 Opposite Doors — 3 Cards) ---
    {
      id: "bp_study",
      type: "BLUEPRINT",
      glyph: "ST",
      name: "THE STUDY",
      shortName: "STUDY",
      shortEffect: "2 doors • I-shaped",
      effect: "I-shaped private study (2 opposite doors) lined with oak desks, ledgers, and oil lamps linking two wings straight through.",
      lore: "Open journals sit beside dry inkwells, every margin covered in tallies.",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], roomStyle: "study" }
    },
    {
      id: "bp_hallway_1",
      type: "BLUEPRINT",
      glyph: "H1",
      name: "HALL I",
      shortName: "HALL I",
      shortEffect: "2 doors • I-shaped",
      effect: "I-shaped straight wooden hallway (2 opposite doors) extending escape corridors cleanly across the cabin.",
      lore: "Every loose plank groans loudest when you try to run quietly.",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], isHallway: true }
    },
    {
      id: "bp_hallway_2",
      type: "BLUEPRINT",
      glyph: "H2",
      name: "HALL II",
      shortName: "HALL II",
      shortEffect: "2 doors • I-shaped",
      effect: "Second I-shaped straight wooden hallway (2 opposite doors) connecting distant wings back toward The Dining Room.",
      lore: "Lantern light barely reaches the far frame at the end of the passage.",
      meta: { exits: 2, shape: "i_shape", baseDoors: ["N", "S"], isHallway: true }
    },

    // --- T-SHAPED (3 Doors — 3 Cards) ---
    {
      id: "bp_living_room",
      type: "BLUEPRINT",
      glyph: "LR",
      name: "THE LIVING ROOM",
      shortName: "LIVING",
      shortEffect: "3 doors • T-shaped",
      effect: "T-shaped living room (3 doors) furnished with a worn sofa, cabin decor, and an antique standing clock.",
      lore: "The velvet cushions still hold the imprint of someone who stood up in a hurry.",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], hasClock: true, roomStyle: "living_room" }
    },
    {
      id: "bp_t_hallway_1",
      type: "BLUEPRINT",
      glyph: "T1",
      name: "T-HALL I",
      shortName: "T-HALL I",
      shortEffect: "3 doors • T-shaped",
      effect: "T-shaped three-way hallway (3 doors) branching the cabin into multiple routes to avoid lethal dead ends.",
      lore: "Three shadowy doors wait at the fork; only one leads back to the table.",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], isHallway: true }
    },
    {
      id: "bp_t_hallway_2",
      type: "BLUEPRINT",
      glyph: "T2",
      name: "T-HALL II",
      shortName: "T-HALL II",
      shortEffect: "3 doors • T-shaped",
      effect: "Second T-shaped three-way hallway (3 doors) opening additional loops for evading threats during Hex Events.",
      lore: "Drafts swirl from three directions at once beneath the hanging beams.",
      meta: { exits: 3, shape: "t_shape", baseDoors: ["N", "E", "S"], isHallway: true }
    },

    // =========================================================================
    // 2. CLUE CARDS (Exact Cabin Game Names — 6 clue families)
    // =========================================================================
    {
      id: "om_grandfather_clock",
      type: "OMEN",
      glyph: "GC",
      name: "THE GRANDFATHER CLOCK",
      shortEffect: "Clock & chime reveal",
      effect: "While on top of the Graveyard, The Grandfather Clock manifests in its assigned room and strikes a deep resonant chime.",
      lore: "You hear the brass toll before you ever see the tall mahogany cabinet.",
      meta: { clueGroup: "grandfather_clock" }
    },
    {
      id: "om_past_traveler",
      type: "OMEN",
      glyph: "PP",
      name: "THE PAST PLAYER",
      shortEffect: "Wall text or remains",
      effect: "While on top of the Graveyard, Evidence of a Past Player appears in its assigned room as wall writing ('Help us') or skeletal remains.",
      lore: "Someone stayed in this cabin before you — and left a final plea behind.",
      meta: { clueGroup: "past_player" }
    },
    {
      id: "om_corrupt_painting",
      type: "OMEN",
      glyph: "CP",
      name: "CORRUPT PAINTING",
      shortEffect: "Uncanny wall portrait",
      effect: "While on top of the Graveyard, a framed painting in its assigned room twists into an uncanny, unblinking portrait when inspected with [E].",
      lore: "The eyes stretch far too wide, staring directly back at your lantern.",
      meta: { clueGroup: "corrupt_painting" }
    },
    {
      id: "om_paranormal_alt",
      type: "OMEN",
      glyph: "PA",
      name: "PARANORMAL ALTERATION",
      shortEffect: "Warped room furniture",
      effect: "While on top of the Graveyard, a room's furniture, fixtures, or wallpaper warps — leaving an antique chair hovering upside-down.",
      lore: "Gravity seems to forget one corner of the cabin.",
      meta: { clueGroup: "paranormal_alteration" }
    },
    {
      id: "om_rooster_decor",
      type: "OMEN",
      glyph: "CD",
      name: "CHICKEN DECOR",
      shortEffect: "Chicken decor (May be fake!)",
      effect: "While on top of the Graveyard, a Chicken Decor plaque appears in a room. Beware: sometimes it is a fake clue that loses its head once the 3rd clue is revealed.",
      lore: "A carved farmhouse rooster — check its head once three clues have surfaced.",
      meta: { clueGroup: "chicken_decor", canBeDecoy: true }
    },
    {
      id: "om_chalk_grid",
      type: "OMEN",
      glyph: "XO",
      name: "TIC-TAC-TOE",
      shortEffect: "5 X/O marks across rooms",
      effect: "While on top of the Graveyard, X or O marks appear across 5 different rooms (including the Study canvas). Whichever symbol appears 3 times is the winning clue.",
      lore: "An unfinished game etched across five rooms — count every X and O carefully.",
      meta: { clueGroup: "tic_tac_toe", outcomes: ["WINNING X", "WINNING O"] }
    },

    // =========================================================================
    // 3. CHIME CARDS (Progress Cards — balanced SP & MP clock/table effects)
    // =========================================================================
    {
      id: "ch_plus_15",
      type: "CHIME",
      glyph: "+15",
      name: "QUIET QUARTER",
      shortEffect: "Player +15m (Harvester stays)",
      effect: "Advances ONLY the player pawn forward by 15 minutes toward 12:00 AM Midnight while keeping the Hollow Harvester still this turn.",
      lore: "A measured quarter-hour tick buys calm steps without rushing midnight.",
      meta: { deltaMinutes: 15, freezeHarvester: true, skipPassiveStep: true }
    },
    {
      id: "ch_plus_30",
      type: "CHIME",
      glyph: "+30",
      name: "HALF-HOUR TOLL",
      shortEffect: "Player +30m (Harvester stays)",
      effect: "Advances ONLY the player pawn forward by 30 minutes toward 12:00 AM Midnight. The Hollow Harvester does not move this turn.",
      lore: "A single brass bell rings from the beam overhead while shadows freeze in place.",
      meta: { deltaMinutes: 30, freezeHarvester: true, skipPassiveStep: true }
    },
    {
      id: "ch_plus_60",
      type: "CHIME",
      glyph: "+60",
      name: "FULL-HOUR STRIKE",
      shortEffect: "Player +60m (Harvester stays)",
      effect: "Advances ONLY the player pawn forward by 60 minutes toward 12:00 AM Midnight. The Hollow Harvester does not move this turn.",
      lore: "The grandfather clock skips a whole heartbeat, leaving the hunter stranded behind.",
      meta: { deltaMinutes: 60, freezeHarvester: true, skipPassiveStep: true }
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

  // Starter discovered set (1 per category so all 5 categories show both known & black "?" silhouettes)
  const DEFAULT_DISCOVERED_IDS = [
    "bp_cellar",
    "hx_harvester",
    "om_grandfather_clock",
    "ch_plus_30",
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

  // ==================== BALANCED DRAW PROBABILITIES + GUARANTEED PITY ENGINE ====================
  // Tuned via 600-match Monte Carlo simulation so:
  //   - Matches do NOT rush to 12:00 AM too fast (healthy ~24-34 turn arc)
  //   - Players do NOT uncover all 3 True Clues too early (~18-26 turns to deduce the Exit Room)
  //   - Singleplayer strictly excludes all Multiplayer-only / turn-shifting cards
  //   - The Thief & The Neighbor remain strictly 1x per match in both SP & MP!
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

  // Balanced internal Progress (CHIME) weights:
  //   - Steady +15m & +30m dominate; +60m is rarer so clock doesn't rocket to Midnight!
  //   - Borrowed Time (-30m) lets investigators slow down Midnight when needed.
  //   - ch_random_turn, ch_traitor & ch_sacrifice are strictly Multiplayer-only!
  const CHIME_CARD_WEIGHTS = {
    ch_plus_15:      0.22,
    ch_plus_30:      0.27,
    ch_rewind_30:    0.08,
    ch_plus_60:      0.10,
    ch_shuffle:      0.12,
    ch_random_board: 0.09,
    ch_random_turn:  0.08,  // MP only (auto-filtered out in SP)
    ch_traitor:      0.020, // Rare MP only (strictly 1x/match)
    ch_sacrifice:    0.020, // Rare MP only (strictly 1x/match)
    ch_the_thief:    0.06,  // Strictly 1x/match
    ch_the_neighbor: 0.06   // Strictly 1x/match
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

  // Special Progress cards that can appear AT MOST ONCE per entire match!
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

  // Draws 1 card obeying balanced SP/MP weights AND pity guarantees:
  //   - At least 1 ROOM within every 4 draws (while unbuilt rooms remain)
  //   - At least 1 CLUE within every 6 draws (SP) / 7 draws (MP) so answers aren't solved too fast!
  //   - At least 1 EVENT within every 6 eligible draws (respecting cooldown)
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

    const roomPityCap = 3; // Guarantee Room on 4th draw without one
    const cluePityCap = isMultiplayer ? 6 : 5; // Guarantee Clue on 6th (SP) or 7th (MP) draw without one
    const eventPityCap = 5; // Guarantee Event on 6th eligible draw without one

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
        // Late-game once all 11 rooms are placed/held
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

  // Random N cards (used for 3-card starter hand & Shuffle Card!)
  // Caps starter Clues at max 1 so players don't start with 3 clues and solve the game too early,
  // enforces SP vs MP card filtering, and ensures at least 1 Room when rooms remain!
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
      // If last card of a 3-card starter hand and still 0 rooms while rooms exist, gently bias a room
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

  // Legacy helper kept for compatibility (builds a 40-card weighted deck matching DRAW_WEIGHTS)
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
    buildRoomDirectionSVG,
    drawWeightedCard,
    buildStartingHand,
    buildSingleplayerDeck
  };
})(window.Duskwood);
