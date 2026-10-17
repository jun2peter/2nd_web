// 이미지 글리치 — 호버(또는 항상/스크롤 속도)에 따라 RGB 갈라짐·슬라이스·픽셀·스캔 효과를 캔버스에 그린다.
export const meta = {
  name: "이미지 글리치 · 픽셀",
  description: "사진 위에 글리치(RGB 갈라짐·조각 밀림), 픽셀 모자이크, 스캔라인 효과를 줘요. 호버할 때만, 항상 조금씩, 또는 스크롤 속도에 따라 세게.",
  category: "media",
  defaultSize: { width: 720, height: 480 },
  runsWhenReduced: true,
  runsOffscreen: false,
  props: [
    { key: "image", label: "이미지", type: "image", default: "" },
    { key: "mode", label: "효과", type: "select", options: [["glitch", "글리치 (RGB + 조각)"], ["pixel", "픽셀 모자이크 → 선명하게"], ["scan", "스캔라인 + 흔들림"], ["rgb", "RGB 갈라짐만"]], default: "glitch" },
    { key: "trigger", label: "언제", type: "select", options: [["hover", "호버 중 (폰: 누르는 동안)"], ["always", "항상 조금씩"], ["scroll", "스크롤 속도에 따라"]], default: "hover" },
    { key: "intensity", label: "세기", type: "range", min: 0.1, max: 2, step: 0.1, default: 1 },
    { key: "speed", label: "속도", type: "range", min: 0.2, max: 3, step: 0.1, default: 1 },
    { key: "fit", label: "맞춤", type: "select", options: [["cover", "꽉 채움"], ["contain", "전체 보이기"]], default: "cover" },
    { key: "background", label: "배경색", type: "color", default: "#000000" },
  ],
};

export function mount(element, props, ctx) {
  element.style.background = props.background;
  if (!props.image) {
    element.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:12px/1.5 Arial,sans-serif;letter-spacing:.1em;opacity:.7;text-align:center">GLITCH<br>오른쪽에서 이미지를 넣으세요</div>';
    element.style.position = "relative";
    return () => element.replaceChildren();
  }
  const surface = ctx.createCanvas("2d");
  const g = surface.context;
  const image = new Image();
  image.decoding = "async";
  image.src = ctx.asset(props.image);
  const off = document.createElement("canvas");
  const offContext = off.getContext("2d");
  let ready = false; let failed = false;
  image.addEventListener("load", () => { ready = true; });
  image.addEventListener("error", () => { failed = true; });

  let energy = 0;        // 0–1, how strong the effect is right now
  let seed = 0;
  const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const fitRect = (width, height) => {
    const scale = props.fit === "contain" ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * scale; const dh = image.naturalHeight * scale;
    return { x: (width - dw) / 2, y: (height - dh) / 2, w: dw, h: dh };
  };
  const drawBase = (width, height) => { const rect = fitRect(width, height); g.drawImage(image, rect.x, rect.y, rect.w, rect.h); return rect; };

  const stopLoop = ctx.loop((time) => {
    const width = surface.width; const height = surface.height;
    if (!width || !height) return;
    g.clearRect(0, 0, width, height);
    if (!ready) { if (failed) { g.fillStyle = "#fff"; g.font = "12px Arial"; g.fillText("이미지를 못 불러왔어요", 16, 24); } return; }
    // target energy
    let target = 0;
    if (props.trigger === "always") target = 0.35;
    else if (props.trigger === "scroll") target = Math.min(1, Math.abs(ctx.scroll.velocity || 0) / 40);
    else target = (ctx.pointer.inside && (!ctx.isTouch || ctx.pointer.down)) ? 1 : 0;
    if (ctx.reducedMotion) target = 0;
    energy += (target - energy) * (target > energy ? 0.18 : 0.08);
    const amount = energy * props.intensity;
    const t = time * props.speed;
    seed = Math.floor(t * 12) * 7919; // 초당 12번 패턴이 바뀐다
    if (amount < 0.01) { drawBase(width, height); return; }

    if (props.mode === "pixel") {
      const cell = Math.max(1, Math.round(amount * 36));
      const w = Math.max(1, Math.ceil(width / cell)); const h = Math.max(1, Math.ceil(height / cell));
      off.width = w; off.height = h;
      const rect = fitRect(w, h);
      offContext.clearRect(0, 0, w, h); offContext.drawImage(image, rect.x, rect.y, rect.w, rect.h);
      g.imageSmoothingEnabled = false;
      g.drawImage(off, 0, 0, w, h, 0, 0, width, height);
      g.imageSmoothingEnabled = true;
      return;
    }
    const rect = drawBase(width, height);
    if (props.mode === "rgb" || props.mode === "glitch") {
      const shift = amount * 14;
      g.save(); g.globalCompositeOperation = "screen"; g.globalAlpha = 0.6;
      g.filter = "saturate(6) hue-rotate(-60deg) brightness(.9)"; g.drawImage(image, rect.x - shift, rect.y, rect.w, rect.h);
      g.filter = "saturate(6) hue-rotate(140deg) brightness(.9)"; g.drawImage(image, rect.x + shift, rect.y + shift * 0.3, rect.w, rect.h);
      g.restore();
    }
    if (props.mode === "glitch") {
      const slices = Math.round(3 + amount * 9);
      for (let index = 0; index < slices; index += 1) {
        const sy = random() * height; const sh = 4 + random() * height * 0.08; const dx = (random() - 0.5) * amount * 90;
        g.drawImage(surface.canvas, 0, sy * surface.dpr, surface.pixelWidth, sh * surface.dpr, dx, sy, width, sh);
      }
    }
    if (props.mode === "scan") {
      const band = (t * 120) % (height + 80) - 40;
      g.drawImage(surface.canvas, 0, Math.max(0, band) * surface.dpr, surface.pixelWidth, 26 * surface.dpr, amount * 10, Math.max(0, band), width, 26);
      g.fillStyle = `rgba(255,255,255,${0.05 * amount})`;
      for (let y = 0; y < height; y += 4) g.fillRect(0, y, width, 1);
      g.fillStyle = `rgba(0,0,0,${0.25 * amount})`; g.fillRect(0, band - 6, width, 3);
    }
  });
  return () => { stopLoop(); };
}
