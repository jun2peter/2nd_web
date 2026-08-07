# PARK SEUNGJUN — Works & Research

MIT Media Lab 지원과 장기 작품 아카이빙을 함께 고려한 포트폴리오입니다.

## 두 가지 화면

- 기본 화면 — **Experience**: 작품을 전시처럼 천천히 경험하는 인터랙티브 버전
- `?view=archive` — **Archive**: 흰색 자유 배치 아트보드
- `?view=archive&edit=1` — **Archive Studio**: 피그마처럼 요소를 추가하고 드래그·리사이즈하는 편집 화면
- `?work=작품주소` — Experience에서 여는 작품 상세 페이지

Experience의 작품 데이터와 Archive의 자유 배치 데이터는 분리되어 있습니다. Archive 화면은 `content/archive.json`을 읽습니다.

## Archive Studio 사용법

1. `?view=archive&edit=1`을 엽니다.
2. 텍스트, 이미지·GIF, 영상, 버튼, 도형, 반복 글자를 추가합니다.
3. 요소를 드래그하거나 오른쪽 패널에서 위치·크기·폰트·색상·반복을 조절합니다.
4. 작업 내용은 현재 브라우저에 자동 저장됩니다.
5. **게시 준비**를 누르면 완성된 JSON이 복사되고 GitHub 편집 화면이 열립니다.
6. GitHub에서 전체 내용을 붙여넣은 뒤 **Commit changes**를 누르면 공개 사이트에 반영됩니다.

작은 이미지와 GIF는 편집기에서 바로 불러올 수 있습니다. 큰 이미지·GIF와 짧은 MP4·WebM 영상은 편집기의 업로드 버튼 또는 Pages CMS의 Media에 올린 뒤 `/media/파일명`을 사용하세요. YouTube·Vimeo 링크도 함께 지원합니다. GitHub 웹 업로드는 파일당 25MB 제한이 있으므로 긴 영상은 외부 영상 링크 사용을 권장합니다.

## 작품과 글을 가장 쉽게 올리는 방법

이 저장소에는 [Pages CMS](https://pagescms.org/) 설정 파일 `.pages.yml`이 포함되어 있습니다. Pages CMS에서 GitHub로 로그인한 뒤 이 저장소를 선택하면 다음을 폼처럼 편집할 수 있습니다.

- 작품 추가·삭제·순서 변경
- 표지와 설치 사진 업로드
- 작품 설명, 역할, 연구 질문, 방법, 도구, 수상·전시 이력 편집
- 소개문, 이메일, SNS, 전체 색상과 모션 강도 변경
- 연구 축 편집
- Archive 캔버스 수치와 각 요소의 세부 속성 편집

CMS가 별도 데이터베이스를 만들지 않고 이 저장소의 파일을 직접 수정하므로, 서비스를 바꾸더라도 콘텐츠가 사라지지 않습니다.

## 처음 공개하기 전에 반드시 바꿀 항목

Pages CMS의 **Site settings** 또는 `content/site.json`에서 아래를 교체하세요.

1. `hello@example.com` → 실제 연락 이메일
2. Instagram URL → 실제 계정
3. 작품 제작 연도와 전시·수상 표기
4. 각 작품의 실제 표지 및 기록 사진
5. 영문 작가 소개문 최종 교정

현재 영문은 화면과 정보 구조를 시험하기 위한 1차 초안입니다. 사실이 확정되지 않은 항목은 공개 전 반드시 검토하세요.

## 유지비

이 사이트는 프레임워크, 서버, 데이터베이스가 필요 없는 정적 HTML/CSS/JavaScript입니다.

- 원본 코드와 콘텐츠: GitHub
- 콘텐츠 편집: Pages CMS 무료 버전 또는 GitHub 웹 편집기
- 호스팅: Cloudflare Pages 무료 범위 또는 공개 저장소의 GitHub Pages
- 선택 비용: 개인 도메인 연간 등록비

유료 Figma Sites에 종속되지 않습니다. Figma는 화면과 컴포넌트를 설계하는 디자인 문서로만 사용하고, 실제 사이트 원본은 이 코드입니다.

## 내 컴퓨터에서 확인하기

저장소 폴더에서 다음 명령을 실행하고 표시되는 주소를 브라우저로 엽니다.

```bash
python -m http.server 8080
```

## 공개하기

### 선택 A — Cloudflare Pages

비공개 GitHub 저장소를 유지하면서 무료로 공개하기 좋습니다. 저장소를 연결하고 별도 빌드 명령 없이 루트 폴더를 배포합니다.

### 선택 B — GitHub Pages

저장소를 공개로 전환한 뒤 Settings → Pages → Deploy from a branch → `main` / root를 선택합니다. 기본 주소는 `jun2peter.github.io/2nd_web/` 형태입니다.

## Figma ↔ 코드

`design/figma-tokens.json`에 색상, 간격, 타이포그래피 토큰이 정리되어 있습니다. 자세한 규칙은 `design/FIGMA_HANDOFF.md`를 참고하세요.
