// ── dust (in-game currency) ────────────────────────────────────────────────────

const LS_DUST      = 'nsky_v2_dust';
const LS_PURCHASES = 'nsky_v2_purchases';
const LS_FRAGS     = 'nsky_v2_fragments';

let dustTotal   = parseInt(localStorage.getItem(LS_DUST)  || '0', 10);
let fragTotal   = parseInt(localStorage.getItem(LS_FRAGS) || '0', 10);
let purchases   = JSON.parse(localStorage.getItem(LS_PURCHASES) || '[]');
let dustMult    = 1.0;
let dustMultEnd = 0;

// ── dust HUD ──────────────────────────────────────────────────────────────────

function updateDustHUD() {
  const cnt = document.getElementById('dust-count');
  if (cnt) cnt.textContent = dustTotal;
  const ml = document.getElementById('dust-mult');
  if (ml) {
    ml.style.display = dustMult > 1 ? '' : 'none';
    ml.textContent   = `×${dustMult.toFixed(0)}`;
  }
}

function pulseDustHUD() {
  const hud = document.getElementById('dust-hud');
  if (!hud) return;
  hud.classList.remove('pulse');
  void hud.offsetWidth;
  hud.classList.add('pulse');
}

function earnDust(n) {
  dustTotal += n;
  localStorage.setItem(LS_DUST, String(dustTotal));
  updateDustHUD();
  pulseDustHUD();
}

function spendDust(n) {
  if (dustTotal < n) return false;
  dustTotal -= n;
  localStorage.setItem(LS_DUST, String(dustTotal));
  updateDustHUD();
  return true;
}

// ── constellation fragments ───────────────────────────────────────────────────

function updateFragHUD() {
  const cnt = document.getElementById('frag-count');
  if (cnt) cnt.textContent = fragTotal;
  const hud = document.getElementById('frag-hud');
  if (hud) hud.style.display = fragTotal > 0 ? '' : 'none';
}

function pulseFragHUD() {
  const hud = document.getElementById('frag-hud');
  if (!hud) return;
  hud.classList.remove('pulse');
  void hud.offsetWidth;
  hud.classList.add('pulse');
}

function earnFrag() {
  fragTotal++;
  localStorage.setItem(LS_FRAGS, String(fragTotal));
  updateFragHUD();
  pulseFragHUD();
}

function spendFrag() {
  if (fragTotal < 1) return false;
  fragTotal--;
  localStorage.setItem(LS_FRAGS, String(fragTotal));
  updateFragHUD();
  return true;
}

// ── dust multiplier (photo boost) ────────────────────────────────────────────

function activateDustMult(mult, secs) {
  dustMult    = mult;
  dustMultEnd = performance.now() + secs * 1000;
  updateDustHUD();
  _boostBorn = performance.now() * 0.001;
  _boostMult = mult;
  const label = mult >= 2
    ? 'Parfait ! ×2 poussière pendant 10s ✦'
    : '×1.5 poussière pendant 10s ✦';
  showToast(label, 2600);
}

// ── boost visual effect ───────────────────────────────────────────────────────

let _boostBorn = -999;
let _boostMult = 1;

