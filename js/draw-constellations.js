// ── constellation discovery state ─────────────────────────────────────────────

let revealAnims = {};     // { [name]: startT }
let successAnims = {};    // { [name]: startT } – expanding ring burst on discovery
let constParticles = [];  // screen-space sparkles spawned on discovery
let auroraState = null;   // { startT } – all-found aurora
let allFoundDone = false;

const DISC_ZOOM_MIN = 1.5;

// Returns the screen-space bounding radius of a constellation at the current zoom.
// Used by both the renderer and click-detection so the hit area matches exactly.
function _constMaxR(c) {
  return (c.type === 'louisa' ? 252 : c.type === 'lily' ? 115 : c.type === 'moon' ? 112 : c.type === 'butterfly' ? 90 : 105)
    * CONST_SCALE * c.size * zoomLevel + 20;
}

function discoverConstellation(name, t, screenX, screenY) {
  if (discoveredSet.has(name)) return;
  discoveredSet.add(name);
  saveDiscovered();

  // Flash HUD
  const el = hudEl[name];
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('found', 'flash');

  // Reveal + success animations
  revealAnims[name]  = t;
  successAnims[name] = t;

  // Particle burst from constellation center (screen-space)
  const isLily      = name === 'lily';
  const isMoon      = name === 'moon';
  const isKiss      = name === 'kiss';
  const isButterfly = name === 'butterfly';
  const rgb1 = isLily      ? '255,140,200'
             : isMoon      ? '225,15,15'
             : isKiss      ? '255,120,145'
             : isButterfly ? '200,120,255'
             : name === 'heart' ? '255,160,180'
             : '180,210,255';
  const rgb2 = isMoon      ? '255,72,22'
             : isButterfly ? '240,200,255'
             : '255,240,180';
  const rgb3 = isMoon ? '180,0,0' : null;
  const count    = isMoon ? 60  : 28;
  const minSpeed = isMoon ? 80  : 55;
  const maxSpeed = isMoon ? 185 : 110;
  const minSize  = isMoon ? 2.2 : 1.5;
  const maxSize  = isMoon ? 4.2 : 2.5;
  const maxLife  = isMoon ? 1.4 : 0.9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    const roll  = Math.random();
    const rgb   = rgb3 && roll < 0.25 ? rgb3 : roll < 0.6 ? rgb1 : rgb2;
    constParticles.push({
      x: screenX, y: screenY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      born: t, life: 0.7 + Math.random() * maxLife,
      size: minSize + Math.random() * (maxSize - minSize),
      rgb,
    });
  }

  playChime();
  _trigger('nudge');

  if (discoveredSet.size === 7 && !allFoundDone) {
    allFoundDone = true;
    auroraState  = { startT: t + 0.5 };
    setTimeout(playAllFoundChime, 600);
  }
}

// Called from handleGameClick: discover a constellation by clicking anywhere within its bounds.
function tryDiscover(cx, cy) {
  if (nukeMode) return false;
  if (zoomLevel < DISC_ZOOM_MIN) return false;
  const t = performance.now() * 0.001;
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const hw = W * 0.5, hh = H * 0.5;

  for (const c of constellations) {
    if (discoveredSet.has(c.type)) continue;
    const bx = ((c.sx * ww - panX * c.depth + cam.x * c.depth) % ww + ww) % ww;
    const by = ((c.sy * wh - panY * c.depth + cam.y * c.depth) % wh + wh) % wh;
    const kx = Math.round((hw - bx) / ww);
    const ky = Math.round((hh - by) / wh);
    const [scx, scy] = worldToScreen(bx + kx * ww, by + ky * wh);
    if (Math.hypot(cx - scx, cy - scy) > _constMaxR(c)) continue;
    discoverConstellation(c.type, t, scx, scy);
    return true;
  }
  return false;
}

