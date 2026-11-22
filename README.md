# DUSKWOOD INN

> **Play Online:** [https://duskwoodinn.hung192.dev](https://duskwoodinn.hung192.dev)

A pixel-art board-horror survival and deduction web game built with pure **HTML5, CSS3, Vanilla JavaScript, Canvas 2D, and Web Audio API**.

Trapped inside an eerie abandoned inn in the middle of a dead forest, you must expand the cabin's shifting floorplan, uncover hidden clues, survive lethal paranormal events, stay ahead of **The Hollow Harvester**, and deduce the true **Exit Room** before the clock strikes **12:00 AM (Midnight)**.

---

## Table of Contents

- [Play Online](#play-online)
- [Gameplay Overview](#gameplay-overview)
- [Key Features](#key-features)
- [Controls](#controls)
- [Run Locally](#run-locally)
- [Project Structure](#project-structure)
- [Optional Audio Assets](#optional-audio-assets)
- [Credits, References & Copyright Sources](#credits-references--copyright-sources)
- [Non-Commercial & Intellectual Property Disclaimer](#non-commercial--intellectual-property-disclaimer)

---

## Play Online

Launch the game directly in your browser without any installation:

**Live Website:** [https://duskwoodinn.hung192.dev](https://duskwoodinn.hung192.dev)

*(Recommended: Desktop browser such as Chrome, Edge, Firefox, or Safari with audio enabled for full spatial SFX and atmosphere.)*

---

## Gameplay Overview

1. **Survive Until Midnight (12:00 PM – 12:00 AM):** Play cards from the wooden round table to advance your piece along the carved 12-hour clock groove while avoiding being caught by **The Hollow Harvester**.
2. **Build the Cabin:** Draw and rotate directional **Room Cards** to connect doorways outward from **The Dining Room**, starting with **The Cellar** on Turn 1.
3. **Investigate & Deduce:** Place **Clue Cards** onto the **Graveyard Pedestal** (only the top card is checked each turn) and explore newly built rooms in 3rd-person view to spot manifestations.
4. **Survive Lethal Events:** Drawing an **Event Card** interrupts your turn and triggers a real-time horror trial across the cabin. Falling during an event costs precious time and respawns you in The Cellar.
5. **Choose the True Exit Room:** Use your interactive **Game Manual (`[B]`)** to cross off ruled-out clues and narrow down the 12 candidate rooms. At **12:00 AM**, stand inside the true Exit Room to survive until dawn and escape into the forest.

---

## Key Features

- **Dual-Perspective Gameplay:**
  - **First-Person Wooden Round Table View:** Features a carved 48-notch clock groove, rising/gliding physical pawns, a rotating outer rim turntable, a 3D wooden Graveyard/Draw pedestal, and a fanned vintage parchment hand.
  - **Third-Person Stardew-Inspired Cabin Exploration:** Walk smoothly through connected doorways across **12 handcrafted, non-square rooms** (*The Cellar, The Furnace Room, The Bathroom, The Kitchen, The Bedroom, L-Hall, The Study, Hall I, Hall II, The Living Room, T-Hall I, T-Hall II*) radiating from *The Dining Room*.
- **Five Card Categories:**
  - **Room (Blueprint):** Dead-end, L-shaped, I-shaped, and T-shaped rooms with real doorway alignment and 90° rotation.
  - **Clue (Omen):** 6 distinct clue families — *The Grandfather Clock*, *Evidence of a Past Player*, *Corrupt Painting*, *Paranormal Alteration*, *Tic-Tac-Toe* (spanning 5 rooms), and *Chicken Decor* (including a Fake Decoy headless mechanic).
  - **Progress (Chime):** Time advancement cards (`+30m`, `+60m`) and special encounters (*Shuffle Hand* under-the-table animation, *Wheel of Fate*, *Shifting Seat*, *The Thief's Wheel*, and *The Neighbor* porch bargain).
  - **Lifesaver (Ward):** Push *The Hollow Harvester* back along the clock track.
  - **Event (Hex):** 10 horror entities & playable survival events (*The Hollow Harvester*, *Cutting Corners*, *The Attic*, *The Tall Man*, *Red Balloons*, *Feeling Small?*, *Musical Rooms*, *The Basement*, *Stay in the Light*, and *The Knight*).
- **Interactive Deduction Manual & Card Codex:**
  - Press `[B]` to open the weathered two-page **Game Manual** — left-click clues to circle in red ink, right-click to cross out, and automatically eliminate impossible Exit Rooms.
  - Press `[J]` to inspect the **Survivor's Tome**, tracking rules and discovered cards.
- **Character Customizer:** Terraria-inspired pixel sprite editor (hairstyles, outfits, color palettes, accessories, lantern toggle) persisted automatically via `localStorage`.
- **Zero Dependencies:** Runs natively in modern browsers with built-in Web Audio API synthesizers and offline SVG fallbacks.

---

## Controls

| Key / Input | Action |
| :--- | :--- |
| `W A S D` / Arrow Keys | Move character |
| `Shift` | Sprint |
| `C` | Crouch (silent movement) |
| `E` | Sit / Stand up / Inspect props, clues, portraits & light switches |
| `T` | Enter / Exit First-Person Round Table View |
| `F` | Toggle handheld Lantern / Pick up or interact during Events |
| `X` | Drop held item (The Attic / Feeling Small?) |
| `B` | Open / Close Interactive Deduction Book |
| `J` | Open / Close Survivor's Tome (Rules & Card Codex) |
| `D` / `G` / `R` | *(Table View)* Draw Card / Inspect Graveyard / Rotate Room Card 90° |
| `Esc` | Pause / Back / Close open modal |

---

## Run Locally

Because **Duskwood Inn** is built with vanilla web technologies, no build step or package installation is required.

### Option 1: Run via Local Server (Recommended)
Running through a local HTTP server ensures smooth audio preloading and avoids browser `file://` restrictions:

```bash
# Clone the repository
git clone [https://github.com/](https://github.com/)<USERNAME>/<REPO_NAME>.git
cd <REPO_NAME>

# Start a quick local server (choose one)
npx serve .
# OR using Python 3
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Option 2: Open Directly
Simply double-click `index.html` to open it in any modern Chromium, Firefox, or Safari browser.

---

## Project Structure

```text
duskwood-inn/
├── index.html                 # Main application shell, modals & script loader
├── CNAME                      # Custom domain configuration (duskwoodinn.hung192.dev)
├── css/
│   ├── theme.css              # Design tokens, typography, glass/silver UI components
│   ├── lobby.css              # Lobby, modals, character customizer & Survivor's Tome styles
│   └── gameplay.css           # Cabin HUD, 1st-person table, vintage cards & event overlays
├── js/
│   ├── main.js                # Bootstrap & primary animation loop
│   ├── core/
│   │   ├── audio.js           # Audio engine, spatial attenuation & Web Audio synth fallbacks
│   │   └── character.js       # Pixel-art survivor sprite renderer
│   ├── data/
│   │   ├── config.js          # Palettes, customization options & localStorage persistence
│   │   ├── cards.js           # Full 5-category card catalog, room shapes & draw pity engine
│   │   └── paintings.js       # Public-domain portrait gallery & Uncanny Valley corrupted variants
│   ├── lobby/
│   │   ├── background.js      # Procedural pixel-art dead forest & abandoned cabin backdrop
│   │   ├── customizer.js      # Survivor customization UI controller
│   │   ├── menus.js           # Main menu, play mode selector & options handler
│   │   └── tome.js            # Rules book & Card Codex UI
│   └── world/
│       ├── game.js            # Main world controller, movement, interactions & HUD sync
│       ├── intro.js           # Singleplayer flickering-bulb intro sequence
│       ├── parlor.js          # The Dining Room (round table, grandfather clock, lighting)
│       ├── rooms.js           # Variable non-square geometry & interiors for all 12 rooms
│       ├── table-view.js      # 1st-person round table canvas, pawns, turns & card actions
│       ├── book.js            # Interactive weathered Game Manual & deduction tracker
│       ├── clues.js           # Clue manifest, room spawning & close-up inspection modal
│       ├── events.js          # Monster registry, ink-smudge banners & Cutting Corners
│       ├── attic.js           # The Attic warehouse maze, 5 totems & Ghost AI
│       ├── stalkers.js        # The Tall Man, Red Balloons & Feeling Small? engines
│       ├── musical.js         # Musical Rooms (Cardboard Box, oblique popcorn throw, Monkey)
│       ├── basement.js        # The Basement underground maze, 5 fuse boxes & Chainsaw Stalker
│       ├── staylit.js         # Stay in the Light (rotating lit rooms & glowing Shadow Hound)
│       ├── knight.js          # The Knight turn-based Demon Statue & table light radar
│       └── endgame.js         # 12:00 AM Judgment, Lose Cutscene, Dawn Forest & Credits
├── image/                     # Pixel-art sprites (The Neighbor layers, Shuffle Hand, favicon)
└── audio/                     # Optional local audio tracks (see audio/PUT_AUDIO_FILES_HERE.txt)
```

---

## Optional Audio Assets

The game includes built-in procedural Web Audio API sound effects and music fallbacks so it plays cleanly out of the box. To use custom local tracks, place your `.mp3` files inside the `audio/` directory following the naming list documented in `audio/PUT_AUDIO_FILES_HERE.txt`.

---

## Credits, References & Copyright Sources

### Author & Creator
- **hung190207** — Concept, Game Architecture, Pixel Art, Implementation & Direction (*Duskwood Inn Project*)
- **Website:** [https://duskwoodinn.hung192.dev](https://duskwoodinn.hung192.dev)

### Game Design Inspirations & References
- **The Cabin Game** — created by **Twisted Corridor** (Steam)
- **Betrayal at the House on the Hill** — Board Game created by **Bruce Glassco**, published by **Avalon Hill**
- **Visual & UI Style Inspirations:**
  - *Stardew Valley* (3/4 top-down interior pixel perspective inspiration)
  - *Terraria* (side-profile pixel character sprite proportions & retro menu feel)
  - *Minecraft* (centered main menu stack layout)

### Music & Soundtrack References
*(External audio tracks are referenced for personal/fan-project atmosphere and are not redistributed commercially; all rights belong to their respective composers and copyright holders.)*
- **Lobby Music Reference:** *"Don't Go"* — from *Five Nights at Freddy's 3* (by **Scott Cawthon** / Tim Juliano)
- **Victory BGM Reference:** *"Reunited"* — from *Undertale* (by **Toby Fox**)
- **Defeat BGM Reference:** *"game over"* — by **AZALI**

### Artwork & Typography
- **In-Game Antique Paintings (`js/data/paintings.js`):** Public-domain historical oil paintings (17th–19th century) referenced via **Wikimedia Commons** and **The Metropolitan Museum of Art Open Access (CC0)** archives, including works by *Rembrandt van Rijn*, *Caspar David Friedrich*, *Francisco de Goya*, *William Merritt Chase*, and *Pierre Troubetskoy*.
- **Fonts:** Loaded via **Google Fonts** (*Press Start 2P*, *Pixelify Sans*, *VT323*, *IM Fell English SC*, *Special Elite*) under their respective open font licenses (SIL OFL / Apache 2.0).

---

## Non-Commercial & Intellectual Property Disclaimer

**Duskwood Inn** is a **strictly non-commercial, fan-made personal project** created solely for educational purposes, creative experimentation, and appreciation of horror board-game design. This project is **not monetized**, is not affiliated with or endorsed by any of the referenced studios, publishers, or composers, and generates no commercial revenue.

The author holds deep respect for the intellectual property, creative work, and ownership rights of all original creators whose games, mechanics, art, and music inspired this project — especially **Twisted Corridor** (*The Cabin Game*), **Avalon Hill / Bruce Glassco** (*Betrayal at the House on the Hill*), and the respective music composers. All trademarks, copyrights, and referenced works remain the sole property of their respective owners. If any rights holder has concerns regarding any reference or asset used in this repository, please open an issue or contact the author for prompt review or removal.