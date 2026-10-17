// Runs custom components (components/*.js) and sandboxed code blocks inside Archive pages.
// The contract every component follows is documented in docs/COMPONENTS.md.

import { COMPONENTS } from "../components/registry.js?v=studio8b";

const VERSION = "studio8b";

// Pinned CDN builds a component may ask for with ctx.lib(name).
export const LIBRARIES = {
  three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  gsap: "https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js",
  ScrollTrigger: "https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js",
  lenis: "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs",
  lottie: "https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/esm/lottie.min.js",
  dotlottie: "https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.40.0/dist/index.js",
};

const PROP_TYPES = ["text", "textarea", "number", "range", "color", "toggle", "select", "image", "images", "url"];
const moduleCache = new Map();
const libraryCache = new Map();
export const componentMetas = new Map();

export const isRegisteredComponent = (id) => COMPONENTS.includes(id);
export const registeredComponents = () => COMPONENTS.slice();

export function loadComponent(id) {
  if (!isRegisteredComponent(id)) return Promise.reject(new Error(`"${id}" is not listed in components/registry.js`));
  if (!moduleCache.has(id)) moduleCache.set(id, import(`../components/${id}.js?v=${VERSION}`));
  return moduleCache.get(id);
}

export function loadLibrary(name) {
  const url = LIBRARIES[name];
  if (!url) return Promise.reject(new Error(`Unknown library "${name}". Add it to LIBRARIES in archive/components-host.js`));
  if (!libraryCache.has(name)) libraryCache.set(name, import(url));
  return libraryCache.get(name);
}

function normalizeMeta(id, meta = {}) {
  meta = meta || {};
  const props = (Array.isArray(meta.props) ? meta.props : []).filter((prop) => prop && /^[a-zA-Z][\w-]*$/.test(prop.key || "")).map((prop) => ({
    key: prop.key,
    label: String(prop.label || prop.key),
    type: PROP_TYPES.includes(prop.type) ? prop.type : "text",
    default: prop.default,
    min: Number.isFinite(prop.min) ? prop.min : undefined,
    max: Number.isFinite(prop.max) ? prop.max : undefined,
    step: Number.isFinite(prop.step) ? prop.step : undefined,
    options: Array.isArray(prop.options) ? prop.options.map((option) => Array.isArray(option) ? [String(option[0]), String(option[1] ?? option[0])] : [String(option), String(option)]) : [],
    help: prop.help ? String(prop.help) : "",
  }));
  return {
    id,
    name: String(meta.name || id),
    description: String(meta.description || ""),
    category: String(meta.category || "effect"),
    defaultSize: { width: Number(meta.defaultSize?.width) || 640, height: Number(meta.defaultSize?.height) || 420 },
    interactive: meta.interactive !== false,
    runsWhenReduced: Boolean(meta.runsWhenReduced),
    runsOffscreen: Boolean(meta.runsOffscreen),
    props,
  };
}

let metasPromise = null;
export function loadComponentMetas() {
  metasPromise ||= Promise.all(COMPONENTS.map((id) => loadComponent(id)
    .then((module) => normalizeMeta(id, module.meta))
    .catch((error) => ({ ...normalizeMeta(id, { name: id }), error: error.message }))))
    .then((metas) => { metas.forEach((meta) => componentMetas.set(meta.id, meta)); return metas; });
  return metasPromise;
}

function coerce(prop, value) {
  if (value === undefined || value === null) return prop.default ?? (prop.type === "toggle" ? false : prop.type === "images" ? [] : ["number", "range"].includes(prop.type) ? 0 : "");
  if (["number", "range"].includes(prop.type)) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return prop.default ?? 0;
    return Math.min(prop.max ?? Infinity, Math.max(prop.min ?? -Infinity, parsed));
  }
  if (prop.type === "toggle") return value === true || value === "true";
  if (prop.type === "select") return prop.options.some(([option]) => option === String(value)) ? String(value) : prop.default ?? prop.options[0]?.[0] ?? "";
  if (prop.type === "images") return (Array.isArray(value) ? value : String(value).split("\n")).map((item) => String(item).trim()).filter(Boolean).slice(0, 60);
  return String(value).slice(0, 20000);
}

