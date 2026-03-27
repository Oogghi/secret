// ── audio ──────────────────────────────────────────────────────────────────────

let audioCtx   = null;
let audioGain  = null; // master gain node
let audioReady = false;

function initAudio() {
  if (audioReady) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  audioReady = true;
  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();

    // SFX gain node (chimes, explosions) — intentionally quiet
    audioGain = audioCtx.createGain();
    audioGain.gain.setValueAtTime(0, audioCtx.currentTime);
    audioGain.gain.linearRampToValueAtTime(0.10, audioCtx.currentTime + 5);
    audioGain.connect(audioCtx.destination);

    // Ambient music — own gain chain, bypasses the quiet SFX gain
    const ambientEl = new Audio('space_sound.mp3');
    ambientEl.loop = true;
    ambientEl.crossOrigin = 'anonymous';
    const ambientSrc = audioCtx.createMediaElementSource(ambientEl);
    const ambientGain = audioCtx.createGain();
    ambientGain.gain.setValueAtTime(0, audioCtx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 5);
    ambientSrc.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
    ambientEl.play().catch(() => {});

  } catch(e) {}
}

// Shared oscillator chord builder — stagger in seconds, peakGain, decay and stop times relative to each note's t0
function _playOscChord(notes, stagger, peakGain, decayAt, stopAt) {
  if (!audioCtx) return;
  notes.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    const t0 = audioCtx.currentTime + i * stagger;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peakGain, t0 + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + decayAt);
    osc.connect(env); env.connect(audioGain);
    osc.start(t0); osc.stop(t0 + stopAt);
  });
}

function playChime() {
  _playOscChord([523.25, 659.25, 783.99], 0.14, 0.22, 2.0, 2.1); // C5 E5 G5
}

function playAllFoundChime() {
  _playOscChord([523.25, 659.25, 783.99, 1046.5], 0.22, 0.28, 3.5, 3.8); // C5 E5 G5 C6 — longer, more majestic
}

// Waveshaper distortion curve (soft-clip saturation)
function _distCurve(amount) {
  const n = 512, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return c;
}

// White-noise buffer source
function _noiseBuffer(seconds) {
  const len = Math.round(audioCtx.sampleRate * seconds);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  return src;
}

function playNukeExplosion(strength) {
  if (!audioCtx) return;
  const t0  = audioCtx.currentTime;
  const vol = Math.min(1.4, 0.65 + strength * 0.45);

  // 1 — Sub-bass punch: sine sweep 65 Hz → 22 Hz, gut-punch feel
  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(65, t0);
  sub.frequency.exponentialRampToValueAtTime(22, t0 + 1.0);
  const subG = audioCtx.createGain();
  subG.gain.setValueAtTime(0, t0);
  subG.gain.linearRampToValueAtTime(vol * 1.1, t0 + 0.006);
  subG.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
  sub.connect(subG); subG.connect(audioGain);
  sub.start(t0); sub.stop(t0 + 2.3);

  // 2 — Hard crack: very short noise burst through distortion + highpass
  const crackSrc = _noiseBuffer(0.06);
  const crackHpf = audioCtx.createBiquadFilter();
  crackHpf.type = 'highpass'; crackHpf.frequency.value = 1800;
  const crackDist = audioCtx.createWaveShaper();
  crackDist.curve = _distCurve(600);
  const crackG = audioCtx.createGain();
  crackG.gain.setValueAtTime(vol * 1.0, t0);
  crackG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.055);
  crackSrc.connect(crackHpf); crackHpf.connect(crackDist); crackDist.connect(crackG); crackG.connect(audioGain);
  crackSrc.start(t0);

  // 3 — Body boom: mid-low noise, saturated, long decay
  const boomSrc  = _noiseBuffer(3.5);
  const boomLpf  = audioCtx.createBiquadFilter();
  boomLpf.type = 'lowpass'; boomLpf.frequency.value = 320; boomLpf.Q.value = 1.8;
  boomLpf.frequency.setValueAtTime(320, t0);
  boomLpf.frequency.exponentialRampToValueAtTime(60, t0 + 3.0);
  const boomDist = audioCtx.createWaveShaper();
  boomDist.curve = _distCurve(180);
  const boomG = audioCtx.createGain();
  boomG.gain.setValueAtTime(0, t0);
  boomG.gain.linearRampToValueAtTime(vol * 0.65, t0 + 0.015);
  boomG.gain.setValueAtTime(vol * 0.65, t0 + 0.08);
  boomG.gain.exponentialRampToValueAtTime(0.001, t0 + 3.4);
  boomSrc.connect(boomLpf); boomLpf.connect(boomDist); boomDist.connect(boomG); boomG.connect(audioGain);
  boomSrc.start(t0);

  // 4 — Debris whoosh: bandpass noise sweeping downward (like shrapnel flying past)
  const debSrc = _noiseBuffer(2.2);
  const debBpf = audioCtx.createBiquadFilter();
  debBpf.type = 'bandpass'; debBpf.Q.value = 1.2;
  debBpf.frequency.setValueAtTime(1400, t0 + 0.03);
  debBpf.frequency.exponentialRampToValueAtTime(180, t0 + 2.0);
  const debG = audioCtx.createGain();
  debG.gain.setValueAtTime(0, t0 + 0.02);
  debG.gain.linearRampToValueAtTime(vol * 0.40, t0 + 0.06);
  debG.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
  debSrc.connect(debBpf); debBpf.connect(debG); debG.connect(audioGain);
  debSrc.start(t0);

  // 5 — High sizzle / plasma crackle (brief fizz right at impact)
  const sizzSrc = _noiseBuffer(0.18);
  const sizzHpf = audioCtx.createBiquadFilter();
  sizzHpf.type = 'highpass'; sizzHpf.frequency.value = 6000;
  const sizzG = audioCtx.createGain();
  sizzG.gain.setValueAtTime(vol * 0.55, t0);
  sizzG.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
  sizzSrc.connect(sizzHpf); sizzHpf.connect(sizzG); sizzG.connect(audioGain);
  sizzSrc.start(t0);

  // 6 — Resonant ring: metallic sine that blooms then fades (the "space" quality)
  const ring = audioCtx.createOscillator();
  ring.type = 'sine';
  ring.frequency.setValueAtTime(55 + strength * 18, t0);
  ring.frequency.exponentialRampToValueAtTime(32, t0 + 2.5);
  const ringPeak = audioCtx.createBiquadFilter();
  ringPeak.type = 'peaking'; ringPeak.frequency.value = 80; ringPeak.gain.value = 10;
  const ringG = audioCtx.createGain();
  ringG.gain.setValueAtTime(0, t0 + 0.04);
  ringG.gain.linearRampToValueAtTime(vol * 0.35, t0 + 0.18);
  ringG.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8);
  ring.connect(ringPeak); ringPeak.connect(ringG); ringG.connect(audioGain);
  ring.start(t0 + 0.04); ring.stop(t0 + 3.0);
}
