// 비포 / 애프터 — two images under one draggable divider (mouse, touch, keyboard ←→).
export const meta = {
  name: "비포 / 애프터",
  description: "두 이미지를 분할선으로 비교해요. 방문자가 선을 드래그하고, 키보드 ←→로도 움직여요. 보정 전후, 스케치와 완성, 낮과 밤 비교에 좋아요.",
  category: "media",
  defaultSize: { width: 900, height: 560 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "before", label: "왼쪽(위) 이미지", type: "image", default: "" },
    { key: "after", label: "오른쪽(아래) 이미지", type: "image", default: "" },
    { key: "labelBefore", label: "왼쪽 라벨", type: "text", default: "BEFORE" },
    { key: "labelAfter", label: "오른쪽 라벨", type: "text", default: "AFTER" },
    { key: "start", label: "처음 위치(%)", type: "range", min: 0, max: 100, step: 1, default: 50 },
    { key: "direction", label: "방향", type: "select", options: [["horizontal", "좌우"], ["vertical", "상하"]], default: "horizontal" },
    { key: "fit", label: "맞춤", type: "select", options: [["cover", "꽉 채움"], ["contain", "전체 보이기"]], default: "cover" },
    { key: "lineColor", label: "선·손잡이 색", type: "color", default: "#ffffff" },
    { key: "hoverFollow", label: "마우스만 올려도 따라가기", type: "toggle", default: false },
    { key: "showLabels", label: "라벨 보이기", type: "toggle", default: true },
  ],
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export function mount(element, props, ctx) {
  const before = props.before ? ctx.asset(props.before) : "";
  const after = props.after ? ctx.asset(props.after) : "";
  element.style.position = "relative"; element.style.overflow = "hidden"; element.style.userSelect = "none"; element.style.touchAction = "none"; element.style.background = "#111";
  if (!before || !after) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;opacity:.7;text-align:center">BEFORE / AFTER<br>오른쪽에서 이미지 두 장을 넣으세요</div>';
    return () => element.replaceChildren();
  }
  const horizontal = props.direction !== "vertical";
  const picture = (src, label, extra = "") => `<img src="${escapeHTML(src)}" alt="${escapeHTML(label)}" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${props.fit};${extra}">`;
  const tag = (label, place) => props.showLabels && label ? `<small style="position:absolute;${place};font:600 11px/1 Arial,sans-serif;letter-spacing:.14em;color:#fff;background:rgba(0,0,0,.45);padding:6px 8px;border-radius:4px;pointer-events:none">${escapeHTML(label)}</small>` : "";
  element.innerHTML = `${picture(before, props.labelBefore)}${picture(after, props.labelAfter, horizontal ? "clip-path:inset(0 0 0 50%)" : "clip-path:inset(50% 0 0 0)")}
    <div data-line style="position:absolute;${horizontal ? "top:0;bottom:0;width:2px;margin-left:-1px;left:50%" : "left:0;right:0;height:2px;margin-top:-1px;top:50%"};background:${props.lineColor};box-shadow:0 0 12px rgba(0,0,0,.35)"><span style="position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:${props.lineColor};display:grid;place-items:center;font:700 13px Arial,sans-serif;color:#111;box-shadow:0 6px 20px rgba(0,0,0,.3);letter-spacing:-.05em">${horizontal ? "◂▸" : "▴▾"}</span></div>
    ${tag(props.labelBefore, "left:14px;top:14px")}${tag(props.labelAfter, horizontal ? "right:14px;top:14px" : "left:14px;bottom:14px")}`;
  const afterImage = element.querySelectorAll("img")[1];
  const line = element.querySelector("[data-line]");
  let value = Math.min(100, Math.max(0, Number(props.start) || 0));

  const render = () => {
    afterImage.style.clipPath = horizontal ? `inset(0 0 0 ${value}%)` : `inset(${value}% 0 0 0)`;
    if (horizontal) line.style.left = `${value}%`; else line.style.top = `${value}%`;
    element.setAttribute("aria-valuenow", String(Math.round(value)));
  };
  element.setAttribute("role", "slider"); element.tabIndex = 0;
  element.setAttribute("aria-valuemin", "0"); element.setAttribute("aria-valuemax", "100");
  element.setAttribute("aria-label", `${props.labelBefore} / ${props.labelAfter}`);

  let dragging = false;
  const fromEvent = (event) => {
    const rect = element.getBoundingClientRect();
    const ratio = horizontal ? (event.clientX - rect.left) / Math.max(1, rect.width) : (event.clientY - rect.top) / Math.max(1, rect.height);
    value = Math.min(100, Math.max(0, ratio * 100));
    render();
  };
  const down = (event) => { dragging = true; try { element.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ } fromEvent(event); };
  const move = (event) => { if (dragging || (props.hoverFollow && event.pointerType === "mouse")) fromEvent(event); };
  const up = () => { dragging = false; };
  const key = (event) => {
    const step = event.shiftKey ? 10 : 2;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) { value = Math.max(0, value - step); render(); event.preventDefault(); }
    if (["ArrowRight", "ArrowDown"].includes(event.key)) { value = Math.min(100, value + step); render(); event.preventDefault(); }
  };
  element.addEventListener("pointerdown", down); element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up); element.addEventListener("pointercancel", up); element.addEventListener("keydown", key);
  render();
  return () => {
    element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up); element.removeEventListener("pointercancel", up); element.removeEventListener("keydown", key);
    ["role", "tabindex", "aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-label"].forEach((name) => element.removeAttribute(name));
    element.replaceChildren();
  };
}
