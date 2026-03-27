// ── Roue Céleste — daily lucky wheel ─────────────────────────────────────────

const LS_ROULETTE_DAY   = 'nsky_v2_roulette_day';
const LS_ROULETTE_SPINS = 'nsky_v2_roulette_spins';
const RL_EXTRA_COST     = 100;

const RL_N   = 8;
const RL_SEG = 2 * Math.PI / RL_N;

// Labels are short to fit tangentially on the wheel.
// Full rewards (incl. bonus frags) are revealed in the result message.
const RL_PRIZES = [
  { label: '+30 ✦',  col: [100, 175, 255], reward: { dust:  30         }, weight: 28 },
  { label: '+80 ✦',  col: [255, 210,  70], reward: { dust:  80         }, weight: 22 },
  { label: '+1 ✧',   col: [ 80, 230, 255], reward: { frag:   1         }, weight: 18 },
  { label: '+150 ✦', col: [255, 160,  55], reward: { dust: 150         }, weight: 12 },
  { label: '+2 min', col: [ 70, 255, 150], reward: { time: 120         }, weight:  7 },
  { label: '+100 ✦', col: [255, 110, 180], reward: { dust: 100, frag: 1}, weight:  6 },
  { label: '+5 ✧',   col: [185, 110, 255], reward: { frag:   5         }, weight:  5 },
  { label: '500 ✦',  col: [255, 225,  35], reward: { dust: 500, frag:10}, weight:  2 },
];

// ── state ─────────────────────────────────────────────────────────────────────

let _rlAngle    = 0;
let _rlSpinning = false;
let _rlFrom     = 0;
let _rlTo       = 0;
let _rlStart    = 0;
let _rlDur      = 0;
let _rlPrize    = null;
let _rlAnimId   = null;
let _rlWinIdx   = -1;     // segment that just won
let _rlWinTime  = -99;    // performance.now() when win flash started
let _rlParticles = [];    // celebration particles

// ── helpers ───────────────────────────────────────────────────────────────────

function rlSpinsToday() {
  const today = new Date().toDateString();
  if (localStorage.getItem(LS_ROULETTE_DAY) !== today) return 0;
  return parseInt(localStorage.getItem(LS_ROULETTE_SPINS) || '0', 10);
}

function rlFreeAvailable() { return rlSpinsToday() === 0; }

// ── weighted random pick ──────────────────────────────────────────────────────

function rlPick() {
  const total = RL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RL_PRIZES.length; i++) {
    r -= RL_PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return RL_PRIZES.length - 1;
}

// ── spin physics ──────────────────────────────────────────────────────────────

function rlTargetAngle(winIdx) {
  const target    = -((winIdx + 0.5) * RL_SEG);
  const minTarget = _rlAngle + 5 * 2 * Math.PI;
  const k         = Math.ceil((minTarget - target) / (2 * Math.PI));
  return target + k * 2 * Math.PI;
}

function rlEase(t) { return 1 - Math.pow(1 - t, 4); }

function rlAnimate(now) {
  if (!_rlSpinning) return;
  const t = Math.min(1, (now - _rlStart) / 1000 / _rlDur);
  _rlAngle = _rlFrom + (_rlTo - _rlFrom) * rlEase(t);
  rlDraw(now);
  if (t < 1) {
    _rlAnimId = requestAnimationFrame(rlAnimate);
  } else {
    _rlAngle    = _rlTo;
    _rlSpinning = false;
    rlDraw(now);
    setTimeout(() => rlApplyReward(_rlPrize), 480);
  }
}

// ── spin ──────────────────────────────────────────────────────────────────────

