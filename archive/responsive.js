// Responsive layouts for Archive Studio.
// A page is designed on the desktop artboard. Tablet and mobile are optional extra artboards:
// each block keeps its desktop values and stores only the values that differ in
// block.responsive.tablet / block.responsive.mobile. The public site turns those overrides into
// media-query CSS, so one DOM serves every screen size without re-rendering.

export const LAYOUTS = ["desktop", "tablet", "mobile"];
export const LAYOUT_LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
export const LAYOUT_DEFAULTS = {
  desktop: { width: 1440, viewport: 900 },
  tablet: { width: 834, viewport: 1112 },
  mobile: { width: 390, viewport: 844 },
};
export const RESPONSIVE_DEFAULTS = { tabletMax: 1199, mobileMax: 767 };

const num = (value, fallback, min = -100000, max = 100000) => {
  if (value == null || (typeof value === "string" && !value.trim())) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const range = (min, max) => (value) => {
  const parsed = num(value, undefined, min, max);
  return parsed === undefined ? undefined : parsed;
};
const oneOf = (values) => (value) => (values.includes(value) ? value : undefined);

// Values a tablet/mobile layout may change. Everything else (content, colours, motion) is shared.
const OVERRIDE_RULES = {
  x: range(-100000, 100000),
  y: range(-100000, 100000),
  width: range(2, 100000),
  height: range(2, 100000),
  rotation: range(-360, 360),
  opacity: range(0, 1),
  fontSize: range(6, 400),
  lineHeight: range(0.5, 4),
  letterSpacing: range(-20, 100),
  textAlign: oneOf(["left", "center", "right"]),
  padding: range(0, 200),
  borderRadius: range(0, 1000),
  galleryColumns: range(1, 8),
  galleryGap: range(0, 100),
  navOrientation: oneOf(["horizontal", "vertical"]),
  navGap: range(0, 200),
  pinTop: range(-5000, 5000),
  pinDistance: range(0, 30000),
  hidden: (value) => (value === true || value === "true" ? true : undefined),
};
export const OVERRIDE_KEYS = Object.keys(OVERRIDE_RULES);

export function normalizeResponsiveSettings(raw = {}) {
  raw = raw || {};
  const mobileMax = num(raw.mobileMax, RESPONSIVE_DEFAULTS.mobileMax, 320, 1400);
  return {
    mobileMax,
    tabletMax: num(raw.tabletMax, RESPONSIVE_DEFAULTS.tabletMax, mobileMax + 1, 2400),
  };
}

export function normalizeLayouts(raw = {}, canvas = {}) {
  raw = raw || {};
  const out = {};
  for (const key of ["tablet", "mobile"]) {
    const source = raw[key] || {};
    const width = num(source.width, LAYOUT_DEFAULTS[key].width, 280, 2400);
    out[key] = {
      enabled: Boolean(source.enabled),
      width,
      height: num(source.height, Math.round((canvas.height || 1800) * Math.max(1, (canvas.width || 1440) / width) * 0.5), 400, 80000),
      viewport: num(source.viewport, LAYOUT_DEFAULTS[key].viewport, 300, 4000),
    };
  }
  return out;
}

export function normalizeResponsive(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const layout of LAYOUTS) {
    const source = raw[layout];
    if (!source || typeof source !== "object") continue;
    const keys = layout === "desktop" ? ["hidden"] : OVERRIDE_KEYS;
    const clean = {};
    for (const key of keys) {
      if (source[key] == null || source[key] === "") continue;
      const value = OVERRIDE_RULES[key](source[key]);
      if (value !== undefined) clean[key] = value;
    }
    if (Object.keys(clean).length) out[layout] = clean;
  }
  return out;
}

export function layoutBox(page, layout = "desktop") {
  if (layout === "desktop" || !page.layouts?.[layout]) {
    return { layout: "desktop", enabled: true, width: page.canvas.width, height: page.canvas.height, viewport: page.canvas.viewport || LAYOUT_DEFAULTS.desktop.viewport };
  }
  return { layout, ...page.layouts[layout] };
}

export function isLayoutEnabled(page, layout) {
  return layout === "desktop" || Boolean(page.layouts?.[layout]?.enabled);
}