function drawBoostEffect(t) {
  const isX2  = _boostMult >= 2;
  const rgb   = isX2 ? '255,210,50' : '110,185,255';
  const snapY = H * 0.88;

  // ── initial burst animation ───────────────────────────────────────────────
  const age = t - _boostBorn;
  const dur  = isX2 ? 2.0 : 1.5;
  if (age >= 0 && age <= dur) {
    const prog = age / dur;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Background wash
    const washR = H * (0.4 + prog * 1.8);
    const washA = (1 - prog) * (isX2 ? 0.28 : 0.18);
    const gr    = ctx.createRadialGradient(W * 0.5, snapY, 0, W * 0.5, snapY, washR);
    gr.addColorStop(0,   `rgba(${rgb},${washA.toFixed(3)})`);
    gr.addColorStop(0.5, `rgba(${rgb},${(washA * 0.4).toFixed(3)})`);
    gr.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);

    // Staggered expanding rings
    for (let i = 0; i < (isX2 ? 3 : 2); i++) {
      const rAge  = age - i * 0.18;
      if (rAge <= 0) continue;
      const rProg = Math.min(1, rAge / (dur * 0.85));
      const r     = rProg * Math.min(W, H) * (isX2 ? 1.3 : 1.0);
      const ra    = (1 - rProg) * (isX2 ? 0.80 : 0.55);
      if (ra < 0.01) continue;
      ctx.strokeStyle = `rgba(${rgb},${ra.toFixed(2)})`;
      ctx.lineWidth   = (2.2 - i * 0.5) * (1 - rProg * 0.5);
      ctx.beginPath();
      ctx.arc(W * 0.5, snapY, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── ongoing exposure glow while multiplier is active ─────────────────────
  if (dustMult <= 1) return;
  const remaining  = Math.max(0, (dustMultEnd - performance.now()) / 1000);
  const fadeOut    = Math.min(1, remaining / 1.5);
  const slowPulse  = 0.5 + 0.5 * Math.sin(t * 1.8);
  const fastPulse  = 0.5 + 0.5 * Math.sin(t * (isX2 ? 5.5 : 4.0));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 1 — full-screen colour wash (overexposure feel)
  const washA = fadeOut * (isX2 ? 0.18 : 0.11) * (0.7 + 0.3 * slowPulse);
  ctx.fillStyle = `rgba(${rgb},${washA.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);

  // 2 — central bloom radiating outward
  const bloomR = Math.max(W, H) * 1.1;
  const bloomA = fadeOut * (isX2 ? 0.28 : 0.18) * (0.6 + 0.4 * slowPulse);
  const bloom  = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, bloomR);
  bloom.addColorStop(0,    `rgba(${rgb},${bloomA.toFixed(3)})`);
  bloom.addColorStop(0.35, `rgba(${rgb},${(bloomA * 0.55).toFixed(3)})`);
  bloom.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  // 3 — light leaking from all four corners
  const cornerR = Math.min(W, H) * 0.65;
  const cornerA = fadeOut * (isX2 ? 0.30 : 0.20) * (0.5 + 0.5 * fastPulse);
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cornerR);
    cg.addColorStop(0,   `rgba(${rgb},${cornerA.toFixed(3)})`);
    cg.addColorStop(0.5, `rgba(${rgb},${(cornerA * 0.3).toFixed(3)})`);
    cg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(cx - cornerR, cy - cornerR, cornerR * 2, cornerR * 2);
  }

  // 4 — hard glowing border
  const borderA = fadeOut * (isX2 ? 0.95 : 0.75) * fastPulse;
  ctx.strokeStyle = `rgba(${rgb},${borderA.toFixed(2)})`;
  ctx.lineWidth   = isX2 ? 3.5 : 2.5;
  ctx.shadowColor = `rgba(${rgb},${(fadeOut * 0.8).toFixed(2)})`;
  ctx.shadowBlur  = isX2 ? 18 : 12;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  ctx.restore();
}

function tickDustMult() {
  if (dustMult > 1 && performance.now() > dustMultEnd) {
    dustMult = 1;
    updateDustHUD();
  }
}


// ── floating dust labels ──────────────────────────────────────────────────────

const _dustFloats = [];

function _spawnDustFloat(px, py, amount) {
  _dustFloats.push({ x: px, y: py, text: `+${amount} ✦`, born: performance.now() * 0.001 });
}

function _spawnFragFloat(px, py) {
  _dustFloats.push({ x: px, y: py, text: '+1 ✧', born: performance.now() * 0.001, isFrag: true });
}

function drawDustFloats(t) {
  if (!_dustFloats.length) return;
  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  for (let i = _dustFloats.length - 1; i >= 0; i--) {
    const f   = _dustFloats[i];
    const age = t - f.born;
    if (age >= 1.1) { _dustFloats.splice(i, 1); continue; }
    const prog = age / 1.1;
    // ease-in fade-out: snappy appear, slow fade
    const a = prog < 0.15
      ? prog / 0.15
      : Math.pow(1 - (prog - 0.15) / 0.85, 1.8);
    const y = f.y - 38 * prog;
    ctx.globalAlpha  = a;
    ctx.font         = `${Math.round(12 + 3 * (1 - prog))}px Georgia, serif`;
    ctx.fillStyle    = f.isFrag ? 'rgba(180,240,255,1)' : 'rgba(255,225,80,1)';
    ctx.shadowColor  = f.isFrag ? 'rgba(100,210,255,0.90)' : 'rgba(255,180,20,0.90)';
    ctx.shadowBlur   = 10;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
  ctx.restore();
}

// ── shop data ─────────────────────────────────────────────────────────────────

const SHOP = {
  heart:     { label: 'Cœur',     icon: '🤗', desc: "Ce que tu veux de RAISONNABLE.",                             price: 380,  fragPrice: 10 },
  louisa:    { label: 'Louisa',   icon: '💆', desc: "Un massage sans limite de temps, rien que pour toi",          price: 400,  fragPrice: 10 },
  lily:      { label: 'Lily',     icon: '💐', desc: "Un bouquet de tes fleurs préférées",                          price: 350,  fragPrice: 10 },
  moon:      { label: 'Lune',     icon: '🎬', desc: "Une soirée ciné à ton choix, avec tous les snacks",           price: 420,  fragPrice: 10 },
  kiss:      { label: 'Bisou',    icon: '🫦', desc: "Je m'occupe de toi skkskskskskkskkskss",                      price: 300,  fragPrice: 8  },
  butterfly: { label: 'Papillon', icon: '✈️', desc: "Des vacances surprise organisées par moi, juste pour toi",   price: 6767, fragPrice: 25 },
  shark:     { label: 'Requin',   icon: '🌊', desc: "Une nuit au bord de la mer pour voir le soleil se coucher",  price: 650,  fragPrice: 15 },
};

// ── shop overlay ──────────────────────────────────────────────────────────────

const SHOP_COLORS = {
  heart: '255,140,170', louisa: '160,200,255', lily: '255,110,185',
  moon: '220,60,40', kiss: '255,100,130', butterfly: '185,110,255',
  shark: '30,195,225',
};

function getEffectivePrice(type) {
  const base  = SHOP[type].price;
  const count = purchases.filter(p => p.type === type).length;
  return Math.round(base * Math.pow(3, count));
}

function getEffectiveFragPrice(type) {
  const base  = SHOP[type].fragPrice;
  const count = purchases.filter(p => p.type === type).length;
  return Math.round(base * Math.pow(3, count));
}

function openShop(type) {
  const s     = SHOP[type];
  if (!s) return;
  const price     = getEffectivePrice(type);
  const fragPrice = getEffectiveFragPrice(type);
  const count = purchases.filter(p => p.type === type).length;
  const col   = SHOP_COLORS[type] || '180,210,255';
  const card  = document.getElementById('shop-card');
  card.style.setProperty('--c', col);
  card.dataset.type = type;

  document.getElementById('shop-header').textContent    = `Constellation ${s.label}`;
  document.getElementById('shop-icon').textContent      = s.icon;
  document.getElementById('shop-desc').textContent      = s.desc;
  document.getElementById('shop-price').textContent     = price;
  document.getElementById('shop-frag-price').textContent = fragPrice;
  document.getElementById('shop-wallet').textContent    = dustTotal;
  document.getElementById('shop-frags').textContent     = fragTotal;

  const btn = document.getElementById('shop-buy-btn');
  btn.dataset.type = type;
  const canAfford = dustTotal >= price && fragTotal >= fragPrice;
  if (!canAfford) {
    const missing = [];
    if (dustTotal < price)       missing.push(`${price - dustTotal} ✦`);
    if (fragTotal < fragPrice)   missing.push(`${fragPrice - fragTotal} ✧`);
    btn.textContent = `Il te manque ${missing.join(' et ')}`;
    btn.disabled = true;
    btn.className = 'shop-btn broke';
  } else {
    btn.textContent = count === 0 ? 'Réclamer la récompense' : 'Réclamer à nouveau';
    btn.disabled = false;
    btn.className = 'shop-btn';
  }
  document.getElementById('shop-overlay').classList.add('open');
}

document.getElementById('shop-close').addEventListener('click', () =>
  document.getElementById('shop-overlay').classList.remove('open'));

document.getElementById('shop-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('shop-overlay'))
    document.getElementById('shop-overlay').classList.remove('open');
});

document.getElementById('shop-buy-btn').addEventListener('click', function() {
  const type  = this.dataset.type;
  const s     = SHOP[type];
  if (!s) return;
  const price     = getEffectivePrice(type);
  const fragPrice = getEffectiveFragPrice(type);
  if (!spendDust(price)) { showToast('Pas assez de poussière ✦', 2000); return; }
  for (let i = 0; i < fragPrice; i++) {
    if (!spendFrag()) {
      // Refund dust and already-spent frags if we run out mid-way
      earnDust(price);
      for (let j = 0; j < i; j++) earnFrag();
      showToast('Pas assez d\'éclats ✧', 2000);
      return;
    }
  }

  purchases.push({ type, icon: s.icon, label: s.label, desc: s.desc, date: Date.now() });
  localStorage.setItem(LS_PURCHASES, JSON.stringify(purchases));

  document.getElementById('shop-overlay').classList.remove('open');
  document.getElementById('confirm-icon').textContent = s.icon;
  document.getElementById('confirm-desc').textContent = s.desc;
  document.getElementById('confirm-overlay').classList.add('open');
});

document.getElementById('confirm-close').addEventListener('click', () =>
  document.getElementById('confirm-overlay').classList.remove('open'));

document.getElementById('confirm-see-rewards').addEventListener('click', () => {
  document.getElementById('confirm-overlay').classList.remove('open');
  openGalleryUI('rewards');
});

// ── constellation shop click detection ───────────────────────────────────────

function tryOpenShop(cx, cy) {
  if (nukeMode) return false;
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const hw = W * 0.5, hh = H * 0.5;
  let best = null, bestD = Infinity;

  for (const c of constellations) {
    if (!discoveredSet.has(c.type)) continue;
    const bx = ((c.sx * ww - panX * c.depth + cam.x * c.depth) % ww + ww) % ww;
    const by = ((c.sy * wh - panY * c.depth + cam.y * c.depth) % wh + wh) % wh;
    const kx = Math.round((hw - bx) / ww);
    const ky = Math.round((hh - by) / wh);
    if (_isTileNuked(c, kx, ky)) continue;   // this tile destroyed → no market
    const [scx, scy] = worldToScreen(bx + kx * ww, by + ky * wh);
    const d = Math.hypot(scx - cx, scy - cy);
    if (d < _constMaxR(c) && d < bestD) { bestD = d; best = c.type; }
  }

  if (best) { openShop(best); return true; }
  return false;
}

// ── market indicators ─────────────────────────────────────────────────────────
// A small glowing gem (diamond shape) floats above each live discovered
// constellation center — clearly signals "something to buy here".

function drawMarketIndicators(t) {
  if (!discoveredSet.size) return;
  if (timerExpired) return;
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const hw = W * 0.5, hh = H * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (const c of constellations) {
    if (!discoveredSet.has(c.type)) continue;

    const bx = ((c.sx * ww - panX * c.depth + cam.x * c.depth) % ww + ww) % ww;
    const by = ((c.sy * wh - panY * c.depth + cam.y * c.depth) % wh + wh) % wh;
    const kx = Math.round((hw - bx) / ww);
    const ky = Math.round((hh - by) / wh);
    if (_isTileNuked(c, kx, ky)) continue;    // this tile destroyed → no market indicator
    const [scx, scy] = worldToScreen(bx + kx * ww, by + ky * wh);

    if (scx < -80 || scx > W + 80 || scy < -80 || scy > H + 80) continue;

    const zoomA = Math.max(0, Math.min(1, (zoomLevel - 0.9) / 0.5));
    if (zoomA < 0.01) continue;

    const col   = SHOP_COLORS[c.type] || '180,210,255';
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + c.sx * 5.1);
    // Gem floats gently above the constellation center
    const floatY = scy - (28 + 3 * Math.sin(t * 1.1 + c.sx * 3.7)) * Math.min(zoomLevel, 2);
    const alpha  = zoomA * (0.55 + 0.25 * pulse);

    // Diamond gem — taller than wide, like a cut jewel
    const gh = (7 + 1.5 * pulse) * Math.min(zoomLevel, 2);  // half-height
    const gw = gh * 0.62;                                     // half-width

    ctx.save();
    ctx.shadowColor = `rgba(${col},${(alpha * 0.9).toFixed(2)})`;
    ctx.shadowBlur  = 10 + 4 * pulse;

    // Filled gem body
    ctx.beginPath();
    ctx.moveTo(scx,      floatY - gh);   // top
    ctx.lineTo(scx + gw, floatY);        // right
    ctx.lineTo(scx,      floatY + gh);   // bottom
    ctx.lineTo(scx - gw, floatY);        // left
    ctx.closePath();
    ctx.fillStyle = `rgba(${col},${(alpha * 0.22).toFixed(2)})`;
    ctx.fill();

    // Gem outline
    ctx.strokeStyle = `rgba(${col},${(alpha * 0.85).toFixed(2)})`;
    ctx.lineWidth   = 1.1;
    ctx.stroke();

    // Inner facet line — horizontal divider through the widest point
    ctx.beginPath();
    ctx.moveTo(scx - gw, floatY);
    ctx.lineTo(scx + gw, floatY);
    ctx.strokeStyle = `rgba(${col},${(alpha * 0.40).toFixed(2)})`;
    ctx.lineWidth   = 0.7;
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

// ── overlay guard ─────────────────────────────────────────────────────────────

function isOverlayOpen() {
  return ['shop-overlay', 'confirm-overlay', 'gallery', 'gallery-full', 'pause-overlay', 'refill-overlay'].some(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('open');
  }) || document.getElementById('timer-expired').classList.contains('visible');
}

// ── handle game click (tap on canvas) ─────────────────────────────────────────

function handleGameClick(cx, cy) {
  if (isOverlayOpen()) return;
  // Ignore clicks inside the timer HUD element
  const timerHud = document.getElementById('timer-hud');
  if (timerHud) {
    const r = timerHud.getBoundingClientRect();
    if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return;
  }
  if (nukeMode) { fireNuke(cx, cy, performance.now() * 0.001); return; }
  if (!tryOpenShop(cx, cy)) tryDiscover(cx, cy);
}

// ── init ──────────────────────────────────────────────────────────────────────

function gameInit() {
  updateDustHUD();
  updateFragHUD();
}
