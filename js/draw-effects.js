// ── satellite ─────────────────────────────────────────────────────────────────

let satellite = null, nextSatellite = 15 + Math.random() * 30;
function spawnSatellite(t) {
  const angle = (0.05 + Math.random() * 0.30) * Math.PI;
  const speed = 55 + Math.random() * 45;
  satellite = {
    x0: -8, y0: Math.random() * H * 0.7,
    spawnPanX: panX, spawnPanY: panY,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    born: t, dur: Math.sqrt(W*W+H*H) / speed,
    doFlare: Math.random() < 0.4, flareAt: 0.35 + Math.random() * 0.30, flareFired: false,
  };
}
function drawSatellite(t) {
  if (!satellite) return;
  const age = t - satellite.born, life = age / satellite.dur;
  if (life > 1.08) { satellite = null; nextSatellite = t + 60 + Math.random() * 90; return; }
  const fade = Math.min(1, life * 12) * Math.max(0, 1 - (life - 0.88) / 0.12);
  if (fade < 0.01) return;
  let flareBoost = 1;
  if (satellite.doFlare) {
    const fp = (life - satellite.flareAt) / 0.07;
    flareBoost = 1 + 2.5 * Math.exp(-fp * fp * 4);
    if (!satellite.flareFired && life >= satellite.flareAt) { satellite.flareFired = true; _trigger('nudge'); }
  }
  // Pan-compensated position (same pattern as shooting stars)
  const wx = satellite.x0 + satellite.vx * age - (panX - satellite.spawnPanX);
  const wy = satellite.y0 + satellite.vy * age - (panY - satellite.spawnPanY);
  const [sx, sy] = worldToScreen(wx, wy);
  const alpha = Math.min(1, fade * 0.65 * flareBoost);
  const r = 3.5 * flareBoost;
  const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  gr.addColorStop(0,   `rgba(220,230,255,${alpha.toFixed(2)})`);
  gr.addColorStop(0.5, `rgba(200,215,255,${(alpha*0.35).toFixed(2)})`);
  gr.addColorStop(1,   'rgba(200,215,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(sx-r, sy-r, r*2, r*2);
  const spd = Math.sqrt(satellite.vx**2 + satellite.vy**2);
  const nx = satellite.vx/spd, ny = satellite.vy/spd, tl = 6*flareBoost;
  const grad = ctx.createLinearGradient(sx-nx*tl, sy-ny*tl, sx, sy);
  grad.addColorStop(0, 'rgba(220,230,255,0)');
  grad.addColorStop(1, `rgba(220,230,255,${(alpha*0.4).toFixed(2)})`);
  ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx-nx*tl, sy-ny*tl); ctx.lineTo(sx, sy); ctx.stroke();
}

// ── shooting stars ────────────────────────────────────────────────────────────

const shooters = [];
let nextShoot = 0;
function spawnShooter(t) {
  const angle = (0.18 + Math.random() * 0.22) * Math.PI;
  const speed = 900 + Math.random() * 600, len = 120 + Math.random() * 180;
  const edge = Math.random();
  const x = edge < 0.65 ? Math.random() * W : -10;
  const y = edge < 0.65 ? -10 : Math.random() * H * 0.6;
  if (Math.random() < 0.6) _trigger('light');
  shooters.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
                  len, born: t, dur: (len + Math.max(W,H)*1.4)/speed,
                  spawnPanX: panX, spawnPanY: panY });
}
function updateAndDrawShooters(t) {
  if (t >= nextShoot) { spawnShooter(t); nextShoot = t + 3 + Math.random() * 7; }
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i], age = t - s.born;
    if (age > s.dur + 0.15) { shooters.splice(i, 1); continue; }
    const life = age / s.dur;
    const alpha = Math.min(1, life * 8) * Math.max(0, 1 - (life - 0.75) / 0.25);
    if (alpha < 0.01) continue;
    const hwx = s.x + s.vx*age - (panX - s.spawnPanX);
    const hwy = s.y + s.vy*age - (panY - s.spawnPanY);
    const spd = Math.sqrt(s.vx*s.vx + s.vy*s.vy);
    const nx = s.vx/spd, ny = s.vy/spd;
    const [hx, hy] = worldToScreen(hwx, hwy);
    const [tx, ty] = worldToScreen(hwx - nx*s.len, hwy - ny*s.len);
    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0,   'rgba(255,255,255,0)');
    grad.addColorStop(0.6, `rgba(255,255,255,${(alpha*0.3).toFixed(2)})`);
    grad.addColorStop(1,   `rgba(255,255,255,${alpha.toFixed(2)})`);
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    const headR = 4 * Math.max(1, zoomLevel * 0.5);
    const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, headR);
    gr.addColorStop(0,   `rgba(255,255,255,${alpha.toFixed(2)})`);
    gr.addColorStop(0.4, `rgba(255,255,255,${(alpha*0.4).toFixed(2)})`);
    gr.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(hx-headR, hy-headR, headR*2, headR*2);
  }
}

// ── cosmic ray ────────────────────────────────────────────────────────────────

let cosmicRay = null;
function spawnCosmicRay(t) {
  const angle = Math.random() * Math.PI;
  const cx = W * (0.2 + Math.random() * 0.6), cy = H * (0.2 + Math.random() * 0.6);
  const len = Math.sqrt(W * W + H * H) * 1.1;
  cosmicRay = {
    x1: cx - Math.cos(angle) * len * 0.5, y1: cy - Math.sin(angle) * len * 0.5,
    x2: cx + Math.cos(angle) * len * 0.5, y2: cy + Math.sin(angle) * len * 0.5,
    born: t, dur: 0.11,
  };
  _trigger('light');
}
function drawCosmicRay(t) {
  if (!cosmicRay) return;
  const age = t - cosmicRay.born;
  if (age > cosmicRay.dur) { cosmicRay = null; return; }
  const a = (1 - age / cosmicRay.dur) * 0.90;
  ctx.save();
  ctx.strokeStyle = `rgba(225,238,255,${a.toFixed(2)})`;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = 'rgba(200,225,255,0.9)';
  ctx.shadowBlur  = 10;
  ctx.beginPath();
  ctx.moveTo(cosmicRay.x1, cosmicRay.y1);
  ctx.lineTo(cosmicRay.x2, cosmicRay.y2);
  ctx.stroke();
  ctx.restore();
}
