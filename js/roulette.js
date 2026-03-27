// ── Roue Céleste — daily lucky wheel ─────────────────────────────────────────

const LS_ROULETTE_DAY   = 'nsky_v2_roulette_day';
const LS_ROULETTE_SPINS = 'nsky_v2_roulette_spins';
const RL_EXTRA_COST     = 100;  // ✦ per extra spin

const RL_N   = 8;
const RL_SEG = 2 * Math.PI / RL_N;

const RL_PRIZES = [
  { label: '+30 ✦',   col: [100, 175, 255], reward: { dust: 30  }, weight: 28 },
  { label: '+80 ✦',   col: [255, 215,  80], reward: { dust: 80  }, weight: 22 },
  { label: '+1 ✧',    col: [ 80, 235, 255], reward: { frag:  1  }, weight: 18 },
  { label: '+150 ✦',  col: [255, 165,  60], reward: { dust: 150 }, weight: 12 },
  { label: '+2 min',  col: [ 80, 255, 155], reward: { time: 120 }, weight:  7 },
  { label: '+100 ✦',  col: [255, 120, 185], reward: { dust: 100, frag: 1 }, weight: 6 },
  { label: '+5 ✧',    col: [190, 120, 255], reward: { frag:  5  }, weight:  5 },
  { label: '500✦·10✧', col: [255, 225,  40], reward: { dust: 500, frag: 10 }, weight: 2 },
];

let _rlAngle    = 0;
let _rlSpinning = false;
let _rlFrom     = 0;
let _rlTo       = 0;
let _rlStart    = 0;
let _rlDur      = 0;
let _rlPrize    = null;
let _rlAnimId   = null;

// ── state ─────────────────────────────────────────────────────────────────────

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
  // Wheel drawn: segment i center at _rlAngle + (i+0.5)*RL_SEG - π/2
  // We want that to equal -π/2 (pointer at top): _rlAngle = -(winIdx+0.5)*RL_SEG + k*2π
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
  rlDraw();
  if (t < 1) {
    _rlAnimId = requestAnimationFrame(rlAnimate);
  } else {
    _rlAngle    = _rlTo;
    _rlSpinning = false;
    rlDraw();
    setTimeout(() => rlApplyReward(_rlPrize), 500);
  }
}

// ── spin entry point ──────────────────────────────────────────────────────────

function rouletteSpin() {
  if (_rlSpinning) return;
  const isFree = rlFreeAvailable();
  if (!isFree && dustTotal < RL_EXTRA_COST) return;
  if (!isFree) spendDust(RL_EXTRA_COST);

  const today = new Date().toDateString();
  localStorage.setItem(LS_ROULETTE_DAY,   today);
  localStorage.setItem(LS_ROULETTE_SPINS, String(rlSpinsToday() + 1));

  const winIdx = rlPick();
  _rlPrize    = RL_PRIZES[winIdx];
  _rlFrom     = _rlAngle;
  _rlTo       = rlTargetAngle(winIdx);
  _rlDur      = 3.5 + Math.random() * 0.8;
  _rlStart    = performance.now();
  _rlSpinning = true;

  document.getElementById('roulette-result').textContent = '';
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
  return parts.join(' · ');
}

function rlApplyReward(prize) {
  const r = prize.reward;
  if (r.dust) earnDust(r.dust);
  if (r.frag) { for (let i = 0; i < r.frag; i++) earnFrag(); }

  if (r.time) {
    rlGrantTime(r.time);
    return;
  }

  const msg = `✦ ${rlBuildMsg(prize)} !`;
  const resultEl = document.getElementById('roulette-result');
  if (resultEl) resultEl.textContent = msg;
  showToast(msg, 3500);

  // Sync expired-screen stat counters
  const dustEl = document.getElementById('te-dust-count');
  const fragEl = document.getElementById('te-frag-count');
  if (dustEl) dustEl.textContent = dustTotal;
  if (fragEl) fragEl.textContent = fragTotal;

  rlUpdateBtn();
}

