import {
  LAYOUTS,
  LAYOUT_LABELS,
  OVERRIDE_KEYS,
  autoLayout,
  blockPositionStyle,
  blocksOutsideLayout,
  clearOverrides,
  currentLayout,
  hasOverride,
  isLayoutEnabled,
  layoutBox,
  normalizeLayouts,
  normalizeResponsive,
  normalizeResponsiveSettings,
  placeNewBlockOnLayouts,
  resolveBlock,
  responsiveCSS,
  setOverride,
} from "./archive/responsive.js?v=studio8b";
import {
  bindCodeBlocks,
  codeBlockDocument,
  componentMetas,
  detachLiveComponents,
  isRegisteredComponent,
  loadComponentMetas,
  mountComponents,
  reattachLiveComponents,
  resolveProps,
  sanitizeProps,
} from "./archive/components-host.js?v=studio8b";
import { bindCustomCursor, bindMagnetic, bindPins, bindSmoothScroll, bindSplitText } from "./archive/effects.js?v=studio8b";
import { toast, openModal, closeModal, openCommandPalette, closePalette, shortcutSheetMarkup, emptyStateMarkup } from "./archive/studio-ui.js?v=studio8b";
import { SECTION_TEMPLATES, PAGE_TEMPLATES, sectionTemplate, sectionSketch } from "./archive/templates.js?v=studio8b";
import { listCheckpoints, saveCheckpoint, loadCheckpoint, deleteCheckpoint, formatBytes, formatWhen } from "./archive/checkpoints.js?v=studio8b";
import { parseRepoFromEditURL, getToken, setToken, getRepoConfig, setRepoConfig, checkConnection, publishArchive, uploadMedia, fetchFileMeta, putFile, encodeText } from "./archive/github-publish.js?v=studio8b";

const DATA_VERSION = 5;
const STORAGE_KEY = "psj-archive-builder-draft-v5";
const LEGACY_STORAGE_KEYS = ["psj-archive-builder-draft-v4", "psj-archive-builder-draft-v3", "psj-archive-builder-draft-v2", "psj-archive-canvas-draft-v1"];
const GITHUB_EDIT_URL = "https://github.com/jun2peter/2nd_web/edit/main/content/archive.json";
const GITHUB_MEDIA_UPLOAD_URL = "https://github.com/jun2peter/2nd_web/upload/main/media";

const BLOCK_TYPES = ["text", "image", "video", "audio", "button", "shape", "line", "marquee", "gallery", "embed", "nav", "component", "code", "form"];
// Studio 8: 마스크 프리셋(A13) · 듀오톤(A15) · 폼 칸(C4)
const MASK_PRESETS = ["none", "fade-bottom", "fade-top", "fade-left", "fade-right", "fade-x", "fade-y", "vignette", "image"];
const MASK_PRESET_LABELS = { none: "없음", "fade-bottom": "아래로 흐려짐", "fade-top": "위로 흐려짐", "fade-left": "왼쪽으로 흐려짐", "fade-right": "오른쪽으로 흐려짐", "fade-x": "양옆 흐려짐", "fade-y": "위아래 흐려짐", vignette: "비네트 (가장자리 어둡게 뚫기)", image: "이미지 마스크 (PNG·SVG)" };
const MASK_GRADIENTS = {
  "fade-bottom": "linear-gradient(to bottom, #000 55%, transparent 100%)",
  "fade-top": "linear-gradient(to top, #000 55%, transparent 100%)",
  "fade-left": "linear-gradient(to left, #000 55%, transparent 100%)",
  "fade-right": "linear-gradient(to right, #000 55%, transparent 100%)",
  "fade-x": "linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)",
  "fade-y": "linear-gradient(to bottom, transparent, #000 18%, #000 82%, transparent)",
  vignette: "radial-gradient(ellipse at center, #000 52%, transparent 100%)",
};
const FORM_FIELDS = ["name", "email", "phone", "subject", "message"];
const FORM_FIELD_LABELS = { name: "이름", email: "이메일", phone: "전화", subject: "제목", message: "메시지" };
function hexToRGB(value) {
  const hex = String(value || "").trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex); const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (short) return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)];
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  return null;
}
function maskImageFor(block = {}) {
  if (block.maskPreset === "image") { const url = safeURL(block.maskImage, { imageData: true }); return url ? `url('${escapeHTML(url)}')` : ""; }
  return MASK_GRADIENTS[block.maskPreset] || "";
}
function duotoneFilterMarkup(block) {
  const dark = hexToRGB(block.duotoneDark); const light = hexToRGB(block.duotoneLight);
  if (!dark || !light) return "";
  const table = (channel) => `${(dark[channel] / 255).toFixed(3)} ${(light[channel] / 255).toFixed(3)}`;
  return `<svg class="canvas-duotone" width="0" height="0" aria-hidden="true" focusable="false"><filter id="duo-${escapeHTML(block.id)}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/><feFuncB type="table" tableValues="${table(2)}"/></feComponentTransfer></filter></svg>`;
}
const MOTION_LAB_TRIGGERS = ["load", "in-view", "hover", "press", "click", "scroll", "linked"];
const TRANSITION_PRESETS = ["none", "fade", "slide", "zoom", "wipe", "circle", "blur"];
const CURSOR_PRESETS = ["default", "dot", "crosshair", "ring", "blend"];
const MOTION_LAB_ORIGINS = ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left"];
// Studio 6: media as material — clip shapes, hover states (see visualEffectStyle / imageMarkup / inspectorMarkup).
const CLIP_SHAPES = ["none", "circle", "ellipse", "triangle", "diamond", "hexagon", "star", "blob", "blob2", "arch", "pill", "custom"];
const CLIP_SHAPE_LABELS = { none: "자르지 않음", circle: "원", ellipse: "타원", triangle: "삼각형", diamond: "마름모", hexagon: "육각형", star: "별", blob: "블롭 1", blob2: "블롭 2", arch: "아치", pill: "캡슐", custom: "직접 입력 (clip-path)" };
const CLIP_PATHS = {
  circle: "circle(50% at 50% 50%)",
  ellipse: "ellipse(50% 50% at 50% 50%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  blob: "inset(0 round 60% 40% 30% 70% / 60% 30% 70% 40%)",
  blob2: "inset(0 round 30% 70% 70% 30% / 30% 30% 70% 70%)",
  arch: "inset(0 round 50% 50% 0 0 / 100% 100% 0 0)",
  pill: "inset(0 round 9999px)",
};
const HOVER_EFFECTS = ["none", "zoom", "color", "gray", "bright", "lift", "swap"];
const HOVER_EFFECT_LABELS = { none: "없음", zoom: "살짝 확대", color: "흑백 → 컬러", gray: "컬러 → 흑백", bright: "밝아짐", lift: "떠오름 (그림자)", swap: "다른 이미지로 교체" };
// clip-path for a block: a preset, or a sanitized custom shape (polygon/circle/ellipse/inset/path only).
// Studio 7 · 폰트 고르기. google: 구글 폰트 이름(불러오기용), family: CSS font-family 값, weights: 요청할 굵기(없으면 기본만).
const FONT_LIBRARY = [
  { name: "Noto Sans KR", family: '"Noto Sans KR", sans-serif', google: true, lang: "ko", weights: "100..900" },
  { name: "Noto Serif KR", family: '"Noto Serif KR", serif', google: true, lang: "ko", weights: "200..900" },
  { name: "Pretendard (직접 CSS 필요)", family: '"Pretendard", "Noto Sans KR", sans-serif', google: false, lang: "ko", sample: "가나다라 Pretendard 123 · 페이지 설정에 CSS 주소 필요" },
  { name: "Gothic A1", family: '"Gothic A1", sans-serif', google: true, lang: "ko", weights: "100;200;300;400;500;600;700;800;900" },
  { name: "IBM Plex Sans KR", family: '"IBM Plex Sans KR", sans-serif', google: true, lang: "ko", weights: "100;200;300;400;500;600;700" },
  { name: "Nanum Gothic", family: '"Nanum Gothic", sans-serif', google: true, lang: "ko", weights: "400;700;800" },
  { name: "Nanum Myeongjo", family: '"Nanum Myeongjo", serif', google: true, lang: "ko", weights: "400;700;800" },
  { name: "Gowun Dodum", family: '"Gowun Dodum", sans-serif', google: true, lang: "ko" },
  { name: "Gowun Batang", family: '"Gowun Batang", serif', google: true, lang: "ko", weights: "400;700" },
  { name: "Hahmlet", family: '"Hahmlet", serif', google: true, lang: "ko", weights: "100..900" },
  { name: "Song Myung", family: '"Song Myung", serif', google: true, lang: "ko" },
  { name: "Sunflower", family: '"Sunflower", sans-serif', google: true, lang: "ko", weights: "300;500;700" },
  { name: "Black Han Sans", family: '"Black Han Sans", sans-serif', google: true, lang: "ko" },
  { name: "Do Hyeon", family: '"Do Hyeon", sans-serif', google: true, lang: "ko" },
  { name: "Jua", family: '"Jua", sans-serif', google: true, lang: "ko" },
  { name: "Nanum Pen Script", family: '"Nanum Pen Script", cursive', google: true, lang: "ko" },
  { name: "East Sea Dokdo", family: '"East Sea Dokdo", cursive', google: true, lang: "ko" },
  { name: "Inter", family: '"Inter", sans-serif', google: true, lang: "en", role: "text", weights: "100..900" },
  { name: "Roboto", family: '"Roboto", sans-serif', google: true, lang: "en", role: "text", weights: "100..900" },
  { name: "DM Sans", family: '"DM Sans", sans-serif', google: true, lang: "en", role: "text", weights: "100..1000" },
  { name: "Manrope", family: '"Manrope", sans-serif', google: true, lang: "en", role: "text", weights: "200..800" },
  { name: "Space Grotesk", family: '"Space Grotesk", sans-serif', google: true, lang: "en", role: "text", weights: "300..700" },
  { name: "Montserrat", family: '"Montserrat", sans-serif', google: true, lang: "en", role: "text", weights: "100..900" },
  { name: "Poppins", family: '"Poppins", sans-serif', google: true, lang: "en", role: "text", weights: "100;200;300;400;500;600;700;800;900" },
  { name: "Lora", family: '"Lora", serif', google: true, lang: "en", role: "text", weights: "400..700" },
  { name: "EB Garamond", family: '"EB Garamond", serif', google: true, lang: "en", role: "text", weights: "400..800" },
  { name: "Cormorant Garamond", family: '"Cormorant Garamond", serif', google: true, lang: "en", role: "text", weights: "300;400;500;600;700" },
  { name: "JetBrains Mono", family: '"JetBrains Mono", monospace', google: true, lang: "en", role: "text", weights: "100..800" },
  { name: "Space Mono", family: '"Space Mono", monospace', google: true, lang: "en", role: "text", weights: "400;700" },
  { name: "Playfair Display", family: '"Playfair Display", serif', google: true, lang: "en", role: "display", weights: "400..900" },
  { name: "Instrument Serif", family: '"Instrument Serif", serif', google: true, lang: "en", role: "display" },
  { name: "Fraunces", family: '"Fraunces", serif', google: true, lang: "en", role: "display", weights: "100..900" },
  { name: "Bebas Neue", family: '"Bebas Neue", sans-serif', google: true, lang: "en", role: "display" },
  { name: "Anton", family: '"Anton", sans-serif', google: true, lang: "en", role: "display" },
  { name: "Oswald", family: '"Oswald", sans-serif', google: true, lang: "en", role: "display", weights: "200..700" },
  { name: "Archivo Black", family: '"Archivo Black", sans-serif', google: true, lang: "en", role: "display" },
  { name: "Syne", family: '"Syne", sans-serif', google: true, lang: "en", role: "display", weights: "400..800" },
  { name: "Unbounded", family: '"Unbounded", sans-serif', google: true, lang: "en", role: "display", weights: "200..900" },
  { name: "Arial", family: "Arial, sans-serif", google: false, lang: "sys", sample: "기본 고딕 · Arial Abc 123" },
  { name: "Georgia", family: "Georgia, serif", google: false, lang: "sys", sample: "기본 세리프 · Georgia Abc 123" },
  { name: "Times New Roman", family: '"Times New Roman", serif', google: false, lang: "sys", sample: "Times Abc 123" },
  { name: "Courier New", family: '"Courier New", monospace', google: false, lang: "sys", sample: "Courier Abc 123" },
  { name: "시스템 기본 (system-ui)", family: "system-ui, -apple-system, sans-serif", google: false, lang: "sys", sample: "기기에 설치된 기본 글꼴 가나다 Abc" },
];
export function googleFontsHref(names = []) {
  const families = [...new Set(names.map((name) => String(name).trim()).filter(Boolean))].slice(0, 40).map((name) => {
    const known = FONT_LIBRARY.find((font) => font.google && font.name === name);
    const axis = known?.weights ? `:wght@${known.weights}` : "";
    return `family=${encodeURIComponent(name).replace(/%20/g, "+")}${axis}`;
  });
  return families.length ? `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap` : "";
}

function clipPathFor(block = {}) {
  if (block.clipShape === "custom") {
    const custom = String(block.clipCustom || "").replace(/[;{}<>\\]/g, "").replaceAll('"', "'").trim();
    return /^(polygon|circle|ellipse|inset|path)\(.+\)$/i.test(custom) ? custom : "";
  }
  return CLIP_PATHS[block.clipShape] || "";
}
const clone = (value) => JSON.parse(JSON.stringify(value));

const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const number = (value, fallback = 0, min = -100000, max = 100000) => {
  if (value == null || (typeof value === "string" && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const cssText = (value, fallback = "") => {
  const clean = String(value ?? "").replace(/[;{}<>"'\\]/g, "").trim();
  return clean || fallback;
};

const cssColor = (value, fallback = "transparent") => {
  const clean = String(value ?? "").trim();
  return /^[#(),.%\w\s-]+$/.test(clean) ? clean : fallback;
};

function normalizeEasing(value, fallback = "cubic-bezier(.22,1,.36,1)") {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"].includes(raw)) return raw;
  const bezier = raw.match(/^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/);
  if (bezier) {
    const values = bezier.slice(1).map(Number);
    if (values.every(Number.isFinite) && values[0] >= 0 && values[0] <= 1 && values[2] >= 0 && values[2] <= 1) return `cubic-bezier(${values.join(",")})`;
  }
  const steps = raw.match(/^steps\(\s*(\d+)\s*,\s*(start|end)\s*\)$/);
  if (steps) return `steps(${number(steps[1], 1, 1, 100)},${steps[2]})`;
  return fallback;
}

const safeId = (value, fallback = "item") => {
  const clean = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || fallback;
};

const safeSlug = (value, fallback = "page") => {
  const clean = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_\-/]+/gu, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^-+|-+$/g, "")
    .replace(/^\/+|\/+$/g, "");
  return clean || fallback;
};

const uid = (prefix = "item") => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${id}`;
};

function safeURL(value = "", { imageData = false, link = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (imageData && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw) && !/["'<>\\]/.test(raw)) return raw;
  if (link && /^(?:mailto:|tel:|#|\?)/i.test(raw) && !/["'<>\\]/.test(raw)) return raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("//") && !/["'<>\\\r\n]/.test(raw)) {
    const encoded = encodeURI(raw).replace(/%25([0-9a-f]{2})/gi, "%$1");
    return encoded.startsWith("/") ? `.${encoded}` : encoded;
  }
  return "";
}

function safeEmbedURL(value = "") {
  const src = safeURL(value);
  if (!src) return "";
  try {
    const url = new URL(src, location.href);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) {
      const list = url.searchParams.get("list") || "";
      if (host !== "youtu.be" && url.pathname === "/playlist" && /^[\w-]{6,}$/.test(list)) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`;
      let id = "";
      if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
      else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})(?:\/|$)/)?.[1] || "";
      return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (["vimeo.com", "player.vimeo.com"].includes(host)) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts.find((part) => /^\d+$/.test(part));
      if (!id) return "";
      const hash = url.searchParams.get("h") || parts[parts.indexOf(id) + 1] || "";
      const player = new URL(`https://player.vimeo.com/video/${id}`);
      if (/^[\w-]+$/.test(hash)) player.searchParams.set("h", hash);
      return player.toString();
    }
    if (["open.spotify.com", "spotify.com"].includes(host)) {
      const path = url.pathname.replace(/^\/(?:embed\/)?/, "");
      return `https://open.spotify.com/embed/${path}`;
    }
    if (host === "w.soundcloud.com") return src;
    if (host === "soundcloud.com") return `https://w.soundcloud.com/player/?url=${encodeURIComponent(src)}`;
    if (host === "google.com" || host.endsWith(".google.com")) {
      const embedPath = /^\/maps\/(?:embed|d\/embed)(?:\/|$)/.test(url.pathname);
      const legacyEmbed = url.pathname === "/maps" && url.searchParams.get("output") === "embed";
      if (embedPath || legacyEmbed) return src;
    }
  } catch (error) {
    console.warn("Embed URL could not be parsed.", error);
  }
  return "";
}

function isGIFSource(value = "") {
  const source = String(value).trim();
  return /^data:image\/gif;/i.test(source) || /\.gif(?:$|[?#])/i.test(source);
}

function normalizeCanvas(canvas = {}) {
  canvas = canvas || {};
  return {
    width: number(canvas.width, 1440, 320, 5000),
    height: number(canvas.height, 1800, 400, 30000),
    background: cssColor(canvas.background, "#ffffff"),
    grid: number(canvas.grid, 8, 1, 100),
    fontStylesheet: safeURL(canvas.fontStylesheet),
    viewport: number(canvas.viewport, 900, 300, 4000),
    // Studio 7 (C2): 페이지 배경 미디어 — 이미지·무음 영상·덮는 색·움직이는 그라디언트·노이즈
    backgroundImage: String(canvas.backgroundImage ?? ""),
    backgroundVideo: String(canvas.backgroundVideo ?? ""),
    backgroundFit: canvas.backgroundFit === "contain" ? "contain" : "cover",
    backgroundPosition: cssText(canvas.backgroundPosition, "50% 50%"),
    backgroundOverlay: cssText(canvas.backgroundOverlay, ""),
    backgroundEffect: ["none", "drift", "noise", "drift-noise"].includes(canvas.backgroundEffect) ? canvas.backgroundEffect : "none",
    // Studio 8 (B18): 컬럼 그리드 오버레이 (0 = 없음)
    columns: number(canvas.columns, 0, 0, 24),
    columnGap: number(canvas.columnGap, 24, 0, 200),
    columnMargin: number(canvas.columnMargin, 80, 0, 1000),
  };
}

// Studio 8 (B18): 페이지 가이드선 — 눈금자에서 끌어낸 세로(v: x값)·가로(h: y값) 선, 캔버스 px.
function normalizeGuides(guides = {}) {
  const list = (value) => [...new Set((Array.isArray(value) ? value : []).map((item) => Math.round(number(item, NaN))).filter((item) => Number.isFinite(item)))].sort((a, b) => a - b).slice(0, 60);
  return { v: list(guides?.v), h: list(guides?.h) };
}

// Studio 7 (C2): 캔버스 맨 아래에 깔리는 배경 층. 편집기에서는 영상 대신 포스터(배경 이미지)만 보여 가볍게 둔다.
const NOISE_DATA_URI = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E";
function canvasBackgroundMarkup(canvas, { editing = false } = {}) {
  const image = safeURL(canvas.backgroundImage, { imageData: true });
  const video = editing ? "" : safeURL(canvas.backgroundVideo);
  const effect = canvas.backgroundEffect || "none";
  if (!image && !video && !canvas.backgroundOverlay && effect === "none" && !(editing && canvas.backgroundVideo)) return "";
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fit = `object-fit:${canvas.backgroundFit};object-position:${escapeHTML(canvas.backgroundPosition)}`;
  const media = video && !reduced
    ? `<video data-canvas-bg-video src="${escapeHTML(video)}" ${image ? `poster="${escapeHTML(image)}"` : ""} autoplay muted loop playsinline preload="auto" aria-hidden="true" style="${fit}"></video>`
    : image ? `<img src="${escapeHTML(image)}" alt="" aria-hidden="true" loading="eager" decoding="async" style="${fit}">` : editing && canvas.backgroundVideo ? '<span class="archive-canvas__bg-note">배경 영상은 미리보기에서 재생돼요</span>' : "";
  const drift = effect === "drift" || effect === "drift-noise" ? `<div class="archive-canvas__bg-drift" style="background:${escapeHTML(canvas.background)}"></div>` : "";
  const noise = effect === "noise" || effect === "drift-noise" ? `<div class="archive-canvas__bg-noise" style="background-image:url(&quot;${NOISE_DATA_URI}&quot;)"></div>` : "";
  const overlay = canvas.backgroundOverlay ? `<div class="archive-canvas__bg-overlay" style="background:${escapeHTML(canvas.backgroundOverlay)}"></div>` : "";
  return `<div class="archive-canvas__bg${effect.includes("drift") ? " has-drift" : ""}" aria-hidden="true">${drift}${media}${noise}${overlay}</div>`;
}
// Studio 7 (C1): 사이트·페이지 커스텀 CSS. </style>로 빠져나가지 못하게만 막는다 — 소유자의 코드라 그 밖은 자유.
const customStyleTag = (css = "", label = "") => { const clean = String(css || "").replace(/<\/style/gi, "<\\/style").trim(); return clean ? `<style data-custom-css="${label}">${clean}</style>` : ""; };

function legacyAction(block = {}) {
  const href = String(block.href || "").trim();
  if (!href || href === "#") return {};
  if (href.startsWith("#")) return { type: "anchor", anchorId: href.slice(1) };
  if (href.startsWith("mailto:")) return { type: "email", email: href.slice(7) };
  if (href.startsWith("tel:")) return { type: "phone", phone: href.slice(4) };
  return { type: "external", url: href, newTab: Boolean(block.openNewTab) };
}

function normalizeAction(action = {}, block = {}) {
  action = action || {};
  block = block || {};
  const source = Object.keys(action || {}).length ? action : legacyAction(block);
  const type = ["none", "page", "anchor", "external", "email", "phone", "download", "back"].includes(source.type) ? source.type : "none";
  return {
    type,
    pageId: safeId(source.pageId, ""),
    anchorId: safeId(source.anchorId, ""),
    url: String(source.url || ""),
    email: String(source.email || ""),
    subject: String(source.subject || ""),
    body: String(source.body || ""),
    phone: String(source.phone || ""),
    newTab: Boolean(source.newTab),
  };
}

function normalizeMotionKeyframe(frame = {}, index = 0) {
  frame = frame || {};
  return {
    id: safeId(frame.id, `kf-${index + 1}`),
    at: number(frame.at ?? frame.offset, index ? 100 : 0, 0, 100),
    x: number(frame.x, 0, -5000, 5000),
    y: number(frame.y, 0, -5000, 5000),
    scaleX: number(frame.scaleX ?? frame.scale, 1, -10, 10),
    scaleY: number(frame.scaleY ?? frame.scale, 1, -10, 10),
    rotate: number(frame.rotate, 0, -3600, 3600),
    rotateX: number(frame.rotateX, 0, -1440, 1440),
    rotateY: number(frame.rotateY, 0, -1440, 1440),
    skewX: number(frame.skewX, 0, -89, 89),
    skewY: number(frame.skewY, 0, -89, 89),
    opacity: number(frame.opacity, 1, 0, 1),
    blur: number(frame.blur, 0, 0, 200),
    brightness: number(frame.brightness, 1, 0, 5),
    saturate: number(frame.saturate, 1, 0, 5),
    hue: number(frame.hue, 0, -720, 720),
    clipTop: number(frame.clipTop, 0, 0, 100),
    clipRight: number(frame.clipRight, 0, 0, 100),
    clipBottom: number(frame.clipBottom, 0, 0, 100),
    clipLeft: number(frame.clipLeft, 0, 0, 100),
    easing: normalizeEasing(frame.easing, "linear"),
  };
}

const usesClip = (keyframes = []) => keyframes.some((frame) => frame.clipTop || frame.clipRight || frame.clipBottom || frame.clipLeft);
const clipPath = (frame) => `inset(${frame.clipTop}% ${frame.clipRight}% ${frame.clipBottom}% ${frame.clipLeft}%)`;

function neutralMotionKeyframes() {
  return [normalizeMotionKeyframe({ id: "kf-start", at: 0 }, 0), normalizeMotionKeyframe({ id: "kf-end", at: 100 }, 1)];
}

function normalizeMotionTimeline(timeline = {}) {
  timeline = timeline || {};
  const enabled = Boolean(timeline.enabled);
  const usedIds = new Set();
  let keyframes = (Array.isArray(timeline.keyframes) ? timeline.keyframes : [])
    .slice(0, 32)
    .map(normalizeMotionKeyframe)
    .sort((a, b) => a.at - b.at)
    .map((frame) => {
      let id = frame.id;
      let suffix = 2;
      while (usedIds.has(id)) id = `${frame.id}-${suffix++}`;
      usedIds.add(id);
      return { ...frame, id };
    });
  if (enabled && !keyframes.length) keyframes = neutralMotionKeyframes();
  else if (enabled && keyframes.length === 1) {
    const only = keyframes[0];
    const requestedId = only.at < 50 ? "kf-end" : "kf-start";
    const companion = normalizeMotionKeyframe({ id: only.id === requestedId ? `${requestedId}-2` : requestedId, at: only.at < 50 ? 100 : 0 }, only.at < 50 ? 1 : 0);
    keyframes = only.at < 50 ? [only, companion] : [companion, only];
  }
  return {
    enabled,
    trigger: MOTION_LAB_TRIGGERS.includes(timeline.trigger) ? timeline.trigger : "load",
    duration: number(timeline.duration, 1200, 100, 60000),
    delay: number(timeline.delay, 0, 0, 30000),
    iterations: number(timeline.iterations, 1, 1, 99),
    infinite: Boolean(timeline.infinite),
    direction: ["normal", "reverse", "alternate", "alternate-reverse"].includes(timeline.direction) ? timeline.direction : "normal",
    fill: ["none", "forwards", "backwards", "both"].includes(timeline.fill) ? timeline.fill : "both",
    origin: MOTION_LAB_ORIGINS.includes(timeline.origin) ? timeline.origin : "center",
    perspective: number(timeline.perspective, 800, 0, 5000),
    once: timeline.once !== false,
    linkTarget: safeId(timeline.linkTarget, ""),
    linkEvent: ["click", "hover", "press", "in-view"].includes(timeline.linkEvent) ? timeline.linkEvent : "click",
    linkMode: timeline.linkMode === "restart" ? "restart" : "toggle",
    scrollRange: ["element", "enter", "page"].includes(timeline.scrollRange) ? timeline.scrollRange : "element",
    scrubSmooth: number(timeline.scrubSmooth, 0, 0, 0.95),
    keyframes,
  };
}

function normalizeMotion(motion = {}) {
  motion = motion || {};
  const entrance = motion.entrance || {};
  const hover = motion.hover || {};
  const loop = motion.loop || {};
  const loopPreset = ["none", "float", "pulse", "spin", "bounce", "sway", "breathe"].includes(loop.preset) ? loop.preset : "none";
  return {
    entrance: {
      preset: ["none", "fade", "rise", "fall", "slide-left", "slide-right", "scale", "blur", "rotate"].includes(entrance.preset) ? entrance.preset : "none",
      trigger: entrance.trigger === "scroll" ? "scroll" : "load",
      duration: number(entrance.duration, 650, 0, 10000),
      delay: number(entrance.delay, 0, 0, 10000),
      easing: cssText(entrance.easing, "cubic-bezier(.22,1,.36,1)"),
      once: entrance.once !== false,
    },
    hover: {
      preset: ["none", "lift", "scale", "tilt", "glow", "invert", "fade", "magnetic"].includes(hover.preset) ? hover.preset : "none",
      duration: number(hover.duration, 240, 0, 5000),
      amount: number(hover.amount, 1.04, 0, 5),
    },
    loop: {
      preset: loopPreset,
      duration: number(loop.duration, 4000, 200, 30000),
      delay: number(loop.delay, 0, 0, 10000),
      direction: ["normal", "reverse", "alternate"].includes(loop.direction) ? loop.direction : loopPreset === "spin" ? "normal" : "alternate",
    },
    timeline: normalizeMotionTimeline(motion.timeline),
  };
}

const MOTION_LAB_PRESETS = {
  "fade-up": {
    label: "Fade up",
    trigger: "in-view",
    duration: 850,
    frames: [{ at: 0, y: 64, opacity: 0, blur: 10, easing: "cubic-bezier(.22,1,.36,1)" }, { at: 100 }],
  },
  "reveal-left": {
    label: "Slide reveal",
    trigger: "in-view",
    duration: 900,
    frames: [{ at: 0, x: -96, opacity: 0, blur: 8, easing: "cubic-bezier(.22,1,.36,1)" }, { at: 100 }],
  },
  pop: {
    label: "Pop",
    trigger: "click",
    duration: 620,
    frames: [{ at: 0, scaleX: .62, scaleY: .62, opacity: 0 }, { at: 72, scaleX: 1.1, scaleY: 1.1, easing: "cubic-bezier(.34,1.56,.64,1)" }, { at: 100 }],
  },
  float: {
    label: "Float",
    trigger: "load",
    duration: 3200,
    infinite: true,
    frames: [{ at: 0 }, { at: 50, y: -28, rotate: 1.5, easing: "ease-in-out" }, { at: 100 }],
  },
  orbit: {
    label: "Orbit",
    trigger: "load",
    duration: 5000,
    infinite: true,
    frames: [{ at: 0, x: -34 }, { at: 25, x: 0, y: -34, rotate: 90 }, { at: 50, x: 34, y: 0, rotate: 180 }, { at: 75, x: 0, y: 34, rotate: 270 }, { at: 100, x: -34, y: 0, rotate: 360 }],
  },
  spin: {
    label: "Spin",
    trigger: "load",
    duration: 2600,
    infinite: true,
    frames: [{ at: 0 }, { at: 100, rotate: 360, easing: "linear" }],
  },
  cinematic: {
    label: "Cinematic",
    trigger: "in-view",
    duration: 1400,
    frames: [{ at: 0, y: 80, scaleX: .92, scaleY: .92, opacity: 0, blur: 28, brightness: .65 }, { at: 65, opacity: 1, blur: 3, brightness: 1.08, easing: "cubic-bezier(.22,1,.36,1)" }, { at: 100 }],
  },
  glitch: {
    label: "Glitch",
    trigger: "hover",
    duration: 520,
    frames: [{ at: 0 }, { at: 18, x: -12, skewX: -5, hue: 45 }, { at: 36, x: 14, y: -4, skewX: 4, hue: -55 }, { at: 58, x: -6, y: 3, opacity: .72, hue: 90 }, { at: 76, x: 5, skewX: -2 }, { at: 100 }],
  },
  "mask-up": {
    label: "Mask up",
    trigger: "in-view",
    duration: 1100,
    frames: [{ at: 0, clipTop: 100, y: 36, easing: "cubic-bezier(0.77,0,0.18,1)" }, { at: 100 }],
  },
  "mask-side": {
    label: "Mask wipe",
    trigger: "in-view",
    duration: 1150,
    frames: [{ at: 0, clipRight: 100, x: -24, easing: "cubic-bezier(0.77,0,0.18,1)" }, { at: 100 }],
  },
  "zoom-reveal": {
    label: "Zoom reveal",
    trigger: "in-view",
    duration: 1500,
    frames: [{ at: 0, scaleX: 1.28, scaleY: 1.28, clipTop: 14, clipRight: 14, clipBottom: 14, clipLeft: 14, opacity: 0, easing: "cubic-bezier(0.22,1,0.36,1)" }, { at: 100 }],
  },
  "flip-in": {
    label: "Flip in",
    trigger: "in-view",
    duration: 1000,
    origin: "bottom",
    perspective: 900,
    frames: [{ at: 0, rotateX: -88, opacity: 0, y: 30, easing: "cubic-bezier(0.22,1,0.36,1)" }, { at: 100 }],
  },
  "drop-bounce": {
    label: "Drop bounce",
    trigger: "in-view",
    duration: 1100,
    frames: [{ at: 0, y: -180, opacity: 0, easing: "cubic-bezier(0.55,0,1,0.45)" }, { at: 55, y: 0, opacity: 1, scaleX: 1.08, scaleY: .9, easing: "cubic-bezier(0.34,1.56,0.64,1)" }, { at: 78, y: -18, scaleX: .98, scaleY: 1.03, easing: "ease-in" }, { at: 100 }],
  },
  "float-3d": {
    label: "Float 3D",
    trigger: "load",
    duration: 7000,
    infinite: true,
    perspective: 1000,
    frames: [{ at: 0 }, { at: 25, rotateX: 8, rotateY: -10, y: -14, easing: "ease-in-out" }, { at: 50, rotateX: -4, rotateY: 8, y: 6, easing: "ease-in-out" }, { at: 75, rotateX: 6, rotateY: 4, y: -8, easing: "ease-in-out" }, { at: 100 }],
  },
  "menu-panel": {
    label: "Menu panel",
    trigger: "linked",
    duration: 760,
    frames: [{ at: 0, clipBottom: 100, opacity: 0, easing: "cubic-bezier(0.77,0,0.18,1)" }, { at: 20, opacity: 1 }, { at: 100 }],
  },
};

function motionLabTransform(frame, perspective = 800) {
  const depth = perspective > 0 ? `perspective(${perspective}px) ` : "";
  return `${depth}translate3d(${frame.x}px,${frame.y}px,0) rotateX(${frame.rotateX}deg) rotateY(${frame.rotateY}deg) rotate(${frame.rotate}deg) skewX(${frame.skewX}deg) skewY(${frame.skewY}deg) scale(${frame.scaleX},${frame.scaleY})`;
}

export function motionLabKeyframes(timeline = {}) {
  const normalized = normalizeMotionTimeline({ ...timeline, enabled: true });
  const clip = usesClip(normalized.keyframes);
  return normalized.keyframes.map((frame) => ({
    offset: frame.at / 100,
    transform: motionLabTransform(frame, normalized.perspective),
    transformOrigin: normalized.origin.replace("-", " "),
    opacity: frame.opacity,
    filter: `blur(${frame.blur}px) brightness(${frame.brightness}) saturate(${frame.saturate}) hue-rotate(${frame.hue}deg)`,
    ...(clip ? { clipPath: clipPath(frame) } : {}),
    easing: frame.easing,
  }));
}

export function motionLabTiming(timeline = {}, { preview = false, scrub = false } = {}) {
  const normalized = normalizeMotionTimeline({ ...timeline, enabled: true });
  return {
    duration: normalized.duration,
    delay: scrub ? 0 : normalized.delay,
    iterations: scrub || preview ? 1 : normalized.infinite ? Infinity : normalized.iterations,
    direction: scrub ? "normal" : normalized.direction,
    fill: normalized.fill,
  };
}

function normalizeGalleryItems(value) {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string" ? { src: item, alt: "", caption: "" } : {
      src: String(item?.src || item?.image || ""),
      alt: String(item?.alt || ""),
      caption: String(item?.caption || ""),
    }).filter((item) => item.src);
  }
  return String(value || "").split("\n").map((line) => {
    const [src = "", alt = "", ...caption] = line.split("|").map((item) => item.trim());
    return { src, alt, caption: caption.join(" | ") };
  }).filter((item) => item.src);
}

function normalizeBlock(block = {}, index = 0) {
  block = block || {};
  const type = BLOCK_TYPES.includes(block.type) ? block.type : "text";
  const textLike = ["text", "button", "marquee", "nav"].includes(type);
  const defaultWidth = type === "text" ? 520 : type === "marquee" ? 720 : type === "button" ? 220 : type === "line" ? 420 : type === "component" || type === "code" ? 640 : 360;
  const defaultHeight = type === "text" ? 120 : type === "marquee" ? 72 : type === "button" ? 64 : type === "line" ? 2 : type === "audio" ? 60 : type === "component" || type === "code" ? 420 : 260;
  const code = block.code && typeof block.code === "object" ? block.code : {};
  const legacyAutoplay = block.autoplay == null ? type === "video" : block.autoplay !== false;
  const legacyControls = block.controls == null ? ["video", "audio", "embed"].includes(type) : Boolean(block.controls);
  const inferredPlayback = legacyAutoplay ? "autoplay" : legacyControls ? "controls" : "click";
  const playbackMode = ["autoplay", "click", "hover", "in-view", "controls", "link", ...(type === "video" ? ["scrub"] : [])].includes(block.playbackMode) ? block.playbackMode : inferredPlayback;
  return {
    id: safeId(block.id, `${type}-${index + 1}`),
    name: cssText(block.name, type[0].toUpperCase() + type.slice(1)),
    type,
    visible: block.visible !== false,
    locked: Boolean(block.locked),
    anchorId: safeId(block.anchorId, ""),
    x: number(block.x, 80),
    y: number(block.y, 80),
    width: number(block.width, defaultWidth, 2),
    height: number(block.height, defaultHeight, 2),
    z: number(block.z, index + 1, 0, 9999),
    rotation: number(block.rotation, 0, -360, 360),
    opacity: number(block.opacity, 1, 0, 1),
    content: String(block.content ?? (type === "text" ? "새 텍스트" : type === "button" ? "버튼" : type === "marquee" ? "반복되는 문장" : "")),
    src: String(block.src ?? ""),
    media: String(block.media ?? ""),
    alt: String(block.alt ?? ""),
    poster: String(block.poster ?? ""),
    captions: String(block.captions ?? ""),
    backgroundImage: String(block.backgroundImage ?? ""),
    ariaLabel: String(block.ariaLabel ?? ""),
    decorative: Boolean(block.decorative),
    htmlTag: ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(block.htmlTag) ? block.htmlTag : type === "text" ? "p" : "div",
    action: normalizeAction(block.action, block),
    fontFamily: cssText(block.fontFamily, "Arial, sans-serif"),
    fontSize: number(block.fontSize, type === "button" || type === "nav" || type === "form" ? 16 : 48, 6, 400),
    fontWeight: number(block.fontWeight, 400, 100, 1000),
    lineHeight: number(block.lineHeight, 1.05, 0.5, 4),
    letterSpacing: number(block.letterSpacing, 0, -20, 100),
    textAlign: ["left", "center", "right"].includes(block.textAlign) ? block.textAlign : "left",
    color: cssColor(block.color, type === "button" ? "#ffffff" : "#111111"),
    background: cssColor(block.background, type === "button" ? "#111111" : type === "shape" ? "#ededed" : "transparent"),
    borderColor: cssColor(block.borderColor, "#111111"),
    borderWidth: number(block.borderWidth, type === "button" ? 1 : 0, 0, 40),
    borderRadius: number(block.borderRadius, 0, 0, 1000),
    padding: number(block.padding, type === "button" ? 16 : 0, 0, 200),
    objectFit: ["cover", "contain", "fill"].includes(block.objectFit) ? block.objectFit : "cover",
    repeat: ["no-repeat", "repeat", "repeat-x", "repeat-y"].includes(block.repeat) ? block.repeat : "no-repeat",
    repeatSize: number(block.repeatSize, 180, 8, 2000),
    playbackMode,
    gifPlayback: ["auto", "click", "hover"].includes(block.gifPlayback) ? block.gifPlayback : "auto",
    embedMode: ["interactive", "click", "link"].includes(block.embedMode) ? block.embedMode : "interactive",
    playLabel: String(block.playLabel || (type === "audio" ? "Play audio" : "Play")),
    pauseWhenHidden: block.pauseWhenHidden !== false,
    autoplay: playbackMode === "autoplay" || playbackMode === "in-view",
    loop: block.loop == null ? type === "video" : block.loop !== false,
    muted: block.muted == null ? type === "video" : block.muted !== false,
    controls: playbackMode === "controls" ? true : legacyControls,
    preload: ["none", "metadata", "auto"].includes(block.preload) ? block.preload : "metadata",
    speed: number(block.speed, 18, 2, 120),
    direction: block.direction === "right" ? "right" : "left",
    galleryItems: normalizeGalleryItems(block.galleryItems || block.items),
    galleryMode: block.galleryMode === "slideshow" ? "slideshow" : "grid",
    galleryColumns: number(block.galleryColumns, 2, 1, 8),
    galleryGap: number(block.galleryGap, 12, 0, 100),
    galleryInterval: number(block.galleryInterval, 3500, 800, 30000),
    lightbox: Boolean(block.lightbox),
    embedTitle: String(block.embedTitle || "Embedded media"),
    navOrientation: block.navOrientation === "vertical" ? "vertical" : "horizontal",
    navGap: number(block.navGap, 24, 0, 200),
    navMode: block.navMode === "custom" ? "custom" : "listed",
    navPageIds: Array.isArray(block.navPageIds) ? [...new Set(block.navPageIds.map((id) => safeId(id, "")).filter(Boolean))] : [],
    navActiveStyle: ["underline", "pill", "fade", "none"].includes(block.navActiveStyle) ? block.navActiveStyle : "underline",
    navShowIndex: Boolean(block.navShowIndex),
    blendMode: ["normal", "multiply", "screen", "overlay", "difference", "exclusion", "color-burn", "color-dodge"].includes(block.blendMode) ? block.blendMode : "normal",
    blur: number(block.blur, 0, 0, 80),
    grayscale: number(block.grayscale, 0, 0, 1),
    contrast: number(block.contrast, 1, 0, 3),
    saturate: number(block.saturate, 1, 0, 3),
    brightness: number(block.brightness, 1, 0, 3),
    hueRotate: number(block.hueRotate, 0, -360, 360),
    sepia: number(block.sepia, 0, 0, 1),
    invert: number(block.invert, 0, 0, 1),
    clipShape: CLIP_SHAPES.includes(block.clipShape) ? block.clipShape : "none",
    clipCustom: String(block.clipCustom ?? "").slice(0, 2000),
    focalX: number(block.focalX, 50, 0, 100),
    focalY: number(block.focalY, 50, 0, 100),
    hoverEffect: HOVER_EFFECTS.includes(block.hoverEffect) ? block.hoverEffect : "none",
    hoverSrc: String(block.hoverSrc ?? ""),
    maskPreset: MASK_PRESETS.includes(block.maskPreset) ? block.maskPreset : "none",
    maskImage: String(block.maskImage ?? ""),
    maskMode: block.maskMode === "luminance" ? "luminance" : "alpha",
    maskSize: ["cover", "contain", "stretch"].includes(block.maskSize) ? block.maskSize : "cover",
    maskPosition: cssText(block.maskPosition, "50% 50%"),
    duotone: Boolean(block.duotone),
    duotoneDark: cssColor(block.duotoneDark, "#1a1446"),
    duotoneLight: cssColor(block.duotoneLight, "#ff8a5b"),
    formEndpoint: String(block.formEndpoint ?? ""),
    formFields: Array.isArray(block.formFields) ? FORM_FIELDS.filter((name) => block.formFields.includes(name)) : ["name", "email", "message"],
    formExtra: String(block.formExtra ?? "").slice(0, 2000),
    formSubmitLabel: String(block.formSubmitLabel || "보내기"),
    formSuccess: String(block.formSuccess || "보냈어요. 곧 답장할게요."),
    // Studio 7 (A12): 영상 구간(초)·재생 속도. 0은 "끝까지".
    videoStart: number(block.videoStart, 0, 0, 36000),
    videoEnd: number(block.videoEnd, 0, 0, 36000),
    playbackRate: number(block.playbackRate, 1, 0.1, 4),
    shadowX: number(block.shadowX, 0, -200, 200),
    shadowY: number(block.shadowY, 0, -200, 200),
    shadowBlur: number(block.shadowBlur, 0, 0, 200),
    shadowColor: cssColor(block.shadowColor, "rgba(0,0,0,.25)"),
    motion: normalizeMotion(block.motion),
    textEffect: ["none", "typewriter", "scramble", "letters", "words"].includes(block.textEffect) && textLike ? block.textEffect : "none",
    parallax: number(block.parallax, 0, -2, 2),
    mouseParallax: number(block.mouseParallax, 0, -2, 2),
    publicDraggable: Boolean(block.publicDraggable),
    component: type === "component" ? safeId(block.component, "") : "",
    props: type === "component" ? sanitizeProps(block.props) : {},
    code: type === "code" ? { html: String(code.html ?? ""), css: String(code.css ?? ""), js: String(code.js ?? "") } : { html: "", css: "", js: "" },
    codeInteractive: block.codeInteractive !== false,
    fixed: Boolean(block.fixed),
    fixedAnchor: block.fixedAnchor === "bottom" ? "bottom" : "top",
    pinEnabled: Boolean(block.pinEnabled),
    pinTop: number(block.pinTop, 0, -5000, 5000),
    pinDistance: number(block.pinDistance, 600, 0, 30000),
    responsive: normalizeResponsive(block.responsive),
  };
}

function normalizePage(page = {}, index = 0) {
  page = page || {};
  const canvas = normalizeCanvas(page.canvas);
  const usedIds = new Set();
  const blocks = (Array.isArray(page.blocks) ? page.blocks : []).map((raw, blockIndex) => {
    const block = normalizeBlock(raw, blockIndex);
    let id = block.id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${block.id}-${suffix++}`;
    block.id = id;
    usedIds.add(id);
    return block;
  });
  const seo = page.seo || {};
  return {
    id: safeId(page.id, `page-${index + 1}`),
    name: cssText(page.name, index ? `Page ${index + 1}` : "Home"),
    slug: safeSlug(page.slug, index ? `page-${index + 1}` : "home"),
    visibility: ["listed", "unlisted", "draft"].includes(page.visibility) ? page.visibility : "listed",
    canvas,
    layouts: normalizeLayouts(page.layouts, canvas),
    seo: {
      title: String(seo.title || page.name || (index ? `Page ${index + 1}` : "Archive")),
      description: String(seo.description || ""),
      image: String(seo.image || ""),
      noIndex: Boolean(seo.noIndex),
      language: cssText(seo.language, "ko"),
    },
    // Studio 7 (C1): 이 페이지에만 적용되는 CSS
    customCSS: String(page.customCSS ?? "").slice(0, 50000),
    guides: normalizeGuides(page.guides),
    blocks,
  };
}

export function normalizeArchiveData(source = {}) {
  source = source || {};
  const isV1 = !Array.isArray(source.pages);
  const rawPages = isV1 ? [{
    id: "page-home",
    name: "Home",
    slug: "home",
    visibility: "listed",
    canvas: source.canvas,
    blocks: source.blocks,
    seo: { title: "Archive", description: "", image: "", noIndex: false, language: "ko" },
  }] : source.pages;
  const usedPageIds = new Set();
  const usedSlugs = new Set();
  const pages = rawPages.map((raw, index) => {
    const page = normalizePage(raw, index);
    let id = page.id;
    let suffix = 2;
    while (usedPageIds.has(id)) id = `${page.id}-${suffix++}`;
    page.id = id;
    usedPageIds.add(id);
    let slug = page.slug;
    suffix = 2;
    while (usedSlugs.has(slug)) slug = `${page.slug}-${suffix++}`;
    page.slug = slug;
    usedSlugs.add(slug);
    return page;
  });
  if (!pages.length) pages.push(normalizePage({ id: "page-home", name: "Home", slug: "home" }));

  const rawSettings = source.settings || {};
  const transition = rawSettings.transition || {};
  const seo = rawSettings.seo || {};
  const requestedHome = pages.find((page) => page.id === rawSettings.defaultPageId);
  const publicHome = requestedHome && requestedHome.visibility !== "draft" ? requestedHome : pages.find((page) => page.visibility !== "draft");
  const defaultPageId = (publicHome || requestedHome || pages[0]).id;
  const smoothScroll = rawSettings.smoothScroll || {};
  const usedBlockIds = new Set(pages.flatMap((page) => page.blocks.map((block) => block.id)));
  const globals = (Array.isArray(source.globals) ? source.globals : []).filter((raw) => raw && typeof raw === "object" && raw.type).map((raw, index) => {
    const block = normalizeBlock(raw, index);
    let id = block.id;
    let suffix = 2;
    while (usedBlockIds.has(id)) id = `${block.id}-${suffix++}`;
    block.id = id;
    usedBlockIds.add(id);
    return block;
  });
  return {
    version: DATA_VERSION,
    settings: {
      defaultPageId,
      homeView: rawSettings.homeView === "archive" ? "archive" : "experience",
      transition: {
        preset: TRANSITION_PRESETS.includes(transition.preset) ? transition.preset : "fade",
        duration: number(transition.duration, 420, 0, 3000),
        easing: cssText(transition.easing, "cubic-bezier(.22,1,.36,1)"),
        color: cssColor(transition.color, "#ffffff"),
      },
      responsive: normalizeResponsiveSettings(rawSettings.responsive),
      scaleMode: rawSettings.scaleMode === "max-100" ? "max-100" : "fit",
      smoothScroll: { enabled: Boolean(smoothScroll.enabled), intensity: number(smoothScroll.intensity, 0.1, 0.02, 0.5) },
      showPageNav: Boolean(rawSettings.showPageNav),
      showScrollProgress: Boolean(rawSettings.showScrollProgress),
      showMotionToggle: Boolean(rawSettings.showMotionToggle),
      hideViewSwitch: Boolean(rawSettings.hideViewSwitch),
      cursor: CURSOR_PRESETS.includes(rawSettings.cursor) ? rawSettings.cursor : "default",
      cursorColor: cssColor(rawSettings.cursorColor, "#111111"),
      // Studio 7: 폰트 고르기에서 선택한 구글 폰트 이름 목록. 사이트에서 자동으로 불러온다.
      fonts: [...new Set((Array.isArray(rawSettings.fonts) ? rawSettings.fonts : []).map((name) => String(name).trim().slice(0, 60)).filter(Boolean))].slice(0, 40),
      // Studio 7 (C1): 사이트 전체 CSS와 <head>에 넣을 코드(폰트 link·분석 스크립트). head 코드는 공개 화면에서만 실행.
      customCSS: String(rawSettings.customCSS ?? "").slice(0, 50000),
      customHead: String(rawSettings.customHead ?? "").slice(0, 20000),
      // Studio 8 (C6): 공개 주소 — sitemap.xml·공유 미리보기용. (C5): 방문자 다크 모드 토글
      siteURL: safeURL(rawSettings.siteURL, { link: true }),
      theme: {
        toggle: Boolean(rawSettings.theme?.toggle),
        darkBackground: cssColor(rawSettings.theme?.darkBackground, "#0b0b0c"),
        darkText: cssColor(rawSettings.theme?.darkText, "#f4f3ed"),
        dimMedia: Boolean(rawSettings.theme?.dimMedia),
      },
      seo: {
        titleSuffix: String(seo.titleSuffix || ""),
        description: String(seo.description || ""),
        image: String(seo.image || ""),
        noIndex: Boolean(seo.noIndex),
      },
    },
    pages,
    globals,
    components: Array.isArray(source.components) ? clone(source.components) : [],
  };
}

function fingerprint(data) {
  let hash = 2166136261;
  const value = JSON.stringify(normalizeArchiveData(data));
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readDraftEnvelope() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { document: normalizeArchiveData(parsed.document || parsed), base: String(parsed.base || ""), savedAt: String(parsed.savedAt || "") };
    }
  } catch (error) {
    console.warn("Archive draft could not be read.", error);
  }
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const parsed = JSON.parse(legacy);
      return {
        document: normalizeArchiveData(parsed.document || parsed),
        base: String(parsed.base || ""),
        savedAt: String(parsed.savedAt || ""),
      };
    } catch (error) {
      console.warn(`Legacy archive draft could not be read from ${key}.`, error);
    }
  }
  return null;
}

export function hasArchiveDraft() {
  return Boolean(readDraftEnvelope());
}

function getArchiveDraftInfo(published) {
  const normalizedPublished = normalizeArchiveData(published);
  const currentBase = fingerprint(normalizedPublished);
  const envelope = readDraftEnvelope();
  if (!envelope) return { document: normalizedPublished, base: currentBase, stale: false, savedAt: "" };
  const sameAsPublished = fingerprint(envelope.document) === currentBase;
  return {
    document: envelope.document,
    base: sameAsPublished ? currentBase : envelope.base || currentBase,
    stale: Boolean(!sameAsPublished && (!envelope.base || envelope.base !== currentBase)),
    savedAt: envelope.savedAt,
  };
}

export function getArchiveDraft(published) {
  return getArchiveDraftInfo(published).document;
}

function saveDraft(data, published, base = fingerprint(published)) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: DATA_VERSION,
      base,
      savedAt: new Date().toISOString(),
      document: normalizeArchiveData(data),
    }));
    return true;
  } catch (error) {
    console.warn("Archive draft could not be saved.", error);
    return false;
  }
}

export function resolveArchivePage(source, slug = "", { includeDraft = false } = {}) {
  const data = normalizeArchiveData(source);
  const fallback = data.pages.find((page) => page.id === data.settings.defaultPageId) || data.pages[0];
  const requested = slug ? data.pages.find((page) => page.slug === safeSlug(slug, slug)) : fallback;
  if (!requested || (requested.visibility === "draft" && !includeDraft)) return null;
  return requested;
}

export function syncArchiveFontStylesheet(data, pageId = "") {
  const normalized = normalizeArchiveData(data);
  const page = normalized.pages.find((item) => item.id === pageId) || normalized.pages.find((item) => item.id === normalized.settings.defaultPageId) || normalized.pages[0];
  const apply = (id, href) => {
    let link = document.querySelector(`#${id}`);
    if (!href) { link?.remove(); return; }
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.append(link);
    }
    if (link.href !== href) link.href = href;
  };
  apply("archive-custom-font", safeURL(page?.canvas?.fontStylesheet));
  // Studio 7: 폰트 고르기로 선택한 구글 폰트
  apply("archive-google-fonts", googleFontsHref(normalized.settings.fonts));
}

// Studio 7 (C1): settings.customHead(<link>·<meta>·<style>·<script>)를 <head>에 넣는다. 공개 화면 전용 — 편집기에서는 비운다.
export function syncArchiveCustomHead(data, { enabled = true } = {}) {
  const html = enabled ? String(normalizeArchiveData(data).settings.customHead || "").trim() : "";
  const current = document.head.dataset.archiveCustomHead || "";
  if (current === html) return;
  document.head.querySelectorAll("[data-archive-custom-head]").forEach((node) => node.remove());
  document.head.dataset.archiveCustomHead = html;
  if (!html) return;
  const template = document.createElement("template");
  template.innerHTML = html;
  [...template.content.children].forEach((node) => {
    if (!["LINK", "META", "STYLE", "SCRIPT", "NOSCRIPT", "BASE"].includes(node.tagName) || node.tagName === "BASE") return;
    // innerHTML로 넣은 <script>는 실행되지 않으므로 새로 만든다.
    const clone = node.tagName === "SCRIPT" ? Object.assign(document.createElement("script"), { textContent: node.textContent }) : node.cloneNode(true);
    if (node.tagName === "SCRIPT") [...node.attributes].forEach((attribute) => clone.setAttribute(attribute.name, attribute.value));
    clone.setAttribute("data-archive-custom-head", "");
    document.head.append(clone);
  });
}

function commonStyle(block, box = { viewport: 900 }) {
  return [
    blockPositionStyle({ ...block, x: number(block.x), y: number(block.y), width: number(block.width, 100, 2), height: number(block.height, 100, 2) }, box),
    `z-index:${number(block.z, 1, 0, 9999)}`,
    `opacity:${number(block.opacity, 1, 0, 1)}`,
    `mix-blend-mode:${block.blendMode}`,
    `--block-rotation:${number(block.rotation)}deg`,
    `--visitor-drag-x:0px`,
    `--visitor-drag-y:0px`,
    `--parallax-x:0px`,
    `--parallax-y:0px`,
    `--pin-y:0px`,
    `--pin-top:${number(block.pinTop)}px`,
    `--pin-distance:${number(block.pinDistance, 0, 0)}px`,
    `transform:translate3d(calc(var(--visitor-drag-x) + var(--parallax-x)),calc(var(--visitor-drag-y) + var(--parallax-y) + var(--pin-y)),0) rotate(var(--block-rotation))`,
  ].join(";");
}

function blockStyle(block, box) {
  const motion = block.motion;
  return `${commonStyle(block, box)};--entrance-duration:${motion.entrance.duration}ms;--entrance-delay:${motion.entrance.delay}ms;--entrance-easing:${motion.entrance.easing};--hover-duration:${motion.hover.duration}ms;--hover-amount:${motion.hover.amount};--loop-duration:${motion.loop.duration}ms;--loop-delay:${motion.loop.delay}ms;--loop-direction:${motion.loop.direction};`;
}

function typographyStyle(block) {
  return [
    `font-family:${cssText(block.fontFamily, "Arial, sans-serif")}`,
    `font-size:${number(block.fontSize, 48, 6, 400)}px`,
    `font-weight:${number(block.fontWeight, 400, 100, 1000)}`,
    `line-height:${number(block.lineHeight, 1.05, 0.5, 4)}`,
    `letter-spacing:${number(block.letterSpacing, 0, -20, 100)}px`,
    `text-align:${block.textAlign}`,
    `color:${cssColor(block.color, "#111111")}`,
  ].join(";");
}

function surfaceStyle(block) {
  const backgroundImage = safeURL(block.backgroundImage, { imageData: true });
  return [
    `background:${cssColor(block.background)}`,
    backgroundImage ? `background-image:url('${escapeHTML(backgroundImage)}')` : "",
    backgroundImage ? "background-position:center;background-size:cover" : "",
    `border:${number(block.borderWidth, 0, 0, 40)}px solid ${cssColor(block.borderColor, "#111111")}`,
    `border-radius:${number(block.borderRadius, 0, 0, 1000)}px`,
    `padding:${number(block.padding, 0, 0, 200)}px`,
  ].filter(Boolean).join(";");
}

function visualEffectStyle(block) {
  const clip = clipPathFor(block);
  const mask = maskImageFor(block);
  const maskSize = block.maskSize === "stretch" ? "100% 100%" : block.maskSize || "cover";
  const maskPosition = cssText(block.maskPosition, "50% 50%");
  return [
    `filter:${block.duotone && hexToRGB(block.duotoneDark) && hexToRGB(block.duotoneLight) ? `url(#duo-${block.id}) ` : ""}blur(${block.blur}px) grayscale(${block.grayscale}) contrast(${number(block.contrast, 1)}) saturate(${number(block.saturate, 1)}) brightness(${number(block.brightness, 1)}) hue-rotate(${number(block.hueRotate)}deg) sepia(${number(block.sepia)}) invert(${number(block.invert)}) drop-shadow(${block.shadowX}px ${block.shadowY}px ${block.shadowBlur}px ${block.shadowColor})`,
    clip ? `clip-path:${clip}` : "",
    mask ? `-webkit-mask-image:${mask};mask-image:${mask};-webkit-mask-size:${maskSize};mask-size:${maskSize};-webkit-mask-position:${maskPosition};mask-position:${maskPosition};-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;mask-mode:${block.maskMode === "luminance" ? "luminance" : "alpha"}` : "",
    `--focal:${number(block.focalX, 50)}% ${number(block.focalY, 50)}%`,
  ].filter(Boolean).join(";");
}

// Studio 8 (C4): 폼 — 방문자가 메시지를 보내는 칸. 편집기에서는 조작이 꺼지고(inert), 공개 화면에서 fetch로 보낸다.
function formMarkup(block, { editing = false } = {}) {
  const fields = block.formFields.length ? block.formFields : ["email", "message"];
  const input = (name) => name === "message" ? `<label><span>${FORM_FIELD_LABELS[name]}</span><textarea name="message" rows="4" required></textarea></label>` : `<label><span>${FORM_FIELD_LABELS[name]}</span><input name="${name}" type="${name === "email" ? "email" : name === "phone" ? "tel" : "text"}" ${["name", "email"].includes(name) ? "required" : ""}></label>`;
  const extras = block.formExtra.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [label, type = "text"] = line.split("|").map((part) => part.trim());
    const safeType = ["text", "email", "tel", "url", "number", "date", "textarea"].includes(type) ? type : "text";
    const name = `extra_${index + 1}`;
    return safeType === "textarea" ? `<label><span>${escapeHTML(label)}</span><textarea name="${name}" rows="3"></textarea></label>` : `<label><span>${escapeHTML(label)}</span><input name="${name}" type="${safeType}"></label>`;
  });
  const endpoint = safeURL(block.formEndpoint, { link: true });
  return `<form class="canvas-form" data-archive-form data-success="${escapeHTML(block.formSuccess)}" action="${escapeHTML(endpoint)}" method="post" novalidate ${editing ? "inert" : ""} style="${typographyStyle(block)};${surfaceStyle(block)}">${fields.map(input).join("")}${extras.join("")}<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="canvas-form__honey">${endpoint ? "" : '<p class="canvas-form__warn">받을 주소(엔드포인트)가 아직 없어요 — 오른쪽 내용 패널에서 넣으세요</p>'}<button type="submit">${escapeHTML(block.formSubmitLabel)}</button><p class="canvas-form__status" aria-live="polite" hidden></p></form>`;
}

function routeForPage(data, pageId, anchorId = "", draft = false) {
  const page = data.pages.find((item) => item.id === pageId);
  if (!page) return "";
  const params = new URLSearchParams({ view: "archive" });
  if (draft) params.set("draft", "1");
  if (page.id !== data.settings.defaultPageId) params.set("page", page.slug);
  return `?${params.toString()}${anchorId ? `#${encodeURIComponent(anchorId)}` : ""}`;
}

function actionAttributes(action, data, { draft = false } = {}) {
  let href = "";
  let extra = "";
  if (action.type === "page") {
    href = routeForPage(data, action.pageId, action.anchorId, draft);
    if (href) extra += " data-route";
  } else if (action.type === "anchor") {
    href = `#${encodeURIComponent(action.anchorId)}`;
  } else if (action.type === "external") {
    href = safeURL(action.url, { link: true });
  } else if (action.type === "email") {
    const query = new URLSearchParams();
    if (action.subject) query.set("subject", action.subject);
    if (action.body) query.set("body", action.body);
    const email = action.email.trim().replace(/[\s"'<>]/g, "");
    href = email ? `mailto:${email}${query.toString() ? `?${query}` : ""}` : "";
  } else if (action.type === "phone") {
    href = `tel:${action.phone.replace(/[^+\d-]/g, "")}`;
  } else if (action.type === "download") {
    href = safeURL(action.url, { link: true });
    extra += " download";
  } else if (action.type === "back") {
    href = "#";
    extra += " data-archive-back";
  }
  if (!href) return null;
  if (action.newTab && ["external", "download"].includes(action.type)) extra += ' target="_blank" rel="noreferrer"';
  return `href="${escapeHTML(href)}"${extra}`;
}

function mediaPosterMarkup(block, fallback = "MEDIA") {
  const poster = safeURL(block.poster, { imageData: true });
  return poster
    ? `<img class="canvas-media-poster__image" src="${escapeHTML(poster)}" alt="" aria-hidden="true" loading="lazy" style="object-fit:${block.objectFit}">`
    : `<span class="canvas-media-poster__fallback">${escapeHTML(fallback)}</span>`;
}

function mediaPlayButton(block, label = block.playLabel) {
  return `<button class="canvas-media-play" data-media-play type="button" aria-label="${escapeHTML(label)}"><span aria-hidden="true">▶</span><strong>${escapeHTML(label)}</strong></button>`;
}

function embedURLWithOptions(value, block, { autoplay = false } = {}) {
  const source = safeEmbedURL(value);
  if (!source) return "";
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtube-nocookie.com") {
      const id = url.pathname.endsWith("/videoseries") ? "" : url.pathname.split("/").filter(Boolean).pop();
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      url.searchParams.set("controls", block.controls === false ? "0" : "1");
      url.searchParams.set("playsinline", "1");
      if (block.loop && id) {
        url.searchParams.set("loop", "1");
        url.searchParams.set("playlist", id);
      }
    } else if (host === "player.vimeo.com") {
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      url.searchParams.set("muted", block.muted ? "1" : "0");
      url.searchParams.set("loop", block.loop ? "1" : "0");
      url.searchParams.set("controls", block.controls === false ? "0" : "1");
    }
    return url.toString();
  } catch (error) {
    return source;
  }
}

function embedShellMarkup(block, source, { mode = "interactive", editing = false } = {}) {
  const title = block.embedTitle || block.alt || block.name;
  const poster = `<div class="canvas-media-poster">${mediaPosterMarkup(block, title)}</div>`;
  if (editing) return `<div class="canvas-embed-placeholder">${poster}<span class="canvas-editor-media-badge">${mode === "link" ? "LINK CARD" : mode === "click" ? "CLICK TO LOAD" : "INTERACTIVE EMBED"}</span></div>`;
  if (mode === "link") return `<div class="canvas-embed-placeholder">${poster}<span class="canvas-media-link-label">${escapeHTML(block.playLabel || "Open")}</span></div>`;
  if (mode === "click") {
    const autoplaySource = embedURLWithOptions(source, block, { autoplay: true });
    return `<div class="canvas-embed-shell" data-embed-shell data-embed-src="${escapeHTML(autoplaySource)}" data-embed-title="${escapeHTML(title)}">${poster}${mediaPlayButton(block, block.playLabel || "Load media")}</div>`;
  }
  const iframeSource = embedURLWithOptions(source, block, { autoplay: block.playbackMode === "autoplay" });
  return `<iframe src="${escapeHTML(iframeSource)}" title="${escapeHTML(title)}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

function videoMarkup(block, { editing = false } = {}) {
  const src = safeURL(block.media || block.src);
  if (!src) return '<div class="canvas-block__placeholder">VIDEO URL / FILE</div>';
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mode = reduced && ["autoplay", "in-view"].includes(block.playbackMode) ? "click" : block.playbackMode;
  const embed = safeEmbedURL(src);
  if (embed) {
    const embedMode = mode === "link" ? "link" : mode === "controls" ? "interactive" : "click";
    return embedShellMarkup(block, src, { mode: embedMode, editing });
  }
  if (editing) return `<div class="canvas-editor-media-preview"><div class="canvas-media-poster">${mediaPosterMarkup(block, "VIDEO")}</div><span class="canvas-editor-media-badge">${escapeHTML(mode.toUpperCase())}</span></div>`;
  if (mode === "link") return `<div class="canvas-embed-placeholder"><div class="canvas-media-poster">${mediaPosterMarkup(block, "VIDEO")}</div><span class="canvas-media-link-label">${escapeHTML(block.playLabel || "Open video")}</span></div>`;
  const poster = safeURL(block.poster, { imageData: true });
  const track = safeURL(block.captions);
  const autoplay = mode === "autoplay" && block.muted;
  const showControls = mode === "controls" || (block.controls && !["click", "hover", "link", "scrub"].includes(mode));
  const button = ["click", "hover", "controls"].includes(mode) ? mediaPlayButton(block) : ["autoplay", "in-view"].includes(mode) ? mediaPlayButton(block, "Play video").replace("data-media-play", "data-media-play data-autoplay-fallback hidden") : mode === "scrub" ? '<span class="canvas-media-scrub-hint" aria-hidden="true">← 마우스를 움직여 보세요 →</span>' : "";
  // Studio 7 (A12): 구간·속도는 data 속성으로 넘기고 bindArchiveViewer가 적용. 구간 반복은 직접 처리하므로 native loop는 끈다.
  const ranged = block.videoStart > 0 || block.videoEnd > block.videoStart;
  const rangeAttributes = `${block.videoStart > 0 ? ` data-media-start="${block.videoStart}"` : ""}${block.videoEnd > block.videoStart ? ` data-media-end="${block.videoEnd}"` : ""}${block.playbackRate !== 1 ? ` data-media-rate="${block.playbackRate}"` : ""}${ranged && block.loop ? ' data-media-loop="true"' : ""}`;
  return `<div class="canvas-native-media${mode === "scrub" ? " canvas-native-media--scrub" : ""}" data-native-media data-media-mode="${mode}" data-pause-hidden="${block.pauseWhenHidden}"${rangeAttributes}><video data-media-element src="${escapeHTML(src)}" aria-label="${escapeHTML(block.alt || block.name)}" playsinline preload="${mode === "scrub" ? "auto" : block.preload}" ${poster ? `poster="${escapeHTML(poster)}"` : ""} ${autoplay ? "autoplay" : ""} ${block.loop && !ranged ? "loop" : ""} ${block.muted || mode === "scrub" ? "muted" : ""} ${showControls ? "controls" : ""}>${track ? `<track kind="captions" src="${escapeHTML(track)}" srclang="ko" label="한국어">` : ""}</video>${button}</div>`;
}

function audioMarkup(block, { editing = false } = {}) {
  const src = safeURL(block.media || block.src);
  if (!src) return '<div class="canvas-block__placeholder">AUDIO URL / FILE</div>';
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mode = reduced && ["autoplay", "in-view"].includes(block.playbackMode) ? "click" : block.playbackMode;
  if (editing) return `<div class="canvas-editor-media-preview canvas-editor-media-preview--audio"><span aria-hidden="true">♪</span><strong>${escapeHTML(block.name)}</strong><span class="canvas-editor-media-badge">${escapeHTML(mode.toUpperCase())}</span></div>`;
  if (mode === "link") return `<div class="canvas-audio-link"><span aria-hidden="true">♪</span><strong>${escapeHTML(block.playLabel || block.name)}</strong></div>`;
  const showControls = mode === "controls" || (block.controls && !["click", "hover", "link"].includes(mode));
  const button = ["click", "hover", "controls"].includes(mode) ? mediaPlayButton(block) : ["autoplay", "in-view"].includes(mode) ? mediaPlayButton(block, "Play audio").replace("data-media-play", "data-media-play data-autoplay-fallback hidden") : "";
  return `<div class="canvas-native-media canvas-native-media--audio" data-native-media data-media-mode="${mode}" data-pause-hidden="${block.pauseWhenHidden}"><audio data-media-element src="${escapeHTML(src)}" aria-label="${escapeHTML(block.alt || block.name)}" preload="${block.preload}" ${mode === "autoplay" ? "autoplay" : ""} ${block.loop ? "loop" : ""} ${block.muted ? "muted" : ""} ${showControls ? "controls" : ""}></audio>${button}</div>`;
}

function repeatedText(content) {
  const item = `<span>${escapeHTML(content)}</span>`;
  return `<div class="canvas-marquee__track"><div>${item.repeat(5)}</div><div aria-hidden="true">${item.repeat(5)}</div></div>`;
}

function galleryMarkup(block) {
  const items = block.galleryItems.map((item, index) => {
    const src = safeURL(item.src, { imageData: true });
    if (!src) return "";
    return `<figure class="canvas-gallery__item ${index === 0 ? "is-active" : ""}" data-gallery-item><img src="${escapeHTML(src)}" alt="${escapeHTML(item.alt)}" loading="lazy" style="object-fit:${block.objectFit}">${item.caption ? `<figcaption>${escapeHTML(item.caption)}</figcaption>` : ""}</figure>`;
  }).join("");
  if (!items) return '<div class="canvas-block__placeholder">GALLERY — ONE URL PER LINE</div>';
  return `<div class="canvas-gallery canvas-gallery--${block.galleryMode}" data-gallery style="--gallery-columns:${block.galleryColumns};--gallery-gap:${block.galleryGap}px" data-interval="${block.galleryInterval}">${items}</div>`;
}

function navigationPages(block, data, { draft = false } = {}) {
  if (block.navMode === "custom") {
    return block.navPageIds.map((id) => data.pages.find((page) => page.id === id)).filter((page) => page && (draft || page.visibility !== "draft"));
  }
  return data.pages.filter((page) => page.visibility === "listed");
}

function navMarkup(block, data, draft = false, currentPageId = "") {
  const pages = navigationPages(block, data, { draft });
  const links = pages.map((page, index) => `<a data-route ${page.id === currentPageId ? 'aria-current="page"' : ""} href="${escapeHTML(routeForPage(data, page.id, "", draft))}">${block.navShowIndex ? `<span>${String(index + 1).padStart(2, "0")}</span>` : ""}${escapeHTML(page.name)}</a>`).join("");
  return `<nav class="canvas-auto-nav canvas-auto-nav--${block.navOrientation} canvas-auto-nav--active-${block.navActiveStyle}" data-typo data-surface style="${typographyStyle(block)};${surfaceStyle(block)};--nav-gap:${block.navGap}px" aria-label="Archive pages">${links || "<span>메뉴에 표시할 페이지를 선택하세요</span>"}</nav>`;
}

function imageMarkup(block, { editing = false, linking = false } = {}) {
  const src = safeURL(block.media || block.src, { imageData: true });
  if (!src) return '<div class="canvas-block__placeholder">IMAGE / GIF</div>';
  const isGif = isGIFSource(src);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mode = linking ? (block.gifPlayback === "auto" && !reduced ? "auto" : "link") : reduced && block.gifPlayback === "auto" ? "click" : block.gifPlayback;
  if (isGif) {
    const poster = `<div class="canvas-media-poster">${mediaPosterMarkup(block, "GIF")}</div>`;
    if (editing) return `<div class="canvas-editor-media-preview">${poster}<span class="canvas-editor-media-badge">GIF · ${escapeHTML(mode.toUpperCase())}</span></div>`;
    return `<div class="canvas-gif-shell" ${mode === "link" ? "" : `data-gif-shell data-gif-mode="${mode}" data-gif-src="${escapeHTML(src)}" data-gif-alt="${escapeHTML(block.decorative ? "" : block.alt)}" data-gif-fit="${block.objectFit}"`}>${poster}${["click", "hover"].includes(mode) ? mediaPlayButton(block, block.playLabel || "Play GIF") : ""}</div>`;
  }
  if (block.repeat !== "no-repeat") return `<div class="canvas-block__repeated-image" style="background-image:url('${escapeHTML(src)}');background-repeat:${block.repeat};background-size:${block.repeatSize}px auto;border-radius:${block.borderRadius}px"></div>`;
  const hoverSource = block.hoverEffect === "swap" ? safeURL(block.hoverSrc, { imageData: true }) : "";
  const swap = hoverSource ? `<img class="canvas-hover-swap" src="${escapeHTML(hoverSource)}" alt="" aria-hidden="true" loading="lazy" style="object-fit:${block.objectFit};border-radius:${block.borderRadius}px">` : "";
  return `<img src="${escapeHTML(src)}" alt="${block.decorative ? "" : escapeHTML(block.alt)}" ${block.decorative ? 'aria-hidden="true"' : ""} loading="lazy" style="object-fit:${block.objectFit};border-radius:${block.borderRadius}px">${swap}`;
}

function blockContent(block, data, draft = false, currentPageId = "", editing = false, linking = false) {
  if (block.type === "text") {
    const tag = block.htmlTag;
    return `<${tag} class="canvas-block__text" data-text-effect="${block.textEffect}" data-typo data-surface style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content).replaceAll("\n", "<br>")}</${tag}>`;
  }
  if (block.type === "image") return imageMarkup(block, { editing, linking });
  if (block.type === "video") return videoMarkup(block, { editing });
  if (block.type === "audio") return audioMarkup(block, { editing });
  if (block.type === "button") return `<span class="canvas-block__button" data-typo data-surface style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content)}</span>`;
  if (block.type === "shape") return `<div class="canvas-block__shape" data-surface style="${surfaceStyle(block)}"></div>`;
  if (block.type === "line") return `<div class="canvas-block__line" style="background:${block.background === "transparent" ? block.borderColor : block.background};border-radius:${block.borderRadius}px"></div>`;
  if (block.type === "marquee") return `<div class="canvas-marquee canvas-marquee--${block.direction}" data-typo data-surface style="${typographyStyle(block)};${surfaceStyle(block)};--marquee-speed:${block.speed}s">${repeatedText(block.content)}</div>`;
  if (block.type === "gallery") return galleryMarkup(block);
  if (block.type === "embed") {
    const src = safeEmbedURL(block.src);
    return src ? embedShellMarkup(block, block.src, { mode: block.embedMode, editing }) : '<div class="canvas-block__placeholder">YOUTUBE / VIMEO / SPOTIFY / MAP</div>';
  }
  if (block.type === "nav") return navMarkup(block, data, draft, currentPageId);
  if (block.type === "component") {
    if (!block.component || !isRegisteredComponent(block.component)) return '<div class="canvas-block__placeholder">COMPONENT · 오른쪽에서 종류를 고르세요</div>';
    return `<div class="canvas-component" data-component="${escapeHTML(block.component)}" data-component-props="${escapeHTML(JSON.stringify(block.props))}"></div>`;
  }
  if (block.type === "form") return formMarkup(block, { editing });
  if (block.type === "code") {
    if (!block.code.html.trim() && !block.code.css.trim() && !block.code.js.trim()) return '<div class="canvas-block__placeholder">CODE · HTML · CSS · JS</div>';
    return `<iframe class="canvas-code" data-code-frame title="${escapeHTML(block.ariaLabel || block.name)}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHTML(codeBlockDocument(block.code, { editing }))}"${block.codeInteractive ? "" : ' tabindex="-1" style="pointer-events:none"'}></iframe>`;
  }
  return "";
}

// Studio 7: 편집기 핸들 8개(네 모서리·네 변) + 회전 핸들. 모양·위치는 styles.css의 .canvas-block__resize--* 규칙.
const RESIZE_HANDLE_LABELS = { nw: "왼쪽 위", n: "위", ne: "오른쪽 위", e: "오른쪽", se: "오른쪽 아래", s: "아래", sw: "왼쪽 아래", w: "왼쪽" };
const EDITOR_HANDLES_MARKUP = `${Object.keys(RESIZE_HANDLE_LABELS).map((direction) => `<button class="canvas-block__resize canvas-block__resize--${direction}" data-resize="${direction}" type="button" aria-label="${RESIZE_HANDLE_LABELS[direction]} 크기 조절" tabindex="-1"></button>`).join("")}<button class="canvas-block__rotate" data-rotate type="button" aria-label="회전 (Shift: 15° 단위)" tabindex="-1"></button>`;

export function archiveBlockMarkup(rawBlock, { data, editing = false, draft = false, pageId = "", normalized = false, box, isGlobal = false } = {}) {
  const documentData = normalized ? data : normalizeArchiveData(data || {});
  const block = normalizeBlock(rawBlock);
  const layoutHidden = Boolean(rawBlock.hidden);
  if (!block.visible && !editing) return "";
  const action = actionAttributes(block.action, documentData, { draft });
  const mediaLinkMode = (["video", "audio"].includes(block.type) && block.playbackMode === "link") || (block.type === "embed" && block.embedMode === "link");
  const canWrapAction = !["nav", "code", "form"].includes(block.type) && (!["video", "audio", "embed"].includes(block.type) || mediaLinkMode);
  let content = blockContent(block, documentData, draft, pageId, editing, Boolean(action && canWrapAction));
  if (action && canWrapAction) content = `<a class="canvas-block__link" ${action} aria-label="${escapeHTML(block.ariaLabel || block.content || block.name)}">${content}</a>`;
  const motion = block.motion;
  const motionLab = motion.timeline;
  const anchor = block.anchorId || block.id;
  const lightboxSource = block.type === "image" ? safeURL(block.media || block.src, { imageData: true }) : "";
  const lightboxAttributes = block.lightbox ? `data-lightbox ${lightboxSource ? `data-lightbox-src="${escapeHTML(lightboxSource)}"` : ""}` : "";
  // In the editor a fixed block is drawn where it sits on the first screen, whatever its anchor.
  const style = blockStyle(editing && block.fixed ? { ...block, fixedAnchor: "top" } : block, box || layoutBox(documentData.pages.find((page) => page.id === pageId) || documentData.pages[0], "desktop"));
  const wrapperSurface = ["image", "video", "audio", "gallery", "embed"].includes(block.type) ? surfaceStyle(block) : "";
  const visitorDraggable = block.publicDraggable && !["video", "audio", "embed", "code", "form"].includes(block.type) && !action && !block.lightbox && !block.fixed;
  const motionLabData = motionLab.enabled ? `data-motion-lab="${escapeHTML(JSON.stringify(motionLab))}" data-motion-lab-trigger="${motionLab.trigger}"` : "";
  const motionFocusable = motionLab.enabled && ["click", "press", "hover"].includes(motionLab.trigger) && !action && !["video", "audio", "embed", "nav", "code"].includes(block.type) ? `tabindex="0" ${["click", "press"].includes(motionLab.trigger) ? 'role="button"' : ""}` : "";
  const flags = `${block.fixed ? ` data-fixed="${block.fixedAnchor}"` : ""}${block.pinEnabled && !block.fixed ? " data-pin" : ""}${isGlobal ? " data-global" : ""}${block.hoverEffect && block.hoverEffect !== "none" ? ` data-hover-effect="${block.hoverEffect}"` : ""}`;
  const startsClosed = motionLab.enabled && motionLab.trigger === "linked" && motionLab.linkMode === "toggle" && motionLab.keyframes[0]?.opacity === 0;
  const classes = `canvas-block canvas-block--${block.type}${editing ? " is-editable" : ""}${editing && startsClosed ? " is-toggle-closed" : ""}${block.visible ? "" : " is-hidden-layer"}${layoutHidden ? " is-layout-hidden" : ""}${block.locked ? " is-locked" : ""}`;
  return `<article id="${escapeHTML(anchor)}" class="${classes}" data-block-id="${escapeHTML(block.id)}" data-entrance="${motion.entrance.preset}" data-trigger="${motion.entrance.trigger}" data-once="${motion.entrance.once}" data-loop="${motion.loop.preset}" data-hover="${motion.hover.preset}" data-parallax="${block.parallax}" data-mouse-parallax="${block.mouseParallax}"${flags} ${motionLabData} ${motionFocusable} ${visitorDraggable ? "data-public-draggable" : ""} ${lightboxAttributes} style="${style}">${block.duotone ? duotoneFilterMarkup(block) : ""}<div class="canvas-block__entrance"><div class="canvas-block__timeline"><div class="canvas-block__loop"><div class="canvas-block__hover"><div class="canvas-block__content"${wrapperSurface ? " data-surface" : ""} style="${visualEffectStyle(block)};${wrapperSurface}">${content}</div></div></div></div></div>${editing ? EDITOR_HANDLES_MARKUP : ""}</article>`;
}

function resolvePage(data, pageOrId) {
  return typeof pageOrId === "object" ? data.pages.find((item) => item.id === pageOrId.id) || pageOrId : data.pages.find((item) => item.id === pageOrId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
}

// The editor renders one artboard (desktop, tablet or mobile) with resolved values.
// The public site renders the desktop values plus media-query CSS for the other artboards.
export function archiveCanvasMarkup(source, pageOrId = "", { editing = false, draft = false, layout = "desktop" } = {}) {
  const data = normalizeArchiveData(source);
  const page = resolvePage(data, pageOrId);
  const globalIds = new Set(data.globals.map((block) => block.id));
  const all = [...page.blocks, ...data.globals];
  const activeLayout = editing && isLayoutEnabled(page, layout) ? layout : "desktop";
  const box = layoutBox(page, activeLayout);
  const blocks = (editing ? all.map((block) => resolveBlock(block, activeLayout)) : all.filter((block) => !block.fixed))
    .map((block) => archiveBlockMarkup(block, { data, editing, draft, pageId: page.id, normalized: true, box, isGlobal: globalIds.has(block.id) })).join("");
  const css = editing ? "" : responsiveCSS({ page, blocks: all.filter((block) => block.visible), settings: data.settings });
  const fold = editing ? `<div class="archive-canvas__fold" style="top:${box.viewport}px"><span>첫 화면 ${box.viewport}px</span></div>` : "";
  const background = canvasBackgroundMarkup(page.canvas, { editing });
  const customCSS = customStyleTag(data.settings.customCSS, "site") + customStyleTag(page.customCSS, "page");
  return `<section class="archive-canvas${editing ? " archive-canvas--editing" : ""}" data-archive-canvas data-archive-scope="${escapeHTML(page.id)}" data-page-id="${escapeHTML(page.id)}"${editing ? ` data-layout="${activeLayout}"` : ""} style="width:${box.width}px;height:${box.height}px;background:${page.canvas.background};--canvas-grid:${page.canvas.grid}px">${css ? `<style>${css}</style>` : ""}${customCSS}${background}${blocks}${fold}${editing && !blocks ? '<div class="archive-canvas__empty">왼쪽에서 요소를 추가하세요 · 빈 캔버스를 누르면 페이지 설정</div>' : ""}</section>`;
}

// Blocks marked 화면에 고정 live outside the scaled canvas so they stay put while the page scrolls.
export function archiveFixedLayerMarkup(source, pageOrId = "", { draft = false } = {}) {
  const data = normalizeArchiveData(source);
  const page = resolvePage(data, pageOrId);
  const globalIds = new Set(data.globals.map((block) => block.id));
  const fixed = [...page.blocks, ...data.globals].filter((block) => block.fixed && block.visible);
  if (!fixed.length) return "";
  const box = { ...layoutBox(page, "desktop"), fixedLayer: true };
  const blocks = fixed.map((block) => archiveBlockMarkup(block, { data, draft, pageId: page.id, normalized: true, box, isGlobal: globalIds.has(block.id) })).join("");
  return `<div class="archive-fixed-layer" data-archive-fixed><div class="archive-fixed-layer__inner" data-archive-scope="${escapeHTML(page.id)}" style="width:${box.width}px">${blocks}</div></div>`;
}

export function archiveSiteChromeMarkup(source, page, { draft = false } = {}) {
  const data = normalizeArchiveData(source);
  const listed = data.pages.filter((item) => item.visibility === "listed");
  const nav = data.settings.showPageNav && listed.length > 1 ? `<nav class="archive-page-nav" aria-label="Archive pages">${listed.map((item) => `<a data-route class="${item.id === page.id ? "is-active" : ""}" ${item.id === page.id ? 'aria-current="page"' : ""} href="${escapeHTML(routeForPage(data, item.id, "", draft))}">${escapeHTML(item.name)}</a>`).join("")}</nav>` : "";
  return `${nav}${data.settings.showScrollProgress ? '<div class="archive-scroll-progress" data-scroll-progress></div>' : ""}${data.settings.showMotionToggle ? '<button class="archive-motion-toggle" data-motion-toggle type="button">Pause motion</button>' : ""}`;
}

function field(label, path, value, type = "text", options = "") {
  if (type === "select") return `<label><span>${label}</span><select data-field="${path}">${options}</select></label>`;
  if (type === "checkbox") return `<label class="studio-check"><input data-field="${path}" type="checkbox" ${value ? "checked" : ""}><span>${label}</span></label>`;
  if (type === "textarea") return `<label class="studio-field--wide"><span>${label}</span><textarea data-field="${path}" rows="4">${escapeHTML(value)}</textarea></label>`;
  return `<label><span>${label}</span><input data-field="${path}" type="${type}" value="${escapeHTML(value)}"></label>`;
}

const option = (value, current, label = value) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;

// Studio 8 (B17): 색 칸 = 색 고르기 + 글자 입력(그라디언트·rgba도 그대로 쓸 수 있게). 팔레트 띠는 사이트에서 쓰는 색 + 최근 색 + 스포이트.
const RECENT_COLORS_KEY = "psj-studio-recent-colors";
const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
function colorField(label, path, value) {
  const hex = isHexColor(value) ? String(value).trim() : "#000000";
  return `<label class="studio-color studio-color--field"><span>${label}</span><span class="studio-color__row"><input type="color" value="${hex}" data-color-twin aria-label="${label} 고르기"><input data-field="${path}" data-color-field type="text" value="${escapeHTML(value)}"></span></label>`;
}
function recentColors() {
  try { return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || "[]").filter(isHexColor).map((item) => item.toLowerCase()).slice(0, 10); } catch (error) { return []; }
}
function rememberColor(value) {
  const hex = String(value || "").trim().toLowerCase();
  if (!isHexColor(hex)) return;
  try { localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify([hex, ...recentColors().filter((item) => item !== hex)].slice(0, 10))); } catch (error) { /* storage full */ }
}
function sitePalette(data) {
  const counts = new Map();
  const add = (value) => { const hex = String(value || "").trim().toLowerCase(); if (isHexColor(hex)) counts.set(hex, (counts.get(hex) || 0) + 1); };
  const scan = (block) => { add(block.color); add(block.background); add(block.borderColor); };
  data.pages.forEach((page) => { add(page.canvas.background); page.blocks.forEach(scan); });
  data.globals.forEach(scan);
  add(data.settings.cursorColor);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([hex]) => hex);
}
function paletteStripMarkup(data) {
  const site = sitePalette(data);
  const recent = recentColors().filter((hex) => !site.includes(hex));
  const swatch = (hex) => `<button data-swatch="${hex}" title="${hex}" aria-label="${hex} 적용" type="button" style="background:${hex}"></button>`;
  const eyedropper = typeof EyeDropper === "function" ? '<button class="studio-palette-strip__eyedropper" data-eyedropper title="화면에서 색 집기 (스포이트)" aria-label="스포이트" type="button">⌖</button>' : "";
  if (!site.length && !recent.length && !eyedropper) return "";
  return `<div class="studio-palette-strip" data-palette-strip><span class="studio-palette-strip__label">색</span>${site.map(swatch).join("")}${recent.length ? `<i></i>${recent.map(swatch).join("")}` : ""}${eyedropper}<small>색 칸을 누른 뒤 고르면 그 칸에 들어가요</small></div>`;
}

function pageListMarkup(data, activePageId) {
  const groups = [
    { key: "listed", title: "메뉴에 표시", empty: "아직 메뉴 페이지가 없어요." },
    { key: "unlisted", title: "링크로만 접근", empty: "" },
    { key: "draft", title: "초안", empty: "" },
  ];
  return groups.map((group) => {
    const pages = data.pages.filter((page) => page.visibility === group.key);
    if (!pages.length && !group.empty) return "";
    const rows = pages.map((page) => {
      const isHome = page.id === data.settings.defaultPageId;
      return `<div class="studio-page-row ${page.id === activePageId ? "is-active" : ""}"><button data-page-select="${escapeHTML(page.id)}" type="button"><span class="studio-page-row__icon">${isHome ? "⌂" : group.key === "listed" ? "●" : group.key === "unlisted" ? "◌" : "○"}</span><strong>${escapeHTML(page.name)}</strong><small>/${escapeHTML(page.slug)}</small></button><div><button data-page-move="up" data-page-id="${escapeHTML(page.id)}" title="위로" aria-label="${escapeHTML(page.name)} 페이지를 위로" type="button">↑</button><button data-page-move="down" data-page-id="${escapeHTML(page.id)}" title="아래로" aria-label="${escapeHTML(page.name)} 페이지를 아래로" type="button">↓</button></div></div>`;
    }).join("");
    return `<div class="studio-page-group"><div class="studio-page-group__label"><span>${group.title}</span><small>${pages.length}</small></div>${rows || `<p class="studio-muted">${group.empty}</p>`}</div>`;
  }).join("");
}

const LAYOUT_ICONS = { desktop: "▭", tablet: "▯", mobile: "▮" };

function breakpointSwitchMarkup(page, layout = "desktop") {
  return LAYOUTS.map((item) => {
    const box = layoutBox(page, item);
    const enabled = isLayoutEnabled(page, item);
    const active = item === layout;
    return `<button data-studio-layout="${item}" class="${active ? "is-active" : ""}${enabled ? "" : " is-empty"}" aria-pressed="${active}" title="${LAYOUT_LABELS[item]} ${box.width}px${enabled ? "" : " · 아직 없음"}" type="button"><span aria-hidden="true">${LAYOUT_ICONS[item]}</span>${LAYOUT_LABELS[item]}<small>${box.width}</small></button>`;
  }).join("");
}

function layoutPromptMarkup(page, layout) {
  const label = LAYOUT_LABELS[layout];
  const box = layoutBox(page, layout);
  return `<div class="studio-layout-prompt__card"><span>${LAYOUT_ICONS[layout]} ${label} · ${box.width}px</span><h3>이 페이지에는 아직 ${label} 배치가 없어요</h3><p>지금은 폰·태블릿에서도 데스크톱 배치를 통째로 줄여서 보여줘요. ${label} 전용 배치를 만들면 글자는 읽기 좋은 크기로, 요소는 화면 폭에 맞게 다시 놓여요. 만든 뒤에 옮기거나 크기를 바꾼 값은 ${label}에만 적용돼요.</p><div><button class="is-primary" data-action="layout-create" data-mode="stack" type="button">자동 정렬로 만들기<small>세로 한 줄로 읽기 좋게</small></button><button data-action="layout-create" data-mode="scale" type="button">비율대로 줄여서 시작<small>데스크톱 구성을 그대로 축소</small></button></div></div>`;
}

function siteSettingsMarkup(data) {
  const settings = data.settings;
  return `${field("첫 화면", "settings.homeView", settings.homeView, "select", option("experience", settings.homeView, "Experience (검은 화면)") + option("archive", settings.homeView, "Archive (이 빌더로 만든 페이지)"))}
    ${field("페이지 전환", "settings.transition.preset", settings.transition.preset, "select", option("none", settings.transition.preset, "없음") + option("fade", settings.transition.preset, "페이드") + option("slide", settings.transition.preset, "밀어 올리기") + option("zoom", settings.transition.preset, "줌") + option("wipe", settings.transition.preset, "와이프 (아래에서 위로)") + option("circle", settings.transition.preset, "원형 (누른 곳에서 퍼짐)") + option("blur", settings.transition.preset, "블러"))}
    <div class="studio-fields studio-fields--two">${field("전환 시간(ms)", "settings.transition.duration", settings.transition.duration, "number")}${field("화면 맞춤", "settings.scaleMode", settings.scaleMode, "select", option("fit", settings.scaleMode, "화면 폭에 꽉 채움") + option("max-100", settings.scaleMode, "원래 크기까지만"))}${field("커서", "settings.cursor", settings.cursor, "select", option("default", settings.cursor, "기본") + option("dot", settings.cursor, "점") + option("crosshair", settings.cursor, "십자") + option("ring", settings.cursor, "링 (따라오기)") + option("blend", settings.cursor, "반전 원"))}${colorField("커서 색", "settings.cursorColor", settings.cursorColor)}</div>
    <div class="studio-checks">${field("부드러운 스크롤", "settings.smoothScroll.enabled", settings.smoothScroll.enabled, "checkbox")}${field("상단 전환 막대 숨김", "settings.hideViewSwitch", settings.hideViewSwitch, "checkbox")}</div>
    ${settings.smoothScroll.enabled ? field("스크롤 부드러움 (0.02 느림 ~ 0.5 빠름)", "settings.smoothScroll.intensity", settings.smoothScroll.intensity, "number") : ""}
    <div class="studio-checks">${field("고정 전역 페이지 메뉴", "settings.showPageNav", settings.showPageNav, "checkbox")}${field("스크롤 진행선", "settings.showScrollProgress", settings.showScrollProgress, "checkbox")}${field("모션 정지 버튼", "settings.showMotionToggle", settings.showMotionToggle, "checkbox")}</div>
    <p class="studio-insert__label">반응형 기준 (화면 폭)</p>
    <div class="studio-fields studio-fields--two">${field("태블릿 배치: 이 폭 이하", "settings.responsive.tabletMax", settings.responsive.tabletMax, "number")}${field("모바일 배치: 이 폭 이하", "settings.responsive.mobileMax", settings.responsive.mobileMax, "number")}</div>
    <p class="studio-help">페이지마다 Tablet·Mobile 배치를 만들면 이 폭을 기준으로 바뀌어요. 없는 배치는 한 단계 큰 배치를 줄여서 보여줘요.</p>
    <p class="studio-insert__label">공개 주소 · 다크 모드 (Studio 8)</p>
    ${field("공개 주소 (예: https://jun2peter.github.io/2nd_web/)", "settings.siteURL", settings.siteURL, "url")}
    <p class="studio-help">sitemap.xml(게시 창에서 내려받기)과 검수에 쓰여요.</p>
    <div class="studio-checks">${field("방문자 다크 모드 버튼 (☾)", "settings.theme.toggle", settings.theme.toggle, "checkbox")}${field("다크일 때 사진 살짝 어둡게", "settings.theme.dimMedia", settings.theme.dimMedia, "checkbox")}</div>
    ${settings.theme.toggle ? `<div class="studio-fields studio-fields--two">${colorField("다크 배경", "settings.theme.darkBackground", settings.theme.darkBackground)}${colorField("다크 글자색", "settings.theme.darkText", settings.theme.darkText)}</div><p class="studio-help">페이지 배경과 글자색만 바뀌어요(사진·버튼·도형은 그대로). 방문자의 선택은 브라우저에 기억돼요.</p>` : ""}
    <p class="studio-insert__label">코드 (Studio 7)</p>
    ${codeArea("사이트 전체 CSS", "settings.customCSS", settings.customCSS)}
    <p class="studio-help">모든 페이지에 적용돼요. 편집기 캔버스에도 바로 보여요.</p>
    ${codeArea("<head>에 넣을 코드", "settings.customHead", settings.customHead)}
    <p class="studio-help">웹폰트 &lt;link&gt;, 방문자 분석 &lt;script&gt;, &lt;meta&gt; 등. 공개 화면에서만 실행되고 편집기에서는 꺼져 있어요. 잘못된 스크립트는 사이트를 멈출 수 있으니 미리보기(새 탭)에서 꼭 확인하세요.</p>`;
}

function responsiveSectionMarkup(page) {
  const rows = ["tablet", "mobile"].map((layout) => {
    const box = layoutBox(page, layout);
    const enabled = isLayoutEnabled(page, layout);
    return `<div class="studio-layout-row ${enabled ? "is-on" : ""}"><div><strong>${LAYOUT_ICONS[layout]} ${LAYOUT_LABELS[layout]}</strong><small>${enabled ? `켜짐 · ${box.width}×${box.height}` : "없음 · 데스크톱을 줄여서 보여줌"}</small></div><div>${enabled ? `<button data-action="layout-regenerate" data-layout="${layout}" type="button">다시 정렬</button><button data-action="layout-disable" data-layout="${layout}" type="button">끄기</button>` : `<button data-action="layout-open" data-layout="${layout}" type="button">만들기</button>`}</div></div>`;
  }).join("");
  return `<details class="studio-inspector-section" open><summary><span>반응형 배치</span><small>Desktop · Tablet · Mobile</small></summary><div class="studio-inspector-section__body">${rows}<p class="studio-help">위쪽 화면 크기 버튼으로 각 배치를 편집해요. Tablet·Mobile에서 바꾼 위치·크기·글자 크기는 그 화면에만 적용되고, 글·이미지·색·모션은 모든 화면이 함께 써요.</p></div></details>`;
}

function pageInspectorMarkup(data, page, layout = "desktop") {
  const isHome = page.id === data.settings.defaultPageId;
  const status = page.visibility === "listed" ? "게시됨 · 메뉴 표시" : page.visibility === "unlisted" ? "게시됨 · 링크 전용" : "초안 · 사이트에서 숨김";
  const box = layoutBox(page, layout);
  const sizeFields = layout === "desktop"
    ? `${field("너비 (px)", "canvas.width", page.canvas.width, "number")}${field("페이지 길이 (px)", "canvas.height", page.canvas.height, "number")}${field("첫 화면 높이 (px)", "canvas.viewport", page.canvas.viewport, "number")}`
    : `${field(`${LAYOUT_LABELS[layout]} 너비 (px)`, `page.layouts.${layout}.width`, box.width, "number")}${field(`${LAYOUT_LABELS[layout]} 페이지 길이`, `page.layouts.${layout}.height`, box.height, "number")}${field("첫 화면 높이 (px)", `page.layouts.${layout}.viewport`, box.viewport, "number")}`;
  return `<div class="inspector-head inspector-head--page"><div><span>PAGE${layout === "desktop" ? "" : ` · ${LAYOUT_LABELS[layout].toUpperCase()}`}</span><strong>${escapeHTML(page.name)}</strong><small>${status}</small></div></div>
    <details class="studio-inspector-section" open><summary><span>페이지</span><small>이름 · URL · 공개 상태</small></summary><div class="studio-inspector-section__body">
      ${field("페이지 이름", "page.name", page.name)}${field("URL 경로", "page.slug", page.slug)}
      ${field("공개 상태", "page.visibility", page.visibility, "select", option("listed", page.visibility, "게시됨 · 메뉴에 표시") + option("unlisted", page.visibility, "게시됨 · 링크로만 접근") + option("draft", page.visibility, "초안 · 일반 사이트에서 숨김"))}
      <div class="studio-page-actions"><button data-action="set-home" type="button" ${isHome ? "disabled" : ""}>${isHome ? "현재 홈페이지" : "홈으로 지정"}</button><button data-action="duplicate-page" type="button">복제</button><button data-action="delete-page" type="button">삭제</button></div>
    </div></details>
    <details class="studio-inspector-section" open><summary><span>페이지 크기${layout === "desktop" ? "" : ` · ${LAYOUT_LABELS[layout]}`}</span><small data-page-size-summary>${box.width} × ${box.height}px</small></summary><div class="studio-inspector-section__body"><div class="studio-fields studio-fields--two">${sizeFields}${colorField("배경", "canvas.background", page.canvas.background)}${field("스냅 간격", "canvas.grid", page.canvas.grid, "number")}</div>${field("웹폰트 CSS 주소", "canvas.fontStylesheet", page.canvas.fontStylesheet, "url")}
      <p class="studio-insert__label">컬럼 그리드 · 가이드 (Studio 8)</p>
      <div class="studio-fields studio-fields--two">${field("컬럼 수 (0 = 없음)", "canvas.columns", page.canvas.columns, "number")}${field("컬럼 간격", "canvas.columnGap", page.canvas.columnGap, "number")}${field("좌우 여백", "canvas.columnMargin", page.canvas.columnMargin, "number")}</div>
      <div class="studio-button-row"><button data-action="toggle-rulers" type="button">눈금자 켜기/끄기 (Ctrl+R)</button><button data-action="clear-guides" type="button" ${page.guides.v.length + page.guides.h.length ? "" : "disabled"}>가이드 ${page.guides.v.length + page.guides.h.length}개 지우기</button></div>
      <p class="studio-help">눈금자를 켜고 위·왼쪽 눈금자에서 캔버스로 끌어내리면 가이드가 생겨요. 가이드는 끌어서 옮기고 더블클릭으로 지워요. 요소는 가이드와 컬럼 가장자리에 자석처럼 붙어요. 컬럼은 Ctrl+'로 숨겼다 보여요.</p></div></details>
    <details class="studio-inspector-section" ${page.canvas.backgroundImage || page.canvas.backgroundVideo || page.canvas.backgroundEffect !== "none" ? "open" : ""}><summary><span>배경 미디어</span><small>이미지 · 영상 · 그라디언트 · 노이즈</small></summary><div class="studio-inspector-section__body">
      ${field("배경 이미지 (링크 또는 /media/파일)", "canvas.backgroundImage", page.canvas.backgroundImage)}${field("배경 영상 (MP4·WebM · 무음 반복)", "canvas.backgroundVideo", page.canvas.backgroundVideo)}
      <div class="studio-fields studio-fields--two">${field("맞춤", "canvas.backgroundFit", page.canvas.backgroundFit, "select", option("cover", page.canvas.backgroundFit, "꽉 채움") + option("contain", page.canvas.backgroundFit, "전체 보이기"))}${field("위치 (예: 50% 30%)", "canvas.backgroundPosition", page.canvas.backgroundPosition)}</div>
      ${field("덮는 색 (예: rgba(0,0,0,.35))", "canvas.backgroundOverlay", page.canvas.backgroundOverlay)}
      ${field("효과", "canvas.backgroundEffect", page.canvas.backgroundEffect, "select", option("none", page.canvas.backgroundEffect, "없음") + option("drift", page.canvas.backgroundEffect, "움직이는 그라디언트 (배경 값 사용)") + option("noise", page.canvas.backgroundEffect, "필름 노이즈") + option("drift-noise", page.canvas.backgroundEffect, "그라디언트 + 노이즈"))}
      <p class="studio-help">배경은 페이지 전체(스크롤 포함)에 깔려요. 움직이는 그라디언트는 위 ‘배경’ 칸에 linear-gradient(...)를 넣었을 때 살아나요. 영상은 편집기에서 포스터(배경 이미지)만 보이고 미리보기에서 재생돼요. 모션 줄이기 설정인 방문자에겐 영상 대신 이미지가 보여요.</p>
    </div></details>
    ${responsiveSectionMarkup(page)}
    <details class="studio-inspector-section" ${page.customCSS ? "open" : ""}><summary><span>페이지 CSS</span><small>이 페이지에만 적용</small></summary><div class="studio-inspector-section__body">${codeArea("CSS", "page.customCSS", page.customCSS)}<p class="studio-help">요소에는 <code>.canvas-block--text</code>처럼 종류별 클래스가, 각 요소에는 <code>#위치ID</code>(위치·크기 패널의 ‘페이지 내 위치 ID’)가 붙어요. 예: <code>#hero-title .canvas-block__text { text-shadow: 0 0 40px #fff }</code></p></div></details>
    <details class="studio-inspector-section"><summary><span>SEO · 공유</span><small>검색과 링크 미리보기</small></summary><div class="studio-inspector-section__body">${field("브라우저 제목", "page.seo.title", page.seo.title)}${field("검색 설명", "page.seo.description", page.seo.description, "textarea")}${field("공유 이미지", "page.seo.image", page.seo.image)}${field("언어 코드", "page.seo.language", page.seo.language)}${field("검색엔진에서 숨김", "page.seo.noIndex", page.seo.noIndex, "checkbox")}</div></details>`;
}

function motionLabDockMarkup(page, selectedId = "", selectedFrameId = "", playhead = 0, speed = 1) {
  const timed = page.blocks.filter((block) => block.motion.timeline.enabled && block.motion.timeline.trigger !== "scroll");
  const horizon = Math.max(100, ...timed.map((block) => block.motion.timeline.delay + block.motion.timeline.duration));
  const rows = page.blocks.map((block) => {
    const timeline = block.motion.timeline;
    const clipLeft = timeline.trigger === "scroll" ? 0 : timeline.delay / horizon * 100;
    const clipWidth = timeline.trigger === "scroll" ? 100 : timeline.duration / horizon * 100;
    const frames = timeline.keyframes.map((frame) => {
      const position = timeline.trigger === "scroll" ? frame.at : (timeline.delay + frame.at / 100 * timeline.duration) / horizon * 100;
      return `<button class="motion-lab-dock__key ${block.id === selectedId && frame.id === selectedFrameId ? "is-active" : ""}" data-motion-dock-frame="${escapeHTML(frame.id)}" data-motion-dock-block="${escapeHTML(block.id)}" style="left:${position}%" aria-label="${escapeHTML(block.name)} ${frame.at}% 키프레임" title="${frame.at}%" type="button"></button>`;
    }).join("");
    return `<div class="motion-lab-dock__row ${block.id === selectedId ? "is-selected" : ""} ${timeline.enabled ? "has-motion" : ""}"><button class="motion-lab-dock__layer" data-motion-dock-select="${escapeHTML(block.id)}" type="button"><span>${timeline.enabled ? "◆" : "◇"}</span><strong>${escapeHTML(block.name)}</strong><small>${timeline.enabled ? `${timeline.trigger} · ${timeline.keyframes.length} key` : block.type}</small></button><div class="motion-lab-dock__track" data-motion-dock-track="${escapeHTML(block.id)}"><span class="motion-lab-dock__clip ${timeline.trigger === "scroll" ? "is-scroll" : ""}" style="left:${clipLeft}%;width:${clipWidth}%"></span>${timeline.enabled ? frames : `<button data-motion-add-track="${escapeHTML(block.id)}" type="button">＋ 모션</button>`}</div></div>`;
  }).join("") || '<div class="motion-lab-dock__empty">먼저 페이지에 요소를 추가하세요.</div>';
  return `<section class="motion-lab-dock" data-motion-lab-dock aria-label="Motion Lab timeline">
    <header class="motion-lab-dock__header"><div><strong>MOTION LAB</strong><span>레이어별 키프레임 · 0–100%</span></div><div class="motion-lab-dock__transport"><button data-motion-page-restart type="button" aria-label="처음으로">↺</button><button data-motion-page-play type="button" aria-label="모션 재생">▶</button><button data-motion-page-stop type="button" aria-label="모션 정지">■</button><select data-motion-speed aria-label="미리보기 속도"><option value="0.5" ${speed === .5 ? "selected" : ""}>0.5×</option><option value="1" ${speed === 1 ? "selected" : ""}>1×</option><option value="2" ${speed === 2 ? "selected" : ""}>2×</option></select><button data-motion-stagger type="button">순차 등장</button></div></header>
    <div class="motion-lab-dock__scrubber"><span>0</span><input data-motion-scrub type="range" min="0" max="100" step=".1" value="${playhead}" aria-label="타임라인 재생 위치"><output data-motion-time>${Math.round(playhead)}% · ${Math.round(horizon * playhead / 100)}ms</output></div>
    <div class="motion-lab-dock__rows" style="--motion-playhead:${playhead}%"><i class="motion-lab-dock__playhead" data-motion-dock-playhead></i>${rows}</div>
  </section>`;
}

export function archiveStudioTemplate(source, activePageId = "") {
  const data = normalizeArchiveData(source);
  const page = data.pages.find((item) => item.id === activePageId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
  return `<main id="main" class="archive-page archive-page--studio">
    <div class="archive-studio studio-v8" data-archive-studio data-active-page="${escapeHTML(page.id)}">
      <aside class="archive-studio__left">
        <div class="archive-studio__brand"><strong><b>8</b>Archive Studio</strong><span>v8 · 편집기</span></div>
        <a class="studio-exit" href="?view=archive">← 사이트로 돌아가기</a>
        <nav class="studio-tabs" role="tablist" aria-label="왼쪽 패널" data-left-tabs><button data-left-tab="layers" class="is-active" role="tab" aria-selected="true" type="button">레이어</button><button data-left-tab="insert" role="tab" aria-selected="false" type="button">＋ 추가</button><button data-left-tab="assets" role="tab" aria-selected="false" type="button">자산<small data-asset-count-tab></small></button><button data-left-tab="settings" role="tab" aria-selected="false" type="button">설정</button></nav>
        <section class="studio-panel studio-pages" data-left-panel="layers"><div class="studio-panel__head"><div><h2>페이지</h2><small data-page-count>${data.pages.length}개</small></div></div><div data-page-list>${pageListMarkup(data, page.id)}</div><div class="studio-page-create"><button data-action="add-page" type="button">＋ 메뉴 페이지</button><button data-action="add-unlisted-page" type="button">＋ 링크 전용</button></div></section>
        <section class="studio-panel studio-layers" data-left-panel="layers"><div class="studio-panel__head"><h2>레이어</h2><small>드래그로 순서 · 더블클릭 이름</small></div><input class="studio-layer-search" data-layer-search type="search" placeholder="레이어 검색" aria-label="레이어 검색"><div data-layer-list></div></section>
        <section class="studio-panel studio-insert" data-left-panel="insert"><h2>요소 추가</h2><p class="studio-insert__label">기본</p><div class="studio-add-grid">
          <button data-add="text" type="button"><i>T</i><span>텍스트</span></button><button data-add="button" type="button"><i>↗</i><span>버튼</span></button><button data-add="shape" type="button"><i>○</i><span>도형</span></button><button data-add="line" type="button"><i>—</i><span>선</span></button></div><p class="studio-insert__label">미디어</p><div class="studio-add-grid"><button data-add="image" type="button"><i>▧</i><span>이미지·GIF</span></button><button data-add="video" type="button"><i>▶</i><span>영상</span></button><button data-add="audio" type="button"><i>♪</i><span>오디오</span></button><button data-add="gallery" type="button"><i>▦</i><span>갤러리</span></button><button data-add="embed" type="button"><i>⌘</i><span>임베드</span></button></div><p class="studio-insert__label">인터랙션</p><div class="studio-add-grid"><button data-add="marquee" type="button"><i>→</i><span>반복 글자</span></button><button data-add="nav" type="button"><i>☰</i><span>페이지 메뉴</span></button><button data-add="form" type="button"><i>✉</i><span>폼</span></button>
        </div><p class="studio-insert__label">커스텀 · 무엇이든</p><div class="studio-add-grid"><button data-add="code" type="button"><i>&lt;/&gt;</i><span>코드 블록</span></button><button data-add-component="" type="button" data-scroll-library><i>✦</i><span>컴포넌트</span></button><button data-action="open-templates" type="button"><i>▤</i><span>섹션 템플릿</span></button></div><div class="studio-component-library" data-component-library><p class="studio-muted">컴포넌트 목록을 불러오는 중…</p></div></section>
        <details class="studio-panel studio-assets" data-left-panel="assets" open><summary>자산 <small data-asset-count></small></summary><div class="studio-assets__body" data-asset-list><p class="studio-muted">아직 사용한 이미지·영상이 없어요.</p></div></details>
        <details class="studio-panel studio-site-settings" data-left-panel="settings" open><summary>사이트 설정</summary><div class="studio-site-settings__body">
          ${siteSettingsMarkup(data)}
        </div></details>
      </aside>
      <section class="archive-studio__center">
        <header class="archive-studio__topbar"><div class="studio-mode-switch" role="group" aria-label="편집 모드"><button class="is-active" data-studio-mode="design" aria-pressed="true" type="button">Design</button><button data-studio-mode="motion" aria-pressed="false" type="button">Motion</button></div><div class="studio-breakpoints" role="group" aria-label="화면 크기" data-breakpoints>${breakpointSwitchMarkup(page, "desktop")}</div><div class="studio-topbar__context"><strong data-current-page-name>${escapeHTML(page.name)}</strong><span data-current-page-meta>${page.visibility === "listed" ? "메뉴 표시" : page.visibility === "unlisted" ? "링크 전용" : "초안"} · ${page.canvas.width}×${page.canvas.height}</span><small data-save-status aria-live="polite">이 브라우저에 자동 저장됨</small></div><div class="studio-topbar__actions"><button data-action="undo" type="button" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소">↶</button><button data-action="redo" type="button" title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행">↷</button><span class="studio-zoom" role="group" aria-label="캔버스 확대"><button data-action="zoom-out" type="button" title="축소 (Ctrl+-)" aria-label="축소">−</button><select data-zoom aria-label="캔버스 확대"><option value="0.25">25%</option><option value="0.5" selected>50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.5">150%</option></select><button data-action="zoom-in" type="button" title="확대 (Ctrl+=)" aria-label="확대">＋</button><button data-action="zoom-fit" type="button" title="화면 맞춤 (Ctrl+0)">맞춤</button></span><i></i><button data-action="toggle-rulers" type="button" title="눈금자·가이드 (Ctrl+R)" aria-pressed="false">눈금자</button><button data-action="toggle-columns" type="button" title="컬럼 그리드 보기 (Ctrl+')" aria-pressed="false">컬럼</button><i></i><button data-action="command-palette" type="button" title="명령 팔레트 (Ctrl+K)">⌘K</button><button data-action="shortcuts" type="button" title="단축키 (?)" aria-label="단축키 보기">?</button><button data-action="toggle-editor-theme" type="button" title="편집기 어둡게 / 밝게 (Ctrl+Shift+D)" aria-label="편집기 테마" aria-pressed="false">◐</button><i></i><button data-action="preflight" type="button" title="게시 전 확인">✓ 검수</button><button data-action="device-preview" type="button" title="폰·태블릿 크기로 보기">▯ 기기</button><button data-action="preview" type="button" title="새 탭에서 사이트처럼 보기">↗ 미리보기</button><button data-action="file-menu" type="button" aria-haspopup="menu">파일 ▾</button><span hidden><button data-action="import" type="button">불러오기</button><button data-action="reset-published" type="button">게시본</button><button data-action="download" type="button">백업</button><button data-action="publish-copy" type="button">복사 게시</button></span><button class="studio-publish" data-action="publish" type="button" title="GitHub에 올리기 (Ctrl+Shift+P)">↑ 게시</button></div></header>
        <div class="archive-studio__workspace"><div class="studio-layout-prompt" data-layout-prompt hidden></div><div class="archive-studio__board-sizer"><div class="archive-studio__board">${archiveCanvasMarkup(data, page, { editing: true })}</div></div></div>
        ${motionLabDockMarkup({ blocks: [...page.blocks, ...data.globals] })}
      </section>
      <aside class="archive-studio__inspector" data-inspector>${pageInspectorMarkup(data, page)}</aside>
      <input data-image-picker type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>
      <input data-json-picker type="file" accept="application/json,.json" hidden>
    </div>
  </main>`;
}

function actionFields(block, data) {
  const action = block.action;
  const pageOptions = data.pages.map((page) => option(page.id, action.pageId, `${page.name} /${page.slug}`)).join("");
  let detail = "";
  if (action.type === "page") detail = `${field("이동할 페이지", "action.pageId", action.pageId, "select", `<option value="">선택</option>${pageOptions}`)}${field("그 페이지의 위치 ID (선택)", "action.anchorId", action.anchorId)}`;
  if (action.type === "anchor") detail = field("이 페이지의 위치 ID", "action.anchorId", action.anchorId);
  if (["external", "download"].includes(action.type)) detail = field(action.type === "download" ? "다운로드 파일 URL" : "외부 URL", "action.url", action.url, "url");
  if (action.type === "email") detail = `${field("이메일", "action.email", action.email, "email")}${field("메일 제목", "action.subject", action.subject)}${field("메일 본문", "action.body", action.body, "textarea")}`;
  if (action.type === "phone") detail = field("전화번호", "action.phone", action.phone, "tel");
  return `${field("클릭하면", "action.type", action.type, "select", option("none", action.type, "아무 동작 없음") + option("page", action.type, "다른 페이지") + option("anchor", action.type, "이 페이지의 위치") + option("external", action.type, "외부 링크") + option("email", action.type, "이메일") + option("phone", action.type, "전화") + option("download", action.type, "파일 다운로드") + option("back", action.type, "뒤로가기"))}${detail}${["external", "download"].includes(action.type) ? field("새 창", "action.newTab", action.newTab, "checkbox") : ""}`;
}

function inspectorSection(title, hint, body, { open = false, className = "" } = {}) {
  return `<details class="studio-inspector-section ${className}" ${open ? "open" : ""}><summary><span>${title}</span><small>${hint}</small></summary><div class="studio-inspector-section__body">${body}</div></details>`;
}

// Studio 7 · 편집기 보조 상수와 마크업 (레이어 아이콘, 정렬 툴바, 다중 선택 패널)
const LAYER_ICONS = { text: "T", image: "▧", video: "▶", audio: "♪", button: "↗", shape: "○", line: "—", marquee: "→", gallery: "▦", embed: "⌘", nav: "☰", component: "✦", code: "‹›" };
const ALIGN_LABELS = { left: "왼쪽", center: "가로 가운데", right: "오른쪽", top: "위", middle: "세로 가운데", bottom: "아래" };
const ALIGN_ICONS = {
  left: '<svg viewBox="0 0 16 16"><path d="M2 1v14" /><rect x="4" y="3" width="9" height="4" /><rect x="4" y="9" width="6" height="4" /></svg>',
  center: '<svg viewBox="0 0 16 16"><path d="M8 1v14" /><rect x="3" y="3" width="10" height="4" /><rect x="5" y="9" width="6" height="4" /></svg>',
  right: '<svg viewBox="0 0 16 16"><path d="M14 1v14" /><rect x="3" y="3" width="9" height="4" /><rect x="6" y="9" width="6" height="4" /></svg>',
  top: '<svg viewBox="0 0 16 16"><path d="M1 2h14" /><rect x="3" y="4" width="4" height="9" /><rect x="9" y="4" width="4" height="6" /></svg>',
  middle: '<svg viewBox="0 0 16 16"><path d="M1 8h14" /><rect x="3" y="3" width="4" height="10" /><rect x="9" y="5" width="4" height="6" /></svg>',
  bottom: '<svg viewBox="0 0 16 16"><path d="M1 14h14" /><rect x="3" y="3" width="4" height="9" /><rect x="9" y="6" width="4" height="6" /></svg>',
  "distribute-x": '<svg viewBox="0 0 16 16"><path d="M1 1v14M15 1v14" /><rect x="4" y="4" width="3" height="8" /><rect x="9" y="4" width="3" height="8" /></svg>',
  "distribute-y": '<svg viewBox="0 0 16 16"><path d="M1 1h14M1 15h14" /><rect x="4" y="4" width="8" height="3" /><rect x="4" y="9" width="8" height="3" /></svg>',
};
function alignToolbarMarkup(count = 1) {
  const align = Object.keys(ALIGN_LABELS).map((mode) => `<button data-align="${mode}" title="${ALIGN_LABELS[mode]} 정렬${count > 1 ? "" : " (캔버스 기준)"}" aria-label="${ALIGN_LABELS[mode]} 정렬" type="button">${ALIGN_ICONS[mode]}</button>`).join("");
  const distribute = `<button data-distribute="x" title="가로 간격 균등" aria-label="가로 간격 균등" ${count < 3 ? "disabled" : ""} type="button">${ALIGN_ICONS["distribute-x"]}</button><button data-distribute="y" title="세로 간격 균등" aria-label="세로 간격 균등" ${count < 3 ? "disabled" : ""} type="button">${ALIGN_ICONS["distribute-y"]}</button>`;
  return `<div class="studio-align" role="group" aria-label="정렬과 분배">${align}<i></i>${distribute}</div>`;
}
// Studio 7 (A11): 썸네일을 클릭하거나 끌어서 보이는 중심(focal)을 찍는다. 영상은 포스터가 있을 때만 그림이 보인다.
function focalPickerMarkup(block) {
  const src = block.type === "image" ? safeURL(block.media || block.src, { imageData: true }) : safeURL(block.poster, { imageData: true });
  return `<div class="studio-focal${src ? "" : " is-empty"}" data-focal-pick title="클릭하거나 끌어서 보이는 중심 정하기" style="${src ? `background-image:url('${escapeHTML(src)}')` : ""}"><span class="studio-focal__dot" style="left:${number(block.focalX, 50, 0, 100)}%;top:${number(block.focalY, 50, 0, 100)}%"></span>${src ? "" : `<small>${block.type === "video" ? "포스터 이미지를 넣으면 그림 위에서 찍을 수 있어요" : "이미지를 넣으면 그림 위에서 찍을 수 있어요"}</small>`}</div>`;
}
function multiSelectionMarkup(blocks, layout = "desktop") {
  const locked = blocks.filter((block) => block.locked).length;
  const hidden = blocks.filter((block) => !block.visible).length;
  const list = blocks.map((block) => `<li><i class="studio-layer__icon" aria-hidden="true">${LAYER_ICONS[block.type] || "▣"}</i><span>${escapeHTML(block.name)}</span><small>${block.locked ? "🔒 " : ""}${Math.round(block.width)}×${Math.round(block.height)}</small></li>`).join("");
  const fontBlocks = blocks.filter((block) => ["text", "button", "marquee", "nav"].includes(block.type));
  const fontField = fontBlocks.length ? `<div class="studio-font-field"><label><span>폰트 (글자 요소 ${fontBlocks.length}개)</span><input data-multi-field="fontFamily" value="${escapeHTML(fontBlocks.every((block) => block.fontFamily === fontBlocks[0].fontFamily) ? fontBlocks[0].fontFamily : "")}" placeholder="여러 값"></label><button class="studio-font-pick" data-font-pick type="button">Aa</button></div>` : "";
  return `<div class="inspector-head"><div><span>${blocks.length}개 선택${layout !== "desktop" ? `<i class="is-layout">${LAYOUT_LABELS[layout]}</i>` : ""}</span><strong>여러 요소</strong><small>Shift+클릭으로 더하거나 빼기 · 빈 곳 드래그로 묶어 선택</small></div><button data-action="delete" type="button">삭제</button></div>
    <details class="studio-inspector-section" open><summary><span>정렬 · 분배</span><small>선택 묶음 기준</small></summary><div class="studio-inspector-section__body">${alignToolbarMarkup(blocks.length)}<p class="studio-help">정렬은 선택한 요소들을 감싸는 상자 기준이에요. 간격 균등은 3개 이상일 때, 양 끝은 그대로 두고 사이 간격만 맞춰요.</p></div></details>
    <details class="studio-inspector-section" open><summary><span>함께 바꾸기</span><small>복제 · 잠금 · 숨김 · 순서</small></summary><div class="studio-inspector-section__body">
      <div class="inspector-actions"><button data-action="duplicate" type="button">복제</button><button data-action="back" type="button">뒤로</button><button data-action="front" type="button">앞으로</button></div>
      <div class="inspector-actions"><button data-action="lock-selected" type="button">${locked === blocks.length ? "잠금 해제" : "잠금"}</button><button data-action="hide-selected" type="button">${hidden === blocks.length ? "표시" : "숨기기"}</button><button data-action="copy-selected" type="button">복사</button></div>
      ${fontField}
      <div class="studio-fields studio-fields--two">${field("투명도", "multi.opacity", blocks.every((block) => block.opacity === blocks[0].opacity) ? blocks[0].opacity : "", "number").replace('data-field="multi.opacity"', 'data-multi-field="opacity"')}${field("회전", "multi.rotation", blocks.every((block) => block.rotation === blocks[0].rotation) ? blocks[0].rotation : "", "number").replace('data-field="multi.rotation"', 'data-multi-field="rotation"')}</div>
    </div></details>
    <details class="studio-inspector-section"><summary><span>선택한 요소</span><small>${blocks.length}개</small></summary><div class="studio-inspector-section__body"><ul class="studio-selection-list">${list}</ul></div></details>`;
}

function motionTriggerOptions(current) {
  return option("load", current, "페이지 열림")
    + option("in-view", current, "화면에 들어올 때")
    + option("click", current, "클릭할 때")
    + option("hover", current, "호버 · 터치 누름")
    + option("press", current, "누르는 동안")
    + option("scroll", current, "스크롤 진행률 0–100% ")
    + option("linked", current, "다른 레이어와 연결 (메뉴·토글)");
}

function motionEasingOptions(current) {
  return option("linear", current, "Linear")
    + option("ease-out", current, "Ease out")
    + option("ease-in", current, "Ease in")
    + option("ease-in-out", current, "Ease in-out")
    + option("cubic-bezier(0.22,1,0.36,1)", current, "Smooth out")
    + option("cubic-bezier(0.34,1.56,0.64,1)", current, "Spring · soft")
    + option("steps(4,end)", current, "Steps · 4");
}

function motionLabInspectorMarkup(block, selectedFrameId = "", blocks = []) {
  const timeline = block.motion.timeline;
  const selectedIndex = Math.max(0, timeline.keyframes.findIndex((frame) => frame.id === selectedFrameId));
  const frame = timeline.keyframes[selectedIndex] || null;
  const presets = Object.entries(MOTION_LAB_PRESETS).map(([id, preset]) => `<button data-motion-preset="${id}" type="button">${escapeHTML(preset.label)}</button>`).join("");
  const sources = blocks.filter((item) => item.id !== block.id).map((item) => option(item.id, timeline.linkTarget, `${item.name} · ${item.type}`)).join("");
  const linkControls = timeline.trigger === "linked"
    ? `<div class="studio-callout motion-lab-callout"><strong>다른 레이어가 이 모션을 실행해요</strong><p>예: ‘메뉴’ 버튼을 누르면 이 패널이 열리고, 다시 누르면 닫혀요(토글). 첫 키프레임 투명도가 0이면 닫혀 있는 동안 클릭도 통과해요. Esc로도 닫혀요. 편집 화면에서는 흐리게 보이니 왼쪽 레이어 목록에서 선택하세요.</p></div>
      ${field("연결할 레이어", "motion.timeline.linkTarget", timeline.linkTarget, "select", `<option value="">선택</option>${sources}`)}
      <div class="studio-fields studio-fields--two">${field("그 레이어를", "motion.timeline.linkEvent", timeline.linkEvent, "select", option("click", timeline.linkEvent, "클릭하면") + option("hover", timeline.linkEvent, "호버하는 동안") + option("press", timeline.linkEvent, "누르는 동안") + option("in-view", timeline.linkEvent, "화면에서 보면"))}${field("동작", "motion.timeline.linkMode", timeline.linkMode, "select", option("toggle", timeline.linkMode, "열기·닫기 토글") + option("restart", timeline.linkMode, "처음부터 재생"))}</div>`
    : "";
  const timeControls = timeline.trigger === "scroll"
    ? `<div class="studio-callout motion-lab-callout"><strong>스크롤 진행률에 직접 연결</strong><p>스크롤 위치가 0–100% 타임라인이 돼요. 시간·지연·반복 설정은 적용되지 않아요.</p></div><div class="studio-fields studio-fields--two">${field("스크롤 구간", "motion.timeline.scrollRange", timeline.scrollRange, "select", option("element", timeline.scrollRange, "화면을 지나가는 동안") + option("enter", timeline.scrollRange, "화면 가운데 올 때까지") + option("page", timeline.scrollRange, "페이지 전체"))}${field("따라오는 부드러움 0–0.95", "motion.timeline.scrubSmooth", timeline.scrubSmooth, "number")}</div>`
    : `<div class="studio-checks">${timeline.trigger === "linked" ? "" : field("무한 반복", "motion.timeline.infinite", timeline.infinite, "checkbox")}${["in-view"].includes(timeline.trigger) && !timeline.infinite ? field("한 번만 재생", "motion.timeline.once", timeline.once, "checkbox") : ""}${timeline.trigger === "linked" && timeline.linkEvent === "in-view" ? field("한 번 열면 유지", "motion.timeline.once", timeline.once, "checkbox") : ""}</div><div class="studio-fields studio-fields--two">${field("시간 (ms)", "motion.timeline.duration", timeline.duration, "number")}${field("지연 (ms)", "motion.timeline.delay", timeline.delay, "number")}${timeline.trigger === "linked" ? "" : `${field("반복 횟수", "motion.timeline.iterations", timeline.iterations, "number")}${field("방향", "motion.timeline.direction", timeline.direction, "select", option("normal", timeline.direction, "정방향") + option("reverse", timeline.direction, "역방향") + option("alternate", timeline.direction, "왕복") + option("alternate-reverse", timeline.direction, "역방향 왕복"))}`}${field("완료 상태", "motion.timeline.fill", timeline.fill, "select", option("both", timeline.fill, "처음·끝 유지") + option("forwards", timeline.fill, "끝 유지") + option("none", timeline.fill, "원래대로"))}</div>`;
  const controls = `<div class="motion-lab-presets">${presets}</div>
    <div class="studio-checks">${field("Motion Lab 사용", "motion.timeline.enabled", timeline.enabled, "checkbox")}</div>
    ${field("시작 조건", "motion.timeline.trigger", timeline.trigger, "select", motionTriggerOptions(timeline.trigger))}${linkControls}${timeControls}
    <div class="studio-fields studio-fields--two">${field("변형 기준점", "motion.timeline.origin", timeline.origin, "select", MOTION_LAB_ORIGINS.map((item) => option(item, timeline.origin, item.replaceAll("-", " "))).join(""))}${field("3D 원근", "motion.timeline.perspective", timeline.perspective, "number")}</div>
    <div class="motion-lab-inspector-actions"><button data-motion-preview type="button">▶ 선택 모션 재생</button><button data-motion-stop type="button">■ 정지</button><button data-motion-empty type="button">＋ 빈 모션</button></div>`;
  if (!timeline.enabled || !frame) return `${controls}<div class="studio-callout motion-lab-callout"><strong>프리셋 또는 빈 모션으로 시작</strong><p>모션 모드의 하단 타임라인에서 키프레임을 고르고 캔버스와 숫자로 정밀하게 조절할 수 있어요.</p></div>`;
  const dots = timeline.keyframes.map((item, index) => `<button class="motion-lab-key-dot ${item.id === frame.id ? "is-active" : ""}" data-motion-frame-select="${escapeHTML(item.id)}" style="left:${item.at}%" aria-label="${item.at}% 키프레임" title="${item.at}%" type="button"><span>${index + 1}</span></button>`).join("");
  const framePath = `motion.timeline.keyframes.${selectedIndex}`;
  return `${controls}
    <div class="motion-lab-mini-timeline"><div class="motion-lab-mini-ruler"><span>0</span><span>50</span><span>100%</span></div><div class="motion-lab-mini-track"><i data-motion-inspector-playhead style="left:${frame.at}%"></i>${dots}</div></div>
    <div class="motion-lab-frame-head"><div><span>KEYFRAME ${selectedIndex + 1}</span><strong>${frame.at}%</strong></div><div><button data-motion-frame-duplicate type="button">복제</button><button data-motion-frame-delete type="button" ${timeline.keyframes.length <= 2 ? "disabled" : ""}>삭제</button></div></div>
    <label class="motion-lab-range"><span>타임라인 위치 <output data-motion-at-output>${frame.at}%</output></span><input data-field="${framePath}.at" type="range" min="0" max="100" step="1" value="${frame.at}"></label>
    <p class="studio-insert__label">TRANSFORM</p><div class="studio-fields studio-fields--two">${field("X 이동", `${framePath}.x`, frame.x, "number")}${field("Y 이동", `${framePath}.y`, frame.y, "number")}${field("가로 배율", `${framePath}.scaleX`, frame.scaleX, "number")}${field("세로 배율", `${framePath}.scaleY`, frame.scaleY, "number")}${field("회전 Z", `${framePath}.rotate`, frame.rotate, "number")}${field("회전 X", `${framePath}.rotateX`, frame.rotateX, "number")}${field("회전 Y", `${framePath}.rotateY`, frame.rotateY, "number")}${field("기울기 X", `${framePath}.skewX`, frame.skewX, "number")}${field("기울기 Y", `${framePath}.skewY`, frame.skewY, "number")}</div>
    <p class="studio-insert__label">APPEARANCE</p><div class="studio-fields studio-fields--two">${field("투명도", `${framePath}.opacity`, frame.opacity, "number")}${field("블러", `${framePath}.blur`, frame.blur, "number")}${field("밝기", `${framePath}.brightness`, frame.brightness, "number")}${field("채도", `${framePath}.saturate`, frame.saturate, "number")}${field("색상 회전", `${framePath}.hue`, frame.hue, "number")}</div>
    <p class="studio-insert__label">MASK · 가려진 정도 %</p><div class="studio-fields studio-fields--two">${field("위", `${framePath}.clipTop`, frame.clipTop, "number")}${field("오른쪽", `${framePath}.clipRight`, frame.clipRight, "number")}${field("아래", `${framePath}.clipBottom`, frame.clipBottom, "number")}${field("왼쪽", `${framePath}.clipLeft`, frame.clipLeft, "number")}</div>
    ${field("이 프레임 뒤 이징", `${framePath}.easing`, frame.easing, "select", motionEasingOptions(frame.easing))}
    <div class="motion-lab-inspector-actions motion-lab-inspector-actions--frames"><button data-motion-frame-add type="button">＋ 키프레임</button><button data-motion-frame-copy type="button">현재 값으로 새 프레임</button></div>`;
}

function componentPropFields(meta, rawProps) {
  const props = resolveProps(meta, rawProps);
  return meta.props.map((prop) => {
    const path = `props.${prop.key}`;
    const value = props[prop.key];
    const help = prop.help ? `<small class="studio-prop-help">${escapeHTML(prop.help)}</small>` : "";
    if (prop.type === "toggle") return field(escapeHTML(prop.label), path, value, "checkbox");
    if (prop.type === "select") return field(escapeHTML(prop.label), path, value, "select", prop.options.map(([key, label]) => option(escapeHTML(key), value, escapeHTML(label))).join(""));
    if (prop.type === "textarea" || prop.type === "images") return `<label class="studio-field--wide"><span>${escapeHTML(prop.label)}${prop.type === "images" ? " · 한 줄에 하나" : ""}</span><textarea data-field="${path}" rows="4">${escapeHTML(Array.isArray(value) ? value.join("\n") : value)}</textarea>${help}</label>`;
    if (prop.type === "range") return `<label class="studio-range"><span>${escapeHTML(prop.label)} <output>${escapeHTML(value)}</output></span><input data-field="${path}" type="range" min="${prop.min ?? 0}" max="${prop.max ?? 1}" step="${prop.step ?? 0.01}" value="${escapeHTML(value)}">${help}</label>`;
    if (prop.type === "color") return `<label class="studio-color"><span>${escapeHTML(prop.label)}</span><span class="studio-color__row"><input data-field="${path}" type="color" value="${escapeHTML(/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000")}"><input data-field="${path}" type="text" value="${escapeHTML(value)}"></span>${help}</label>`;
    return `<label><span>${escapeHTML(prop.label)}${prop.type === "image" ? " · 링크나 /media/파일명" : ""}</span><input data-field="${path}" type="${prop.type === "number" ? "number" : "text"}" value="${escapeHTML(value)}">${help}</label>`;
  }).join("");
}

const codeArea = (label, path, value) => `<label class="studio-field--wide studio-code-field"><span>${label}</span><textarea data-field="${path}" rows="7" spellcheck="false" autocapitalize="off">${escapeHTML(value)}</textarea></label>`;

function inspectorMarkup(block, data, selectedFrameId = "", motionMode = false, { layout = "desktop", base = block, isGlobal = false, blocks = [] } = {}) {
  // Fields whose value can differ per screen size get a dot when this screen overrides them.
  const lf = (label, key, value, type = "text", options = "") => {
    const html = field(label, key, value, type, options);
    return hasOverride(base, layout, key) ? html.replace("<label", '<label data-overridden title="이 화면 전용 값"') : html;
  };
  const overridden = layout !== "desktop" && Object.keys(base.responsive?.[layout] || {}).some((key) => key !== "hidden");
  const mediaFields = block.type === "image" ? `
    ${field("이미지·GIF 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<div class="studio-button-row"><button class="inspector-file" data-action="pick-image" type="button">작은 파일 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">GitHub에 업로드 ↗</button></div>
    ${field("설명(alt)", "alt", block.alt)}${field("장식 이미지", "decorative", block.decorative, "checkbox")}
    <div class="studio-fields studio-fields--two">${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain", "fill"].map((item) => option(item, block.objectFit)).join(""))}${field("이미지 반복", "repeat", block.repeat, "select", ["no-repeat", "repeat", "repeat-x", "repeat-y"].map((item) => option(item, block.repeat)).join(""))}${field("반복 크기", "repeatSize", block.repeatSize, "number")}</div>${focalPickerMarkup(block)}<div class="studio-fields studio-fields--two">${field("보이는 중심 X(%)", "focalX", block.focalX, "number")}${field("보이는 중심 Y(%)", "focalY", block.focalY, "number")}</div><p class="studio-help">이미지가 잘릴 때 어느 부분을 남길지예요. 50/50이 가운데, 0/0이 왼쪽 위.</p>${field("호버 효과", "hoverEffect", block.hoverEffect, "select", HOVER_EFFECTS.map((item) => option(item, block.hoverEffect, HOVER_EFFECT_LABELS[item])).join(""))}${block.hoverEffect === "swap" ? field("호버 시 보여줄 이미지 링크/경로", "hoverSrc", block.hoverSrc) : ""}${field("클릭 시 크게 보기", "lightbox", block.lightbox, "checkbox")}` : "";
  const videoFields = block.type === "video" ? `
    ${field("직접 영상 주소 (MP4·WebM)", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-video" type="button">영상 파일 업로드 ↗</button><p class="studio-help">YouTube·Vimeo는 ‘임베드’ 요소를 쓰면 재생 방식이 더 정확해요. GitHub 웹 업로드는 파일당 25MB까지입니다.</p>
    ${field("포스터 이미지", "poster", block.poster)}${field("WebVTT 자막 경로", "captions", block.captions)}${field("영상 설명", "alt", block.alt)}${focalPickerMarkup(block)}<div class="studio-fields studio-fields--two">${field("보이는 중심 X(%)", "focalX", block.focalX, "number")}${field("보이는 중심 Y(%)", "focalY", block.focalY, "number")}</div>${field("호버 효과", "hoverEffect", block.hoverEffect, "select", HOVER_EFFECTS.filter((item) => item !== "swap").map((item) => option(item, block.hoverEffect, HOVER_EFFECT_LABELS[item])).join(""))}` : "";
  const audioFields = block.type === "audio" ? `${field("오디오 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-audio" type="button">MP3·WAV 업로드 ↗</button>${field("재생 버튼 문구", "playLabel", block.playLabel)}` : "";
  const buttonFields = block.type === "button" ? `<div class="studio-presets"><button data-button-preset="square" type="button">각진</button><button data-button-preset="round" type="button">둥근</button><button data-button-preset="pill" type="button">캡슐</button><button data-button-preset="circle" type="button">원형</button><button data-button-preset="outline" type="button">테두리</button></div>${field("배경 이미지·GIF 링크/경로", "backgroundImage", block.backgroundImage)}<button class="inspector-file" data-action="pick-button-image" type="button">작은 버튼 이미지 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">큰 버튼 이미지 업로드 ↗</button>` : "";
  const formFieldsMarkup = block.type === "form" ? `${field("받을 주소 (Formspree·Getform·Web3Forms 엔드포인트)", "formEndpoint", block.formEndpoint, "url")}<p class="studio-help">예: https://formspree.io/f/xxxx — 폼 서비스에서 만들면 주는 주소예요. 메일은 그 서비스가 보내줘요. 주소가 없으면 보내기가 안 돼요.</p><div class="studio-checks">${FORM_FIELDS.map((name) => `<label class="studio-check"><input data-form-field="${name}" type="checkbox" ${block.formFields.includes(name) ? "checked" : ""}><span>${FORM_FIELD_LABELS[name]}</span></label>`).join("")}</div>${field("추가 칸 (한 줄에 하나: 라벨 | 종류)", "formExtra", block.formExtra, "textarea")}<p class="studio-help">종류: text · email · tel · url · number · date · textarea</p><div class="studio-fields studio-fields--two">${field("보내기 버튼 글자", "formSubmitLabel", block.formSubmitLabel)}${field("성공 메시지", "formSuccess", block.formSuccess)}</div>` : "";
  const textFields = ["text", "button", "marquee", "nav", "form"].includes(block.type) ? `
    ${["text", "button", "marquee"].includes(block.type) ? field(block.type === "button" ? "버튼 글자" : "내용", "content", block.content, "textarea") : ""}
    ${block.type === "text" ? field("HTML 의미", "htmlTag", block.htmlTag, "select", ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"].map((item) => option(item, block.htmlTag)).join("")) : ""}
    <div class="studio-font-field">${field("폰트", "fontFamily", block.fontFamily)}<button class="studio-font-pick" data-font-pick type="button" title="폰트 고르기" style="font-family:${escapeHTML(block.fontFamily)}">Aa</button></div>
    <div class="studio-fields studio-fields--two">${lf("크기", "fontSize", block.fontSize, "number")}${field("굵기", "fontWeight", block.fontWeight, "number")}${lf("행간", "lineHeight", block.lineHeight, "number")}${lf("자간", "letterSpacing", block.letterSpacing, "number")}</div>
    ${lf("정렬", "textAlign", block.textAlign, "select", ["left", "center", "right"].map((item) => option(item, block.textAlign)).join(""))}${block.type === "text" ? field("글자 효과", "textEffect", block.textEffect, "select", option("none", block.textEffect, "없음") + option("typewriter", block.textEffect, "타이프라이터") + option("scramble", block.textEffect, "스크램블") + option("letters", block.textEffect, "글자별 등장") + option("words", block.textEffect, "단어별 등장")) : ""}` : "";
  const marqueeFields = block.type === "marquee" ? `<div class="studio-fields studio-fields--two">${field("속도(초)", "speed", block.speed, "number")}${field("방향", "direction", block.direction, "select", option("left", block.direction, "왼쪽") + option("right", block.direction, "오른쪽"))}</div>` : "";
  const galleryFields = block.type === "gallery" ? `${field("한 줄: 이미지 경로 | alt 설명 | 캡션", "galleryItemsText", block.galleryItems.map((item) => [item.src, item.alt, item.caption].join(" | ")).join("\n"), "textarea")}${field("보기 방식", "galleryMode", block.galleryMode, "select", option("grid", block.galleryMode, "그리드") + option("slideshow", block.galleryMode, "슬라이드쇼"))}<div class="studio-fields studio-fields--two">${lf("열 수", "galleryColumns", block.galleryColumns, "number")}${lf("간격", "galleryGap", block.galleryGap, "number")}${field("전환 간격(ms)", "galleryInterval", block.galleryInterval, "number")}</div>${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain"].map((item) => option(item, block.objectFit)).join(""))}${field("클릭 시 크게 보기", "lightbox", block.lightbox, "checkbox")}<button class="inspector-file" data-action="upload-media" type="button">갤러리 이미지 업로드 ↗</button>` : "";
  const embedFields = block.type === "embed" ? `${field("임베드 링크", "src", block.src, "url")}${field("포스터·썸네일 이미지", "poster", block.poster)}${field("접근성 제목", "embedTitle", block.embedTitle)}${field("버튼 문구", "playLabel", block.playLabel)}<p class="studio-help">YouTube, Vimeo, Spotify, SoundCloud, Google Maps를 지원합니다. 지도는 일반 공유 링크가 아니라 ‘지도 퍼가기’ iframe의 src 주소를 넣으세요.</p>` : "";
  const navPages = data.pages.map((page) => {
    const selectedIndex = block.navPageIds.indexOf(page.id);
    const moves = selectedIndex >= 0 ? `<span class="studio-nav-page__move"><button data-nav-page-move="up" data-nav-page-id="${escapeHTML(page.id)}" aria-label="${escapeHTML(page.name)} 메뉴 순서를 위로" ${selectedIndex === 0 ? "disabled" : ""} type="button">↑</button><button data-nav-page-move="down" data-nav-page-id="${escapeHTML(page.id)}" aria-label="${escapeHTML(page.name)} 메뉴 순서를 아래로" ${selectedIndex === block.navPageIds.length - 1 ? "disabled" : ""} type="button">↓</button></span>` : "";
    return `<div class="studio-nav-page ${page.visibility === "draft" ? "is-disabled" : ""}"><label><input data-nav-page-id="${escapeHTML(page.id)}" type="checkbox" ${selectedIndex >= 0 ? "checked" : ""} ${page.visibility === "draft" ? "disabled" : ""}><span>${escapeHTML(page.name)}</span><small>${page.visibility === "listed" ? "메뉴" : page.visibility === "unlisted" ? "링크 전용" : "초안"}</small></label>${moves}</div>`;
  }).join("");
  const listedCount = data.pages.filter((page) => page.visibility === "listed").length;
  const navFields = block.type === "nav" ? `${field("메뉴 구성", "navMode", block.navMode, "select", option("listed", block.navMode, "사이트 메뉴 페이지 자동") + option("custom", block.navMode, "직접 선택"))}${block.navMode === "custom" ? `<div class="studio-nav-page-list">${navPages}</div>` : `<div class="studio-callout"><strong>메뉴 페이지 ${listedCount}개</strong><p>${listedCount < 2 ? "지금은 Home만 있어요. 새 메뉴 페이지를 만들면 자동으로 여기에 나타납니다." : "왼쪽 ‘메뉴에 표시’ 그룹의 순서대로 보여요."}</p><button data-action="nav-add-page" type="button">＋ 메뉴 페이지 만들기</button></div>`}<div class="studio-fields studio-fields--two">${lf("방향", "navOrientation", block.navOrientation, "select", option("horizontal", block.navOrientation, "가로") + option("vertical", block.navOrientation, "세로"))}${lf("메뉴 간격", "navGap", block.navGap, "number")}${field("현재 페이지 표시", "navActiveStyle", block.navActiveStyle, "select", option("underline", block.navActiveStyle, "밑줄") + option("pill", block.navActiveStyle, "캡슐") + option("fade", block.navActiveStyle, "나머지 흐리게") + option("none", block.navActiveStyle, "표시 없음"))}</div>${field("번호 함께 표시", "navShowIndex", block.navShowIndex, "checkbox")}<p class="studio-help">편집 중 클릭은 메뉴 선택입니다. 실제 이동은 미리보기에서 확인하세요.</p>` : "";

  const optionalNativeControls = ["autoplay", "in-view"].includes(block.playbackMode) ? field("기본 컨트롤도 표시", "controls", block.controls, "checkbox") : "";
  const pauseOutside = ["autoplay", "in-view"].includes(block.playbackMode) ? field("화면 밖에서 정지", "pauseWhenHidden", block.pauseWhenHidden, "checkbox") : "";
  const videoPlayback = block.type === "video" ? `${field("재생 방식", "playbackMode", block.playbackMode, "select", option("click", block.playbackMode, "클릭해서 재생") + option("autoplay", block.playbackMode, "무음 자동재생") + option("in-view", block.playbackMode, "화면에 들어오면 재생") + option("hover", block.playbackMode, "호버 중 재생") + option("scrub", block.playbackMode, "호버 스크럽 · 마우스 위치가 시간") + option("controls", block.playbackMode, "기본 플레이어") + option("link", block.playbackMode, "재생 없이 링크 카드"))}<div class="studio-checks">${field("반복 재생", "loop", block.loop, "checkbox")}${field("처음에는 음소거", "muted", block.muted, "checkbox")}${optionalNativeControls}${pauseOutside}</div><div class="studio-fields studio-fields--two">${field("미리 불러오기", "preload", block.preload, "select", option("none", block.preload, "안 함") + option("metadata", block.preload, "정보만") + option("auto", block.preload, "전체"))}${field("재생 버튼 문구", "playLabel", block.playLabel)}</div><p class="studio-help">클릭 재생은 큰 버튼, 기본 플레이어는 브라우저 컨트롤을 사용합니다. 자동 계열이 차단되면 재생 버튼이 나타납니다.</p><div class="studio-fields studio-fields--two">${field("구간 시작(초)", "videoStart", block.videoStart, "number")}${field("구간 끝(초 · 0=끝까지)", "videoEnd", block.videoEnd, "number")}${field("재생 속도 (1=보통)", "playbackRate", block.playbackRate, "number")}</div><p class="studio-help">구간을 정하면 그 사이만 재생·반복해요. 호버 스크럽은 자동 재생 없이 마우스 X 위치로 영상을 넘겨요(파일 전체를 미리 불러옴). 투명 배경 영상은 WebM(VP9, alpha)으로 내보내고 포스터는 PNG로 넣으세요.</p>` : "";
  const audioPlayback = block.type === "audio" ? `${field("재생 방식", "playbackMode", block.playbackMode, "select", option("click", block.playbackMode, "클릭해서 재생") + option("controls", block.playbackMode, "기본 플레이어") + option("autoplay", block.playbackMode, "자동재생 · 보장되지 않음") + option("in-view", block.playbackMode, "화면에 들어오면 재생") + option("hover", block.playbackMode, "호버 중 재생") + option("link", block.playbackMode, "재생 없이 링크 카드"))}<div class="studio-checks">${field("반복 재생", "loop", block.loop, "checkbox")}${optionalNativeControls}${pauseOutside}</div>${field("미리 불러오기", "preload", block.preload, "select", option("none", block.preload, "안 함") + option("metadata", block.preload, "정보만") + option("auto", block.preload, "전체"))}<p class="studio-help">소리가 있는 자동재생은 대부분 차단됩니다. 실패하면 직접 누를 재생 버튼이 나타납니다.</p>` : "";
  const gifPlayback = block.type === "image" ? `${field("GIF 재생 방식", "gifPlayback", block.gifPlayback, "select", option("auto", block.gifPlayback, "바로 재생") + option("click", block.gifPlayback, "클릭하면 시작") + option("hover", block.gifPlayback, "호버하면 재생"))}${field("GIF 정지 포스터", "poster", block.poster)}${field("재생 버튼 문구", "playLabel", block.playLabel)}<p class="studio-help">정적인 이미지에는 이 설정이 적용되지 않아요. GIF 반복은 파일 자체 설정이며 정밀한 제어는 MP4·WebM이 더 좋아요.</p>` : "";
  const embedPlayback = block.type === "embed" ? `${field("임베드 사용 방식", "embedMode", block.embedMode, "select", option("interactive", block.embedMode, "바로 조작") + option("click", block.embedMode, "클릭해서 불러오기") + option("link", block.embedMode, "재생 없이 페이지·링크 이동"))}<div class="studio-checks">${field("YouTube·Vimeo 컨트롤", "controls", block.controls, "checkbox")}${field("YouTube·Vimeo 반복", "loop", block.loop, "checkbox")}</div><div class="studio-callout"><strong>${block.embedMode === "link" ? "전체 카드가 링크가 됩니다" : block.embedMode === "click" ? "첫 클릭은 임베드를 불러옵니다" : "방문자가 임베드 안을 직접 조작합니다"}</strong><p>${block.embedMode === "link" ? "아래 클릭 동작에서 이동할 페이지나 URL을 선택하세요." : "다른 페이지로 보내려면 ‘재생 없이 페이지·링크 이동’을 선택하세요. 컨트롤·반복 옵션은 YouTube와 Vimeo에만 적용됩니다."}</p></div>` : "";
  const playbackFields = videoPlayback || audioPlayback || gifPlayback || embedPlayback || navFields;
  const mediaLinkMode = (["video", "audio"].includes(block.type) && block.playbackMode === "link") || (block.type === "embed" && block.embedMode === "link");
  const actionAllowed = block.type !== "nav" && (!["video", "audio", "embed"].includes(block.type) || mediaLinkMode);
  const actionBody = actionAllowed ? `${actionFields(block, data)}${field("접근성 이름", "ariaLabel", block.ariaLabel)}` : `<div class="studio-callout"><strong>클릭은 미디어 조작에 사용됩니다</strong><p>${block.type === "embed" ? "페이지로 이동시키려면 위에서 ‘재생 없이 페이지·링크 이동’을 선택하세요." : block.type === "nav" ? "메뉴 항목별 목적지는 페이지 설정을 따라갑니다." : "페이지로 이동시키려면 재생 방식을 ‘재생 없이 링크 카드’로 바꾸세요."}</p></div>`;
  const meta = block.type === "component" ? componentMetas.get(block.component) : null;
  const componentOptions = [...componentMetas.values()].map((item) => option(item.id, block.component, escapeHTML(item.name))).join("");
  const componentFields = block.type === "component" ? `${field("컴포넌트", "component", block.component, "select", `<option value="">선택</option>${componentOptions}`)}${meta ? `<p class="studio-help">${escapeHTML(meta.description)}${meta.error ? ` · 불러오기 실패: ${escapeHTML(meta.error)}` : ""}</p>${componentPropFields(meta, block.props)}` : `<p class="studio-help">${componentMetas.size ? "위에서 컴포넌트를 고르세요." : "컴포넌트 목록을 불러오는 중…"}</p>`}<p class="studio-help">새 효과는 components 폴더에 파일 하나를 추가해 만들어요 · docs/COMPONENTS.md</p>` : "";
  const codeFields = block.type === "code" ? `<p class="studio-help">CodePen이나 다른 Claude가 만든 HTML·CSS·JS를 붙여넣으면 이 상자 안에서 바로 실행돼요. 사이트와 분리된 안전한 상자라서 코드가 잘못돼도 사이트 전체는 깨지지 않아요.</p>${codeArea("HTML", "code.html", block.code.html)}${codeArea("CSS", "code.css", block.code.css)}${codeArea("JavaScript", "code.js", block.code.js)}<div class="studio-checks">${field("방문자가 상자 안을 조작", "codeInteractive", block.codeInteractive, "checkbox")}</div><p class="studio-help">스크롤·마우스 값은 <code>archive.on("scroll", fn)</code>, <code>archive.on("pointer", fn)</code>로 받을 수 있어요.</p>` : "";
  const contentBody = `${formFieldsMarkup}${textFields}${mediaFields}${videoFields}${audioFields}${buttonFields}${marqueeFields}${galleryFields}${embedFields}${componentFields}${codeFields}` || '<p class="studio-muted">이 요소는 내용 설정이 없어요.</p>';
  const layoutNote = layout === "desktop" ? "" : `<div class="studio-callout studio-callout--layout"><strong>${LAYOUT_LABELS[layout]} 배치 편집 중</strong><p>여기서 바꾼 위치·크기·글자 크기는 ${LAYOUT_LABELS[layout]}에만 적용돼요. 점(●)이 붙은 칸이 이 화면 전용 값이에요.</p>${overridden ? '<button data-action="layout-reset-block" type="button">데스크톱 값으로 되돌리기</button>' : ""}</div>`;
  const fixedFields = block.fixed ? `${field("고정 기준", "fixedAnchor", block.fixedAnchor, "select", option("top", block.fixedAnchor, "화면 위쪽 기준") + option("bottom", block.fixedAnchor, "화면 아래쪽 기준"))}<p class="studio-help">스크롤해도 화면의 같은 자리에 있어요. 캔버스의 ‘첫 화면’ 점선 안에 놓으세요. 헤더·메뉴 버튼·커서 효과에 써요.</p>` : "";
  const layoutBody = `${layoutNote}${field("레이어 이름", "name", block.name)}<div class="studio-fields studio-fields--two">${lf("X", "x", block.x, "number")}${lf("Y", "y", block.y, "number")}${lf("W", "width", block.width, "number")}${lf("H", "height", block.height, "number")}${lf("회전", "rotation", block.rotation, "number")}${lf("투명도", "opacity", block.opacity, "number")}</div><div class="studio-checks">${field(`${LAYOUT_LABELS[layout]}에서 숨기기`, "layoutHidden", block.hidden, "checkbox")}${field("모든 화면에서 숨김", "visibleInverse", !block.visible, "checkbox")}${field("잠금", "locked", block.locked, "checkbox")}${field("모든 페이지에 표시", "isGlobal", isGlobal, "checkbox")}${field("화면에 고정", "fixed", block.fixed, "checkbox")}</div>${fixedFields}${field("페이지 내 위치 ID", "anchorId", block.anchorId)}<p class="studio-help studio-help--tight">캔버스 기준 정렬 (가로는 전체 너비, 세로는 첫 화면)</p>${alignToolbarMarkup(1)}<div class="inspector-actions"><button data-action="duplicate" type="button">복제</button><button data-action="back" type="button">뒤로</button><button data-action="front" type="button">앞으로</button></div>`;
  const styleBody = `${paletteStripMarkup(data)}<div class="studio-fields studio-fields--two">${colorField("글자색", "color", block.color)}${colorField("배경/그라디언트", "background", block.background)}${colorField("선 색", "borderColor", block.borderColor)}${field("선 두께", "borderWidth", block.borderWidth, "number")}${lf("둥근 모서리", "borderRadius", block.borderRadius, "number")}${lf("안쪽 여백", "padding", block.padding, "number")}${field("블러", "blur", block.blur, "number")}${field("흑백", "grayscale", block.grayscale, "number")}${field("대비", "contrast", block.contrast, "number")}${field("채도", "saturate", block.saturate, "number")}${field("밝기", "brightness", block.brightness, "number")}${field("색상 회전(°)", "hueRotate", block.hueRotate, "number")}${field("세피아", "sepia", block.sepia, "number")}${field("반전", "invert", block.invert, "number")}</div><p class="studio-help">대비·채도·밝기는 1이 원본, 흑백·세피아·반전은 0~1.</p><div class="studio-button-row"><button class="inspector-file" data-action="gradient-edit" type="button">배경 그라디언트 편집…</button></div>${field("모양으로 자르기", "clipShape", block.clipShape, "select", CLIP_SHAPES.map((item) => option(item, block.clipShape, CLIP_SHAPE_LABELS[item])).join(""))}${block.clipShape === "custom" ? `${field("clip-path 값", "clipCustom", block.clipCustom, "textarea")}<p class="studio-help">예: polygon(50% 0%, 100% 100%, 0% 100%) · circle(40% at 50% 50%) · inset(10% round 40px)</p>` : ""}${block.clipShape !== "none" ? '<p class="studio-help">사진·영상·갤러리·도형 모두 이 모양으로 잘려요. 그림자는 자른 모양 밖으로 나가지 않아요.</p>' : ""}${field("마스크 (가장자리 흐리게 · 모양 뚫기)", "maskPreset", block.maskPreset, "select", MASK_PRESETS.map((item) => option(item, block.maskPreset, MASK_PRESET_LABELS[item])).join(""))}${block.maskPreset === "image" ? `${field("마스크 이미지 (PNG·SVG 링크 또는 /media 경로)", "maskImage", block.maskImage)}<button class="inspector-file" data-action="pick-mask-image" type="button">작은 마스크 파일 바로 넣기</button><div class="studio-fields studio-fields--two">${field("마스크 해석", "maskMode", block.maskMode, "select", option("alpha", block.maskMode, "투명도 (불투명한 곳만 보임)") + option("luminance", block.maskMode, "밝기 (흰색만 보임)"))}${field("맞춤", "maskSize", block.maskSize, "select", option("cover", block.maskSize, "꽉 채움") + option("contain", block.maskSize, "전체 보이기") + option("stretch", block.maskSize, "늘리기"))}${field("위치 (예: 50% 50%)", "maskPosition", block.maskPosition)}</div><p class="studio-help">PNG의 불투명한 부분(또는 밝은 부분)만 보여요. 붓 자국·찢어진 종이·글자 모양 마스크를 올려 보세요.</p>` : ""}<div class="studio-checks">${field("듀오톤 (두 가지 색으로 물들이기)", "duotone", block.duotone, "checkbox")}</div>${block.duotone ? `<div class="studio-fields studio-fields--two">${colorField("어두운 색", "duotoneDark", block.duotoneDark)}${colorField("밝은 색", "duotoneLight", block.duotoneLight)}</div><p class="studio-help">사진·영상·갤러리에 잘 어울려요. 두 색을 바꿔 보세요.</p>` : ""}${field("블렌드", "blendMode", block.blendMode, "select", ["normal", "multiply", "screen", "overlay", "difference", "exclusion", "color-burn", "color-dodge"].map((item) => option(item, block.blendMode)).join(""))}<div class="studio-fields studio-fields--two">${field("그림자 X", "shadowX", block.shadowX, "number")}${field("그림자 Y", "shadowY", block.shadowY, "number")}${field("그림자 번짐", "shadowBlur", block.shadowBlur, "number")}${field("그림자 색", "shadowColor", block.shadowColor)}</div>`;
  const visitorDragField = ["video", "audio", "embed"].includes(block.type) ? "" : field("방문자가 드래그", "publicDraggable", block.publicDraggable, "checkbox");
  const motionBody = `${field("등장", "motion.entrance.preset", block.motion.entrance.preset, "select", ["none", "fade", "rise", "fall", "slide-left", "slide-right", "scale", "blur", "rotate"].map((item) => option(item, block.motion.entrance.preset)).join(""))}<div class="studio-fields studio-fields--two">${field("트리거", "motion.entrance.trigger", block.motion.entrance.trigger, "select", option("load", block.motion.entrance.trigger, "페이지 열림") + option("scroll", block.motion.entrance.trigger, "스크롤 진입"))}${field("시간(ms)", "motion.entrance.duration", block.motion.entrance.duration, "number")}${field("지연(ms)", "motion.entrance.delay", block.motion.entrance.delay, "number")}${field("호버", "motion.hover.preset", block.motion.hover.preset, "select", ["none", "lift", "scale", "tilt", "glow", "invert", "fade"].map((item) => option(item, block.motion.hover.preset)).join("") + option("magnetic", block.motion.hover.preset, "magnetic · 자석"))}${field("반복", "motion.loop.preset", block.motion.loop.preset, "select", ["none", "float", "pulse", "spin", "bounce", "sway", "breathe"].map((item) => option(item, block.motion.loop.preset)).join(""))}${field("반복 시간(ms)", "motion.loop.duration", block.motion.loop.duration, "number")}${field("반복 방향", "motion.loop.direction", block.motion.loop.direction, "select", option("normal", block.motion.loop.direction, "정방향") + option("reverse", block.motion.loop.direction, "역방향") + option("alternate", block.motion.loop.direction, "왕복"))}${field("스크롤 패럴랙스", "parallax", block.parallax, "number")}${field("마우스 패럴랙스", "mouseParallax", block.mouseParallax, "number")}</div><div class="studio-checks">${field("스크롤 등장 한 번만", "motion.entrance.once", block.motion.entrance.once, "checkbox")}${visitorDragField}${block.fixed ? "" : field("스크롤 고정 (pin)", "pinEnabled", block.pinEnabled, "checkbox")}</div>${block.pinEnabled && !block.fixed ? `<div class="studio-fields studio-fields--two">${lf("화면 위에서 (px)", "pinTop", block.pinTop, "number")}${lf("고정 거리 (px)", "pinDistance", block.pinDistance, "number")}</div><p class="studio-help">요소 위쪽이 화면 위에서 지정한 위치에 닿으면, ‘고정 거리’만큼 스크롤하는 동안 그 자리에 머물러요. 다른 요소의 스크롤 모션과 함께 쓰면 장면이 넘어가는 스크롤 연출이 돼요.</p>` : ""}`;
  const motionLabSection = inspectorSection("MOTION LAB", "키프레임 · 타임라인 · 트리거", motionLabInspectorMarkup(block, selectedFrameId, blocks), { open: motionMode || block.motion.timeline.enabled, className: "studio-inspector-section--motion-lab" });
  const badges = `${isGlobal ? '<i title="모든 페이지에 표시">🌐 전체 페이지</i>' : ""}${block.fixed ? '<i title="화면에 고정">📌 고정</i>' : ""}${layout !== "desktop" ? `<i class="is-layout">${LAYOUT_LABELS[layout]}</i>` : ""}`;
  return `<div class="inspector-head"><div><span>${escapeHTML(block.type === "component" && meta ? `component · ${meta.name}` : block.type)}${badges}</span><strong>${escapeHTML(block.name)}</strong></div><button data-action="delete" type="button">삭제</button></div>
    ${motionMode ? motionLabSection : ""}
    ${inspectorSection("내용", "텍스트 · 파일 · 데이터", contentBody, { open: true })}
    ${playbackFields ? inspectorSection(block.type === "nav" ? "메뉴 구성" : "재생 방식", "먼저 동작을 선택하세요", playbackFields, { open: true, className: "studio-inspector-section--accent" }) : ""}
    ${inspectorSection("클릭 동작", "페이지 · 링크 · 다운로드", actionBody, { open: actionAllowed && block.action.type !== "none" })}
    ${inspectorSection("위치 · 크기", "레이어와 아트보드 좌표", layoutBody, { open: true })}
    ${inspectorSection("모양", "색상 · 테두리 · 효과", styleBody)}
    ${inspectorSection("빠른 애니메이션", "등장 · 호버 · 반복", motionBody)}
    ${motionMode ? "" : motionLabSection}`;
}

function setPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key]; });
  cursor[keys.at(-1)] = value;
}

function getPath(target, path) {
  return path.split(".").reduce((value, key) => value?.[key], target);
}

function defaultBlock(type, page) {
  const index = page.blocks.length;
  const maxZ = Math.max(0, ...page.blocks.map((block) => block.z));
  const widths = { marquee: 720, text: 520, button: 220, line: 420, nav: 520, gallery: 640, embed: 560, audio: 420, component: 640, code: 560, form: 520 };
  const heights = { marquee: 72, text: 130, button: 64, line: 2, nav: 64, gallery: 420, embed: 315, audio: 64, component: 420, code: 360, form: 470 };
  return normalizeBlock({
    id: uid(type),
    name: `${type[0].toUpperCase()}${type.slice(1)} ${index + 1}`,
    type,
    x: Math.max(40, Math.round(page.canvas.width / 2 - (widths[type] || 360) / 2) + index * 8),
    y: 100 + index * 24,
    z: maxZ + 1,
    width: widths[type] || 360,
    height: heights[type] || 260,
    playbackMode: ["video", "audio"].includes(type) ? "click" : undefined,
    autoplay: false,
    loop: false,
    muted: false,
    controls: ["video", "audio", "embed"].includes(type),
    playLabel: type === "image" ? "Play GIF" : type === "audio" ? "Play audio" : type === "embed" ? "Load media" : "Play",
    galleryItems: type === "gallery" ? [{ src: "", alt: "", caption: "" }] : [],
    code: type === "code" ? SAMPLE_CODE : undefined,
  }, index);
}

// A small starter for 코드 블록 that shows the scroll/pointer bridge.
const SAMPLE_CODE = {
  html: `<div class="orb"></div>\n<p class="label">CODE BLOCK</p>`,
  css: `body { display: grid; place-items: center; background: #0b0b0c; color: #f4f3ed; font-family: Arial, sans-serif; }\n.orb { width: 42vmin; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffd0c2, #ff5a36 45%, #3b2bff 100%); filter: blur(.5px); transition: transform .6s cubic-bezier(.22,1,.36,1); }\n.label { position: absolute; bottom: 16px; left: 16px; margin: 0; font-size: 11px; letter-spacing: .12em; opacity: .6; }`,
  js: `const orb = document.querySelector(".orb");\n// 마우스(또는 손가락)를 따라 기울고, 스크롤하면 회전해요.\narchive.on("pointer", (p) => {\n  orb.style.translate = \`\${(p.x - .5) * 40}px \${(p.y - .5) * 40}px\`;\n});\narchive.on("scroll", (s) => {\n  orb.style.transform = \`rotate(\${s.progress * 180}deg) scale(\${.8 + s.progress * .4})\`;\n});`,
};

function runPreflight(data) {
  const warnings = [];
  const slugs = new Set();
  const usesAction = (block) => {
    if (block.action.type === "none" || block.type === "nav") return false;
    if (["video", "audio"].includes(block.type)) return block.playbackMode === "link";
    if (block.type === "embed") return block.embedMode === "link";
    return true;
  };
  const reachable = new Set(data.pages.filter((page) => page.visibility === "listed" || page.id === data.settings.defaultPageId).filter((page) => page.visibility !== "draft").map((page) => page.id));
  let changed = true;
  while (changed) {
    changed = false;
    data.pages.filter((page) => reachable.has(page.id)).forEach((page) => {
      page.blocks.filter((block) => block.visible && usesAction(block) && block.action.type === "page").forEach((block) => {
        const target = data.pages.find((item) => item.id === block.action.pageId && item.visibility !== "draft");
        if (target && !reachable.has(target.id)) { reachable.add(target.id); changed = true; }
      });
      page.blocks.filter((block) => block.visible && block.type === "nav" && block.navMode === "custom").forEach((block) => {
        block.navPageIds.forEach((id) => {
          const target = data.pages.find((item) => item.id === id && item.visibility !== "draft");
          if (target && !reachable.has(target.id)) { reachable.add(target.id); changed = true; }
        });
      });
    });
  }
  data.pages.forEach((page) => {
    if (slugs.has(page.slug)) warnings.push(`중복 URL: /${page.slug}`);
    slugs.add(page.slug);
    if (!page.seo.title) warnings.push(`${page.name}: SEO 제목 없음`);
    if (!page.seo.description) warnings.push(`${page.name}: SEO 설명 없음`);
    if (page.id === data.settings.defaultPageId && page.visibility === "draft") warnings.push(`${page.name}: 홈페이지가 초안이라 공개 Archive가 열리지 않음`);
    if (page.visibility === "unlisted" && !reachable.has(page.id)) warnings.push(`${page.name}: 공개 홈·메뉴 페이지에서 도달할 수 없는 링크 전용 페이지`);
    if (page.visibility === "unlisted" && !page.seo.noIndex) warnings.push(`${page.name}: 링크 전용이지만 검색엔진 숨김이 꺼져 있음`);
    if (page.visibility === "draft") warnings.push(`${page.name}: 일반 사이트에서는 숨겨지지만 공개 JSON에는 남으므로 비밀 자료 금지`);
    page.blocks.forEach((block) => {
      if (!block.visible) return;
      const action = block.action;
      if (block.type === "button" && block.action.type === "none") warnings.push(`${page.name} / ${block.name}: 버튼 목적지 없음`);
      if (block.type === "image" && !safeURL(block.media || block.src, { imageData: true })) warnings.push(`${page.name} / ${block.name}: 이미지 파일 또는 링크 없음`);
      if (block.type === "image" && !block.decorative && !block.alt) warnings.push(`${page.name} / ${block.name}: 이미지 설명(alt) 없음`);
      if (block.type === "image" && isGIFSource(block.media || block.src) && ["click", "hover"].includes(block.gifPlayback) && action.type !== "none") warnings.push(`${page.name} / ${block.name}: GIF 재생과 클릭 목적지를 함께 설정해 클릭 목적지가 우선됨`);
      if (block.type === "video" && block.playbackMode === "autoplay" && !block.muted) warnings.push(`${page.name} / ${block.name}: 소리 있는 자동재생은 브라우저가 막을 수 있음`);
      if (block.type === "video" && block.videoEnd > 0 && block.videoEnd <= block.videoStart) warnings.push(`${page.name} / ${block.name}: 영상 구간 끝(${block.videoEnd}초)이 시작(${block.videoStart}초)보다 빠르거나 같음`);
      if (block.type === "video" && block.playbackMode === "scrub" && safeEmbedURL(block.media || block.src)) warnings.push(`${page.name} / ${block.name}: 호버 스크럽은 직접 올린 MP4·WebM에서만 동작 (YouTube·Vimeo 불가)`);
      if (block.type === "image" && block.hoverEffect === "swap" && !safeURL(block.hoverSrc, { imageData: true })) warnings.push(`${page.name} / ${block.name}: 호버 시 교체할 이미지(hoverSrc)가 비어 있음`);
      if (block.type === "audio" && block.playbackMode === "autoplay") warnings.push(`${page.name} / ${block.name}: 오디오 자동재생은 브라우저가 막을 수 있으므로 클릭 재생 권장`);
      if (["video", "audio"].includes(block.type) && !safeURL(block.media || block.src)) warnings.push(`${page.name} / ${block.name}: 미디어 파일 또는 링크 없음`);
      if (block.type === "video" && safeEmbedURL(block.media || block.src) && !["click", "controls", "link"].includes(block.playbackMode)) warnings.push(`${page.name} / ${block.name}: YouTube·Vimeo 영상은 이 재생 방식 대신 클릭 재생·기본 플레이어를 쓰거나 임베드 요소로 옮기세요`);
      if (["video", "audio"].includes(block.type) && block.playbackMode === "link" && action.type === "none") warnings.push(`${page.name} / ${block.name}: 링크 카드로 설정했지만 클릭 목적지가 없음`);
      if (["video", "audio"].includes(block.type) && block.playbackMode !== "link" && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 재생 모드에서는 클릭 동작이 사용되지 않음 · 링크 카드로 바꾸거나 목적지를 지우세요`);
      if (block.type === "gallery" && !block.galleryItems.some((item) => safeURL(item.src, { imageData: true }))) warnings.push(`${page.name} / ${block.name}: 갤러리 이미지 없음`);
      if (block.type === "embed" && !safeEmbedURL(block.src)) warnings.push(`${page.name} / ${block.name}: 허용되는 임베드 링크가 아님`);
      if (block.type === "embed" && block.embedMode === "link" && action.type === "none") warnings.push(`${page.name} / ${block.name}: 링크 카드로 설정했지만 클릭 목적지가 없음`);
      if (block.type === "embed" && block.embedMode !== "link" && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 조작·불러오기 모드에서는 클릭 동작이 사용되지 않음 · 링크 카드로 바꾸거나 목적지를 지우세요`);
      if (block.type === "nav" && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 페이지 메뉴의 클릭 동작은 사용되지 않음`);
      if (block.type === "nav" && block.navMode === "custom" && !block.navPageIds.length) warnings.push(`${page.name} / ${block.name}: 직접 선택 메뉴에 표시할 페이지가 없음`);
      if (block.type === "nav" && block.navMode === "custom" && block.navPageIds.some((id) => !data.pages.some((item) => item.id === id && item.visibility !== "draft"))) warnings.push(`${page.name} / ${block.name}: 직접 선택 메뉴에 사라졌거나 초안인 페이지가 포함됨`);
      if (block.publicDraggable && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 클릭 목적지와 방문자 드래그를 함께 쓸 수 없어 클릭이 우선됨`);
      if (block.publicDraggable && ["video", "audio", "embed"].includes(block.type)) warnings.push(`${page.name} / ${block.name}: 미디어 조작과 충돌해 방문자 드래그가 사용되지 않음`);
      if (block.publicDraggable && block.lightbox) warnings.push(`${page.name} / ${block.name}: 라이트박스와 방문자 드래그를 함께 쓸 수 없어 라이트박스가 우선됨`);
      if (block.lightbox && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 클릭 목적지와 라이트박스를 함께 켜서 클릭 목적지가 우선됨`);
      const timeline = block.motion.timeline;
      if (timeline.enabled) {
        const clickLike = ["click", "press"].includes(timeline.trigger);
        const interactiveMedia = ["video", "audio"].includes(block.type) && block.playbackMode !== "link" || block.type === "embed" && block.embedMode !== "link";
        if (clickLike && usesAction(block)) warnings.push(`${page.name} / ${block.name}: Motion Lab ${timeline.trigger} 모션과 페이지·링크 이동이 겹쳐 모션을 보기 전에 이동할 수 있음`);
        if (clickLike && block.type === "nav") warnings.push(`${page.name} / ${block.name}: 페이지 메뉴의 클릭과 Motion Lab ${timeline.trigger} 모션이 겹침 · 화면 진입이나 페이지 열림 트리거 권장`);
        if (clickLike && interactiveMedia) warnings.push(`${page.name} / ${block.name}: Motion Lab ${timeline.trigger} 모션이 미디어 조작과 겹침 · 화면 진입이나 페이지 열림 트리거 권장`);
        if (clickLike && block.lightbox) warnings.push(`${page.name} / ${block.name}: Motion Lab ${timeline.trigger} 모션과 크게 보기가 같은 클릭을 사용함`);
        if (clickLike && block.publicDraggable) warnings.push(`${page.name} / ${block.name}: Motion Lab ${timeline.trigger} 모션과 방문자 드래그가 같은 포인터를 사용함`);
        if (timeline.trigger === "hover" && interactiveMedia) warnings.push(`${page.name} / ${block.name}: 호버 모션과 미디어 컨트롤이 겹칠 수 있음 · 터치에서는 누르는 동안으로 자동 대체됨`);
        if (timeline.trigger === "scroll" && page.canvas.height < 1000) warnings.push(`${page.name} / ${block.name}: 스크롤 진행 모션에 비해 페이지 길이가 짧아 전체 구간이 빠르게 지나갈 수 있음`);
        if (timeline.keyframes.some((frame) => frame.blur > 40)) warnings.push(`${page.name} / ${block.name}: 큰 키프레임 블러는 저사양 기기에서 느릴 수 있음`);
        const flashes = timeline.keyframes.slice(1).filter((frame, index) => Math.abs(frame.opacity - timeline.keyframes[index].opacity) > .65 || Math.abs(frame.brightness - timeline.keyframes[index].brightness) > 1.5).length;
        if (flashes / Math.max(.1, timeline.duration / 1000) > 3) warnings.push(`${page.name} / ${block.name}: 초당 3회가 넘는 밝기·투명도 변화는 발작 위험이 있어 속도를 낮추거나 키프레임을 줄이세요`);
        if (timeline.keyframes.every((frame) => frame.x === 0 && frame.y === 0 && frame.scaleX === 1 && frame.scaleY === 1 && frame.rotate === 0 && frame.rotateX === 0 && frame.rotateY === 0 && frame.skewX === 0 && frame.skewY === 0 && frame.opacity === 1 && frame.blur === 0 && frame.brightness === 1 && frame.saturate === 1 && frame.hue === 0)) warnings.push(`${page.name} / ${block.name}: Motion Lab이 켜져 있지만 키프레임 변화가 없음`);
      }
      if (action.type === "page") {
        const target = data.pages.find((item) => item.id === action.pageId);
        if (!target) warnings.push(`${page.name} / ${block.name}: 사라진 페이지로 연결됨`);
        else if (target.visibility === "draft" && page.visibility !== "draft") warnings.push(`${page.name} / ${block.name}: 일반 공개 페이지에서 초안 페이지로 연결됨`);
        if (action.anchorId && target && !target.blocks.some((item) => (item.anchorId || item.id) === action.anchorId)) warnings.push(`${page.name} / ${block.name}: 이동할 페이지의 위치 ID를 찾을 수 없음`);
      }
      if (action.type === "anchor" && (!action.anchorId || !page.blocks.some((item) => (item.anchorId || item.id) === action.anchorId))) warnings.push(`${page.name} / ${block.name}: 페이지 위치 ID가 비었거나 존재하지 않음`);
      if (["external", "download"].includes(action.type) && !safeURL(action.url, { link: true })) warnings.push(`${page.name} / ${block.name}: 외부·다운로드 URL이 비었거나 잘못됨`);
      if (action.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(action.email)) warnings.push(`${page.name} / ${block.name}: 이메일 주소가 비었거나 잘못됨`);
      if (action.type === "phone" && action.phone.replace(/\D/g, "").length < 6) warnings.push(`${page.name} / ${block.name}: 전화번호가 비었거나 너무 짧음`);
    });
  });
  data.pages.forEach((page) => {
    const blocks = [...page.blocks, ...data.globals];
    const ids = new Set(blocks.map((block) => block.id));
    if (page.visibility !== "draft" && !isLayoutEnabled(page, "mobile")) warnings.push(`${page.name}: Mobile 배치가 없어 폰에서는 데스크톱을 작게 줄여 보여줌 · 위쪽 Mobile 버튼으로 만들 수 있어요`);
    ["tablet", "mobile"].forEach((layout) => {
      blocksOutsideLayout(page, blocks, layout).forEach((block) => warnings.push(`${page.name} / ${block.name}: ${LAYOUT_LABELS[layout]} 화면 밖으로 나가 있음`));
      if (!isLayoutEnabled(page, layout)) return;
      blocks.filter((block) => block.visible && ["text", "button", "nav"].includes(block.type)).forEach((block) => {
        const view = resolveBlock(block, layout);
        if (!view.hidden && view.fontSize < 12) warnings.push(`${page.name} / ${block.name}: ${LAYOUT_LABELS[layout]} 글자 크기 ${view.fontSize}px는 읽기 어려움`);
      });
    });
    blocks.filter((block) => block.visible).forEach((block) => {
      if (block.type === "component" && !block.component) warnings.push(`${page.name} / ${block.name}: 컴포넌트 종류를 고르지 않음`);
      if (block.type === "component" && block.component && !isRegisteredComponent(block.component)) warnings.push(`${page.name} / ${block.name}: components/registry.js에 없는 컴포넌트 “${block.component}”`);
      if (block.type === "code" && !`${block.code.html}${block.code.css}${block.code.js}`.trim()) warnings.push(`${page.name} / ${block.name}: 코드 블록이 비어 있음`);
      const timeline = block.motion.timeline;
      if (timeline.enabled && timeline.trigger === "linked" && !timeline.linkTarget) warnings.push(`${page.name} / ${block.name}: 연결 모션에 연결할 레이어가 없음`);
      if (timeline.enabled && timeline.trigger === "linked" && timeline.linkTarget && !ids.has(timeline.linkTarget)) warnings.push(`${page.name} / ${block.name}: 연결된 레이어가 이 페이지에 없음`);
      if (block.pinEnabled && !block.fixed && block.y + block.height + block.pinDistance > page.canvas.height) warnings.push(`${page.name} / ${block.name}: 스크롤 고정 거리가 페이지 끝을 넘어서 잘릴 수 있음`);
      if (block.fixed && block.y > page.canvas.viewport) warnings.push(`${page.name} / ${block.name}: 화면에 고정된 요소가 첫 화면 밖(${page.canvas.viewport}px 아래)에 있어 보이지 않음`);
    });
  });
  const hasContinuousMotion = data.pages.some((page) => page.blocks.some((block) => block.visible && (
    block.type === "marquee"
    || block.motion.loop.preset !== "none"
    || (block.motion.timeline.enabled && block.motion.timeline.infinite && block.motion.timeline.trigger !== "scroll")
    || (["video", "audio"].includes(block.type) && ["autoplay", "in-view"].includes(block.playbackMode))
    || (block.type === "gallery" && block.galleryMode === "slideshow" && block.galleryItems.length > 1)
    || (block.type === "image" && block.gifPlayback === "auto" && isGIFSource(block.media || block.src))
  )));
  if (hasContinuousMotion && !data.settings.showMotionToggle) warnings.push("계속 움직이는 요소가 있지만 방문자용 모션 정지 버튼이 꺼져 있음");
  // Studio 8 (C6·C7): SEO와 접근성 — 제목 구조, 대비, 글자 크기, 공유 이미지, 폼 주소, http 링크
  const luminance = (hex) => { const rgb = hexToRGB(hex); if (!rgb) return null; const [r, g, b] = rgb.map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrastRatio = (a, b) => { const la = luminance(a); const lb = luminance(b); if (la == null || lb == null) return null; return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  data.pages.filter((page) => page.visibility !== "draft").forEach((page) => {
    const headings = page.blocks.filter((block) => block.type === "text" && block.visible && /^h[1-6]$/.test(block.htmlTag));
    const h1s = headings.filter((block) => block.htmlTag === "h1");
    if (!h1s.length && page.blocks.some((block) => block.type === "text" && block.visible)) warnings.push(`${page.name}: 대제목(h1)이 없어요 · 가장 큰 제목의 ‘HTML 의미’를 h1으로 바꾸세요`);
    if (h1s.length > 1) warnings.push(`${page.name}: 대제목(h1)이 ${h1s.length}개예요 · 하나만 남기세요`);
    const levels = headings.slice().sort((a, b) => a.y - b.y).map((block) => Number(block.htmlTag[1]));
    for (let index = 1; index < levels.length; index += 1) { if (levels[index] - levels[index - 1] > 1) { warnings.push(`${page.name}: 제목 단계가 h${levels[index - 1]}에서 h${levels[index]}로 건너뛰어요`); break; } }
    if (!page.seo.description.trim()) warnings.push(`${page.name}: 검색 설명(SEO)이 비어 있어요`);
    if (page.id === data.settings.defaultPageId && !page.seo.image.trim() && !data.settings.seo.image) warnings.push(`${page.name}: 공유 이미지(og:image)가 없어요 · 링크 미리보기에 그림이 안 나와요`);
    page.blocks.filter((block) => block.visible).forEach((block) => {
      if (["text", "button"].includes(block.type)) {
        const mobile = block.responsive?.mobile?.fontSize;
        if (block.fontSize < 12 || (mobile != null && mobile < 12)) warnings.push(`${page.name} / ${block.name}: 글자가 12px보다 작아요 (읽기 어려움)`);
        const behind = block.background !== "transparent" ? block.background : page.canvas.background;
        const ratio = contrastRatio(block.color, behind);
        if (ratio != null && ratio < 3) warnings.push(`${page.name} / ${block.name}: 글자색과 배경 대비가 낮아요 (${ratio.toFixed(1)}:1 · 권장 4.5:1)`);
      }
      if (block.type === "button" && !block.content.trim() && !block.ariaLabel.trim()) warnings.push(`${page.name} / ${block.name}: 버튼에 글자나 접근성 이름이 없어요`);
      if (block.type === "form" && !safeURL(block.formEndpoint, { link: true })) warnings.push(`${page.name} / ${block.name}: 폼의 받을 주소(엔드포인트)가 없어요 · 보내기가 안 돼요`);
      if (block.action.type === "external" && /^http:\/\//i.test(block.action.url)) warnings.push(`${page.name} / ${block.name}: http:// 링크예요 · https로 바꾸는 게 안전해요`);
      if (block.hoverEffect === "swap" && !block.hoverSrc.trim()) warnings.push(`${page.name} / ${block.name}: 호버 교체 이미지가 비어 있어요`);
      if (block.maskPreset === "image" && !block.maskImage.trim()) warnings.push(`${page.name} / ${block.name}: 마스크 이미지가 비어 있어서 요소가 안 보일 수 있어요`);
    });
  });
  if (!data.settings.siteURL) warnings.push("사이트 설정에 공개 주소가 없어요 · sitemap.xml을 만들 때 필요해요");
  return warnings;
}

export function bindArchiveViewer(source, pageOrId = "") {
  const data = normalizeArchiveData(source);
  const page = typeof pageOrId === "object" ? pageOrId : data.pages.find((item) => item.id === pageOrId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
  const canvas = document.querySelector("[data-archive-canvas]");
  const sizer = document.querySelector("[data-archive-sizer]");
  if (!canvas || !sizer) return;
  const fixedInner = document.querySelector("[data-archive-fixed] .archive-fixed-layer__inner");
  const roots = [canvas, fixedInner].filter(Boolean);
  const qa = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]);
  const cleanups = [];
  const layoutListeners = new Set();
  let paused = false;
  let scale = 1;
  let layout = currentLayout(page, data.settings);

  // Studio 8 (C4): 폼 — fetch로 보내고 결과를 같은 자리에 표시 (JSON 응답을 주는 폼 서비스 엔드포인트)
  qa("[data-archive-form]").forEach((form) => {
    const submit = async (event) => {
      event.preventDefault();
      const statusNode = form.querySelector(".canvas-form__status");
      const say = (text, kind = "") => { if (!statusNode) return; statusNode.hidden = false; statusNode.textContent = text; statusNode.dataset.kind = kind; };
      const endpoint = form.getAttribute("action") || "";
      if (!/^https?:\/\//i.test(endpoint)) { say("받을 주소가 아직 설정되지 않았어요.", "error"); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      say("보내는 중…");
      try {
        const response = await fetch(endpoint, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(String(response.status));
        say(form.dataset.success || "보냈어요.", "ok"); form.reset();
      } catch (error) { say("보내지 못했어요. 잠시 후 다시 시도하거나 이메일로 보내주세요.", "error"); }
      if (button) button.disabled = false;
    };
    form.addEventListener("submit", submit);
    cleanups.push(() => form.removeEventListener("submit", submit));
  });

  // Studio 8 (C5): 방문자 다크 모드 — 페이지 배경과 글자색만 바꾼다. 선택은 localStorage에 기억.
  if (data.settings.theme.toggle) {
    const root = document.documentElement;
    root.style.setProperty("--archive-dark-bg", data.settings.theme.darkBackground);
    root.style.setProperty("--archive-dark-text", data.settings.theme.darkText);
    root.classList.toggle("archive-dark-dim-media", data.settings.theme.dimMedia);
    let stored = ""; try { stored = localStorage.getItem("psj-archive-theme") || ""; } catch (error) { stored = ""; }
    const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    const applyTheme = (dark) => { root.classList.toggle("archive-dark", dark); button.textContent = dark ? "☀" : "☾"; button.setAttribute("aria-pressed", String(dark)); button.title = dark ? "밝은 화면으로" : "어두운 화면으로"; };
    const button = document.createElement("button");
    button.className = "archive-theme-toggle"; button.type = "button"; button.setAttribute("aria-label", "다크 모드 전환");
    document.body.append(button);
    applyTheme(stored ? stored === "dark" : prefersDark);
    const toggle = () => { const dark = !root.classList.contains("archive-dark"); applyTheme(dark); try { localStorage.setItem("psj-archive-theme", dark ? "dark" : "light"); } catch (error) { /* ignore */ } };
    button.addEventListener("click", toggle);
    cleanups.push(() => { button.remove(); });
  }

  // The artboard for the current screen (desktop/tablet/mobile) is chosen by media-query CSS;
  // here it is scaled to the window width (or never enlarged with scaleMode "max-100").
  const resize = () => {
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const width = canvas.offsetWidth || page.canvas.width;
    const height = canvas.offsetHeight || page.canvas.height;
    scale = data.settings.scaleMode === "max-100" ? Math.min(1, viewportWidth / width) : viewportWidth / width;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.setProperty("--archive-control-scale", String(1 / Math.max(scale, 0.1)));
    canvas.classList.toggle("archive-canvas--compact-controls", scale < 0.65);
    sizer.style.width = `${width * scale}px`;
    sizer.style.height = `${height * scale}px`;
    document.documentElement.style.setProperty("--archive-scale", String(scale));
    if (fixedInner) {
      fixedInner.style.transform = `scale(${scale})`;
      fixedInner.style.height = `${innerHeight / scale}px`;
      fixedInner.style.left = `${Math.max(0, (viewportWidth - width * scale) / 2)}px`;
      fixedInner.style.setProperty("--archive-control-scale", String(1 / Math.max(scale, 0.1)));
    }
    const nextLayout = currentLayout(page, data.settings);
    if (nextLayout !== layout) {
      layout = nextLayout;
      layoutListeners.forEach((listener) => listener(layout));
    }
  };
  resize();
  addEventListener("resize", resize);
  cleanups.push(() => removeEventListener("resize", resize));
  if (document.fonts?.ready) document.fonts.ready.then(resize).catch(() => {});

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealNodes = qa("[data-entrance]");
  const reveal = (node) => node.classList.add("is-motion-visible");
  if (reduced) revealNodes.forEach(reveal);
  else {
    revealNodes.filter((node) => node.dataset.trigger !== "scroll").forEach((node, index) => setTimeout(() => reveal(node), 20 + index * 8));
    const scrollNodes = revealNodes.filter((node) => node.dataset.trigger === "scroll");
    if (scrollNodes.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target);
        else if (entry.target.dataset.once === "false") entry.target.classList.remove("is-motion-visible");
      }), { threshold: 0.08, rootMargin: "0px 0px -8%" });
      scrollNodes.forEach((node) => observer.observe(node));
      cleanups.push(() => observer.disconnect());
    } else scrollNodes.forEach(reveal);
  }

  const motionLabControllers = [];
  const scrollMotionControllers = [];
  let motionLabScrollFrame = 0;
  const playFromStart = (controller) => {
    if (paused || !controller.animation) return false;
    try { controller.animation.cancel(); controller.animation.play(); controller.played = true; return true; }
    catch (error) { console.warn("Motion Lab animation could not play.", error); return false; }
  };
  const stopToBase = (controller) => {
    if (!controller.animation) return;
    controller.wasRunning = false;
    controller.offscreenRunning = false;
    try { controller.animation.cancel(); } catch (error) { console.warn("Motion Lab animation could not reset.", error); }
  };
  const scrollTarget = (controller) => {
    const clampProgress = (value) => Math.min(1, Math.max(0, value));
    if (controller.timeline.scrollRange === "page") return clampProgress(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    const rect = controller.node.getBoundingClientRect();
    if (controller.timeline.scrollRange === "enter") {
      const start = innerHeight;
      const end = innerHeight * .5 - rect.height / 2;
      return clampProgress((start - rect.top) / Math.max(1, start - end));
    }
    const start = innerHeight * .9;
    const end = innerHeight * .1 - rect.height;
    return clampProgress((start - rect.top) / Math.max(1, start - end));
  };
  // Scroll-linked tracks. scrubSmooth > 0 lets the motion glide after the scroll instead of snapping to it.
  const updateMotionLabScroll = () => {
    motionLabScrollFrame = 0;
    if (paused || reduced) return;
    let settling = false;
    scrollMotionControllers.forEach((controller) => {
      const target = scrollTarget(controller);
      const smooth = controller.scrollReady ? controller.timeline.scrubSmooth : 0;
      controller.scrollReady = true;
      controller.progress = smooth ? controller.progress + (target - controller.progress) * (1 - smooth) : target;
      if (Math.abs(target - controller.progress) > 0.0005) settling = true;
      else controller.progress = target;
      controller.animation.currentTime = controller.progress * controller.timeline.duration;
    });
    if (settling) motionLabScrollFrame = requestAnimationFrame(updateMotionLabScroll);
  };
  const scheduleMotionLabScroll = () => {
    if (!motionLabScrollFrame) motionLabScrollFrame = requestAnimationFrame(updateMotionLabScroll);
  };

  // 다른 레이어와 연결: a track that plays when another layer is clicked, hovered, pressed or seen.
  // Toggle mode plays forward to open and backward to close — enough for menus, drawers and captions.
  const setMotionClosed = (controller, closed) => {
    const hides = controller.timeline.linkMode === "toggle" && controller.timeline.keyframes[0]?.opacity === 0;
    if (closed && hides) controller.node.dataset.motionClosed = "true";
    else delete controller.node.dataset.motionClosed;
  };
  const runLinked = (controller, open) => {
    if (paused) return;
    if (controller.timeline.linkMode === "restart") { if (open) playFromStart(controller); return; }
    if (open === controller.open) return;
    controller.open = open;
    if (open) setMotionClosed(controller, false);
    try {
      controller.animation.playbackRate = open ? 1 : -1;
      controller.animation.play();
      controller.animation.finished.then(() => { if (!controller.open) setMotionClosed(controller, true); }).catch(() => {});
    } catch (error) { console.warn("Linked motion could not play.", error); }
  };
  function bindLinkedMotion() {
    const bySource = new Map();
    linkedControllers.forEach((controller) => {
      setMotionClosed(controller, true);
      const id = controller.timeline.linkTarget;
      if (!id) return;
      if (!bySource.has(id)) bySource.set(id, []);
      bySource.get(id).push(controller);
    });
    const coarse = matchMedia("(pointer: coarse)").matches;
    bySource.forEach((controllers, sourceId) => {
      const source = qa(`[data-block-id="${CSS.escape(sourceId)}"]`)[0];
      if (!source) return;
      source.dataset.motionSource = "";
      const group = (event) => controllers.filter((controller) => controller.timeline.linkEvent === event || (coarse && event === "click" && controller.timeline.linkEvent === "hover"));
      const clickers = group("click");
      if (clickers.length) {
        const plainBlock = !source.querySelector("a,button,iframe,video,audio");
        if (plainBlock) { source.setAttribute("role", "button"); source.tabIndex = 0; }
        source.setAttribute("aria-expanded", "false");
        const toggle = (event) => {
          if (event?.target?.closest?.("iframe,video,audio")) return;
          const opening = !clickers.some((controller) => controller.open);
          clickers.forEach((controller) => runLinked(controller, controller.timeline.linkMode === "restart" ? true : opening));
          source.setAttribute("aria-expanded", String(opening));
        };
        const keydown = (event) => { if (plainBlock && ["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); } };
        source.addEventListener("click", toggle);
        source.addEventListener("keydown", keydown);
        cleanups.push(() => { source.removeEventListener("click", toggle); source.removeEventListener("keydown", keydown); });
      }
      const hovers = coarse ? [] : group("hover");
      if (hovers.length) {
        const enter = () => hovers.forEach((controller) => runLinked(controller, true));
        const leave = () => hovers.forEach((controller) => runLinked(controller, false));
        source.addEventListener("pointerenter", enter); source.addEventListener("pointerleave", leave);
        source.addEventListener("focusin", enter); source.addEventListener("focusout", leave);
        cleanups.push(() => { source.removeEventListener("pointerenter", enter); source.removeEventListener("pointerleave", leave); source.removeEventListener("focusin", enter); source.removeEventListener("focusout", leave); });
      }
      const pressers = group("press");
      if (pressers.length) {
        const down = () => pressers.forEach((controller) => runLinked(controller, true));
        const up = () => pressers.forEach((controller) => runLinked(controller, false));
        source.addEventListener("pointerdown", down); addEventListener("pointerup", up); addEventListener("pointercancel", up);
        cleanups.push(() => { source.removeEventListener("pointerdown", down); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); });
      }
      const watchers = group("in-view");
      if (watchers.length && "IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => watchers.forEach((controller) => {
          if (entry.isIntersecting) runLinked(controller, true);
          else if (controller.timeline.linkMode === "toggle" && !controller.timeline.once) runLinked(controller, false);
        })), { threshold: .2 });
        observer.observe(source);
        cleanups.push(() => observer.disconnect());
      }
    });
    if (linkedControllers.some((controller) => controller.timeline.linkMode === "toggle")) {
      const escape = (event) => {
        if (event.key !== "Escape") return;
        linkedControllers.filter((controller) => controller.open && ["click", "hover"].includes(controller.timeline.linkEvent)).forEach((controller) => runLinked(controller, false));
        qa("[data-motion-source][aria-expanded='true']").forEach((source) => source.setAttribute("aria-expanded", "false"));
      };
      addEventListener("keydown", escape);
      cleanups.push(() => removeEventListener("keydown", escape));
    }
  }

  const linkedControllers = [];
  if (!reduced && typeof Element !== "undefined" && Element.prototype.animate) {
    qa("[data-motion-lab]").forEach((node) => {
      let timeline;
      try { timeline = normalizeMotionTimeline(JSON.parse(node.dataset.motionLab || "{}")); }
      catch (error) { console.warn("Motion Lab data could not be read.", error); return; }
      if (!timeline.enabled || timeline.keyframes.length < 2) return;
      const target = node.querySelector(".canvas-block__timeline");
      if (!target) return;
      const scrub = timeline.trigger === "scroll";
      let animation;
      try {
        animation = target.animate(motionLabKeyframes(timeline), motionLabTiming(timeline, { scrub }));
        animation.pause();
        if (["hover", "press", "click"].includes(timeline.trigger)) animation.cancel();
      } catch (error) { console.warn("Motion Lab animation could not be created.", error); return; }
      const controller = { node, target, timeline, animation, played: false, active: false, inViewport: true, wasRunning: false, offscreenRunning: false, progress: 0 };
      motionLabControllers.push(controller);
      cleanups.push(() => animation.cancel());

      if (timeline.trigger === "load" && timeline.infinite && "IntersectionObserver" in window) {
        animation.play(); controller.played = true;
        const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
          controller.active = entry.isIntersecting;
          controller.inViewport = entry.isIntersecting;
          if (entry.isIntersecting) {
            if (!paused && (!controller.played || controller.offscreenRunning || controller.wasRunning || animation.playState === "paused")) {
              animation.play(); controller.played = true; controller.offscreenRunning = false; controller.wasRunning = false;
            }
          } else {
            controller.offscreenRunning ||= controller.wasRunning || ["running", "pending"].includes(animation.playState);
            if (["running", "pending"].includes(animation.playState)) animation.pause();
          }
        }), { threshold: .01, rootMargin: "10% 0px" });
        observer.observe(node);
        cleanups.push(() => observer.disconnect());
      } else if (timeline.trigger === "load") { animation.play(); controller.played = true; }
      else if (timeline.trigger === "in-view") {
        if ("IntersectionObserver" in window) {
          const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            controller.active = entry.isIntersecting;
            controller.inViewport = entry.isIntersecting;
            if (entry.isIntersecting) {
              if (timeline.infinite) {
                if (!paused && (controller.offscreenRunning || !controller.played || animation.playState === "paused")) {
                  if (!controller.played) playFromStart(controller);
                  else animation.play();
                  controller.offscreenRunning = false;
                }
              } else if (!timeline.once || !controller.played) {
                const started = playFromStart(controller);
                if (timeline.once && started) observer.unobserve(node);
              }
            } else if (timeline.infinite) {
              controller.offscreenRunning ||= controller.wasRunning || ["running", "pending"].includes(animation.playState);
              if (["running", "pending"].includes(animation.playState)) animation.pause();
            } else if (!timeline.once) stopToBase(controller);
          }), { threshold: .12, rootMargin: "0px 0px -6%" });
          observer.observe(node);
          cleanups.push(() => observer.disconnect());
        } else playFromStart(controller);
      } else if (timeline.trigger === "hover") {
        let activePointer = null;
        const enter = (event) => {
          if (event?.pointerId != null) { activePointer = event.pointerId; node.setPointerCapture?.(event.pointerId); }
          controller.active = true; playFromStart(controller);
        };
        const leave = (event) => {
          if (activePointer != null && event?.pointerId != null && event.pointerId !== activePointer) return;
          if (activePointer != null) node.releasePointerCapture?.(activePointer);
          activePointer = null; controller.active = false; stopToBase(controller);
        };
        const coarse = matchMedia("(pointer: coarse)").matches;
        if (coarse) {
          node.addEventListener("pointerdown", enter); addEventListener("pointerup", leave); addEventListener("pointercancel", leave);
          cleanups.push(() => { node.removeEventListener("pointerdown", enter); removeEventListener("pointerup", leave); removeEventListener("pointercancel", leave); });
        } else {
          node.addEventListener("pointerenter", enter); node.addEventListener("pointerleave", leave);
          node.addEventListener("focusin", enter); node.addEventListener("focusout", leave);
          cleanups.push(() => { node.removeEventListener("pointerenter", enter); node.removeEventListener("pointerleave", leave); node.removeEventListener("focusin", enter); node.removeEventListener("focusout", leave); });
        }
      } else if (timeline.trigger === "press") {
        let activePointer = null;
        const down = (event) => {
          if (event?.pointerId != null) { activePointer = event.pointerId; node.setPointerCapture?.(event.pointerId); }
          controller.active = true; playFromStart(controller);
        };
        const up = (event) => {
          if (activePointer != null && event?.pointerId != null && event.pointerId !== activePointer) return;
          if (activePointer != null) node.releasePointerCapture?.(activePointer);
          activePointer = null; controller.active = false; stopToBase(controller);
        };
        const isNestedControl = (event) => event.target !== node && Boolean(event.target.closest?.("a,button,input,select,textarea,video,audio,iframe"));
        const keydown = (event) => { if (!isNestedControl(event) && ["Enter", " "].includes(event.key)) { event.preventDefault(); down(); } };
        const keyup = (event) => { if (!isNestedControl(event) && ["Enter", " "].includes(event.key)) up(); };
        node.addEventListener("pointerdown", down); addEventListener("pointerup", up); addEventListener("pointercancel", up); node.addEventListener("keydown", keydown); node.addEventListener("keyup", keyup);
        cleanups.push(() => { node.removeEventListener("pointerdown", down); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); node.removeEventListener("keydown", keydown); node.removeEventListener("keyup", keyup); });
      } else if (timeline.trigger === "click") {
        const click = () => playFromStart(controller);
        const keydown = (event) => {
          const nestedControl = event.target !== node && event.target.closest?.("a,button,input,select,textarea,video,audio,iframe");
          if (!nestedControl && ["Enter", " "].includes(event.key)) { event.preventDefault(); playFromStart(controller); }
        };
        node.addEventListener("click", click);
        node.addEventListener("keydown", keydown);
        cleanups.push(() => { node.removeEventListener("click", click); node.removeEventListener("keydown", keydown); });
        if (timeline.infinite && "IntersectionObserver" in window) {
          const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
            controller.inViewport = entry.isIntersecting;
            if (!entry.isIntersecting) {
              controller.offscreenRunning ||= controller.wasRunning || ["running", "pending"].includes(animation.playState);
              if (["running", "pending"].includes(animation.playState)) animation.pause();
            } else if (!paused && controller.offscreenRunning) {
              animation.play(); controller.offscreenRunning = false; controller.wasRunning = false;
            }
          }), { threshold: .01, rootMargin: "10% 0px" });
          observer.observe(node);
          cleanups.push(() => observer.disconnect());
        }
      } else if (timeline.trigger === "scroll") scrollMotionControllers.push(controller);
      else if (timeline.trigger === "linked") {
        controller.open = false;
        linkedControllers.push(controller);
      }
    });
    bindLinkedMotion();
    if (scrollMotionControllers.length) {
      addEventListener("scroll", scheduleMotionLabScroll, { passive: true });
      addEventListener("resize", scheduleMotionLabScroll, { passive: true });
      updateMotionLabScroll();
      cleanups.push(() => { removeEventListener("scroll", scheduleMotionLabScroll); removeEventListener("resize", scheduleMotionLabScroll); if (motionLabScrollFrame) cancelAnimationFrame(motionLabScrollFrame); });
    }
  }

  const pauseMotionLab = () => motionLabControllers.forEach((controller) => {
    controller.wasRunning = controller.animation.playState === "running";
    if (["running", "pending"].includes(controller.animation.playState)) controller.animation.pause();
  });
  const resumeMotionLab = () => {
    motionLabControllers.forEach((controller) => {
      const trigger = controller.timeline.trigger;
      if (trigger === "scroll") return;
      if (["in-view", "hover", "press"].includes(trigger)) {
        if (controller.active) {
          if (!controller.played) playFromStart(controller);
          else controller.animation.play();
        }
      } else if (controller.wasRunning && (!controller.timeline.infinite || controller.inViewport)) controller.animation.play();
      controller.wasRunning = false;
    });
    updateMotionLabScroll();
  };

  qa("[data-archive-back]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); history.back(); }));

  qa("[data-embed-shell]").forEach((shell) => {
    const initial = shell.innerHTML;
    const activate = () => {
      const src = safeURL(shell.dataset.embedSrc);
      if (!src || shell.querySelector("iframe")) return;
      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = shell.dataset.embedTitle || "Embedded media";
      iframe.loading = "lazy";
      iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      shell.replaceChildren(iframe);
    };
    const bindButton = () => {
      const button = shell.querySelector("[data-media-play]");
      if (button && !button.dataset.bound) { button.dataset.bound = "true"; button.addEventListener("click", activate); }
    };
    const reset = () => { shell.innerHTML = initial; bindButton(); };
    bindButton();
    shell._archivePauseEmbed = reset;
  });

  qa("[data-native-media]").forEach((shell) => {
    const media = shell.querySelector("[data-media-element]");
    const button = shell.querySelector("[data-media-play]");
    const mode = shell.dataset.mediaMode;
    if (!media) return;
    const setButton = (playing) => {
      if (!button) return;
      button.hidden = false;
      button.classList.toggle("is-playing", playing);
      button.setAttribute("aria-label", playing ? "Pause" : "Play");
      const strong = button.querySelector("strong");
      if (strong) strong.textContent = playing ? "Pause" : "Play";
    };
    const play = () => media.play().then(() => setButton(true)).catch(() => setButton(false));
    const pause = () => { media.pause(); setButton(false); };
    const toggle = () => media.paused ? play() : pause();
    shell._archivePlay = play;
    shell._archivePause = pause;
    if (button) { button.addEventListener("click", toggle); cleanups.push(() => button.removeEventListener("click", toggle)); }
    media.addEventListener("play", () => setButton(true));
    media.addEventListener("pause", () => setButton(false));
    media.addEventListener("ended", () => { if (!media.loop) setButton(false); });
    // Studio 7 (A12): 구간 반복(시작·끝 초), 재생 속도, 호버 스크럽
    const rangeStart = number(shell.dataset.mediaStart, 0, 0);
    const rangeEnd = number(shell.dataset.mediaEnd, 0, 0);
    const rate = number(shell.dataset.mediaRate, 1, 0.1, 4);
    const rangeLoop = shell.dataset.mediaLoop === "true";
    const applyRange = () => { if (rate !== 1) media.playbackRate = rate; if (rangeStart > 0 && media.currentTime < rangeStart) { try { media.currentTime = rangeStart; } catch (error) { /* not seekable yet */ } } };
    media.addEventListener("loadedmetadata", applyRange);
    if (media.readyState >= 1) applyRange();
    if (rangeEnd > rangeStart || rangeLoop) {
      media.addEventListener("timeupdate", () => {
        if (rangeEnd > rangeStart && media.currentTime >= rangeEnd && mode !== "scrub") {
          media.currentTime = rangeStart;
          if (!rangeLoop) pause();
        }
      });
      if (rangeLoop) media.addEventListener("ended", () => { media.currentTime = rangeStart; play(); });
    }
    if (mode === "scrub") {
      // 마우스(또는 손가락) X 위치 → 영상 시간. 재생은 하지 않는다.
      const scrub = (event) => {
        if (paused) return;
        const rect = shell.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
        const end = rangeEnd > rangeStart ? rangeEnd : media.duration || 0;
        if (!end) return;
        try { media.currentTime = rangeStart + ratio * (end - rangeStart); } catch (error) { /* not seekable yet */ }
        shell.classList.add("is-scrubbed");
      };
      shell.addEventListener("pointermove", scrub);
      cleanups.push(() => shell.removeEventListener("pointermove", scrub));
      media.addEventListener("loadedmetadata", () => { media.pause(); }, { once: true });
    }
    if (mode === "autoplay") play();
    if (mode === "hover") {
      const enter = () => { if (!paused) play(); }; const leave = () => pause();
      shell.addEventListener("pointerenter", enter); shell.addEventListener("pointerleave", leave);
      cleanups.push(() => { shell.removeEventListener("pointerenter", enter); shell.removeEventListener("pointerleave", leave); });
    }
    const observeVisibility = mode === "in-view" || (mode === "autoplay" && shell.dataset.pauseHidden === "true");
    if (observeVisibility && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        shell.dataset.inView = entry.isIntersecting ? "true" : "false";
        if (entry.isIntersecting && !paused) play();
        else if (shell.dataset.pauseHidden === "true") pause();
      }), { threshold: 0.45 });
      observer.observe(shell); cleanups.push(() => observer.disconnect());
    } else if (mode === "in-view") setButton(false);
  });

  qa("[data-gif-shell]").forEach((shell) => {
    const initial = shell.innerHTML;
    const mode = shell.dataset.gifMode;
    const activate = () => {
      if (shell.querySelector("[data-active-gif]")) return;
      const src = safeURL(shell.dataset.gifSrc, { imageData: true });
      if (!src) return;
      const image = document.createElement("img");
      image.dataset.activeGif = "true";
      image.src = src;
      image.alt = shell.dataset.gifAlt || "";
      image.style.objectFit = shell.dataset.gifFit || "cover";
      shell.replaceChildren(image);
    };
    const deactivate = () => { shell.innerHTML = initial; bindClick(); };
    const bindClick = () => {
      const button = shell.querySelector("[data-media-play]");
      if (button && !button.dataset.bound) { button.dataset.bound = "true"; button.addEventListener("click", activate); }
    };
    bindClick();
    if (mode === "auto" && !reduced) activate();
    if (mode === "hover") {
      const enter = () => { if (!paused) activate(); }; const leave = () => deactivate();
      shell.addEventListener("pointerenter", enter); shell.addEventListener("pointerleave", leave);
      cleanups.push(() => { shell.removeEventListener("pointerenter", enter); shell.removeEventListener("pointerleave", leave); });
    }
    shell._archivePauseGIF = deactivate;
    shell._archiveResumeGIF = () => { if (mode === "auto" && !reduced) activate(); };
  });

  qa("[data-gallery]").forEach((gallery) => {
    if (!gallery.classList.contains("canvas-gallery--slideshow")) return;
    const items = [...gallery.querySelectorAll("[data-gallery-item]")];
    if (items.length < 2 || reduced) return;
    let index = 0;
    const timer = setInterval(() => {
      if (paused) return;
      items[index].classList.remove("is-active");
      index = (index + 1) % items.length;
      items[index].classList.add("is-active");
    }, number(gallery.dataset.interval, 3500, 800, 30000));
    cleanups.push(() => clearInterval(timer));
  });

  const openLightbox = (src, alt) => {
    const dialog = document.createElement("dialog");
    dialog.className = "archive-lightbox";
    dialog.innerHTML = `<button type="button" aria-label="닫기">×</button><img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}">`;
    document.body.append(dialog);
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
    cleanups.push(() => { if (dialog.open) dialog.close(); dialog.remove(); });
  };
  qa("[data-lightbox]").forEach((block) => block.addEventListener("click", (event) => {
    if (event.target.closest("a,[data-media-play]")) return;
    const image = event.target.closest("img") || event.target.closest("figure")?.querySelector("img") || block.querySelector("img");
    const src = image?.currentSrc || image?.src || block.dataset.lightboxSrc;
    if (src) openLightbox(src, image?.alt || "");
  }));

  qa('[data-text-effect="typewriter"],[data-text-effect="scramble"]').forEach((node) => {
    if (reduced) return;
    const original = node.textContent;
    if (node.dataset.textEffect === "typewriter") {
      node.textContent = "";
      let index = 0;
      const timer = setInterval(() => {
        if (paused) return;
        node.textContent = original.slice(0, ++index);
        if (index >= original.length) clearInterval(timer);
      }, 38);
      cleanups.push(() => clearInterval(timer));
    } else {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789✦△○";
      let frame = 0;
      const timer = setInterval(() => {
        if (paused) return;
        frame += 1;
        node.textContent = [...original].map((char, index) => char === " " || index < frame / 2 ? char : chars[Math.floor(Math.random() * chars.length)]).join("");
        if (frame / 2 >= original.length) { node.textContent = original; clearInterval(timer); }
      }, 42);
      cleanups.push(() => clearInterval(timer));
    }
  });

  const motionBlocks = qa("[data-parallax], [data-mouse-parallax]").filter((node) => !node.hasAttribute("data-fixed"));
  const updateParallax = (event) => {
    if (paused) return;
    const scrollCenter = scrollY + innerHeight / 2;
    const mx = event?.clientX == null ? 0 : event.clientX / innerWidth - 0.5;
    const my = event?.clientY == null ? 0 : event.clientY / innerHeight - 0.5;
    motionBlocks.forEach((node) => {
      const rect = node.getBoundingClientRect();
      const scrollAmount = number(node.dataset.parallax) * (scrollCenter - (rect.top + scrollY + rect.height / 2)) * 0.08;
      const mouseAmount = number(node.dataset.mouseParallax) * 28;
      node.style.setProperty("--parallax-x", `${mx * mouseAmount}px`);
      node.style.setProperty("--parallax-y", `${scrollAmount + my * mouseAmount}px`);
    });
  };
  if (!reduced && motionBlocks.some((node) => number(node.dataset.parallax) || number(node.dataset.mouseParallax))) {
    addEventListener("scroll", updateParallax, { passive: true });
    addEventListener("pointermove", updateParallax, { passive: true });
    updateParallax();
    cleanups.push(() => { removeEventListener("scroll", updateParallax); removeEventListener("pointermove", updateParallax); });
  }

  qa("[data-public-draggable]").forEach((node) => {
    let drag = null;
    let offsetX = 0;
    let offsetY = 0;
    const down = (event) => {
      if (event.target.closest("a,button,input,video,audio")) return;
      drag = { lastX: event.clientX, lastY: event.clientY, pointerId: event.pointerId };
      node.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const scale = Math.max(.01, canvas.getBoundingClientRect().width / Math.max(1, canvas.offsetWidth));
      offsetX += (event.clientX - drag.lastX) / scale; offsetY += (event.clientY - drag.lastY) / scale; drag.lastX = event.clientX; drag.lastY = event.clientY;
      node.style.setProperty("--visitor-drag-x", `${offsetX}px`);
      node.style.setProperty("--visitor-drag-y", `${offsetY}px`);
    };
    const up = () => { drag = null; };
    const preventNativeDrag = (event) => event.preventDefault();
    node.addEventListener("pointerdown", down); node.addEventListener("pointermove", move); node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
    node.addEventListener("dragstart", preventNativeDrag);
    cleanups.push(() => { node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up); node.removeEventListener("dragstart", preventNativeDrag); });
  });

  const progress = document.querySelector("[data-scroll-progress]");
  if (progress) {
    const update = () => progress.style.transform = `scaleX(${Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight))})`;
    update(); addEventListener("scroll", update, { passive: true }); cleanups.push(() => removeEventListener("scroll", update));
  }

  const componentHost = mountComponents(roots, { isPaused: () => paused, getLayout: () => layout });
  cleanups.push(() => componentHost.destroy());
  const codeHost = bindCodeBlocks(roots, { isPaused: () => paused, getLayout: () => layout });
  cleanups.push(() => codeHost.destroy());
  layoutListeners.add((next) => codeHost.setLayout?.(next));
  cleanups.push(bindSplitText(qa('[data-text-effect="letters"],[data-text-effect="words"]'), { reduced }));
  cleanups.push(bindMagnetic(qa('[data-hover="magnetic"]'), { reduced, isPaused: () => paused }));
  cleanups.push(bindPins(qa("[data-pin]"), { canvas, getScale: () => scale, isPaused: () => paused }));
  cleanups.push(bindSmoothScroll(data.settings, { reduced }));
  cleanups.push(bindCustomCursor(data.settings));

  const motionToggle = document.querySelector("[data-motion-toggle]");
  if (motionToggle) {
    const toggle = () => {
      paused = !paused;
      document.documentElement.classList.toggle("archive-motion-paused", paused);
      motionToggle.textContent = paused ? "Play motion" : "Pause motion";
      codeHost.setPaused(paused);
      componentHost.setPaused(paused);
      qa("[data-native-media]").forEach((shell) => {
        const media = shell.querySelector("[data-media-element]");
        if (!media) return;
        if (paused) shell._archivePause?.();
        else if (shell.dataset.mediaMode === "autoplay" && (shell.dataset.pauseHidden !== "true" || shell.dataset.inView !== "false")) shell._archivePlay?.();
        else if (shell.dataset.mediaMode === "in-view" && shell.dataset.inView === "true") shell._archivePlay?.();
      });
      qa("[data-gif-shell]").forEach((shell) => paused ? shell._archivePauseGIF?.() : shell._archiveResumeGIF?.());
      qa("[data-canvas-bg-video]").forEach((video) => { if (paused) video.pause(); else video.play().catch(() => {}); }); // Studio 7 (C2)
      if (paused) qa("[data-embed-shell]").forEach((shell) => shell._archivePauseEmbed?.());
      if (paused) motionBlocks.forEach((node) => { node.style.setProperty("--parallax-x", "0px"); node.style.setProperty("--parallax-y", "0px"); });
      if (paused) pauseMotionLab();
      else { updateParallax(); resumeMotionLab(); }
    };
    motionToggle.addEventListener("click", toggle); cleanups.push(() => motionToggle.removeEventListener("click", toggle));
  }

  return () => {
    qa("[data-media-element]").forEach((media) => {
      media.pause?.();
      media.removeAttribute("src");
      media.load?.();
    });
    qa("iframe").forEach((iframe) => { iframe.src = "about:blank"; });
    cleanups.forEach((cleanup) => cleanup());
    document.documentElement.classList.remove("archive-motion-paused");
  };
}

export function bindArchiveStudio(initialData, publishedData, initialPageId = "") {
  const studio = document.querySelector("[data-archive-studio]");
  if (!studio) return;
  let data = normalizeArchiveData(initialData);
  let published = normalizeArchiveData(publishedData);
  const draftInfo = getArchiveDraftInfo(published);
  let draftBase = draftInfo.base || fingerprint(published);
  let draftConflict = draftInfo.stale;
  let saveWarningShown = false;
  let activePageId = data.pages.some((page) => page.id === initialPageId) ? initialPageId : studio.dataset.activePage || data.settings.defaultPageId;
  let selectedId = "";
  // Studio 7: 다중 선택. selectedIds가 전체 선택, selectedId는 그중 첫 번째(기본) 선택이라 기존 코드가 그대로 동작한다.
  let selectedIds = [];
  let selectedMotionFrameId = "";
  let studioMode = "design";
  let motionPlayhead = 0;
  let motionPreviewSpeed = 1;
  let motionPreviewMode = matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
  let studioMotionAnimations = [];
  let studioMotionFrame = 0;
  let disposed = false;
  let drag = null;
  let zoom = number(studio.querySelector("[data-zoom]")?.value, 0.5, 0.1, 2);
  let historyStack = [JSON.stringify(data)];
  let historyIndex = 0;
  let layout = "desktop";
  let deferredRender = 0;
  let editorComponents = null;

  function currentPage() { return data.pages.find((page) => page.id === activePageId) || data.pages[0]; }
  const canvas = () => studio.querySelector("[data-archive-canvas]");
  // Blocks on the current page plus 모든 페이지에 표시 (global) blocks, which every page shares.
  const allBlocks = () => [...(currentPage()?.blocks || []), ...data.globals];
  const isGlobalBlock = (block) => data.globals.some((item) => item.id === block?.id);
  const containerOf = (block) => isGlobalBlock(block) ? data.globals : currentPage().blocks;
  const activeLayout = () => isLayoutEnabled(currentPage(), layout) ? layout : "desktop";
  const view = (block) => resolveBlock(block, activeLayout());
  const setLayoutValue = (block, key, value) => setOverride(block, activeLayout(), key, value);
  const selected = () => allBlocks().find((block) => block.id === selectedId);
  // Studio 7 다중 선택 헬퍼. selectedId가 다른 곳에서 바뀌면 집합을 그에 맞춰 줄인다.
  const syncSelection = () => {
    if (!selectedId) { selectedIds = []; return; }
    const ids = new Set(allBlocks().map((block) => block.id));
    selectedIds = selectedIds.filter((id) => ids.has(id));
    if (!selectedIds.includes(selectedId)) selectedIds = [selectedId];
  };
  const selectedBlocks = () => { syncSelection(); return selectedIds.map((id) => allBlocks().find((block) => block.id === id)).filter(Boolean); };
  const setSelection = (ids) => {
    const existing = new Set(allBlocks().map((block) => block.id));
    selectedIds = [...new Set(ids)].filter((id) => existing.has(id));
    selectedId = selectedIds[0] || "";
  };
  const toggleSelection = (id) => { syncSelection(); setSelection(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]); };
  const isMultiSelection = () => selectedBlocks().length > 1;
  // 선택 전체를 감싸는 사각형(회전은 무시) — 정렬·러버밴드·선택 상자에 쓴다.
  const boundsOf = (blocks) => {
    const rects = blocks.map((block) => view(block));
    if (!rects.length) return null;
    const left = Math.min(...rects.map((rect) => rect.x)); const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width)); const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  const selectedTimeline = () => selected()?.motion.timeline;
  const selectedMotionFrame = () => {
    const timeline = selectedTimeline();
    if (!timeline?.keyframes.length) return null;
    const frame = timeline.keyframes.find((item) => item.id === selectedMotionFrameId) || timeline.keyframes[0];
    selectedMotionFrameId = frame.id;
    return frame;
  };
  const motionHorizon = () => Math.max(100, ...allBlocks().filter((block) => block.motion.timeline.enabled && block.motion.timeline.trigger !== "scroll").map((block) => block.motion.timeline.delay + block.motion.timeline.duration));
  const QUIET_STATUS = /자동 저장|편집 중|^키프레임 |^확대 |^화면 맞춤|^선택 없음$/;
  const status = (message, { quiet = false } = {}) => { const node = studio.querySelector("[data-save-status]"); if (node) node.textContent = message; if (!quiet && !QUIET_STATUS.test(message)) toast(message); };

  const clearStudioMotion = () => {
    if (studioMotionFrame) cancelAnimationFrame(studioMotionFrame);
    studioMotionFrame = 0;
    studioMotionAnimations.forEach((animation) => { try { animation.cancel(); } catch (error) { console.warn("Studio motion preview could not stop.", error); } });
    studioMotionAnimations = [];
  };

  const previewFrames = (timeline) => {
    const frames = motionLabKeyframes(timeline);
    if (motionPreviewMode !== "reduced") return frames;
    return frames.map((frame) => ({ offset: frame.offset, opacity: frame.opacity, easing: frame.easing }));
  };

  const updateMotionTransport = (progress) => {
    if (disposed) return;
    motionPlayhead = number(progress, 0, 0, 100);
    const dock = studio.querySelector("[data-motion-lab-dock]");
    dock?.querySelector("[data-motion-scrub]")?.setAttribute("value", String(motionPlayhead));
    const scrub = dock?.querySelector("[data-motion-scrub]");
    if (scrub) scrub.value = String(motionPlayhead);
    const output = dock?.querySelector("[data-motion-time]");
    const horizon = motionHorizon();
    if (output) output.textContent = `${Math.round(motionPlayhead)}% · ${Math.round(horizon * motionPlayhead / 100)}ms`;
    const rows = dock?.querySelector(".motion-lab-dock__rows");
    rows?.style.setProperty("--motion-playhead", `${motionPlayhead}%`);
    const playhead = dock?.querySelector("[data-motion-dock-playhead]");
    const track = dock?.querySelector(".motion-lab-dock__track");
    if (playhead && track && rows) rows.style.setProperty("--motion-playhead-left", `${track.offsetLeft + track.clientWidth * motionPlayhead / 100}px`);
  };

  const scrubStudioMotion = (progress = motionPlayhead) => {
    if (disposed) return;
    clearStudioMotion();
    updateMotionTransport(progress);
    if (studioMode !== "motion" || motionPreviewMode === "off" || typeof Element === "undefined" || !Element.prototype.animate) return;
    allBlocks().forEach((block) => {
      const timeline = block.motion.timeline;
      if (!timeline.enabled || timeline.keyframes.length < 2) return;
      const target = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"] .canvas-block__timeline`);
      if (!target) return;
      try {
        const animation = target.animate(previewFrames(timeline), motionLabTiming(timeline, { scrub: true }));
        const globalTime = motionHorizon() * motionPlayhead / 100;
        const localTime = timeline.trigger === "scroll" ? timeline.duration * motionPlayhead / 100 : Math.min(timeline.duration, Math.max(0, globalTime - timeline.delay));
        animation.pause(); animation.currentTime = localTime;
        studioMotionAnimations.push(animation);
      } catch (error) { console.warn("Studio Motion Lab scrub could not render.", error); }
    });
  };

  const playStudioMotion = ({ onlySelected = false, restart = true } = {}) => {
    if (disposed) return;
    clearStudioMotion();
    if (motionPreviewMode === "off") { status("모션 미리보기가 꺼져 있어요"); return; }
    const blocks = (onlySelected ? [selected()] : allBlocks()).filter((block) => block?.motion.timeline.enabled && block.motion.timeline.keyframes.length > 1);
    if (!blocks.length) { status("재생할 Motion Lab 트랙이 없어요"); return; }
    const startAt = restart ? 0 : motionPlayhead;
    let total = 100;
    blocks.forEach((block) => {
      const timeline = block.motion.timeline;
      const target = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"] .canvas-block__timeline`);
      if (!target) return;
      const duration = timeline.duration / motionPreviewSpeed;
      const delay = timeline.delay / motionPreviewSpeed;
      total = Math.max(total, duration + delay);
      try {
        const animation = target.animate(previewFrames(timeline), { ...motionLabTiming(timeline, { preview: true }), duration, delay });
        studioMotionAnimations.push(animation);
      } catch (error) { console.warn("Studio Motion Lab preview could not play.", error); }
    });
    if (!restart) studioMotionAnimations.forEach((animation) => { animation.currentTime = total * startAt / 100; });
    const started = performance.now() - total * startAt / 100;
    const tick = (now) => {
      if (disposed) return;
      const progress = Math.min(100, (now - started) / total * 100);
      updateMotionTransport(progress);
      if (progress < 100 && studioMotionAnimations.some((animation) => animation.playState !== "finished")) studioMotionFrame = requestAnimationFrame(tick);
      else studioMotionFrame = 0;
    };
    studioMotionFrame = requestAnimationFrame(tick);
    status(onlySelected ? "선택한 모션 재생 중" : "페이지 모션 재생 중");
  };

  const applyMotionPreset = (block, presetId, delay = 0) => {
    const preset = MOTION_LAB_PRESETS[presetId];
    if (!block || !preset) return;
    block.motion.timeline = normalizeMotionTimeline({
      enabled: true,
      trigger: preset.trigger,
      duration: preset.duration,
      delay,
      infinite: Boolean(preset.infinite),
      iterations: 1,
      direction: "normal",
      fill: "both",
      origin: preset.origin || "center",
      perspective: preset.perspective || 800,
      once: true,
      linkTarget: block.motion.timeline.linkTarget,
      linkEvent: block.motion.timeline.linkEvent,
      linkMode: block.motion.timeline.linkMode,
      keyframes: preset.frames.map((frame) => ({ ...frame, id: uid("kf") })),
    });
    if (preset.infinite) data.settings.showMotionToggle = true;
    selectedMotionFrameId = block.motion.timeline.keyframes[0]?.id || "";
    motionPlayhead = block.motion.timeline.keyframes[0]?.at || 0;
  };

  const enableEmptyMotion = (block) => {
    if (!block) return;
    const previousFrameId = selectedMotionFrameId;
    block.motion.timeline = normalizeMotionTimeline({ ...block.motion.timeline, enabled: true, keyframes: block.motion.timeline.keyframes.length ? block.motion.timeline.keyframes : neutralMotionKeyframes().map((frame) => ({ ...frame, id: uid("kf") })) });
    selectedMotionFrameId = block.motion.timeline.keyframes.some((frame) => frame.id === previousFrameId) ? previousFrameId : block.motion.timeline.keyframes[0]?.id || "";
    motionPlayhead = block.motion.timeline.keyframes.find((frame) => frame.id === selectedMotionFrameId)?.at ?? 0;
  };

  const addMotionKeyframe = ({ copyCurrent = false } = {}) => {
    const block = selected();
    if (!block) return;
    enableEmptyMotion(block);
    const timeline = block.motion.timeline;
    if (timeline.keyframes.length >= 32) { status("키프레임은 요소당 최대 32개예요"); return; }
    const current = selectedMotionFrame() || timeline.keyframes.at(-1);
    const currentIndex = timeline.keyframes.findIndex((frame) => frame.id === current.id);
    const next = timeline.keyframes[currentIndex + 1];
    const previous = timeline.keyframes[currentIndex - 1];
    let at = next && next.at - current.at > 1 ? Math.round((current.at + next.at) / 2) : previous && current.at - previous.at > 1 ? Math.round((previous.at + current.at) / 2) : -1;
    if (at < 0) {
      const gaps = timeline.keyframes.slice(0, -1).map((frame, index) => ({ start: frame.at, end: timeline.keyframes[index + 1].at })).sort((a, b) => (b.end - b.start) - (a.end - a.start));
      at = gaps[0] && gaps[0].end - gaps[0].start > 1 ? Math.round((gaps[0].start + gaps[0].end) / 2) : Array.from({ length: 101 }, (_, index) => index).find((value) => !timeline.keyframes.some((frame) => frame.at === value)) ?? current.at;
    }
    const raw = copyCurrent ? { ...clone(current), at } : { at };
    const frame = normalizeMotionKeyframe({ ...raw, id: uid("kf") }, timeline.keyframes.length);
    timeline.keyframes.push(frame);
    timeline.keyframes.sort((a, b) => a.at - b.at);
    selectedMotionFrameId = frame.id; motionPlayhead = frame.at;
  };

  const recordHistory = () => {
    const snapshot = JSON.stringify(data);
    if (historyStack[historyIndex] === snapshot) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snapshot);
    if (historyStack.length > 60) historyStack.shift();
    historyIndex = historyStack.length - 1;
  };

  const persist = ({ history = true } = {}) => {
    const keepPage = activePageId;
    data = normalizeArchiveData(data);
    activePageId = data.pages.some((page) => page.id === keepPage) ? keepPage : data.settings.defaultPageId;
    const saved = saveDraft(data, published, draftBase);
    syncArchiveFontStylesheet(data, activePageId);
    if (history) recordHistory();
    if (!saved) {
      status("자동 저장 실패 — 지금 JSON 백업을 눌러주세요");
      if (!saveWarningShown) { saveWarningShown = true; alert("브라우저 저장 공간이 부족해 자동 저장하지 못했어요. 작업은 현재 화면에 남아 있으니 바로 ‘백업’을 눌러 JSON 파일로 저장해주세요."); }
    } else if (draftConflict) status("자동 저장됨 · 게시본이 바뀌었으니 덮어쓰기 전 백업 권장");
    else status("이 브라우저에 자동 저장됨");
  };

  const applyZoom = () => {
    const page = currentPage();
    const board = studio.querySelector(".archive-studio__board");
    const sizer = studio.querySelector(".archive-studio__board-sizer");
    if (!board || !sizer || !page) return;
    const box = layoutBox(page, activeLayout());
    board.style.transform = `scale(${zoom})`;
    board.style.setProperty("--studio-zoom", zoom);
    sizer.style.width = `${box.width * zoom}px`;
    sizer.style.height = `${box.height * zoom}px`;
    drawRulersSoon();
  };

  const fitZoom = () => {
    const workspace = studio.querySelector(".archive-studio__workspace");
    const box = layoutBox(currentPage(), activeLayout());
    const available = Math.max(200, (workspace?.clientWidth || 900) - 72);
    zoom = [1, 0.75, 0.5, 0.25].find((value) => box.width * value <= available) || 0.25;
    const select = studio.querySelector("[data-zoom]");
    if (select) select.value = String(zoom);
  };

  const destroyEditorComponents = () => {
    studio.querySelectorAll(".archive-studio__board [data-component]").forEach((element) => element._archiveComponent?.destroy());
  };

  const renderCanvas = () => {
    clearStudioMotion();
    clearTimeout(deferredRender);
    deferredRender = 0;
    const board = studio.querySelector(".archive-studio__board");
    const prompt = studio.querySelector("[data-layout-prompt]");
    const sizer = studio.querySelector(".archive-studio__board-sizer");
    const missing = layout !== "desktop" && !isLayoutEnabled(currentPage(), layout);
    if (prompt) { prompt.hidden = !missing; prompt.innerHTML = missing ? layoutPromptMarkup(currentPage(), layout) : ""; }
    if (sizer) sizer.hidden = missing;
    if (missing) { destroyEditorComponents(); board.innerHTML = ""; return; }
    const kept = detachLiveComponents(board);
    board.innerHTML = archiveCanvasMarkup(data, currentPage(), { editing: true, layout });
    reattachLiveComponents(board, kept);
    editorComponents = mountComponents([board], { editing: true, getLayout: activeLayout });
    if (!allBlocks().length) board.querySelector("[data-archive-canvas]")?.insertAdjacentHTML("beforeend", emptyStateMarkup());
    renderColumns(); renderPageGuides();
    markSelectedElements();
    applyZoom();
    if (studioMode === "motion") requestAnimationFrame(() => scrubStudioMotion(motionPlayhead));
  };
  // Code and slider edits re-render after a short pause so iframes and WebGL are not rebuilt on every keystroke.
  const renderCanvasSoon = (delay = 160) => {
    clearTimeout(deferredRender);
    deferredRender = setTimeout(renderCanvas, delay);
  };

  const renderPages = () => {
    studio.querySelector("[data-page-list]").innerHTML = pageListMarkup(data, activePageId);
    const page = currentPage();
    const count = studio.querySelector("[data-page-count]");
    const name = studio.querySelector("[data-current-page-name]");
    const meta = studio.querySelector("[data-current-page-meta]");
    if (count) count.textContent = `${data.pages.length}개`;
    if (name) name.textContent = page.name;
    const box = layoutBox(page, activeLayout());
    if (meta) meta.textContent = `${page.visibility === "listed" ? "메뉴 표시" : page.visibility === "unlisted" ? "링크 전용" : "초안"} · ${box.width}×${box.height}`;
    const switcher = studio.querySelector("[data-breakpoints]");
    if (switcher) switcher.innerHTML = breakpointSwitchMarkup(page, layout);
  };

  // Studio 7: 선택 표시(여러 개 가능)와 선택 상자. 캔버스를 다시 그리지 않고 클래스만 바꾼다.
  const markSelectedElements = () => {
    const board = canvas();
    if (!board) return;
    syncSelection();
    board.querySelectorAll(".is-selected, .is-primary").forEach((element) => element.classList.remove("is-selected", "is-primary"));
    selectedIds.forEach((id) => board.querySelector(`[data-block-id="${CSS.escape(id)}"]`)?.classList.add("is-selected"));
    if (selectedId) board.querySelector(`[data-block-id="${CSS.escape(selectedId)}"]`)?.classList.add("is-primary");
    board.classList.toggle("is-multi", selectedIds.length > 1);
    drawSelectionBox();
    drawRulersSoon();
  };
  const drawSelectionBox = () => {
    const board = canvas();
    if (!board) return;
    board.querySelector(".studio-selection-box")?.remove();
    board.querySelector(".studio-float-toolbar")?.remove();
    const blocks = selectedBlocks();
    if (!blocks.length || studioMode !== "design" || textEditing) return;
    const bounds = boundsOf(blocks);
    if (blocks.length >= 2) {
      const box = document.createElement("div");
      box.className = "studio-selection-box";
      box.style.cssText = `left:${bounds.left}px;top:${bounds.top}px;width:${bounds.width}px;height:${bounds.height}px`;
      box.innerHTML = `<span>${blocks.length}개 · ${Math.round(bounds.width)}×${Math.round(bounds.height)}</span>`;
      board.append(box);
    }
    board.append(floatToolbarFor(blocks, bounds));
  };
  // Studio 8: a small toolbar floats above the selection (single or multi) with the most used actions.
  const floatToolbarFor = (blocks, bounds) => {
    const many = blocks.length > 1; const block = blocks[0];
    const allLocked = blocks.every((item) => item.locked); const anyVisible = blocks.some((item) => item.visible);
    const item = (id, label, icon, { disabled = false, keys = "" } = {}) => `<button data-menu="${id}" title="${label}${keys ? ` (${keys})` : ""}" aria-label="${label}" type="button" ${disabled ? "disabled" : ""}>${icon}</button>`;
    const bar = document.createElement("div");
    bar.className = "studio-float-toolbar";
    const gap = 44 / zoom;
    const top = bounds.top - gap >= 0 ? bounds.top - gap : bounds.top + bounds.height + 10 / zoom;
    bar.style.cssText = `left:${Math.max(0, bounds.left)}px;top:${top}px`;
    bar.innerHTML = [
      !many && ["text", "button"].includes(block.type) ? item("edit-text", "글자 편집", "<b>T</b>", { keys: "Enter", disabled: block.locked }) : "",
      many ? alignToolbarMarkup(blocks.length) : `${item("align-center", "캔버스 가로 가운데", ALIGN_ICONS.center, { disabled: allLocked })}${item("align-middle", "첫 화면 세로 가운데", ALIGN_ICONS.middle, { disabled: allLocked })}`,
      "<i></i>",
      item("duplicate", many ? `${blocks.length}개 복제` : "복제", "⧉", { keys: "Ctrl+D", disabled: allLocked }),
      many ? "" : item("forward", "한 칸 앞으로", "↑", { keys: "Ctrl+]" }) + item("backward", "한 칸 뒤로", "↓", { keys: "Ctrl+[" }),
      item("lock", allLocked ? "잠금 해제" : "잠금", allLocked ? "🔓" : "🔒", { keys: "Ctrl+Shift+L" }),
      item("hide", anyVisible ? "숨기기" : "표시", anyVisible ? "◌" : "◉", { keys: "Ctrl+Shift+H", disabled: allLocked }),
      "<i></i>",
      item("delete", many ? `${blocks.length}개 삭제` : "삭제", "✕", { keys: "Delete", disabled: allLocked }),
    ].join("");
    return bar;
  };

  let layerFilter = "";
  const renderLayers = () => {
    const list = studio.querySelector("[data-layer-list]");
    const current = activeLayout();
    syncSelection();
    const query = layerFilter.trim().toLowerCase();
    const blocks = allBlocks().sort((a, b) => b.z - a.z).filter((block) => !query || block.name.toLowerCase().includes(query) || block.type.includes(query));
    const markup = blocks.map((block) => {
      const hiddenHere = view(block).hidden;
      const marks = `${isGlobalBlock(block) ? '<b title="모든 페이지에 표시">🌐</b>' : ""}${block.fixed ? '<b title="화면에 고정">📌</b>' : ""}${hiddenHere ? `<b title="${LAYOUT_LABELS[current]}에서 숨김">⊘</b>` : ""}`;
      const icon = block.visible ? (block.locked ? "🔒" : `<i class="studio-layer__icon" aria-hidden="true">${LAYER_ICONS[block.type] || "▣"}</i>${block.type}`) : "숨김";
      return `<button class="studio-layer ${selectedIds.includes(block.id) ? "is-active" : ""}${block.id === selectedId && selectedIds.length > 1 ? " is-primary" : ""}${hiddenHere ? " is-layout-hidden" : ""}" data-select="${escapeHTML(block.id)}" draggable="${query ? "false" : "true"}" title="더블클릭: 이름 바꾸기 · 드래그: 순서 바꾸기" type="button"><span>${icon}</span><em>${escapeHTML(block.name)}${marks}</em>${block.motion.timeline.enabled ? `<i title="Motion Lab ${block.motion.timeline.keyframes.length} keyframes">◆ ${block.motion.timeline.keyframes.length}</i>` : ""}</button>`;
    }).join("") || `<p class="studio-muted">${query ? "검색 결과가 없어요." : "아직 레이어가 없어요."}</p>`;
    // 같은 레이어 목록이면 버튼을 새로 만들지 않고 고친다 — 그래야 더블클릭(이름 바꾸기)이 끊기지 않는다.
    const existing = [...list.querySelectorAll(":scope > .studio-layer")];
    if (existing.length && existing.length === blocks.length && existing.every((node, index) => node.dataset.select === blocks[index].id)) {
      const template = document.createElement("template");
      template.innerHTML = markup;
      [...template.content.children].forEach((fresh, index) => {
        const node = existing[index];
        if (node.className !== fresh.className) node.className = fresh.className;
        if (node.innerHTML !== fresh.innerHTML && !node.querySelector("input")) node.innerHTML = fresh.innerHTML;
        if (node.getAttribute("draggable") !== fresh.getAttribute("draggable")) node.setAttribute("draggable", fresh.getAttribute("draggable"));
      });
      return;
    }
    list.innerHTML = markup;
  };

  const renderInspector = () => {
    const inspector = studio.querySelector("[data-inspector]");
    const block = selected();
    selectedMotionFrame();
    const blocks = selectedBlocks();
    if (blocks.length > 1 && studioMode !== "motion") { inspector.innerHTML = multiSelectionMarkup(blocks.map((item) => view(item)), activeLayout()); return; }
    inspector.innerHTML = block ? inspectorMarkup(view(block), data, selectedMotionFrameId, studioMode === "motion", { layout: activeLayout(), base: block, isGlobal: isGlobalBlock(block), blocks: allBlocks() }) : pageInspectorMarkup(data, currentPage(), activeLayout());
  };

  const renderMotionDock = () => {
    const dock = studio.querySelector("[data-motion-lab-dock]");
    if (!dock) return;
    dock.outerHTML = motionLabDockMarkup({ blocks: allBlocks() }, selectedId, selectedMotionFrameId, motionPlayhead, motionPreviewSpeed);
    const speed = studio.querySelector("[data-motion-speed]");
    if (speed) speed.insertAdjacentHTML("afterend", `<select data-motion-preview-mode aria-label="접근성 미리보기"><option value="full" ${motionPreviewMode === "full" ? "selected" : ""}>Full</option><option value="reduced" ${motionPreviewMode === "reduced" ? "selected" : ""}>Reduced</option><option value="off" ${motionPreviewMode === "off" ? "selected" : ""}>Off</option></select>`);
    requestAnimationFrame(() => updateMotionTransport(motionPlayhead));
  };

  const renderSelection = ({ pages = false } = {}) => {
    if (pages) renderPages();
    renderCanvas(); renderLayers(); renderInspector(); renderMotionDock(); renderAssets();
  };

  const selectBlock = (id) => {
    selectedId = id; selectedIds = id ? [id] : [];
    const timeline = selected()?.motion.timeline;
    selectedMotionFrameId = timeline?.keyframes.find((frame) => frame.id === selectedMotionFrameId)?.id || timeline?.keyframes[0]?.id || "";
    if (studioMode === "motion" && timeline?.enabled && selectedMotionFrameId) motionPlayhead = timeline.keyframes.find((frame) => frame.id === selectedMotionFrameId)?.at || 0;
    renderSelection();
  };
  const selectPage = (id) => {
    if (!data.pages.some((page) => page.id === id)) return;
    activePageId = id; selectedId = ""; selectedMotionFrameId = ""; motionPlayhead = 0;
    if (isLayoutEnabled(currentPage(), layout)) fitZoom();
    syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true });
  };

  const createPage = (visibility = "listed") => {
    const count = data.pages.length + 1;
    const page = normalizePage({ id: uid("page"), name: `Page ${count}`, slug: `page-${count}`, visibility, canvas: clone(currentPage().canvas), seo: { noIndex: visibility !== "listed" } }, data.pages.length);
    data.pages.push(page); activePageId = page.id; selectedId = ""; persist(); renderSelection({ pages: true });
  };

  const duplicateBlock = (block) => {
    const copy = normalizeBlock({ ...clone(block), id: uid(block.type), name: `${block.name} copy`, z: Math.max(0, ...allBlocks().map((item) => item.z)) + 1 }, currentPage().blocks.length);
    const shifted = view(copy);
    setLayoutValue(copy, "x", shifted.x + 24); setLayoutValue(copy, "y", shifted.y + 24);
    containerOf(block).push(copy); selectedId = copy.id; persist(); renderSelection();
  };

  // Studio 6: clipboard (works across pages and tabs), z-order shortcuts, continuous zoom, file drop.
  const CLIPBOARD_KEY = "psj-archive-clipboard-v1";
  const findBlock = (id) => [...data.pages.flatMap((page) => page.blocks), ...data.globals].find((item) => item.id === id);
  const removeBlock = (block) => {
    const container = containerOf(block);
    const index = container.findIndex((item) => item.id === block.id);
    if (index >= 0) container.splice(index, 1);
    selectedIds = selectedIds.filter((id) => id !== block.id);
    if (selectedId === block.id) selectedId = selectedIds[0] || "";
  };
  // 선택한 요소 전체에 적용하는 묶음 동작 (잠긴 요소는 건너뛴다).
  const deleteSelected = () => {
    const blocks = selectedBlocks().filter((block) => !block.locked);
    if (!blocks.length) { if (selectedBlocks().length) status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    blocks.forEach((block) => removeBlock(block));
    if (!selectedIds.length) selectedId = currentPage().blocks.at(-1)?.id || "";
    persist(); renderSelection();
    if (blocks.length > 1) status(`${blocks.length}개 삭제했어요`);
  };
  const duplicateSelected = () => {
    const blocks = selectedBlocks().filter((block) => !block.locked);
    if (!blocks.length) return;
    if (blocks.length === 1) { duplicateBlock(blocks[0]); return; }
    let z = Math.max(0, ...allBlocks().map((item) => item.z));
    const ids = blocks.map((block) => {
      const copy = normalizeBlock({ ...clone(block), id: uid(block.type), name: `${block.name} copy`, z: ++z }, currentPage().blocks.length);
      const shifted = view(copy);
      setLayoutValue(copy, "x", shifted.x + 24); setLayoutValue(copy, "y", shifted.y + 24);
      containerOf(block).push(copy);
      return copy.id;
    });
    setSelection(ids); persist(); renderSelection(); status(`${ids.length}개 복제했어요`);
  };
  const setLockedSelected = (locked) => {
    const blocks = selectedBlocks();
    blocks.forEach((block) => { block.locked = locked; });
    persist(); renderSelection(); status(locked ? `${blocks.length}개 잠금` : `${blocks.length}개 잠금 해제`);
  };
  const setHiddenSelected = (hidden) => {
    const blocks = selectedBlocks().filter((block) => !block.locked);
    blocks.forEach((block) => { block.visible = !hidden; });
    persist(); renderSelection(); status(hidden ? `${blocks.length}개 숨김 · 레이어 패널에서 다시 켤 수 있어요` : `${blocks.length}개 표시`);
  };
  const selectAll = () => {
    const ids = allBlocks().filter((block) => block.visible && !block.locked && !view(block).hidden).map((block) => block.id);
    if (!ids.length) { status("선택할 요소가 없어요"); return; }
    setSelection(ids); renderSelection(); status(`${ids.length}개 선택 · Shift+클릭으로 빼거나 더할 수 있어요`);
  };
  // Studio 7: 정렬·분배. 1개면 캔버스(가로는 전체 너비, 세로는 첫 화면) 기준, 2개 이상이면 선택 묶음 기준.
  const alignSelected = (mode) => {
    const blocks = selectedBlocks().filter((block) => !block.locked);
    if (!blocks.length) return;
    const box = layoutBox(currentPage(), activeLayout());
    const bounds = blocks.length > 1 ? boundsOf(blocks) : { left: 0, right: box.width, top: 0, bottom: box.viewport };
    blocks.forEach((block) => {
      const rect = view(block);
      if (mode === "left") setLayoutValue(block, "x", Math.round(bounds.left));
      if (mode === "center") setLayoutValue(block, "x", Math.round((bounds.left + bounds.right) / 2 - rect.width / 2));
      if (mode === "right") setLayoutValue(block, "x", Math.round(bounds.right - rect.width));
      if (mode === "top") setLayoutValue(block, "y", Math.round(bounds.top));
      if (mode === "middle") setLayoutValue(block, "y", Math.round((bounds.top + bounds.bottom) / 2 - rect.height / 2));
      if (mode === "bottom") setLayoutValue(block, "y", Math.round(bounds.bottom - rect.height));
    });
    persist(); renderSelection();
    status(`${ALIGN_LABELS[mode]} 정렬 · ${blocks.length > 1 ? "선택 묶음 기준" : "캔버스 기준"}`);
  };
  const distributeSelected = (axis) => {
    const blocks = selectedBlocks().filter((block) => !block.locked);
    if (blocks.length < 3) { status("균등 분배는 3개 이상 선택했을 때 돼요"); return; }
    const key = axis === "x" ? "x" : "y"; const size = axis === "x" ? "width" : "height";
    const sorted = blocks.map((block) => ({ block, rect: view(block) })).sort((a, b) => a.rect[key] - b.rect[key]);
    const first = sorted[0]; const last = sorted.at(-1);
    const span = (last.rect[key] + last.rect[size]) - first.rect[key];
    const total = sorted.reduce((sum, item) => sum + item.rect[size], 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = first.rect[key];
    sorted.forEach((item) => { setLayoutValue(item.block, key, Math.round(cursor)); cursor += item.rect[size] + gap; });
    persist(); renderSelection(); status(`${axis === "x" ? "가로" : "세로"} 간격을 ${Math.round(gap)}px로 맞췄어요`);
  };
  const copySelected = ({ cut = false } = {}) => {
    const block = selected();
    if (!block) return;
    if (cut && block.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    try { localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ pageId: activePageId, block: clone(block) })); }
    catch (error) { status("복사 실패 · 브라우저 저장 공간을 확인하세요"); return; }
    if (cut) { removeBlock(block); persist(); renderSelection(); }
    status(cut ? "잘라냈어요 · Ctrl+V로 붙여넣기" : "복사했어요 · Ctrl+V로 붙여넣기 (다른 페이지에서도 돼요)");
  };
  const pasteBlock = () => {
    let payload = null;
    try { payload = JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || "null"); } catch (error) { payload = null; }
    if (!payload?.block) { status("붙여넣을 요소가 없어요 · 먼저 요소를 고르고 Ctrl+C"); return; }
    const copy = normalizeBlock({ ...payload.block, id: uid(payload.block.type || "block"), z: Math.max(0, ...allBlocks().map((item) => item.z)) + 1 }, currentPage().blocks.length);
    const placed = view(copy);
    const overlaps = allBlocks().some((item) => { const other = view(item); return Math.abs(other.x - placed.x) < 2 && Math.abs(other.y - placed.y) < 2; });
    if (overlaps) { setLayoutValue(copy, "x", placed.x + 24); setLayoutValue(copy, "y", placed.y + 24); }
    currentPage().blocks.push(copy); selectedId = copy.id; persist(); renderSelection();
    status(payload.pageId === activePageId ? "붙여넣었어요" : "다른 페이지의 요소를 붙여넣었어요");
  };
  const reorderBlock = (block, step, toEnd = false) => {
    const order = [...allBlocks()].sort((a, b) => a.z - b.z);
    const index = order.findIndex((item) => item.id === block.id);
    const target = toEnd ? (step > 0 ? order.length - 1 : 0) : Math.min(order.length - 1, Math.max(0, index + step));
    if (index < 0 || target === index) return;
    order.splice(index, 1); order.splice(target, 0, block);
    order.forEach((item, position) => { item.z = position + 1; });
    persist(); renderSelection();
    status(step > 0 ? (toEnd ? "맨 앞으로 보냈어요" : "한 칸 앞으로") : (toEnd ? "맨 뒤로 보냈어요" : "한 칸 뒤로"));
  };
  // Continuous zoom (10–200%). The <select> grows a custom option so odd values still show.
  const setZoom = (value, anchor = null) => {
    const workspaceNode = studio.querySelector(".archive-studio__workspace");
    const previous = zoom;
    zoom = Math.min(2, Math.max(0.1, Math.round(value * 100) / 100));
    const select = studio.querySelector("[data-zoom]");
    if (select) {
      let match = [...select.options].find((item) => !item.dataset.customZoom && Number(item.value) === zoom);
      if (!match) {
        match = select.querySelector("[data-custom-zoom]") || select.appendChild(document.createElement("option"));
        match.dataset.customZoom = "1"; match.value = String(zoom); match.textContent = `${Math.round(zoom * 100)}%`;
      }
      select.value = String(zoom);
    }
    applyZoom();
    if (anchor && workspaceNode && previous !== zoom) {
      const ratio = zoom / previous;
      workspaceNode.scrollLeft = (workspaceNode.scrollLeft + anchor.x) * ratio - anchor.x;
      workspaceNode.scrollTop = (workspaceNode.scrollTop + anchor.y) * ratio - anchor.y;
    }
  };
  // ===== Studio 7 (A10): 파일 드롭 · WebP 압축 · 여러 장 묶기 =====
  const INLINE_LIMIT = 1_500_000; // 이보다 크면 data URL 대신 /media 경로
  const dataURLBytes = (dataURL) => Math.round((dataURL.length - dataURL.indexOf(",") - 1) * 3 / 4);
  const readAsDataURL = (file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => resolve(""); reader.readAsDataURL(file); });
  // PNG·JPEG·WebP는 캔버스로 다시 그려 WebP(긴 변 2000px, 400KB 목표)로 줄인다. GIF(움직임)·SVG는 그대로 둔다.
  const compressImage = async (file, { maxEdge = 2000, targetBytes = 400_000 } = {}) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { const dataURL = await readAsDataURL(file); return dataURL ? { dataURL, bytes: file.size, compressed: false } : null; }
    const url = URL.createObjectURL(file);
    const image = await new Promise((resolve) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = () => resolve(null); node.src = url; });
    URL.revokeObjectURL(url);
    if (!image) { const dataURL = await readAsDataURL(file); return dataURL ? { dataURL, bytes: file.size, compressed: false } : null; }
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    let quality = 0.86;
    const draw = () => {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    };
    let dataURL = draw();
    if (!dataURL.startsWith("data:image/webp")) { const original = await readAsDataURL(file); return original ? { dataURL: original, bytes: file.size, compressed: false } : null; } // WebP를 못 만드는 브라우저
    let guard = 0;
    while (dataURLBytes(dataURL) > targetBytes && guard++ < 8) { if (quality > 0.62) quality -= 0.08; else scale *= 0.85; dataURL = draw(); }
    if (dataURLBytes(dataURL) >= file.size && file.size <= targetBytes && scale === 1) { const original = await readAsDataURL(file); if (original) return { dataURL: original, bytes: file.size, compressed: false }; }
    return { dataURL, bytes: dataURLBytes(dataURL), compressed: true, width: canvas.width, height: canvas.height, from: file.size };
  };
  const chooseInsertMode = (count) => new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "studio-choice"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-label", "여러 이미지 넣기");
    modal.innerHTML = `<div class="studio-choice__card"><h3>이미지 ${count}장을 어떻게 넣을까요?</h3><p>넣기 전에 긴 변 2000px · WebP로 줄여서 저장해요 (GIF·SVG는 그대로). 방향키·Enter로도 고를 수 있어요.</p><div class="studio-choice__options"><button data-choice="separate" type="button" autofocus><strong>따로따로</strong><small>이미지 블록 ${count}개 · 계단식으로 놓임</small></button><button data-choice="gallery" type="button"><strong>갤러리 하나로</strong><small>그리드 또는 슬라이드쇼</small></button><button data-choice="sequence" type="button"><strong>스크롤 시퀀스</strong><small>스크롤로 넘기는 연속 프레임 (순서 = 파일 이름순)</small></button></div><button class="studio-choice__cancel" data-choice="" type="button">취소 (Esc)</button></div>`;
    document.body.append(modal);
    const finish = (choice) => { removeEventListener("keydown", onKey, true); modal.remove(); resolve(choice); };
    const onKey = (event) => { event.stopPropagation(); if (event.key === "Escape") finish(""); };
    addEventListener("keydown", onKey, true);
    modal.addEventListener("click", (event) => { const pick = event.target.closest("[data-choice]"); if (pick) finish(pick.dataset.choice); else if (event.target === modal) finish(""); });
    modal.querySelector("[data-choice=separate]").focus();
  });
  const mediaPathFor = (file) => `/media/${file.name.replace(/[^\w.-]+/g, "-")}`;
  const insertFiles = async (files, point = null) => {
    const list = [...files].filter((file) => /^(image|video|audio)\//.test(file.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, 60);
    if (!list.length) return false;
    const imageFiles = list.filter((file) => file.type.startsWith("image/"));
    let mode = "separate";
    if (imageFiles.length >= 2) { mode = await chooseInsertMode(imageFiles.length); if (!mode) { status("넣기를 취소했어요"); return true; } }
    status(`${list.length}개 파일을 준비하는 중… (이미지는 WebP로 줄이는 중)`);
    const prepared = [];
    for (const file of list) {
      const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "audio";
      prepared.push({ file, type, result: type === "image" ? await compressImage(file) : null });
    }
    if (disposed) return true;
    const page = currentPage();
    const box = layoutBox(page, activeLayout());
    const current = activeLayout();
    const ids = [];
    let uploadNeeded = 0; let saved = 0;
    const pendingUploads = [];
    const sourceFor = (item) => {
      if (item.type !== "image" || !item.result || item.result.bytes > INLINE_LIMIT) { uploadNeeded += 1; pendingUploads.push(item.file); return { media: mediaPathFor(item.file), src: "" }; }
      if (item.result.compressed) saved += Math.max(0, item.result.from - item.result.bytes);
      return { media: "", src: item.result.dataURL };
    };
    const place = (block, width, height, offset) => {
      block.width = width; block.height = height;
      const x = point ? Math.round(Math.min(Math.max(0, point.x - width / 2), Math.max(0, box.width - width)) + offset * 24) : block.x;
      const y = point ? Math.round(Math.max(0, point.y - height / 2) + offset * 24) : block.y;
      if (current === "desktop") { block.x = x; block.y = y; }
      placeNewBlockOnLayouts(block, page);
      if (current !== "desktop") setOverride(block, current, "x", x), setOverride(block, current, "y", point ? y : Math.round((studio.querySelector(".archive-studio__workspace")?.scrollTop || 0) / zoom) + 80);
      page.blocks.push(block); ids.push(block.id);
    };
    const singles = mode === "separate" ? prepared : prepared.filter((item) => item.type !== "image");
    singles.forEach((item, offset) => {
      const block = defaultBlock(item.type, page);
      block.name = item.file.name.replace(/\.[^.]+$/, "").slice(0, 40) || block.name;
      const source = sourceFor(item);
      block.media = source.media; block.src = source.src;
      if (item.type === "image" && item.result?.width && item.result?.height) {
        const width = Math.min(480, box.width - 40); place(block, width, Math.max(40, Math.round(width * item.result.height / item.result.width)), offset);
      } else place(block, item.type === "audio" ? 420 : Math.min(480, box.width - 40), item.type === "audio" ? 64 : 320, offset);
    });
    const grouped = mode === "separate" ? [] : prepared.filter((item) => item.type === "image");
    if (grouped.length && mode === "gallery") {
      const block = defaultBlock("gallery", page);
      block.name = `갤러리 ${grouped.length}장`;
      block.galleryItems = grouped.map((item) => { const source = sourceFor(item); return { src: source.src || source.media, alt: item.file.name.replace(/\.[^.]+$/, ""), caption: "" }; });
      block.galleryColumns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(grouped.length))));
      place(block, Math.min(960, box.width - 40), 560, 0);
    } else if (grouped.length && mode === "sequence") {
      const meta = componentMetas.get("scroll-sequence");
      const block = defaultBlock("component", page);
      block.component = "scroll-sequence"; block.name = `스크롤 시퀀스 ${grouped.length}프레임`;
      block.props = meta ? resolveProps(meta, { images: grouped.map((item) => { const source = sourceFor(item); return source.src || source.media; }) }) : { images: [] };
      place(block, Math.min(960, box.width - 40), meta?.defaultSize.height || 420, 0);
    }
    setSelection(ids); persist(); renderSelection();
    const draftSize = JSON.stringify(data).length;
    const parts = [`${ids.length}개 추가했어요`];
    if (saved > 200_000) parts.push(`WebP로 ${(saved / 1_000_000).toFixed(1)}MB 줄임`);
    if (uploadNeeded) parts.push(githubToken() ? `큰 파일 ${uploadNeeded}개는 GitHub에 자동으로 올리는 중 (게시 후 보여요)` : `큰 파일 ${uploadNeeded}개는 GitHub media 폴더에 같은 이름으로 올려야 보여요 · 게시 창(Ctrl+Shift+P)에 토큰을 넣으면 자동`);
    if (draftSize > 3_000_000) parts.push(`초안이 ${(draftSize / 1_000_000).toFixed(1)}MB예요 · 이미지가 많으면 GitHub media에 올리고 경로로 넣는 게 안전해요`);
    status(parts.join(" · "));
    if (pendingUploads.length && githubToken()) uploadFilesToGitHub(pendingUploads);
    return true;
  };

  // A first-guess text height for 자동 정렬, measured with the real font.
  const measureText = (block, width) => {
    if (block.type !== "text") return 0;
    const probe = document.createElement(block.htmlTag || "p");
    probe.setAttribute("style", `${typographyStyle(block)};padding:${number(block.padding, 0, 0, 200)}px;position:absolute;left:-99999px;top:0;width:${width}px;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;margin:0;box-sizing:border-box`);
    probe.textContent = block.content;
    document.body.append(probe);
    const height = probe.scrollHeight;
    probe.remove();
    return height;
  };

  const switchLayout = (next) => {
    layout = LAYOUTS.includes(next) ? next : "desktop";
    if (isLayoutEnabled(currentPage(), layout)) fitZoom();
    renderSelection({ pages: true });
    status(layout === "desktop" ? "Desktop 배치 편집" : isLayoutEnabled(currentPage(), layout) ? `${LAYOUT_LABELS[layout]} 배치 편집 · 바꾼 값은 이 화면에만 적용돼요` : `${LAYOUT_LABELS[layout]} 배치를 만들어 주세요`);
  };

  const createLayout = (target, mode) => {
    autoLayout({ page: currentPage(), globals: data.globals, layout: target, mode, measureText });
    persist();
    layout = target;
    fitZoom();
    renderSelection({ pages: true });
    status(`${LAYOUT_LABELS[target]} 배치를 ${mode === "scale" ? "비율대로" : "자동 정렬로"} 만들었어요 · 이제 손으로 다듬으세요`);
  };

  const openDevicePreview = () => {
    saveDraft(data, published, draftBase);
    const page = currentPage();
    const params = new URLSearchParams({ view: "archive", draft: "1" });
    if (page.id !== data.settings.defaultPageId) params.set("page", page.slug);
    const devices = { mobile: [390, 844, "Phone"], tablet: [834, 1112, "Tablet"], desktop: [1440, 900, "Desktop"] };
    let device = layout;
    const modal = document.createElement("div");
    modal.className = "studio-device";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", "기기 미리보기");
    modal.innerHTML = `<div class="studio-device__bar">${Object.entries(devices).map(([key, [w, h, label]]) => `<button data-device="${key}" type="button">${label}<small>${w}×${h}</small></button>`).join("")}<span></span><button data-device-reload type="button">↻ 새로고침</button><button data-device-close type="button">닫기 ✕</button></div><div class="studio-device__stage"><div class="studio-device__frame"><iframe title="기기 미리보기" src="?${params}"></iframe></div></div>`;
    document.body.append(modal);
    const frame = modal.querySelector(".studio-device__frame");
    const iframe = modal.querySelector("iframe");
    const fit = () => {
      const [w, h] = devices[device];
      const stage = modal.querySelector(".studio-device__stage");
      const scale = Math.min(1, (stage.clientWidth - 48) / w, (stage.clientHeight - 48) / h);
      frame.style.width = `${w}px`; frame.style.height = `${h}px`; frame.style.transform = `scale(${scale})`;
      modal.querySelectorAll("[data-device]").forEach((button) => button.classList.toggle("is-active", button.dataset.device === device));
    };
    const close = () => { removeEventListener("resize", fit); removeEventListener("keydown", escape); modal.remove(); };
    const escape = (event) => { if (event.key === "Escape") close(); };
    modal.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-device]");
      if (pick) { device = pick.dataset.device; fit(); }
      if (event.target.closest("[data-device-reload]")) { saveDraft(data, published, draftBase); iframe.src = iframe.src; }
      if (event.target.closest("[data-device-close]") || event.target === modal) close();
    });
    addEventListener("resize", fit);
    addEventListener("keydown", escape);
    fit();
  };

  const renderComponentLibrary = () => {
    const library = studio.querySelector("[data-component-library]");
    if (!library) return;
    const metas = [...componentMetas.values()];
    library.innerHTML = metas.length ? metas.map((meta) => `<button data-add-component="${escapeHTML(meta.id)}" type="button" ${meta.error ? "disabled" : ""}><strong>✦ ${escapeHTML(meta.name)}</strong><small>${escapeHTML(meta.error ? `불러오기 실패 · ${meta.error}` : meta.description)}</small></button>`).join("") : '<p class="studio-muted">components/registry.js에 등록된 컴포넌트가 없어요.</p>';
  };

  const addBlock = (block) => {
    placeNewBlockOnLayouts(block, currentPage());
    const current = activeLayout();
    if (current !== "desktop") {
      const box = layoutBox(currentPage(), current);
      const workspace = studio.querySelector(".archive-studio__workspace");
      const visibleTop = Math.round((workspace?.scrollTop || 0) / zoom) + 80;
      setOverride(block, current, "y", Math.min(Math.max(0, box.height - block.height), visibleTop));
    }
    currentPage().blocks.push(block); selectedId = block.id; persist(); renderSelection();
  };

  const moveGlobal = (block, makeGlobal) => {
    if (makeGlobal === isGlobalBlock(block)) return;
    const from = containerOf(block);
    from.splice(from.findIndex((item) => item.id === block.id), 1);
    (makeGlobal ? data.globals : currentPage().blocks).push(block);
  };

  const restoreHistory = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= historyStack.length) return;
    historyIndex = nextIndex; data = normalizeArchiveData(JSON.parse(historyStack[historyIndex]));
    if (!data.pages.some((page) => page.id === activePageId)) activePageId = data.settings.defaultPageId;
    selectedId = allBlocks().some((block) => block.id === selectedId) ? selectedId : currentPage().blocks[0]?.id || "";
    const saved = saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true }); status(saved ? (historyIndex ? "실행 기록을 불러옴" : "처음 상태") : "자동 저장 실패 — 지금 JSON 백업을 눌러주세요");
  };

  // ===== Studio 7: 캔버스에서 바로 글자 편집 (더블클릭 / Enter) =====
  let textEditing = null; // { id, element, blockElement }
  const textNodeFor = (blockElement) => blockElement?.querySelector(".canvas-block__text, .canvas-block__button");
  const startTextEdit = (block) => {
    if (!block || block.locked || !["text", "button"].includes(block.type) || studioMode !== "design") return;
    finishTextEdit();
    const blockElement = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`);
    const element = textNodeFor(blockElement);
    if (!blockElement || !element) return;
    setSelection([block.id]); renderLayers(); renderInspector(); markSelectedElements();
    blockElement.classList.add("is-text-editing");
    element.textContent = block.content; // <br> 대신 진짜 줄바꿈으로
    element.style.whiteSpace = "pre-wrap";
    try { element.contentEditable = "plaintext-only"; if (element.contentEditable !== "plaintext-only") element.contentEditable = "true"; } catch (error) { element.contentEditable = "true"; }
    element.spellcheck = false;
    textEditing = { id: block.id, element, blockElement, original: block.content };
    const onInput = () => { const target = allBlocks().find((item) => item.id === block.id); if (target) { target.content = element.innerText.replace(/ /g, " ").replace(/\n$/, ""); if (block.type === "button") target.content = target.content.replace(/\n+/g, " "); } };
    const onKey = (keyEvent) => {
      if (keyEvent.key === "Escape") { keyEvent.preventDefault(); keyEvent.stopPropagation(); finishTextEdit({ cancel: true }); return; }
      if (keyEvent.key === "Enter" && (block.type === "button" || keyEvent.metaKey || keyEvent.ctrlKey)) { keyEvent.preventDefault(); finishTextEdit(); return; }
      keyEvent.stopPropagation();
    };
    const onPaste = (pasteEvent) => { pasteEvent.preventDefault(); pasteEvent.stopPropagation(); const text = pasteEvent.clipboardData?.getData("text/plain") || ""; document.execCommand("insertText", false, block.type === "button" ? text.replace(/\n+/g, " ") : text); };
    element.addEventListener("input", onInput); element.addEventListener("keydown", onKey); element.addEventListener("paste", onPaste);
    element.addEventListener("blur", () => { if (textEditing?.element === element) finishTextEdit(); });
    textEditing.dispose = () => { element.removeEventListener("input", onInput); element.removeEventListener("keydown", onKey); element.removeEventListener("paste", onPaste); };
    element.focus();
    try { const range = document.createRange(); range.selectNodeContents(element); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); } catch (error) { /* ignore */ }
    status("글자 편집 중 · Esc 취소 · 바깥 클릭 또는 Ctrl+Enter로 끝");
  };
  const finishTextEdit = ({ cancel = false } = {}) => {
    if (!textEditing) return;
    const session = textEditing; textEditing = null;
    session.dispose?.();
    const block = allBlocks().find((item) => item.id === session.id);
    if (block && cancel) block.content = session.original;
    if (block && !cancel && block.type === "text") {
      // 글이 길어져 상자를 넘치면 높이를 늘려 준다.
      const needed = Math.ceil(session.element.scrollHeight);
      const current = view(block);
      if (needed > current.height) setLayoutValue(block, "height", needed);
    }
    if (block && block.content !== session.original) persist();
    renderSelection();
    status(cancel ? "글자 편집 취소" : "글자 편집 끝");
  };
  studio.addEventListener("dblclick", (event) => {
    if (studioMode !== "design") return;
    const layer = event.target.closest("[data-select]");
    if (layer) { startLayerRename(layer); return; }
    const blockElement = event.target.closest(".canvas-block");
    if (!blockElement || !canvas()?.contains(blockElement)) return;
    const block = allBlocks().find((item) => item.id === blockElement.dataset.blockId);
    if (block?.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    if (block && ["text", "button"].includes(block.type)) startTextEdit(block);
    else if (block && block.type === "image") { studio.querySelector("[data-image-picker]").dataset.target = "image"; studio.querySelector("[data-image-picker]").click(); }
  });

  // ===== Studio 7: 우클릭 메뉴 =====
  const closeContextMenu = () => document.querySelector(".studio-context-menu")?.remove();
  const openContextMenu = (items, x, y) => {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "studio-context-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML = items.map((item) => item === "-" ? '<hr>' : `<button data-menu="${item.id}" role="menuitem" type="button" ${item.disabled ? "disabled" : ""}><span>${item.label}</span>${item.keys ? `<kbd>${item.keys}</kbd>` : ""}</button>`).join("");
    document.body.append(menu);
    const width = menu.offsetWidth; const height = menu.offsetHeight;
    menu.style.left = `${Math.min(x, innerWidth - width - 8)}px`; menu.style.top = `${Math.min(y, innerHeight - height - 8)}px`;
    menu.addEventListener("click", (event) => { const item = event.target.closest("[data-menu]"); if (item) { runContextAction(item.dataset.menu); closeContextMenu(); } });
  };
  const runContextAction = (id) => {
    const block = selected();
    const blocks = selectedBlocks();
    switch (id) {
      case "edit-text": startTextEdit(block); break;
      case "duplicate": duplicateSelected(); break;
      case "copy": copySelected(); break;
      case "cut": copySelected({ cut: true }); break;
      case "paste": pasteBlock(); break;
      case "delete": deleteSelected(); break;
      case "lock": setLockedSelected(!blocks.every((item) => item.locked)); break;
      case "hide": setHiddenSelected(blocks.some((item) => item.visible)); break;
      case "forward": if (block) reorderBlock(block, 1); break;
      case "backward": if (block) reorderBlock(block, -1); break;
      case "front": if (block) reorderBlock(block, 1, true); break;
      case "back": if (block) reorderBlock(block, -1, true); break;
      case "rename": { if (!block) break; const name = prompt("레이어 이름", block.name); if (name != null && name.trim()) { block.name = name.trim().slice(0, 60); persist(); renderSelection(); } break; }
      case "global": if (block) { moveGlobal(block, !isGlobalBlock(block)); persist(); renderSelection(); status(isGlobalBlock(block) ? "모든 페이지에 표시돼요" : "이 페이지에만 표시돼요"); } break;
      case "select-all": selectAll(); break;
      case "align-center": alignSelected("center"); break;
      case "align-middle": alignSelected("middle"); break;
      case "page-settings": selectedId = ""; selectedIds = []; renderSelection(); break;
      case "file-download": studio.querySelector('[data-action="download"]')?.click(); break;
      case "file-import": studio.querySelector('[data-action="import"]')?.click(); break;
      case "file-reset": studio.querySelector('[data-action="reset-published"]')?.click(); break;
      case "file-publish-copy": publishByCopy(); break;
      case "checkpoints": openCheckpoints(); break;
      case "publish-modal": openPublish(); break;
      case "templates": openTemplates(); break;
      default: break;
    }
  };
  // ===== Studio 8 (A15): 그라디언트 편집기 — 배경 칸에 linear/radial/conic 그라디언트를 써 준다 =====
  const parseGradient = (value) => {
    const match = /^(linear|radial|conic)-gradient\((.*)\)$/s.exec(String(value || "").trim());
    if (!match) return null;
    const type = match[1]; const parts = match[2].split(/,(?![^()]*\))/).map((part) => part.trim());
    let angle = 180; let stops = parts;
    if (type === "linear" && /^-?\d+(\.\d+)?deg$/.test(parts[0])) { angle = parseFloat(parts[0]); stops = parts.slice(1); }
    else if (type === "linear" && /^to /.test(parts[0])) { angle = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 }[parts[0]] ?? 180; stops = parts.slice(1); }
    else if (type === "conic" && /^from /.test(parts[0])) { angle = parseFloat(parts[0].replace("from", "")) || 0; stops = parts.slice(1); }
    else if (type !== "linear" && /^(circle|ellipse|closest|farthest|at )/.test(parts[0])) stops = parts.slice(1);
    const parsed = stops.map((stop) => { const found = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*(-?\d+(?:\.\d+)?)?%?$/i.exec(stop); return found ? { color: found[1], at: found[2] != null ? Number(found[2]) : null } : null; }).filter(Boolean);
    if (parsed.length < 2) return null;
    parsed.forEach((stop, index) => { if (stop.at == null) stop.at = Math.round(index / (parsed.length - 1) * 100); });
    return { type, angle, stops: parsed };
  };
  const gradientCSS = ({ type, angle, stops }) => {
    const list = stops.map((stop) => `${stop.color} ${stop.at}%`).join(", ");
    return type === "linear" ? `linear-gradient(${angle}deg, ${list})` : type === "radial" ? `radial-gradient(circle at 50% 50%, ${list})` : `conic-gradient(from ${angle}deg at 50% 50%, ${list})`;
  };
  const GRADIENT_PRESETS = {
    sunset: { type: "linear", angle: 135, stops: [{ color: "#ff9a5b", at: 0 }, { color: "#ff3d7f", at: 55 }, { color: "#3b2bff", at: 100 }] },
    ocean: { type: "linear", angle: 160, stops: [{ color: "#0f2027", at: 0 }, { color: "#203a43", at: 50 }, { color: "#2c5364", at: 100 }] },
    mono: { type: "linear", angle: 180, stops: [{ color: "#ffffff", at: 0 }, { color: "#111111", at: 100 }] },
    fade: { type: "linear", angle: 180, stops: [{ color: "#ffffff", at: 0 }, { color: "rgba(255,255,255,0)", at: 100 }] },
    glow: { type: "radial", angle: 0, stops: [{ color: "#ffffff", at: 0 }, { color: "#ffd0c2", at: 40 }, { color: "#ff5a36", at: 100 }] },
  };
  const openGradientEditor = () => {
    const block = selected(); if (!block) return;
    if (block.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    const fieldNode = () => studio.querySelector('[data-color-field][data-field="background"]');
    const state = clone(parseGradient(block.background) || { type: "linear", angle: 135, stops: [{ color: isHexColor(block.background) ? block.background : "#4d5cff", at: 0 }, { color: "#ff5a36", at: 100 }] });
    const modal = openModal({ title: "배경 그라디언트", subtitle: "색 2~5개 · 각도·종류 · 바로 미리보기", body: `<div class="studio-gradient"><div class="studio-gradient__preview" data-gradient-preview></div><div class="studio-fields studio-fields--two"><label><span>종류</span><select data-gradient-type><option value="linear">선형</option><option value="radial">원형</option><option value="conic">원뿔 (각도로 도는)</option></select></label><label><span>각도 (°)</span><input data-gradient-angle type="number" min="0" max="360" step="1"></label></div><div data-gradient-stops></div><div class="studio-modal__actions studio-modal__actions--left"><button data-gradient-add type="button">＋ 색 추가</button><span class="studio-gradient__presets"><button data-gradient-preset="sunset" type="button">노을</button><button data-gradient-preset="ocean" type="button">바다</button><button data-gradient-preset="mono" type="button">흑백</button><button data-gradient-preset="fade" type="button">흰색→투명</button><button data-gradient-preset="glow" type="button">빛</button></span></div><div class="studio-modal__actions"><button data-gradient-clear type="button">그라디언트 없애기</button><button class="is-primary" data-gradient-apply type="button">닫기</button></div></div>` });
    const preview = modal.querySelector("[data-gradient-preview]"); const stopsNode = modal.querySelector("[data-gradient-stops]");
    const typeSelect = modal.querySelector("[data-gradient-type]"); const angleInput = modal.querySelector("[data-gradient-angle]");
    const apply = () => { const node = fieldNode(); if (!node) return; node.value = gradientCSS(state); node.dispatchEvent(new Event("input", { bubbles: true })); };
    const render = () => {
      typeSelect.value = state.type; angleInput.value = String(state.angle); angleInput.disabled = state.type === "radial";
      stopsNode.innerHTML = state.stops.map((stop, index) => `<div class="studio-gradient__stop"><input type="color" value="${isHexColor(stop.color) ? stop.color : "#000000"}" data-stop-color="${index}" aria-label="색 ${index + 1}"><input type="text" value="${escapeHTML(stop.color)}" data-stop-text="${index}" aria-label="색 값 ${index + 1}"><input type="range" min="0" max="100" value="${stop.at}" data-stop-at="${index}" aria-label="위치 ${index + 1}"><output>${stop.at}%</output><button data-stop-remove="${index}" type="button" ${state.stops.length <= 2 ? "disabled" : ""} aria-label="색 ${index + 1} 삭제">✕</button></div>`).join("");
      preview.style.background = gradientCSS(state);
    };
    modal.addEventListener("input", (event) => {
      const target = event.target;
      if (target === typeSelect) { state.type = target.value; render(); }
      else if (target === angleInput) { state.angle = number(target.value, state.angle, 0, 360); preview.style.background = gradientCSS(state); }
      else if (target.dataset.stopColor != null) { state.stops[target.dataset.stopColor].color = target.value; target.closest(".studio-gradient__stop").querySelector("[data-stop-text]").value = target.value; preview.style.background = gradientCSS(state); }
      else if (target.dataset.stopText != null) { const value = target.value.trim(); if (/^(#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|transparent$|[a-z]+$)/i.test(value)) { state.stops[target.dataset.stopText].color = value; if (isHexColor(value)) target.closest(".studio-gradient__stop").querySelector("[data-stop-color]").value = value; preview.style.background = gradientCSS(state); } else return; }
      else if (target.dataset.stopAt != null) { state.stops[target.dataset.stopAt].at = number(target.value, 0, 0, 100); target.nextElementSibling.textContent = `${state.stops[target.dataset.stopAt].at}%`; preview.style.background = gradientCSS(state); }
      else return;
      apply();
    });
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-gradient-add]")) { if (state.stops.length >= 5) { status("색은 5개까지예요"); return; } state.stops.push({ color: "#ffffff", at: 100 }); render(); apply(); return; }
      const remove = event.target.closest("[data-stop-remove]");
      if (remove) { state.stops.splice(Number(remove.dataset.stopRemove), 1); render(); apply(); return; }
      const preset = event.target.closest("[data-gradient-preset]")?.dataset.gradientPreset;
      if (preset && GRADIENT_PRESETS[preset]) { Object.assign(state, clone(GRADIENT_PRESETS[preset])); render(); apply(); return; }
      if (event.target.closest("[data-gradient-clear]")) { const node = fieldNode(); if (node) { node.value = "transparent"; node.dispatchEvent(new Event("input", { bubbles: true })); } modal.close(); return; }
      if (event.target.closest("[data-gradient-apply]")) { apply(); modal.close(); }
    });
    render(); apply();
  };

  // ===== Studio 8: 명령 팔레트(Ctrl+K) · 단축키 표(?) · 파일 메뉴 =====
  const clickAction = (selector) => () => { const button = studio.querySelector(selector); if (button) button.click(); else status("지금 화면에서는 쓸 수 없는 명령이에요"); };
  const paletteCommands = () => {
    const adds = [["text", "텍스트"], ["button", "버튼"], ["shape", "도형"], ["line", "선"], ["image", "이미지·GIF"], ["video", "영상"], ["audio", "오디오"], ["gallery", "갤러리"], ["embed", "임베드"], ["marquee", "반복 글자"], ["nav", "페이지 메뉴"], ["form", "폼 (연락)"], ["code", "코드 블록"]];
    return [
      ...adds.map(([type, label]) => ({ id: `add-${type}`, group: "추가", label: `${label} 추가`, keywords: type, run: () => addBlock(defaultBlock(type, currentPage())) })),
      { id: "add-templates", group: "추가", label: "섹션 템플릿…", hint: "히어로 · 그리드 · 소개 · 연락처", run: clickAction('[data-action="open-templates"]') },
      ...[...componentMetas.values()].filter((meta) => !meta.error).map((meta) => ({ id: `component-${meta.id}`, group: "컴포넌트", label: `${meta.name} 추가`, hint: String(meta.description || "").slice(0, 44), keywords: meta.id, run: clickAction(`[data-add-component="${meta.id}"]`) })),
      ...data.pages.map((page) => ({ id: `page-${page.id}`, group: "페이지", label: `${page.name} 열기`, hint: page.visibility === "listed" ? "메뉴 표시" : page.visibility === "unlisted" ? "링크 전용" : "초안", keywords: page.slug, run: () => selectPage(page.id) })),
      { id: "new-page", group: "페이지", label: "새 메뉴 페이지", run: () => createPage("listed") },
      { id: "new-unlisted", group: "페이지", label: "새 링크 전용 페이지", run: () => createPage("unlisted") },
      { id: "dup-page", group: "페이지", label: "현재 페이지 복제", run: () => { selectedId = ""; selectedIds = []; renderSelection(); studio.querySelector('[data-action="duplicate-page"]')?.click(); } },
      ...["desktop", "tablet", "mobile"].map((item) => ({ id: `layout-${item}`, group: "보기", label: `${LAYOUT_LABELS[item]} 배치 편집`, run: () => switchLayout(item) })),
      { id: "mode-design", group: "보기", label: "Design 모드", run: clickAction('[data-studio-mode="design"]') },
      { id: "mode-motion", group: "보기", label: "Motion 모드 (Motion Lab)", run: clickAction('[data-studio-mode="motion"]') },
      { id: "zoom-fit", group: "보기", label: "화면 맞춤", keys: "Ctrl+0", run: clickAction('[data-action="zoom-fit"]') },
      { id: "zoom-100", group: "보기", label: "100%로 보기", run: () => setZoom(1) },
      { id: "rulers", group: "보기", label: "눈금자·가이드 켜기/끄기", keys: "Ctrl+R", run: clickAction('[data-action="toggle-rulers"]') },
      { id: "device", group: "확인", label: "기기 미리보기 (폰·태블릿)", run: clickAction('[data-action="device-preview"]') },
      { id: "preview", group: "확인", label: "새 탭에서 미리보기", run: clickAction('[data-action="preview"]') },
      { id: "preflight", group: "확인", label: "검수 실행", run: clickAction('[data-action="preflight"]') },
      { id: "download", group: "파일", label: "백업 JSON 내려받기", run: clickAction('[data-action="download"]') },
      { id: "import", group: "파일", label: "JSON 불러오기", run: clickAction('[data-action="import"]') },
      { id: "reset", group: "파일", label: "게시본으로 되돌리기", run: clickAction('[data-action="reset-published"]') },
      { id: "publish", group: "파일", label: "게시 (GitHub 연결)…", keys: "Ctrl+Shift+P", run: () => openPublish() },
      { id: "checkpoint-save", group: "파일", label: "체크포인트 저장", keys: "Ctrl+Shift+S", run: () => quickCheckpoint() },
      { id: "checkpoints", group: "파일", label: "체크포인트 목록…", run: () => openCheckpoints() },
      { id: "page-templates", group: "페이지", label: "템플릿으로 새 페이지…", run: () => openTemplates("pages") },
      { id: "select-all", group: "선택", label: "모두 선택", keys: "Ctrl+A", run: () => selectAll() },
      { id: "deselect", group: "선택", label: "선택 해제 · 페이지 설정 보기", keys: "Esc", run: () => { selectedId = ""; selectedIds = []; renderSelection(); } },
      { id: "theme", group: "보기", label: "편집기 다크 / 라이트 전환", keys: "Ctrl+Shift+D", run: () => setEditorTheme(!studio.classList.contains("is-dark")) },
      { id: "tab-insert", group: "보기", label: "왼쪽 패널: 추가", run: () => setLeftTab("insert") },
      { id: "tab-layers", group: "보기", label: "왼쪽 패널: 레이어·페이지", run: () => setLeftTab("layers") },
      { id: "tab-assets", group: "보기", label: "왼쪽 패널: 자산", run: () => setLeftTab("assets") },
      { id: "tab-settings", group: "보기", label: "왼쪽 패널: 사이트 설정", run: () => setLeftTab("settings") },
      { id: "shortcuts", group: "도움", label: "단축키 표", keys: "?", run: () => openShortcuts() },
    ];
  };
  const openPalette = () => { finishTextEdit(); closeContextMenu(); openCommandPalette({ commands: paletteCommands() }); };
  const openShortcuts = () => { closeContextMenu(); openModal({ title: "단축키", subtitle: "Studio 8", body: shortcutSheetMarkup(), wide: true }); };
  const openFileMenu = (anchor) => {
    const rect = anchor.getBoundingClientRect();
    openContextMenu([
      { id: "file-download", label: "백업 JSON 내려받기" },
      { id: "file-import", label: "JSON 불러오기" },
      "-",
      { id: "checkpoints", label: "체크포인트…", keys: "Ctrl+Shift+S" },
      "-",
      { id: "publish-modal", label: "게시 (GitHub 연결)…", keys: "Ctrl+Shift+P" },
      { id: "file-publish-copy", label: "게시 · 복사해서 GitHub에 붙여넣기" },
      { id: "file-reset", label: "게시본으로 되돌리기" },
    ], rect.left, rect.bottom + 4);
  };

  studio.addEventListener("contextmenu", (event) => {
    if (studioMode !== "design") return;
    if (textEditing && event.target.closest(".is-text-editing")) return;
    const blockElement = event.target.closest(".canvas-block");
    const layer = event.target.closest("[data-select]");
    const onCanvas = event.target.matches("[data-archive-canvas]");
    if (!blockElement && !layer && !onCanvas) return;
    event.preventDefault();
    finishTextEdit();
    if (blockElement || layer) {
      const id = blockElement ? blockElement.dataset.blockId : layer.dataset.select;
      syncSelection();
      if (!selectedIds.includes(id)) { setSelection([id]); renderSelection(); }
      const block = selected(); const blocks = selectedBlocks(); const many = blocks.length > 1;
      const allLocked = blocks.every((item) => item.locked); const anyVisible = blocks.some((item) => item.visible);
      openContextMenu([
        ...(!many && ["text", "button"].includes(block.type) ? [{ id: "edit-text", label: "글자 편집", keys: "Enter · 더블클릭", disabled: block.locked }] : []),
        { id: "duplicate", label: many ? `${blocks.length}개 복제` : "복제", keys: "Ctrl+D", disabled: allLocked },
        { id: "copy", label: "복사", keys: "Ctrl+C" },
        { id: "cut", label: "잘라내기", keys: "Ctrl+X", disabled: allLocked },
        { id: "paste", label: "붙여넣기", keys: "Ctrl+V" },
        "-",
        { id: "forward", label: "한 칸 앞으로", keys: "Ctrl+]", disabled: many }, { id: "backward", label: "한 칸 뒤로", keys: "Ctrl+[", disabled: many },
        { id: "front", label: "맨 앞으로", keys: "Ctrl+Shift+]", disabled: many }, { id: "back", label: "맨 뒤로", keys: "Ctrl+Shift+[", disabled: many },
        "-",
        { id: "align-center", label: many ? "가로 가운데 정렬" : "캔버스 가로 가운데", disabled: allLocked }, { id: "align-middle", label: many ? "세로 가운데 정렬" : "첫 화면 세로 가운데", disabled: allLocked },
        "-",
        { id: "lock", label: allLocked ? "잠금 해제" : "잠금", keys: "Ctrl+Shift+L" },
        { id: "hide", label: anyVisible ? "숨기기" : "표시", keys: "Ctrl+Shift+H", disabled: allLocked },
        { id: "rename", label: "이름 바꾸기", keys: "레이어 더블클릭", disabled: many },
        { id: "global", label: isGlobalBlock(block) ? "이 페이지에만 표시" : "모든 페이지에 표시", disabled: many || block.locked },
        "-",
        { id: "delete", label: many ? `${blocks.length}개 삭제` : "삭제", keys: "Delete", disabled: allLocked },
      ], event.clientX, event.clientY);
      return;
    }
    openContextMenu([
      { id: "paste", label: "붙여넣기", keys: "Ctrl+V" },
      { id: "select-all", label: "모두 선택", keys: "Ctrl+A" },
      "-",
      { id: "page-settings", label: "페이지 설정 보기" },
    ], event.clientX, event.clientY);
  });
  const closeMenusOnOutside = (event) => { if (!event.target.closest(".studio-context-menu")) closeContextMenu(); if (!event.target.closest(".studio-font-picker, [data-font-pick]")) closeFontPicker(); };
  addEventListener("pointerdown", closeMenusOnOutside, true);
  addEventListener("blur", closeContextMenu);

  // ===== Studio 7: 레이어 패널 — 드래그로 순서, 더블클릭 이름, 검색 =====
  let layerDragId = "";
  const layerList = studio.querySelector("[data-layer-list]");
  const startLayerRename = (layer) => {
    const block = allBlocks().find((item) => item.id === layer.dataset.select);
    const label = layer.querySelector("em");
    if (!block || !label || layer.querySelector("input")) return;
    const input = document.createElement("input");
    input.type = "text"; input.value = block.name; input.className = "studio-layer__rename"; input.setAttribute("aria-label", "레이어 이름");
    label.replaceChildren(input);
    let finished = false;
    const done = (save) => {
      if (finished) return; finished = true;
      if (save && input.value.trim() && input.value.trim() !== block.name) { block.name = input.value.trim().slice(0, 60); persist(); }
      input.remove(); label.textContent = block.name; renderSelection();
    };
    input.addEventListener("keydown", (event) => { event.stopPropagation(); if (event.key === "Enter") done(true); if (event.key === "Escape") done(false); });
    input.addEventListener("blur", () => done(true));
    input.addEventListener("click", (event) => event.stopPropagation());
    input.focus(); input.select();
  };
  layerList?.addEventListener("dragstart", (event) => {
    const layer = event.target.closest("[data-select]");
    if (!layer || layer.querySelector("input")) { event.preventDefault(); return; }
    layerDragId = layer.dataset.select;
    event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", layerDragId);
    layer.classList.add("is-dragging");
  });
  layerList?.addEventListener("dragover", (event) => {
    if (!layerDragId) return;
    const layer = event.target.closest("[data-select]");
    if (!layer) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "move";
    const rect = layer.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    layerList.querySelectorAll(".is-drop-before, .is-drop-after").forEach((node) => node.classList.remove("is-drop-before", "is-drop-after"));
    layer.classList.add(before ? "is-drop-before" : "is-drop-after");
  });
  layerList?.addEventListener("dragleave", (event) => { if (!layerList.contains(event.relatedTarget)) layerList.querySelectorAll(".is-drop-before, .is-drop-after").forEach((node) => node.classList.remove("is-drop-before", "is-drop-after")); });
  layerList?.addEventListener("drop", (event) => {
    const layer = event.target.closest("[data-select]");
    if (!layerDragId || !layer) return;
    event.preventDefault();
    const targetId = layer.dataset.select;
    const before = layer.classList.contains("is-drop-before");
    const dragged = allBlocks().find((item) => item.id === layerDragId);
    layerDragId = "";
    if (!dragged || targetId === dragged.id) { renderLayers(); return; }
    // 패널은 위가 앞(z 큰 순). 끌어다 놓은 자리로 옮기고 z를 다시 매긴다.
    const order = allBlocks().sort((a, b) => b.z - a.z).filter((item) => item.id !== dragged.id);
    const targetIndex = order.findIndex((item) => item.id === targetId);
    order.splice(before ? targetIndex : targetIndex + 1, 0, dragged);
    order.forEach((item, index) => { item.z = order.length - index; });
    setSelection([dragged.id]); persist(); renderSelection(); status(`‘${dragged.name}’ 순서를 바꿨어요`);
  });
  layerList?.addEventListener("dragend", () => { layerDragId = ""; layerList.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach((node) => node.classList.remove("is-dragging", "is-drop-before", "is-drop-after")); });
  studio.querySelector("[data-layer-search]")?.addEventListener("input", (event) => { layerFilter = event.target.value; renderLayers(); });

  // ===== Studio 7: 폰트 고르기 =====
  const closeFontPicker = () => document.querySelector(".studio-font-picker")?.remove();
  const ensureFontPreviewStylesheet = () => {
    if (document.querySelector("#archive-font-preview")) return;
    const link = document.createElement("link");
    link.id = "archive-font-preview"; link.rel = "stylesheet"; link.href = googleFontsHref(FONT_LIBRARY.filter((font) => font.google).map((font) => font.name));
    document.head.append(link);
  };
  const fontsInUse = () => {
    const families = new Map();
    [...data.pages.flatMap((page) => page.blocks), ...data.globals].filter((block) => ["text", "button", "marquee", "nav"].includes(block.type)).forEach((block) => families.set(block.fontFamily, (families.get(block.fontFamily) || 0) + 1));
    return [...families.entries()].sort((a, b) => b[1] - a[1]).map(([family]) => family);
  };
  const fontItem = (font) => `<button data-font-choose="${escapeHTML(font.family)}" data-font-google="${escapeHTML(font.google ? font.name : "")}" style="font-family:${escapeHTML(font.family)}" type="button"><strong>${escapeHTML(font.name)}</strong><small>${font.sample || (font.lang === "ko" ? "가나다라 한글 Abc 123" : "The quick brown fox 123")}</small></button>`;
  const openFontPicker = (anchor) => {
    if (document.querySelector(".studio-font-picker")) { closeFontPicker(); return; }
    ensureFontPreviewStylesheet();
    const current = selected()?.fontFamily || "";
    const used = fontsInUse().map((family) => FONT_LIBRARY.find((font) => font.family === family) || { name: family.split(",")[0].replace(/["']/g, "").trim(), family, lang: /[가-힣]/.test(family) ? "ko" : "en" });
    const section = (title, fonts) => fonts.length ? `<p class="studio-font-picker__label">${title}</p>${fonts.map(fontItem).join("")}` : "";
    const panel = document.createElement("div");
    panel.className = "studio-font-picker"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "폰트 고르기");
    panel.innerHTML = `<div class="studio-font-picker__head"><input type="search" data-font-search placeholder="폰트 이름 검색 (예: Noto, 명조, Mono)" aria-label="폰트 검색"><button data-font-close type="button" aria-label="닫기">✕</button></div><div class="studio-font-picker__list">${section("이 사이트에서 쓰는 폰트", used)}${section("한글", FONT_LIBRARY.filter((font) => font.lang === "ko"))}${section("영문 · 제목용", FONT_LIBRARY.filter((font) => font.lang === "en" && font.role === "display"))}${section("영문 · 본문용", FONT_LIBRARY.filter((font) => font.lang === "en" && font.role === "text"))}${section("기본 (설치된 폰트)", FONT_LIBRARY.filter((font) => !font.google))}</div><p class="studio-font-picker__help">구글 폰트는 고르면 사이트에 자동으로 불러와요. 직접 입력란에는 CSS font-family 값(예: "Pretendard", sans-serif)을 넣고, 웹폰트 CSS 주소는 페이지 설정에 넣으세요.</p>`;
    document.body.append(panel);
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, innerWidth - 16);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(rect.right - width, innerWidth - width - 8))}px`;
    const top = rect.bottom + 6; const height = panel.offsetHeight;
    panel.style.top = `${top + height > innerHeight - 8 ? Math.max(8, rect.top - height - 6) : top}px`;
    panel.querySelectorAll("[data-font-choose]").forEach((button) => button.classList.toggle("is-current", button.dataset.fontChoose === current));
    const search = panel.querySelector("[data-font-search]");
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      panel.querySelectorAll("[data-font-choose]").forEach((button) => { button.hidden = Boolean(query) && !button.textContent.toLowerCase().includes(query) && !button.dataset.fontChoose.toLowerCase().includes(query); });
      panel.querySelectorAll(".studio-font-picker__label").forEach((label) => { let node = label.nextElementSibling; let visible = false; while (node && !node.classList.contains("studio-font-picker__label")) { if (!node.hidden) visible = true; node = node.nextElementSibling; } label.hidden = !visible; });
    });
    search.addEventListener("keydown", (event) => { event.stopPropagation(); if (event.key === "Escape") closeFontPicker(); });
    panel.querySelector("[data-font-close]").addEventListener("click", closeFontPicker);
    // 패널은 body에 붙어 있어서 studio의 click 리스너가 받지 못한다 — 여기서 직접 처리.
    panel.addEventListener("click", (event) => { const choose = event.target.closest("[data-font-choose]"); if (choose) chooseFont(choose.dataset.fontChoose, choose.dataset.fontGoogle || ""); });
    search.focus();
  };
  const chooseFont = (family, googleName = "") => {
    const targets = selectedBlocks().filter((block) => ["text", "button", "marquee", "nav"].includes(block.type) && !block.locked);
    if (!targets.length) { status("글자 요소를 먼저 선택하세요"); closeFontPicker(); return; }
    targets.forEach((block) => { block.fontFamily = family; });
    if (googleName && !data.settings.fonts.includes(googleName)) data.settings.fonts.push(googleName);
    closeFontPicker(); persist(); renderSelection();
    status(`${targets.length > 1 ? `${targets.length}개에 ` : ""}${googleName || family.split(",")[0].replace(/["']/g, "")} 적용${googleName ? " · 구글 폰트를 자동으로 불러와요" : ""}`);
  };

  studio.addEventListener("click", async (event) => {
    closeContextMenu();
    if (event.target.matches("[data-archive-canvas]")) {
      // 러버밴드 드래그 직후에 따라오는 click은 무시한다 (드래그가 아니라 클릭일 때만 선택 해제).
      if (performance.now() - suppressCanvasClick < 400) { suppressCanvasClick = 0; return; }
      finishTextEdit(); selectedId = ""; selectedIds = []; renderSelection(); return;
    }
    const leftTab = event.target.closest("[data-left-tab]");
    if (leftTab) { setLeftTab(leftTab.dataset.leftTab); return; }
    const assetSelect = event.target.closest("[data-asset-select]");
    if (assetSelect) { const asset = assetAt(assetSelect.dataset.assetSelect); if (asset) selectAssetUse(asset); return; }
    const assetInsert = event.target.closest("[data-asset-insert]");
    if (assetInsert) { const asset = assetAt(assetInsert.dataset.assetInsert); if (asset) insertAsset(asset); return; }
    const assetReplace = event.target.closest("[data-asset-replace]");
    if (assetReplace) {
      const asset = assetAt(assetReplace.dataset.assetReplace); if (!asset) return;
      const next = prompt(`이 파일을 쓰는 ${asset.uses.length}곳을 모두 바꿔요.\n새 주소 또는 /media/파일명:`, asset.url.startsWith("data:") ? "" : asset.url);
      if (next != null) replaceAsset(asset, next); return;
    }
    const swatch = event.target.closest("[data-swatch]");
    if (swatch) { applyColorToActiveField(swatch.dataset.swatch); return; }
    if (event.target.closest("[data-eyedropper]")) {
      if (typeof EyeDropper !== "function") { status("이 브라우저는 스포이트를 지원하지 않아요 (Chrome·Edge 권장)"); return; }
      try { const picked = await new EyeDropper().open(); applyColorToActiveField(picked.sRGBHex); } catch (error) { /* 취소 */ }
      return;
    }
    const alignButton = event.target.closest("[data-align]");
    if (alignButton) { alignSelected(alignButton.dataset.align); return; }
    const distributeButton = event.target.closest("[data-distribute]");
    if (distributeButton) { distributeSelected(distributeButton.dataset.distribute); return; }
    const fontPick = event.target.closest("[data-font-pick]");
    if (fontPick) { openFontPicker(fontPick); return; }
    const fontChoose = event.target.closest("[data-font-choose]");
    if (fontChoose) { chooseFont(fontChoose.dataset.fontChoose, fontChoose.dataset.fontGoogle || ""); return; }
    const menuItem = event.target.closest("[data-menu]");
    if (menuItem) { runContextAction(menuItem.dataset.menu); return; }
    const layoutButton = event.target.closest("[data-studio-layout]");
    if (layoutButton) { switchLayout(layoutButton.dataset.studioLayout); return; }
    const componentButton = event.target.closest("[data-add-component]");
    if (componentButton) {
      if (!componentButton.dataset.addComponent) { setLeftTab("insert"); studio.querySelector("[data-component-library]")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
      const meta = componentMetas.get(componentButton.dataset.addComponent);
      if (!meta) return;
      const page = currentPage();
      const block = defaultBlock("component", page);
      const width = Math.min(meta.defaultSize.width, page.canvas.width);
      Object.assign(block, { component: meta.id, name: `${meta.name} ${page.blocks.length + 1}`, props: resolveProps(meta, {}), width, height: meta.defaultSize.height, x: Math.round((page.canvas.width - width) / 2) });
      addBlock(block); status(`${meta.name} 추가 · 오른쪽에서 값을 바꿔보세요`); return;
    }
    const modeButton = event.target.closest("[data-studio-mode]");
    if (modeButton) {
      studioMode = modeButton.dataset.studioMode === "motion" ? "motion" : "design";
      studio.querySelector(".archive-studio__center")?.classList.toggle("is-motion-mode", studioMode === "motion");
      studio.querySelectorAll("[data-studio-mode]").forEach((button) => { const active = button.dataset.studioMode === studioMode; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
      if (studioMode === "motion" && !selectedId) selectedId = currentPage().blocks.find((block) => block.motion.timeline.enabled)?.id || currentPage().blocks[0]?.id || "";
      selectedMotionFrameId = selected()?.motion.timeline.keyframes[0]?.id || selectedMotionFrameId;
      renderSelection();
      studio.querySelector("[data-inspector]")?.scrollTo?.({ top: 0, behavior: "smooth" });
      status(studioMode === "motion" ? "Motion Lab · 타임라인을 드래그해 확인하세요" : "Design 모드 · 배치와 콘텐츠 편집");
      return;
    }
    const dockLayer = event.target.closest("[data-motion-dock-select]");
    if (dockLayer) { selectBlock(dockLayer.dataset.motionDockSelect); return; }
    const dockFrame = event.target.closest("[data-motion-dock-frame]");
    if (dockFrame) {
      selectedId = dockFrame.dataset.motionDockBlock;
      selectedMotionFrameId = dockFrame.dataset.motionDockFrame;
      motionPlayhead = selected()?.motion.timeline.keyframes.find((frame) => frame.id === selectedMotionFrameId)?.at || 0;
      renderSelection();
      return;
    }
    const addTrack = event.target.closest("[data-motion-add-track]");
    if (addTrack) {
      selectedId = addTrack.dataset.motionAddTrack;
      const block = selected();
      if (block?.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      enableEmptyMotion(block); persist(); renderSelection(); return;
    }
    const motionPreset = event.target.closest("[data-motion-preset]");
    if (motionPreset && selected()) {
      if (selected().locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      applyMotionPreset(selected(), motionPreset.dataset.motionPreset); persist(); renderSelection(); status(`${MOTION_LAB_PRESETS[motionPreset.dataset.motionPreset]?.label || "Motion"} 프리셋 적용`); return;
    }
    const motionFrameSelect = event.target.closest("[data-motion-frame-select]");
    if (motionFrameSelect) {
      selectedMotionFrameId = motionFrameSelect.dataset.motionFrameSelect;
      motionPlayhead = selectedMotionFrame()?.at || 0;
      renderInspector(); renderMotionDock(); scrubStudioMotion(motionPlayhead); return;
    }
    if (event.target.closest("[data-motion-empty]") && selected()) {
      if (selected().locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      enableEmptyMotion(selected()); persist(); renderSelection(); return;
    }
    if (event.target.closest("[data-motion-frame-add]") || event.target.closest("[data-motion-frame-copy]")) {
      if (selected()?.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      addMotionKeyframe({ copyCurrent: Boolean(event.target.closest("[data-motion-frame-copy]")) }); persist(); renderSelection(); return;
    }
    if (event.target.closest("[data-motion-frame-duplicate]") && selectedMotionFrame()) {
      if (selected()?.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      addMotionKeyframe({ copyCurrent: true }); persist(); renderSelection(); return;
    }
    if (event.target.closest("[data-motion-frame-delete]") && selectedMotionFrame()) {
      const timeline = selectedTimeline();
      if (selected()?.locked || timeline.keyframes.length <= 2) return;
      const index = timeline.keyframes.findIndex((frame) => frame.id === selectedMotionFrameId);
      timeline.keyframes.splice(index, 1);
      selectedMotionFrameId = timeline.keyframes[Math.max(0, index - 1)]?.id || "";
      motionPlayhead = selectedMotionFrame()?.at || 0;
      persist(); renderSelection(); return;
    }
    if (event.target.closest("[data-motion-preview]")) { playStudioMotion({ onlySelected: true }); return; }
    if (event.target.closest("[data-motion-stop]") || event.target.closest("[data-motion-page-stop]")) { clearStudioMotion(); scrubStudioMotion(0); status("모션 정지"); return; }
    if (event.target.closest("[data-motion-page-restart]")) { playStudioMotion({ restart: true }); return; }
    if (event.target.closest("[data-motion-page-play]")) { playStudioMotion({ restart: false }); return; }
    if (event.target.closest("[data-motion-stagger]")) {
      const blocks = currentPage().blocks.filter((block) => block.visible && !block.locked).sort((a, b) => a.y - b.y || a.x - b.x);
      if (!blocks.length) { status("순차 등장시킬 레이어가 없어요"); return; }
      if (blocks.some((block) => block.motion.timeline.enabled) && !confirm("현재 페이지의 기존 Motion Lab 트랙을 순차 등장 모션으로 바꿀까요?")) return;
      blocks.forEach((block, index) => applyMotionPreset(block, "fade-up", index * 120));
      selectedId = blocks[0].id; selectedMotionFrameId = blocks[0].motion.timeline.keyframes[0]?.id || ""; motionPlayhead = 0;
      persist(); renderSelection(); status(`${blocks.length}개 레이어에 순차 등장 적용`); return;
    }
    const pageButton = event.target.closest("[data-page-select]");
    if (pageButton) { selectPage(pageButton.dataset.pageSelect); return; }
    const pageMove = event.target.closest("[data-page-move]");
    if (pageMove) {
      const index = data.pages.findIndex((page) => page.id === pageMove.dataset.pageId);
      const page = data.pages[index];
      const groupIndexes = data.pages.map((item, itemIndex) => item.visibility === page?.visibility ? itemIndex : -1).filter((itemIndex) => itemIndex >= 0);
      const groupPosition = groupIndexes.indexOf(index);
      const targetPosition = pageMove.dataset.pageMove === "up" ? groupPosition - 1 : groupPosition + 1;
      const target = groupIndexes[targetPosition];
      if (index >= 0 && target != null) [data.pages[index], data.pages[target]] = [data.pages[target], data.pages[index]];
      persist(); renderSelection({ pages: true }); return;
    }
    const navPageMove = event.target.closest("[data-nav-page-move]");
    if (navPageMove) {
      const block = selected();
      if (!block || block.type !== "nav" || block.locked) return;
      const index = block.navPageIds.indexOf(navPageMove.dataset.navPageId);
      const target = navPageMove.dataset.navPageMove === "up" ? index - 1 : index + 1;
      if (index >= 0 && target >= 0 && target < block.navPageIds.length) [block.navPageIds[index], block.navPageIds[target]] = [block.navPageIds[target], block.navPageIds[index]];
      persist(); renderCanvas(); renderInspector(); return;
    }
    const preset = event.target.closest("[data-button-preset]")?.dataset.buttonPreset;
    if (preset && selected()?.type === "button") {
      const block = selected();
      if (block.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      if (preset === "square") Object.assign(block, { borderRadius: 0, background: "#111111", color: "#ffffff", borderWidth: 0, width: 220, height: 64 });
      if (preset === "round") Object.assign(block, { borderRadius: 12, background: "#111111", color: "#ffffff", borderWidth: 0, width: 220, height: 64 });
      if (preset === "pill") Object.assign(block, { borderRadius: 999, background: "#111111", color: "#ffffff", borderWidth: 0, width: 240, height: 64 });
      if (preset === "circle") Object.assign(block, { borderRadius: 999, background: "#111111", color: "#ffffff", borderWidth: 0, width: 120, height: 120 });
      if (preset === "outline") Object.assign(block, { borderRadius: 0, background: "transparent", color: "#111111", borderColor: "#111111", borderWidth: 1, width: 220, height: 64 });
      persist(); renderSelection(); return;
    }
    const add = event.target.closest("[data-add]");
    if (add) { addBlock(defaultBlock(add.dataset.add, currentPage())); return; }
    const layer = event.target.closest("[data-select]");
    if (layer) {
      if (layer.querySelector("input")) return; // 이름 바꾸는 중
      if (event.shiftKey && studioMode === "design") { toggleSelection(layer.dataset.select); renderSelection(); return; }
      selectBlock(layer.dataset.select); return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const block = selected();
    if (action === "zoom-in") { setZoom(zoom * 1.25); status(`확대 ${Math.round(zoom * 100)}%`); return; }
    if (action === "zoom-out") { setZoom(zoom / 1.25); status(`확대 ${Math.round(zoom * 100)}%`); return; }
    if (action === "zoom-fit") { fitZoom(); applyZoom(); status(`화면 맞춤 · ${Math.round(zoom * 100)}%`); return; }
    if (action === "command-palette") { openPalette(); return; }
    if (action === "open-templates") { openTemplates(); return; }
    if (action === "checkpoints") { openCheckpoints(); return; }
    if (action === "publish") { openPublish(); return; }
    if (action === "toggle-rulers") { setRulers(!rulersOn); return; }
    if (action === "toggle-editor-theme") { setEditorTheme(!studio.classList.contains("is-dark")); return; }
    if (action === "toggle-columns") { setColumns(!columnsOn); return; }
    if (action === "clear-guides") { currentPage().guides = { v: [], h: [] }; persist(); renderPageGuides(); renderInspector(); status("가이드를 모두 지웠어요"); return; }
    if (action === "shortcuts") { openShortcuts(); return; }
    if (action === "file-menu") { openFileMenu(event.target.closest("[data-action]")); return; }
    if (action === "lock-selected") { setLockedSelected(!selectedBlocks().every((item) => item.locked)); return; }
    if (action === "hide-selected") { setHiddenSelected(selectedBlocks().some((item) => item.visible)); return; }
    if (action === "copy-selected") { copySelected(); return; }
    if (isMultiSelection() && ["delete", "duplicate", "front", "back"].includes(action)) {
      if (action === "delete") deleteSelected();
      else if (action === "duplicate") duplicateSelected();
      else {
        const movable = selectedBlocks().filter((item) => !item.locked).sort((a, b) => a.z - b.z);
        if (action === "front") { let z = Math.max(0, ...allBlocks().map((item) => item.z)); movable.forEach((item) => { item.z = ++z; }); }
        else { let z = Math.max(0, Math.min(...allBlocks().map((item) => item.z)) - movable.length); movable.forEach((item) => { item.z = z++; }); }
        persist(); renderSelection(); status(action === "front" ? `${movable.length}개를 앞으로` : `${movable.length}개를 뒤로`);
      }
      return;
    }
    if (block?.locked && ["delete", "duplicate", "front", "back", "pick-image", "pick-button-image", "upload-media", "upload-video", "upload-audio", "layout-reset-block"].includes(action)) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    if (action === "layout-create") {
      createLayout(layout, event.target.closest("[data-mode]")?.dataset.mode === "scale" ? "scale" : "stack");
    } else if (action === "layout-open") {
      switchLayout(event.target.closest("[data-layout]")?.dataset.layout);
    } else if (action === "layout-regenerate") {
      const target = event.target.closest("[data-layout]")?.dataset.layout;
      if (!target || !confirm(`${LAYOUT_LABELS[target]} 배치를 데스크톱에서 다시 자동 정렬할까요? 이 화면에서 손으로 바꾼 위치·크기는 사라져요.`)) return;
      createLayout(target, "stack");
    } else if (action === "layout-disable") {
      const target = event.target.closest("[data-layout]")?.dataset.layout;
      if (!target || !confirm(`${LAYOUT_LABELS[target]} 배치를 끌까요? 값은 남아 있어서 다시 켜면 돌아와요.`)) return;
      currentPage().layouts[target].enabled = false;
      if (layout === target) layout = "desktop";
      persist(); fitZoom(); renderSelection({ pages: true });
    } else if (action === "layout-reset-block" && block) {
      clearOverrides(block, activeLayout()); persist(); renderSelection(); status("이 요소를 데스크톱 값으로 되돌렸어요");
    } else if (action === "device-preview") {
      openDevicePreview();
    } else if (action === "add-page" || action === "nav-add-page") {
      createPage("listed");
    } else if (action === "add-unlisted-page") {
      createPage("unlisted");
    } else if (action === "set-home") {
      if (currentPage().visibility === "draft") { alert("초안 페이지는 홈으로 지정할 수 없어요. 먼저 공개 또는 링크 전용으로 바꿔주세요."); return; }
      data.settings.defaultPageId = activePageId; persist(); renderSelection({ pages: true });
    } else if (action === "duplicate-page") {
      const original = currentPage();
      const page = clone(original); const idMap = new Map();
      page.id = uid("page"); page.name = `${original.name} copy`; page.slug = `${original.slug}-copy`; page.visibility = "unlisted"; page.seo.noIndex = true;
      page.blocks.forEach((item) => { const old = item.id; item.id = uid(item.type); idMap.set(old, item.id); if (item.anchorId && idMap.has(item.anchorId)) item.anchorId = idMap.get(item.anchorId); });
      page.blocks.forEach((item) => { if (item.anchorId && idMap.has(item.anchorId)) item.anchorId = idMap.get(item.anchorId); if (item.action.type === "page" && item.action.pageId === original.id) item.action.pageId = page.id; if (["anchor", "page"].includes(item.action.type) && idMap.has(item.action.anchorId)) item.action.anchorId = idMap.get(item.action.anchorId); });
      data.pages.splice(data.pages.findIndex((item) => item.id === original.id) + 1, 0, page); activePageId = page.id; selectedId = page.blocks[0]?.id || ""; persist(); renderSelection({ pages: true });
    } else if (action === "delete-page") {
      if (data.pages.length === 1) { alert("마지막 페이지는 삭제할 수 없어요."); return; }
      if (activePageId === data.settings.defaultPageId) { alert("홈페이지를 먼저 다른 페이지로 지정해주세요."); return; }
      const inbound = data.pages.flatMap((page) => page.blocks).filter((item) => item.action.type === "page" && item.action.pageId === activePageId).length;
      if (!confirm(`${currentPage().name} 페이지를 삭제할까요?${inbound ? ` 이 페이지로 연결된 버튼 ${inbound}개가 있어요.` : ""}`)) return;
      const index = data.pages.findIndex((page) => page.id === activePageId); data.pages.splice(index, 1); activePageId = data.pages[Math.max(0, index - 1)].id; selectedId = currentPage().blocks[0]?.id || ""; persist(); renderSelection({ pages: true });
    } else if (action === "delete" && block) {
      const container = containerOf(block); container.splice(container.findIndex((item) => item.id === block.id), 1); selectedId = currentPage().blocks.at(-1)?.id || ""; persist(); renderSelection();
    } else if (action === "duplicate" && block) duplicateBlock(block);
    else if ((action === "front" || action === "back") && block) {
      block.z = action === "front" ? Math.max(0, ...allBlocks().map((item) => item.z)) + 1 : Math.max(0, Math.min(...allBlocks().map((item) => item.z)) - 1); persist(); renderSelection();
    } else if (action === "pick-image" && block?.type === "image") {
      studio.querySelector("[data-image-picker]").dataset.target = "image"; studio.querySelector("[data-image-picker]").click();
    } else if (action === "pick-mask-image" && block) {
      studio.querySelector("[data-image-picker]").dataset.target = "mask"; studio.querySelector("[data-image-picker]").click();
    } else if (action === "gradient-edit" && block) {
      openGradientEditor();
    } else if (action === "pick-button-image" && block?.type === "button") {
      studio.querySelector("[data-image-picker]").dataset.target = "button"; studio.querySelector("[data-image-picker]").click();
    } else if (["upload-media", "upload-video", "upload-audio"].includes(action)) {
      window.open(GITHUB_MEDIA_UPLOAD_URL, "_blank", "noopener"); status("업로드 후 /media/파일명을 해당 경로 칸에 입력하세요");
    } else if (action === "undo") restoreHistory(historyIndex - 1);
    else if (action === "redo") restoreHistory(historyIndex + 1);
    else if (action === "preflight") {
      const warnings = runPreflight(data); alert(warnings.length ? `게시 전 확인 ${warnings.length}개\n\n• ${warnings.join("\n• ")}` : "검수 완료! 필수 오류를 찾지 못했어요."); status(warnings.length ? `검수: 확인할 항목 ${warnings.length}개` : "검수 통과");
    } else if (action === "preview") {
      saveDraft(data, published, draftBase); const page = currentPage(); const params = new URLSearchParams({ view: "archive", draft: "1" }); if (page.id !== data.settings.defaultPageId) params.set("page", page.slug); window.open(`?${params}`, "_blank", "noopener");
    } else if (action === "import") studio.querySelector("[data-json-picker]").click();
    else if (action === "reset-published") {
      if (!confirm("브라우저에 저장된 작업을 버리고 현재 게시본으로 되돌릴까요? 먼저 백업을 권장해요.")) return;
      data = clone(published); activePageId = data.settings.defaultPageId; selectedId = ""; layout = "desktop"; historyStack = [JSON.stringify(data)]; historyIndex = 0; draftBase = fingerprint(published); draftConflict = false; saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true }); status("현재 게시본으로 되돌렸어요");
    }
    else if (action === "download") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "archive-v5-studio.json"; link.click(); URL.revokeObjectURL(link.href);
    } else if (action === "publish-copy") {
      if (draftConflict && !confirm("GitHub의 현재 게시본이 이 로컬 초안을 만든 뒤 변경됐어요. 먼저 JSON 백업을 저장하고 차이를 확인하는 것이 안전해요. 그래도 게시 준비를 계속할까요?")) return;
      window.open(GITHUB_EDIT_URL, "_blank", "noopener");
      try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); status("복사 완료 — 열린 GitHub에서 전체 붙여넣고 Commit changes"); } catch (error) { status("백업 버튼으로 JSON을 받은 뒤 GitHub에서 교체하세요"); }
    }
  });

  studio.addEventListener("input", (event) => {
    if (event.target.matches("[data-motion-scrub]")) { scrubStudioMotion(number(event.target.value, 0, 0, 100)); return; }
    // Studio 8 (B17): 색 고르기 ↔ 글자 칸 동기화
    if (event.target.matches("[data-color-twin]")) {
      const text = event.target.closest(".studio-color__row")?.querySelector("[data-field]");
      if (!text) return;
      text.value = event.target.value; text.dispatchEvent(new Event("input", { bubbles: true })); return;
    }
    if (event.target.matches("[data-color-field]")) {
      lastColorField = event.target.dataset.field;
      const twin = event.target.closest(".studio-color__row")?.querySelector("[data-color-twin]");
      if (twin && isHexColor(event.target.value)) twin.value = event.target.value.trim();
    }
    // Studio 7: 다중 선택 패널의 공통 값
    const multiInput = event.target.closest("[data-multi-field]");
    if (multiInput) {
      const key = multiInput.dataset.multiField;
      const targets = selectedBlocks().filter((block) => !block.locked && (key !== "fontFamily" || ["text", "button", "marquee", "nav"].includes(block.type)));
      if (!targets.length) return;
      targets.forEach((block) => {
        if (key === "fontFamily") block.fontFamily = cssText(multiInput.value, block.fontFamily);
        else if (OVERRIDE_KEYS.includes(key) && activeLayout() !== "desktop") setLayoutValue(block, key, number(multiInput.value, view(block)[key]));
        else block[key] = number(multiInput.value, block[key]);
      });
      persist(); renderCanvas(); renderLayers(); return;
    }
    const formField = event.target.closest("[data-form-field]");
    if (formField) {
      const block = selected();
      if (!block || block.type !== "form") return;
      const set = new Set(block.formFields);
      if (formField.checked) set.add(formField.dataset.formField); else set.delete(formField.dataset.formField);
      block.formFields = FORM_FIELDS.filter((name) => set.has(name));
      persist(); renderCanvas(); return;
    }
    const navPageInput = event.target.closest("[data-nav-page-id]");
    if (navPageInput) {
      const block = selected();
      if (!block || block.type !== "nav") return;
      if (block.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); renderInspector(); return; }
      const id = navPageInput.dataset.navPageId;
      const selectedPages = new Set(block.navPageIds);
      if (navPageInput.checked) selectedPages.add(id); else selectedPages.delete(id);
      block.navPageIds = [...selectedPages]; persist(); renderCanvas(); return;
    }
    const input = event.target.closest("[data-field]"); if (!input) return;
    const path = input.dataset.field;
    const page = currentPage(); const block = selected();
    if (path === "page.visibility" && input.value === "draft" && page.id === data.settings.defaultPageId) {
      alert("현재 홈페이지는 초안으로 바꿀 수 없어요. 다른 페이지를 홈으로 지정한 뒤 변경해주세요.");
      input.value = page.visibility;
      return;
    }
    let target = block; let cleanPath = path;
    let renderLater = false;
    if (path.startsWith("settings.")) target = data;
    else if (path.startsWith("page.")) { target = page; cleanPath = path.slice(5); }
    else if (path.startsWith("canvas.")) { target = page; cleanPath = path; }
    if (!target) return;
    if (target === block && block?.locked && cleanPath !== "locked") { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); renderInspector(); return; }
    const motionFrameMatch = target === block ? cleanPath.match(/^motion\.timeline\.keyframes\.\d+\.(\w+)$/) : null;
    if (motionFrameMatch && block) {
      const frame = selectedMotionFrame();
      if (!frame) return;
      const key = motionFrameMatch[1];
      frame[key] = typeof frame[key] === "number" ? number(input.value, frame[key]) : input.value;
      if (key === "at") {
        motionPlayhead = number(input.value, frame.at, 0, 100);
        const output = studio.querySelector("[data-motion-at-output]");
        if (output) output.textContent = `${number(input.value, frame.at, 0, 100)}%`;
      }
    }
    else if (cleanPath === "galleryItemsText" && block) block.galleryItems = normalizeGalleryItems(input.value);
    else if (cleanPath === "visibleInverse" && block) block.visible = !input.checked;
    else if (cleanPath === "layoutHidden" && block) setOverride(block, activeLayout(), "hidden", input.checked);
    else if (cleanPath === "isGlobal" && block) moveGlobal(block, input.checked);
    else if (target === block && activeLayout() !== "desktop" && OVERRIDE_KEYS.includes(cleanPath)) {
      const current = view(block)[cleanPath];
      setLayoutValue(block, cleanPath, typeof current === "number" ? number(input.value, current) : input.value);
    }
    else if (target === block && cleanPath.startsWith("props.")) {
      const key = cleanPath.slice(6);
      const prop = componentMetas.get(block.component)?.props.find((item) => item.key === key);
      if (!prop) return;
      block.props[key] = prop.type === "toggle" ? input.checked : ["number", "range"].includes(prop.type) ? number(input.value, Number(prop.default) || 0) : prop.type === "images" ? input.value.split("\n").map((line) => line.trim()).filter(Boolean) : input.value;
      input.closest("label")?.querySelector("output")?.replaceChildren(input.value);
      input.closest(".studio-color__row")?.querySelectorAll("input").forEach((other) => { if (other !== input && (other.type !== "color" || /^#[0-9a-f]{6}$/i.test(input.value))) other.value = input.value; });
      renderLater = true;
    }
    else if (target === block && cleanPath.startsWith("code.")) { setPath(block, cleanPath, input.value); renderLater = true; }
    else {
      const current = getPath(target, cleanPath);
      const value = input.type === "checkbox" ? input.checked : typeof current === "number" ? number(input.value, current) : input.value;
      setPath(target, cleanPath, value);
      if (target === block && cleanPath === "playbackMode") {
        block.autoplay = ["autoplay", "in-view"].includes(value);
        if (["autoplay", "in-view", "hover", "scrub"].includes(value) && block.type === "video") block.muted = true;
        if (value === "scrub" && block.type === "video") block.preload = "auto";
        if (value === "controls") block.controls = true;
      }
      if (target === block && cleanPath === "motion.loop.preset" && value === "spin") {
        block.motion.loop.direction = "normal";
        const directionInput = studio.querySelector('[data-field="motion.loop.direction"]');
        if (directionInput) directionInput.value = "normal";
      }
      if (target === block && cleanPath === "motion.timeline.enabled" && value) enableEmptyMotion(block);
      if (target === page && cleanPath === "visibility") page.seo.noIndex = value !== "listed";
      if (target === block && cleanPath === "component") { const meta = componentMetas.get(value); block.props = meta ? resolveProps(meta, {}) : {}; }
      if (target === block && cleanPath === "fixed" && value) {
        const box = layoutBox(currentPage(), activeLayout());
        const current = view(block);
        if (current.y + current.height > box.viewport) setLayoutValue(block, "y", Math.max(0, box.viewport - current.height - 24));
        block.pinEnabled = false;
      }
    }
    if (/customCSS$|customHead$/.test(cleanPath)) renderLater = true; // Studio 7: 코드 입력은 잠깐 쉬었다 그린다
    persist(); selectedMotionFrame();
    if (renderLater) renderCanvasSoon(cleanPath.startsWith("code.") || /custom/.test(cleanPath) ? 500 : 160); else renderCanvas();
    renderLayers(); renderMotionDock(); if (target === page) renderPages();
    if (target === block && ["motion.timeline.enabled", "motion.timeline.trigger", "motion.timeline.infinite", "component", "fixed", "isGlobal", "pinEnabled", "layoutHidden"].includes(cleanPath)) renderInspector();
    if (target === data && ["settings.smoothScroll.enabled", "settings.theme.toggle"].includes(cleanPath)) studio.querySelector(".studio-site-settings__body").innerHTML = siteSettingsMarkup(data);
    if (target === page && (cleanPath.startsWith("canvas.") || cleanPath.startsWith("layouts."))) {
      const summary = studio.querySelector("[data-page-size-summary]");
      const box = layoutBox(page, activeLayout());
      if (summary) summary.textContent = `${box.width} × ${box.height}px`;
      applyZoom();
    }
  });

  studio.addEventListener("change", (event) => {
    if (event.target.matches("[data-color-field], [data-color-twin]")) rememberColor(event.target.value);
    if (event.target.matches("[data-zoom]")) { zoom = number(event.target.value, 0.5, 0.1, 2); applyZoom(); return; }
    if (event.target.matches("[data-motion-speed]")) { motionPreviewSpeed = number(event.target.value, 1, .5, 2); renderMotionDock(); return; }
    if (event.target.matches("[data-motion-preview-mode]")) { motionPreviewMode = event.target.value; scrubStudioMotion(motionPlayhead); return; }
    if (event.target.matches('[data-field="page.name"],[data-field="page.slug"],[data-field="page.visibility"]')) { renderPages(); renderInspector(); }
    if (event.target.matches('[data-field="action.type"],[data-field="playbackMode"],[data-field="embedMode"],[data-field="navMode"],[data-field="fixedAnchor"],[data-field="clipShape"],[data-field="hoverEffect"],[data-field="maskPreset"],[data-field="duotone"]')) renderInspector();
    if (event.target.matches('[data-field^="motion.timeline"]')) { selectedMotionFrame(); renderInspector(); renderMotionDock(); scrubStudioMotion(motionPlayhead); }
  });

  studio.querySelector("[data-image-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; const block = selected(); if (!file || !block) return;
    const target = event.target.dataset.target;
    event.target.value = "";
    // Studio 7: 큰 사진도 WebP로 줄여서 넣는다. 줄여도 1.5MB가 넘으면 GitHub media 안내.
    status("이미지를 WebP로 줄이는 중…");
    compressImage(file).then((result) => {
      const current = findBlock(block.id);
      if (!current) return;
      if (!result || result.bytes > INLINE_LIMIT) { alert("줄여도 1.5MB보다 커요. 업로드 버튼으로 GitHub media 폴더에 올린 뒤 /media/파일명 경로를 붙여주세요."); return; }
      if (target === "button") current.backgroundImage = result.dataURL; else if (target === "mask") { current.maskImage = result.dataURL; current.maskPreset = "image"; } else { current.src = result.dataURL; current.media = ""; }
      persist(); renderSelection();
      status(result.compressed ? `넣었어요 · ${(result.from / 1_000_000).toFixed(1)}MB → ${(result.bytes / 1000).toFixed(0)}KB WebP` : "넣었어요");
    });
  });

  studio.querySelector("[data-json-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { try { data = normalizeArchiveData(JSON.parse(String(reader.result))); activePageId = data.settings.defaultPageId; selectedId = ""; draftBase = fingerprint(published); draftConflict = false; persist(); renderSelection({ pages: true }); status("JSON 프로젝트를 불러왔어요"); } catch (error) { alert("올바른 Archive JSON 파일이 아니에요."); } };
    reader.readAsText(file); event.target.value = "";
  });

  const workspaceNode = studio.querySelector(".archive-studio__workspace");
  workspaceNode?.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const rect = workspaceNode.getBoundingClientRect();
    setZoom(zoom * Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025)), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });
  workspaceNode?.addEventListener("dragover", (event) => {
    const types = [...(event.dataTransfer?.types || [])];
    if (!types.includes("Files") && !types.includes("text/x-archive-asset")) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "copy"; workspaceNode.classList.add("is-dropping");
  });
  workspaceNode?.addEventListener("dragleave", (event) => { if (!workspaceNode.contains(event.relatedTarget)) workspaceNode.classList.remove("is-dropping"); });
  workspaceNode?.addEventListener("drop", (event) => {
    workspaceNode.classList.remove("is-dropping");
    const rect = studio.querySelector(".archive-studio__board")?.getBoundingClientRect();
    const point = rect ? { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom } : null;
    const assetURL = event.dataTransfer?.getData("text/x-archive-asset");
    if (assetURL) { event.preventDefault(); insertAsset(collectAssets().find((item) => item.url === assetURL) || { url: assetURL, kind: mediaKind(assetURL), uses: [] }, point); return; }
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    insertFiles(event.dataTransfer.files, point);
  });
  const handlePaste = (event) => {
    if (/input|textarea|select/i.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable) return;
    const files = [...(event.clipboardData?.files || [])];
    event.preventDefault();
    if (files.length) insertFiles(files, null); else pasteBlock();
  };
  addEventListener("paste", handlePaste);

  // ===== Studio 8 (B17): 색 팔레트 — 마지막으로 만진 색 칸에 스와치·스포이트 색을 넣는다 =====
  let lastColorField = "";
  studio.addEventListener("focusin", (event) => { if (event.target.matches("[data-color-field]")) lastColorField = event.target.dataset.field; });
  const applyColorToActiveField = (hex) => {
    const inspector = studio.querySelector("[data-inspector]");
    const target = (lastColorField && inspector?.querySelector(`[data-color-field][data-field="${CSS.escape(lastColorField)}"]`)) || inspector?.querySelector("[data-color-field]");
    if (!target) { status("색을 넣을 칸이 없어요 · 요소를 고르고 모양 패널을 여세요"); return; }
    target.value = hex;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    rememberColor(hex);
    status(`${hex} → ${target.closest("label")?.querySelector("span")?.textContent || "색"}`);
  };

  // ===== Studio 8 (B18): 눈금자 · 가이드 · 컬럼 그리드 =====
  let rulersOn = false; let columnsOn = true;
  try { rulersOn = localStorage.getItem("psj-studio-rulers") === "1"; columnsOn = localStorage.getItem("psj-studio-columns") !== "0"; } catch (error) { /* ignore */ }
  const RULER = 20;
  const center = studio.querySelector(".archive-studio__center");
  const rulerH = document.createElement("canvas"); rulerH.className = "studio-ruler studio-ruler--h"; rulerH.title = "아래로 끌면 가로 가이드";
  const rulerV = document.createElement("canvas"); rulerV.className = "studio-ruler studio-ruler--v"; rulerV.title = "오른쪽으로 끌면 세로 가이드";
  const rulerCorner = document.createElement("button"); rulerCorner.className = "studio-ruler-corner"; rulerCorner.type = "button"; rulerCorner.title = "눈금자 끄기 (Ctrl+R)"; rulerCorner.textContent = "✕";
  center?.append(rulerH, rulerV, rulerCorner);
  const rulerStep = () => { const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000]; return steps.find((step) => step * zoom >= 64) || 1000; };
  const drawRulers = () => {
    const board = studio.querySelector(".archive-studio__board");
    if (!rulersOn || !board || !workspaceNode || !rulerH.isConnected) return;
    const wsRect = workspaceNode.getBoundingClientRect(); const boardRect = board.getBoundingClientRect();
    const top = workspaceNode.offsetTop; const left = workspaceNode.offsetLeft;
    const width = Math.max(10, workspaceNode.clientWidth - RULER); const height = Math.max(10, workspaceNode.clientHeight - RULER);
    rulerH.style.cssText = `top:${top}px;left:${left + RULER}px;width:${width}px;height:${RULER}px`;
    rulerV.style.cssText = `top:${top + RULER}px;left:${left}px;width:${RULER}px;height:${height}px`;
    rulerCorner.style.cssText = `top:${top}px;left:${left}px;width:${RULER}px;height:${RULER}px`;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const step = rulerStep(); const minor = step / 5;
    const bounds = selectedBlocks().length ? boundsOf(selectedBlocks()) : null;
    const paint = (canvasNode, size, originScreen, along, vertical) => {
      canvasNode.width = Math.round((vertical ? RULER : size) * dpr); canvasNode.height = Math.round((vertical ? size : RULER) * dpr);
      const g = canvasNode.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#f4f4f1"; g.fillRect(0, 0, vertical ? RULER : size, vertical ? size : RULER);
      if (bounds) { g.fillStyle = "rgba(77,92,255,.16)"; const a = originScreen + (vertical ? bounds.top : bounds.left) * zoom; const b = (vertical ? bounds.height : bounds.width) * zoom; if (vertical) g.fillRect(0, a, RULER, b); else g.fillRect(a, 0, b, RULER); }
      g.strokeStyle = "#a3a39e"; g.fillStyle = "#5a5a55"; g.font = "9px Menlo, Consolas, monospace"; g.textBaseline = "top";
      const start = Math.floor((-originScreen) / zoom / minor) * minor; const end = (size - originScreen) / zoom;
      g.beginPath();
      for (let value = start; value <= end; value += minor) {
        const pos = Math.round(originScreen + value * zoom) + 0.5; const major = Math.abs(value / step - Math.round(value / step)) < 1e-6;
        const length = major ? RULER - 5 : value % (step / 2) === 0 ? 7 : 4;
        if (vertical) { g.moveTo(RULER, pos); g.lineTo(RULER - length, pos); } else { g.moveTo(pos, RULER); g.lineTo(pos, RULER - length); }
        if (major) { if (vertical) { g.save(); g.translate(3, pos - 2); g.rotate(-Math.PI / 2); g.textAlign = "right"; g.fillText(String(Math.round(value)), 0, 0); g.restore(); } else g.fillText(String(Math.round(value)), pos + 3, 2); }
      }
      g.stroke();
      void along;
    };
    paint(rulerH, width, boardRect.left - wsRect.left - RULER, "x", false);
    paint(rulerV, height, boardRect.top - wsRect.top - RULER, "y", true);
  };
  let rulerFrame = 0;
  const drawRulersSoon = () => { if (rulerFrame) return; rulerFrame = requestAnimationFrame(() => { rulerFrame = 0; drawRulers(); }); };
  const setRulers = (on, { silent = false } = {}) => {
    rulersOn = Boolean(on);
    try { localStorage.setItem("psj-studio-rulers", rulersOn ? "1" : "0"); } catch (error) { /* ignore */ }
    [rulerH, rulerV, rulerCorner].forEach((node) => { node.hidden = !rulersOn; });
    studio.querySelectorAll('[data-action="toggle-rulers"]').forEach((button) => button.setAttribute("aria-pressed", String(rulersOn)));
    workspaceNode?.classList.toggle("has-rulers", rulersOn);
    canvas()?.classList.toggle("has-guides", rulersOn);
    if (rulersOn) drawRulers();
    if (!silent) status(rulersOn ? "눈금자 켜짐 · 눈금자에서 캔버스로 끌어 가이드를 만드세요" : "눈금자 끔 (가이드는 숨겨져요)");
  };
  const setColumns = (on, { silent = false } = {}) => {
    columnsOn = Boolean(on);
    try { localStorage.setItem("psj-studio-columns", columnsOn ? "1" : "0"); } catch (error) { /* ignore */ }
    studio.querySelectorAll('[data-action="toggle-columns"]').forEach((button) => button.setAttribute("aria-pressed", String(columnsOn)));
    renderColumns();
    if (!silent) status(columnsOn ? (currentPage().canvas.columns ? "컬럼 그리드 보임" : "컬럼 그리드 보임 · 페이지 설정에서 컬럼 수를 정하세요") : "컬럼 그리드 숨김");
  };
  const columnEdges = (page = currentPage()) => {
    const box = layoutBox(page, activeLayout()); const count = page.canvas.columns;
    if (!count || !columnsOn) return [];
    const inner = box.width - page.canvas.columnMargin * 2; const width = (inner - page.canvas.columnGap * (count - 1)) / count;
    if (width <= 0) return [];
    const edges = [];
    for (let index = 0; index < count; index += 1) { const left = page.canvas.columnMargin + index * (width + page.canvas.columnGap); edges.push(left, left + width); }
    return edges;
  };
  const renderColumns = () => {
    const board = canvas(); if (!board) return;
    board.querySelector(".studio-columns")?.remove();
    const page = currentPage(); const edges = columnEdges(page);
    if (!edges.length) return;
    const box = layoutBox(page, activeLayout());
    const overlay = document.createElement("div"); overlay.className = "studio-columns"; overlay.style.height = `${box.height}px`;
    for (let index = 0; index < edges.length; index += 2) { const column = document.createElement("i"); column.style.cssText = `left:${edges[index]}px;width:${edges[index + 1] - edges[index]}px`; overlay.append(column); }
    board.prepend(overlay);
  };
  const renderPageGuides = () => {
    const board = canvas(); if (!board) return;
    board.querySelectorAll(".studio-page-guide").forEach((node) => node.remove());
    board.classList.toggle("has-guides", rulersOn);
    const page = currentPage(); const box = layoutBox(page, activeLayout());
    const make = (axis, value, index) => {
      const node = document.createElement("div");
      node.className = `studio-page-guide studio-page-guide--${axis}`; node.dataset.guideAxis = axis; node.dataset.guideIndex = String(index);
      node.style.cssText = axis === "v" ? `left:${value}px;height:${box.height}px` : `top:${value}px;width:${box.width}px`;
      node.innerHTML = `<span>${Math.round(value)}</span>`; node.title = "끌어서 옮기기 · 더블클릭으로 지우기";
      board.append(node);
    };
    page.guides.v.forEach((value, index) => make("v", value, index));
    page.guides.h.forEach((value, index) => make("h", value, index));
  };
  // 눈금자에서 끌어내기(새 가이드) · 기존 가이드 끌기(이동)
  let guideDrag = null;
  const guideValueFrom = (event, axis) => {
    const rect = studio.querySelector(".archive-studio__board")?.getBoundingClientRect(); if (!rect) return 0;
    const raw = axis === "v" ? (event.clientX - rect.left) / zoom : (event.clientY - rect.top) / zoom;
    return Math.round(event.altKey ? raw : gridSnap(raw));
  };
  const startGuideDrag = (event, axis, index = -1) => {
    event.preventDefault();
    guideDrag = { axis, index, pointerId: event.pointerId, value: index >= 0 ? currentPage().guides[axis][index] : guideValueFrom(event, axis), moved: false };
    const board = canvas(); if (!board) return;
    let ghost = index >= 0 ? board.querySelector(`.studio-page-guide[data-guide-axis="${axis}"][data-guide-index="${index}"]`) : null;
    if (!ghost) { ghost = document.createElement("div"); ghost.className = `studio-page-guide studio-page-guide--${axis} is-new`; ghost.innerHTML = "<span></span>"; board.append(ghost); }
    ghost.classList.add("is-dragging"); guideDrag.ghost = ghost;
    const box = layoutBox(currentPage(), activeLayout());
    const place = (value) => { ghost.style.cssText = axis === "v" ? `left:${value}px;height:${box.height}px` : `top:${value}px;width:${box.width}px`; ghost.querySelector("span").textContent = String(value); };
    place(guideDrag.value);
    const move = (moveEvent) => { if (moveEvent.pointerId !== guideDrag.pointerId) return; guideDrag.moved = true; guideDrag.value = guideValueFrom(moveEvent, axis); place(guideDrag.value); status(`가이드 ${axis === "v" ? "X" : "Y"} ${guideDrag.value}`, { quiet: true }); };
    const up = (upEvent) => {
      if (upEvent.pointerId !== guideDrag.pointerId) return;
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      const page = currentPage(); const list = page.guides[axis]; const wsRect = workspaceNode.getBoundingClientRect();
      const inside = upEvent.clientX >= wsRect.left + RULER && upEvent.clientY >= wsRect.top + RULER && upEvent.clientX <= wsRect.right && upEvent.clientY <= wsRect.bottom;
      const limit = axis === "v" ? box.width : box.height;
      if (index >= 0) { if (!inside || guideDrag.value < -10 || guideDrag.value > limit + 10) list.splice(index, 1); else list[index] = guideDrag.value; }
      else if (inside && guideDrag.value >= 0 && guideDrag.value <= limit) list.push(guideDrag.value);
      page.guides = normalizeGuides(page.guides);
      guideDrag = null; persist(); renderPageGuides(); renderInspector();
      status(index >= 0 && !inside ? "가이드를 지웠어요" : "가이드 저장됨 · 요소가 이 선에 붙어요", { quiet: false });
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  };
  rulerH.addEventListener("pointerdown", (event) => { if (event.button === 0) startGuideDrag(event, "h"); });
  rulerV.addEventListener("pointerdown", (event) => { if (event.button === 0) startGuideDrag(event, "v"); });
  rulerCorner.addEventListener("click", () => setRulers(false));
  studio.addEventListener("pointerdown", (event) => {
    const guide = event.target.closest(".studio-page-guide");
    if (!guide || event.button !== 0 || !rulersOn) return;
    event.stopPropagation(); startGuideDrag(event, guide.dataset.guideAxis, Number(guide.dataset.guideIndex));
  }, true);
  studio.addEventListener("dblclick", (event) => {
    const guide = event.target.closest(".studio-page-guide");
    if (!guide) return;
    event.preventDefault(); event.stopPropagation();
    const page = currentPage(); page.guides[guide.dataset.guideAxis].splice(Number(guide.dataset.guideIndex), 1);
    persist(); renderPageGuides(); renderInspector(); status("가이드를 지웠어요");
  }, true);
  workspaceNode?.addEventListener("scroll", drawRulersSoon, { passive: true });
  addEventListener("resize", drawRulersSoon);
  setRulers(rulersOn, { silent: true }); setColumns(columnsOn, { silent: true });

  // ===== Studio 8.1: 왼쪽 패널 탭 · 편집기 다크/라이트 테마 · UI 글꼴 =====
  const leftPanel = studio.querySelector(".archive-studio__left");
  const LEFT_TABS = ["layers", "insert", "assets", "settings"];
  const setLeftTab = (tab, { remember = true } = {}) => {
    if (!leftPanel) return;
    const next = LEFT_TABS.includes(tab) ? tab : "layers";
    leftPanel.dataset.tab = next;
    studio.querySelectorAll("[data-left-tab]").forEach((button) => { const active = button.dataset.leftTab === next; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); });
    if (remember) { try { localStorage.setItem("psj-studio-left-tab", next); } catch (error) { /* ignore */ } }
  };
  let storedTab = "layers";
  try { storedTab = localStorage.getItem("psj-studio-left-tab") || "layers"; } catch (error) { /* ignore */ }
  setLeftTab(allBlocks().length ? storedTab : "insert", { remember: false });
  const setEditorTheme = (dark, { silent = false } = {}) => {
    studio.classList.toggle("is-dark", dark);
    document.documentElement.classList.toggle("studio-dark", dark);
    studio.querySelectorAll('[data-action="toggle-editor-theme"]').forEach((button) => { button.setAttribute("aria-pressed", String(dark)); button.textContent = dark ? "☀" : "◐"; });
    try { localStorage.setItem("psj-studio-theme", dark ? "dark" : "light"); } catch (error) { /* ignore */ }
    if (!silent) status(dark ? "편집기 다크 테마 (Ctrl+Shift+D)" : "편집기 라이트 테마 (Ctrl+Shift+D)");
  };
  let storedTheme = "";
  try { storedTheme = localStorage.getItem("psj-studio-theme") || ""; } catch (error) { /* ignore */ }
  setEditorTheme(storedTheme === "dark", { silent: true });
  if (!document.getElementById("studio-ui-font")) {
    const link = document.createElement("link");
    link.id = "studio-ui-font"; link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
    document.head.append(link);
  }

  // Studio 8 (B6): 끄는 동안 가장 가까운 이웃까지의 거리 — 좌우·상하 한 개씩
  const nearestGaps = (box, excludeIds = []) => {
    const others = allBlocks().filter((block) => !excludeIds.includes(block.id) && block.visible).map((block) => view(block)).filter((rect) => !rect.hidden);
    const gaps = [];
    const overlapY = (rect) => Math.min(rect.y + rect.height, box.bottom) - Math.max(rect.y, box.top);
    const overlapX = (rect) => Math.min(rect.x + rect.width, box.right) - Math.max(rect.x, box.left);
    let left = null; let right = null; let up = null; let down = null;
    others.forEach((rect) => {
      if (overlapY(rect) > 0) {
        if (rect.x + rect.width <= box.left && (!left || rect.x + rect.width > left.x + left.width)) left = rect;
        if (rect.x >= box.right && (!right || rect.x < right.x)) right = rect;
      }
      if (overlapX(rect) > 0) {
        if (rect.y + rect.height <= box.top && (!up || rect.y + rect.height > up.y + up.height)) up = rect;
        if (rect.y >= box.bottom && (!down || rect.y < down.y)) down = rect;
      }
    });
    const mid = (a, b) => (Math.max(a[0], b[0]) + Math.min(a[1], b[1])) / 2;
    if (left && box.left - (left.x + left.width) <= 600) gaps.push({ axis: "x", from: left.x + left.width, to: box.left, at: mid([left.y, left.y + left.height], [box.top, box.bottom]) });
    if (right && right.x - box.right <= 600) gaps.push({ axis: "x", from: box.right, to: right.x, at: mid([right.y, right.y + right.height], [box.top, box.bottom]) });
    if (up && box.top - (up.y + up.height) <= 600) gaps.push({ axis: "y", from: up.y + up.height, to: box.top, at: mid([up.x, up.x + up.width], [box.left, box.right]) });
    if (down && down.y - box.bottom <= 600) gaps.push({ axis: "y", from: box.bottom, to: down.y, at: mid([down.x, down.x + down.width], [box.left, box.right]) });
    return gaps.filter((gap) => gap.to - gap.from >= 1);
  };

  // ===== Studio 8 (B15): 자산 패널 — 사이트에서 쓰는 이미지·영상·오디오를 한눈에 =====
  let assetsKey = "";
  const mediaKind = (url) => /^data:video/.test(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? "video" : /^data:audio/.test(url) || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url) ? "audio" : "image";
  const collectAssets = () => {
    const map = new Map();
    const add = (url, use) => { const key = String(url || "").trim(); if (!key) return; if (!map.has(key)) map.set(key, { url: key, kind: mediaKind(key), uses: [] }); map.get(key).uses.push(use); };
    const scanBlock = (block, pageId) => {
      const use = (field) => ({ pageId, blockId: block.id, field, name: block.name });
      ["src", "media", "poster", "backgroundImage", "hoverSrc", "captions"].forEach((field) => { if (block[field]) add(block[field], use(field)); });
      (block.galleryItems || []).forEach((item, index) => { if (item.src) add(item.src, use(`galleryItems.${index}.src`)); });
      if (block.type === "component") {
        const meta = componentMetas.get(block.component);
        (meta?.props || []).forEach((prop) => {
          const value = block.props?.[prop.key];
          if (prop.type === "image" && value) add(value, use(`props.${prop.key}`));
          if (prop.type === "images" && Array.isArray(value)) value.forEach((entry, index) => add(String(entry).split("|")[0].trim(), use(`props.${prop.key}.${index}`)));
        });
      }
    };
    data.pages.forEach((page) => {
      page.blocks.forEach((block) => scanBlock(block, page.id));
      if (page.canvas.backgroundImage) add(page.canvas.backgroundImage, { pageId: page.id, field: "canvas.backgroundImage", name: `${page.name} 배경` });
      if (page.canvas.backgroundVideo) add(page.canvas.backgroundVideo, { pageId: page.id, field: "canvas.backgroundVideo", name: `${page.name} 배경 영상` });
      if (page.seo.image) add(page.seo.image, { pageId: page.id, field: "seo.image", name: `${page.name} 공유 이미지` });
    });
    data.globals.forEach((block) => scanBlock(block, ""));
    return [...map.values()];
  };
  const assetLabel = (url) => url.startsWith("data:") ? `내장 파일 ${Math.max(1, Math.round(url.length * 3 / 4 / 1024))}KB` : (url.replace(/^https?:\/\/[^/]+/, "").split("?")[0].split("/").pop() || url).slice(0, 34);
  const renderAssets = () => {
    const list = studio.querySelector("[data-asset-list]"); const count = studio.querySelector("[data-asset-count]");
    if (!list) return;
    const assets = collectAssets();
    const key = assets.map((asset) => `${asset.url.slice(0, 80)}:${asset.uses.length}`).join("|");
    if (count) count.textContent = assets.length ? `${assets.length}개` : "";
    const tabCount = studio.querySelector("[data-asset-count-tab]"); if (tabCount) tabCount.textContent = assets.length ? ` ${assets.length}` : "";
    if (key === assetsKey) return;
    assetsKey = key;
    list._assets = assets;
    list.innerHTML = assets.length ? assets.map((asset, index) => `<div class="studio-asset" draggable="true" data-asset-index="${index}" data-asset-url="${escapeHTML(asset.url)}" title="${escapeHTML(asset.url.slice(0, 200))}">${asset.kind === "image" ? `<img src="${escapeHTML(safeURL(asset.url, { imageData: true }) || "")}" alt="" loading="lazy">` : `<i>${asset.kind === "video" ? "▶" : "♪"}</i>`}<div><strong>${escapeHTML(assetLabel(asset.url))}</strong><small>${asset.kind} · ${asset.uses.length}곳${asset.url.startsWith("/media/") ? " · media" : asset.url.startsWith("data:") ? " · 내장" : ""}</small></div><span><button data-asset-select="${index}" type="button" title="쓰는 요소 선택">선택</button><button data-asset-insert="${index}" type="button" title="캔버스에 새로 넣기">＋</button><button data-asset-replace="${index}" type="button" title="쓰는 모든 곳에서 바꾸기">교체</button></span></div>`).join("") + '<p class="studio-help">줄을 캔버스로 끌어다 놓으면 그 자리에 새 요소가 생겨요.</p>' : '<p class="studio-muted">아직 사용한 이미지·영상이 없어요. 파일을 캔버스에 끌어다 놓으면 여기에 모여요.</p>';
  };
  const assetAt = (index) => studio.querySelector("[data-asset-list]")?._assets?.[Number(index)] || null;
  const selectAssetUse = (asset) => {
    const use = asset.uses.find((item) => item.blockId) || asset.uses[0];
    if (!use) return;
    if (use.pageId && use.pageId !== activePageId) { activePageId = use.pageId; layout = "desktop"; }
    if (use.blockId) { selectedId = use.blockId; selectedIds = [use.blockId]; } else { selectedId = ""; selectedIds = []; }
    renderSelection({ pages: true });
    const node = canvas()?.querySelector(`[data-block-id="${CSS.escape(use.blockId || "")}"]`);
    node?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    status(`${use.name}${use.blockId ? "" : " (페이지 설정)"}${asset.uses.length > 1 ? ` · ${asset.uses.length}곳에서 사용` : ""}`);
  };
  const replaceAsset = (asset, next) => {
    const value = String(next || "").trim();
    if (!value || value === asset.url) return;
    let changed = 0;
    const swap = (object, key) => { if (object && object[key] === asset.url) { object[key] = value; changed += 1; } };
    const scan = (block) => {
      ["src", "media", "poster", "backgroundImage", "hoverSrc", "captions"].forEach((field) => swap(block, field));
      (block.galleryItems || []).forEach((item) => swap(item, "src"));
      if (block.type === "component" && block.props) Object.keys(block.props).forEach((key) => {
        if (block.props[key] === asset.url) { block.props[key] = value; changed += 1; }
        else if (Array.isArray(block.props[key])) block.props[key] = block.props[key].map((entry) => { const [first, ...rest] = String(entry).split("|"); if (first.trim() === asset.url) { changed += 1; return [value, ...rest].join("|"); } return entry; });
      });
    };
    data.pages.forEach((page) => { page.blocks.forEach(scan); swap(page.canvas, "backgroundImage"); swap(page.canvas, "backgroundVideo"); swap(page.seo, "image"); });
    data.globals.forEach(scan);
    persist(); renderSelection(); status(`${changed}곳을 바꿨어요`);
  };
  const insertAsset = (asset, point = null) => {
    const page = currentPage(); const box = layoutBox(page, activeLayout());
    const block = defaultBlock(asset.kind, page);
    block.name = assetLabel(asset.url).replace(/\.[^.]+$/, "").slice(0, 40) || block.name;
    if (asset.url.startsWith("/media/")) block.media = asset.url; else block.src = asset.url;
    const width = asset.kind === "audio" ? 420 : Math.min(480, box.width - 40); const height = asset.kind === "audio" ? 64 : 320;
    block.width = width; block.height = height;
    if (point && activeLayout() === "desktop") { block.x = Math.round(Math.min(Math.max(0, point.x - width / 2), Math.max(0, box.width - width))); block.y = Math.round(Math.max(0, point.y - height / 2)); }
    addBlock(block);
  };
  studio.addEventListener("dragstart", (event) => { const row = event.target.closest("[data-asset-url]"); if (!row) return; event.dataTransfer.setData("text/x-archive-asset", row.dataset.assetUrl); event.dataTransfer.effectAllowed = "copy"; });

  // ===== Studio 8 (B16): 섹션·페이지 템플릿 =====
  const nextSectionY = (page = currentPage()) => {
    const bottoms = page.blocks.filter((block) => !block.fixed).map((block) => block.y + block.height);
    return bottoms.length ? Math.max(...bottoms) + 80 : Math.max(0, Math.round((workspaceNode?.scrollTop || 0) / zoom));
  };
  const materializeSpec = (spec, page, zBase, index) => {
    const base = { ...spec };
    if (base.type === "component") base.props = resolveProps(componentMetas.get(base.component) || { props: [] }, base.props || {});
    const block = normalizeBlock({ ...base, id: uid(base.type), z: zBase + index + 1 }, page.blocks.length + index);
    if (base.action) block.action = normalizeAction(base.action, block);
    placeNewBlockOnLayouts(block, page);
    return block;
  };
  const insertSection = (id, { page = currentPage(), y = null, select = true } = {}) => {
    const template = sectionTemplate(id);
    if (!template) return null;
    const startY = y == null ? nextSectionY(page) : y;
    const built = template.build({ width: page.canvas.width, y: startY });
    const zBase = Math.max(0, ...page.blocks.map((block) => block.z), ...data.globals.map((block) => block.z));
    const blocks = built.blocks.map((spec, index) => materializeSpec(spec, page, zBase, index));
    page.blocks.push(...blocks);
    if (startY + built.height + 80 > page.canvas.height) page.canvas.height = startY + built.height + 80;
    if (select) setSelection(blocks.map((block) => block.id));
    return { blocks, height: built.height };
  };
  const createPageFromTemplate = (templateId) => {
    const template = PAGE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const usedSlugs = new Set(data.pages.map((page) => page.slug));
    let slug = template.id; let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${template.id}-${suffix++}`;
    const page = normalizePage({ id: uid("page"), name: template.name, slug, visibility: "listed", canvas: { ...clone(currentPage().canvas), height: 1800, columns: 0, backgroundImage: "", backgroundVideo: "", backgroundEffect: "none" } }, data.pages.length);
    data.pages.push(page); activePageId = page.id; layout = "desktop";
    let y = 0;
    template.sections.forEach((id) => { const result = insertSection(id, { page, y, select: false }); if (result) y += result.height; });
    page.canvas.height = Math.max(900, y + 80);
    selectedId = ""; selectedIds = [];
    persist(); fitZoom(); renderSelection({ pages: true });
    workspaceNode?.scrollTo({ top: 0 });
    status(`${template.name} 페이지를 만들었어요 · 글과 사진 자리를 바꾸세요`);
  };
  const sketchMarkup = (id) => `<i class="studio-template-sketch">${sectionSketch(id).map((rect) => `<b class="is-${rect.kind}" style="left:${rect.left}%;top:${rect.top}%;width:${Math.max(1, rect.width)}%;height:${Math.max(2.5, rect.height)}%"></b>`).join("")}</i>`;
  const openTemplates = (tab = "sections") => {
    finishTextEdit(); closeContextMenu();
    const categories = [...new Set(SECTION_TEMPLATES.map((item) => item.category))];
    const sections = categories.map((category) => `<h4>${escapeHTML(category)}</h4><div class="studio-template-grid">${SECTION_TEMPLATES.filter((item) => item.category === category).map((item) => `<button data-template-section="${item.id}" type="button">${sketchMarkup(item.id)}<strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small></button>`).join("")}</div>`).join("");
    const pages = `<div class="studio-template-grid studio-template-grid--pages">${PAGE_TEMPLATES.map((item) => `<button data-template-page="${item.id}" type="button"><i class="studio-template-sketch studio-template-sketch--page">${item.sections.map((id) => `<em>${escapeHTML(sectionTemplate(id)?.name || id)}</em>`).join("")}</i><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small></button>`).join("")}</div><p class="studio-help">새 페이지가 만들어지고 메뉴에 표시돼요. 이름·URL은 페이지 설정에서 바꾸세요.</p>`;
    const modal = openModal({ title: "템플릿", subtitle: "섹션은 현재 페이지 맨 아래에 들어가고, 페이지 템플릿은 새 페이지를 만들어요", wide: true, body: `<div class="studio-template-tabs" role="tablist"><button data-template-tab="sections" class="${tab === "sections" ? "is-active" : ""}" type="button">섹션 ${SECTION_TEMPLATES.length}</button><button data-template-tab="pages" class="${tab === "pages" ? "is-active" : ""}" type="button">페이지 ${PAGE_TEMPLATES.length}</button></div><div data-template-panel="sections" ${tab === "sections" ? "" : "hidden"}>${sections}</div><div data-template-panel="pages" ${tab === "pages" ? "" : "hidden"}>${pages}</div>` });
    modal.addEventListener("click", (event) => {
      const tabButton = event.target.closest("[data-template-tab]");
      if (tabButton) { modal.querySelectorAll("[data-template-tab]").forEach((button) => button.classList.toggle("is-active", button === tabButton)); modal.querySelectorAll("[data-template-panel]").forEach((panel) => { panel.hidden = panel.dataset.templatePanel !== tabButton.dataset.templateTab; }); return; }
      const section = event.target.closest("[data-template-section]");
      if (section) {
        const result = insertSection(section.dataset.templateSection);
        modal.close(); persist(); renderSelection();
        const top = result?.blocks[0]?.y || 0; workspaceNode?.scrollTo({ top: Math.max(0, top * zoom - 40), behavior: "smooth" });
        status(`${sectionTemplate(section.dataset.templateSection)?.name} 섹션 추가 · 글과 사진을 바꾸세요`); return;
      }
      const pageButton = event.target.closest("[data-template-page]");
      if (pageButton) { modal.close(); createPageFromTemplate(pageButton.dataset.templatePage); }
    });
  };

  // ===== Studio 8 (B13): 체크포인트 =====
  const quickCheckpoint = async (name = "", auto = false) => {
    try { const row = await saveCheckpoint({ name, data, auto }); status(`체크포인트 저장 · ${row.name}${row.storage === "localstorage" ? " (임시 저장소)" : ""}`); return row; }
    catch (error) { status(error.message || "체크포인트 저장 실패"); return null; }
  };
  const openCheckpoints = async () => {
    closeContextMenu();
    const rows = await listCheckpoints();
    const total = rows.reduce((sum, row) => sum + (row.size || 0), 0);
    const modal = openModal({ title: "체크포인트", subtitle: `저장 지점 ${rows.length}개 · ${formatBytes(total)} · 이 브라우저에만 보관돼요`, wide: true, body: `
      <form class="studio-checkpoint-form" data-checkpoint-form><input type="text" name="name" placeholder="이름 (예: 홈 1차 완성)" maxlength="60" autocomplete="off"><button class="studio-button is-primary" type="submit">지금 상태 저장</button></form>
      <div class="studio-checkpoint-list">${rows.length ? rows.map((row) => `<div class="studio-checkpoint" data-checkpoint="${row.id}"><div><strong>${escapeHTML(row.name)}</strong><small>${formatWhen(row.savedAt)} · 페이지 ${row.pages} · 요소 ${row.blocks} · ${formatBytes(row.size || 0)}${row.auto ? " · 자동" : ""}</small></div><span><button data-checkpoint-restore="${row.id}" type="button">복원</button><button data-checkpoint-download="${row.id}" type="button">JSON</button><button data-checkpoint-delete="${row.id}" type="button">삭제</button></span></div>`).join("") : '<p class="studio-muted">아직 체크포인트가 없어요. 큰 변경 전에 하나 남겨 두세요 (Ctrl+Shift+S).</p>'}</div>
      <p class="studio-help">복원하면 지금 상태가 ‘복원 전 자동’으로 먼저 저장돼요. 브라우저 데이터를 지우면 함께 사라지니 중요한 버전은 JSON으로도 내려받아 두세요. 최대 30개를 보관해요.</p>` });
    modal.querySelector("[data-checkpoint-form]")?.addEventListener("submit", async (event) => { event.preventDefault(); await quickCheckpoint(String(new FormData(event.target).get("name") || "")); openCheckpoints(); });
    modal.addEventListener("click", async (event) => {
      const restore = event.target.closest("[data-checkpoint-restore]");
      if (restore) {
        const snapshot = await loadCheckpoint(restore.dataset.checkpointRestore);
        if (!snapshot) { status("체크포인트를 읽지 못했어요"); return; }
        if (!confirm("이 체크포인트로 되돌릴까요? 지금 상태는 ‘복원 전 자동’으로 먼저 저장돼요.")) return;
        await quickCheckpoint("복원 전 자동", true);
        data = normalizeArchiveData(snapshot);
        activePageId = data.pages.some((page) => page.id === activePageId) ? activePageId : data.settings.defaultPageId;
        selectedId = ""; selectedIds = []; layout = "desktop";
        persist(); fitZoom(); renderSelection({ pages: true }); modal.close(); status("체크포인트로 되돌렸어요"); return;
      }
      const download = event.target.closest("[data-checkpoint-download]");
      if (download) {
        const snapshot = await loadCheckpoint(download.dataset.checkpointDownload);
        if (!snapshot) return;
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `archive-checkpoint-${download.dataset.checkpointDownload}.json`; link.click(); URL.revokeObjectURL(link.href); return;
      }
      const remove = event.target.closest("[data-checkpoint-delete]");
      if (remove) { await deleteCheckpoint(remove.dataset.checkpointDelete); openCheckpoints(); }
    });
  };

  // ===== Studio 8 (B12): GitHub 원클릭 게시 · 미디어 업로드 =====
  const GITHUB_DEFAULTS = parseRepoFromEditURL(GITHUB_EDIT_URL) || { owner: "", repo: "", branch: "main", path: "content/archive.json" };
  const githubConfig = () => ({ ...getRepoConfig(GITHUB_DEFAULTS), path: GITHUB_DEFAULTS.path });
  const githubToken = () => getToken();
  const publishByCopy = () => { studio.querySelector('[data-action="publish-copy"]')?.click(); };
  const markPublished = () => { published = clone(data); draftBase = fingerprint(published); draftConflict = false; saveDraft(data, published, draftBase); };
  const uploadFilesToGitHub = async (files, listNode = null) => {
    const config = githubConfig(); const token = githubToken();
    if (!token) { status("GitHub 토큰이 없어서 자동 업로드를 못 해요 · 게시 창(Ctrl+Shift+P)에서 토큰을 넣으세요"); return []; }
    const results = [];
    for (const file of files) {
      const row = listNode ? document.createElement("li") : null;
      if (row) { row.textContent = `${file.name} · 준비 중…`; listNode.append(row); }
      try {
        const result = await uploadMedia({ config, token, file, onProgress: (step) => { const label = step === "encoding" ? "읽는 중" : "GitHub에 올리는 중"; if (row) row.textContent = `${file.name} · ${label}…`; status(`${file.name} ${label}…`, { quiet: true }); } });
        results.push(result);
        if (row) row.innerHTML = `<code>${escapeHTML(result.path)}</code> <button data-copy-path="${escapeHTML(result.path)}" type="button">경로 복사</button>${result.replaced ? " <small>(덮어씀)</small>" : ""}`;
        status(`${file.name} 업로드 완료 → ${result.path}`);
      } catch (error) { if (row) row.textContent = `${file.name} · 실패: ${error.message}`; status(`${file.name} 업로드 실패 · ${error.message}`); }
    }
    return results;
  };
  const sitemapXML = () => {
    const base = String(data.settings.siteURL || "").trim();
    if (!base) return "";
    const root = base.endsWith("/") ? base : `${base}/`;
    const pages = data.pages.filter((page) => page.visibility === "listed" && !page.seo.noIndex);
    const urls = [root, ...pages.map((page) => page.id === data.settings.defaultPageId && data.settings.homeView === "archive" ? `${root}?view=archive` : `${root}?view=archive&page=${encodeURIComponent(page.slug)}`)];
    const today = new Date().toISOString().slice(0, 10);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((url) => `  <url><loc>${url.replace(/&/g, "&amp;")}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  };
  const openPublish = () => {
    finishTextEdit(); closeContextMenu();
    const config = githubConfig(); const token = githubToken();
    const warnings = runPreflight(data);
    const modal = openModal({ title: "게시", subtitle: "GitHub에 커밋되면 1~2분 뒤 공개 사이트가 바뀌어요", wide: true, body: `
      <section class="studio-publish-section">
        <h4>1 · GitHub로 바로 게시</h4>
        <div class="studio-fields studio-fields--three"><label><span>소유자</span><input data-gh="owner" type="text" value="${escapeHTML(config.owner)}"></label><label><span>저장소</span><input data-gh="repo" type="text" value="${escapeHTML(config.repo)}"></label><label><span>브랜치</span><input data-gh="branch" type="text" value="${escapeHTML(config.branch)}"></label></div>
        <label><span>토큰 — 이 브라우저에만 저장 · fine-grained, 이 저장소만, Contents 읽기·쓰기</span><input data-gh="token" type="password" value="${escapeHTML(token)}" placeholder="github_pat_…" autocomplete="off"></label>
        <div class="studio-modal__actions studio-modal__actions--left"><button data-gh-check type="button">연결 확인</button><button data-gh-forget type="button" ${token ? "" : "disabled"}>토큰 지우기</button><a class="studio-link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">토큰 만들기 ↗</a></div>
        <p class="studio-publish-status" data-gh-status>${token ? "토큰이 저장돼 있어요. ‘연결 확인’으로 권한을 보고 게시하세요." : "토큰을 붙여넣으면 버튼 하나로 게시돼요. 없으면 아래 2번 방식을 쓰세요."}</p>
        <p class="studio-help">검수: ${warnings.length ? `확인할 항목 ${warnings.length}개 (상단 ‘검수’ 버튼)` : "문제 없음"} · 게시 전에 ‘게시 전 자동’ 체크포인트가 저장돼요.</p>
        <div class="studio-modal__actions"><button class="is-primary" data-gh-publish type="button" ${token ? "" : "disabled"}>지금 게시</button></div>
      </section>
      <section class="studio-publish-section">
        <h4>2 · 직접 올리기 (토큰 없이)</h4>
        <p class="studio-help">JSON을 복사하고 GitHub 편집 화면을 열어요. 전체 선택 → 붙여넣기 → Commit changes.</p>
        <div class="studio-modal__actions studio-modal__actions--left"><button data-gh-copy type="button">JSON 복사하고 GitHub 열기</button><button data-gh-media-page type="button">미디어 업로드 페이지 열기 ↗</button><button data-gh-sitemap type="button" title="공개 주소를 사이트 설정에 넣어야 해요">sitemap.xml 내려받기</button></div>
      </section>
      <section class="studio-publish-section">
        <h4>3 · 미디어 파일 올리기 (토큰 필요 · 파일당 최대 25MB)</h4>
        <p class="studio-help">올린 파일은 <code>/media/파일명</code>으로 바로 쓸 수 있어요. 토큰이 있으면 큰 파일을 캔버스에 끌어다 놓을 때도 자동으로 올라가요.</p>
        <input data-gh-files type="file" multiple accept="image/*,video/*,audio/*" ${token ? "" : "disabled"}>
        <ul class="studio-upload-list" data-gh-uploads></ul>
      </section>` });
    const read = (key) => modal.querySelector(`[data-gh="${key}"]`)?.value.trim() || "";
    const statusLine = modal.querySelector("[data-gh-status]");
    const say = (message, kind = "") => { statusLine.textContent = message; statusLine.dataset.kind = kind; };
    const currentConfig = () => { const next = { owner: read("owner") || GITHUB_DEFAULTS.owner, repo: read("repo") || GITHUB_DEFAULTS.repo, branch: read("branch") || "main" }; setRepoConfig(next); return { ...next, path: GITHUB_DEFAULTS.path }; };
    const syncToken = () => { setToken(read("token")); const has = Boolean(read("token")); modal.querySelector("[data-gh-publish]").disabled = !has; modal.querySelector("[data-gh-forget]").disabled = !has; modal.querySelector("[data-gh-files]").disabled = !has; };
    modal.querySelector('[data-gh="token"]').addEventListener("input", syncToken);
    modal.addEventListener("click", async (event) => {
      const copyPath = event.target.closest("[data-copy-path]");
      if (copyPath) { try { await navigator.clipboard.writeText(copyPath.dataset.copyPath); status(`${copyPath.dataset.copyPath} 복사됨`); } catch (error) { status("복사하지 못했어요"); } return; }
      if (event.target.closest("[data-gh-forget]")) { setToken(""); modal.querySelector('[data-gh="token"]').value = ""; syncToken(); say("토큰을 지웠어요."); return; }
      if (event.target.closest("[data-gh-copy]")) { modal.close(); publishByCopy(); return; }
      if (event.target.closest("[data-gh-media-page]")) { window.open(GITHUB_MEDIA_UPLOAD_URL, "_blank", "noopener"); return; }
      if (event.target.closest("[data-gh-sitemap]")) {
        const xml = sitemapXML();
        if (!xml) { say("사이트 설정의 ‘공개 주소’를 먼저 넣으세요.", "error"); return; }
        const blob = new Blob([xml], { type: "application/xml" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "sitemap.xml"; link.click(); URL.revokeObjectURL(link.href);
        say("sitemap.xml을 내려받았어요. 저장소 맨 위(루트)에 올리세요. 토큰이 있으면 ‘지금 게시’ 때 자동으로 함께 올라가요.", "ok"); return;
      }
      if (event.target.closest("[data-gh-check]")) {
        syncToken(); const current = currentConfig(); const key = read("token");
        if (!key) { say("토큰을 먼저 붙여넣으세요.", "error"); return; }
        say("확인 중…");
        try {
          const info = await checkConnection({ ...current, token: key });
          say(`${info.login}(으)로 연결됨 · ${current.owner}/${current.repo}${info.isPrivate ? " (비공개)" : ""} · ${info.canPush ? "쓰기 가능" : "쓰기 권한 없음!"}${info.branchOk ? "" : ` · 브랜치 ${current.branch} 없음 (기본 ${info.defaultBranch})`}`, info.canPush && info.branchOk ? "ok" : "error");
        } catch (error) { say(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-gh-publish]")) {
        syncToken(); const current = currentConfig(); const key = read("token");
        if (!key) { say("토큰을 먼저 붙여넣으세요.", "error"); return; }
        const button = event.target.closest("[data-gh-publish]"); button.disabled = true;
        try {
          say("게시 전 체크포인트 저장 중…"); await quickCheckpoint("게시 전 자동", true);
          say("GitHub에 커밋하는 중…");
          const result = await publishArchive({ config: current, token: key, json: JSON.stringify(normalizeArchiveData(data), null, 2), message: `Publish archive.json from Archive Studio (${new Date().toLocaleString("ko-KR")})` });
          markPublished();
          const xml = sitemapXML();
          if (xml) { try { const existing = await fetchFileMeta({ ...current, path: "sitemap.xml", token: key }); await putFile({ ...current, path: "sitemap.xml", token: key, message: "Update sitemap.xml (Archive Studio)", content: encodeText(xml), sha: existing?.sha || "" }); } catch (error) { console.warn("sitemap upload skipped", error); } }
          say(`게시 완료! 커밋 ${result.commitSha.slice(0, 7)} · 1~2분 뒤 사이트에 반영돼요. `, "ok");
          if (result.commitURL) statusLine.insertAdjacentHTML("beforeend", `<a class="studio-link" href="${escapeHTML(result.commitURL)}" target="_blank" rel="noopener">커밋 보기 ↗</a>`);
          status("GitHub에 게시했어요 · 반영까지 1~2분");
        } catch (error) { say(error.message, "error"); }
        button.disabled = false;
      }
    });
    modal.querySelector("[data-gh-files]")?.addEventListener("change", async (event) => {
      const files = [...event.target.files]; event.target.value = "";
      if (files.length) await uploadFilesToGitHub(files, modal.querySelector("[data-gh-uploads]"));
    });
  };

  // ===== Studio 7: 스마트 가이드 · 러버밴드 · 핸들 8개 · 회전 · 묶음 이동 =====
  const GUIDE_THRESHOLD = 6; // 화면 px 기준. 캔버스 px로는 ÷zoom.
  let marquee = null; // 빈 곳 드래그 선택
  let suppressCanvasClick = 0; // 마지막 러버밴드가 끝난 시각(performance.now)
  const clearGuides = () => canvas()?.querySelectorAll(".studio-guide").forEach((node) => node.remove());
  const drawGuides = (guides, distances = []) => {
    clearGuides();
    const board = canvas();
    if (!board || (!guides.length && !distances.length)) return;
    const box = layoutBox(currentPage(), activeLayout());
    guides.forEach((guide) => {
      const node = document.createElement("div");
      node.className = `studio-guide studio-guide--${guide.axis === "x" ? "v" : "h"}${guide.canvas ? " is-canvas" : ""}`;
      node.style.cssText = guide.axis === "x" ? `left:${guide.at}px;top:0;height:${box.height}px` : `top:${guide.at}px;left:0;width:${box.width}px`;
      board.append(node);
    });
    distances.forEach((gap) => {
      const node = document.createElement("div");
      node.className = `studio-guide studio-distance studio-distance--${gap.axis}`;
      node.style.cssText = gap.axis === "x" ? `left:${gap.from}px;width:${gap.to - gap.from}px;top:${gap.at}px` : `top:${gap.from}px;height:${gap.to - gap.from}px;left:${gap.at}px`;
      node.innerHTML = `<span>${Math.round(gap.to - gap.from)}</span>`;
      board.append(node);
    });
  };
  // 다른 요소의 모서리·중심, 캔버스 모서리·중심·첫 화면 선을 후보로 모은다.
  const guideCandidates = (excludeIds = []) => {
    const box = layoutBox(currentPage(), activeLayout());
    const xs = [{ at: 0, canvas: true }, { at: box.width / 2, canvas: true }, { at: box.width, canvas: true }];
    const ys = [{ at: 0, canvas: true }, { at: box.viewport / 2, canvas: true }, { at: box.viewport, canvas: true }, { at: box.height, canvas: true }];
    allBlocks().filter((block) => !excludeIds.includes(block.id) && block.visible).forEach((block) => {
      const rect = view(block);
      if (rect.hidden) return;
      xs.push({ at: rect.x }, { at: rect.x + rect.width / 2 }, { at: rect.x + rect.width });
      ys.push({ at: rect.y }, { at: rect.y + rect.height / 2 }, { at: rect.y + rect.height });
    });
    if (rulersOn) { currentPage().guides.v.forEach((at) => xs.push({ at, canvas: true, guide: true })); currentPage().guides.h.forEach((at) => ys.push({ at, canvas: true, guide: true })); }
    columnEdges().forEach((at) => xs.push({ at, canvas: true, column: true }));
    return { xs, ys };
  };
  // 값 목록(edges) 중 하나가 후보에 붙으면 그만큼 밀어 준다. 없으면 null.
  const snapEdges = (edges, candidates, threshold) => {
    let best = null;
    candidates.forEach((candidate) => edges.forEach((edge) => {
      const delta = candidate.at - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: candidate.at, canvas: candidate.canvas };
    }));
    return best;
  };
  const gridSnap = (value) => Math.round(value / currentPage().canvas.grid) * currentPage().canvas.grid;

  const startMarquee = (event) => {
    const board = canvas();
    if (!board) return;
    finishTextEdit();
    const rect = board.getBoundingClientRect();
    marquee = { pointerId: event.pointerId, startX: (event.clientX - rect.left) / zoom, startY: (event.clientY - rect.top) / zoom, shift: event.shiftKey, base: event.shiftKey ? [...selectedIds] : [], moved: false };
    try { board.setPointerCapture?.(event.pointerId); } catch (error) { /* ignore */ }
  };
  const marqueeRect = (event) => {
    const rect = canvas().getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom; const y = (event.clientY - rect.top) / zoom;
    return { left: Math.min(x, marquee.startX), top: Math.min(y, marquee.startY), width: Math.abs(x - marquee.startX), height: Math.abs(y - marquee.startY) };
  };
  const blocksInRect = (area) => allBlocks().filter((block) => {
    if (!block.visible || block.locked) return false;
    const rect = view(block);
    if (rect.hidden) return false;
    return rect.x < area.left + area.width && rect.x + rect.width > area.left && rect.y < area.top + area.height && rect.y + rect.height > area.top;
  }).map((block) => block.id);

  // Studio 7 (A11): 포컬 포인트 썸네일 — 누른 자리·끄는 자리를 %로 바꿔 바로 반영
  let focalDrag = null;
  const applyFocal = (event, picker) => {
    const block = selected();
    if (!block || !picker) return;
    const rect = picker.getBoundingClientRect();
    const focalX = Math.round(Math.min(100, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width) * 100)));
    const focalY = Math.round(Math.min(100, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height) * 100)));
    block.focalX = focalX; block.focalY = focalY;
    const dot = picker.querySelector(".studio-focal__dot");
    if (dot) { dot.style.left = `${focalX}%`; dot.style.top = `${focalY}%`; }
    const inspector = studio.querySelector("[data-inspector]");
    const xInput = inspector?.querySelector('[data-field="focalX"]'); const yInput = inspector?.querySelector('[data-field="focalY"]');
    if (xInput) xInput.value = String(focalX); if (yInput) yInput.value = String(focalY);
    canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"] .canvas-block__content`)?.style.setProperty("--focal", `${focalX}% ${focalY}%`);
    status(`보이는 중심 ${focalX}% / ${focalY}%`);
  };
  studio.addEventListener("pointerdown", (event) => {
    const focalPicker = event.target.closest("[data-focal-pick]");
    if (focalPicker && event.button === 0) {
      if (selected()?.locked) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
      event.preventDefault(); focalDrag = { pointerId: event.pointerId, picker: focalPicker };
      try { focalPicker.setPointerCapture?.(event.pointerId); } catch (error) { /* ignore */ }
      applyFocal(event, focalPicker); return;
    }
    const blockElement = event.target.closest(".canvas-block");
    if (event.button === 0 && (blockElement || event.target.matches("[data-archive-canvas]"))) canvas()?.querySelector(".studio-float-toolbar")?.remove();
    // 빈 캔버스를 누르면 러버밴드 선택 시작 (Design 모드, 왼쪽 버튼).
    if (!blockElement && event.button === 0 && studioMode === "design" && event.target.matches("[data-archive-canvas]")) { startMarquee(event); return; }
    if (!blockElement || !canvas()?.contains(blockElement)) return;
    if (event.button !== 0) return;
    if (textEditing && textEditing.id === blockElement.dataset.blockId) return; // 글자 편집 중에는 캐럿 이동
    finishTextEdit();
    event.preventDefault();
    const id = blockElement.dataset.blockId;
    syncSelection();
    if (event.shiftKey && studioMode === "design") { toggleSelection(id); renderLayers(); renderInspector(); markSelectedElements(); return; }
    if (!selectedIds.includes(id) || studioMode === "motion") setSelection([id]);
    else selectedId = id; // 이미 묶음 안에 있으면 묶음을 유지한 채 기본 선택만 바꾼다
    const block = selected();
    if (!block) return;
    if (block.locked) { renderLayers(); renderInspector(); markSelectedElements(); return; }
    const timeline = block.motion.timeline;
    if (studioMode === "motion" && !timeline.enabled) {
      renderLayers(); renderInspector(); markSelectedElements();
      status("이 레이어는 아직 모션이 없어요 · 오른쪽 프리셋이나 + 모션을 선택하세요");
      return;
    }
    if (studioMode === "motion" && timeline.enabled) {
      const closestFrame = timeline.keyframes.find((frame) => frame.id === selectedMotionFrameId) || [...timeline.keyframes].sort((a, b) => Math.abs(a.at - motionPlayhead) - Math.abs(b.at - motionPlayhead))[0];
      selectedMotionFrameId = closestFrame?.id || "";
      motionPlayhead = closestFrame?.at ?? motionPlayhead;
    }
    const motionFrame = studioMode === "motion" && timeline.enabled ? selectedMotionFrame() : null;
    const resize = studioMode === "design" ? (event.target.closest("[data-resize]")?.dataset.resize || "") : "";
    const rotate = studioMode === "design" && Boolean(event.target.closest("[data-rotate]"));
    let grabbed = blockElement;
    // Alt+드래그: 제자리에 복제한 뒤 복제본을 끈다.
    if (event.altKey && studioMode === "design" && !resize && !rotate) {
      const sources = selectedBlocks().filter((item) => !item.locked);
      let z = Math.max(0, ...allBlocks().map((item) => item.z));
      const ids = sources.map((source) => { const copy = normalizeBlock({ ...clone(source), id: uid(source.type), name: `${source.name} copy`, z: ++z }, currentPage().blocks.length); containerOf(source).push(copy); return copy.id; });
      setSelection(ids); renderCanvas(); renderLayers();
      grabbed = canvas()?.querySelector(`[data-block-id="${CSS.escape(selectedId)}"]`) || blockElement;
      status("복제해서 옮기는 중…");
    }
    const primary = selected();
    try { grabbed.setPointerCapture?.(event.pointerId); } catch (error) { /* pointer already released */ }
    const start = view(primary);
    const group = studioMode === "design" && !resize && !rotate ? selectedBlocks().filter((item) => item.id !== primary.id && !item.locked).map((item) => { const rect = view(item); return { id: item.id, x: rect.x, y: rect.y }; }) : [];
    const bounds = grabbed.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: start.x, y: start.y, width: start.width, height: start.height, rotation: start.rotation,
      resize, rotate, group, moved: false, clickedId: id, wasMulti: selectedIds.length > 1 && !event.altKey,
      centerX: bounds.left + bounds.width / 2, centerY: bounds.top + bounds.height / 2,
      startAngle: Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * 180 / Math.PI,
      motion: Boolean(motionFrame), motionFrameId: motionFrame?.id || "", motionX: motionFrame?.x || 0, motionY: motionFrame?.y || 0,
    };
    renderLayers(); renderInspector(); markSelectedElements();
  });

  studio.addEventListener("pointermove", (event) => {
    if (focalDrag && event.pointerId === focalDrag.pointerId) { applyFocal(event, focalDrag.picker); return; }
    if (marquee && event.pointerId === marquee.pointerId) {
      const area = marqueeRect(event);
      if (!marquee.moved && Math.max(area.width, area.height) * zoom < 3) return;
      marquee.moved = true;
      let box = canvas()?.querySelector(".studio-marquee");
      if (!box && canvas()) { box = document.createElement("div"); box.className = "studio-marquee"; canvas().append(box); }
      if (box) box.style.cssText = `left:${area.left}px;top:${area.top}px;width:${area.width}px;height:${area.height}px`;
      const inside = blocksInRect(area);
      const next = marquee.shift ? [...new Set([...marquee.base, ...inside])] : inside;
      if (next.join() !== selectedIds.join()) { setSelection(next); markSelectedElements(); renderLayers(); }
      status(`${next.length}개 선택 중…`);
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return; const block = selected(); if (!block) return;
    const element = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`);
    let dx = (event.clientX - drag.startX) / zoom; let dy = (event.clientY - drag.startY) / zoom; const snap = gridSnap;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) drag.moved = true;
    const radians = drag.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const localX = dx * cosine + dy * sine; const localY = -dx * sine + dy * cosine;
    if (drag.rotate) {
      const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180 / Math.PI;
      let next = drag.rotation + (angle - drag.startAngle);
      if (event.shiftKey) next = Math.round(next / 15) * 15;
      next = Math.round(((next + 180) % 360 + 360) % 360 - 180);
      setLayoutValue(block, "rotation", next);
      if (element) element.setAttribute("style", blockStyle({ ...view(block), fixedAnchor: "top" }, layoutBox(currentPage(), activeLayout())));
      status(`회전 ${next}° · Shift로 15° 단위`);
      return;
    }
    if (drag.motion) {
      const frame = block.motion.timeline.keyframes.find((item) => item.id === drag.motionFrameId);
      if (!frame) return;
      frame.x = snap(drag.motionX + localX); frame.y = snap(drag.motionY + localY);
      clearStudioMotion();
      const target = element?.querySelector(".canvas-block__timeline");
      if (target) {
        target.style.transform = motionLabTransform(frame, block.motion.timeline.perspective);
        target.style.transformOrigin = block.motion.timeline.origin.replace("-", " ");
        target.style.opacity = frame.opacity;
        target.style.filter = `blur(${frame.blur}px) brightness(${frame.brightness}) saturate(${frame.saturate}) hue-rotate(${frame.hue}deg)`;
        target.style.clipPath = usesClip(block.motion.timeline.keyframes) ? clipPath(frame) : "";
      }
      status(`키프레임 ${frame.at}% · X ${frame.x} / Y ${frame.y}`);
      return;
    }
    const threshold = GUIDE_THRESHOLD / zoom;
    const guides = [];
    if (drag.resize) {
      // 핸들 방향: ex = -1(왼쪽) 0 1(오른쪽), ey = -1(위) 0 1(아래). 반대쪽 변·모서리는 고정.
      const direction = drag.resize;
      const ex = direction.includes("e") ? 1 : direction.includes("w") ? -1 : 0;
      const ey = direction.includes("s") ? 1 : direction.includes("n") ? -1 : 0;
      const fromCenter = event.altKey;
      let nextWidth = ex ? Math.max(2, drag.width + ex * localX * (fromCenter ? 2 : 1)) : drag.width;
      let nextHeight = ey ? Math.max(2, drag.height + ey * localY * (fromCenter ? 2 : 1)) : drag.height;
      if (event.shiftKey && ex && ey) {
        // 비율 고정: 더 많이 바뀐 축을 따른다.
        const ratio = drag.width / Math.max(1, drag.height);
        if (Math.abs(nextWidth - drag.width) / drag.width >= Math.abs(nextHeight - drag.height) / Math.max(1, drag.height)) nextHeight = Math.max(2, nextWidth / ratio);
        else nextWidth = Math.max(2, nextHeight * ratio);
      } else if (!drag.rotation && !fromCenter) {
        // 회전이 없을 때만 움직이는 변을 다른 요소에 스냅. 아니면 격자.
        const candidates = guideCandidates([block.id]);
        if (ex) {
          const edge = ex > 0 ? drag.x + nextWidth : drag.x + drag.width - nextWidth;
          const hit = snapEdges([edge], candidates.xs, threshold);
          if (hit) { nextWidth = Math.max(2, nextWidth + ex * hit.delta); guides.push({ axis: "x", at: hit.at, canvas: hit.canvas }); } else nextWidth = Math.max(2, snap(nextWidth));
        }
        if (ey) {
          const edge = ey > 0 ? drag.y + nextHeight : drag.y + drag.height - nextHeight;
          const hit = snapEdges([edge], candidates.ys, threshold);
          if (hit) { nextHeight = Math.max(2, nextHeight + ey * hit.delta); guides.push({ axis: "y", at: hit.at, canvas: hit.canvas }); } else nextHeight = Math.max(2, snap(nextHeight));
        }
      } else { nextWidth = Math.max(2, snap(nextWidth)); nextHeight = Math.max(2, snap(nextHeight)); }
      // 고정된 반대쪽을 기준으로 중심이 얼마나 움직였는지(요소 좌표계) → 화면 좌표계로 회전.
      const shiftLocalX = fromCenter ? 0 : (nextWidth - drag.width) / 2 * ex;
      const shiftLocalY = fromCenter ? 0 : (nextHeight - drag.height) / 2 * ey;
      const nextCenterX = drag.x + drag.width / 2 + shiftLocalX * cosine - shiftLocalY * sine;
      const nextCenterY = drag.y + drag.height / 2 + shiftLocalX * sine + shiftLocalY * cosine;
      setLayoutValue(block, "width", Math.round(nextWidth)); setLayoutValue(block, "height", Math.round(nextHeight)); setLayoutValue(block, "x", Math.round(nextCenterX - nextWidth / 2)); setLayoutValue(block, "y", Math.round(nextCenterY - nextHeight / 2));
      drawGuides(guides);
      status(`${Math.round(nextWidth)} × ${Math.round(nextHeight)}${event.shiftKey ? " · 비율 고정" : ""}${fromCenter ? " · 가운데 기준" : ""}`);
    }
    else {
      // 이동: Shift는 한 축으로만, 스마트 가이드는 묶음 전체의 상자 기준으로 스냅.
      if (event.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
      const movingIds = [block.id, ...drag.group.map((item) => item.id)];
      const groupRects = [{ x: drag.x, y: drag.y, width: drag.width, height: drag.height }, ...drag.group.map((item) => { const rect = view(allBlocks().find((other) => other.id === item.id) || block); return { x: item.x, y: item.y, width: rect.width, height: rect.height }; })];
      const left = Math.min(...groupRects.map((rect) => rect.x)) + dx; const top = Math.min(...groupRects.map((rect) => rect.y)) + dy;
      const right = Math.max(...groupRects.map((rect) => rect.x + rect.width)) + dx; const bottom = Math.max(...groupRects.map((rect) => rect.y + rect.height)) + dy;
      const candidates = guideCandidates(movingIds);
      const hitX = snapEdges([left, (left + right) / 2, right], candidates.xs, threshold);
      const hitY = snapEdges([top, (top + bottom) / 2, bottom], candidates.ys, threshold);
      const snappedDx = hitX ? dx + hitX.delta : snap(drag.x + dx) - drag.x;
      const snappedDy = hitY ? dy + hitY.delta : snap(drag.y + dy) - drag.y;
      if (hitX) guides.push({ axis: "x", at: hitX.at, canvas: hitX.canvas });
      if (hitY) guides.push({ axis: "y", at: hitY.at, canvas: hitY.canvas });
      setLayoutValue(block, "x", Math.round(drag.x + snappedDx)); setLayoutValue(block, "y", Math.round(drag.y + snappedDy));
      drag.group.forEach((item) => {
        const other = allBlocks().find((candidate) => candidate.id === item.id);
        if (!other) return;
        setLayoutValue(other, "x", Math.round(item.x + snappedDx)); setLayoutValue(other, "y", Math.round(item.y + snappedDy));
        const node = canvas()?.querySelector(`[data-block-id="${CSS.escape(other.id)}"]`);
        if (node) node.setAttribute("style", blockStyle({ ...view(other), fixedAnchor: "top" }, layoutBox(currentPage(), activeLayout())));
      });
      const movedBox = { left: left - dx + snappedDx, right: right - dx + snappedDx, top: top - dy + snappedDy, bottom: bottom - dy + snappedDy };
      drawGuides(guides, nearestGaps(movedBox, movingIds));
      if (drag.group.length) drawSelectionBox();
      const placed = view(block);
      status(`X ${placed.x} · Y ${placed.y}${drag.group.length ? ` · ${drag.group.length + 1}개 함께 이동` : ""}${event.shiftKey ? " · 한 축 고정" : ""}`);
    }
    if (element) element.setAttribute("style", blockStyle({ ...view(block), fixedAnchor: "top" }, layoutBox(currentPage(), activeLayout())));
  });

  const finishDrag = (event) => {
    if (focalDrag && event.pointerId === focalDrag.pointerId) { focalDrag = null; persist(); return; }
    if (marquee && event.pointerId === marquee.pointerId) {
      const moved = marquee.moved; marquee = null;
      canvas()?.querySelector(".studio-marquee")?.remove();
      if (moved) { suppressCanvasClick = performance.now(); renderSelection(); status(selectedIds.length ? `${selectedIds.length}개 선택` : "선택 없음"); }
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    const wasMotion = drag.motion; const finished = drag; drag = null;
    clearGuides();
    // 묶음 안의 요소를 움직이지 않고 그냥 클릭하면 그 요소만 남긴다.
    if (!finished.moved && finished.wasMulti && !finished.resize && !finished.rotate && studioMode === "design") { setSelection([finished.clickedId]); renderSelection(); return; }
    persist(); renderInspector(); renderMotionDock(); renderLayers(); markSelectedElements();
    if (wasMotion) scrubStudioMotion(motionPlayhead);
  };
  studio.addEventListener("pointerup", finishDrag); studio.addEventListener("pointercancel", finishDrag);

  const handleKeydown = (event) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "") || Boolean(document.activeElement?.isContentEditable);
    const combo = event.metaKey || event.ctrlKey;
    if (combo && event.key.toLowerCase() === "z") { event.preventDefault(); restoreHistory(historyIndex + (event.shiftKey ? 1 : -1)); return; }
    if (combo && event.key.toLowerCase() === "k") { event.preventDefault(); if (document.querySelector(".studio-palette")) closePalette(); else openPalette(); return; }
    if (combo && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "r") { event.preventDefault(); setRulers(!rulersOn); return; }
    if (combo && event.shiftKey && event.key.toLowerCase() === "s") { event.preventDefault(); quickCheckpoint(); return; }
    if (combo && event.shiftKey && event.key.toLowerCase() === "d") { event.preventDefault(); setEditorTheme(!studio.classList.contains("is-dark")); return; }
    if (combo && event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); openPublish(); return; }
    if (combo && event.key === "'") { event.preventDefault(); setColumns(!columnsOn); return; }
    if (document.querySelector(".studio-modal, .studio-palette")) return; // 창이 열려 있으면 창이 키를 처리
    if (typing) return;
    if (event.key === "?" && !combo) { event.preventDefault(); openShortcuts(); return; }
    if (combo && event.key === "0") { event.preventDefault(); fitZoom(); applyZoom(); status(`화면 맞춤 · ${Math.round(zoom * 100)}%`); return; }
    if (combo && ["=", "+", "-", "_"].includes(event.key)) { event.preventDefault(); setZoom(zoom * (["-", "_"].includes(event.key) ? 1 / 1.25 : 1.25)); status(`확대 ${Math.round(zoom * 100)}%`); return; }
    if (event.key === "Escape" && document.querySelector(".studio-context-menu, .studio-font-picker")) { closeContextMenu(); closeFontPicker(); return; }
    if (event.key === "Escape" && selectedId && !drag) { selectedId = ""; selectedIds = []; renderSelection(); return; }
    if (combo && event.key.toLowerCase() === "a" && studioMode === "design") { event.preventDefault(); selectAll(); return; }
    if (combo && event.key.toLowerCase() === "v") return; // paste 이벤트가 처리
    if (!selected()) return;
    if (combo && event.key.toLowerCase() === "c") { event.preventDefault(); copySelected(); return; }
    if (combo && event.key.toLowerCase() === "x") { event.preventDefault(); copySelected({ cut: true }); return; }
    if (combo && event.shiftKey && event.key.toLowerCase() === "l") { event.preventDefault(); setLockedSelected(!selectedBlocks().every((item) => item.locked)); return; }
    if (combo && event.shiftKey && event.key.toLowerCase() === "h") { event.preventDefault(); setHiddenSelected(selectedBlocks().some((item) => item.visible)); return; }
    if (event.key === "Enter" && !combo && studioMode === "design" && ["text", "button"].includes(selected().type) && !selected().locked && !isMultiSelection()) { event.preventDefault(); startTextEdit(selected()); return; }
    if (combo && ["BracketRight", "BracketLeft"].includes(event.code)) { event.preventDefault(); reorderBlock(selected(), event.code === "BracketRight" ? 1 : -1, event.shiftKey); return; }
    const movable = selectedBlocks().filter((block) => !block.locked);
    if (!movable.length) { if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d")) { event.preventDefault(); status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); } return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
    if (["Backspace", "Delete"].includes(event.key)) { event.preventDefault(); deleteSelected(); return; }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
      if (studioMode === "motion") {
        if (selected().locked) return;
        if (!selectedTimeline()?.enabled || !selectedMotionFrame()) { status("이 레이어는 아직 모션이 없어요 · 프리셋이나 + 모션을 선택하세요"); return; }
        const radians = view(selected()).rotation * Math.PI / 180;
        const screenX = moves[event.key][0] * amount; const screenY = moves[event.key][1] * amount;
        selectedMotionFrame().x += screenX * Math.cos(radians) + screenY * Math.sin(radians);
        selectedMotionFrame().y += -screenX * Math.sin(radians) + screenY * Math.cos(radians);
      } else movable.forEach((block) => { const current = view(block); setLayoutValue(block, "x", current.x + moves[event.key][0] * amount); setLayoutValue(block, "y", current.y + moves[event.key][1] * amount); });
      persist(); renderSelection();
    }
  };
  addEventListener("keydown", handleKeydown);

  const initiallySaved = saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true });
  try { if (!localStorage.getItem("psj-studio8-welcome")) { localStorage.setItem("psj-studio8-welcome", "1"); setTimeout(() => toast("Studio 8 · ? 키로 단축키 표, Ctrl+K로 명령 팔레트를 열 수 있어요", { duration: 6500 }), 900); } } catch (error) { /* storage blocked */ }
  if (!initiallySaved) status("자동 저장 실패 — JSON 백업을 눌러주세요");
  else if (draftConflict) status("게시본이 변경됐어요 · 백업 후 비교하고 게시하세요");
  loadComponentMetas().then(() => { if (disposed) return; renderComponentLibrary(); if (selected()?.type === "component") renderInspector(); renderCanvas(); }).catch((error) => console.warn("Component list could not load.", error));
  return () => { disposed = true; clearTimeout(deferredRender); clearStudioMotion(); destroyEditorComponents(); saveDraft(data, published, draftBase); removeEventListener("keydown", handleKeydown); removeEventListener("paste", handlePaste); removeEventListener("resize", drawRulersSoon); closePalette(); closeModal(); document.documentElement.classList.remove("studio-dark"); removeEventListener("pointerdown", closeMenusOnOutside, true); removeEventListener("blur", closeContextMenu); closeContextMenu(); closeFontPicker(); document.querySelector("#archive-font-preview")?.remove(); document.querySelector(".studio-device")?.remove(); };
}
