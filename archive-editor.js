const STORAGE_KEY = "psj-archive-builder-draft-v2";
const LEGACY_STORAGE_KEY = "psj-archive-canvas-draft-v1";
const GITHUB_EDIT_URL = "https://github.com/jun2peter/2nd_web/edit/main/content/archive.json";
const GITHUB_MEDIA_UPLOAD_URL = "https://github.com/jun2peter/2nd_web/upload/main/media";

const BLOCK_TYPES = ["text", "image", "video", "audio", "button", "shape", "line", "marquee", "gallery", "embed", "nav"];
const clone = (value) => JSON.parse(JSON.stringify(value));

const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const number = (value, fallback = 0, min = -100000, max = 100000) => {
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
  const raw = String(value).trim();
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
      const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
      return /^[\w-]{6,}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (["vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return /^\d+$/.test(id || "") ? `https://player.vimeo.com/video/${id}` : "";
    }
    if (["open.spotify.com", "spotify.com"].includes(host)) {
      const path = url.pathname.replace(/^\/(?:embed\/)?/, "");
      return `https://open.spotify.com/embed/${path}`;
    }
    if (host === "w.soundcloud.com") return src;
    if (host === "soundcloud.com") return `https://w.soundcloud.com/player/?url=${encodeURIComponent(src)}`;
    if ((host === "google.com" || host.endsWith(".google.com")) && url.pathname.startsWith("/maps")) return src;
  } catch (error) {
    console.warn("Embed URL could not be parsed.", error);
  }
  return "";
}

function normalizeCanvas(canvas = {}) {
  canvas = canvas || {};
  return {
    width: number(canvas.width, 1440, 320, 5000),
    height: number(canvas.height, 1800, 400, 30000),
    background: cssColor(canvas.background, "#ffffff"),
    grid: number(canvas.grid, 8, 1, 100),
    fontStylesheet: safeURL(canvas.fontStylesheet),
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
      preset: ["none", "lift", "scale", "tilt", "glow", "invert", "fade"].includes(hover.preset) ? hover.preset : "none",
      duration: number(hover.duration, 240, 0, 5000),
      amount: number(hover.amount, 1.04, 0, 5),
    },
    loop: {
      preset: loopPreset,
      duration: number(loop.duration, 4000, 200, 30000),
      delay: number(loop.delay, 0, 0, 10000),
      direction: ["normal", "reverse", "alternate"].includes(loop.direction) ? loop.direction : loopPreset === "spin" ? "normal" : "alternate",
    },
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
  const defaultWidth = type === "text" ? 520 : type === "marquee" ? 720 : type === "button" ? 220 : type === "line" ? 420 : 360;
  const defaultHeight = type === "text" ? 120 : type === "marquee" ? 72 : type === "button" ? 64 : type === "line" ? 2 : type === "audio" ? 60 : 260;
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
    autoplay: block.autoplay == null ? type === "video" : block.autoplay !== false,
    loop: block.loop == null ? type === "video" : block.loop !== false,
    muted: block.muted == null ? type === "video" : block.muted !== false,
    controls: Boolean(block.controls),
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
    blendMode: ["normal", "multiply", "screen", "overlay", "difference", "exclusion", "color-burn", "color-dodge"].includes(block.blendMode) ? block.blendMode : "normal",
    blur: number(block.blur, 0, 0, 80),
    grayscale: number(block.grayscale, 0, 0, 1),
    shadowX: number(block.shadowX, 0, -200, 200),
    shadowY: number(block.shadowY, 0, -200, 200),
    shadowBlur: number(block.shadowBlur, 0, 0, 200),
    shadowColor: cssColor(block.shadowColor, "rgba(0,0,0,.25)"),
    motion: normalizeMotion(block.motion),
    textEffect: ["none", "typewriter", "scramble"].includes(block.textEffect) && textLike ? block.textEffect : "none",
    parallax: number(block.parallax, 0, -2, 2),
    mouseParallax: number(block.mouseParallax, 0, -2, 2),
    publicDraggable: Boolean(block.publicDraggable),
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
  return {
    version: 2,
    settings: {
      defaultPageId,
      transition: {
        preset: ["none", "fade", "slide", "zoom"].includes(transition.preset) ? transition.preset : "fade",
        duration: number(transition.duration, 420, 0, 3000),
        easing: cssText(transition.easing, "cubic-bezier(.22,1,.36,1)"),
        color: cssColor(transition.color, "#ffffff"),
      },
      showPageNav: Boolean(rawSettings.showPageNav),
      showScrollProgress: Boolean(rawSettings.showScrollProgress),
      showMotionToggle: Boolean(rawSettings.showMotionToggle),
      cursor: ["default", "dot", "crosshair"].includes(rawSettings.cursor) ? rawSettings.cursor : "default",
      cursorColor: cssColor(rawSettings.cursorColor, "#111111"),
      seo: {
        titleSuffix: String(seo.titleSuffix || ""),
        description: String(seo.description || ""),
        image: String(seo.image || ""),
        noIndex: Boolean(seo.noIndex),
      },
    },
    pages,
    components: Array.isArray(source.components) ? clone(source.components) : [],
    globals: Array.isArray(source.globals) ? clone(source.globals) : [],
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
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return { document: normalizeArchiveData(JSON.parse(legacy)), base: "", savedAt: "" };
  } catch (error) {
    console.warn("Legacy archive draft could not be read.", error);
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
      version: 2,
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

function commonStyle(block) {
  return [
    `left:${number(block.x)}px`,
    `top:${number(block.y)}px`,
    `width:${number(block.width, 100, 2)}px`,
    `height:${number(block.height, 100, 2)}px`,
    `z-index:${number(block.z, 1, 0, 9999)}`,
    `opacity:${number(block.opacity, 1, 0, 1)}`,
    `mix-blend-mode:${block.blendMode}`,
    `--block-rotation:${number(block.rotation)}deg`,
    `--visitor-drag-x:0px`,
    `--visitor-drag-y:0px`,
    `--parallax-x:0px`,
    `--parallax-y:0px`,
    `transform:translate3d(calc(var(--visitor-drag-x) + var(--parallax-x)),calc(var(--visitor-drag-y) + var(--parallax-y)),0) rotate(var(--block-rotation))`,
  ].join(";");
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

function videoMarkup(block) {
  const src = safeURL(block.media || block.src);
  if (!src) return '<div class="canvas-block__placeholder">VIDEO URL / FILE</div>';
  const allowAutoplay = block.autoplay && !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const embed = safeEmbedURL(src);
  if (embed) {
    const joiner = embed.includes("?") ? "&" : "?";
    const query = `autoplay=${allowAutoplay ? 1 : 0}&muted=${block.muted ? 1 : 0}&loop=${block.loop ? 1 : 0}`;
    return `<iframe src="${escapeHTML(`${embed}${joiner}${query}`)}" title="${escapeHTML(block.alt || block.name)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }
  const poster = safeURL(block.poster, { imageData: true });
  const track = safeURL(block.captions);
  return `<video src="${escapeHTML(src)}" playsinline preload="${block.preload}" ${poster ? `poster="${escapeHTML(poster)}"` : ""} ${allowAutoplay && block.muted ? "autoplay" : ""} ${block.loop ? "loop" : ""} ${block.muted ? "muted" : ""} ${block.controls ? "controls" : ""}>${track ? `<track kind="captions" src="${escapeHTML(track)}" srclang="ko" label="한국어">` : ""}</video>`;
}

function audioMarkup(block) {
  const src = safeURL(block.media || block.src);
  if (!src) return '<div class="canvas-block__placeholder">AUDIO URL / FILE</div>';
  const allowAutoplay = block.autoplay && !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  return `<audio src="${escapeHTML(src)}" preload="${block.preload}" ${allowAutoplay ? "autoplay" : ""} ${block.loop ? "loop" : ""} ${block.muted ? "muted" : ""} ${block.controls !== false ? "controls" : ""}></audio>`;
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

function navMarkup(block, data, draft = false, currentPageId = "") {
  const links = data.pages.filter((page) => draft || page.visibility === "listed").map((page) => `<a data-route ${page.id === currentPageId ? 'aria-current="page"' : ""} href="${escapeHTML(routeForPage(data, page.id, "", draft))}">${escapeHTML(page.name)}</a>`).join("");
  return `<nav class="canvas-auto-nav canvas-auto-nav--${block.navOrientation}" style="${typographyStyle(block)};${surfaceStyle(block)};--nav-gap:${block.navGap}px" aria-label="Archive pages">${links || "<span>표시할 공개 페이지가 없어요</span>"}</nav>`;
}

function blockContent(block, data, draft = false, currentPageId = "") {
  if (block.type === "text") {
    const tag = block.htmlTag;
    return `<${tag} class="canvas-block__text" data-text-effect="${block.textEffect}" style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content).replaceAll("\n", "<br>")}</${tag}>`;
  }
  if (block.type === "image") {
    const src = safeURL(block.media || block.src, { imageData: true });
    if (!src) return '<div class="canvas-block__placeholder">IMAGE / GIF</div>';
    if (block.repeat !== "no-repeat") return `<div class="canvas-block__repeated-image" style="background-image:url('${escapeHTML(src)}');background-repeat:${block.repeat};background-size:${block.repeatSize}px auto;border-radius:${block.borderRadius}px"></div>`;
    return `<img src="${escapeHTML(src)}" alt="${block.decorative ? "" : escapeHTML(block.alt)}" ${block.decorative ? 'aria-hidden="true"' : ""} loading="lazy" style="object-fit:${block.objectFit};border-radius:${block.borderRadius}px">`;
  }
  if (block.type === "video") return videoMarkup(block);
  if (block.type === "audio") return audioMarkup(block);
  if (block.type === "button") return `<span class="canvas-block__button" style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content)}</span>`;
  if (block.type === "shape") return `<div class="canvas-block__shape" style="${surfaceStyle(block)}"></div>`;
  if (block.type === "line") return `<div class="canvas-block__line" style="background:${block.background === "transparent" ? block.borderColor : block.background};border-radius:${block.borderRadius}px"></div>`;
  if (block.type === "marquee") return `<div class="canvas-marquee canvas-marquee--${block.direction}" style="${typographyStyle(block)};${surfaceStyle(block)};--marquee-speed:${block.speed}s">${repeatedText(block.content)}</div>`;
  if (block.type === "gallery") return galleryMarkup(block);
  if (block.type === "embed") {
    const src = safeEmbedURL(block.src);
    return src ? `<iframe src="${escapeHTML(src)}" title="${escapeHTML(block.embedTitle)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` : '<div class="canvas-block__placeholder">YOUTUBE / VIMEO / SPOTIFY / MAP</div>';
  }
  if (block.type === "nav") return navMarkup(block, data, draft, currentPageId);
  return "";
}