function rlGrantTime(secs) {
  showToast(`⏱ +${secs / 60} minutes accordées ! ✦`, 3500);
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

// ── draw ──────────────────────────────────────────────────────────────────────

function rlDraw() {
  const canvas = document.getElementById('roulette-canvas');
  if (!canvas) return;
  const ctx2 = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  const cx = cw / 2, cy = ch / 2;
  const R  = Math.min(cx, cy) - 16;
  const fs = Math.max(9, Math.round(R * 0.095));

  ctx2.clearRect(0, 0, cw, ch);

  // Outer glow
  ctx2.save();
  const glow = ctx2.createRadialGradient(cx, cy, R - 4, cx, cy, R + 20);
  glow.addColorStop(0, 'rgba(160,120,255,0.16)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx2.fillStyle = glow;
  ctx2.beginPath(); ctx2.arc(cx, cy, R + 20, 0, Math.PI * 2); ctx2.fill();
  ctx2.restore();

  // Segments
  for (let i = 0; i < RL_N; i++) {
    const a0    = _rlAngle + i * RL_SEG - Math.PI / 2;
    const a1    = a0 + RL_SEG;
    const [r, g, b] = RL_PRIZES[i].col;
    const alpha = i % 2 === 0 ? 0.32 : 0.18;

    ctx2.beginPath();
    ctx2.moveTo(cx, cy);
    ctx2.arc(cx, cy, R, a0, a1);
    ctx2.closePath();
    ctx2.fillStyle   = `rgba(${r},${g},${b},${alpha})`;
    ctx2.fill();
    ctx2.strokeStyle = 'rgba(12,18,40,0.90)';
    ctx2.lineWidth   = 1.5;
    ctx2.stroke();

    // Label — horizontal text positioned at segment midpoint
    const midA = _rlAngle + (i + 0.5) * RL_SEG - Math.PI / 2;
    const tx   = cx + R * 0.64 * Math.cos(midA);
    const ty   = cy + R * 0.64 * Math.sin(midA);

    ctx2.save();
    ctx2.font         = `bold ${fs}px Georgia, serif`;
    ctx2.textAlign    = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillStyle    = `rgba(${r},${g},${b},1)`;
    ctx2.shadowColor  = `rgba(${r},${g},${b},0.70)`;
    ctx2.shadowBlur   = 7;
    ctx2.fillText(RL_PRIZES[i].label, tx, ty);
    ctx2.restore();
  }

  // Rim
  ctx2.beginPath();
  ctx2.arc(cx, cy, R, 0, Math.PI * 2);
  ctx2.strokeStyle = 'rgba(180,210,255,0.22)';
  ctx2.lineWidth   = 2;
  ctx2.stroke();

  // Center cap
  ctx2.beginPath();
  ctx2.arc(cx, cy, R * 0.10, 0, Math.PI * 2);
  ctx2.fillStyle   = 'rgba(8,12,28,0.95)';
  ctx2.fill();
  ctx2.strokeStyle = 'rgba(180,210,255,0.45)';
  ctx2.lineWidth   = 1.5;
  ctx2.stroke();

  // Pointer triangle at top, just outside rim
  const pH = 13, pW = 9;
  ctx2.beginPath();
  ctx2.moveTo(cx,          cy - R - 1);
  ctx2.lineTo(cx - pW / 2, cy - R - 1 - pH);
  ctx2.lineTo(cx + pW / 2, cy - R - 1 - pH);
  ctx2.closePath();
  ctx2.fillStyle   = 'rgba(255,215,70,0.95)';
  ctx2.shadowColor = 'rgba(255,195,40,0.80)';
  ctx2.shadowBlur  = 12;
  ctx2.fill();
  ctx2.shadowBlur  = 0;
}

// ── UI ────────────────────────────────────────────────────────────────────────

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
    btn.textContent    = `Rejouer — ${RL_EXTRA_COST} ✦`;
    infoEl.textContent = ok ? 'Un tirage de plus ✦' : 'Il te faut 100 ✦';
  }
}

function rouletteOpen() {
  document.getElementById('roulette-overlay').classList.add('open');
  document.getElementById('roulette-result').textContent = '';
  rlDraw();
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
