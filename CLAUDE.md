# 2nd_web — 작업 안내 (Claude용)

박승준(PARK SEUNGJUN) 작가의 포트폴리오 사이트이자, 그 사이트를 만드는 **Archive Studio**(웹 빌더)입니다.
사용자는 디자이너·영상 작가이고 개발자가 아닙니다. 설명은 한국어로, 쉬운 말로 해주세요.

## 한눈에 보기

- **빌드 없음.** 순수 HTML/CSS/ES 모듈. npm·번들러·프레임워크를 추가하지 마세요. GitHub Pages / Cloudflare Pages에 폴더 그대로 올라갑니다.
- 화면은 두 가지: Experience(`app.js`가 직접 그리는 검은 메인)와 **Archive**(`content/archive.json`을 빌더가 그리는 페이지들).
- `?view=archive&edit=1` = Archive Studio(편집기). 편집 내용은 브라우저 localStorage에 초안으로 저장되고, "게시 파일 준비"로 JSON을 복사해 GitHub에 붙여넣어 게시합니다.

## 파일 지도

| 파일 | 역할 |
|---|---|
| `index.html` | 진입점. CSS/JS를 `?v=studio7`로 캐시 무효화 |
| `app.js` | 라우팅, Experience 화면, 작품 상세, Archive 화면 틀(고정 레이어 포함) |
| `archive-editor.js` | 빌더 본체: 데이터 정규화(`normalize*`), 블록 마크업, 공개 사이트 실행(`bindArchiveViewer`), 편집기(`bindArchiveStudio`), 검수(`runPreflight`) |
| `archive/responsive.js` | Desktop/Tablet/Mobile 배치: 화면별 덮어쓰기 값, 미디어쿼리 CSS 생성, 자동 정렬(`autoLayout`) |
| `archive/components-host.js` | 커스텀 컴포넌트 실행기(ctx 제공), 코드 블록(sandbox iframe) 브리지, 외부 라이브러리 목록 `LIBRARIES` |
| `archive/effects.js` | 부드러운 스크롤(Lenis), 커서, 글자별 등장, 자석 호버, 스크롤 고정(pin) |
| `components/*.js` + `components/registry.js` | 커스텀 컴포넌트. 계약은 `docs/COMPONENTS.md` |
| `components/playground.html` | 컴포넌트 단독 테스트 페이지 |
| `content/*.json` | 사이트 내용. `archive.json`이 빌더 데이터 (v5) |
| `.pages.yml` | Pages CMS 폼 정의 |
| `styles.css` | 전체 스타일. 끝부분 `Archive Studio 5` 섹션이 새 기능 |
| `docs/REQUEST_TEMPLATES.md` | 사용자가 Claude에게 요청할 때 쓰는 문장 틀 |
| `docs/ROADMAP_STUDIO6.md` | **Studio 6 작업표**(이미지·영상을 재료로 + 편집기 손맛). 상태 표시(✅/🌙/📋)와 진행 기록을 함께 갱신 |

Studio 6에서 블록에 추가된 필드: `clipShape`·`clipCustom`(모양으로 자르기, `clipPathFor`), `focalX`·`focalY`(보이는 중심 → `--focal`), `hoverEffect`·`hoverSrc`(`data-hover-effect`, CSS는 styles.css 끝 Studio 6 섹션), `contrast`·`saturate`·`brightness`·`hueRotate`·`sepia`·`invert`(`visualEffectStyle`). 편집기 클립보드 키는 `psj-archive-clipboard-v1`(localStorage). 새 컴포넌트: `scroll-sequence`, `media-text`, `hover-reveal`, `compare-slider`.

Studio 7(2026-10-17 새벽)에서 추가: 편집기 다중 선택(`selectedIds`, `selected()`는 첫 선택)·정렬·스마트 가이드·핸들 8개+회전·더블클릭 글자 편집·우클릭 메뉴·레이어 드래그·폰트 고르기(`FONT_LIBRARY`, `settings.fonts` → `googleFontsHref`)·파일 드롭 WebP 압축(`compressImage`)·포컬 썸네일. 데이터 필드: 블록 `videoStart`·`videoEnd`·`playbackRate`, 재생 방식 `scrub`; 페이지 `customCSS`, `canvas.background{Image,Video,Fit,Position,Overlay,Effect}`(`canvasBackgroundMarkup`); 설정 `fonts`·`customCSS`·`customHead`(`syncArchiveCustomHead`, 공개 화면 전용). 작업표: `docs/ROADMAP_STUDIO6.md`, 보고서: `docs/NIGHT_REPORT_2026-10-17.md`.

## archive.json v5 구조 (요약)