export function resolveProps(meta, raw = {}) {
  const props = {};
  (meta?.props || []).forEach((prop) => { props[prop.key] = coerce(prop, raw?.[prop.key]); });
  return props;
}

// Keeps only plain JSON values so archive.json stays portable.
export function sanitizeProps(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clean = {};
  Object.entries(raw).slice(0, 80).forEach(([key, value]) => {
    if (!/^[a-zA-Z][\w-]*$/.test(key)) return;
    if (typeof value === "string") clean[key] = value.slice(0, 20000);
    else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean") clean[key] = value;
    // Studio 7: 드롭으로 넣은 프레임은 data URL이라 길다 — 이미지 data URL은 자르지 않는다(최대 2MB).
    else if (Array.isArray(value)) clean[key] = value.filter((item) => typeof item === "string").slice(0, 60).map((item) => item.slice(0, /^data:image\//i.test(item) ? 2_000_000 : 2000));
  });
  return clean;
}

export function assetURL(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw) && !/["'<>\\]/.test(raw)) return raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("//") && !/["'<>\\\r\n]/.test(raw)) {
    const encoded = encodeURI(raw).replace(/%25([0-9a-f]{2})/gi, "%$1");
    return encoded.startsWith("/") ? `.${encoded}` : encoded;
  }
  return "";
}

/* ---------- Shared frame clock, pointer and scroll ---------- */

const world = {
  pointer: { clientX: -9999, clientY: -9999, down: false, moved: false, inWindow: false },
  scrollY: typeof scrollY === "number" ? scrollY : 0,
  velocity: 0,
  instances: new Set(),
  frame: 0,
  started: false,
  last: 0,
};

function startWorld() {
  if (world.started || typeof window === "undefined") return;
  world.started = true;
  addEventListener("pointermove", (event) => { world.pointer.clientX = event.clientX; world.pointer.clientY = event.clientY; world.pointer.moved = true; world.pointer.inWindow = true; }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { world.pointer.inWindow = false; });
  addEventListener("pointerdown", (event) => { world.pointer.down = true; world.pointer.clientX = event.clientX; world.pointer.clientY = event.clientY; }, { passive: true });
  addEventListener("pointerup", () => { world.pointer.down = false; }, { passive: true });
  addEventListener("pointercancel", () => { world.pointer.down = false; }, { passive: true });
  document.addEventListener("visibilitychange", wake);
}

function tick(now) {
  world.frame = 0;
  const delta = Math.min(0.1, world.last ? (now - world.last) / 1000 : 1 / 60);
  world.last = now;
  const nextScroll = scrollY;
  world.velocity += ((nextScroll - world.scrollY) - world.velocity) * 0.25;
  world.scrollY = nextScroll;
  let active = false;
  world.instances.forEach((instance) => {
    if (!instance.loops.size) return;
    if (!instance.shouldRun()) return;
    active = true;
    instance.loops.forEach((loop) => {
      try { loop(now / 1000, delta); }
      catch (error) { instance.fail(error); }
    });
  });
  if (active) world.frame = requestAnimationFrame(tick);
  else world.last = 0;
}

function wake() {
  if (!world.frame && typeof requestAnimationFrame === "function") world.frame = requestAnimationFrame(tick);
}

/* ---------- Component instances ---------- */

function createInstance(element, { editing, isPaused, reducedMotion, getLayout }) {
  const id = element.dataset.component;
  let rawProps = {};
  try { rawProps = JSON.parse(element.dataset.componentProps || "{}"); } catch (error) { rawProps = {}; }
  const instance = {
    id,
    element,
    loops: new Set(),
    resizeHandlers: new Set(),
    destroyHandlers: new Set(),
    visible: editing,
    mounted: false,
    destroyed: false,
    meta: null,
    api: null,
    canvases: [],
    shouldRun() {
      if (this.destroyed || !this.mounted || isPaused()) return false;
      if (!this.visible && !this.meta?.runsOffscreen) return false;
      if (document.hidden) return false;
      return !reducedMotion || this.meta?.runsWhenReduced;
    },
    fail(error) {
      console.warn(`Component "${id}" failed.`, error);
      element.dataset.componentError = error?.message || String(error);
      if (editing) element.insertAdjacentHTML("beforeend", `<div class="canvas-component__error">${String(error?.message || error).replace(/[<>&]/g, "")}</div>`);
      this.loops.clear();
    },
  };

  const ctx = {
    element,
    editing,
    reducedMotion,
    get layout() { return getLayout(); },
    get isTouch() { return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches; },
    get paused() { return isPaused(); },
    get visible() { return instance.visible; },
    size() {
      const rect = element.getBoundingClientRect();
      return { width: element.clientWidth, height: element.clientHeight, screenWidth: rect.width, screenHeight: rect.height, dpr: Math.min(devicePixelRatio || 1, 2) };
    },
    get pointer() {
      const rect = element.getBoundingClientRect();
      const { clientX, clientY } = world.pointer;
      const x = rect.width ? (clientX - rect.left) / rect.width : 0.5;
      const y = rect.height ? (clientY - rect.top) / rect.height : 0.5;
      return { x, y, clientX, clientY, inside: world.pointer.inWindow && x >= 0 && x <= 1 && y >= 0 && y <= 1, inWindow: world.pointer.inWindow, down: world.pointer.down, moved: world.pointer.moved };
    },
    get scroll() {
      const rect = element.getBoundingClientRect();
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      return {
        y: world.scrollY,
        page: Math.min(1, Math.max(0, world.scrollY / max)),
        progress: Math.min(1, Math.max(0, (innerHeight - rect.top) / Math.max(1, innerHeight + rect.height))),
        velocity: world.velocity,
      };
    },
    loop(fn) {
      instance.loops.add(fn);
      if (reducedMotion && !instance.meta?.runsWhenReduced) requestAnimationFrame(() => { try { fn(performance.now() / 1000, 0); } catch (error) { instance.fail(error); } });
      wake();
      return () => instance.loops.delete(fn);
    },
    onResize(fn) { instance.resizeHandlers.add(fn); return () => instance.resizeHandlers.delete(fn); },
    onDestroy(fn) { instance.destroyHandlers.add(fn); },
    lib: loadLibrary,
    asset: assetURL,
    createCanvas(type = "2d", options = {}) {
      const canvas = document.createElement("canvas");
      canvas.className = "canvas-component__surface";
      element.append(canvas);
      const context = type === "2d" ? canvas.getContext("2d", options) : canvas.getContext(type, { antialias: true, alpha: true, premultipliedAlpha: true, ...options });
      const surface = { canvas, context, width: 1, height: 1, pixelWidth: 1, pixelHeight: 1, dpr: 1 };
      const fit = () => {
        const { screenWidth, screenHeight, dpr } = ctx.size();
        surface.dpr = dpr;
        surface.width = Math.max(1, screenWidth);
        surface.height = Math.max(1, screenHeight);
        surface.pixelWidth = Math.max(1, Math.round(screenWidth * dpr));
        surface.pixelHeight = Math.max(1, Math.round(screenHeight * dpr));
        if (canvas.width !== surface.pixelWidth) canvas.width = surface.pixelWidth;
        if (canvas.height !== surface.pixelHeight) canvas.height = surface.pixelHeight;
        if (type === "2d" && context) context.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      fit();
      instance.resizeHandlers.add(fit);
      instance.canvases.push({ canvas, context, type });
      return surface;
    },
  };

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    if (!instance.mounted || instance.destroyed) return;
    instance.resizeHandlers.forEach((fn) => { try { fn(ctx.size()); } catch (error) { instance.fail(error); } });
    try { instance.api?.resize?.(ctx.size()); } catch (error) { instance.fail(error); }
  }) : null;

  instance.mount = async () => {
    if (instance.mounted || instance.destroyed) return;
    instance.mounted = true;
    try {
      const module = await loadComponent(id);
      if (instance.destroyed) return;
      instance.meta = componentMetas.get(id) || normalizeMeta(id, module.meta);
      const props = resolveProps(instance.meta, rawProps);
      if (typeof module.mount !== "function") throw new Error("Component has no mount(element, props, ctx) export");
      const result = await module.mount(element, props, ctx);
      if (instance.destroyed) { (typeof result === "function" ? result : result?.destroy)?.(); return; }
      instance.api = typeof result === "function" ? { destroy: result } : result || {};
      resizeObserver?.observe(element);
      element.dataset.componentReady = "true";
      wake();
    } catch (error) { instance.fail(error); }
  };

  instance.setPaused = (paused) => {
    try { instance.api?.paused?.(paused); } catch (error) { instance.fail(error); }
    if (!paused) wake();
  };

  instance.setVisible = (visible) => {
    instance.visible = visible;
    try { instance.api?.visibility?.(visible); } catch (error) { instance.fail(error); }
    if (visible) wake();
  };

  instance.destroy = () => {
    if (instance.destroyed) return;
    instance.destroyed = true;
    resizeObserver?.disconnect();
    instance.loops.clear();
    try { instance.api?.destroy?.(); } catch (error) { console.warn(`Component "${id}" could not be destroyed cleanly.`, error); }
    instance.destroyHandlers.forEach((fn) => { try { fn(); } catch (error) { console.warn(error); } });
    instance.canvases.forEach(({ context, type }) => { if (type !== "2d") context?.getExtension?.("WEBGL_lose_context")?.loseContext(); });
    world.instances.delete(instance);
  };

  world.instances.add(instance);
  return instance;
}

