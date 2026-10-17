// archive/studio-ui.js — Studio 8 shared editor UI: toasts, modal, command palette, shortcut sheet, empty page state.
// Pure UI: nothing here touches archive data. The editor passes callbacks in.

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

// ---------------------------------------------------------------- toasts
let toastHost = null;
let lastToast = { text: "", at: 0 };

export function toast(message, { kind = "info", duration = 2600 } = {}) {
  const text = String(message || "").trim();
  if (!text) return null;
  const now = performance.now();
  if (lastToast.text === text && now - lastToast.at < 1500) return null; // same message hammered: show once
  lastToast = { text, at: now };
  if (!toastHost || !toastHost.isConnected) {
    toastHost = document.createElement("div");
    toastHost.className = "studio-toasts";
    toastHost.setAttribute("aria-live", "polite");
    document.body.append(toastHost);
  }
  const node = document.createElement("div");
  node.className = `studio-toast studio-toast--${kind}`;
  node.textContent = text;
  toastHost.append(node);
  while (toastHost.children.length > 4) toastHost.firstElementChild.remove();
  requestAnimationFrame(() => node.classList.add("is-in"));
  const timer = setTimeout(() => { node.classList.remove("is-in"); setTimeout(() => node.remove(), 260); }, duration);
  node.addEventListener("click", () => { clearTimeout(timer); node.remove(); });
  return node;
}

// ---------------------------------------------------------------- modal
export function closeModal() {
  document.querySelector(".studio-modal")?.dispatchEvent(new CustomEvent("studio-modal-close"));
}

export function openModal({ title = "", subtitle = "", body = "", wide = false, onClose = null } = {}) {
  closeModal();
  const modal = document.createElement("div");
  modal.className = `studio-modal${wide ? " studio-modal--wide" : ""}`;
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", title);
  modal.innerHTML = `<div class="studio-modal__card"><header><div><strong>${escapeHTML(title)}</strong>${subtitle ? `<small>${escapeHTML(subtitle)}</small>` : ""}</div><button data-modal-close type="button" aria-label="닫기">✕</button></header><div class="studio-modal__body">${body}</div></div>`;
  document.body.append(modal);
  document.body.classList.add("has-studio-modal");
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    modal.remove();
    document.body.classList.remove("has-studio-modal");
    removeEventListener("keydown", onKey, true);
    onClose?.();
  };
  const onKey = (event) => { if (event.key === "Escape") { event.stopImmediatePropagation(); event.preventDefault(); close(); } };
  addEventListener("keydown", onKey, true);
  modal.addEventListener("studio-modal-close", close);
  modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest("[data-modal-close]")) close(); });
  modal.close = close;
  setTimeout(() => modal.querySelector("input:not([type=hidden]), textarea, select, button:not([data-modal-close])")?.focus?.(), 0);
  return modal;
}

// ---------------------------------------------------------------- command palette
const RECENT_KEY = "psj-studio-palette-recent";

export function closePalette() { document.querySelector(".studio-palette")?.remove(); }

// commands: [{ id, group, label, hint?, keys?, keywords?, run }]
export function openCommandPalette({ commands = [], placeholder = "무엇을 할까요? 요소 추가 · 페이지 · 동작 검색" } = {}) {
  closePalette();
  const root = document.createElement("div");
  root.className = "studio-palette";
  root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "명령 팔레트");
  root.innerHTML = `<div class="studio-palette__card"><input type="search" placeholder="${escapeHTML(placeholder)}" aria-label="명령 검색" autocomplete="off" spellcheck="false"><div class="studio-palette__list" role="listbox"></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> 이동</span><span><kbd>Enter</kbd> 실행</span><span><kbd>Esc</kbd> 닫기</span></footer></div>`;
  document.body.append(root);
  const input = root.querySelector("input");
  const list = root.querySelector(".studio-palette__list");
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (error) { recent = []; }
  let items = [];
  let active = 0;

  const score = (command, query) => {
    const label = command.label.toLowerCase();
    const extra = `${command.group || ""} ${command.hint || ""} ${command.keywords || ""}`.toLowerCase();
    if (label.startsWith(query)) return 4;
    if (label.includes(query)) return 3;
    if (query.split(/\s+/).every((part) => label.includes(part) || extra.includes(part))) return 2;
    if (extra.includes(query)) return 1;
    return 0;
  };
  const render = () => {
    const query = input.value.trim().toLowerCase();
    const scored = commands
      .map((command, index) => ({ command, index, score: query ? score(command, query) : 1 }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (query) return b.score - a.score || a.index - b.index;
        const ra = recent.indexOf(a.command.id); const rb = recent.indexOf(b.command.id);
        if (ra !== rb) { if (ra === -1) return 1; if (rb === -1) return -1; return ra - rb; }
        return a.index - b.index;
      });
    items = scored.slice(0, 48).map((entry) => entry.command);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = items.map((command, index) => `<button data-palette-index="${index}" class="${index === active ? "is-active" : ""}" role="option" aria-selected="${index === active}" type="button"><em>${escapeHTML(command.group || "")}</em><span>${escapeHTML(command.label)}${command.hint ? `<small>${escapeHTML(command.hint)}</small>` : ""}</span>${command.keys ? `<kbd>${escapeHTML(command.keys)}</kbd>` : ""}${!query && recent.includes(command.id) ? '<i title="최근 사용">●</i>' : ""}</button>`).join("")
      || '<p class="studio-palette__empty">맞는 명령이 없어요 · 다른 말로 찾아보세요</p>';
    list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  };
  const run = (index) => {
    const command = items[index];
    if (!command) return;
    recent = [command.id, ...recent.filter((id) => id !== command.id)].slice(0, 8);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (error) { /* storage full: ignore */ }
    closePalette();
    try { command.run(); } catch (error) { console.error("Palette command failed.", error); toast("명령을 실행하지 못했어요", { kind: "error" }); }
  };
  input.addEventListener("input", () => { active = 0; render(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); active = Math.max(0, active - 1); render(); }
    else if (event.key === "Enter") { event.preventDefault(); run(active); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePalette(); }
  });
  list.addEventListener("click", (event) => { const button = event.target.closest("[data-palette-index]"); if (button) run(Number(button.dataset.paletteIndex)); });
  list.addEventListener("pointermove", (event) => { const button = event.target.closest("[data-palette-index]"); if (button && Number(button.dataset.paletteIndex) !== active) { active = Number(button.dataset.paletteIndex); list.querySelectorAll(".is-active").forEach((node) => node.classList.remove("is-active")); button.classList.add("is-active"); } });
  root.addEventListener("pointerdown", (event) => { if (event.target === root) closePalette(); });
  render();
  input.focus();
  return root;
}

