// 미디어 텍스트 — big type filled with an image or a muted video (SVG clipPath made of <text>, so video works too).
// The fill can drift with scroll (parallax) and the mouse while the letters stay put.
export const meta = {
  name: "미디어 텍스트",
  description: "큰 글자 안을 이미지나 영상으로 채워요. 글자 크기 0이면 상자 너비에 맞춰 자동으로 키워요. 스크롤·마우스에 따라 안쪽 그림만 움직이게 할 수 있어요.",
  category: "text",
  defaultSize: { width: 1200, height: 320 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "text", label: "글자 (줄바꿈 가능)", type: "textarea", default: "ARCHIVE" },
    { key: "image", label: "이미지", type: "image", default: "" },
    { key: "video", label: "또는 영상 (MP4·WebM, 무음 반복)", type: "url", default: "" },
    { key: "fontFamily", label: "폰트", type: "text", default: "Arial Black, Impact, sans-serif" },
    { key: "fontWeight", label: "굵기", type: "number", min: 100, max: 1000, step: 100, default: 900 },
    { key: "fontSize", label: "글자 크기(px, 0 = 너비에 맞춤)", type: "number", min: 0, max: 1200, step: 1, default: 0 },
    { key: "letterSpacing", label: "자간(em)", type: "range", min: -0.1, max: 0.5, step: 0.01, default: -0.02 },
    { key: "lineHeight", label: "행간", type: "range", min: 0.6, max: 1.6, step: 0.05, default: 0.9 },
    { key: "align", label: "정렬", type: "select", options: [["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]], default: "center" },
    { key: "parallax", label: "스크롤 패럴랙스 세기", type: "range", min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: "mouse", label: "마우스 따라 살짝 이동", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
    { key: "background", label: "글자 밖 배경 (예: transparent, #fff)", type: "text", default: "transparent" },
  ],
};

let instanceCount = 0;
const SVG = "http://www.w3.org/2000/svg";

export function mount(element, props, ctx) {
  const id = `media-text-${++instanceCount}-${Math.random().toString(36).slice(2, 7)}`;
  element.style.position = "relative";
  element.style.overflow = "hidden";
  element.style.background = /^[#(),.%\w\s-]+$/.test(props.background || "") ? props.background : "transparent";

  const source = props.video ? ctx.asset(props.video) : props.image ? ctx.asset(props.image) : "";
  const text = String(props.text || "").replace(/\r/g, "");
  if (!source || !text.trim()) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#888;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;text-align:center">MEDIA TEXT<br>오른쪽에서 글자와 이미지(또는 영상)를 넣으세요</div>';
    return () => element.replaceChildren();
  }

  // Hidden SVG holding the text-shaped clip; the media element is clipped by it (userSpaceOnUse = element px).
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  const clip = document.createElementNS(SVG, "clipPath");
  clip.setAttribute("id", id); clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const defs = document.createElementNS(SVG, "defs");
  defs.append(clip); svg.append(defs);

  const isVideo = Boolean(props.video);
  const media = document.createElement(isVideo ? "video" : "img");
  if (isVideo) { media.muted = true; media.loop = true; media.playsInline = true; media.autoplay = true; media.preload = "auto"; media.setAttribute("muted", ""); media.setAttribute("playsinline", ""); }
  else { media.alt = text.replace(/\n/g, " "); media.decoding = "async"; }
  media.src = source;
  media.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;clip-path:url(#${id});-webkit-clip-path:url(#${id});display:block`;
  element.append(svg, media);

  const probe = document.createElement("canvas").getContext("2d");
  const lines = text.split("\n").map((line) => line.replace(/\s+$/, "")).map((line) => line || " ");

  const layout = () => {
    const width = Math.max(1, element.clientWidth);
    const height = Math.max(1, element.clientHeight);
    let size = props.fontSize > 0 ? props.fontSize : 0;
    if (!size) {
      probe.font = `${props.fontWeight} 100px ${props.fontFamily}`;
      const widest = Math.max(...lines.map((line) => probe.measureText(line).width / 100 + props.letterSpacing * Math.max(0, line.length - 1)));
      const byWidth = (width * 0.98) / Math.max(0.05, widest);
      const byHeight = height / Math.max(0.1, lines.length * props.lineHeight);
      size = Math.max(8, Math.min(byWidth, byHeight));
    }
    const blockHeight = lines.length * size * props.lineHeight;
    const top = (height - blockHeight) / 2;
    const x = props.align === "left" ? width * 0.01 : props.align === "right" ? width * 0.99 : width / 2;
    const anchor = props.align === "left" ? "start" : props.align === "right" ? "end" : "middle";
    clip.replaceChildren(...lines.map((line, index) => {
      const node = document.createElementNS(SVG, "text");
      node.setAttribute("x", String(x));
      node.setAttribute("y", String(top + (index + 0.5) * size * props.lineHeight));
      node.setAttribute("text-anchor", anchor);
      node.setAttribute("dominant-baseline", "central");
      node.setAttribute("font-family", props.fontFamily);
      node.setAttribute("font-weight", String(props.fontWeight));
      node.setAttribute("font-size", String(size));
      node.setAttribute("letter-spacing", `${props.letterSpacing * size}`);
      node.textContent = line;
      return node;
    }));
  };
  layout();
  if (document.fonts?.ready) document.fonts.ready.then(() => { if (element.isConnected) layout(); });
  const stopResize = ctx.onResize(layout);

  let stopLoop = () => {};
  if ((props.parallax > 0 || props.mouse > 0) && !ctx.reducedMotion) {
    let mx = 0; let my = 0;
    stopLoop = ctx.loop(() => {
      const pointer = ctx.pointer;
      const targetX = pointer.inWindow ? (pointer.x - 0.5) * props.mouse * 30 : 0;
      const targetY = pointer.inWindow ? (pointer.y - 0.5) * props.mouse * 30 : 0;
      mx += (targetX - mx) * 0.08; my += (targetY - my) * 0.08;
      const drift = (ctx.scroll.progress - 0.5) * props.parallax * 60;
      media.style.objectPosition = `${50 + mx}% ${50 + my + drift}%`;
    });
  }
  if (isVideo) media.play?.().catch(() => {});

  return {
    destroy() { stopLoop(); stopResize(); if (isVideo) { media.pause(); media.removeAttribute("src"); media.load(); } element.replaceChildren(); },
    resize: layout,
    paused(isPaused) { if (!isVideo) return; if (isPaused) media.pause(); else media.play?.().catch(() => {}); },
  };
}
