# Figma ↔ Code Handoff

Figma는 호스팅이 아니라 설계 도면으로만 사용합니다. 운영 사이트의 원본은 GitHub 코드와 `content/` 데이터입니다.

| Figma frame | Website state | Code surface |
|---|---|---|
| `01 Experience / Desktop` | 기본 화면 | `experienceTemplate()` |
| `01 Experience / Mobile` | 기본 화면 720px 이하 | `styles.css` mobile media query |
| `02 Archive / [page-slug] / 1440` | `?view=archive&page=[slug]` | `content/archive.json`의 해당 page |
| `02 Archive Studio` | `?view=archive&edit=1` | `archive-editor.js` |
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

## Figma의 Archive 디자인을 Studio로 옮기는 법

1. Figma에서 Archive 페이지마다 **1440px 너비의 Frame**을 하나 만들고 Frame 이름에 URL slug를 적습니다.
2. Studio에서 같은 이름의 페이지를 만들고 아트보드 너비·높이를 Figma Frame과 맞춥니다.
3. Figma 오른쪽 패널의 `X / Y / W / H / Rotation / Opacity` 값을 Studio 오른쪽 패널에 그대로 입력합니다. 둘 다 픽셀 기준입니다.
4. 이미지·GIF·영상은 Figma에서 export한 뒤 GitHub `media/`에 업로드하고 `/media/파일명`을 넣습니다.
5. Figma의 Fill, Stroke, Radius, Shadow, Blur, Blend 값을 Studio의 모양 패널에서 맞춥니다. 그라디언트는 CSS `linear-gradient(...)` 문자열도 사용할 수 있습니다.
6. 페이지 이동과 hover·scroll·loop 애니메이션은 Figma prototype 설명을 참고해 Studio의 **클릭 동작 / 애니메이션**에서 지정합니다.

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