// Block values as seen on one layout. `hidden` never inherits: each layout decides on its own.
export function resolveBlock(block, layout = "desktop") {
  const overrides = block.responsive?.[layout] || {};
  if (layout === "desktop") return { ...block, hidden: Boolean(overrides.hidden) };
  return { ...block, ...overrides, hidden: Boolean(overrides.hidden) };
}

export function hasOverride(block, layout, key) {
  return layout !== "desktop" && block.responsive?.[layout]?.[key] !== undefined;
}

export function setOverride(block, layout, key, value) {
  if (layout === "desktop" && key !== "hidden") {
    block[key] = value;
    return;
  }
  block.responsive ||= {};
  block.responsive[layout] ||= {};
  if (value === undefined || (key === "hidden" && !value)) delete block.responsive[layout][key];
  else block.responsive[layout][key] = value;
  if (!Object.keys(block.responsive[layout]).length) delete block.responsive[layout];
}

export function clearOverrides(block, layout) {
  if (!block.responsive?.[layout]) return;
  const hidden = block.responsive[layout].hidden;
  delete block.responsive[layout];
  if (hidden) block.responsive[layout] = { hidden };
}

// Which artboard serves which viewport width. Missing artboards fall back to the next larger one.
export function layoutRanges(page, settings) {
  const responsive = normalizeResponsiveSettings(settings?.responsive);
  const tablet = isLayoutEnabled(page, "tablet");
  const mobile = isLayoutEnabled(page, "mobile");
  const ranges = [{
    layout: "desktop",
    query: tablet ? `(min-width: ${responsive.tabletMax + 1}px)` : mobile ? `(min-width: ${responsive.mobileMax + 1}px)` : "",
  }];
  if (tablet) ranges.push({ layout: "tablet", query: mobile ? `(min-width: ${responsive.mobileMax + 1}px) and (max-width: ${responsive.tabletMax}px)` : `(max-width: ${responsive.tabletMax}px)` });
  if (mobile) ranges.push({ layout: "mobile", query: `(max-width: ${responsive.mobileMax}px)` });
  return ranges;
}

export function currentLayout(page, settings) {
  if (typeof matchMedia !== "function") return "desktop";
  const match = layoutRanges(page, settings).find((item) => !item.query || matchMedia(item.query).matches);
  return match?.layout || "desktop";
}

// A fixed block that covers the whole first screen follows the real screen height instead.
const coversScreen = (view, box) => view.y <= 4 && view.height >= box.viewport * 0.95;

function fixedPosition(view, box) {
  if (coversScreen(view, box)) return "top:0!important;bottom:auto!important";
  if (view.fixedAnchor === "bottom") return `top:auto!important;bottom:${Math.round(box.viewport - view.y - view.height)}px!important`;
  return `top:${view.y}px!important;bottom:auto!important`;
}

export function blockPositionStyle(view, box) {
  if (view.fixed && box.fixedLayer && coversScreen(view, box)) return `left:${view.x}px;top:0;width:${view.width}px;height:100%`;
  const vertical = view.fixed && view.fixedAnchor === "bottom"
    ? `top:auto;bottom:${Math.round(box.viewport - view.y - view.height)}px`
    : `top:${view.y}px`;
  return `left:${view.x}px;${vertical};width:${view.width}px;height:${view.height}px`;
}

