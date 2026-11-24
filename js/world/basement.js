/* ==========================================================================
   DUSKWOOD INN - THE BASEMENT (`hx_cellar_breakers`) Event Engine (v0.59)
   - Trigger: Exits Table View + violent earthquake shake in The Dining Room!
     The Dining Room gradually slides DOWN underground into the Basement Map
     over 14 seconds synced to `audio/basement_start_sfx.mp3`!
   - 5 seconds after landing underground (`PRE_START_5S`): Event begins!
   - Dynamic Basement Layout mirrored from the upstairs Cabin (`matchState.roomMap`):
       * Mirrors the exact room grid & doorway layout arranged upstairs, with
         The Dining Room (0,0) as the central hydraulic lift shaft ('H').
       * Pitch-dark weathered brick basement corridors (`rgba(2,2,4,0.968)`).
       * Small recessed Hiding Rooms / Alcoves ('A') fitted with glowing warm
         lamps that spill light into the corridor so players can spot them in
         the dark to hide and break the Chainsaw Monster's chase!
       * 5 Electrical / Fuse Boxes glowing bright RED with crackling electric
         leakage arcs -> turn bright GREEN once repaired!
       * Press [F] near a box -> opens FULL-SCREEN First-Person Close-Up Repair
         View facing the open brick-mounted fuse cabinet; HOLD [F] to fill the
         yellow progress bar!
       * Monster: Tall Chainsaw-Head Monster roaming completely RANDOMLY along
         basement paths (`WANDER`) — NEVER follows a fixed loop! Detects and
         CHASES players who stand close enough (BFS pathfinding); if TOO CLOSE
         (`<= 44px`), revs into an un-outrunnable frenzy (`102 px/s` > `88 px/s`
         sprint)! Duck into a lit hiding room ('A') to evade & break chase!
       * Keeps exact spatial near/far `audio/chainsaw_sfx.mp3` (11s) SFX!
   - Victory (5/5 boxes repaired): Reverses the descent — violently shakes &
     slides the Basement/Dining Room back UPWARD over 14 seconds with
     `audio/basement_start_sfx.mp3`, returning to normal cabin gameplay!
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  const TILE = 16;
  const CELL_STEP = 6; // Each upstairs room (rx, ry) occupies a 6-tile stride (5x5 interior + 1-tile shared brick wall)
  const PAD_TILES = 3; // Outer brick margin so exterior lit hiding alcoves can be recessed cleanly
  const VIEW_W = 208;
  const VIEW_H = 208;

  const SLIDE_DURATION = 14.0;   // Synced to audio/basement_start_sfx.mp3 (14s)!
  const PRE_START_DELAY = 5.0;   // 5 seconds after sliding down finishes!
  const REPAIR_DURATION = 4.2;   // Seconds of holding [F] per breaker box

  // Chainsaw Monster AI speeds (compared to player walk 54 / sprint 88 / crouch 32 in game.js)
  const SAW_WANDER_SPEED = 42;       // Random corridor wandering speed
  const SAW_CHASE_SPEED = 80;        // Mid-range chase speed (player can sprint at 88 to reach a lit hiding room)
  const SAW_NO_ESCAPE_SPEED = 102;   // Too close -> faster than player sprint (88), CANNOT OUTRUN!
  const SAW_DETECT_LOS_RADIUS = 78;  // Sight detection radius down dark corridors
  const SAW_DETECT_NEAR_RADIUS = 50; // Proximity detection radius (even around a tight corner)
  const SAW_NO_ESCAPE_RADIUS = 44;   // Un-outrunnable close-range lunge radius!
  const SAW_LOSE_RADIUS = 136;       // Distance to lose chase if LOS is broken

  let activeLayout = null;
  let staticMazeCanvas = null;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const mctx = maskCanvas.getContext("2d");

  // Offscreen Dining Room snapshot buffer used for the smooth vertical slide-down / slide-up animation!
  const diningSlideBuf = document.createElement("canvas");
  diningSlideBuf.width = VIEW_W;
  diningSlideBuf.height = VIEW_H;
  const dsctx = diningSlideBuf.getContext("2d");
  dsctx.imageSmoothingEnabled = false;

  // Offscreen Tall Chainsaw-Head Monster Sprite Buffer (28x44px — towering industrial horror!)
  const sawBuf = document.createElement("canvas");
  sawBuf.width = 28;
  sawBuf.height = 44;
  const sctx = sawBuf.getContext("2d");
  sctx.imageSmoothingEnabled = false;

  let repairSparkTimer = 0;

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }
  function isMpMode(m) { return Boolean(App.Events && App.Events.isMpEventMode && App.Events.isMpEventMode(m)); }
  function isMpHost(m) { return !App.Events || !App.Events.isMpHost || App.Events.isMpHost(m); }
  function isMpGuest(m) { return Boolean(App.Events && App.Events.isMpGuest && App.Events.isMpGuest(m)); }

  function tileChar(col, row) {
    if (!activeLayout) return "#";
    if (col < 0 || col >= activeLayout.cols || row < 0 || row >= activeLayout.rows) return "#";
    return activeLayout.grid[row][col];
  }

  function isWallTile(col, row) {
    return tileChar(col, row) === "#";
  }

  function isAlcoveTile(col, row) {
    return tileChar(col, row) === "A";
  }

  function isMonsterWalkable(col, row) {
    const ch = tileChar(col, row);
    // Monster walks freely on corridors ('.') & hub ('H'), NEVER enters lit hiding rooms ('A') or walls ('#')!
    return ch === "." || ch === "H";
  }

  function isPlayerInAlcove(player) {
    if (!player || !activeLayout) return false;
    const col = Math.floor(player.x / TILE);
    const row = Math.floor((player.y - 3) / TILE);
    return isAlcoveTile(col, row);
  }

  function snapshotRoomLights(matchState) {
    const snap = {};
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      if (k === "0,0") {
        snap[k] = !(matchState.roomLightStates && matchState.roomLightStates[k] === false);
      } else {
        snap[k] = Boolean(matchState.roomLightStates && matchState.roomLightStates[k] === true);
      }
    });
    return snap;
  }

  function restoreRoomLights(matchState, snap) {
    if (App.Events && App.Events.turnAllLightsOn) {
      App.Events.turnAllLightsOn(matchState);
      return;
    }
    matchState.roomLightStates = { "0,0": true };
    Object.keys(matchState.roomMap || {}).forEach((k) => {
      matchState.roomLightStates[k] = true;
    });
  }

  // ==================== 1. DYNAMIC BASEMENT LAYOUT FROM UPSTAIRS ROOM MAP ====================
  function computeRoomMapSignature(roomMap) {
    const keys = Object.keys(roomMap || {}).sort();
    return keys.map((k) => {
      const r = roomMap[k];
      const d = (r && r.doors) || {};
      return `${k}:${r ? r.id : ""}:${d.N ? 1 : 0}${d.E ? 1 : 0}${d.S ? 1 : 0}${d.W ? 1 : 0}`;
    }).join("|");
  }

  function buildBasementLayoutFromRoomMap(roomMap) {
    const sig = computeRoomMapSignature(roomMap);
    if (activeLayout && activeLayout.sig === sig) return activeLayout;

    // 1. Copy & sort rooms deterministically so Host & Guests generate 100% identical basement geometry
    const rawList = Object.values(roomMap || {})
      .filter((r) => r && typeof r.x === "number" && typeof r.y === "number")
      .map((r) => ({
        x: r.x,
        y: r.y,
        id: r.id || "room",
        name: r.shortName || r.name || "BASEMENT",
        doors: {
          N: Boolean(r.doors && r.doors.N),
          E: Boolean(r.doors && r.doors.E),
          S: Boolean(r.doors && r.doors.S),
          W: Boolean(r.doors && r.doors.W)
        }
      }))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    const byCoord = new Map();
    rawList.forEach((r) => byCoord.set(`${r.x},${r.y}`, r));
    if (!byCoord.has("0,0")) {
      const hub = { x: 0, y: 0, id: "dining_room", name: "DINING", doors: { N: true, E: true, S: true, W: true } };
      rawList.push(hub);
      byCoord.set("0,0", hub);
    }

    // If very early in the match (< 4 rooms built upstairs), attach subtle foundation wing stubs around (0,0)
    // so the player still sees their exact upstairs layout while having enough space for 5 fuse boxes & hiding nooks!
    if (rawList.length < 4) {
      const stubs = [
        { x: 0, y: -1, opp: "N", doors: { N: false, E: true, S: true, W: true } },
        { x: 1, y: 0,  opp: "E", doors: { N: true, E: false, S: true, W: true } },
        { x: 0, y: 1,  opp: "S", doors: { N: true, E: true, S: false, W: true } },
        { x: -1, y: 0, opp: "W", doors: { N: true, E: true, S: true, W: false } }
      ];
      const origin = byCoord.get("0,0");
      stubs.forEach((s) => {
        if (rawList.length >= 4) return;
        const k = `${s.x},${s.y}`;
        if (!byCoord.has(k)) {
          const stubRoom = { x: s.x, y: s.y, id: "basement_annex", name: "FOUNDATION", doors: Object.assign({}, s.doors) };
          rawList.push(stubRoom);
          byCoord.set(k, stubRoom);
          origin.doors[s.opp] = true;
        }
      });
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rawList.forEach((r) => {
      if (r.x < minX) minX = r.x;
      if (r.x > maxX) maxX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.y > maxY) maxY = r.y;
    });

    const cols = (maxX - minX + 1) * CELL_STEP + 1 + PAD_TILES * 2;
    const rows = (maxY - minY + 1) * CELL_STEP + 1 + PAD_TILES * 2;
    const grid = Array.from({ length: rows }, () => Array(cols).fill("#"));

    const toOriginCol = (rx) => PAD_TILES + (rx - minX) * CELL_STEP;
    const toOriginRow = (ry) => PAD_TILES + (ry - minY) * CELL_STEP;

    const carveRect = (c1, r1, c2, r2, ch) => {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
            grid[r][c] = ch;
          }
        }
      }
    };

    const DIRS = [
      ["N", 0, -1, "S"],
      ["E", 1,  0, "W"],
      ["S", 0,  1, "N"],
      ["W", -1, 0, "E"]
    ];

    // 2. Carve every upstairs room into matching basement geometry + connected archways
    rawList.forEach((room) => {
      const oc = toOriginCol(room.x);
      const or = toOriginRow(room.y);
      const isHub = room.x === 0 && room.y === 0;
      const d = room.doors;
      const isNarrowHall = room.id === "bp_hallway_1" || room.id === "bp_hallway_2" || room.id === "bp_l_hallway" || room.id === "bp_t_hallway_1" || room.id === "bp_t_hallway_2";
      const isTightRoom = room.id === "bp_bathroom";

      if (isHub) {
        // Dining Room hydraulic lift shaft at exact (0,0) coordinate
        carveRect(oc + 1, or + 1, oc + 5, or + 5, "H");
      } else if (isNarrowHall) {
        // Narrow 3-tile wide corridor branches matching exact door directions (I, L, or T hallway)
        carveRect(oc + 2, or + 2, oc + 4, or + 4, ".");
        if (d.N) carveRect(oc + 2, or + 1, oc + 4, or + 2, ".");
        if (d.S) carveRect(oc + 2, or + 4, oc + 4, or + 5, ".");
        if (d.W) carveRect(oc + 1, or + 2, oc + 2, or + 4, ".");
        if (d.E) carveRect(oc + 4, or + 2, oc + 5, or + 4, ".");
      } else if (isTightRoom) {
        // Narrow elongated chamber like Bathroom upstairs
        if (d.N || d.S) carveRect(oc + 2, or + 1, oc + 4, or + 5, ".");
        else carveRect(oc + 1, or + 2, oc + 5, or + 4, ".");
      } else {
        // Spacious 5x5 basement chamber mirroring Kitchen/Bedroom/Living/Study/Furnace/Cellar
        carveRect(oc + 1, or + 1, oc + 5, or + 5, ".");
        // Add a single structural brick pillar in the center of large rooms to create tense kiting/stealth corners
        if (room.id === "bp_living_room" || room.id === "bp_kitchen" || room.id === "bp_bedroom" || room.id === "bp_cellar") {
          grid[or + 3][oc + 3] = "#";
        }
      }

      // Open brick doorway archways wherever two adjacent upstairs rooms share a matching door
      DIRS.forEach(([dir, dx, dy, opp]) => {
        const nb = byCoord.get(`${room.x + dx},${room.y + dy}`);
        if (!nb) return;
        const matched = Boolean(d[dir] && nb.doors[opp]);
        if (!matched) return;
        if (dir === "N") carveRect(oc + 2, or,     oc + 4, or + 1, ".");
        if (dir === "S") carveRect(oc + 2, or + 5, oc + 4, or + 6, ".");
        if (dir === "W") carveRect(oc,     or + 2, oc + 1, or + 4, ".");
        if (dir === "E") carveRect(oc + 5, or + 2, oc + 6, or + 4, ".");
      });
    });

    const hubCol = toOriginCol(0) + 3;
    const hubRow = toOriginRow(0) + 3;
    const hubCenter = { x: hubCol * TILE + 8, y: hubRow * TILE + 8 };

    // 3. BFS Connectivity Verification: ensure EVERY upstairs room is reachable from (0,0)
    //    (e.g., if a room's door was placed oddly or Cellar wasn't linked, punch a doorway to its visited neighbor)
    const getVisited = () => {
      const vis = new Set([`${hubCol},${hubRow}`]);
      const q = [{ c: hubCol, r: hubRow }];
      while (q.length > 0) {
        const cur = q.shift();
        const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let i = 0; i < steps.length; i++) {
          const nc = cur.c + steps[i][0];
          const nr = cur.r + steps[i][1];
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
          const ch = grid[nr][nc];
          if (ch !== "." && ch !== "H") continue;
          const k = `${nc},${nr}`;
          if (!vis.has(k)) {
            vis.add(k);
            q.push({ c: nc, r: nr });
          }
        }
      }
      return vis;
    };

    for (let pass = 0; pass < rawList.length; pass++) {
      const vis = getVisited();
      let bridged = false;
      for (let i = 0; i < rawList.length; i++) {
        const rm = rawList[i];
        const oc = toOriginCol(rm.x);
        const or = toOriginRow(rm.y);
        const cx = oc + 2;
        const cy = or + 2;
        if (vis.has(`${cx},${cy}`)) continue;
        // Find an adjacent room that IS visited and punch a doorway between them
        for (let di = 0; di < DIRS.length; di++) {
          const [dir, dx, dy] = DIRS[di];
          const nb = byCoord.get(`${rm.x + dx},${rm.y + dy}`);
          if (!nb) continue;
          const ncx = toOriginCol(nb.x) + 2;
          const ncy = toOriginRow(nb.y) + 2;
          if (!vis.has(`${ncx},${ncy}`)) continue;
          if (dir === "N") carveRect(oc + 2, or,     oc + 4, or + 1, ".");
          if (dir === "S") carveRect(oc + 2, or + 5, oc + 4, or + 6, ".");
          if (dir === "W") carveRect(oc,     or + 2, oc + 1, or + 4, ".");
          if (dir === "E") carveRect(oc + 5, or + 2, oc + 6, or + 4, ".");
          bridged = true;
          break;
        }
      }
      if (!bridged) break;
    }

    const reachableSet = getVisited();

    // 4. Carve SMALL LIT HIDING ROOMS / ALCOVES ('A') recessed into solid brick walls!
    //    Each hiding room has a glowing warm lamp mounted inside so players can spot them in pitch dark
    //    and duck inside to avoid / break chase from the Chainsaw Monster!
    const alcoveLights = [];
    const targetAlcoves = Math.max(5, Math.min(11, rawList.length + 2));
    const alcoveCandidates = [];

    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (grid[r][c] !== "." || !reachableSet.has(`${c},${r}`)) continue;
        const nDirs = [[-1, 0, "N"], [1, 0, "S"], [0, -1, "W"], [0, 1, "E"]];
        for (let di = 0; di < nDirs.length; di++) {
          const [dr, dc, side] = nDirs[di];
          const r1 = r + dr, c1 = c + dc;
          const r2 = r + dr * 2, c2 = c + dc * 2;
          if (r2 <= 0 || r2 >= rows - 1 || c2 <= 0 || c2 >= cols - 1) continue;
          if (grid[r1][c1] !== "#" || grid[r2][c2] !== "#") continue;
          // Ensure side walls around the recessed nook are solid brick '#' so it is a TRUE enclosed hiding cubby!
          const pdr = dc !== 0 ? 1 : 0;
          const pdc = dr !== 0 ? 1 : 0;
          if (
            grid[r1 + pdr][c1 + pdc] !== "#" ||
            grid[r1 - pdr][c1 - pdc] !== "#" ||
            grid[r2 + pdr][c2 + pdc] !== "#" ||
            grid[r2 - pdr][c2 - pdc] !== "#"
          ) continue;
          alcoveCandidates.push({
            corridorCol: c,
            corridorRow: r,
            entryCol: c1,
            entryRow: r1,
            deepCol: c2,
            deepRow: r2,
            side
          });
        }
      }
    }

    // Spread lit hiding rooms evenly across the entire basement (farthest-point spacing)
    const minAlcoveSpacingPx = TILE * 4.8;
    for (let i = 0; i < alcoveCandidates.length && alcoveLights.length < targetAlcoves; i++) {
      // Pick candidate maximizing min distance to existing alcoves
      let bestIdx = -1;
      let bestDist = -1;
      for (let j = 0; j < alcoveCandidates.length; j++) {
        const cand = alcoveCandidates[j];
        if (grid[cand.entryRow][cand.entryCol] !== "#" || grid[cand.deepRow][cand.deepCol] !== "#") continue;
        const cx = cand.entryCol * TILE + 8;
        const cy = cand.entryRow * TILE + 8;
        const minD = alcoveLights.length === 0
          ? Math.hypot(cx - hubCenter.x, cy - hubCenter.y)
          : Math.min(...alcoveLights.map((a) => Math.hypot(cx - a.entryX, cy - a.entryY)));
        if (alcoveLights.length > 0 && minD < minAlcoveSpacingPx) continue;
        if (minD > bestDist) {
          bestDist = minD;
          bestIdx = j;
        }
      }
      if (bestIdx < 0) break;
      const pick = alcoveCandidates[bestIdx];
      // Verify side walls are still intact before carving
      const dr = pick.deepRow - pick.entryRow;
      const dc = pick.deepCol - pick.entryCol;
      const pdr = dc !== 0 ? 1 : 0;
      const pdc = dr !== 0 ? 1 : 0;
      if (
        grid[pick.entryRow + pdr][pick.entryCol + pdc] !== "#" ||
        grid[pick.entryRow - pdr][pick.entryCol - pdc] !== "#" ||
        grid[pick.deepRow + pdr][pick.deepCol + pdc] !== "#" ||
        grid[pick.deepRow - pdr][pick.deepCol - pdc] !== "#"
      ) continue;

      grid[pick.entryRow][pick.entryCol] = "A";
      grid[pick.deepRow][pick.deepCol] = "A";
      alcoveLights.push({
        col: pick.deepCol,
        row: pick.deepRow,
        entryCol: pick.entryCol,
        entryRow: pick.entryRow,
        side: pick.side,
        x: pick.deepCol * TILE + 8,
        y: pick.deepRow * TILE + 8,
        entryX: pick.entryCol * TILE + 8,
        entryY: pick.entryRow * TILE + 8
      });
    }

    // Fallback: if fewer than 3 deep 2-tile alcoves fit on a super compact grid, carve 1-tile lit niches
    if (alcoveLights.length < 3) {
      for (let r = 2; r < rows - 2 && alcoveLights.length < 4; r++) {
        for (let c = 2; c < cols - 2 && alcoveLights.length < 4; c++) {
          if (grid[r][c] !== "." || !reachableSet.has(`${c},${r}`)) continue;
          const nDirs = [[-1, 0, "N"], [1, 0, "S"], [0, -1, "W"], [0, 1, "E"]];
          for (let di = 0; di < nDirs.length; di++) {
            const [dr, dc, side] = nDirs[di];
            const r1 = r + dr, c1 = c + dc;
            if (r1 <= 0 || r1 >= rows - 1 || c1 <= 0 || c1 >= cols - 1) continue;
            if (grid[r1][c1] !== "#") continue;
            const pdr = dc !== 0 ? 1 : 0;
            const pdc = dr !== 0 ? 1 : 0;
            if (grid[r1 + pdr][c1 + pdc] !== "#" || grid[r1 - pdr][c1 - pdc] !== "#") continue;
            const cx = c1 * TILE + 8;
            const cy = r1 * TILE + 8;
            if (alcoveLights.some((a) => Math.hypot(cx - a.x, cy - a.y) < TILE * 3.5)) continue;
            grid[r1][c1] = "A";
            alcoveLights.push({ col: c1, row: r1, entryCol: c1, entryRow: r1, side, x: cx, y: cy, entryX: cx, entryY: cy });
            break;
          }
        }
      }
    }

    // 5. Place 5 Red Breaker / Fuse Boxes mounted on reachable corridor walls, evenly spread across the layout
    const breakerCandidates = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (grid[r][c] !== "." || !reachableSet.has(`${c},${r}`)) continue;
        // Keep a little breathing room away from hub center
        if (Math.hypot(c - hubCol, r - hubRow) < 3.0) continue;
        const wallDir =
          grid[r - 1][c] === "#" ? "N" :
          grid[r][c - 1] === "#" ? "W" :
          grid[r][c + 1] === "#" ? "E" :
          grid[r + 1][c] === "#" ? "S" : null;
        if (!wallDir) continue;
        // Avoid placing directly inside an alcove mouth
        if (grid[r - 1][c] === "A" || grid[r + 1][c] === "A" || grid[r][c - 1] === "A" || grid[r][c + 1] === "A") continue;
        breakerCandidates.push({ col: c, row: r, wall: wallDir });
      }
    }

    // Fallback if very tight map
    if (breakerCandidates.length < 5) {
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if (grid[r][c] === "." && reachableSet.has(`${c},${r}`)) {
            if (!breakerCandidates.some((b) => b.col === c && b.row === r)) {
              breakerCandidates.push({ col: c, row: r, wall: "N" });
            }
          }
        }
      }
    }

    const breakerLabels = ["FUSE BOX A", "FUSE BOX B", "FUSE BOX C", "FUSE BOX D", "FUSE BOX E"];
    const breakerSpecs = [];
    for (let i = 0; i < 5 && breakerCandidates.length > 0; i++) {
      let best = breakerCandidates[0];
      let bestScore = -1;
      for (let j = 0; j < breakerCandidates.length; j++) {
        const cand = breakerCandidates[j];
        if (breakerSpecs.some((b) => b.col === cand.col && b.row === cand.row)) continue;
        const score = breakerSpecs.length === 0
          ? Math.hypot(cand.col - hubCol, cand.row - hubRow)
          : Math.min(...breakerSpecs.map((b) => Math.hypot(cand.col - b.col, cand.row - b.row)));
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      breakerSpecs.push({
        id: `brk_${i + 1}`,
        label: breakerLabels[i],
        col: best.col,
        row: best.row,
        wall: best.wall
      });
    }

    // 6. Monster Spawn Tile: farthest reachable corridor tile from the central Dining Room shaft
    let spawnTile = { col: hubCol, row: Math.max(1, hubRow - 4) };
    let maxSpawnDist = -1;
    reachableSet.forEach((k) => {
      const parts = k.split(",");
      const c = Number(parts[0]);
      const r = Number(parts[1]);
      if (grid[r][c] !== ".") return;
      const d = Math.hypot(c - hubCol, r - hubRow);
      if (d > maxSpawnDist) {
        maxSpawnDist = d;
        spawnTile = { col: c, row: r };
      }
    });

    activeLayout = {
      sig,
      cols,
      rows,
      worldW: cols * TILE,
      worldH: rows * TILE,
      grid,
      hubCenter,
      alcoveLights,
      breakerSpecs,
      spawnTile
    };
    staticMazeCanvas = null;
    return activeLayout;
  }

  // ==================== 2. BUILD STATIC WEATHERED BRICK BASEMENT MAP ====================
  function buildStaticBasementMaze(matchState) {
    if (!activeLayout) buildBasementLayoutFromRoomMap(matchState && matchState.roomMap);
    const L = activeLayout;
    staticMazeCanvas = document.createElement("canvas");
    staticMazeCanvas.width = L.worldW;
    staticMazeCanvas.height = L.worldH;
    const c = staticMazeCanvas.getContext("2d");
    c.imageSmoothingEnabled = false;

    const slabCols = ["#272320", "#221e1c", "#2b2622", "#1f1c1a"];
    for (let r = 0; r < L.rows; r++) {
      for (let col = 0; col < L.cols; col++) {
        const ch = L.grid[r][col];
        const x = col * TILE;
        const y = r * TILE;

        if (ch === "#") {
          // Aged industrial brown/umber basement brickwork (matching basement screenshots!)
          px(c, x, y, TILE, TILE, "#0f0c0b");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#3c3129");
          px(c, x + 1, y + 1, TILE - 2, 3, "#4f4137"); // Upper bevel
          // Brick mortar seams
          px(c, x + 1, y + 6,  TILE - 2, 1, "#211a15");
          px(c, x + 1, y + 11, TILE - 2, 1, "#211a15");
          px(c, x + 7, y + 2,  1, 4, "#211a15");
          px(c, x + 4, y + 7,  1, 4, "#211a15");
          px(c, x + 11, y + 7, 1, 4, "#211a15");
          px(c, x + 8, y + 12, 1, 3, "#211a15");
          if ((col * 7 + r * 11) % 5 === 0) {
            px(c, x + 3, y + 3, 3, 2, "#2f251f"); // Weathered brick patch
          }
          // Cast dark vertical drop shadow onto south floor
          if (!isWallTile(col, r + 1)) {
            c.fillStyle = "rgba(0,0,0,0.56)";
            c.fillRect(x, y + TILE, TILE, 4);
          }
          continue;
        }

        if (ch === "H") {
          // Central steel hydraulic lift platform where The Dining Room lands!
          px(c, x, y, TILE, TILE, "#36312d");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#4a423b");
          px(c, x + 2, y + 2, 2, 2, "#231e1b");
          px(c, x + 12, y + 12, 2, 2, "#231e1b");
          if (tileChar(col, r - 1) !== "H") px(c, x, y, TILE, 2, (col % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col, r + 1) !== "H") px(c, x, y + TILE - 2, TILE, 2, (col % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col - 1, r) !== "H") px(c, x, y, 2, TILE, (r % 2 === 0) ? "#c79a2e" : "#1c1917");
          if (tileChar(col + 1, r) !== "H") px(c, x + TILE - 2, y, 2, TILE, (r % 2 === 0) ? "#c79a2e" : "#1c1917");
          continue;
        }

        if (ch === "A") {
          // Lit Hiding Room / Recessed Safe Alcove! Warm timber/stone refuge floor
          px(c, x, y, TILE, TILE, "#2d251d");
          px(c, x + 1, y + 1, TILE - 2, TILE - 2, "#403427");
          px(c, x + 2, y + 2, TILE - 4, 1, "#6b553b");
          px(c, x + 2, y + TILE - 3, TILE - 4, 1, "#2a2118");
          continue;
        }

        // Damp basement floor slabs
        const colIdx = (col * 3 + r * 5) % slabCols.length;
        px(c, x, y, TILE, TILE, slabCols[colIdx]);
        px(c, x, y + TILE - 1, TILE, 1, "#171412");
        px(c, x + TILE - 1, y, 1, TILE, "#171412");
        if ((col + r) % 4 === 0) {
          px(c, x + 4, y + 5, 5, 2, "rgba(12, 10, 9, 0.42)");
        }
      }
    }
  }

  // ==================== 3. TALL CHAINSAW-HEAD MONSTER SPRITE (28x44) ====================
  function drawChainsawMonsterSprite(ctx, x, y, timeSec, facing, isChasing, isFrenzy) {
    const walkRate = isFrenzy ? 16.5 : isChasing ? 12.2 : 8.0;
    const stride = Math.sin(timeSec * walkRate);
    const revVib = Math.sin(timeSec * (isFrenzy ? 78 : 48)) > 0 ? 1 : 0;
    const legL = Math.round(stride * (isChasing ? 3.2 : 2.3));
    const legR = -legL;
    const chainTick = Math.floor(timeSec * (isFrenzy ? 36 : 24)) % 2;

    sctx.clearRect(0, 0, 28, 44);

    // Tall heavy work boots & towering dark legs
    px(sctx, 9,  29, 4, 12 + legL, "#0d0b0e");
    px(sctx, 10, 29, 2, 11 + legL, "#242129");
    px(sctx, 8,  39 + legL, 5, 3,  "#141012");

    px(sctx, 15, 29, 4, 12 + legR, "#0d0b0e");
    px(sctx, 16, 29, 2, 11 + legR, "#242129");
    px(sctx, 15, 39 + legR, 5, 3,  "#141012");

    // Towering hunched oil-stained coveralls & bloodied leather butcher apron
    px(sctx, 6,  14, 16, 16, "#0d0a0c");
    px(sctx, 7,  15, 14, 14, "#24272c");
    px(sctx, 9,  16, 10, 13, "#3b231b");
    px(sctx, 10, 19, 3,  4,  "#7a141c");
    px(sctx, 15, 22, 3,  5,  "#630e15");

    // Long muscular arms hanging by sides
    const armSw = Math.round(stride * (isChasing ? 3.0 : 2.0));
    px(sctx, 3,  15, 4, 14 + armSw, "#121318");
    px(sctx, 4,  16, 2, 12 + armSw, "#2e3238");
    px(sctx, 3,  28 + armSw, 4, 3,  "#4f382e");

    px(sctx, 21, 15, 4, 14 - armSw, "#121318");
    px(sctx, 22, 16, 2, 12 - armSw, "#2e3238");
    px(sctx, 21, 28 - armSw, 4, 3,  "#4f382e");

    // Iconic Chainsaw Head
    px(sctx, 11, 12, 6, 3, "#1a1718");
    px(sctx, 12, 12, 4, 2, "#595e66");
    px(sctx, 5,  4 + revVib, 11, 9, "#1a0e09");
    px(sctx, 6,  5 + revVib, 9,  7, isFrenzy ? "#e0531f" : "#c94a1c");
    px(sctx, 7,  5 + revVib, 7,  2, "#eb7338");
    px(sctx, 7,  8 + revVib, 5,  3, "#26282e");
    px(sctx, 4,  6 + revVib, 2,  5, "#3a3e45");
    // Glowing crimson vent eye-slit (flares intensely during chase/frenzy!)
    px(sctx, 13, 6 + revVib, 2,  2, isFrenzy ? "#ff6b35" : isChasing ? "#ff2626" : "#cc1f1f");

    // Protruding steel chainsaw guide bar
    px(sctx, 16, 6 + revVib, 11, 5, "#17191d");
    px(sctx, 16, 7 + revVib, 10, 3, "#9aa4b0");
    px(sctx, 17, 8 + revVib, 7,  1, "#8c141c");
    for (let tx = 16 + chainTick; tx <= 26; tx += 2) {
      px(sctx, tx, 5 + revVib,  1, 1, "#f2f6fa");
      px(sctx, tx, 11 + revVib, 1, 1, "#f2f6fa");
    }

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(Math.round(x - 10), Math.round(y - 2), 20, 5);

    const drawX = Math.round(x - 14);
    const drawY = Math.round(y - 41);
    if (facing < 0) {
      ctx.translate(Math.round(x * 2), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sawBuf, drawX, drawY);
    } else {
      ctx.drawImage(sawBuf, drawX, drawY);
    }

    // Revving orange sparks flying off blade when chasing!
    if (isChasing && Math.sin(timeSec * 31) > 0) {
      ctx.fillStyle = isFrenzy ? "#fff0a6" : "#ff8d3b";
      const spX = Math.round(x + facing * 12);
      const spY = Math.round(y - 33 + Math.sin(timeSec * 47) * 3);
      ctx.fillRect(spX, spY, 2, 2);
      ctx.fillRect(spX + facing * 3, spY - 2, 1, 1);
    }
    ctx.restore();
  }

  // ==================== 4. BREAKER / FUSE BOX SPRITES & ELECTRIC LEAK ARCS ====================
  function drawBreakerBoxInMaze(ctx, bx, by, fixed, timeSec) {
    const x = Math.round(bx);
    const y = Math.round(by);
    px(ctx, x - 6, y - 8, 12, 14, "#14161a");
    px(ctx, x - 5, y - 7, 10, 12, "#59544e");
    px(ctx, x - 4, y - 6, 8,  10, "#3b3733");
    // Top caged beacon lamp (matches image_bc96be.jpg!)
    const lampCol = fixed ? "#4df286" : (Math.sin(timeSec * 12) > -0.2 ? "#ff2e2e" : "#8f1414");
    px(ctx, x - 2, y - 10, 4, 3, lampCol);
    px(ctx, x - 3, y - 1, 6, 4, fixed ? "#1f4d30" : "#4d1818");
    px(ctx, x - 2, y,     2, 2, fixed ? "#78ffaa" : "#ff6b6b");
    px(ctx, x + 1, y,     2, 2, fixed ? "#78ffaa" : "#ff6b6b");
  }

  function drawElectricLeakArcs(ctx, bx, by, timeSec, seed) {
    const burst = Math.sin(timeSec * 14 + seed * 3.1);
    if (burst < -0.15) return;
    ctx.save();
    ctx.strokeStyle = burst > 0.55 ? "#d8f8ff" : "#7be0ff";
    ctx.lineWidth = 1.2;
    const ang = ((Math.floor(timeSec * 18) + seed * 7) % 8) * (Math.PI / 4);
    const mx = bx + Math.cos(ang) * 7 + (Math.sin(timeSec * 40) * 2);
    const my = by - 2 + Math.sin(ang) * 7;
    const ex = bx + Math.cos(ang + 0.3) * 14;
    const ey = by - 2 + Math.sin(ang + 0.3) * 13;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2);
    ctx.lineTo(mx, my);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#fff8b8";
    ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 2, 2);
    ctx.restore();
  }

  // ==================== 5. FULL-SCREEN FIRST-PERSON FUSE BOX VIEW (Matches image_bc9701.jpg!) ====================
  function buildBreakerModalSVG(box) {
    const fixed = Boolean(box.fixed);
    const prog = Math.max(0, Math.min(100, Math.round((box.progress || 0) * 100)));
    const barW = Math.round((prog / 100) * 636);
    const glowRgb = fixed ? "64,242,126" : "255,34,34";
    const beaconOuter = fixed ? "#28db6c" : "#e81b1b";
    const beaconCore = fixed ? "#b8ffd4" : "#ff8a8a";
    const leverY = fixed ? 550 : 614;
    const leverCol = fixed ? "#5ef295" : "#783135";

    // Full-screen textured brick basement wall behind the open fuse cabinet
    let bricks = "";
    for (let row = 0; row < 15; row++) {
      const y = row * 52;
      const offset = (row % 2) * 62;
      for (let col = -1; col < 12; col++) {
        const x = col * 124 + offset;
        const shade = ((row * 5 + col * 3) & 3) === 0 ? "#2f1b1d" : "#261517";
        bricks += `<rect x="${x + 4}" y="${y + 4}" width="116" height="44" rx="4" fill="${shade}" stroke="#12090a" stroke-width="4"/>`;
      }
    }

    // Upper wire terminal blocks along the rail
    let terminals = "";
    [296, 336, 376, 416, 650, 690, 730].forEach((tx) => {
      terminals += `
        <rect x="${tx}" y="352" width="28" height="36" rx="2" fill="#2e181a" stroke="#14090b" stroke-width="3"/>
        <circle cx="${tx + 14}" cy="368" r="5" fill="#5e3236"/>
        <rect x="${tx}" y="440" width="28" height="30" rx="2" fill="#2e181a" stroke="#14090b" stroke-width="3"/>
      `;
    });

    return `
      <svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" class="bm-fp-svg" aria-hidden="true">
        <defs>
          <radialGradient id="bmSirenWash" cx="44%" cy="29%" r="72%">
            <stop offset="0%" stop-color="rgba(${glowRgb},0.88)"/>
            <stop offset="35%" stop-color="rgba(${glowRgb},0.46)"/>
            <stop offset="72%" stop-color="rgba(${glowRgb},0.16)"/>
            <stop offset="100%" stop-color="rgba(8,4,6,0.92)"/>
          </radialGradient>
          <linearGradient id="bmCabinetGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(${glowRgb},0.55)"/>
            <stop offset="60%" stop-color="rgba(${glowRgb},0.22)"/>
            <stop offset="100%" stop-color="rgba(18,7,9,0.92)"/>
          </linearGradient>
        </defs>

        <!-- 1. Full-screen aged basement brick wall drenched in red/green siren light -->
        <rect width="1280" height="720" fill="#14090b"/>
        <g opacity="0.95">${bricks}</g>
        <rect width="1280" height="720" fill="url(#bmSirenWash)" class="bm-siren-pulse"/>

        <!-- 2. Top Caged Emergency Beacon + Twin Mounting Bolts -->
        <g transform="translate(526, 134)">
          <rect x="-210" y="136" width="58" height="28" rx="12" fill="#180e10" stroke="#361c20" stroke-width="3"/>
          <rect x="206"  y="136" width="58" height="28" rx="12" fill="#180e10" stroke="#361c20" stroke-width="3"/>
          <rect x="-18"  y="132" width="104" height="32" rx="6" fill="#160c0e" stroke="#3a1e22" stroke-width="4"/>
          <rect x="-6"   y="26"  width="80"  height="108" rx="38" fill="${beaconOuter}" opacity="0.92"/>
          <ellipse cx="34" cy="78" rx="22" ry="38" fill="${beaconCore}" opacity="0.95"/>
          <!-- Wire protective cage bars -->
          <rect x="-10" y="22" width="88" height="114" rx="40" fill="none" stroke="#2c1518" stroke-width="5"/>
          <line x1="12" y1="24" x2="12" y2="136" stroke="#2c1518" stroke-width="3.5"/>
          <line x1="34" y1="22" x2="34" y2="136" stroke="#2c1518" stroke-width="3.5"/>
          <line x1="56" y1="24" x2="56" y2="136" stroke="#2c1518" stroke-width="3.5"/>
          <line x1="-8" y1="74" x2="76" y2="74" stroke="#2c1518" stroke-width="3.5"/>
          <line x1="-6" y1="106" x2="74" y2="106" stroke="#2c1518" stroke-width="3"/>
        </g>

        <!-- 3. Open Heavy Steel Cabinet Door swung out to the far right edge -->
        <g transform="translate(1038, 294)">
          <rect x="-38" y="128" width="56" height="26" rx="5" fill="#2c1619" stroke="#100708" stroke-width="4"/>
          <rect x="14"  y="0"   width="255" height="430" rx="14" fill="#2a1316" stroke="#0d0607" stroke-width="10"/>
          <rect x="36"  y="24"  width="212" height="382" rx="8"  fill="none" stroke="#4d242a" stroke-width="5"/>
        </g>

        <!-- 4. Heavy Open Electrical Fuse Box Cabinet -->
        <rect x="92"  y="286" width="908" height="436" rx="14" fill="#11090b" stroke="#060304" stroke-width="10"/>
        <rect x="144" y="334" width="804" height="388" fill="url(#bmCabinetGlow)" stroke="#241114" stroke-width="6"/>

        <!-- Interior curved feeder wires -->
        <g fill="none" stroke="#180b0d" stroke-width="6">
          <path d="M312,334 Q360,442 292,548"/>
          <path d="M388,334 Q444,475 410,640"/>
          <path d="M520,334 Q468,425 530,535"/>
          <path d="M552,334 Q590,420 582,535"/>
          <path d="M668,334 Q710,455 680,545"/>
          <path d="M746,334 Q724,462 778,625"/>
        </g>

        <!-- Terminal Blocks -->
        ${terminals}

        <!-- Horizontal DIN Rail & Large Golden-Yellow Repair Progress Bar (Updated smoothly at 60fps!) -->
        <rect x="196" y="388" width="698" height="54" fill="#170b0d" stroke="#30161a" stroke-width="4"/>
        <rect x="228" y="399" width="636" height="32" rx="2" fill="#26190f" stroke="#0e0806" stroke-width="3"/>
        <rect id="bm-svg-bar-fill" x="228" y="399" width="${barW}" height="32" rx="2" fill="${fixed ? "#58f291" : "#d6ba4e"}"/>

        <!-- Lower DIN Rail -->
        <rect x="190" y="534" width="712" height="22" fill="#1b0d10" stroke="#33181c" stroke-width="3"/>

        <!-- Left Ceramic Fuse Cylinders -->
        <g transform="translate(248, 536)">
          <rect x="0"   y="12" width="28" height="156" rx="6" fill="#4f2225" stroke="#14080a" stroke-width="4"/>
          <rect x="4"   y="28" width="20" height="124" rx="3" fill="${fixed ? "#7bf7aa" : "#80343a"}"/>
          <rect x="82"  y="12" width="28" height="156" rx="6" fill="#4f2225" stroke="#14080a" stroke-width="4"/>
          <rect x="86"  y="28" width="20" height="124" rx="3" fill="${fixed ? "#7bf7aa" : "#80343a"}"/>
        </g>

        <!-- Two Large Heavy Industrial Breaker Switches (Matches image_bc9701.jpg!) -->
        <g>
          <rect x="446" y="514" width="166" height="208" rx="16" fill="#180c0f" stroke="#3c1d22" stroke-width="5"/>
          <rect x="488" y="546" width="82"  height="132" rx="6"  fill="#0e0608"/>
          <rect x="502" y="${leverY}" width="54" height="44" rx="6" fill="${leverCol}" stroke="#0a0405" stroke-width="4"/>

          <rect x="646" y="514" width="166" height="208" rx="16" fill="#180c0f" stroke="#3c1d22" stroke-width="5"/>
          <rect x="688" y="546" width="82"  height="132" rx="6"  fill="#0e0608"/>
          <rect x="702" y="${leverY}" width="54" height="44" rx="6" fill="${leverCol}" stroke="#0a0405" stroke-width="4"/>
        </g>

        <!-- Crackling electric leakage sparks when not yet repaired -->
        ${!fixed ? `
          <g class="bm-spark-arcs" stroke="#a6f4ff" stroke-width="4.5" fill="none" stroke-linecap="round">
            <polyline points="320,432 356,472 332,504 374,536"/>
            <polyline points="756,432 722,468 764,496 732,534"/>
          </g>` : ""}
      </svg>`;
  }

  function syncBreakerModalUI(bm) {
    const modal = document.getElementById("basement-breaker-modal");
    if (!modal || !bm || !bm.repairingBoxId) return;
    const box = bm.breakers.find((b) => b.id === bm.repairingBoxId);
    if (!box) return;

    const artEl = document.getElementById("bm-breaker-art");
    const titleEl = document.getElementById("bm-fp-box-title");
    const fillEl = document.getElementById("bm-progress-fill");
    const pctEl = document.getElementById("bm-progress-pct");
    const hintEl = document.getElementById("bm-repair-hint");

    const pct = Math.min(100, Math.round((box.progress || 0) * 100));
    if (titleEl) {
      titleEl.textContent = `${box.label}  •  ${box.fixed ? "POWER RESTORED" : "SHORT CIRCUIT"}`;
    }
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
      fillEl.classList.toggle("is-done", box.fixed);
    }
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (hintEl) {
      hintEl.textContent = box.fixed
        ? "BREAKER REPAIRED!"
        : bm.holdingRepairF
          ? "REPAIRING... KEEP HOLDING [F] (LISTEN FOR THE CHAINSAW!)"
          : "HOLD [F] TO REPAIR FUSE BOX  •  [E / ESC] STEP BACK & HIDE";
    }
    if (artEl) {
      const key = `${box.id}_${box.fixed ? 1 : 0}`;
      if (artEl.dataset.lastKey !== key) {
        artEl.dataset.lastKey = key;
        artEl.innerHTML = buildBreakerModalSVG(box);
      }
      // Silky 60fps direct SVG bar width update without DOM rebuild flicker!
      const svgBar = artEl.querySelector("#bm-svg-bar-fill");
      if (svgBar) {
        svgBar.setAttribute("width", String(Math.round((pct / 100) * 636)));
      }
    }
  }

  function openBreakerModal(matchState, box) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !box || box.fixed) return false;
    bm.repairingBoxId = box.id;
    bm.holdingRepairF = true;
    const modal = document.getElementById("basement-breaker-modal");
    const artEl = document.getElementById("bm-breaker-art");
    if (artEl) artEl.dataset.lastKey = "";
    syncBreakerModalUI(bm);
    if (modal) modal.classList.remove("hidden");
    App.Audio.open();
    return true;
  }

  function closeBreakerModal(matchState, silent) {
    const bm = matchState && matchState.basementEvent;
    if (bm) {
      bm.repairingBoxId = null;
      bm.holdingRepairF = false;
    }
    document.getElementById("basement-breaker-modal")?.classList.add("hidden");
    if (!silent) App.Audio.close();
  }

  // ==================== 6. RANDOM PATHING + PROXIMITY CHASE CHAINSAW AI ====================
  function hasClearCorridorLOS(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const col = Math.floor((x1 + (x2 - x1) * t) / TILE);
      const row = Math.floor((y1 + (y2 - y1) * t) / TILE);
      if (isWallTile(col, row)) return false;
    }
    return true;
  }

  function findNextBfsStep(startCol, startRow, goalCol, goalRow) {
    if (startCol === goalCol && startRow === goalRow) return null;
    const queue = [{ c: startCol, r: startRow, first: null }];
    const visited = new Set([`${startCol},${startRow}`]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length > 0) {
      const cur = queue.shift();
      for (let i = 0; i < dirs.length; i++) {
        const nc = cur.c + dirs[i][0];
        const nr = cur.r + dirs[i][1];
        const k = `${nc},${nr}`;
        if (visited.has(k) || !isMonsterWalkable(nc, nr)) continue;
        const firstStep = cur.first || { col: nc, row: nr };
        if (nc === goalCol && nr === goalRow) return firstStep;
        visited.add(k);
        queue.push({ c: nc, r: nr, first: firstStep });
      }
    }
    return null;
  }

  function updateChainsawMonsterAI(dt, bm, matchState, localPlayer) {
    const m = bm.monster;
    if (!m || !m.active || !activeLayout) return;

    // 1. Collect all living exposed players in the Basement (players inside lit hiding rooms 'A' are invisible/safe!)
    const exposedTargets = [];
    if (localPlayer && !bm.localDeadInCellar && !isPlayerInAlcove(localPlayer)) {
      exposedTargets.push({ x: localPlayer.x, y: localPlayer.y });
    }
    if (isMpMode(matchState) && App.Events && App.Events.getAllLivingPlayers) {
      App.Events.getAllLivingPlayers(matchState, null).forEach((lp) => {
        if (!lp.isLocal && lp.inBasement && !isPlayerInAlcove(lp)) {
          exposedTargets.push({ x: lp.x, y: lp.y });
        }
      });
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < exposedTargets.length; i++) {
      const t = exposedTargets[i];
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }

    // 2. Chase detection / lose-aggro state machine
    if (nearest) {
      const seesTarget = nearestDist <= SAW_DETECT_LOS_RADIUS && hasClearCorridorLOS(m.x, m.y, nearest.x, nearest.y);
      const sensesClose = nearestDist <= SAW_DETECT_NEAR_RADIUS;
      if (seesTarget || sensesClose) {
        m.chasing = true;
        m.chaseMemory = 2.8;
        m.lastKnownX = nearest.x;
        m.lastKnownY = nearest.y;
      } else if (m.chasing) {
        m.chaseMemory = Math.max(0, (m.chaseMemory || 0) - dt);
        if (nearestDist > SAW_LOSE_RADIUS || m.chaseMemory <= 0) {
          m.chasing = false;
          m.frenzy = false;
        }
      }
    } else if (m.chasing) {
      // Target hid inside a lit hiding room ('A') -> immediately break chase!
      m.chasing = false;
      m.frenzy = false;
      m.targetTile = null;
    }

    // 3. Speed scaling: if player stands TOO CLOSE (<= 44px), monster surges to 102 px/s (CANNOT OUTRUN!)
    if (m.chasing) {
      m.frenzy = Boolean(nearest && nearestDist <= SAW_NO_ESCAPE_RADIUS);
      m.speed = m.frenzy ? SAW_NO_ESCAPE_SPEED : SAW_CHASE_SPEED;
    } else {
      m.frenzy = false;
      m.speed = SAW_WANDER_SPEED;
    }

    // 4. Direct lunge when extremely close with clear corridor LOS (cannot outrun!)
    if (m.chasing && nearest && nearestDist <= SAW_NO_ESCAPE_RADIUS && hasClearCorridorLOS(m.x, m.y, nearest.x, nearest.y)) {
      const dx = nearest.x - m.x;
      const dy = nearest.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const nx = m.x + (dx / d) * m.speed * dt;
        const ny = m.y + (dy / d) * m.speed * dt;
        if (isMonsterWalkable(Math.floor(nx / TILE), Math.floor(ny / TILE))) {
          m.x = nx;
          m.y = ny;
          if (Math.abs(dx) > 0.2) m.facing = dx >= 0 ? 1 : -1;
          m.targetTile = null;
          return;
        }
      }
    }

    // 5. Grid navigation: BFS shortest path when CHASING, 100% RANDOM pathing when WANDERING
    const curCol = Math.floor(m.x / TILE);
    const curRow = Math.floor(m.y / TILE);
    m.repathTimer = Math.max(0, (m.repathTimer || 0) - dt);

    const arrived =
      !m.targetTile ||
      !isMonsterWalkable(m.targetTile.col, m.targetTile.row) ||
      Math.hypot(m.targetTile.col * TILE + 8 - m.x, m.targetTile.row * TILE + 8 - m.y) <= 2.4;

    if (arrived || (m.chasing && m.repathTimer <= 0)) {
      if (arrived && m.targetTile) {
        m.prevCol = curCol;
        m.prevRow = curRow;
      }

      if (m.chasing && typeof m.lastKnownX === "number" && typeof m.lastKnownY === "number") {
        m.repathTimer = 0.24;
        const gCol = Math.floor(m.lastKnownX / TILE);
        const gRow = Math.floor(m.lastKnownY / TILE);
        const nextStep = findNextBfsStep(curCol, curRow, gCol, gRow);
        if (nextStep) {
          m.targetTile = nextStep;
        } else {
          // Reached last known tile & player is gone -> drop back to random wander
          m.chasing = false;
          m.frenzy = false;
          m.targetTile = null;
        }
      }

      if (!m.chasing || !m.targetTile) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const neighbors = [];
        for (let i = 0; i < dirs.length; i++) {
          const nc = curCol + dirs[i][0];
          const nr = curRow + dirs[i][1];
          if (isMonsterWalkable(nc, nr)) neighbors.push({ col: nc, row: nr });
        }
        if (neighbors.length > 0) {
          const nonBacktrack = neighbors.filter((n) => !(n.col === m.prevCol && n.row === m.prevRow));
          // Completely random choice along walkable paths (10% chance to spontaneously reverse even in straight halls)
          const pool = (nonBacktrack.length > 0 && Math.random() > 0.10) ? nonBacktrack : neighbors;
          m.targetTile = pool[Math.floor(Math.random() * pool.length)];
        }
      }
    }

    if (m.targetTile) {
      const tx = m.targetTile.col * TILE + 8;
      const ty = m.targetTile.row * TILE + 8;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.3) {
        const step = Math.min(dist, m.speed * dt);
        m.x += (dx / dist) * step;
        m.y += (dy / dist) * step;
        if (Math.abs(dx) > 0.25) m.facing = dx >= 0 ? 1 : -1;
      }
    }
  }

  // ==================== 7. START / UPDATE / WIN / LOSE LIFECYCLE ====================
  function startBasementEvent(matchState, player) {
    if (!matchState) return null;
    if (App.Events && App.Events.beginMpEventSession) App.Events.beginMpEventSession(matchState, "the_basement");

    const layout = buildBasementLayoutFromRoomMap(matchState.roomMap);
    buildStaticBasementMaze(matchState);

    const savedLights = snapshotRoomLights(matchState);

    const breakers = layout.breakerSpecs.map((s, idx) => ({
      id: s.id,
      label: s.label,
      col: s.col,
      row: s.row,
      wall: s.wall,
      x: s.col * TILE + 8,
      y: s.row * TILE + 8,
      progress: 0,
      fixed: false,
      seed: idx + 1
    }));

    const sp = layout.spawnTile;

    matchState.basementEvent = {
      active: true,
      stage: "DESCENDING", // DESCENDING (14s) -> PRE_START_5S (5s) -> PLAYING -> ASCENDING (14s)
      savedLights,
      slideTimer: 0,
      preStartTimer: PRE_START_DELAY,
      breakers,
      fixedCount: 0,
      repairingBoxId: null,
      holdingRepairF: false,
      monster: {
        active: false,
        x: sp.col * TILE + 8,
        y: sp.row * TILE + 8,
        facing: 1,
        prevCol: sp.col,
        prevRow: sp.row,
        targetTile: null,
        chasing: false,
        frenzy: false,
        chaseMemory: 0,
        repathTimer: 0,
        speed: SAW_WANDER_SPEED
      },
      notice: "THE FLOOR IS SHAKING! THE DINING ROOM IS SINKING INTO THE BASEMENT...",
      noticeTimer: 6.0,
      syncAccum: 0,
      repairSendAccum: 0,
      pendingGuestDelta: 0
    };
    if (isMpMode(matchState) && isMpHost(matchState)) {
      broadcastStateNow(matchState);
    }

    matchState.currentRoomCoord = { x: 0, y: 0 };
    if (player) {
      player.seated = false;
      player.crouching = false;
      player.x = 54;
      player.y = 132;
      player.facing = 1;
    }

    if (App.Audio && App.Audio.playBasementSlide) {
      App.Audio.playBasementSlide(SLIDE_DURATION);
    }

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "THE BASEMENT\nTHE DINING ROOM IS SLIDING UNDERGROUND...\nREPAIR ALL 5 RED FUSE BOXES [HOLD F] & HIDE IN LIT ALCOVES!",
        { typingDurationSec: 4.5, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 6000);
    }

    return matchState.basementEvent;
  }

  function finishDescentIntoBasement(bm, player) {
    bm.stage = "PRE_START_5S";
    bm.preStartTimer = PRE_START_DELAY;
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();

    if (player && activeLayout) {
      player.x = activeLayout.hubCenter.x;
      player.y = activeLayout.hubCenter.y;
      player.facing = 1;
    }
    bm.notice = "LANDED IN THE BASEMENT! 5 SECONDS — FIND THE LIT HIDING ROOMS & RED FUSE BOXES!";
    bm.noticeTimer = 5.0;
    App.Audio.clockChime();
  }

  function beginBasementHunt(bm) {
    bm.stage = "PLAYING";
    bm.monster.active = true;
    const sp = activeLayout ? activeLayout.spawnTile : { col: 3, row: 3 };
    bm.monster.x = sp.col * TILE + 8;
    bm.monster.y = sp.row * TILE + 8;
    bm.monster.prevCol = sp.col;
    bm.monster.prevRow = sp.row;
    bm.monster.targetTile = null;
    bm.monster.chasing = false;
    bm.monster.frenzy = false;
    bm.notice = "THE CHAINSAW ROAMS THE DARK! STAY FAR OR DUCK INTO A LIT HIDING ROOM!";
    bm.noticeTimer = 5.5;
    App.Audio.hexAlert();
  }

  function startVictoryAscent(bm, matchState, player) {
    closeBreakerModal(matchState, true);
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    bm.monster.active = false;
    bm.monster.chasing = false;
    bm.monster.frenzy = false;
    bm.stage = "ASCENDING";
    bm.slideTimer = 0;

    if (App.Audio && App.Audio.playBasementSlide) {
      App.Audio.playBasementSlide(SLIDE_DURATION);
    }
    bm.notice = "ALL 5 FUSE BOXES RESTORED! RISING BACK UP TO THE DINING ROOM...";
    bm.noticeTimer = 6.5;

    if (App.Events && App.Events.showSmudgeBanner) {
      App.Events.showSmudgeBanner(
        "ALL 5 FUSE BOXES REPAIRED!\nTHE BASEMENT LIFTS YOU BACK TO THE DINING ROOM...",
        { success: true, typingDurationSec: 3.2, showChoices: false }
      );
      setTimeout(() => {
        if (App.Events && App.Events.hideSmudgeBanner) App.Events.hideSmudgeBanner();
      }, 4600);
    }
  }

  function finishVictoryAscent(bm, matchState, player) {
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    restoreRoomLights(matchState, bm.savedLights);

    bm.active = false;
    matchState.basementEvent = null;
    if (App.Events && App.Events.onEventWonBroadcast) {
      App.Events.onEventWonBroadcast(matchState, "the_basement", "ALL 5 FUSE BOXES REPAIRED!\nTHE BASEMENT LIFTS BACK UP — CELLAR DOOR UNLOCKED.");
    }
    matchState.currentRoomCoord = { x: 0, y: 0 };
    if (player) {
      player.seated = false;
      player.x = 54;
      player.y = 132;
      player.facing = 1;
    }
    App.Audio.clockChime();
  }

  function triggerChainsawDeath(matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm) return;

    closeBreakerModal(matchState, true);
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();

    const res = (App.Events && App.Events.onLocalPlayerEventDeath)
      ? App.Events.onLocalPlayerEventDeath(matchState, "the_basement", "sparky", "THE CHAINSAW MONSTER CAUGHT YOU!")
      : { keepEventRunning: false };

    if (res.keepEventRunning) {
      bm.localDeadInCellar = true;
    } else {
      restoreRoomLights(matchState, bm.savedLights);
      bm.active = false;
      matchState.basementEvent = null;
    }
  }

  function forceEndFromNetwork(matchState, won, opts) {
    cleanup(matchState, opts);
  }

  // Exact preserved near/far spatial SFX mechanism for audio/chainsaw_sfx.mp3!
  function syncChainsawSpatialAudio(bm, player) {
    if (!App.Audio || !App.Audio.setChainsawAttenuation) return;
    if (!bm || !bm.active || !bm.monster || !bm.monster.active) {
      if (App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
      return;
    }
    const dist = Math.hypot(player.x - bm.monster.x, player.y - bm.monster.y);
    const minDist = 18;
    const maxDist = 235;
    const t = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const att = Math.pow(1 - t, 1.45);
    if (App.Audio.startChainsawLoop) App.Audio.startChainsawLoop();
    App.Audio.setChainsawAttenuation(att);
  }

  function update(dt, matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) {
      if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
      return;
    }
    if (!activeLayout) {
      buildBasementLayoutFromRoomMap(matchState.roomMap);
      buildStaticBasementMaze(matchState);
    }
    if (bm.localDeadInCellar) {
      if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
      if (isMpGuest(matchState)) return;
    }

    if (bm.noticeTimer > 0) {
      bm.noticeTimer = Math.max(0, bm.noticeTimer - dt);
      if (bm.noticeTimer === 0) bm.notice = "";
    }

    // GUEST: sends repair ticks to Host & tracks Host's authoritative Chainsaw position & near/far SFX
    if (isMpGuest(matchState)) {
      if (bm.stage === "DESCENDING" || bm.stage === "ASCENDING") {
        bm.slideTimer = Math.min(SLIDE_DURATION, bm.slideTimer + dt);
        return;
      }
      if (bm.stage === "PRE_START_5S") {
        bm.preStartTimer = Math.max(0, bm.preStartTimer - dt);
        return;
      }
      if (bm.repairingBoxId && bm.holdingRepairF) {
        const box = bm.breakers.find((b) => b.id === bm.repairingBoxId);
        if (box && !box.fixed) {
          const delta = dt / REPAIR_DURATION;
          box.progress = Math.min(0.99, box.progress + delta);
          bm.pendingGuestDelta = (bm.pendingGuestDelta || 0) + delta;
          bm.repairSendAccum = (bm.repairSendAccum || 0) + dt;
          repairSparkTimer -= dt;
          if (repairSparkTimer <= 0) {
            repairSparkTimer = 0.24;
            if (App.Audio && App.Audio.electricRepairTick) App.Audio.electricRepairTick();
          }
          syncBreakerModalUI(bm);
          if (bm.repairSendAccum >= 0.12) {
            App.Network.sendGameAction("MP_BASEMENT_REPAIR", { boxId: box.id, delta: bm.pendingGuestDelta });
            bm.repairSendAccum = 0;
            bm.pendingGuestDelta = 0;
          }
        }
      }
      if (bm.monster && bm.monster.active) {
        syncChainsawSpatialAudio(bm, player);
        if (!isPlayerInAlcove(player) && Math.hypot(bm.monster.x - player.x, bm.monster.y - player.y) <= 13.5) {
          triggerChainsawDeath(matchState);
        }
      }
      return;
    }

    // 1. 14-Second Violent Shaking Descent (HOST / SP)
    if (bm.stage === "DESCENDING") {
      bm.slideTimer += dt;
      if (bm.slideTimer >= SLIDE_DURATION) {
        finishDescentIntoBasement(bm, player);
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.35) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 2. 5-Second Calm Before Chainsaw Awakens
    if (bm.stage === "PRE_START_5S") {
      bm.preStartTimer -= dt;
      if (bm.preStartTimer <= 0) {
        beginBasementHunt(bm);
        if (isMpMode(matchState)) broadcastStateNow(matchState);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.30) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 3. 14-Second Reverse Shaking Ascent After Win
    if (bm.stage === "ASCENDING") {
      bm.slideTimer += dt;
      if (bm.slideTimer >= SLIDE_DURATION) {
        finishVictoryAscent(bm, matchState, player);
      } else if (isMpMode(matchState)) {
        bm.syncAccum = (bm.syncAccum || 0) + dt;
        if (bm.syncAccum >= 0.35) { bm.syncAccum = 0; broadcastStateNow(matchState); }
      }
      return;
    }

    // 4. PLAYING STAGE: Repair Progress + Random-Wander & Proximity-Chase Chainsaw AI!
    if (!bm.localDeadInCellar && bm.repairingBoxId && bm.holdingRepairF) {
      applyHostBreakerDelta(matchState, player, bm.repairingBoxId, dt / REPAIR_DURATION, true);
    }

    const m = bm.monster;
    if (m.active) {
      updateChainsawMonsterAI(dt, bm, matchState, player);

      if (!bm.localDeadInCellar) {
        syncChainsawSpatialAudio(bm, player);
        if (!isPlayerInAlcove(player) && Math.hypot(m.x - player.x, m.y - player.y) <= 14.5) {
          triggerChainsawDeath(matchState);
        }
      }

      if (isMpMode(matchState) && App.Events && App.Events.getAllLivingPlayers && App.Events.hostKillRemotePlayer) {
        App.Events.getAllLivingPlayers(matchState, null).forEach((lp) => {
          if (lp.isLocal || !lp.inBasement) return;
          if (isPlayerInAlcove(lp)) return;
          if (Math.hypot(m.x - lp.x, m.y - lp.y) <= 14.5) {
            App.Events.hostKillRemotePlayer(matchState, lp.playerId, "the_basement", "sparky", "THE CHAINSAW MONSTER CAUGHT YOU!");
          }
        });
      }
    }

    if (isMpMode(matchState)) {
      bm.syncAccum = (bm.syncAccum || 0) + dt;
      if (bm.syncAccum >= 0.085) {
        bm.syncAccum = 0;
        broadcastStateNow(matchState);
      }
    }
  }

  // ==================== 8. CONTROLS, COLLISION & SHAKE ====================
  function onKeyFDown(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING") return false;

    if (bm.repairingBoxId) {
      bm.holdingRepairF = true;
      syncBreakerModalUI(bm);
      return true;
    }

    for (const box of bm.breakers) {
      if (box.fixed) continue;
      if (Math.hypot(player.x - box.x, player.y - box.y) <= 24) {
        return openBreakerModal(matchState, box);
      }
    }
    return false;
  }

  function onKeyFUp(matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || !bm.repairingBoxId) return false;
    bm.holdingRepairF = false;
    syncBreakerModalUI(bm);
    return true;
  }

  function collidesInBasement(nx, ny) {
    const halfW = 3.5;
    const pts = [
      [nx - halfW, ny - 5],
      [nx + halfW, ny - 5],
      [nx - halfW, ny + 1],
      [nx + halfW, ny + 1]
    ];
    for (let i = 0; i < pts.length; i++) {
      const col = Math.floor(pts[i][0] / TILE);
      const row = Math.floor(pts[i][1] / TILE);
      if (isWallTile(col, row)) return true;
    }
    return false;
  }

  function getShakeOffset(matchState, timeSec) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return { x: 0, y: 0 };
    if (bm.stage !== "DESCENDING" && bm.stage !== "ASCENDING") return { x: 0, y: 0 };
    const frac = Math.min(1, bm.slideTimer / SLIDE_DURATION);
    const ramp = Math.sin(frac * Math.PI);
    const amp = 4.5 + ramp * 6.5;
    return {
      x: Math.round((Math.sin(timeSec * 61) + Math.cos(timeSec * 47)) * amp * 0.55),
      y: Math.round((Math.cos(timeSec * 53) + Math.sin(timeSec * 79)) * amp * 0.55)
    };
  }

  function getPrompt(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING" || bm.repairingBoxId) return null;

    for (const box of bm.breakers) {
      if (box.fixed) continue;
      if (Math.hypot(player.x - box.x, player.y - box.y) <= 24) {
        return { type: "basement_breaker", prompt: `[F] INSPECT & REPAIR ${box.label}` };
      }
    }
    if (isPlayerInAlcove(player)) {
      return { type: "basement_alcove", prompt: "HIDDEN IN LIT ALCOVE — SAFE FROM CHAINSAW" };
    }
    return null;
  }

  // ==================== 9. RENDERER (DESCENT / PITCH-DARK MAZE + LIT HIDING ROOMS / ASCENT) ====================
  function renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, overrideCenter) {
    const bm = matchState && matchState.basementEvent;
    if (!activeLayout) buildBasementLayoutFromRoomMap(matchState && matchState.roomMap);
    if (!staticMazeCanvas) buildStaticBasementMaze(matchState);
    const L = activeLayout;

    const focusX = overrideCenter ? overrideCenter.x : player.x;
    const focusY = overrideCenter ? overrideCenter.y : player.y;
    const camX = Math.max(0, Math.min(Math.max(0, L.worldW - VIEW_W), Math.round(focusX - VIEW_W / 2)));
    const camY = Math.max(0, Math.min(Math.max(0, L.worldH - VIEW_H), Math.round(focusY - VIEW_H / 2)));

    // Fill outer background black in case world is smaller than viewport
    ctx.fillStyle = "#060505";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 1. Draw Basement Maze brick walls & damp floors
    const drawW = Math.min(VIEW_W, L.worldW - camX);
    const drawH = Math.min(VIEW_H, L.worldH - camY);
    ctx.drawImage(staticMazeCanvas, camX, camY, drawW, drawH, 0, 0, drawW, drawH);

    // 2. Draw glowing wall-mounted light fixtures inside every small hiding room ('A')
    if (L.alcoveLights) {
      L.alcoveLights.forEach((al) => {
        const ax = Math.round(al.x - camX);
        const ay = Math.round(al.y - camY);
        if (ax < -20 || ax > VIEW_W + 20 || ay < -20 || ay > VIEW_H + 20) return;
        px(ctx, ax - 3, ay - 7, 6, 2, "#382c20");
        px(ctx, ax - 2, ay - 5, 4, 4, "#fff6cc");
        px(ctx, ax - 1, ay - 4, 2, 2, "#ffffff");
      });
    }

    // 3. Draw all 5 Breaker/Fuse Boxes mounted on corridor walls
    if (bm && bm.breakers) {
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY;
        if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) return;
        drawBreakerBoxInMaze(ctx, sx, sy, b.fixed, timeSec);
      });
    }

    // 4. Depth-sort Local Player, Co-op Teammates & Tall Chainsaw-Head Monster
    const actors = [];
    const remoteBasementPlayers = [];
    if (player && !overrideCenter) {
      actors.push({
        y: player.y,
        draw: () => {
          const spriteCfg = Object.assign({}, charConfig, {
            facing: player.facing,
            walking: player.moving,
            lantern: player.lanternOn
          });
          App.Character.drawInWorld(ctx, player.x - camX, player.y - camY, spriteCfg, timeSec, {
            seated: false,
            sprinting: player.sprinting,
            crouching: player.crouching
          });
        }
      });
    }
    if (!overrideCenter && App.Network && App.Network.isMultiplayerMatch && App.Network.isMultiplayerMatch() && App.Network.getAllRemotePlayers) {
      const skipPid = player && player.spectatePlayerId ? player.spectatePlayerId : null;
      App.Network.getAllRemotePlayers().forEach((rp) => {
        if (!rp.inBasement || rp.deadInEvent || rp.deadSpectator) return;
        if (skipPid && rp.playerId === skipPid) return;
        remoteBasementPlayers.push(rp);
        actors.push({
          y: rp.y,
          draw: () => {
            const rCfg = Object.assign({}, rp.character || charConfig, {
              facing: rp.facing || 1,
              walking: Boolean(rp.moving),
              lantern: Boolean(rp.lanternOn)
            });
            App.Character.drawInWorld(ctx, rp.x - camX, rp.y - camY, rCfg, timeSec, {
              seated: false,
              sprinting: Boolean(rp.sprinting),
              crouching: Boolean(rp.crouching)
            });
          }
        });
      });
    }
    if (bm && bm.monster && bm.monster.active) {
      const m = bm.monster;
      actors.push({
        y: m.y,
        draw: () => drawChainsawMonsterSprite(ctx, m.x - camX, m.y - camY, timeSec, m.facing, Boolean(m.chasing), Boolean(m.frenzy))
      });
    }
    actors.sort((a, b) => a.y - b.y);
    actors.forEach((a) => a.draw());

    // 5. PITCH-DARK Subterranean Darkness Mask (Very dark basement!)
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, VIEW_W, VIEW_H);
    mctx.fillStyle = "rgba(2, 2, 4, 0.968)";
    mctx.fillRect(0, 0, VIEW_W, VIEW_H);

    mctx.globalCompositeOperation = "destination-out";

    // (a) Tight handheld lantern halo so corridors stay oppressively dark
    if (player && !overrideCenter) {
      const pxv = player.x - camX;
      const pyv = player.y - camY - 8;
      const rad = player.lanternOn ? 44 : 18;
      const lg = mctx.createRadialGradient(pxv, pyv, 3, pxv, pyv, rad);
      lg.addColorStop(0, player.lanternOn ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.48)");
      lg.addColorStop(0.55, player.lanternOn ? "rgba(0,0,0,0.46)" : "rgba(0,0,0,0.16)");
      lg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = lg;
      mctx.fillRect(pxv - rad - 2, pyv - rad - 2, rad * 2 + 4, rad * 2 + 4);
    }
    remoteBasementPlayers.forEach((rp) => {
      const rxv = rp.x - camX;
      const ryv = rp.y - camY - 8;
      const rRad = rp.lanternOn ? 40 : 16;
      if (rxv < -rRad || rxv > VIEW_W + rRad || ryv < -rRad || ryv > VIEW_H + rRad) return;
      const rlg = mctx.createRadialGradient(rxv, ryv, 3, rxv, ryv, rRad);
      rlg.addColorStop(0, rp.lanternOn ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.40)");
      rlg.addColorStop(0.55, rp.lanternOn ? "rgba(0,0,0,0.40)" : "rgba(0,0,0,0.14)");
      rlg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = rlg;
      mctx.fillRect(rxv - rRad - 2, ryv - rRad - 2, rRad * 2 + 4, rRad * 2 + 4);
    });

    // (b) Dim overhead shaft light at Dining Room landing hub
    const hx = L.hubCenter.x - camX;
    const hy = L.hubCenter.y - camY;
    const hg = mctx.createRadialGradient(hx, hy, 4, hx, hy, 36);
    hg.addColorStop(0, "rgba(0,0,0,0.58)");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = hg;
    mctx.fillRect(hx - 38, hy - 38, 76, 76);

    // (c) LIT HIDING ROOMS / ALCOVES ('A'): bright warm refuge light punching through the darkness!
    if (L.alcoveLights) {
      L.alcoveLights.forEach((al) => {
        const ax = al.x - camX;
        const ay = al.y - camY;
        const ex = al.entryX - camX;
        const ey = al.entryY - camY;
        if (ax < -48 || ax > VIEW_W + 48 || ay < -48 || ay > VIEW_H + 48) return;
        const rad = 36;
        const ag = mctx.createRadialGradient(ax, ay, 4, ax, ay, rad);
        ag.addColorStop(0, "rgba(0,0,0,0.98)");
        ag.addColorStop(0.55, "rgba(0,0,0,0.68)");
        ag.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = ag;
        mctx.fillRect(ax - rad, ay - rad, rad * 2, rad * 2);

        // Soft spill toward alcove mouth so players spot the hiding room from the dark corridor
        const eg = mctx.createRadialGradient(ex, ey, 2, ex, ey, 26);
        eg.addColorStop(0, "rgba(0,0,0,0.72)");
        eg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = eg;
        mctx.fillRect(ex - 26, ey - 26, 52, 52);
      });
    }

    // (d) Breaker Boxes punch clearly through darkness so RED/GREEN beacons shine across corridors
    if (bm && bm.breakers) {
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY - 2;
        if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) return;
        const br = b.fixed ? 26 : 32;
        const bg = mctx.createRadialGradient(sx, sy, 3, sx, sy, br);
        bg.addColorStop(0, "rgba(0,0,0,0.90)");
        bg.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = bg;
        mctx.fillRect(sx - br, sy - br, br * 2, br * 2);
      });
    }

    // (e) Faint eerie reveal around Chainsaw Monster (slightly brighter when chasing/frenzy!)
    if (bm && bm.monster && bm.monster.active) {
      const mx = bm.monster.x - camX;
      const my = bm.monster.y - camY - 18;
      const mRad = bm.monster.chasing ? 32 : 22;
      const mg = mctx.createRadialGradient(mx, my, 2, mx, my, mRad);
      mg.addColorStop(0, bm.monster.chasing ? "rgba(0,0,0,0.82)" : "rgba(0,0,0,0.56)");
      mg.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = mg;
      mctx.fillRect(mx - mRad, my - mRad, mRad * 2, mRad * 2);
    }

    ctx.drawImage(maskCanvas, 0, 0);

    // 6. Post-darkness colored glows:
    //    (a) Warm amber-gold glow from every Lit Hiding Room ('A')
    if (L.alcoveLights) {
      const lampFlick = 0.90 + Math.sin(timeSec * 10.5) * 0.08;
      L.alcoveLights.forEach((al) => {
        const ax = al.x - camX;
        const ay = al.y - camY - 2;
        if (ax < -42 || ax > VIEW_W + 42 || ay < -42 || ay > VIEW_H + 42) return;
        const rad = 32;
        const glow = ctx.createRadialGradient(ax, ay, 2, ax, ay, rad);
        glow.addColorStop(0, `rgba(255, 232, 166, ${(0.40 * lampFlick).toFixed(3)})`);
        glow.addColorStop(0.55, `rgba(235, 180, 92, ${(0.17 * lampFlick).toFixed(3)})`);
        glow.addColorStop(1, "rgba(200, 140, 50, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(ax - rad, ay - rad, rad * 2, rad * 2);
      });
    }

    //    (b) RED glow + electric leakage arcs on unrepaired boxes; GREEN glow on repaired boxes
    if (bm && bm.breakers) {
      const pulse = 0.70 + Math.sin(timeSec * 6.0) * 0.30;
      bm.breakers.forEach((b) => {
        const sx = b.x - camX;
        const sy = b.y - camY - 2;
        if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) return;

        const rad = b.fixed ? 24 : 30;
        const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad);
        if (b.fixed) {
          glow.addColorStop(0, "rgba(74, 245, 134, 0.44)");
          glow.addColorStop(1, "rgba(40, 200, 95, 0)");
        } else {
          glow.addColorStop(0, `rgba(255, 42, 42, ${(0.54 * pulse).toFixed(3)})`);
          glow.addColorStop(0.55, `rgba(210, 22, 22, ${(0.22 * pulse).toFixed(3)})`);
          glow.addColorStop(1, "rgba(180, 0, 0, 0)");
        }
        ctx.fillStyle = glow;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);

        if (!b.fixed) {
          drawElectricLeakArcs(ctx, sx, sy, timeSec, b.seed);
        }
      });
    }

    //    (c) Ominous red eye tint when Chainsaw Monster is actively CHASING!
    if (bm && bm.monster && bm.monster.active && bm.monster.chasing) {
      const mx = bm.monster.x - camX;
      const my = bm.monster.y - camY - 24;
      const rg = ctx.createRadialGradient(mx, my, 2, mx, my, bm.monster.frenzy ? 28 : 20);
      rg.addColorStop(0, bm.monster.frenzy ? "rgba(255, 65, 25, 0.34)" : "rgba(255, 38, 38, 0.22)");
      rg.addColorStop(1, "rgba(200, 0, 0, 0)");
      ctx.fillStyle = rg;
      ctx.fillRect(mx - 30, my - 30, 60, 60);
    }

    //    (d) Subtle warm handheld lantern tint
    if (player && !overrideCenter && player.lanternOn) {
      const lx = player.x - camX + player.facing * 7;
      const ly = player.y - camY - 8;
      const wg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 36);
      wg.addColorStop(0, "rgba(255, 212, 128, 0.18)");
      wg.addColorStop(1, "rgba(255, 180, 80, 0)");
      ctx.fillStyle = wg;
      ctx.fillRect(lx - 36, ly - 36, 72, 72);
    }

    return { camX, camY };
  }

  // Dramatic 14-Second Vertical Slide Transition (DESCENDING down into Basement OR ASCENDING back up!)
  function renderSlideCutscene(ctx, timeSec, player, charConfig, matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!activeLayout) buildBasementLayoutFromRoomMap(matchState && matchState.roomMap);
    const isAscending = bm && bm.stage === "ASCENDING";
    const rawFrac = bm ? Math.max(0, Math.min(1, bm.slideTimer / SLIDE_DURATION)) : 0;
    const ease = rawFrac < 0.5 ? 2 * rawFrac * rawFrac : 1 - Math.pow(-2 * rawFrac + 2, 2) / 2;

    const flick = 0.55 + Math.sin(timeSec * 29) * 0.35;
    App.GameRoom.render(dsctx, timeSec, Math.max(0.18, flick), player, charConfig, matchState);

    renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, activeLayout.hubCenter);

    const progressDown = isAscending ? (1 - ease) : ease;

    const wallShift = Math.floor((timeSec * (isAscending ? -130 : 130)) % 24);
    ctx.fillStyle = "rgba(18, 16, 15, 0.72)";
    ctx.fillRect(0, 0, 14, VIEW_H);
    ctx.fillRect(VIEW_W - 14, 0, 14, VIEW_H);
    for (let y = -24; y < VIEW_H + 24; y += 24) {
      const sy = y + wallShift;
      px(ctx, 2, sy, 10, 4, "#3b3834");
      px(ctx, VIEW_W - 12, sy, 10, 4, "#3b3834");
      px(ctx, 13, sy, 2, 24, "#6b5426");
      px(ctx, VIEW_W - 15, sy, 2, 24, "#6b5426");
    }

    const slideOffsetY = Math.round(progressDown * VIEW_H);
    const diningAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, (progressDown - 0.68) / 0.32)));

    if (diningAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = diningAlpha;
      ctx.drawImage(diningSlideBuf, 0, slideOffsetY);
      px(ctx, 0, slideOffsetY - 4, VIEW_W, 5, "#262320");
      for (let hx = 0; hx < VIEW_W; hx += 16) {
        px(ctx, hx, slideOffsetY - 3, 8, 3, "#d4a238");
      }
      ctx.restore();
    }

    for (let i = 0; i < 16; i++) {
      const dx = (i * 37 + Math.floor(timeSec * 19)) % VIEW_W;
      const dy = ((i * 53 + Math.floor(timeSec * (isAscending ? -95 : 95))) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.fillStyle = "rgba(195, 185, 165, 0.45)";
      ctx.fillRect(dx, dy, 2, 2);
    }

    return { camX: 0, camY: 0 };
  }

  function renderViewport(ctx, timeSec, player, charConfig, matchState) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return { camX: 0, camY: 0 };
    if (bm.stage === "DESCENDING" || bm.stage === "ASCENDING") {
      return renderSlideCutscene(ctx, timeSec, player, charConfig, matchState);
    }
    return renderBasementMazeTo(ctx, timeSec, player, charConfig, matchState, null);
  }

  // ==================== 10. HUD & STATE HELPERS ====================
  function getHudSummary(matchState, player) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active) return null;

    if (bm.stage === "DESCENDING") {
      return {
        title: `THE BASEMENT • DESCENDING (${Math.max(1, Math.ceil(SLIDE_DURATION - bm.slideTimer))}S)`,
        sub: "THE DINING ROOM IS SLIDING UNDERGROUND...",
        notice: bm.notice || ""
      };
    }
    if (bm.stage === "PRE_START_5S") {
      return {
        title: `THE BASEMENT • STARTING IN ${Math.max(1, Math.ceil(bm.preStartTimer))}S`,
        sub: "LOCATE THE RED FUSE BOXES & LIT HIDING ROOMS!",
        notice: bm.notice || ""
      };
    }
    if (bm.stage === "ASCENDING") {
      return {
        title: `THE BASEMENT CLEARED • RISING UP (${Math.max(1, Math.ceil(SLIDE_DURATION - bm.slideTimer))}S)`,
        sub: "SLIDING BACK UP TO THE DINING ROOM...",
        notice: bm.notice || ""
      };
    }
    const statusTag = isPlayerInAlcove(player)
      ? "HIDDEN IN LIT ROOM (SAFE)"
      : bm.monster && bm.monster.frenzy
        ? "TOO CLOSE — CANNOT OUTRUN! DUCK INTO A LIT ROOM!"
        : bm.monster && bm.monster.chasing
          ? "CHAINSAW CHASING YOU! RUN TO A LIT HIDING ROOM!"
          : "IN DARK CORRIDOR (LISTEN FOR CHAINSAW)";
    return {
      title: `THE BASEMENT • FUSE BOXES REPAIRED: ${bm.fixedCount} / ${bm.breakers.length}`,
      sub: `${statusTag}  |  [F] REPAIR BOX`,
      notice: bm.notice || ""
    };
  }

  function isActive(matchState) {
    return Boolean(matchState && matchState.basementEvent && matchState.basementEvent.active);
  }

  function isInBasementMap(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && !bm.localDeadInCellar && (bm.stage === "PRE_START_5S" || bm.stage === "PLAYING"));
  }

  function isLocalInBasementView(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && !bm.localDeadInCellar);
  }

  function isSlideCutscene(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && (bm.stage === "DESCENDING" || bm.stage === "ASCENDING"));
  }

  function isRepairModalOpen(matchState) {
    const bm = matchState && matchState.basementEvent;
    return Boolean(bm && bm.active && bm.repairingBoxId);
  }

  function applyHostBreakerDelta(matchState, player, boxId, delta, isLocalHost) {
    const bm = matchState && matchState.basementEvent;
    if (!bm || !bm.active || bm.stage !== "PLAYING") return;
    const box = bm.breakers.find((b) => b.id === boxId);
    if (!box || box.fixed) return;

    box.progress = Math.min(1.0, (box.progress || 0) + Math.max(0, delta || 0));
    if (isLocalHost) {
      repairSparkTimer -= (delta || 0) * REPAIR_DURATION;
      if (repairSparkTimer <= 0) {
        repairSparkTimer = 0.24;
        if (App.Audio && App.Audio.electricRepairTick) App.Audio.electricRepairTick();
      }
      syncBreakerModalUI(bm);
    }

    if (box.progress >= 1.0) {
      box.fixed = true;
      bm.fixedCount = bm.breakers.filter((b) => b.fixed).length;
      const allDone = bm.fixedCount >= bm.breakers.length;
      if (App.Audio && App.Audio.breakerFixed) App.Audio.breakerFixed(allDone);
      if (bm.repairingBoxId === box.id) {
        syncBreakerModalUI(bm);
        bm.holdingRepairF = false;
      }
      if (isMpMode(matchState)) broadcastStateNow(matchState, { fixedBoxId: box.id });

      if (allDone) {
        setTimeout(() => {
          if (matchState.basementEvent && matchState.basementEvent.active) {
            startVictoryAscent(matchState.basementEvent, matchState, player);
            if (isMpMode(matchState)) broadcastStateNow(matchState);
          }
        }, 420);
      } else {
        bm.notice = `${box.label} REPAIRED (${bm.fixedCount}/5)!`;
        bm.noticeTimer = 3.0;
        if (bm.repairingBoxId === box.id) {
          setTimeout(() => {
            if (matchState.basementEvent && matchState.basementEvent.repairingBoxId === box.id) {
              closeBreakerModal(matchState, true);
            }
          }, 340);
        }
      }
    }
  }

  function broadcastStateNow(matchState, extra) {
    if (!matchState || !isMpMode(matchState) || !isMpHost(matchState)) return;
    const bm = matchState.basementEvent;
    if (!bm || !bm.active) return;
    App.Network.sendGameAction("MP_BASEMENT_STATE", Object.assign({
      stage: bm.stage,
      slideTimer: Math.round((bm.slideTimer || 0) * 10) / 10,
      preStartTimer: Math.round((bm.preStartTimer || 0) * 10) / 10,
      fixedCount: bm.fixedCount || 0,
      breakers: bm.breakers.map((b) => ({
        id: b.id,
        col: b.col,
        row: b.row,
        x: b.x,
        y: b.y,
        wall: b.wall,
        progress: Math.round((b.progress || 0) * 100) / 100,
        fixed: Boolean(b.fixed)
      })),
      monster: {
        active: Boolean(bm.monster.active),
        x: Math.round(bm.monster.x * 10) / 10,
        y: Math.round(bm.monster.y * 10) / 10,
        facing: bm.monster.facing,
        chasing: Boolean(bm.monster.chasing),
        frenzy: Boolean(bm.monster.frenzy)
      },
      notice: bm.notice || "",
      noticeTimer: bm.noticeTimer || 0
    }, extra || {}));
  }

  function handleNetworkMessage(action, payload, matchState, player) {
    if (!matchState || !action) return false;
    const p = payload || {};

    if (action === "MP_BASEMENT_REPAIR") {
      if (isMpHost(matchState) && p.boxId && typeof p.delta === "number") {
        applyHostBreakerDelta(matchState, player, p.boxId, p.delta, false);
      }
      return true;
    }

    if (action === "MP_BASEMENT_STATE") {
      if (!isMpGuest(matchState)) return true;
      if (!matchState.basementEvent) startBasementEvent(matchState, player);
      const bm = matchState.basementEvent;
      if (!bm) return true;

      const prevStage = bm.stage;
      bm.stage = p.stage || bm.stage;
      bm.slideTimer = typeof p.slideTimer === "number" ? p.slideTimer : bm.slideTimer;
      bm.preStartTimer = typeof p.preStartTimer === "number" ? p.preStartTimer : bm.preStartTimer;
      bm.fixedCount = typeof p.fixedCount === "number" ? p.fixedCount : bm.fixedCount;

      if (Array.isArray(p.breakers)) {
        p.breakers.forEach((nb) => {
          const loc = bm.breakers.find((x) => x.id === nb.id);
          if (!loc) return;
          if (typeof nb.x === "number") loc.x = nb.x;
          if (typeof nb.y === "number") loc.y = nb.y;
          if (typeof nb.col === "number") loc.col = nb.col;
          if (typeof nb.row === "number") loc.row = nb.row;
          const wasFixed = loc.fixed;
          loc.progress = Math.max(loc.progress || 0, nb.progress || 0);
          if (nb.fixed) {
            loc.progress = 1.0;
            loc.fixed = true;
            if (!wasFixed) {
              if (App.Audio && App.Audio.breakerFixed) App.Audio.breakerFixed(bm.fixedCount >= 5);
              if (bm.repairingBoxId === loc.id) {
                syncBreakerModalUI(bm);
                bm.holdingRepairF = false;
                setTimeout(() => {
                  if (matchState.basementEvent && matchState.basementEvent.repairingBoxId === loc.id) {
                    closeBreakerModal(matchState, true);
                  }
                }, 300);
              }
            }
          }
        });
        if (bm.repairingBoxId) syncBreakerModalUI(bm);
      }

      if (p.monster) Object.assign(bm.monster, p.monster);
      if (p.notice) { bm.notice = p.notice; bm.noticeTimer = p.noticeTimer || 2.5; }

      if (prevStage === "DESCENDING" && bm.stage === "PRE_START_5S" && !bm.localDeadInCellar) {
        finishDescentIntoBasement(bm, player);
      } else if (prevStage === "PRE_START_5S" && bm.stage === "PLAYING") {
        bm.monster.active = true;
        App.Audio.hexAlert();
      } else if (prevStage !== "ASCENDING" && bm.stage === "ASCENDING") {
        startVictoryAscent(bm, matchState, player);
      }
      return true;
    }
    return false;
  }

  function cleanup(matchState, opts) {
    if (App.Audio && App.Audio.stopBasementSlide) App.Audio.stopBasementSlide();
    if (App.Audio && App.Audio.stopChainsawLoop) App.Audio.stopChainsawLoop();
    document.getElementById("basement-breaker-modal")?.classList.add("hidden");
    if (App.Jumpscare && !(opts && opts.keepJumpscare)) App.Jumpscare.stop();
    if (matchState) matchState.basementEvent = null;
    activeLayout = null;
    staticMazeCanvas = null;
  }

  App.Basement = {
    startBasementEvent,
    onKeyFDown,
    onKeyFUp,
    closeBreakerModal,
    update,
    collidesInBasement,
    getShakeOffset,
    getPrompt,
    renderViewport,
    getHudSummary,
    forceEndFromNetwork,
    isActive,
    isLocalInBasementView,
    isInBasementMap,
    isSlideCutscene,
    isRepairModalOpen,
    isPlayerInAlcove,
    broadcastStateNow,
    handleNetworkMessage,
    cleanup
  };
})(window.Duskwood);