function drawConstellations(t) {
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const hw = W * 0.5, hh = H * 0.5;
  const seismActive = seisms.length > 0;
  _constStarPositions = []; // reset cache each frame

  for (const c of constellations) {
    const isDisc  = discoveredSet.has(c.type);

    // Zoom-based base opacity (nuked dimming is applied per-tile in the inner loop)
    let baseOpacity;
    if (isDisc) {
      baseOpacity = Math.max(0.28, Math.min(1.0, (zoomLevel - 1.0) / 0.5));
    } else {
      baseOpacity = Math.max(0.0,  Math.min(1.0, (zoomLevel - 0.6) / 0.6));
    }

    // Reveal animation boost
    if (revealAnims[c.type] !== undefined) {
      const ra = t - revealAnims[c.type];
      if (ra < 2.5) {
        baseOpacity = Math.min(1.0, baseOpacity + Math.exp(-ra * 1.8) * 2.0);
      } else {
        delete revealAnims[c.type];
      }
    }

    const sc   = CONST_SCALE * c.size;
    const maxR = _constMaxR(c);

    // Per-type colors — computed once per constellation, not per tile
    const isLily      = c.type === 'lily';
    const isMoon      = c.type === 'moon';
    const isKiss      = c.type === 'kiss';
    const isButterfly = c.type === 'butterfly';
    const isHeart = c.type === 'heart';
    const isShark = c.type === 'shark';
    const hintRgb = isMoon      ? '220,18,18'
                  : isLily      ? '255,130,185'
                  : isKiss      ? '255,110,140'
                  : isButterfly ? '190,120,255'
                  : isHeart     ? '255,140,170'
                  : isShark     ? '30,195,225'
                  : '180,210,255';
    const ringRgb = isLily      ? '255,140,200'
                  : isHeart     ? '255,160,180'
                  : isMoon      ? '220,18,18'
                  : isKiss      ? '255,120,145'
                  : isButterfly ? '200,130,255'
                  : isShark     ? '60,205,235'
                  : '180,220,255';
    const lineBloom = isLily      ? '255,130,195'
                    : isMoon      ? '200,30,20'
                    : isKiss      ? '255,110,140'
                    : isButterfly ? '185,110,255'
                    : isHeart     ? '255,130,165'
                    : isShark     ? '30,185,215'
                    : '180,210,255';
    const lineCore  = isLily      ? '255,225,240'
                    : isMoon      ? '255,110,90'
                    : isKiss      ? '255,210,220'
                    : isButterfly ? '230,210,255'
                    : isHeart     ? '255,215,228'
                    : isShark     ? '180,240,255'
                    : '180,205,255';

    const bx = ((c.sx * ww - panX * c.depth + cam.x * c.depth) % ww + ww) % ww;
    const by = ((c.sy * wh - panY * c.depth + cam.y * c.depth) % wh + wh) % wh;

    const kx0 = Math.floor((hw - hw / zoomLevel - maxR - bx) / ww);
    const kx1 = Math.floor((hw + hw / zoomLevel + maxR - bx) / ww);
    const ky0 = Math.floor((hh - hh / zoomLevel - maxR - by) / wh);
    const ky1 = Math.floor((hh + hh / zoomLevel + maxR - by) / wh);

    for (let ky = ky0; ky <= ky1; ky++) {
      for (let kx = kx0; kx <= kx1; kx++) {
        const cx = bx + kx * ww, cy = by + ky * wh;
        // Per-tile nuked dimming — only the destroyed tile goes dim
        const isTileNuked = _isTileNuked(c, kx, ky);
        const opacityMult = isTileNuked ? Math.max(0.15, baseOpacity * 0.20) : baseOpacity;

        // Proximity hint ring (drawn even when constellation is barely visible)
        if (!isDisc) {
          const [scx, scy] = worldToScreen(cx, cy);
          const distCenter = Math.hypot(scx - hw, scy - hh);
          const hintMax = 1.5 * Math.min(hw, hh);
          if (distCenter < hintMax) {
            const strength = Math.max(0, 1 - distCenter / hintMax);
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.1 * Math.PI * 2);
            const ringA = strength * (0.035 + 0.025 * pulse);
            const ringR = maxR * 0.35 * (1 + 0.04 * pulse);
            ctx.save();
            ctx.strokeStyle = `rgba(${hintRgb},${ringA.toFixed(3)})`;
            ctx.lineWidth   = 1.2;
            ctx.setLineDash([5, 9]);
            ctx.beginPath();
            ctx.arc(scx, scy, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }

        // Success animation: expanding rings + label (drawn regardless of opacityMult)
        if (successAnims[c.type] !== undefined) {
          const sa = t - successAnims[c.type];
          if (sa < 2.2) {
            const [scx2, scy2] = worldToScreen(cx, cy);
            // 3 staggered expanding rings
            for (let ring = 0; ring < 3; ring++) {
              const delay = ring * 0.18;
              const age   = sa - delay;
              if (age <= 0) continue;
              const prog  = Math.min(age / 1.4, 1);
              const ringR = prog * maxR * 1.1;
              const ringA = (1 - prog) * (0.7 - ring * 0.15);
              ctx.save();
              ctx.strokeStyle = `rgba(${ringRgb},${ringA.toFixed(2)})`;
              ctx.lineWidth   = 2.5 * (1 - prog * 0.6);
              ctx.shadowColor = `rgba(${ringRgb},0.6)`;
              ctx.shadowBlur  = 12;
              ctx.beginPath();
              ctx.arc(scx2, scy2, ringR, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
            // "Found" label fades in then out
            const labelA = Math.min(1, sa / 0.3) * Math.max(0, 1 - (sa - 1.4) / 0.6);
            if (labelA > 0.01) {
              ctx.save();
              ctx.globalAlpha  = labelA;
              ctx.font         = `${Math.round(13 * Math.min(zoomLevel, 2))}px Georgia, serif`;
              ctx.textAlign    = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle    = `rgba(${ringRgb},0.95)`;
              ctx.shadowColor  = `rgba(${ringRgb},0.8)`;
              ctx.shadowBlur   = 14;
              ctx.fillText('✦  trouvée !', scx2, scy2 - maxR * 0.55);
              ctx.restore();
            }
          } else {
            delete successAnims[c.type];
          }
        }

        // Skip drawing stars/lines if invisible
        if (opacityMult < 0.01) continue;

        // Pre-compute screen positions with seism + nuke-blast displacement
        const pts = c.stars.map(s => {
          let wx = cx + s.x * sc, wy = cy + s.y * sc;
          if (seismActive) {
            const [ddx, ddy] = seismDisp(wx, wy, c.depth, t);
            wx += ddx; wy += ddy;
          }
          let [spx, spy] = worldToScreen(wx, wy);
          if (nukeBlasts.length) {
            const [ndx, ndy] = nukeBlastDisp(spx, spy, t);
            spx += ndx; spy += ndy;
          }
          // Cache for hit-testing (kx, ky identify the tile for per-tile nuking)
          _constStarPositions.push({ sx: spx, sy: spy, type: c.type, kx, ky });
          return [spx, spy];
        });

        // Lines breathe slowly
        const breathe    = 0.82 + 0.18 * Math.sin(t * 0.28 * Math.PI * 2 + c.sx * Math.PI * 2);
        const coreAlpha  = Math.min(0.38, 0.14 + 0.10 * zoomLevel) * breathe * opacityMult;
        const bloomAlpha = coreAlpha * 0.25;
        ctx.lineCap = 'round';

        for (const pass of [
          { width: 5.5, alpha: bloomAlpha, rgb: lineBloom },
          { width: 1.1, alpha: coreAlpha,  rgb: lineCore  },
        ]) {
          ctx.strokeStyle = `rgba(${pass.rgb},${pass.alpha.toFixed(3)})`;
          ctx.lineWidth = pass.width;
          ctx.beginPath();
          for (const [a, b] of c.lines) {
            ctx.moveTo(pts[a][0], pts[a][1]);
            ctx.lineTo(pts[b][0], pts[b][1]);
          }
          ctx.stroke();
        }

        // Stars
        const za = Math.min(0.95, 0.62 + 0.22 * Math.min(zoomLevel, 2)) * opacityMult;
        for (let i = 0; i < c.stars.length; i++) {
          const star = c.stars[i];
          const [px, py] = pts[i];
          const pulse = Math.sin(t * star.freq * Math.PI * 2 + star.phase);
          const amp   = (isLily      && star.col === 'fuchsia')
                     || (isMoon      && star.col === 'blood')
                     || (isButterfly && star.col === 'violet')
                       ? 0.32 : 0.14;
          const pa    = 1 + amp * pulse;
          const r = Math.max(2.0, 2.8 * Math.min(zoomLevel, 3) * 0.55) * star.b * (1 + 0.07 * pulse);
          const a = Math.min(0.98, za * star.b * pa);

          let haloRgb, coreRgb, haloFade;
          if (isLily) {
            if      (star.col === 'fuchsia') { haloRgb='255,20,148';  coreRgb='255,90,178';  haloFade='220,0,120'; }
            else if (star.col === 'pink')    { haloRgb='255,130,185'; coreRgb='255,205,228'; haloFade='230,80,150'; }
            else                             { haloRgb='250,215,235'; coreRgb='255,245,252'; haloFade='230,180,220'; }
          } else if (isMoon) {
            if      (star.col === 'blood')   { haloRgb='225,15,15';   coreRgb='255,65,55';   haloFade='175,0,0';   }
            else if (star.col === 'ember')   { haloRgb='235,80,18';   coreRgb='255,145,75';  haloFade='190,38,5';  }
            else if (star.col === 'halo')    { haloRgb='155,10,65';   coreRgb='200,50,100';  haloFade='118,0,48';  }
            else                             { haloRgb='255,135,115'; coreRgb='255,218,205'; haloFade='225,82,65'; }
          } else if (isKiss) {
            if (star.col === 'rose') { haloRgb='255,80,120';  coreRgb='255,190,205'; haloFade='220,50,90'; }
            else                     { haloRgb='255,155,172'; coreRgb='255,225,230'; haloFade='230,120,145'; }
          } else if (isButterfly) {
            if      (star.col === 'violet') { haloRgb='200,100,255'; coreRgb='230,190,255'; haloFade='160,60,230'; }
            else if (star.col === 'purple') { haloRgb='160,80,220';  coreRgb='210,170,255'; haloFade='120,50,185'; }
            else                            { haloRgb='205,165,255'; coreRgb='235,220,255'; haloFade='175,140,230'; }
          } else if (isHeart) {
            haloRgb='255,140,170'; coreRgb='255,215,228'; haloFade='220,90,130';
          } else if (isShark) {
            if (star.col === 'teal')  { haloRgb='30,195,225';  coreRgb='180,240,255'; haloFade='10,145,185'; }
            else if (star.col === 'white') { haloRgb='200,240,255'; coreRgb='240,252,255'; haloFade='160,220,240'; }
            else                      { haloRgb='70,200,230';  coreRgb='190,242,255'; haloFade='40,160,200'; }
          } else {
            haloRgb='190,215,255'; coreRgb='230,240,255'; haloFade='160,190,255';
          }

          const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
          halo.addColorStop(0,   `rgba(${haloRgb},${(a * 0.32).toFixed(2)})`);
          halo.addColorStop(0.6, `rgba(${haloRgb},${(a * 0.08).toFixed(2)})`);
          halo.addColorStop(1,   `rgba(${haloFade},0)`);
          ctx.fillStyle = halo;
          ctx.fillRect(px - r*5, py - r*5, r*10, r*10);
          const core = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
          core.addColorStop(0,   `rgba(${coreRgb},${a.toFixed(2)})`);
          core.addColorStop(0.5, `rgba(${haloRgb},${(a * 0.45).toFixed(2)})`);
          core.addColorStop(1,   `rgba(${haloRgb},0)`);
          ctx.fillStyle = core;
          ctx.fillRect(px - r*2, py - r*2, r*4, r*4);
        }
      }
    }
  }
}

// ── constellation discovery particles ─────────────────────────────────────────

function drawConstParticles(t) {
  for (let i = constParticles.length - 1; i >= 0; i--) {
    const p   = constParticles[i];
    const age = t - p.born;
    if (age >= p.life) { constParticles.splice(i, 1); continue; }
    const prog = age / p.life;
    const a    = (1 - prog) * (prog < 0.15 ? prog / 0.15 : 1); // fade in briefly, then out
    const px   = p.x + p.vx * age;
    const py   = p.y + p.vy * age + 30 * prog * prog; // slight gravity
    const r    = p.size * (1 - prog * 0.5);
    const gr   = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    gr.addColorStop(0,   `rgba(${p.rgb},${(a * 0.95).toFixed(2)})`);
    gr.addColorStop(0.4, `rgba(${p.rgb},${(a * 0.4).toFixed(2)})`);
    gr.addColorStop(1,   `rgba(${p.rgb},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(px - r*3, py - r*3, r*6, r*6);
  }
}

// ── aurora (all-found event) ───────────────────────────────────────────────────

function drawAurora(t) {
  if (!auroraState) return;
  const age = t - auroraState.startT;
  if (age < 0) return;
  if (age > 9.0) { auroraState = null; return; }

  const bands = [
    { rgb: '60,220,160',  oy: H * 0.18 },
    { rgb: '100,160,255', oy: H * 0.32 },
    { rgb: '180,80,220',  oy: H * 0.22 },
  ];
  ctx.save();
  const sweep = Math.min(1, age / 4.5);
  const fade  = Math.min(1, age / 0.6) * Math.max(0, 1 - (age - 7.5) / 1.5);
  for (const b of bands) {
    const cx  = -W * 0.6 + sweep * W * 2.2;
    const gr  = ctx.createRadialGradient(cx, b.oy, 0, cx, b.oy, W * 0.9);
    const a   = 0.18 * fade;
    gr.addColorStop(0,   `rgba(${b.rgb},${a.toFixed(3)})`);
    gr.addColorStop(0.5, `rgba(${b.rgb},${(a * 0.4).toFixed(3)})`);
    gr.addColorStop(1,   `rgba(${b.rgb},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  // Message
  if (age > 2.0) {
    const ta = Math.min(1, (age - 2.0) / 0.9) * Math.max(0, 1 - (age - 7.0) / 1.5);
    if (ta > 0.005) {
      ctx.globalAlpha = ta * 0.90;
      ctx.font        = `${Math.round(Math.min(W * 0.028, 24))}px Georgia, serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = 'rgba(220,235,255,0.92)';
      ctx.shadowColor = 'rgba(140,185,255,0.85)';
      ctx.shadowBlur  = 22;
      ctx.fillText('louisa baka chouchou loulou doudou ✦', W * 0.5, H * 0.5);
    }
  }
  ctx.restore();
}