// ---------------------------------------------------------------- shortcut sheet
const SHORTCUTS = [
  ["선택", [["클릭 · Shift+클릭", "선택 · 더하기/빼기"], ["빈 곳 드래그", "사각형으로 묶어 선택 (Shift: 더하기)"], ["Ctrl+A", "모두 선택"], ["Esc", "선택 해제 · 창 닫기"], ["Tab 키 없이 레이어 패널 클릭", "숨은 요소 선택"]]],
  ["편집", [["Enter · 더블클릭", "글자 바로 편집 (Ctrl+Enter 끝)"], ["Ctrl+D", "복제"], ["Delete · Backspace", "삭제"], ["Ctrl+C · X · V", "복사 · 잘라내기 · 붙여넣기 (다른 페이지·탭에서도)"], ["Alt+드래그", "복제하며 옮기기"], ["Shift+드래그", "가로·세로 한 축으로만"], ["Shift+핸들", "비율 고정 · Alt: 가운데 기준"], ["방향키 · Shift+방향키", "1px · 10px 이동"]]],
  ["순서 · 상태", [["Ctrl+] · Ctrl+[", "한 칸 앞 · 뒤"], ["Ctrl+Shift+] · [", "맨 앞 · 맨 뒤"], ["Ctrl+Shift+L", "잠금 / 해제"], ["Ctrl+Shift+H", "숨기기 / 표시"], ["우클릭", "메뉴 (복제·정렬·이름·전역…)"]]],
  ["보기", [["Ctrl+휠 · 핀치", "연속 줌"], ["Ctrl+0", "화면 맞춤"], ["Ctrl+= · Ctrl+-", "단계 줌"], ["Ctrl+R", "눈금자 · 가이드 켜기/끄기"], ["Ctrl+'", "컬럼 그리드 켜기/끄기"]]],
  ["도구", [["Ctrl+K", "명령 팔레트"], ["?", "이 단축키 표"], ["Ctrl+Z · Ctrl+Shift+Z", "실행 취소 · 다시 실행"], ["Ctrl+Shift+S", "체크포인트 저장"], ["Ctrl+Shift+P", "게시 창"]]],
];

export function shortcutSheetMarkup() {
  return `<div class="studio-shortcuts">${SHORTCUTS.map(([group, rows]) => `<section><h4>${escapeHTML(group)}</h4><dl>${rows.map(([keys, what]) => `<div><dt>${keys.split(" · ").map((key) => `<kbd>${escapeHTML(key)}</kbd>`).join("<span>·</span>")}</dt><dd>${escapeHTML(what)}</dd></div>`).join("")}</dl></section>`).join("")}</div><p class="studio-help">Mac에서는 Ctrl 대신 ⌘를 누르세요. 입력칸에 커서가 있을 때는 글자 입력이 우선이에요.</p>`;
}

// ---------------------------------------------------------------- empty page
export function emptyStateMarkup() {
  return `<div class="studio-empty" data-studio-empty><div><span>EMPTY PAGE</span><h3>아직 빈 페이지예요</h3><p>왼쪽 <b>요소 추가</b>에서 고르거나, 사진·영상 파일을 이 캔버스로 끌어다 놓으세요.<br>섹션 템플릿으로 시작하면 가장 빨라요.</p><div class="studio-empty__actions"><button class="is-primary" data-action="open-templates" type="button">▤ 섹션 템플릿</button><button data-add="text" type="button">T 텍스트</button><button data-add="image" type="button">▧ 이미지</button><button data-action="command-palette" type="button">⌘K 명령 팔레트</button></div></div></div>`;
}

// ---------------------------------------------------------------- small helpers other modules reuse
export { escapeHTML as escapeUIText };
