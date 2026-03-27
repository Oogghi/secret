// ── canvas ─────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d', { alpha: false, desynchronized: true });
const dpr    = Math.min(window.devicePixelRatio || 1, 2);
let W, H;

// ── camera ─────────────────────────────────────────────────────────────────────

const cam    = { x: 0, y: 0 };
const camTgt = { x: 0, y: 0 };

// ── pan + zoom ─────────────────────────────────────────────────────────────────

let panX = 0, panY = 0;
let velX = 0, velY = 0;
let zoomLevel = 1, zoomTgt = 1;

let isDragging    = false;
let dragLastX     = 0, dragLastY = 0, dragLastT = 0;
let touchActive   = false;
let touchPrevX    = 0, touchPrevY = 0, touchPrevT = 0;
let isPinching    = false;
let pinchLastDist = 0;

// touch tap detection (mouse uses native 'click' event below)
let _touchTapX = 0, _touchTapY = 0, _touchTapT = 0, _touchMoved = false;

function applyDragDelta(dx, dy, dtMs) {
  const inv = 1 / zoomLevel;
  panX -= dx * inv; panY -= dy * inv;
  const dt = Math.max(dtMs, 4) / 1000;
  velX = velX * 0.4 + (-dx * inv / dt) * 0.6;
  velY = velY * 0.4 + (-dy * inv / dt) * 0.6;
}

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const delta   = -e.deltaY * (e.deltaMode === 1 ? 40 : 1) * 0.0008;
  const zoomNew = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTgt * Math.exp(delta)));
  panX += (e.clientX - W * 0.5) * (1 / zoomTgt - 1 / zoomNew);
  panY += (e.clientY - H * 0.5) * (1 / zoomTgt - 1 / zoomNew);
  zoomTgt = zoomNew;
}, { passive: false });

canvas.addEventListener('mousedown', e => {
  initAudio();
  if (nukeMode) { fireNuke(e.clientX, e.clientY, performance.now() * 0.001); return; }
  isDragging = true;
  dragLastX  = e.clientX; dragLastY = e.clientY; dragLastT = performance.now();
  velX = velY = 0; canvas.style.cursor = 'grabbing';
  spawnSeism(e.clientX, e.clientY);
});
window.addEventListener('mousemove', e => {
  if (!isDragging) {
    camTgt.x = ((e.clientX / W) - 0.5) * MAX_SHIFT;
    camTgt.y = ((e.clientY / H) - 0.5) * MAX_SHIFT;
    return;
  }
  const now = performance.now();
  applyDragDelta(e.clientX - dragLastX, e.clientY - dragLastY, now - dragLastT);
  dragLastX = e.clientX; dragLastY = e.clientY; dragLastT = now;
});
window.addEventListener('mouseup', () => {
  isDragging = false;
  canvas.style.cursor = nukeMode ? 'crosshair' : 'grab';
});
// Native click = reliable drag-vs-tap detection for mouse
canvas.addEventListener('click', e => {
  if (nukeMode) return; // nuke already fired on mousedown
  handleGameClick(e.clientX, e.clientY);
});

window.addEventListener('touchstart', e => {
  initAudio();
  if (e.touches.length === 2) {
    e.preventDefault();
    isPinching = true; touchActive = false;
    const t0 = e.touches[0], t1 = e.touches[1];
    pinchLastDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    return;
  }
  if (isPinching) return;
  _trigger('light');
  _touchTapX = e.touches[0].clientX; _touchTapY = e.touches[0].clientY;
  _touchTapT = performance.now(); _touchMoved = false;
  if (nukeMode) { fireNuke(e.touches[0].clientX, e.touches[0].clientY, performance.now() * 0.001); return; }
  spawnSeism(e.touches[0].clientX, e.touches[0].clientY);
  touchActive = true;
  touchPrevX = e.touches[0].clientX; touchPrevY = e.touches[0].clientY;
  touchPrevT = performance.now(); velX = velY = 0;
}, { passive: false });

window.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault();
    const t0 = e.touches[0], t1 = e.touches[1];
    const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    if (pinchLastDist > 0) {
      const pcx     = (t0.clientX + t1.clientX) * 0.5;
      const pcy     = (t0.clientY + t1.clientY) * 0.5;
      const zoomNew = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTgt * (newDist / pinchLastDist)));
      panX += (pcx - W * 0.5) * (1 / zoomTgt - 1 / zoomNew);
      panY += (pcy - H * 0.5) * (1 / zoomTgt - 1 / zoomNew);
      zoomTgt = zoomNew;
    }
    pinchLastDist = newDist;
    return;
  }
  if (isPinching || !touchActive) return;
  if (Math.hypot(e.touches[0].clientX - _touchTapX, e.touches[0].clientY - _touchTapY) > 10) _touchMoved = true;
  const now = performance.now();
  applyDragDelta(e.touches[0].clientX - touchPrevX, e.touches[0].clientY - touchPrevY, now - touchPrevT);
  touchPrevX = e.touches[0].clientX; touchPrevY = e.touches[0].clientY; touchPrevT = now;
}, { passive: false });

