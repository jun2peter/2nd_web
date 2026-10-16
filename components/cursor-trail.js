// Cursor Trail — a site-wide trail (ribbon · ink · dots) that follows the pointer.
// Draws on ONE fixed, full-viewport canvas appended to <body>; in the Studio editor it plays a small demo inside its own box.
//
// meta.runsOffscreen keeps ctx.loop running even when this component's own box is scrolled away, so the box can sit anywhere.
// If the loop stops anyway (visitor pauses motion, tab hidden) a cheap watchdog clears the overlay,
// so a frozen trail is never left on screen.

export const meta = {
  name: "커서 트레일",
  description: "마우스를 따라 리본·잉크·점 꼬리가 사이트 전체에 그려져요. 상자 자체는 보이지 않으니 아무 데나 작게 두세요(모든 페이지에 쓰려면 '모든 페이지에 표시'). 폰에서는 손가락을 대고 있는 동안만 그려져요.",
  category: "cursor",
  runsOffscreen: true,
  defaultSize: { width: 320, height: 200 },
  props: [
    { key: "mode", label: "모양", type: "select", options: [["ribbon", "리본"], ["ink", "잉크"], ["dots", "점"]], default: "ribbon" },
    { key: "color", label: "색", type: "color", default: "#ffffff" },
    { key: "size", label: "굵기", type: "range", min: 2, max: 60, step: 1, default: 14 },
    { key: "length", label: "꼬리 길이", type: "range", min: 4, max: 80, step: 1, default: 28 },
    { key: "blend", label: "섞는 방식", type: "select", options: [["normal", "보통"], ["difference", "반전 (difference)"], ["screen", "밝게 (screen)"]], default: "difference" },
    { key: "fade", label: "사라지는 속도", type: "range", min: 0.2, max: 3, step: 0.05, default: 1 },
  ],
};

const STEP = 1 / 60;
const TAU = Math.PI * 2;
const BLENDS = ["normal", "difference", "screen"];

function inkSprite(color) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 128;
  const g = sprite.getContext("2d");
  const value = Number.parseInt(String(color).replace("#", "").padEnd(6, "0").slice(0, 6), 16) || 0;
  const rgb = `${value >> 16 & 255},${value >> 8 & 255},${value & 255}`;
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  [[0, 1], [0.25, 0.72], [0.5, 0.32], [0.75, 0.08], [1, 0]].forEach(([stop, alpha]) => gradient.addColorStop(stop, `rgba(${rgb},${alpha})`));
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  return sprite;
}

// Tapered ribbon through the points (tail → head), smoothed with Catmull-Rom.
function drawRibbon(g, points, head, size) {
  const n = points.length + (head ? 1 : 0);
  if (n < 2) return 0;
  const at = (i) => (i < points.length ? points[i] : head);
  const xs = [];
  const ys = [];
  const ls = [];
  const sub = 4;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(Math.max(0, i - 1));
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(Math.min(n - 1, i + 2));
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      xs.push(0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3));
      ys.push(0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3));
      ls.push(p1.life + (p2.life - p1.life) * t);
    }
  }
  const last = at(n - 1);
  xs.push(last.x);
  ys.push(last.y);
  ls.push(last.life);
  const m = xs.length;
  let travel = 0;
  for (let j = 1; j < m; j++) travel += Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]);
  if (travel < 1.5) return 0;
  const left = [];
  const right = [];
  let headWidth = 0;
  for (let j = 0; j < m; j++) {
    const a = Math.max(0, j - 1);
    const b = Math.min(m - 1, j + 1);
    const tx = xs[b] - xs[a];
    const ty = ys[b] - ys[a];
    const len = Math.hypot(tx, ty) || 1;
    const u = j / (m - 1);
    const w = size * 0.5 * Math.pow(u, 0.75) * Math.min(1, ls[j] * 1.8);
    left.push(xs[j] - (ty / len) * w, ys[j] + (tx / len) * w);
    right.push(xs[j] + (ty / len) * w, ys[j] - (tx / len) * w);
    headWidth = w;
  }
  g.beginPath();
  g.moveTo(left[0], left[1]);
  for (let j = 2; j < left.length; j += 2) g.lineTo(left[j], left[j + 1]);
  for (let j = right.length - 2; j >= 0; j -= 2) g.lineTo(right[j], right[j + 1]);
  g.closePath();
  g.fill();
  if (headWidth > 0.3) {
    g.beginPath();
    g.arc(xs[m - 1], ys[m - 1], headWidth, 0, TAU);
    g.fill();
  }
  return 1;
}

