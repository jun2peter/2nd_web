# Claude에게 요청하는 법

## 제일 쉬운 방법: 이 폴더를 연 Claude에게 말로만

Claude 데스크톱 앱의 **Code 탭**(또는 터미널의 Claude Code)에서 `2nd_web` 폴더를 열고 하고 싶은 걸 말하면 됩니다.
Claude는 폴더를 열면 `CLAUDE.md`(이 사이트 설명서)를 먼저 읽기 때문에, 코드를 복사해 붙일 필요가 없어요.

### 좋은 요청에 들어갈 다섯 가지

1. **무엇을** — 원하는 효과. 레퍼런스 사이트 주소, 영상, 스크린샷이 있으면 같이.
2. **어디에** — 어느 페이지, 어느 레이어(Studio 레이어 이름 그대로).
3. **화면별로** — 데스크톱에서는 어떻고, 폰에서는 어떻게 (터치에는 마우스 호버가 없어요).
4. **느낌** — 속도·무게감·부드러움. 영화 용어도 좋아요: "슬로모션처럼", "컷이 끊기듯", "숨 쉬듯".
5. **언제** — 페이지 열릴 때 / 화면에 들어올 때 / 클릭·호버 / 스크롤하는 동안.

> 예: "홈 첫 화면 배경에 잉크가 번지는 셰이더 넣어줘. 마우스 따라 천천히 번지고, 폰에서는 손가락 닿은 곳에서 번져. 무겁고 느리게. 컴포넌트로 만들어서 색이랑 속도는 패널에서 바꿀 수 있게."

---

## 틀 A — 새 효과 컴포넌트 (이 폴더를 연 Claude에게)

```
components 폴더에 새 컴포넌트를 만들어줘.

- 이름: (예: ink-shader)
- 효과: (무엇이 어떻게 움직이는지)
- 레퍼런스: (주소/영상/설명)
- 마우스·손가락 반응: (데스크톱 / 폰 각각)
- 패널에서 바꾸고 싶은 값: (색, 속도, 글자, 이미지 …)
- 놓을 곳: (페이지 이름, 대략 위치와 크기)

docs/COMPONENTS.md 규칙대로 만들고 registry.js에 등록한 다음,
playground와 Studio의 기기 미리보기(폰 390px)에서 확인까지 해줘.
```

## 틀 B — 저장소를 못 보는 일반 채팅(claude.ai 등)에서 컴포넌트 받기

아래 전체를 복사해서 붙이고 `{ }` 부분만 바꾸세요. 받은 파일은 `components/` 폴더에 넣고,
`components/registry.js` 목록에 파일 이름을 추가하면 Studio에 나타납니다 (이 단계는 Code 탭 Claude에게 "이 파일 등록해줘"라고 해도 돼요).

```
정적 웹사이트 빌더용 "컴포넌트" JavaScript 파일 하나(ES module)를 만들어줘. 빌드 도구 없음, 외부 import 금지.

만들 효과: {효과 설명, 레퍼런스}
폰에서: {터치 동작}
패널에서 바꿀 값: {색, 속도 …}

형식:
export const meta = {
  name: "한국어 이름", description: "한 줄 설명", category: "background|text|media|cursor|3d|effect",
  defaultSize: { width: 800, height: 500 },
  props: [ { key, label, type, default, min, max, step, options } ]   // type: text, textarea, number, range, color, toggle, select(options: [[값, 라벨]]), image, images, url
};
export function mount(element, props, ctx) { ...; return () => { /* 정리 */ }; }   // async 가능

ctx가 주는 도구 (이것만 사용):
- ctx.createCanvas("2d" | "webgl" | "webgl2") → { canvas, context, width, height(화면 CSS px), pixelWidth, pixelHeight, dpr } (상자 크기에 자동 맞춤)
- ctx.loop((timeSeconds, deltaSeconds) => {}) → 매 프레임. 화면 밖·일시정지·동작 줄이기면 자동으로 멈춤. 직접 requestAnimationFrame 쓰지 말 것
- ctx.pointer → { x, y (상자 기준 0–1), clientX, clientY, inside, down, moved }
- ctx.scroll → { page (0–1), progress (이 상자가 화면을 지나가는 정도 0–1), velocity, y }
- ctx.size() → { width, height, screenWidth, screenHeight, dpr }
- ctx.onResize(fn), ctx.onDestroy(fn)
- await ctx.lib("three" | "gsap" | "ScrollTrigger" | "lenis") → 고정 버전 라이브러리
- ctx.asset(path) → 이미지 경로를 안전한 URL로
- ctx.layout ("desktop"|"tablet"|"mobile"), ctx.editing, ctx.reducedMotion, ctx.isTouch, ctx.paused

규칙: element 안에만 그리기(페이지 전체 효과면 body에 붙이고 정리 함수에서 제거), 터치 기기 대응,
reducedMotion이면 정지된 한 장면, 정리 함수에서 이벤트·DOM·GPU 자원 해제, 빠르게 mount.
결과는 파일 하나의 전체 코드로 줘.
```

