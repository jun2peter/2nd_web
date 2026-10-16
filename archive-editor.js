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
} from "./archive/responsive.js?v=studio5";
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
} from "./archive/components-host.js?v=studio5";
import { bindCustomCursor, bindMagnetic, bindPins, bindSmoothScroll, bindSplitText } from "./archive/effects.js?v=studio5";

const DATA_VERSION = 5;
const STORAGE_KEY = "psj-archive-builder-draft-v5";
const LEGACY_STORAGE_KEYS = ["psj-archive-builder-draft-v4", "psj-archive-builder-draft-v3", "psj-archive-builder-draft-v2", "psj-archive-canvas-draft-v1"];
const GITHUB_EDIT_URL = "https://github.com/jun2peter/2nd_web/edit/main/content/archive.json";
const GITHUB_MEDIA_UPLOAD_URL = "https://github.com/jun2peter/2nd_web/upload/main/media";

const BLOCK_TYPES = ["text", "image", "video", "audio", "button", "shape", "line", "marquee", "gallery", "embed", "nav", "component", "code"];
const MOTION_LAB_TRIGGERS = ["load", "in-view", "hover", "press", "click", "scroll", "linked"];
const TRANSITION_PRESETS = ["none", "fade", "slide", "zoom", "wipe", "circle", "blur"];
const CURSOR_PRESETS = ["default", "dot", "crosshair", "ring", "blend"];
const MOTION_LAB_ORIGINS = ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left"];
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
  };
}

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
  const playbackMode = ["autoplay", "click", "hover", "in-view", "controls", "link"].includes(block.playbackMode) ? block.playbackMode : inferredPlayback;
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
    fontSize: number(block.fontSize, type === "button" || type === "nav" ? 16 : 48, 6, 400),
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
  const id = "archive-custom-font";
  let link = document.querySelector(`#${id}`);
  const href = safeURL(page?.canvas?.fontStylesheet);
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.append(link);
  }
  if (link.href !== href) link.href = href;
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
  return [
    `filter:blur(${block.blur}px) grayscale(${block.grayscale}) drop-shadow(${block.shadowX}px ${block.shadowY}px ${block.shadowBlur}px ${block.shadowColor})`,
  ].join(";");
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
  const showControls = mode === "controls" || (block.controls && !["click", "hover", "link"].includes(mode));
  const button = ["click", "hover", "controls"].includes(mode) ? mediaPlayButton(block) : ["autoplay", "in-view"].includes(mode) ? mediaPlayButton(block, "Play video").replace("data-media-play", "data-media-play data-autoplay-fallback hidden") : "";
  return `<div class="canvas-native-media" data-native-media data-media-mode="${mode}" data-pause-hidden="${block.pauseWhenHidden}"><video data-media-element src="${escapeHTML(src)}" aria-label="${escapeHTML(block.alt || block.name)}" playsinline preload="${block.preload}" ${poster ? `poster="${escapeHTML(poster)}"` : ""} ${autoplay ? "autoplay" : ""} ${block.loop ? "loop" : ""} ${block.muted ? "muted" : ""} ${showControls ? "controls" : ""}>${track ? `<track kind="captions" src="${escapeHTML(track)}" srclang="ko" label="한국어">` : ""}</video>${button}</div>`;
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
  return `<img src="${escapeHTML(src)}" alt="${block.decorative ? "" : escapeHTML(block.alt)}" ${block.decorative ? 'aria-hidden="true"' : ""} loading="lazy" style="object-fit:${block.objectFit};border-radius:${block.borderRadius}px">`;
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
  if (block.type === "code") {
    if (!block.code.html.trim() && !block.code.css.trim() && !block.code.js.trim()) return '<div class="canvas-block__placeholder">CODE · HTML · CSS · JS</div>';
    return `<iframe class="canvas-code" data-code-frame title="${escapeHTML(block.ariaLabel || block.name)}" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${escapeHTML(codeBlockDocument(block.code, { editing }))}"${block.codeInteractive ? "" : ' tabindex="-1" style="pointer-events:none"'}></iframe>`;
  }
  return "";
}