window.addEventListener('touchend', e => {
  if (e.touches.length < 2) { isPinching = false; pinchLastDist = 0; }
  if (e.touches.length === 0) {
    if (!nukeMode && !_touchMoved && (performance.now() - _touchTapT) < 500) {
      handleGameClick(_touchTapX, _touchTapY);
    }
    touchActive = false;
  }
}, { passive: true });

// ── gyroscope / orientation ───────────────────────────────────────────────────
// Prefer the modern Generic Sensor API (no deprecation warning).
// Fall back to the legacy deviceorientation event when unavailable (e.g. iOS Safari).

function applyTilt(beta, gamma, ref) {
  camTgt.x = (Math.max(-20, Math.min(20, gamma - ref.gamma)) / 20) * MAX_SHIFT;
  camTgt.y = (Math.max(-20, Math.min(20, beta  - ref.beta))  / 20) * MAX_SHIFT;
}

function attachGyroModern() {
  // RelativeOrientationSensor — supported in Chrome/Android, avoids deprecation
  const sensor = new RelativeOrientationSensor({ frequency: 30, referenceFrame: 'device' });
  let ref = null;
  sensor.addEventListener('reading', () => {
    const [qx, qy, qz, qw] = sensor.quaternion;
    // Quaternion → tilt angles equivalent to beta / gamma
    const beta  = Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qx - qy * qz)))) * (180 / Math.PI);
    const gamma = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * (180 / Math.PI);
    if (!ref) { ref = { beta, gamma }; return; }
    applyTilt(beta, gamma, ref);
  });
  sensor.addEventListener('error', () => attachGyroLegacy()); // fall back on error
  sensor.start();
}

function attachGyroLegacy() {
  let ref = null;
  window.addEventListener('deviceorientation', e => {
    if (e.beta === null || e.gamma === null) return;
    if (!ref) { ref = { beta: e.beta, gamma: e.gamma }; return; }
    applyTilt(e.beta, e.gamma, ref);
  });
}

function initGyro() {
  if ('RelativeOrientationSensor' in window) {
    // Generic Sensor API — request permissions then start
    Promise.all([
      navigator.permissions.query({ name: 'accelerometer' }),
      navigator.permissions.query({ name: 'gyroscope' }),
    ]).then(([a, g]) => {
      if (a.state !== 'denied' && g.state !== 'denied') attachGyroModern();
      else attachGyroLegacy();
    }).catch(() => attachGyroModern()); // try anyway if permissions API missing
  } else if (typeof DeviceOrientationEvent !== 'undefined' &&
             typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS Safari — requires explicit user gesture to request permission
    window.addEventListener('touchstart', () => {
      DeviceOrientationEvent.requestPermission()
        .then(s => { if (s === 'granted') attachGyroLegacy(); })
        .catch(() => {});
    }, { once: true });
  } else {
    attachGyroLegacy();
  }
}
initGyro();

// ── coordinate transforms ──────────────────────────────────────────────────────

function worldToScreen(wx, wy) {
  const zx  = W * 0.5 + (wx - W * 0.5) * zoomLevel;
  const zy  = H * 0.5 + (wy - H * 0.5) * zoomLevel;
  const fdx = zx - W * 0.5, fdy = zy - H * 0.5;
  const r2  = (fdx * fdx + fdy * fdy) / (W * W * 0.25 + H * H * 0.25);
  const ff  = 1 + FISHEYE * r2;
  return [W * 0.5 + fdx * ff, H * 0.5 + fdy * ff];
}

function screenToWorld(sx, sy) {
  const fdx   = sx - W * 0.5, fdy = sy - H * 0.5;
  const r2    = (fdx * fdx + fdy * fdy) / (W * W * 0.25 + H * H * 0.25);
  const ff    = 1 + FISHEYE * r2;
  const preFx = W * 0.5 + fdx / ff;
  const preFy = H * 0.5 + fdy / ff;
  return [W * 0.5 + (preFx - W * 0.5) / zoomLevel, H * 0.5 + (preFy - H * 0.5) / zoomLevel];
}

// ── seism ──────────────────────────────────────────────────────────────────────

const seisms = [];
function spawnSeism(screenX, screenY) {
  const [wx, wy] = screenToWorld(screenX, screenY);
  seisms.push({ cx: wx, cy: wy, born: performance.now() * 0.001 });
}
function seismDisp(wx, wy, depth, t) {
  let tx = 0, ty = 0;
  for (const s of seisms) {
    const age = t - s.born;
    if (age <= 0 || age > 1.2) continue;
    const dx = wx - s.cx, dy = wy - s.cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1 || d2 > 102400) continue;
    const d = Math.sqrt(d2);
    const jitter = (Math.sin(wx * 0.087 + wy * 0.053) * 0.5 +
                    Math.sin(wx * 0.031 - wy * 0.119) * 0.5) * 0.055;
    const phase = age - d / 380 + jitter;
    if (phase < 0) continue;
    const radial = 22 * depth * (1 - d / 320) * Math.exp(-9 * phase);
    const swirl  = radial * 0.25 * Math.sin(wx * 0.061 + wy * 0.043 + 1.3);
    const nx = dx / d, ny = dy / d;
    tx += radial * nx + swirl * (-ny);
    ty += radial * ny + swirl * nx;
  }
  return [tx, ty];
}