function rouletteSpin() {
  if (_rlSpinning) return;
  const isFree = rlFreeAvailable();
  if (!isFree && dustTotal < RL_EXTRA_COST) return;
  if (!isFree) spendDust(RL_EXTRA_COST);

  const today = new Date().toDateString();
  localStorage.setItem(LS_ROULETTE_DAY,   today);
  localStorage.setItem(LS_ROULETTE_SPINS, String(rlSpinsToday() + 1));

  const winIdx = rlPick();
  _rlPrize     = RL_PRIZES[winIdx];
  _rlFrom      = _rlAngle;
  _rlTo        = rlTargetAngle(winIdx);
  _rlDur       = 3.6 + Math.random() * 0.7;
  _rlStart     = performance.now();
  _rlSpinning  = true;
  _rlWinIdx    = -1;
  _rlParticles = [];

  const res = document.getElementById('roulette-result');
  res.textContent = '';
  res.classList.remove('show');
  rlUpdateBtn();

  if (_rlAnimId) cancelAnimationFrame(_rlAnimId);
  _rlAnimId = requestAnimationFrame(rlAnimate);
}

// ── reward ────────────────────────────────────────────────────────────────────

function rlBuildMsg(prize) {
  const r = prize.reward;
  const parts = [];
  if (r.dust) parts.push(`+${r.dust} ✦`);
  if (r.frag) parts.push(`+${r.frag} ✧`);
  return parts.join('  ');
}

function rlApplyReward(prize) {
  const r = prize.reward;
  if (r.dust) earnDust(r.dust);
  if (r.frag) { for (let i = 0; i < r.frag; i++) earnFrag(); }

  // Win flash
  _rlWinIdx  = RL_PRIZES.indexOf(prize);
  _rlWinTime = performance.now();
  rlSpawnParticles(prize);

  if (r.time) { rlGrantTime(r.time); return; }

  const msg = rlBuildMsg(prize);
  const res = document.getElementById('roulette-result');
  if (res) { res.textContent = msg; res.classList.add('show'); }
  showToast(`✦  ${msg}`, 3500);

  const dustEl = document.getElementById('te-dust-count');
  const fragEl = document.getElementById('te-frag-count');
  if (dustEl) dustEl.textContent = dustTotal;
  if (fragEl) fragEl.textContent = fragTotal;

  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 30, 80]);
  rlUpdateBtn();
  requestAnimationFrame(rlAnimate); // keep drawing for particle animation
}

function rlGrantTime(secs) {
  showToast(`⏱  +${secs / 60} minutes accordées  ✦`, 3500);
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 30, 80]);
  document.getElementById('roulette-overlay').classList.remove('open');
  setTimeout(() => {
    timerUsedToday    = Math.max(0, timerUsedToday - secs);
    timerSessionStart = Date.now();
    timerExpired      = false;
    timerActive       = true;
    timerWarned       = timerSecondsRemaining() <= 60;
    document.body.classList.remove('sky-expired');
    const el = document.getElementById('timer-expired');
    if (el) el.classList.remove('visible');
    localStorage.setItem(LS_PLAYTIME, String(Math.round(timerUsedToday)));
    timerUpdateHUD(timerSecondsRemaining());
  }, 400);
}

// ── celebration particles ─────────────────────────────────────────────────────

function rlSpawnParticles(prize) {
  const canvas = document.getElementById('roulette-canvas');
  if (!canvas) return;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const [r, g, b] = prize.col;
  const count = prize.reward.dust >= 300 ? 28 : prize.reward.frag >= 5 ? 22 : 14;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    _rlParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r, g, b,
      size: 1.5 + Math.random() * 3,
      life: 1,
      decay: 0.018 + Math.random() * 0.012,
    });
  }
}

// ── draw ──────────────────────────────────────────────────────────────────────

