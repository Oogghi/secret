// ── seeded PRNG (mulberry32) — stable star positions per night ────────────────

function mulberry32(seed) {
  let a = (seed * 1664525 + 1013904223) >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── star colors ────────────────────────────────────────────────────────────────

const STAR_COL = [
  '155,185,255', // 0 blue-white  (O/B — hot, rare)
  '255,255,255', // 1 white        (A/F — common)
  '255,252,225', // 2 yellow-white (G   — sun-like)
  '255,210,140', // 3 orange       (K   — cooler)
  '255,128,60',  // 4 red-orange   (M giant — rare, large)
];
function pickColorType(r) {
  if (r < 0.03) return 0;
  if (r < 0.42) return 1;
  if (r < 0.77) return 2;
  if (r < 0.95) return 3;
  return 4;
}

// ── constellation patterns ─────────────────────────────────────────────────────

const PATTERNS = {
  heart: {
    stars: [
      {x:0,   y:-42, b:1.0},
      {x:-56, y:-82, b:0.9},
      {x:57,  y:-79, b:0.9},
      {x:-97, y:-36, b:0.7},
      {x:96,  y:-40, b:0.7},
      {x:-66, y:20,  b:0.8},
      {x:67,  y:17,  b:0.8},
      {x:2,   y:85,  b:1.0},
    ],
    lines: [[3,1],[1,0],[0,2],[2,4],[3,5],[5,7],[7,6],[6,4]],
  },
  louisa: {
    stars: [
      // L
      {x:-243, y:-48, b:0.9}, {x:-244, y:52,  b:1.0}, {x:-191, y:50,  b:0.8},
      // O
      {x:-129, y:-54, b:0.9}, {x:-91,  y:2,   b:0.7}, {x:-131, y:56,  b:0.9}, {x:-168, y:-1,  b:0.7},
      // U
      {x:-69,  y:-48, b:0.8}, {x:-71,  y:27,  b:0.7}, {x:-34,  y:60,  b:1.0}, {x:3,    y:26,  b:0.7}, {x:1,    y:-49, b:0.8},
      // I
      {x:29,   y:-49, b:0.9}, {x:31,   y:51,  b:0.9},
      // S
      {x:122,  y:-44, b:0.8}, {x:64,   y:-51, b:0.9}, {x:61,   y:1,   b:0.7}, {x:123,  y:6,   b:0.7}, {x:125,  y:46,  b:0.8}, {x:63,   y:53,  b:0.9},
      // A
      {x:153,  y:51,  b:0.9}, {x:198,  y:-54, b:1.0}, {x:244,  y:51,  b:0.9}, {x:166,  y:16,  b:0.7}, {x:231,  y:16,  b:0.7},
    ],
    lines: [
      [0,1],[1,2],
      [3,4],[4,5],[5,6],[6,3],
      [7,8],[8,9],[9,10],[10,11],
      [12,13],
      [14,15],[15,16],[16,17],[17,18],[18,19],
      [20,21],[21,22],[23,24],
    ],
  },
  moon: {
    size: 1.6,
    jitter: 3,   // near-zero jitter so the ring stays perfectly circular
    stars: [
      // ── outer ring (24 stars, radius 100, every 15°) ───────────────────────
      {x: 100, y:   0, b:1.00, col:'blood'},  // 0
      {x:  97, y:  26, b:0.95, col:'blood'},  // 1
      {x:  87, y:  50, b:0.90, col:'blood'},  // 2
      {x:  71, y:  71, b:0.88, col:'blood'},  // 3
      {x:  50, y:  87, b:0.90, col:'blood'},  // 4
      {x:  26, y:  97, b:0.95, col:'blood'},  // 5
      {x:   0, y: 100, b:1.00, col:'blood'},  // 6
      {x: -26, y:  97, b:0.95, col:'blood'},  // 7
      {x: -50, y:  87, b:0.90, col:'blood'},  // 8
      {x: -71, y:  71, b:0.88, col:'blood'},  // 9
      {x: -87, y:  50, b:0.90, col:'blood'},  // 10
      {x: -97, y:  26, b:0.95, col:'blood'},  // 11
      {x:-100, y:   0, b:1.00, col:'blood'},  // 12
      {x: -97, y: -26, b:0.95, col:'blood'},  // 13
      {x: -87, y: -50, b:0.90, col:'blood'},  // 14
      {x: -71, y: -71, b:0.88, col:'blood'},  // 15
      {x: -50, y: -87, b:0.90, col:'blood'},  // 16
      {x: -26, y: -97, b:0.95, col:'blood'},  // 17
      {x:   0, y:-100, b:1.00, col:'blood'},  // 18
      {x:  26, y: -97, b:0.95, col:'blood'},  // 19
      {x:  50, y: -87, b:0.90, col:'blood'},  // 20
      {x:  71, y: -71, b:0.88, col:'blood'},  // 21
      {x:  87, y: -50, b:0.90, col:'blood'},  // 22
      {x:  97, y: -26, b:0.95, col:'blood'},  // 23
      // ── Mare Imbrium — large, irregular dark region, upper-left ───────────
      {x: -10, y: -55, b:0.68, col:'ember'},  // 24
      {x: -35, y: -48, b:0.65, col:'ember'},  // 25
      {x: -55, y: -32, b:0.68, col:'ember'},  // 26
      {x: -60, y:  -8, b:0.62, col:'ember'},  // 27
      {x: -48, y:  12, b:0.65, col:'ember'},  // 28
      {x: -20, y: -15, b:0.60, col:'ember'},  // 29
      // ── Mare Tranquilitatis — smaller, center-right ────────────────────────
      {x:  20, y: -22, b:0.68, col:'ember'},  // 30
      {x:  42, y: -15, b:0.65, col:'ember'},  // 31
      {x:  44, y:   8, b:0.62, col:'ember'},  // 32
      {x:  22, y:  12, b:0.65, col:'ember'},  // 33
      // ── Tycho crater — lower-center-right ─────────────────────────────────
      {x:  16, y:  48, b:0.80, col:'blood'},  // 34
      {x:  38, y:  40, b:0.75, col:'blood'},  // 35
      {x:  28, y:  60, b:0.78, col:'blood'},  // 36
      // ── Tycho ray tips — radiating outward ────────────────────────────────
      {x:  -2, y:  28, b:0.58, col:'halo'},   // 37 — ray toward center
      {x:  56, y:  22, b:0.56, col:'halo'},   // 38 — ray toward right
      {x:  50, y:  68, b:0.58, col:'halo'},   // 39 — ray toward lower-right
      // ── Aristarchus — bright isolated hot spot, upper-right ────────────────
      {x:  50, y: -58, b:0.82, col:'blood'},  // 40
      // ── center glow ────────────────────────────────────────────────────────
      {x:   0, y:   0, b:0.88, col:'core'},   // 41
    ],
    lines: [
      // outer ring
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],
      [12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,0],
      // Mare Imbrium (irregular hexagon, upper-left)
      [24,25],[25,26],[26,27],[27,28],[28,29],[29,24],
      // Mare Tranquilitatis (quad, center-right)
      [30,31],[31,32],[32,33],[33,30],
      // Tycho crater triangle
      [34,35],[35,36],[36,34],
      // Tycho rays radiating outward
      [34,37],[35,38],[36,39],
    ],
  },
  kiss: {
    jitter: 7,
    stars: [
      // upper lip — cupid's bow (left→right)
      {x: -78, y:   0, b:0.9,  col:'rose'},   // 0  left corner
      {x: -54, y: -16, b:0.8},                // 1  left flare
      {x: -27, y: -30, b:0.95, col:'rose'},   // 2  left peak
      {x:   0, y: -16, b:0.75},               // 3  center dip
      {x:  27, y: -30, b:0.95, col:'rose'},   // 4  right peak
      {x:  54, y: -16, b:0.8},                // 5  right flare
      {x:  78, y:   0, b:0.9,  col:'rose'},   // 6  right corner
      // lower lip — full rounded arc
      {x: -54, y:  18, b:0.8},                // 7  lower-left curve
      {x: -28, y:  40, b:0.85},               // 8  lower-left side
      {x:   0, y:  52, b:1.0,  col:'rose'},   // 9  bottom center
      {x:  28, y:  40, b:0.85},               // 10 lower-right side
      {x:  54, y:  18, b:0.8},                // 11 lower-right curve
    ],
    lines: [
      [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],        // upper lip
      [6,11],[11,10],[10,9],[9,8],[8,7],[7,0],     // lower lip
    ],
  },
  butterfly: {
    stars: [
      // body
      {x:   0, y: -40, b:0.9,  col:'purple'},  // 0 head
      {x:   0, y:   0, b:1.0,  col:'purple'},  // 1 thorax
      {x:   0, y:  40, b:0.8,  col:'purple'},  // 2 abdomen
      // upper-left wing
      {x: -25, y: -18, b:0.75},                // 3
      {x: -65, y: -42, b:0.95, col:'violet'},  // 4 tip
      {x: -85, y: -10, b:0.9,  col:'violet'},  // 5 outer
      {x: -62, y:  22, b:0.75},                // 6
      // upper-right wing
      {x:  25, y: -18, b:0.75},                // 7
      {x:  65, y: -42, b:0.95, col:'violet'},  // 8 tip
      {x:  85, y: -10, b:0.9,  col:'violet'},  // 9 outer
      {x:  62, y:  22, b:0.75},                // 10
      // lower-left wing
      {x: -28, y:  22, b:0.75},                // 11
      {x: -55, y:  42, b:0.85, col:'violet'},  // 12
      {x: -32, y:  62, b:0.8},                 // 13
      // lower-right wing
      {x:  28, y:  22, b:0.75},                // 14
      {x:  55, y:  42, b:0.85, col:'violet'},  // 15
      {x:  32, y:  62, b:0.8},                 // 16
    ],
    lines: [
      [0,1],[1,2],
      [1,3],[3,4],[4,5],[5,6],[6,1],
      [1,7],[7,8],[8,9],[9,10],[10,1],
      [1,11],[11,12],[12,13],[13,2],
      [1,14],[14,15],[15,16],[16,2],
    ],
  },

  shark: {
    jitter: 5,
    stars: [
      {x: 105, y:   2, b:1.0,  col:'teal'},   // 0  snout tip
      {x:  74, y: -24, b:0.82},               // 1  upper jaw
      {x:  74, y:  28, b:0.82},               // 2  lower jaw
      {x:  56, y: -12, b:0.95, col:'white'},  // 3  eye
      {x:  20, y: -34, b:0.72},               // 4  upper body
      {x:   4, y: -96, b:1.0,  col:'teal'},   // 5  dorsal fin tip (tall!)
      {x: -30, y: -30, b:0.80},               // 6  dorsal rear
      {x:  24, y:  62, b:0.90, col:'teal'},   // 7  pectoral fin tip
      {x:   6, y:  32, b:0.68},               // 8  pectoral base
      {x: -62, y: -22, b:0.72},               // 9  rear upper
      {x: -62, y:  26, b:0.72},               // 10 rear lower
      {x:-105, y: -55, b:0.94, col:'teal'},   // 11 tail top lobe
      {x: -90, y:   2, b:0.74},               // 12 tail notch
      {x:-105, y:  52, b:0.94, col:'teal'},   // 13 tail bottom lobe
    ],
    lines: [
      // Closed body outline
      [0,1],                // snout → upper jaw
      [1,4],[4,5],[5,6],    // upper body → dorsal fin up and back
      [6,9],[9,11],         // upper rear → tail top
      [11,12],[12,13],      // tail crescent
      [13,10],[10,2],       // lower rear → back to jaw
      [0,2],                // snout → lower jaw
      // Interior
      [9,10],               // rear body vertical
      [2,8],[8,7],          // pectoral fin
    ],
  },

  lily: {
    size: 1.2,
    stars: [
      {x:0,   y:0,   b:1.0,  col:'white'},
      {x:0,   y:-25, b:0.72, col:'white'},
      {x:-12, y:-54, b:0.82, col:'pink'},
      {x:12,  y:-54, b:0.82, col:'pink'},
      {x:0,   y:-62, b:0.78, col:'pink'},
      {x:-10, y:-79, b:0.88, col:'pink'},
      {x:10,  y:-79, b:0.88, col:'pink'},
      {x:2,   y:-100,b:1.0,  col:'fuchsia'},
      {x:22,  y:13,  b:0.72, col:'white'},
      {x:52,  y:16,  b:0.82, col:'pink'},
      {x:40,  y:37,  b:0.82, col:'pink'},
      {x:54,  y:31,  b:0.78, col:'pink'},
      {x:74,  y:32,  b:0.88, col:'pink'},
      {x:64,  y:48,  b:0.88, col:'pink'},
      {x:88,  y:49,  b:1.0,  col:'fuchsia'},
      {x:-22, y:13,  b:0.72, col:'white'},
      {x:-40, y:37,  b:0.82, col:'pink'},
      {x:-52, y:16,  b:0.82, col:'pink'},
      {x:-54, y:31,  b:0.78, col:'pink'},
      {x:-64, y:48,  b:0.88, col:'pink'},
      {x:-74, y:32,  b:0.88, col:'pink'},
      {x:-88, y:49,  b:1.0,  col:'fuchsia'},
      {x:17,  y:-10, b:0.65, col:'white'},
      {x:33,  y:-31, b:0.75, col:'pink'},
      {x:43,  y:-13, b:0.75, col:'pink'},
      {x:45,  y:-26, b:0.72, col:'pink'},
      {x:54,  y:-41, b:0.82, col:'pink'},
      {x:63,  y:-27, b:0.82, col:'pink'},
      {x:73,  y:-41, b:0.95, col:'fuchsia'},
      {x:0,   y:20,  b:0.65, col:'white'},
      {x:10,  y:44,  b:0.75, col:'pink'},
      {x:-10, y:44,  b:0.75, col:'pink'},
      {x:0,   y:52,  b:0.72, col:'pink'},
      {x:9,   y:67,  b:0.82, col:'pink'},
      {x:-9,  y:67,  b:0.82, col:'pink'},
      {x:0,   y:84,  b:0.95, col:'fuchsia'},
      {x:-17, y:-10, b:0.65, col:'white'},
      {x:-43, y:-13, b:0.75, col:'pink'},
      {x:-33, y:-31, b:0.75, col:'pink'},
      {x:-45, y:-26, b:0.72, col:'pink'},
      {x:-63, y:-27, b:0.82, col:'pink'},
      {x:-54, y:-41, b:0.82, col:'pink'},
      {x:-73, y:-41, b:0.95, col:'fuchsia'},
      {x:6,   y:-10, b:0.55, col:'white'},
      {x:12,  y:0,   b:0.55, col:'white'},
      {x:6,   y:10,  b:0.55, col:'white'},
      {x:-6,  y:10,  b:0.55, col:'white'},
      {x:-12, y:0,   b:0.55, col:'white'},
      {x:-6,  y:-10, b:0.55, col:'white'},
      {x:16,  y:-28, b:0.75, col:'fuchsia'},
      {x:32,  y:0,   b:0.75, col:'fuchsia'},
      {x:16,  y:28,  b:0.75, col:'fuchsia'},
      {x:-16, y:28,  b:0.75, col:'fuchsia'},
      {x:-32, y:0,   b:0.75, col:'fuchsia'},
      {x:-16, y:-28, b:0.75, col:'fuchsia'},
    ],
    lines: [
      [0,1], [1,2],[2,5],[5,7], [7,6],[6,3],[3,1], [1,4],[4,7],
      [0,8], [8,9],[9,12],[12,14], [14,13],[13,10],[10,8], [8,11],[11,14],
      [0,15], [15,16],[16,19],[19,21], [21,20],[20,17],[17,15], [15,18],[18,21],
      [0,22], [22,23],[23,26],[26,28], [28,27],[27,24],[24,22], [22,25],[25,28],
      [0,29], [29,30],[30,33],[33,35], [35,34],[34,31],[31,29], [29,32],[32,35],
      [0,36], [36,37],[37,40],[40,42], [42,41],[41,38],[38,36], [36,39],[39,42],
      [0,43],[43,49], [0,44],[44,50], [0,45],[45,51],
      [0,46],[46,52], [0,47],[47,53], [0,48],[48,54],
    ],
  },
};

