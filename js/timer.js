// ── daily play timer (10 min limit) ──────────────────────────────────────────

const LS_PLAYTIME = 'nsky_v2_playtime_secs';
const LS_PLAYDAY  = 'nsky_v2_playday';
const DAY_LIMIT   = 5 * 60; // 300 seconds

// circumferences (for stroke-dasharray)
const HUD_CIRC  = 2 * Math.PI * 22;  // r=22 → ≈138.23
const WLCM_CIRC = 2 * Math.PI * 44;  // r=44 → ≈276.46

let timerSessionStart = null;
let timerUsedToday    = 0;
let timerExpired      = false;
let timerActive       = false;
let timerWarned       = false;

// ── localStorage ──────────────────────────────────────────────────────────────

function timerGetToday() { return new Date().toDateString(); }

function timerLoad() {
  const today = timerGetToday();
  if (localStorage.getItem(LS_PLAYDAY) !== today) {
    localStorage.setItem(LS_PLAYDAY, today);
    localStorage.setItem(LS_PLAYTIME, '0');
  }
  timerUsedToday = parseInt(localStorage.getItem(LS_PLAYTIME) || '0', 10);
}

function timerSave() {
  if (!timerSessionStart) return;
  const elapsed = (Date.now() - timerSessionStart) / 1000;
  const total   = Math.min(DAY_LIMIT, timerUsedToday + elapsed);
  localStorage.setItem(LS_PLAYTIME, String(Math.round(total)));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function timerSecondsRemaining() {
  const elapsed = timerSessionStart ? (Date.now() - timerSessionStart) / 1000 : 0;
  return Math.max(0, DAY_LIMIT - timerUsedToday - elapsed);
}

function timerSecondsToMidnight() {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, (midnight - now) / 1000);
}

