# 커스텀 컴포넌트 만들기

Archive Studio의 기본 요소(텍스트·이미지·영상…)로 안 되는 효과는 **컴포넌트**로 만듭니다.
컴포넌트 = `components/` 폴더의 JavaScript 파일 하나. 한 번 넣으면 Studio의 **요소 추가 → 컴포넌트**에 나타나고,
색·속도·글자 같은 값은 오른쪽 패널에서 바로 바꿀 수 있습니다.

더 가볍게 붙이고 싶다면 **코드 블록**(HTML/CSS/JS를 Studio에 직접 붙여넣기)을 쓰세요. 아래 「코드 블록」 참고.

## 파일 하나의 모양

```js
// components/my-effect.js
export const meta = {
  name: "보이는 이름",                 // Studio 목록에 표시
  description: "한 줄 설명",
  category: "background",            // background · text · media · cursor · 3d · effect
  defaultSize: { width: 800, height: 500 },  // 처음 추가될 때 크기 (데스크톱 px)
  runsWhenReduced: false,            // 방문자가 '동작 줄이기'를 켜도 계속 움직일지
  runsOffscreen: false,              // 상자가 화면 밖이어도 계속 실행 (커서처럼 페이지 전체에 그리는 효과만 true)
  props: [                           // 오른쪽 패널에 생기는 입력칸
    { key: "color", label: "색", type: "color", default: "#ff5a36" },
    { key: "speed", label: "속도", type: "range", min: 0, max: 3, step: 0.1, default: 1 },
    { key: "title", label: "문구", type: "text", default: "Hello" },
    { key: "photo", label: "이미지", type: "image", default: "" },
    { key: "photos", label: "이미지 여러 장(한 줄에 하나)", type: "images", default: [] },
    { key: "mode", label: "모드", type: "select", options: [["soft", "부드럽게"], ["hard", "강하게"]], default: "soft" },
    { key: "follow", label: "마우스 따라가기", type: "toggle", default: true },
  ],
};

export function mount(element, props, ctx) {
  // element: 이 컴포넌트가 그릴 상자 (Studio에서 정한 위치·크기)
  // props: 위 meta.props 값 (타입이 맞춰져서 들어옴)
  // ctx: 아래 도구 모음
  const surface = ctx.createCanvas("2d");
  ctx.loop((time, delta) => {
    const g = surface.context;
    g.clearRect(0, 0, surface.width, surface.height);
    // ...
  });
  return () => { /* 정리: 이벤트 해제, 외부 객체 dispose */ };
}
```

그리고 `components/registry.js`의 목록에 파일 이름(확장자 없이)을 추가합니다. 목록에 없는 파일은 실행되지 않습니다.

## prop 타입

| type | 패널 입력 | 값 |
|---|---|---|
| `text`, `textarea`, `url` | 글자칸 | 문자열 |
| `number`, `range` | 숫자칸 / 슬라이더 (`min`·`max`·`step`) | 숫자 |
| `color` | 색 고르기 | `#rrggbb` |
| `toggle` | 체크박스 | true/false |
| `select` | 드롭다운 (`options: [[값, 라벨], …]`) | 문자열 |
| `image` | 이미지 경로·링크 | 문자열 → `ctx.asset(값)`으로 URL 만들기 |
| `images` | 한 줄에 하나씩 | 문자열 배열 |

## ctx 도구

| 이름 | 하는 일 |
|---|---|
| `ctx.createCanvas("2d" \| "webgl" \| "webgl2")` | 상자를 꽉 채우는 캔버스. 크기·화면 배율을 자동으로 맞춤. 돌려받는 `surface`: `canvas`, `context`, `width`/`height`(화면 CSS px), `pixelWidth`/`pixelHeight`, `dpr` |
| `ctx.loop((time, delta) => {})` | 매 프레임 실행. **화면 밖·일시정지·탭 숨김·동작 줄이기**일 때 자동으로 멈춤. 해제 함수를 돌려줌 |
| `ctx.pointer` | `{ x, y }`(상자 기준 0–1), `clientX`, `clientY`, `inside`, `inWindow`(마우스가 창 안에 있는지), `down`, `moved` |
| `ctx.scroll` | `{ page }`(페이지 전체 0–1), `progress`(이 상자가 화면을 지나가는 정도 0–1), `velocity`, `y` |
| `ctx.size()` | `{ width, height }`(배치 크기), `screenWidth`, `screenHeight`(실제 화면 크기), `dpr` |
| `ctx.onResize(fn)` | 크기가 바뀔 때 (화면 회전, 폰↔데스크톱 레이아웃 전환 포함) |
| `ctx.onDestroy(fn)` | 페이지를 떠날 때 |
| `ctx.lib("three" \| "gsap" \| "ScrollTrigger" \| "lenis")` | 버전이 고정된 외부 라이브러리를 불러옴 (`await`) |
| `ctx.asset(path)` | `/media/a.jpg` 같은 경로를 안전한 URL로 |
| `ctx.layout` | 지금 화면의 레이아웃: `desktop` · `tablet` · `mobile` |
| `ctx.editing` | Studio 편집 화면 안에서 실행 중이면 true (무거운 효과는 줄이기) |
| `ctx.reducedMotion`, `ctx.isTouch`, `ctx.paused` | 접근성·터치 기기·방문자 모션 정지 상태 |

