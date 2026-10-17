// archive/checkpoints.js — Studio 8 (B13): 이름 붙인 저장 지점. IndexedDB에 보관하고, 안 되면 localStorage(최대 5개)로.
const DB_NAME = "psj-archive-studio";
const STORE = "checkpoints";
const LS_KEY = "psj-archive-checkpoints";
const MAX_ROWS = 30;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB 없음")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 열기 실패"));
    request.onblocked = () => reject(new Error("IndexedDB 사용 중"));
  });
}

async function withStore(mode, run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request && typeof request === "object" && "result" in request ? request.result : request); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("저장 실패")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("저장 취소")); };
  });
}

const lsList = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (error) { return []; } };
const lsWrite = (rows) => { try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); return true; } catch (error) { return false; } };
const strip = ({ json, ...row }) => row;

export async function listCheckpoints() {
  let rows = [];
  try { rows = (await withStore("readonly", (store) => store.getAll())) || []; } catch (error) { rows = lsList(); }
  return rows.map(strip).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

export async function saveCheckpoint({ name = "", data, auto = false }) {
  const json = JSON.stringify(data);
  const row = {
    id: `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(name || "").trim().slice(0, 60) || new Date().toLocaleString("ko-KR"),
    savedAt: new Date().toISOString(),
    size: json.length,
    pages: Array.isArray(data?.pages) ? data.pages.length : 0,
    blocks: (Array.isArray(data?.pages) ? data.pages.reduce((count, page) => count + (page.blocks?.length || 0), 0) : 0) + (Array.isArray(data?.globals) ? data.globals.length : 0),
    auto: Boolean(auto),
    json,
  };
  try {
    await withStore("readwrite", (store) => store.put(row));
    const all = (await withStore("readonly", (store) => store.getAll())) || [];
    const extra = all.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(MAX_ROWS);
    if (extra.length) await withStore("readwrite", (store) => { extra.forEach((item) => store.delete(item.id)); return null; });
    return { ...strip(row), storage: "indexeddb" };
  } catch (error) {
    const rows = [row, ...lsList()].slice(0, 5);
    if (!lsWrite(rows)) throw new Error("브라우저 저장 공간이 부족해 체크포인트를 저장하지 못했어요. 백업 JSON을 내려받아 두세요.");
    return { ...strip(row), storage: "localstorage" };
  }
}

export async function loadCheckpoint(id) {
  try { const row = await withStore("readonly", (store) => store.get(id)); if (row?.json) return JSON.parse(row.json); } catch (error) { /* fall through */ }
  const row = lsList().find((item) => item.id === id);
  return row?.json ? JSON.parse(row.json) : null;
}

export async function deleteCheckpoint(id) {
  try { await withStore("readwrite", (store) => store.delete(id)); } catch (error) { /* fall through */ }
  lsWrite(lsList().filter((item) => item.id !== id));
}

export const formatBytes = (bytes) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1000))}KB`;
export const formatWhen = (iso) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); };