function rlDraw(now) {
  const canvas = document.getElementById('roulette-canvas');
  if (!canvas) return;
  const c  = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  const cx = cw / 2, cy = ch / 2;
  const R  = Math.min(cx, cy) - 20;          // room for pointer + outer glow
  const fs = Math.max(11, Math.round(R * 0.093));
  const t  = now !== undefined ? now : performance.now();

  c.clearRect(0, 0, cw, ch);

  // ── background depth circle ───────────────────────────────────────────────
  const bg = c.createRadialGradient(cx, cy, 0, cx, cy, R + 22);
  bg.addColorStop(0,   'rgba(14,8,35,0.75)');
  bg.addColorStop(0.75,'rgba(8,4,20,0.50)');
  bg.addColorStop(1,   'rgba(0,0,0,0)');
  c.fillStyle = bg;
  c.beginPath(); c.arc(cx, cy, R + 22, 0, Math.PI * 2); c.fill();

  // ── segments ──────────────────────────────────────────────────────────────
  for (let i = 0; i < RL_N; i++) {
    const a0   = _rlAngle + i * RL_SEG - Math.PI / 2;
    const a1   = a0 + RL_SEG;
    const midA = (a0 + a1) / 2;
    const [r, g, b] = RL_PRIZES[i].col;

    const isWinner  = i === _rlWinIdx;
    const winAge    = isWinner ? Math.min(1, (t - _rlWinTime) / 900) : 0;
    const winPulse  = isWinner ? (0.5 + 0.5 * Math.sin((t - _rlWinTime) * 0.008)) : 0;
    const baseAlpha = i % 2 === 0 ? 0.26 : 0.14;
    const segAlpha  = baseAlpha + winAge * 0.30 * (0.6 + 0.4 * winPulse);

    // Fill
    const grad = c.createRadialGradient(cx, cy, R * 0.12, cx, cy, R);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${(segAlpha * 0.3).toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},${(segAlpha * 0.7).toFixed(3)})`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},${segAlpha.toFixed(3)})`);

    c.save();
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, R, a0, a1);
    c.closePath();
    c.fillStyle = grad;
    c.fill();

    // Spoke separator
    c.strokeStyle = 'rgba(180,200,255,0.10)';
    c.lineWidth   = 1;
    c.stroke();
    c.restore();

    // Colored rim arc highlight
    c.save();
    c.beginPath();
    c.arc(cx, cy, R - 5, a0 + 0.07, a1 - 0.07);
    const rimA = isWinner ? (0.70 + 0.30 * winPulse) : 0.45;
    c.strokeStyle = `rgba(${r},${g},${b},${rimA.toFixed(2)})`;
    c.lineWidth   = isWinner ? 5 : 3.5;
    if (isWinner) { c.shadowColor = `rgba(${r},${g},${b},0.80)`; c.shadowBlur = 12; }
    c.stroke();
    c.restore();

    // Prize label — tangential text (rotates with wheel, readable)
    c.save();
    c.translate(cx, cy);
    c.rotate(midA);
    c.translate(R * 0.60, 0);
    c.rotate(Math.PI / 2);
    if (Math.sin(midA) >= 0) c.rotate(Math.PI);
    c.font         = `bold ${fs}px Georgia, serif`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillStyle    = `rgba(${r},${g},${b},${isWinner ? '1' : '0.92'})`;
    c.shadowColor  = `rgba(${r},${g},${b},${isWinner ? '0.90' : '0.50'})`;
    c.shadowBlur   = isWinner ? 14 : 6;
    c.fillText(RL_PRIZES[i].label, 0, 0);
    c.restore();
  }

  // ── outer rim ─────────────────────────────────────────────────────────────
  c.save();
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(210,220,255,0.28)';
  c.lineWidth   = 2.5;
  c.stroke();
  // thin inner ring
  c.beginPath(); c.arc(cx, cy, R - 10, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(180,200,255,0.09)';
  c.lineWidth   = 1;
  c.stroke();
  c.restore();

  // ── center hub ────────────────────────────────────────────────────────────
  const hubR = R * 0.12;
  c.save();
  const hub = c.createRadialGradient(cx, cy, 0, cx, cy, hubR);
  hub.addColorStop(0, 'rgba(60,45,110,1)');
  hub.addColorStop(1, 'rgba(12,8,28,1)');
  c.beginPath(); c.arc(cx, cy, hubR, 0, Math.PI * 2);
  c.fillStyle = hub; c.fill();
  c.strokeStyle = 'rgba(210,200,255,0.45)';
  c.lineWidth   = 1.5; c.stroke();
  c.font         = `${Math.round(hubR * 1.0)}px serif`;
  c.textAlign    = 'center';
  c.textBaseline = 'middle';
  c.fillStyle    = 'rgba(220,215,255,0.70)';
  c.fillText('✦', cx, cy);
  c.restore();

  // ── pointer ───────────────────────────────────────────────────────────────
  const pTip  = cy - R - 2;
  const pH    = 15, pHW = 8;
  c.save();
  c.beginPath();
  c.moveTo(cx,        pTip);
  c.lineTo(cx - pHW,  pTip - pH);
  c.lineTo(cx + pHW,  pTip - pH);
  c.closePath();
  const pg = c.createLinearGradient(cx, pTip - pH, cx, pTip);
  pg.addColorStop(0, 'rgba(255,240,130,1)');
  pg.addColorStop(1, 'rgba(210,150,10,1)');
  c.fillStyle   = pg;
  c.shadowColor = 'rgba(255,200,30,0.85)';
  c.shadowBlur  = 14;
  c.fill();
  c.restore();

  // ── celebration particles ─────────────────────────────────────────────────
  for (let i = _rlParticles.length - 1; i >= 0; i--) {
    const p = _rlParticles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.05;   // gentle gravity
    p.life -= p.decay;
    if (p.life <= 0) { _rlParticles.splice(i, 1); continue; }

    c.save();
    c.globalAlpha = p.life * p.life;
    c.beginPath();
    c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    c.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;
    c.shadowColor = `rgba(${p.r},${p.g},${p.b},0.80)`;
    c.shadowBlur  = 6;
    c.fill();
    c.restore();
  }

  // Keep animating while particles alive or win flash is playing
  if (_rlParticles.length > 0 || (t - _rlWinTime < 1600 && _rlWinIdx >= 0)) {
    if (!_rlSpinning) requestAnimationFrame(ts => rlDraw(ts));
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function rlUpdateBtn() {
  const btn    = document.getElementById('roulette-spin-btn');
  const infoEl = document.getElementById('roulette-spin-info');
  if (!btn || !infoEl) return;

  if (_rlSpinning) {
    btn.disabled       = true;
    btn.textContent    = '· · ·';
    infoEl.textContent = '';
    return;
  }

  if (rlFreeAvailable()) {
    btn.disabled       = false;
    btn.textContent    = 'Tourner !';
    infoEl.textContent = 'Tirage gratuit ✦';
  } else {
    const ok           = dustTotal >= RL_EXTRA_COST;
    btn.disabled       = !ok;
    btn.textContent    = `Rejouer  —  ${RL_EXTRA_COST} ✦`;
    infoEl.textContent = ok ? 'Un tirage de plus ✦' : `Il te faut ${RL_EXTRA_COST} ✦`;
  }
}

// ── open / close ──────────────────────────────────────────────────────────────

function rouletteOpen() {
  // Size canvas to fit the device
  const canvas = document.getElementById('roulette-canvas');
  const size   = Math.min(
    window.innerWidth  - 48,
    Math.round(window.innerHeight * 0.50),
    340
  );
  canvas.width  = size;
  canvas.height = size;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  _rlWinIdx    = -1;
  _rlParticles = [];

  const res = document.getElementById('roulette-result');
  res.textContent = '';
  res.classList.remove('show');

  document.getElementById('roulette-overlay').classList.add('open');
  rlDraw(performance.now());
  rlUpdateBtn();
}

function rouletteClose() {
  if (_rlSpinning) return;
  document.getElementById('roulette-overlay').classList.remove('open');
}

// ── init ──────────────────────────────────────────────────────────────────────

(function rouletteInit() {
  document.getElementById('roulette-spin-btn').addEventListener('click', rouletteSpin);
  document.getElementById('roulette-close').addEventListener('click', rouletteClose);
  document.getElementById('roulette-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('roulette-overlay')) rouletteClose();
  });
})();
