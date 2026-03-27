// ── nuke mode ─────────────────────────────────────────────────────────────────

let nukeMode    = false;
let _lastNukeT  = 0;
const nukeExplosions      = [];   // active explosion visuals
const nukeBlasts          = [];   // screen-space star-push events
const dimmedConsts        = new Map(); // type → Set<tileKey>  (per-tile, not per-type)
const constellationNukes  = [];   // chain-reaction destruction sequences

document.getElementById('nuke-btn').addEventListener('click', () => {
  nukeMode = !nukeMode;
  document.getElementById('nuke-btn').classList.toggle('armed', nukeMode);
  document.getElementById('c').style.cursor = nukeMode ? 'crosshair' : 'grab';
});

function findNearestStar(cx, cy) {
  const hw = W * 0.5, hh = H * 0.5;
  const _zsl = zoomLevel, _FD = hw * hw + hh * hh;
  const _zox = hw * (1 - _zsl), _zoy = hh * (1 - _zsl);
  let best = null, bestDist = 60;
  for (const s of stars) {
    if (s.base < 0.15 || s.destroyed) continue;
    const bx = s.wx - panX * s.depth + cam.x * s.depth;
    const by = s.wy - panY * s.depth + cam.y * s.depth;
    const zx = _zox + bx * _zsl, zy = _zoy + by * _zsl;
    const fdx = zx - hw, fdy = zy - hh;
    const ff  = 1 + FISHEYE * (fdx * fdx + fdy * fdy) / _FD;
    const px  = hw + fdx * ff, py = hh + fdy * ff;
    const d   = Math.hypot(px - cx, py - cy);
    if (d < bestDist) { bestDist = d; best = { s, px, py }; }
  }
  return best;
}

function triggerNukeExplosion(px, py, star, t) {
  const strength = 0.25 + star.base;
  const r        = 18 + strength * 90;
  const rgb      = star.rgb || STAR_COL[star.colorIdx] || STAR_COL[1];

  const [ox, oy] = screenToWorld(px, py);
  const depth    = star.depth || 1;

  // Particles — three types: fast sparks, core debris, slow embers
  const count = Math.round(22 + strength * 58);
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle   = Math.random() * Math.PI * 2;
    const roll    = Math.random();
    const isCore  = roll < 0.25;
    const isEmber = !isCore && roll < 0.42;
    const spd     = isEmber ? 12 + Math.random() * 55
                  : isCore  ? 55 + Math.random() * (strength * 220)
                  :           35 + Math.random() * (strength * 330);
    const sz      = isCore  ? 1.6 + Math.random() * strength * 2.4
                  : isEmber ? 1.0 + Math.random() * 1.8
                  :           0.5 + Math.random() * 1.4;
    const decay   = isEmber ? 1.1 + Math.random() * 1.6 : 1.8 + Math.random() * 3.2;
    particles.push({ angle, spd, decay, r: sz, isCore, isEmber });
  }

  nukeExplosions.push({ ox, oy, depth, spawnPanX: panX, spawnPanY: panY, spawnCamX: cam.x, spawnCamY: cam.y,
    r, rgb, strength, born: t, dur: 2.0 + strength * 1.3, particles });

  nukeBlasts.push({ ox, oy, depth, spawnPanX: panX, spawnPanY: panY, spawnCamX: cam.x, spawnCamY: cam.y,
    radius: r * 3.8, strength: r * 0.9, born: t, dur: 0.75 + strength * 0.25 });
  playNukeExplosion(strength);
  _trigger('nudge');

  // Permanently destroy the hit star
  star.destroyed = true;

  // Kick nearby stars outward from the blast
  const _hw2 = W * 0.5, _hh2 = H * 0.5;
  const _zsl2 = zoomLevel;
  const _zox2 = _hw2 * (1 - _zsl2), _zoy2 = _hh2 * (1 - _zsl2);
  const _FD2  = _hw2 * _hw2 + _hh2 * _hh2;
  const kickR = Math.min(r * 3.5 * _zsl2, W * 0.42);
  for (const s of stars) {
    if (s.destroyed) continue;
    const bxs = s.wx - panX * s.depth + cam.x * s.depth;
    const bys = s.wy - panY * s.depth + cam.y * s.depth;
    const zx2 = _zox2 + bxs * _zsl2, zy2 = _zoy2 + bys * _zsl2;
    const fdx2 = zx2 - _hw2, fdy2 = zy2 - _hh2;
    const ff2  = 1 + FISHEYE * (fdx2 * fdx2 + fdy2 * fdy2) / _FD2;
    const spx  = _hw2 + fdx2 * ff2, spy = _hh2 + fdy2 * ff2;
    const ddx  = spx - px, ddy = spy - py;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 1 || dist > kickR) continue;
    const forcePx = Math.pow(1 - dist / kickR, 0.65) * r * 1.4;
    s.driftVx = (ddx / dist) * forcePx / _zsl2;
    s.driftVy = (ddy / dist) * forcePx / _zsl2;
  }
}

