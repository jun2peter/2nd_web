// archive/templates.js — Studio 8 (B16): 섹션·페이지 템플릿. 순수 데이터 빌더.
// build({ width, y }) → { height, blocks: [블록 명세...] } — 편집기가 id·z를 붙이고 normalizeBlock을 거쳐 넣는다.
const FONT = "Arial, sans-serif";

const text = (over) => ({ type: "text", htmlTag: "p", fontFamily: FONT, fontSize: 18, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0, textAlign: "left", color: "#111111", background: "transparent", ...over });
const image = (over) => ({ type: "image", src: "", alt: "교체할 이미지", objectFit: "cover", borderRadius: 0, background: "#ededed", hoverEffect: "zoom", ...over });
const button = (over) => ({ type: "button", content: "버튼", fontFamily: FONT, fontSize: 15, fontWeight: 600, color: "#ffffff", background: "#111111", borderRadius: 999, padding: 16, width: 200, height: 56, textAlign: "center", ...over });
const line = (over) => ({ type: "line", background: "#111111", height: 1, ...over });

// 콘텐츠 열: 최대 1120px, 좌우 여백 80px 이상
const column = (width) => { const content = Math.min(1120, width - 160); return { W: width, C: content, L: Math.round((width - content) / 2) }; };
const titleSize = (content, ratio, min, max) => Math.max(min, Math.min(max, Math.round(content * ratio)));

