# DUSKWOOD INN

A pixel-art board-horror survival and deduction web game built with pure **HTML5, CSS3, Vanilla JavaScript, Canvas 2D, and Web Audio API**.

Trapped inside an eerie abandoned inn in the middle of a dead forest, you must expand the cabin's shifting floorplan, uncover hidden clues, survive lethal paranormal events, stay ahead of **The Hollow Harvester**, and deduce the true **Exit Room** before the clock strikes **12:00 AM (Midnight)**.

---

## Table of Contents

- [Gameplay Overview](#gameplay-overview)
- [Key Features](#key-features)
- [Controls](#controls)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Optional Audio Assets](#optional-audio-assets)
- [Credits, References & Copyright Sources](#credits-references--copyright-sources)
- [Non-Commercial & Intellectual Property Disclaimer](#non-commercial--intellectual-property-disclaimer)

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

## Getting Started

Because **Duskwood Inn** is built with vanilla web technologies, no build step or package installation is required.

### Option 1: Run Locally via Local Server (Recommended)
Running through a local HTTP server ensures smooth audio preloading and avoids browser `file://` restrictions:

```bash
# Clone the repository
git clone [https://github.com/](https://github.com/)<USERNAME>/<REPO_NAME>.git
cd <REPO_NAME>

# Start a quick local server (choose one)
npx serve .
# OR using Python 3
python -m http.server 8000