## 틀 C — 코드 블록 (파일 없이 Studio에 바로 붙이기)

어느 채팅에서든 받을 수 있고, Studio → 요소 추가 → **코드 블록**의 HTML·CSS·JavaScript 칸에 붙이면 끝이에요.

```
웹페이지 안의 한 상자(iframe) 안에서 돌아갈 HTML / CSS / JavaScript를 각각 따로 줘.
효과: {설명}
조건:
- 상자 크기는 바뀔 수 있으니 100% 크기에 맞춰 그리기 (폰 390px 폭에서도 보기 좋게)
- 배경 투명 또는 {색}
- 페이지 스크롤과 마우스 값은 이렇게 받을 수 있음:
  archive.on("scroll", s => { s.page, s.progress (0–1), s.velocity })
  archive.on("pointer", p => { p.x, p.y (상자 기준 0–1), p.inside })
  archive.on("visibility", visible => { 화면 밖이면 false — 애니메이션 멈추기 })
- 외부 라이브러리가 필요하면 고정 버전 CDN <script src>로
```

코드 블록은 사이트와 분리된 안전한 상자에서 돌아가서, 코드가 잘못돼도 사이트 전체가 깨지지 않아요.
대신 상자 밖(페이지 전체)은 건드릴 수 없어요. 그런 효과는 틀 A·B의 컴포넌트로 만드세요.

## 틀 D — 빌더 자체에 기능 추가

```
Archive Studio에 기능을 추가해줘.
- 하고 싶은 것: {예: 레이어 여러 개를 그룹으로 묶어서 같이 움직이기}
- 지금 불편한 점: {…}
- 비슷한 도구: {Framer, Figma, Webflow 등에서 본 방식}
CLAUDE.md 규칙대로 옛 데이터가 계속 열리게 하고, 편집기·공개 사이트·폰 화면에서 모두 확인해줘.
```

## 틀 E — 있는 기능으로 연출 만들기

```
{페이지 이름} 페이지를 다듬어줘.
- 폰 배치: {예: 자동 정렬로 만든 다음, 제목을 더 크게, 작품 카드는 한 줄에 하나}
- 모션: {예: 스크롤하면 작품 이미지가 아래에서 마스크로 열리게, 소개 문단은 고정된 채 사진만 지나가게}
- 메뉴: {예: 오른쪽 위 MENU 누르면 검은 패널이 위에서 내려오고 다시 누르면 닫히게}
content/archive.json에서 이 페이지만 고치고, 기기 미리보기로 확인해줘.
```

## 문제가 생겼을 때

```
{어느 화면(주소)}에서 {무엇을 했더니} {무엇이 이상함}.
기대한 것: {…}
기기/브라우저: {예: 아이폰 사파리, 맥 크롬}
(스크린샷이나 화면 녹화가 있으면 첨부)
```
