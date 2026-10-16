// Kinetic Title — a big headline whose letters wave, scatter from the pointer, lean into scroll or rise into view.
// Letters are spans fitted to the box width; a visually hidden copy keeps the words readable for screen readers.

export const meta = {
  name: "키네틱 타이틀",
  description: "글자 하나하나가 움직이는 큰 제목. 물결·밀어내기·스크롤 반응·등장 중에서 고르세요. 상자 너비에 자동으로 맞춰지고 한글도 돼요.",
  category: "text",
  defaultSize: { width: 1200, height: 280 },
  props: [
    { key: "text", label: "문구", type: "text", default: "MOVING IMAGE" },
    { key: "mode", label: "움직임", type: "select", options: [["wave", "물결"], ["repel", "밀어내기 (마우스·손가락)"], ["scroll", "스크롤 반응"], ["reveal", "등장"]], default: "wave" },
    { key: "intensity", label: "세기", type: "range", min: 0, max: 2, step: 0.05, default: 1 },
    { key: "replay", label: "다시 보일 때마다 등장 재생 (등장 모드)", type: "toggle", default: true },
    { key: "fontFamily", label: "글꼴", type: "text", default: "Arial, Helvetica, sans-serif" },
    { key: "fontWeight", label: "굵기", type: "range", min: 100, max: 900, step: 100, default: 700 },
    { key: "color", label: "글자 색", type: "color", default: "#11110f" },
    { key: "letterSpacing", label: "자간 (em)", type: "range", min: -0.15, max: 0.5, step: 0.01, default: -0.02 },
    { key: "fitWidth", label: "상자 너비에 맞춤", type: "toggle", default: true },
    { key: "fontSize", label: "글자 크기 (px, 맞춤을 끄면)", type: "range", min: 12, max: 400, step: 1, default: 120 },
    { key: "align", label: "정렬", type: "select", options: [["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]], default: "center" },
  ],
};

const STYLE = `
.kt{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;line-height:1;white-space:pre;user-select:none;-webkit-user-select:none}
.kt__line{display:block;flex:none;width:max-content;white-space:pre}
.kt__char{display:inline-block;white-space:pre;transform-origin:var(--kt-origin,50% 55%);will-change:transform}
.kt__sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.kt__hint{font:500 10px/1 "SFMono-Regular",Consolas,"Liberation Mono",monospace;letter-spacing:.16em;opacity:.45}
`;

const ALIGN = { left: "flex-start", center: "center", right: "flex-end" };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const graphemes = (text) => (segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text));

export function mount(element, props, ctx) {
  const mode = props.mode;
  const intensity = props.intensity;
  const still = ctx.reducedMotion;
  const animates = !still && (intensity > 0 || mode === "reveal");
  const text = String(props.text ?? "").replace(/\r\n?/g, "\n");
  let destroyed = false;

  const root = document.createElement("div");
  root.className = "kt";
  const style = document.createElement("style");
  style.textContent = STYLE;
  const reader = document.createElement("span");
  reader.className = "kt__sr";
  reader.textContent = text;
  root.append(style, reader);
  root.style.color = props.color;
  root.style.fontWeight = String(props.fontWeight);
  root.style.fontFamily = props.fontFamily;
  if (!root.style.fontFamily) root.style.fontFamily = "Arial, Helvetica, sans-serif";
  root.style.alignItems = ALIGN[props.align] || "center";
  root.style.textAlign = props.align;
  root.style.setProperty("--kt-origin", mode === "scroll" || mode === "reveal" ? "50% 100%" : "50% 55%");

  /* ---------- Letters ---------- */

  const chars = [];
  const lines = text.split("\n").map((lineText, lineIndex) => {
    const line = document.createElement("div");
    line.className = "kt__line";
    line.setAttribute("aria-hidden", "true");
    const parts = graphemes(lineText);
    parts.forEach((part, i) => {
      const span = document.createElement("span");
      span.className = "kt__char";
      span.textContent = part;
      if (i < parts.length - 1 && props.letterSpacing) span.style.marginRight = `${props.letterSpacing}em`;
      line.append(span);
      chars.push({ el: span, line: lineIndex, space: !part.trim(), cx: 0, cy: 0, x: 0, y: 0, vx: 0, vy: 0, skew: 0, stretch: 1 });
    });
    if (!parts.length) line.textContent = " ";
    root.append(line);
    return { el: line, x: 0 };
  });
  const hasText = chars.some((char) => !char.space);
  if (!hasText && ctx.editing) {
    const hint = document.createElement("div");
    hint.className = "kt__hint";
    hint.textContent = "TEXT";
    root.append(hint);
  }
  element.append(root);

  /* ---------- Fit ---------- */

  let fontSize = 100;
  let drift = 0;
  let dirty = true;
  const maxStretch = 0.22 * Math.min(intensity, 1.5);
  const fit = () => {
    if (destroyed) return;
    const width = element.clientWidth || 1;
    const height = element.clientHeight || 1;
    drift = mode === "scroll" && !still ? Math.min(0.16, 0.07 * intensity) * width : 0;
    root.style.padding = `0 ${(drift / 2).toFixed(1)}px`;
    // Vertical room the motion needs, in em, so moving letters are not cut by the box.
    const room = still ? 0.1 : mode === "wave" ? 0.1 + 0.16 * intensity : mode === "scroll" ? 0.1 + maxStretch : 0.12;
    const byHeight = height / (lines.length + room);
    if (props.fitWidth && hasText) {
      root.style.fontSize = "100px";
      const widest = Math.max(...lines.map((line) => line.el.offsetWidth));
      const usable = (width - drift) * (mode === "wave" || mode === "repel" ? 0.95 : 0.97);
      fontSize = widest > 0 ? Math.min((100 * usable) / widest, byHeight) : byHeight;
    } else fontSize = props.fitWidth ? Math.min(100, byHeight) : props.fontSize;
    fontSize = Math.max(4, fontSize);
    root.style.fontSize = `${fontSize.toFixed(2)}px`;
    chars.forEach((char) => {
      char.cx = char.el.offsetLeft + char.el.offsetWidth / 2;
      char.cy = char.el.offsetTop + char.el.offsetHeight / 2;
    });
    dirty = true;
  };
  fit();
  const fonts = document.fonts;
  fonts?.addEventListener?.("loadingdone", fit);
  fonts?.ready?.then(() => { if (!destroyed) fit(); });
  ctx.onResize(fit);

  /* ---------- Pointer (repel): mouse via window, touch via the element so it follows the finger while scrolling ---------- */

  const pointer = { type: ctx.isTouch ? "touch" : "mouse", x: 0, y: 0, seen: false, out: false, touching: false };
  const onPointer = (event) => {
    if (event.pointerType === "touch") { pointer.type = "touch"; return; }
    pointer.type = event.pointerType || "mouse";
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.seen = true;
    pointer.out = false;
  };
  const onWindowLeave = () => { pointer.out = true; };
  const onTouch = (event) => {
    const touch = event.touches[0];
    pointer.type = "touch";
    pointer.touching = Boolean(touch);
    if (touch) { pointer.x = touch.clientX; pointer.y = touch.clientY; }
  };
  const touchEvents = ["touchstart", "touchmove", "touchend", "touchcancel"];
  const usesPointer = mode === "repel" && !still;
  if (usesPointer) {
    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("pointerdown", onPointer, { passive: true });
    document.documentElement.addEventListener("mouseleave", onWindowLeave);
    touchEvents.forEach((type) => element.addEventListener(type, onTouch, { passive: true }));
  }
  const pointerLocal = () => {
    if (!(pointer.touching || (pointer.type !== "touch" && pointer.seen && !pointer.out))) return null;
    const rect = element.getBoundingClientRect();
    const sx = rect.width / (element.clientWidth || 1) || 1;
    const sy = rect.height / (element.clientHeight || 1) || 1;
    return { x: (pointer.x - rect.left) / sx, y: (pointer.y - rect.top) / sy };
  };

  /* ---------- Reveal ---------- */

  let revealState = "done";
  let revealStart = null;
  let observer = null;
  const hideAll = () => {
    revealState = "hidden";
    revealStart = null;
    chars.forEach((char) => { char.el.style.opacity = "0"; char.el.style.filter = ""; });
  };
  const play = () => { revealState = "playing"; revealStart = null; };
  if (mode === "reveal" && animates) {
    hideAll();
    if (ctx.editing || typeof IntersectionObserver !== "function") play();
    else {
      observer = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        const seen = entry.isIntersecting && (entry.intersectionRatio >= 0.2 || entry.intersectionRect.height >= innerHeight * 0.2);
        if (seen && revealState === "hidden") play();
        else if (!entry.isIntersecting && props.replay && revealState !== "hidden") hideAll();
      }, { threshold: [0, 0.1, 0.2] });
      observer.observe(element);
    }
  }

  /* ---------- Motion ---------- */

  let clock = 0;
  let amount = 0;
  let resting = false;
  const center = (chars.length - 1) / 2 || 1;

  const wave = (dt) => {
    clock += dt;
    amount += (1 - amount) * ease(1.6, dt);
    const lift = fontSize * 0.075 * intensity * amount;
    const tilt = 2 * intensity * amount;
    chars.forEach((char, i) => {
      if (char.space) return;
      const phase = clock * 2.2 - i * 0.42 - char.line * 0.8;
      char.el.style.transform = `translate3d(0, ${(Math.sin(phase) * lift).toFixed(2)}px, 0) rotate(${(Math.cos(phase) * tilt).toFixed(2)}deg)`;
    });
  };

  const repel = (dt) => {
    const p = pointerLocal();
    const reach = fontSize * (0.8 + 0.35 * intensity);
    const push = 90 * fontSize * intensity;
    const step = Math.min(dt, 1 / 30);
    let moving = false;
    chars.forEach((char) => {
      if (char.space) return;
      let ax = -140 * char.x - 15 * char.vx;
      let ay = -140 * char.y - 15 * char.vy;
      if (p) {
        const dx = char.cx + char.x - p.x;
        const dy = char.cy + char.y - p.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        if (distance < reach) {
          moving = true;
          const force = (1 - distance / reach) ** 2 * push;
          ax += (dx / distance) * force;
          ay += (dy / distance) * force;
        }
      }
      char.vx += ax * step;
      char.vy += ay * step;
      char.x += char.vx * step;
      char.y += char.vy * step;
      if (Math.abs(char.x) + Math.abs(char.y) > 0.02 || Math.abs(char.vx) + Math.abs(char.vy) > 0.05) moving = true;
    });
    if (!moving && resting) return;
    resting = !moving;
    chars.forEach((char) => {
      if (char.space) return;
      if (!moving) { char.x = char.y = char.vx = char.vy = 0; char.el.style.transform = ""; return; }
      const turn = clamp((char.x / fontSize) * 28, -30, 30);
      char.el.style.transform = `translate3d(${char.x.toFixed(2)}px, ${char.y.toFixed(2)}px, 0) rotate(${turn.toFixed(2)}deg)`;
    });
  };

  const scroll = (dt) => {
    const state = ctx.scroll;
    const velocity = clamp(state.velocity, -90, 90);
    const skewTarget = clamp(-velocity * 0.32 * intensity, -20, 20);
    const stretchTarget = 1 + Math.min(maxStretch, Math.abs(velocity) * 0.006 * intensity);
    let moving = dirty;
    lines.forEach((line, i) => {
      const goal = (0.5 - state.progress) * drift * (i % 2 ? -1 : 1);
      const next = line.x + (goal - line.x) * ease(5, dt);
      if (Math.abs(next - line.x) > 0.01 || dirty) {
        moving = true;
        line.x = next;
        line.el.style.transform = `translate3d(${next.toFixed(2)}px, 0, 0)`;
      }
    });
    chars.forEach((char, i) => {
      // Letters near the middle answer first, the ends trail behind: the word bows with the scroll.
      const rate = 7 + 10 * (1 - Math.abs(i - center) / center);
      char.skew += (skewTarget - char.skew) * ease(rate, dt);
      char.stretch += (stretchTarget - char.stretch) * ease(rate, dt);
      if (Math.abs(char.skew - skewTarget) > 0.01 || Math.abs(char.stretch - stretchTarget) > 0.0005) moving = true;
    });
    if (!moving && resting) return;
    resting = !moving;
    chars.forEach((char) => {
      if (char.space) return;
      char.el.style.transform = `skewX(${char.skew.toFixed(2)}deg) scaleY(${char.stretch.toFixed(4)})`;
    });
  };

  const reveal = (time) => {
    if (revealState !== "playing") return;
    if (revealStart === null) revealStart = time;
    const elapsed = time - revealStart;
    const strength = clamp(intensity, 0.2, 1.5);
    const rise = fontSize * 0.6 * strength;
    const blur = Math.min(24, fontSize * 0.14) * strength;
    const stagger = clamp(0.9 / Math.max(1, chars.length), 0.022, 0.065);
    let finished = true;
    chars.forEach((char, i) => {
      const p = clamp((elapsed - i * stagger) / 1.15, 0, 1);
      if (p < 1) finished = false;
      const e = 1 - (1 - p) ** 4;
      char.el.style.opacity = p >= 1 ? "" : Math.min(1, p * 2.4).toFixed(3);
      char.el.style.transform = p >= 1 ? "" : `translate3d(0, ${((1 - e) * rise).toFixed(2)}px, 0)`;
      char.el.style.filter = p >= 1 || (1 - e) * blur < 0.1 ? "" : `blur(${((1 - e) * blur).toFixed(2)}px)`;
    });
    if (finished) revealState = "done";
  };

  if (animates) {
    ctx.loop((time, delta) => {
      if (destroyed) return;
      const dt = Math.min(Math.max(delta || 1 / 60, 1 / 240), 1 / 20);
      if (mode === "wave") wave(dt);
      else if (mode === "repel") repel(dt);
      else if (mode === "scroll") scroll(dt);
      else if (mode === "reveal") reveal(time);
      dirty = false;
    });
  }

  return () => {
    destroyed = true;
    observer?.disconnect();
    fonts?.removeEventListener?.("loadingdone", fit);
    if (usesPointer) {
      removeEventListener("pointermove", onPointer);
      removeEventListener("pointerdown", onPointer);
      document.documentElement.removeEventListener("mouseleave", onWindowLeave);
      touchEvents.forEach((type) => element.removeEventListener(type, onTouch));
    }
    root.remove();
  };
}
