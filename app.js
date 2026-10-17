import {
  archiveCanvasMarkup,
  archiveFixedLayerMarkup,
  archiveSiteChromeMarkup,
  archiveStudioTemplate,
  bindArchiveStudio,
  bindArchiveViewer,
  getArchiveDraft,
  hasArchiveDraft,
  normalizeArchiveData,
  resolveArchivePage,
  syncArchiveCustomHead,
  syncArchiveFontStylesheet,
} from "./archive-editor.js?v=studio8";

const app = document.querySelector("#app");

const state = {
  site: null,
  projects: [],
  notes: [],
  archiveCanvas: null,
  activeArchiveCanvas: null,
  activeArchivePage: null,
  cleanups: [],
};

const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function safeURL(value = "") {
  const url = String(value).trim();
  if (!url) return "";
  if (/^(https?:|mailto:)/i.test(url)) return escapeHTML(url);
  if (url.startsWith("/")) return `.${escapeHTML(url)}`;
  return escapeHTML(url);
}

const archiveIsHome = () => Boolean(state.archiveCanvas) && normalizeArchiveData(state.archiveCanvas).settings.homeView === "archive";

function routeURL({ view, work, page } = {}) {
  const params = new URLSearchParams();
  if (view === "archive") params.set("view", "archive");
  if (view === "experience" && archiveIsHome()) params.set("view", "experience");
  if (work) params.set("work", work);
  if (page) params.set("page", page);
  const query = params.toString();
  return query ? `?${query}` : "./";
}

function viewSwitch(active = "experience", tone = "dark") {
  return `
    <nav class="view-switch view-switch--${tone}" aria-label="Choose portfolio view">
      <a data-route href="${routeURL({ view: "experience" })}" class="${active === "experience" ? "is-active" : ""}" ${active === "experience" ? 'aria-current="page"' : ""}>Experience</a>
      <span aria-hidden="true">/</span>
      <a data-route href="${routeURL({ view: "archive" })}" class="${active === "archive" ? "is-active" : ""}" ${active === "archive" ? 'aria-current="page"' : ""}>Archive</a>
    </nav>`;
}

function motifMarkup(motif) {
  if (motif === "eyes") {
    return `<div class="eye-field">${Array.from({ length: 20 }, () => "<span></span>").join("")}</div>`;
  }
  if (motif === "balance") {
    return `<div class="balance-field">
      <span class="balance-field__ring"></span>
      <span class="balance-field__line"></span>
      <span class="balance-field__orb balance-field__orb--a"></span>
      <span class="balance-field__orb balance-field__orb--b"></span>
    </div>`;
  }
  return `<div class="sun-field">
    <span class="sun-field__disc"></span>
    <span class="sun-field__figure"></span>
    <span class="sun-field__horizon"></span>
  </div>`;
}

function projectVisual(project, { hint = false, extraClass = "" } = {}) {
  const style = `--project-accent:${escapeHTML(project.visual.accent)};--project-secondary:${escapeHTML(project.visual.secondary)}`;
  const image = project.cover
    ? `<img src="${safeURL(project.cover)}" alt="${escapeHTML(project.title)} documentation" loading="lazy">`
    : `<div class="project-visual__fallback" aria-hidden="true">${motifMarkup(project.visual.motif)}</div>`;
  return `<div class="project-visual project-visual--${escapeHTML(project.visual.motif)} ${extraClass}" style="${style}">
    ${image}
    ${hint && !project.cover ? '<span class="project-visual__upload-hint">Add archive image</span>' : ""}
  </div>`;
}

function researchNotesMarkup() {
  return state.notes
    .map(
      (note) => `<article>
        <span>${escapeHTML(note.number)}</span>
        <h2>${escapeHTML(note.title)}</h2>
        <p>${escapeHTML(note.text)}</p>
      </article>`,
    )
    .join("");
}

