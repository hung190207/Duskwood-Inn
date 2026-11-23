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

  // Grandfather Clock Clue NEVER spawns in The Dining Room!
  const GRANDFATHER_CLOCK_ROOMS = ALL_CANDIDATE_ROOMS.filter((r) => r !== "dining_room");

  // Paranormal Alteration in Hall I or Hall II warps & curves the entire corridor (image_433f9a.jpg)!
  const WARP_HALLWAY_IDS = new Set(["bp_hallway_1", "bp_hallway_2"]);

  // Rooms containing a dedicated wooden table/desk -> Past Player spawns as glowing Severed Hand + Hammer on Table!
  // Rooms NOT in this set -> Past Player spawns as Red Handwritten Wall Text ("Everyone is Dead" / "Help us")!
  const TABLE_ROOMS = new Set([
    "bp_study",
    "bp_living_room",
    "bp_kitchen",
    "bp_bedroom",
    "bp_furnace"
  ]);

  const RED_WALL_PHRASES = [
    ["Everyone", "is Dead"],
    ["Help us", ""],
    ["Don't look", "back"]
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
          roomId: pickSpawnRoom(GRANDFATHER_CLOCK_ROOMS),
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "past_player") {
        const ppRoom = pickSpawnRoom(ALL_CANDIDATE_ROOMS);
        const phrasePair = RED_WALL_PHRASES[Math.floor(Math.random() * RED_WALL_PHRASES.length)];
        entries.push({
          id: "clue_past_player",
          clueKey: "past_player",
          omenId: "om_past_traveler",
          roomId: ppRoom,
          wallPhrase: phrasePair,
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "corrupt_painting") {
        entries.push({
          id: "clue_corrupt_painting",
          clueKey: "corrupt_painting",
          omenId: "om_corrupt_painting",
          roomId: pickSpawnRoom(PAINTING_ROOMS),
          corruptVariantIdx: Math.random() < 0.5 ? 0 : 1,
          isTrueClue: true,
          revealed: false
        });
      } else if (clueKey === "paranormal_alt") {
        // Give Hall I / Hall II a healthy chance to showcase the Warped Hallway anomaly alongside floating objects!
        const paraRoom = Math.random() < 0.34
          ? pickSpawnRoom(["bp_hallway_1", "bp_hallway_2"])
          : pickSpawnRoom(ALL_CANDIDATE_ROOMS);
        entries.push({
          id: "clue_paranormal_alt",
          clueKey: "paranormal_alt",
          omenId: "om_paranormal_alt",
          roomId: paraRoom,
          paranormalVariant: WARP_HALLWAY_IDS.has(paraRoom) ? "warped_hallway" : "floating_chair",
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

  function isFinalClueRevealed(matchState) {
    return Boolean(
      matchState &&
      matchState.clueManifest &&
      Array.isArray(matchState.clueManifest.revealedTrueKeys) &&
      matchState.clueManifest.revealedTrueKeys.length >= 3
    );
  }

  // Returns true if ANY player in a Multiplayer match is actively holding a non-defective THE TRAITOR card!
  function isTraitorBlockingFinalClue(matchState) {
    if (!matchState || matchState.mode !== "MULTIPLAYER") return false;
    const map = matchState.heldRolesByPlayer;
    if (!map || typeof map !== "object") return false;
    return Object.values(map).some((r) => Boolean(r && r.hasTraitor && !r.traitorDefective));
  }

  // Checks if revealing `entry` right now would complete the 3rd (final) true clue while THE TRAITOR is held!
  // For Tic-Tac-Toe (X/O), specifically blocks the 3rd winning X or 3rd winning O when 2 other clues are already revealed!
  function isEntryBlockedByTraitor(entry, manifest, matchState) {
    if (!entry || !manifest || !entry.isTrueClue) return false;
    if (!isTraitorBlockingFinalClue(matchState)) return false;
    const revTrueCount = Array.isArray(manifest.revealedTrueKeys) ? manifest.revealedTrueKeys.length : 0;
    if (revTrueCount < 2) return false;
    if (manifest.revealedTrueKeys.includes(entry.clueKey)) return false;

    if (entry.omenId === "om_chalk_grid") {
      const winSym = entry.clueKey === "winning_x" ? "X" : "O";
      if (entry.symbol !== winSym) return false; // Losing symbols may still appear; ONLY block 3rd winning X/O!
      const revWinCnt = manifest.entries.filter(
        (x) => x.omenId === "om_chalk_grid" && x.revealed && x.symbol === winSym
      ).length;
      return revWinCnt >= 2;
    }

    // Any other single-room true clue would immediately become the 3rd revealed true clue -> BLOCK!
    return true;
  }

  // ==================== 2. TURN-END TOP GRAVEYARD CLUE CHECK ====================
  // Checks ONLY the TOP Clue Card currently on the Graveyard!
  // Smart Built-Room Re-binding: once the player has built >= 4 rooms (Dining + Cellar + 2+),
  // any matching unrevealed clue whose pre-rolled room hasn't been drawn yet automatically
  // binds into one of the player's built rooms so clues NEVER stay stuck invisible all match!
  function isMpClientNotHost(matchState) {
    return Boolean(
      matchState &&
      matchState.mode === "MULTIPLAYER" &&
      App.Network &&
      App.Network.isMultiplayerMatch &&
      App.Network.isMultiplayerMatch() &&
      !App.Network.isHost()
    );
  }

  function broadcastAuthoritativeClueSync(matchState, newlyRevealed) {
    if (!matchState || matchState.mode !== "MULTIPLAYER") return;
    if (!App.Network || !App.Network.isMultiplayerMatch || !App.Network.isMultiplayerMatch() || !App.Network.isHost()) return;
    const revOmenIds = Array.isArray(newlyRevealed) ? newlyRevealed.map((e) => e && e.omenId).filter(Boolean) : [];
    App.Network.sendGameAction("MP_CLUE_SYNC", {
      clueManifest: matchState.clueManifest || null,
      sanctuaryRoomId: matchState.sanctuaryRoomId || "",
      sanctuaryClueKeys: Array.isArray(matchState.sanctuaryClueKeys) ? matchState.sanctuaryClueKeys.slice() : [],
      newlyRevealedOmenIds: revOmenIds
    });
  }

  function applyNetworkClueSync(payload, matchState) {
    if (!payload || !matchState) return;
    if (payload.clueManifest) {
      // Deep-clone so references stay clean
      matchState.clueManifest = JSON.parse(JSON.stringify(payload.clueManifest));
    }
    if (payload.sanctuaryRoomId) matchState.sanctuaryRoomId = payload.sanctuaryRoomId;
    if (Array.isArray(payload.sanctuaryClueKeys)) matchState.sanctuaryClueKeys = payload.sanctuaryClueKeys.slice();
    if (Array.isArray(payload.newlyRevealedOmenIds) && payload.newlyRevealedOmenIds.includes("om_grandfather_clock")) {
      if (App.Audio && App.Audio.playGrandfatherClockClue) App.Audio.playGrandfatherClockClue();
    }
  }

  function evaluateTopGraveyardClue(matchState) {
    if (!matchState || !matchState.clueManifest || !matchState.activeOmenId) return [];
    // MULTIPLAYER: ONLY Host evaluates & re-binds clue rooms so every player sees the EXACT same clues in the EXACT same rooms!
    if (isMpClientNotHost(matchState)) return [];
    const topOmenId = matchState.activeOmenId;
    const manifest = matchState.clueManifest;
    const builtRoomIds = new Set(Object.values(matchState.roomMap || {}).map((r) => r.id));
    const builtNonCellar = Array.from(builtRoomIds).filter((id) => id !== "bp_cellar");

    const matching = manifest.entries.filter(
      (e) => e.omenId === topOmenId && !e.revealed && !isEntryBlockedByTraitor(e, manifest, matchState)
    );

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
            : topOmenId === "om_grandfather_clock"
              ? builtNonCellar.filter((rid) => rid !== "dining_room")
              : builtNonCellar.slice();
          if (!pool.length) return;
          const unoccupied = pool.filter((rid) => !occupiedClueRooms.has(rid));
          const pickPool = unoccupied.length ? unoccupied : pool;
          entry.roomId = pickPool[Math.floor(Math.random() * pickPool.length)];
          if (entry.omenId === "om_paranormal_alt") {
            entry.paranormalVariant = WARP_HALLWAY_IDS.has(entry.roomId) ? "warped_hallway" : "floating_chair";
          }
          occupiedClueRooms.add(entry.roomId);
        });
      }

      manifest.entries.forEach((entry) => {
        if (entry.omenId !== topOmenId) return;
        if (entry.revealed) return;
        if (isEntryBlockedByTraitor(entry, manifest, matchState)) return; // Blocked by THE TRAITOR!
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

    broadcastAuthoritativeClueSync(matchState, newlyRevealed);
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

  function getCorruptPaintingVariant(roomId, matchState) {
    const entry = getRevealedEntriesForRoom(roomId, matchState).find(
      (e) => e.omenId === "om_corrupt_painting"
    );
    if (entry && typeof entry.corruptVariantIdx === "number") {
      return entry.corruptVariantIdx;
    }
    return 0;
  }

  function isHallwayWarped(room, matchState) {
    if (!room || !WARP_HALLWAY_IDS.has(room.id)) return false;
    return getRevealedEntriesForRoom(room.id, matchState).some(
      (e) => e.omenId === "om_paranormal_alt"
    );
  }

  // ==================== 3. VERIFIED, ZERO-OVERLAP ROOM CLUE PLACEMENT ANCHORS ====================
  function getRoomTableTopAnchor(room) {
    const rid = room.id;
    const d = room.doors || {};

    if (rid === "bp_study") {
      return (d.N && d.S) ? { x: 61, y: 120, onTable: true } : { x: 105, y: 158, onTable: true };
    }
    if (rid === "bp_living_room") {
      if (!d.W) return { x: 75,  y: 124, onTable: true };
      if (!d.N) return { x: 104, y: 97,  onTable: true };
      if (!d.E) return { x: 133, y: 124, onTable: true };
      return { x: 104, y: 139, onTable: true };
    }
    if (rid === "bp_kitchen") {
      if (d.N && d.E) return { x: 168, y: 147, onTable: true };
      if (d.E && d.S) return { x: 170, y: 143, onTable: true };
      if (d.S && d.W) return { x: 38,  y: 143, onTable: true };
      return { x: 38, y: 147, onTable: true };
    }
    if (rid === "bp_bedroom") {
      if (d.N && d.E) return { x: 166, y: 149, onTable: true };
      if (d.E && d.S) return { x: 166, y: 145, onTable: true };
      if (d.S && d.W) return { x: 38,  y: 145, onTable: true };
      return { x: 38, y: 149, onTable: true };
    }
    if (rid === "bp_furnace") {
      if (d.N) return { x: 143, y: 73,  onTable: true };
      if (d.S) return { x: 66,  y: 155, onTable: true };
      return { x: 112, y: 87, onTable: true };
    }
    return null;
  }

  // Verified bare wall coordinates for Black Chicken Decor & Red Wall Writing (ZERO furniture overlap!)
  function getBareWallAnchor(room, kind) {
    const rid = room.id;
    const d = room.doors || {};

    if (rid === "dining_room") {
      // Bare wallpaper strip right of Piano (152..176) on North wall (x: 177..193, y: 16..46)
      return { x: 185, y: 26, isWall: true, compactWall: true, interactY: 58 };
    }

    if (rid === "bp_bathroom") {
      const isVert = d.N || d.S;
      if (isVert) {
        if (d.N) {
          // Door 92..116, Switch 80..85 (y:34..41), MedCab 116..128 (y:20..34) -> Clear upper-left wall!
          return { x: 83, y: 24, isWall: true, compactWall: true, interactY: 58 };
        }
        // d.S: MedCab 80..92, Mirror 110..126 -> Clear center wall (94..109)!
        return { x: 101, y: 27, isWall: true, compactWall: true, interactY: 58 };
      }
      // Horizontal Bathroom: Switch 34..39, Mirror 96..112, MedCab 146..158 -> Wide open tile wall!
      return kind === "past_wall"
        ? { x: 176, y: 76, isWall: true, interactY: 102 }
        : { x: 68,  y: 76, isWall: true, interactY: 102 };
    }

    if (rid === "bp_furnace") {
      const isVert = d.N || d.S;
      if (isVert) {
        if (d.N) {
          // Door 92..116, Breaker 64..76, Switch 80..85 -> Clear North-right brick wall!
          return { x: 126, y: 27, isWall: true, interactY: 58 };
        }
        // d.S: Pipe y:22..25, Furnace 88..120 -> Clear lower-left brick wall below pipe!
        return { x: 63, y: 37, isWall: true, interactY: 58 };
      }
      // Horizontal Furnace: Pipe y:54..57, Switch 138..143 -> Clear right brick wall below pipe!
      return { x: 168, y: 69, isWall: true, interactY: 88 };
    }

    if (rid === "bp_kitchen") {
      // Clear of Fridge, Stove, Portrait & Light Switch in all 4 L-orientations!
      if (d.N && d.E) return { x: 83,  y: 28, isWall: true, interactY: 58 };
      if (d.E && d.S) return { x: 176, y: 60, isWall: true, interactY: 88 };
      if (d.S && d.W) return { x: 28,  y: 60, isWall: true, interactY: 88 };
      return { x: 125, y: 28, isWall: true, interactY: 58 };
    }

    if (rid === "bp_bedroom") {
      // Clear of Portrait, Wardrobe & Light Switch in all 4 L-orientations!
      if (d.N && d.E) return { x: 124, y: 24, isWall: true, interactY: 58 };
      if (d.E && d.S) return { x: 182, y: 60, isWall: true, interactY: 88 };
      if (d.S && d.W) return { x: 25,  y: 60, isWall: true, interactY: 88 };
      return { x: 76, y: 23, isWall: true, interactY: 58 };
    }

    if (rid === "bp_study") {
      const isVert = d.N && d.S;
      // Vertical Study: Door 92..116, Right Bookcase 134..158 -> Bare green wallpaper strip x:117..133!
      // Horizontal Study: Portrait 94..114, Right Bookcase 144..178 -> Bare wallpaper x:117..141!
      return isVert
        ? { x: 125, y: 29, isWall: true, compactWall: true, interactY: 58 }
        : { x: 129, y: 55, isWall: true, interactY: 84 };
    }

    if (rid === "bp_living_room") {
      // Static grandfather clock was removed -> wide bare wallpaper on North wall in all 4 orientations!
      if (!d.W) return { x: 64,  y: 29, isWall: true, interactY: 58 };
      if (!d.N) return { x: 156, y: 51, isWall: true, interactY: 78 };
      if (!d.E) return { x: 144, y: 29, isWall: true, interactY: 58 };
      return { x: 72, y: 29, isWall: true, interactY: 58 };
    }

    // Hallways (L-Hall, Straight I & II, T-Hall I & II)
    const hasHorizNorthWall = !d.N && (d.E || d.W);
    if (hasHorizNorthWall) {
      if (d.W && d.E) {
        // Horizontal Straight / T-Hall: sconces 62 & 146, portrait 95..113, switch 130 -> open wall 24..54 or 158..188
        return kind === "past_wall"
          ? { x: 170, y: 78, isWall: true, interactY: 110 }
          : { x: 40,  y: 78, isWall: true, interactY: 110 };
      }
      if (d.E) {
        // E + S (L-Hall): sconce 98, portrait 128..146, switch 163, sconce 176 -> clean gap 105..124!
        return { x: 114, y: 78, isWall: true, interactY: 110 };
      }
      // W + S (L-Hall): sconce 32, portrait 62..80, switch 97, sconce 110 -> clean gap 39..58!
      return { x: 49, y: 78, isWall: true, interactY: 110 };
    }
    if (d.E || d.W) {
      // North-connected L/T Hallway: sconce 133/75, switch 165/38, portrait 174/16 -> clean open gap 149 / 58!
      return d.E
        ? { x: 150, y: 78, isWall: true, interactY: 110 }
        : { x: 58,  y: 78, isWall: true, interactY: 110 };
    }
    // Pure vertical Straight Hallway (N & S doors only; x:78..130, door 92..116, sconce 84 y:30, switch 120 y:32)
    return { x: 123, y: 21, isWall: true, compactWall: true, interactY: 58 };
  }

  function getSafeClueAnchor(room, omenId) {
    const rid = room.id;
    const d = room.doors || {};

    // 1. PAST PLAYER ("Help us"):
    //    - Rooms WITH a table -> On top of the table (Severed Hand + Hammer, glowing!)
    //    - Rooms WITHOUT a table -> Bare wall (Crimson/Red handwritten text!)
    if (omenId === "om_past_traveler") {
      if (TABLE_ROOMS.has(rid)) {
        const tbl = getRoomTableTopAnchor(room);
        if (tbl) return tbl;
      }
      return getBareWallAnchor(room, "past_wall");
    }

    // 2. CHICKEN DECOR: Pure Black Rooster on bare wall (zero overlap with furniture!)
    if (omenId === "om_rooster_decor") {
      return getBareWallAnchor(room, "chicken");
    }

    // 3. GRANDFATHER CLOCK CLUE (NEVER spawns in dining_room; slender standing clock against closed wall!)
    if (omenId === "om_grandfather_clock") {
      if (rid === "bp_living_room") {
        if (!d.W) return { x: 62,  y: 56 };
        if (!d.N) return { x: 146, y: 76 };
        if (!d.E) return { x: 144, y: 56 };
        return { x: 68, y: 56 };
      }
      if (rid === "bp_study")     return (d.N && d.S) ? { x: 144, y: 86 } : { x: 44, y: 154 };
      if (rid === "bp_bathroom")  return (d.N || d.S) ? { x: 120, y: 84 } : { x: 48, y: 112 };
      if (rid === "bp_furnace")   return (d.N || d.S) ? { x: 144, y: 92 } : { x: 46, y: 146 };
      if (rid === "bp_kitchen" || rid === "bp_bedroom") return { x: d.W ? 140 : 68, y: d.S ? 104 : 144 };
      return { x: d.E ? 148 : d.W ? 60 : 90, y: 120 };
    }

    // 4. UNCHANGED CLUES: TIC-TAC-TOE (X/O) & PARANORMAL ALTERATION
    if (rid === "dining_room") {
      if (omenId === "om_chalk_grid")     return { x: 64,  y: 44, isWall: true, interactY: 58 };
      if (omenId === "om_paranormal_alt") return { x: 168, y: 170 };
      return { x: 36, y: 172 };
    }

    if (rid === "bp_study") {
      const isVert = d.N && d.S;
      if (omenId === "om_chalk_grid")     return isVert ? { x: 140, y: 166, easel: true } : { x: 160, y: 152, easel: true };
      if (omenId === "om_paranormal_alt") return isVert ? { x: 140, y: 138 } : { x: 44, y: 104 };
      return isVert ? { x: 64, y: 174 } : { x: 156, y: 156 };
    }

    if (rid === "bp_bathroom") {
      const isVert = d.N || d.S;
      if (omenId === "om_chalk_grid") {
        return isVert
          ? { x: d.N ? 82 : 118, y: 32, isWall: true, isMirror: true, interactY: 58 }
          : { x: 104, y: 78, isWall: true, isMirror: true, interactY: 102 };
      }
      if (omenId === "om_paranormal_alt") return isVert ? { x: 116, y: 138 } : { x: 138, y: 138 };
      return isVert ? { x: 88, y: 152 } : { x: 76, y: 138 };
    }

    if (rid === "bp_furnace") {
      const isVert = d.N || d.S;
      if (omenId === "om_chalk_grid") {
        return isVert
          ? { x: d.N ? 140 : 72, y: 32, isWall: true, interactY: 58 }
          : { x: 68, y: 60, isWall: true, interactY: 88 };
      }
      if (omenId === "om_paranormal_alt") return isVert ? { x: 140, y: 144 } : { x: 130, y: 146 };
      return isVert ? { x: 66, y: 168 } : { x: 58, y: 152 };
    }

    if (rid === "bp_kitchen" || rid === "bp_bedroom") {
      if (omenId === "om_chalk_grid") {
        if (d.N && d.E) return { x: 132, y: 32, isWall: true, interactY: 58 };
        if (d.E && d.S) return { x: 86,  y: 60, isWall: true, interactY: 88 };
        if (d.S && d.W) return { x: 38,  y: 60, isWall: true, interactY: 88 };
        return { x: 76, y: 32, isWall: true, interactY: 58 };
      }
      if (omenId === "om_paranormal_alt") return { x: d.E ? 168 : 40, y: 122 };
      return { x: d.E ? 164 : 42, y: 126 };
    }

    if (rid === "bp_living_room") {
      if (omenId === "om_chalk_grid") {
        return d.N ? { x: 78, y: 30, isWall: true, interactY: 58 } : { x: 104, y: 50, isWall: true, interactY: 78 };
      }
      if (omenId === "om_paranormal_alt") return { x: d.E ? 168 : 40, y: 148 };
      return { x: d.S ? 68 : 146, y: 158 };
    }

    const hasHoriz = !d.N && (d.E || d.W);
    if (omenId === "om_chalk_grid") {
      if (hasHoriz || d.E || d.W) return { x: d.E ? 148 : 60, y: 80, isWall: true, interactY: 110 };
      return { x: 86, y: 34, isWall: true, interactY: 58 };
    }
    if (omenId === "om_paranormal_alt") return { x: d.E ? 150 : d.W ? 58 : 114, y: 132 };
    return { x: d.E ? 156 : d.W ? 52 : 92, y: 138 };
  }

  // ==================== 4. CLEAR, AUTHENTIC IN-ROOM CLUE MODELS ====================
  // 4a. Smaller, Slimmer Grandfather Clock Clue (modeled after the classic Dining Room Grandfather Clock!)
  function drawGrandfatherClockModel(c, x, y, timeSec) {
    const cx = Math.round(x);
    const lx = cx - 5;       // 11px total max width (slender!)
    const ty = Math.round(y - 31); // 33px tall (compact & slim!)

    // Floor contact shadow
    c.fillStyle = "rgba(0, 0, 0, 0.44)";
    c.fillRect(lx - 1, ty + 32, 13, 3);

    // Ornate Stepped Crown & Brass Spire Finial
    px(c, cx, ty - 2, 1, 2, "#d9b45a");
    px(c, lx + 2, ty,     7,  2, "#24130a");
    px(c, lx + 3, ty,     5,  1, "#70442a");
    px(c, lx,     ty + 2, 11, 2, "#24130a");
    px(c, lx + 1, ty + 2, 9,  1, "#875536");

    // Slender Upper Clock Hood (9px wide)
    px(c, lx + 1, ty + 4, 9, 10, "#24130a");
    px(c, lx + 2, ty + 5, 7, 8,  "#593520");

    // Slim Mahogany Trunk (7px wide!)
    px(c, lx + 2, ty + 14, 7, 15, "#24130a");
    px(c, lx + 3, ty + 15, 5, 13, "#663d25");
    px(c, lx + 3, ty + 15, 1, 13, "#855435");

    // Small Stepped Plinth Base
    px(c, lx,     ty + 29, 11, 4, "#24130a");
    px(c, lx + 1, ty + 30, 9,  2, "#54321e");
    px(c, lx + 2, ty + 30, 7,  1, "#7d4e31");

    // Crisp Brass-Rimmed Ivory Clock Face (frozen at XII)
    fillPixelEllipse(c, cx, ty + 9, 3.5, 3.5, "#c9a44c");
    fillPixelEllipse(c, cx, ty + 9, 2.5, 2.5, "#f5ecd6");
    px(c, cx, ty + 7, 1, 3, "#1a120d");
    px(c, cx, ty + 9, 1, 1, "#9e2424");

    // Narrow Glass Pendulum Pane + Swinging Brass Pendulum
    px(c, lx + 4, ty + 16, 3, 11, "#120e0d");
    const swing = Math.round(Math.sin(timeSec * Math.PI) * 1.0);
    px(c, cx + swing, ty + 17, 1, 7, "#c9a44c");
    px(c, cx - 1 + swing, ty + 23, 2, 2, "#f2cf6b");
  }

  function drawArtistCanvasWithSymbol(c, x, y, symbol) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    c.fillStyle = "rgba(0,0,0,0.42)";
    c.fillRect(cx - 10, cy + 4, 20, 3);
    px(c, cx - 7, cy - 1, 2, 8, "#5e3a22");
    px(c, cx + 5, cy - 1, 2, 8, "#5e3a22");
    px(c, cx - 1, cy - 22, 2, 27, "#452916");
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
      px(c, cx - 8, cy - 9, 16, 18, "#241911");
      px(c, cx - 7, cy - 8, 14, 16, "#7a95a3");
      px(c, cx - 6, cy - 7, 12, 14, "#b4cad4");
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

    const isDarkInk = surfaceStyle === "wall_tile";
    const shadowCol = isDarkInk ? "rgba(245, 238, 220, 0.55)" : "rgba(14, 10, 8, 0.72)";
    const mainCol   = isDarkInk ? "#1f1916" : "#f5eedc";

    c.lineCap = "round";
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

  // 4b. PAST PLAYER FORM 1 (In Rooms WITH a Table): Severed Pale Hand + Wooden-Handled Iron Hammer (Matches image_42b895.jpg!)
  function drawPastPlayerBodyPart(c, x, y, timeSec) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const pulse = 0.65 + Math.sin(timeSec * 3.4) * 0.25;

    // Subtle glowing aura underneath the severed hand & hammer on the table (hơi phát sáng!)
    const g = c.createRadialGradient(cx, cy, 1, cx, cy, 13);
    g.addColorStop(0, `rgba(255, 232, 185, ${(0.34 * pulse).toFixed(3)})`);
    g.addColorStop(0.65, `rgba(225, 175, 130, ${(0.14 * pulse).toFixed(3)})`);
    g.addColorStop(1, "rgba(255, 210, 150, 0)");
    c.fillStyle = g;
    c.fillRect(cx - 13, cy - 13, 26, 26);

    // Cast shadows on tabletop
    c.fillStyle = "rgba(18, 10, 6, 0.44)";
    c.fillRect(cx - 7, cy - 2, 14, 6);

    // Wooden-handled Iron Hammer lying beside/under the fingers (matching image_42b895!)
    px(c, cx + 1, cy - 2, 2, 6, "#54321a"); // Wooden handle outline
    px(c, cx + 1, cy - 1, 2, 5, "#a66c3e"); // Wooden handle
    px(c, cx - 1, cy + 3, 7, 3, "#212429"); // Heavy iron hammer head outline
    px(c, cx,     cy + 4, 5, 2, "#636b75"); // Steel hammer head
    px(c, cx + 1, cy + 4, 3, 1, "#9aa4b0"); // Steel shine

    // Severed Pale Human Hand resting over the hammer handle (matching image_42b895!)
    px(c, cx - 7, cy - 4, 3, 4, "#6e1118"); // Dark crimson severed wrist stump!
    px(c, cx - 6, cy - 3, 2, 2, "#a81d28"); // Fresh crimson cross-section
    px(c, cx - 5, cy - 5, 6, 4, "#c9a690"); // Pale hand back / palm
    px(c, cx - 4, cy - 5, 4, 2, "#ebd2be"); // Lit knuckle highlight
    // Curled reaching fingers resting over hammer handle & pointing down
    px(c, cx + 1, cy - 4, 3, 2, "#e0bfa8"); // Forefinger/middle fingers arched right
    px(c, cx + 3, cy - 3, 2, 2, "#cfa891"); // Fingertips
    px(c, cx - 3, cy - 1, 2, 3, "#d9b49d"); // Curled thumb pointing downward
  }

  // 4c. PAST PLAYER FORM 2 (In Rooms WITHOUT a Table): Crimson/Red Handwritten Wall Text (Matches image_42bba1 & 42bbbd!)
  function drawPastPlayerRedWallText(c, x, y, phrasePair, compactWall) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const l1 = compactWall ? "HELP" : ((phrasePair && phrasePair[0]) || "Everyone");
    const l2 = compactWall ? "US"   : ((phrasePair && phrasePair[1]) || "is Dead");

    c.save();
    c.textAlign = "center";
    c.textBaseline = "middle";
    const fontSize = compactWall ? 5.2 : 5.6;
    c.font = `700 ${fontSize}px 'Pixelify Sans', monospace`;

    // Slight eerie crooked tilt + dark crimson shadow so red paint pops cleanly on every wall
    c.translate(cx, cy);
    c.rotate(-0.07);

    const drawLine = (txt, dy) => {
      if (!txt) return;
      c.fillStyle = "rgba(28, 4, 6, 0.72)";
      c.fillText(txt, 0.7, dy + 0.7);
      c.fillStyle = "#a8161e";
      c.fillText(txt, 0, dy);
      c.fillStyle = "#cc242c";
      c.fillText(txt, -0.3, dy - 0.2);
    };

    if (l2) {
      drawLine(l1, -3.4);
      drawLine(l2, 3.2);
    } else {
      drawLine(l1, 0);
    }

    // Subtle blood-red paint drips below letters
    c.fillStyle = "#8a1118";
    c.fillRect(-5, 5, 1, 2);
    c.fillRect(3, 4, 1, 3);
    c.restore();
  }

  function drawUpsideDownFloatingChair(c, x, y, timeSec) {
    const cx = Math.round(x);
    const hover = Math.round(Math.sin(timeSec * 2.5) * 2.4);
    const cy = Math.round(y) - 10 + hover;

    c.save();
    c.strokeStyle = "rgba(220, 210, 195, 0.36)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - 10, cy - 10); c.quadraticCurveTo(cx - 13, cy, cx - 9, cy + 10);
    c.moveTo(cx + 10, cy - 10); c.quadraticCurveTo(cx + 13, cy, cx + 9, cy + 10);
    c.stroke();
    c.restore();

    fillPixelEllipse(c, cx, Math.round(y) + 5, 10, 4, "rgba(0, 0, 0, 0.52)");

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

  // 4d. CHICKEN DECOR: Stark Black Rooster Silhouette Mounted Directly on the Wall (Matches image_42bbd8.jpg!)
  function drawChickenDecorModel(c, x, y, isHeadless) {
    const cx = Math.round(x);
    const cy = Math.round(y);

    // Faint wall-mounted relief shadow directly behind the black cutout
    c.fillStyle = "rgba(0, 0, 0, 0.30)";
    c.fillRect(cx - 5, cy - 2, 10, 6);

    const blackMain = "#0b0908";
    const blackHi   = "#24201c"; // Subtle matte charcoal edge highlight so silhouette reads on dark walls!

    // Plump arched rooster body (facing right, matching image_42bbd8.jpg!)
    px(c, cx - 4, cy - 2, 8, 5, blackMain);
    px(c, cx - 3, cy - 3, 6, 7, blackMain);
    // Faint charcoal feather cutout highlights inside body (like ornate wrought-iron/stencil decor!)
    px(c, cx - 2, cy - 1, 3, 1, blackHi);
    px(c, cx - 1, cy + 1, 3, 1, blackHi);

    // Tall fanned black rooster tail feathers curving up-left
    px(c, cx - 7, cy - 6, 3, 5, blackMain);
    px(c, cx - 6, cy - 7, 2, 4, blackMain);
    px(c, cx - 5, cy - 4, 2, 4, blackMain);
    px(c, cx - 6, cy - 5, 1, 2, blackHi);

    // Slender black rooster legs & claws perched on wallpaper
    px(c, cx - 2, cy + 4, 1, 3, blackMain);
    px(c, cx + 1, cy + 4, 1, 3, blackMain);
    px(c, cx - 3, cy + 7, 3, 1, blackMain);
    px(c, cx,     cy + 7, 3, 1, blackMain);

    if (!isHeadless) {
      // Proud upright black neck, head, scalloped comb & beak!
      px(c, cx + 2, cy - 6, 3, 5, blackMain);
      px(c, cx + 3, cy - 7, 3, 3, blackMain);
      // Black scalloped comb on crown (all black silhouette!)
      px(c, cx + 3, cy - 9, 1, 2, blackMain);
      px(c, cx + 5, cy - 9, 1, 2, blackMain);
      px(c, cx + 4, cy - 8, 2, 1, blackHi);
      // Sharp black beak pointing right
      px(c, cx + 6, cy - 6, 2, 1, blackMain);
      px(c, cx + 6, cy - 5, 1, 1, blackMain);
    } else {
      // Fake Chicken after 3rd clue revealed: head cleanly snapped/missing!
      px(c, cx + 2, cy - 3, 2, 2, "#3d1212");
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
      if (entry.omenId === "om_past_traveler" && pt.onTable) {
        // Severed Hand + Hammer on table gently glows in dim light so players notice it!
        pts.push({ x: pt.x, y: pt.y, r: 30, strength: 0.72 });
      } else {
        pts.push({ x: pt.x, y: pt.y - (entry.omenId === "om_grandfather_clock" ? 14 : 2), r: 24, strength: 0.56 });
      }
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
        if (pt.onTable) {
          drawPastPlayerBodyPart(ctx, pt.x, pt.y, timeSec);
        } else {
          drawPastPlayerRedWallText(ctx, pt.x, pt.y, entry.wallPhrase, Boolean(pt.compactWall));
        }
      } else if (entry.omenId === "om_paranormal_alt") {
        if (WARP_HALLWAY_IDS.has(room.id)) {
          for (let i = 0; i < 6; i++) {
            const mx = 84 + ((i * 19 + Math.floor(timeSec * 8)) % 40);
            const my = 72 + ((i * 23 + Math.floor(Math.sin(timeSec * 2 + i) * 6)) % 92);
            ctx.fillStyle = "rgba(235, 224, 200, 0.42)";
            ctx.fillRect(mx, my, 1, 1);
          }
        } else {
          drawUpsideDownFloatingChair(ctx, pt.x, pt.y, timeSec);
        }
      } else if (entry.omenId === "om_rooster_decor") {
        drawChickenDecorModel(ctx, pt.x, pt.y, Boolean(entry.isFakeChicken && headless));
      }
    });
  }

  function renderRoomClueHighlights(ctx, room, timeSec, matchState) {
    if (!room || !matchState || !matchState.clueManifest) return;
    const entries = getRevealedEntriesForRoom(room.id, matchState);
    if (!entries.length) return;

    entries.forEach((entry) => {
      if (entry.omenId === "om_corrupt_painting") {
        getCorruptPaintingCoords(room, matchState).forEach((p) => {
          px(ctx, p.x - 2, p.ry + 4, 1, 1, "#f2eee6");
          px(ctx, p.x + 2, p.ry + 4, 1, 1, "#f2eee6");
        });
        return;
      }
      const pt = getSafeClueAnchor(room, entry.omenId);
      if (entry.omenId === "om_past_traveler" && pt.onTable) {
        // Gentle luminous highlight on the severed hand & hammer resting on the table!
        const pulse = 0.70 + Math.sin(timeSec * 3.4) * 0.25;
        const g = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 18);
        g.addColorStop(0, `rgba(255, 240, 200, ${(0.34 * pulse).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(245, 205, 155, ${(0.14 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(255, 224, 175, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(pt.x - 18, pt.y - 18, 36, 36);
        return;
      }
      const gy = pt.y - (entry.omenId === "om_grandfather_clock" ? 14 : 2);
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
      if (entry.omenId === "om_corrupt_painting") return;
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
          x: ix, y: iy, r: 24,
          prompt: pt.onTable ? "[E] INSPECT SEVERED HAND" : "[E] INSPECT WALL WRITING",
          clueInspect: { entry, room, isBodyPart: Boolean(pt.onTable) }
        });
      } else if (entry.omenId === "om_paranormal_alt") {
        if (WARP_HALLWAY_IDS.has(room.id)) {
          list.push({
            id: "clue_inspect_para",
            x: 104, y: 126, r: 34,
            prompt: "[E] INSPECT WARPED HALLWAY",
            clueInspect: { entry, room, isWarpedHallway: true }
          });
        } else {
          list.push({
            id: "clue_inspect_para",
            x: ix, y: iy, r: 20,
            prompt: "[E] INSPECT CHAIR",
            clueInspect: { entry, room }
          });
        }
      } else if (entry.omenId === "om_rooster_decor") {
        list.push({
          id: "clue_inspect_chicken",
          x: ix, y: iy, r: 24,
          prompt: "[E] INSPECT CHICKEN DECOR",
          clueInspect: { entry, room }
        });
      }
    });

    return list;
  }

  // ==================== 6. FOCUSED CLOSE-UP INSPECTION MODAL ====================
  function buildClueCloseUpSVG(entry, matchState, room, isBodyPart) {
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
      // Slim, slender antique grandfather clock close-up
      return `
        <svg viewBox="0 0 320 260" class="ci-focus-svg">
          <rect width="320" height="260" fill="#120e0d"/>
          <path d="M122,22 Q160,4 198,22 L204,40 L116,40 Z" fill="#3b2214" stroke="#180d07" stroke-width="3.5"/>
          <rect x="122" y="40" width="76" height="82" fill="#4f2f1c" stroke="#180d07" stroke-width="3.5"/>
          <circle cx="160" cy="81" r="30" fill="#c9a44c" stroke="#24150b" stroke-width="3.5"/>
          <circle cx="160" cy="81" r="25" fill="#f4ebd2" stroke="#594225" stroke-width="1.8"/>
          <text x="160" y="65" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-weight="700" font-size="9" fill="#1f150e">XII</text>
          <text x="178" y="84" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-weight="700" font-size="8" fill="#1f150e">III</text>
          <text x="160" y="103" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-weight="700" font-size="8" fill="#1f150e">VI</text>
          <text x="142" y="84" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-weight="700" font-size="8" fill="#1f150e">IX</text>
          <line x1="160" y1="81" x2="160" y2="62" stroke="#1c120d" stroke-width="3" stroke-linecap="round"/>
          <line x1="160" y1="81" x2="160" y2="67" stroke="#7a1b1b" stroke-width="2" stroke-linecap="round"/>
          <circle cx="160" cy="81" r="2.8" fill="#1c120d"/>
          <rect x="128" y="122" width="64" height="114" fill="#422616" stroke="#180d07" stroke-width="3.5"/>
          <rect x="140" y="132" width="40" height="94" fill="#120e0d" stroke="#29170d" stroke-width="2"/>
          <g class="ci-pendulum">
            <line x1="160" y1="136" x2="160" y2="202" stroke="#c9a44c" stroke-width="2.5"/>
            <circle cx="160" cy="206" r="10" fill="#e6c163" stroke="#59411b" stroke-width="2.2"/>
          </g>
          <rect x="116" y="236" width="88" height="18" fill="#3b2214" stroke="#180d07" stroke-width="3.5"/>
        </svg>`;
    }

    if (entry.omenId === "om_past_traveler") {
      if (isBodyPart) {
        // FORM 1 CLOSE-UP: Severed Pale Hand + Wooden-Handled Iron Hammer on Tabletop (Matches image_42b895.jpg!)
        return `
          <svg viewBox="0 0 320 260" class="ci-focus-svg">
            <defs>
              <radialGradient id="handGlow" cx="50%" cy="50%" r="48%">
                <stop offset="0%" stop-color="rgba(255,232,188,0.44)"/>
                <stop offset="100%" stop-color="rgba(255,210,145,0)"/>
              </radialGradient>
            </defs>
            <!-- Aged patterned tabletop surface & wall corner -->
            <rect width="320" height="260" fill="#5e4a34"/>
            <polygon points="0,84 156,36 320,96 320,260 0,260" fill="#d9cca8" stroke="#2e2115" stroke-width="5"/>
            <ellipse cx="160" cy="144" rx="115" ry="78" fill="url(#handGlow)"/>
            <!-- Cast shadow beneath hand & hammer -->
            <ellipse cx="152" cy="154" rx="76" ry="38" fill="rgba(28,18,10,0.34)"/>
            <!-- Wooden-Handled Iron Hammer resting right under/beside the severed hand -->
            <g transform="translate(158, 134) rotate(-6)">
              <rect x="-8" y="-32" width="17" height="72" rx="3" fill="#9c633b" stroke="#361e0f" stroke-width="2.6"/>
              <line x1="-2" y1="-28" x2="-2" y2="36" stroke="#b87c4f" stroke-width="2" opacity="0.6"/>
              <polygon points="-38,34 38,34 44,48 34,62 -36,62 -44,48" fill="#4f4844" stroke="#1f1b19" stroke-width="3"/>
              <polygon points="-34,37 34,37 38,46 -34,46" fill="#736a64"/>
            </g>
            <!-- Pale Severed Human Hand with bloody wrist cross-section reaching over the hammer handle -->
            <g transform="translate(132, 106)">
              <!-- Severed crimson wrist cross-section -->
              <ellipse cx="-26" cy="4" rx="10" ry="15" fill="#6b0d14" stroke="#2e0608" stroke-width="2.2"/>
              <ellipse cx="-25" cy="4" rx="6" ry="10" fill="#9e1922"/>
              <circle cx="-25" cy="4" r="2.6" fill="#e6d6c3"/>
              <!-- Back of pale hand & arched fingers gripping the top of the hammer handle -->
              <path d="M-24,-10 C-6,-18 14,-18 32,-12 C48,-6 60,4 64,14 C65,18 58,20 53,15 C46,7 36,2 24,0 C12,0 2,8 6,20 C9,28 15,34 12,38 C8,42 -2,36 -10,25 C-16,18 -20,16 -24,14 Z" fill="#dfc1aa" stroke="#472d1f" stroke-width="2.6"/>
              <!-- Extra curled fingers behind index -->
              <path d="M28,-10 C42,-4 52,5 56,15" fill="none" stroke="#855a44" stroke-width="1.8"/>
              <path d="M22,-6 C35,0 44,8 48,16" fill="none" stroke="#855a44" stroke-width="1.6"/>
              <path d="M-12,-4 C0,-10 14,-10 24,-6" fill="none" stroke="#f5e1cf" stroke-width="2.2" opacity="0.65"/>
            </g>
          </svg>`;
      }

      // FORM 2 CLOSE-UP: Blood-Red Handwritten Wall Text (Matches image_42bba1 & image_42bbbd!)
      const p1 = (entry.wallPhrase && entry.wallPhrase[0]) || "Everyone";
      const p2 = (entry.wallPhrase && entry.wallPhrase[1]) || "is Dead";
      return `
        <svg viewBox="0 0 320 260" class="ci-focus-svg">
          <rect width="320" height="260" fill="#4f463c"/>
          <g fill="#5b5146" opacity="0.5">
            <rect x="20" y="0" width="26" height="260"/><rect x="82" y="0" width="26" height="260"/>
            <rect x="144" y="0" width="26" height="260"/><rect x="206" y="0" width="26" height="260"/>
            <rect x="268" y="0" width="26" height="260"/>
          </g>
          <rect x="0" y="204" width="320" height="10" fill="#3b2f24"/>
          <rect x="0" y="214" width="320" height="46" fill="#2e231a"/>
          <!-- Scrawled crimson wall handwriting -->
          <g transform="rotate(-4 160 112)">
            <text x="160" y="96" text-anchor="middle" font-family="'Pixelify Sans', Georgia, serif" font-style="italic" font-weight="700" font-size="44" fill="#8f141c" stroke="#360508" stroke-width="1.2">${p1}</text>
            ${p2 ? `<text x="166" y="152" text-anchor="middle" font-family="'Pixelify Sans', Georgia, serif" font-style="italic" font-weight="700" font-size="44" fill="#8f141c" stroke="#360508" stroke-width="1.2">${p2}</text>` : ""}
          </g>
          <!-- Subtle dripping red paint streaks -->
          <path d="M98,108 L98,128 M172,158 L172,184 M224,104 L224,122" stroke="#7a1017" stroke-width="2.5" stroke-linecap="round" opacity="0.72"/>
        </svg>`;
    }

    if (entry.omenId === "om_paranormal_alt") {
      if (room && WARP_HALLWAY_IDS.has(room.id)) {
        return `
          <svg viewBox="0 0 320 260" class="ci-focus-svg">
            <defs>
              <radialGradient id="sconceL" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,244,212,0.88)"/>
                <stop offset="55%" stop-color="rgba(240,222,184,0.28)"/>
                <stop offset="100%" stop-color="rgba(240,222,184,0)"/>
              </radialGradient>
              <radialGradient id="sconceR" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(255,246,216,0.92)"/>
                <stop offset="55%" stop-color="rgba(240,222,184,0.32)"/>
                <stop offset="100%" stop-color="rgba(240,222,184,0)"/>
              </radialGradient>
            </defs>
            <rect width="320" height="260" fill="#5e5548"/>
            <polygon points="0,0 320,0 245,76 80,76" fill="#786e60"/>
            <path d="M52,260 C72,218 118,202 128,176 L196,176 C206,204 238,224 256,260 Z" fill="#544232"/>
            <rect x="134" y="88" width="32" height="62" fill="#c9c2b2" stroke="#453d34" stroke-width="3"/>
            <g stroke="#6b6257" stroke-width="1.5">
              <line x1="136" y1="96" x2="164" y2="96"/><line x1="136" y1="104" x2="164" y2="104"/>
              <line x1="136" y1="112" x2="164" y2="112"/><line x1="136" y1="120" x2="164" y2="120"/>
              <line x1="136" y1="128" x2="164" y2="128"/><line x1="136" y1="136" x2="164" y2="136"/>
              <line x1="136" y1="144" x2="164" y2="144"/>
            </g>
            <path d="M0,0 L48,0 C74,48 96,52 126,64 L126,184 C96,196 68,218 52,260 L0,260 Z" fill="#706657"/>
            <path d="M48,0 C74,48 96,52 126,64 L126,74 C94,62 70,56 44,6 Z" fill="#cfc7b8" stroke="#4a4238" stroke-width="1.5"/>
            <path d="M52,260 C68,218 96,196 126,184 L126,193 C98,204 72,226 58,260 Z" fill="#c7bfb0" stroke="#4a4238" stroke-width="1.4"/>
            <path d="M320,0 L248,0 C226,46 210,60 184,72 L184,178 C210,192 232,216 254,260 L320,260 Z" fill="#635a4c"/>
            <path d="M248,0 C226,46 210,60 184,72 L184,81 C212,68 230,52 254,6 Z" fill="#c9c0b0" stroke="#453d34" stroke-width="1.5"/>
            <path d="M254,260 C232,216 210,192 184,178 L184,187 C208,200 228,224 248,260 Z" fill="#bfb7a8" stroke="#453d34" stroke-width="1.4"/>
            <ellipse cx="104" cy="118" rx="34" ry="40" fill="url(#sconceL)"/>
            <path d="M100,114 L108,114 L110,126 L98,126 Z" fill="#fff7dc" stroke="#85755e" stroke-width="1"/>
            <path d="M104,126 L104,136 C104,140 97,140 97,134" fill="none" stroke="#4f4335" stroke-width="2"/>
            <ellipse cx="268" cy="126" rx="46" ry="52" fill="url(#sconceR)"/>
            <path d="M260,112 L276,112 L280,132 L256,132 Z" fill="#fff9e2" stroke="#8c7b62" stroke-width="1.2"/>
            <path d="M268,132 L268,148 C268,154 256,154 256,144" fill="none" stroke="#4f4335" stroke-width="2.5"/>
          </svg>`;
      }
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

    // CHICKEN DECOR CLOSE-UP: Pure Black Rooster Silhouette on Patterned Cabin Wallpaper (Matches image_42bbd8.jpg!)
    return `
      <svg viewBox="0 0 320 260" class="ci-focus-svg">
        <rect width="320" height="260" fill="#8c7a5b"/>
        <!-- Vintage cabin floral/striped wallpaper pattern -->
        <g fill="#756448" opacity="0.45">
          <rect x="24" y="0" width="24" height="260"/><rect x="88" y="0" width="24" height="260"/>
          <rect x="152" y="0" width="24" height="260"/><rect x="216" y="0" width="24" height="260"/>
          <rect x="280" y="0" width="24" height="260"/>
        </g>
        <!-- Soft drop shadow behind black wall silhouette -->
        <g transform="translate(5, 5)" opacity="0.28">
          <path d="M190,118 C172,126 148,122 118,100 C96,84 78,94 72,108 C88,116 78,132 100,150 C118,172 150,184 182,180 C208,176 220,156 214,134 C210,124 200,118 190,118 Z" fill="#000000"/>
        </g>
        <!-- Stark Black Wall Rooster Silhouette facing right (matching image_42bbd8.jpg!) -->
        <path d="M190,118 C172,126 148,122 118,100 C96,84 78,94 72,108 C88,116 78,132 100,150 C118,172 150,184 182,180 C208,176 220,156 214,134 C210,124 200,118 190,118 Z" fill="#0d0b0a" stroke="#050404" stroke-width="2.5"/>
        <!-- Ornate feather cutout slits on black metal/wood decor -->
        <path d="M138,144 Q162,138 182,154 M144,156 Q166,152 180,164" fill="none" stroke="#8c7a5b" stroke-width="2" opacity="0.55"/>
        <!-- Legs & claws -->
        <line x1="146" y1="178" x2="140" y2="206" stroke="#0d0b0a" stroke-width="5" stroke-linecap="round"/>
        <line x1="174" y1="178" x2="182" y2="206" stroke="#0d0b0a" stroke-width="5" stroke-linecap="round"/>
        <path d="M126,206 L152,206 M168,206 L194,206" stroke="#0d0b0a" stroke-width="4.5" stroke-linecap="round"/>
        ${
          headless
            ? `<path d="M192,118 L212,132 L198,138 Z" fill="#5e1414"/>
               <text x="160" y="62" text-anchor="middle" font-family="'Pixelify Sans', monospace" font-weight="700" font-size="16" fill="#6b1010">HEADLESS — FAKE CLUE!</text>`
            : `<path d="M214,134 C220,112 218,90 206,82 C194,76 182,86 184,104 C186,114 184,122 182,126 Z" fill="#0d0b0a"/>
               <path d="M210,82 C214,70 204,64 198,72 C192,62 180,68 184,82 Z" fill="#0d0b0a"/>
               <path d="M216,94 L234,101 L215,107 Z" fill="#0d0b0a"/>
               <circle cx="203" cy="95" r="2.6" fill="#8c7a5b"/>`
        }
      </svg>`;
  }

  function openInspectModal(clueInspect, matchState) {
    if (!clueInspect || !clueInspect.entry) return;
    const { entry, room, isBodyPart } = clueInspect;

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
      if (noteEl) noteEl.textContent = "A slender mahogany grandfather clock stands silently against the wall, its hands frozen on XII as a deep chime echoes through the cabin.";
    } else if (entry.omenId === "om_past_traveler") {
      if (isBodyPart) {
        if (titleEl) titleEl.textContent = "EVIDENCE OF A PAST PLAYER";
        if (subEl) subEl.textContent = `BODY PART ON TABLE (${roomLabel})`;
        if (noteEl) noteEl.textContent = "A pale severed hand rests faintly glowing atop the table right beside a heavy iron hammer. Someone before you never escaped.";
      } else {
        const phraseStr = (entry.wallPhrase || ["Everyone", "is Dead"]).filter(Boolean).join(" ");
        if (titleEl) titleEl.textContent = "EVIDENCE OF A PAST PLAYER";
        if (subEl) subEl.textContent = `RED WALL WRITING (${roomLabel})`;
        if (noteEl) noteEl.textContent = `Scrawled across the cabin wall in dark red: "${phraseStr}". Someone who stayed here before left a final warning behind.`;
      }
    } else if (entry.omenId === "om_paranormal_alt") {
      if (room && WARP_HALLWAY_IDS.has(room.id)) {
        if (titleEl) titleEl.textContent = "PARANORMAL ALTERATION — WARPED HALLWAY";
        if (subEl) subEl.textContent = `SPATIAL DISTORTION (${roomLabel})`;
        if (noteEl) noteEl.textContent = "The hallway walls, crown molding, and baseboards bulge and curve unnaturally into a wavy, non-Euclidean corridor while the sconces stay lit.";
      } else {
        if (titleEl) titleEl.textContent = "PARANORMAL ALTERATION";
        if (subEl) subEl.textContent = `CLUE MANIFESTATION (${roomLabel})`;
        if (noteEl) noteEl.textContent = "An antique wooden chair hovers upside-down quietly in the corner while the wallpaper behind it bends unnaturally.";
      }
    } else if (entry.omenId === "om_rooster_decor") {
      if (titleEl) titleEl.textContent = headless ? "HEADLESS CHICKEN DECOR (FAKE!)" : "BLACK CHICKEN DECOR";
      if (subEl) subEl.textContent = `WALL DECORATION (${roomLabel})`;
      if (noteEl) {
        noteEl.textContent = headless
          ? "The black rooster's head has vanished after the 3rd clue was revealed! This Chicken Decor is a FAKE DECOY — mark X on Chicken Decor in your Book [B]!"
          : "A stark black rooster silhouette mounted directly onto the cabin wall. Beware: a fake chicken will lose its head once the 3rd and final clue is revealed.";
      }
    }

    artEl.innerHTML = buildClueCloseUpSVG(entry, matchState, room, Boolean(isBodyPart));
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
    if (isMpClientNotHost(matchState)) return null;
    const manifest = matchState.clueManifest;
    const builtRoomIds = new Set(Object.values(matchState.roomMap || {}).map((r) => r.id));
    const candidates = manifest.entries.filter(
      (e) => !e.revealed && e.isTrueClue && builtRoomIds.has(e.roomId) && !isEntryBlockedByTraitor(e, manifest, matchState)
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
    broadcastAuthoritativeClueSync(matchState, [picked]);
    return picked;
  }

  App.Clues = {
    initMatchClues,
    evaluateTopGraveyardClue,
    forceRevealOneClue,
    broadcastAuthoritativeClueSync,
    applyNetworkClueSync,
    isFinalClueRevealed,
    isTraitorBlockingFinalClue,
    getRevealedEntriesForRoom,
    isRoomPaintingCorrupted,
    getCorruptPaintingVariant,
    isHallwayWarped,
    getClueLightPoints,
    renderRoomClues,
    renderRoomClueHighlights,
    getRoomClueInteractables,
    openInspectModal,
    closeInspectModal,
    isInspectOpen: () => inspectOpen
  };
})(window.Duskwood);
