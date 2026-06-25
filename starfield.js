/* ============================================================
   GSV starfield — vanilla JS, no dependencies.
   Reads colours from your CSS token file at runtime.

   Tuning:
     DENSITY   — divisor on viewport area. ~9000 = subtle.
     MAX_STARS — hard cap regardless of screen size.
     SPARKLES  — pinned bright flashes. Never scales with density.
     FPS       — 30 is plenty for ambient.

   Button proximity effect:
     TRIGGER_ID      — id of the element that triggers the surge.
     TRIGGER_RADIUS  — px from button centre that arms the effect.
     SURGE_EXTRA     — extra ambient stars added during surge.
     SURGE_FADE_MS   — how long the surge takes to fade back out.
   ============================================================ */

(function () {
  var DENSITY        = 9000;
  var MAX_STARS      = 320;
  var SPARKLES       = 5;
  var FPS            = 15;
  var MONO           = "'Departure Mono','JetBrains Mono','IBM Plex Mono',monospace";

  var TRIGGER_ID     = 'gsv-github-btn';
  var TRIGGER_RADIUS = 50;
  var SURGE_EXTRA    = 8000;  // was 400
  var SURGE_FADE_MS  = 150;   // was 600 — snaps in fast
  var SPARKLES       = 5;     // leave this
  var DENSITY        = 5000;  // leave this

  var TIERS = [
    { w: 0.62, chars: ['\u00B7', '.'],  tok: '--text-dim',      fb: '#565199', a: [0.45, 0.80], sz: [16, 22] },
    { w: 0.24, chars: ['+', '*'],       tok: '--accent',        fb: '#b3aeff', a: [0.55, 0.90], sz: [20, 26] },
    { w: 0.14, chars: ['\u2022', '*'],  tok: '--accent-bright', fb: '#cbc7ff', a: [0.70, 1.00], sz: [20, 28] }
  ];

  var canvas = document.getElementById('gsv-starfield');
  if (!canvas) return;
  var ctx    = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr    = Math.min(window.devicePixelRatio || 1, 2);

  var root = getComputedStyle(document.documentElement);
  function tok(name, fb) { return root.getPropertyValue(name).trim() || fb; }
  var VOID  = tok('--void',          '#07061a');
  var GLOW1 = tok('--frame-hi',      '#161240');
  var GLOW2 = tok('--border-raised', '#4a449e');
  var MINT  = tok('--online',        '#5ef2a0');
  var SPK   = tok('--accent-bright', '#cbc7ff');

  function rnd(a, b)  { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[(Math.random() * arr.length) | 0]; }
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    return 'rgba(' + parseInt(h.slice(0,2),16) + ',' + parseInt(h.slice(2,4),16) + ',' + parseInt(h.slice(4,6),16) + ',' + a + ')';
  }
  function pickTier() {
    var r = Math.random(), acc = 0;
    for (var i = 0; i < TIERS.length; i++) { acc += TIERS[i].w; if (r <= acc) return TIERS[i]; }
    return TIERS[0];
  }
  function makeStar() {
    var t = pickTier();
    return {
      x:     Math.random() * W,
      y:     Math.random() * H,
      ch:    pick(t.chars),
      color: tok(t.tok, t.fb),
      base:  rnd(t.a[0], t.a[1]),
      sz:    rnd(t.sz[0], t.sz[1]),
      phase: Math.random() * Math.PI * 2,
      speed: rnd(0.4, 1.3),
      spark: false
    };
  }

  var W = 0, H = 0, raf = null, last = 0;
  var interval = 1000 / FPS;
  var mx = -9999, my = -9999;
  var btnCx = -9999, btnCy = -9999;

  // Two pools: base (always present) and surge (fade in/out)
  var baseStars  = [];
  var surgeStars = [];

  // Surge state — 0 = calm, 1 = full surge
  var surgeTarget = 0;  // what we're heading toward
  var surgeLevel  = 0;  // current interpolated level (0–1)

  function buildBase() {
    var n = Math.min(MAX_STARS, Math.round((W * H) / DENSITY));
    baseStars = [];
    for (var i = 0; i < n; i++) baseStars.push(makeStar());
    // sparkles always in base pool
    for (var j = 0; j < SPARKLES; j++) {
      baseStars.push({
        x: Math.random() * W, y: Math.random() * H,
        ch: pick(['\u2022', '+']),
        color: Math.random() < 0.5 ? MINT : SPK,
        base: rnd(0.55, 0.95), sz: rnd(24, 32),
        phase: Math.random() * Math.PI * 2, speed: rnd(0.9, 1.6) * 2.2, spark: true
      });
    }
  }
  function buildSurge() {
    surgeStars = [];
    for (var i = 0; i < SURGE_EXTRA; i++) surgeStars.push(makeStar());
  }

  function updateBtn() {
    var el = document.getElementById(TRIGGER_ID);
    if (!el) { btnCx = -9999; btnCy = -9999; return; }
    var r = el.getBoundingClientRect();
    btnCx = r.left + r.width  / 2;
    btnCy = r.top  + r.height / 2;
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBase(); buildSurge(); updateBtn();
  }

  function glow() {
    var g;
    g = ctx.createRadialGradient(W*0.32, H*0.4, 0, W*0.32, H*0.4, Math.max(W,H)*0.65);
    g.addColorStop(0, hexA(GLOW1, 0.55)); g.addColorStop(0.5, hexA(GLOW1, 0.20)); g.addColorStop(1, hexA(VOID, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W*0.82, H*0.8, 0, W*0.82, H*0.8, Math.max(W,H)*0.4);
    g.addColorStop(0, hexA(GLOW2, 0.14)); g.addColorStop(1, hexA(VOID, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W*0.5, H*0.42, 0, W*0.5, H*0.42, Math.max(W,H)*0.32);
    g.addColorStop(0, hexA(VOID, 0.45)); g.addColorStop(1, hexA(VOID, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawPool(pool, t, alphaScale) {
    for (var i = 0; i < pool.length; i++) {
      var s = pool[i], a = s.base;
      if (!reduce) {
        var raw = Math.sin(t * s.speed + s.phase);
        var q   = Math.round(raw * 1.5) / 1.5;        // snap to 4 discrete levels
        var osc = 0.45 + 0.55 * q;
        a = s.base * (s.spark ? osc * osc : osc);
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, a * alphaScale));
      ctx.fillStyle   = s.color;
      ctx.font        = s.sz.toFixed(1) + 'px ' + MONO;
      ctx.fillText(s.ch, s.x, s.y);
    }
  }

  function frame(now) {
    // proximity check — update surgeTarget
    if (!reduce && btnCx > 0) {
      var dx = mx - btnCx, dy = my - btnCy;
      surgeTarget = (dx * dx + dy * dy < TRIGGER_RADIUS * TRIGGER_RADIUS) ? 1 : 0;
    }

    // smoothly interpolate surgeLevel toward surgeTarget
    var step = (1000 / FPS) / SURGE_FADE_MS;
    if (surgeLevel < surgeTarget) surgeLevel = Math.min(1, surgeLevel + step);
    else if (surgeLevel > surgeTarget) surgeLevel = Math.max(0, surgeLevel - step);

    ctx.fillStyle = VOID; ctx.fillRect(0, 0, W, H);
    glow();
    ctx.textBaseline = 'middle';
    var t = (now || 0) / 1000;

    drawPool(baseStars,  t, 1);
    if (surgeLevel > 0) drawPool(surgeStars, t, surgeLevel);

    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < interval) return;
    last = now; frame(now);
  }
  function start() { if (reduce) { frame(0); return; } if (!raf) raf = requestAnimationFrame(loop); }
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  window.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
  window.addEventListener('scroll',    updateBtn, { passive: true });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  window.addEventListener('resize', function () { resize(); if (reduce) frame(0); });

  resize();
  start();
})();
