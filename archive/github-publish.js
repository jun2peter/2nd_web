// archive/github-publish.js — Studio 8 (B12): GitHub Contents API로 archive.json과 미디어를 바로 커밋.
// 토큰은 이 브라우저(localStorage)에만 저장되고 저장소로는 절대 나가지 않는다. 권장: fine-grained 토큰, 이 저장소만, Contents 읽기·쓰기.
const TOKEN_KEY = "psj-archive-github-token";
const REPO_KEY = "psj-archive-github-repo";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function parseRepoFromEditURL(url) {
  const match = /github\.com\/([^/]+)\/([^/]+)\/edit\/([^/]+)\/(.+)$/.exec(String(url || ""));
  return match ? { owner: match[1], repo: match[2], branch: match[3], path: match[4] } : null;
}

export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (error) { return ""; } }
export function setToken(token) { try { if (token && token.trim()) localStorage.setItem(TOKEN_KEY, token.trim()); else localStorage.removeItem(TOKEN_KEY); } catch (error) { /* ignore */ } }
export function getRepoConfig(defaults = {}) { try { return { ...defaults, ...JSON.parse(localStorage.getItem(REPO_KEY) || "{}") }; } catch (error) { return { ...defaults }; } }
export function setRepoConfig(config) { try { localStorage.setItem(REPO_KEY, JSON.stringify(config)); } catch (error) { /* ignore */ } }

function describeError(status, json) {
  const message = json?.message || "";
  if (status === 401) return "토큰이 올바르지 않거나 만료됐어요 (401). 새 토큰을 붙여넣으세요.";
  if (status === 403) return /rate limit/i.test(message) ? "GitHub 요청 한도에 걸렸어요. 잠시 후 다시 시도하세요." : "이 저장소에 쓸 권한이 없어요 (403). 토큰 권한에 Contents 읽기·쓰기가 있는지 확인하세요.";
  if (status === 404) return "저장소·브랜치·파일을 찾지 못했어요 (404). 소유자/저장소/브랜치 이름과 토큰의 저장소 범위를 확인하세요.";
  if (status === 409) return "방금 같은 파일이 바뀌었어요 (409). 다시 시도하면 최신 버전 위에 올라가요.";
  if (status === 422) return `GitHub가 요청을 거절했어요 (422). ${message}`;
  return `GitHub 오류 ${status}${message ? ` · ${message}` : ""}`;
}

async function api(path, { method = "GET", body = null, token = "" } = {}) {
  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) { throw new Error("GitHub에 연결하지 못했어요. 인터넷 연결을 확인하세요."); }
  let json = null;
  try { json = await response.json(); } catch (error) { json = null; }
  if (!response.ok) { const error = new Error(describeError(response.status, json)); error.status = response.status; error.payload = json; throw error; }
  return json;
}

const encodePath = (path) => String(path).replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  return btoa(binary);
}
export const encodeText = (text) => bytesToBase64(new TextEncoder().encode(String(text)));
export async function encodeFile(file) { return bytesToBase64(new Uint8Array(await file.arrayBuffer())); }

export async function checkConnection({ owner, repo, branch, token }) {
  const user = await api("/user", { token });
  const repository = await api(`/repos/${owner}/${repo}`, { token });
  let branchOk = true;
  try { await api(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`, { token }); } catch (error) { branchOk = false; }
  return { login: user.login, canPush: Boolean(repository.permissions?.push || repository.permissions?.admin), isPrivate: Boolean(repository.private), defaultBranch: repository.default_branch, branchOk };
}

// 파일의 sha(있으면)만 가져온다. 큰 파일도 메타데이터는 돌아온다.
export async function fetchFileMeta({ owner, repo, branch, path, token }) {
  try {
    const json = await api(`/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, { token });
    return json && json.type === "file" ? { sha: json.sha, size: json.size, htmlURL: json.html_url } : null;
  } catch (error) { if (error.status === 404) return null; throw error; }
}

export async function putFile({ owner, repo, branch, path, token, message, content, sha = "" }) {
  const body = { message, branch, content };
  if (sha) body.sha = sha;
  const json = await api(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, { method: "PUT", body, token });
  return { sha: json.content?.sha || "", commitSha: json.commit?.sha || "", commitURL: json.commit?.html_url || "", fileURL: json.content?.html_url || "" };
}

export async function publishArchive({ config, token, json, message = "Publish archive.json (Archive Studio)" }) {
  const existing = await fetchFileMeta({ ...config, token });
  return putFile({ ...config, token, message, content: encodeText(json), sha: existing?.sha || "" });
}

export function mediaPathForFile(file, folder = "media") { return `${folder}/${file.name.replace(/[^\w.-]+/g, "-")}`; }

export async function uploadMedia({ config, token, file, folder = "media", onProgress = null }) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}은(는) ${Math.round(file.size / 1024 / 1024)}MB라서 너무 커요 (최대 25MB). 영상은 YouTube·Vimeo 링크를 권장해요.`);
  const path = mediaPathForFile(file, folder);
  onProgress?.("encoding");
  const content = await encodeFile(file);
  const existing = await fetchFileMeta({ ...config, path, token });
  onProgress?.("uploading");
  const result = await putFile({ ...config, path, token, message: `Upload ${path} (Archive Studio)`, content, sha: existing?.sha || "" });
  return { path: `/${path}`, replaced: Boolean(existing), ...result };
}