export function mountComponents(roots, { editing = false, isPaused = () => false, getLayout = () => "desktop" } = {}) {
  startWorld();
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const elements = roots.filter(Boolean).flatMap((root) => [...root.querySelectorAll("[data-component]")]).filter((element) => !element._archiveComponent);
  const instances = elements.map((element) => {
    const instance = createInstance(element, { editing, isPaused, reducedMotion, getLayout });
    element._archiveComponent = instance;
    return instance;
  });
  let observer = null;
  if (editing || typeof IntersectionObserver !== "function") instances.forEach((instance) => { instance.visible = true; instance.mount(); });
  else {
    observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const instance = entry.target._archiveComponent;
      if (!instance) return;
      if (entry.isIntersecting && !instance.mounted) instance.mount();
      instance.setVisible(entry.isIntersecting);
    }), { rootMargin: "60% 0px" });
    instances.forEach((instance) => observer.observe(instance.element));
    // Page-wide effects (meta.runsOffscreen) start right away, wherever their box sits.
    instances.forEach((instance) => loadComponent(instance.id).then((module) => {
      if (!module.meta?.runsOffscreen || instance.destroyed) return;
      instance.visible = true;
      instance.mount();
    }).catch(() => {}));
  }
  return {
    instances,
    resume: wake,
    setPaused(paused) { instances.forEach((instance) => instance.setPaused(paused)); },
    destroy() {
      observer?.disconnect();
      instances.forEach((instance) => { instance.destroy(); delete instance.element._archiveComponent; });
    },
  };
}