function getConstellationStarScreen(c, starIdx) {
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const hw = W * 0.5, hh = H * 0.5;
  const bx = ((c.sx * ww - panX * c.depth + cam.x * c.depth) % ww + ww) % ww;
  const by = ((c.sy * wh - panY * c.depth + cam.y * c.depth) % wh + wh) % wh;
  const kx = Math.round((hw - bx) / ww);
  const ky = Math.round((hh - by) / wh);
  const cx = bx + kx * ww, cy = by + ky * wh;
  const sc = CONST_SCALE * (c.size || 1);
  const star = c.stars[starIdx];
  return worldToScreen(cx + star.x * sc, cy + star.y * sc);
}

// Stable per-tile key — invariant under camera panning.
// N = kx - floor((c.sx * ww - panX * depth + cam.x * depth) / ww) identifies
// which physical repeat of the constellation tile (kx, ky) corresponds to.
function _constTileKey(c, kx, ky) {
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const bxInner = c.sx * ww - panX * c.depth + cam.x * c.depth;
  const byInner = c.sy * wh - panY * c.depth + cam.y * c.depth;
  return `${kx - Math.floor(bxInner / ww)},${ky - Math.floor(byInner / wh)}`;
}

function _isTileNuked(c, kx, ky) {
  const tiles = dimmedConsts.get(c.type);
  return tiles ? tiles.has(_constTileKey(c, kx, ky)) : false;
}

function nukeConstellation(constType, tileKx, tileKy, hitPx, hitPy, t) {
  const c = constellations.find(cc => cc.type === constType);
  if (!c) return;

  const tileKey = _constTileKey(c, tileKx, tileKy);
  if (!dimmedConsts.has(constType)) dimmedConsts.set(constType, new Set());
  const tileSet = dimmedConsts.get(constType);
  if (tileSet.has(tileKey)) return;
  tileSet.add(tileKey);

  // Lump-sum dust for destroying the whole constellation — capped at 10
  const total = Math.min(10, Math.round(
    c.stars.reduce((sum, s) => sum + Math.max(1, Math.round((0.5 + s.b * 1.3) * 1.2)), 0)
    * dustMult
  ));
  _spawnDustFloat(hitPx, hitPy - 30, total);
  earnDust(total);

  // 50% chance to drop a constellation fragment ✧
  if (Math.random() < 0.5) {
    earnFrag();
    _spawnFragFloat(hitPx, hitPy - 55);
  }

  // Randomise destruction order for a chaotic chain-reaction feel
  const starQueue = c.stars.map((_, i) => i).sort(() => Math.random() - 0.5);

  const nebulaRgb = constType === 'lily'       ? '255,60,190'
                  : constType === 'heart'      ? '255,110,140'
                  : constType === 'moon'       ? '220,15,15'
                  : constType === 'kiss'       ? '255,90,130'
                  : constType === 'butterfly'  ? '190,100,255'
                  :                              '100,170,255';

  constellationNukes.push({ constellation: c, type: constType,
    starQueue, qIdx: 0, nextT: t + 0.02, nebulaBorn: null, nebulaRgb });

  // Large central shockwave rings the whole constellation
  const [cox, coy] = screenToWorld(hitPx, hitPy);
  nukeBlasts.push({ ox: cox, oy: coy, depth: 1, spawnPanX: panX, spawnPanY: panY, spawnCamX: cam.x, spawnCamY: cam.y,
    radius: 420, strength: 180, born: t, dur: 1.4 });
}

function updateConstellationNukes(t) {
  for (let i = constellationNukes.length - 1; i >= 0; i--) {
    const cn = constellationNukes[i];

    if (cn.qIdx >= cn.starQueue.length) {
      if (!cn.nebulaBorn) cn.nebulaBorn = t;
      if (t - cn.nebulaBorn > 16) constellationNukes.splice(i, 1);
      continue;
    }
    if (t < cn.nextT) continue;

    const starIdx = cn.starQueue[cn.qIdx++];
    const star    = cn.constellation.stars[starIdx];
    const [spx, spy] = getConstellationStarScreen(cn.constellation, starIdx);

    if (spx > -300 && spx < W + 300 && spy > -300 && spy < H + 300) {
      triggerNukeExplosion(spx, spy, {
        base: 0.5 + star.b * 1.3,
        rgb: cn.nebulaRgb,
        depth: 1,
      }, t);
    }

    // Accelerate through the chain
    const progress = cn.qIdx / cn.starQueue.length;
    cn.nextT = t + Math.max(0.015, (0.07 - progress * 0.04) + Math.random() * 0.03);
  }
}