function experienceTemplate() {
  const { site, projects } = state;
  const works = projects
    .map(
      (project, index) => `<a data-route href="${routeURL({ work: project.slug })}" class="experience-work" data-reveal>
        <div class="experience-work__meta">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHTML(project.category)}</span>
          <span>${escapeHTML(project.year)}</span>
        </div>
        ${projectVisual(project, { hint: true })}
        <div class="experience-work__copy">
          <div>
            <p>${escapeHTML(project.titleKo)}</p>
            <h2>${escapeHTML(project.title)}</h2>
          </div>
          <p>${escapeHTML(project.summary)}</p>
          <span class="experience-work__arrow" aria-hidden="true">↗</span>
        </div>
      </a>`,
    )
    .join("");

  return `<main id="main" class="experience-page motion-${escapeHTML(site.theme.motion)}">
    <div class="experience-page__aura" aria-hidden="true"></div>
    <header class="experience-header">
      <a data-route href="./" class="experience-header__name" aria-label="Home">
        <span>${escapeHTML(site.shortName)}</span><span>${escapeHTML(site.role)}</span>
      </a>
      ${viewSwitch("experience", "dark")}
      <a class="experience-header__contact" href="mailto:${escapeHTML(site.email)}">Contact <span aria-hidden="true">↗</span></a>
    </header>

    <section class="experience-hero" aria-labelledby="experience-title">
      <canvas class="pointer-field" aria-hidden="true"></canvas>
      <div class="experience-hero__topline"><span>Works &amp; Research</span><span>Seoul · KR</span><span>Archive / 2026</span></div>
      <div class="experience-hero__title-wrap">
        <p class="experience-hero__kicker">A practice between</p>
        <h1 id="experience-title"><span>Body</span><span class="experience-hero__connector">×</span><span>Machine</span><span class="experience-hero__connector">×</span><span>Relation</span></h1>
      </div>
      <p class="experience-hero__intro">${escapeHTML(site.intro)}</p>
      <a class="experience-hero__scroll" href="#selected-works"><span>Enter the archive</span><span aria-hidden="true">↓</span></a>
      <div class="experience-hero__index" aria-hidden="true"><span>1000</span><span>eyes / traces / encounters</span></div>
    </section>

    <section class="experience-manifesto" data-reveal>
      <p class="section-label">Position / 01</p>
      <div class="experience-manifesto__body">
        <p>I do not begin with what a machine can <em>do.</em></p>
        <p>I begin with the encounter, gesture, and trace it leaves <em>behind.</em></p>
      </div>
      <div class="experience-manifesto__aside"><span>Robotics</span><span>Moving image</span><span>AI systems</span><span>Metal inlay</span></div>
    </section>

    <section class="experience-works" id="selected-works">
      <div class="experience-section-head" data-reveal><p class="section-label">Selected works / 02</p><p>Move slowly. The archive responds.</p></div>
      <div class="experience-works__list">${works}</div>
    </section>

    <section class="experience-research" data-reveal>
      <div class="experience-section-head"><p class="section-label">Research axes / 03</p><p>Questions carried from one work into the next.</p></div>
      <div class="experience-research__grid">${researchNotesMarkup()}</div>
    </section>

    <section class="experience-about" data-reveal>
      <p class="section-label">About / 04</p>
      <div class="experience-about__copy"><h2>Artist by formation.<br>Designer by practice.<br>Researcher in progress.</h2><p>${escapeHTML(site.about)}</p></div>
      <div class="experience-about__contact"><p>${escapeHTML(site.availability)}</p><a href="mailto:${escapeHTML(site.email)}">${escapeHTML(site.email)}</a></div>
    </section>

    <footer class="experience-footer"><p>© ${new Date().getFullYear()} ${escapeHTML(site.name)}</p><div>${site.socials.map((social) => `<a href="${safeURL(social.url)}" target="_blank" rel="noreferrer">${escapeHTML(social.label)}</a>`).join("")}</div><button class="top-button" type="button">Top ↑</button></footer>
  </main>`;
}

