// ── draw: deep background ─────────────────────────────────────────────────────

// Shared helper: draw a rotated elliptical radial glow in local (translated) coordinates
function _drawEllipseGlow(sx, sy, rx, ry, rot, stops) {
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(rot); ctx.scale(1, ry / rx);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  for (const [pos, color] of stops) gr.addColorStop(pos, color);
  ctx.fillStyle = gr; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function drawDeepBackground() {
  for (const g of gSmudges) {
    const rx = g.rx * zoomLevel, ry = g.ry * zoomLevel;
    if (rx < 3) continue;
    forEachFeatureTile(g, rx + 10, (sx, sy) => {
      if (sx + rx < 0 || sx - rx > W || sy + rx < 0 || sy - rx > H) return;
      const sAlpha = Math.min(0.85, g.alpha * (1 + exposureLevel * 2.2));
      _drawEllipseGlow(sx, sy, rx, ry, g.rot, [
        [0,    `rgba(${NIGHT.smudgeRgb},${sAlpha.toFixed(4)})`],
        [0.28, `rgba(${NIGHT.smudgeRgb},${(sAlpha * 0.65).toFixed(4)})`],
        [0.65, `rgba(${NIGHT.smudgeRgb},${(sAlpha * 0.22).toFixed(4)})`],
        [1,    'rgba(0,0,0,0)'],
      ]);
    });
  }

  for (const s of snrList) {
    const r = s.radius * zoomLevel;
    if (r < 8) continue;
    forEachFeatureTile(s, r + 20, (sx, sy) => {
      if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) return;
      for (let sh = 0; sh < 3; sh++) {
        const fr = r * (0.72 + sh * 0.14);
        const fa = Math.min(1, s.alpha * (1 + exposureLevel * 2.0) * (1 - sh * 0.28));
        const gr = ctx.createRadialGradient(sx, sy, fr * 0.78, sx, sy, fr);
        gr.addColorStop(0,    'rgba(0,0,0,0)');
        gr.addColorStop(0.45, `rgba(${s.rgb},${(fa * 0.38).toFixed(4)})`);
        gr.addColorStop(0.78, `rgba(${s.rgb},${fa.toFixed(4)})`);
        gr.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(sx - fr, sy - fr, fr * 2, fr * 2);
      }
      const ir = r * 0.52;
      const ig = ctx.createRadialGradient(sx, sy, 0, sx, sy, ir);
      ig.addColorStop(0, `rgba(${s.rgb},${Math.min(1, s.alpha * (1 + exposureLevel * 2.0) * 0.45).toFixed(4)})`);
      ig.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ig; ctx.fillRect(sx - ir, sy - ir, ir * 2, ir * 2);
    });
  }

}

// ── draw: dark nebulae ────────────────────────────────────────────────────────

function drawDarkNebulae() {
  for (const d of darkNebs) {
    const rx = d.rx * zoomLevel, ry = d.ry * zoomLevel;
    if (rx < 8) continue;
    forEachFeatureTile(d, rx + 10, (sx, sy) => {
      if (sx + rx < 0 || sx - rx > W || sy + ry < 0 || sy - ry > H) return;
      _drawEllipseGlow(sx, sy, rx, ry, d.rot, [
        [0,    `rgba(0,0,0,${d.alpha.toFixed(3)})`],
        [0.45, `rgba(0,0,0,${(d.alpha * 0.65).toFixed(3)})`],
        [0.80, `rgba(0,0,0,${(d.alpha * 0.18).toFixed(3)})`],
        [1,    'rgba(0,0,0,0)'],
      ]);
    });
  }
}

// ── draw: variable stars ──────────────────────────────────────────────────────

function drawForegroundFeatures(t) {
  for (const v of varStars) {
    const phase  = t / v.period + v.phaseOff;
    const raw    = Math.sin(phase * Math.PI * 2);
    const pulse  = Math.pow(Math.max(0, 0.5 + 0.5 * raw - 0.12 * Math.sin(phase * Math.PI * 4)), 1.6);
    const brightness = 0.18 + pulse * 0.82;
    const boost  = 1 + pulse * 4.8;
    const wGlow  = v.base * 7 * boost;
    forEachFeatureTile(v, wGlow * zoomLevel + 10, (sx, sy) => {
      const sg = wGlow * zoomLevel;
      if (sx + sg < 0 || sx - sg > W || sy + sg < 0 || sy - sg > H) return;
      const a = Math.min(1, brightness * 0.92);
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sg);
      gr.addColorStop(0.00, `rgba(${v.rgb},${a.toFixed(2)})`);
      gr.addColorStop(0.08, `rgba(${v.rgb},${(a * 0.78).toFixed(2)})`);
      gr.addColorStop(0.25, `rgba(${v.rgb},${(a * 0.22).toFixed(2)})`);
      gr.addColorStop(0.55, `rgba(${v.rgb},${(a * 0.05).toFixed(2)})`);
      gr.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(sx - sg, sy - sg, sg * 2, sg * 2);
    });
  }
}

// ── nebula wisps ──────────────────────────────────────────────────────────────

function drawWisps(t) {
  for (const w of wisps) {
    const expBoost = 1 + exposureLevel * 1.8;
    const a  = Math.min(1, w.alpha * (0.7 + 0.3 * Math.sin(t * w.pFreq * Math.PI * 2 + w.pPhase)) * expBoost);
    const gr = ctx.createRadialGradient(w.x, w.y, w.r * 0.1, w.x, w.y, w.r2);
    gr.addColorStop(0,   `rgba(${w.cr},${w.cg},${w.cb},${(a*0.6).toFixed(4)})`);
    gr.addColorStop(0.4, `rgba(${w.cr},${w.cg},${w.cb},${a.toFixed(4)})`);
    gr.addColorStop(1,   `rgba(${w.cr},${w.cg},${w.cb},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(w.x - w.r2, w.y - w.r2, w.r2 * 2, w.r2 * 2);
  }
}
