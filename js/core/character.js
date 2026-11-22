/* ==========================================================================
   DUSKWOOD INN - Terraria-Style Pixel Character Sprite Renderer
   Reference Standard:
   - Side-profile 3/4 stance on a 20x26 logical pixel grid (character ~14x22)
   - Colored dark outlines (derived per material, not flat pure black)
   - Multi-tone pixel shading (highlight, base, shadow, outline)
   - Iconic 2px vertical Terraria eye (1px white sclera + 1px colored pupil)
   - Supports standing, walking, AND seated-at-table poses
   ========================================================================== */

window.Duskwood = window.Duskwood || {};

(function (App) {
  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return (
      "#" +
      [clamp(r), clamp(g), clamp(b)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  function makeRamp(baseHex) {
    const { r, g, b } = hexToRgb(baseHex);
    return {
      hi:   rgbToHex(r + (255 - r) * 0.28, g + (255 - g) * 0.24, b + (255 - b) * 0.16),
      base: baseHex,
      sh:   rgbToHex(r * 0.72, g * 0.68, b * 0.65),
      out:  rgbToHex(r * 0.30, g * 0.24, b * 0.20)
    };
  }

  function p(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Offscreen 20x26 pixel buffer (always drawn facing RIGHT, flipped if needed)
  const buf = document.createElement("canvas");
  buf.width = 20;
  buf.height = 26;
  const bctx = buf.getContext("2d");
  bctx.imageSmoothingEnabled = false;

  function drawLegsAndBoots(c, pants, shoes, walkPhase, seated, crouching) {
    if (seated) {
      // Bent knees tucked forward while seated in a Stardew wooden chair
      rect(c, 7, 17, 7, 3, pants.base);
      rect(c, 7, 17, 2, 3, pants.sh);
      rect(c, 10, 17, 4, 2, pants.hi);
      rect(c, 11, 19, 3, 2, pants.base);
      p(c, 14, 17, pants.out);
      p(c, 14, 18, pants.out);
      // Boots resting down below knee
      rect(c, 10, 20, 5, 3, shoes.out);
      rect(c, 11, 20, 3, 2, shoes.base);
      p(c, 11, 21, shoes.hi);
      return;
    }

    const frames = [
      [0, 0, 0, 0],
      [-1, 1, 0, -1],
      [0, 0, 0, 0],
      [1, -1, -1, 0]
    ];
    const [bx, fx, bfy, ffy] = frames[walkPhase];

    if (crouching) {
      const shift = walkPhase === 1 ? 1 : walkPhase === 3 ? -1 : 0;
      rect(c, 6, 18, 8, 3, pants.base);
      rect(c, 6, 18, 2, 3, pants.sh);
      rect(c, 10, 18, 3, 2, pants.hi);
      // Bent low crouch boots
      rect(c, 5 + shift, 20, 4, 3, shoes.out);
      rect(c, 6 + shift, 20, 2, 2, shoes.sh);
      rect(c, 10 - shift, 20, 5, 3, shoes.out);
      rect(c, 11 - shift, 20, 3, 2, shoes.base);
      p(c, 11 - shift, 21, shoes.hi);
      return;
    }

    // Pants upper pelvis
    rect(c, 7, 17, 6, 3, pants.base);
    rect(c, 7, 17, 2, 3, pants.sh);
    rect(c, 10, 17, 2, 2, pants.hi);
    p(c, 12, 17, pants.out);
    p(c, 12, 18, pants.out);
    p(c, 12, 19, pants.out);

    // Back leg + boot
    const backX = 6 + bx;
    rect(c, backX, 19, 3, 2, pants.sh);
    rect(c, backX, 20 + bfy, 4, 3, shoes.out);
    rect(c, backX + 1, 20 + bfy, 2, 2, shoes.sh);
    p(c, backX + 1, 21 + bfy, shoes.base);

    // Front leg + boot
    const frontX = 9 + fx;
    rect(c, frontX, 18, 3, 3, pants.base);
    p(c, frontX + 1, 18, pants.hi);
    p(c, frontX + 2, 19, pants.out);

    rect(c, frontX, 20 + ffy, 5, 3, shoes.out);
    rect(c, frontX + 1, 20 + ffy, 2, 2, shoes.base);
    p(c, frontX + 1, 21 + ffy, shoes.hi);
    p(c, frontX + 3, 21 + ffy, shoes.sh);
  }

  function drawTorsoAndOutfit(c, cfg, shirt, under, pants, bobY) {
    const y = 10 + bobY;

    rect(c, 6, y, 8, 7, shirt.base);
    rect(c, 5, y + 1, 1, 5, shirt.out);
    rect(c, 13, y + 1, 1, 5, shirt.out);
    rect(c, 7, y, 6, 1, shirt.sh);

    rect(c, 6, y + 1, 2, 5, shirt.hi);
    rect(c, 10, y + 2, 2, 4, shirt.hi);
    rect(c, 9, y + 2, 1, 5, shirt.sh);
    rect(c, 12, y + 2, 1, 5, shirt.sh);

    if (cfg.outfit === 1) {
      rect(c, 9, y + 1, 3, 6, under.base);
      p(c, 10, y + 2, under.hi);
      rect(c, 8, y + 1, 1, 6, shirt.out);
    } else if (cfg.outfit === 2) {
      rect(c, 6, y, 8, 2, shirt.out);
      rect(c, 7, y, 6, 1, under.hi);
      p(c, 10, y + 3, under.hi);
      p(c, 10, y + 5, under.hi);
    } else if (cfg.outfit === 3) {
      rect(c, 5, y - 1, 3, 2, shirt.sh);
      p(c, 5, y - 1, shirt.out);
      rect(c, 8, y + 4, 4, 2, shirt.sh);
      p(c, 10, y + 1, under.hi);
      p(c, 10, y + 2, under.hi);
    } else if (cfg.outfit === 4) {
      rect(c, 7, y + 2, 6, 1, under.base);
      rect(c, 7, y + 4, 6, 1, under.base);
      rect(c, 7, y + 6, 6, 1, shirt.sh);
    } else if (cfg.outfit === 5) {
      rect(c, 7, y + 4, 6, 3, pants.base);
      rect(c, 8, y + 1, 1, 3, pants.sh);
      rect(c, 11, y + 1, 1, 3, pants.base);
      p(c, 8, y + 4, "#e3c068");
      p(c, 11, y + 4, "#e3c068");
    }
  }

  function drawArms(c, skin, shirt, walkPhase, bobY, holdingLantern, timeSec, seated) {
    const y = 11 + bobY;
    const swing = seated ? 0 : walkPhase === 1 ? 1 : walkPhase === 3 ? -1 : 0;

    // Far (front-right) arm reaching toward table when seated or holding lantern
    const fx = 13 + (holdingLantern || seated ? 1 : -swing);
    const fy = y + (seated ? 2 : 3) + (holdingLantern ? -1 : 0);
    rect(c, fx, fy, 2, 3, skin.out);
    p(c, fx, fy + 1, skin.base);
    p(c, fx, fy, skin.hi);

    if (holdingLantern && !seated) {
      const lx = fx + 1;
      const ly = fy + 1;
      const pulse = Math.sin(timeSec * 9) > -0.2;
      p(c, lx + 1, ly - 1, "#8d99a8");
      rect(c, lx, ly, 3, 1, "#4e5661");
      rect(c, lx, ly + 1, 3, 3, "#2a2e36");
      p(c, lx + 1, ly + 1, pulse ? "#fff4bd" : "#f5c663");
      p(c, lx + 1, ly + 2, "#f0a93e");
      rect(c, lx, ly + 4, 3, 1, "#4e5661");
    }

    // Near (left) arm
    const nx = seated ? 7 : 5 + swing;
    rect(c, nx, y, 3, 4, shirt.out);
    rect(c, nx + 1, y, 2, 4, shirt.hi);
    p(c, nx + 2, y + 2, shirt.base);

    const handX = seated ? nx + 2 : nx;
    const handY = seated ? y + 3 : y + 4;
    rect(c, handX, handY, 4, 3, skin.out);
    rect(c, handX + 1, handY, 2, 2, skin.base);
    p(c, handX + 1, handY, skin.sh);
    p(c, handX + 1, handY + 1, skin.hi);
  }

  function drawHeadAndFace(c, skin, eyeHex, bobY, isBlinking) {
    const y = 4 + bobY;

    rect(c, 7, y + 1, 6, 5, skin.base);
    rect(c, 8, y + 4, 4, 2, skin.base);

    p(c, 7, y + 4, skin.sh);
    p(c, 8, y + 5, skin.sh);
    p(c, 12, y + 4, skin.hi);

    p(c, 13, y + 4, skin.out);
    p(c, 12, y + 5, skin.out);

    rect(c, 8, y + 6, 4, 1, skin.out);
    p(c, 7, y + 5, skin.out);

    if (isBlinking) {
      p(c, 10, y + 3, skin.sh);
      p(c, 11, y + 3, skin.out);
    } else {
      p(c, 10, y + 2, "#ffffff");
      p(c, 10, y + 3, "#ffffff");
      p(c, 11, y + 2, eyeHex);
      p(c, 11, y + 3, eyeHex);
    }
  }

  function drawHair(c, style, hair, bobY) {
    const y = 1 + bobY;

    if (style === 0) {
      rect(c, 8, y, 2, 1, hair.out);
      rect(c, 11, y, 2, 1, hair.out);
      rect(c, 6, y + 1, 9, 1, hair.out);
      rect(c, 5, y + 2, 11, 1, hair.out);
      rect(c, 4, y + 3, 12, 3, hair.out);
      rect(c, 5, y + 6, 3, 3, hair.out);
      rect(c, 14, y + 5, 2, 2, hair.out);

      rect(c, 6, y + 2, 8, 3, hair.base);
      rect(c, 5, y + 3, 10, 2, hair.base);
      rect(c, 6, y + 5, 3, 2, hair.base);

      p(c, 9, y + 1, hair.hi);
      p(c, 12, y + 1, hair.hi);
      rect(c, 7, y + 2, 3, 1, hair.hi);
      rect(c, 11, y + 2, 3, 1, hair.hi);
      p(c, 14, y + 3, hair.hi);
      p(c, 8, y + 3, hair.hi);

      rect(c, 7, y + 4, 3, 1, hair.sh);
      rect(c, 11, y + 4, 3, 1, hair.sh);
      p(c, 9, y + 5, hair.out);
      p(c, 13, y + 5, hair.sh);
      p(c, 14, y + 4, hair.base);
      p(c, 15, y + 4, hair.sh);
      p(c, 6, y + 7, hair.sh);
      p(c, 7, y + 6, hair.sh);
      return;
    }

    if (style === 1) {
      p(c, 7, y, hair.out); p(c, 10, y - 1, hair.out); p(c, 13, y, hair.out);
      rect(c, 6, y + 1, 9, 4, hair.out);
      rect(c, 5, y + 3, 3, 5, hair.out);
      rect(c, 7, y + 1, 7, 3, hair.base);
      p(c, 10, y, hair.hi); p(c, 8, y + 2, hair.hi); p(c, 12, y + 2, hair.hi);
      rect(c, 6, y + 4, 8, 1, hair.sh);
      rect(c, 6, y + 5, 2, 3, hair.sh);
      return;
    }

    if (style === 2) {
      rect(c, 6, y + 1, 9, 4, hair.out);
      rect(c, 5, y + 3, 3, 6, hair.out);
      rect(c, 7, y + 2, 7, 2, hair.base);
      rect(c, 8, y + 2, 4, 1, hair.hi);
      rect(c, 10, y + 4, 5, 2, hair.sh);
      p(c, 14, y + 5, hair.out);
      rect(c, 6, y + 4, 2, 4, hair.base);
      return;
    }

    if (style === 3) {
      rect(c, 6, y + 1, 9, 4, hair.out);
      rect(c, 4, y + 3, 4, 10, hair.out);
      rect(c, 7, y + 2, 7, 2, hair.base);
      rect(c, 8, y + 2, 5, 1, hair.hi);
      rect(c, 5, y + 4, 3, 8, hair.base);
      rect(c, 5, y + 5, 1, 6, hair.sh);
      p(c, 7, y + 5, hair.hi);
      rect(c, 10, y + 4, 4, 1, hair.sh);
      return;
    }

    if (style === 4) {
      rect(c, 7, y + 1, 7, 3, hair.out);
      rect(c, 6, y + 2, 2, 4, hair.out);
      rect(c, 8, y + 2, 5, 2, hair.base);
      rect(c, 9, y + 2, 3, 1, hair.hi);
      rect(c, 7, y + 3, 6, 1, hair.sh);
      return;
    }

    if (style === 5) {
      rect(c, 6, y + 1, 8, 4, hair.out);
      rect(c, 3, y + 4, 3, 6, hair.out);
      rect(c, 7, y + 2, 6, 2, hair.base);
      rect(c, 8, y + 2, 4, 1, hair.hi);
      rect(c, 4, y + 5, 2, 4, hair.base);
      p(c, 5, y + 5, "#d84858");
      rect(c, 7, y + 4, 6, 1, hair.sh);
      return;
    }

    if (style === 6) {
      rect(c, 5, y + 1, 10, 5, hair.out);
      rect(c, 4, y + 2, 12, 3, hair.out);
      rect(c, 6, y + 2, 8, 3, hair.base);
      p(c, 7, y + 1, hair.hi); p(c, 10, y + 1, hair.hi); p(c, 13, y + 2, hair.hi);
      p(c, 6, y + 3, hair.hi); p(c, 9, y + 3, hair.sh); p(c, 12, y + 3, hair.hi);
      rect(c, 5, y + 5, 3, 3, hair.sh);
      return;
    }

    rect(c, 6, y + 1, 9, 4, hair.out);
    rect(c, 5, y + 3, 3, 4, hair.out);
    rect(c, 7, y + 2, 7, 2, hair.base);
    rect(c, 7, y + 2, 3, 1, hair.hi);
    p(c, 10, y + 2, hair.out);
    rect(c, 11, y + 2, 3, 1, hair.hi);
    rect(c, 6, y + 4, 2, 2, hair.sh);
  }

  function drawAccessory(c, accessoryIdx, bobY) {
    const y = 4 + bobY;
    if (accessoryIdx === 1) {
      rect(c, 9, y + 1, 4, 1, "#c8d2e0");
      p(c, 9, y + 2, "#8f9aa8");
      p(c, 12, y + 2, "#8f9aa8");
      rect(c, 9, y + 4, 4, 1, "#8f9aa8");
    } else if (accessoryIdx === 2) {
      rect(c, 6, y + 6, 8, 2, "#9c323e");
      rect(c, 7, y + 6, 6, 1, "#cc4b58");
      rect(c, 6, y + 8, 2, 3, "#7a232e");
    } else if (accessoryIdx === 3) {
      rect(c, 6, y - 3, 8, 4, "#3b4352");
      rect(c, 7, y - 3, 6, 2, "#596478");
      rect(c, 5, y, 10, 2, "#272c36");
      rect(c, 6, y, 8, 1, "#8a96ab");
    } else if (accessoryIdx === 4) {
      rect(c, 7, y - 4, 6, 3, "#543b28");
      rect(c, 8, y - 3, 4, 1, "#78573d");
      rect(c, 4, y - 1, 12, 2, "#362417");
      rect(c, 5, y - 1, 10, 1, "#6b4c33");
    } else if (accessoryIdx === 5) {
      rect(c, 6, y, 8, 2, "#8c2b36");
      rect(c, 7, y, 6, 1, "#c43f4d");
      p(c, 4, y + 1, "#8c2b36");
      p(c, 5, y + 1, "#611c24");
    }
  }

  function paintBuffer(charConfig, timeSec, opts) {
    const pal = App.Config.PALETTES;
    const skin  = makeRamp(pal.skin[charConfig.skin]?.base || pal.skin[0].base);
    const hair  = makeRamp(pal.hair[charConfig.hairColor]?.base || pal.hair[0].base);
    const eye   = pal.eye[charConfig.eyeColor]?.base || pal.eye[0].base;
    const shirt = makeRamp(pal.shirt[charConfig.shirtColor]?.base || pal.shirt[0].base);
    const under = makeRamp(pal.undershirt[charConfig.underColor]?.base || pal.undershirt[0].base);
    const pants = makeRamp(pal.pants[charConfig.pantsColor]?.base || pal.pants[0].base);
    const shoes = makeRamp(pal.shoes[charConfig.shoeColor]?.base || pal.shoes[0].base);

    const seated = Boolean(opts && opts.seated);
    const crouching = !seated && Boolean(opts && opts.crouching);
    const isWalking = !seated && Boolean(charConfig.walking);
    const speed = opts && opts.sprinting ? 10.5 : crouching ? 4.6 : 6.8;
    const walkPhase = isWalking ? Math.floor(timeSec * speed) % 4 : 0;
    const crouchDrop = crouching ? 2 : 0;
    const bobY = (isWalking
      ? (walkPhase === 1 || walkPhase === 3 ? -1 : 0)
      : (Math.sin(timeSec * 2.4) > 0.78 ? 1 : 0)) + crouchDrop;

    const blinkCycle = timeSec % 4.2;
    const isBlinking = blinkCycle > 4.05;

    bctx.clearRect(0, 0, 20, 26);

    if (!(opts && opts.hideShadow)) {
      bctx.fillStyle = "rgba(0, 0, 0, 0.36)";
      bctx.fillRect(5, 23, 10, 2);
    }

    drawLegsAndBoots(bctx, pants, shoes, walkPhase, seated, crouching);
    drawTorsoAndOutfit(bctx, charConfig, shirt, under, pants, bobY);
    drawHeadAndFace(bctx, skin, eye, bobY, isBlinking);
    drawHair(bctx, charConfig.hairStyle, hair, bobY);
    drawAccessory(bctx, charConfig.accessory, bobY);
    drawArms(
      bctx,
      skin,
      shirt,
      walkPhase,
      bobY,
      Boolean(charConfig.lantern && !(opts && opts.hideLantern)),
      timeSec,
      seated
    );
  }

  function renderToCanvas(targetCanvas, charConfig, timeSec, opts) {
    if (!targetCanvas) return;
    const tctx = targetCanvas.getContext("2d");
    tctx.imageSmoothingEnabled = false;
    tctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    paintBuffer(charConfig, timeSec, opts);

    if (charConfig.lantern && !(opts && opts.hideLantern) && !(opts && opts.seated)) {
      const glowX =
        charConfig.facing === 1
          ? targetCanvas.width * 0.78
          : targetCanvas.width * 0.22;
      const glowY = targetCanvas.height * 0.62;
      const rad = targetCanvas.width * 0.38;
      const flick = 0.26 + Math.sin(timeSec * 8.5) * 0.05;
      const grad = tctx.createRadialGradient(glowX, glowY, 2, glowX, glowY, rad);
      grad.addColorStop(0, `rgba(255, 214, 120, ${flick})`);
      grad.addColorStop(1, "rgba(255, 190, 90, 0)");
      tctx.fillStyle = grad;
      tctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    }

    const scale = Math.max(
      1,
      Math.floor(Math.min(targetCanvas.width / 20, targetCanvas.height / 26))
    );
    const drawW = 20 * scale;
    const drawH = 26 * scale;
    const dx = Math.floor((targetCanvas.width - drawW) / 2);
    const dy = Math.floor((targetCanvas.height - drawH) / 2);

    tctx.save();
    if (charConfig.facing === -1) {
      tctx.translate(targetCanvas.width, 0);
      tctx.scale(-1, 1);
    }
    tctx.drawImage(buf, dx, dy, drawW, drawH);
    tctx.restore();
  }

  // Draw character directly into the 2D Stardew pixel world at feet anchor (footX, footY)
  function drawInWorld(worldCtx, footX, footY, charConfig, timeSec, opts) {
    paintBuffer(charConfig, timeSec, opts);
    const dx = Math.round(footX - 10);
    const dy = Math.round(footY - 23);

    worldCtx.save();
    if (charConfig.facing === -1) {
      worldCtx.translate(Math.round(footX * 2), 0);
      worldCtx.scale(-1, 1);
      worldCtx.drawImage(buf, Math.round(footX - 10), dy);
    } else {
      worldCtx.drawImage(buf, dx, dy);
    }
    worldCtx.restore();
  }


  // Draws a player-lookalike NPC (or player facing corner) seen from BEHIND.
  // When opts.headTwisted is true (Cutting Corners triggered!), body stays facing wall
  // while head twists 180 deg backward with glowing white eyes & wide uncanny grin!
  function drawBackCornerInWorld(worldCtx, footX, footY, charConfig, timeSec, opts) {
    const headTwisted = Boolean(opts && opts.headTwisted);
    const pal = App.Config.PALETTES;
    const skin  = makeRamp(pal.skin[charConfig.skin]?.base || pal.skin[0].base);
    const hair  = makeRamp(pal.hair[charConfig.hairColor]?.base || pal.hair[0].base);
    const shirt = makeRamp(pal.shirt[charConfig.shirtColor]?.base || pal.shirt[0].base);
    const under = makeRamp(pal.undershirt[charConfig.underColor]?.base || pal.undershirt[0].base);
    const pants = makeRamp(pal.pants[charConfig.pantsColor]?.base || pal.pants[0].base);
    const shoes = makeRamp(pal.shoes[charConfig.shoeColor]?.base || pal.shoes[0].base);

    // Very slow, eerie breathing micro-shift (otherwise completely motionless!)
    const bobY = Math.sin(timeSec * 1.45) > 0.86 ? 1 : 0;

    bctx.clearRect(0, 0, 20, 26);

    // Floor contact shadow tucked tight against the corner
    bctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    bctx.fillRect(5, 22, 10, 3);

    // Boots (back of heels facing the room)
    rect(bctx, 6, 20, 4, 3, shoes.out);
    rect(bctx, 7, 20, 2, 2, shoes.sh);
    rect(bctx, 10, 20, 4, 3, shoes.out);
    rect(bctx, 11, 20, 2, 2, shoes.base);

    // Pants (back of legs standing straight & stiff)
    rect(bctx, 6, 17, 8, 3, pants.base);
    rect(bctx, 6, 17, 1, 3, pants.out);
    rect(bctx, 13, 17, 1, 3, pants.out);
    rect(bctx, 9, 18, 2, 2, pants.sh);
    rect(bctx, 7, 17, 2, 2, pants.sh);

    // Back of Torso / Jacket / Outfit (angled slightly toward the NE corner)
    const ty = 10 + bobY;
    rect(bctx, 6, ty, 8, 7, shirt.base);
    rect(bctx, 5, ty + 1, 1, 5, shirt.out);
    rect(bctx, 14, ty + 1, 1, 5, shirt.out);
    rect(bctx, 7, ty, 6, 1, shirt.sh);
    rect(bctx, 7, ty + 1, 3, 5, shirt.sh);   // Left back shadow
    rect(bctx, 11, ty + 1, 2, 5, shirt.hi);  // Subtle shoulder highlight
    if (charConfig.outfit === 3) {
      // Back of hoodie hood resting on upper back
      rect(bctx, 6, ty - 1, 8, 3, shirt.sh);
      rect(bctx, 7, ty, 6, 1, shirt.out);
    } else if (charConfig.outfit === 4) {
      rect(bctx, 6, ty + 2, 8, 1, under.base);
      rect(bctx, 6, ty + 4, 8, 1, under.base);
    } else if (charConfig.outfit === 5) {
      // Overalls X-straps on back
      rect(bctx, 6, ty + 4, 8, 3, pants.base);
      p(bctx, 7, ty + 1, pants.sh); p(bctx, 8, ty + 2, pants.sh);
      p(bctx, 12, ty + 1, pants.base); p(bctx, 11, ty + 2, pants.base);
      rect(bctx, 9, ty + 3, 2, 1, pants.base);
    }

    // Both Arms hanging straight, rigid & motionless at sides (creepy!)
    rect(bctx, 4, ty + 1, 2, 5, shirt.out);
    rect(bctx, 5, ty + 1, 1, 4, shirt.sh);
    rect(bctx, 4, ty + 6, 2, 2, skin.out);
    p(bctx, 5, ty + 6, skin.sh);

    rect(bctx, 14, ty + 1, 2, 5, shirt.out);
    rect(bctx, 14, ty + 1, 1, 4, shirt.base);
    rect(bctx, 14, ty + 6, 2, 2, skin.out);
    p(bctx, 14, ty + 6, skin.base);

    // Back of Neck (tiny skin sliver below hairline — ZERO eyes/face visible!)
    const hy = 3 + bobY;
    rect(bctx, 8, hy + 6, 4, 1, skin.sh);
    p(bctx, 7, hy + 6, skin.out);
    p(bctx, 12, hy + 6, skin.out);

    if (headTwisted) {
      // TWISTED 180-DEGREE UNCANNY FACE LOOKING STRAIGHT BACK AT PLAYER (image_715622.png!)
      rect(bctx, 6, hy, 8, 7, "#120c0c");
      rect(bctx, 7, hy, 6, 2, hair.out);
      rect(bctx, 7, hy + 2, 6, 5, "#2b1c1c"); // Dark shadowed face
      // Glowing hollow white eyes staring straight out
      p(bctx, 8, hy + 3, "#ffffff");
      p(bctx, 11, hy + 3, "#ffffff");
      // Creepy wide toothy grin across lower face
      rect(bctx, 8, hy + 5, 4, 1, "#e8dec8");
      p(bctx, 7, hy + 5, "#856e62");
      p(bctx, 12, hy + 5, "#856e62");
    } else {
      // Full Back of Head & Hair facing away into the wall corner!
      rect(bctx, 6, hy, 8, 7, hair.out);
      rect(bctx, 5, hy + 1, 10, 5, hair.out);
      rect(bctx, 7, hy + 1, 6, 5, hair.base);
      rect(bctx, 6, hy + 2, 8, 3, hair.base);
      // Hair back shading & crown highlight
      rect(bctx, 8, hy + 1, 4, 1, hair.hi);
      rect(bctx, 7, hy + 4, 6, 2, hair.sh);
      p(bctx, 9, hy + 2, hair.hi);
      p(bctx, 11, hy + 2, hair.hi);
    }

    // Extra back hair lengths for Long Flow (3) / Ponytail (5) / Curly Mop (6)
    if (charConfig.hairStyle === 3) {
      rect(bctx, 5, hy + 6, 10, 5, hair.out);
      rect(bctx, 6, hy + 6, 8, 4, hair.base);
      rect(bctx, 7, hy + 8, 6, 2, hair.sh);
    } else if (charConfig.hairStyle === 5) {
      rect(bctx, 9, hy + 6, 3, 5, hair.out);
      rect(bctx, 10, hy + 7, 1, 3, hair.base);
      rect(bctx, 9, hy + 6, 3, 1, "#d84858"); // Hair tie seen from behind!
    } else if (charConfig.hairStyle === 6) {
      rect(bctx, 4, hy + 1, 12, 5, hair.out);
      rect(bctx, 5, hy + 2, 10, 3, hair.base);
    }

    // Back view of wearable hats / scarf / bandana
    if (charConfig.accessory === 2) {
      rect(bctx, 6, hy + 6, 8, 2, "#9c323e");
      rect(bctx, 9, hy + 8, 2, 3, "#7a232e");
    } else if (charConfig.accessory === 3) {
      rect(bctx, 6, hy - 2, 8, 4, "#3b4352");
      rect(bctx, 5, hy + 1, 10, 2, "#272c36");
    } else if (charConfig.accessory === 4) {
      rect(bctx, 7, hy - 3, 6, 3, "#543b28");
      rect(bctx, 4, hy, 12, 2, "#362417");
    } else if (charConfig.accessory === 5) {
      rect(bctx, 6, hy + 1, 8, 2, "#8c2b36");
      p(bctx, 9, hy + 3, "#611c24"); p(bctx, 11, hy + 3, "#8c2b36");
    }

    const dx = Math.round(footX - 10);
    const dy = Math.round(footY - 23);
    worldCtx.drawImage(buf, dx, dy);
  }

  App.Character = { renderToCanvas, drawInWorld, drawBackCornerInWorld };
})(window.Duskwood);