function archiveTemplate({ editing = false, draft = false, pageSlug = "" } = {}) {
  const published = normalizeArchiveData(state.archiveCanvas);
  const localDraft = editing || (draft && hasArchiveDraft());
  const documentData = localDraft ? getArchiveDraft(published) : published;
  const page = resolveArchivePage(documentData, pageSlug, { includeDraft: localDraft });
  state.activeArchiveCanvas = documentData;
  state.activeArchivePage = page;
  if (!page) return errorTemplate("This archive page is not published.");
  document.documentElement.style.setProperty("--page-transition-duration", `${documentData.settings.transition.duration}ms`);
  document.documentElement.style.setProperty("--page-transition-easing", documentData.settings.transition.easing);
  document.documentElement.style.setProperty("--page-transition-color", documentData.settings.transition.color);
  syncArchiveFontStylesheet(documentData, page.id);
  syncArchiveCustomHead(documentData, { enabled: !editing }); // Studio 7 (C1): head 코드는 공개 화면에서만
  if (editing) return archiveStudioTemplate(documentData, page.id);
  const hideSwitch = documentData.settings.hideViewSwitch;
  return `<main id="main" class="archive-page archive-transition-${escapeHTML(documentData.settings.transition.preset)}" style="--page-transition-duration:${documentData.settings.transition.duration}ms;--page-transition-easing:${escapeHTML(documentData.settings.transition.easing)};--page-transition-color:${escapeHTML(documentData.settings.transition.color)};background-color:${escapeHTML(page.canvas.background)}">
    ${hideSwitch ? "" : `<header class="archive-canvas-nav">${viewSwitch("archive", "light")}</header>`}
    ${archiveSiteChromeMarkup(documentData, page, { draft: localDraft })}
    <div class="archive-canvas-viewport${hideSwitch ? " archive-canvas-viewport--full" : ""}"><div class="archive-canvas-sizer" data-archive-sizer>${archiveCanvasMarkup(documentData, page, { draft: localDraft })}</div></div>
    ${archiveFixedLayerMarkup(documentData, page, { draft: localDraft })}
  </main>`;
}

function detailTemplate(project, fromArchive = false) {
  const { site, projects } = state;
  const index = projects.findIndex((item) => item.slug === project.slug);
  const previous = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  const list = (items) => items.map((item) => `<li>${escapeHTML(item)}</li>`).join("");
  const gallery = project.gallery.length
    ? project.gallery.map((item) => `<figure><img src="${safeURL(item.image)}" alt="${escapeHTML(item.caption || project.title)}" loading="lazy">${item.caption ? `<figcaption>${escapeHTML(item.caption)}</figcaption>` : ""}</figure>`).join("")
    : `${projectVisual(project)}<div class="project-gallery__placeholder"><span>02</span><p>Process, detail, or installation view</p></div>`;
  const style = `--project-accent:${escapeHTML(project.visual.accent)};--project-secondary:${escapeHTML(project.visual.secondary)}`;

  return `<main id="main" class="project-page" style="${style}">
    <header class="project-header"><a data-route href="./" class="project-header__name">${escapeHTML(site.shortName)} <span>Works &amp; Research</span></a>${viewSwitch(fromArchive ? "archive" : "experience", "dark")}<a data-route href="${routeURL(fromArchive ? { view: "archive" } : {})}" class="project-header__close">Close ×</a></header>
    <section class="project-hero">
      <div class="project-hero__index"><span>${String(index + 1).padStart(2, "0")}</span><span>${escapeHTML(project.category)}</span><span>${escapeHTML(project.year)}</span></div>
      <div class="project-hero__title"><p>${escapeHTML(project.titleKo)}</p><h1>${escapeHTML(project.title)}</h1></div>
      <p class="project-hero__summary">${escapeHTML(project.summary)}</p>${projectVisual(project, { hint: true })}
    </section>
    <section class="project-facts"><dl><div><dt>Format</dt><dd>${escapeHTML(project.format)}</dd></div><div><dt>Duration / scale</dt><dd>${escapeHTML(project.duration)}</dd></div><div><dt>My role</dt><dd>${escapeHTML(project.role)}</dd></div><div><dt>Status</dt><dd>${escapeHTML(project.status)}</dd></div></dl></section>
    <section class="project-narrative"><p class="project-section-label">The work</p><p class="project-narrative__lead">${escapeHTML(project.statement)}</p></section>
    <section class="project-research"><div><p class="project-section-label">Research lens</p><h2>${escapeHTML(project.researchQuestion)}</h2></div><div class="project-research__columns"><div><h3>Methods</h3><ul>${list(project.methods)}</ul></div><div><h3>Tools / material</h3><ul>${list(project.tools)}</ul></div></div></section>
    <section class="project-gallery"><div class="project-gallery__head"><p class="project-section-label">Documentation</p><p>${project.gallery.length ? `${project.gallery.length} archive images` : "Images can be added from the content studio"}</p></div><div class="project-gallery__grid">${gallery}</div></section>
    <section class="project-recognition"><p class="project-section-label">Exhibition / recognition</p><p>${escapeHTML(project.recognition)}</p></section>
    <nav class="project-pagination" aria-label="Other projects"><a data-route href="${routeURL({ work: previous.slug, ...(fromArchive ? { view: "archive" } : {}) })}"><span>← Previous</span><strong>${escapeHTML(previous.title)}</strong></a><a data-route href="${routeURL({ work: next.slug, ...(fromArchive ? { view: "archive" } : {}) })}"><span>Next →</span><strong>${escapeHTML(next.title)}</strong></a></nav>
  </main>`;
}