// Media-query CSS for every non-desktop artboard, scoped to one page.
export function responsiveCSS({ page, blocks, settings }) {
  const scope = `[data-archive-scope="${page.id}"]`;
  let css = "";
  for (const item of layoutRanges(page, settings)) {
    const box = layoutBox(page, item.layout);
    let rules = "";
    if (item.layout !== "desktop") {
      rules += `.archive-canvas${scope}{width:${box.width}px!important;height:${box.height}px!important}`;
      rules += `.archive-fixed-layer__inner${scope}{width:${box.width}px!important}`;
    }
    for (const block of blocks) {
      const view = resolveBlock(block, item.layout);
      const selector = `${scope} [data-block-id="${block.id}"]`;
      if (view.hidden) {
        rules += `${selector}{display:none!important}`;
        continue;
      }
      const overrides = item.layout === "desktop" ? null : block.responsive?.[item.layout];
      if (!overrides) continue;
      const position = view.fixed ? `left:${view.x}px!important;${fixedPosition(view, box)}` : `left:${view.x}px!important;top:${view.y}px!important`;
      const height = view.fixed && coversScreen(view, box) ? "100%" : `${view.height}px`;
      rules += `${selector}{${position};width:${view.width}px!important;height:${height}!important;opacity:${view.opacity}!important;--block-rotation:${view.rotation}deg!important;--pin-top:${view.pinTop ?? 0}px!important;--pin-distance:${view.pinDistance ?? 0}px!important}`;
      const typo = ["fontSize", "lineHeight", "letterSpacing", "textAlign"].some((key) => overrides[key] !== undefined);
      if (typo) rules += `${selector} [data-typo]{font-size:${view.fontSize}px!important;line-height:${view.lineHeight}!important;letter-spacing:${view.letterSpacing}px!important;text-align:${view.textAlign}!important}`;
      if (overrides.padding !== undefined || overrides.borderRadius !== undefined) rules += `${selector} [data-surface]{padding:${view.padding}px!important;border-radius:${view.borderRadius}px!important}${selector} img{border-radius:${view.borderRadius}px!important}`;
      if (overrides.galleryColumns !== undefined || overrides.galleryGap !== undefined) rules += `${selector} .canvas-gallery{--gallery-columns:${view.galleryColumns}!important;--gallery-gap:${view.galleryGap}px!important}`;
      if (overrides.navOrientation !== undefined || overrides.navGap !== undefined) {
        const vertical = view.navOrientation === "vertical";
        rules += `${selector} .canvas-auto-nav{--nav-gap:${view.navGap}px!important;flex-direction:${vertical ? "column" : "row"}!important;align-items:${vertical ? "flex-start" : "center"}!important;justify-content:${vertical ? "center" : "flex-start"}!important}`;
      }
    }
    if (!rules) continue;
    css += item.query ? `@media ${item.query}{${rules}}` : rules;
  }
  return css;
}

/* ---------- Auto layout ---------- */