export function archiveBlockMarkup(rawBlock, { data, editing = false, draft = false, pageId = "", normalized = false, box, isGlobal = false } = {}) {
  const documentData = normalized ? data : normalizeArchiveData(data || {});
  const block = normalizeBlock(rawBlock);
  const layoutHidden = Boolean(rawBlock.hidden);
  if (!block.visible && !editing) return "";
  const action = actionAttributes(block.action, documentData, { draft });
  const mediaLinkMode = (["video", "audio"].includes(block.type) && block.playbackMode === "link") || (block.type === "embed" && block.embedMode === "link");
  const canWrapAction = !["nav", "code"].includes(block.type) && (!["video", "audio", "embed"].includes(block.type) || mediaLinkMode);
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
  const visitorDraggable = block.publicDraggable && !["video", "audio", "embed", "code"].includes(block.type) && !action && !block.lightbox && !block.fixed;
  const motionLabData = motionLab.enabled ? `data-motion-lab="${escapeHTML(JSON.stringify(motionLab))}" data-motion-lab-trigger="${motionLab.trigger}"` : "";
  const motionFocusable = motionLab.enabled && ["click", "press", "hover"].includes(motionLab.trigger) && !action && !["video", "audio", "embed", "nav", "code"].includes(block.type) ? `tabindex="0" ${["click", "press"].includes(motionLab.trigger) ? 'role="button"' : ""}` : "";
  const flags = `${block.fixed ? ` data-fixed="${block.fixedAnchor}"` : ""}${block.pinEnabled && !block.fixed ? " data-pin" : ""}${isGlobal ? " data-global" : ""}`;
  const startsClosed = motionLab.enabled && motionLab.trigger === "linked" && motionLab.linkMode === "toggle" && motionLab.keyframes[0]?.opacity === 0;
  const classes = `canvas-block canvas-block--${block.type}${editing ? " is-editable" : ""}${editing && startsClosed ? " is-toggle-closed" : ""}${block.visible ? "" : " is-hidden-layer"}${layoutHidden ? " is-layout-hidden" : ""}${block.locked ? " is-locked" : ""}`;
  return `<article id="${escapeHTML(anchor)}" class="${classes}" data-block-id="${escapeHTML(block.id)}" data-entrance="${motion.entrance.preset}" data-trigger="${motion.entrance.trigger}" data-once="${motion.entrance.once}" data-loop="${motion.loop.preset}" data-hover="${motion.hover.preset}" data-parallax="${block.parallax}" data-mouse-parallax="${block.mouseParallax}"${flags} ${motionLabData} ${motionFocusable} ${visitorDraggable ? "data-public-draggable" : ""} ${lightboxAttributes} style="${style}"><div class="canvas-block__entrance"><div class="canvas-block__timeline"><div class="canvas-block__loop"><div class="canvas-block__hover"><div class="canvas-block__content"${wrapperSurface ? " data-surface" : ""} style="${visualEffectStyle(block)};${wrapperSurface}">${content}</div></div></div></div></div>${editing ? '<button class="canvas-block__resize" data-resize type="button" aria-label="크기 조절"></button>' : ""}</article>`;
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
  return `<section class="archive-canvas${editing ? " archive-canvas--editing" : ""}" data-archive-canvas data-archive-scope="${escapeHTML(page.id)}" data-page-id="${escapeHTML(page.id)}"${editing ? ` data-layout="${activeLayout}"` : ""} style="width:${box.width}px;height:${box.height}px;background-color:${page.canvas.background};--canvas-grid:${page.canvas.grid}px">${css ? `<style>${css}</style>` : ""}${blocks}${fold}${editing && !blocks ? '<div class="archive-canvas__empty">왼쪽에서 요소를 추가하세요 · 빈 캔버스를 누르면 페이지 설정</div>' : ""}</section>`;
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
    <div class="studio-fields studio-fields--two">${field("전환 시간(ms)", "settings.transition.duration", settings.transition.duration, "number")}${field("화면 맞춤", "settings.scaleMode", settings.scaleMode, "select", option("fit", settings.scaleMode, "화면 폭에 꽉 채움") + option("max-100", settings.scaleMode, "원래 크기까지만"))}${field("커서", "settings.cursor", settings.cursor, "select", option("default", settings.cursor, "기본") + option("dot", settings.cursor, "점") + option("crosshair", settings.cursor, "십자") + option("ring", settings.cursor, "링 (따라오기)") + option("blend", settings.cursor, "반전 원"))}${field("커서 색", "settings.cursorColor", settings.cursorColor)}</div>
    <div class="studio-checks">${field("부드러운 스크롤", "settings.smoothScroll.enabled", settings.smoothScroll.enabled, "checkbox")}${field("상단 전환 막대 숨김", "settings.hideViewSwitch", settings.hideViewSwitch, "checkbox")}</div>
    ${settings.smoothScroll.enabled ? field("스크롤 부드러움 (0.02 느림 ~ 0.5 빠름)", "settings.smoothScroll.intensity", settings.smoothScroll.intensity, "number") : ""}
    <div class="studio-checks">${field("고정 전역 페이지 메뉴", "settings.showPageNav", settings.showPageNav, "checkbox")}${field("스크롤 진행선", "settings.showScrollProgress", settings.showScrollProgress, "checkbox")}${field("모션 정지 버튼", "settings.showMotionToggle", settings.showMotionToggle, "checkbox")}</div>
    <p class="studio-insert__label">반응형 기준 (화면 폭)</p>
    <div class="studio-fields studio-fields--two">${field("태블릿 배치: 이 폭 이하", "settings.responsive.tabletMax", settings.responsive.tabletMax, "number")}${field("모바일 배치: 이 폭 이하", "settings.responsive.mobileMax", settings.responsive.mobileMax, "number")}</div>
    <p class="studio-help">페이지마다 Tablet·Mobile 배치를 만들면 이 폭을 기준으로 바뀌어요. 없는 배치는 한 단계 큰 배치를 줄여서 보여줘요.</p>`;
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
    <details class="studio-inspector-section" open><summary><span>페이지 크기${layout === "desktop" ? "" : ` · ${LAYOUT_LABELS[layout]}`}</span><small data-page-size-summary>${box.width} × ${box.height}px</small></summary><div class="studio-inspector-section__body"><div class="studio-fields studio-fields--two">${sizeFields}${field("배경", "canvas.background", page.canvas.background)}${field("스냅 간격", "canvas.grid", page.canvas.grid, "number")}</div>${field("웹폰트 CSS 주소", "canvas.fontStylesheet", page.canvas.fontStylesheet, "url")}</div></details>
    ${responsiveSectionMarkup(page)}
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
    <div class="archive-studio" data-archive-studio data-active-page="${escapeHTML(page.id)}">
      <aside class="archive-studio__left">
        <div class="archive-studio__brand"><strong>ARCHIVE STUDIO <b>5</b></strong><span>Responsive</span></div>
        <a class="studio-exit" href="?view=archive">← 사이트로 돌아가기</a>
        <section class="studio-panel studio-pages"><div class="studio-panel__head"><div><h2>페이지</h2><small data-page-count>${data.pages.length}개</small></div></div><div data-page-list>${pageListMarkup(data, page.id)}</div><div class="studio-page-create"><button data-action="add-page" type="button">＋ 메뉴 페이지</button><button data-action="add-unlisted-page" type="button">＋ 링크 전용</button></div></section>
        <section class="studio-panel studio-layers"><div class="studio-panel__head"><h2>레이어</h2><small>현재 페이지</small></div><div data-layer-list></div></section>
        <section class="studio-panel studio-insert"><h2>요소 추가</h2><p class="studio-insert__label">기본</p><div class="studio-add-grid">
          <button data-add="text" type="button">T&nbsp; 텍스트</button><button data-add="button" type="button">↗ 버튼</button><button data-add="shape" type="button">○ 도형</button><button data-add="line" type="button">— 선</button></div><p class="studio-insert__label">미디어</p><div class="studio-add-grid"><button data-add="image" type="button">▧ 이미지·GIF</button><button data-add="video" type="button">▶ 영상</button><button data-add="audio" type="button">♪ 오디오</button><button data-add="gallery" type="button">▦ 갤러리</button><button data-add="embed" type="button">⌘ 임베드</button></div><p class="studio-insert__label">인터랙션</p><div class="studio-add-grid"><button data-add="marquee" type="button">→ 반복 글자</button><button data-add="nav" type="button">☰ 페이지 메뉴</button>
        </div><p class="studio-insert__label">커스텀 · 무엇이든</p><div class="studio-add-grid"><button data-add="code" type="button">&lt;/&gt; 코드 블록</button><button data-add-component="" type="button" data-scroll-library>✦ 컴포넌트</button></div><div class="studio-component-library" data-component-library><p class="studio-muted">컴포넌트 목록을 불러오는 중…</p></div></section>
        <details class="studio-panel studio-site-settings"><summary>사이트 설정</summary><div class="studio-site-settings__body">
          ${siteSettingsMarkup(data)}
        </div></details>
      </aside>
      <section class="archive-studio__center">
        <header class="archive-studio__topbar"><div class="studio-mode-switch" role="group" aria-label="편집 모드"><button class="is-active" data-studio-mode="design" aria-pressed="true" type="button">Design</button><button data-studio-mode="motion" aria-pressed="false" type="button">Motion</button></div><div class="studio-breakpoints" role="group" aria-label="화면 크기" data-breakpoints>${breakpointSwitchMarkup(page, "desktop")}</div><div class="studio-topbar__context"><strong data-current-page-name>${escapeHTML(page.name)}</strong><span data-current-page-meta>${page.visibility === "listed" ? "메뉴 표시" : page.visibility === "unlisted" ? "링크 전용" : "초안"} · ${page.canvas.width}×${page.canvas.height}</span><small data-save-status aria-live="polite">이 브라우저에 자동 저장됨</small></div><div class="studio-topbar__actions"><button data-action="undo" type="button" title="실행 취소" aria-label="실행 취소">↶</button><button data-action="redo" type="button" title="다시 실행" aria-label="다시 실행">↷</button><select data-zoom aria-label="캔버스 확대"><option value="0.25">25%</option><option value="0.5" selected>50%</option><option value="0.75">75%</option><option value="1">100%</option></select><button data-action="preflight" type="button">검수</button><button data-action="device-preview" type="button">기기 미리보기</button><button data-action="preview" type="button">새 탭</button><button data-action="import" type="button">불러오기</button><button data-action="reset-published" type="button">게시본</button><button data-action="download" type="button">백업</button><button class="studio-publish" data-action="publish" type="button">게시 파일 준비</button></div></header>
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
    <div class="studio-fields studio-fields--two">${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain", "fill"].map((item) => option(item, block.objectFit)).join(""))}${field("이미지 반복", "repeat", block.repeat, "select", ["no-repeat", "repeat", "repeat-x", "repeat-y"].map((item) => option(item, block.repeat)).join(""))}${field("반복 크기", "repeatSize", block.repeatSize, "number")}</div>${field("클릭 시 크게 보기", "lightbox", block.lightbox, "checkbox")}` : "";
  const videoFields = block.type === "video" ? `
    ${field("직접 영상 주소 (MP4·WebM)", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-video" type="button">영상 파일 업로드 ↗</button><p class="studio-help">YouTube·Vimeo는 ‘임베드’ 요소를 쓰면 재생 방식이 더 정확해요. GitHub 웹 업로드는 파일당 25MB까지입니다.</p>
    ${field("포스터 이미지", "poster", block.poster)}${field("WebVTT 자막 경로", "captions", block.captions)}${field("영상 설명", "alt", block.alt)}` : "";
  const audioFields = block.type === "audio" ? `${field("오디오 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-audio" type="button">MP3·WAV 업로드 ↗</button>${field("재생 버튼 문구", "playLabel", block.playLabel)}` : "";
  const buttonFields = block.type === "button" ? `<div class="studio-presets"><button data-button-preset="square" type="button">각진</button><button data-button-preset="round" type="button">둥근</button><button data-button-preset="pill" type="button">캡슐</button><button data-button-preset="circle" type="button">원형</button><button data-button-preset="outline" type="button">테두리</button></div>${field("배경 이미지·GIF 링크/경로", "backgroundImage", block.backgroundImage)}<button class="inspector-file" data-action="pick-button-image" type="button">작은 버튼 이미지 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">큰 버튼 이미지 업로드 ↗</button>` : "";
  const textFields = ["text", "button", "marquee", "nav"].includes(block.type) ? `
    ${["text", "button", "marquee"].includes(block.type) ? field(block.type === "button" ? "버튼 글자" : "내용", "content", block.content, "textarea") : ""}
    ${block.type === "text" ? field("HTML 의미", "htmlTag", block.htmlTag, "select", ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"].map((item) => option(item, block.htmlTag)).join("")) : ""}
    ${field("폰트", "fontFamily", block.fontFamily)}
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
  const videoPlayback = block.type === "video" ? `${field("재생 방식", "playbackMode", block.playbackMode, "select", option("click", block.playbackMode, "클릭해서 재생") + option("autoplay", block.playbackMode, "무음 자동재생") + option("in-view", block.playbackMode, "화면에 들어오면 재생") + option("hover", block.playbackMode, "호버 중 재생") + option("controls", block.playbackMode, "기본 플레이어") + option("link", block.playbackMode, "재생 없이 링크 카드"))}<div class="studio-checks">${field("반복 재생", "loop", block.loop, "checkbox")}${field("처음에는 음소거", "muted", block.muted, "checkbox")}${optionalNativeControls}${pauseOutside}</div><div class="studio-fields studio-fields--two">${field("미리 불러오기", "preload", block.preload, "select", option("none", block.preload, "안 함") + option("metadata", block.preload, "정보만") + option("auto", block.preload, "전체"))}${field("재생 버튼 문구", "playLabel", block.playLabel)}</div><p class="studio-help">클릭 재생은 큰 버튼, 기본 플레이어는 브라우저 컨트롤을 사용합니다. 자동 계열이 차단되면 재생 버튼이 나타납니다.</p>` : "";
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
  const contentBody = `${textFields}${mediaFields}${videoFields}${audioFields}${buttonFields}${marqueeFields}${galleryFields}${embedFields}${componentFields}${codeFields}` || '<p class="studio-muted">이 요소는 내용 설정이 없어요.</p>';
  const layoutNote = layout === "desktop" ? "" : `<div class="studio-callout studio-callout--layout"><strong>${LAYOUT_LABELS[layout]} 배치 편집 중</strong><p>여기서 바꾼 위치·크기·글자 크기는 ${LAYOUT_LABELS[layout]}에만 적용돼요. 점(●)이 붙은 칸이 이 화면 전용 값이에요.</p>${overridden ? '<button data-action="layout-reset-block" type="button">데스크톱 값으로 되돌리기</button>' : ""}</div>`;
  const fixedFields = block.fixed ? `${field("고정 기준", "fixedAnchor", block.fixedAnchor, "select", option("top", block.fixedAnchor, "화면 위쪽 기준") + option("bottom", block.fixedAnchor, "화면 아래쪽 기준"))}<p class="studio-help">스크롤해도 화면의 같은 자리에 있어요. 캔버스의 ‘첫 화면’ 점선 안에 놓으세요. 헤더·메뉴 버튼·커서 효과에 써요.</p>` : "";
  const layoutBody = `${layoutNote}${field("레이어 이름", "name", block.name)}<div class="studio-fields studio-fields--two">${lf("X", "x", block.x, "number")}${lf("Y", "y", block.y, "number")}${lf("W", "width", block.width, "number")}${lf("H", "height", block.height, "number")}${lf("회전", "rotation", block.rotation, "number")}${lf("투명도", "opacity", block.opacity, "number")}</div><div class="studio-checks">${field(`${LAYOUT_LABELS[layout]}에서 숨기기`, "layoutHidden", block.hidden, "checkbox")}${field("모든 화면에서 숨김", "visibleInverse", !block.visible, "checkbox")}${field("잠금", "locked", block.locked, "checkbox")}${field("모든 페이지에 표시", "isGlobal", isGlobal, "checkbox")}${field("화면에 고정", "fixed", block.fixed, "checkbox")}</div>${fixedFields}${field("페이지 내 위치 ID", "anchorId", block.anchorId)}<div class="inspector-actions"><button data-action="duplicate" type="button">복제</button><button data-action="back" type="button">뒤로</button><button data-action="front" type="button">앞으로</button></div>`;
  const styleBody = `<div class="studio-fields studio-fields--two">${field("글자색", "color", block.color)}${field("배경/그라디언트", "background", block.background)}${field("선 색", "borderColor", block.borderColor)}${field("선 두께", "borderWidth", block.borderWidth, "number")}${lf("둥근 모서리", "borderRadius", block.borderRadius, "number")}${lf("안쪽 여백", "padding", block.padding, "number")}${field("블러", "blur", block.blur, "number")}${field("흑백", "grayscale", block.grayscale, "number")}</div>${field("블렌드", "blendMode", block.blendMode, "select", ["normal", "multiply", "screen", "overlay", "difference", "exclusion", "color-burn", "color-dodge"].map((item) => option(item, block.blendMode)).join(""))}<div class="studio-fields studio-fields--two">${field("그림자 X", "shadowX", block.shadowX, "number")}${field("그림자 Y", "shadowY", block.shadowY, "number")}${field("그림자 번짐", "shadowBlur", block.shadowBlur, "number")}${field("그림자 색", "shadowColor", block.shadowColor)}</div>`;
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
  const widths = { marquee: 720, text: 520, button: 220, line: 420, nav: 520, gallery: 640, embed: 560, audio: 420, component: 640, code: 560 };
  const heights = { marquee: 72, text: 130, button: 64, line: 2, nav: 64, gallery: 420, embed: 315, audio: 64, component: 420, code: 360 };
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
  const published = normalizeArchiveData(publishedData);
  const draftInfo = getArchiveDraftInfo(published);
  let draftBase = draftInfo.base || fingerprint(published);
  let draftConflict = draftInfo.stale;
  let saveWarningShown = false;
  let activePageId = data.pages.some((page) => page.id === initialPageId) ? initialPageId : studio.dataset.activePage || data.settings.defaultPageId;
  let selectedId = "";
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
  const selectedTimeline = () => selected()?.motion.timeline;
  const selectedMotionFrame = () => {
    const timeline = selectedTimeline();
    if (!timeline?.keyframes.length) return null;
    const frame = timeline.keyframes.find((item) => item.id === selectedMotionFrameId) || timeline.keyframes[0];
    selectedMotionFrameId = frame.id;
    return frame;
  };
  const motionHorizon = () => Math.max(100, ...allBlocks().filter((block) => block.motion.timeline.enabled && block.motion.timeline.trigger !== "scroll").map((block) => block.motion.timeline.delay + block.motion.timeline.duration));
  const status = (message) => { const node = studio.querySelector("[data-save-status]"); if (node) node.textContent = message; };

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
    const element = selectedId ? board.querySelector(`[data-block-id="${CSS.escape(selectedId)}"]`) : null;
    element?.classList.add("is-selected");
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

  const renderLayers = () => {
    const list = studio.querySelector("[data-layer-list]");
    const current = activeLayout();
    list.innerHTML = allBlocks().sort((a, b) => b.z - a.z).map((block) => {
      const hiddenHere = view(block).hidden;
      const marks = `${isGlobalBlock(block) ? '<b title="모든 페이지에 표시">🌐</b>' : ""}${block.fixed ? '<b title="화면에 고정">📌</b>' : ""}${hiddenHere ? `<b title="${LAYOUT_LABELS[current]}에서 숨김">⊘</b>` : ""}`;
      return `<button class="studio-layer ${block.id === selectedId ? "is-active" : ""}${hiddenHere ? " is-layout-hidden" : ""}" data-select="${escapeHTML(block.id)}" type="button"><span>${block.visible ? (block.locked ? "🔒" : block.type) : "숨김"}</span><em>${escapeHTML(block.name)}${marks}</em>${block.motion.timeline.enabled ? `<i title="Motion Lab ${block.motion.timeline.keyframes.length} keyframes">◆ ${block.motion.timeline.keyframes.length}</i>` : ""}</button>`;
    }).join("") || '<p class="studio-muted">아직 레이어가 없어요.</p>';
  };

  const renderInspector = () => {
    const inspector = studio.querySelector("[data-inspector]");
    const block = selected();
    selectedMotionFrame();
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
    renderCanvas(); renderLayers(); renderInspector(); renderMotionDock();
  };

  const selectBlock = (id) => {
    selectedId = id;
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

  studio.addEventListener("click", async (event) => {
    if (event.target.matches("[data-archive-canvas]")) { selectedId = ""; renderSelection(); return; }
    const layoutButton = event.target.closest("[data-studio-layout]");
    if (layoutButton) { switchLayout(layoutButton.dataset.studioLayout); return; }
    const componentButton = event.target.closest("[data-add-component]");
    if (componentButton) {
      if (!componentButton.dataset.addComponent) { studio.querySelector("[data-component-library]")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
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
    if (layer) { selectBlock(layer.dataset.select); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const block = selected();
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
    } else if (action === "publish") {
      if (draftConflict && !confirm("GitHub의 현재 게시본이 이 로컬 초안을 만든 뒤 변경됐어요. 먼저 JSON 백업을 저장하고 차이를 확인하는 것이 안전해요. 그래도 게시 준비를 계속할까요?")) return;
      window.open(GITHUB_EDIT_URL, "_blank", "noopener");
      try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); status("복사 완료 — 열린 GitHub에서 전체 붙여넣고 Commit changes"); } catch (error) { status("백업 버튼으로 JSON을 받은 뒤 GitHub에서 교체하세요"); }
    }
  });

  studio.addEventListener("input", (event) => {
    if (event.target.matches("[data-motion-scrub]")) { scrubStudioMotion(number(event.target.value, 0, 0, 100)); return; }
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
        if (["autoplay", "in-view", "hover"].includes(value) && block.type === "video") block.muted = true;
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
    persist(); selectedMotionFrame();
    if (renderLater) renderCanvasSoon(cleanPath.startsWith("code.") ? 500 : 160); else renderCanvas();
    renderLayers(); renderMotionDock(); if (target === page) renderPages();
    if (target === block && ["motion.timeline.enabled", "motion.timeline.trigger", "motion.timeline.infinite", "component", "fixed", "isGlobal", "pinEnabled", "layoutHidden"].includes(cleanPath)) renderInspector();
    if (target === data && ["settings.smoothScroll.enabled"].includes(cleanPath)) studio.querySelector(".studio-site-settings__body").innerHTML = siteSettingsMarkup(data);
    if (target === page && (cleanPath.startsWith("canvas.") || cleanPath.startsWith("layouts."))) {
      const summary = studio.querySelector("[data-page-size-summary]");
      const box = layoutBox(page, activeLayout());
      if (summary) summary.textContent = `${box.width} × ${box.height}px`;
      applyZoom();
    }
  });

  studio.addEventListener("change", (event) => {
    if (event.target.matches("[data-zoom]")) { zoom = number(event.target.value, 0.5, 0.1, 2); applyZoom(); return; }
    if (event.target.matches("[data-motion-speed]")) { motionPreviewSpeed = number(event.target.value, 1, .5, 2); renderMotionDock(); return; }
    if (event.target.matches("[data-motion-preview-mode]")) { motionPreviewMode = event.target.value; scrubStudioMotion(motionPlayhead); return; }
    if (event.target.matches('[data-field="page.name"],[data-field="page.slug"],[data-field="page.visibility"]')) { renderPages(); renderInspector(); }
    if (event.target.matches('[data-field="action.type"],[data-field="playbackMode"],[data-field="embedMode"],[data-field="navMode"],[data-field="fixedAnchor"]')) renderInspector();
    if (event.target.matches('[data-field^="motion.timeline"]')) { selectedMotionFrame(); renderInspector(); renderMotionDock(); scrubStudioMotion(motionPlayhead); }
  });

  studio.querySelector("[data-image-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; const block = selected(); if (!file || !block) return;
    if (file.size > 1_500_000) { alert("1.5MB보다 큰 파일은 업로드 버튼으로 GitHub media 폴더에 올린 뒤 /media/파일명 경로를 붙여주세요."); event.target.value = ""; return; }
    const target = event.target.dataset.target;
    const reader = new FileReader(); reader.onload = () => { if (target === "button") block.backgroundImage = String(reader.result); else { block.src = String(reader.result); block.media = ""; } persist(); renderSelection(); }; reader.readAsDataURL(file); event.target.value = "";
  });

  studio.querySelector("[data-json-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { try { data = normalizeArchiveData(JSON.parse(String(reader.result))); activePageId = data.settings.defaultPageId; selectedId = ""; draftBase = fingerprint(published); draftConflict = false; persist(); renderSelection({ pages: true }); status("JSON 프로젝트를 불러왔어요"); } catch (error) { alert("올바른 Archive JSON 파일이 아니에요."); } };
    reader.readAsText(file); event.target.value = "";
  });

  studio.addEventListener("pointerdown", (event) => {
    const blockElement = event.target.closest(".canvas-block"); if (!blockElement || !canvas()?.contains(blockElement)) return;
    event.preventDefault(); selectedId = blockElement.dataset.blockId; const block = selected();
    if (!block) return;
    canvas()?.querySelectorAll(".is-selected").forEach((element) => element.classList.remove("is-selected"));
    if (block.locked) { renderLayers(); renderInspector(); blockElement.classList.add("is-selected"); return; }
    const timeline = block.motion.timeline;
    if (studioMode === "motion" && !timeline.enabled) {
      renderLayers(); renderInspector(); blockElement.classList.add("is-selected");
      status("이 레이어는 아직 모션이 없어요 · 오른쪽 프리셋이나 + 모션을 선택하세요");
      return;
    }
    if (studioMode === "motion" && timeline.enabled) {
      const closestFrame = timeline.keyframes.find((frame) => frame.id === selectedMotionFrameId) || [...timeline.keyframes].sort((a, b) => Math.abs(a.at - motionPlayhead) - Math.abs(b.at - motionPlayhead))[0];
      selectedMotionFrameId = closestFrame?.id || "";
      motionPlayhead = closestFrame?.at ?? motionPlayhead;
    }
    const motionFrame = studioMode === "motion" && timeline.enabled ? selectedMotionFrame() : null;
    try { blockElement.setPointerCapture?.(event.pointerId); } catch (error) { /* pointer already released */ }
    const start = view(block);
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: start.x, y: start.y, width: start.width, height: start.height, rotation: start.rotation, resize: Boolean(event.target.closest("[data-resize]")), motion: Boolean(motionFrame), motionFrameId: motionFrame?.id || "", motionX: motionFrame?.x || 0, motionY: motionFrame?.y || 0 };
    renderLayers(); renderInspector(); blockElement.classList.add("is-selected");
  });

  studio.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return; const block = selected(); if (!block) return;
    const element = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`);
    const dx = (event.clientX - drag.startX) / zoom; const dy = (event.clientY - drag.startY) / zoom; const snap = (value) => Math.round(value / currentPage().canvas.grid) * currentPage().canvas.grid;
    const radians = drag.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const localX = dx * cosine + dy * sine; const localY = -dx * sine + dy * cosine;
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
    if (drag.resize) {
      const oldCenterX = drag.x + drag.width / 2; const oldCenterY = drag.y + drag.height / 2;
      const fixedCornerX = oldCenterX - drag.width * cosine / 2 + drag.height * sine / 2;
      const fixedCornerY = oldCenterY - drag.width * sine / 2 - drag.height * cosine / 2;
      const nextWidth = Math.max(2, snap(drag.width + localX)); const nextHeight = Math.max(2, snap(drag.height + localY));
      const nextCenterX = fixedCornerX + nextWidth * cosine / 2 - nextHeight * sine / 2;
      const nextCenterY = fixedCornerY + nextWidth * sine / 2 + nextHeight * cosine / 2;
      setLayoutValue(block, "width", nextWidth); setLayoutValue(block, "height", nextHeight); setLayoutValue(block, "x", Math.round(nextCenterX - nextWidth / 2)); setLayoutValue(block, "y", Math.round(nextCenterY - nextHeight / 2));
    }
    else { setLayoutValue(block, "x", snap(drag.x + dx)); setLayoutValue(block, "y", snap(drag.y + dy)); }
    if (element) element.setAttribute("style", blockStyle({ ...view(block), fixedAnchor: "top" }, layoutBox(currentPage(), activeLayout()))); status(activeLayout() === "desktop" ? "편집 중…" : `${LAYOUT_LABELS[activeLayout()]} 배치 편집 중…`);
  });

  const finishDrag = (event) => { if (!drag || event.pointerId !== drag.pointerId) return; const wasMotion = drag.motion; drag = null; persist(); renderInspector(); renderMotionDock(); if (wasMotion) scrubStudioMotion(motionPlayhead); };
  studio.addEventListener("pointerup", finishDrag); studio.addEventListener("pointercancel", finishDrag);

  const handleKeydown = (event) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); restoreHistory(historyIndex + (event.shiftKey ? 1 : -1)); return; }
    if (typing || !selected()) return;
    if (selected().locked) { if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d")) { event.preventDefault(); status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); } return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateBlock(selected()); return; }
    if (["Backspace", "Delete"].includes(event.key)) { event.preventDefault(); const container = containerOf(selected()); container.splice(container.findIndex((block) => block.id === selectedId), 1); selectedId = currentPage().blocks.at(-1)?.id || ""; persist(); renderSelection(); return; }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault(); const amount = event.shiftKey ? 10 : 1;
      if (studioMode === "motion") {
        if (!selectedTimeline()?.enabled || !selectedMotionFrame()) { status("이 레이어는 아직 모션이 없어요 · 프리셋이나 + 모션을 선택하세요"); return; }
        const radians = view(selected()).rotation * Math.PI / 180;
        const screenX = moves[event.key][0] * amount; const screenY = moves[event.key][1] * amount;
        selectedMotionFrame().x += screenX * Math.cos(radians) + screenY * Math.sin(radians);
        selectedMotionFrame().y += -screenX * Math.sin(radians) + screenY * Math.cos(radians);
      } else { const current = view(selected()); setLayoutValue(selected(), "x", current.x + moves[event.key][0] * amount); setLayoutValue(selected(), "y", current.y + moves[event.key][1] * amount); }
      persist(); renderSelection();
    }
  };
  addEventListener("keydown", handleKeydown);

  const initiallySaved = saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true });
  if (!initiallySaved) status("자동 저장 실패 — JSON 백업을 눌러주세요");
  else if (draftConflict) status("게시본이 변경됐어요 · 백업 후 비교하고 게시하세요");
  loadComponentMetas().then(() => { if (disposed) return; renderComponentLibrary(); if (selected()?.type === "component") renderInspector(); renderCanvas(); }).catch((error) => console.warn("Component list could not load.", error));
  return () => { disposed = true; clearTimeout(deferredRender); clearStudioMotion(); destroyEditorComponents(); saveDraft(data, published, draftBase); removeEventListener("keydown", handleKeydown); document.querySelector(".studio-device")?.remove(); };
}
