/* ==========================================================================
   DUSKWOOD INN - THE THIEF (`ch_the_thief`) In-Room 4-Color Roulette Engine
   Matches The Cabin Game reference (image_434abd, image_434adb, image_4d2c82):
   - Triggered as a +30m Progress Card: Dining Room turns dark & atmospheric!
   - Center Round Table transforms into a 4-Color Roulette Wheel (GREEN, RED,
     BLUE, YELLOW) lined with chasing white bulb lights + a Severed Thief Head
     wearing a black balaclava with Green & Red Poker Chips pinned over its eyes!
   - 4 Gacha Card Stands spawn nearby with 4 rolled effects (60% Negative / 40% Positive):
       * Negative (60%): Graveyard Wipe, Harvester +30 Min, Steal Time (+1 Hour),
                         Return Clue (random eligible player's hand -> Deck),
                         Return Room (random eligible player's hand -> Deck)
       * Positive (40%): Gained Clue Card, Delay Harvester (-30 Min),
                         Time Rewind (-30 Min), Graveyard Salvage
   - Selection & Placement:
       * Singleplayer: Pick 1 of the 4 Gacha cards -> place onto 1 colored slot (3 empty).
       * Multiplayer : Each player picks 1 distinct card -> places onto 1 empty colored slot
                       (max 1 card per color slot; 4 players fill all 4 slots).
   - Human-Hands Lever: Placed beside the wheel. Unlocks once all players placed their
     card -> press [E] to pull the human-hands lever and spin!
   - Resolution:
       * Empty slot  -> Nothing happens! Safe/neutral.
       * Card slot   -> Triggers that card's exact effect on the match!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const CX = 104;
  const CY = 126;
  const RX = 33;
  const RY = 26;

  // 4 Quadrant Colors (exact order around wheel starting from top-left):
  // Angle in wheel-local space:
  //   slot 0 GREEN  : [PI,      1.5*PI] -> center 1.25*PI (NW / Top-Left)
  //   slot 1 RED    : [1.5*PI,  2.0*PI] -> center 1.75*PI (NE / Top-Right)
  //   slot 2 BLUE   : [0,       0.5*PI] -> center 0.25*PI (SE / Bottom-Right)
  //   slot 3 YELLOW : [0.5*PI,  1.0*PI] -> center 0.75*PI (SW / Bottom-Left)
  const WHEEL_SLOTS = [
    { idx: 0, name: "GREEN",  fill: "#1f5e31", bright: "#33944e", rim: "#78eb98", placeX: 70,  placeY: 106, baseAng: Math.PI * 1.25 },
    { idx: 1, name: "RED",    fill: "#7d1920", bright: "#b82832", rim: "#ff7a82", placeX: 138, placeY: 106, baseAng: Math.PI * 1.75 },
    { idx: 2, name: "BLUE",   fill: "#1a2f6e", bright: "#2b4ca8", rim: "#7aa8ff", placeX: 138, placeY: 146, baseAng: Math.PI * 0.25 },
    { idx: 3, name: "YELLOW", fill: "#8f6f20", bright: "#c99f32", rim: "#ffe37a", placeX: 70,  placeY: 146, baseAng: Math.PI * 0.75 }
  ];

  // 4 Gacha Card Stands arranged cleanly along North open floor (clear of Fireplace, Piano & Wheel!)
  const STAND_POSITIONS = [
    { x: 56,  y: 74 },
    { x: 86,  y: 72 },
    { x: 122, y: 72 },
    { x: 152, y: 74 }
  ];

  // Creepy Human-Hands Lever mounted on East side beside the roulette table!
  const LEVER_POS = { x: 170, y: 126 };

  // ==================== 60% NEGATIVE / 40% POSITIVE GACHA POOL ====================
  const NEGATIVE_POOL = [
    {
      id: "graveyard_wipe",
      polarity: "negative",
      header: "THE GRAVEYARD",
      name: "GRAVEYARD WIPE",
      short: "Wipes Graveyard",
      desc: "WIPES ALL CLUE CARDS CURRENTLY RESTING IN THE GRAVEYARD."
    },
    {
      id: "harvester_plus_30",
      polarity: "negative",
      header: "THE HARVESTER",
      name: "HARVESTER +30 MIN",
      short: "Harvester +30m",
      desc: "PUSHES THE HOLLOW HARVESTER +30 MINUTES CLOSER TO YOUR PIECE."
    },
    {
      id: "steal_time",
      polarity: "negative",
      header: "TIME",
      name: "LOSE 1 HOUR",
      short: "Lose 1 Hour",
      desc: "LOSE 1 HOUR OF GAME TIME (+60 MINUTES TOWARD MIDNIGHT)."
    },
    {
      id: "return_clue",
      polarity: "negative",
      header: "CLUES",
      name: "RETURN A CLUE",
      short: "Hand Clue -> Deck",
      desc: "SELECTS 1 RANDOM PLAYER HOLDING A CLUE CARD AND RETURNS 1 RANDOM CLUE FROM THEIR HAND BACK INTO THE DECK."
    },
    {
      id: "return_room",
      polarity: "negative",
      header: "A ROOM",
      name: "RETURN A ROOM",
      short: "Hand Room -> Deck",
      desc: "SELECTS 1 RANDOM PLAYER HOLDING A ROOM CARD AND RETURNS 1 RANDOM ROOM FROM THEIR HAND BACK INTO THE DECK."
    }
  ];

  const POSITIVE_POOL = [
    {
      id: "gain_clue",
      polarity: "positive",
      header: "CLUES",
      name: "GAINED CLUE CARD",
      short: "+1 Clue Card",
      desc: "GRANTS 1 UNOWNED CLUE CARD DIRECTLY INTO YOUR HAND."
    },
    {
      id: "delay_harvester",
      polarity: "positive",
      header: "THE HARVESTER",
      name: "DELAY HARVESTER",
      short: "Harvester -30m",
      desc: "DRIVES THE HOLLOW HARVESTER BACK BY 30 MINUTES (OR +1 DELAY TURN)."
    },
    {
      id: "time_rewind",
      polarity: "positive",
      header: "TIME",
      name: "TIME REWIND",
      short: "Clock -30m",
      desc: "REWINDS THE NIGHT CLOCK BACK BY 30 MINUTES."
    },
    {
      id: "graveyard_salvage",
      polarity: "positive",
      header: "THE GRAVEYARD",
      name: "GRAVEYARD SALVAGE",
      short: "Salvage Graveyard",
      desc: "RETURNS 1 CLUE CARD FROM THE GRAVEYARD BACK INTO THE DECK (OR GRANTS A CARD IF EMPTY)."
    }
  ];

  let standModalOpen = false;
  let inspectedStandIdx = -1;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  function fillPixelEllipse(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const ratio = 1 - (dy * dy) / (ry * ry);
      if (ratio < 0) continue;
      const span = Math.floor(rx * Math.sqrt(ratio));
      c.fillRect(Math.floor(cx - span), Math.floor(cy + dy), span * 2 + 1, 1);
    }
  }

  function isMpMatch(matchState) {
    return Boolean(
      matchState &&
      matchState.mode === "MULTIPLAYER" &&
      App.Network &&
      App.Network.isMultiplayerMatch &&
      App.Network.isMultiplayerMatch()
    );
  }

  function getLocalPid() {
    return (App.Network && App.Network.getLocalPlayerId) ? App.Network.getLocalPlayerId() : "local";
  }

  // Roll 4 distinct Gacha cards with 60% Negative / 40% Positive weighting!
  function rollFourGachaCards(matchState) {
    const negAvail = NEGATIVE_POOL.filter(
      (c) => !(matchState && matchState.bannedGraveyardWipe && c.id === "graveyard_wipe")
    );
    const posAvail = POSITIVE_POOL.slice();
    const chosen = [];

    for (let i = 0; i < 4; i++) {
      const wantNeg = Math.random() < 0.60;
      let pool = wantNeg ? negAvail : posAvail;
      if (!pool.length) pool = wantNeg ? posAvail : negAvail;
      if (!pool.length) break;
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(Object.assign({}, pool.splice(idx, 1)[0]));
    }
    return chosen;
  }

  // ==================== 1. LIFECYCLE: START / PICK / PLACE / SPIN / RESOLVE ====================
  function startThiefEvent(matchState, opts) {
    if (!matchState) return null;
    const o = opts || {};
    const fromNetwork = Boolean(o.fromNetwork);

    const activeSeats = (matchState.playerSeats && matchState.playerSeats.length) ? matchState.playerSeats : [0];
    const requiredPlacements = Math.min(4, Math.max(1, activeSeats.length));

    const cards = (fromNetwork && Array.isArray(o.cards)) ? o.cards.map((c) => Object.assign({}, c)) : rollFourGachaCards(matchState);
    const stands = cards.map((card, i) => ({
      standIdx: i,
      x: STAND_POSITIONS[i].x,
      y: STAND_POSITIONS[i].y,
      card,
      takenBy: null
    }));

    const localPid = getLocalPid();
    const localFlags = App.TableView && App.TableView.getLocalHandCategoryFlags
      ? App.TableView.getLocalHandCategoryFlags()
      : { hasClue: false, hasRoom: false };

    const handFlagsByPlayer = {};
    handFlagsByPlayer[localPid] = localFlags;

    matchState.thiefEvent = {
      active: true,
      stage: "PICK_AND_PLACE", // PICK_AND_PLACE | SPINNING | RESULT
      stands,
      wheelSlots: [null, null, null, null], // Each slot: { card, placedBy } | null
      requiredPlacements,
      playerPickedStand: {},  // playerId -> standIdx
      playerHoldingCard: {},  // playerId -> card object (until placed on wheel)
      playerPlacedSlot: {},   // playerId -> slotIdx
      handFlagsByPlayer,
      wheelAngle: 0,
      spinStartAngle: 0,
      spinTargetAngle: 0,
      spinElapsed: 0,
      spinDuration: 4.2,
      spinLastTick: 0,
      winningSlotIdx: -1,
      leverPull: 0,           // 0 = upright, 1 = pulled down
      resultTimer: 0,
      resultText: "",
      nextOrderIdx: typeof o.nextOrderIdx === "number" ? o.nextOrderIdx : 0,
      notice: requiredPlacements > 1
        ? `THE THIEF! EACH PLAYER PICKS 1 OF 4 CARDS, PLACES IT ON A COLOR, THEN PULLS THE HAND LEVER!`
        : `THE THIEF! INSPECT THE 4 CARDS [E], PICK 1, PLACE IT ON A COLOR, THEN PULL THE HAND LEVER!`,
      noticeTimer: 6.5
    };

    if (!fromNetwork && isMpMatch(matchState)) {
      App.Network.sendGameAction("MP_THIEF_START", {
        cards,
        requiredPlacements,
        nextOrderIdx: matchState.thiefEvent.nextOrderIdx,
        playerId: localPid,
        handFlags: localFlags
      });
    } else if (fromNetwork && isMpMatch(matchState)) {
      // Reply with our own hand category flags so Return Clue / Return Room knows every eligible player!
      App.Network.sendGameAction("MP_THIEF_HAND_FLAGS", {
        playerId: localPid,
        handFlags: localFlags
      });
    }

    // Bring player into The Dining Room & stand up cleanly!
    if (App.GameWorld && App.GameWorld.forceStandUpForEvent) {
      App.GameWorld.forceStandUpForEvent();
    }
    matchState.currentRoomCoord = { x: 0, y: 0 };

    App.Audio.hexAlert();
    return matchState.thiefEvent;
  }

  function getPlacedCount(th) {
    if (!th || !th.wheelSlots) return 0;
    return th.wheelSlots.filter(Boolean).length;
  }

  function canPullLever(th) {
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return false;
    return getPlacedCount(th) >= th.requiredPlacements;
  }

  function pickCardFromStand(matchState, standIdx, fromNetwork, netPlayerId) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return false;
    const pid = netPlayerId || getLocalPid();
    const stand = th.stands[standIdx];
    if (!stand || stand.takenBy) return false;
    if (typeof th.playerPickedStand[pid] === "number") return false; // Strictly 1 card per player!

    stand.takenBy = pid;
    th.playerPickedStand[pid] = standIdx;
    th.playerHoldingCard[pid] = stand.card;

    if (!fromNetwork) {
      closeStandModal(true);
      App.Audio.cardDraw();
      th.notice = `PICKED "${stand.card.name}"! WALK TO ANY EMPTY COLOR ON THE WHEEL AND PRESS [E] TO PLACE IT.`;
      th.noticeTimer = 4.5;
      if (isMpMatch(matchState)) {
        App.Network.sendGameAction("MP_THIEF_PICK", { standIdx, playerId: pid });
      }
    }
    return true;
  }

  function placeCardOnSlot(matchState, slotIdx, fromNetwork, netPlayerId) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return false;
    const pid = netPlayerId || getLocalPid();
    if (slotIdx < 0 || slotIdx > 3) return false;
    if (th.wheelSlots[slotIdx]) return false; // Strictly 1 card per colored quadrant!
    const card = th.playerHoldingCard[pid];
    if (!card) return false;

    th.wheelSlots[slotIdx] = { card, placedBy: pid };
    delete th.playerHoldingCard[pid];
    th.playerPlacedSlot[pid] = slotIdx;

    if (!fromNetwork) {
      App.Audio.cardPlay();
      const colName = WHEEL_SLOTS[slotIdx].name;
      const placed = getPlacedCount(th);
      th.notice = placed >= th.requiredPlacements
        ? `PLACED "${card.name}" ON ${colName}! WALK TO THE HUMAN-HANDS LEVER ON THE RIGHT AND PRESS [E] TO SPIN!`
        : `PLACED "${card.name}" ON ${colName} (${placed}/${th.requiredPlacements}) — WAITING FOR OTHER PLAYERS...`;
      th.noticeTimer = 4.8;
      if (isMpMatch(matchState)) {
        App.Network.sendGameAction("MP_THIEF_PLACE", { slotIdx, playerId: pid });
      }
    }
    return true;
  }

  function pullLeverToSpin(matchState, fromNetwork, netPayload) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return false;
    if (!fromNetwork && !canPullLever(th)) return false;

    // Pick random winning quadrant (exact 25% each: 0=GREEN, 1=RED, 2=BLUE, 3=YELLOW)
    const winningSlotIdx = (fromNetwork && netPayload && typeof netPayload.winningSlotIdx === "number")
      ? netPayload.winningSlotIdx
      : Math.floor(Math.random() * 4);

    // Top pointer sits at angle = -PI/2 (1.5*PI).
    // Slot center in wheel-local coords is `WHEEL_SLOTS[winningSlotIdx].baseAng`.
    // We want (baseAng + targetAngle) === 1.5*PI (mod 2*PI) +/- small random jitter inside the 90deg wedge!
    const jitter = (fromNetwork && netPayload && typeof netPayload.jitter === "number")
      ? netPayload.jitter
      : (Math.random() - 0.5) * 0.58;
    const baseAng = WHEEL_SLOTS[winningSlotIdx].baseAng;
    const desiredMod = (((Math.PI * 1.5 - baseAng + jitter) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const curMod = (((th.wheelAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const deltaMod = (desiredMod - curMod + Math.PI * 2) % (Math.PI * 2);
    const fullSpins = 5 * Math.PI * 2;

    // Pre-pick random target player for Return Clue / Return Room so Multiplayer clients stay 100% deterministic!
    let targetReturnPid = (fromNetwork && netPayload) ? netPayload.targetReturnPid : null;
    const placedEntry = th.wheelSlots[winningSlotIdx];
    if (!fromNetwork && placedEntry && (placedEntry.card.id === "return_clue" || placedEntry.card.id === "return_room")) {
      const needKey = placedEntry.card.id === "return_clue" ? "hasClue" : "hasRoom";
      const eligibles = Object.keys(th.handFlagsByPlayer || {}).filter(
        (pid) => th.handFlagsByPlayer[pid] && th.handFlagsByPlayer[pid][needKey]
      );
      if (eligibles.length > 0) {
        targetReturnPid = eligibles[Math.floor(Math.random() * eligibles.length)];
      }
    }

    th.stage = "SPINNING";
    th.winningSlotIdx = winningSlotIdx;
    th.targetReturnPid = targetReturnPid;
    th.spinStartAngle = th.wheelAngle;
    th.spinTargetAngle = th.wheelAngle + fullSpins + deltaMod;
    th.spinElapsed = 0;
    th.spinDuration = 4.2;
    th.spinLastTick = 0;
    th.leverPull = 0.01;
    th.notice = "THE HUMAN HANDS PULL THE LEVER — THE WHEEL SPINS...";
    th.noticeTimer = 4.4;

    if (!fromNetwork && isMpMatch(matchState)) {
      App.Network.sendGameAction("MP_THIEF_SPIN", {
        winningSlotIdx,
        jitter,
        targetReturnPid
      });
    }

    App.Audio.chairCreak();
    App.Audio.grooveTick();
    return true;
  }

  function resolveThiefSpinResult(matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return;

    th.stage = "RESULT";
    th.resultTimer = 3.2;

    const slot = WHEEL_SLOTS[th.winningSlotIdx] || WHEEL_SLOTS[0];
    const placed = th.wheelSlots[th.winningSlotIdx];

    if (!placed || !placed.card) {
      // LANDED ON EMPTY SLOT -> NOTHING HAPPENS!
      th.resultText = `WHEEL STOPPED ON EMPTY ${slot.name} SLOT — NOTHING HAPPENS!`;
      th.notice = th.resultText;
      th.noticeTimer = 3.2;
      App.Audio.click();
      if (App.Events && App.Events.showSmudgeBanner) {
        App.Events.showSmudgeBanner(
          `${slot.name} SLOT WAS EMPTY!\nNO EFFECT TRIGGERED — THE THIEF FADES AWAY.`,
          { success: true, typingDurationSec: 2.2, showChoices: false }
        );
      }
      return;
    }

    // LANDED ON PLACED CARD -> EXECUTE EFFECT!
    const card = placed.card;
    const summary = App.TableView && App.TableView.applyThiefGachaEffect
      ? App.TableView.applyThiefGachaEffect(card.id, {
          targetReturnPid: th.targetReturnPid,
          placedBy: placed.placedBy
        })
      : card.desc;

    th.resultText = `${slot.name}: ${card.name} — ${summary}`;
    th.notice = th.resultText;
    th.noticeTimer = 3.5;

    if (card.polarity === "negative") App.Audio.hexAlert();
    else App.Audio.clockChime();

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        `THE WHEEL CHOSE: ${card.name}!\n${summary}`,
        {
          danger: card.polarity === "negative",
          success: card.polarity === "positive",
          typingDurationSec: 2.5,
          showChoices: false
        }
      );
    }
  }

  function finishThiefEvent(matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th) return;
    const nextOrderIdx = th.nextOrderIdx;
    closeStandModal(true);
    if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
    th.active = false;
    matchState.thiefEvent = null;

    if (App.TableView && App.TableView.finishThiefTurn) {
      App.TableView.finishThiefTurn(nextOrderIdx);
    }
  }

  function update(dt, matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return;

    if (th.noticeTimer > 0) {
      th.noticeTimer = Math.max(0, th.noticeTimer - dt);
      if (th.noticeTimer === 0) th.notice = "";
    }

    if (th.stage === "SPINNING") {
      th.leverPull = Math.min(1, th.leverPull + dt * 4.2);
      th.spinElapsed += dt;
      const p = Math.min(1, th.spinElapsed / Math.max(0.2, th.spinDuration));
      // Smooth casino wheel deceleration (quartic ease-out)
      const ease = 1 - Math.pow(1 - p, 4);
      th.wheelAngle = th.spinStartAngle + (th.spinTargetAngle - th.spinStartAngle) * ease;

      const tickStep = Math.floor(th.wheelAngle / (Math.PI / 6));
      if (tickStep > th.spinLastTick) {
        th.spinLastTick = tickStep;
        App.Audio.grooveTick();
      }

      if (p >= 1) {
        th.wheelAngle = th.spinTargetAngle;
        resolveThiefSpinResult(matchState);
      }
      return;
    }

    if (th.stage === "RESULT") {
      th.resultTimer -= dt;
      if (th.resultTimer <= 0) {
        finishThiefEvent(matchState);
      }
    }
  }

  // ==================== 2. PIXEL-ART RENDERING IN THE DINING ROOM ====================
  // 2a. 4-Colored Roulette Table + Chasing Lights + Placed Cards + Pinned Thief Balaclava Head!
  function drawThiefRouletteTable(c, timeSec, matchState) {
    const th = matchState && matchState.thiefEvent;
    const ang = th ? th.wheelAngle : 0;
    const isResult = th && th.stage === "RESULT";

    // Ground shadow & pedestal
    fillPixelEllipse(c, CX, CY + 10, RX + 2, RY + 2, "rgba(0, 0, 0, 0.72)");
    px(c, CX - 7, CY + 15, 14, 12, "#1c110b");

    // Outer dark casino rim bezel
    fillPixelEllipse(c, CX, CY + 4, RX + 2, RY + 2, "#120c0c");
    fillPixelEllipse(c, CX, CY, RX + 2, RY + 2, "#1b1414");

    // 4 Colored Roulette Quadrants (projected neatly into 3/4 oval perspective!)
    c.save();
    c.translate(CX, CY);
    c.scale(1, RY / RX);

    for (let i = 0; i < 4; i++) {
      const slot = WHEEL_SLOTS[i];
      const a0 = ang + Math.PI + i * (Math.PI / 2);
      const a1 = a0 + Math.PI / 2;
      const isWinner = isResult && th.winningSlotIdx === i && Math.sin(timeSec * 18) > -0.2;

      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, RX - 3, a0, a1);
      c.closePath();
      c.fillStyle = isWinner ? slot.bright : slot.fill;
      c.fill();
      c.strokeStyle = "#100c0c";
      c.lineWidth = 1.6;
      c.stroke();

      // Dotted glowing LED carnival lights along every divider seam (matching image_434adb.png!)
      for (let d = 1; d <= 5; d++) {
        const dist = 6 + d * 4.6;
        const lx = Math.cos(a0) * dist;
        const ly = Math.sin(a0) * dist;
        const blink = Math.floor(timeSec * 8 + d + i) % 3 !== 0;
        c.fillStyle = blink ? "#fffbe0" : "#b8a87a";
        c.fillRect(Math.round(lx - 0.7), Math.round(ly - 0.7), 1.6, 1.6);
      }

      // Draw miniature Vintage Parchment Card resting flat on this quadrant if placed! (image_4d2c82.jpg)
      const placed = th && th.wheelSlots && th.wheelSlots[i];
      if (placed && placed.card) {
        const midA = a0 + Math.PI / 4;
        const cr = RX * 0.56;
        const kx = Math.cos(midA) * cr;
        const ky = Math.sin(midA) * cr;
        c.save();
        c.translate(kx, ky);
        c.rotate(midA + Math.PI / 2);
        c.fillStyle = "#1b120c";
        c.fillRect(-5.5, -6.5, 11, 13);
        c.fillStyle = placed.card.polarity === "negative" ? "#f0dfd4" : "#f4eed8";
        c.fillRect(-4.5, -5.5, 9, 11);
        c.fillStyle = placed.card.polarity === "negative" ? "#8c1a22" : "#246b3b";
        c.fillRect(-3.5, -4, 7, 2);
        c.fillStyle = "#2b1d14";
        c.fillRect(-3, -0.5, 6, 1);
        c.fillRect(-3, 1.8, 5, 1);
        c.restore();
      }
    }

    // 24 Chasing glowing carnival bulb lights around the outer black wheel rim!
    const bulbs = 24;
    for (let b = 0; b < bulbs; b++) {
      const ba = ang + (b / bulbs) * Math.PI * 2;
      const bx = Math.cos(ba) * (RX - 1.2);
      const by = Math.sin(ba) * (RX - 1.2);
      const lit = th && th.stage === "SPINNING"
        ? (b + Math.floor(timeSec * 18)) % 2 === 0
        : (b + Math.floor(timeSec * 4)) % 3 !== 0;
      c.fillStyle = lit ? "#fff9d6" : "#5e5340";
      c.fillRect(Math.round(bx - 0.9), Math.round(by - 0.9), 2, 2);
    }

    c.restore();

    // Fixed Brass / Ivory Top Pointer Needle at 12 o'clock pointing straight down into the winning quadrant!
    px(c, CX - 3, CY - RY - 5, 7, 4, "#24160c");
    px(c, CX - 2, CY - RY - 4, 5, 3, "#e8c45e");
    px(c, CX - 1, CY - RY - 1, 3, 4, "#fff2b2");
    px(c, CX,     CY - RY + 3, 1, 2, "#ff3b3b");

    // === PINNED SEVERED THIEF HEAD IN CENTER (Black Balaclava + Green & Red Poker Chip Eyes — image_434adb.png!) ===
    const hx = CX;
    const hy = CY - 2;
    const headBob = th && th.stage === "SPINNING" ? Math.round(Math.sin(timeSec * 22) * 0.8) : 0;
    // Iron pin collar anchoring the head in the dead center of the wheel
    fillPixelEllipse(c, hx, hy + 4, 7, 4, "#120f12");
    px(c, hx - 4, hy + 1, 8, 5, "#1a171c");
    // Black knit balaclava ski-mask head
    px(c, hx - 5, hy - 12 + headBob, 10, 14, "#08080b");
    px(c, hx - 4, hy - 13 + headBob, 8,  14, "#131318");
    px(c, hx - 3, hy - 12 + headBob, 6,  3,  "#22222a"); // Knit crown highlight
    // Pale skin slit around eyes inside balaclava opening
    px(c, hx - 4, hy - 9 + headBob, 8, 4, "#bfa392");
    // LEFT EYE: Green & White Striped Poker Chip!
    px(c, hx - 4, hy - 9 + headBob, 4, 4, "#1f7a4c");
    px(c, hx - 3, hy - 8 + headBob, 2, 2, "#f2f7f4");
    // RIGHT EYE: Red & White Striped Poker Chip!
    px(c, hx + 1, hy - 9 + headBob, 4, 4, "#b8242c");
    px(c, hx + 2, hy - 8 + headBob, 2, 2, "#f5ebe8");
    // Knit ski-mask rib texture over mouth/jaw
    px(c, hx - 3, hy - 4 + headBob, 1, 4, "#1f1f26");
    px(c, hx - 1, hy - 4 + headBob, 1, 4, "#1f1f26");
    px(c, hx + 1, hy - 4 + headBob, 1, 4, "#1f1f26");
    px(c, hx + 3, hy - 4 + headBob, 1, 4, "#1f1f26");
  }

  // 2b. Tall Dark Stand holding a Vintage Gacha Card (Matches image_434abd.png!)
  function drawGachaCardStand(c, stand, timeSec) {
    const x = Math.round(stand.x);
    const y = Math.round(stand.y);

    // Floor base shadow & iron pole stand
    c.fillStyle = "rgba(0,0,0,0.52)";
    c.fillRect(x - 5, y + 1, 10, 3);
    px(c, x - 3, y,      7, 2, "#1c1816");
    px(c, x,     y - 16, 2, 16, "#26211e");
    px(c, x,     y - 16, 1, 16, "#453d38");

    if (stand.takenBy) return; // Empty stand once taken!

    const hover = Math.sin(timeSec * 3.0 + stand.standIdx) > 0.4 ? -1 : 0;
    // Ornate cream/parchment Gacha Card mounted upright on stand!
    px(c, x - 6, y - 27 + hover, 13, 14, "#140e0a");
    px(c, x - 5, y - 26 + hover, 11, 12, "#ece3cd");
    // Tiny vintage dark ink border & header lines
    px(c, x - 4, y - 25 + hover, 9,  2,  stand.card.polarity === "negative" ? "#7a1920" : "#225c36");
    px(c, x - 4, y - 21 + hover, 9,  1,  "#2a1e16");
    px(c, x - 4, y - 19 + hover, 7,  1,  "#453428");
    px(c, x - 4, y - 17 + hover, 8,  1,  "#453428");
  }

  // 2c. Creepy Human-Hands Lever (`cần gạt hình đôi tay người`)!
  function drawHumanHandsLever(c, th, timeSec) {
    const x = LEVER_POS.x;
    const y = LEVER_POS.y;
    const unlocked = canPullLever(th);
    const pulled = th ? th.leverPull : 0;

    // Heavy iron/wood mechanical pedestal box on floor
    c.fillStyle = "rgba(0,0,0,0.56)";
    c.fillRect(x - 9, y + 2, 18, 4);
    px(c, x - 8, y - 8, 16, 11, "#18100c");
    px(c, x - 7, y - 7, 14, 9,  "#4a2f1d");
    px(c, x - 5, y - 5, 10, 5,  "#261a14");
    // Ready indicator bulb on lever pedestal (Red = locked, Green = ready to pull!)
    const bulbOn = unlocked ? (Math.sin(timeSec * 7) > -0.3 ? "#62f58e" : "#2c8a48") : "#a82424";
    px(c, x - 1, y - 3, 3, 2, bulbOn);

    // Iron Lever Shaft + Pair of Pale Human Hands clasping the handle!
    const dyHand = Math.round(pulled * 8);
    px(c, x - 1, y - 21 + dyHand, 3, 14 - Math.round(pulled * 5), "#5e6670");
    px(c, x,     y - 21 + dyHand, 1, 13 - Math.round(pulled * 5), "#a8b4c2");

    // Crossbar T-grip
    px(c, x - 7, y - 22 + dyHand, 15, 3, "#2b2e33");
    px(c, x - 6, y - 21 + dyHand, 13, 1, "#8d99a6");

    // LEFT & RIGHT PALE HUMAN HANDS sculpted/clasped tightly onto the lever handle!
    // Left pale hand + curled fingers
    px(c, x - 7, y - 24 + dyHand, 5, 6, "#5c3b2e");
    px(c, x - 6, y - 23 + dyHand, 4, 4, "#dfc2ab");
    px(c, x - 5, y - 23 + dyHand, 2, 2, "#f2dac7");
    px(c, x - 6, y - 19 + dyHand, 3, 2, "#c29f88"); // Wrist cuff
    // Right pale hand + curled fingers
    px(c, x + 3, y - 24 + dyHand, 5, 6, "#5c3b2e");
    px(c, x + 3, y - 23 + dyHand, 4, 4, "#dfc2ab");
    px(c, x + 4, y - 23 + dyHand, 2, 2, "#f2dac7");
    px(c, x + 4, y - 19 + dyHand, 3, 2, "#c29f88");
  }

  function getParlorRenderables(ctx, timeSec, matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return [];
    const list = [];

    th.stands.forEach((st) => {
      list.push({
        y: st.y,
        draw: () => drawGachaCardStand(ctx, st, timeSec)
      });
    });

    list.push({
      y: LEVER_POS.y,
      draw: () => drawHumanHandsLever(ctx, th, timeSec)
    });

    return list;
  }

  // Spotlight cutouts punched into the dark Dining Room mask!
  function getDarknessLightCutouts(matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return [];
    const cuts = [
      { x: CX, y: CY - 2, r: 62, strength: 0.94 }, // Central 4-color Roulette Wheel + Thief Head
      { x: LEVER_POS.x, y: LEVER_POS.y - 12, r: 28, strength: 0.84 } // Human-Hands Lever
    ];
    th.stands.forEach((st) => {
      if (!st.takenBy) {
        cuts.push({ x: st.x, y: st.y - 16, r: 24, strength: 0.86 });
      }
    });
    return cuts;
  }

  // Post-darkness highlights: glowing poker-chip eyes, active colored slot placement hint & held card!
  function renderParlorHighlights(ctx, timeSec, matchState, player) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return;

    const pulse = 0.68 + Math.sin(timeSec * 5.2) * 0.30;

    // Subtle eerie glow on the Thief's Green & Red Poker-Chip eyes in the center of the wheel
    px(ctx, CX - 3, CY - 10, 2, 2, "#8cffbe");
    px(ctx, CX + 2, CY - 10, 2, 2, "#ff8c94");

    const drawMiniHeldCard = (pxPos, pyPos, facingDir, cardObj) => {
      const hx = Math.round(pxPos + (facingDir || 1) * 7);
      const hy = Math.round(pyPos - 10);
      px(ctx, hx - 3, hy - 4, 7, 9, "#1c120a");
      px(ctx, hx - 2, hy - 3, 5, 7, "#f5ecd4");
      px(ctx, hx - 1, hy - 2, 3, 2, cardObj.polarity === "negative" ? "#9e1c24" : "#26733f");
    };

    // Draw held Gacha card for ALL remote teammates in The Dining Room!
    if (th.stage === "PICK_AND_PLACE" && App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch() && App.Network.getRemotePlayersInRoom) {
      App.Network.getRemotePlayersInRoom(0, 0).forEach((rp) => {
        if (!rp || rp.deadSpectator || rp.deadInEvent || rp.inAttic || rp.inBasement) return;
        const rCard = th.playerHoldingCard[rp.playerId];
        if (rCard) drawMiniHeldCard(rp.x, rp.y, rp.facing, rCard);
      });
    }

    // If local player is holding a picked Gacha card: draw mini card next to player & highlight empty wheel slots!
    const localPid = getLocalPid();
    const heldCard = th.playerHoldingCard[localPid];
    if (heldCard && th.stage === "PICK_AND_PLACE") {
      if (player) {
        drawMiniHeldCard(player.x, player.y, player.facing, heldCard);
      }

      // Highlight the 4 empty colored placement spots around the wheel so player sees where to press [E]!
      WHEEL_SLOTS.forEach((slot) => {
        if (th.wheelSlots[slot.idx]) return;
        const near = player && Math.hypot(player.x - slot.placeX, player.y - slot.placeY) <= 26;
        ctx.save();
        ctx.strokeStyle = slot.rim;
        ctx.globalAlpha = near ? 0.95 : 0.45 * pulse;
        ctx.lineWidth = near ? 2.0 : 1.2;
        ctx.beginPath();
        ctx.arc(slot.placeX, slot.placeY, near ? 8 : 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Highlight unlocked Human-Hands Lever with a beckoning golden ring!
    if (canPullLever(th)) {
      const g = ctx.createRadialGradient(LEVER_POS.x, LEVER_POS.y - 16, 2, LEVER_POS.x, LEVER_POS.y - 16, 20);
      g.addColorStop(0, `rgba(120, 245, 160, ${(0.34 * pulse).toFixed(3)})`);
      g.addColorStop(1, "rgba(120, 245, 160, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(LEVER_POS.x - 20, LEVER_POS.y - 36, 40, 40);
    }
  }

  // ==================== 3. INTERACTION PROMPTS & VINTAGE CARD STAND MODAL ====================
  function getParlorInteractable(matchState, player) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return null;

    const localPid = getLocalPid();
    const heldCard = th.playerHoldingCard[localPid];
    const hasPickedAlready = typeof th.playerPickedStand[localPid] === "number";

    // 1. Check Human-Hands Lever
    if (Math.hypot(player.x - LEVER_POS.x, player.y - LEVER_POS.y) <= 24) {
      if (canPullLever(th)) {
        return {
          type: "thief_pull_lever",
          prompt: "[E] PULL HUMAN-HANDS LEVER TO SPIN THE WHEEL!"
        };
      }
      return {
        type: "thief_lever_locked",
        prompt: `LEVER LOCKED — PLACE CARD ON A COLOR FIRST (${getPlacedCount(th)}/${th.requiredPlacements})`
      };
    }

    // 2. If holding a picked card -> Check nearest colored wheel slot to place it!
    if (heldCard) {
      let bestSlot = null;
      let bestDist = 30;
      for (const slot of WHEEL_SLOTS) {
        const d = Math.hypot(player.x - slot.placeX, player.y - slot.placeY);
        if (d < bestDist) {
          bestDist = d;
          bestSlot = slot;
        }
      }
      if (bestSlot) {
        if (th.wheelSlots[bestSlot.idx]) {
          return {
            type: "thief_slot_full",
            prompt: `${bestSlot.name} SLOT ALREADY HAS A CARD — PICK AN EMPTY COLOR!`
          };
        }
        return {
          type: "thief_place_slot",
          slotIdx: bestSlot.idx,
          prompt: `[E] PLACE "${heldCard.name}" ON ${bestSlot.name} SLOT`
        };
      }
    }

    // 3. Check 4 Gacha Card Stands!
    let bestStand = null;
    let bestStandDist = 20;
    for (const st of th.stands) {
      if (st.takenBy) continue;
      const d = Math.hypot(player.x - st.x, player.y - st.y);
      if (d < bestStandDist) {
        bestStandDist = d;
        bestStand = st;
      }
    }
    if (bestStand) {
      return {
        type: "thief_inspect_stand",
        standIdx: bestStand.standIdx,
        prompt: hasPickedAlready
          ? `[E] READ "${bestStand.card.name}" (ALREADY PICKED YOUR 1 CARD)`
          : `[E] INSPECT & PICK: ${bestStand.card.name}`
      };
    }

    return null;
  }

  function openStandModal(matchState, standIdx) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active || th.stage !== "PICK_AND_PLACE") return false;
    const stand = th.stands[standIdx];
    if (!stand || stand.takenBy) return false;

    const modal = document.getElementById("thief-stand-modal");
    const headerEl = document.getElementById("thief-stand-header");
    const titleEl = document.getElementById("thief-stand-title");
    const tagEl = document.getElementById("thief-stand-tag");
    const descEl = document.getElementById("thief-stand-desc");
    const takeBtn = document.getElementById("thief-stand-take-btn");
    if (!modal) {
      return pickCardFromStand(matchState, standIdx, false);
    }

    const localPid = getLocalPid();
    const canTake = typeof th.playerPickedStand[localPid] !== "number";
    const card = stand.card;

    if (headerEl) headerEl.textContent = card.header;
    if (titleEl) titleEl.textContent = card.name;
    if (tagEl) {
      tagEl.textContent = card.polarity === "negative" ? "PENALTY EFFECT" : "BENEFICIAL EFFECT";
      tagEl.className = `th-card-polarity ${card.polarity === "negative" ? "is-neg" : "is-pos"}`;
    }
    if (descEl) descEl.textContent = card.desc;
    if (takeBtn) {
      takeBtn.classList.toggle("hidden", !canTake);
      takeBtn.textContent = "[E] PICK THIS CARD";
    }

    inspectedStandIdx = standIdx;
    standModalOpen = true;
    modal.classList.remove("hidden");
    App.Audio.open();
    return true;
  }

  function closeStandModal(silent) {
    if (!standModalOpen) return;
    standModalOpen = false;
    inspectedStandIdx = -1;
    document.getElementById("thief-stand-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  function confirmTakeInspectedStand(matchState) {
    if (!standModalOpen || inspectedStandIdx < 0) return false;
    return pickCardFromStand(matchState, inspectedStandIdx, false);
  }

  function getHudSummary(matchState) {
    const th = matchState && matchState.thiefEvent;
    if (!th || !th.active) return null;

    if (th.stage === "SPINNING") {
      return {
        title: "THE THIEF • SPINNING THE 4-COLOR WHEEL...",
        sub: "EMPTY SLOT = NOTHING HAPPENS  |  PLACED CARD = EFFECT ACTIVATES!",
        notice: th.notice || ""
      };
    }
    if (th.stage === "RESULT") {
      return {
        title: "THE THIEF • RESULT",
        sub: th.resultText || "",
        notice: ""
      };
    }

    const localPid = getLocalPid();
    const held = th.playerHoldingCard[localPid];
    const placed = getPlacedCount(th);
    const sub = held
      ? `HOLDING: ${held.name} — WALK TO GREEN/RED/BLUE/YELLOW SLOT & PRESS [E]`
      : canPullLever(th)
        ? `CARDS PLACED (${placed}/${th.requiredPlacements}) — PULL THE HUMAN-HANDS LEVER [E] ON THE RIGHT!`
        : typeof th.playerPlacedSlot[localPid] === "number"
          ? `YOU PLACED YOUR CARD (${placed}/${th.requiredPlacements}) — WAITING FOR OTHER PLAYERS...`
          : `WALK TO THE 4 STANDS (NORTH) TO INSPECT & PICK 1 CARD [E] (${placed}/${th.requiredPlacements})`;

    return {
      title: `THE THIEF • 4-COLOR ROULETTE (${placed}/${th.requiredPlacements} PLACED)`,
      sub,
      notice: th.notice || ""
    };
  }

  function handleNetworkMessage(action, payload, matchState) {
    if (!matchState || !action) return false;
    const p = payload || {};

    if (action === "MP_THIEF_START") {
      startThiefEvent(matchState, {
        fromNetwork: true,
        cards: p.cards,
        nextOrderIdx: p.nextOrderIdx
      });
      if (matchState.thiefEvent && p.playerId && p.handFlags) {
        matchState.thiefEvent.handFlagsByPlayer[p.playerId] = p.handFlags;
      }
      return true;
    }

    const th = matchState.thiefEvent;
    if (!th || !th.active) return false;

    if (action === "MP_THIEF_HAND_FLAGS" && p.playerId && p.handFlags) {
      th.handFlagsByPlayer[p.playerId] = p.handFlags;
      return true;
    }

    if (action === "MP_THIEF_PICK" && typeof p.standIdx === "number") {
      pickCardFromStand(matchState, p.standIdx, true, p.playerId);
      return true;
    }

    if (action === "MP_THIEF_PLACE" && typeof p.slotIdx === "number") {
      placeCardOnSlot(matchState, p.slotIdx, true, p.playerId);
      return true;
    }

    if (action === "MP_THIEF_SPIN") {
      pullLeverToSpin(matchState, true, p);
      return true;
    }

    return false;
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.thiefEvent && matchState.thiefEvent.active);
  }

  function cleanup(matchState) {
    closeStandModal(true);
    if (matchState) matchState.thiefEvent = null;
  }

  App.Thief = {
    WHEEL_SLOTS,
    STAND_POSITIONS,
    LEVER_POS,
    startThiefEvent,
    pickCardFromStand,
    placeCardOnSlot,
    pullLeverToSpin,
    openStandModal,
    closeStandModal,
    confirmTakeInspectedStand,
    isStandModalOpen: () => standModalOpen,
    update,
    drawThiefRouletteTable,
    getParlorRenderables,
    getDarknessLightCutouts,
    renderParlorHighlights,
    getParlorInteractable,
    getHudSummary,
    handleNetworkMessage,
    isActive,
    cleanup
  };
})(window.Duskwood);
