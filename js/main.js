// ── film roll ─────────────────────────────────────────────────────────────────

const LS_FILMDATE  = 'nsky_v2_filmdate';
const LS_FILMSHOTS = 'nsky_v2_filmshots';
const FILM_MAX     = 3;
let   shotsLeft    = FILM_MAX;

function filmInit() {
  const today = new Date().toDateString();
  if (localStorage.getItem(LS_FILMDATE) !== today) {
    shotsLeft = FILM_MAX;
    localStorage.setItem(LS_FILMSHOTS, String(FILM_MAX));
    localStorage.setItem(LS_FILMDATE, today);
  } else {
    shotsLeft = parseInt(localStorage.getItem(LS_FILMSHOTS) || String(FILM_MAX), 10);
  }
  filmUpdateUI();
}

function filmConsume() {
  if (shotsLeft <= 0) return false;
  shotsLeft--;
  localStorage.setItem(LS_FILMSHOTS, String(shotsLeft));
  filmUpdateUI();
  return true;
}

function filmUpdateUI() {
  for (let i = 0; i < FILM_MAX; i++) {
    const el = document.getElementById('sc' + i);
    if (el) el.classList.toggle('used', i >= shotsLeft);
  }
  document.getElementById('snap').classList.toggle('empty', shotsLeft <= 0);
}

// ── long exposure ─────────────────────────────────────────────────────────────

let exposureLevel  = 0;
let   _expCharging = false;
let   _expStartT   = 0;
let   _expOscFreq  = 0.5;   // Hz — randomised on each press
const RING_CIRC    = 207.3;

function updateSnapRing() {
  const arc = document.getElementById('snap-ring-arc');
  if (!arc) return;
  arc.setAttribute('stroke-dashoffset', (RING_CIRC * (1 - exposureLevel)).toFixed(2));
  // At peak (>0.82) flash gold; otherwise blue→white gradient
  const isPeak = exposureLevel >= 0.82;
  if (isPeak) {
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.018);
    arc.setAttribute('stroke', `rgba(255,220,60,${pulse.toFixed(2)})`);
  } else {
    const g = Math.round(255 - 55  * exposureLevel);
    const b = Math.round(255 - 160 * exposureLevel);
    const a = (0.75 + 0.25 * exposureLevel).toFixed(2);
    arc.setAttribute('stroke', `rgba(255,${g},${b},${a})`);
  }
}

// ── init ──────────────────────────────────────────────────────────────────────

function init() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.scale(dpr, dpr);
  cam.x = cam.y = 0;

  // Night counter first — palette depends on the final nightCount
  const today = new Date().toDateString();
  if (localStorage.getItem(LS_DATE) !== today) {
    nightCount++;
    localStorage.setItem(LS_NIGHT, String(nightCount));
    localStorage.setItem(LS_DATE, today);
  }
  initNightPalette();
  generateWorld();
  generateStars();
  generateWisps();
  generateConstellations();

  gameInit();
  refreshHUD();
  filmInit();
  scheduleEvents();
}

// ── render loop ───────────────────────────────────────────────────────────────

