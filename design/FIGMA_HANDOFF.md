# Figma ↔ Code Handoff

Figma는 호스팅이 아니라 설계 도면으로만 사용합니다. 운영 사이트의 원본은 GitHub 코드와 `content/` 데이터입니다.

| Figma frame | Website state | Code surface |
|---|---|---|
| `01 Experience / Desktop` | 기본 화면 | `experienceTemplate()` |
| `01 Experience / Mobile` | 기본 화면 720px 이하 | `styles.css` mobile media query |
| `02 Archive / [page-slug] / 1440` | `?view=archive&page=[slug]` | `content/archive.json`의 해당 page |
| `02 Archive Studio 4 / Design` | `?view=archive&edit=1` | `archive-editor.js` |
| `02 Archive Studio 4 / Motion` | Studio 상단 `Motion` | `block.motion.timeline` |
| `03 Work / Desktop` | `?work=[slug]` | `detailTemplate()` |
| `03 Work / Mobile` | Work 720px 이하 | `styles.css` mobile media query |

## 컴포넌트 이름

- `Navigation / ViewSwitch`
- `Project / Visual`
- `Project / ExperienceCard`
- `Project / ArchiveCard`
- `Research / Axis`
- `Content / SectionLabel`
- `Archive / Button`
- `Archive / ImageButton`
- `Archive / Navigation`
- `Archive / Gallery`
- `Archive / MotionTrack`
- `Archive / MotionKeyframe`

## Figma의 Archive 디자인을 Studio로 옮기는 법

1. Figma에서 Archive 페이지마다 **1440px 너비의 Frame**을 하나 만들고 Frame 이름에 URL slug를 적습니다.
2. Studio에서 같은 이름의 페이지를 만들고 아트보드 너비·높이를 Figma Frame과 맞춥니다.
3. Figma 오른쪽 패널의 `X / Y / W / H / Rotation / Opacity` 값을 Studio 오른쪽 패널에 그대로 입력합니다. 둘 다 픽셀 기준입니다.
4. 이미지·GIF·영상은 Figma에서 export한 뒤 GitHub `media/`에 업로드하고 `/media/파일명`을 넣습니다.
5. Figma의 Fill, Stroke, Radius, Shadow, Blur, Blend 값을 Studio의 모양 패널에서 맞춥니다. 그라디언트는 CSS `linear-gradient(...)` 문자열도 사용할 수 있습니다.
6. 페이지 이동과 hover·scroll·loop 애니메이션은 Studio의 **클릭 동작 / 빠른 애니메이션**에서 지정합니다.
7. Figma의 최상위 Frame 하나가 Studio의 페이지 하나입니다. 메뉴에 보여야 하면 **메뉴 페이지**, 버튼으로만 들어가야 하면 **링크 전용**으로 만듭니다.
8. 영상·오디오·GIF의 Prototype 메모에 `autoplay`, `click`, `hover`, `in-view`, `controls`, `link` 중 재생 정책을 적고 Studio의 **재생 방식**에서 같은 값을 고릅니다.
9. Figma Motion의 키프레임은 Studio 상단 **Motion** 모드에서 옮깁니다. Position은 키프레임 X/Y, Scale은 가로·세로 배율, Rotation은 Z/X/Y 회전, Opacity와 Blur는 Appearance에 입력합니다.
10. Figma Motion의 시간은 Studio의 duration/delay, layer timing은 하단 공통 타임라인, easing은 각 키프레임의 ‘이 프레임 뒤 이징’에 대응합니다. Scroll Transform은 시작 조건을 **스크롤 진행률**로 선택합니다.

Motion Lab v1은 레이어마다 하나의 키프레임 트랙을 가집니다. 여러 레이어를 같은 하단 타임라인에서 재생·스크럽하고 `순차 등장`을 적용할 수 있지만, 하나의 trigger가 여러 레이어의 서로 다른 scene/variant를 동시에 전환하는 기능은 아직 코드의 다음 확장 범위입니다.

## 페이지 메뉴와 임베드 규칙

- 캔버스 안에서 자유롭게 배치할 메뉴는 `Archive / Navigation` 요소를 사용합니다. `사이트 설정 → 고정 전역 페이지 메뉴`는 캔버스 밖의 간편 고정 메뉴입니다.
- 페이지 메뉴의 `사이트 메뉴 페이지 자동`은 왼쪽 **메뉴에 표시** 그룹을 따라가며, `직접 선택`은 링크 전용 페이지도 포함할 수 있습니다.
- 타사 iframe을 직접 조작하는 임베드는 카드 전체 링크와 동시에 사용할 수 없습니다. 페이지 이동 디자인이라면 **재생 없이 페이지·링크 이동** 모드를 쓰고 포스터·버튼 상태를 Figma에 따로 그립니다.
- GIF의 클릭·호버 재생은 포스터 이미지에서 GIF로 교체되는 방식입니다. 정확한 재생 시간·반복 횟수가 중요하면 Figma export 후 MP4·WebM을 사용합니다.

Archive는 사용자가 원한 대로 breakpoint 재배치 대신 고정 Frame 전체를 화면 너비에 맞춰 축소합니다. 따라서 Figma에서 잡은 상대 배치가 작은 화면에서도 바뀌지 않습니다.

## 무엇을 어디서 바꾸나

| 바꾸려는 것 | 수정 위치 |
|---|---|
| 작품·글·사진 | Pages CMS 또는 `content/*.json` |
| 전체 색상·모션 | Pages CMS의 Site settings |
| 간격·글자 크기 | `styles.css` 및 `figma-tokens.json` |
| 화면 구조 | Figma 프레임을 먼저 수정한 뒤 대응 템플릿 수정 |
| 인터랙션 | 코드가 원본. Figma 프로토타입은 동작 설명용 |

복잡한 포인터 반응, 스크롤 등장, 캔버스 파티클은 Figma가 완전히 표현하기 어렵기 때문에 코드가 최종 기준입니다.