let constellations = [];

// Apply random jitter and per-star animation parameters to a pattern
function jitterPattern(pat) {
  const jitter = pat.jitter ?? 14;
  return pat.stars.map(s => ({
    x:     s.x + (Math.random() - 0.5) * jitter,
    y:     s.y + (Math.random() - 0.5) * jitter,
    b:     s.b,
    col:   s.col,
    phase: Math.random() * Math.PI * 2,
    freq:  0.22 + Math.random() * 0.38,
  }));
}

function generateConstellations() {
  const rng = mulberry32(nightCount * 11111 + 33333);
  constellations = [];
  for (const type of ['louisa', 'heart', 'lily', 'moon', 'kiss', 'butterfly', 'shark']) {
    const pat = PATTERNS[type];
    constellations.push({ type, sx: rng(), sy: rng(), depth: 1.0,
                          stars: jitterPattern(pat), lines: pat.lines, size: pat.size || 1.0 });
  }
}

let varStars  = [];
let snrList   = [];
let gSmudges  = [];
let darkNebs  = [];

function generateWorld() {
  varStars = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const red = Math.random() < 0.55;
    const r = 255, g = red ? 70 + Math.random() * 80 | 0 : 205 + Math.random() * 40 | 0;
    const b = red ? 25 : 100 + Math.random() * 60 | 0;
    varStars.push({
      sx: Math.random(), sy: Math.random(),
      depth:    0.82 + Math.random() * 0.36,
      period:   5 + Math.random() * 9,
      phaseOff: Math.random() * Math.PI * 2,
      base:     0.65 + Math.random() * 0.55,
      rgb:      `${r},${g},${b}`,
    });
  }

  snrList = [];
  const snCount = 1 + (Math.random() < 0.55 ? 1 : 0);
  for (let i = 0; i < snCount; i++) {
    const r = 215 + Math.random() * 40 | 0;
    const g = 70  + Math.random() * 90 | 0;
    snrList.push({
      sx: Math.random(), sy: Math.random(),
      depth:  0.95,
      radius: 160 + Math.random() * 180,
      rgb:    `${r},${g},30`,
      alpha:  0.020 + Math.random() * 0.030,
    });
  }

  gSmudges = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    gSmudges.push({
      sx: Math.random(), sy: Math.random(),
      depth: 0.08 + Math.random() * 0.14,
      rx:    65 + Math.random() * 130,
      ry:    22 + Math.random() * 52,
      rot:   Math.random() * Math.PI,
      alpha: 0.032 + Math.random() * 0.050,
    });
  }

  darkNebs = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    darkNebs.push({
      sx: Math.random(), sy: Math.random(),
      depth: 0.90 + Math.random() * 0.20,
      rx:    110 + Math.random() * 220,
      ry:    70  + Math.random() * 150,
      rot:   Math.random() * Math.PI,
      alpha: 0.10 + Math.random() * 0.18,
    });
  }

}