// Editor helper: keep running components whose id + props did not change across a re-render.
export function detachLiveComponents(root) {
  const kept = new Map();
  root?.querySelectorAll("[data-component]").forEach((element) => {
    if (!element._archiveComponent || element._archiveComponent.destroyed) return;
    kept.set(`${element.closest("[data-block-id]")?.dataset.blockId}|${element.dataset.component}|${element.dataset.componentProps}`, element);
  });
  return kept;
}

export function reattachLiveComponents(root, kept) {
  root?.querySelectorAll("[data-component]").forEach((placeholder) => {
    const key = `${placeholder.closest("[data-block-id]")?.dataset.blockId}|${placeholder.dataset.component}|${placeholder.dataset.componentProps}`;
    const live = kept.get(key);
    if (!live) return;
    placeholder.replaceWith(live);
    kept.delete(key);
  });
  kept.forEach((element) => element._archiveComponent?.destroy());
}

/* ---------- Code blocks (sandboxed HTML/CSS/JS) ---------- */

const CODE_BRIDGE = `<script>(function(){var handlers={};var state={scroll:{page:0,progress:0,velocity:0},pointer:{x:.5,y:.5,inside:false},visible:true,paused:false,layout:"desktop"};window.archive={state:state,on:function(type,fn){(handlers[type]=handlers[type]||[]).push(fn);return function(){handlers[type]=(handlers[type]||[]).filter(function(item){return item!==fn})}},get editing(){return document.documentElement.dataset.editing==="true"}};addEventListener("message",function(event){var data=event.data;if(!data||data.__archive!==true)return;if(data.type==="scroll")state.scroll=data.value;if(data.type==="pointer")state.pointer=data.value;if(data.type==="visibility")state.visible=data.value;if(data.type==="paused")state.paused=data.value;if(data.type==="layout")state.layout=data.value;(handlers[data.type]||[]).forEach(function(fn){try{fn(data.value,state)}catch(error){console.error(error)}})});})();<\/script>`;

