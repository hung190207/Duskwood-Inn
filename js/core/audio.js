/* ==========================================================================
   DUSKWOOD INN - Sound Effects, Lobby BGM, Intro Bulb & Spatial Clock Tick
   - Lobby BGM:   `audio/dont-go.mp3` default -> built-in piano fallback
   - Intro SFX:   `audio/broken_light.mp3` (6s; flicker 2.0s -> ~3.85s) -> synth
   - Parlor SFX:  `audio/clock_tick.mp3` looping spatial tick -> wood tick synth
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  let ctx = null;

  // Lobby BGM state
  let inLobby = true;
  let bgmAudioEl = null;
  let mp3Failed = false;
  let synthTimer = null;
  let synthStep = 0;

  // Ending BGM state (audio/good_end_bgm.mp3 & audio/game_over_bgm.mp3)
  let goodEndBgmEl = null;
  let goodEndBgmFailed = false;
  let goodEndBgmActive = false;
  let goodEndFallbackTimer = null;
  let goodEndStep = 0;

  let gameOverBgmEl = null;
  let gameOverBgmFailed = false;
  let gameOverBgmActive = false;
  let gameOverFallbackTimer = null;
  let gameOverStep = 0;

  // The Attic Exorcism SFX (audio/exorcism_sfx.mp3)
  let exorcismEl = null;
  let exorcismFailed = false;
  let exorcismActive = false;

  // Shared Event Monster Jumpscare SFX (audio/jumpscare.mp3 — 4.0 seconds)
  let jumpscareEl = null;
  let jumpscareFailed = false;
  let jumpscareActive = false;
  let jumpscareStopTimer = null;
  let jumpscareFadeInterval = null;

  // Broken Light Intro SFX state (audio/broken_light.mp3)
  let brokenLightEl = null;
  let brokenLightFailed = false;
  let brokenLightStartMs = 0;
  let brokenLightActive = false;
  let brokenLightTimeouts = [];

  // Main Parlor Spatial Clock Tick state (audio/clock_tick.mp3)
  let clockTickEl = null;
  let clockTickFailed = false;
  let clockTickActive = false;
  let clockTickAttenuation = 1.0;
  let clockTickTimer = null;
  let clockTickPhase = 0;

  // Table Intro SFX state (audio/human_intro.mp3 — 11s total)
  let humanIntroEl = null;
  let humanIntroFailed = false;
  let humanIntroStartMs = 0;
  let humanIntroActive = false;

  // Card Draw SFX pool (audio/draw_card.mp3 — 4-slot pool for crisp 3x consecutive starter deal!)
  let drawCardPool = [];
  let drawCardPoolIdx = 0;
  let drawCardFailed = false;

  // Outer Rim Turn Rotation SFX state (reuses audio/human_intro.mp3, 4.0s -> 11.0s)
  let rimTurnEl = null;
  let rimTurnFailed = false;
  let rimTurnActive = false;
  let rimTurnStopTimer = null;
  let rimTurnFadeInterval = null;

  // Pawn Slow Glide SFX state (audio/moving.mp3 — 4.0s total)
  let pawnMoveEl = null;
  let pawnMoveFailed = false;
  let pawnMoveActive = false;
  let pawnMoveStopTimer = null;
  let pawnMoveFadeInterval = null;
  let pawnMoveLoopTimer = null;

  // Grandfather Clock Clue Reveal SFX state (audio/grandfather_clock_sfx.mp3, plays 3.0s -> 11.0s)
  let gfClockEl = null;
  let gfClockFailed = false;
  let gfClockActive = false;
  let gfClockStopTimer = null;
  let gfClockFadeInterval = null;
  let gfClockFallbackTimers = [];

  // Event Card Drawn SFX state (audio/event_draw.mp3 — 4.0 seconds)
  let eventDrawEl = null;
  let eventDrawFailed = false;
  let eventDrawActive = false;
  let eventDrawStopTimer = null;
  let eventDrawFadeInterval = null;

  // Event Typewriter SFX state (audio/typing.mp3 — 5.0 seconds)
  let typingEl = null;
  let typingFailed = false;
  let typingActive = false;
  let typingStopTimer = null;
  let typingFadeInterval = null;
  let typingFallbackInterval = null;

  // Red Balloons Clown Laugh Ambient Loop (audio/clown_laugh.mp3 — loops 0.0s -> 9.0s)
  const CLOWN_LOOP_END_SEC = 9.0;
  let clownEl = null;
  let clownFailed = false;
  let clownActive = false;
  let clownWatchTimer = null;
  let clownFallbackTimer = null;

  // Midnight Endgame Alarm SFX (audio/end_game_alarm.mp3 — played 3 times!)
  let endAlarmEl = null;
  let endAlarmFailed = false;
  let endAlarmActive = false;
  let endAlarmTimers = [];

  // Wrong-Room Light Shatter SFX (audio/light_break.mp3 — 5.0 seconds per wave)
  let lightBreakEl = null;
  let lightBreakFailed = false;
  let lightBreakActive = false;
  let lightBreakStopTimer = null;
  let lightBreakFadeInterval = null;

  // Feeling Small? Spatial Toy Train Loop (audio/toy_train_sfx.mp3 — 20s, heard across rooms!)
  const TOY_TRAIN_LOOP_END_SEC = 20.0;
  let toyTrainEl = null;
  let toyTrainFailed = false;
  let toyTrainActive = false;
  let toyTrainAttenuation = 1.0;
  let toyTrainWatchTimer = null;
  let toyTrainFallbackTimer = null;
  let toyTrainBeat = 0;

  // The Attic Ghost Spatial Loop (audio/attic_ghost_sfx.mp3 — loops strictly 1.0s -> 3.0s!)
  const ATTIC_GHOST_START_SEC = 1.0;
  const ATTIC_GHOST_END_SEC = 3.0;
  let atticGhostEl = null;
  let atticGhostFailed = false;
  let atticGhostActive = false;
  let atticGhostAttenuation = 0.0;
  let atticGhostWatchTimer = null;
  let atticGhostFallbackTimer = null;

  // Musical Rooms Music Box (audio/music_rooms_sfx.mp3 — 28s file, strictly 0.0s -> 20.0s!)
  const MUSIC_BOX_LIMIT_SEC = 20.0;
  let musicBoxEl = null;
  let musicBoxFailed = false;
  let musicBoxActive = false;
  let musicBoxWatchTimer = null;
  let musicBoxFallbackTimer = null;
  let musicBoxStep = 0;

  // Giant Monkey SFX (audio/monkey_sfx.mp3 — 9.0 seconds, spatial during chase!)
  const MONKEY_CLIP_END_SEC = 9.0;
  let monkeyEl = null;
  let monkeyFailed = false;
  let monkeyActive = false;
  let monkeyLoopMode = false;
  let monkeyAttenuation = 1.0;
  let monkeyWatchTimer = null;
  let monkeyFallbackTimer = null;

  // The Basement Hydraulic Descent / Ascent Rumble (audio/basement_start_sfx.mp3 — 14.0s)
  const BASEMENT_SLIDE_SEC = 14.0;
  let basementSlideEl = null;
  let basementSlideFailed = false;
  let basementSlideActive = false;
  let basementSlideStopTimer = null;
  let basementSlideFadeInterval = null;
  let basementSlideFallbackTimer = null;

  // The Basement Chainsaw-Head Monster Spatial Loop (audio/chainsaw_sfx.mp3 — 11.0s)
  const CHAINSAW_LOOP_END_SEC = 11.0;
  let chainsawEl = null;
  let chainsawFailed = false;
  let chainsawActive = false;
  let chainsawAttenuation = 0.0;
  let chainsawWatchTimer = null;
  let chainsawFallbackTimer = null;

  // Red Balloons Spatial Proximity Loop (audio/balloons_sfx.mp3)
  let balloonsSfxEl = null;
  let balloonsSfxFailed = false;
  let balloonsSfxActive = false;
  let balloonsSfxAttenuation = 0.0;
  let balloonsSfxFallbackTimer = null;

  // Stay in the Light Random Switch Surge (audio/light_switch_sfx.mp3 — 4.0s)
  let lightSurgeEl = null;
  let lightSurgeFailed = false;
  let lightSurgeActive = false;
  let lightSurgeStopTimer = null;
  let lightSurgeFadeInterval = null;

  // The Neighbor Door Knock SFX (audio/door_knock_sfx.mp3 — preloaded + silence-trimmed)
  let doorKnockEl = null;
  let doorKnockFailed = false;
  let doorKnockActive = false;
  let doorKnockTrimSec = 0;
  let doorKnockStopTimer = null;
  let doorKnockFadeInterval = null;
  let doorKnockTimers = [];

  // The Neighbor Door Open SFX (audio/door_open_sfx.mp3 — preloaded + silence-trimmed)
  let doorOpenEl = null;
  let doorOpenFailed = false;
  let doorOpenActive = false;
  let doorOpenTrimSec = 0;
  let doorOpenStopTimer = null;
  let doorOpenFadeInterval = null;

  // The Knight Armored Movement SFX (audio/knight_footstep_sfx.mp3 — strictly 0.0s -> 2.0s loop)
  const KNIGHT_STEP_END_SEC = 2.0;
  let knightStepEl = null;
  let knightStepFailed = false;
  let knightStepActive = false;
  let knightStepWatchTimer = null;
  let knightStepStopTimer = null;
  let knightStepFadeInterval = null;
  let knightStepFallbackTimers = [];

  const PIANO_SEQUENCE = [
    [[329.63, 440.00], 110.00, 1.45],
    [[523.25],         0,      0.95],
    [[493.88],         0,      1.20],
    [[440.00],         110.00, 1.80],

    [[329.63, 440.00], 87.31,  1.45],
    [[523.25],         0,      0.95],
    [[493.88],         0,      1.20],
    [[392.00],         87.31,  1.80],

    [[293.66, 392.00], 130.81, 1.45],
    [[440.00],         0,      0.95],
    [[392.00],         0,      1.20],
    [[329.63],         130.81, 1.80],

    [[293.66, 349.23], 98.00,  1.50],
    [[329.63],         0,      1.10],
    [[293.66],         0,      1.25],
    [[246.94, 329.63], 82.41,  2.20]
  ];

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function getSfxVol() {
    return App.Config ? App.Config.state.options.sfxVolume : 0.65;
  }

  function getBgmVol() {
    return App.Config ? App.Config.state.options.bgmVolume : 0.55;
  }

  function playTone(freq, duration, type, gainScale, slideTo) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    const peak = Math.max(0.001, vol * (gainScale || 0.16));
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  // ==================== FALLBACK PIANO SYNTH (LOBBY) ====================
  function playPianoNote(freq, dur, isBass) {
    const vol = getBgmVol();
    if (!inLobby || vol <= 0.001 || !freq) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const oscMain = audio.createOscillator();
    const oscOvertone = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    oscMain.type = "triangle";
    oscMain.frequency.setValueAtTime(freq, now);
    oscOvertone.type = "sine";
    oscOvertone.frequency.setValueAtTime(freq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(isBass ? 420 : 1250, now);
    filter.frequency.exponentialRampToValueAtTime(260, now + dur * 1.3);

    const peak = vol * (isBass ? 0.13 : 0.10);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + dur * 1.45);

    const overGain = audio.createGain();
    overGain.gain.value = 0.22;

    oscMain.connect(filter);
    oscOvertone.connect(overGain);
    overGain.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    oscMain.start(now);
    oscOvertone.start(now);
    oscMain.stop(now + dur * 1.5);
    oscOvertone.stop(now + dur * 1.5);
  }

  function stopSynthFallback() {
    clearTimeout(synthTimer);
    synthTimer = null;
  }

  function scheduleSynthLoop() {
    stopSynthFallback();
    if (!inLobby || !mp3Failed) return;

    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const [melody, bass, dur] = PIANO_SEQUENCE[synthStep % PIANO_SEQUENCE.length];
    if (bass) playPianoNote(bass, dur + 0.6, true);
    melody.forEach((f, i) => {
      setTimeout(() => playPianoNote(f, dur + 0.4, false), i * 35);
    });

    synthStep = (synthStep + 1) % PIANO_SEQUENCE.length;
    synthTimer = setTimeout(scheduleSynthLoop, dur * 1000);
  }

  function activateFallback(reason) {
    if (!mp3Failed) {
      mp3Failed = true;
      console.warn(
        "[Duskwood Audio] Could not play 'audio/dont-go.mp3' (" +
          reason +
          "). Switching to built-in piano BGM."
      );
    }
    if (bgmAudioEl && !bgmAudioEl.paused) {
      bgmAudioEl.pause();
    }
    if (inLobby && !synthTimer) {
      scheduleSynthLoop();
    }
  }

  // ==================== PRIMARY LOBBY BGM: audio/dont-go.mp3 ====================
  function ensureBgmElement() {
    if (bgmAudioEl) return bgmAudioEl;
    bgmAudioEl = new Audio("audio/dont-go.mp3");
    bgmAudioEl.loop = true;
    bgmAudioEl.preload = "auto";
    bgmAudioEl.addEventListener("error", () => {
      activateFallback("file missing or unsupported format");
    });
    return bgmAudioEl;
  }

  function startLobbyBgm() {
    stopGoodEndBgm();
    stopGameOverBgm();
    inLobby = true;
    if (mp3Failed) {
      if (!synthTimer) scheduleSynthLoop();
      return;
    }

    const audioEl = ensureBgmElement();
    audioEl.volume = Math.max(0, Math.min(1, getBgmVol()));
    if (!audioEl.paused) return;

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => stopSynthFallback())
        .catch((err) => {
          if (err && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
          activateFallback(err ? err.name : "playback error");
        });
    }
  }

  function stopLobbyBgm() {
    inLobby = false;
    stopSynthFallback();
    if (bgmAudioEl && !bgmAudioEl.paused) {
      bgmAudioEl.pause();
      bgmAudioEl.currentTime = 0;
    }
  }

  function syncBgmVolume() {
    const v = Math.max(0, Math.min(1, getBgmVol()));
    if (bgmAudioEl) bgmAudioEl.volume = v;
    if (goodEndBgmEl && !goodEndBgmFailed) goodEndBgmEl.volume = v;
    if (gameOverBgmEl && !gameOverBgmFailed) gameOverBgmEl.volume = v;
  }

  // ==================== WINNING SCENE BGM (audio/good_end_bgm.mp3) ====================
  const GOOD_END_CHORDS = [
    [261.63, 329.63, 392.00],
    [220.00, 329.63, 440.00],
    [174.61, 261.63, 349.23],
    [196.00, 293.66, 392.00]
  ];

  function stopGoodEndBgm() {
    goodEndBgmActive = false;
    clearInterval(goodEndFallbackTimer);
    goodEndFallbackTimer = null;
    if (goodEndBgmEl && !goodEndBgmEl.paused) {
      goodEndBgmEl.pause();
      try { goodEndBgmEl.currentTime = 0; } catch (_) {}
    }
  }

  function startGoodEndFallback() {
    clearInterval(goodEndFallbackTimer);
    if (!goodEndBgmActive) return;
    goodEndStep = 0;
    const playChord = () => {
      if (!goodEndBgmActive) return;
      const vol = getBgmVol();
      if (vol <= 0.001) return;
      const audio = ensureContext();
      if (!audio || audio.state !== "running") return;
      const chord = GOOD_END_CHORDS[goodEndStep % GOOD_END_CHORDS.length];
      goodEndStep += 1;
      const now = audio.currentTime;
      chord.forEach((f) => {
        const osc = audio.createOscillator();
        const g = audio.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.0005, now);
        g.gain.linearRampToValueAtTime(vol * 0.08, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 2.3);
        osc.connect(g);
        g.connect(audio.destination);
        osc.start(now);
        osc.stop(now + 2.4);
      });
    };
    playChord();
    goodEndFallbackTimer = setInterval(playChord, 2400);
  }

  function startGoodEndBgm() {
    stopLobbyBgm();
    stopGameOverBgm();
    if (goodEndBgmActive) return;
    goodEndBgmActive = true;

    if (goodEndBgmFailed) {
      startGoodEndFallback();
      return;
    }

    if (!goodEndBgmEl) {
      goodEndBgmEl = new Audio("audio/good_end_bgm.mp3");
      goodEndBgmEl.loop = true;
      goodEndBgmEl.preload = "auto";
      goodEndBgmEl.addEventListener("error", () => {
        if (!goodEndBgmFailed) {
          goodEndBgmFailed = true;
          console.warn("[Duskwood Audio] 'audio/good_end_bgm.mp3' not found. Using dawn chord synth.");
          if (goodEndBgmActive) startGoodEndFallback();
        }
      });
    }

    try {
      goodEndBgmEl.currentTime = 0;
      goodEndBgmEl.volume = Math.max(0, Math.min(1, getBgmVol()));
      const p = goodEndBgmEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!goodEndBgmFailed) {
            goodEndBgmFailed = true;
            if (goodEndBgmActive) startGoodEndFallback();
          }
        });
      }
    } catch (_) {
      goodEndBgmFailed = true;
      startGoodEndFallback();
    }
  }

  // ==================== LOSE / GAME OVER BGM (audio/game_over_bgm.mp3) ====================
  const GAME_OVER_NOTES = [110.0, 103.83, 98.0, 82.41];

  function stopGameOverBgm() {
    gameOverBgmActive = false;
    clearInterval(gameOverFallbackTimer);
    gameOverFallbackTimer = null;
    if (gameOverBgmEl && !gameOverBgmEl.paused) {
      gameOverBgmEl.pause();
      try { gameOverBgmEl.currentTime = 0; } catch (_) {}
    }
  }

  function startGameOverFallback() {
    clearInterval(gameOverFallbackTimer);
    if (!gameOverBgmActive) return;
    gameOverStep = 0;
    const playDirge = () => {
      if (!gameOverBgmActive) return;
      const vol = getBgmVol();
      if (vol <= 0.001) return;
      const audio = ensureContext();
      if (!audio || audio.state !== "running") return;
      const f = GAME_OVER_NOTES[gameOverStep % GAME_OVER_NOTES.length];
      gameOverStep += 1;
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const lp = audio.createBiquadFilter();
      const g = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 2.5);
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(360, now);
      g.gain.setValueAtTime(0.0005, now);
      g.gain.linearRampToValueAtTime(vol * 0.14, now + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 2.5);
      osc.connect(lp);
      lp.connect(g);
      g.connect(audio.destination);
      osc.start(now);
      osc.stop(now + 2.6);
    };
    playDirge();
    gameOverFallbackTimer = setInterval(playDirge, 2600);
  }

  function startGameOverBgm() {
    stopLobbyBgm();
    stopGoodEndBgm();
    if (gameOverBgmActive) return;
    gameOverBgmActive = true;

    if (gameOverBgmFailed) {
      startGameOverFallback();
      return;
    }

    if (!gameOverBgmEl) {
      gameOverBgmEl = new Audio("audio/game_over_bgm.mp3");
      gameOverBgmEl.loop = true;
      gameOverBgmEl.preload = "auto";
      gameOverBgmEl.addEventListener("error", () => {
        if (!gameOverBgmFailed) {
          gameOverBgmFailed = true;
          console.warn("[Duskwood Audio] 'audio/game_over_bgm.mp3' not found. Using somber game over synth.");
          if (gameOverBgmActive) startGameOverFallback();
        }
      });
    }

    try {
      gameOverBgmEl.currentTime = 0;
      gameOverBgmEl.volume = Math.max(0, Math.min(1, getBgmVol()));
      const p = gameOverBgmEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!gameOverBgmFailed) {
            gameOverBgmFailed = true;
            if (gameOverBgmActive) startGameOverFallback();
          }
        });
      }
    } catch (_) {
      gameOverBgmFailed = true;
      startGameOverFallback();
    }
  }

  function unlockLobbyAudio() {
    if (!inLobby) return;
    const audio = ensureContext();
    if (mp3Failed) {
      if (audio && audio.state === "suspended") {
        audio.resume().then(() => {
          if (inLobby && !synthTimer) scheduleSynthLoop();
        }).catch(() => {});
      } else if (!synthTimer) {
        scheduleSynthLoop();
      }
      return;
    }
    if (!bgmAudioEl || bgmAudioEl.paused) {
      startLobbyBgm();
    }
  }

  // ==================== INTRO SFX: audio/broken_light.mp3 (6s) ====================
  function playElectricSpark(duration, intensity) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(118, now);

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(920, now);
    filter.Q.value = 2.4;

    const peak = Math.max(0.001, vol * 0.16 * (intensity || 1));
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playBrokenLightFallback() {
    const sparks = [
      [2000, 0.12, 0.8],
      [2280, 0.09, 0.6],
      [2550, 0.18, 0.9],
      [2920, 0.10, 0.7],
      [3160, 0.19, 1.0],
      [3480, 0.14, 1.0],
      [3650, 0.10, 0.85],
      [3820, 0.45, 0.55]
    ];

    sparks.forEach(([delayMs, dur, amp]) => {
      const id = setTimeout(() => {
        if (!brokenLightActive) return;
        playElectricSpark(dur, amp);
        if (delayMs === 3820) {
          playTone(180, 0.04, "square", 0.10, 90);
        }
      }, delayMs);
      brokenLightTimeouts.push(id);
    });
  }

  function stopBrokenLight() {
    brokenLightActive = false;
    brokenLightTimeouts.forEach((id) => clearTimeout(id));
    brokenLightTimeouts = [];
    if (brokenLightEl && !brokenLightEl.paused) {
      brokenLightEl.pause();
      brokenLightEl.currentTime = 0;
    }
  }

  function playBrokenLight() {
    stopBrokenLight();
    brokenLightActive = true;
    brokenLightStartMs = performance.now();

    if (brokenLightFailed) {
      playBrokenLightFallback();
      return;
    }

    if (!brokenLightEl) {
      brokenLightEl = new Audio("audio/broken_light.mp3");
      brokenLightEl.preload = "auto";
      brokenLightEl.addEventListener("error", () => {
        if (!brokenLightFailed) {
          brokenLightFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/broken_light.mp3' not found. Using electric flicker synth."
          );
          if (brokenLightActive) playBrokenLightFallback();
        }
      });
    }

    brokenLightEl.currentTime = 0;
    brokenLightEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    const p = brokenLightEl.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (!brokenLightFailed) {
          brokenLightFailed = true;
          if (brokenLightActive) playBrokenLightFallback();
        }
      });
    }
  }

  function getBrokenLightTime() {
    if (!brokenLightActive) return 0;
    if (brokenLightEl && !brokenLightFailed && !brokenLightEl.paused && brokenLightEl.currentTime > 0) {
      return brokenLightEl.currentTime;
    }
    return (performance.now() - brokenLightStartMs) * 0.001;
  }

  // ==================== MAIN PARLOR SPATIAL CLOCK TICK ====================
  function computeClockVolume() {
    const raw = getSfxVol() * 0.85 * Math.max(0, Math.min(1, clockTickAttenuation));
    return raw < 0.005 ? 0 : Math.min(1, raw);
  }

  function playWoodenClockImpulse(isTick) {
    const effVol = computeClockVolume();
    if (!clockTickActive || effVol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    osc.type = "triangle";
    const baseFreq = isTick ? 940 : 720;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isTick ? 280 : 220, now + 0.032);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(isTick ? 1150 : 880, now);
    filter.Q.value = 3.2;

    const peak = Math.max(0.0008, effVol * 0.16);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.042);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  function stopClockTickFallback() {
    clearInterval(clockTickTimer);
    clockTickTimer = null;
  }

  function startClockTickFallback() {
    clockTickFailed = true;
    stopClockTickFallback();
    if (!clockTickActive) return;
    clockTickTimer = setInterval(() => {
      if (!clockTickActive) return;
      playWoodenClockImpulse(clockTickPhase % 2 === 0);
      clockTickPhase += 1;
    }, 1000);
  }

  function startClockTick() {
    clockTickActive = true;
    if (clockTickFailed) {
      if (!clockTickTimer) startClockTickFallback();
      return;
    }

    if (!clockTickEl) {
      clockTickEl = new Audio("audio/clock_tick.mp3");
      clockTickEl.loop = true;
      clockTickEl.preload = "auto";
      clockTickEl.addEventListener("error", () => {
        if (!clockTickFailed) {
          console.warn(
            "[Duskwood Audio] 'audio/clock_tick.mp3' not found. Using wooden clock tick synth."
          );
          startClockTickFallback();
        }
      });
    }

    clockTickEl.volume = computeClockVolume();
    if (!clockTickEl.paused) return;

    const p = clockTickEl.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        if (err && err.name === "NotAllowedError") return;
        if (!clockTickFailed) startClockTickFallback();
      });
    }
  }

  function stopClockTick() {
    clockTickActive = false;
    stopClockTickFallback();
    if (clockTickEl && !clockTickEl.paused) {
      clockTickEl.pause();
      clockTickEl.currentTime = 0;
    }
  }

  function setClockTickAttenuation(attenuation) {
    clockTickAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeClockVolume();
    if (clockTickEl && !clockTickFailed) {
      clockTickEl.volume = vol;
      clockTickEl.muted = vol <= 0.001;
      if (clockTickActive && vol > 0.001 && clockTickEl.paused) {
        const p = clockTickEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }
  }

  // ==================== TABLE INTRO SFX: audio/human_intro.mp3 (11s) ====================
  function stopHumanIntro() {
    humanIntroActive = false;
    if (humanIntroEl && !humanIntroEl.paused) {
      humanIntroEl.pause();
      humanIntroEl.currentTime = 0;
    }
  }

  function playHumanIntro() {
    stopHumanIntro();
    humanIntroActive = true;
    humanIntroStartMs = performance.now();

    if (humanIntroFailed) {
      SFX.pawnRise();
      return;
    }

    if (!humanIntroEl) {
      humanIntroEl = new Audio("audio/human_intro.mp3");
      humanIntroEl.preload = "auto";
      humanIntroEl.addEventListener("error", () => {
        if (!humanIntroFailed) {
          humanIntroFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/human_intro.mp3' not found. Using built-in table intro synth."
          );
          if (humanIntroActive) SFX.pawnRise();
        }
      });
    }

    humanIntroEl.currentTime = 0;
    humanIntroEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    const p = humanIntroEl.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (!humanIntroFailed) {
          humanIntroFailed = true;
          if (humanIntroActive) SFX.pawnRise();
        }
      });
    }
  }

  function getHumanIntroTime() {
    if (!humanIntroActive) return 0;
    if (humanIntroEl && !humanIntroFailed && !humanIntroEl.paused && humanIntroEl.currentTime > 0) {
      return humanIntroEl.currentTime;
    }
    return (performance.now() - humanIntroStartMs) * 0.001;
  }

  function isHumanIntroUsingFallback() {
    return humanIntroFailed;
  }

  function syncHumanIntroTime(targetSec) {
    if (!humanIntroActive || humanIntroFailed || !humanIntroEl) return;
    if (humanIntroEl.readyState < 2) return;
    const clamped = Math.max(0, Math.min(getHumanIntroDuration() - 0.1, targetSec || 0));
    if (Math.abs((humanIntroEl.currentTime || 0) - clamped) > 0.35) {
      try { humanIntroEl.currentTime = clamped; } catch (_) {}
    }
  }

  // ==================== CARD DRAW SFX: audio/draw_card.mp3 (ROCK-SOLID 4-CHANNEL POOL) ====================
  function playDrawCardSynthFallback() {
    playTone(320, 0.06, "triangle", 0.09, 540);
    setTimeout(() => playTone(640, 0.05, "sine", 0.07, 740), 40);
  }

  function ensureDrawCardPool() {
    if (drawCardPool.length > 0) return;
    for (let i = 0; i < 4; i++) {
      const a = new Audio("audio/draw_card.mp3");
      a.preload = "auto";
      a.addEventListener("error", () => {
        if (!drawCardFailed) {
          drawCardFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/draw_card.mp3' not found. Using built-in card draw synth."
          );
        }
      });
      drawCardPool.push(a);
    }
  }

  // Called during a user click gesture (e.g., Turn 1 Cellar placement or Lobby click)
  // so all 4 pool slots are preloaded & autoplay-unlocked for 3x consecutive starter draws!
  function warmUpDrawCard() {
    if (drawCardFailed) return;
    ensureDrawCardPool();
    drawCardPool.forEach((el) => {
      if (el._warmed) return;
      el._warmed = true;
      try {
        if (el.readyState === 0) el.load();
      } catch (_) {}
    });
  }

  function playDrawCardSfx() {
    const vol = getSfxVol();
    if (vol <= 0.001) return;

    if (drawCardFailed) {
      playDrawCardSynthFallback();
      return;
    }

    ensureDrawCardPool();
    const targetVol = Math.max(0, Math.min(1, vol));
    // Prefer an idle slot first so rapid 3x starter draws overlap cleanly without cutting off!
    let el = drawCardPool.find((a) => a.paused || a.ended);
    if (!el) {
      el = drawCardPool[drawCardPoolIdx % drawCardPool.length];
    }
    drawCardPoolIdx = (drawCardPoolIdx + 1) % drawCardPool.length;

    const tryPlayEl = (audioEl, allowRetry) => {
      try {
        audioEl._inUse = true;
        audioEl.muted = false;
        audioEl.volume = targetVol;
        if (!audioEl.paused) audioEl.pause();
        if (audioEl.readyState >= 1) {
          try { audioEl.currentTime = 0; } catch (_) {}
        }
        const p = audioEl.play();
        if (p && typeof p.catch === "function") {
          p.catch((err) => {
            // Never permanently poison drawCardFailed on transient AbortError / autoplay hiccups!
            if (err && err.name === "NotSupportedError") {
              drawCardFailed = true;
              playDrawCardSynthFallback();
              return;
            }
            if (allowRetry && drawCardPool[0] && drawCardPool[0] !== audioEl) {
              tryPlayEl(drawCardPool[0], false);
            } else {
              // Fresh one-shot Audio fallback before giving up to synth
              try {
                const oneShot = new Audio("audio/draw_card.mp3");
                oneShot.volume = targetVol;
                oneShot.play().catch(() => playDrawCardSynthFallback());
              } catch (_) {
                playDrawCardSynthFallback();
              }
            }
          });
        }
      } catch (_) {
        if (allowRetry && drawCardPool[0] && drawCardPool[0] !== audioEl) {
          tryPlayEl(drawCardPool[0], false);
        } else {
          playDrawCardSynthFallback();
        }
      }
    };

    tryPlayEl(el, true);
  }

  // ==================== BOOK PAGE TURN SFX (audio/page_turn.mp3 — slice 1.00s -> 3.00s) ====================
  const PAGE_TURN_START_SEC = 1.00;
  const PAGE_TURN_END_SEC = 3.00;
  let pageTurnPool = [];
  let pageTurnPoolIdx = 0;
  let pageTurnFailed = false;

  function playPageTurnSynthFallback() {
    playTone(340, 0.055, "triangle", 0.075, 580);
    setTimeout(() => playTone(460, 0.04, "sine", 0.05, 310), 28);
  }

  function clearPageTurnTimers(el) {
    if (!el) return;
    clearTimeout(el._safetyTimer);
    el._safetyTimer = null;
    clearInterval(el._watchTimer);
    el._watchTimer = null;
    clearInterval(el._fadeTimer);
    el._fadeTimer = null;
  }

  function parkPageTurnSlot(el) {
    if (!el || pageTurnFailed) return;
    try {
      if (el.readyState >= 1) {
        el.currentTime = PAGE_TURN_START_SEC;
      }
    } catch (_) {}
  }

  function ensurePageTurnPool() {
    if (pageTurnPool.length > 0) return;
    for (let i = 0; i < 4; i++) {
      const a = new Audio("audio/page_turn.mp3");
      a.preload = "auto";
      a.addEventListener("loadedmetadata", () => {
        if (a.paused) parkPageTurnSlot(a);
      });
      a.addEventListener("error", () => {
        if (!pageTurnFailed) {
          pageTurnFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/page_turn.mp3' not found. Using built-in paper flip synth."
          );
        }
      });
      try { a.load(); } catch (_) {}
      pageTurnPool.push(a);
    }
  }

  // Unlock & pre-park all 4 page_turn.mp3 slots at 1.50s on the first user gesture
  function warmUpPageTurn() {
    if (pageTurnFailed) return;
    ensurePageTurnPool();
    pageTurnPool.forEach((el) => {
      if (el._warmed) return;
      el._warmed = true;
      try {
        if (el.readyState === 0) el.load();
      } catch (_) {}
    });
  }

  function playPageTurnSfx() {
    const vol = getSfxVol();
    if (vol <= 0.001) return;

    if (pageTurnFailed) {
      playPageTurnSynthFallback();
      return;
    }

    ensurePageTurnPool();
    const targetVol = Math.max(0, Math.min(1, vol));
    // Prefer an idle slot already pre-parked near 1.50s for instant 0ms playback!
    let el = pageTurnPool.find((a) => a.paused && !a._busy);
    if (!el) {
      el = pageTurnPool[pageTurnPoolIdx % pageTurnPool.length];
    }
    pageTurnPoolIdx = (pageTurnPoolIdx + 1) % pageTurnPool.length;

    clearPageTurnTimers(el);
    el._busy = true;
    const playToken = (el._playToken || 0) + 1;
    el._playToken = playToken;

    const fadeAndStop = () => {
      if (el._playToken !== playToken) return;
      clearInterval(el._watchTimer);
      el._watchTimer = null;
      clearTimeout(el._safetyTimer);
      el._safetyTimer = null;

      if (el.paused) {
        el._busy = false;
        parkPageTurnSlot(el);
        return;
      }

      const fadeMs = 75;
      const v0 = el.volume;
      const t0 = performance.now();
      el._fadeTimer = setInterval(() => {
        if (el._playToken !== playToken) {
          clearInterval(el._fadeTimer);
          return;
        }
        const frac = Math.min(1, (performance.now() - t0) / fadeMs);
        el.volume = Math.max(0, v0 * (1 - frac));
        if (frac >= 1) {
          clearInterval(el._fadeTimer);
          el._fadeTimer = null;
          el.pause();
          el._busy = false;
          parkPageTurnSlot(el);
        }
      }, 16);
    };

    const beginPlay = () => {
      if (el._playToken !== playToken) return;
      try {
        el.muted = false;
        el.volume = targetVol;
        const p = el.play();
        if (p && typeof p.catch === "function") {
          p.catch((err) => {
            if (el._playToken !== playToken) return;
            el._busy = false;
            if (err && err.name === "NotSupportedError") pageTurnFailed = true;
            playPageTurnSynthFallback();
          });
        }

        // Watch ACTUAL currentTime so slow browser seeking NEVER cuts off the sound early!
        el._watchTimer = setInterval(() => {
          if (el._playToken !== playToken) {
            clearInterval(el._watchTimer);
            return;
          }
          if (el.ended || el.currentTime >= PAGE_TURN_END_SEC) {
            fadeAndStop();
          }
        }, 18);

        // Safety stop cap (2.65s) in case currentTime stalls
        el._safetyTimer = setTimeout(() => {
          fadeAndStop();
        }, 2650);
      } catch (_) {
        el._busy = false;
        playPageTurnSynthFallback();
      }
    };

    const seekThenPlay = () => {
      if (el._playToken !== playToken) return;
      if (!el.paused) el.pause();

      const alreadyParked = Math.abs((el.currentTime || 0) - PAGE_TURN_START_SEC) <= 0.08;
      if (alreadyParked && el.readyState >= 2) {
        beginPlay();
        return;
      }

      let started = false;
      const onSeekReady = () => {
        if (started || el._playToken !== playToken) return;
        started = true;
        beginPlay();
      };

      el.addEventListener("seeked", onSeekReady, { once: true });
      try {
        el.currentTime = PAGE_TURN_START_SEC;
      } catch (_) {
        onSeekReady();
        return;
      }
      // Fallback in case browser doesn't emit 'seeked' when time delta is tiny
      setTimeout(onSeekReady, 90);
    };

    if (el.readyState >= 1) {
      seekThenPlay();
    } else {
      el.addEventListener("loadedmetadata", seekThenPlay, { once: true });
      try { el.load(); } catch (_) { el._busy = false; playPageTurnSynthFallback(); }
    }
  }

  // ==================== TABLE RIM ROTATION SFX (ONLY 4.0s -> 11.0s of human_intro.mp3) ====================
  const RIM_CLIP_START_SEC = 4.0;
  const RIM_CLIP_END_SEC = 11.0;

  function getHumanIntroDuration() {
    if (humanIntroEl && Number.isFinite(humanIntroEl.duration) && humanIntroEl.duration > 1) {
      return humanIntroEl.duration;
    }
    if (rimTurnEl && Number.isFinite(rimTurnEl.duration) && rimTurnEl.duration > 1) {
      return rimTurnEl.duration;
    }
    return 11.0;
  }

  function getRimClipDuration() {
    const endSec = Math.min(RIM_CLIP_END_SEC, getHumanIntroDuration());
    return Math.max(1.5, endSec - RIM_CLIP_START_SEC); // Exact 7.0s (4s -> 11s)
  }

  function stopRimTurn() {
    rimTurnActive = false;
    clearTimeout(rimTurnStopTimer);
    rimTurnStopTimer = null;
    clearInterval(rimTurnFadeInterval);
    rimTurnFadeInterval = null;
    if (rimTurnEl && !rimTurnEl.paused) {
      rimTurnEl.pause();
      rimTurnEl.currentTime = RIM_CLIP_START_SEC;
    }
  }

  function playRimTurn(durationSec) {
    stopRimTurn();
    rimTurnActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (rimTurnFailed || humanIntroFailed) {
      rimTurnFailed = true;
      SFX.grooveTick();
      return;
    }

    if (!rimTurnEl) {
      rimTurnEl = new Audio("audio/human_intro.mp3");
      rimTurnEl.preload = "auto";
      rimTurnEl.addEventListener("error", () => {
        if (!rimTurnFailed) {
          rimTurnFailed = true;
          if (rimTurnActive) SFX.grooveTick();
        }
      });
    }

    try {
      const maxClip = getRimClipDuration();
      const playLen = Math.max(0.4, Math.min(maxClip, durationSec || maxClip));

      const seekAndPlay = () => {
        if (!rimTurnActive || !rimTurnEl) return;
        try {
          rimTurnEl.currentTime = RIM_CLIP_START_SEC;
        } catch (_) {}
        rimTurnEl.volume = vol;
        const p = rimTurnEl.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            rimTurnFailed = true;
            if (rimTurnActive) SFX.grooveTick();
          });
        }
      };

      // If metadata isn't loaded yet, seek as soon as loadedmetadata fires so it ALWAYS starts at 4.0s!
      if (rimTurnEl.readyState >= 1) {
        seekAndPlay();
      } else {
        rimTurnEl.addEventListener("loadedmetadata", seekAndPlay, { once: true });
        rimTurnEl.load();
      }

      // Smooth fade-out right before reaching 11.0s (or earlier for shorter multiplayer turns)
      const fadeMs = 260;
      const stopDelayMs = Math.max(260, Math.round(playLen * 1000));
      rimTurnStopTimer = setTimeout(() => {
        if (!rimTurnEl || rimTurnEl.paused) {
          stopRimTurn();
          return;
        }
        const startVol = rimTurnEl.volume;
        const t0 = performance.now();
        rimTurnFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (rimTurnEl) rimTurnEl.volume = Math.max(0, startVol * (1 - frac));
          if (frac >= 1) stopRimTurn();
        }, 25);
      }, Math.max(0, stopDelayMs - fadeMs));
    } catch (_) {
      rimTurnFailed = true;
      SFX.grooveTick();
    }
  }

  function isRimTurnUsingFallback() {
    return rimTurnFailed || humanIntroFailed;
  }

  // ==================== PAWN GLIDE SFX (audio/moving.mp3 — 4.0 seconds) ====================
  const PAWN_MOVE_CLIP_SEC = 4.0;

  function stopPawnMove() {
    pawnMoveActive = false;
    clearTimeout(pawnMoveStopTimer);
    pawnMoveStopTimer = null;
    clearInterval(pawnMoveFadeInterval);
    pawnMoveFadeInterval = null;
    clearInterval(pawnMoveLoopTimer);
    pawnMoveLoopTimer = null;
    if (pawnMoveEl && !pawnMoveEl.paused) {
      pawnMoveEl.pause();
      try { pawnMoveEl.currentTime = 0; } catch (_) {}
    }
  }

  function playPawnMove(durationSec) {
    stopPawnMove();
    pawnMoveActive = true;
    const targetVol = Math.max(0, Math.min(1, getSfxVol()));
    if (targetVol <= 0.001) return;

    if (pawnMoveFailed) return;

    if (!pawnMoveEl) {
      pawnMoveEl = new Audio("audio/moving.mp3");
      pawnMoveEl.loop = true; // Loops cleanly if a glide ever exceeds 4.0s
      pawnMoveEl.preload = "auto";
      pawnMoveEl.addEventListener("error", () => {
        if (!pawnMoveFailed) {
          pawnMoveFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/moving.mp3' not found. Using wooden groove tick synth."
          );
        }
      });
    }

    try {
      const playLen = Math.max(0.45, durationSec || PAWN_MOVE_CLIP_SEC);
      pawnMoveEl.currentTime = 0;
      pawnMoveEl.volume = targetVol;
      const p = pawnMoveEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          pawnMoveFailed = true;
        });
      }

      const fadeOutMs = 180;
      const stopDelayMs = Math.max(220, Math.round(playLen * 1000));
      pawnMoveStopTimer = setTimeout(() => {
        if (!pawnMoveEl || pawnMoveEl.paused) {
          stopPawnMove();
          return;
        }
        const startVol = pawnMoveEl.volume;
        const t0 = performance.now();
        pawnMoveFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeOutMs);
          if (pawnMoveEl) pawnMoveEl.volume = Math.max(0, startVol * (1 - frac));
          if (frac >= 1) stopPawnMove();
        }, 20);
      }, Math.max(0, stopDelayMs - fadeOutMs));
    } catch (_) {
      pawnMoveFailed = true;
    }
  }

  function isPawnMoveUsingFallback() {
    return pawnMoveFailed;
  }

  // ==================== GRANDFATHER CLOCK CLUE SFX (3.0s -> 11.0s of grandfather_clock_sfx.mp3) ====================
  const GF_CLIP_START_SEC = 3.0;
  const GF_CLIP_END_SEC = 11.0;

  function playDeepClockBellStrike(volScale) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const partials = [
      [130.81, 0.20, 2.3],
      [196.00, 0.14, 1.8],
      [261.63, 0.10, 1.4],
      [392.00, 0.06, 1.0]
    ];
    partials.forEach(([freq, amp, dur]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.992, now + dur);

      const peak = Math.max(0.001, vol * amp * (volScale || 1));
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + dur + 0.04);
    });
  }

  function playGrandfatherClockFallback() {
    [0, 2200, 4400].forEach((delayMs, i) => {
      const id = setTimeout(() => {
        if (!gfClockActive) return;
        playDeepClockBellStrike(1.0 - i * 0.12);
      }, delayMs);
      gfClockFallbackTimers.push(id);
    });
    const endId = setTimeout(() => { gfClockActive = false; }, 7500);
    gfClockFallbackTimers.push(endId);
  }

  function stopGrandfatherClockClue() {
    gfClockActive = false;
    clearTimeout(gfClockStopTimer);
    gfClockStopTimer = null;
    clearInterval(gfClockFadeInterval);
    gfClockFadeInterval = null;
    gfClockFallbackTimers.forEach((id) => clearTimeout(id));
    gfClockFallbackTimers = [];
    if (gfClockEl && !gfClockEl.paused) {
      gfClockEl.pause();
      try { gfClockEl.currentTime = GF_CLIP_START_SEC; } catch (_) {}
    }
  }

  function playGrandfatherClockClue() {
    stopGrandfatherClockClue();
    gfClockActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (gfClockFailed) {
      playGrandfatherClockFallback();
      return;
    }

    if (!gfClockEl) {
      gfClockEl = new Audio("audio/grandfather_clock_sfx.mp3");
      gfClockEl.preload = "auto";
      gfClockEl.addEventListener("error", () => {
        if (!gfClockFailed) {
          gfClockFailed = true;
          console.warn(
            "[Duskwood Audio] 'audio/grandfather_clock_sfx.mp3' not found. Using deep grandfather clock chime synth."
          );
          if (gfClockActive) playGrandfatherClockFallback();
        }
      });
    }

    try {
      const clipDurationSec = GF_CLIP_END_SEC - GF_CLIP_START_SEC; // Exact 8.0s (3.0s -> 11.0s)

      const seekAndPlay = () => {
        if (!gfClockActive || !gfClockEl) return;
        try {
          gfClockEl.currentTime = GF_CLIP_START_SEC;
        } catch (_) {}
        gfClockEl.volume = vol;
        const p = gfClockEl.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            if (!gfClockFailed) {
              gfClockFailed = true;
              if (gfClockActive) playGrandfatherClockFallback();
            }
          });
        }
      };

      if (gfClockEl.readyState >= 1) {
        seekAndPlay();
      } else {
        gfClockEl.addEventListener("loadedmetadata", seekAndPlay, { once: true });
        gfClockEl.load();
      }

      const fadeMs = 380;
      const stopDelayMs = Math.round(clipDurationSec * 1000);
      gfClockStopTimer = setTimeout(() => {
        if (!gfClockEl || gfClockEl.paused) {
          stopGrandfatherClockClue();
          return;
        }
        const startVol = gfClockEl.volume;
        const t0 = performance.now();
        gfClockFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (gfClockEl) gfClockEl.volume = Math.max(0, startVol * (1 - frac));
          if (frac >= 1) stopGrandfatherClockClue();
        }, 30);
      }, Math.max(0, stopDelayMs - fadeMs));
    } catch (_) {
      gfClockFailed = true;
      playGrandfatherClockFallback();
    }
  }

  function syncSfxVolume() {
    if (clockTickEl && !clockTickFailed) {
      clockTickEl.volume = computeClockVolume();
    }
    if (brokenLightEl && !brokenLightFailed) {
      brokenLightEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (humanIntroEl && !humanIntroFailed) {
      humanIntroEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (drawCardPool.length && !drawCardFailed) {
      const v = Math.max(0, Math.min(1, getSfxVol()));
      drawCardPool.forEach((a) => { a.volume = v; });
    }
    if (rimTurnEl && !rimTurnFailed && rimTurnActive) {
      rimTurnEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (pawnMoveEl && !pawnMoveFailed && pawnMoveActive) {
      pawnMoveEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (gfClockEl && !gfClockFailed && gfClockActive) {
      gfClockEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (eventDrawEl && !eventDrawFailed && eventDrawActive) {
      eventDrawEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (typingEl && !typingFailed && typingActive) {
      typingEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (pageTurnPool.length && !pageTurnFailed) {
      const v = Math.max(0, Math.min(1, getSfxVol()));
      pageTurnPool.forEach((a) => { a.volume = v; });
    }
    if (clownEl && !clownFailed && clownActive) {
      clownEl.volume = Math.max(0, Math.min(1, getSfxVol() * 0.85));
    }
    if (endAlarmEl && !endAlarmFailed && endAlarmActive) {
      endAlarmEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (lightBreakEl && !lightBreakFailed && lightBreakActive) {
      lightBreakEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (toyTrainEl && !toyTrainFailed && toyTrainActive) {
      const tv = computeToyTrainVolume();
      toyTrainEl.volume = tv;
      toyTrainEl.muted = tv <= 0.001;
    }
    if (atticGhostEl && !atticGhostFailed && atticGhostActive) {
      const gv = computeAtticGhostVolume();
      atticGhostEl.volume = gv;
      atticGhostEl.muted = gv <= 0.001;
    }
    if (musicBoxEl && !musicBoxFailed && musicBoxActive) {
      musicBoxEl.volume = Math.max(0, Math.min(1, getSfxVol() * 0.90));
    }
    if (monkeyEl && !monkeyFailed && monkeyActive) {
      const mv = computeMonkeyVolume();
      monkeyEl.volume = mv;
      monkeyEl.muted = mv <= 0.001;
    }
    if (basementSlideEl && !basementSlideFailed && basementSlideActive) {
      basementSlideEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (chainsawEl && !chainsawFailed && chainsawActive) {
      const cv = computeChainsawVolume();
      chainsawEl.volume = cv;
      chainsawEl.muted = cv <= 0.001;
    }
    if (balloonsSfxEl && !balloonsSfxFailed && balloonsSfxActive) {
      const bv = computeBalloonsSfxVolume();
      balloonsSfxEl.volume = bv;
      balloonsSfxEl.muted = bv <= 0.001;
    }
    if (lightSurgeEl && !lightSurgeFailed && lightSurgeActive) {
      lightSurgeEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (doorKnockEl && !doorKnockFailed && doorKnockActive) {
      doorKnockEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (doorOpenEl && !doorOpenFailed && doorOpenActive) {
      doorOpenEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (knightStepEl && !knightStepFailed && knightStepActive) {
      knightStepEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (exorcismEl && !exorcismFailed && exorcismActive) {
      exorcismEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
    if (jumpscareEl && !jumpscareFailed && jumpscareActive) {
      jumpscareEl.volume = Math.max(0, Math.min(1, getSfxVol()));
    }
  }

  // ==================== EVENT CARD DRAW SFX (audio/event_draw.mp3 — 4.0s) ====================
  function playEventDrawFallback() {
    playTone(98, 1.4, "sawtooth", 0.13, 68);
    setTimeout(() => playTone(138.6, 1.6, "triangle", 0.12, 116.5), 140);
    setTimeout(() => playTone(207.6, 1.8, "sine", 0.10, 174.6), 340);
    setTimeout(() => playTone(73.4, 1.4, "sawtooth", 0.11, 55.0), 1100);
  }

  function stopEventDraw() {
    eventDrawActive = false;
    clearTimeout(eventDrawStopTimer);
    eventDrawStopTimer = null;
    clearInterval(eventDrawFadeInterval);
    eventDrawFadeInterval = null;
    if (eventDrawEl && !eventDrawEl.paused) {
      eventDrawEl.pause();
      try { eventDrawEl.currentTime = 0; } catch (_) {}
    }
  }

  function playEventDraw() {
    stopEventDraw();
    eventDrawActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (eventDrawFailed) {
      playEventDrawFallback();
      return;
    }

    if (!eventDrawEl) {
      eventDrawEl = new Audio("audio/event_draw.mp3");
      eventDrawEl.preload = "auto";
      eventDrawEl.addEventListener("error", () => {
        if (!eventDrawFailed) {
          eventDrawFailed = true;
          console.warn("[Duskwood Audio] 'audio/event_draw.mp3' not found. Using eerie event chord synth.");
          if (eventDrawActive) playEventDrawFallback();
        }
      });
    }

    try {
      eventDrawEl.currentTime = 0;
      eventDrawEl.volume = vol;
      const p = eventDrawEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!eventDrawFailed) {
            eventDrawFailed = true;
            if (eventDrawActive) playEventDrawFallback();
          }
        });
      }

      const fadeMs = 280;
      const clipMs = 4000; // Exact 4.0 seconds!
      eventDrawStopTimer = setTimeout(() => {
        if (!eventDrawEl || eventDrawEl.paused) {
          stopEventDraw();
          return;
        }
        const startVol = eventDrawEl.volume;
        const t0 = performance.now();
        eventDrawFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (eventDrawEl) eventDrawEl.volume = Math.max(0, startVol * (1 - frac));
          if (frac >= 1) stopEventDraw();
        }, 24);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      eventDrawFailed = true;
      playEventDrawFallback();
    }
  }

  // ==================== EVENT TYPEWRITER SFX (audio/typing.mp3 — 5.0s) ====================
  function stopTypingSfx() {
    typingActive = false;
    clearTimeout(typingStopTimer);
    typingStopTimer = null;
    clearInterval(typingFadeInterval);
    typingFadeInterval = null;
    clearInterval(typingFallbackInterval);
    typingFallbackInterval = null;
    if (typingEl && !typingEl.paused) {
      typingEl.pause();
      try { typingEl.currentTime = 0; } catch (_) {}
    }
  }

  function startTypingFallback(durationMs) {
    clearInterval(typingFallbackInterval);
    const tEnd = performance.now() + durationMs;
    typingFallbackInterval = setInterval(() => {
      if (!typingActive || performance.now() >= tEnd) {
        stopTypingSfx();
        return;
      }
      playTone(680 + Math.random() * 240, 0.025, "square", 0.06, 260);
    }, 85);
  }

  function playTypingSfx(durationSec) {
    stopTypingSfx();
    typingActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    const clipMs = Math.max(500, Math.round((durationSec || 5.0) * 1000));

    if (typingFailed) {
      startTypingFallback(clipMs);
      return;
    }

    if (!typingEl) {
      typingEl = new Audio("audio/typing.mp3");
      typingEl.loop = true;
      typingEl.preload = "auto";
      typingEl.addEventListener("error", () => {
        if (!typingFailed) {
          typingFailed = true;
          console.warn("[Duskwood Audio] 'audio/typing.mp3' not found. Using typewriter keystroke synth.");
          if (typingActive) startTypingFallback(clipMs);
        }
      });
    }

    try {
      typingEl.currentTime = 0;
      typingEl.volume = vol;
      const p = typingEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!typingFailed) {
            typingFailed = true;
            if (typingActive) startTypingFallback(clipMs);
          }
        });
      }

      const fadeMs = 240;
      typingStopTimer = setTimeout(() => {
        if (!typingEl || typingEl.paused) {
          stopTypingSfx();
          return;
        }
        const startVol = typingEl.volume;
        const t0 = performance.now();
        typingFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (typingEl) typingEl.volume = Math.max(0, startVol * (1 - frac));
          if (frac >= 1) stopTypingSfx();
        }, 22);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      typingFailed = true;
      startTypingFallback(clipMs);
    }
  }

  // ==================== RED BALLOONS CLOWN LAUGH LOOP (audio/clown_laugh.mp3 0.0s -> 9.0s) ====================
  function playClownSynthBurst() {
    if (!clownActive) return;
    const notes = [440, 392, 466.16, 370, 330];
    notes.forEach((f, idx) => {
      setTimeout(() => {
        if (!clownActive) return;
        playTone(f, 0.14, "sawtooth", 0.065, f * 0.84);
      }, idx * 145);
    });
  }

  function stopClownLaughLoop() {
    clownActive = false;
    clearInterval(clownWatchTimer);
    clownWatchTimer = null;
    clearInterval(clownFallbackTimer);
    clownFallbackTimer = null;
    if (clownEl && !clownEl.paused) {
      clownEl.pause();
      try { clownEl.currentTime = 0; } catch (_) {}
    }
  }

  function startClownFallbackLoop() {
    clearInterval(clownFallbackTimer);
    if (!clownActive) return;
    playClownSynthBurst();
    clownFallbackTimer = setInterval(() => {
      if (!clownActive) {
        clearInterval(clownFallbackTimer);
        return;
      }
      playClownSynthBurst();
    }, 3400);
  }

  function playClownLaughLoop() {
    stopClownLaughLoop();
    clownActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol() * 0.85));
    if (vol <= 0.001) return;

    if (clownFailed) {
      startClownFallbackLoop();
      return;
    }

    if (!clownEl) {
      clownEl = new Audio("audio/clown_laugh.mp3");
      clownEl.preload = "auto";
      clownEl.addEventListener("error", () => {
        if (!clownFailed) {
          clownFailed = true;
          console.warn("[Duskwood Audio] 'audio/clown_laugh.mp3' not found. Using eerie clown synth loop.");
          if (clownActive) startClownFallbackLoop();
        }
      });
      clownEl.addEventListener("ended", () => {
        if (!clownActive || clownFailed) return;
        try {
          clownEl.currentTime = 0;
          clownEl.play().catch(() => {});
        } catch (_) {}
      });
    }

    try {
      clownEl.currentTime = 0;
      clownEl.volume = vol;
      const p = clownEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!clownFailed) {
            clownFailed = true;
            if (clownActive) startClownFallbackLoop();
          }
        });
      }

      // Loop strictly between 0.0s and 9.0s until event ends!
      clownWatchTimer = setInterval(() => {
        if (!clownActive || !clownEl || clownFailed) {
          clearInterval(clownWatchTimer);
          return;
        }
        if (clownEl.currentTime >= CLOWN_LOOP_END_SEC) {
          try {
            clownEl.currentTime = 0;
            if (clownEl.paused) clownEl.play().catch(() => {});
          } catch (_) {}
        }
      }, 45);
    } catch (_) {
      clownFailed = true;
      startClownFallbackLoop();
    }
  }

  function playBalloonPopSfx(isGold) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    // Crisp white-noise pop burst
    const bufLen = Math.floor(audio.sampleRate * 0.09);
    const nBuf = audio.createBuffer(1, bufLen, audio.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.6);
    }
    const noise = audio.createBufferSource();
    noise.buffer = nBuf;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(isGold ? 1600 : 1200, now);
    filter.Q.value = 1.2;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(Math.min(1, vol * 0.42), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    noise.start(now);

    // Snappy rubber thump
    playTone(isGold ? 540 : 340, 0.08, "triangle", 0.22, 75);
    if (isGold) {
      setTimeout(() => playTone(660, 0.25, "sine", 0.14, 880), 70);
      setTimeout(() => playTone(880, 0.35, "triangle", 0.12, 1046.5), 160);
    }
  }

  // ==================== MIDNIGHT ENDGAME ALARM (audio/end_game_alarm.mp3 x3) ====================
  function playAlarmSynthStrike() {
    playTone(220, 0.95, "sawtooth", 0.14, 196);
    playTone(440, 0.85, "triangle", 0.12, 415);
    setTimeout(() => playTone(164.8, 0.70, "sawtooth", 0.11, 146.8), 120);
  }

  function stopEndGameAlarm() {
    endAlarmActive = false;
    endAlarmTimers.forEach((id) => clearTimeout(id));
    endAlarmTimers = [];
    if (endAlarmEl && !endAlarmEl.paused) {
      endAlarmEl.pause();
      try { endAlarmEl.currentTime = 0; } catch (_) {}
    }
  }

  function playEndGameAlarm3x(onAllDone) {
    stopEndGameAlarm();
    endAlarmActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));

    const runFallback = () => {
      [0, 1250, 2500].forEach((ms) => {
        const id = setTimeout(() => {
          if (!endAlarmActive) return;
          if (vol > 0.001) playAlarmSynthStrike();
        }, ms);
        endAlarmTimers.push(id);
      });
      const fin = setTimeout(() => {
        endAlarmActive = false;
        if (typeof onAllDone === "function") onAllDone();
      }, 3750);
      endAlarmTimers.push(fin);
    };

    if (endAlarmFailed || vol <= 0.001) {
      runFallback();
      return;
    }

    if (!endAlarmEl) {
      endAlarmEl = new Audio("audio/end_game_alarm.mp3");
      endAlarmEl.preload = "auto";
      endAlarmEl.addEventListener("error", () => {
        if (!endAlarmFailed) {
          endAlarmFailed = true;
          console.warn("[Duskwood Audio] 'audio/end_game_alarm.mp3' not found. Using midnight alarm synth.");
        }
      });
    }

    let playCount = 0;
    const playOneHit = () => {
      if (!endAlarmActive) return;
      playCount += 1;
      try {
        endAlarmEl.currentTime = 0;
        endAlarmEl.volume = vol;
        let advanced = false;
        const nextOrDone = () => {
          if (advanced || !endAlarmActive) return;
          advanced = true;
          if (playCount < 3) {
            const gapId = setTimeout(playOneHit, 180);
            endAlarmTimers.push(gapId);
          } else {
            endAlarmActive = false;
            if (typeof onAllDone === "function") onAllDone();
          }
        };
        endAlarmEl.onended = nextOrDone;
        // Safety cap per hit (2.4s max) so 3 hits never stall even on long MP3s
        const capId = setTimeout(() => {
          if (!advanced && endAlarmActive) {
            try { endAlarmEl.pause(); } catch (_) {}
            nextOrDone();
          }
        }, 2400);
        endAlarmTimers.push(capId);

        const p = endAlarmEl.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            if (!endAlarmFailed) {
              endAlarmFailed = true;
              clearTimeout(capId);
              if (endAlarmActive) runFallback();
            }
          });
        }
      } catch (_) {
        endAlarmFailed = true;
        if (endAlarmActive) runFallback();
      }
    };

    playOneHit();
  }

  // ==================== WRONG-ROOM LIGHT SHATTER SFX (audio/light_break.mp3 — 5.0s) ====================
  function playLightBreakFallback() {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    // Sharp electric snap + glass burst noise
    const bufLen = Math.floor(audio.sampleRate * 0.42);
    const nBuf = audio.createBuffer(1, bufLen, audio.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.8);
    }
    const noise = audio.createBufferSource();
    noise.buffer = nBuf;
    const hp = audio.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1800, now);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(Math.min(1, vol * 0.46), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    noise.connect(hp);
    hp.connect(gain);
    gain.connect(audio.destination);
    noise.start(now);

    // Falling glass tinkle shards + buzz
    playTone(1480, 0.09, "square", 0.14, 320);
    [90, 175, 290, 440, 620].forEach((ms, i) => {
      setTimeout(() => playTone(2100 + i * 320 + Math.random() * 450, 0.06, "triangle", 0.09, 980), ms);
    });
  }

  function stopLightBreak() {
    lightBreakActive = false;
    clearTimeout(lightBreakStopTimer);
    lightBreakStopTimer = null;
    clearInterval(lightBreakFadeInterval);
    lightBreakFadeInterval = null;
    if (lightBreakEl && !lightBreakEl.paused) {
      lightBreakEl.pause();
      try { lightBreakEl.currentTime = 0; } catch (_) {}
    }
  }

  function playLightBreak(durationSec) {
    stopLightBreak();
    lightBreakActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (lightBreakFailed) {
      playLightBreakFallback();
      return;
    }

    if (!lightBreakEl) {
      lightBreakEl = new Audio("audio/light_break.mp3");
      lightBreakEl.preload = "auto";
      lightBreakEl.addEventListener("error", () => {
        if (!lightBreakFailed) {
          lightBreakFailed = true;
          console.warn("[Duskwood Audio] 'audio/light_break.mp3' not found. Using shattering glass synth.");
          if (lightBreakActive) playLightBreakFallback();
        }
      });
    }

    try {
      const clipMs = Math.max(800, Math.round((durationSec || 5.0) * 1000));
      lightBreakEl.currentTime = 0;
      lightBreakEl.volume = vol;
      const p = lightBreakEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!lightBreakFailed) {
            lightBreakFailed = true;
            if (lightBreakActive) playLightBreakFallback();
          }
        });
      }

      const fadeMs = 260;
      lightBreakStopTimer = setTimeout(() => {
        if (!lightBreakEl || lightBreakEl.paused) {
          stopLightBreak();
          return;
        }
        const v0 = lightBreakEl.volume;
        const t0 = performance.now();
        lightBreakFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (lightBreakEl) lightBreakEl.volume = Math.max(0, v0 * (1 - frac));
          if (frac >= 1) stopLightBreak();
        }, 24);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      lightBreakFailed = true;
      playLightBreakFallback();
    }
  }

  function playCarEngineStart() {
    playTone(95, 0.22, "sawtooth", 0.14, 130);
    setTimeout(() => playTone(115, 0.28, "sawtooth", 0.15, 165), 240);
    setTimeout(() => playTone(140, 0.85, "sawtooth", 0.14, 210), 540);
    setTimeout(() => playTone(180, 1.10, "triangle", 0.12, 260), 1150);
  }

  // ==================== FEELING SMALL? TOY TRAIN SPATIAL LOOP (20s, CROSS-ROOM) ====================
  function computeToyTrainVolume() {
    const raw = getSfxVol() * 0.90 * Math.max(0, Math.min(1, toyTrainAttenuation));
    return raw < 0.004 ? 0 : Math.min(1, raw);
  }

  function playToyTrainFallbackChug() {
    const effVol = computeToyTrainVolume();
    if (!toyTrainActive || effVol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const step = toyTrainBeat % 8;
    toyTrainBeat += 1;

    // Rhythmic wooden clickety-clack chug
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(step % 2 === 0 ? 310 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.07);
    gain.gain.setValueAtTime(Math.max(0.0008, effVol * 0.14), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    // Occasional soft toy whistle toot-toot!
    if (step === 0 || step === 2) {
      const wOsc = audio.createOscillator();
      const wGain = audio.createGain();
      wOsc.type = "sine";
      wOsc.frequency.setValueAtTime(step === 0 ? 784 : 987.8, now);
      wGain.gain.setValueAtTime(Math.max(0.0008, effVol * 0.08), now);
      wGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);
      wOsc.connect(wGain);
      wGain.connect(audio.destination);
      wOsc.start(now);
      wOsc.stop(now + 0.24);
    }
  }

  function stopToyTrainLoop() {
    toyTrainActive = false;
    clearInterval(toyTrainWatchTimer);
    toyTrainWatchTimer = null;
    clearInterval(toyTrainFallbackTimer);
    toyTrainFallbackTimer = null;
    if (toyTrainEl && !toyTrainEl.paused) {
      toyTrainEl.pause();
      try { toyTrainEl.currentTime = 0; } catch (_) {}
    }
  }

  function startToyTrainFallback() {
    clearInterval(toyTrainFallbackTimer);
    if (!toyTrainActive) return;
    toyTrainFallbackTimer = setInterval(() => {
      if (!toyTrainActive) {
        clearInterval(toyTrainFallbackTimer);
        return;
      }
      playToyTrainFallbackChug();
    }, 340);
  }

  function startToyTrainLoop() {
    if (toyTrainActive) return;
    toyTrainActive = true;

    if (toyTrainFailed) {
      startToyTrainFallback();
      return;
    }

    if (!toyTrainEl) {
      toyTrainEl = new Audio("audio/toy_train_sfx.mp3");
      toyTrainEl.preload = "auto";
      toyTrainEl.addEventListener("error", () => {
        if (!toyTrainFailed) {
          toyTrainFailed = true;
          console.warn("[Duskwood Audio] 'audio/toy_train_sfx.mp3' not found. Using spatial wooden toy train synth.");
          if (toyTrainActive) startToyTrainFallback();
        }
      });
      toyTrainEl.addEventListener("ended", () => {
        if (!toyTrainActive || toyTrainFailed) return;
        try {
          toyTrainEl.currentTime = 0;
          toyTrainEl.play().catch(() => {});
        } catch (_) {}
      });
    }

    try {
      const vol = computeToyTrainVolume();
      toyTrainEl.currentTime = 0;
      toyTrainEl.volume = vol;
      toyTrainEl.muted = vol <= 0.001;
      const p = toyTrainEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!toyTrainFailed) {
            toyTrainFailed = true;
            if (toyTrainActive) startToyTrainFallback();
          }
        });
      }

      clearInterval(toyTrainWatchTimer);
      toyTrainWatchTimer = setInterval(() => {
        if (!toyTrainActive || !toyTrainEl || toyTrainFailed) {
          clearInterval(toyTrainWatchTimer);
          return;
        }
        if (toyTrainEl.currentTime >= TOY_TRAIN_LOOP_END_SEC) {
          try {
            toyTrainEl.currentTime = 0;
            if (toyTrainEl.paused) toyTrainEl.play().catch(() => {});
          } catch (_) {}
        }
      }, 60);
    } catch (_) {
      toyTrainFailed = true;
      startToyTrainFallback();
    }
  }

  function setToyTrainAttenuation(attenuation) {
    toyTrainAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeToyTrainVolume();
    if (toyTrainEl && !toyTrainFailed) {
      toyTrainEl.volume = vol;
      toyTrainEl.muted = vol <= 0.001;
      if (toyTrainActive && vol > 0.001 && toyTrainEl.paused) {
        toyTrainEl.play().catch(() => {});
      }
    }
  }

  // ==================== THE ATTIC GHOST SPATIAL LOOP (1.0s -> 3.0s) ====================
  function computeAtticGhostVolume() {
    const raw = getSfxVol() * 0.96 * Math.max(0, Math.min(1, atticGhostAttenuation));
    return raw < 0.004 ? 0 : Math.min(1, raw);
  }

  function playAtticGhostFallbackMoan() {
    const effVol = computeAtticGhostVolume();
    if (!atticGhostActive || effVol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const osc2 = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(248, now);
    osc.frequency.exponentialRampToValueAtTime(192, now + 0.9);
    osc.frequency.exponentialRampToValueAtTime(224, now + 1.8);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(372, now);
    osc2.frequency.exponentialRampToValueAtTime(288, now + 1.8);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(480, now);
    filter.Q.value = 3.2;

    const peak = Math.max(0.0008, effVol * 0.14);
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 1.85);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.9);
    osc2.stop(now + 1.9);
  }

  function stopAtticGhostLoop() {
    atticGhostActive = false;
    atticGhostAttenuation = 0;
    clearInterval(atticGhostWatchTimer);
    atticGhostWatchTimer = null;
    clearInterval(atticGhostFallbackTimer);
    atticGhostFallbackTimer = null;
    if (atticGhostEl && !atticGhostEl.paused) {
      atticGhostEl.pause();
      try { atticGhostEl.currentTime = ATTIC_GHOST_START_SEC; } catch (_) {}
    }
  }

  function startAtticGhostFallback() {
    clearInterval(atticGhostFallbackTimer);
    if (!atticGhostActive) return;
    playAtticGhostFallbackMoan();
    atticGhostFallbackTimer = setInterval(() => {
      if (!atticGhostActive) {
        clearInterval(atticGhostFallbackTimer);
        return;
      }
      playAtticGhostFallbackMoan();
    }, 1950);
  }

  function ensureAtticGhostElement() {
    if (atticGhostEl) return atticGhostEl;
    atticGhostEl = new Audio("audio/attic_ghost_sfx.mp3");
    atticGhostEl.preload = "auto";
    atticGhostEl.addEventListener("error", () => {
      if (!atticGhostFailed) {
        atticGhostFailed = true;
        console.warn("[Duskwood Audio] 'audio/attic_ghost_sfx.mp3' not found. Using spatial spectral ghost synth.");
        if (atticGhostActive) startAtticGhostFallback();
      }
    });
    atticGhostEl.addEventListener("ended", () => {
      if (!atticGhostActive || atticGhostFailed) return;
      try {
        const startPos = Number.isFinite(atticGhostEl.duration) && atticGhostEl.duration > ATTIC_GHOST_START_SEC + 0.4
          ? ATTIC_GHOST_START_SEC : 0;
        atticGhostEl.currentTime = startPos;
        atticGhostEl.play().catch(() => {});
      } catch (_) {}
    });
    return atticGhostEl;
  }

  function startAtticGhostLoop() {
    if (atticGhostActive) return;
    atticGhostActive = true;

    if (atticGhostFailed) {
      startAtticGhostFallback();
      return;
    }

    ensureAtticGhostElement();

    const beginClip = () => {
      if (!atticGhostActive || !atticGhostEl || atticGhostFailed) return;
      try {
        const hasRange = Number.isFinite(atticGhostEl.duration) && atticGhostEl.duration > ATTIC_GHOST_START_SEC + 0.4;
        const startPos = hasRange ? ATTIC_GHOST_START_SEC : 0;
        const vol = computeAtticGhostVolume();
        atticGhostEl.volume = vol;
        atticGhostEl.muted = vol <= 0.001;

        const doPlay = () => {
          if (!atticGhostActive || !atticGhostEl || atticGhostFailed) return;
          const p = atticGhostEl.play();
          if (p && typeof p.catch === "function") {
            p.catch((err) => {
              if (err && err.name === "NotSupportedError" && !atticGhostFailed) {
                atticGhostFailed = true;
                if (atticGhostActive) startAtticGhostFallback();
              }
            });
          }
        };

        if (Math.abs((atticGhostEl.currentTime || 0) - startPos) > 0.12) {
          let fired = false;
          const onSeeked = () => {
            if (fired) return;
            fired = true;
            doPlay();
          };
          atticGhostEl.addEventListener("seeked", onSeeked, { once: true });
          try { atticGhostEl.currentTime = startPos; } catch (_) { onSeeked(); return; }
          setTimeout(onSeeked, 110);
        } else {
          doPlay();
        }
      } catch (_) {
        atticGhostFailed = true;
        startAtticGhostFallback();
      }
    };

    if (atticGhostEl.readyState >= 1) {
      beginClip();
    } else {
      atticGhostEl.addEventListener("loadedmetadata", beginClip, { once: true });
      try { atticGhostEl.load(); } catch (_) {}
    }

    // Loop cleanly strictly when reaching 3.0s — NEVER fight in-progress seeks!
    clearInterval(atticGhostWatchTimer);
    atticGhostWatchTimer = setInterval(() => {
      if (!atticGhostActive || !atticGhostEl || atticGhostFailed) {
        clearInterval(atticGhostWatchTimer);
        return;
      }
      if (atticGhostEl.seeking) return;
      const endPos = Number.isFinite(atticGhostEl.duration)
        ? Math.min(ATTIC_GHOST_END_SEC, atticGhostEl.duration - 0.05)
        : ATTIC_GHOST_END_SEC;
      if (atticGhostEl.currentTime >= endPos) {
        const startPos = Number.isFinite(atticGhostEl.duration) && atticGhostEl.duration > ATTIC_GHOST_START_SEC + 0.4
          ? ATTIC_GHOST_START_SEC : 0;
        try {
          atticGhostEl.currentTime = startPos;
          if (atticGhostEl.paused) atticGhostEl.play().catch(() => {});
        } catch (_) {}
      }
    }, 55);
  }

  function setAtticGhostAttenuation(attenuation) {
    atticGhostAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeAtticGhostVolume();
    if (atticGhostEl && !atticGhostFailed) {
      atticGhostEl.volume = vol;
      atticGhostEl.muted = vol <= 0.001;
      if (atticGhostActive && vol > 0.001 && atticGhostEl.paused && !atticGhostEl.seeking) {
        atticGhostEl.play().catch(() => {});
      }
    }
  }

  // ==================== THE ATTIC EXORCISM SFX (audio/exorcism_sfx.mp3) ====================
  function playExorcismFallback() {
    // Rising cleansing flames & radiant choir resonance
    playTone(146.8, 0.85, "sawtooth", 0.14, 293.6);
    setTimeout(() => playTone(293.6, 0.95, "triangle", 0.14, 440.0), 320);
    setTimeout(() => playTone(440.0, 1.15, "sine", 0.14, 587.3), 780);
    setTimeout(() => playTone(587.3, 1.35, "triangle", 0.13, 880.0), 1350);
  }

  function stopExorcismSfx() {
    exorcismActive = false;
    if (exorcismEl && !exorcismEl.paused) {
      exorcismEl.pause();
      try { exorcismEl.currentTime = 0; } catch (_) {}
    }
  }

  function playExorcismSfx() {
    stopExorcismSfx();
    exorcismActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (exorcismFailed) {
      playExorcismFallback();
      return;
    }

    if (!exorcismEl) {
      exorcismEl = new Audio("audio/exorcism_sfx.mp3");
      exorcismEl.preload = "auto";
      exorcismEl.addEventListener("error", () => {
        if (!exorcismFailed) {
          exorcismFailed = true;
          console.warn("[Duskwood Audio] 'audio/exorcism_sfx.mp3' not found. Using cleansing ritual synth.");
          if (exorcismActive) playExorcismFallback();
        }
      });
      exorcismEl.addEventListener("ended", () => {
        exorcismActive = false;
      });
    }

    try {
      exorcismEl.currentTime = 0;
      exorcismEl.volume = vol;
      const p = exorcismEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!exorcismFailed) {
            exorcismFailed = true;
            if (exorcismActive) playExorcismFallback();
          }
        });
      }
    } catch (_) {
      exorcismFailed = true;
      playExorcismFallback();
    }
  }

  // ==================== SHARED EVENT MONSTER JUMPSCARE SFX (audio/jumpscare.mp3 — 4.0s) ====================
  function playJumpscareFallback() {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    // 1. Instant jarring sub-bass slam
    const sub = audio.createOscillator();
    const subG = audio.createGain();
    sub.type = "sawtooth";
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    subG.gain.setValueAtTime(Math.min(1, vol * 0.45), now);
    subG.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);
    sub.connect(subG);
    subG.connect(audio.destination);
    sub.start(now);
    sub.stop(now + 1.15);

    // 2. Dissonant metallic screech chord (tritone + minor 2nd shriek!)
    [466.16, 659.25, 698.46, 1244.5].forEach((freq, idx) => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = idx % 2 === 0 ? "sawtooth" : "square";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * (idx % 2 === 0 ? 1.14 : 0.78), now + 1.45);
      g.gain.setValueAtTime(Math.min(0.45, vol * 0.20), now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 1.85);
      osc.connect(g);
      g.connect(audio.destination);
      osc.start(now);
      osc.stop(now + 1.9);
    });

    // 3. Harsh distorted shriek noise blast
    const bufLen = Math.floor(audio.sampleRate * 1.45);
    const nBuf = audio.createBuffer(1, bufLen, audio.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.35);
    }
    const noise = audio.createBufferSource();
    noise.buffer = nBuf;
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1650, now);
    bp.Q.value = 1.4;
    const nGain = audio.createGain();
    nGain.gain.setValueAtTime(Math.min(1, vol * 0.55), now);
    nGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.45);
    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(audio.destination);
    noise.start(now);
  }

  function stopJumpscare() {
    jumpscareActive = false;
    clearTimeout(jumpscareStopTimer);
    jumpscareStopTimer = null;
    clearInterval(jumpscareFadeInterval);
    jumpscareFadeInterval = null;
    if (jumpscareEl && !jumpscareEl.paused) {
      jumpscareEl.pause();
      try { jumpscareEl.currentTime = 0; } catch (_) {}
    }
  }

  function ensureJumpscareElement() {
    if (jumpscareEl || jumpscareFailed) return jumpscareEl;
    jumpscareEl = new Audio("audio/jumpscare.mp3");
    jumpscareEl.preload = "auto";
    jumpscareEl.addEventListener("error", () => {
      if (!jumpscareFailed) {
        jumpscareFailed = true;
        console.warn("[Duskwood Audio] 'audio/jumpscare.mp3' not found. Using horror shriek synth.");
        if (jumpscareActive) playJumpscareFallback();
      }
    });
    jumpscareEl.addEventListener("ended", () => {
      jumpscareActive = false;
    });
    return jumpscareEl;
  }

  function warmUpJumpscare() {
    if (jumpscareFailed) return;
    const el = ensureJumpscareElement();
    if (!el || el._warmed) return;
    el._warmed = true;
    try {
      if (el.readyState === 0) el.load();
    } catch (_) {}
  }

  function playJumpscare(durationSec) {
    stopJumpscare();
    jumpscareActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (jumpscareFailed) {
      playJumpscareFallback();
      return;
    }

    ensureJumpscareElement();

    try {
      const clipMs = Math.max(1000, Math.round((durationSec || 4.0) * 1000));
      jumpscareEl.muted = false;
      jumpscareEl.currentTime = 0;
      jumpscareEl.volume = vol;
      const p = jumpscareEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!jumpscareFailed) {
            jumpscareFailed = true;
            if (jumpscareActive) playJumpscareFallback();
          }
        });
      }

      const fadeMs = 260;
      jumpscareStopTimer = setTimeout(() => {
        if (!jumpscareEl || jumpscareEl.paused) {
          stopJumpscare();
          return;
        }
        const v0 = jumpscareEl.volume;
        const t0 = performance.now();
        jumpscareFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (jumpscareEl) jumpscareEl.volume = Math.max(0, v0 * (1 - frac));
          if (frac >= 1) stopJumpscare();
        }, 22);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      jumpscareFailed = true;
      playJumpscareFallback();
    }
  }

  function warmUpAtticAudio() {
    if (!atticGhostFailed) {
      const el = ensureAtticGhostElement();
      if (!el._warmed) {
        el._warmed = true;
        try {
          if (el.readyState === 0) el.load();
        } catch (_) {}
      }
    }
    if (!exorcismFailed && !exorcismEl) {
      exorcismEl = new Audio("audio/exorcism_sfx.mp3");
      exorcismEl.preload = "auto";
      exorcismEl.addEventListener("error", () => { exorcismFailed = true; });
    }
  }

  function playShapeInsertSfx(isWin) {
    playTone(440, 0.09, "triangle", 0.16, 660);
    setTimeout(() => playTone(660, 0.12, "sine", 0.14, 880), 65);
    if (isWin) {
      setTimeout(() => playTone(880, 0.35, "triangle", 0.14, 1174.6), 160);
    }
  }

  // ==================== MUSICAL ROOMS MUSIC BOX (audio/music_rooms_sfx.mp3 — 0s -> 20s) ====================
  const MUSIC_BOX_NOTES = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 698.46, 523.25, 659.25, 783.99, 1046.5, 987.77, 880.0, 783.99, 659.25];

  function stopMusicalBox() {
    musicBoxActive = false;
    clearInterval(musicBoxWatchTimer);
    musicBoxWatchTimer = null;
    clearInterval(musicBoxFallbackTimer);
    musicBoxFallbackTimer = null;
    if (musicBoxEl && !musicBoxEl.paused) {
      musicBoxEl.pause();
      try { musicBoxEl.currentTime = 0; } catch (_) {}
    }
  }

  function startMusicalBoxFallback(durationSec) {
    clearInterval(musicBoxFallbackTimer);
    if (!musicBoxActive) return;
    musicBoxStep = 0;
    const tEnd = performance.now() + (durationSec || 35.0) * 1000;
    musicBoxFallbackTimer = setInterval(() => {
      if (!musicBoxActive || performance.now() >= tEnd) {
        stopMusicalBox();
        return;
      }
      const f = MUSIC_BOX_NOTES[musicBoxStep % MUSIC_BOX_NOTES.length];
      playTone(f, 0.24, "sine", 0.09, f * 0.996);
      if (musicBoxStep % 4 === 0) playTone(f * 0.5, 0.30, "triangle", 0.055);
      musicBoxStep += 1;
    }, 310);
  }

  function playMusicalBox20s(durationSec) {
    stopMusicalBox();
    musicBoxActive = true;
    const targetDur = durationSec || 35.0;
    const vol = Math.max(0, Math.min(1, getSfxVol() * 0.90));
    if (vol <= 0.001) return;

    if (musicBoxFailed) {
      startMusicalBoxFallback(targetDur);
      return;
    }

    if (!musicBoxEl) {
      musicBoxEl = new Audio("audio/music_rooms_sfx.mp3");
      musicBoxEl.loop = true;
      musicBoxEl.preload = "auto";
      musicBoxEl.addEventListener("error", () => {
        if (!musicBoxFailed) {
          musicBoxFailed = true;
          console.warn("[Duskwood Audio] 'audio/music_rooms_sfx.mp3' not found. Using music box synth.");
          if (musicBoxActive) startMusicalBoxFallback(targetDur);
        }
      });
    }

    try {
      const startMs = performance.now();
      musicBoxEl.loop = true;
      musicBoxEl.currentTime = 0;
      musicBoxEl.volume = vol;
      const p = musicBoxEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!musicBoxFailed) {
            musicBoxFailed = true;
            if (musicBoxActive) startMusicalBoxFallback(targetDur);
          }
        });
      }

      // Play cleanly for the full throwing duration (35s) then stop automatically!
      clearInterval(musicBoxWatchTimer);
      musicBoxWatchTimer = setInterval(() => {
        if (!musicBoxActive || !musicBoxEl || musicBoxFailed) {
          clearInterval(musicBoxWatchTimer);
          return;
        }
        const elapsed = (performance.now() - startMs) * 0.001;
        if (elapsed >= targetDur) {
          stopMusicalBox();
        }
      }, 60);
    } catch (_) {
      musicBoxFailed = true;
      startMusicalBoxFallback(targetDur);
    }
  }

  // ==================== GIANT MONKEY SFX (audio/monkey_sfx.mp3 — 9.0 seconds) ====================
  function computeMonkeyVolume() {
    const raw = getSfxVol() * 0.96 * Math.max(0, Math.min(1, monkeyAttenuation));
    return raw < 0.004 ? 0 : Math.min(1, raw);
  }

  function playMonkeyFallbackRoar() {
    const effVol = computeMonkeyVolume();
    if (!monkeyActive || effVol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    // Deep guttural monkey roar + metallic cymbal crash
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.72);
    gain.gain.setValueAtTime(Math.max(0.0008, effVol * 0.16), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.75);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.78);

    // Toy cymbal metallic clang
    playTone(1380, 0.14, "square", 0.06 * monkeyAttenuation, 720);
    setTimeout(() => {
      if (monkeyActive) playTone(1620, 0.12, "square", 0.055 * monkeyAttenuation, 840);
    }, 320);
  }

  function stopMonkeySfx() {
    monkeyActive = false;
    monkeyLoopMode = false;
    clearInterval(monkeyWatchTimer);
    monkeyWatchTimer = null;
    clearInterval(monkeyFallbackTimer);
    monkeyFallbackTimer = null;
    if (monkeyEl && !monkeyEl.paused) {
      monkeyEl.pause();
      try { monkeyEl.currentTime = 0; } catch (_) {}
    }
  }

  function startMonkeyFallback(loop) {
    clearInterval(monkeyFallbackTimer);
    if (!monkeyActive) return;
    playMonkeyFallbackRoar();
    if (!loop) return;
    monkeyFallbackTimer = setInterval(() => {
      if (!monkeyActive) {
        clearInterval(monkeyFallbackTimer);
        return;
      }
      playMonkeyFallbackRoar();
    }, 1500);
  }

  function playMonkeySfx(loop) {
    const wantLoop = Boolean(loop);
    if (monkeyActive && monkeyLoopMode === wantLoop) return;
    stopMonkeySfx();
    monkeyActive = true;
    monkeyLoopMode = wantLoop;
    monkeyAttenuation = 1.0;

    if (monkeyFailed) {
      startMonkeyFallback(wantLoop);
      return;
    }

    if (!monkeyEl) {
      monkeyEl = new Audio("audio/monkey_sfx.mp3");
      monkeyEl.preload = "auto";
      monkeyEl.addEventListener("error", () => {
        if (!monkeyFailed) {
          monkeyFailed = true;
          console.warn("[Duskwood Audio] 'audio/monkey_sfx.mp3' not found. Using giant monkey synth.");
          if (monkeyActive) startMonkeyFallback(monkeyLoopMode);
        }
      });
      monkeyEl.addEventListener("ended", () => {
        if (!monkeyActive || monkeyFailed) return;
        if (monkeyLoopMode) {
          try {
            monkeyEl.currentTime = 0;
            monkeyEl.play().catch(() => {});
          } catch (_) {}
        } else {
          stopMonkeySfx();
        }
      });
    }

    try {
      const vol = computeMonkeyVolume();
      monkeyEl.currentTime = 0;
      monkeyEl.volume = vol;
      monkeyEl.muted = vol <= 0.001;
      const p = monkeyEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!monkeyFailed) {
            monkeyFailed = true;
            if (monkeyActive) startMonkeyFallback(monkeyLoopMode);
          }
        });
      }

      clearInterval(monkeyWatchTimer);
      monkeyWatchTimer = setInterval(() => {
        if (!monkeyActive || !monkeyEl || monkeyFailed) {
          clearInterval(monkeyWatchTimer);
          return;
        }
        if (monkeyEl.currentTime >= MONKEY_CLIP_END_SEC) {
          if (monkeyLoopMode) {
            try {
              monkeyEl.currentTime = 0;
              if (monkeyEl.paused && computeMonkeyVolume() > 0.001) monkeyEl.play().catch(() => {});
            } catch (_) {}
          } else {
            stopMonkeySfx();
          }
        }
      }, 50);
    } catch (_) {
      monkeyFailed = true;
      startMonkeyFallback(wantLoop);
    }
  }

  function setMonkeySfxAttenuation(attenuation) {
    monkeyAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeMonkeyVolume();
    if (monkeyEl && !monkeyFailed) {
      monkeyEl.volume = vol;
      monkeyEl.muted = vol <= 0.001;
      if (monkeyActive && vol > 0.001 && monkeyEl.paused) {
        monkeyEl.play().catch(() => {});
      }
    }
  }

  function playPopcornThrowSfx() {
    playTone(260, 0.10, "triangle", 0.14, 520);
  }

  function playPopcornScoreSfx(isWin) {
    playTone(523.25, 0.08, "triangle", 0.15, 659.25);
    setTimeout(() => playTone(783.99, 0.12, "sine", 0.14, 987.77), 60);
    if (isWin) {
      setTimeout(() => playTone(1046.5, 0.36, "triangle", 0.15, 1318.5), 140);
    }
  }

  // ==================== THE BASEMENT HYDRAULIC SLIDE (audio/basement_start_sfx.mp3 — 14s) ====================
  function playBasementSlideFallbackPulse() {
    const vol = getSfxVol();
    if (!basementSlideActive || vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const osc2 = audio.createOscillator();
    const lp = audio.createBiquadFilter();
    const gain = audio.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(52 + Math.random() * 14, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.55);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(92 + Math.random() * 18, now);
    osc2.frequency.exponentialRampToValueAtTime(64, now + 0.55);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(Math.max(0.0008, vol * 0.16), now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.56);

    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.58);
    osc2.stop(now + 0.58);
  }

  function stopBasementSlide() {
    basementSlideActive = false;
    clearTimeout(basementSlideStopTimer);
    basementSlideStopTimer = null;
    clearInterval(basementSlideFadeInterval);
    basementSlideFadeInterval = null;
    clearInterval(basementSlideFallbackTimer);
    basementSlideFallbackTimer = null;
    if (basementSlideEl && !basementSlideEl.paused) {
      basementSlideEl.pause();
      try { basementSlideEl.currentTime = 0; } catch (_) {}
    }
  }

  function startBasementSlideFallback(durationMs) {
    clearInterval(basementSlideFallbackTimer);
    if (!basementSlideActive) return;
    const tEnd = performance.now() + durationMs;
    playBasementSlideFallbackPulse();
    basementSlideFallbackTimer = setInterval(() => {
      if (!basementSlideActive || performance.now() >= tEnd) {
        stopBasementSlide();
        return;
      }
      playBasementSlideFallbackPulse();
    }, 480);
  }

  function playBasementSlide(durationSec) {
    stopBasementSlide();
    basementSlideActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    const clipMs = Math.max(1000, Math.round((durationSec || BASEMENT_SLIDE_SEC) * 1000));

    if (basementSlideFailed) {
      startBasementSlideFallback(clipMs);
      return;
    }

    if (!basementSlideEl) {
      basementSlideEl = new Audio("audio/basement_start_sfx.mp3");
      basementSlideEl.preload = "auto";
      basementSlideEl.addEventListener("error", () => {
        if (!basementSlideFailed) {
          basementSlideFailed = true;
          console.warn("[Duskwood Audio] 'audio/basement_start_sfx.mp3' not found. Using heavy underground rumble synth.");
          if (basementSlideActive) startBasementSlideFallback(clipMs);
        }
      });
    }

    try {
      basementSlideEl.currentTime = 0;
      basementSlideEl.volume = vol;
      const p = basementSlideEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!basementSlideFailed) {
            basementSlideFailed = true;
            if (basementSlideActive) startBasementSlideFallback(clipMs);
          }
        });
      }

      const fadeMs = 380;
      basementSlideStopTimer = setTimeout(() => {
        if (!basementSlideEl || basementSlideEl.paused) {
          stopBasementSlide();
          return;
        }
        const v0 = basementSlideEl.volume;
        const t0 = performance.now();
        basementSlideFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (basementSlideEl) basementSlideEl.volume = Math.max(0, v0 * (1 - frac));
          if (frac >= 1) stopBasementSlide();
        }, 28);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      basementSlideFailed = true;
      startBasementSlideFallback(clipMs);
    }
  }

  // ==================== CHAINSAW-HEAD MONSTER SPATIAL LOOP (audio/chainsaw_sfx.mp3 — 11s) ====================
  function computeChainsawVolume() {
    const raw = getSfxVol() * 0.96 * Math.max(0, Math.min(1, chainsawAttenuation));
    return raw < 0.004 ? 0 : Math.min(1, raw);
  }

  function playChainsawFallbackBuzz() {
    const effVol = computeChainsawVolume();
    if (!chainsawActive || effVol <= 0.001) return;
    const audio = ensureContext();
    if (!audio || audio.state !== "running") return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    const bp = audio.createBiquadFilter();
    const gain = audio.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(112, now + 0.14);
    osc.frequency.linearRampToValueAtTime(86, now + 0.28);

    lfo.type = "square";
    lfo.frequency.setValueAtTime(28, now);
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    bp.type = "bandpass";
    bp.frequency.setValueAtTime(420, now);
    bp.Q.value = 1.6;

    const peak = Math.max(0.0008, effVol * 0.17);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.29);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.30);
    lfo.stop(now + 0.30);
  }

  function stopChainsawLoop() {
    chainsawActive = false;
    chainsawAttenuation = 0;
    clearInterval(chainsawWatchTimer);
    chainsawWatchTimer = null;
    clearInterval(chainsawFallbackTimer);
    chainsawFallbackTimer = null;
    if (chainsawEl && !chainsawEl.paused) {
      chainsawEl.pause();
      try { chainsawEl.currentTime = 0; } catch (_) {}
    }
  }

  function startChainsawFallback() {
    clearInterval(chainsawFallbackTimer);
    if (!chainsawActive) return;
    playChainsawFallbackBuzz();
    chainsawFallbackTimer = setInterval(() => {
      if (!chainsawActive) {
        clearInterval(chainsawFallbackTimer);
        return;
      }
      playChainsawFallbackBuzz();
    }, 290);
  }

  function startChainsawLoop() {
    if (chainsawActive) return;
    chainsawActive = true;

    if (chainsawFailed) {
      startChainsawFallback();
      return;
    }

    if (!chainsawEl) {
      chainsawEl = new Audio("audio/chainsaw_sfx.mp3");
      chainsawEl.preload = "auto";
      chainsawEl.addEventListener("error", () => {
        if (!chainsawFailed) {
          chainsawFailed = true;
          console.warn("[Duskwood Audio] 'audio/chainsaw_sfx.mp3' not found. Using spatial chainsaw buzz synth.");
          if (chainsawActive) startChainsawFallback();
        }
      });
      chainsawEl.addEventListener("ended", () => {
        if (!chainsawActive || chainsawFailed) return;
        try {
          chainsawEl.currentTime = 0;
          chainsawEl.play().catch(() => {});
        } catch (_) {}
      });
    }

    try {
      const vol = computeChainsawVolume();
      chainsawEl.currentTime = 0;
      chainsawEl.volume = vol;
      chainsawEl.muted = vol <= 0.001;
      const p = chainsawEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!chainsawFailed) {
            chainsawFailed = true;
            if (chainsawActive) startChainsawFallback();
          }
        });
      }

      clearInterval(chainsawWatchTimer);
      chainsawWatchTimer = setInterval(() => {
        if (!chainsawActive || !chainsawEl || chainsawFailed) {
          clearInterval(chainsawWatchTimer);
          return;
        }
        if (chainsawEl.currentTime >= CHAINSAW_LOOP_END_SEC) {
          try {
            chainsawEl.currentTime = 0;
            if (chainsawEl.paused && computeChainsawVolume() > 0.001) chainsawEl.play().catch(() => {});
          } catch (_) {}
        }
      }, 45);
    } catch (_) {
      chainsawFailed = true;
      startChainsawFallback();
    }
  }

  function setChainsawAttenuation(attenuation) {
    chainsawAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeChainsawVolume();
    if (chainsawEl && !chainsawFailed) {
      chainsawEl.volume = vol;
      chainsawEl.muted = vol <= 0.001;
      if (chainsawActive && vol > 0.001 && chainsawEl.paused) {
        chainsawEl.play().catch(() => {});
      }
    }
  }

  // ==================== RED BALLOONS SPATIAL PROXIMITY LOOP (audio/balloons_sfx.mp3) ====================
  function computeBalloonsSfxVolume() {
    const raw = getSfxVol() * 0.90 * Math.max(0, Math.min(1, balloonsSfxAttenuation));
    return Math.max(0, Math.min(1, raw));
  }

  function playBalloonsFallbackRub() {
    const effVol = computeBalloonsSfxVolume();
    if (!balloonsSfxActive || effVol <= 0.001) return;
    const c = ensureContext();
    if (!c || c.state === "suspended") return;
    const now = c.currentTime;

    // Soft eerie rubber-creak / hollow float shimmer as fallback if balloons_sfx.mp3 is absent
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340 + Math.random() * 65, now);
    osc.frequency.exponentialRampToValueAtTime(520 + Math.random() * 80, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.28);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.11 * effVol, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  function stopBalloonsSfxLoop() {
    balloonsSfxActive = false;
    balloonsSfxAttenuation = 0;
    clearInterval(balloonsSfxFallbackTimer);
    balloonsSfxFallbackTimer = null;
    if (balloonsSfxEl && !balloonsSfxEl.paused) {
      balloonsSfxEl.pause();
      try { balloonsSfxEl.currentTime = 0; } catch (_) {}
    }
  }

  function startBalloonsSfxFallback() {
    clearInterval(balloonsSfxFallbackTimer);
    if (!balloonsSfxActive) return;
    playBalloonsFallbackRub();
    balloonsSfxFallbackTimer = setInterval(() => {
      if (!balloonsSfxActive) {
        clearInterval(balloonsSfxFallbackTimer);
        return;
      }
      playBalloonsFallbackRub();
    }, 880);
  }

  function startBalloonsSfxLoop() {
    if (balloonsSfxActive) return;
    balloonsSfxActive = true;

    if (balloonsSfxFailed) {
      startBalloonsSfxFallback();
      return;
    }

    if (!balloonsSfxEl) {
      balloonsSfxEl = new Audio("audio/balloons_sfx.mp3");
      balloonsSfxEl.preload = "auto";
      balloonsSfxEl.loop = true;
      balloonsSfxEl.addEventListener("error", () => {
        if (!balloonsSfxFailed) {
          balloonsSfxFailed = true;
          console.warn("[Duskwood Audio] 'audio/balloons_sfx.mp3' not found. Using spatial balloon synth fallback.");
          if (balloonsSfxActive) startBalloonsSfxFallback();
        }
      });
    }

    try {
      const vol = computeBalloonsSfxVolume();
      balloonsSfxEl.currentTime = 0;
      balloonsSfxEl.volume = vol;
      balloonsSfxEl.muted = vol <= 0.001;
      const p = balloonsSfxEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!balloonsSfxFailed) {
            balloonsSfxFailed = true;
            if (balloonsSfxActive) startBalloonsSfxFallback();
          }
        });
      }
    } catch (_) {
      balloonsSfxFailed = true;
      startBalloonsSfxFallback();
    }
  }

  function setBalloonsSfxAttenuation(attenuation) {
    balloonsSfxAttenuation = Math.max(0, Math.min(1, attenuation));
    const vol = computeBalloonsSfxVolume();
    if (balloonsSfxEl && !balloonsSfxFailed) {
      balloonsSfxEl.volume = vol;
      balloonsSfxEl.muted = vol <= 0.001;
      if (balloonsSfxActive && vol > 0.001 && balloonsSfxEl.paused) {
        balloonsSfxEl.play().catch(() => {});
      }
    }
  }

  function playElectricRepairTick() {
    playTone(980 + Math.random() * 420, 0.04, "sawtooth", 0.07, 420);
  }

  function playBreakerFixedSfx(isAllDone) {
    playTone(220, 0.07, "square", 0.14, 440);
    setTimeout(() => playTone(587.3, 0.14, "triangle", 0.15, 880), 75);
    if (isAllDone) {
      setTimeout(() => playTone(880, 0.42, "triangle", 0.16, 1174.6), 175);
    }
  }

  // ==================== STAY IN THE LIGHT SWITCH SURGE (audio/light_switch_sfx.mp3 — 4s) ====================
  function playLightSurgeFallback() {
    playTone(920, 0.04, "square", 0.14, 380);
    setTimeout(() => playTone(640, 0.05, "square", 0.13, 280), 65);
    setTimeout(() => playTone(120, 0.35, "sawtooth", 0.07, 90), 110);
  }

  function stopLightSwitchSurge() {
    lightSurgeActive = false;
    clearTimeout(lightSurgeStopTimer);
    lightSurgeStopTimer = null;
    clearInterval(lightSurgeFadeInterval);
    lightSurgeFadeInterval = null;
    if (lightSurgeEl && !lightSurgeEl.paused) {
      lightSurgeEl.pause();
      try { lightSurgeEl.currentTime = 0; } catch (_) {}
    }
  }

  function playLightSwitchSurge(durationSec) {
    stopLightSwitchSurge();
    lightSurgeActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (lightSurgeFailed) {
      playLightSurgeFallback();
      return;
    }

    if (!lightSurgeEl) {
      lightSurgeEl = new Audio("audio/light_switch_sfx.mp3");
      lightSurgeEl.preload = "auto";
      lightSurgeEl.addEventListener("error", () => {
        if (!lightSurgeFailed) {
          lightSurgeFailed = true;
          console.warn("[Duskwood Audio] 'audio/light_switch_sfx.mp3' not found. Using breaker switch synth.");
          if (lightSurgeActive) playLightSurgeFallback();
        }
      });
    }

    try {
      const clipMs = Math.max(800, Math.round((durationSec || 4.0) * 1000));
      lightSurgeEl.currentTime = 0;
      lightSurgeEl.volume = vol;
      const p = lightSurgeEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!lightSurgeFailed) {
            lightSurgeFailed = true;
            if (lightSurgeActive) playLightSurgeFallback();
          }
        });
      }
      const fadeMs = 240;
      lightSurgeStopTimer = setTimeout(() => {
        if (!lightSurgeEl || lightSurgeEl.paused) {
          stopLightSwitchSurge();
          return;
        }
        const v0 = lightSurgeEl.volume;
        const t0 = performance.now();
        lightSurgeFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (lightSurgeEl) lightSurgeEl.volume = Math.max(0, v0 * (1 - frac));
          if (frac >= 1) stopLightSwitchSurge();
        }, 22);
      }, Math.max(0, clipMs - fadeMs));
    } catch (_) {
      lightSurgeFailed = true;
      playLightSurgeFallback();
    }
  }

  function playShadowHoundVanishSfx() {
    playTone(760, 0.28, "sawtooth", 0.11, 210);
    setTimeout(() => playTone(1180, 0.34, "sine", 0.09, 420), 60);
  }

  // ==================== THE NEIGHBOR DOOR KNOCK (audio/door_knock_sfx.mp3 — 5s) ====================
  function playSingleWoodKnock(volScale) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const lp = audio.createBiquadFilter();
    const gain = audio.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.09);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(420, now);

    const peak = Math.max(0.001, vol * 0.36 * (volScale || 1));
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  function playDoorKnockFallback() {
    // Two heavy eerie triple-knock sets across 5 seconds!
    [120, 460, 800, 2350, 2690, 3030].forEach((ms, i) => {
      const id = setTimeout(() => {
        if (!doorKnockActive) return;
        playSingleWoodKnock(i % 3 === 0 ? 1.0 : 0.88);
      }, ms);
      doorKnockTimers.push(id);
    });
    const endId = setTimeout(() => { doorKnockActive = false; }, 4900);
    doorKnockTimers.push(endId);
  }

  function stopDoorKnock() {
    doorKnockActive = false;
    clearTimeout(doorKnockStopTimer);
    doorKnockStopTimer = null;
    clearInterval(doorKnockFadeInterval);
    doorKnockFadeInterval = null;
    doorKnockTimers.forEach((id) => clearTimeout(id));
    doorKnockTimers = [];
    if (doorKnockEl && !doorKnockEl.paused) {
      doorKnockEl.pause();
      try { doorKnockEl.currentTime = 0; } catch (_) {}
    }
  }

  function detectLeadingSilenceSec(url, onDetected) {
    if (typeof fetch !== "function" || location.protocol === "file:") return;
    const audio = ensureContext();
    if (!audio || typeof audio.decodeAudioData !== "function") return;
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => (buf ? audio.decodeAudioData(buf) : null))
      .then((decoded) => {
        if (!decoded) return;
        const ch0 = decoded.getChannelData(0);
        const sr = decoded.sampleRate || 44100;
        const threshold = 0.014;
        let firstIdx = 0;
        for (let i = 0; i < ch0.length; i += 64) {
          if (Math.abs(ch0[i]) >= threshold) {
            firstIdx = Math.max(0, i - Math.floor(sr * 0.02));
            break;
          }
        }
        const trimSec = firstIdx / sr;
        // Only trim if meaningful leading silence (> 80ms) & leaves at least 0.6s of audio
        if (trimSec > 0.08 && decoded.duration - trimSec > 0.6) {
          onDetected(trimSec);
        }
      })
      .catch(() => {});
  }

  function ensureNeighborAudioElements() {
    if (!doorKnockEl && !doorKnockFailed) {
      doorKnockEl = new Audio("audio/door_knock_sfx.mp3");
      doorKnockEl.preload = "auto";
      doorKnockEl.addEventListener("error", () => {
        if (!doorKnockFailed) {
          doorKnockFailed = true;
          console.warn("[Duskwood Audio] 'audio/door_knock_sfx.mp3' not found. Using wooden door knock synth.");
          if (doorKnockActive) playDoorKnockFallback();
        }
      });
      detectLeadingSilenceSec("audio/door_knock_sfx.mp3", (sec) => {
        doorKnockTrimSec = sec;
        if (doorKnockEl && doorKnockEl.paused && doorKnockEl.readyState >= 1) {
          try { doorKnockEl.currentTime = sec; } catch (_) {}
        }
      });
    }
    if (!doorOpenEl && !doorOpenFailed) {
      doorOpenEl = new Audio("audio/door_open_sfx.mp3");
      doorOpenEl.preload = "auto";
      doorOpenEl.addEventListener("error", () => {
        if (!doorOpenFailed) {
          doorOpenFailed = true;
          console.warn("[Duskwood Audio] 'audio/door_open_sfx.mp3' not found. Using creaking cabin door synth.");
          if (doorOpenActive) playDoorOpenFallback();
        }
      });
      detectLeadingSilenceSec("audio/door_open_sfx.mp3", (sec) => {
        doorOpenTrimSec = sec;
        if (doorOpenEl && doorOpenEl.paused && doorOpenEl.readyState >= 1) {
          try { doorOpenEl.currentTime = sec; } catch (_) {}
        }
      });
    }
  }

  function warmUpNeighborAudio() {
    ensureNeighborAudioElements();
    [doorKnockEl, doorOpenEl].forEach((el) => {
      if (!el || el._warmed) return;
      el._warmed = true;
      try {
        if (el.readyState === 0) el.load();
      } catch (_) {}
    });
  }

  function playDoorKnock(durationSec) {
    stopDoorKnock();
    doorKnockActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (doorKnockFailed) {
      playDoorKnockFallback();
      return;
    }

    ensureNeighborAudioElements();

    try {
      const clipMs = Math.max(1200, Math.round((durationSec || 5.0) * 1000));
      const startPos = doorKnockTrimSec || 0;
      doorKnockEl.muted = false;
      doorKnockEl.volume = vol;

      const scheduleFade = () => {
        clearTimeout(doorKnockStopTimer);
        const fadeMs = 260;
        doorKnockStopTimer = setTimeout(() => {
          if (!doorKnockEl || doorKnockEl.paused) {
            stopDoorKnock();
            return;
          }
          const v0 = doorKnockEl.volume;
          const t0 = performance.now();
          doorKnockFadeInterval = setInterval(() => {
            const frac = Math.min(1, (performance.now() - t0) / fadeMs);
            if (doorKnockEl) doorKnockEl.volume = Math.max(0, v0 * (1 - frac));
            if (frac >= 1) stopDoorKnock();
          }, 22);
        }, Math.max(0, clipMs - fadeMs));
      };

      const startNow = () => {
        if (!doorKnockActive || !doorKnockEl) return;
        const p = doorKnockEl.play();
        if (p && typeof p.then === "function") {
          p.then(scheduleFade).catch(() => {
            if (!doorKnockFailed) {
              doorKnockFailed = true;
              if (doorKnockActive) playDoorKnockFallback();
            }
          });
        } else {
          scheduleFade();
        }
      };

      if (doorKnockEl.readyState >= 1 && Math.abs((doorKnockEl.currentTime || 0) - startPos) > 0.05) {
        let fired = false;
        const go = () => { if (!fired) { fired = true; startNow(); } };
        doorKnockEl.addEventListener("seeked", go, { once: true });
        try { doorKnockEl.currentTime = startPos; } catch (_) { go(); return; }
        setTimeout(go, 70);
      } else {
        startNow();
      }
    } catch (_) {
      doorKnockFailed = true;
      playDoorKnockFallback();
    }
  }

  // ==================== THE NEIGHBOR DOOR OPEN (audio/door_open_sfx.mp3 — 5s) ====================
  function playDoorOpenFallback() {
    playTone(540, 0.04, "square", 0.12, 260);
    setTimeout(() => playTone(215, 0.95, "sawtooth", 0.075, 162), 140);
    setTimeout(() => playTone(318, 1.35, "sawtooth", 0.065, 244), 480);
    setTimeout(() => playTone(160, 0.45, "triangle", 0.07, 118), 1650);
  }

  function stopDoorOpen() {
    doorOpenActive = false;
    clearTimeout(doorOpenStopTimer);
    doorOpenStopTimer = null;
    clearInterval(doorOpenFadeInterval);
    doorOpenFadeInterval = null;
    if (doorOpenEl && !doorOpenEl.paused) {
      doorOpenEl.pause();
      try { doorOpenEl.currentTime = doorOpenTrimSec || 0; } catch (_) {}
    }
  }

  function playDoorOpen(durationSec) {
    stopDoorOpen();
    doorOpenActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    if (doorOpenFailed) {
      playDoorOpenFallback();
      return;
    }

    ensureNeighborAudioElements();

    try {
      const clipMs = Math.max(1200, Math.round((durationSec || 5.0) * 1000));
      const startPos = doorOpenTrimSec || 0;
      doorOpenEl.muted = false;
      doorOpenEl.volume = vol;

      const scheduleFade = () => {
        clearTimeout(doorOpenStopTimer);
        const fadeMs = 300;
        doorOpenStopTimer = setTimeout(() => {
          if (!doorOpenEl || doorOpenEl.paused) {
            stopDoorOpen();
            return;
          }
          const v0 = doorOpenEl.volume;
          const t0 = performance.now();
          doorOpenFadeInterval = setInterval(() => {
            const frac = Math.min(1, (performance.now() - t0) / fadeMs);
            if (doorOpenEl) doorOpenEl.volume = Math.max(0, v0 * (1 - frac));
            if (frac >= 1) stopDoorOpen();
          }, 24);
        }, Math.max(0, clipMs - fadeMs));
      };

      const startNow = () => {
        if (!doorOpenActive || !doorOpenEl) return;
        const p = doorOpenEl.play();
        if (p && typeof p.then === "function") {
          p.then(scheduleFade).catch(() => {
            if (!doorOpenFailed) {
              doorOpenFailed = true;
              if (doorOpenActive) playDoorOpenFallback();
            }
          });
        } else {
          scheduleFade();
        }
      };

      if (doorOpenEl.readyState >= 1 && Math.abs((doorOpenEl.currentTime || 0) - startPos) > 0.05) {
        let fired = false;
        const go = () => { if (!fired) { fired = true; startNow(); } };
        doorOpenEl.addEventListener("seeked", go, { once: true });
        try { doorOpenEl.currentTime = startPos; } catch (_) { go(); return; }
        setTimeout(go, 70);
      } else {
        startNow();
      }
    } catch (_) {
      doorOpenFailed = true;
      playDoorOpenFallback();
    }
  }

  // ==================== THE KNIGHT FOOTSTEP SFX (audio/knight_footstep_sfx.mp3 — 0.0s -> 2.0s loop) ====================
  function playSingleArmorClank(volScale) {
    const vol = getSfxVol();
    if (vol <= 0.001) return;
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime;

    // Deep heavy plate-boot thud + metallic steel clink
    const thud = audio.createOscillator();
    const tGain = audio.createGain();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(112, now);
    thud.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    tGain.gain.setValueAtTime(Math.max(0.001, vol * 0.34 * (volScale || 1)), now);
    tGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    thud.connect(tGain);
    tGain.connect(audio.destination);
    thud.start(now);
    thud.stop(now + 0.17);

    const clink = audio.createOscillator();
    const bp = audio.createBiquadFilter();
    const cGain = audio.createGain();
    clink.type = "sawtooth";
    clink.frequency.setValueAtTime(540 + Math.random() * 90, now);
    clink.frequency.exponentialRampToValueAtTime(280, now + 0.11);
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(980, now);
    bp.Q.value = 3.5;
    cGain.gain.setValueAtTime(Math.max(0.001, vol * 0.14 * (volScale || 1)), now);
    cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
    clink.connect(bp);
    bp.connect(cGain);
    cGain.connect(audio.destination);
    clink.start(now);
    clink.stop(now + 0.13);
  }

  function playKnightFootstepFallback(durationMs) {
    const steps = Math.max(2, Math.floor(durationMs / 480));
    for (let i = 0; i < steps; i++) {
      const id = setTimeout(() => {
        if (!knightStepActive) return;
        playSingleArmorClank(i % 2 === 0 ? 1.0 : 0.85);
      }, i * 480);
      knightStepFallbackTimers.push(id);
    }
    const endId = setTimeout(() => { knightStepActive = false; }, durationMs + 40);
    knightStepFallbackTimers.push(endId);
  }

  function stopKnightFootstep() {
    knightStepActive = false;
    clearInterval(knightStepWatchTimer);
    knightStepWatchTimer = null;
    clearTimeout(knightStepStopTimer);
    knightStepStopTimer = null;
    clearInterval(knightStepFadeInterval);
    knightStepFadeInterval = null;
    knightStepFallbackTimers.forEach((id) => clearTimeout(id));
    knightStepFallbackTimers = [];
    if (knightStepEl && !knightStepEl.paused) {
      knightStepEl.pause();
      try { knightStepEl.currentTime = 0; } catch (_) {}
    }
  }

  function playKnightFootstep(durationSec) {
    stopKnightFootstep();
    knightStepActive = true;
    const vol = Math.max(0, Math.min(1, getSfxVol()));
    if (vol <= 0.001) return;

    const totalMs = Math.max(400, Math.round((durationSec || KNIGHT_STEP_END_SEC) * 1000));

    if (knightStepFailed) {
      playKnightFootstepFallback(totalMs);
      return;
    }

    if (!knightStepEl) {
      knightStepEl = new Audio("audio/knight_footstep_sfx.mp3");
      knightStepEl.preload = "auto";
      knightStepEl.addEventListener("error", () => {
        if (!knightStepFailed) {
          knightStepFailed = true;
          console.warn("[Duskwood Audio] 'audio/knight_footstep_sfx.mp3' not found. Using armored footstep synth.");
          if (knightStepActive) playKnightFootstepFallback(totalMs);
        }
      });
      knightStepEl.addEventListener("ended", () => {
        if (!knightStepActive || knightStepFailed) return;
        try {
          knightStepEl.currentTime = 0;
          knightStepEl.play().catch(() => {});
        } catch (_) {}
      });
    }

    try {
      knightStepEl.currentTime = 0;
      knightStepEl.volume = vol;
      const p = knightStepEl.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (!knightStepFailed) {
            knightStepFailed = true;
            if (knightStepActive) playKnightFootstepFallback(totalMs);
          }
        });
      }

      // Strictly loop within ONLY the first 2.0 seconds (0.0s -> 2.0s) whenever Knight is moving!
      clearInterval(knightStepWatchTimer);
      knightStepWatchTimer = setInterval(() => {
        if (!knightStepActive || !knightStepEl || knightStepFailed) {
          clearInterval(knightStepWatchTimer);
          return;
        }
        if (knightStepEl.currentTime >= KNIGHT_STEP_END_SEC) {
          try {
            knightStepEl.currentTime = 0;
            if (knightStepEl.paused) knightStepEl.play().catch(() => {});
          } catch (_) {}
        }
      }, 30);

      const fadeMs = 180;
      knightStepStopTimer = setTimeout(() => {
        if (!knightStepEl || knightStepEl.paused) {
          stopKnightFootstep();
          return;
        }
        const v0 = knightStepEl.volume;
        const t0 = performance.now();
        knightStepFadeInterval = setInterval(() => {
          const frac = Math.min(1, (performance.now() - t0) / fadeMs);
          if (knightStepEl) knightStepEl.volume = Math.max(0, v0 * (1 - frac));
          if (frac >= 1) stopKnightFootstep();
        }, 20);
      }, Math.max(0, totalMs - fadeMs));
    } catch (_) {
      knightStepFailed = true;
      playKnightFootstepFallback(totalMs);
    }
  }

  const SFX = {
    hover() {
      playTone(460, 0.04, "triangle", 0.06, 520);
    },
    click() {
      playTone(260, 0.055, "square", 0.09, 175);
      setTimeout(() => playTone(520, 0.045, "triangle", 0.08, 610), 22);
    },
    open() {
      playTone(240, 0.07, "triangle", 0.11, 360);
      setTimeout(() => playTone(380, 0.09, "triangle", 0.10, 520), 45);
    },
    close() {
      playTone(390, 0.06, "triangle", 0.10, 270);
      setTimeout(() => playTone(250, 0.08, "triangle", 0.09, 170), 40);
    },
    swatch() {
      playTone(540, 0.045, "sine", 0.08, 690);
    },
    random() {
      const notes = [330, 440, 554, 659];
      notes.forEach((n, idx) => {
        setTimeout(() => playTone(n, 0.06, "triangle", 0.09), idx * 40);
      });
    },
    launch() {
      playTone(146.8, 0.45, "sawtooth", 0.08, 110);
      setTimeout(() => playTone(220, 0.42, "triangle", 0.11, 196), 80);
      setTimeout(() => playTone(293.6, 0.55, "triangle", 0.10, 261.6), 170);
    },
    woodStep() {
      playTone(135 + Math.random() * 25, 0.045, "triangle", 0.07, 75);
    },
    chairCreak() {
      playTone(210, 0.09, "sawtooth", 0.05, 160);
    },
    lanternClick() {
      playTone(620, 0.04, "square", 0.07, 380);
    },
    lightSwitch() {
      playTone(780, 0.025, "square", 0.09, 440);
      setTimeout(() => playTone(520, 0.02, "triangle", 0.07, 340), 22);
    },
    pageFlip() {
      playPageTurnSfx();
    },
    inkMark(isCross) {
      if (isCross) {
        playTone(250, 0.05, "sawtooth", 0.06, 170);
        setTimeout(() => playTone(210, 0.05, "sawtooth", 0.055, 140), 42);
      } else {
        playTone(420, 0.07, "triangle", 0.075, 560);
      }
    },
    cardDraw() {
      playDrawCardSfx();
    },
    doorTransition() {
      playTone(175, 0.08, "triangle", 0.09, 118);
      setTimeout(() => playTone(240, 0.06, "sawtooth", 0.045, 165), 45);
    },
    cardPlay() {
      playTone(220, 0.07, "square", 0.09, 150);
      setTimeout(() => playTone(440, 0.09, "triangle", 0.08, 330), 35);
    },
    clockChime() {
      playTone(587.3, 0.35, "sine", 0.12, 580);
      setTimeout(() => playTone(440.0, 0.45, "triangle", 0.10, 435), 140);
    },
    hexAlert() {
      playTone(130, 0.28, "sawtooth", 0.11, 92);
      setTimeout(() => playTone(116, 0.36, "sawtooth", 0.12, 82), 180);
    },
    pawnRise() {
      // Wooden mechanical rise out of the carved clock groove
      playTone(125, 0.22, "triangle", 0.11, 210);
      setTimeout(() => playTone(190, 0.26, "sine", 0.09, 310), 150);
      setTimeout(() => playTone(340, 0.07, "square", 0.06, 260), 420);
    },
    grooveTick() {
      // Soft wooden click as the player piece glides past each hour mark
      playTone(540 + Math.random() * 40, 0.035, "triangle", 0.055, 290);
    },
    cardDeal() {
      // Crisp parchment card slide & snap
      playTone(280, 0.05, "triangle", 0.08, 490);
      setTimeout(() => playTone(620, 0.04, "sine", 0.06, 420), 32);
    },
    harvesterRise() {
      // Deep ominous rumble + scraping chime as the Hollow Harvester emerges at XII
      playTone(72, 0.65, "sawtooth", 0.13, 52);
      setTimeout(() => playTone(110, 0.55, "sawtooth", 0.11, 78), 160);
      setTimeout(() => playTone(92, 0.72, "triangle", 0.12, 58), 380);
      setTimeout(() => playTone(310, 0.18, "square", 0.07, 165), 620);
    },
    startLobbyBgm,
    stopLobbyBgm,
    syncBgmVolume,
    syncSfxVolume,
    unlockLobbyAudio,
    playBrokenLight,
    stopBrokenLight,
    getBrokenLightTime,
    startClockTick,
    stopClockTick,
    setClockTickAttenuation,
    playHumanIntro,
    stopHumanIntro,
    getHumanIntroTime,
    syncHumanIntroTime,
    getHumanIntroDuration,
    getRimClipDuration,
    isHumanIntroUsingFallback,
    playRimTurn,
    stopRimTurn,
    isRimTurnUsingFallback,
    playPawnMove,
    stopPawnMove,
    isPawnMoveUsingFallback,
    playGrandfatherClockClue,
    stopGrandfatherClockClue,
    playEventDraw,
    stopEventDraw,
    playTypingSfx,
    stopTypingSfx,
    playClownLaughLoop,
    stopClownLaughLoop,
    balloonPop: playBalloonPopSfx,
    playEndGameAlarm3x,
    stopEndGameAlarm,
    playLightBreak,
    stopLightBreak,
    carEngineStart: playCarEngineStart,
    startToyTrainLoop,
    stopToyTrainLoop,
    setToyTrainAttenuation,
    startAtticGhostLoop,
    stopAtticGhostLoop,
    setAtticGhostAttenuation,
    shapeInsert: playShapeInsertSfx,
    playMusicalBox20s,
    stopMusicalBox,
    playMonkeySfx,
    stopMonkeySfx,
    setMonkeySfxAttenuation,
    popcornThrow: playPopcornThrowSfx,
    popcornScore: playPopcornScoreSfx,
    playBasementSlide,
    stopBasementSlide,
    startChainsawLoop,
    stopChainsawLoop,
    setChainsawAttenuation,
    startBalloonsSfxLoop,
    stopBalloonsSfxLoop,
    setBalloonsSfxAttenuation,
    electricRepairTick: playElectricRepairTick,
    breakerFixed: playBreakerFixedSfx,
    playLightSwitchSurge,
    stopLightSwitchSurge,
    shadowHoundVanish: playShadowHoundVanishSfx,
    playDoorKnock,
    stopDoorKnock,
    playDoorOpen,
    stopDoorOpen,
    playKnightFootstep,
    stopKnightFootstep,
    startGoodEndBgm,
    stopGoodEndBgm,
    startGameOverBgm,
    stopGameOverBgm,
    playExorcismSfx,
    stopExorcismSfx,
    playJumpscare,
    stopJumpscare,
    warmUpJumpscare,
    warmUpDrawCard,
    warmUpPageTurn,
    warmUpNeighborAudio,
    warmUpAtticAudio
  };

  App.Audio = SFX;
})(window.Duskwood);