```
settings: { defaultPageId, homeView, transition, responsive{tabletMax,mobileMax}, scaleMode, smoothScroll, cursor, ... }
pages[]: { id, name, slug, visibility, canvas{width,height,viewport,background,...}, layouts{tablet,mobile:{enabled,width,height,viewport}}, seo, blocks[] }
globals[]: 모든 페이지에 표시되는 블록 (헤더·메뉴 등)
block: { id, type, x, y, width, height, z, ...type별 값, motion{entrance,hover,loop,timeline}, responsive{tablet:{...},mobile:{...},desktop:{hidden}}, fixed, fixedAnchor, pinEnabled, pinTop, pinDistance, component, props, code{html,css,js} }
```

- 블록 좌표는 **데스크톱 아트보드 px**. Tablet/Mobile에서 바뀐 값만 `block.responsive.<layout>`에 저장합니다 (허용 키: `OVERRIDE_RULES` in `archive/responsive.js`).
- 공개 사이트는 데스크톱 값을 인라인 스타일로, 나머지 화면은 `responsiveCSS()`가 만든 미디어쿼리로 그립니다. DOM은 하나.
- 아트보드는 화면 폭에 맞춰 `transform: scale`로 확대·축소됩니다(`settings.scaleMode`). `fixed` 블록은 캔버스 밖 `.archive-fixed-layer`에 그려집니다.
- 모션: `motion.timeline`(Motion Lab, Web Animations API). `trigger: "linked"`는 다른 레이어(`linkTarget`)의 클릭/호버/누름/보임으로 재생, `linkMode: "toggle"`이면 열기·닫기.

## 작업 규칙

1. **옛 데이터가 계속 열려야 합니다.** 필드를 추가할 땐 `normalizeBlock`/`normalizePage`/`normalizeArchiveData`에 기본값을 넣고, 없던 값이 들어와도 깨지지 않게 하세요. 필드 이름을 바꾸거나 지우지 마세요.
2. 새 블록 속성을 추가하면 함께 손볼 곳: `normalizeBlock` → 마크업(`blockContent`/`archiveBlockMarkup`) → 인스펙터(`inspectorMarkup`) → 공개 사이트 동작(`bindArchiveViewer`) → 필요하면 `runPreflight` 경고 → `.pages.yml`.
3. 화면 크기마다 달라야 하는 값이면 `archive/responsive.js`의 `OVERRIDE_RULES`에 추가하고 `responsiveCSS`에서 CSS로 내보내세요.
4. **모듈을 고치면 캐시 버전을 올리세요**: 모든 `?v=studio7` 문자열(index.html, app.js, archive-editor.js, archive/*.js, playground)을 같은 새 값으로 바꿉니다.
5. 외부 라이브러리는 CDN + **정확한 버전 고정**만. 컴포넌트는 `ctx.lib(name)`으로, 목록은 `LIBRARIES`에.
6. 모든 움직임은 `prefers-reduced-motion`·방문자 "Pause motion"·터치 기기(hover 없음)를 고려합니다.
7. 편집기 UI 문구는 한국어. 사용자가 보는 설명은 짧고 구체적으로.
8. `content/archive.json`은 사용자가 만든 작품 데이터입니다. 통째로 다시 쓰지 말고, 요청받은 부분만 고치세요.
9. 커밋·푸시는 사용자가 요청할 때만. 푸시하면 공개 사이트가 바로 바뀝니다.

## 자주 하는 일

- **새 시각 효과** (셰이더, 3D, 입자, 커서, 특별한 갤러리…) → `components/새이름.js` 하나 + `components/registry.js`에 등록. 계약·예제: `docs/COMPONENTS.md`, `components/grain-gradient.js`.
- **간단한 코드 조각을 바로 넣기** → 저장소 수정 없이 Studio의 "코드 블록"에 HTML/CSS/JS 붙여넣기.
- **새 모션 프리셋** → `MOTION_LAB_PRESETS` (archive-editor.js). 키프레임 값: x, y, scaleX/Y, rotate, rotateX/Y, skewX/Y, opacity, blur, brightness, saturate, hue, clipTop/Right/Bottom/Left(%), easing.
- **페이지 전환 추가** → `TRANSITION_PRESETS` + `styles.css`의 `html.vt-<이름>::view-transition-*` 규칙.
- **커서 추가** → `CURSOR_PRESETS` + `archive/effects.js`의 `bindCustomCursor` + CSS.

## 확인하는 법 (꼭 하기)

```bash
python -m http.server 8080
```

1. `http://localhost:8080/?view=archive&edit=1` — 편집기. 상단 Desktop/Tablet/Mobile 버튼, **기기 미리보기**로 폰 화면 확인.
2. `http://localhost:8080/?view=archive&draft=1` — 내 브라우저의 초안을 공개 화면처럼 보기. 창 폭을 390px·834px·1440px로 바꿔보기.
3. `http://localhost:8080/components/playground.html?c=컴포넌트이름` — 컴포넌트 단독 테스트.
4. 브라우저 콘솔 에러 0개, 편집기 상단 **검수** 경고 확인.
5. 문법 검사: 각 JS를 `.mjs`로 복사해 `node --check` (Node가 있을 때).
