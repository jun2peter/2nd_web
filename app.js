const app = document.querySelector("#app");

const state = {
  site: null,
  projects: [],
  notes: [],
  archiveCategory: "All",
  archiveLayout: "grid",
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

function routeURL({ view, work } = {}) {
  const params = new URLSearchParams();
  if (view === "archive") params.set("view", "archive");
  if (work) params.set("work", work);
  const query = params.toString();
  return query ? `?${query}` : "./";
}

function viewSwitch(active = "experience", tone = "dark") {
  return `
    <nav class="view-switch view-switch--${tone}" aria-label="Choose portfolio view">
      <a data-route href="${routeURL()}" class="${active === "experience" ? "is-active" : ""}" ${active === "experience" ? 'aria-current="page"' : ""}>Experience</a>
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
        <p>I begin with the relation its interface makes <em>possible.</em></p>
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
      <div class="experience-about__copy"><h2>Artist by formation.<br>Interface designer by method.<br>Researcher by direction.</h2><p>${escapeHTML(site.about)}</p></div>
      <div class="experience-about__contact"><p>${escapeHTML(site.availability)}</p><a href="mailto:${escapeHTML(site.email)}">${escapeHTML(site.email)}</a></div>
    </section>

    <footer class="experience-footer"><p>© ${new Date().getFullYear()} ${escapeHTML(site.name)}</p><div>${site.socials.map((social) => `<a href="${safeURL(social.url)}" target="_blank" rel="noreferrer">${escapeHTML(social.label)}</a>`).join("")}</div><button class="top-button" type="button">Top ↑</button></footer>
  </main>`;
}

function archiveTemplate() {
  const { site, projects, archiveCategory, archiveLayout } = state;
  const categories = ["All", ...new Set(projects.map((project) => project.category))];
  const visible = archiveCategory === "All" ? projects : projects.filter((project) => project.category === archiveCategory);
  const projectMarkup = visible
    .map(
      (project) => `<a data-route href="${routeURL({ work: project.slug, view: "archive" })}" class="archive-project">
        <div class="archive-project__index">${String(projects.indexOf(project) + 1).padStart(2, "0")}</div>
        ${projectVisual(project)}
        <div class="archive-project__title"><h2>${escapeHTML(project.title)}</h2><p>${escapeHTML(project.titleKo)}</p></div>
        <div class="archive-project__meta"><span>${escapeHTML(project.category)}</span><span>${escapeHTML(project.year)}</span></div>
        <p class="archive-project__summary">${escapeHTML(project.summary)}</p><span class="archive-project__open" aria-hidden="true">↗</span>
      </a>`,
    )
    .join("");

  return `<main id="main" class="archive-page">
    <header class="archive-header"><a data-route href="${routeURL({ view: "archive" })}" class="archive-wordmark">${escapeHTML(site.name)}</a>${viewSwitch("archive", "light")}<div class="archive-header__right"><span>${escapeHTML(site.location)}</span><a href="mailto:${escapeHTML(site.email)}">Email ↗</a></div></header>
    <section class="archive-intro" aria-labelledby="archive-title">
      <div class="archive-intro__role"><span>Practice</span><p>${escapeHTML(site.role)}</p></div>
      <div class="archive-intro__statement"><p class="archive-kicker">Portfolio / Research archive</p><h1 id="archive-title">${escapeHTML(site.intro)}</h1></div>
      <div class="archive-intro__index"><span>Index</span><dl><div><dt>Works</dt><dd>${String(projects.length).padStart(2, "0")}</dd></div><div><dt>Axes</dt><dd>${String(state.notes.length).padStart(2, "0")}</dd></div><div><dt>Updated</dt><dd>2026.08</dd></div></dl></div>
    </section>
    <section class="archive-work-section" id="works">
      <div class="archive-toolbar"><p>Selected works</p><div class="archive-filters" aria-label="Filter works by category">${categories.map((category) => `<button type="button" data-category="${escapeHTML(category)}" class="${category === archiveCategory ? "is-active" : ""}" aria-pressed="${category === archiveCategory}">${escapeHTML(category)}</button>`).join("")}</div><div class="archive-layout-toggle" aria-label="Choose archive layout"><button type="button" data-layout="grid" class="${archiveLayout === "grid" ? "is-active" : ""}">Grid</button><span>/</span><button type="button" data-layout="list" class="${archiveLayout === "list" ? "is-active" : ""}">List</button></div></div>
      <div class="archive-projects archive-projects--${archiveLayout}">${projectMarkup}</div>
    </section>
    <section class="archive-axes"><div class="archive-axes__label"><p>Research axes</p><span>Questions in progress</span></div><div class="archive-axes__list">${researchNotesMarkup()}</div></section>
    <section class="archive-about"><p>About</p><div><p>${escapeHTML(site.about)}</p><div class="archive-about__links"><a href="mailto:${escapeHTML(site.email)}">${escapeHTML(site.email)}</a>${site.socials.map((social) => `<a href="${safeURL(social.url)}" target="_blank" rel="noreferrer">${escapeHTML(social.label)} ↗</a>`).join("")}</div></div></section>
    <footer class="archive-footer"><span>© ${new Date().getFullYear()}</span><span>Designed as a living archive</span><button class="top-button" type="button">Back to top ↑</button></footer>
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
      history.pushState({}, "", link.getAttribute("href"));
      render();
      window.scrollTo(0, 0);
    });
  });
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

function bindArchive() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.archiveCategory = button.dataset.category;
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll("[data-layout]").forEach((button) => {
    button.addEventListener("click", () => {
      state.archiveLayout = button.dataset.layout;
      render({ preserveScroll: true });
    });
  });
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

function render({ preserveScroll = false } = {}) {
  const previousScroll = scrollY;
  clearPageEffects();
  const params = new URLSearchParams(location.search);
  const work = params.get("work");
  const archive = params.get("view") === "archive";
  document.documentElement.dataset.view = work ? "project" : archive ? "archive" : "experience";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", archive ? state.site.theme.paper : "#080808");

  if (work) {
    const project = state.projects.find((item) => item.slug === work);
    app.innerHTML = project ? detailTemplate(project, archive) : errorTemplate("This work is not in the archive.");
    document.title = project ? `${project.title} — ${state.site.name}` : `Not found — ${state.site.name}`;
  } else if (archive) {
    app.innerHTML = archiveTemplate();
    document.title = `Archive — ${state.site.name}`;
  } else {
    app.innerHTML = experienceTemplate();
    document.title = `${state.site.name} — Works & Research`;
  }

  bindRouteLinks();
  bindSharedControls();
  if (!work && archive) bindArchive();
  if (!work && !archive) bindExperience();
  if (preserveScroll) requestAnimationFrame(() => scrollTo(0, previousScroll));
}

async function loadArchive() {
  try {
    const [siteResponse, projectsResponse, notesResponse] = await Promise.all([
      fetch("./content/site.json"),
      fetch("./content/projects.json"),
      fetch("./content/notes.json"),
    ]);
    if (!siteResponse.ok || !projectsResponse.ok || !notesResponse.ok) throw new Error("Archive files could not be loaded.");
    [state.site, state.projects, state.notes] = await Promise.all([
      siteResponse.json(),
      projectsResponse.json(),
      notesResponse.json(),
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
  scrollTo(0, 0);
});

loadArchive();
