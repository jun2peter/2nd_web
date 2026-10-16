// Particle Text — a word drawn with thousands of particles that scatter from the pointer and flow back home.
// Canvas 2D: the text is rendered offscreen, sampled into home positions, then simulated with a damped spring.

export const meta = {
  name: "입자 텍스트",
  description: "수천 개의 입자로 그린 글자. 마우스(폰은 손가락)가 지나가면 흩어졌다가 천천히 제자리로 돌아와요. 한글도 돼요.",
  category: "text",
  defaultSize: { width: 1200, height: 520 },
  props: [
    { key: "text", label: "문구", type: "text", default: "ARCHIVE" },
    { key: "fontFamily", label: "글꼴", type: "text", default: 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' },
    { key: "fontWeight", label: "굵기", type: "range", min: 100, max: 900, step: 100, default: 800 },
    { key: "color", label: "색", type: "color", default: "#ff5a36" },
    { key: "particleSize", label: "입자 크기", type: "range", min: 0.6, max: 6, step: 0.1, default: 1.6 },
    { key: "density", label: "입자 간격 (작을수록 촘촘)", type: "range", min: 2, max: 12, step: 0.5, default: 4 },
    { key: "radius", label: "밀어내는 범위", type: "range", min: 20, max: 320, step: 5, default: 110 },
    { key: "force", label: "밀어내는 힘", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
    { key: "returnSpeed", label: "돌아오는 속도", type: "range", min: 0.1, max: 2.5, step: 0.05, default: 1 },
    { key: "shimmer", label: "은은한 반짝임", type: "toggle", default: true },
  ],
};

const FALLBACK_FONT = 'Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const SHIMMER_LEVELS = [0.46, 0.66, 0.85, 1];
const INTRO_SECONDS = 1.9;

// Deterministic PRNG so re-sampling after a resize gives the same jitter.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Accepts any CSS font-family list; falls back when the canvas rejects it.
function resolveFamily(g, value) {
  const clean = String(value || "").replace(/[;{}<>\\]/g, "").trim().slice(0, 200);
  if (!clean) return FALLBACK_FONT;
  g.font = "7px monospace";
  const before = g.font;
  g.font = `400 10px ${clean}`;
  return g.font === before ? FALLBACK_FONT : clean;
}

export function mount(element, props, ctx) {
  const surface = ctx.createCanvas("2d");
  const g = surface.context;
  const sampler = document.createElement("canvas");
  const sg = sampler.getContext("2d", { willReadFrequently: true });
  const text = String(props.text || "").replace(/\s+/g, " ").trim();
  const weight = Math.min(900, Math.max(100, Math.round((props.fontWeight || 700) / 100) * 100));
  const family = resolveFamily(sg, props.fontFamily);
  const touch = ctx.isTouch;
  const reduced = ctx.reducedMotion;

  // Spring tuned to a constant damping ratio, so the slider only changes speed, not bounciness.
  const k = 0.028 * props.returnSpeed;
  const dampBase = Math.exp(-2 * 0.46 * Math.sqrt(k));

  let width = 0;
  let height = 0;
  let count = 0;
  let drawSize = props.particleSize;
  let gapUsed = props.density;
  let reach = props.radius;
  let hx = new Float32Array(0), hy = hx, x = hx, y = hx, vx = hx, vy = hx, ph = hx, fr = hx;
  let offX = null, offY = null, delay = null;
  let bucket = new Uint8Array(0);
  let built = false;
  let dirty = true;
  let alive = true;
  let clock = 0;
  let introStart = reduced || ctx.editing ? Infinity : -1; // -1: waiting to be seen, Infinity: no intro
  let introDone = !(introStart < 0);

  const pointer = { x: 0, y: 0, vx: 0, vy: 0, amount: 0, active: false };
  const finger = { down: false, x: 0, y: 0 };

  /* ---------- Text layout: auto-fit, wrapping at spaces when that makes the type bigger ---------- */

  function layoutText(w, h) {
    sg.font = `${weight} 100px ${family}`;
    const words = text.split(" ");
    const space = sg.measureText(" ").width;
    const widths = words.map((word) => sg.measureText(word).width);
    const metrics = sg.measureText(text);
    const asc = metrics.actualBoundingBoxAscent || 72;
    const desc = metrics.actualBoundingBoxDescent || 0;
    const lineH = asc + desc;
    const advance = Math.max(lineH, 80) * 1.08;
    const pack = (limit) => {
      const lines = [];
      let current = [];
      let lineWidth = 0;
      words.forEach((word, index) => {
        const add = current.length ? space + widths[index] : widths[index];
        if (current.length && lineWidth + add > limit) { lines.push(current.join(" ")); current = [word]; lineWidth = widths[index]; }
        else { current.push(word); lineWidth += add; }
      });
      if (current.length) lines.push(current.join(" "));
      return lines;
    };
    const total = widths.reduce((sum, value) => sum + value, 0) + space * (words.length - 1);
    let best = null;
    for (let n = 1; n <= Math.min(4, words.length); n++) {
      let lines = [text];
      if (n > 1) {
        let lo = Math.max(...widths);
        let hi = total;
        for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (pack(mid).length <= n) hi = mid; else lo = mid; }
        lines = pack(hi);
        if (lines.length !== n) continue;
      }
      const maxW = Math.max(1, ...lines.map((line) => sg.measureText(line).width));
      const blockH = lineH + advance * (n - 1);
      const size = 100 * Math.min((w * 0.9) / maxW, (h * 0.78) / blockH);
      if (!best || size > best.size * 1.2) best = { lines, size, asc, advance, blockH, maxW };
    }
    return best;
  }

  function sampleHomes(w, h, gap, fit) {
    const s = Math.min(1, Math.max(0.25, 2.2 / gap));
    const sw = Math.max(1, Math.ceil(w * s));
    const sh = Math.max(1, Math.ceil(h * s));
    if (sampler.width !== sw || sampler.height !== sh) { sampler.width = sw; sampler.height = sh; }
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, sw, sh);
    sg.setTransform(s, 0, 0, s, 0, 0);
    sg.font = `${weight} ${fit.size}px ${family}`;
    sg.textAlign = "center";
    sg.textBaseline = "alphabetic";
    sg.fillStyle = "#000";
    const scale = fit.size / 100;
    const top = (h - fit.blockH * scale) / 2;
    fit.lines.forEach((line, index) => sg.fillText(line, w / 2, top + fit.asc * scale + index * fit.advance * scale));
    sg.setTransform(1, 0, 0, 1, 0, 0);
    const data = sg.getImageData(0, 0, sw, sh).data;
    const rand = seeded(1337);
    const homes = [];
    // Only walk the grid cells around the text block.
    const halfW = (fit.maxW * scale) / 2 + gap * 2;
    const startX = gap / 2 + Math.max(0, Math.floor((w / 2 - halfW) / gap)) * gap;
    const startY = gap / 2 + Math.max(0, Math.floor((top - gap * 2) / gap)) * gap;
    const endX = Math.min(w, w / 2 + halfW);
    const endY = Math.min(h, top + fit.blockH * scale + fit.size * 0.3 + gap * 2);
    for (let py = startY; py < endY; py += gap) {
      for (let px = startX; px < endX; px += gap) {
        const jx = px + (rand() - 0.5) * gap * 0.6;
        const jy = py + (rand() - 0.5) * gap * 0.6;
        const sx = Math.min(sw - 1, Math.max(0, Math.floor(jx * s)));
        const sy = Math.min(sh - 1, Math.max(0, Math.floor(jy * s)));
        if (data[(sy * sw + sx) * 4 + 3] > 120) homes.push(jx, jy);
      }
    }
    return homes;
  }

  function rebuild() {
    width = surface.width;
    height = surface.height;
    const fit = text ? layoutText(width, height) : null;
    const small = touch || width < 640;
    const cap = small ? 3600 : width < 1100 ? 7000 : 12000;
    // Sampling gap is relative to ~220px type, so small text (phones) still reads clearly.
    let gap = fit ? Math.max(1.6, props.density * Math.min(1.25, Math.max(0.4, fit.size / 220))) : props.density;
    const requested = gap;
    let homes = [];
    if (fit && fit.size > 3) {
      homes = sampleHomes(width, height, gap, fit);
      for (let tries = 0; tries < 4 && homes.length / 2 > cap; tries++) {
        gap *= Math.sqrt(homes.length / 2 / cap) * 1.03;
        homes = sampleHomes(width, height, gap, fit);
      }
    }
    gapUsed = gap;
    drawSize = props.particleSize * Math.min(1.8, Math.sqrt(gap / requested));
    reach = props.radius * Math.min(1, Math.max(0.6, width / 1000));

    const next = homes.length / 2;
    const rand = seeded(7);
    // After a resize, particles re-form from a slight scatter around their new homes.
    const settle = count ? gap * 1.5 : 0;
    hx = new Float32Array(next); hy = new Float32Array(next);
    x = new Float32Array(next); y = new Float32Array(next);
    vx = new Float32Array(next); vy = new Float32Array(next);
    ph = new Float32Array(next); fr = new Float32Array(next);
    bucket = new Uint8Array(next);
    // Not seen yet: (re)build the scattered start. Resized mid-intro: let the springs finish it.
    const withIntro = !introDone && introStart < 0;
    if (built && !introDone && introStart >= 0) { introDone = true; offX = offY = delay = null; }
    if (withIntro) { offX = new Float32Array(next); offY = new Float32Array(next); delay = new Float32Array(next); }
    for (let i = 0; i < next; i++) {
      hx[i] = homes[i * 2];
      hy[i] = homes[i * 2 + 1];
      ph[i] = rand() * Math.PI * 2;
      fr[i] = 0.6 + rand() * 1.6;
      x[i] = hx[i] + (rand() - 0.5) * settle;
      y[i] = hy[i] + (rand() - 0.5) * settle;
      if (withIntro) {
        const angle = rand() * Math.PI * 2;
        const spread = (0.15 + rand() * 0.55) * Math.min(width, height);
        offX[i] = Math.cos(angle) * spread;
        offY[i] = Math.sin(angle) * spread * 0.8 + height * 0.12;
        delay[i] = 0.55 * (hx[i] / Math.max(1, width)) + rand() * 0.25;
        x[i] = hx[i] + offX[i];
        y[i] = hy[i] + offY[i];
      }
    }
    count = next;
    built = true;
  }

  /* ---------- Pointer: mouse via ctx.pointer, finger via touch events (works while the page scrolls) ---------- */

  const fromTouch = (event) => {
    const point = event.touches[0];
    if (!point) return;
    const rect = element.getBoundingClientRect();
    finger.x = point.clientX - rect.left;
    finger.y = point.clientY - rect.top;
  };
  const onTouchStart = (event) => { finger.down = true; fromTouch(event); };
  const onTouchMove = (event) => fromTouch(event);
  const onTouchEnd = (event) => { if (!event.touches.length) finger.down = false; else fromTouch(event); };
  element.addEventListener("touchstart", onTouchStart, { passive: true });
  element.addEventListener("touchmove", onTouchMove, { passive: true });
  element.addEventListener("touchend", onTouchEnd, { passive: true });
  element.addEventListener("touchcancel", onTouchEnd, { passive: true });
  // The mouse leaving the window releases the particles (ctx.pointer keeps its last position).
  const mouse = { away: false, x: null, y: null };
  const onMouseOut = (event) => { if (!event.relatedTarget) mouse.away = true; };
  addEventListener("mouseout", onMouseOut, { passive: true });

  function readPointer(dt) {
    const radius = reach;
    let target = null;
    if (finger.down) target = finger;
    else if (!touch) {
      const p = ctx.pointer;
      if (p.clientX !== mouse.x || p.clientY !== mouse.y) { mouse.away = false; mouse.x = p.clientX; mouse.y = p.clientY; }
      if (p.moved && !mouse.away) {
        const px = p.x * width;
        const py = p.y * height;
        if (px > -radius && px < width + radius && py > -radius && py < height + radius) target = { x: px, y: py };
      }
    }
    const lastX = pointer.x;
    const lastY = pointer.y;
    if (target) {
      if (!pointer.active) { pointer.x = target.x; pointer.y = target.y; }
      const ease = 1 - Math.exp(-dt * 30);
      pointer.x += (target.x - pointer.x) * ease;
      pointer.y += (target.y - pointer.y) * ease;
    }
    const frames = Math.max(dt * 60, 0.001);
    const mvx = pointer.active && target ? (pointer.x - lastX) / frames : 0;
    const mvy = pointer.active && target ? (pointer.y - lastY) / frames : 0;
    pointer.vx += (Math.max(-40, Math.min(40, mvx)) - pointer.vx) * 0.5;
    pointer.vy += (Math.max(-40, Math.min(40, mvy)) - pointer.vy) * 0.5;
    pointer.active = Boolean(target);
    pointer.amount += ((target ? 1 : 0) - pointer.amount) * (1 - Math.exp(-dt * (target ? 10 : 4)));
  }

  /* ---------- Simulation and drawing ---------- */

  function simulate(dt) {
    const step = dt * 60;
    if (!step) return;
    readPointer(dt);
    const radius = Math.max(1, reach);
    const r2 = radius * radius;
    const push = props.force * 2.6 * pointer.amount * step;
    const mx = pointer.x;
    const my = pointer.y;
    const mvx = pointer.vx;
    const mvy = pointer.vy;
    const kk = k * step;
    const damp = Math.pow(dampBase, step);
    const wobble = 0.22 + gapUsed * 0.07;
    const t1 = clock * 1.05;
    const t2 = clock * 0.77;
    let introT = -1;
    if (!introDone && introStart >= 0) {
      introT = (clock - introStart) / INTRO_SECONDS;
      if (introT > 1.9) { introDone = true; offX = offY = delay = null; introT = -1; }
    }
    for (let i = 0; i < count; i++) {
      let tx = hx[i] + Math.sin(t1 + ph[i]) * wobble;
      let ty = hy[i] + Math.cos(t2 + ph[i] * 1.7) * wobble;
      if (introT >= 0) {
        const p = Math.min(1, Math.max(0, introT * 1.8 - delay[i]));
        const rest = (1 - p) * (1 - p) * (1 - p);
        tx += offX[i] * rest;
        ty += offY[i] * rest;
      }
      let ax = (tx - x[i]) * kk;
      let ay = (ty - y[i]) * kk;
      if (push > 0) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) + 0.001;
          const f = 1 - d / radius;
          const strength = f * f * push;
          ax += (dx / d) * strength + mvx * strength * 0.05;
          ay += (dy / d) * strength + mvy * strength * 0.05;
        }
      }
      vx[i] = (vx[i] + ax) * damp;
      vy[i] = (vy[i] + ay) * damp;
      x[i] += vx[i] * step;
      y[i] += vy[i] * step;
    }
  }

  function draw() {
    g.clearRect(0, 0, surface.width, surface.height);
    if (!count) return;
    let fade = 1;
    if (!introDone) fade = introStart < 0 ? 0 : Math.min(1, (clock - introStart) / 0.7);
    if (fade <= 0) return;
    const s = drawSize;
    const half = s / 2;
    const round = s >= 2.2;
    g.fillStyle = props.color;
    const plot = (only) => {
      g.beginPath();
      for (let i = 0; i < count; i++) {
        if (only >= 0 && bucket[i] !== only) continue;
        if (round) { g.moveTo(x[i] + half, y[i]); g.arc(x[i], y[i], half, 0, Math.PI * 2); }
        else g.rect(x[i] - half, y[i] - half, s, s);
      }
      g.fill();
    };
    if (!props.shimmer) { g.globalAlpha = fade; plot(-1); g.globalAlpha = 1; return; }
    for (let i = 0; i < count; i++) {
      const wave = 0.5 + 0.5 * Math.sin(clock * fr[i] + ph[i] * 3);
      const moving = vx[i] * vx[i] + vy[i] * vy[i] > 2.5;
      bucket[i] = moving ? 3 : (wave * 3.99) | 0;
    }
    for (let level = 0; level < SHIMMER_LEVELS.length; level++) { g.globalAlpha = SHIMMER_LEVELS[level] * fade; plot(level); }
    g.globalAlpha = 1;
  }

  ctx.loop((time, delta) => {
    if (dirty) { dirty = false; rebuild(); }
    const dt = Math.min(delta, 1 / 20);
    clock += dt;
    if (introStart < 0) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < innerHeight && rect.width > 0) introStart = clock;
    }
    simulate(dt);
    draw();
  });

  ctx.onResize(() => {
    dirty = true;
    if (reduced) { dirty = false; rebuild(); draw(); }
  });

  // Web fonts that are not loaded yet: re-sample once they arrive.
  if (text && document.fonts) {
    try {
      const spec = `${weight} 48px ${family}`;
      if (!document.fonts.check(spec, text)) {
        document.fonts.load(spec, text).then(() => {
          if (!alive) return;
          dirty = true;
          if (reduced) { dirty = false; rebuild(); draw(); }
        }).catch(() => {});
      }
    } catch (error) { /* invalid font list: the fallback is already in use */ }
  }

  return () => {
    alive = false;
    element.removeEventListener("touchstart", onTouchStart);
    element.removeEventListener("touchmove", onTouchMove);
    element.removeEventListener("touchend", onTouchEnd);
    element.removeEventListener("touchcancel", onTouchEnd);
    removeEventListener("mouseout", onMouseOut);
    sampler.width = sampler.height = 0;
    count = 0;
  };
}
