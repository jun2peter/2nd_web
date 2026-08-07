const STORAGE_KEY = "psj-archive-canvas-draft-v1";
const GITHUB_EDIT_URL = "https://github.com/jun2peter/2nd_web/edit/main/content/archive.json";
const GITHUB_MEDIA_UPLOAD_URL = "https://github.com/jun2peter/2nd_web/upload/main/media";

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
  const clean = String(value ?? "").replace(/[;{}<>]/g, "").trim();
  return clean || fallback;
};

const cssColor = (value, fallback = "transparent") => {
  const clean = String(value ?? "").trim();
  return /^[#(),.%\w\s-]+$/.test(clean) ? clean : fallback;
};

function safeURL(value = "", { imageData = false, link = false } = {}) {
  const raw = String(value).trim();
  if (!raw) return "";
  if (imageData && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw) && !/["'<>\\]/.test(raw)) return raw;
  if (link && /^(?:mailto:|tel:|#)/i.test(raw)) return raw;
  if (/^(?:\.\.\/|\.\/|\/)?[a-z0-9_@%+.,~()\-/]+(?:\?[a-z0-9_@%+.,~=&\-/]*)?$/i.test(raw)) {
    return raw.startsWith("/") ? `.${raw}` : raw;
  }
  return "";
}

function normalizeBlock(block = {}, index = 0) {
  const type = ["text", "image", "video", "button", "shape", "marquee"].includes(block.type) ? block.type : "text";
  return {
    id: cssText(block.id, `${type}-${index + 1}`),
    name: cssText(block.name, type[0].toUpperCase() + type.slice(1)),
    type,
    x: number(block.x, 80),
    y: number(block.y, 80),
    width: number(block.width, type === "text" ? 520 : 360, 24),
    height: number(block.height, type === "text" ? 120 : 240, 24),
    z: number(block.z, index + 1, 0, 9999),
    rotation: number(block.rotation, 0, -360, 360),
    opacity: number(block.opacity, 1, 0, 1),
    content: String(block.content ?? (type === "text" ? "새 텍스트" : type === "button" ? "버튼" : type === "marquee" ? "반복되는 문장" : "")),
    src: String(block.src ?? ""),
    media: String(block.media ?? ""),
    alt: String(block.alt ?? ""),
    href: String(block.href ?? "#"),
    openNewTab: Boolean(block.openNewTab),
    fontFamily: cssText(block.fontFamily, "Arial, sans-serif"),
    fontSize: number(block.fontSize, type === "button" ? 16 : 48, 6, 400),
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
    autoplay: block.autoplay !== false,
    loop: block.loop !== false,
    muted: block.muted !== false,
    controls: Boolean(block.controls),
    speed: number(block.speed, 18, 2, 120),
    direction: block.direction === "right" ? "right" : "left",
  };
}

export function normalizeArchiveData(source = {}) {
  const canvas = source.canvas || {};
  return {
    version: 1,
    canvas: {
      width: number(canvas.width, 1440, 320, 5000),
      height: number(canvas.height, 1800, 400, 20000),
      background: cssColor(canvas.background, "#ffffff"),
      grid: number(canvas.grid, 8, 1, 100),
      fontStylesheet: safeURL(canvas.fontStylesheet),
    },
    blocks: Array.isArray(source.blocks) ? source.blocks.map(normalizeBlock) : [],
  };
}

export function getArchiveDraft(published) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeArchiveData(JSON.parse(stored));
  } catch (error) {
    console.warn("Archive draft could not be read.", error);
  }
  return normalizeArchiveData(published);
}

function saveDraft(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Archive draft could not be saved.", error);
  }
}

export function syncArchiveFontStylesheet(data) {
  const id = "archive-custom-font";
  let link = document.querySelector(`#${id}`);
  const href = safeURL(data?.canvas?.fontStylesheet);
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
    `width:${number(block.width, 100, 24)}px`,
    `height:${number(block.height, 100, 24)}px`,
    `z-index:${number(block.z, 1, 0, 9999)}`,
    `opacity:${number(block.opacity, 1, 0, 1)}`,
    `transform:rotate(${number(block.rotation)}deg)`,
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
  return [
    `background:${cssColor(block.background)}`,
    `border:${number(block.borderWidth, 0, 0, 40)}px solid ${cssColor(block.borderColor, "#111111")}`,
    `border-radius:${number(block.borderRadius, 0, 0, 1000)}px`,
    `padding:${number(block.padding, 0, 0, 200)}px`,
  ].join(";");
}

function videoMarkup(block) {
  const src = safeURL(block.media || block.src);
  if (!src) return '<div class="canvas-block__placeholder">VIDEO URL</div>';
  try {
    const url = new URL(src, location.href);
    let embed = "";
    if (/(?:youtube\.com|youtu\.be)$/.test(url.hostname.replace(/^www\./, ""))) {
      const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").pop();
      if (/^[\w-]{6,}$/.test(id || "")) {
        const params = new URLSearchParams({ autoplay: block.autoplay ? "1" : "0", mute: block.muted ? "1" : "0", loop: block.loop ? "1" : "0", playlist: id });
        embed = `https://www.youtube.com/embed/${id}?${params}`;
      }
    } else if (/vimeo\.com$/.test(url.hostname.replace(/^www\./, ""))) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (/^\d+$/.test(id || "")) embed = `https://player.vimeo.com/video/${id}?autoplay=${block.autoplay ? 1 : 0}&muted=${block.muted ? 1 : 0}&loop=${block.loop ? 1 : 0}`;
    }
    if (embed) return `<iframe src="${escapeHTML(embed)}" title="${escapeHTML(block.alt || block.name)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } catch (error) {
    console.warn("Video URL could not be parsed.", error);
  }
  return `<video src="${escapeHTML(src)}" playsinline ${block.autoplay ? "autoplay" : ""} ${block.loop ? "loop" : ""} ${block.muted ? "muted" : ""} ${block.controls ? "controls" : ""}></video>`;
}

function repeatedText(content) {
  const item = `<span>${escapeHTML(content)}</span>`;
  return `<div class="canvas-marquee__track"><div>${item.repeat(5)}</div><div aria-hidden="true">${item.repeat(5)}</div></div>`;
}

export function archiveBlockMarkup(rawBlock, { editing = false } = {}) {
  const block = normalizeBlock(rawBlock);
  let content = "";
  if (block.type === "text") {
    content = `<div class="canvas-block__text" style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content).replaceAll("\n", "<br>")}</div>`;
  } else if (block.type === "image") {
    const src = safeURL(block.media || block.src, { imageData: true });
    content = !src
      ? '<div class="canvas-block__placeholder">IMAGE / GIF</div>'
      : block.repeat === "no-repeat"
        ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(block.alt)}" style="object-fit:${block.objectFit};border-radius:${block.borderRadius}px">`
        : `<div class="canvas-block__repeated-image" style="background-image:url('${escapeHTML(src)}');background-repeat:${block.repeat};background-size:${block.repeatSize}px auto;border-radius:${block.borderRadius}px"></div>`;
  } else if (block.type === "video") {
    content = videoMarkup(block);
  } else if (block.type === "button") {
    const href = safeURL(block.href, { link: true }) || "#";
    content = `<a class="canvas-block__button" href="${escapeHTML(href)}" ${block.openNewTab ? 'target="_blank" rel="noreferrer"' : ""} style="${typographyStyle(block)};${surfaceStyle(block)}">${escapeHTML(block.content)}</a>`;
  } else if (block.type === "shape") {
    content = `<div class="canvas-block__shape" style="${surfaceStyle(block)}"></div>`;
  } else if (block.type === "marquee") {
    content = `<div class="canvas-marquee canvas-marquee--${block.direction}" style="${typographyStyle(block)};${surfaceStyle(block)};--marquee-speed:${block.speed}s">${repeatedText(block.content)}</div>`;
  }
  return `<article class="canvas-block canvas-block--${block.type}${editing ? " is-editable" : ""}" data-block-id="${escapeHTML(block.id)}" style="${commonStyle(block)}"><div class="canvas-block__content">${content}</div>${editing ? '<button class="canvas-block__resize" data-resize type="button" aria-label="크기 조절"></button>' : ""}</article>`;
}