const scriptSafe = (value) => String(value || "").replace(/<\/script/gi, "<\\/script");

export function codeBlockDocument(code = {}, { editing = false } = {}) {
  return `<!doctype html><html data-editing="${editing}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}*{box-sizing:border-box}${String(code.css || "").replace(/<\/style/gi, "<\\/style")}</style></head><body>${String(code.html || "")}${CODE_BRIDGE}<script>${scriptSafe(code.js)}<\/script></body></html>`;
}

export function bindCodeBlocks(roots, { isPaused = () => false, getLayout = () => "desktop" } = {}) {
  const frames = roots.filter(Boolean).flatMap((root) => [...root.querySelectorAll("iframe[data-code-frame]")]);
  if (!frames.length) return { setPaused() {}, destroy() {} };
  let raf = 0;
  let lastY = scrollY;
  let velocity = 0;
  const visible = new Map(frames.map((frame) => [frame, true]));
  const post = (frame, type, value) => { try { frame.contentWindow?.postMessage({ __archive: true, type, value }, "*"); } catch (error) { /* frame not ready */ } };
  const update = () => {
    raf = 0;
    velocity += ((scrollY - lastY) - velocity) * 0.3;
    lastY = scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    frames.forEach((frame) => {
      if (!visible.get(frame)) return;
      const rect = frame.getBoundingClientRect();
      post(frame, "scroll", { page: Math.min(1, Math.max(0, scrollY / max)), progress: Math.min(1, Math.max(0, (innerHeight - rect.top) / Math.max(1, innerHeight + rect.height))), velocity });
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  const pointer = (event) => frames.forEach((frame) => {
    if (!visible.get(frame)) return;
    const rect = frame.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width);
    const y = (event.clientY - rect.top) / Math.max(1, rect.height);
    post(frame, "pointer", { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1, down: event.buttons > 0 });
  });
  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => entries.forEach((entry) => {
    visible.set(entry.target, entry.isIntersecting);
    post(entry.target, "visibility", entry.isIntersecting);
  }), { rootMargin: "20% 0px" }) : null;
  frames.forEach((frame) => {
    observer?.observe(frame);
    frame.addEventListener("load", () => { post(frame, "layout", getLayout()); post(frame, "paused", isPaused()); schedule(); });
  });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  addEventListener("pointermove", pointer, { passive: true });
  return {
    setPaused(paused) { frames.forEach((frame) => post(frame, "paused", paused)); },
    setLayout(layout) { frames.forEach((frame) => post(frame, "layout", layout)); },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      removeEventListener("pointermove", pointer);
    },
  };
}