export const SECTION_TEMPLATES = [
  {
    id: "hero-title", name: "히어로 · 큰 제목", category: "시작", description: "작은 라벨 + 두 줄 제목 + 소개 문장 + 버튼",
    build({ width, y }) {
      const { C, L } = column(width); const size = titleSize(C, 0.11, 56, 150);
      return { height: 760, blocks: [
        text({ name: "라벨", x: L, y: y + 140, width: Math.round(C * 0.5), height: 28, content: "PORTFOLIO · 2026", fontSize: 13, letterSpacing: 3, color: "#666666", fontWeight: 600 }),
        text({ name: "큰 제목", htmlTag: "h1", x: L, y: y + 200, width: C, height: Math.round(size * 2.1), content: "작품과 연구를\n한 곳에 모았습니다", fontSize: size, fontWeight: 800, lineHeight: 0.98, letterSpacing: -2 }),
        text({ name: "소개 문장", x: L, y: y + 220 + Math.round(size * 2.1), width: Math.round(C * 0.6), height: 90, content: "두 줄 정도의 소개 문장을 적어 보세요. 무엇을 만들고, 어떤 질문을 따라가는지.", fontSize: 20, lineHeight: 1.6, color: "#444444" }),
        button({ name: "주요 버튼", x: L, y: y + 340 + Math.round(size * 2.1), content: "작품 보기", width: 180 }),
      ] };
    },
  },
  {
    id: "hero-media", name: "히어로 · 이미지 배경", category: "시작", description: "화면을 채우는 이미지 위에 흰 제목",
    build({ width, y }) {
      const { C, L } = column(width); const size = titleSize(C, 0.085, 48, 120);
      return { height: 820, blocks: [
        image({ name: "히어로 이미지", x: 0, y, width, height: 820, hoverEffect: "none", grayscale: 0, brightness: 0.85, focalY: 40 }),
        text({ name: "라벨", x: L, y: y + 820 - size - 190, width: Math.round(C * 0.5), height: 26, content: "WORK · 2026", fontSize: 13, letterSpacing: 3, color: "#ffffff", fontWeight: 600 }),
        text({ name: "제목", htmlTag: "h1", x: L, y: y + 820 - size - 150, width: C, height: Math.round(size * 1.2), content: "제목을 입력하세요", fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: -1.5, color: "#ffffff" }),
      ] };
    },
  },
  {
    id: "intro", name: "소개 · 사진 + 글", category: "콘텐츠", description: "왼쪽 세로 사진, 오른쪽 제목·본문·버튼",
    build({ width, y }) {
      const { C, L } = column(width); const half = Math.round(C * 0.5); const photo = Math.round(C * 0.42);
      return { height: 780, blocks: [
        image({ name: "프로필 사진", x: L, y: y + 40, width: photo, height: 680, borderRadius: 6 }),
        text({ name: "소제목", htmlTag: "h2", x: L + half, y: y + 80, width: half, height: 120, content: "안녕하세요,\n박승준입니다", fontSize: 44, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }),
        text({ name: "본문", x: L + half, y: y + 240, width: half, height: 200, content: "로보틱 설치, 무빙 이미지, AI 영화, 한국 금속 상감을 오가며 작업합니다.\n\n세 문장 정도로 지금 하는 일과 관심을 적어 보세요. 길면 두 단락으로 나눠도 좋아요.", fontSize: 17, lineHeight: 1.75, color: "#333333" }),
        button({ name: "보조 버튼", x: L + half, y: y + 500, content: "이력서 받기", background: "transparent", color: "#111111", borderWidth: 1, borderColor: "#111111", width: 170 }),
      ] };
    },
  },
  {
    id: "grid-2", name: "이미지 2열", category: "미디어", description: "큰 사진 두 장과 캡션",
    build({ width, y }) {
      const { C, L } = column(width); const gap = 32; const card = Math.round((C - gap) / 2);
      const cardAt = (index) => { const x = L + index * (card + gap); return [
        image({ name: `사진 ${index + 1}`, x, y: y + 40, width: card, height: Math.round(card * 0.75) }),
        text({ name: `제목 ${index + 1}`, x, y: y + 60 + Math.round(card * 0.75), width: card, height: 26, content: "프로젝트 이름", fontSize: 16, fontWeight: 600 }),
        text({ name: `설명 ${index + 1}`, x, y: y + 88 + Math.round(card * 0.75), width: card, height: 22, content: "2026 · 매체 · 장소", fontSize: 13, color: "#666666" }),
      ]; };
      return { height: 160 + Math.round(card * 0.75), blocks: [...cardAt(0), ...cardAt(1)] };
    },
  },
  {
    id: "grid-3", name: "이미지 3열", category: "미디어", description: "카드 세 장 · 썸네일 그리드",
    build({ width, y }) {
      const { C, L } = column(width); const gap = 28; const card = Math.round((C - gap * 2) / 3);
      const blocks = [];
      for (let index = 0; index < 3; index += 1) {
        const x = L + index * (card + gap);
        blocks.push(image({ name: `카드 ${index + 1}`, x, y: y + 40, width: card, height: Math.round(card * 1.1), borderRadius: 4 }));
        blocks.push(text({ name: `카드 제목 ${index + 1}`, x, y: y + 58 + Math.round(card * 1.1), width: card, height: 24, content: "프로젝트 이름", fontSize: 15, fontWeight: 600 }));
        blocks.push(text({ name: `카드 설명 ${index + 1}`, x, y: y + 84 + Math.round(card * 1.1), width: card, height: 20, content: "2026 · 매체", fontSize: 12, color: "#666666" }));
      }
      return { height: 150 + Math.round(card * 1.1), blocks };
    },
  },
  {
    id: "project-list", name: "프로젝트 목록 · 호버 리빌", category: "미디어", description: "제목 줄에 마우스를 올리면 사진이 따라오는 목록",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 560, blocks: [
        text({ name: "목록 라벨", x: L, y: y + 40, width: C, height: 24, content: "SELECTED WORKS", fontSize: 12, letterSpacing: 3, color: "#666666", fontWeight: 600 }),
        { type: "component", component: "hover-reveal", props: null, name: "프로젝트 목록", x: L, y: y + 90, width: C, height: 440 },
      ] };
    },
  },
  {
    id: "quote", name: "인용 문장", category: "콘텐츠", description: "가운데 정렬된 큰 문장과 출처",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 420, blocks: [
        text({ name: "인용", x: L, y: y + 110, width: C, height: 150, content: "“만드는 과정이 곧 작품입니다.”", fontSize: titleSize(C, 0.036, 26, 44), fontWeight: 500, lineHeight: 1.3, textAlign: "center", letterSpacing: -0.5 }),
        text({ name: "출처", x: L, y: y + 290, width: C, height: 24, content: "— 이름, 소속", fontSize: 14, color: "#666666", textAlign: "center" }),
      ] };
    },
  },
  {
    id: "contact", name: "연락처", category: "마무리", description: "제목 · 이메일 버튼 · SNS 링크",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 520, blocks: [
        text({ name: "연락 제목", htmlTag: "h2", x: L, y: y + 80, width: C, height: 80, content: "함께 만들어요", fontSize: titleSize(C, 0.05, 36, 64), fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }),
        text({ name: "연락 설명", x: L, y: y + 180, width: Math.round(C * 0.6), height: 60, content: "프로젝트·전시·협업 제안을 기다립니다.", fontSize: 18, lineHeight: 1.6, color: "#444444" }),
        button({ name: "이메일 버튼", x: L, y: y + 262, content: "이메일 보내기", width: 190, action: { type: "email", email: "hello@example.com" } }),
        text({ name: "Instagram 링크", x: L, y: y + 360, width: 180, height: 24, content: "Instagram ↗", fontSize: 14, fontWeight: 600, action: { type: "external", url: "https://instagram.com/", newTab: true } }),
        text({ name: "Vimeo 링크", x: L + 190, y: y + 360, width: 180, height: 24, content: "Vimeo ↗", fontSize: 14, fontWeight: 600, action: { type: "external", url: "https://vimeo.com/", newTab: true } }),
        line({ name: "구분선", x: L, y: y + 440, width: C }),
      ] };
    },
  },
  {
    id: "gallery-slideshow", name: "슬라이드쇼", category: "미디어", description: "화면 폭 갤러리 슬라이드쇼 (사진 3장 자리)",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 720, blocks: [
        { type: "gallery", name: "슬라이드쇼", x: L, y: y + 40, width: C, height: 640, galleryMode: "slideshow", galleryItems: [{ src: "", alt: "사진 1", caption: "" }, { src: "", alt: "사진 2", caption: "" }, { src: "", alt: "사진 3", caption: "" }], galleryInterval: 3500, objectFit: "cover" },
      ] };
    },
  },
  {
    id: "compare", name: "비포 / 애프터", category: "미디어", description: "두 이미지를 분할선으로 비교",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 700, blocks: [
        { type: "component", component: "compare-slider", props: null, name: "비포 애프터", x: L, y: y + 40, width: C, height: 560 },
        text({ name: "비교 설명", x: L, y: y + 620, width: C, height: 24, content: "왼쪽 원본 · 오른쪽 보정 — 가운데 선을 끌어 보세요", fontSize: 13, color: "#666666", textAlign: "center" }),
      ] };
    },
  },
  {
    id: "band", name: "흐르는 띠 문구", category: "콘텐츠", description: "선 사이를 지나가는 반복 글자",
    build({ width, y }) {
      return { height: 170, blocks: [
        line({ name: "위 선", x: 0, y: y + 24, width }),
        { type: "marquee", name: "띠 문구", x: 0, y: y + 44, width, height: 80, content: "NEW WORK — 2026 — EXHIBITION — RESEARCH —", fontFamily: FONT, fontSize: 48, fontWeight: 700, letterSpacing: -1, color: "#111111", speed: 24, direction: "left" },
        line({ name: "아래 선", x: 0, y: y + 144, width }),
      ] };
    },
  },
  {
    id: "footer", name: "푸터", category: "마무리", description: "구분선 · 페이지 메뉴 · 저작권",
    build({ width, y }) {
      const { C, L } = column(width);
      return { height: 220, blocks: [
        line({ name: "푸터 선", x: L, y: y + 20, width: C }),
        { type: "nav", name: "푸터 메뉴", x: L, y: y + 56, width: Math.round(C * 0.6), height: 44, navMode: "listed", fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "#111111", navGap: 24, navActiveStyle: "underline" },
        text({ name: "저작권", x: L, y: y + 140, width: Math.round(C * 0.6), height: 22, content: "© 2026 PARK SEUNGJUN. All rights reserved.", fontSize: 12, color: "#666666" }),
        text({ name: "크레딧", x: L + C - 280, y: y + 140, width: 280, height: 22, content: "Made with Archive Studio", fontSize: 12, color: "#666666", textAlign: "right" }),
      ] };
    },
  },
];