export function archiveBlockMarkup(rawBlock, { data, editing = false, draft = false, pageId = "" } = {}) {
  const documentData = normalizeArchiveData(data || {});
  const block = normalizeBlock(rawBlock);
  if (!block.visible && !editing) return "";
  const action = actionAttributes(block.action, documentData, { draft });
  let content = blockContent(block, documentData, draft, pageId);
  if (action && !["nav", "video", "audio", "embed"].includes(block.type)) content = `<a class="canvas-block__link" ${action} aria-label="${escapeHTML(block.ariaLabel || block.content || block.name)}">${content}</a>`;
  const motion = block.motion;
  const anchor = block.anchorId || block.id;
  const lightboxSource = block.type === "image" ? safeURL(block.media || block.src, { imageData: true }) : "";
  const lightboxAttributes = block.lightbox ? `data-lightbox ${lightboxSource ? `data-lightbox-src="${escapeHTML(lightboxSource)}"` : ""}` : "";
  const style = `${commonStyle(block)};--entrance-duration:${motion.entrance.duration}ms;--entrance-delay:${motion.entrance.delay}ms;--entrance-easing:${motion.entrance.easing};--hover-duration:${motion.hover.duration}ms;--hover-amount:${motion.hover.amount};--loop-duration:${motion.loop.duration}ms;--loop-delay:${motion.loop.delay}ms;--loop-direction:${motion.loop.direction};`;
  const wrapperSurface = ["image", "video", "audio", "gallery", "embed"].includes(block.type) ? surfaceStyle(block) : "";
  const visitorDraggable = block.publicDraggable && !action && !block.lightbox;
  return `<article id="${escapeHTML(anchor)}" class="canvas-block canvas-block--${block.type}${editing ? " is-editable" : ""}${block.visible ? "" : " is-hidden-layer"}${block.locked ? " is-locked" : ""}" data-block-id="${escapeHTML(block.id)}" data-entrance="${motion.entrance.preset}" data-trigger="${motion.entrance.trigger}" data-once="${motion.entrance.once}" data-loop="${motion.loop.preset}" data-hover="${motion.hover.preset}" data-parallax="${block.parallax}" data-mouse-parallax="${block.mouseParallax}" ${visitorDraggable ? "data-public-draggable" : ""} ${lightboxAttributes} style="${style}"><div class="canvas-block__entrance"><div class="canvas-block__loop"><div class="canvas-block__hover"><div class="canvas-block__content" style="${visualEffectStyle(block)};${wrapperSurface}">${content}</div></div></div></div>${editing ? '<button class="canvas-block__resize" data-resize type="button" aria-label="크기 조절"></button>' : ""}</article>`;
}