`mount`는 정리 함수를 돌려주거나 `{ destroy(), resize(size), visibility(isVisible), paused(isPaused) }` 객체를 돌려줄 수 있습니다.
`paused`는 방문자가 "Pause motion"을 누르거나 다시 켤 때 불립니다.
`async function mount`도 됩니다 (라이브러리를 기다릴 때).

## 지켜야 할 규칙

1. **혼자 동작하기**: 다른 파일을 import 하지 말고, 외부 라이브러리는 `ctx.lib`로만 불러오세요. 새 라이브러리가 필요하면 `archive/components-host.js`의 `LIBRARIES`에 고정 버전 URL을 추가합니다.
2. **상자 안에서 그리기**: 기본은 `element` 안. 화면 전체 효과(커서 등)가 꼭 필요할 때만 `document.body`에 붙이고, 정리 함수에서 반드시 제거합니다.
3. **폰에서도**: 터치에는 hover가 없습니다. `ctx.pointer.down`이나 `ctx.scroll`로 대체 동작을 주세요. 폰에서 무거우면 `ctx.size().dpr`을 낮추거나 입자 수를 줄이세요.
4. **멈출 줄 알기**: 애니메이션은 꼭 `ctx.loop`로 돌리세요. 직접 `requestAnimationFrame`을 돌리면 화면 밖에서도 배터리를 씁니다.
5. **정리하기**: 붙인 이벤트, 만든 DOM, three.js renderer(`renderer.dispose()`)는 정리 함수에서 해제합니다.
6. **편집 화면 배려**: Studio는 값을 바꿀 때마다 컴포넌트를 다시 만듭니다. `mount`는 빨라야 하고, `ctx.editing`이면 무거운 로딩을 줄여도 됩니다.

## 확인하는 법

```bash
python -m http.server 8080
```

1. `http://localhost:8080/components/playground.html?c=파일이름` 에서 혼자 띄워 값과 크기를 바꿔봅니다 (Desktop/Tablet/Mobile 버튼).
2. `?view=archive&edit=1` → 요소 추가 → 컴포넌트에서 넣어보고, 상단 **기기 미리보기**로 폰 화면을 확인합니다.

## 코드 블록 (파일 없이 바로 붙이기)

Studio의 **요소 추가 → 코드 블록**은 HTML·CSS·JS 칸에 코드를 붙여넣으면 그 상자 안에서 바로 실행합니다.
CodePen 예제나 다른 Claude가 만들어 준 코드 조각을 넣기 좋습니다.

- 사이트와 분리된 안전한 상자(sandbox iframe)에서 실행돼서, 코드가 잘못돼도 사이트 전체가 깨지지 않습니다.
- 대신 상자 밖(페이지 전체)을 건드릴 수 없습니다. 페이지 전체 효과는 컴포넌트로 만드세요.
- 스크롤·마우스 위치는 `window.archive`로 받을 수 있습니다:

```js
archive.on("scroll", (s) => { /* s.page, s.progress (0–1), s.velocity */ });
archive.on("pointer", (p) => { /* p.x, p.y (상자 기준 0–1, 상자 밖이면 범위를 벗어남), p.inside */ });
archive.on("visibility", (visible) => { /* 화면 밖이면 false — 애니메이션 멈추기 */ });
archive.on("paused", (paused) => { /* 방문자가 모션 정지를 누름 */ });
archive.state.layout; // "desktop" | "tablet" | "mobile"
```