let lastT = 0;
function draw(ts) {
  const t  = ts * 0.001;
  const dt = Math.min(t - lastT, 0.05);
  lastT = t;

  if (_expCharging) {
    const elapsed = (performance.now() - _expStartT) / 1000;
    // Oscillates 0→1→0 at randomised frequency so timing can't be memorised
    exposureLevel = 0.5 + 0.5 * Math.sin(elapsed * _expOscFreq * Math.PI * 2 - Math.PI / 2);
    updateSnapRing();
  }
  tickDustMult();

  if (!isDragging && !touchActive) {
    panX += velX * dt; panY += velY * dt;
    const f = Math.pow(0.92, 60 * dt);
    velX *= f; velY *= f;
    if (Math.abs(velX) < 0.08) velX = 0;
    if (Math.abs(velY) < 0.08) velY = 0;
  }

  const zoomLerp = 1 - Math.pow(0.87, 60 * dt);
  zoomLevel += (zoomTgt - zoomLevel) * zoomLerp;

  const lerpF = 1 - Math.pow(CAM_SMOOTH, 60 * dt);
  cam.x += (camTgt.x - cam.x) * lerpF;
  cam.y += (camTgt.y - cam.y) * lerpF;

  for (let i = seisms.length - 1; i >= 0; i--)
    if (t - seisms[i].born > 1.2) seisms.splice(i, 1);

  refreshVisibleChunks();

  // Star drift physics — velocity decays with friction, position updates permanently
  const friction = Math.pow(0.08, dt);
  for (const s of stars) {
    if (!s.driftVx && !s.driftVy) continue;
    s.wx += s.driftVx * dt;
    s.wy += s.driftVy * dt;
    s.driftVx *= friction;
    s.driftVy *= friction;
    if (Math.abs(s.driftVx) < 0.005 && Math.abs(s.driftVy) < 0.005) { s.driftVx = 0; s.driftVy = 0; }
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  drawDeepBackground();
  drawWisps(t);

  const scint = updateScintillation(t);
  drawStars(t, scint, seisms.length > 0);
  drawConstellations(t);
  drawDarkNebulae();
  drawForegroundFeatures(t);

  if (satellite) drawSatellite(t);
  else if (t >= nextSatellite) spawnSatellite(t);

  updateShower(t);
  updateAndDrawShooters(t);
  drawConstParticles(t);
  updateConstellationNukes(t);
  drawConstellationNebulae(t);
  drawNukeExplosions(t);
  drawCosmicRay(t);      // instant flash — drawn late so it's always visible

  // Nightly tint — thin colored lens over the full scene, unique per calendar night
  ctx.fillStyle = `rgba(${NIGHT.tintRgb},${NIGHT.tintA.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);

  drawBoostEffect(t);    // photo boost rings
  drawMarketIndicators(t);
  drawDustFloats(t);
  drawAurora(t);         // all-found overlay last

  requestAnimationFrame(draw);
}

window.addEventListener('resize', init);
init();
requestAnimationFrame(draw);
initTimer();

// ── console commands ──────────────────────────────────────────────────────────

function _spawnConstellation(type) {
  // Reverse-map current view center to a fractional world position so the
  // constellation appears right in front of the camera.
  const ww = W * CONST_WORLD, wh = H * CONST_WORLD;
  const sx = (((W * 0.5 + panX - cam.x) / ww) % 1 + 1) % 1;
  const sy = (((H * 0.5 + panY - cam.y) / wh) % 1 + 1) % 1;
  const pat = PATTERNS[type];
  const fresh = { type, sx, sy, depth: 1.0, stars: jitterPattern(pat), lines: pat.lines, size: pat.size || 1.0 };
  const idx = constellations.findIndex(c => c.type === type);
  if (idx >= 0) constellations[idx] = fresh; else constellations.push(fresh);
  // Reset any destroyed state so it's fully visible
  dimmedConsts.delete(type);
  for (let i = constellationNukes.length - 1; i >= 0; i--)
    if (constellationNukes[i].type === type) constellationNukes.splice(i, 1);
}

window.sky = {
  shower()        { const t = performance.now()*0.001; showerActive = true; showerEnd = t + 38; showToast('✦  Pluie de météores', 3500); _trigger('nudge'); },
  ray()           { spawnCosmicRay(performance.now()*0.001); },
  seism()         { spawnSeism(W/2, H/2); },
  nuke()          { nukeMode = !nukeMode; document.getElementById('nuke-btn').classList.toggle('armed', nukeMode); document.getElementById('c').style.cursor = nukeMode ? 'crosshair' : 'grab'; },
  discover(name)  { if (!name) { console.log('Names: heart, louisa, lily, moon, kiss, butterfly, shark'); return; } discoveredSet.add(name); localStorage.setItem(LS_DISC, JSON.stringify([...discoveredSet])); refreshHUD(); showToast(`✦ ${name} découverte`, 2500); },
  reset()         { discoveredSet.clear(); dimmedConsts.clear(); constellationNukes.length = 0; fragTotal = 0; localStorage.removeItem(LS_DISC); localStorage.removeItem(LS_FRAGS); updateFragHUD(); refreshHUD(); showToast('Remise à zéro', 2000); },
  heart()         { _spawnConstellation('heart');     showToast('✦ cœur invoqué', 2000); },
  louisa()        { _spawnConstellation('louisa');    showToast('✦ louisa invoquée', 2000); },
  lily()          { _spawnConstellation('lily');      showToast('✦ lily invoquée', 2000); },
  moon()          { _spawnConstellation('moon');      showToast('✦ lune invoquée', 2000); },
  kiss()          { _spawnConstellation('kiss');      showToast('✦ bisou invoqué', 2000); },
  butterfly()     { _spawnConstellation('butterfly'); showToast('✦ papillon invoqué', 2000); },
  shark()         { _spawnConstellation('shark');     showToast('✦ requin invoqué', 2000); },
  timerReset()    { localStorage.setItem(LS_PLAYTIME, '0'); localStorage.setItem(LS_PLAYDAY, timerGetToday()); timerUsedToday = 0; timerSessionStart = Date.now(); timerExpired = false; timerWarned = false; document.body.classList.remove('sky-expired'); timerUpdateHUD(DAY_LIMIT); document.getElementById('timer-expired').classList.remove('visible'); showToast('Minuterie réinitialisée — 5:00', 2500); },
  timerFinish()   { timerSave(); timerShowExpired(); },
  timerSet(mins)  { if (typeof mins !== 'number' || mins < 0) { console.log('Usage: sky.timerSet(minutes) — e.g. sky.timerSet(2)'); return; } const secs = Math.min(DAY_LIMIT, Math.max(0, Math.round(mins * 60))); timerUsedToday = DAY_LIMIT - secs; timerSessionStart = Date.now(); localStorage.setItem(LS_PLAYTIME, String(timerUsedToday)); timerExpired = false; timerWarned = false; timerActive = true; document.body.classList.remove('sky-expired'); document.getElementById('timer-expired').classList.remove('visible'); timerUpdateHUD(secs); showToast(`Minuterie → ${mins} min`, 2500); },
  nightReset()    { nightCount = 0; localStorage.setItem(LS_NIGHT, '0'); localStorage.removeItem(LS_DATE); initNightPalette(); generateWisps(); refreshHUD(); showToast('Nuit réinitialisée → Nuit 0', 2000); },
  setNight(n)     { if (typeof n !== 'number' || n < 0) { console.log('Usage: sky.setNight(n) — e.g. sky.setNight(5)'); return; } nightCount = Math.round(n); localStorage.setItem(LS_NIGHT, String(nightCount)); localStorage.setItem(LS_DATE, new Date().toDateString()); initNightPalette(); generateWisps(); refreshHUD(); showToast(`Nuit → ${nightCount}`, 2000); },
  giveDust(n)            { if (typeof n !== 'number' || n < 0) { console.log('Usage: sky.giveDust(amount) — e.g. sky.giveDust(500)'); return; } earnDust(Math.round(n)); showToast(`✦ +${Math.round(n)} poussière`, 2000); },
  giveFrag(n=1)          { for (let i = 0; i < Math.round(n); i++) earnFrag(); showToast(`✧ +${Math.round(n)} éclat${n > 1 ? 's' : ''}`, 2000); },
  infiniteRessources()   { earnDust(99999); for (let i = 0; i < 999; i++) earnFrag(); showToast('✦✧ Ressources infinies activées', 2500); },
  help()                 { console.log('sky.shower() | sky.ray() | sky.seism() | sky.nuke() | sky.heart() | sky.louisa() | sky.lily() | sky.moon() | sky.kiss() | sky.butterfly() | sky.shark() | sky.discover(name) | sky.reset() | sky.giveDust(n) | sky.giveFrag(n) | sky.infiniteRessources() | sky.timerReset() | sky.timerFinish() | sky.timerSet(mins) | sky.nightReset() | sky.setNight(n)'); },
};

// ── screenshot ────────────────────────────────────────────────────────────────

// ── snap: film roll + long exposure ───────────────────────────────────────────

const _snapBtn = document.getElementById('snap');
let   _snapDown = false;

_snapBtn.addEventListener('pointerdown', e => {
  if (shotsLeft <= 0) {
    if (fragTotal >= 1) {
      document.getElementById('refill-frag-count').textContent = fragTotal;
      document.getElementById('refill-btn').disabled = false;
      document.getElementById('refill-overlay').classList.add('open');
    } else {
      showToast('Plus de pellicule — reviens demain ✦', 2500);
    }
    return;
  }
  e.preventDefault();
  _snapDown    = true;
  _expCharging = true;
  _expStartT   = performance.now();
  _expOscFreq  = 0.28 + Math.random() * 0.42; // 0.28–0.70 Hz, randomised each press
  exposureLevel = 0;
  updateSnapRing();
  _snapBtn.setPointerCapture(e.pointerId);
});

function _doSnap() {
  if (!_snapDown) return;
  _snapDown    = false;
  _expCharging = false;
  const captured = exposureLevel;
  exposureLevel  = 0;
  updateSnapRing();

  if (!filmConsume()) return;

  const flash = document.getElementById('snap-flash');
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');

  // Apply dust multiplier based on how close to peak the exposure was
  const isPeak = captured >= 0.82;
  activateDustMult(isPeak ? 2.0 : 1.5, 10);

  canvas.toBlob(blob => galSavePhoto(blob, captured), 'image/png');
}

_snapBtn.addEventListener('pointerup',     _doSnap);
_snapBtn.addEventListener('pointercancel', () => {
  _snapDown = false; _expCharging = false;
  exposureLevel = 0; updateSnapRing();
});

document.getElementById('refill-btn').addEventListener('click', () => {
  if (fragTotal < 1) return;
  spendFrag();
  shotsLeft++;
  localStorage.setItem(LS_FILMSHOTS, String(shotsLeft));
  filmUpdateUI();
  document.getElementById('refill-overlay').classList.remove('open');
  showToast('✧ Pellicule rechargée !', 2000);
});
document.getElementById('refill-cancel').addEventListener('click', () => {
  document.getElementById('refill-overlay').classList.remove('open');
});
