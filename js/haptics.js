// ── haptics ────────────────────────────────────────────────────────────────────

let _hapticLabel = null;
function _ensureHapticDOM() {
  if (_hapticLabel) return;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.setAttribute('switch', '');
  cb.style.cssText = 'all:initial;appearance:auto;';
  _hapticLabel = document.createElement('label');
  _hapticLabel.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  _hapticLabel.appendChild(cb);
  document.body.appendChild(_hapticLabel);
}
_ensureHapticDOM();
const _patterns = {
  light: [{ t: 0, d: 15 }],
  soft:  [{ t: 0, d: 40 }],
  nudge: [{ t: 0, d: 80 }, { t: 160, d: 50 }],
};
function _trigger(preset) {
  const taps = _patterns[preset] || _patterns.light;
  if (_hapticLabel) {
    _hapticLabel.click();
    for (let i = 1; i < taps.length; i++) setTimeout(() => _hapticLabel.click(), taps[i].t);
  } else if (navigator.vibrate) {
    const flat = []; let cursor = 0;
    for (const tap of taps) {
      const gap = tap.t - cursor;
      if (gap > 0) { if (flat.length > 0) flat.push(gap); else flat.push(0, gap); }
      flat.push(tap.d); cursor = tap.t + tap.d;
    }
    navigator.vibrate(flat);
  }
}
