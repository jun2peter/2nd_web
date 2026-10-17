// Page-level effects for the public Archive site: smooth scroll, custom cursors,
// split-text reveals, magnetic hover and scroll pinning. Each binder returns a cleanup function.

import { loadLibrary } from "./components-host.js?v=studio7";

const noop = () => {};
const coarsePointer = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function bindSmoothScroll(settings, { reduced = false } = {}) {
  if (!settings?.smoothScroll?.enabled || reduced || coarsePointer()) return noop;
  let lenis = null;
  let frame = 0;
  let disposed = false;
  loadLibrary("lenis").then((module) => {
    if (disposed) return;
    const Lenis = module.default || module.Lenis;
    lenis = new Lenis({ lerp: settings.smoothScroll.intensity, smoothWheel: true });
    document.documentElement.classList.add("has-smooth-scroll");
    const loop = (time) => { lenis.raf(time); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
  }).catch((error) => console.warn("Smooth scroll could not load.", error));
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    lenis?.destroy();
    document.documentElement.classList.remove("has-smooth-scroll");
  };
}

export function bindCustomCursor(settings) {
  if (!settings || settings.cursor === "default" || coarsePointer()) return noop;
  const cursor = document.createElement("div");
  cursor.className = `archive-custom-cursor archive-custom-cursor--${settings.cursor}`;
  cursor.style.setProperty("--cursor-color", settings.cursorColor);
  cursor.setAttribute("aria-hidden", "true");
  document.body.append(cursor);
  document.documentElement.classList.add("has-archive-cursor");
  const smooth = ["ring", "blend"].includes(settings.cursor);
  const state = { x: -200, y: -200, tx: -200, ty: -200, scale: 1, targetScale: 1, shown: false };
  let frame = 0;
  const render = () => {
    frame = 0;
    const ease = smooth ? 0.2 : 1;
    state.x += (state.tx - state.x) * ease;
    state.y += (state.ty - state.y) * ease;
    state.scale += (state.targetScale - state.scale) * 0.18;
    cursor.style.transform = `translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    if (Math.abs(state.tx - state.x) > 0.1 || Math.abs(state.ty - state.y) > 0.1 || Math.abs(state.targetScale - state.scale) > 0.005) frame = requestAnimationFrame(render);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  const move = (event) => {
    state.tx = event.clientX;
    state.ty = event.clientY;
    if (!state.shown) { state.x = state.tx; state.y = state.ty; state.shown = true; cursor.classList.add("is-visible"); }
    const interactive = event.target?.closest?.("a,button,[role='button'],[data-lightbox],[data-public-draggable],label,select,input,textarea,iframe,[data-motion-source]");
    state.targetScale = interactive ? (settings.cursor === "blend" ? 2.8 : settings.cursor === "ring" ? 1.7 : 1.4) : 1;
    cursor.classList.toggle("is-hovering", Boolean(interactive));
    schedule();
  };
  const down = () => { state.targetScale *= 0.75; schedule(); };
  const up = () => { state.targetScale /= 0.75; schedule(); };
  const hide = () => { cursor.classList.remove("is-visible"); state.shown = false; };
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerdown", down, { passive: true });
  addEventListener("pointerup", up, { passive: true });
  document.documentElement.addEventListener("mouseleave", hide);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("pointermove", move);
    removeEventListener("pointerdown", down);
    removeEventListener("pointerup", up);
    document.documentElement.removeEventListener("mouseleave", hide);
    cursor.remove();
    document.documentElement.classList.remove("has-archive-cursor");
  };
}

// Wraps each word or letter in a span and reveals them in sequence when the block scrolls into view.
export function bindSplitText(nodes, { reduced = false } = {}) {
  if (reduced || !nodes.length) return noop;
  const make = (className, text, index) => {
    const span = document.createElement("span");
    span.className = className;
    if (text != null) span.textContent = text;
    if (index != null) span.style.setProperty("--split-index", index);
    return span;
  };
  nodes.forEach((node) => {
    const mode = node.dataset.textEffect;
    let index = 0;
    const wrap = (text) => {
      const fragment = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { fragment.append(document.createTextNode(part)); return; }
        if (mode === "words") { fragment.append(make("split-unit", part, index++)); return; }
        const word = make("split-word");
        [...part].forEach((char) => word.append(make("split-unit", char, index++)));
        fragment.append(word);
      });
      return fragment;
    };
    [...node.childNodes].forEach((child) => { if (child.nodeType === 3) child.replaceWith(wrap(child.textContent)); });
    node.style.setProperty("--split-step", `${Math.round(Math.max(6, Math.min(mode === "words" ? 90 : 32, 1600 / Math.max(1, index))))}ms`);
    node.classList.add("is-split");
  });
  if (typeof IntersectionObserver !== "function") { nodes.forEach((node) => node.classList.add("is-split-visible")); return noop; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-split-visible");
    observer.unobserve(entry.target);
  }), { threshold: 0.15, rootMargin: "0px 0px -6%" });
  nodes.forEach((node) => observer.observe(node));
  return () => observer.disconnect();
}

// Hover preset "magnetic": the block leans toward the pointer and springs back.
export function bindMagnetic(nodes, { reduced = false, isPaused = () => false } = {}) {
  if (reduced || coarsePointer() || !nodes.length) return noop;
  const cleanups = nodes.map((node) => {
    const target = node.querySelector(".canvas-block__hover");
    if (!target) return noop;
    const move = (event) => {
      if (isPaused()) return;
      const rect = node.getBoundingClientRect();
      const scale = rect.width / Math.max(1, node.offsetWidth);
      const dx = (event.clientX - (rect.left + rect.width / 2)) / scale;
      const dy = (event.clientY - (rect.top + rect.height / 2)) / scale;
      target.style.transform = `translate3d(${dx * 0.32}px,${dy * 0.32}px,0)`;
    };
    const leave = () => { target.style.transform = ""; };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    return () => { node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", leave); target.style.transform = ""; };
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}

// 스크롤 고정: the block stays on screen for `--pin-distance` px of scrolling, starting when its top
// reaches `--pin-top` px below the top of the screen. Values are in artboard px, so they follow the layout.
export function bindPins(nodes, { canvas, getScale, isPaused = () => false } = {}) {
  if (!nodes.length || !canvas) return noop;
  let frame = 0;
  let metrics = [];
  const measure = () => {
    metrics = nodes.map((node) => {
      const style = getComputedStyle(node);
      return { node, top: parseFloat(style.getPropertyValue("--pin-top")) || 0, distance: parseFloat(style.getPropertyValue("--pin-distance")) || 0, start: node.offsetTop, active: Boolean(node.offsetParent) };
    });
  };
  const update = () => {
    frame = 0;
    if (isPaused()) return;
    const scale = Math.max(0.01, getScale());
    const scrolled = -canvas.getBoundingClientRect().top / scale;
    metrics.forEach(({ node, top, distance, start, active }) => {
      if (!active) return;
      const offset = Math.min(distance, Math.max(0, scrolled - (start - top)));
      node.style.setProperty("--pin-y", `${offset}px`);
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const resize = () => { nodes.forEach((node) => node.style.setProperty("--pin-y", "0px")); measure(); schedule(); };
  measure();
  update();
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", resize, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("scroll", schedule);
    removeEventListener("resize", resize);
  };
}