export const PAGE_TEMPLATES = [
  { id: "home", name: "포트폴리오 홈", description: "큰 제목 → 카드 3열 → 프로젝트 목록 → 띠 문구 → 연락처 → 푸터", sections: ["hero-title", "grid-3", "project-list", "band", "contact", "footer"] },
  { id: "about", name: "소개 (About)", description: "사진+글 → 인용 → 이미지 2열 → 연락처 → 푸터", sections: ["intro", "quote", "grid-2", "contact", "footer"] },
  { id: "project", name: "프로젝트 상세", description: "이미지 히어로 → 문장 → 이미지 2열 → 비포/애프터 → 슬라이드쇼 → 푸터", sections: ["hero-media", "quote", "grid-2", "compare", "gallery-slideshow", "footer"] },
  { id: "contact", name: "연락처 페이지", description: "연락처 → 푸터", sections: ["contact", "footer"] },
];

export function sectionTemplate(id) { return SECTION_TEMPLATES.find((item) => item.id === id) || null; }

// 템플릿 카드용 미니 스케치: 1440 기준으로 지어서 비율 좌표(%)로 바꾼다.
export function sectionSketch(id) {
  const template = sectionTemplate(id);
  if (!template) return [];
  const width = 1440; const built = template.build({ width, y: 0 });
  return built.blocks.map((block) => ({ kind: block.type, left: block.x / width * 100, top: block.y / built.height * 100, width: block.width / width * 100, height: block.height / built.height * 100 }));
}
