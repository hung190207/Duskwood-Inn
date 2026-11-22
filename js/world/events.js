/* ==========================================================================
   DUSKWOOD INN - Event Cards, Monster Registry & Full Cutting Corners Engine
   - Maps each of the 9 Event Cards 1-to-1 to its Monster entity
   - Full Cutting Corners Delayed Event:
       1) Drawn -> Spawns player-lookalike NPC facing NE wall corner in Main Parlor.
       2) Once 5-6 total rooms (incl. Main Parlor & Cellar) exist -> Triggers Event!
       3) ALL cabin lights shut off; Corner Man twists head backward with glowing
          white eyes & wide grin; ragged black ink-smudge banner types letter-by-letter
          with audio/typing.mp3 (5s) + 10-second countdown to face ANY valid corner.
       4) Failing to face a valid corner in 10s -> Death (+1 HOUR penalty & Cellar respawn).
       5) After 10s in a corner -> Series of "FACE IT IF..." condition questions
          (Progress cards on table / Total rooms incl. Cellar / Events on table),
          typed with audio/typing.mp3 (5s). Turn around if TRUE; stay facing wall if FALSE!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const MONSTERS = {
    hollow_harvester: {
      id: "hollow_harvester",
      name: "THE HOLLOW HARVESTER",
      eventCardId: "hx_harvester",
      tag: "BOARD HUNTER",
      summary: "Emerges from beneath XII after 3 turns and stalks +30m per turn along the clock groove."
    },
    corner_man: {
      id: "corner_man",
      name: "THE CORNER MAN",
      eventCardId: "hx_corners",
      tag: "DELAYED DOPPELGANGER",
      summary: "Appears motionless in the corner of The Dining Room looking just like a survivor, face pressed into the wall."
    },
    attic_stalker: {
      id: "attic_stalker",
      name: "ATTIC STALKER",
      eventCardId: "hx_attic",
      tag: "ATTIC PREDATOR",
      summary: "Prowls the dark attic while survivors place 5 totems and light ritual candles. Avoid direct eye contact."
    },
    tall_man: {
      id: "tall_man",
      name: "THE TALL MAN",
      eventCardId: "hx_tall_stalker",
      tag: "LIGHT HUNTER",
      summary: "An eyeless towering figure that hunts any lit room or handheld lantern until every light switch is turned off."
    },
    balloon_stalker: {
      id: "balloon_stalker",
      name: "THE BALLOON STALKER",
      eventCardId: "hx_balloons",
      tag: "SOUND HUNTER",
      summary: "Drawn toward noise and every popping red balloon until the final golden balloon is burst."
    },
    the_knight: {
      id: "the_knight",
      name: "THE KNIGHT",
      eventCardId: "hx_knight",
      tag: "TURN-BASED STALKER",
      summary: "An armored entity advancing 1 room every dark phase while survivors rotate and move the statue."
    },
    ceiling_crawler: {
      id: "ceiling_crawler",
      name: "THE PUPPET",
      eventCardId: "hx_tiny_toys",
      tag: "MARIONETTE ENTITY",
      summary: "Hangs by taut marionette strings in The Dining Room and relentlessly hunts anyone who fails to load the Toy Train within 10 seconds."
    },
    giant_monkey: {
      id: "giant_monkey",
      name: "THE GIANT MONKEY",
      eventCardId: "hx_musical_rooms",
      tag: "DARKNESS HUNTER",
      summary: "Slumbers while carnival music plays, then tears through every unlit room the instant the music stops."
    },
    sparky: {
      id: "sparky",
      name: "CHAINSAW STALKER",
      eventCardId: "hx_cellar_breakers",
      tag: "BASEMENT ENTITY",
      summary: "A towering monster with a roaring chainsaw for a head patrolling the underground basement maze."
    },
    shadow_hunter: {
      id: "shadow_hunter",
      name: "THE SHADOW HUNTER",
      eventCardId: "hx_stay_lit",
      tag: "UMBRAL ENTITY",
      summary: "Lurks in every pocket of darkness, striking anyone who steps outside illuminated zones before time runs out."
    }
  };

  // North-East bare wall corner in The Dining Room (Main Parlor)
  const PARLOR_CORNER_ANCHOR = {
    x: 185,
    y: 59,
    collider: { x: 179, y: 52, w: 13, h: 10 }
  };

  // ==================== RAGGED INK-SMUDGE TYPEWRITER BANNER ====================
  let typeTimer = null;
  let bannerState = {
    visible: false,
    fullText: "",
    shownChars: 0,
    typingDone: true
  };

  function clearBannerTyping() {
    clearInterval(typeTimer);
    typeTimer = null;
  }

  function showSmudgeBanner(text, opts) {
    const options = opts || {};
    const banner = document.getElementById("event-smudge-banner");
    const textEl = document.getElementById("event-smudge-text");
    const countEl = document.getElementById("event-smudge-count");
    const choiceRow = document.getElementById("event-smudge-choices");
    const subTagEl = document.getElementById("event-smudge-subtag");
    if (!banner || !textEl) return;

    clearBannerTyping();
    bannerState.visible = true;
    bannerState.fullText = text || "";
    bannerState.shownChars = 0;
    bannerState.typingDone = false;

    banner.classList.remove("hidden");
    banner.classList.toggle("is-danger", Boolean(options.danger));
    banner.classList.toggle("is-success", Boolean(options.success));
    if (subTagEl) {
      subTagEl.textContent = options.subtag || "";
      subTagEl.classList.toggle("hidden", !options.subtag);
    }
    if (countEl) {
      if (typeof options.countdown === "number") {
        countEl.textContent = String(Math.ceil(options.countdown));
        countEl.classList.remove("hidden");
      } else {
        countEl.classList.add("hidden");
      }
    }
    if (choiceRow) {
      choiceRow.classList.toggle("hidden", !options.showChoices);
    }

    textEl.textContent = "";

    const totalLen = Math.max(1, bannerState.fullText.length);
    const typingAudioDur = typeof options.typingDurationSec === "number" ? options.typingDurationSec : 5.0;
    // Pace letter-by-letter reveal smoothly over ~2.2s..4.4s while typing.mp3 plays for 5.0s!
    const revealMs = Math.min(4400, Math.max(1600, totalLen * 56));
    const stepMs = Math.max(24, Math.floor(revealMs / totalLen));

    if (options.playTyping !== false && App.Audio && App.Audio.playTypingSfx) {
      App.Audio.playTypingSfx(typingAudioDur);
    }

    typeTimer = setInterval(() => {
      bannerState.shownChars += 1;
      textEl.textContent = bannerState.fullText.slice(0, bannerState.shownChars);
      if (bannerState.shownChars >= totalLen) {
        clearBannerTyping();
        bannerState.typingDone = true;
      }
    }, stepMs);
  }

  function updateBannerCountdown(seconds) {
    const countEl = document.getElementById("event-smudge-count");
    if (!countEl) return;
    if (typeof seconds === "number" && seconds > 0) {
      countEl.textContent = String(Math.ceil(seconds));
      countEl.classList.remove("hidden");
    } else {
      countEl.classList.add("hidden");
    }
  }

  function hideSmudgeBanner() {
    clearBannerTyping();
    bannerState.visible = false;
    if (App.Audio && App.Audio.stopTypingSfx) App.Audio.stopTypingSfx();
    document.getElementById("event-smudge-banner")?.classList.add("hidden");
    document.getElementById("event-smudge-choices")?.classList.add("hidden");
  }

  // ==================== MONSTER LOOKUP & PORTRAITS ====================
  function getMonsterById(id) {
    return MONSTERS[id] || null;
  }

  function getMonsterForCard(card) {
    if (!card || !card.meta || !card.meta.monsterId) return null;
    return MONSTERS[card.meta.monsterId] || null;
  }

  function getMonsterPortraitSVG(monsterId) {
    if (monsterId === "corner_man") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#16110e"/>
          <polygon points="0,0 32,0 32,64 0,64" fill="#261c15"/>
          <polygon points="32,0 64,0 64,64 32,64" fill="#1b140f"/>
          <line x1="32" y1="0" x2="32" y2="64" stroke="#0d0907" stroke-width="2"/>
          <ellipse cx="32" cy="54" rx="12" ry="4" fill="rgba(0,0,0,0.65)"/>
          <rect x="25" y="12" width="14" height="13" rx="3" fill="#2b1e16" stroke="#0d0907" stroke-width="1.6"/>
          <circle cx="29" cy="18" r="1.4" fill="#ffffff"/>
          <circle cx="35" cy="18" r="1.4" fill="#ffffff"/>
          <path d="M28,22 Q32,25 36,22" stroke="#ebe2cc" stroke-width="1.4" fill="none"/>
          <rect x="23" y="25" width="18" height="16" rx="2" fill="#525a4c" stroke="#0d0907" stroke-width="1.6"/>
          <rect x="19" y="26" width="4" height="14" fill="#464d41" stroke="#0d0907" stroke-width="1.3"/>
          <rect x="41" y="26" width="4" height="14" fill="#464d41" stroke="#0d0907" stroke-width="1.3"/>
          <rect x="25" y="41" width="6" height="12" fill="#3a4a61" stroke="#0d0907" stroke-width="1.4"/>
          <rect x="33" y="41" width="6" height="12" fill="#3a4a61" stroke="#0d0907" stroke-width="1.4"/>
        </svg>`;
    }
    if (monsterId === "tall_man") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#0d0a0c"/>
          <ellipse cx="32" cy="14" rx="7" ry="10" fill="#bfb5a8" stroke="#090708" stroke-width="1.8"/>
          <ellipse cx="29" cy="13" rx="2.2" ry="1.4" fill="#6b6158"/>
          <ellipse cx="35" cy="13" rx="2.2" ry="1.4" fill="#6b6158"/>
          <path d="M24,25 L40,25 L43,64 L21,64 Z" fill="#141216" stroke="#060506" stroke-width="1.6"/>
          <path d="M24,26 L12,56 M40,26 L52,56" stroke="#141216" stroke-width="4" stroke-linecap="round"/>
        </svg>`;
    }
    if (monsterId === "attic_stalker") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#120e12"/>
          <path d="M16,58 C18,32 24,18 32,16 C40,18 46,32 48,58 Z" fill="#1a141c" stroke="#08060a" stroke-width="1.8"/>
          <ellipse cx="32" cy="22" rx="9" ry="10" fill="#241c26"/>
          <circle cx="28" cy="21" r="2.2" fill="#fff0b8"/>
          <circle cx="36" cy="21" r="2.2" fill="#fff0b8"/>
          <path d="M28,28 Q32,32 36,28" stroke="#85758a" stroke-width="1.4" fill="none"/>
        </svg>`;
    }
    if (monsterId === "balloon_stalker") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#140c0e"/>
          <ellipse cx="22" cy="20" rx="10" ry="12" fill="#b8242c" stroke="#420a0d" stroke-width="1.6"/>
          <path d="M22,32 Q24,44 20,56" stroke="#cbbca4" stroke-width="1.2" fill="none"/>
          <path d="M32,58 C34,34 40,22 48,22 C54,22 58,34 58,58 Z" fill="#161114"/>
          <circle cx="44" cy="28" r="1.8" fill="#ff5454"/>
          <circle cx="51" cy="28" r="1.8" fill="#ff5454"/>
        </svg>`;
    }
    if (monsterId === "the_knight") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#121418"/>
          <path d="M22,12 Q32,4 42,12 L44,32 L20,32 Z" fill="#636c78" stroke="#181c21" stroke-width="2"/>
          <rect x="24" y="19" width="16" height="4" fill="#111418"/>
          <rect x="27" y="20" width="3" height="2" fill="#f05a5a"/>
          <rect x="34" y="20" width="3" height="2" fill="#f05a5a"/>
          <path d="M14,62 L18,34 L46,34 L50,62 Z" fill="#4c545e" stroke="#181c21" stroke-width="2"/>
        </svg>`;
    }
    if (monsterId === "ceiling_crawler") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#120b0d"/>
          <!-- Marionette strings attached to limbs & head -->
          <g stroke="#cfc8bc" stroke-width="1.1" opacity="0.72">
            <line x1="32" y1="2" x2="32" y2="16"/>
            <line x1="16" y1="2" x2="14" y2="34"/>
            <line x1="48" y1="2" x2="50" y2="34"/>
            <line x1="24" y1="2" x2="24" y2="56"/>
            <line x1="40" y1="2" x2="40" y2="56"/>
          </g>
          <rect x="24" y="29" width="16" height="17" fill="#7a1b26" stroke="#180a0c" stroke-width="1.6"/>
          <line x1="28" y1="29" x2="28" y2="46" stroke="#d9b65c" stroke-width="2"/>
          <line x1="36" y1="29" x2="36" y2="46" stroke="#d9b65c" stroke-width="2"/>
          <line x1="24" y1="32" x2="13" y2="35" stroke="#c7a682" stroke-width="4" stroke-linecap="round"/>
          <line x1="40" y1="32" x2="51" y2="35" stroke="#c7a682" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="32" cy="21" rx="8" ry="9" fill="#e6d8c3" stroke="#180d0c" stroke-width="1.6"/>
          <circle cx="29" cy="20" r="1.8" fill="#120a0c"/>
          <circle cx="35" cy="20" r="1.8" fill="#120a0c"/>
          <line x1="28" y1="26" x2="36" y2="26" stroke="#362018" stroke-width="1.6"/>
        </svg>`;
    }
    if (monsterId === "giant_monkey") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#17100c"/>
          <circle cx="15" cy="26" r="7" fill="#4f3322" stroke="#1c1009" stroke-width="1.8"/>
          <circle cx="49" cy="26" r="7" fill="#4f3322" stroke="#1c1009" stroke-width="1.8"/>
          <ellipse cx="32" cy="30" rx="17" ry="18" fill="#5c3b26" stroke="#1c1009" stroke-width="2"/>
          <ellipse cx="32" cy="36" rx="12" ry="9" fill="#bfa282"/>
          <circle cx="26" cy="25" r="3" fill="#ff3b3b"/>
          <circle cx="38" cy="25" r="3" fill="#ff3b3b"/>
          <rect x="23" y="36" width="18" height="5" rx="1" fill="#1c110b"/>
          <line x1="27" y1="36" x2="27" y2="41" stroke="#f5ecd6" stroke-width="2"/>
          <line x1="32" y1="36" x2="32" y2="41" stroke="#f5ecd6" stroke-width="2"/>
          <line x1="37" y1="36" x2="37" y2="41" stroke="#f5ecd6" stroke-width="2"/>
        </svg>`;
    }
    if (monsterId === "sparky") {
      return `
        <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
          <rect width="64" height="64" fill="#0b111c"/>
          <path d="M18,56 L22,22 L42,22 L46,56 Z" fill="#1c273b" stroke="#5cc4ff" stroke-width="1.6"/>
          <circle cx="32" cy="18" r="9" fill="#141e30" stroke="#7be0ff" stroke-width="1.6"/>
          <circle cx="29" cy="17" r="2.2" fill="#9cf0ff"/>
          <circle cx="35" cy="17" r="2.2" fill="#9cf0ff"/>
          <polyline points="10,24 18,32 13,38 22,48" fill="none" stroke="#8ceeff" stroke-width="2.2"/>
          <polyline points="54,20 46,30 51,36 43,46" fill="none" stroke="#8ceeff" stroke-width="2.2"/>
        </svg>`;
    }
    return `
      <svg viewBox="0 0 64 64" class="ev-monster-svg" aria-hidden="true">
        <rect width="64" height="64" fill="#09070a"/>
        <path d="M18,62 C20,34 24,14 32,12 C40,14 44,34 46,62 Z" fill="#151018" stroke="#362438" stroke-width="1.4"/>
        <circle cx="28" cy="24" r="2.4" fill="#ff4d4d"/>
        <circle cx="36" cy="24" r="2.4" fill="#ff4d4d"/>
      </svg>`;
  }

  // ==================== VALID TWO-WALL CORNERS FOR EVERY ROOM ====================
  function rectCollidesPoint(col, x, y) {
    if (col.shape === "ellipse") {
      const ex = (x - col.cx) / (col.rx + 4);
      const ey = (y - 3 - col.cy) / (col.ry + 2);
      return ex * ex + ey * ey < 1.0;
    }
    return x >= col.x - 4 && x <= col.x + col.w + 4 && y >= col.y - 2 && y <= col.y + col.h + 4;
  }

  function getValidCornersForRoom(room, roomMap) {
    if (!room) return [];

    // Main Parlor (The Dining Room): SW & SE bare wall corners are always open & valid!
    if (room.id === "dining_room") {
      return [
        { id: "corner_sw", x: 24,  y: 186, label: "SW CORNER" },
        { id: "corner_se", x: 184, y: 186, label: "SE CORNER" }
      ];
    }

    if (!App.CabinRooms) return [];
    const rData = App.CabinRooms.getRoomData(room, roomMap);
    const rects = rData.floorRects || [];
    const colliders = rData.colliders || [];
    const candidates = [];

    rects.forEach((r, rIdx) => {
      const pts = [
        { id: `c_${rIdx}_nw`, x: r.x1 + 9, y: r.y1 + 8,  dxOut: -4, dyOut: -4 },
        { id: `c_${rIdx}_ne`, x: r.x2 - 9, y: r.y1 + 8,  dxOut:  4, dyOut: -4 },
        { id: `c_${rIdx}_sw`, x: r.x1 + 9, y: r.y2 - 7,  dxOut: -4, dyOut:  4 },
        { id: `c_${rIdx}_se`, x: r.x2 - 9, y: r.y2 - 7,  dxOut:  4, dyOut:  4 }
      ];

      pts.forEach((p) => {
        // Must be a real exterior two-wall corner (both outside directions must be solid walls, not inside another floorRect!)
        const xOutside = !rects.some((o) => p.x + p.dxOut * 3 >= o.x1 && p.x + p.dxOut * 3 <= o.x2 && p.y >= o.y1 && p.y <= o.y2);
        const yOutside = !rects.some((o) => p.x >= o.x1 && p.x <= o.x2 && p.y + p.dyOut * 3 >= o.y1 && p.y + p.dyOut * 3 <= o.y2);
        if (!xOutside || !yOutside) return;

        // Avoid blocking furniture colliders
        if (colliders.some((col) => rectCollidesPoint(col, p.x, p.y))) return;

        // Avoid sitting right on top of a doorway portal
        const nearDoor =
          (Math.abs(p.x - 104) < 16 && (p.y < 64 || p.y > 180)) ||
          (Math.abs(p.y - 126) < 16 && (p.x < 28 || p.x > 180));
        if (nearDoor) return;

        // Deduplicate close points
        if (!candidates.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 14)) {
          candidates.push({ id: p.id, x: p.x, y: p.y, label: "CORNER" });
        }
      });
    });

    // Guarantee at least 2 reachable wall corners even in super-tight layouts
    if (candidates.length === 0 && rects.length > 0) {
      const r = rects[0];
      candidates.push(
        { id: "c_fb_1", x: r.x1 + 9, y: r.y1 + 9, label: "CORNER" },
        { id: "c_fb_2", x: r.x2 - 9, y: r.y2 - 8, label: "CORNER" }
      );
    }

    return candidates;
  }

  // ==================== CUTTING CORNERS STATE & LIFECYCLE ====================
  function initMatchEvents(matchState) {
    hideSmudgeBanner();
    document.getElementById("event-jumpscare-flash")?.classList.add("hidden");
    if (!matchState) return;
    matchState.events = {
      cuttingCornersNpc: null,
      cuttingCorners: null, // Active Cutting Corners state machine
      globalLightsOut: false,
      activeMonsters: [],
      triggeredHistory: []
    };
  }

  function isGlobalLightsOut(matchState) {
    return (
      Boolean(matchState && matchState.events && matchState.events.globalLightsOut) ||
      Boolean(App.Stalkers && App.Stalkers.isRedBalloonsActive && App.Stalkers.isRedBalloonsActive(matchState)) ||
      Boolean(App.Musical && App.Musical.isIntroDarkStage && App.Musical.isIntroDarkStage(matchState)) ||
      Boolean(App.Knight && App.Knight.isDarkPhase && App.Knight.isDarkPhase(matchState))
    );
  }

  function isCuttingCornersActive(matchState) {
    const cc = matchState && matchState.events && matchState.events.cuttingCorners;
    return Boolean(cc && cc.stage !== "WAITING_ROOMS" && cc.stage !== "DONE");
  }

  function isAnyEventActive(matchState) {
    return (
      isCuttingCornersActive(matchState) ||
      Boolean(App.Attic && App.Attic.isAtticActive && App.Attic.isAtticActive(matchState)) ||
      Boolean(App.Stalkers && App.Stalkers.isAnyStalkerActive && App.Stalkers.isAnyStalkerActive(matchState)) ||
      Boolean(App.Musical && App.Musical.isActive && App.Musical.isActive(matchState)) ||
      Boolean(App.Basement && App.Basement.isActive && App.Basement.isActive(matchState)) ||
      Boolean(App.StayLit && App.StayLit.isActive && App.StayLit.isActive(matchState)) ||
      Boolean(App.Knight && App.Knight.isActive && App.Knight.isActive(matchState)) ||
      Boolean(App.Endgame && App.Endgame.isEndgameActive && App.Endgame.isEndgameActive(matchState))
    );
  }

  function onEventCardDrawn(card, matchState) {
    if (!card || !matchState) return null;
    if (!matchState.events) initMatchEvents(matchState);

    const monster = getMonsterForCard(card);
    if (monster) {
      matchState.events.triggeredHistory.push({
        cardId: card.id,
        monsterId: monster.id,
        turn: matchState.turnCount || 0
      });
      if (!matchState.events.activeMonsters.includes(monster.id)) {
        matchState.events.activeMonsters.push(monster.id);
      }
    }

    // CUTTING CORNERS: Spawn player-lookalike NPC facing NE wall corner in Main Parlor!
    // Triggers automatically once total rooms (incl. Main Parlor & Cellar) reach 5 or 6!
    if (card.id === "hx_corners") {
      const baseChar = (App.Config && App.Config.state && App.Config.state.character)
        ? Object.assign({}, App.Config.state.character)
        : {
            skin: 0, hairStyle: 0, hairColor: 0, eyeColor: 0,
            outfit: 0, shirtColor: 0, underColor: 0, pantsColor: 0,
            shoeColor: 0, accessory: 0
          };
      baseChar.walking = false;
      baseChar.lantern = false;
      baseChar.facing = 1;

      const curRooms = Object.keys(matchState.roomMap || {}).length;
      let targetRooms = Math.random() < 0.5 ? 5 : 6;
      if (curRooms === 5) targetRooms = 6;
      else if (curRooms >= 6) targetRooms = curRooms;

      matchState.events.cuttingCornersNpc = {
        id: "npc_cutting_corners",
        monsterId: "corner_man",
        roomId: "dining_room",
        x: PARLOR_CORNER_ANCHOR.x,
        y: PARLOR_CORNER_ANCHOR.y,
        facingCorner: true,
        headTwisted: false,
        charConfig: baseChar
      };

      matchState.events.cuttingCorners = {
        stage: "WAITING_ROOMS", // WAITING_ROOMS | SCRAMBLE | QUESTION | FEEDBACK | DEATH | SURVIVED | DONE
        triggerRooms: targetRooms,
        triggerImmediatelyAfterDraw: curRooms >= 6,
        timer: 0,
        questions: [],
        qIndex: 0,
        currentQ: null,
        playerTurnedAround: false,
        feedbackText: ""
      };
    }

    return monster;
  }

  function buildCuttingCornersQuestions(matchState) {
    const rim = matchState.rimPlayedCards || [];
    const progressCount = rim.filter((c) => c.type === "CHIME").length;
    const totalRooms = Object.keys(matchState.roomMap || {}).length;
    const eventCount = rim.filter((c) => c.type === "HEX").length;

    function makeVariant(actual, minVal) {
      const isTrue = Math.random() < 0.5;
      if (isTrue) return { shown: actual, isTrue: true };
      const delta = Math.random() < 0.5 ? 1 : -1;
      let fake = actual + delta;
      if (fake < minVal) fake = actual + 1;
      if (fake === actual) fake = actual + 2;
      return { shown: fake, isTrue: false };
    }

    const qProgress = makeVariant(progressCount, 0);
    const qRooms = makeVariant(totalRooms, 2);
    const qEvents = makeVariant(eventCount, 0);

    const list = [
      {
        kind: "progress",
        isTrue: qProgress.isTrue,
        actual: progressCount,
        shown: qProgress.shown,
        text: `FACE IT IF THERE ${qProgress.shown === 1 ? "IS" : "ARE"} ${qProgress.shown} PROGRESS ${qProgress.shown === 1 ? "CARD" : "CARDS"} ON THE TABLE.`
      },
      {
        kind: "rooms",
        isTrue: qRooms.isTrue,
        actual: totalRooms,
        shown: qRooms.shown,
        text: `FACE IT IF THERE ARE ${qRooms.shown} TOTAL ROOMS INCLUDING THE CELLAR.`
      },
      {
        kind: "events",
        isTrue: qEvents.isTrue,
        actual: eventCount,
        shown: qEvents.shown,
        text: `FACE IT IF THERE ${qEvents.shown === 1 ? "IS" : "ARE"} ${qEvents.shown} ${qEvents.shown === 1 ? "EVENT" : "EVENTS"} ON THE TABLE.`
      }
    ];

    // Shuffle question order & pick ONLY 1 condition for Cutting Corners!
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return [list[0]];
  }

  function startCuttingCornersEvent(matchState) {
    if (!matchState || !matchState.events || !matchState.events.cuttingCorners) return false;
    const cc = matchState.events.cuttingCorners;
    if (cc.stage !== "WAITING_ROOMS") return false;

    // 1. Shut off ALL lights across the entire cabin!
    matchState.events.globalLightsOut = true;
    matchState.roomLightStates = {};
    Object.keys(matchState.roomMap || {}).forEach((rk) => {
      matchState.roomLightStates[rk] = false;
    });

    // 2. Corner Man snaps his head 180 deg backward with glowing white eyes & creepy smile!
    if (matchState.events.cuttingCornersNpc) {
      matchState.events.cuttingCornersNpc.headTwisted = true;
    }

    // 3. Force player out of Table View & stand them up so they can sprint to a corner immediately!
    if (App.FieldBook && App.FieldBook.isOpen()) App.FieldBook.close(true);
    if (App.Clues && App.Clues.isInspectOpen()) App.Clues.closeInspectModal(true);
    if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
      App.GameWorld.forceStandUpForEvent();
    }

    cc.stage = "SCRAMBLE";
    cc.timer = 10.0;
    cc.questions = buildCuttingCornersQuestions(matchState);
    cc.qIndex = 0;
    cc.currentQ = null;
    cc.playerTurnedAround = false;

    App.Audio.hexAlert();
    showSmudgeBanner("GET TO A CORNER AND FACE IT.\nDO NOT TURN AROUND...", {
      countdown: 10,
      typingDurationSec: 5.0,
      showChoices: false
    });
    return true;
  }

  // Called whenever a new room is built (or after a turn) to check the 5-6 room trigger!
  function checkCuttingCornersTrigger(matchState) {
    if (!matchState || !matchState.events || !matchState.events.cuttingCorners) return false;
    const cc = matchState.events.cuttingCorners;
    if (cc.stage !== "WAITING_ROOMS") return false;

    const totalRooms = Object.keys(matchState.roomMap || {}).length;
    if (totalRooms >= cc.triggerRooms) {
      return startCuttingCornersEvent(matchState);
    }
    return false;
  }

  function startQuestionRound(matchState) {
    const cc = matchState.events.cuttingCorners;
    if (!cc) return;
    if (cc.qIndex >= cc.questions.length) {
      // Survived all 3 questions!
      cc.stage = "SURVIVED";
      cc.timer = 3.2;
      App.Audio.clockChime();
      showSmudgeBanner("IT LEFT THE ROOM...\nYOU SURVIVED CUTTING CORNERS.", {
        success: true,
        typingDurationSec: 2.8,
        showChoices: false
      });
      return;
    }

    cc.stage = "QUESTION";
    cc.currentQ = cc.questions[cc.qIndex];
    cc.timer = 10.0;
    cc.playerTurnedAround = false;

    showSmudgeBanner(cc.currentQ.text, {
      subtag: `CONDITION ${cc.qIndex + 1} / ${cc.questions.length}`,
      countdown: 10,
      typingDurationSec: 5.0,
      showChoices: true
    });
  }

  function triggerCuttingCornersDeath(matchState, reasonText) {
    const cc = matchState.events.cuttingCorners;
    if (!cc) return;
    cc.stage = "DEATH";
    cc.timer = 3.6;

    // Dramatic Corner Man jumpscare flash!
    const flash = document.getElementById("event-jumpscare-flash");
    if (flash) {
      flash.classList.remove("hidden");
      setTimeout(() => flash.classList.add("hidden"), 780);
    }

    App.Audio.hexAlert();
    const penLbl = (matchState && matchState.mode === "MULTIPLAYER") ? "+30 MIN" : "+1 HOUR";
    showSmudgeBanner(`${reasonText}\nRESPAWNING IN THE CELLAR (${penLbl})...`, {
      danger: true,
      typingDurationSec: 3.0,
      showChoices: false
    });
  }

  function finishCuttingCornersCleanup(matchState, player, died) {
    const cc = matchState.events.cuttingCorners;
    if (cc) cc.stage = "DONE";

    matchState.events.globalLightsOut = false;
    matchState.events.cuttingCornersNpc = null;
    turnAllLightsOn(matchState);
    hideSmudgeBanner();

    if (player) {
      player.facingCorner = false;
      player.cornerLock = null;
    }

    if (died) {
      // Apply SP (+1h) or MP (+30m) death time penalty to BOTH Player & Harvester pawns!
      applyDeathTimePenalty(matchState);
      if (App.GameWorld && App.GameWorld.respawnInCellar) {
        App.GameWorld.respawnInCellar();
      }
    }
  }

  function submitCuttingCornersChoice(matchState, player, turnAround) {
    const cc = matchState && matchState.events && matchState.events.cuttingCorners;
    if (!cc || cc.stage !== "QUESTION" || !cc.currentQ) return;

    // Visually turn player around if they chose TRUE (Face it!)
    if (turnAround && player) {
      player.facingCorner = false;
      cc.playerTurnedAround = true;
    }

    const correct = Boolean(turnAround) === Boolean(cc.currentQ.isTrue);
    document.getElementById("event-smudge-choices")?.classList.add("hidden");

    if (correct) {
      cc.stage = "FEEDBACK";
      cc.timer = 1.6;
      cc.qIndex += 1;
      App.Audio.open();
      showSmudgeBanner(turnAround ? "YOU FACED IT... IT SPARES YOU." : "YOU KEPT FACING THE WALL...", {
        success: true,
        playTyping: false,
        showChoices: false
      });
    } else {
      const msg = turnAround
        ? "THE CONDITION WAS FALSE — YOU TURNED AROUND!"
        : "THE CONDITION WAS TRUE — YOU DID NOT FACE IT!";
      triggerCuttingCornersDeath(matchState, msg);
    }
  }

  // Called every frame from GameWorld.renderFrame()
  function update(dt, matchState, player, currentRoom) {
    if (!matchState || !matchState.events || !matchState.events.cuttingCorners) return;
    const cc = matchState.events.cuttingCorners;

    if (cc.stage === "WAITING_ROOMS") {
      if (cc.triggerImmediatelyAfterDraw && (!App.TableView || !App.TableView.isBusy())) {
        cc.triggerImmediatelyAfterDraw = false;
        startCuttingCornersEvent(matchState);
      }
      return;
    }

    if (cc.stage === "SCRAMBLE") {
      cc.timer -= dt;
      updateBannerCountdown(cc.timer);

      if (cc.timer <= 0) {
        // Auto-detect if player is physically tucked right against a valid corner even if they forgot [E]
        if (player && !player.facingCorner && currentRoom) {
          const corners = getValidCornersForRoom(currentRoom, matchState.roomMap);
          const near = corners.find((c) => Math.hypot(player.x - c.x, player.y - c.y) <= 16);
          if (near) {
            player.x = near.x;
            player.y = near.y;
            player.facingCorner = true;
            player.cornerLock = near;
          }
        }

        if (player && player.facingCorner) {
          startQuestionRound(matchState);
        } else {
          triggerCuttingCornersDeath(matchState, "TIME IS UP — YOU DID NOT FACE A CORNER!");
        }
      }
      return;
    }

    if (cc.stage === "QUESTION") {
      cc.timer -= dt;
      updateBannerCountdown(cc.timer);
      if (cc.timer <= 0) {
        // Timer ran out without turning around -> counts as staying facing the corner (FALSE)!
        submitCuttingCornersChoice(matchState, player, false);
      }
      return;
    }

    if (cc.stage === "FEEDBACK") {
      cc.timer -= dt;
      if (cc.timer <= 0) {
        // Snap player back into facing the corner for the next question
        if (player && player.cornerLock) {
          player.facingCorner = true;
        }
        startQuestionRound(matchState);
      }
      return;
    }

    if (cc.stage === "DEATH") {
      cc.timer -= dt;
      if (cc.timer <= 0) {
        finishCuttingCornersCleanup(matchState, player, true);
      }
      return;
    }

    if (cc.stage === "SURVIVED") {
      cc.timer -= dt;
      if (cc.timer <= 0) {
        finishCuttingCornersCleanup(matchState, player, false);
      }
    }
  }

  // ==================== ROOM RENDERING & CORNER MARKERS ====================
  function getParlorColliders(matchState) {
    if (!matchState || !matchState.events || !matchState.events.cuttingCornersNpc) return [];
    return [PARLOR_CORNER_ANCHOR.collider];
  }

  function getParlorRenderables(ctx, timeSec, matchState) {
    if (!matchState || !matchState.events || !matchState.events.cuttingCornersNpc) return [];
    const npc = matchState.events.cuttingCornersNpc;
    return [
      {
        y: npc.y,
        draw: () => {
          if (App.Character && App.Character.drawBackCornerInWorld) {
            App.Character.drawBackCornerInWorld(ctx, npc.x, npc.y, npc.charConfig, timeSec, {
              headTwisted: Boolean(npc.headTwisted)
            });
          }
        }
      }
    ];
  }

  // Draws subtle glowing corner zone markers in the current room during Cutting Corners SCRAMBLE
  // + highlights the Corner Man's eerie glowing white eyes in Main Parlor!
  function renderRoomEventHighlights(ctx, room, timeSec, matchState) {
    if (!matchState || !matchState.events) return;
    const cc = matchState.events.cuttingCorners;

    // 1. In Main Parlor, highlight Corner Man NPC (and piercing white eyes when head twisted!)
    if (room && room.id === "dining_room" && matchState.events.cuttingCornersNpc) {
      const npc = matchState.events.cuttingCornersNpc;
      const pulse = 0.72 + Math.sin(timeSec * 3.0) * 0.24;
      const g = ctx.createRadialGradient(npc.x, npc.y - 10, 2, npc.x, npc.y - 10, 24);
      g.addColorStop(
        0,
        npc.headTwisted
          ? `rgba(220, 46, 54, ${(0.28 * pulse).toFixed(3)})`
          : `rgba(218, 226, 240, ${(0.18 * pulse).toFixed(3)})`
      );
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(npc.x - 26, npc.y - 36, 52, 52);

      if (npc.headTwisted) {
        // Glowing white pinpoint eyes & toothy smile pop starkly in pitch darkness!
        const ex = Math.round(npc.x - 2);
        const ey = Math.round(npc.y - 17);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(ex, ey, 1, 1);
        ctx.fillRect(ex + 3, ey, 1, 1);
        ctx.fillStyle = "#e8dfc8";
        ctx.fillRect(ex, ey + 2, 4, 1);
      }
    }

    // 2. During the 10-second SCRAMBLE, show subtle floor markers at valid two-wall corners in EVERY room!
    if (cc && cc.stage === "SCRAMBLE" && room) {
      const corners = getValidCornersForRoom(room, matchState.roomMap);
      const pulse = 0.55 + Math.sin(timeSec * 7.5) * 0.35;
      corners.forEach((cPt) => {
        const rg = ctx.createRadialGradient(cPt.x, cPt.y, 1, cPt.x, cPt.y, 14);
        rg.addColorStop(0, `rgba(247, 212, 130, ${(0.34 * pulse).toFixed(3)})`);
        rg.addColorStop(1, "rgba(247, 212, 130, 0)");
        ctx.fillStyle = rg;
        ctx.fillRect(cPt.x - 15, cPt.y - 15, 30, 30);

        ctx.save();
        ctx.strokeStyle = `rgba(255, 232, 175, ${(0.72 * pulse).toFixed(2)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cPt.x, cPt.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  function turnAllLightsOn(matchState) {
    if (!matchState) return;
    matchState.roomLightStates = matchState.roomLightStates || {};
    matchState.roomLightStates["0,0"] = true;
    Object.keys(matchState.roomMap || {}).forEach((rk) => {
      matchState.roomLightStates[rk] = true;
    });
  }

  // Centralized Death Time Penalty:
  // - Singleplayer: +60 minutes (+1 HOUR) to BOTH Player piece AND Harvester piece!
  // - Multiplayer : +30 minutes per dead player to BOTH Player piece AND Harvester piece!
  function applyDeathTimePenalty(matchState, deadPlayersCount) {
    if (!matchState) return { penaltyMin: 60, label: "+1 HOUR" };
    const isMp = matchState.mode === "MULTIPLAYER";
    const count = Math.max(1, deadPlayersCount || 1);
    const penaltyMin = isMp ? (30 * count) : 60;

    const prevClock = matchState.clockMinutes || 0;
    const actualAdvance = Math.min(720 - prevClock, penaltyMin);
    matchState.clockMinutes = Math.min(720, prevClock + penaltyMin);

    if (matchState.harvesterSpawned) {
      matchState.harvesterMinutes = Math.min(
        matchState.clockMinutes,
        (matchState.harvesterMinutes || 0) + actualAdvance
      );
    }

    const label = penaltyMin >= 60 && penaltyMin % 60 === 0
      ? `+${penaltyMin / 60} HOUR${penaltyMin > 60 ? "S" : ""}`
      : `+${penaltyMin} MIN`;
    return { penaltyMin, label };
  }

  App.Events = {
    MONSTERS,
    PARLOR_CORNER_ANCHOR,
    getMonsterById,
    getMonsterForCard,
    getMonsterPortraitSVG,
    getValidCornersForRoom,
    initMatchEvents,
    isGlobalLightsOut,
    isCuttingCornersActive,
    isAnyEventActive,
    turnAllLightsOn,
    applyDeathTimePenalty,
    onEventCardDrawn,
    checkCuttingCornersTrigger,
    submitCuttingCornersChoice,
    update,
    showSmudgeBanner,
    hideSmudgeBanner,
    getParlorColliders,
    getParlorRenderables,
    renderRoomEventHighlights
  };
})(window.Duskwood);