function drawConstellationNebulae(t) {
  for (const cn of constellationNukes) {
    if (!cn.nebulaBorn) continue;
    const age = t - cn.nebulaBorn;
    if (age > 14) continue;
    const a = Math.min(1, age / 0.8) * Math.max(0, 1 - age / 14) * 0.18;
    if (a < 0.002) continue;

    const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
    const hw = W * 0.5, hh = H * 0.5;
    const bx = ((cn.constellation.sx * ww - panX * cn.constellation.depth + cam.x * cn.constellation.depth) % ww + ww) % ww;
    const by = ((cn.constellation.sy * wh - panY * cn.constellation.depth + cam.y * cn.constellation.depth) % wh + wh) % wh;
    const kx = Math.round((hw - bx) / ww);
    const ky = Math.round((hh - by) / wh);
    const [scx, scy] = worldToScreen(bx + kx * ww, by + ky * wh);

    const nebulaR = Math.min(W * 0.65, (100 + age * 18) * Math.max(1, zoomLevel));
    if (nebulaR < 1) continue;
    try {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gr = ctx.createRadialGradient(scx, scy, 0, scx, scy, nebulaR);
      gr.addColorStop(0,   `rgba(${cn.nebulaRgb},${(a * 0.55).toFixed(3)})`);
      gr.addColorStop(0.35,`rgba(${cn.nebulaRgb},${a.toFixed(3)})`);
      gr.addColorStop(0.65,`rgba(${cn.nebulaRgb},${(a * 0.35).toFixed(3)})`);
      gr.addColorStop(1,   `rgba(${cn.nebulaRgb},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(scx - nebulaR, scy - nebulaR, nebulaR * 2, nebulaR * 2);
      ctx.restore();
    } catch(_) { ctx.restore(); }
  }
}

function fireNuke(cx, cy, t) {
  if (!nukeMode) return;
  if (t - _lastNukeT < 0.6) return;
  _lastNukeT = t;

  // Check constellation stars first — clicking any star of a constellation nukes it
  let constHit = null, constBestDist = 45;
  for (const entry of _constStarPositions) {
    const d = Math.hypot(cx - entry.sx, cy - entry.sy);
    if (d < constBestDist) { constBestDist = d; constHit = entry; }
  }

  if (constHit) {
    const dust = Math.round(1 * dustMult);
    _spawnDustFloat(constHit.sx, constHit.sy - 20, dust);
    earnDust(dust);
    triggerNukeExplosion(constHit.sx, constHit.sy, {
      base: 0.6, rgb: '255,230,160', depth: 1,
    }, t);
    nukeConstellation(constHit.type, constHit.kx, constHit.ky, constHit.sx, constHit.sy, t);
    return;
  }

  const hit = findNearestStar(cx, cy);
  if (!hit) return;

  // Earn dust from the destroyed star
  const raw  = 1;
  const dust = Math.round(raw * dustMult);
  _spawnDustFloat(hit.px, hit.py - 20, dust);
  earnDust(dust);

  triggerNukeExplosion(hit.px, hit.py, hit.s, t);

  for (const entry of _constStarPositions) {
    if (Math.hypot(hit.px - entry.sx, hit.py - entry.sy) < 55) {
      nukeConstellation(entry.type, entry.kx, entry.ky, hit.px, hit.py, t);
      break;
    }
  }
}

// Per-frame cache of constellation star screen positions (built in drawConstellations)
let _constStarPositions = [];

function nukeBlastDisp(spx, spy, t) {
  let dx = 0, dy = 0;
  for (const b of nukeBlasts) {
    const age  = t - b.born;
    if (age < 0 || age > b.dur) continue;
    // Re-project blast center to current screen position
    const cwx = b.ox - (panX - b.spawnPanX) * b.depth + (cam.x - (b.spawnCamX || 0)) * b.depth;
    const cwy = b.oy - (panY - b.spawnPanY) * b.depth + (cam.y - (b.spawnCamY || 0)) * b.depth;
    const [bsx, bsy] = worldToScreen(cwx, cwy);
    const ddx  = spx - bsx, ddy = spy - bsy;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist < b.radius && dist > 0.5) {
      const push = b.strength * Math.exp(-age * 5) * Math.pow(1 - dist / b.radius, 0.6);
      dx += (ddx / dist) * push;
      dy += (ddy / dist) * push;
    }
  }
  return [dx, dy];
}

function drawNukeExplosions(t) {
  // Prune dead blasts
  for (let i = nukeBlasts.length - 1; i >= 0; i--)
    if (t - nukeBlasts[i].born > nukeBlasts[i].dur) nukeBlasts.splice(i, 1);

  for (let i = nukeExplosions.length - 1; i >= 0; i--) {
    const e    = nukeExplosions[i];
    const age  = t - e.born;
    if (age > e.dur) { nukeExplosions.splice(i, 1); continue; }
    const life = age / e.dur;

    const cwx = e.ox - (panX - e.spawnPanX) * e.depth + (cam.x - e.spawnCamX) * e.depth;
    const cwy = e.oy - (panY - e.spawnPanY) * e.depth + (cam.y - e.spawnCamY) * e.depth;
    const [epx, epy] = worldToScreen(cwx, cwy);

    try {

    // 1 ── Initial flash — big, saturating, longer than before
    if (age < 0.26) {
      const fl = age / 0.26;
      const fr = Math.max(1, e.r * (0.05 + fl * 2.2));
      const fa = (1 - fl * fl) * (0.75 + e.strength * 0.40);
      const fg = ctx.createRadialGradient(epx, epy, 0, epx, epy, fr);
      fg.addColorStop(0,    `rgba(255,255,255,${Math.min(1,fa).toFixed(2)})`);
      fg.addColorStop(0.12, `rgba(255,252,220,${Math.min(1,fa * 0.9).toFixed(2)})`);
      fg.addColorStop(0.40, `rgba(${e.rgb},${(fa * 0.28).toFixed(2)})`);
      fg.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = fg;
      ctx.fillRect(epx - fr, epy - fr, fr * 2, fr * 2);
      ctx.restore();
    }

    // 4 ── Particles (sparks, core debris, slow embers)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of e.particles) {
      const dist = p.spd * age * Math.exp(-p.decay * age);
      const ppx  = epx + Math.cos(p.angle) * dist;
      const ppy  = epy + Math.sin(p.angle) * dist;
      const pa   = p.isEmber
        ? Math.max(0, Math.min(1, age * 3) * (1 - life * 0.85))
        : Math.max(0, 1 - life * 1.25);
      if (pa < 0.006) continue;
      const pr   = p.r * Math.max(0.25, 1 - life * (p.isEmber ? 0.4 : 0.65));
      const halo = Math.max(0.5, pr * (p.isCore ? 4.5 : p.isEmber ? 3.2 : 2.4));
      const gr   = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, halo);
      if (p.isCore) {
        gr.addColorStop(0,    `rgba(255,255,248,${pa.toFixed(2)})`);
        gr.addColorStop(0.20, `rgba(255,240,180,${(pa * 0.85).toFixed(2)})`);
        gr.addColorStop(0.55, `rgba(${e.rgb},${(pa * 0.40).toFixed(2)})`);
        gr.addColorStop(1,    `rgba(${e.rgb},0)`);
      } else if (p.isEmber) {
        gr.addColorStop(0,    `rgba(255,160,60,${(pa * 0.80).toFixed(2)})`);
        gr.addColorStop(0.40, `rgba(${e.rgb},${(pa * 0.35).toFixed(2)})`);
        gr.addColorStop(1,    `rgba(${e.rgb},0)`);
      } else {
        gr.addColorStop(0,    `rgba(${e.rgb},${(pa * 0.65).toFixed(2)})`);
        gr.addColorStop(0.50, `rgba(${e.rgb},${(pa * 0.18).toFixed(2)})`);
        gr.addColorStop(1,    `rgba(${e.rgb},0)`);
      }
      ctx.fillStyle = gr;
      ctx.fillRect(ppx - halo, ppy - halo, halo * 2, halo * 2);
    }
    ctx.restore();

    // 5 ── Lingering core glow
    const ga = Math.max(0, 0.18 * Math.pow(1 - life, 2.2) * e.strength);
    if (ga > 0.002) {
      const glowR = Math.max(1, e.r * (0.30 + life * 0.55));
      const gr = ctx.createRadialGradient(epx, epy, 0, epx, epy, glowR);
      gr.addColorStop(0,   `rgba(${e.rgb},${Math.min(0.95, ga * 3.5).toFixed(3)})`);
      gr.addColorStop(0.4, `rgba(${e.rgb},${ga.toFixed(3)})`);
      gr.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = gr;
      ctx.fillRect(epx - glowR, epy - glowR, glowR * 2, glowR * 2);
      ctx.restore();
    }

    } catch(_e) { /* guard against degenerate gradient args */ }
  }
}
