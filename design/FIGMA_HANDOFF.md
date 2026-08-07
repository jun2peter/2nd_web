# Figma ↔ Code Handoff

Figma는 호스팅이 아니라 설계 도면으로만 사용합니다. 운영 사이트의 원본은 GitHub 코드와 `content/` 데이터입니다.

| Figma frame | Website state | Code surface |
|---|---|---|
| `01 Experience / Desktop` | 기본 화면 | `experienceTemplate()` |
| `01 Experience / Mobile` | 기본 화면 720px 이하 | `styles.css` mobile media query |
| `02 Archive / Desktop` | `?view=archive` | `archiveTemplate()` |
| `02 Archive / Mobile` | Archive 720px 이하 | `styles.css` mobile media query |
| `03 Work / Desktop` | `?work=[slug]` | `detailTemplate()` |
| `03 Work / Mobile` | Work 720px 이하 | `styles.css` mobile media query |

## 컴포넌트 이름

- `Navigation / ViewSwitch`
- `Project / Visual`
- `Project / ExperienceCard`
- `Project / ArchiveCard`
- `Research / Axis`
- `Content / SectionLabel`

## 무엇을 어디서 바꾸나

| 바꾸려는 것 | 수정 위치 |
|---|---|
| 작품·글·사진 | Pages CMS 또는 `content/*.json` |
| 전체 색상·모션 | Pages CMS의 Site settings |
| 간격·글자 크기 | `styles.css` 및 `figma-tokens.json` |
| 화면 구조 | Figma 프레임을 먼저 수정한 뒤 대응 템플릿 수정 |
| 인터랙션 | 코드가 원본. Figma 프로토타입은 동작 설명용 |

복잡한 포인터 반응, 스크롤 등장, 캔버스 파티클은 Figma가 완전히 표현하기 어렵기 때문에 코드가 최종 기준입니다.