function forEachFeatureTile(feat, margin, cb) {
  const ww = W * WORLD_SCALE, wh = H * WORLD_SCALE;
  const bx = ((feat.sx * ww - panX * feat.depth + cam.x * feat.depth) % ww + ww) % ww;
  const by = ((feat.sy * wh - panY * feat.depth + cam.y * feat.depth) % wh + wh) % wh;
  const hw = W * 0.5, hh = H * 0.5;
  const visX0 = hw - hw / zoomLevel, visX1 = hw + hw / zoomLevel;
  const visY0 = hh - hh / zoomLevel, visY1 = hh + hh / zoomLevel;
  const kx0 = Math.floor((visX0 - margin - bx) / ww);
  const kx1 = Math.floor((visX1 + margin - bx) / ww);
  const ky0 = Math.floor((visY0 - margin - by) / wh);
  const ky1 = Math.floor((visY1 + margin - by) / wh);
  for (let ky = ky0; ky <= ky1; ky++) {
    for (let kx = kx0; kx <= kx1; kx++) {
      const [sx, sy] = worldToScreen(bx + kx * ww, by + ky * wh);
      cb(sx, sy);
    }
  }
}

let wisps = [];
function generateWisps() {
  wisps = [];
  for (let i = 0; i < 5 + Math.floor(Math.random() * 3); i++) {
    const c = NIGHT.wispColors[Math.floor(Math.random() * NIGHT.wispColors.length)];
    wisps.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 180 + Math.random() * 280, r2: 350 + Math.random() * 400,
      alpha: 0.012 + Math.random() * 0.018,
      cr: c[0], cg: c[1], cb: c[2],
      pFreq: 0.008 + Math.random() * 0.012, pPhase: Math.random() * Math.PI * 2,
    });
  }
}