function timerFmtMS(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Color shifts: blue → amber → red as time runs out
function timerArcColor(fraction) {
  if (fraction > 0.5) {
    const t = (fraction - 0.5) / 0.5;            // 1→0 as fraction goes 1→0.5
    const r = Math.round(150 + 105 * (1 - t));
    const g = Math.round(200 -  40 * (1 - t));
    const b = Math.round(255 - 205 * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = fraction / 0.5;                     // 1→0 as fraction goes 0.5→0
    const g = Math.round(160 * t);
    const b = Math.round(50  * t);
    return `rgb(255,${g},${b})`;
  }
}

// ── HUD arc ───────────────────────────────────────────────────────────────────

function timerUpdateHUD(remaining) {
  const fraction = remaining / DAY_LIMIT;
  const arcEl    = document.getElementById('timer-arc');
  const textEl   = document.getElementById('timer-time');
  if (!arcEl || !textEl) return;

  textEl.textContent = timerFmtMS(remaining);
  arcEl.style.strokeDasharray = `${HUD_CIRC * fraction} ${HUD_CIRC}`;
  const col = timerArcColor(fraction);
  arcEl.style.stroke = col;

  const hudEl = document.getElementById('timer-hud');
  if (!hudEl) return;
  if (fraction < 0.167) {
    hudEl.style.filter = `drop-shadow(0 0 7px ${col})`;
  } else if (fraction < 0.33) {
    hudEl.style.filter = `drop-shadow(0 0 3px ${col})`;
  } else {
    hudEl.style.filter = '';
  }
}

// ── welcome screen ─────────────────────────────────────────────────────────────

function timerUpdateWelcomeArc(remaining) {
  const arc    = document.getElementById('tw-arc');
  const timeEl = document.getElementById('tw-time-text');
  if (!arc || !timeEl) return;
  const frac = remaining / DAY_LIMIT;
  arc.style.strokeDasharray = `${WLCM_CIRC * frac} ${WLCM_CIRC}`;
  arc.style.stroke = timerArcColor(frac);
  timeEl.textContent = timerFmtMS(remaining);
}

function timerShowWelcome(remaining) {
  const el      = document.getElementById('timer-welcome');
  const nightEl = document.getElementById('tw-night-num');
  const subEl   = document.getElementById('tw-subtitle');
  if (!el) return;

  if (nightEl) nightEl.textContent = nightCount;

  if (subEl) {
    subEl.textContent = timerUsedToday < 5
      ? 'tu m\'as trop manqué!!'
      : 'content de te revoir chouchou \uD83D\uDE09';
  }

  timerUpdateWelcomeArc(remaining);
  setTimeout(() => el.classList.add('visible'), 60);

  const dismiss = () => timerDismissWelcome();
  document.getElementById('tw-enter-btn')
    .addEventListener('click', dismiss, { once: true });
  setTimeout(() => {
    if (el.classList.contains('visible')) dismiss();
  }, 8000);
}

function timerDismissWelcome() {
  const el = document.getElementById('timer-welcome');
  if (!el || !el.classList.contains('visible')) return;
  el.classList.add('dismissing');
  setTimeout(() => {
    el.style.display   = 'none';
    el.classList.remove('visible', 'dismissing');
    timerActive       = true;
    timerSessionStart = Date.now();
  }, 700);
}

// ── expired screen ────────────────────────────────────────────────────────────

function timerShowExpired() {
  timerExpired = true;
  document.body.classList.add('sky-expired');
  const el      = document.getElementById('timer-expired');
  const nightEl = document.getElementById('te-night-num');
  if (!el) return;
  if (nightEl) nightEl.textContent = nightCount;

  const dustEl = document.getElementById('te-dust-count');
  const fragEl = document.getElementById('te-frag-count');
  if (dustEl) dustEl.textContent = typeof dustTotal !== 'undefined' ? dustTotal : 0;
  if (fragEl) fragEl.textContent = typeof fragTotal !== 'undefined' ? fragTotal : 0;

  function updateCountdown() {
    const secs = timerSecondsToMidnight();
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const countEl = document.getElementById('te-countdown');
    if (countEl) countEl.textContent =
      `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  buyTimeUpdateDisplay();
  timerSpawnExpiredStars();
  setTimeout(() => el.classList.add('visible'), 120);
}

function timerSpawnExpiredStars() {
  const expCanvas = document.getElementById('timer-expired-canvas');
  if (!expCanvas) return;
  const expCtx    = expCanvas.getContext('2d');
  expCanvas.width  = window.innerWidth;
  expCanvas.height = window.innerHeight;

  const pts = Array.from({ length: 260 }, () => ({
    x:     Math.random() * expCanvas.width,
    y:     Math.random() * expCanvas.height,
    r:     0.3 + Math.random() * 1.3,
    a:     0.12 + Math.random() * 0.55,
    freq:  0.18 + Math.random() * 0.85,
    phase: Math.random() * Math.PI * 2,
  }));

  // Occasionally spawn a slow drifting shooting star
  const shooters = [];
  function maybeSpawnShooter() {
    if (Math.random() < 0.4) {
      shooters.push({
        x:    Math.random() * expCanvas.width,
        y:    Math.random() * expCanvas.height * 0.6,
        vx:   2 + Math.random() * 3,
        vy:   0.8 + Math.random() * 1.5,
        len:  40 + Math.random() * 70,
        a:    0,
        life: 0,
        dur:  1.8 + Math.random() * 1.2,
        born: performance.now() * 0.001,
      });
    }
    setTimeout(maybeSpawnShooter, 3000 + Math.random() * 5000);
  }
  setTimeout(maybeSpawnShooter, 2000);

  function frame(ts) {
    if (!timerExpired) return;
    const t = ts * 0.001;
    expCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);

    // Stars
    for (const s of pts) {
      const a = s.a * (0.4 + 0.6 * Math.sin(t * s.freq + s.phase));
      expCtx.beginPath();
      expCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      expCtx.fillStyle = `rgba(185,210,255,${a.toFixed(2)})`;
      expCtx.fill();
    }

    // Shooters
    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh  = shooters[i];
      const age = t - sh.born;
      if (age > sh.dur) { shooters.splice(i, 1); continue; }
      const prog = age / sh.dur;
      const a    = Math.min(1, age * 6) * (1 - prog * prog);
      const x2   = sh.x + sh.vx * age * 30;
      const y2   = sh.y + sh.vy * age * 30;
      const x1   = x2 - sh.vx * sh.len * 0.03;
      const y1   = y2 - sh.vy * sh.len * 0.03;
      const grad = expCtx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `rgba(200,220,255,0)`);
      grad.addColorStop(1, `rgba(220,235,255,${(a * 0.7).toFixed(2)})`);
      expCtx.save();
      expCtx.strokeStyle = grad;
      expCtx.lineWidth   = 1;
      expCtx.beginPath();
      expCtx.moveTo(x1, y1); expCtx.lineTo(x2, y2);
      expCtx.stroke();
      expCtx.restore();
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── buy extra time ────────────────────────────────────────────────────────────

const BUY_MINUTES        = 2;
const BUY_BASE_DUST      = 100;
const BUY_BASE_FRAG      = 1;
const LS_BUYTIME_COUNT   = 'nsky_v2_buytime_count';
const LS_BUYTIME_DAY     = 'nsky_v2_buytime_day';

function buyTimeCount() {
  const today = timerGetToday();
  if (localStorage.getItem(LS_BUYTIME_DAY) !== today) return 0;
  return parseInt(localStorage.getItem(LS_BUYTIME_COUNT) || '0', 10);
}

function buyTimeCost() {
  const n = buyTimeCount();
  return {
    dust: Math.round(BUY_BASE_DUST * Math.pow(3, n)),
    frag: Math.round(BUY_BASE_FRAG * Math.pow(3, n)),
  };
}

function buyTimeUpdateDisplay() {
  const cost   = buyTimeCost();
  const costEl = document.getElementById('te-buy-cost');
  if (costEl) costEl.textContent = `${cost.dust} ✦ · ${cost.frag} ✧`;
}

function timerBuyTime() {
  if (typeof dustTotal === 'undefined' || typeof fragTotal === 'undefined') return;
  const cost = buyTimeCost();
  if (dustTotal < cost.dust || fragTotal < cost.frag) {
    showToast('Pas assez de ressources ✦', 2500);
    return;
  }

  // Spend resources
  spendDust(cost.dust);
  spendFrag(cost.frag);

  // Record purchase for today (escalates price on next buy)
  const today = timerGetToday();
  const newCount = buyTimeCount() + 1;
  localStorage.setItem(LS_BUYTIME_DAY,   today);
  localStorage.setItem(LS_BUYTIME_COUNT, String(newCount));

  // Absorb elapsed time then give extra time
  if (timerSessionStart) {
    timerUsedToday = Math.min(DAY_LIMIT, timerUsedToday + (Date.now() - timerSessionStart) / 1000);
  }
  timerUsedToday    = Math.max(0, timerUsedToday - BUY_MINUTES * 60);
  timerSessionStart = Date.now();
  localStorage.setItem(LS_PLAYTIME, String(Math.round(timerUsedToday)));

  // Dismiss expired overlay and resume
  timerExpired = false;
  timerActive  = true;
  timerWarned  = false;
  document.body.classList.remove('sky-expired');
  const el = document.getElementById('timer-expired');
  if (el) el.classList.remove('visible');

  buyTimeUpdateDisplay();
  timerUpdateHUD(timerSecondsRemaining());
  showToast(`✦ +${BUY_MINUTES} minutes accordées`, 3000);
}

// ── manual overlay freeze (silent — no pause overlay) ─────────────────────────

let timerFrozenByManual = false;

function timerFreezeForManual() {
  if (!timerActive || timerExpired) return;
  if (timerSessionStart) {
    timerUsedToday   += (Date.now() - timerSessionStart) / 1000;
    timerSessionStart = null;
  }
  timerActive         = false;
  timerFrozenByManual = true;
}

function timerUnfreezeForManual() {
  if (!timerFrozenByManual || timerExpired) return;
  timerFrozenByManual = false;
  timerActive         = true;
  timerSessionStart   = Date.now();
}

// ── pause / resume ────────────────────────────────────────────────────────────

let timerPaused = false;

function timerPause() {
  if (!timerActive || timerExpired || timerPaused) return;
  // Absorb elapsed time so remaining is preserved correctly on resume
  if (timerSessionStart) {
    timerUsedToday += (Date.now() - timerSessionStart) / 1000;
    timerSessionStart = null;
  }
  timerActive = false;
  timerPaused = true;

  const remaining = Math.max(0, DAY_LIMIT - timerUsedToday);
  document.getElementById('pause-remaining').textContent = timerFmtMS(remaining);
  document.getElementById('pause-overlay').classList.add('open');
}

function timerResume() {
  if (!timerPaused) return;
  timerPaused       = false;
  timerActive       = true;
  timerSessionStart = Date.now();
  document.getElementById('pause-overlay').classList.remove('open');
}

// ── tick (every second) ───────────────────────────────────────────────────────

function timerTick() {
  if (!timerActive || timerExpired) return;
  const remaining = timerSecondsRemaining();
  timerUpdateHUD(remaining);

  if (remaining <= 0) {
    timerSave();
    timerShowExpired();
  } else if (remaining <= 60 && !timerWarned) {
    timerWarned = true;
    showToast('✦  Plus qu\'une minute, profite !', 4000);
  }
}

// ── init ──────────────────────────────────────────────────────────────────────

function initTimer() {
  timerLoad();
  const remaining = DAY_LIMIT - timerUsedToday;

  // Always set up the tick, save, and UI machinery so timerBuyTime works
  // even when the timer was already expired on page load.
  setInterval(timerTick, 1000);
  window.addEventListener('beforeunload', timerSave);
  setInterval(timerSave, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') timerTick();
  });
  document.getElementById('timer-hud').addEventListener('click', timerPause);
  document.getElementById('pause-resume-btn').addEventListener('click', timerResume);

  if (remaining <= 0) {
    timerShowExpired();
    return;
  }

  timerUpdateHUD(remaining);
  timerShowWelcome(remaining);
}