const CONTAINER_TYPES = ["shape", "image", "video", "embed", "component", "code"];
const BLEED_TYPES = ["shape", "image", "video", "embed", "component", "code", "gallery", "marquee", "line"];
const TEXT_TYPES = ["text", "button", "marquee", "nav"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const area = (rect) => Math.max(1, rect.w * rect.h);
function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function estimateTextHeight(block, width, fontSize, lineHeight, padding) {
  const usable = Math.max(20, width - padding * 2);
  const charsPerLine = Math.max(1, Math.floor(usable / (fontSize * 0.62)));
  const lines = String(block.content || "").split("\n").reduce((total, line) => total + Math.max(1, Math.ceil([...line].length / charsPerLine)), 0);
  return Math.ceil(lines * fontSize * lineHeight + padding * 2 + fontSize * 0.2);
}

// Builds a first tablet/mobile arrangement from the desktop one.
// mode "stack": one readable column that keeps the desktop reading order, layered groups and rows.
// mode "scale": the desktop composition shrunk proportionally, for hand-tuning.
export function autoLayout({ page, globals = [], layout, mode = "stack", measureText }) {
  if (layout === "desktop") return;
  const target = page.layouts[layout];
  const W = target.width;
  const D = page.canvas.width;
  const ratio = W / D;
  const margin = layout === "mobile" ? 20 : 40;
  const inner = W - margin * 2;
  const minFont = layout === "mobile" ? 15 : 16;
  const fontScale = Math.sqrt(ratio);
  const scaleFont = (size) => Math.round(size <= minFont ? size : Math.max(minFont, size * fontScale));
  const measure = (block, width, fontSize, lineHeight, padding, letterSpacing) => {
    const measured = measureText?.({ ...block, fontSize, lineHeight, padding, letterSpacing }, width);
    return Math.ceil(Number.isFinite(measured) && measured > 0 ? measured + 2 : estimateTextHeight(block, width, fontSize, lineHeight, padding));
  };
  const store = (block, values) => {
    const hidden = block.responsive?.[layout]?.hidden;
    block.responsive ||= {};
    block.responsive[layout] = Object.fromEntries(Object.entries({ ...values, ...(hidden ? { hidden } : {}) }).filter(([, value]) => value !== undefined));
  };
  const typeValues = (block, fontSize, width) => {
    if (!TEXT_TYPES.includes(block.type)) return {};
    const factor = fontSize / Math.max(1, block.fontSize);
    return {
      fontSize,
      letterSpacing: Math.round(block.letterSpacing * factor * 10) / 10,
      padding: Math.round(block.padding * Math.min(1, factor * 1.15)),
      navOrientation: block.type === "nav" && width < 260 ? "vertical" : undefined,
      navGap: block.type === "nav" ? Math.round(clamp(block.navGap * factor, 8, block.navGap)) : undefined,
    };
  };
  const all = [...page.blocks, ...globals].filter((block) => block.visible);
  const desktopViewport = page.canvas.viewport || LAYOUT_DEFAULTS.desktop.viewport;

  if (mode === "scale") {
    all.forEach((block) => {
      const width = Math.max(2, Math.round(block.width * ratio));
      const fontSize = scaleFont(block.fontSize);
      const values = { x: Math.round(block.x * ratio), y: Math.round(block.y * (block.fixed ? 1 : ratio)), width, height: Math.max(2, Math.round(block.height * ratio)), ...typeValues(block, fontSize, width) };
      if (block.type === "text") values.height = Math.max(values.height, measure(block, width, fontSize, block.lineHeight, values.padding, values.letterSpacing));
      if (block.galleryColumns > 2) values.galleryColumns = 2;
      store(block, values);
    });
    target.height = Math.max(400, Math.round(page.canvas.height * ratio));
    target.enabled = true;
    return;
  }

  // Fixed (viewport-pinned) blocks keep their anchor and side.
  all.filter((block) => block.fixed).forEach((block) => {
    if (block.width >= D * 0.9) {
      // Full-screen overlays (menu panels, veils) stay full screen.
      const fullHeight = block.height >= desktopViewport * 0.9;
      store(block, { x: 0, y: fullHeight ? 0 : block.y, width: W, height: fullHeight ? target.viewport : block.height });
      return;
    }
    const width = Math.min(block.width, inner);
    const fontSize = scaleFont(block.fontSize);
    const side = (block.x + block.width / 2) / D;
    const x = Math.round(side < 0.34 ? margin : side > 0.66 ? W - margin - width : (W - width) / 2);
    const typo = typeValues(block, fontSize, width);
    let height = block.type === "text" ? measure(block, width, fontSize, block.lineHeight, typo.padding, typo.letterSpacing) : Math.round(block.height * (TEXT_TYPES.includes(block.type) ? fontSize / Math.max(1, block.fontSize) : width / block.width));
    height = Math.max(block.type === "button" ? 44 : 2, height);
    const y = block.fixedAnchor === "bottom" ? Math.round(target.viewport - (desktopViewport - block.y - block.height) - height) : Math.min(block.y, target.viewport - height - margin);
    store(block, { x, y, width, height, ...typo });
  });

  const items = all.filter((block) => !block.fixed).map((block) => ({ block, rect: { x: block.x, y: block.y, w: block.width, h: block.height }, children: [], parent: null }));
  items.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || a.block.z - b.block.z);
  items.forEach((item) => {
    let best = null;
    items.forEach((other) => {
      if (other === item || !CONTAINER_TYPES.includes(other.block.type) || area(other.rect) <= area(item.rect) * 1.15) return;
      if (overlapArea(item.rect, other.rect) / area(item.rect) < 0.85) return;
      if (other.block.z > item.block.z) return;
      if (!best || area(other.rect) < area(best.rect)) best = other;
    });
    item.parent = best;
  });
  items.forEach((item) => item.parent?.children.push(item));

  const groupRows = (list) => {
    const rows = [];
    list.forEach((item) => {
      const row = rows.at(-1);
      if (row) {
        const top = Math.min(...row.map((entry) => entry.rect.y));
        const bottom = Math.max(...row.map((entry) => entry.rect.y + entry.rect.h));
        const overlap = Math.min(bottom, item.rect.y + item.rect.h) - Math.max(top, item.rect.y);
        if (overlap > Math.min(bottom - top, item.rect.h) * 0.5) { row.push(item); return; }
      }
      rows.push([item]);
    });
    return rows.map((row) => row.sort((a, b) => a.rect.x - b.rect.x));
  };

  const naturalSize = (item, region, { stacked = false } = {}) => {
    const { block, rect } = item;
    const avail = region.width;
    const bleed = !item.parent && rect.w >= D * 0.9 && BLEED_TYPES.includes(block.type);
    const fontSize = scaleFont(block.fontSize);
    if (bleed) {
      const w = W;
      let h = block.type === "marquee" ? Math.round(rect.h * fontSize / Math.max(1, block.fontSize)) : block.type === "line" ? rect.h : Math.round(rect.h * w / rect.w);
      // Screen-sized sections (heroes, full-bleed media) keep the share of the screen they had on desktop.
      if (!["marquee", "line"].includes(block.type) && rect.h >= desktopViewport * 0.5) h = Math.max(h, Math.round(Math.min(rect.h, desktopViewport) / desktopViewport * target.viewport));
      return { w, h, bleed: true, fontSize };
    }
    if (block.type === "text") {
      const w = Math.round(Math.min(avail, rect.w));
      const typo = typeValues(block, fontSize, w);
      return { w, h: measure(block, w, fontSize, block.lineHeight, typo.padding, typo.letterSpacing), fontSize };
    }
    if (block.type === "button") return { w: Math.round(Math.min(avail, rect.w)), h: Math.max(44, Math.round(rect.h * Math.min(1, fontSize / Math.max(1, block.fontSize) * 1.2))), fontSize };
    if (block.type === "nav") return { w: Math.round(avail), h: Math.max(44, Math.round(rect.h * fontSize / Math.max(1, block.fontSize))), fontSize };
    if (block.type === "marquee") return { w: Math.round(avail), h: Math.round(rect.h * fontSize / Math.max(1, block.fontSize)), fontSize };
    if (block.type === "audio") return { w: Math.round(avail), h: rect.h, fontSize };
    if (block.type === "line") return { w: Math.round(Math.min(avail, rect.w)), h: rect.h, fontSize };
    // Media that sat side by side on desktop becomes full width once it has to stack.
    const wide = stacked || rect.w >= region.desktopWidth * 0.45;
    const w = Math.round(wide ? avail : Math.min(avail, Math.max(rect.w * 0.6, avail * 0.5)));
    let h = Math.round(rect.h * w / Math.max(1, rect.w));
    if (block.type === "gallery" && block.galleryColumns > 2) h = Math.round(h * block.galleryColumns / 2);
    return { w, h, fontSize };
  };

  const alignX = (item, region, size) => {
    if (size.bleed) return 0;
    const { rect } = item;
    const centerOffset = Math.abs(rect.x + rect.w / 2 - (region.desktopX + region.desktopWidth / 2));
    const t = centerOffset < region.desktopWidth * 0.08 ? 0.5 : clamp((rect.x - region.desktopX) / Math.max(1, region.desktopWidth - rect.w), 0, 1);
    return Math.round(region.x + (region.width - size.w) * t);
  };

  const place = (item, region, y, size = naturalSize(item, region), x = alignX(item, region, size)) => {
    const { block } = item;
    const typo = typeValues(block, size.fontSize, size.w);
    let height = size.h;
    if (item.children.length) {
      const pad = Math.round(clamp(size.w * 0.07, 16, 48));
      const region = { x: x + pad, width: size.w - pad * 2, desktopX: item.rect.x, desktopWidth: item.rect.w };
      const contentHeight = placeGroup(item.children, region, y + pad) - (y + pad);
      height = Math.max(height, contentHeight + pad * 2);
      // Keep the children's vertical position inside the container (e.g. a title near the bottom of a hero).
      const firstTop = Math.min(...item.children.map((child) => child.rect.y));
      const relative = clamp((firstTop - item.rect.y) / Math.max(1, item.rect.h), 0, 1);
      const start = Math.round(clamp(y + relative * height, y + pad, y + height - pad - contentHeight));
      if (start !== y + pad) placeGroup(item.children, region, start);
    }
    store(block, { x, y, width: size.w, height, ...typo, galleryColumns: block.type === "gallery" && block.galleryColumns > 2 ? 2 : undefined });
    return y + height;
  };

  const placeGroup = (list, region, startY) => {
    let cursor = startY;
    let previousBottom = null;
    groupRows(list).forEach((row) => {
      const top = Math.min(...row.map((item) => item.rect.y));
      if (previousBottom != null) cursor += Math.round(clamp((top - previousBottom) * 0.45, 16, layout === "mobile" ? 96 : 140));
      let sizes = row.map((item) => naturalSize(item, region));
      const total = sizes.reduce((sum, size) => sum + size.w, 0) + (row.length - 1) * 12;
      const fitsInRow = row.length > 1 && total <= region.width && !sizes.some((size) => size.bleed);
      // A row of images/cards that no longer fits becomes a smaller grid when there is room (tablet), else a column.
      const gridGap = layout === "mobile" ? 12 : 20;
      let perRow = 1;
      if (row.length > 2 && !fitsInRow && row.every((item) => !TEXT_TYPES.includes(item.block.type) && !item.children.length)) {
        for (let count = row.length - 1; count >= 2; count -= 1) {
          if ((region.width - (count - 1) * gridGap) / count >= Math.max(240, region.width * 0.4)) { perRow = count; break; }
        }
      }
      if (perRow > 1) {
        const width = Math.floor((region.width - (perRow - 1) * gridGap) / perRow);
        for (let start = 0; start < row.length; start += perRow) {
          if (start) cursor += gridGap;
          const chunk = row.slice(start, start + perRow);
          const bottoms = chunk.map((item, index) => {
            const size = { w: width, h: Math.round(item.rect.h * width / Math.max(1, item.rect.w)), fontSize: scaleFont(item.block.fontSize) };
            return place(item, region, cursor, size, region.x + index * (width + gridGap));
          });
          cursor = Math.max(...bottoms);
        }
        previousBottom = Math.max(...row.map((item) => item.rect.y + item.rect.h));
        return;
      }
      if (row.length > 1 && !fitsInRow) sizes = row.map((item) => naturalSize(item, region, { stacked: true }));
      if (fitsInRow) {
        const spread = (row.at(-1).rect.x + row.at(-1).rect.w - row[0].rect.x) > region.desktopWidth * 0.7;
        const gap = spread && row.length > 1 ? (region.width - total + (row.length - 1) * 12) / (row.length - 1) : 12;
        let x = spread ? region.x : Math.round(region.x + (region.width - total) / 2);
        const bottoms = row.map((item, index) => {
          const end = place(item, region, cursor, sizes[index], Math.round(x));
          x += sizes[index].w + gap;
          return end;
        });
        cursor = Math.max(...bottoms);
      } else {
        row.forEach((item, index) => {
          if (index) cursor += 16;
          cursor = place(item, region, cursor, sizes[index]);
        });
      }
      previousBottom = Math.max(...row.map((item) => item.rect.y + item.rect.h));
    });
    return cursor;
  };

  const roots = items.filter((item) => !item.parent);
  const firstTop = roots.length ? roots[0].rect.y : 0;
  const end = placeGroup(roots, { x: margin, width: inner, desktopX: 0, desktopWidth: D }, firstTop <= 0 ? 0 : Math.round(clamp(firstTop * 0.45, margin, 160)));
  target.height = Math.max(400, Math.round(end + margin * 3));
  target.enabled = true;
}