function errorTemplate(message) {
  return `<main id="main" class="not-found"><p>Archive error</p><h1>${escapeHTML(message)}</h1><a data-route href="./">Return to works →</a></main>`;
}

function clearPageEffects() {
  state.cleanups.forEach((cleanup) => cleanup());
  state.cleanups = [];
}

function bindRouteLinks() {
  document.querySelectorAll("a[data-route]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const navigate = () => {
        history.pushState({}, "", link.getAttribute("href"));
        render();
        requestAnimationFrame(() => { if (!scrollToCurrentArchiveAnchor()) window.scrollTo(0, 0); });
      };
      const transition = state.activeArchiveCanvas?.settings?.transition?.preset;
      if (document.startViewTransition && transition && transition !== "none" && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const root = document.documentElement;
        const fromPointer = event.clientX || event.clientY;
        root.style.setProperty("--vt-x", fromPointer ? `${event.clientX}px` : "50%");
        root.style.setProperty("--vt-y", fromPointer ? `${event.clientY}px` : "50%");
        root.classList.add("archive-native-transition", `vt-${transition}`);
        document.startViewTransition(navigate).finished.finally(() => root.classList.remove("archive-native-transition", `vt-${transition}`));
      }
      else navigate();
    });
  });
}

function scrollToCurrentArchiveAnchor() {
  if (!location.hash) return false;
  const id = decodeURIComponent(location.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return false;
  target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  return true;
}

function bindSharedControls() {
  document.querySelectorAll(".top-button").forEach((button) => {
    button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  });
}

function bindReveal() {
  const elements = document.querySelectorAll("[data-reveal]");
  if (!elements.length || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("is-visible")),
    { rootMargin: "0px 0px -10%", threshold: 0.08 },
  );
  elements.forEach((element) => observer.observe(element));
  state.cleanups.push(() => observer.disconnect());
}

