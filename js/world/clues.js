/* ==========================================================================
   DUSKWOOD INN - Authentic Cabin Game Clue System & Close-Up Focus Inspector
   Matches The Cabin Game rules 1:1:
   1. Secret Exit Room (from FieldBook's 12 rooms) has 3 unique True Clues.
   2. Only the TOP Clue Card on the Graveyard Pedestal gets checked every turn!
   3. A clue will NOT appear if its assigned spawn room does not exist yet.
   4. Once checked while its spawn room exists, the clue manifests permanently:
      - THE GRANDFATHER CLOCK : Plays audio/grandfather_clock_sfx.mp3 (3s->11s)
                                & spawns a tall antique Grandfather Clock model
      - CORRUPT PAINTING      : Warps the room's portrait; [E] reveals an Uncanny painting
      - TIC-TAC-TOE (5 rooms) : Visible painted/chalked X or O right in each room
                                (e.g. painted on Study's artist canvas!) + [E] close-up focus
      - PAST PLAYER           : Visible "HELP US" & skull remains + [E] close-up focus
      - PARANORMAL ALTERATION : Visible upside-down floating chair + [E] close-up focus
      - CHICKEN DECOR         : Visible rooster wall plaque (if FAKE decoy, loses its
                                head once the 3rd & final true clue is revealed!)
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let inspectOpen = false;

  const PAINTING_ROOMS = [
    "dining_room",
    "bp_kitchen",
    "bp_bedroom",
    "bp_study",
    "bp_living_room",
    "bp_l_hallway",
    "bp_hallway_1",
    "bp_hallway_2",
    "bp_t_hallway_1",
    "bp_t_hallway_2"
  ];

  const ALL_CANDIDATE_ROOMS = [
    "dining_room",
    "bp_kitchen",
    "bp_bathroom",
    "bp_furnace",
    "bp_study",
    "bp_bedroom",
    "bp_living_room",
    "bp_t_hallway_1",
    "bp_t_hallway_2",
    "bp_hallway_1",
    "bp_hallway_2",
    "bp_l_hallway"
  ];

  // Room-specific thematic surface for Tic-Tac-Toe marks (walls, foggy bathroom mirror, canvas, tiles!)
  const ROOM_TTT_SURFACES = {
    bp_bathroom:    { style: "mirror",      label: "BATHROOM MIRROR",      desc: "A faint symbol traced by a finger across the steam-fogged bathroom mirror glass." },
    bp_study:       { style: "canvas",      label: "STUDY CANVAS",         desc: "Muted charcoal pigment brushed subtly onto a linen canvas tucked in The Study." },
    dining_room:    { style: "wainscot",    label: "DINING WALL PANEL",    desc: "Faint chalk scratched quietly along the lower oak wainscoting of The Dining Room." },
    bp_kitchen:     { style: "wall_tile",   label: "KITCHEN WALL TILE",    desc: "Fine soot and chalk traced discreetly across the kitchen backsplash tiles." },
    bp_bedroom:     { style: "wallpaper",   label: "BEDROOM WALLPAPER",    desc: "Thin pale chalk marks drawn quietly into the striped bedroom wallpaper." },
    bp_living_room: { style: "wallpaper",   label: "LIVING ROOM WALL",     desc: "A faint chalk symbol tucked along the side parlor wallpaper." },
    bp_furnace:     { style: "brick_wall",  label: "FURNACE BRICK WALL",   desc: "Pale ash rubbed into a quiet symbol on the damp furnace brick wall." },
    bp_l_hallway:   { style: "wall_plaster",label: "L-HALL WALL",          desc: "Thin scratches forming a symbol along the dark L-Hall wall." },
    bp_hallway_1:   { style: "wall_plaster",label: "HALL I WALL",          desc: "A subtle chalk mark traced along the narrow Hall I wall." },
    bp_hallway_2:   { style: "wall_plaster",label: "HALL II WALL",         desc: "Faint chalk etched into the weathered Hall II wallpaper." },
    bp_t_hallway_1: { style: "wall_plaster",label: "T-HALL I WALL",        desc: "Quiet pencil strokes drawn on the T-Hall I wall trim." },
    bp_t_hallway_2: { style: "wall_plaster",label: "T-HALL II WALL",       desc: "A faint etched mark tucked along the T-Hall II wall." }
  };

  // Room-specific Chicken Decor forms (NOT always a floor statue — wall murals, ceramic plates, wood carvings!)
  const ROOM_CHICKEN_STYLES = {
    bp_study:       { style: "wood_figurine", label: "WOODEN ROOSTER FIGURINE", desc: "A small hand-carved wooden rooster figurine tucked on the side shelf in The Study." },
    bp_kitchen:     { style: "wall_plate",    label: "CERAMIC ROOSTER PLATE",   desc: "A vintage painted ceramic rooster plate hung quietly on the kitchen wall." },
    dining_room:    { style: "wall_mural",    label: "PAINTED ROOSTER SKETCH",  desc: "A faded farmhouse rooster painted directly onto the wall plaster of The Dining Room." },
    bp_living_room: { style: "wall_frame",    label: "FRAMED ROOSTER PRINT",    desc: "A small rustic ink print of a rooster mounted subtly on the living room wall." },
    bp_bedroom:     { style: "wall_mural",    label: "WALLPAPER ROOSTER MOTIF", desc: "A faint stenciled rooster silhouette drawn into the bedroom wall corner." },
    bp_bathroom:    { style: "tile_decal",    label: "CERAMIC ROOSTER TILE",    desc: "A subtle glazed rooster motif fired onto one of the bathroom wall tiles." },
    bp_furnace:     { style: "wall_stencil",  label: "CHALKED ROOSTER STENCIL", desc: "A weathered rooster outline stenciled onto the brick wall near the furnace." },
    bp_l_hallway:   { style: "wall_stencil",  label: "HALLWAY ROOSTER DRAWING", desc: "A faint charcoal drawing of a rooster tucked along the L-Hall wall." },
    bp_hallway_1:   { style: "wall_stencil",  label: "HALLWAY ROOSTER DRAWING", desc: "A quiet painted rooster stencil along the wall of Hall I." },
    bp_hallway_2:   { style: "wall_stencil",  label: "HALLWAY ROOSTER DRAWING", desc: "A faded rooster sketch scratched into the Hall II wallpaper." },
    bp_t_hallway_1: { style: "wall_frame",    label: "SMALL ROOSTER PLAQUE",    desc: "A modest wooden rooster plaque hanging along the T-Hall I wall." },
    bp_t_hallway_2: { style: "wall_stencil",  label: "HALLWAY ROOSTER STENCIL", desc: "A faint rooster outline stenciled near the corner of T-Hall II." }
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function fillPixelEllipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
      if (span >= 0) {
        c.fillRect(Math.floor(cx - span), Math.floor(cy + dy), span * 2 + 1, 1);
      }
    }
  }

  // ==================== 1. MATCH CLUE INITIALIZATION ====================
  function initMatchClues(matchState) {
    const exitList = App.FieldBook ? App.FieldBook.EXIT_ROOMS : [];
    const chosenExit = exitList.length
      ? exitList[Math.floor(Math.random() * exitList.length)]
      : { id: "bp_kitchen", clues: ["winning_x", "chicken_decor", "paranormal_alt"] };

    matchState.sanctuaryRoomId = chosenExit.id;
    matchState.sanctuaryClueKeys = chosenExit.clues.slice();

    const entries = [];
    const usedSingleRooms = new Set();

    function pickSpawnRoom(pool) {
      const preferred = pool.filter((r) => !usedSingleRooms.has(r));
      const list = preferred.length ? preferred : pool;
      const picked = list[Math.floor(Math.random() * list.length)];
      usedSingleRooms.add(picked);
      return picked;
    }

    // Create authentic spawn entries for the 3 True Clues of this match!
    chosenExit.clues.forEach((clueKey) => {
      if (clueKey === "clock") {
        entries.push({
          id: "clue_clock",
          clueKey: "clock",
          omenId: "om_grandfather_clock",
          roomId: pickSpawnRoom(ALL_CANDIDATE_ROOMS),
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "past_player") {
        entries.push({
          id: "clue_past_player",
          clueKey: "past_player",
          omenId: "om_past_traveler",
          roomId: pickSpawnRoom(ALL_CANDIDATE_ROOMS),
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "corrupt_painting") {
        entries.push({
          id: "clue_corrupt_painting",
          clueKey: "corrupt_painting",
          omenId: "om_corrupt_painting",
          roomId: pickSpawnRoom(PAINTING_ROOMS),
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "paranormal_alt") {
        entries.push({
          id: "clue_paranormal_alt",
          clueKey: "paranormal_alt",
          omenId: "om_paranormal_alt",
          roomId: pickSpawnRoom(ALL_CANDIDATE_ROOMS),
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "chicken_decor") {
        entries.push({
          id: "clue_chicken",
          clueKey: "chicken_decor",
          omenId: "om_rooster_decor",
          roomId: pickSpawnRoom(ALL_CANDIDATE_ROOMS),
          isTrueClue: true,
          isFakeChicken: false,
          revealed: false
        });
      } else if (clueKey === "winning_x" || clueKey === "winning_o") {
        // TIC-TAC-TOE: Always spans 5 DIFFERENT rooms (3 winning symbol + 2 losing symbol)!
        // Include bp_study & dining_room high in priority so players readily see the Study Canvas & Dining mark!
        const winSym = clueKey === "winning_x" ? "X" : "O";
        const loseSym = winSym === "X" ? "O" : "X";
        const others = shuffle(ALL_CANDIDATE_ROOMS.filter((r) => r !== "bp_bathroom" && r !== "bp_study" && r !== "bp_kitchen"));
        const fiveRooms = shuffle(["bp_bathroom", "bp_study", "bp_kitchen", others[0], others[1]]);
        const symbols = shuffle([winSym, winSym, winSym, loseSym, loseSym]);

        fiveRooms.forEach((rid, i) => {
          const surf = ROOM_TTT_SURFACES[rid] || ROOM_TTT_SURFACES.dining_room;
          entries.push({
            id: `clue_ttt_${i}`,
            clueKey,
            omenId: "om_chalk_grid",
            roomId: rid,
            symbol: symbols[i],
            surfaceStyle: surf.style,
            surfaceLabel: surf.label,
            surfaceDesc: surf.desc,
            isTrueClue: true,
            revealed: false
          });
        });
      }
    });

    // FAKE CHICKEN DECOR DECOY (Exact Cabin Game rule: sometimes spawns as a fake clue;
    // loses its head ONLY when the 3rd & final true clue has been revealed!)
    if (!chosenExit.clues.includes("chicken_decor") && Math.random() < 0.48) {
      entries.push({
        id: "clue_chicken_fake",
        clueKey: "chicken_decor",
        omenId: "om_rooster_decor",
        roomId: pickSpawnRoom(ALL_CANDIDATE_ROOMS),
        isTrueClue: false,
        isFakeChicken: true,
        revealed: false
      });
    }

    matchState.clueManifest = {
      exitRoomId: chosenExit.id,
      trueClueKeys: chosenExit.clues.slice(),
      entries,
      revealedTrueKeys: [],
      fakeChickenHeadless: false,
      lastTttRevealTurn: -1
    };

    if (App.FieldBook) App.FieldBook.resetNotes();
  }

  // ==================== 2. TURN-END TOP GRAVEYARD CLUE CHECK ====================
  // Checks ONLY the TOP Clue Card currently on the Graveyard!
  // Smart Built-Room Re-binding: once the player has built >= 4 rooms (Dining + Cellar + 2+),
  // any matching unrevealed clue whose pre-rolled room hasn't been drawn yet automatically
  // binds into one of the player's built rooms so clues NEVER stay stuck invisible all match!
  function evaluateTopGraveyardClue(matchState) {
    if (!matchState || !matchState.clueManifest || !matchState.activeOmenId) return [];
    const topOmenId = matchState.activeOmenId;
    const manifest = matchState.clueManifest;
    const builtRoomIds = new Set(Object.values(matchState.roomMap || {}).map((r) => r.id));
    const builtNonCellar = Array.from(builtRoomIds).filter((id) => id !== "bp_cellar");

    const matching = manifest.entries.filter((e) => e.omenId === topOmenId && !e.revealed);

    const newlyRevealed = [];

    // TIC-TAC-TOE SPECIAL RULE: Reveal STRICTLY 1 sign (X or O) per player turn!
    // (Takes up to 5 turns to show all 5 signs, or players can deduce early if 3 X's or 3 O's appear first!)
    if (topOmenId === "om_chalk_grid") {
      const curTurn = matchState.turnCount || 0;
      if (matching.length > 0 && manifest.lastTttRevealTurn !== curTurn) {
        let ready = matching.filter((e) => builtRoomIds.has(e.roomId));

        // If none of the remaining pre-assigned TTT rooms exist yet, rebind 1 entry to a free built room!
        if (ready.length === 0 && builtNonCellar.length >= 2) {
          const usedTttRooms = new Set(
            manifest.entries
              .filter((e) => e.omenId === "om_chalk_grid" && (e.revealed || builtRoomIds.has(e.roomId)))
              .map((e) => e.roomId)
          );
          const freeBuilt = shuffle(builtNonCellar.filter((rid) => !usedTttRooms.has(rid)));
          if (freeBuilt.length > 0) {
            const targetEntry = matching[0];
            const newRid = freeBuilt[0];
            targetEntry.roomId = newRid;
            const surf = ROOM_TTT_SURFACES[newRid] || ROOM_TTT_SURFACES.dining_room;
            targetEntry.surfaceStyle = surf.style;
            targetEntry.surfaceLabel = surf.label;
            targetEntry.surfaceDesc = surf.desc;
            ready = [targetEntry];
          }
        }

        if (ready.length > 0) {
          const picked = ready[0];
          picked.revealed = true;
          manifest.lastTttRevealTurn = curTurn;
          newlyRevealed.push(picked);

          // Count revealed X & O marks: once either symbol reaches 3, Tic-Tac-Toe is conclusively revealed!
          const revTtt = manifest.entries.filter((e) => e.omenId === "om_chalk_grid" && e.revealed);
          const xCnt = revTtt.filter((e) => e.symbol === "X").length;
          const oCnt = revTtt.filter((e) => e.symbol === "O").length;
          if (picked.isTrueClue && (xCnt >= 3 || oCnt >= 3) && !manifest.revealedTrueKeys.includes(picked.clueKey)) {
            manifest.revealedTrueKeys.push(picked.clueKey);
          }
        }
      }
    } else {
      // Single-room clue (Clock, Past Player, Corrupt Painting, Paranormal, Chicken / Fake Chicken):
      // Smart re-binding once >= 3 non-Cellar rooms (4+ total rooms) exist!
      if (matching.length > 0 && builtNonCellar.length >= 3) {
        const occupiedClueRooms = new Set(manifest.entries.filter((e) => e.revealed).map((e) => e.roomId));
        matching.forEach((entry) => {
          if (builtRoomIds.has(entry.roomId)) return;
          let pool = topOmenId === "om_corrupt_painting"
            ? builtNonCellar.filter((rid) => PAINTING_ROOMS.includes(rid))
            : builtNonCellar.slice();
          if (!pool.length) return;
          const unoccupied = pool.filter((rid) => !occupiedClueRooms.has(rid));
          const pickPool = unoccupied.length ? unoccupied : pool;
          entry.roomId = pickPool[Math.floor(Math.random() * pickPool.length)];
          occupiedClueRooms.add(entry.roomId);
        });
      }

      manifest.entries.forEach((entry) => {
        if (entry.omenId !== topOmenId) return;
        if (entry.revealed) return;
        if (!builtRoomIds.has(entry.roomId)) return; // Room does not exist yet!

        entry.revealed = true;
        newlyRevealed.push(entry);

        if (entry.isTrueClue && !manifest.revealedTrueKeys.includes(entry.clueKey)) {
          manifest.revealedTrueKeys.push(entry.clueKey);
        }

        // GRANDFATHER CLOCK CLUE: Immediately trigger audio/grandfather_clock_sfx.mp3 (3.0s -> 11.0s)!
        if (entry.omenId === "om_grandfather_clock" && App.Audio && App.Audio.playGrandfatherClockClue) {
          App.Audio.playGrandfatherClockClue();
        }
      });
    }

    // FAKE CHICKEN RULE: The moment the 3rd and final true clue is revealed, a fake chicken loses its head!
    if (manifest.revealedTrueKeys.length >= 3 && !manifest.fakeChickenHeadless) {
      const hasFake = manifest.entries.some((e) => e.isFakeChicken);
      if (hasFake) {
        manifest.fakeChickenHeadless = true;
      }
    }

    return newlyRevealed;
  }

  function getRevealedEntriesForRoom(roomId, matchState) {
    if (!matchState || !matchState.clueManifest) return [];
    return matchState.clueManifest.entries.filter((e) => e.roomId === roomId && e.revealed);
  }

  function isRoomPaintingCorrupted(roomId, matchState) {
    return getRevealedEntriesForRoom(roomId, matchState).some(
      (e) => e.omenId === "om_corrupt_painting"
    );
  }

  // ==================== 3. VERIFIED, VARIED ROOM-AWARE CLUE PLACEMENT ANCHORS ====================
  // Placed naturally along walls, mirrors, shelves & corners — ZERO doorway overlap, ZERO dark-void clipping!
  function getSafeClueAnchor(room, omenId) {
    const rid = room.id;
    const d = room.doors || {};

    // The Dining Room (round table is in center 104,126; windows at 54..72 & 134..152; bookshelf 152..174)
    if (rid === "dining_room") {
      if (omenId === "om_grandfather_clock") return { x: 142, y: 56 };
      if (omenId === "om_chalk_grid")        return { x: 64,  y: 44, isWall: true, interactY: 58 };
      if (omenId === "om_past_traveler")     return { x: 36,  y: 172 };
      if (omenId === "om_paranormal_alt")    return { x: 168, y: 170 };
      if (omenId === "om_rooster_decor")     return { x: 182, y: 30, isWall: true, interactY: 58 };
      return { x: 36, y: 172 };
    }

    // The Study: Wooden rooster figurine on side shelf, painter's easel near corner, wall clues!
    if (rid === "bp_study") {
      const isVert = d.N && d.S;
      if (omenId === "om_chalk_grid") {
        return isVert ? { x: 140, y: 166, easel: true } : { x: 160, y: 152, easel: true };
      }
      if (omenId === "om_grandfather_clock") {
        return isVert ? { x: 144, y: 84 } : { x: 44, y: 154 };
      }
      if (omenId === "om_paranormal_alt") return isVert ? { x: 140, y: 138 } : { x: 44, y: 104 };
      if (omenId === "om_rooster_decor")  return isVert ? { x: 66,  y: 158 } : { x: 162, y: 96 };
      return isVert ? { x: 64, y: 174 } : { x: 156, y: 156 };
    }

    // The Bathroom: Tic-Tac-Toe drawn directly on the steamed Bathroom Mirror! Chicken as glazed tile decal!
    if (rid === "bp_bathroom") {
      const isVert = d.N || d.S;
      if (omenId === "om_chalk_grid") {
        return isVert
          ? { x: d.N ? 82 : 118, y: 32, isWall: true, isMirror: true, interactY: 58 }
          : { x: 104, y: 78, isWall: true, isMirror: true, interactY: 102 };
      }
      if (omenId === "om_rooster_decor") {
        return isVert
          ? { x: d.N ? 124 : 86, y: 30, isWall: true, interactY: 58 }
          : { x: 64, y: 78, isWall: true, interactY: 102 };
      }
      if (omenId === "om_grandfather_clock") return isVert ? { x: 120, y: 82 } : { x: 48, y: 112 };
      if (omenId === "om_paranormal_alt")    return isVert ? { x: 116, y: 138 } : { x: 138, y: 138 };
      return isVert ? { x: 88, y: 152 } : { x: 76, y: 138 };
    }

    // Compact Furnace Room: Wall smudges & brick stencils clear of doorway!
    if (rid === "bp_furnace") {
      const isVert = d.N || d.S;
      if (omenId === "om_chalk_grid") {
        return isVert
          ? { x: d.N ? 140 : 72, y: 32, isWall: true, interactY: 58 }
          : { x: 68, y: 60, isWall: true, interactY: 88 };
      }
      if (omenId === "om_rooster_decor") {
        return isVert
          ? { x: d.N ? 66 : 138, y: 32, isWall: true, interactY: 58 }
          : { x: 148, y: 60, isWall: true, interactY: 88 };
      }
      if (omenId === "om_grandfather_clock") return isVert ? { x: 144, y: 86 } : { x: 46, y: 146 };
      if (omenId === "om_paranormal_alt")    return isVert ? { x: 140, y: 144 } : { x: 130, y: 146 };
      return isVert ? { x: 66, y: 168 } : { x: 58, y: 152 };
    }

    // L-shaped Kitchen & Bedroom: Verified clear of EVERY doorway (92..116) & fridge/wardrobe!
    if (rid === "bp_kitchen" || rid === "bp_bedroom") {
      if (d.N && d.E) {
        if (omenId === "om_chalk_grid")        return { x: 132, y: 32, isWall: true, interactY: 58 };
        if (omenId === "om_rooster_decor")     return { x: 180, y: 64, isWall: true, interactY: 94 };
      } else if (d.E && d.S) {
        if (omenId === "om_chalk_grid")        return { x: 86,  y: 60, isWall: true, interactY: 88 };
        if (omenId === "om_rooster_decor")     return { x: 174, y: 60, isWall: true, interactY: 88 };
      } else if (d.S && d.W) {
        if (omenId === "om_chalk_grid")        return { x: 38,  y: 60, isWall: true, interactY: 88 };
        if (omenId === "om_rooster_decor")     return { x: 114, y: 60, isWall: true, interactY: 88 };
      } else {
        // W & N
        if (omenId === "om_chalk_grid")        return { x: 76,  y: 32, isWall: true, interactY: 58 };
        if (omenId === "om_rooster_decor")     return { x: 46,  y: 64, isWall: true, interactY: 94 };
      }
      if (omenId === "om_grandfather_clock") return { x: d.W ? 140 : 68, y: d.S ? 104 : 146 };
      if (omenId === "om_paranormal_alt")    return { x: d.E ? 168 : 40, y: 140 };
      return { x: d.E ? 164 : 42, y: 146 };
    }

    // Spacious T-shaped Living Room
    if (rid === "bp_living_room") {
      if (d.N) {
        if (omenId === "om_chalk_grid")        return { x: 78,  y: 30, isWall: true, interactY: 58 };
        if (omenId === "om_rooster_decor")     return { x: 148, y: 30, isWall: true, interactY: 58 };
      } else {
        if (omenId === "om_chalk_grid")        return { x: 104, y: 50, isWall: true, interactY: 78 };
        if (omenId === "om_rooster_decor")     return { x: 168, y: 50, isWall: true, interactY: 78 };
      }
      if (omenId === "om_grandfather_clock") return { x: d.W ? 150 : 58, y: 90 };
      if (omenId === "om_paranormal_alt")    return { x: d.E ? 168 : 40, y: 148 };
      return { x: d.S ? 68 : 146, y: 158 };
    }

    // Narrow Hallways: Clear of all doorways (never on 92..116 when N is open!)
    const hasHoriz = !d.N && (d.E || d.W);
    if (hasHoriz) {
      if (omenId === "om_chalk_grid")        return { x: d.E ? 148 : 60, y: 80, isWall: true, interactY: 110 };
      if (omenId === "om_rooster_decor")     return { x: d.E ? 172 : 36, y: 80, isWall: true, interactY: 110 };
    } else if (d.E || d.W) {
      if (omenId === "om_chalk_grid")        return { x: d.E ? 148 : 60, y: 80, isWall: true, interactY: 110 };
      if (omenId === "om_rooster_decor")     return { x: d.E ? 176 : 34, y: 80, isWall: true, interactY: 110 };
    } else {
      // Pure vertical Straight Hallway (x: 78..130, N door 92..116)
      if (omenId === "om_chalk_grid")        return { x: 86,  y: 34, isWall: true, interactY: 58 };
      if (omenId === "om_rooster_decor")     return { x: 122, y: 34, isWall: true, interactY: 58 };
    }
    if (omenId === "om_grandfather_clock") return { x: 92, y: 118 };
    if (omenId === "om_paranormal_alt")    return { x: d.E ? 150 : d.W ? 58 : 114, y: 132 };
    return { x: d.E ? 156 : d.W ? 52 : 92, y: 138 };
  }

  // ==================== 4. CLEAR, NATURAL & VARIED IN-ROOM CLUE MODELS ====================
  function drawGrandfatherClockModel(c, x, y, timeSec) {
    const lx = Math.round(x - 9);
    const ty = Math.round(y - 40);

    c.fillStyle = "rgba(0, 0, 0, 0.48)";
    c.fillRect(lx - 1, ty + 41, 20, 4);

    // Classic mahogany grandfather clock with crisp ivory dial & gleaming brass pendulum
    px(c, lx + 8, ty - 2, 2, 2, "#e0bc5c");
    px(c, lx + 2, ty, 14, 2, "#1f1109");
    px(c, lx, ty + 2, 18, 3, "#1f1109");
    px(c, lx + 1, ty + 3, 16, 1, "#8c5936");

    px(c, lx + 1, ty + 5, 16, 15, "#1f1109");
    px(c, lx + 2, ty + 6, 14, 13, "#613a22");
    px(c, lx + 2, ty + 20, 14, 18, "#1f1109");
    px(c, lx + 3, ty + 21, 12, 16, "#6b4026");
    px(c, lx + 3, ty + 21, 2, 16, "#8c5938");

    px(c, lx, ty + 38, 18, 5, "#1f1109");
    px(c, lx + 1, ty + 39, 16, 3, "#54321d");

    // Crisp ivory clock face frozen at XII
    fillPixelEllipse(c, lx + 9, ty + 12, 6, 6, "#cfa64c");
    fillPixelEllipse(c, lx + 9, ty + 12, 5, 5, "#f5ecd6");
    px(c, lx + 9, ty + 8, 1, 5, "#1a120d");
    px(c, lx + 9, ty + 12, 1, 1, "#9e2424");

    // Swinging brass pendulum
    px(c, lx + 6, ty + 22, 6, 14, "#120e0d");
    const swing = Math.round(Math.sin(timeSec * 3.4) * 1.8);
    px(c, lx + 9 + swing, ty + 24, 1, 8, "#cfa64c");
    px(c, lx + 8 + swing, ty + 30, 3, 3, "#f2cf6b");
  }

  function drawArtistCanvasWithSymbol(c, x, y, symbol) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    c.fillStyle = "rgba(0,0,0,0.42)";
    c.fillRect(cx - 10, cy + 4, 20, 3);
    px(c, cx - 7, cy - 1, 2, 8, "#5e3a22");
    px(c, cx + 5, cy - 1, 2, 8, "#5e3a22");
    px(c, cx - 1, cy - 22, 2, 27, "#452916");
    // Crisp linen artist canvas (22x18)
    px(c, cx - 11, cy - 20, 22, 18, "#21140c");
    px(c, cx - 10, cy - 19, 20, 16, "#ebe2cc");
    c.save();
    c.strokeStyle = "#261b14";
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.beginPath();
    if (symbol === "X") {
      c.moveTo(cx - 5, cy - 15); c.lineTo(cx + 5, cy - 7);
      c.moveTo(cx + 5, cy - 15); c.lineTo(cx - 5, cy - 7);
    } else {
      c.arc(cx, cy - 11, 5.2, 0, Math.PI * 2);
    }
    c.stroke();
    c.restore();
  }

  function drawWallOrMirrorSymbol(c, x, y, symbol, surfaceStyle) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    c.save();

    if (surfaceStyle === "mirror") {
      // Clear steamed bathroom mirror (16x18) with unmistakable finger-traced X or O!
      px(c, cx - 8, cy - 9, 16, 18, "#241911");
      px(c, cx - 7, cy - 8, 14, 16, "#7a95a3");
      px(c, cx - 6, cy - 7, 12, 14, "#b4cad4"); // Steamy condensation haze
      c.strokeStyle = "#233640";
      c.lineWidth = 2.1;
      c.lineCap = "round";
      c.beginPath();
      if (symbol === "X") {
        c.moveTo(cx - 4, cy - 4); c.lineTo(cx + 4, cy + 4);
        c.moveTo(cx + 4, cy - 4); c.lineTo(cx - 4, cy + 4);
      } else {
        c.arc(cx, cy, 4.3, 0, Math.PI * 2);
      }
      c.stroke();
      c.restore();
      return;
    }

    // Crisp, clearly readable chalk / charcoal / ash mark on wallpaper, wainscoting, kitchen tile, or brick!
    const isDarkInk = surfaceStyle === "wall_tile";
    const shadowCol = isDarkInk ? "rgba(245, 238, 220, 0.55)" : "rgba(14, 10, 8, 0.72)";
    const mainCol   = isDarkInk ? "#1f1916" : "#f5eedc";

    c.lineCap = "round";
    // Crisp dark/light backing outline so the X/O reads clearly against patterned wallpaper!
    c.strokeStyle = shadowCol;
    c.lineWidth = 3.8;
    c.beginPath();
    if (symbol === "X") {
      c.moveTo(cx - 5, cy - 5); c.lineTo(cx + 5, cy + 5);
      c.moveTo(cx + 5, cy - 5); c.lineTo(cx - 5, cy + 5);
    } else {
      c.arc(cx, cy, 5.2, 0, Math.PI * 2);
    }
    c.stroke();

    c.strokeStyle = mainCol;
    c.lineWidth = 2.2;
    c.beginPath();
    if (symbol === "X") {
      c.moveTo(cx - 5, cy - 5); c.lineTo(cx + 5, cy + 5);
      c.moveTo(cx + 5, cy - 5); c.lineTo(cx - 5, cy + 5);
    } else {
      c.arc(cx, cy, 5.2, 0, Math.PI * 2);
    }
    c.stroke();
    c.restore();
  }

  function drawPastPlayerRemains(c, x, y) {
    const cx = Math.round(x);
    const cy = Math.round(y);

    // Legible scratched chalk "HELP US" with dark outline so it reads cleanly!
    c.font = "bold 6px monospace";
    c.textAlign = "center";
    c.fillStyle = "rgba(12, 8, 6, 0.85)";
    c.fillText("HELP US", cx + 1, cy - 8);
    c.fillStyle = "#f2ead6";
    c.fillText("HELP US", cx, cy - 9);

    // Distinct ivory skull + crossed bones on floor!
    c.fillStyle = "rgba(0,0,0,0.44)";
    c.fillRect(cx - 8, cy + 2, 16, 4);
    px(c, cx - 10, cy + 1, 9, 2, "#ded4bc");
    px(c, cx + 2,  cy + 2, 8, 2, "#cfc4ab");
    px(c, cx - 4, cy - 5, 9, 7, "#1a1410");
    px(c, cx - 3, cy - 4, 7, 5, "#f2ebd8");
    px(c, cx - 2, cy + 1, 5, 2, "#ded4bc");
    px(c, cx - 2, cy - 2, 2, 2, "#1a1410");
    px(c, cx + 1, cy - 2, 2, 2, "#1a1410");
  }

  function drawUpsideDownFloatingChair(c, x, y, timeSec) {
    const cx = Math.round(x);
    const hover = Math.round(Math.sin(timeSec * 2.5) * 2.4);
    const cy = Math.round(y) - 10 + hover;

    // Subtle warped wallpaper ripples behind the floating chair
    c.save();
    c.strokeStyle = "rgba(220, 210, 195, 0.36)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 10, cy - 10); c.quadraticCurveTo(cx - 13, cy, cx - 9, cy + 10);
    c.moveTo(cx + 10, cy - 10); c.quadraticCurveTo(cx + 13, cy, cx + 9, cy + 10);
    c.stroke();
    c.restore();

    // Clear shadow far below to emphasize levitation!
    fillPixelEllipse(c, cx, Math.round(y) + 5, 10, 4, "rgba(0, 0, 0, 0.52)");

    // Crisp upside-down wooden cabin chair hovering visibly off the floor
    px(c, cx - 6, cy - 12, 3, 9, "#1c1008");
    px(c, cx + 3, cy - 12, 3, 9, "#1c1008");
    px(c, cx - 5, cy - 11, 2, 7, "#a66c42");
    px(c, cx + 4, cy - 11, 2, 7, "#a66c42");
    px(c, cx - 8, cy - 3, 16, 4, "#1c1008");
    px(c, cx - 7, cy - 2, 14, 2, "#bd7d4e");
    px(c, cx - 6, cy + 1, 12, 10, "#1c1008");
    px(c, cx - 5, cy + 2, 10, 8, "#8c5734");
    px(c, cx - 3, cy + 3, 6, 6, "#5c361e");
  }

  function drawChickenDecorModel(c, x, y, isHeadless, chickenStyle) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const style = chickenStyle || "wall_mural";

    if (style === "wood_figurine") {
      // Carved wooden rooster figurine on a clear side plinth (Study!)
      c.fillStyle = "rgba(0,0,0,0.44)";
      c.fillRect(cx - 7, cy + 4, 14, 3);
      px(c, cx - 6, cy + 1, 12, 4, "#24140a");
      px(c, cx - 5, cy + 2, 10, 2, "#875934");
      px(c, cx - 4, cy - 5, 8, 6, "#1f120a");
      px(c, cx - 3, cy - 4, 6, 4, "#b87f4b"); // Warm oak body
      px(c, cx - 7, cy - 6, 4, 5, "#8f5c34"); // Tail feathers
      if (!isHeadless) {
        px(c, cx + 3, cy - 9, 4, 6, "#c99058");
        px(c, cx + 3, cy - 12, 4, 3, "#d63232"); // Bright red comb!
        px(c, cx + 7, cy - 7, 3, 2, "#f2c144");  // Golden beak!
      } else {
        px(c, cx + 3, cy - 5, 3, 2, "#631e1c"); // Snapped neck!
      }
      return;
    }

    if (style === "wall_plate") {
      // Crisp vintage ceramic rooster wall plate mounted on kitchen wall (15x15)!
      fillPixelEllipse(c, cx, cy, 8, 8, "#211914");
      fillPixelEllipse(c, cx, cy, 7, 7, "#f5eedc");
      fillPixelEllipse(c, cx, cy, 5, 5, "#e0d6be");
      // Clear painted rooster silhouette inside plate
      px(c, cx - 3, cy - 1, 6, 4, "#284463");
      px(c, cx - 5, cy - 3, 3, 3, "#385b82");
      if (!isHeadless) {
        px(c, cx + 2, cy - 4, 3, 4, "#284463");
        px(c, cx + 2, cy - 6, 3, 2, "#cc2e2e"); // Red comb
        px(c, cx + 5, cy - 3, 2, 1, "#e8b338"); // Beak
      } else {
        px(c, cx + 2, cy - 2, 2, 2, "#8c2424");
      }
      return;
    }

    if (style === "wall_frame") {
      // Crisp framed folk-art rooster picture hung on wall (15x15)!
      px(c, cx - 8, cy - 8, 16, 16, "#21130b");
      px(c, cx - 7, cy - 7, 14, 14, "#b89552");
      px(c, cx - 6, cy - 6, 12, 12, "#f0e6cf");
      px(c, cx - 4, cy - 1, 7, 5, "#2b2018");
      px(c, cx - 5, cy - 3, 3, 4, "#7a3b29");
      if (!isHeadless) {
        px(c, cx + 2, cy - 4, 3, 4, "#2b2018");
        px(c, cx + 2, cy - 6, 3, 2, "#cc2b2b");
        px(c, cx + 5, cy - 3, 2, 1, "#e6ad32");
      }
      return;
    }

    // "wall_mural", "wall_stencil", or "tile_decal": Crisp, unmistakably readable wall rooster!
    const outCol  = "#1a130e";
    const fillCol = style === "tile_decal" ? "#2e485c" : "#f0e6ce";
    const combCol = "#d63232";
    const beakCol = "#f2c144";

    px(c, cx - 6, cy - 3, 10, 6, outCol);
    px(c, cx - 5, cy - 2, 8,  4, fillCol); // Body
    px(c, cx - 8, cy - 6, 4,  5, outCol);
    px(c, cx - 7, cy - 5, 3,  3, fillCol); // Curved tail
    px(c, cx - 3, cy + 3, 2,  4, fillCol); // Legs
    px(c, cx + 1, cy + 3, 2,  4, fillCol);
    if (!isHeadless) {
      px(c, cx + 2, cy - 7, 5, 6, outCol);
      px(c, cx + 3, cy - 6, 3, 4, fillCol); // Head
      px(c, cx + 3, cy - 9, 4, 3, combCol); // Bright red comb!
      px(c, cx + 6, cy - 5, 3, 2, beakCol); // Golden beak!
    } else {
      px(c, cx + 3, cy - 3, 3, 2, "#8f2222");
    }
  }

  function getCorruptPaintingCoords(room, matchState) {
    const pts = [];
    if (room.id === "dining_room") {
      pts.push({ x: 82, y: 26, rx: 76, ry: 20, rw: 12, rh: 13 });
    } else if (App.CabinRooms) {
      const rData = App.CabinRooms.getRoomData(room, matchState.roomMap);
      (rData.interactables || []).forEach((it) => {
        if (it.paintingId) {
          pts.push({ x: it.x, y: it.y - 34, rx: it.x - 7, ry: it.y - 40, rw: 14, rh: 12 });
        }
      });
    }
    return pts;
  }

  // Gentle anti-vignette visibility punch (small 22px radius, soft strength) so clues near
  // room walls/corners remain clearly readable without looking like neon spotlights!
  function getClueLightPoints(room, matchState) {
    if (!room || !matchState || !matchState.clueManifest) return [];
    const entries = getRevealedEntriesForRoom(room.id, matchState);
    if (!entries.length) return [];
    const pts = [];
    entries.forEach((entry) => {
      if (entry.omenId === "om_corrupt_painting") {
        getCorruptPaintingCoords(room, matchState).forEach((p) => {
          pts.push({ x: p.x, y: p.y, r: 22, strength: 0.52 });
        });
        return;
      }
      const pt = getSafeClueAnchor(room, entry.omenId);
      pts.push({ x: pt.x, y: pt.y - (entry.omenId === "om_grandfather_clock" ? 16 : 2), r: 24, strength: 0.56 });
    });
    return pts;
  }

  function renderRoomClues(ctx, room, timeSec, matchState) {
    if (!room || !matchState || !matchState.clueManifest) return;
    const entries = getRevealedEntriesForRoom(room.id, matchState);
    if (!entries.length) return;
    const headless = Boolean(matchState.clueManifest.fakeChickenHeadless);

    entries.forEach((entry) => {
      if (entry.omenId === "om_corrupt_painting") {
        // Unmistakable pale waxy uncanny portrait face & staring eyes on the wall canvas (NO red gore!)
        getCorruptPaintingCoords(room, matchState).forEach((p) => {
          px(ctx, p.x - 3, p.ry + 2, 6, 7, "#e8dfd0");
          px(ctx, p.x - 3, p.ry + 4, 2, 2, "#12100f");
          px(ctx, p.x + 1, p.ry + 4, 2, 2, "#12100f");
          px(ctx, p.x - 2, p.ry + 7, 4, 1, "#5c3f38");
        });
        return;
      }

      const pt = getSafeClueAnchor(room, entry.omenId);
      if (entry.omenId === "om_grandfather_clock") {
        drawGrandfatherClockModel(ctx, pt.x, pt.y, timeSec);
      } else if (entry.omenId === "om_chalk_grid") {
        if (pt.easel || entry.surfaceStyle === "canvas") {
          drawArtistCanvasWithSymbol(ctx, pt.x, pt.y, entry.symbol);
        } else {
          drawWallOrMirrorSymbol(ctx, pt.x, pt.y, entry.symbol, entry.surfaceStyle);
        }
      } else if (entry.omenId === "om_past_traveler") {
        drawPastPlayerRemains(ctx, pt.x, pt.y);
      } else if (entry.omenId === "om_paranormal_alt") {
        drawUpsideDownFloatingChair(ctx, pt.x, pt.y, timeSec);
      } else if (entry.omenId === "om_rooster_decor") {
        const chDef = ROOM_CHICKEN_STYLES[room.id] || ROOM_CHICKEN_STYLES.dining_room;
        drawChickenDecorModel(ctx, pt.x, pt.y, Boolean(entry.isFakeChicken && headless), chDef.style);
      }
    });
  }

  // Soft post-darkness readability pass ONLY over the exact clue area so corner vignettes never bury clues!
  function renderRoomClueHighlights(ctx, room, timeSec, matchState) {
    if (!room || !matchState || !matchState.clueManifest) return;
    const entries = getRevealedEntriesForRoom(room.id, matchState);
    if (!entries.length) return;

    entries.forEach((entry) => {
      if (entry.omenId === "om_corrupt_painting") {
        getCorruptPaintingCoords(room, matchState).forEach((p) => {
          // Subtle pale ivory gleam on the uncanny eyes when wall is in dim light
          px(ctx, p.x - 2, p.ry + 4, 1, 1, "#f2eee6");
          px(ctx, p.x + 2, p.ry + 4, 1, 1, "#f2eee6");
        });
        return;
      }
      const pt = getSafeClueAnchor(room, entry.omenId);
      const gy = pt.y - (entry.omenId === "om_grandfather_clock" ? 16 : 2);
      const g = ctx.createRadialGradient(pt.x, gy, 2, pt.x, gy, 20);
      g.addColorStop(0, "rgba(255, 244, 214, 0.14)");
      g.addColorStop(1, "rgba(255, 244, 214, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(pt.x - 20, gy - 20, 40, 40);
    });
  }

  // ==================== 5. INTERACTABLES FOR ALL REVEALED CLUES IN ROOM ====================
  function getRoomClueInteractables(room, matchState) {
    if (!room || !matchState || !matchState.clueManifest) return [];
    const entries = getRevealedEntriesForRoom(room.id, matchState);
    const list = [];

    entries.forEach((entry) => {
      if (entry.omenId === "om_corrupt_painting") return; // Handled directly by room's wall portrait [E]!
      const pt = getSafeClueAnchor(room, entry.omenId);
      const ix = pt.x;
      const iy = typeof pt.interactY === "number" ? pt.interactY : pt.y;

      if (entry.omenId === "om_grandfather_clock") {
        list.push({
          id: "clue_inspect_clock",
          x: ix, y: iy, r: 22,
          prompt: "[E] INSPECT GRANDFATHER CLOCK",
          clueInspect: { entry, room }
        });
      } else if (entry.omenId === "om_chalk_grid") {
        const surfName = entry.surfaceStyle === "mirror"
          ? "FOGGY MIRROR"
          : entry.surfaceStyle === "canvas"
            ? "CANVAS"
            : "WALL MARK";
        list.push({
          id: `clue_inspect_ttt_${room.id}`,
          x: ix, y: iy, r: 22,
          prompt: `[E] INSPECT ${surfName}`,
          clueInspect: { entry, room }
        });
      } else if (entry.omenId === "om_past_traveler") {
        list.push({
          id: "clue_inspect_past",
          x: ix, y: iy, r: 20,
          prompt: "[E] INSPECT CORNER",
          clueInspect: { entry, room }
        });
      } else if (entry.omenId === "om_paranormal_alt") {
        list.push({
          id: "clue_inspect_para",
          x: ix, y: iy, r: 20,
          prompt: "[E] INSPECT CHAIR",
          clueInspect: { entry, room }
        });
      } else if (entry.omenId === "om_rooster_decor") {
        const chDef = ROOM_CHICKEN_STYLES[room.id] || ROOM_CHICKEN_STYLES.dining_room;
        list.push({
          id: "clue_inspect_chicken",
          x: ix, y: iy, r: 22,
          prompt: `[E] INSPECT ${chDef.label}`,
          clueInspect: { entry, room }
        });
      }
    });

    return list;
  }

  // ==================== 6. FOCUSED CLOSE-UP INSPECTION MODAL ====================
  function buildClueCloseUpSVG(entry, matchState, room) {
    const headless = Boolean(
      entry.isFakeChicken &&
      matchState &&
      matchState.clueManifest &&
      matchState.clueManifest.fakeChickenHeadless
    );

    if (entry.omenId === "om_chalk_grid") {
      const sym = entry.symbol || "O";
      const st = entry.surfaceStyle || "wallpaper";
      let bg = "";
      let strokeCol = "#e8dfd0";
      let strokeOpacity = "0.78";

      if (st === "mirror") {
        // Steamed bathroom wall mirror with water droplets & finger-traced mark!
        bg = `<rect width="320" height="260" fill="#2c353b"/>
              <rect x="26" y="16" width="268" height="228" rx="6" fill="#423023" stroke="#18100a" stroke-width="5"/>
              <rect x="40" y="30" width="240" height="200" fill="#89a1ad" stroke="#536873" stroke-width="2"/>
              <ellipse cx="160" cy="130" rx="108" ry="86" fill="#b4c8d1" opacity="0.55"/>
              <circle cx="84" cy="72" r="3" fill="#dce9ef" opacity="0.55"/>
              <circle cx="234" cy="186" r="2.5" fill="#dce9ef" opacity="0.55"/>
              <path d="M214,68 L214,104" stroke="#dce9ef" stroke-width="2" opacity="0.38" stroke-linecap="round"/>`;
        strokeCol = "#3d535e";
        strokeOpacity = "0.84";
      } else if (st === "canvas") {
        bg = `<rect width="320" height="260" fill="#211812"/>
              <rect x="28" y="18" width="264" height="224" fill="#4f331e" stroke="#180f09" stroke-width="5"/>
              <rect x="42" y="32" width="236" height="196" fill="#e6dcc6" stroke="#b8ab90" stroke-width="2"/>`;
        strokeCol = "#261d17";
        strokeOpacity = "0.82";
      } else if (st === "wall_tile") {
        bg = `<rect width="320" height="260" fill="#b8b09c"/>
              <g stroke="#7a7262" stroke-width="2">
                <line x1="0" y1="65" x2="320" y2="65"/><line x1="0" y1="130" x2="320" y2="130"/><line x1="0" y1="195" x2="320" y2="195"/>
                <line x1="80" y1="0" x2="80" y2="260"/><line x1="160" y1="0" x2="160" y2="260"/><line x1="240" y1="0" x2="240" y2="260"/>
              </g>`;
        strokeCol = "#2b2520";
        strokeOpacity = "0.74";
      } else if (st === "brick_wall") {
        bg = `<rect width="320" height="260" fill="#42332e"/>
              <g stroke="#241b18" stroke-width="3">
                <line x1="0" y1="52" x2="320" y2="52"/><line x1="0" y1="104" x2="320" y2="104"/><line x1="0" y1="156" x2="320" y2="156"/><line x1="0" y1="208" x2="320" y2="208"/>
                <line x1="90" y1="0" x2="90" y2="52"/><line x1="210" y1="0" x2="210" y2="52"/>
                <line x1="50" y1="52" x2="50" y2="104"/><line x1="170" y1="52" x2="170" y2="104"/>
                <line x1="110" y1="104" x2="110" y2="156"/><line x1="230" y1="104" x2="230" y2="156"/>
              </g>`;
        strokeCol = "#dfd8c8";
        strokeOpacity = "0.72";
      } else if (st === "wainscot") {
        bg = `<rect width="320" height="260" fill="#52331f"/>
              <rect x="24" y="24" width="272" height="212" fill="#422817" stroke="#29170d" stroke-width="4"/>
              <rect x="40" y="40" width="240" height="180" fill="#593822" stroke="#362012" stroke-width="2"/>`;
        strokeCol = "#e8dec8";
        strokeOpacity = "0.72";
      } else {
        // Striped antique wallpaper / plaster wall
        bg = `<rect width="320" height="260" fill="#4d4137"/>
              <g fill="#57493e" opacity="0.55">
                <rect x="18" y="0" width="24" height="260"/><rect x="78" y="0" width="24" height="260"/>
                <rect x="138" y="0" width="24" height="260"/><rect x="198" y="0" width="24" height="260"/>
                <rect x="258" y="0" width="24" height="260"/>
              </g>`;
        strokeCol = "#ebe2d0";
        strokeOpacity = "0.72";
      }

      const mark =
        sym === "X"
          ? `<path d="M110,80 L210,180 M210,80 L110,180" stroke="${strokeCol}" stroke-width="11" stroke-linecap="round" opacity="${strokeOpacity}"/>`
          : `<ellipse cx="160" cy="130" rx="52" ry="56" fill="none" stroke="${strokeCol}" stroke-width="11" opacity="${strokeOpacity}" transform="rotate(-6 160 130)"/>`;

      return `<svg viewBox="0 0 320 260" class="ci-focus-svg">${bg}${mark}</svg>`;
    }

    if (entry.omenId === "om_grandfather_clock") {
      return `
        <svg viewBox="0 0 320 260" class="ci-focus-svg">
          <rect width="320" height="260" fill="#120e0d"/>
          <path d="M104,24 Q160,2 216,24 L224,44 L96,44 Z" fill="#3b2214" stroke="#180d07" stroke-width="4"/>
          <rect x="104" y="44" width="112" height="106" fill="#4f2f1c" stroke="#180d07" stroke-width="4"/>
          <circle cx="160" cy="96" r="42" fill="#c9a44c" stroke="#24150b" stroke-width="4"/>
          <circle cx="160" cy="96" r="36" fill="#f4ebd2" stroke="#594225" stroke-width="2"/>
          <text x="160" y="72" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="11" fill="#1f150e">XII</text>
          <text x="186" y="100" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="10" fill="#1f150e">III</text>
          <text x="160" y="128" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="10" fill="#1f150e">VI</text>
          <text x="134" y="100" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="10" fill="#1f150e">IX</text>
          <line x1="160" y1="96" x2="160" y2="70" stroke="#1c120d" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="160" y1="96" x2="160" y2="77" stroke="#7a1b1b" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="160" cy="96" r="3.5" fill="#1c120d"/>
          <rect x="114" y="150" width="92" height="102" fill="#422616" stroke="#180d07" stroke-width="4"/>
          <rect x="130" y="160" width="60" height="84" fill="#120e0d" stroke="#29170d" stroke-width="2"/>
          <g class="ci-pendulum">
            <line x1="160" y1="162" x2="160" y2="220" stroke="#c9a44c" stroke-width="3"/>
            <circle cx="160" cy="224" r="13" fill="#e6c163" stroke="#59411b" stroke-width="2.5"/>
          </g>
        </svg>`;
    }

    if (entry.omenId === "om_past_traveler") {
      return `
        <svg viewBox="0 0 320 260" class="ci-focus-svg">
          <rect width="320" height="260" fill="#241913"/>
          <line x1="0" y1="65" x2="320" y2="65" stroke="#140d09" stroke-width="3"/>
          <line x1="0" y1="130" x2="320" y2="130" stroke="#140d09" stroke-width="3"/>
          <line x1="0" y1="195" x2="320" y2="195" stroke="#140d09" stroke-width="3"/>
          <text x="160" y="64" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="34" fill="#d9ceba" opacity="0.82" transform="rotate(-4 160 64)">Help us</text>
          <path d="M108,162 C102,118 126,92 160,92 C194,92 218,118 212,162 C208,184 194,192 190,208 L190,228 L130,228 L130,208 C126,192 112,184 108,162 Z" fill="#dfd4bc" stroke="#18120d" stroke-width="4"/>
          <ellipse cx="138" cy="154" rx="16" ry="19" fill="#140f0c"/>
          <ellipse cx="182" cy="154" rx="16" ry="19" fill="#140f0c"/>
          <path d="M160,168 L151,188 L169,188 Z" fill="#140f0c"/>
          <line x1="142" y1="208" x2="142" y2="228" stroke="#18120d" stroke-width="3"/>
          <line x1="154" y1="208" x2="154" y2="228" stroke="#18120d" stroke-width="3"/>
          <line x1="166" y1="208" x2="166" y2="228" stroke="#18120d" stroke-width="3"/>
          <line x1="178" y1="208" x2="178" y2="228" stroke="#18120d" stroke-width="3"/>
        </svg>`;
    }

    if (entry.omenId === "om_paranormal_alt") {
      return `
        <svg viewBox="0 0 320 260" class="ci-focus-svg">
          <rect width="320" height="260" fill="#211b19"/>
          <path d="M50,0 Q66,130 46,260 M115,0 Q130,130 108,260 M180,0 Q198,130 176,260 M245,0 Q262,130 240,260" stroke="#362c28" stroke-width="10" fill="none" opacity="0.5"/>
          <ellipse cx="160" cy="232" rx="68" ry="12" fill="rgba(0,0,0,0.65)"/>
          <g class="ci-float-chair" transform="translate(160,126) rotate(-16)">
            <rect x="-42" y="-76" width="10" height="58" fill="#593620" stroke="#1c1009" stroke-width="3"/>
            <rect x="32" y="-76" width="10" height="58" fill="#593620" stroke="#1c1009" stroke-width="3"/>
            <rect x="-50" y="-22" width="100" height="16" fill="#784a2d" stroke="#1c1009" stroke-width="3.5"/>
            <ellipse cx="0" cy="36" rx="42" ry="46" fill="#4f2f1c" stroke="#1c1009" stroke-width="4"/>
            <ellipse cx="0" cy="36" rx="28" ry="32" fill="#29180f" stroke="#784a2d" stroke-width="2"/>
            <line x1="-12" y1="6" x2="-12" y2="66" stroke="#784a2d" stroke-width="3"/>
            <line x1="0" y1="4" x2="0" y2="68" stroke="#784a2d" stroke-width="3"/>
            <line x1="12" y1="6" x2="12" y2="66" stroke="#784a2d" stroke-width="3"/>
          </g>
        </svg>`;
    }

    // CHICKEN DECOR — Diversified Close-Up Visuals (Wooden Figurine, Ceramic Plate, Wall Mural/Stencil!)
    const chDef = (room && ROOM_CHICKEN_STYLES[room.id]) || ROOM_CHICKEN_STYLES.dining_room;
    const chStyle = chDef.style;
    const bgSvg =
      chStyle === "wood_figurine"
        ? `<rect width="320" height="260" fill="#211812"/>
           <rect x="20" y="198" width="280" height="44" fill="#543520" stroke="#1a0f08" stroke-width="4"/>`
        : chStyle === "wall_plate"
          ? `<rect width="320" height="260" fill="#54493e"/>
             <circle cx="160" cy="130" r="108" fill="#efe7d4" stroke="#362c24" stroke-width="5"/>
             <circle cx="160" cy="130" r="94" fill="none" stroke="#3b5470" stroke-width="2.5" stroke-dasharray="6,4"/>`
          : `<rect width="320" height="260" fill="#473c33"/>
             <rect x="44" y="24" width="232" height="212" rx="10" fill="#52463b" stroke="#2c221b" stroke-width="4"/>`;

    const bodyCol = chStyle === "wood_figurine" ? "#7d4f2d" : chStyle === "wall_plate" ? "#2e4661" : "#261f1a";
    const wingCol = chStyle === "wood_figurine" ? "#9c673e" : chStyle === "wall_plate" ? "#4b698a" : "#4a3d33";

    return `
      <svg viewBox="0 0 320 260" class="ci-focus-svg">
        ${bgSvg}
        <path d="M126,118 C142,126 164,122 192,102 C214,88 232,96 240,108 C224,116 234,132 214,148 C196,170 166,182 134,178 C108,174 96,154 102,134 C106,124 116,118 126,118 Z" fill="${bodyCol}" stroke="#140e0a" stroke-width="3"/>
        <path d="M128,142 Q156,136 178,154 Q152,168 128,142 Z" fill="${wingCol}"/>
        <line x1="142" y1="178" x2="136" y2="202" stroke="#1c140e" stroke-width="4.5"/>
        <line x1="168" y1="178" x2="176" y2="202" stroke="#1c140e" stroke-width="4.5"/>
        <path d="M124,202 L148,202 M164,202 L188,202" stroke="#1c140e" stroke-width="4"/>
        ${
          headless
            ? `<path d="M104,132 L126,118 L116,138 Z" fill="#7a2420" stroke="#240808" stroke-width="2.5"/>
               <text x="160" y="74" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" fill="#7a1818">HEADLESS — FAKE CLUE!</text>`
            : `<path d="M102,134 C96,114 98,92 110,84 C122,78 134,88 132,104 C130,114 134,122 136,126 Z" fill="${bodyCol}" stroke="#140e0a" stroke-width="3"/>
               <path d="M104,84 C100,72 110,66 116,74 C122,64 134,70 130,84 Z" fill="#a82d2d" stroke="#420d0d" stroke-width="2"/>
               <path d="M98,96 L80,103 L99,109 Z" fill="#d99a2e" stroke="#472d0b" stroke-width="2"/>
               <circle cx="112" cy="96" r="3" fill="#f4ebd4"/>`
        }
      </svg>`;
  }

  function openInspectModal(clueInspect, matchState) {
    if (!clueInspect || !clueInspect.entry) return;
    const { entry, room } = clueInspect;

    const modal = document.getElementById("clue-inspect-modal");
    const titleEl = document.getElementById("clue-modal-title");
    const subEl = document.getElementById("clue-modal-subtitle");
    const artEl = document.getElementById("clue-modal-art");
    const noteEl = document.getElementById("clue-modal-note");
    if (!modal || !artEl) return;

    const headless = Boolean(
      entry.isFakeChicken &&
      matchState &&
      matchState.clueManifest &&
      matchState.clueManifest.fakeChickenHeadless
    );

    const roomLabel = (room && (room.fullName || room.name)) || "CABIN ROOM";

    if (entry.omenId === "om_chalk_grid") {
      if (titleEl) titleEl.textContent = `${entry.surfaceLabel} — "${entry.symbol}"`;
      if (subEl) subEl.textContent = `TIC-TAC-TOE CLUE (${roomLabel})`;
      if (noteEl) noteEl.textContent = `${entry.surfaceDesc} Count all 5 rooms' symbols to find whether WINNING X or WINNING O appears 3 times.`;
    } else if (entry.omenId === "om_grandfather_clock") {
      if (titleEl) titleEl.textContent = "THE GRANDFATHER CLOCK";
      if (subEl) subEl.textContent = `CLUE MANIFESTATION (${roomLabel})`;
      if (noteEl) noteEl.textContent = "A mahogany grandfather clock stands flush against the wall, its hands frozen on XII as a hollow chime echoes through the cabin.";
    } else if (entry.omenId === "om_past_traveler") {
      if (titleEl) titleEl.textContent = "EVIDENCE OF A PAST PLAYER";
      if (subEl) subEl.textContent = `CLUE MANIFESTATION (${roomLabel})`;
      if (noteEl) noteEl.textContent = "Weathered skeletal remains tucked beside faint charcoal writing: 'Help us'. Someone before you never made it to midnight.";
    } else if (entry.omenId === "om_paranormal_alt") {
      if (titleEl) titleEl.textContent = "PARANORMAL ALTERATION";
      if (subEl) subEl.textContent = `CLUE MANIFESTATION (${roomLabel})`;
      if (noteEl) noteEl.textContent = "An antique wooden chair hovers upside-down quietly in the corner while the wallpaper behind it bends unnaturally.";
    } else if (entry.omenId === "om_rooster_decor") {
      const chDef = (room && ROOM_CHICKEN_STYLES[room.id]) || ROOM_CHICKEN_STYLES.dining_room;
      if (titleEl) titleEl.textContent = headless ? `HEADLESS ${chDef.label} (FAKE!)` : chDef.label;
      if (subEl) subEl.textContent = `CHICKEN DECOR (${roomLabel})`;
      if (noteEl) {
        noteEl.textContent = headless
          ? "The rooster's head has snapped cleanly off after the 3rd clue was revealed! This Chicken Decor is a FAKE DECOY — mark X on Chicken Decor in your Book [B]!"
          : `${chDef.desc} Beware: a fake chicken will lose its head once the 3rd and final clue is revealed.`;
      }
    }

    artEl.innerHTML = buildClueCloseUpSVG(entry, matchState, room);
    inspectOpen = true;
    modal.classList.remove("hidden");
    App.Audio.open();
  }

  function closeInspectModal(silent) {
    if (!inspectOpen) return;
    inspectOpen = false;
    document.getElementById("clue-inspect-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  // Used by special Progress bargains (The Thief / The Neighbor) to immediately reveal
  // 1 hidden true clue in an already-built room! Returns the revealed entry or null.
  function forceRevealOneClue(matchState) {
    if (!matchState || !matchState.clueManifest) return null;
    const manifest = matchState.clueManifest;
    const builtRoomIds = new Set(Object.values(matchState.roomMap || {}).map((r) => r.id));
    const candidates = manifest.entries.filter(
      (e) => !e.revealed && e.isTrueClue && builtRoomIds.has(e.roomId)
    );
    if (!candidates.length) return null;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    picked.revealed = true;
    if (picked.omenId === "om_chalk_grid") {
      const revTtt = manifest.entries.filter((e) => e.omenId === "om_chalk_grid" && e.revealed);
      const xCnt = revTtt.filter((e) => e.symbol === "X").length;
      const oCnt = revTtt.filter((e) => e.symbol === "O").length;
      if (picked.isTrueClue && (xCnt >= 3 || oCnt >= 3) && !manifest.revealedTrueKeys.includes(picked.clueKey)) {
        manifest.revealedTrueKeys.push(picked.clueKey);
      }
    } else if (picked.isTrueClue && !manifest.revealedTrueKeys.includes(picked.clueKey)) {
      manifest.revealedTrueKeys.push(picked.clueKey);
    }
    if (picked.omenId === "om_grandfather_clock" && App.Audio && App.Audio.playGrandfatherClockClue) {
      App.Audio.playGrandfatherClockClue();
    }
    if (manifest.revealedTrueKeys.length >= 3 && !manifest.fakeChickenHeadless) {
      if (manifest.entries.some((e) => e.isFakeChicken)) {
        manifest.fakeChickenHeadless = true;
      }
    }
    return picked;
  }

  App.Clues = {
    initMatchClues,
    evaluateTopGraveyardClue,
    forceRevealOneClue,
    getRevealedEntriesForRoom,
    isRoomPaintingCorrupted,
    getClueLightPoints,
    renderRoomClues,
    renderRoomClueHighlights,
    getRoomClueInteractables,
    openInspectModal,
    closeInspectModal,
    isInspectOpen: () => inspectOpen
  };
})(window.Duskwood);