export function archiveCanvasMarkup(data, { editing = false } = {}) {
  const normalized = normalizeArchiveData(data);
  const blocks = normalized.blocks.map((block) => archiveBlockMarkup(block, { editing })).join("");
  return `<section class="archive-canvas${editing ? " archive-canvas--editing" : ""}" data-archive-canvas style="width:${normalized.canvas.width}px;height:${normalized.canvas.height}px;background-color:${normalized.canvas.background};--canvas-grid:${normalized.canvas.grid}px">${blocks}${editing && !blocks ? '<div class="archive-canvas__empty">왼쪽에서 요소를 추가하세요</div>' : ""}</section>`;
}

export function archiveStudioTemplate(data) {
  const normalized = normalizeArchiveData(data);
  return `<main id="main" class="archive-page archive-page--studio">
    <div class="archive-studio" data-archive-studio>
      <aside class="archive-studio__left">
        <div class="archive-studio__brand"><strong>ARCHIVE STUDIO</strong><span>local draft</span></div>
        <a class="studio-exit" href="?view=archive">← 사이트로 돌아가기</a>
        <section class="studio-panel"><h2>요소 추가</h2><div class="studio-add-grid">
          <button data-add="text" type="button">T&nbsp; 텍스트</button><button data-add="image" type="button">▧ 이미지·GIF</button><button data-add="video" type="button">▶ 영상</button><button data-add="button" type="button">↗ 버튼</button><button data-add="shape" type="button">○ 도형</button><button data-add="marquee" type="button">→ 반복 글자</button>
        </div></section>
        <section class="studio-panel"><h2>아트보드</h2><div class="studio-fields studio-fields--two">
          ${field("너비", "canvas.width", normalized.canvas.width, "number")}${field("높이", "canvas.height", normalized.canvas.height, "number")}${field("배경", "canvas.background", normalized.canvas.background, "text")}${field("스냅", "canvas.grid", normalized.canvas.grid, "number")}
        </div>${field("웹폰트 CSS 주소", "canvas.fontStylesheet", normalized.canvas.fontStylesheet, "url")}</section>
        <section class="studio-panel studio-layers"><h2>레이어</h2><div data-layer-list></div></section>
      </aside>
      <section class="archive-studio__center">
        <header class="archive-studio__topbar"><span data-save-status>이 브라우저에 자동 저장됨</span><div><button data-action="preview" type="button">미리보기</button><button data-action="download" type="button">JSON 저장</button><button class="studio-publish" data-action="publish" type="button">게시 준비</button></div></header>
        <div class="archive-studio__workspace"><div class="archive-studio__board">${archiveCanvasMarkup(normalized, { editing: true })}</div></div>
      </section>
      <aside class="archive-studio__inspector" data-inspector><div class="inspector-empty"><span>NO SELECTION</span><p>요소를 선택하면 위치·폰트·색상·반복을 바꿀 수 있어요.</p></div></aside>
      <input data-image-picker type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
    </div>
  </main>`;
}

