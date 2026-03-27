// ── nightly sky palette ────────────────────────────────────────────────────────
// Evolves slowly each calendar night so every visit feels subtly unique.
// All values are deterministic from nightCount — no randomness here.

let NIGHT = {};

function initNightPalette() {
  // Deterministic per-night random values (same night always looks the same)
  const r0 = (Math.sin(nightCount * 127.1)          * 43758.5453) % 1;
  const r1 = (Math.sin(nightCount * 311.7 + 54.321) * 43758.5453) % 1;
  const r2 = (Math.sin(nightCount * 191.3 + 99.876) * 43758.5453) % 1;

  // Hue: slow drift + large random jump so consecutive nights can feel very different
  const hue  = (nightCount * 2.7 + 240 + r0 * 200) % 360;
  // Mood: sine wave + random intensity so some nights are vivid, others dim
  const mood = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(nightCount * 0.157) + (r1 - 0.5) * 0.7));

  // Minimal HSL → [r, g, b] helper
  function hsl(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const ch = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return [Math.round(ch(h + 1/3) * 255),
            Math.round(ch(h)       * 255),
            Math.round(ch(h - 1/3) * 255)];
  }

  // Full-screen tint — colored lens over the entire scene
  const [tr, tg, tb] = hsl(hue, 55, 12);
  NIGHT.tintRgb = `${tr},${tg},${tb}`;
  NIGHT.tintA   = 0.07 + mood * 0.09 + r2 * 0.05;

  // Wisp color family — five hues orbiting tonight's base hue
  NIGHT.wispColors = [
    hsl(hue,               75, 28),
    hsl((hue +  45) % 360, 65, 24),
    hsl((hue +  90) % 360, 70, 26),
    hsl((hue + 170) % 360, 60, 20),
    hsl((hue + 230) % 360, 68, 27),
  ];

  // Galaxy smudge tint — shifts from warm-white toward tonight's hue (stays pale)
  const [sr, sg, sb] = hsl((hue + 25) % 360, 20 + mood * 10, 95);
  NIGHT.smudgeRgb = `${sr},${sg},${sb}`;
}