export function archiveCanvasMarkup(source, pageOrId = "", { editing = false, draft = false } = {}) {
  const data = normalizeArchiveData(source);
  const page = typeof pageOrId === "object" ? data.pages.find((item) => item.id === pageOrId.id) || pageOrId : data.pages.find((item) => item.id === pageOrId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
  const blocks = page.blocks.map((block) => archiveBlockMarkup(block, { data, editing, draft, pageId: page.id })).join("");
  return `<section class="archive-canvas${editing ? " archive-canvas--editing" : ""}" data-archive-canvas data-page-id="${escapeHTML(page.id)}" style="width:${page.canvas.width}px;height:${page.canvas.height}px;background-color:${page.canvas.background};--canvas-grid:${page.canvas.grid}px">${blocks}${editing && !blocks ? '<div class="archive-canvas__empty">왼쪽에서 요소를 추가하세요</div>' : ""}</section>`;
}

export function archiveSiteChromeMarkup(source, page, { draft = false } = {}) {
  const data = normalizeArchiveData(source);
  const listed = data.pages.filter((item) => draft || item.visibility === "listed");
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
  return data.pages.map((page) => `<div class="studio-page-row ${page.id === activePageId ? "is-active" : ""}"><button data-page-select="${escapeHTML(page.id)}" type="button"><span>${page.visibility === "listed" ? "●" : page.visibility === "unlisted" ? "◌" : "○"}</span><strong>${escapeHTML(page.name)}</strong><small>/${escapeHTML(page.slug)}</small></button><div><button data-page-move="up" data-page-id="${escapeHTML(page.id)}" title="위로" type="button">↑</button><button data-page-move="down" data-page-id="${escapeHTML(page.id)}" title="아래로" type="button">↓</button></div></div>`).join("");
}

function pageSettingsMarkup(data, page) {
  const isHome = page.id === data.settings.defaultPageId;
  return `<section class="studio-panel studio-page-settings"><h2>현재 페이지</h2>
    ${field("페이지 이름", "page.name", page.name)}${field("URL 경로", "page.slug", page.slug)}
    ${field("공개 상태", "page.visibility", page.visibility, "select", option("listed", page.visibility, "공개 · 메뉴 표시") + option("unlisted", page.visibility, "링크로만 접근") + option("draft", page.visibility, "초안 · 일반 사이트에서 숨김"))}
    <details class="studio-details"><summary>아트보드 설정</summary><div class="studio-fields studio-fields--two">${field("너비", "canvas.width", page.canvas.width, "number")}${field("높이", "canvas.height", page.canvas.height, "number")}${field("배경", "canvas.background", page.canvas.background)}${field("스냅", "canvas.grid", page.canvas.grid, "number")}</div>${field("웹폰트 CSS 주소", "canvas.fontStylesheet", page.canvas.fontStylesheet, "url")}</details>
    <details class="studio-details"><summary>SEO · 공유 설정</summary>${field("브라우저 제목", "page.seo.title", page.seo.title)}${field("검색 설명", "page.seo.description", page.seo.description, "textarea")}${field("공유 이미지", "page.seo.image", page.seo.image)}${field("언어 코드", "page.seo.language", page.seo.language)}${field("검색엔진에서 숨김", "page.seo.noIndex", page.seo.noIndex, "checkbox")}</details>
    <div class="studio-page-actions"><button data-action="set-home" type="button" ${isHome ? "disabled" : ""}>${isHome ? "홈페이지" : "홈으로 지정"}</button><button data-action="duplicate-page" type="button">복제</button><button data-action="delete-page" type="button">삭제</button></div>
  </section>`;
}

export function archiveStudioTemplate(source, activePageId = "") {
  const data = normalizeArchiveData(source);
  const page = data.pages.find((item) => item.id === activePageId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
  return `<main id="main" class="archive-page archive-page--studio">
    <div class="archive-studio" data-archive-studio data-active-page="${escapeHTML(page.id)}">
      <aside class="archive-studio__left">
        <div class="archive-studio__brand"><strong>ARCHIVE STUDIO 2</strong><span>local draft</span></div>
        <a class="studio-exit" href="?view=archive">← 사이트로 돌아가기</a>
        <section class="studio-panel studio-pages"><div class="studio-panel__head"><h2>페이지</h2><button data-action="add-page" type="button">＋</button></div><div data-page-list>${pageListMarkup(data, page.id)}</div></section>
        <div data-page-settings>${pageSettingsMarkup(data, page)}</div>
        <section class="studio-panel"><h2>요소 추가</h2><div class="studio-add-grid">
          <button data-add="text" type="button">T&nbsp; 텍스트</button><button data-add="image" type="button">▧ 이미지·GIF</button><button data-add="video" type="button">▶ 영상</button><button data-add="audio" type="button">♪ 오디오</button><button data-add="button" type="button">↗ 버튼</button><button data-add="shape" type="button">○ 도형</button><button data-add="line" type="button">— 선</button><button data-add="marquee" type="button">→ 반복 글자</button><button data-add="gallery" type="button">▦ 갤러리</button><button data-add="embed" type="button">⌘ 임베드</button><button data-add="nav" type="button">☰ 페이지 메뉴</button>
        </div></section>
        <section class="studio-panel"><h2>사이트 동작</h2>
          ${field("페이지 전환", "settings.transition.preset", data.settings.transition.preset, "select", ["none", "fade", "slide", "zoom"].map((item) => option(item, data.settings.transition.preset)).join(""))}
          <div class="studio-fields studio-fields--two">${field("전환 시간(ms)", "settings.transition.duration", data.settings.transition.duration, "number")}${field("커서", "settings.cursor", data.settings.cursor, "select", option("default", data.settings.cursor, "기본") + option("dot", data.settings.cursor, "점") + option("crosshair", data.settings.cursor, "십자"))}</div>
          <div class="studio-checks">${field("자동 페이지 메뉴", "settings.showPageNav", data.settings.showPageNav, "checkbox")}${field("스크롤 진행선", "settings.showScrollProgress", data.settings.showScrollProgress, "checkbox")}${field("모션 정지 버튼", "settings.showMotionToggle", data.settings.showMotionToggle, "checkbox")}</div>
        </section>
        <section class="studio-panel studio-layers"><h2>레이어</h2><div data-layer-list></div></section>
      </aside>
      <section class="archive-studio__center">
        <header class="archive-studio__topbar"><span data-save-status>이 브라우저에 자동 저장됨</span><div><button data-action="undo" type="button" title="실행 취소">↶</button><button data-action="redo" type="button" title="다시 실행">↷</button><select data-zoom aria-label="캔버스 확대"><option value="0.25">25%</option><option value="0.5" selected>50%</option><option value="0.75">75%</option><option value="1">100%</option></select><button data-action="preflight" type="button">게시 전 검수</button><button data-action="preview" type="button">미리보기</button><button data-action="import" type="button">JSON 불러오기</button><button data-action="reset-published" type="button">게시본 복원</button><button data-action="download" type="button">백업</button><button class="studio-publish" data-action="publish" type="button">게시 준비</button></div></header>
        <div class="archive-studio__workspace"><div class="archive-studio__board-sizer"><div class="archive-studio__board">${archiveCanvasMarkup(data, page, { editing: true })}</div></div></div>
      </section>
      <aside class="archive-studio__inspector" data-inspector><div class="inspector-empty"><span>NO SELECTION</span><p>요소를 선택하면 위치·폰트·링크·애니메이션을 바꿀 수 있어요.</p></div></aside>
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

function inspectorMarkup(block, data) {
  const mediaFields = block.type === "image" ? `
    ${field("외부 이미지·GIF 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="pick-image" type="button">작은 이미지·GIF 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">큰 이미지·GIF 업로드 ↗</button>
    ${field("설명(alt)", "alt", block.alt)}${field("장식 이미지", "decorative", block.decorative, "checkbox")}
    ${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain", "fill"].map((item) => option(item, block.objectFit)).join(""))}
    ${field("반복", "repeat", block.repeat, "select", ["no-repeat", "repeat", "repeat-x", "repeat-y"].map((item) => option(item, block.repeat)).join(""))}
    ${field("반복 크기", "repeatSize", block.repeatSize, "number")}${field("클릭 시 크게 보기", "lightbox", block.lightbox, "checkbox")}` : "";
  const videoFields = block.type === "video" ? `
    ${field("YouTube·Vimeo·외부 영상 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-video" type="button">MP4·WebM 영상 파일 업로드 ↗</button><p class="studio-help">GitHub 웹 업로드는 파일당 25MB까지예요. 긴 영상은 YouTube·Vimeo 링크를 사용하세요.</p>
    ${field("포스터 이미지", "poster", block.poster)}${field("WebVTT 자막 경로", "captions", block.captions)}${field("영상 설명", "alt", block.alt)}
    <div class="studio-checks">${field("자동재생", "autoplay", block.autoplay, "checkbox")}${field("반복", "loop", block.loop, "checkbox")}${field("음소거", "muted", block.muted, "checkbox")}${field("컨트롤", "controls", block.controls, "checkbox")}</div>` : "";
  const audioFields = block.type === "audio" ? `${field("오디오 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-audio" type="button">MP3·WAV 업로드 ↗</button><div class="studio-checks">${field("자동재생", "autoplay", block.autoplay, "checkbox")}${field("반복", "loop", block.loop, "checkbox")}${field("컨트롤", "controls", block.controls, "checkbox")}</div>` : "";
  const buttonFields = block.type === "button" ? `<div class="studio-presets"><button data-button-preset="square" type="button">각진</button><button data-button-preset="round" type="button">둥근</button><button data-button-preset="pill" type="button">캡슐</button><button data-button-preset="circle" type="button">원형</button><button data-button-preset="outline" type="button">테두리</button></div>${field("배경 이미지·GIF 링크/경로", "backgroundImage", block.backgroundImage)}<button class="inspector-file" data-action="pick-button-image" type="button">작은 버튼 이미지 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">큰 버튼 이미지 업로드 ↗</button>` : "";
  const textFields = ["text", "button", "marquee", "nav"].includes(block.type) ? `
    ${["text", "button", "marquee"].includes(block.type) ? field(block.type === "button" ? "버튼 글자" : "내용", "content", block.content, "textarea") : ""}
    ${block.type === "text" ? field("HTML 의미", "htmlTag", block.htmlTag, "select", ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div"].map((item) => option(item, block.htmlTag)).join("")) : ""}
    ${field("폰트", "fontFamily", block.fontFamily)}
    <div class="studio-fields studio-fields--two">${field("크기", "fontSize", block.fontSize, "number")}${field("굵기", "fontWeight", block.fontWeight, "number")}${field("행간", "lineHeight", block.lineHeight, "number")}${field("자간", "letterSpacing", block.letterSpacing, "number")}</div>
    ${field("정렬", "textAlign", block.textAlign, "select", ["left", "center", "right"].map((item) => option(item, block.textAlign)).join(""))}${block.type === "text" ? field("글자 효과", "textEffect", block.textEffect, "select", option("none", block.textEffect, "없음") + option("typewriter", block.textEffect, "타이프라이터") + option("scramble", block.textEffect, "스크램블")) : ""}` : "";
  const marqueeFields = block.type === "marquee" ? `<div class="studio-fields studio-fields--two">${field("속도(초)", "speed", block.speed, "number")}${field("방향", "direction", block.direction, "select", option("left", block.direction, "왼쪽") + option("right", block.direction, "오른쪽"))}</div>` : "";
  const galleryFields = block.type === "gallery" ? `${field("한 줄: 이미지 경로 | alt 설명 | 캡션", "galleryItemsText", block.galleryItems.map((item) => [item.src, item.alt, item.caption].join(" | ")).join("\n"), "textarea")}${field("보기 방식", "galleryMode", block.galleryMode, "select", option("grid", block.galleryMode, "그리드") + option("slideshow", block.galleryMode, "슬라이드쇼"))}<div class="studio-fields studio-fields--two">${field("열 수", "galleryColumns", block.galleryColumns, "number")}${field("간격", "galleryGap", block.galleryGap, "number")}${field("전환 간격(ms)", "galleryInterval", block.galleryInterval, "number")}</div>${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain"].map((item) => option(item, block.objectFit)).join(""))}${field("클릭 시 크게 보기", "lightbox", block.lightbox, "checkbox")}<button class="inspector-file" data-action="upload-media" type="button">갤러리 이미지 업로드 ↗</button>` : "";
  const embedFields = block.type === "embed" ? `${field("임베드 링크", "src", block.src, "url")}${field("접근성 제목", "embedTitle", block.embedTitle)}<p class="studio-help">YouTube, Vimeo, Spotify, SoundCloud, Google Maps 임베드를 허용합니다.</p>` : "";
  const navFields = block.type === "nav" ? `${field("방향", "navOrientation", block.navOrientation, "select", option("horizontal", block.navOrientation, "가로") + option("vertical", block.navOrientation, "세로"))}${field("메뉴 간격", "navGap", block.navGap, "number")}<p class="studio-help">‘공개 · 메뉴 표시’ 페이지만 자동으로 보여요.</p>` : "";
  return `<div class="inspector-head"><div><span>${escapeHTML(block.type)}</span><strong>${escapeHTML(block.name)}</strong></div><button data-action="delete" type="button">삭제</button></div>
    <section class="studio-panel"><h2>레이어</h2>${field("이름", "name", block.name)}<div class="studio-fields studio-fields--two">${field("X", "x", block.x, "number")}${field("Y", "y", block.y, "number")}${field("W", "width", block.width, "number")}${field("H", "height", block.height, "number")}${field("회전", "rotation", block.rotation, "number")}${field("투명도", "opacity", block.opacity, "number")}</div><div class="studio-checks">${field("숨김", "visibleInverse", !block.visible, "checkbox")}${field("잠금", "locked", block.locked, "checkbox")}</div>${field("위치 ID", "anchorId", block.anchorId)}<div class="inspector-actions"><button data-action="duplicate" type="button">복제</button><button data-action="back" type="button">뒤로</button><button data-action="front" type="button">앞으로</button></div></section>
    <section class="studio-panel"><h2>내용</h2>${textFields}${mediaFields}${videoFields}${audioFields}${buttonFields}${marqueeFields}${galleryFields}${embedFields}${navFields}</section>
    ${["nav", "video", "audio", "embed"].includes(block.type) ? "" : `<section class="studio-panel"><h2>클릭 동작</h2>${actionFields(block, data)}${field("접근성 이름", "ariaLabel", block.ariaLabel)}</section>`}
    <section class="studio-panel"><h2>모양</h2><div class="studio-fields studio-fields--two">${field("글자색", "color", block.color)}${field("배경/그라디언트", "background", block.background)}${field("선 색", "borderColor", block.borderColor)}${field("선 두께", "borderWidth", block.borderWidth, "number")}${field("둥근 모서리", "borderRadius", block.borderRadius, "number")}${field("안쪽 여백", "padding", block.padding, "number")}${field("블러", "blur", block.blur, "number")}${field("흑백", "grayscale", block.grayscale, "number")}</div>${field("블렌드", "blendMode", block.blendMode, "select", ["normal", "multiply", "screen", "overlay", "difference", "exclusion", "color-burn", "color-dodge"].map((item) => option(item, block.blendMode)).join(""))}<div class="studio-fields studio-fields--two">${field("그림자 X", "shadowX", block.shadowX, "number")}${field("그림자 Y", "shadowY", block.shadowY, "number")}${field("그림자 번짐", "shadowBlur", block.shadowBlur, "number")}${field("그림자 색", "shadowColor", block.shadowColor)}</div></section>
    <section class="studio-panel"><h2>애니메이션</h2>${field("등장", "motion.entrance.preset", block.motion.entrance.preset, "select", ["none", "fade", "rise", "fall", "slide-left", "slide-right", "scale", "blur", "rotate"].map((item) => option(item, block.motion.entrance.preset)).join(""))}<div class="studio-fields studio-fields--two">${field("트리거", "motion.entrance.trigger", block.motion.entrance.trigger, "select", option("load", block.motion.entrance.trigger, "페이지 열림") + option("scroll", block.motion.entrance.trigger, "스크롤 진입"))}${field("시간(ms)", "motion.entrance.duration", block.motion.entrance.duration, "number")}${field("지연(ms)", "motion.entrance.delay", block.motion.entrance.delay, "number")}${field("호버", "motion.hover.preset", block.motion.hover.preset, "select", ["none", "lift", "scale", "tilt", "glow", "invert", "fade"].map((item) => option(item, block.motion.hover.preset)).join(""))}${field("반복", "motion.loop.preset", block.motion.loop.preset, "select", ["none", "float", "pulse", "spin", "bounce", "sway", "breathe"].map((item) => option(item, block.motion.loop.preset)).join(""))}${field("반복 시간(ms)", "motion.loop.duration", block.motion.loop.duration, "number")}${field("반복 방향", "motion.loop.direction", block.motion.loop.direction, "select", option("normal", block.motion.loop.direction, "정방향") + option("reverse", block.motion.loop.direction, "역방향") + option("alternate", block.motion.loop.direction, "왕복"))}${field("스크롤 패럴랙스", "parallax", block.parallax, "number")}${field("마우스 패럴랙스", "mouseParallax", block.mouseParallax, "number")}</div><div class="studio-checks">${field("스크롤 등장 한 번만", "motion.entrance.once", block.motion.entrance.once, "checkbox")}${field("방문자가 드래그", "publicDraggable", block.publicDraggable, "checkbox")}</div></section>`;
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
  const widths = { marquee: 720, text: 520, button: 220, line: 420, nav: 520, gallery: 640, embed: 560, audio: 420 };
  const heights = { marquee: 72, text: 130, button: 64, line: 2, nav: 64, gallery: 420, embed: 315, audio: 64 };
  return normalizeBlock({
    id: uid(type),
    name: `${type[0].toUpperCase()}${type.slice(1)} ${index + 1}`,
    type,
    x: Math.max(40, Math.round(page.canvas.width / 2 - (widths[type] || 360) / 2) + index * 8),
    y: 100 + index * 24,
    z: maxZ + 1,
    width: widths[type] || 360,
    height: heights[type] || 260,
    controls: ["video", "audio"].includes(type),
    galleryItems: type === "gallery" ? [{ src: "", alt: "", caption: "" }] : [],
  }, index);
}

function runPreflight(data) {
  const warnings = [];
  const slugs = new Set();
  const reachable = new Set(data.pages.filter((page) => page.visibility === "listed" || page.id === data.settings.defaultPageId).filter((page) => page.visibility !== "draft").map((page) => page.id));
  let changed = true;
  while (changed) {
    changed = false;
    data.pages.filter((page) => reachable.has(page.id)).forEach((page) => page.blocks.filter((block) => block.visible && block.action.type === "page").forEach((block) => {
      const target = data.pages.find((item) => item.id === block.action.pageId && item.visibility !== "draft");
      if (target && !reachable.has(target.id)) { reachable.add(target.id); changed = true; }
    }));
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
      if (block.type === "video" && block.autoplay && !block.muted) warnings.push(`${page.name} / ${block.name}: 소리 있는 자동재생은 브라우저가 막을 수 있음`);
      if (["video", "audio"].includes(block.type) && !safeURL(block.media || block.src)) warnings.push(`${page.name} / ${block.name}: 미디어 파일 또는 링크 없음`);
      if (block.type === "gallery" && !block.galleryItems.some((item) => safeURL(item.src, { imageData: true }))) warnings.push(`${page.name} / ${block.name}: 갤러리 이미지 없음`);
      if (block.type === "embed" && !safeEmbedURL(block.src)) warnings.push(`${page.name} / ${block.name}: 허용되는 임베드 링크가 아님`);
      if (["nav", "video", "audio", "embed"].includes(block.type) && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 이 요소 종류의 클릭 동작은 사용되지 않음`);
      if (block.publicDraggable && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 클릭 목적지와 방문자 드래그를 함께 쓸 수 없어 클릭이 우선됨`);
      if (block.publicDraggable && block.lightbox) warnings.push(`${page.name} / ${block.name}: 라이트박스와 방문자 드래그를 함께 쓸 수 없어 라이트박스가 우선됨`);
      if (block.lightbox && action.type !== "none") warnings.push(`${page.name} / ${block.name}: 클릭 목적지와 라이트박스를 함께 켜서 클릭 목적지가 우선됨`);
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
  const hasContinuousMotion = data.pages.some((page) => page.blocks.some((block) => block.visible && (block.type === "marquee" || block.motion.loop.preset !== "none" || (block.type === "video" && block.autoplay && block.loop) || /\.gif(?:$|\?)/i.test(block.media || block.src))));
  if (hasContinuousMotion && !data.settings.showMotionToggle) warnings.push("계속 움직이는 요소가 있지만 방문자용 모션 정지 버튼이 꺼져 있음");
  return warnings;
}

export function bindArchiveViewer(source, pageOrId = "") {
  const data = normalizeArchiveData(source);
  const page = typeof pageOrId === "object" ? pageOrId : data.pages.find((item) => item.id === pageOrId) || data.pages.find((item) => item.id === data.settings.defaultPageId) || data.pages[0];
  const canvas = document.querySelector("[data-archive-canvas]");
  const sizer = document.querySelector("[data-archive-sizer]");
  if (!canvas || !sizer) return;
  const cleanups = [];
  let paused = false;

  const resize = () => {
    const scale = Math.min(1, innerWidth / page.canvas.width);
    canvas.style.transform = `scale(${scale})`;
    sizer.style.width = `${page.canvas.width * scale}px`;
    sizer.style.height = `${page.canvas.height * scale}px`;
  };
  resize();
  addEventListener("resize", resize);
  cleanups.push(() => removeEventListener("resize", resize));

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealNodes = [...canvas.querySelectorAll("[data-entrance]")];
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

  canvas.querySelectorAll("[data-archive-back]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); history.back(); }));

  canvas.querySelectorAll("[data-gallery]").forEach((gallery) => {
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
  };
  canvas.querySelectorAll("[data-lightbox]").forEach((block) => block.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    const image = event.target.closest("img") || event.target.closest("figure")?.querySelector("img") || block.querySelector("img");
    const src = image?.currentSrc || image?.src || block.dataset.lightboxSrc;
    if (src) openLightbox(src, image?.alt || "");
  }));

  canvas.querySelectorAll('[data-text-effect]:not([data-text-effect="none"])').forEach((node) => {
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

  const motionBlocks = [...canvas.querySelectorAll("[data-parallax], [data-mouse-parallax]")];
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

  canvas.querySelectorAll("[data-public-draggable]").forEach((node) => {
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
      const scale = Math.max(.01, canvas.getBoundingClientRect().width / page.canvas.width);
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

  const motionToggle = document.querySelector("[data-motion-toggle]");
  if (motionToggle) {
    const toggle = () => {
      paused = !paused;
      document.documentElement.classList.toggle("archive-motion-paused", paused);
      motionToggle.textContent = paused ? "Play motion" : "Pause motion";
      canvas.querySelectorAll("video,audio").forEach((media) => paused ? media.pause() : blockSafePlay(media));
      if (paused) motionBlocks.forEach((node) => { node.style.setProperty("--parallax-x", "0px"); node.style.setProperty("--parallax-y", "0px"); });
      else updateParallax();
    };
    motionToggle.addEventListener("click", toggle); cleanups.push(() => motionToggle.removeEventListener("click", toggle));
  }

  if (data.settings.cursor !== "default" && !matchMedia("(pointer: coarse)").matches) {
    const cursor = document.createElement("div");
    cursor.className = `archive-custom-cursor archive-custom-cursor--${data.settings.cursor}`;
    cursor.style.setProperty("--cursor-color", data.settings.cursorColor);
    document.body.append(cursor);
    const move = (event) => { cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`; };
    addEventListener("pointermove", move, { passive: true });
    document.documentElement.classList.add("has-archive-cursor");
    cleanups.push(() => { removeEventListener("pointermove", move); cursor.remove(); document.documentElement.classList.remove("has-archive-cursor"); });
  }

  return () => { cleanups.forEach((cleanup) => cleanup()); document.documentElement.classList.remove("archive-motion-paused"); };
}

function blockSafePlay(media) {
  if (media.autoplay) media.play().catch(() => {});
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
  let selectedId = currentPage()?.blocks[0]?.id || "";
  let drag = null;
  let zoom = number(studio.querySelector("[data-zoom]")?.value, 0.5, 0.1, 2);
  let historyStack = [JSON.stringify(data)];
  let historyIndex = 0;

  function currentPage() { return data.pages.find((page) => page.id === activePageId) || data.pages[0]; }
  const canvas = () => studio.querySelector("[data-archive-canvas]");
  const selected = () => currentPage()?.blocks.find((block) => block.id === selectedId);
  const status = (message) => { const node = studio.querySelector("[data-save-status]"); if (node) node.textContent = message; };

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
    board.style.transform = `scale(${zoom})`;
    board.style.setProperty("--studio-zoom", zoom);
    sizer.style.width = `${page.canvas.width * zoom}px`;
    sizer.style.height = `${page.canvas.height * zoom}px`;
  };

  const renderCanvas = () => {
    const board = studio.querySelector(".archive-studio__board");
    board.innerHTML = archiveCanvasMarkup(data, currentPage(), { editing: true });
    const element = selectedId ? board.querySelector(`[data-block-id="${CSS.escape(selectedId)}"]`) : null;
    element?.classList.add("is-selected");
    applyZoom();
  };

  const renderPages = () => {
    studio.querySelector("[data-page-list]").innerHTML = pageListMarkup(data, activePageId);
    studio.querySelector("[data-page-settings]").innerHTML = pageSettingsMarkup(data, currentPage());
  };

  const renderLayers = () => {
    const list = studio.querySelector("[data-layer-list]");
    list.innerHTML = [...currentPage().blocks].sort((a, b) => b.z - a.z).map((block) => `<button class="studio-layer ${block.id === selectedId ? "is-active" : ""}" data-select="${escapeHTML(block.id)}" type="button"><span>${block.visible ? (block.locked ? "🔒" : block.type) : "숨김"}</span>${escapeHTML(block.name)}</button>`).join("") || '<p class="studio-muted">아직 레이어가 없어요.</p>';
  };

  const renderInspector = () => {
    const inspector = studio.querySelector("[data-inspector]");
    const block = selected();
    inspector.innerHTML = block ? inspectorMarkup(block, data) : '<div class="inspector-empty"><span>NO SELECTION</span><p>요소를 선택하면 위치·폰트·링크·애니메이션을 바꿀 수 있어요.</p></div>';
  };

  const renderSelection = ({ pages = false } = {}) => {
    if (pages) renderPages();
    renderCanvas(); renderLayers(); renderInspector();
  };

  const selectBlock = (id) => { selectedId = id; renderSelection(); };
  const selectPage = (id) => {
    if (!data.pages.some((page) => page.id === id)) return;
    activePageId = id; selectedId = currentPage().blocks[0]?.id || "";
    syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true });
  };

  const duplicateBlock = (block) => {
    const copy = normalizeBlock({ ...clone(block), id: uid(block.type), name: `${block.name} copy`, x: block.x + 24, y: block.y + 24, z: Math.max(0, ...currentPage().blocks.map((item) => item.z)) + 1 }, currentPage().blocks.length);
    currentPage().blocks.push(copy); selectedId = copy.id; persist(); renderSelection();
  };

  const restoreHistory = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= historyStack.length) return;
    historyIndex = nextIndex; data = normalizeArchiveData(JSON.parse(historyStack[historyIndex]));
    if (!data.pages.some((page) => page.id === activePageId)) activePageId = data.settings.defaultPageId;
    selectedId = currentPage().blocks.some((block) => block.id === selectedId) ? selectedId : currentPage().blocks[0]?.id || "";
    const saved = saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true }); status(saved ? (historyIndex ? "실행 기록을 불러옴" : "처음 상태") : "자동 저장 실패 — 지금 JSON 백업을 눌러주세요");
  };

  studio.addEventListener("click", async (event) => {
    const pageButton = event.target.closest("[data-page-select]");
    if (pageButton) { selectPage(pageButton.dataset.pageSelect); return; }
    const pageMove = event.target.closest("[data-page-move]");
    if (pageMove) {
      const index = data.pages.findIndex((page) => page.id === pageMove.dataset.pageId);
      const target = pageMove.dataset.pageMove === "up" ? index - 1 : index + 1;
      if (index >= 0 && target >= 0 && target < data.pages.length) [data.pages[index], data.pages[target]] = [data.pages[target], data.pages[index]];
      persist(); renderPages(); return;
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
    if (add) {
      const block = defaultBlock(add.dataset.add, currentPage());
      currentPage().blocks.push(block); selectedId = block.id; persist(); renderSelection(); return;
    }
    const layer = event.target.closest("[data-select]");
    if (layer) { selectBlock(layer.dataset.select); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const block = selected();
    if (block?.locked && ["delete", "duplicate", "front", "back", "pick-image", "pick-button-image", "upload-media", "upload-video", "upload-audio"].includes(action)) { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); return; }
    if (action === "add-page") {
      const page = normalizePage({ id: uid("page"), name: `Page ${data.pages.length + 1}`, slug: `page-${data.pages.length + 1}`, visibility: "unlisted", canvas: clone(currentPage().canvas), seo: { noIndex: true } }, data.pages.length);
      data.pages.push(page); activePageId = page.id; selectedId = ""; persist(); renderSelection({ pages: true });
    } else if (action === "set-home") {
      if (currentPage().visibility === "draft") { alert("초안 페이지는 홈으로 지정할 수 없어요. 먼저 공개 또는 링크 전용으로 바꿔주세요."); return; }
      data.settings.defaultPageId = activePageId; persist(); renderPages();
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
      currentPage().blocks = currentPage().blocks.filter((item) => item.id !== block.id); selectedId = currentPage().blocks.at(-1)?.id || ""; persist(); renderSelection();
    } else if (action === "duplicate" && block) duplicateBlock(block);
    else if ((action === "front" || action === "back") && block) {
      block.z = action === "front" ? Math.max(0, ...currentPage().blocks.map((item) => item.z)) + 1 : Math.max(0, Math.min(...currentPage().blocks.map((item) => item.z)) - 1); persist(); renderSelection();
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
      const page = currentPage(); const params = new URLSearchParams({ view: "archive", draft: "1" }); if (page.id !== data.settings.defaultPageId) params.set("page", page.slug); window.open(`?${params}`, "_blank", "noopener");
    } else if (action === "import") studio.querySelector("[data-json-picker]").click();
    else if (action === "reset-published") {
      if (!confirm("브라우저에 저장된 작업을 버리고 현재 게시본으로 되돌릴까요? 먼저 백업을 권장해요.")) return;
      data = clone(published); activePageId = data.settings.defaultPageId; selectedId = currentPage().blocks[0]?.id || ""; historyStack = [JSON.stringify(data)]; historyIndex = 0; draftBase = fingerprint(published); draftConflict = false; saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true }); status("현재 게시본으로 되돌렸어요");
    }
    else if (action === "download") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "archive-v2.json"; link.click(); URL.revokeObjectURL(link.href);
    } else if (action === "publish") {
      if (draftConflict && !confirm("GitHub의 현재 게시본이 이 로컬 초안을 만든 뒤 변경됐어요. 먼저 JSON 백업을 저장하고 차이를 확인하는 것이 안전해요. 그래도 게시 준비를 계속할까요?")) return;
      window.open(GITHUB_EDIT_URL, "_blank", "noopener");
      try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); status("복사 완료 — 열린 GitHub에서 전체 붙여넣고 Commit changes"); } catch (error) { status("백업 버튼으로 JSON을 받은 뒤 GitHub에서 교체하세요"); }
    }
  });

  studio.addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]"); if (!input) return;
    const path = input.dataset.field;
    const page = currentPage(); const block = selected();
    if (path === "page.visibility" && input.value === "draft" && page.id === data.settings.defaultPageId) {
      alert("현재 홈페이지는 초안으로 바꿀 수 없어요. 다른 페이지를 홈으로 지정한 뒤 변경해주세요.");
      input.value = page.visibility;
      return;
    }
    let target = block; let cleanPath = path;
    if (path.startsWith("settings.")) target = data;
    else if (path.startsWith("page.")) { target = page; cleanPath = path.slice(5); }
    else if (path.startsWith("canvas.")) { target = page; cleanPath = path; }
    if (!target) return;
    if (target === block && block?.locked && cleanPath !== "locked") { status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); renderInspector(); return; }
    if (cleanPath === "galleryItemsText" && block) block.galleryItems = normalizeGalleryItems(input.value);
    else if (cleanPath === "visibleInverse" && block) block.visible = !input.checked;
    else {
      const current = getPath(target, cleanPath);
      const value = input.type === "checkbox" ? input.checked : typeof current === "number" ? number(input.value, current) : input.value;
      setPath(target, cleanPath, value);
      if (target === block && cleanPath === "motion.loop.preset" && value === "spin") {
        block.motion.loop.direction = "normal";
        const directionInput = studio.querySelector('[data-field="motion.loop.direction"]');
        if (directionInput) directionInput.value = "normal";
      }
      if (target === page && cleanPath === "visibility" && value === "unlisted") page.seo.noIndex = true;
    }
    persist(); renderCanvas(); renderLayers();
  });

  studio.addEventListener("change", (event) => {
    if (event.target.matches("[data-zoom]")) { zoom = number(event.target.value, 0.5, 0.1, 2); applyZoom(); return; }
    if (event.target.matches('[data-field="page.name"],[data-field="page.slug"],[data-field="page.visibility"]')) renderPages();
    if (event.target.matches('[data-field="action.type"]')) renderInspector();
  });

  studio.querySelector("[data-image-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; const block = selected(); if (!file || !block) return;
    if (file.size > 1_500_000) { alert("1.5MB보다 큰 파일은 업로드 버튼으로 GitHub media 폴더에 올린 뒤 /media/파일명 경로를 붙여주세요."); event.target.value = ""; return; }
    const target = event.target.dataset.target;
    const reader = new FileReader(); reader.onload = () => { if (target === "button") block.backgroundImage = String(reader.result); else { block.src = String(reader.result); block.media = ""; } persist(); renderSelection(); }; reader.readAsDataURL(file); event.target.value = "";
  });

  studio.querySelector("[data-json-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { try { data = normalizeArchiveData(JSON.parse(String(reader.result))); activePageId = data.settings.defaultPageId; selectedId = currentPage().blocks[0]?.id || ""; draftBase = fingerprint(published); draftConflict = false; persist(); renderSelection({ pages: true }); status("JSON 프로젝트를 불러왔어요"); } catch (error) { alert("올바른 Archive JSON 파일이 아니에요."); } };
    reader.readAsText(file); event.target.value = "";
  });

  studio.addEventListener("pointerdown", (event) => {
    const blockElement = event.target.closest(".canvas-block"); if (!blockElement || !canvas()?.contains(blockElement)) return;
    event.preventDefault(); selectedId = blockElement.dataset.blockId; const block = selected();
    canvas()?.querySelectorAll(".is-selected").forEach((element) => element.classList.remove("is-selected"));
    if (block.locked) { renderLayers(); renderInspector(); blockElement.classList.add("is-selected"); return; }
    blockElement.setPointerCapture?.(event.pointerId);
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: block.x, y: block.y, width: block.width, height: block.height, resize: Boolean(event.target.closest("[data-resize]")) };
    renderLayers(); renderInspector(); blockElement.classList.add("is-selected");
  });

  studio.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return; const block = selected(); if (!block) return;
    const dx = (event.clientX - drag.startX) / zoom; const dy = (event.clientY - drag.startY) / zoom; const snap = (value) => Math.round(value / currentPage().canvas.grid) * currentPage().canvas.grid;
    const radians = block.rotation * Math.PI / 180; const cosine = Math.cos(radians); const sine = Math.sin(radians); const localX = dx * cosine + dy * sine; const localY = -dx * sine + dy * cosine;
    if (drag.resize) {
      const oldCenterX = drag.x + drag.width / 2; const oldCenterY = drag.y + drag.height / 2;
      const fixedCornerX = oldCenterX - drag.width * cosine / 2 + drag.height * sine / 2;
      const fixedCornerY = oldCenterY - drag.width * sine / 2 - drag.height * cosine / 2;
      const nextWidth = Math.max(2, snap(drag.width + localX)); const nextHeight = Math.max(2, snap(drag.height + localY));
      const nextCenterX = fixedCornerX + nextWidth * cosine / 2 - nextHeight * sine / 2;
      const nextCenterY = fixedCornerY + nextWidth * sine / 2 + nextHeight * cosine / 2;
      block.width = nextWidth; block.height = nextHeight; block.x = nextCenterX - nextWidth / 2; block.y = nextCenterY - nextHeight / 2;
    }
    else { block.x = snap(drag.x + dx); block.y = snap(drag.y + dy); }
    const element = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`); if (element) element.setAttribute("style", `${commonStyle(block)};--entrance-duration:${block.motion.entrance.duration}ms;--entrance-delay:${block.motion.entrance.delay}ms;--entrance-easing:${block.motion.entrance.easing};--hover-duration:${block.motion.hover.duration}ms;--hover-amount:${block.motion.hover.amount};--loop-duration:${block.motion.loop.duration}ms;--loop-delay:${block.motion.loop.delay}ms;--loop-direction:${block.motion.loop.direction}`); status("편집 중…");
  });

  const finishDrag = (event) => { if (!drag || event.pointerId !== drag.pointerId) return; drag = null; persist(); renderInspector(); };
  studio.addEventListener("pointerup", finishDrag); studio.addEventListener("pointercancel", finishDrag);

  const handleKeydown = (event) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); restoreHistory(historyIndex + (event.shiftKey ? 1 : -1)); return; }
    if (typing || !selected()) return;
    if (selected().locked) { if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d")) { event.preventDefault(); status("잠긴 레이어예요 · 먼저 잠금을 해제하세요"); } return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateBlock(selected()); return; }
    if (["Backspace", "Delete"].includes(event.key)) { event.preventDefault(); currentPage().blocks = currentPage().blocks.filter((block) => block.id !== selectedId); selectedId = currentPage().blocks.at(-1)?.id || ""; persist(); renderSelection(); return; }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) { event.preventDefault(); const amount = event.shiftKey ? 10 : 1; selected().x += moves[event.key][0] * amount; selected().y += moves[event.key][1] * amount; persist(); renderSelection(); }
  };
  addEventListener("keydown", handleKeydown);

  const initiallySaved = saveDraft(data, published, draftBase); syncArchiveFontStylesheet(data, activePageId); renderSelection({ pages: true });
  if (!initiallySaved) status("자동 저장 실패 — JSON 백업을 눌러주세요");
  else if (draftConflict) status("게시본이 변경됐어요 · 백업 후 비교하고 게시하세요");
  return () => { saveDraft(data, published, draftBase); removeEventListener("keydown", handleKeydown); };
}