function createTrail({ mode, color, size, length, fade }) {
  const maxPoints = Math.max(4, Math.round(length));
  const decay = 2.2 * fade; // life lost per second; 1 → about half a second
  const strokes = [];
  const marks = [];
  const head = { x: 0, y: 0, life: 1 };
  let current = null;
  let acc = 0;
  let spawnX = 0;
  let spawnY = 0;
  let sprite = null;

  const spawnAlong = (spacing, make) => {
    const dx = head.x - spawnX;
    const dy = head.y - spawnY;
    let dist = Math.hypot(dx, dy);
    if (dist < spacing) return;
    const ux = dx / dist;
    const uy = dy / dist;
    for (let guard = 0; dist >= spacing; guard++) {
      if (guard > 48) { spawnX = head.x; spawnY = head.y; break; }
      spawnX += ux * spacing;
      spawnY += uy * spacing;
      dist -= spacing;
      make(spawnX, spawnY, ux, uy);
    }
  };

  return {
    get empty() { return !strokes.length && !marks.length; },
    start(x, y) { head.x = spawnX = x; head.y = spawnY = y; current = null; acc = 0; },
    clear() { strokes.length = 0; marks.length = 0; current = null; },
    update(dt, active, tx, ty) {
      if (active) {
        const px = head.x;
        const py = head.y;
        const ease = 1 - Math.exp(-dt * (mode === "ribbon" ? 26 : 20));
        head.x += (tx - head.x) * ease;
        head.y += (ty - head.y) * ease;
        const moved = Math.hypot(head.x - px, head.y - py);
        const speed = dt > 0 ? moved / dt : 0;
        if (mode === "ribbon") {
          if (!current && moved > 0.4) { current = [{ x: px, y: py, life: 1 }]; strokes.push(current); }
          acc += dt;
          if (current && acc >= STEP) {
            acc %= STEP;
            const last = current[current.length - 1];
            if (Math.hypot(head.x - last.x, head.y - last.y) > 1) current.push({ x: head.x, y: head.y, life: 1 });
            if (current.length > maxPoints) current.splice(0, current.length - maxPoints);
          }
        } else if (mode === "ink") {
          const energy = Math.min(1, speed / 1600);
          spawnAlong(Math.max(4, size * 0.55), (x, y, ux, uy) => {
            if (marks.length >= maxPoints * 3) marks.shift();
            marks.push({ x, y, r: size * (0.9 + Math.random() * 0.9) * (0.6 + energy * 0.9), life: 1, vx: ux * speed * 0.04 + (Math.random() - 0.5) * 26, vy: uy * speed * 0.04 + (Math.random() - 0.5) * 26 });
          });
        } else {
          spawnAlong(Math.max(4, size * 1.25), (x, y) => {
            if (marks.length >= maxPoints) marks.shift();
            marks.push({ x, y, life: 1 });
          });
        }
      } else {
        current = null;
        spawnX = head.x = tx ?? head.x;
        spawnY = head.y = ty ?? head.y;
      }

      for (let s = strokes.length - 1; s >= 0; s--) {
        const points = strokes[s];
        for (let i = 0; i < points.length; i++) points[i].life -= dt * decay;
        let dead = 0;
        while (dead < points.length && points[dead].life <= 0) dead++;
        if (dead) points.splice(0, dead);
        if (!points.length) { strokes.splice(s, 1); if (points === current) current = null; }
      }
      const rate = dt * decay * (mode === "ink" ? 0.55 : 0.75);
      const drag = Math.exp(-dt * 3);
      let keep = 0;
      for (let i = 0; i < marks.length; i++) {
        const mark = marks[i];
        mark.life -= rate;
        if (mark.life <= 0) continue;
        if (mode === "ink") {
          mark.r *= 1 + dt * 0.8;
          mark.x += mark.vx * dt;
          mark.y += mark.vy * dt;
          mark.vx *= drag;
          mark.vy *= drag;
        }
        marks[keep++] = mark;
      }
      marks.length = keep;
    },
    draw(g) {
      g.fillStyle = color;
      if (mode === "ribbon") {
        strokes.forEach((points) => drawRibbon(g, points, points === current ? head : null, size));
      } else if (mode === "ink") {
        sprite ||= inkSprite(color);
        g.globalCompositeOperation = "lighter";
        for (const mark of marks) {
          g.globalAlpha = 0.36 * Math.pow(mark.life, 1.6);
          g.drawImage(sprite, mark.x - mark.r, mark.y - mark.r, mark.r * 2, mark.r * 2);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      } else {
        g.beginPath();
        for (const mark of marks) {
          const r = size * 0.5 * Math.pow(mark.life, 0.8);
          if (r < 0.25) continue;
          g.moveTo(mark.x + r, mark.y);
          g.arc(mark.x, mark.y, r, 0, TAU);
        }
        g.fill();
      }
    },
  };
}

// Editor: a looping figure-eight demo inside the component's own box (no page overlay).
function mountDemo(element, props, ctx, blend) {
  const surface = ctx.createCanvas("2d");
  const g = surface.context;
  surface.canvas.style.mixBlendMode = blend;
  let trail = null;
  let phase = 0;
  let clock = 0;
  const target = () => {
    const w = surface.width;
    const h = surface.height;
    return [w / 2 + w * 0.34 * Math.sin(phase * 1.1), h / 2 + h * 0.3 * Math.sin(phase * 2.2 + 0.5)];
  };
  const reset = () => {
    const scale = Math.max(0.35, Math.min(1, Math.min(surface.width, surface.height) / 240));
    trail = createTrail({ ...props, size: props.size * scale });
    phase = 0;
    trail.start(...target());
  };
  const frame = (dt) => {
    clock += dt;
    phase += dt * (0.7 + 1.9 * (0.5 + 0.5 * Math.sin(clock * 0.9))); // speeds up and slows down like a hand
    const [x, y] = target();
    trail.update(dt, true, x, y);
    g.clearRect(0, 0, surface.width, surface.height);
    trail.draw(g);
    g.globalAlpha = 0.55;
    g.fillStyle = props.color;
    g.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    g.fillText("CURSOR TRAIL · 화면 전체", 10, surface.height - 10);
    g.globalAlpha = 1;
  };
  const still = () => { reset(); for (let i = 0; i < 70; i++) frame(STEP); };
  reset();
  ctx.loop((time, delta) => {
    if (ctx.reducedMotion) { still(); return; }
    frame(Math.min(delta, 0.05));
  });
  ctx.onResize(() => { if (ctx.reducedMotion) still(); else reset(); });
  return () => {};
}

export function mount(element, props, ctx) {
  const blend = BLENDS.includes(props.blend) ? props.blend : "normal";
  if (ctx.editing) return mountDemo(element, props, ctx, blend);
  if (ctx.reducedMotion) return () => {}; // visitors who asked for less motion get no trail at all

  const touch = ctx.isTouch;
  const previousPointerEvents = element.style.pointerEvents;
  element.style.pointerEvents = "none"; // the box itself must never block clicks

  const overlay = document.createElement("canvas");
  overlay.setAttribute("aria-hidden", "true");
  overlay.className = "cursor-trail-overlay";
  overlay.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;mix-blend-mode:${blend}`;
  document.body.append(overlay);
  const og = overlay.getContext("2d");
  let vw = 1;
  let vh = 1;
  let painted = false;
  const fitOverlay = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    vw = Math.max(1, overlay.clientWidth || innerWidth);
    vh = Math.max(1, overlay.clientHeight || innerHeight);
    overlay.width = Math.round(vw * dpr);
    overlay.height = Math.round(vh * dpr);
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    painted = false;
  };
  fitOverlay();
  addEventListener("resize", fitOverlay, { passive: true });

  // Mouse: present while it is inside the window. Touch: only while a finger is down.
  const mouse = { present: false, x: 0, y: 0 };
  const finger = { down: false, fresh: false, x: 0, y: 0 };
  const trail = createTrail(props);
  // Clears everything; the next frame starts a fresh stroke at the pointer instead of streaking from the old spot.
  const wipe = () => {
    trail.clear();
    mouse.present = false;
    finger.fresh = finger.down;
    if (painted) og.clearRect(0, 0, vw, vh);
    painted = false;
  };
  const onMouseOut = (event) => { if (!event.relatedTarget) mouse.present = false; };
  const fromTouch = (event) => { const point = event.touches[0]; if (point) { finger.x = point.clientX; finger.y = point.clientY; } };
  const onTouchStart = (event) => { if (!finger.down) finger.fresh = true; finger.down = true; fromTouch(event); };
  const onTouchMove = (event) => fromTouch(event);
  const onTouchEnd = (event) => { if (!event.touches.length) finger.down = false; };
  if (touch) {
    addEventListener("touchstart", onTouchStart, { passive: true });
    addEventListener("touchmove", onTouchMove, { passive: true });
    addEventListener("touchend", onTouchEnd, { passive: true });
    addEventListener("touchcancel", onTouchEnd, { passive: true });
  } else {
    addEventListener("mouseout", onMouseOut, { passive: true });
  }

  let lastTick = performance.now();
  const watchdog = setInterval(() => { if (performance.now() - lastTick > 250) wipe(); }, 300);

  ctx.loop((time, delta) => {
    lastTick = performance.now();
    const dt = Math.min(delta, 0.05);
    let active = false;
    if (touch) {
      if (finger.fresh) { finger.fresh = false; trail.start(finger.x, finger.y); }
      active = finger.down;
      trail.update(dt, active, finger.x, finger.y);
    } else {
      const p = ctx.pointer;
      if (p.moved && (p.clientX !== mouse.x || p.clientY !== mouse.y)) {
        if (!mouse.present) trail.start(p.clientX, p.clientY);
        mouse.present = true;
        mouse.x = p.clientX;
        mouse.y = p.clientY;
      }
      active = mouse.present;
      trail.update(dt, active, mouse.x, mouse.y);
    }
    if (trail.empty && !painted) return;
    og.clearRect(0, 0, vw, vh);
    trail.draw(og);
    painted = !trail.empty;
  });

  return {
    visibility(visible) { if (!visible) wipe(); },
    destroy() {
      clearInterval(watchdog);
      removeEventListener("resize", fitOverlay);
      removeEventListener("touchstart", onTouchStart);
      removeEventListener("touchmove", onTouchMove);
      removeEventListener("touchend", onTouchEnd);
      removeEventListener("touchcancel", onTouchEnd);
      removeEventListener("mouseout", onMouseOut);
      overlay.remove();
      element.style.pointerEvents = previousPointerEvents;
    },
  };
}
