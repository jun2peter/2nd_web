// 호버 리빌 목록 — a list of project titles; hovering a row floats that row's image under the cursor.
// Classic portfolio index. On touch the image shows while the finger is down.
export const meta = {
  name: "호버 리빌 목록",
  description: "프로젝트 제목 줄에 마우스를 올리면 그 이미지가 커서를 따라 떠올라요. 한 줄에 하나: 제목 | 이미지 | 링크(선택) | 오른쪽 작은 글(선택). 폰에서는 줄을 누르는 동안 보여요.",
  category: "media",
  defaultSize: { width: 960, height: 440 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "items", label: "목록 (한 줄에 하나: 제목 | 이미지 | 링크 | 작은 글)", type: "textarea", default: "예시 하나 — 바꿔 주세요 | https://picsum.photos/seed/archive-one/800/600 |  | 2024\n예시 둘 | https://picsum.photos/seed/archive-two/800/600 |  | 2025\n예시 셋 | https://picsum.photos/seed/archive-three/800/600 |  | 2026" },
    { key: "fontFamily", label: "폰트", type: "text", default: "Arial, sans-serif" },
    { key: "fontSize", label: "글자 크기(px)", type: "number", min: 10, max: 200, step: 1, default: 40 },
    { key: "fontWeight", label: "굵기", type: "number", min: 100, max: 1000, step: 100, default: 500 },
    { key: "color", label: "글자색", type: "color", default: "#111111" },
    { key: "hoverColor", label: "호버한 줄 글자색", type: "color", default: "#111111" },
    { key: "lineColor", label: "구분선 색", type: "color", default: "#dddddd" },
    { key: "padding", label: "줄 위아래 여백(px)", type: "number", min: 0, max: 80, step: 1, default: 18 },
    { key: "imageWidth", label: "이미지 너비(px)", type: "number", min: 80, max: 800, step: 10, default: 320 },
    { key: "imageRatio", label: "이미지 비율", type: "select", options: [["4/3", "4:3"], ["3/2", "3:2"], ["16/9", "16:9"], ["1/1", "1:1"], ["3/4", "3:4 세로"]], default: "4/3" },
    { key: "radius", label: "이미지 모서리(px)", type: "number", min: 0, max: 100, step: 1, default: 6 },
    { key: "follow", label: "따라오는 부드러움", type: "range", min: 0, max: 0.95, step: 0.05, default: 0.8 },
    { key: "tilt", label: "움직일 때 기울기", type: "range", min: 0, max: 1, step: 0.05, default: 0.4 },
    { key: "dimOthers", label: "다른 줄 흐리게", type: "toggle", default: true },
    { key: "numbering", label: "번호 표시", type: "toggle", default: true },
    { key: "newTab", label: "링크를 새 탭으로", type: "toggle", default: false },
  ],
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const safeLink = (value) => (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\?|#)/i.test(value) ? value : "");

export function mount(element, props, ctx) {
  const rows = String(props.items || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = "", image = "", link = "", side = ""] = line.split("|").map((part) => part.trim());
    return { title, image: image ? ctx.asset(image) : "", link: safeLink(link), side };
  });
  element.style.position = "relative";
  if (!rows.length) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#888;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;text-align:center">HOVER REVEAL<br>오른쪽 목록에 한 줄씩 넣으세요</div>';
    return () => element.replaceChildren();
  }

  const list = document.createElement("ul");
  list.style.cssText = `list-style:none;margin:0;padding:0;font:${props.fontWeight} ${props.fontSize}px/1.1 ${props.fontFamily};color:${props.color}`;
  rows.forEach((row, index) => {
    const item = document.createElement("li");
    const node = document.createElement(row.link ? "a" : "div");
    if (row.link) { node.href = row.link; if (props.newTab) { node.target = "_blank"; node.rel = "noopener"; } }
    node.dataset.index = String(index);
    node.style.cssText = `display:flex;align-items:baseline;gap:24px;padding:${props.padding}px 0;border-bottom:1px solid ${props.lineColor};color:inherit;text-decoration:none;transition:opacity .35s ease,color .35s ease;cursor:${row.link ? "pointer" : "default"}`;
    node.innerHTML = `${props.numbering ? `<small style="font-size:.35em;opacity:.55;min-width:2.4em;letter-spacing:.08em">${String(index + 1).padStart(2, "0")}</small>` : ""}<span style="flex:1;min-width:0">${escapeHTML(row.title)}</span>${row.side ? `<small style="font-size:.4em;opacity:.6;white-space:nowrap">${escapeHTML(row.side)}</small>` : ""}`;
    item.append(node); list.append(item);
    if (row.image) { const warm = new Image(); warm.src = row.image; }
  });
  const image = document.createElement("img");
  image.alt = ""; image.setAttribute("aria-hidden", "true"); image.draggable = false;
  image.style.cssText = `position:absolute;left:0;top:0;width:${props.imageWidth}px;aspect-ratio:${props.imageRatio};object-fit:cover;border-radius:${props.radius}px;pointer-events:none;opacity:0;transform:translate(-50%,-50%);will-change:transform,opacity;transition:opacity .25s ease;z-index:2;box-shadow:0 20px 50px rgba(0,0,0,.18)`;
  element.append(list, image);

  const nodes = [...list.querySelectorAll("[data-index]")];
  let active = -1;
  let target = { x: 0, y: 0 };
  let position = { x: 0, y: 0 };
  let lastX = 0;
  const instant = ctx.reducedMotion || props.follow <= 0;

  const locate = (clientX, clientY) => {
    const rect = element.getBoundingClientRect();
    const scale = rect.width / Math.max(1, element.clientWidth) || 1;
    target = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    if (instant) position = { ...target };
  };
  const paint = () => { image.style.transform = `translate(${position.x}px,${position.y}px) translate(-50%,-50%)`; };
  const show = (index) => {
    if (index === active) return;
    active = index;
    const row = rows[index];
    if (row?.image) { if (image.getAttribute("src") !== row.image) image.src = row.image; image.style.opacity = "1"; }
    else image.style.opacity = "0";
    nodes.forEach((node, other) => { node.style.opacity = props.dimOthers && other !== index ? ".35" : "1"; node.style.color = other === index ? props.hoverColor : ""; });
  };
  const hide = () => {
    active = -1;
    image.style.opacity = "0";
    nodes.forEach((node) => { node.style.opacity = "1"; node.style.color = ""; });
  };

  const onMove = (event) => { locate(event.clientX, event.clientY); if (instant) paint(); };
  const onOver = (event) => {
    const row = event.target.closest("[data-index]");
    if (!row || event.pointerType === "touch") return;
    locate(event.clientX, event.clientY);
    if (active < 0) { position = { ...target }; paint(); }
    show(Number(row.dataset.index));
  };
  const onDown = (event) => {
    if (event.pointerType !== "touch") return;
    const row = event.target.closest("[data-index]");
    if (!row) return;
    locate(event.clientX, event.clientY); position = { ...target }; paint();
    show(Number(row.dataset.index));
  };
  const onUp = (event) => { if (event.pointerType === "touch") hide(); };
  list.addEventListener("pointermove", onMove);
  list.addEventListener("pointerover", onOver);
  list.addEventListener("pointerleave", hide);
  list.addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  const stopLoop = instant ? () => {} : ctx.loop(() => {
    if (active < 0) return;
    const ease = 1 - props.follow;
    position.x += (target.x - position.x) * ease;
    position.y += (target.y - position.y) * ease;
    const velocity = position.x - lastX; lastX = position.x;
    const tilt = Math.max(-12, Math.min(12, velocity * props.tilt * 0.6));
    image.style.transform = `translate(${position.x}px,${position.y}px) translate(-50%,-50%) rotate(${tilt}deg)`;
  });

  return () => {
    stopLoop();
    removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onUp);
    element.replaceChildren();
  };
}
