// Drag Gallery — an endless horizontal strip of works: drag, flick, scroll the wheel or let it drift.
// DOM cards moved with transforms (crisp images, real text captions); cards lean a little with speed.

export const meta = {
  name: "드래그 갤러리",
  description: "끝없이 이어지는 가로 작품 갤러리. 끌기·휠·트랙패드로 넘기고, 빠르게 넘기면 카드가 살짝 기울어요. 한 줄에 「이미지 주소 | 설명」.",
  category: "media",
  defaultSize: { width: 1440, height: 640 },
  props: [
    { key: "images", label: "이미지 (한 줄에 하나, 「주소 | 설명」도 가능)", type: "images", default: [] },
    { key: "cardWidth", label: "카드 너비 (상자 높이 대비 %)", type: "range", min: 40, max: 160, step: 1, default: 72 },
    { key: "gap", label: "카드 간격 (px)", type: "range", min: 0, max: 160, step: 1, default: 24 },
    { key: "radius", label: "모서리 둥글기 (px)", type: "range", min: 0, max: 48, step: 1, default: 2 },
    { key: "drift", label: "자동 흐름 속도 (0이면 멈춤)", type: "range", min: 0, max: 120, step: 1, default: 16 },
    { key: "skew", label: "속도에 따른 기울기", type: "range", min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: "captions", label: "설명 보이기", type: "toggle", default: true },
    { key: "captionColor", label: "설명 색", type: "color", default: "#6f6e68" },
    { key: "verticalWheel", label: "세로 휠로도 넘기기 (그동안 페이지 스크롤이 멈춰요)", type: "toggle", default: false },
  ],
};

const MONO = 'var(--mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace)';
const STYLE = `
.dg{position:absolute;inset:0;overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;cursor:grab;outline:none}
.dg.is-dragging{cursor:grabbing}
.dg:focus-visible{box-shadow:inset 0 0 0 1px currentColor}
.dg__card{position:absolute;left:0;top:0;margin:0;width:var(--dg-w);will-change:transform;backface-visibility:hidden}
.dg__frame{position:relative;overflow:hidden;height:var(--dg-h);border-radius:var(--dg-radius);background:rgba(128,126,118,.14);transform:skewX(var(--dg-skew,0deg)) scale(var(--dg-scale,1));transform-origin:50% 50%;isolation:isolate}
.dg__frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .9s cubic-bezier(.16,1,.3,1);-webkit-user-drag:none;user-select:none;pointer-events:none;will-change:transform}
.dg__frame img.is-loaded{opacity:1}
.dg__number{position:absolute;left:.55em;bottom:.42em;font:400 calc(var(--dg-w) * .15)/1 ${MONO};letter-spacing:-.05em;color:rgba(17,17,15,.46)}
.dg__caption{display:flex;align-items:baseline;gap:.9em;height:var(--dg-ch);padding-top:calc(var(--dg-ch) * .36);box-sizing:border-box;overflow:hidden;white-space:nowrap;color:var(--dg-caption);font-size:var(--dg-fs);line-height:1.25}
.dg__index{font-family:${MONO};font-size:.86em;letter-spacing:.06em;opacity:.72}
.dg__text{overflow:hidden;text-overflow:ellipsis}
`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const pad2 = (n) => String(n).padStart(2, "0");