function field(label, path, value, type = "text", options = "") {
  if (type === "select") return `<label><span>${label}</span><select data-field="${path}">${options}</select></label>`;
  if (type === "checkbox") return `<label class="studio-check"><input data-field="${path}" type="checkbox" ${value ? "checked" : ""}><span>${label}</span></label>`;
  if (type === "textarea") return `<label class="studio-field--wide"><span>${label}</span><textarea data-field="${path}" rows="4">${escapeHTML(value)}</textarea></label>`;
  return `<label><span>${label}</span><input data-field="${path}" type="${type}" value="${escapeHTML(value)}"></label>`;
}

const option = (value, current, label = value) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`;

function inspectorMarkup(block) {
  const mediaFields = block.type === "image" ? `
    ${field("외부 이미지·GIF 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="pick-image" type="button">작은 이미지·GIF 바로 넣기</button><button class="inspector-file" data-action="upload-media" type="button">큰 이미지·GIF 업로드 ↗</button>
    ${field("설명(alt)", "alt", block.alt)}
    ${field("맞춤", "objectFit", block.objectFit, "select", ["cover", "contain", "fill"].map((item) => option(item, block.objectFit)).join(""))}
    ${field("반복", "repeat", block.repeat, "select", ["no-repeat", "repeat", "repeat-x", "repeat-y"].map((item) => option(item, block.repeat)).join(""))}
    ${field("반복 크기", "repeatSize", block.repeatSize, "number")}` : "";
  const videoFields = block.type === "video" ? `
    ${field("YouTube·Vimeo·외부 영상 링크", "src", block.src, "url")}${field("업로드 파일 경로", "media", block.media)}<button class="inspector-file" data-action="upload-video" type="button">MP4·WebM 영상 파일 업로드 ↗</button><p class="studio-help">업로드 후 ‘업로드 파일 경로’에 /media/파일명을 입력하세요. 브라우저 업로드는 파일당 25MB까지 가능합니다.</p>
    <div class="studio-checks">${field("자동재생", "autoplay", block.autoplay, "checkbox")}${field("반복", "loop", block.loop, "checkbox")}${field("음소거", "muted", block.muted, "checkbox")}${field("컨트롤", "controls", block.controls, "checkbox")}</div>` : "";
  const linkFields = block.type === "button" ? `${field("링크", "href", block.href, "url")}${field("새 창", "openNewTab", block.openNewTab, "checkbox")}` : "";
  const textFields = ["text", "button", "marquee"].includes(block.type) ? `
    ${field(block.type === "button" ? "버튼 글자" : "내용", "content", block.content, "textarea")}
    ${field("폰트", "fontFamily", block.fontFamily)}
    <div class="studio-fields studio-fields--two">${field("크기", "fontSize", block.fontSize, "number")}${field("굵기", "fontWeight", block.fontWeight, "number")}${field("행간", "lineHeight", block.lineHeight, "number")}${field("자간", "letterSpacing", block.letterSpacing, "number")}</div>
    ${field("정렬", "textAlign", block.textAlign, "select", ["left", "center", "right"].map((item) => option(item, block.textAlign)).join(""))}` : "";
  const marqueeFields = block.type === "marquee" ? `<div class="studio-fields studio-fields--two">${field("속도(초)", "speed", block.speed, "number")}${field("방향", "direction", block.direction, "select", option("left", block.direction, "왼쪽") + option("right", block.direction, "오른쪽"))}</div>` : "";
  return `<div class="inspector-head"><div><span>${escapeHTML(block.type)}</span><strong>${escapeHTML(block.name)}</strong></div><button data-action="delete" type="button">삭제</button></div>
    <section class="studio-panel"><h2>레이어</h2>${field("이름", "name", block.name)}<div class="studio-fields studio-fields--two">${field("X", "x", block.x, "number")}${field("Y", "y", block.y, "number")}${field("W", "width", block.width, "number")}${field("H", "height", block.height, "number")}${field("회전", "rotation", block.rotation, "number")}${field("투명도", "opacity", block.opacity, "number")}</div><div class="inspector-actions"><button data-action="duplicate" type="button">복제</button><button data-action="back" type="button">뒤로</button><button data-action="front" type="button">앞으로</button></div></section>
    <section class="studio-panel"><h2>내용과 동작</h2>${textFields}${mediaFields}${videoFields}${linkFields}${marqueeFields}</section>
    <section class="studio-panel"><h2>모양</h2><div class="studio-fields studio-fields--two">${field("글자색", "color", block.color)}${field("배경색", "background", block.background)}${field("선 색", "borderColor", block.borderColor)}${field("선 두께", "borderWidth", block.borderWidth, "number")}${field("둥근 모서리", "borderRadius", block.borderRadius, "number")}${field("안쪽 여백", "padding", block.padding, "number")}</div></section>`;
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

function defaultBlock(type, data) {
  const index = data.blocks.length;
  const maxZ = Math.max(0, ...data.blocks.map((block) => block.z));
  return normalizeBlock({
    id: `${type}-${Date.now().toString(36)}`,
    name: `${type[0].toUpperCase()}${type.slice(1)} ${index + 1}`,
    type,
    x: Math.max(40, Math.round(data.canvas.width / 2 - (type === "text" ? 260 : 180)) + index * 8),
    y: 100 + index * 24,
    z: maxZ + 1,
    width: type === "marquee" ? 720 : type === "text" ? 520 : type === "button" ? 180 : 360,
    height: type === "marquee" ? 72 : type === "text" ? 130 : type === "button" ? 58 : 260,
  }, index);
}

export function bindArchiveViewer(data) {
  const canvas = document.querySelector("[data-archive-canvas]");
  const sizer = document.querySelector("[data-archive-sizer]");
  if (!canvas || !sizer) return;
  const normalized = normalizeArchiveData(data);
  const resize = () => {
    const scale = Math.min(1, innerWidth / normalized.canvas.width);
    canvas.style.transform = `scale(${scale})`;
    sizer.style.width = `${normalized.canvas.width * scale}px`;
    sizer.style.height = `${normalized.canvas.height * scale}px`;
  };
  resize();
  addEventListener("resize", resize);
  return () => removeEventListener("resize", resize);
}

export function bindArchiveStudio(initialData, publishedData) {
  const studio = document.querySelector("[data-archive-studio]");
  if (!studio) return;
  let data = normalizeArchiveData(initialData);
  const published = normalizeArchiveData(publishedData);
  let selectedId = data.blocks[0]?.id || "";
  let drag = null;

  const canvas = () => studio.querySelector("[data-archive-canvas]");
  const selected = () => data.blocks.find((block) => block.id === selectedId);
  const status = (message) => { const node = studio.querySelector("[data-save-status]"); if (node) node.textContent = message; };

  const persist = () => {
    data = normalizeArchiveData(data);
    saveDraft(data);
    syncArchiveFontStylesheet(data);
    status("이 브라우저에 자동 저장됨");
  };

  const renderCanvas = () => {
    const board = studio.querySelector(".archive-studio__board");
    board.innerHTML = archiveCanvasMarkup(data, { editing: true });
    const element = selectedId ? board.querySelector(`[data-block-id="${CSS.escape(selectedId)}"]`) : null;
    element?.classList.add("is-selected");
  };

  const renderLayers = () => {
    const list = studio.querySelector("[data-layer-list]");
    list.innerHTML = [...data.blocks].sort((a, b) => b.z - a.z).map((block) => `<button class="studio-layer ${block.id === selectedId ? "is-active" : ""}" data-select="${escapeHTML(block.id)}" type="button"><span>${escapeHTML(block.type)}</span>${escapeHTML(block.name)}</button>`).join("") || "<p class=\"studio-muted\">아직 레이어가 없어요.</p>";
  };

  const renderInspector = () => {
    const inspector = studio.querySelector("[data-inspector]");
    const block = selected();
    inspector.innerHTML = block ? inspectorMarkup(block) : '<div class="inspector-empty"><span>NO SELECTION</span><p>요소를 선택하면 위치·폰트·색상·반복을 바꿀 수 있어요.</p></div>';
  };

  const renderSelection = () => {
    renderCanvas();
    renderLayers();
    renderInspector();
  };

  const selectBlock = (id) => {
    selectedId = id;
    renderSelection();
  };

  studio.addEventListener("click", async (event) => {
    const add = event.target.closest("[data-add]");
    if (add) {
      const block = defaultBlock(add.dataset.add, data);
      data.blocks.push(block);
      selectedId = block.id;
      persist();
      renderSelection();
      return;
    }
    const layer = event.target.closest("[data-select]");
    if (layer) { selectBlock(layer.dataset.select); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const block = selected();
    if (action === "delete" && block) {
      data.blocks = data.blocks.filter((item) => item.id !== block.id);
      selectedId = data.blocks.at(-1)?.id || "";
      persist(); renderSelection();
    } else if (action === "duplicate" && block) {
      const copy = normalizeBlock({ ...clone(block), id: `${block.type}-${Date.now().toString(36)}`, name: `${block.name} copy`, x: block.x + 24, y: block.y + 24, z: Math.max(0, ...data.blocks.map((item) => item.z)) + 1 }, data.blocks.length);
      data.blocks.push(copy); selectedId = copy.id; persist(); renderSelection();
    } else if ((action === "front" || action === "back") && block) {
      block.z = action === "front" ? Math.max(0, ...data.blocks.map((item) => item.z)) + 1 : Math.max(0, Math.min(...data.blocks.map((item) => item.z)) - 1);
      persist(); renderSelection();
    } else if (action === "pick-image" && block?.type === "image") {
      studio.querySelector("[data-image-picker]").click();
    } else if (action === "upload-media" || action === "upload-video") {
      window.open(GITHUB_MEDIA_UPLOAD_URL, "_blank", "noopener");
      status("업로드 후 /media/파일명을 ‘업로드 파일 경로’에 입력하세요");
    } else if (action === "preview") {
      window.open("?view=archive&draft=1", "_blank", "noopener");
    } else if (action === "download") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "archive.json"; link.click(); URL.revokeObjectURL(link.href);
    } else if (action === "publish") {
      window.open(GITHUB_EDIT_URL, "_blank", "noopener");
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        status("복사 완료 — 열린 GitHub에서 전체 붙여넣고 Commit changes");
      } catch (error) {
        status("JSON 저장 버튼으로 파일을 받은 뒤 GitHub에서 교체하세요");
      }
    }
  });

  studio.addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]");
    if (!input) return;
    const path = input.dataset.field;
    const target = path.startsWith("canvas.") ? data : selected();
    if (!target) return;
    const current = getPath(target, path);
    const value = input.type === "checkbox" ? input.checked : typeof current === "number" ? number(input.value, current) : input.value;
    setPath(target, path, value);
    persist(); renderCanvas(); renderLayers();
  });

  studio.querySelector("[data-image-picker]").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const block = selected();
    if (!file || block?.type !== "image") return;
    if (file.size > 1_500_000) {
      alert("1.5MB보다 큰 파일은 Pages CMS의 Media에 올린 뒤 /media/파일명 경로를 붙여주세요.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { block.src = String(reader.result); persist(); renderSelection(); };
    reader.readAsDataURL(file);
  });

  studio.addEventListener("pointerdown", (event) => {
    const blockElement = event.target.closest(".canvas-block");
    if (!blockElement || !canvas()?.contains(blockElement)) return;
    event.preventDefault();
    selectedId = blockElement.dataset.blockId;
    const block = selected();
    blockElement.setPointerCapture?.(event.pointerId);
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: block.x, y: block.y, width: block.width, height: block.height, resize: Boolean(event.target.closest("[data-resize]")) };
    canvas()?.querySelectorAll(".is-selected").forEach((element) => element.classList.remove("is-selected"));
    renderLayers(); renderInspector(); blockElement.classList.add("is-selected");
  });

  studio.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const block = selected();
    if (!block) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const snap = (value) => Math.round(value / data.canvas.grid) * data.canvas.grid;
    if (drag.resize) {
      block.width = Math.max(24, snap(drag.width + dx));
      block.height = Math.max(24, snap(drag.height + dy));
    } else {
      block.x = snap(drag.x + dx);
      block.y = snap(drag.y + dy);
    }
    const element = canvas()?.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`);
    if (element) element.setAttribute("style", commonStyle(block));
    status("편집 중…");
  });

  const finishDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null; persist(); renderInspector();
  };
  studio.addEventListener("pointerup", finishDrag);
  studio.addEventListener("pointercancel", finishDrag);

  const handleKeydown = (event) => {
    if (!selected() || /input|textarea|select/i.test(document.activeElement?.tagName || "")) return;
    if (["Backspace", "Delete"].includes(event.key)) {
      event.preventDefault();
      data.blocks = data.blocks.filter((block) => block.id !== selectedId);
      selectedId = data.blocks.at(-1)?.id || ""; persist(); renderSelection();
      return;
    }
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      selected().x += moves[event.key][0] * amount;
      selected().y += moves[event.key][1] * amount;
      persist(); renderSelection();
    }
  };
  addEventListener("keydown", handleKeydown);

  saveDraft(data);
  renderSelection();
  return () => {
    saveDraft(data);
    removeEventListener("keydown", handleKeydown);
  };
}
