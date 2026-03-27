// ── scintillation ─────────────────────────────────────────────────────────────

let scintillation = null, nextScintillation = 8 + Math.random() * 14;
function updateScintillation(t) {
  if (!scintillation && t >= nextScintillation && stars.length > 0) {
    const candidates = stars.map((s, i) => ({ s, i })).filter(({ s }) => s.base > 0.55);
    if (candidates.length > 0) {
      const { i } = candidates[Math.floor(Math.random() * candidates.length)];
      scintillation = { starIdx: i, born: t, dur: 1.2 + Math.random() * 1.6 };
      _trigger('soft');
    }
    nextScintillation = t + 10 + Math.random() * 18;
  }
  if (!scintillation) return null;
  const life = (t - scintillation.born) / scintillation.dur;
  if (life > 1) { scintillation = null; return null; }
  return { idx: scintillation.starIdx, boost: 1 + 2.2 * Math.exp(-(((life-0.5)/0.22)**2)) };
}

// ── stars ─────────────────────────────────────────────────────────────────────

const _dim0 = [], _dim1 = [], _dim2 = [];

function drawStars(t, scint, seismActive) {
  const _zsl = zoomLevel;
  const _zox = W * 0.5 * (1 - _zsl);
  const _zoy = H * 0.5 * (1 - _zsl);
  const _WH2 = W * 0.5, _HH2 = H * 0.5;
  const _FD  = _WH2 * _WH2 + _HH2 * _HH2;

  _dim0.length = _dim1.length = _dim2.length = 0;

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (s.destroyed) continue;
    const boost = (scint && scint.idx === i) ? scint.boost : 1;

    let bx = s.wx - panX * s.depth + cam.x * s.depth;
    let by = s.wy - panY * s.depth + cam.y * s.depth;

    const oPulse = Math.sin(t * s.oFreq * Math.PI * 2 + s.oPhase);
    const sPulse = Math.sin(t * s.sFreq * Math.PI * 2 + s.sPhase);
    const alphaBoost = 1 + exposureLevel * 1.2;
    const alpha  = Math.max(0.05, Math.min(1.0, (s.brightness + oPulse * s.oAmp) * boost * alphaBoost));
    const glow   = s.base * (1 + sPulse * s.sAmp) * 7 * Math.sqrt(boost) * (1 + exposureLevel * 2.5);
    const sg     = glow * _zsl;

    if (seismActive) { const [ddx, ddy] = seismDisp(bx, by, s.depth, t); bx += ddx; by += ddy; }

    const zx  = _zox + bx * _zsl, zy = _zoy + by * _zsl;
    const fdx = zx - _WH2, fdy = zy - _HH2;
    const ff  = 1 + FISHEYE * (fdx * fdx + fdy * fdy) / _FD;
    let px = _WH2 + fdx * ff, py = _HH2 + fdy * ff;

    // Nuke blast push
    if (nukeBlasts.length) {
      const [ndx, ndy] = nukeBlastDisp(px, py, t);
      px += ndx; py += ndy;
    }

    if (px + sg < 0 || px - sg > W || py + sg < 0 || py - sg > H) continue;

    if (sg < 1.8) {
      const pxi = px | 0, pyi = py | 0;
      if      (alpha < 0.35) _dim0.push(pxi, pyi);
      else if (alpha < 0.65) _dim1.push(pxi, pyi);
      else                   _dim2.push(pxi, pyi);
      continue;
    }

    const rgb = s.rgb;
    if (sg < 4.5) {
      const gr = ctx.createRadialGradient(px, py, 0, px, py, sg);
      gr.addColorStop(0,    `rgba(${rgb},${alpha.toFixed(2)})`);
      gr.addColorStop(0.35, `rgba(${rgb},${(alpha*0.22).toFixed(2)})`);
      gr.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(px-sg, py-sg, sg*2, sg*2);
      continue;
    }
    const gr = ctx.createRadialGradient(px, py, 0, px, py, sg);
    gr.addColorStop(0.00, `rgba(${rgb},${alpha.toFixed(2)})`);
    gr.addColorStop(0.07, `rgba(${rgb},${(alpha*0.80).toFixed(2)})`);
    gr.addColorStop(0.22, `rgba(${rgb},${(alpha*0.28).toFixed(2)})`);
    gr.addColorStop(0.55, `rgba(${rgb},${(alpha*0.05).toFixed(2)})`);
    gr.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(px-sg, py-sg, sg*2, sg*2);
  }

  if (_dim0.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.beginPath();
    for (let j = 0; j < _dim0.length; j += 2) ctx.rect(_dim0[j], _dim0[j+1], 1, 1);
    ctx.fill();
  }
  if (_dim1.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)'; ctx.beginPath();
    for (let j = 0; j < _dim1.length; j += 2) ctx.rect(_dim1[j], _dim1[j+1], 1, 1);
    ctx.fill();
  }
  if (_dim2.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.beginPath();
    for (let j = 0; j < _dim2.length; j += 2) ctx.rect(_dim2[j], _dim2[j+1], 1, 1);
    ctx.fill();
  }
}