// A sensible spot for a block created while other artboards exist.
export function placeNewBlockOnLayouts(block, page) {
  for (const layout of ["tablet", "mobile"]) {
    if (!isLayoutEnabled(page, layout)) continue;
    const box = layoutBox(page, layout);
    const margin = layout === "mobile" ? 20 : 40;
    const width = Math.min(block.width, box.width - margin * 2);
    const factor = width / Math.max(1, block.width);
    const fontSize = TEXT_TYPES.includes(block.type) ? Math.max(layout === "mobile" ? 15 : 16, Math.round(block.fontSize * Math.sqrt(box.width / page.canvas.width))) : undefined;
    const height = TEXT_TYPES.includes(block.type) ? Math.round(block.height * (fontSize || block.fontSize) / Math.max(1, block.fontSize)) : Math.max(2, Math.round(block.height * factor));
    setOverride(block, layout, "x", Math.round((box.width - width) / 2));
    setOverride(block, layout, "y", Math.min(block.y, Math.max(0, box.height - height - margin)));
    setOverride(block, layout, "width", width);
    setOverride(block, layout, "height", height);
    if (fontSize) setOverride(block, layout, "fontSize", fontSize);
  }
}

export function blocksOutsideLayout(page, blocks, layout) {
  if (!isLayoutEnabled(page, layout)) return [];
  const box = layoutBox(page, layout);
  return blocks.filter((block) => {
    const view = resolveBlock(block, layout);
    if (view.hidden || !block.visible) return false;
    return view.x + view.width <= 0 || view.x >= box.width || (!view.fixed && (view.y >= box.height || view.y + view.height <= 0)) || view.x < -view.width * 0.5 || view.x + view.width > box.width + view.width * 0.5;
  });
}