// ── infinite chunk-based star system ──────────────────────────────────────────
// Stars are generated on-demand per viewport-sized chunk using a coordinate
// hash seed, so the world is effectively infinite with no visible tiling.

const CHUNK_STARS  = 300;  // stars per viewport-sized chunk
const CHUNK_BUFFER = 2;    // chunks loaded in each direction around camera

const _chunkCache = new Map();
let   _lastCx = null, _lastCy = null;

function _chunkSeed(cx, cy) {
  let h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
  return h || 1;
}

function _makeChunkStars(cx, cy) {
  const rng    = mulberry32(_chunkSeed(cx, cy));
  const result = [];
  const baseX  = cx * W, baseY = cy * H;
  for (let i = 0; i < CHUNK_STARS; i++) {
    const r = rng();
    let base = r < 0.70 ? 0.15 + rng() * 0.28
             : r < 0.92 ? 0.43 + rng() * 0.44
             :             0.87 + rng() * 0.95;
    const colorIdx = pickColorType(rng());
    if (colorIdx === 0 && rng() < 0.25) base *= 1.55;
    if (colorIdx === 4 && rng() < 0.45) base *= 1.85;
    result.push({
      wx:         baseX + rng() * W,
      wy:         baseY + rng() * H,
      base, colorIdx, rgb: STAR_COL[colorIdx],
      brightness: 0.25 + rng() * 0.75,
      depth:      0.70 + rng() * 0.60,
      oFreq:  0.06 + rng() * 0.16, oPhase: rng() * Math.PI * 2, oAmp: 0.18 + rng() * 0.28,
      sFreq:  0.04 + rng() * 0.11, sPhase: rng() * Math.PI * 2, sAmp: 0.15 + rng() * 0.30,
    });
  }
  return result;
}

function refreshVisibleChunks() {
  const cx = Math.floor((panX + W * 0.5) / W);
  const cy = Math.floor((panY + H * 0.5) / H);
  if (cx === _lastCx && cy === _lastCy) return;
  _lastCx = cx; _lastCy = cy;

  const B = CHUNK_BUFFER;
  const needed = new Set();
  for (let dy = -B; dy <= B; dy++)
    for (let dx = -B; dx <= B; dx++)
      needed.add(`${cx + dx},${cy + dy}`);

  for (const key of _chunkCache.keys())
    if (!needed.has(key)) _chunkCache.delete(key);

  stars = [];
  for (const key of needed) {
    if (!_chunkCache.has(key)) {
      const [kx, ky] = key.split(',').map(Number);
      _chunkCache.set(key, _makeChunkStars(kx, ky));
    }
    for (const s of _chunkCache.get(key)) stars.push(s);
  }
}

let stars = [];
function generateStars() {
  _chunkCache.clear();
  _lastCx = null;
  _lastCy = null;
  refreshVisibleChunks();
}
