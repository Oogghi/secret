// ── events ────────────────────────────────────────────────────────────────────
// Meteor shower
let showerActive    = false;
let showerEnd       = 0;
let showerLastSpawn = 0;
function updateShower(t) {
  if (!showerActive) return;
  if (t > showerEnd) { showerActive = false; return; }
  if (t - showerLastSpawn > 0.28) { showerLastSpawn = t; spawnShooter(t); spawnShooter(t); }
}

// Event scheduler
function scheduleEvents() {
  const events = [
    { prob: 0.55, delay: [70, 180],  fn: t => { showerActive = true; showerEnd = t + 38; showToast('✦  Pluie de météores', 3500); _trigger('nudge'); } },
    { prob: 0.40, delay: [30, 480],  fn: t => { spawnCosmicRay(t); } },
  ];
  for (const ev of events) {
    if (Math.random() > ev.prob) continue;
    const delay = ev.delay[0] + Math.random() * (ev.delay[1] - ev.delay[0]);
    setTimeout(() => ev.fn(performance.now() * 0.001), delay * 1000);
  }
}

// ── HUD ────────────────────────────────────────────────────────────────────────

const hudEl = {
  heart:     document.getElementById('hud-heart'),
  louisa:    document.getElementById('hud-louisa'),
  lily:      document.getElementById('hud-lily'),
  moon:      document.getElementById('hud-moon'),
  kiss:      document.getElementById('hud-kiss'),
  butterfly: document.getElementById('hud-butterfly'),
  shark:     document.getElementById('hud-shark'),
};
const nightNumEl = document.getElementById('hud-night-num');

function refreshHUD() {
  for (const name of ['heart', 'louisa', 'lily', 'moon', 'kiss', 'butterfly', 'shark']) {
    if (discoveredSet.has(name) && hudEl[name]) hudEl[name].classList.add('found');
  }
  if (nightNumEl) nightNumEl.textContent = nightCount;
}
