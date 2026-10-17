// 가로 스크롤 섹션 — 세로로 긴 상자를 스크롤하는 동안 카드 줄이 옆으로 흘러간다 (스크롤 하이재킹 없이 translate로).
// 상자를 길게(예: 2400px) 만들수록 천천히 지나간다.
export const meta = {
  name: "가로 스크롤 섹션",
  description: "세로 스크롤을 가로 이동으로 바꿔요. 상자를 세로로 길게(예: 2400px) 만들면 화면에 붙은 채로 카드들이 옆으로 지나가요. 한 줄에 하나: 제목 | 이미지 | 설명 | 링크(선택).",
  category: "media",
  defaultSize: { width: 1440, height: 2400 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "items", label: "카드 (한 줄에 하나: 제목 | 이미지 | 설명 | 링크)", type: "textarea", default: "첫 번째 작품 | https://picsum.photos/seed/hs1/900/700 | 2026 · 설치\n두 번째 작품 | https://picsum.photos/seed/hs2/900/700 | 2025 · 영상\n세 번째 작품 | https://picsum.photos/seed/hs3/900/700 | 2025 · 리서치\n네 번째 작품 | https://picsum.photos/seed/hs4/900/700 | 2024 · 공예" },
    { key: "heading", label: "맨 앞 제목 (비우면 없음)", type: "text", default: "SELECTED\nWORKS" },
    { key: "cardWidth", label: "카드 너비(px)", type: "number", min: 160, max: 1200, step: 10, default: 520 },
    { key: "ratio", label: "이미지 비율", type: "select", options: [["4/3", "4:3"], ["3/2", "3:2"], ["16/9", "16:9"], ["1/1", "1:1"], ["3/4", "3:4 세로"]], default: "4/3" },
    { key: "gap", label: "카드 간격(px)", type: "number", min: 0, max: 200, step: 4, default: 32 },
    { key: "padding", label: "좌우 여백(px)", type: "number", min: 0, max: 400, step: 10, default: 80 },
    { key: "background", label: "배경색", type: "color", default: "#0b0b0c" },
    { key: "textColor", label: "글자색", type: "color", default: "#f4f3ed" },
    { key: "fontFamily", label: "폰트", type: "text", default: "Arial, sans-serif" },
    { key: "smooth", label: "따라오는 부드러움", type: "range", min: 0, max: 0.95, step: 0.05, default: 0.7 },
    { key: "stickyTop", label: "화면 위에서 띄울 거리(px)", type: "number", min: 0, max: 400, step: 1, default: 0 },
    { key: "showProgress", label: "진행 막대 보이기", type: "toggle", default: true },
  ],
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const safeLink = (value) => (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\?|#)/i.test(value) ? value : "");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mount(element, props, ctx) {
  const rows = String(props.items || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = "", image = "", caption = "", link = ""] = line.split("|").map((part) => part.trim());
    return { title, image: image ? ctx.asset(image) : "", caption, link: safeLink(link) };
  });
  element.style.cssText += `;position:relative;overflow:hidden;background:${props.background};color:${props.textColor}`;
  if (!rows.length) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;opacity:.7;text-align:center">HORIZONTAL SCROLL<br>오른쪽 목록에 카드를 한 줄씩 넣으세요</div>';
    return () => element.replaceChildren();
  }
  const stage = document.createElement("div");
  stage.style.cssText = "position:absolute;left:0;top:0;width:100%;overflow:hidden;will-change:transform";
  const track = document.createElement("div");
  track.style.cssText = `display:flex;align-items:center;gap:${props.gap}px;height:100%;padding:0 ${props.padding}px;box-sizing:border-box;will-change:transform;width:max-content;font-family:${props.fontFamily}`;
  const heading = String(props.heading || "").trim();
  if (heading) {
    const head = document.createElement("div");
    head.style.cssText = `flex:0 0 auto;width:${Math.round(props.cardWidth * 0.7)}px;font-weight:800;font-size:${Math.round(props.cardWidth * 0.13)}px;line-height:.95;letter-spacing:-.03em;white-space:pre-line`;
    head.textContent = heading;
    track.append(head);
  }
  rows.forEach((row, index) => {
    const card = document.createElement(row.link ? "a" : "div");
    if (row.link) { card.href = row.link; card.style.textDecoration = "none"; }
    card.style.cssText += `;flex:0 0 auto;width:${props.cardWidth}px;color:inherit;display:block`;
    card.innerHTML = `<div style="width:100%;aspect-ratio:${props.ratio};background:rgba(255,255,255,.06);overflow:hidden;border-radius:4px">${row.image ? `<img src="${escapeHTML(row.image)}" alt="${escapeHTML(row.title)}" loading="lazy" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.22,1,.36,1)">` : ""}</div><div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-top:14px"><strong style="font-size:18px;font-weight:600">${escapeHTML(row.title)}</strong><small style="font-size:12px;opacity:.6;white-space:nowrap">${escapeHTML(row.caption || String(index + 1).padStart(2, "0"))}</small></div>`;
    if (!ctx.isTouch) { card.addEventListener("pointerenter", () => { const img = card.querySelector("img"); if (img) img.style.transform = "scale(1.04)"; }); card.addEventListener("pointerleave", () => { const img = card.querySelector("img"); if (img) img.style.transform = ""; }); }
    track.append(card);
  });
  const bar = document.createElement("div");
  bar.style.cssText = `position:absolute;left:${props.padding}px;right:${props.padding}px;bottom:28px;height:2px;background:rgba(255,255,255,.18);opacity:${props.showProgress ? 1 : 0}`;
  bar.innerHTML = '<i style="position:absolute;left:0;top:0;height:100%;width:0;background:currentColor"></i>';
  stage.append(track, bar);
  element.append(stage);

  let stageHeight = 0; let scale = 1;
  const measure = () => {
    const rect = element.getBoundingClientRect();
    scale = rect.width / Math.max(1, element.clientWidth) || 1;
    stageHeight = Math.max(200, Math.min(Math.round(innerHeight / scale), element.clientHeight || 99999));
    stage.style.height = `${stageHeight}px`;
  };
  measure();
  let shown = 0;
  const smoothing = ctx.reducedMotion ? 0 : props.smooth;
  const stopLoop = ctx.loop(() => {
    const rect = element.getBoundingClientRect();
    const travel = element.clientHeight - stageHeight;
    let progress;
    if (travel > 8) { const offset = clamp((props.stickyTop * scale - rect.top) / scale, 0, travel); stage.style.transform = `translate3d(0,${offset}px,0)`; progress = offset / travel; }
    else { stage.style.transform = ""; progress = ctx.scroll.progress; }
    shown += (progress - shown) * (1 - smoothing);
    if (Math.abs(progress - shown) < 0.0005) shown = progress;
    const distance = Math.max(0, track.scrollWidth - element.clientWidth);
    track.style.transform = `translate3d(${-shown * distance}px,0,0)`;
    bar.firstElementChild.style.width = `${shown * 100}%`;
  });
  const stopResize = ctx.onResize(measure);
  return () => { stopLoop(); stopResize(); element.replaceChildren(); };
}