function bindExperience() {
  const page = document.querySelector(".experience-page");
  if (page) {
    const aura = (event) => {
      page.style.setProperty("--mouse-x", `${event.clientX}px`);
      page.style.setProperty("--mouse-y", `${event.clientY}px`);
    };
    page.addEventListener("pointermove", aura);
    state.cleanups.push(() => page.removeEventListener("pointermove", aura));
  }

  document.querySelectorAll(".experience-work").forEach((card) => {
    const tilt = (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--card-x", (event.clientX - rect.left) / rect.width - 0.5);
      card.style.setProperty("--card-y", (event.clientY - rect.top) / rect.height - 0.5);
    };
    card.addEventListener("pointermove", tilt);
    state.cleanups.push(() => card.removeEventListener("pointermove", tilt));
  });
  bindReveal();
  bindPointerField();
}

function bindArchive({ editing = false } = {}) {
  const cleanup = editing
    ? bindArchiveStudio(state.activeArchiveCanvas, state.archiveCanvas, state.activeArchivePage?.id)
    : state.activeArchivePage ? bindArchiveViewer(state.activeArchiveCanvas, state.activeArchivePage) : null;
  if (cleanup) state.cleanups.push(cleanup);
}

function bindPointerField() {
  const canvas = document.querySelector(".pointer-field");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || state.site.theme.motion === "off";
  const pointer = { x: 0.54, y: 0.44, tx: 0.54, ty: 0.44, burst: 0 };
  let width = 1;
  let height = 1;
  let frame = 0;
  let animationFrame = 0;
  let points = [];

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const columns = Math.max(9, Math.floor(width / 92));
    const rows = Math.max(7, Math.floor(height / 82));
    points = Array.from({ length: columns * rows }, (_, index) => ({
      x: (index % columns + 0.5 + (Math.floor(index / columns) % 2) * 0.24) / columns,
      y: (Math.floor(index / columns) + 0.5) / rows,
      phase: index * 0.72,
      size: 0.7 + ((index * 3) % 7) / 8,
    }));
  };

  const draw = () => {
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    pointer.burst *= 0.94;
    if (!reduced) frame += 0.012;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";
    points.forEach((point) => {
      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 0.36 - distance) / 0.36;
      const safeDistance = Math.max(distance, 0.035);
      const push = influence * (20 + pointer.burst * 38);
      const x = point.x * width + Math.sin(frame * 2 + point.phase) * 4 + (dx / safeDistance) * push;
      const y = point.y * height + Math.cos(frame + point.phase) * 3 + (dy / safeDistance) * push;
      context.beginPath();
      context.fillStyle = `rgba(235,235,224,${0.2 + influence * 0.62})`;
      context.arc(x, y, point.size + influence * 2.5, 0, Math.PI * 2);
      context.fill();
      if (influence > 0.42) {
        context.beginPath();
        context.strokeStyle = `rgba(255,90,54,${influence * 0.34})`;
        context.lineWidth = 0.7;
        context.ellipse(x, y, 9 + influence * 13, 3 + influence * 4, 0, 0, Math.PI * 2);
        context.stroke();
      }
    });
    context.globalCompositeOperation = "source-over";
    if (!reduced) animationFrame = requestAnimationFrame(draw);
  };

  const move = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.tx = (event.clientX - rect.left) / rect.width;
    pointer.ty = (event.clientY - rect.top) / rect.height;
  };
  const leave = () => Object.assign(pointer, { tx: 0.54, ty: 0.44 });
  const burst = () => { pointer.burst = 1; };
  resize();
  draw();
  addEventListener("resize", resize);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointerdown", burst);
  state.cleanups.push(() => {
    cancelAnimationFrame(animationFrame);
    removeEventListener("resize", resize);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("pointerdown", burst);
  });
}

function applyTheme() {
  const { theme } = state.site;
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--signal", theme.signal);
  root.style.setProperty("--paper", theme.paper);
  root.style.setProperty("--ink", theme.ink);
}

function setMeta(selector, attributes) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    document.head.append(node);
  }
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
}

function setCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.rel = "canonical";
    document.head.append(node);
  }
  node.href = href;
}

