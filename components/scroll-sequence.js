// 스크롤 시퀀스 — image frames (or a muted video) scrubbed by how far this box has scrolled through the screen.
// Make the box tall (e.g. 2000px): the picture stays on screen while the box scrolls past, like product pages.
// The visible "stage" is moved by hand (translate) instead of position: sticky, so it works inside the scaled artboard
// and inside the editor's scrolling workspace.
export const meta = {
  name: "스크롤 시퀀스",
  description: "이미지 연속 프레임(또는 무음 영상)을 스크롤에 맞춰 넘겨요. 상자를 세로로 길게(예: 2000px) 만들면 그림이 화면에 붙은 채로 스크롤하는 동안 프레임이 넘어가요. 번호 패턴으로 수백 장을 한 번에 넣을 수 있어요.",
  category: "media",
  defaultSize: { width: 1200, height: 2000 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "pattern", label: "번호 패턴 주소 (예: /media/seq/frame-{0001}.jpg)", type: "text", default: "" },
    { key: "count", label: "프레임 수 (패턴일 때)", type: "number", min: 1, max: 600, step: 1, default: 60 },
    { key: "images", label: "또는 프레임 이미지 (한 줄에 하나, 순서대로)", type: "images", default: [] },
    { key: "video", label: "또는 영상 파일 (MP4·WebM, 무음)", type: "url", default: "" },
    { key: "fit", label: "맞춤", type: "select", options: [["cover", "꽉 채움"], ["contain", "전체 보이기"]], default: "cover" },
    { key: "smooth", label: "따라오는 부드러움", type: "range", min: 0, max: 0.95, step: 0.05, default: 0.6 },
    { key: "stickyTop", label: "화면 위에서 띄울 거리(px)", type: "number", min: 0, max: 400, step: 1, default: 0 },
    { key: "stageHeight", label: "보이는 높이(px, 0 = 화면 높이)", type: "number", min: 0, max: 2000, step: 10, default: 0 },
    { key: "background", label: "배경색", type: "color", default: "#000000" },
    { key: "showProgress", label: "진행 막대 보이기", type: "toggle", default: false },
  ],
};

