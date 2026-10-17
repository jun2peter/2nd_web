// 3D 커버플로우 — 사진들이 가운데 한 장을 중심으로 좌우로 기울어 늘어선다. 드래그·휠·방향키·클릭으로 넘긴다.
export const meta = {
  name: "3D 커버플로우",
  description: "사진이 가운데 한 장을 중심으로 좌우로 비스듬히 늘어서요. 드래그·마우스 휠·←→ 키·옆 사진 클릭으로 넘기고, 자동 넘김도 돼요. 한 줄에 하나: 이미지 | 캡션 | 링크(선택).",
  category: "media",
  defaultSize: { width: 1200, height: 620 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "images", label: "이미지 (한 줄에 하나: 주소 | 캡션 | 링크)", type: "images", default: ["https://picsum.photos/seed/cf1/800/1000 | 하나", "https://picsum.photos/seed/cf2/800/1000 | 둘", "https://picsum.photos/seed/cf3/800/1000 | 셋", "https://picsum.photos/seed/cf4/800/1000 | 넷", "https://picsum.photos/seed/cf5/800/1000 | 다섯"] },
    { key: "cardWidth", label: "카드 너비(px)", type: "number", min: 120, max: 900, step: 10, default: 340 },
    { key: "cardHeight", label: "카드 높이(px)", type: "number", min: 120, max: 1200, step: 10, default: 440 },
    { key: "spacing", label: "카드 간격(px)", type: "number", min: 40, max: 600, step: 10, default: 220 },
    { key: "angle", label: "옆 카드 기울기(°)", type: "range", min: 0, max: 80, step: 1, default: 45 },
    { key: "depth", label: "옆 카드 들어가는 깊이(px)", type: "number", min: 0, max: 800, step: 10, default: 180 },
    { key: "radius", label: "모서리(px)", type: "number", min: 0, max: 80, step: 1, default: 6 },
    { key: "reflection", label: "바닥 반사", type: "toggle", default: true },
    { key: "auto", label: "자동 넘김(초, 0 = 끔)", type: "number", min: 0, max: 30, step: 0.5, default: 0 },
    { key: "captionColor", label: "캡션 색", type: "color", default: "#111111" },
    { key: "background", label: "배경 (예: transparent, #fff)", type: "text", default: "transparent" },
  ],
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const safeLink = (value) => (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\?|#)/i.test(value) ? value : "");

export function mount(element, props, ctx) {
  const items = (props.images || []).map((line) => { const [src = "", caption = "", link = ""] = String(line).split("|").map((part) => part.trim()); return { src: src ? ctx.asset(src) : "", caption, link: safeLink(link) }; }).filter((item) => item.src);
  element.style.position = "relative"; element.style.overflow = "hidden"; element.style.userSelect = "none"; element.style.touchAction = "pan-y";
  element.style.background = /^[#(),.%\w\s-]+$/.test(props.background || "") ? props.background : "transparent";
  if (!items.length) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#888;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;text-align:center">COVERFLOW<br>오른쪽에 이미지를 한 줄씩 넣으세요</div>';
    return () => element.replaceChildren();
  }
  const scene = document.createElement("div");
  scene.style.cssText = `position:absolute;inset:0;perspective:${Math.max(600, props.cardWidth * 3)}px;perspective-origin:50% 45%`;
  const caption = document.createElement("div");
  caption.style.cssText = `position:absolute;left:0;right:0;bottom:18px;text-align:center;font:600 14px/1.4 Arial,sans-serif;color:${props.captionColor};pointer-events:none;letter-spacing:.02em`;
  element.append(scene, caption);
  const cards = items.map((item, index) => {
    const card = document.createElement(item.link ? "a" : "div");
    if (item.link) { card.href = item.link; card.draggable = false; }
    card.dataset.index = String(index);
    card.style.cssText = `position:absolute;left:50%;top:50%;width:${props.cardWidth}px;height:${props.cardHeight}px;margin:${-props.cardHeight / 2}px 0 0 ${-props.cardWidth / 2}px;border-radius:${props.radius}px;overflow:hidden;background:#ddd;box-shadow:0 30px 60px rgba(0,0,0,.22);cursor:pointer;transition:transform .7s cubic-bezier(.22,1,.36,1),opacity .7s ease,filter .7s ease;will-change:transform;transform-style:preserve-3d;${props.reflection ? `-webkit-box-reflect:below 6px linear-gradient(transparent 65%, rgba(0,0,0,.25));` : ""}`;
    card.innerHTML = `<img src="${escapeHTML(item.src)}" alt="${escapeHTML(item.caption)}" draggable="false" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;pointer-events:none">`;
    scene.append(card);
    return card;
  });
  let current = Math.min(items.length - 1, Math.floor(items.length / 2));
  let dragging = null;
  const layoutCards = () => {
    cards.forEach((card, index) => {
      const offset = index - current; const side = Math.sign(offset); const distance = Math.abs(offset);
      const x = offset * props.spacing * (distance > 0 ? 0.75 + 0.25 / distance : 1);
      const z = distance ? -props.depth - (distance - 1) * 60 : 0;
      card.style.transform = `translate3d(${x}px,0,${z}px) rotateY(${-side * (ctx.reducedMotion ? 0 : props.angle)}deg)`;
      card.style.zIndex = String(100 - distance);
      card.style.opacity = distance > 4 ? "0" : String(1 - distance * 0.12);
      card.style.filter = distance ? `brightness(${1 - Math.min(0.5, distance * 0.14)})` : "";
      card.setAttribute("aria-hidden", String(distance !== 0));
    });
    caption.textContent = items[current]?.caption || "";
  };
  const go = (index) => { current = (index + items.length) % items.length; layoutCards(); };
  layoutCards();

  const onClick = (event) => { const card = event.target.closest("[data-index]"); if (!card) return; const index = Number(card.dataset.index); if (index !== current) { event.preventDefault(); go(index); } };
  const onKey = (event) => { if (event.key === "ArrowRight") { event.preventDefault(); go(current + 1); } if (event.key === "ArrowLeft") { event.preventDefault(); go(current - 1); } };
  let wheelLock = 0;
  const onWheel = (event) => { if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.2) return; event.preventDefault(); const now = performance.now(); if (now - wheelLock < 350) return; wheelLock = now; go(current + (event.deltaX > 0 ? 1 : -1)); };
  const onDown = (event) => { dragging = { x: event.clientX, moved: false, pointerId: event.pointerId }; };
  const onMove = (event) => { if (!dragging || event.pointerId !== dragging.pointerId) return; const dx = event.clientX - dragging.x; if (Math.abs(dx) > 40) { dragging.moved = true; dragging.x = event.clientX; go(current + (dx < 0 ? 1 : -1)); } };
  const onUp = (event) => { if (dragging?.moved) { const stop = (clickEvent) => { clickEvent.preventDefault(); clickEvent.stopPropagation(); }; element.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => element.removeEventListener("click", stop, { capture: true }), 0); } if (dragging && event.pointerId === dragging.pointerId) dragging = null; };
  element.tabIndex = 0; element.setAttribute("role", "region"); element.setAttribute("aria-label", "이미지 커버플로우 · 방향키로 넘기기");
  element.addEventListener("click", onClick); element.addEventListener("keydown", onKey); element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onDown); addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("pointercancel", onUp);

  let timer = 0;
  const startAuto = () => { stopAuto(); if (props.auto > 0 && !ctx.reducedMotion) timer = setInterval(() => { if (!dragging && !ctx.paused && ctx.visible) go(current + 1); }, props.auto * 1000); };
  const stopAuto = () => { if (timer) clearInterval(timer); timer = 0; };
  startAuto();

  return {
    destroy() { stopAuto(); element.removeEventListener("click", onClick); element.removeEventListener("keydown", onKey); element.removeEventListener("wheel", onWheel); element.removeEventListener("pointerdown", onDown); removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp); element.replaceChildren(); element.removeAttribute("role"); element.removeAttribute("tabindex"); },
    paused(isPaused) { if (isPaused) stopAuto(); else startAuto(); },
  };
}