function applyArchiveMeta(documentData, page, { draft = false } = {}) {
  if (!page) {
    setMeta('meta[name="robots"]', { name: "robots", content: "noindex,nofollow" });
    return;
  }
  const suffix = documentData.settings.seo.titleSuffix || ` — ${state.site.name}`;
  const title = `${page.seo.title || page.name}${suffix}`;
  const description = page.seo.description || documentData.settings.seo.description || state.site.intro;
  const image = safeURL(page.seo.image || documentData.settings.seo.image);
  const canonical = new URL(location.href);
  canonical.searchParams.delete("edit");
  canonical.searchParams.delete("draft");
  document.title = title;
  document.documentElement.lang = page.seo.language || "ko";
  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[property="og:image"]', { property: "og:image", content: image });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonical.href });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: image ? "summary_large_image" : "summary" });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  setCanonical(canonical.href);
  const noIndex = draft || page.visibility === "draft" || page.seo.noIndex || documentData.settings.seo.noIndex;
  setMeta('meta[name="robots"]', { name: "robots", content: noIndex ? "noindex,nofollow" : "index,follow" });
}

function render({ preserveScroll = false } = {}) {
  const previousScroll = scrollY;
  clearPageEffects();
  const params = new URLSearchParams(location.search);
  const work = params.get("work");
  const archive = params.get("view") === "archive" || (!params.get("view") && !work && archiveIsHome());
  const archiveEditing = archive && params.get("edit") === "1";
  const archiveDraft = archive && params.get("draft") === "1";
  const archivePageSlug = archive ? params.get("page") || "" : "";
  document.documentElement.dataset.view = work ? "project" : archive ? "archive" : "experience";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", archive ? "#ffffff" : "#080808");

  if (work) {
    const project = state.projects.find((item) => item.slug === work);
    app.innerHTML = project ? detailTemplate(project, archive) : errorTemplate("This work is not in the archive.");
    document.title = project ? `${project.title} — ${state.site.name}` : `Not found — ${state.site.name}`;
  } else if (archive) {
    app.innerHTML = archiveTemplate({ editing: archiveEditing, draft: archiveDraft, pageSlug: archivePageSlug });
    if (archiveEditing) document.title = `Archive Studio — ${state.site.name}`;
    else applyArchiveMeta(state.activeArchiveCanvas, state.activeArchivePage, { draft: archiveDraft });
  } else {
    app.innerHTML = experienceTemplate();
    document.title = `${state.site.name} — Works & Research`;
    document.documentElement.lang = "en";
    setMeta('meta[name="robots"]', { name: "robots", content: "index,follow" });
  }

  bindRouteLinks();
  bindSharedControls();
  if (!work && archive) bindArchive({ editing: archiveEditing });
  if (!work && !archive) bindExperience();
  if (preserveScroll) requestAnimationFrame(() => scrollTo(0, previousScroll));
  else if (archive && location.hash) requestAnimationFrame(scrollToCurrentArchiveAnchor);
}

async function loadArchive() {
  try {
    const fresh = { cache: "no-store" };
    const [siteResponse, projectsResponse, notesResponse, archiveResponse] = await Promise.all([
      fetch("./content/site.json", fresh),
      fetch("./content/projects.json", fresh),
      fetch("./content/notes.json", fresh),
      fetch("./content/archive.json", fresh),
    ]);
    if (!siteResponse.ok || !projectsResponse.ok || !notesResponse.ok || !archiveResponse.ok) throw new Error("Archive files could not be loaded.");
    [state.site, state.projects, state.notes, state.archiveCanvas] = await Promise.all([
      siteResponse.json(),
      projectsResponse.json(),
      notesResponse.json(),
      archiveResponse.json(),
    ]);
    applyTheme();
    render();
  } catch (error) {
    app.innerHTML = errorTemplate(error.message || "The archive could not be opened.");
    bindRouteLinks();
  }
}

addEventListener("popstate", () => {
  render();
  requestAnimationFrame(() => { if (!scrollToCurrentArchiveAnchor()) scrollTo(0, 0); });
});

loadArchive();