// "/media/seq/frame-{0001}.jpg" + 3 → frame-0001, frame-0002, frame-0003 (digits inside {} give start number and padding).
function framesFromPattern(pattern, count) {
  const match = /\{(\d+)\}/.exec(pattern || "");
  if (!match) return [];
  const start = Number(match[1]);
  const pad = match[1].length;
  const total = Math.min(600, Math.max(1, Math.round(count || 1)));
  return Array.from({ length: total }, (_, index) => pattern.replace(match[0], String(start + index).padStart(pad, "0")));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function mount(element, props, ctx) {
  element.style.background = props.background;
  element.style.position = "relative";
  element.style.overflow = "hidden";

  const stage = document.createElement("div");
  stage.style.cssText = `position:absolute;left:0;top:0;width:100%;overflow:hidden;background:${props.background};will-change:transform`;
  const note = document.createElement("div");
  note.style.cssText = "position:absolute;left:16px;right:16px;bottom:16px;color:#fff;font:12px/1.4 Arial,sans-serif;opacity:.7;letter-spacing:.08em;pointer-events:none;text-align:left";
  const bar = document.createElement("div");
  bar.style.cssText = `position:absolute;left:0;bottom:0;height:3px;width:0;background:#fff;opacity:${props.showProgress ? 0.9 : 0};pointer-events:none`;
  stage.append(note, bar);
  element.append(stage);

  const lines = (props.images || []).map((line) => String(line).split("|")[0].trim()).filter(Boolean);
  const sources = (props.pattern ? framesFromPattern(props.pattern, props.count) : lines).map((src) => ctx.asset(src)).filter(Boolean);
  const videoSource = !sources.length && props.video ? ctx.asset(props.video) : "";
  if (!sources.length && !videoSource) {
    stage.style.height = "100%";
    note.textContent = "SCROLL SEQUENCE · 오른쪽에서 번호 패턴·이미지 목록·영상 중 하나를 넣으세요";
    return () => element.replaceChildren();
  }

  // Stage height = one screen (in artboard px, so it still fills the screen when the artboard is scaled).
  let stageHeight = 0;
  let scale = 1;
  const measureStage = () => {
    const rect = element.getBoundingClientRect();
    scale = rect.width / Math.max(1, element.clientWidth) || 1;
    const wanted = props.stageHeight > 0 ? props.stageHeight : Math.round(innerHeight / scale);
    stageHeight = Math.max(40, Math.min(wanted, element.clientHeight || wanted));
    stage.style.height = `${stageHeight}px`;
  };
  measureStage();

  let shown = 0;
  const smoothing = ctx.reducedMotion ? 0 : props.smooth;
  // Returns 0–1: how far the box has travelled while the stage is held on screen.
  const advance = () => {
    const rect = element.getBoundingClientRect();
    const travel = element.clientHeight - stageHeight;
    let progress;
    if (travel > 8) {
      const offset = clamp((props.stickyTop * scale - rect.top) / scale, 0, travel);
      stage.style.transform = `translate3d(0,${offset}px,0)`;
      progress = offset / travel;
    } else {
      stage.style.transform = "";
      progress = ctx.scroll.progress;
    }
    shown += (progress - shown) * (1 - smoothing);
    if (Math.abs(progress - shown) < 0.0005) shown = progress;
    bar.style.width = `${shown * 100}%`;
    return shown;
  };

  if (videoSource) {
    const player = document.createElement("video");
    player.muted = true; player.playsInline = true; player.preload = "auto"; player.loop = false;
    player.setAttribute("muted", ""); player.setAttribute("playsinline", "");
    player.src = videoSource;
    player.style.cssText = `display:block;width:100%;height:100%;object-fit:${props.fit}`;
    stage.prepend(player);
    note.textContent = ctx.editing ? "VIDEO SCRUB · 공개 화면에서 스크롤해 보세요 (키프레임이 촘촘한 MP4가 부드러워요)" : "";
    let lastTime = -1;
    const stopLoop = ctx.loop(() => {
      const progress = advance();
      if (!Number.isFinite(player.duration) || player.duration <= 0 || player.readyState < 1 || player.seeking) return;
      const time = progress * Math.max(0, player.duration - 0.05);
      if (Math.abs(time - lastTime) > 1 / 60) { player.currentTime = time; lastTime = time; }
    });
    const stopResize = ctx.onResize(measureStage);
    return () => { stopLoop(); stopResize(); player.pause(); player.removeAttribute("src"); player.load(); element.replaceChildren(); };
  }

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  const g = canvas.getContext("2d");
  stage.prepend(canvas);
  let width = 1; let height = 1; let drawnIndex = -1;
  const size = () => {
    measureStage();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, element.clientWidth); height = Math.max(1, stageHeight);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawnIndex = -1;
  };
  size();

  const frames = sources.map((src) => { const image = new Image(); image.decoding = "async"; image.src = src; return image; });
  let loaded = 0; let failed = 0;
  frames.forEach((image) => { image.addEventListener("load", () => { loaded += 1; }); image.addEventListener("error", () => { failed += 1; }); });

  const draw = (index) => {
    const image = frames[index];
    if (!image?.complete || !image.naturalWidth) return false;
    g.clearRect(0, 0, width, height);
    const fit = props.fit === "contain" ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * fit; const dh = image.naturalHeight * fit;
    g.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
    drawnIndex = index;
    return true;
  };

  const stopLoop = ctx.loop(() => {
    const progress = advance();
    const index = clamp(Math.round(progress * (frames.length - 1)), 0, frames.length - 1);
    if (index !== drawnIndex) {
      // While frames are still loading, fall back to the nearest frame that has arrived.
      if (!draw(index)) { for (let step = 1; step < frames.length; step += 1) { if (draw(index - step) || draw(index + step)) break; } }
    }
    const pending = frames.length - loaded - failed;
    note.textContent = pending > 0 ? `프레임 불러오는 중 ${loaded}/${frames.length}` : failed ? `${failed}장을 못 불러왔어요 · 주소를 확인하세요` : ctx.editing ? `${frames.length} FRAMES · 공개 화면에서 스크롤해 보세요` : "";
  });
  const stopResize = ctx.onResize(size);
  return () => { stopLoop(); stopResize(); element.replaceChildren(); };
}