export function mount(element, props, ctx) {
  const items = (props.images || []).map((line) => {
    const bar = line.indexOf("|");
    const src = ctx.asset((bar >= 0 ? line.slice(0, bar) : line).trim());
    return { src, caption: bar >= 0 ? line.slice(bar + 1).trim() : "" };
  }).filter((item) => item.src || item.caption);
  const source = items.length ? items : Array.from({ length: 6 }, () => ({ src: "", caption: "Untitled" }));

  const root = document.createElement("div");
  root.className = "dg";
  root.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", "작품 갤러리 (끌거나 좌우 화살표로 넘기기)");
  const style = document.createElement("style");
  style.textContent = STYLE;
  root.append(style);
  root.style.setProperty("--dg-caption", props.captionColor);
  root.style.setProperty("--dg-radius", `${props.radius}px`);
  element.append(root);

  /* ---------- Cards ---------- */

  let cards = [];
  const makeCard = (item, index, clone) => {
    const card = document.createElement("figure");
    card.className = "dg__card";
    if (clone) card.setAttribute("aria-hidden", "true");
    const frame = document.createElement("div");
    frame.className = "dg__frame";
    const number = () => {
      const hue = (index * 47 + 18) % 360;
      frame.style.background = `linear-gradient(160deg, hsl(${hue} 16% 85%), hsl(${hue} 10% 72%))`;
      const label = document.createElement("span");
      label.className = "dg__number";
      label.textContent = pad2(index + 1);
      frame.append(label);
    };
    let img = null;
    if (item.src) {
      img = document.createElement("img");
      img.alt = clone ? "" : item.caption;
      img.draggable = false;
      img.decoding = "async";
      img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
      img.addEventListener("error", () => { img.remove(); number(); }, { once: true });
      img.src = item.src;
      frame.append(img);
    } else number();
    card.append(frame);
    if (props.captions) {
      const caption = document.createElement("figcaption");
      caption.className = "dg__caption";
      const indexLabel = document.createElement("span");
      indexLabel.className = "dg__index";
      indexLabel.textContent = pad2(index + 1);
      const text = document.createElement("span");
      text.className = "dg__text";
      text.textContent = item.caption;
      caption.append(indexLabel, text);
      card.append(caption);
    }
    root.append(card);
    return { card, img };
  };
  const rebuild = (count) => {
    cards.forEach(({ card }) => card.remove());
    cards = Array.from({ length: count }, (_, i) => makeCard(source[i % source.length], i % source.length, i >= source.length));
  };

  /* ---------- Layout ---------- */

  let width = 1;
  let height = 1;
  let cardW = 1;
  let slot = 1;
  let total = 1;
  let top = 0;
  let current = 0;
  let target = 0;
  let placed = false;
  let dirty = true;

  const layout = () => {
    width = element.clientWidth || 1;
    height = element.clientHeight || 1;
    const captionH = props.captions ? Math.round(clamp(height * 0.055, 24, 40)) : 0;
    const padY = Math.round(clamp(height * 0.06, 8, 64));
    let frameH = Math.max(24, height - padY * 2 - captionH);
    cardW = Math.max(24, (height * props.cardWidth) / 100);
    const maxW = width * (width < 640 ? 0.78 : 0.86);
    if (cardW > maxW) { frameH *= maxW / cardW; cardW = maxW; } // keep the card ratio on narrow screens
    slot = cardW + props.gap;
    const reps = Math.max(1, Math.ceil((width + slot * 2) / (source.length * slot)));
    if (cards.length !== source.length * reps) rebuild(source.length * reps);
    total = cards.length * slot;
    top = Math.round((height - frameH - captionH) / 2);
    root.style.setProperty("--dg-w", `${cardW.toFixed(2)}px`);
    root.style.setProperty("--dg-h", `${frameH.toFixed(2)}px`);
    root.style.setProperty("--dg-ch", `${captionH}px`);
    root.style.setProperty("--dg-fs", `${clamp(cardW * 0.034, 10, 13).toFixed(1)}px`);
    if (!placed) {
      placed = true;
      current = target = width < 640 ? (width - cardW) / 2 : Math.max(props.gap, width * 0.04);
    }
    dirty = true;
  };

  let velocity = 0;
  let shownCurrent = NaN;
  let shownLean = NaN;
  const render = () => {
    const lean = ctx.reducedMotion ? 0 : clamp(velocity / 2600, -1, 1) * props.skew;
    if (!dirty && Math.abs(current - shownCurrent) < 0.01 && Math.abs(lean - shownLean) < 0.0005) return;
    dirty = false;
    shownCurrent = current;
    shownLean = lean;
    root.style.setProperty("--dg-skew", `${(-lean * 9).toFixed(3)}deg`);
    root.style.setProperty("--dg-scale", (1 - Math.abs(lean) * 0.07).toFixed(4));
    const center = width / 2;
    for (let i = 0; i < cards.length; i += 1) {
      let x = (i * slot + current) % total;
      if (x < 0) x += total;
      if (x > total - slot) x -= total;
      const { card, img } = cards[i];
      card.style.transform = `translate3d(${x.toFixed(2)}px, ${top}px, 0)`;
      if (img && x > -cardW && x < width) {
        const shift = clamp((center - (x + cardW / 2)) / width, -1, 1) * cardW * 0.06;
        img.style.transform = `translate3d(${shift.toFixed(2)}px, 0, 0) scale(1.14)`;
      }
    }
  };

  layout();
  render();

  /* ---------- Input ---------- */

  let inertia = 0;
  let driftDir = -1;
  let driftAmount = 0;
  let hovered = false;
  let drag = null;
  const scaleOf = () => (root.getBoundingClientRect().width / (root.clientWidth || 1)) || 1;
  const jump = () => { if (ctx.reducedMotion) { current = target; dirty = true; render(); } };

  const beginDrag = (event) => {
    drag.active = true;
    root.classList.add("is-dragging");
    try { root.setPointerCapture(event.pointerId); } catch (error) { /* pointer already gone */ }
  };
  const onDown = (event) => {
    if (drag || (event.pointerType === "mouse" && event.button !== 0)) return;
    drag = { id: event.pointerId, x0: event.clientX, y0: event.clientY, x: event.clientX, active: false, scale: scaleOf(), samples: [{ t: event.timeStamp, x: event.clientX }] };
    inertia = 0;
    if (event.pointerType === "mouse") beginDrag(event);
  };
  const onMove = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.active) {
      // Touch/pen: decide on the first real move. Mostly vertical → leave it to the page scroll.
      const dx = event.clientX - drag.x0;
      const dy = event.clientY - drag.y0;
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) { drag = null; return; }
      beginDrag(event);
    }
    const delta = (event.clientX - drag.x) / drag.scale;
    drag.x = event.clientX;
    target += delta;
    drag.samples.push({ t: event.timeStamp, x: event.clientX });
    if (drag.samples.length > 8) drag.samples.shift();
    jump();
  };
  const onUp = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.active) {
      const recent = drag.samples.filter((sample) => event.timeStamp - sample.t < 100);
      let speed = 0;
      if (event.type !== "pointercancel" && recent.length > 1) {
        const first = recent[0];
        const lastSample = recent[recent.length - 1];
        if (lastSample.t > first.t) speed = ((lastSample.x - first.x) / (lastSample.t - first.t)) * 1000 / drag.scale;
      }
      inertia = ctx.reducedMotion ? 0 : clamp(speed, -7000, 7000);
      if (Math.abs(speed) > 40) driftDir = Math.sign(speed);
      root.classList.remove("is-dragging");
      try { root.releasePointerCapture(event.pointerId); } catch (error) { /* already released */ }
    }
    drag = null;
  };
  const onWheel = (event) => {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const dx = event.deltaX * unit;
    const dy = event.deltaY * unit;
    let delta;
    if (Math.abs(dx) > Math.abs(dy)) delta = dx;
    else if (props.verticalWheel && !ctx.editing && !event.ctrlKey) delta = dy; // opt-in: the vertical wheel moves the strip instead of the page
    else return;
    event.preventDefault();
    target -= delta / scaleOf();
    inertia = 0;
    if (Math.abs(delta) > 1) driftDir = -Math.sign(delta);
    jump();
  };
  const onKey = (event) => {
    if (event.key === "ArrowRight") target -= slot;
    else if (event.key === "ArrowLeft") target += slot;
    else return;
    event.preventDefault();
    inertia = 0;
    jump();
  };
  const onEnter = (event) => { if (event.pointerType === "mouse") hovered = true; };
  const onLeave = () => { hovered = false; };
  const onDragStart = (event) => event.preventDefault();

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("keydown", onKey);
  root.addEventListener("pointerenter", onEnter);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("dragstart", onDragStart);

  /* ---------- Frame ---------- */

  let previous = current;
  ctx.loop((time, delta) => {
    if (ctx.reducedMotion) { render(); return; }
    const dt = Math.min(Math.max(delta || 1 / 60, 1 / 240), 1 / 20);
    if (!drag?.active && Math.abs(inertia) > 2) {
      target += inertia * dt;
      inertia *= 0.935 ** (dt * 60);
    } else if (!drag?.active) inertia = 0;
    const driftTarget = ctx.editing || drag?.active ? 0 : hovered ? 0.3 : 1;
    driftAmount += (driftTarget - driftAmount) * ease(driftTarget > driftAmount ? 1.2 : 6, dt);
    target += props.drift * driftDir * driftAmount * dt;
    current += (target - current) * ease(drag?.active ? 16 : 9, dt);
    velocity += ((current - previous) / dt - velocity) * ease(10, dt);
    previous = current;
    render();
  });
  ctx.onResize(() => { layout(); render(); });

  return () => {
    root.removeEventListener("pointerdown", onDown);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerup", onUp);
    root.removeEventListener("pointercancel", onUp);
    root.removeEventListener("wheel", onWheel);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("pointerenter", onEnter);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("dragstart", onDragStart);
    cards = [];
    root.remove();
  };
}
