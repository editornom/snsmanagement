---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
---

# SNS 콘텐츠 제작 자동화 도구 - Epic Breakdown

## Overview

이 문서는 SNS 콘텐츠 제작 자동화 도구의 PRD와 아키텍처 스파인을 에픽/스토리 단위로 분해한다. UX 설계 문서는 별도로 작성되지 않았다(1인 도구, 본 PRD가 유일한 기획 문서).

## Requirements Inventory

### Functional Requirements

- FR1: 참고 이미지 기반 HTML 카드 생성 — Claude API가 참고 이미지를 1080x1350(4:5) HTML 카드로 변환. 텍스트 반영률 90% 이상, 카드 수 1~10장 가변, 색상값은 CSS 변수로 처리(PRD §4.1)
- FR2: 인라인 편집 — 카드 미리보기에서 텍스트/요소 직접 클릭 수정, 별도 저장 버튼 없이 즉시 반영(PRD §4.2)
- FR3: 코드창 토글 및 동기화 — 코드창 온/오프, 미리보기 요소 클릭 시 대응 코드 위치 하이라이트, 코드 직접 수정 시 미리보기 즉시 반영(PRD §4.2)
- FR4: HTML → 이미지 렌더링 — 카드를 1080x1350 PNG로 일괄 렌더링, `{YYMMDD}_{키워드}_{순번}.png`/`.html` 형식 저장(PRD §4.3)
- FR5: 모션그래픽 삽입 — 기본 페이드인/슬라이드인 패턴, 카드별 랜덤화 없음, 반복모션은 1사이클 완료 기준(PRD §4.3)
- FR6: 음악 로테이션 영상 렌더링 — 정해진 타이밍 룰(썸네일 5초, 카드별 애니메이션+3초)로 영상 조립, `/music/` 폴더 순차 로테이션, 마지막 사용곡 추적, `{YYMMDD}_{키워드}.mp4` 저장(PRD §4.3)
- FR7: HTML+이미지 기반 원고 생성 — Claude API에 HTML 소스+렌더링 이미지를 함께 입력해 4사 공통 원고 생성, 연락처 템플릿 고정 삽입, 해시태그 자동생성, 홈페이지 URL은 FR8에서 등록한 메타데이터에서 자동 삽입(PRD §4.4)
- FR8: 출력 폴더 및 메타데이터 관리 — 썸네일 등록 시 `output/{키워드}/{YYMMDD}/` 자동 생성, 이후 모든 산출물 보관, 키워드/제목/홈페이지 URL 메타데이터를 이 시점에 함께 입력받아 저장(PRD §4.5)
- FR9: 자연어 지시 기반 AI 편집 — 자연어 지시를 입력하면 Claude API가 현재 카드 HTML을 골격계약 유지한 채로 수정, FR-1과 동일 API 키 재사용(PRD §4.2)

### NonFunctional Requirements

- NFR1: 플랫폼 — 데스크탑 GUI 프로그램(.exe 패키징, 버튼/입력창 기반), CLI 아님(PRD §4.6)
- NFR2: 창 해상도 — 프로그램 기준 1920x1080(PRD §4.6)
- NFR3: API 사용 범위 — Claude API 단일 키만 사용(HTML 생성+원고 생성), 플랫폼별 업로드/조회 API 미사용(PRD §4.6)
- NFR4: 비용 — 별도 상한 없음, 1회 호출당 약 $0.16~$0.27 수준 허용(PRD §4.6)

### Additional Requirements

- 스타터 스택: Electron ^42 + TypeScript ^5 + electron-builder ^26(NSIS 타깃, Node ≥22.12) — Epic 1 Story 1에서 프로젝트 스캐폴딩으로 반영(ARCHITECTURE-SPINE AD-1, Stack)
- Main/Renderer 프로세스 분리 — `contextIsolation:true`, `nodeIntegration:false`, IPC(`domain:action` 채널)로만 통신(AD-1)
- 정보카드 HTML 구조 계약 — `data-edit-id` 부여 + 색상은 `:root` CSS 커스텀 프로퍼티로만 표현, 카드 1장=단일 HTML 파일(AD-2). **세부 스키마(정확한 data-edit-id 네이밍, 색상변수 명명규칙)는 PRD/아키텍처에서 미확정 — 이번 에픽/스토리 설계에서 결정 필요**
- HTML→PNG 렌더링은 Electron 자체 offscreen `BrowserWindow`+`capturePage()`만 사용, Playwright 등 별도 Chromium 의존성 금지(AD-3)
- 카드 전환효과는 ffmpeg `xfade` 필터(fade/slide 계열)로 구현, HTML/CSS 애니메이션 화면녹화 금지(AD-4)
- 상태 저장은 파일시스템 단일화 — DB 없음, `output/` 폴더가 콘텐츠 단일 진실 소스, 도구 자체 상태(음악 로테이션 등)는 `userData` JSON 파일(AD-5)
- API 키는 Electron `safeStorage`(OS 암호화)로 `userData`에 저장, 멀티PC 동기화 기능 없음(AD-6)
- 파일/폴더 네이밍은 `storage/naming.ts` 단일 유틸에서만 생성(AD-7)
- 폴더별 `meta.json`(키워드/제목/홈페이지 URL)을 썸네일 등록 시 생성, FR-7 원고생성 단계가 읽어 URL 자동삽입(구조시드 보완)
- 자동 업데이트 없음(수동 재설치), 원격 로깅/텔레메트리 없음(로컬 로그파일만)

### UX Design Requirements

해당 없음 — 별도 UX 설계 문서 없음(1인 운영 도구, PRD가 유일한 기획 문서).

### FR Coverage Map

FR1: Epic 1 - 참고이미지 기반 HTML 카드 생성
FR2: Epic 1 - 인라인 편집
FR3: Epic 1 - 코드창 토글 및 동기화
FR8: Epic 1 - 출력 폴더 자동생성 및 메타데이터(키워드/제목/URL) 등록
FR9: Epic 1 - 자연어 지시 기반 AI 편집
FR4: Epic 2 - HTML → 이미지 렌더링
FR5: Epic 2 - 모션그래픽 삽입
FR6: Epic 2 - 음악 로테이션 영상 렌더링
FR7: Epic 3 - HTML+이미지 기반 원고 생성(URL 자동삽입)

## Epic List

### Epic 1: 콘텐츠 시작 & 정보카드 제작

사용자는 썸네일을 등록(키워드/제목/홈페이지 URL 함께 입력)해 출력 폴더를 생성하고, 참고 이미지를 올려 Claude가 변환한 HTML 정보카드를 받아 인라인 편집, 코드창, 또는 자연어 지시로 AI에게 맡겨 만족할 때까지 다듬을 수 있다.
**FRs covered:** FR1, FR2, FR3, FR8, FR9

### Epic 2: 이미지/영상 렌더링

사용자는 Epic 1에서 완성한 정보카드를 PNG 이미지로 렌더링하고, 모션그래픽과 음악 로테이션을 입혀 완성된 영상으로 만들 수 있다.
**FRs covered:** FR4, FR5, FR6

### Epic 3: SNS 원고 생성

사용자는 완성된 카드(HTML+렌더링 이미지)를 바탕으로 4개 플랫폼 공통 원고를 자동 생성받는다. 연락처 템플릿과 홈페이지 URL(Epic 1 메타데이터)이 자동 삽입되고 해시태그도 자동 생성된다.
**FRs covered:** FR7

## Epic 1: 콘텐츠 시작 & 정보카드 제작

사용자는 썸네일을 등록(키워드/제목/홈페이지 URL 함께 입력)해 출력 폴더를 생성하고, 참고 이미지를 올려 Claude가 변환한 HTML 정보카드를 받아 인라인 편집, 코드창, 또는 자연어 지시로 AI에게 맡겨 만족할 때까지 다듬을 수 있다.

### Story 1.1: 프로젝트 스캐폴딩

As a 운영자(Junghoo),
I want Electron+TypeScript 기반 프로젝트가 세팅되어 실행/패키징 가능하길,
So that 이후 모든 기능을 이 위에 쌓을 수 있다.

**Acceptance Criteria:**

**Given** Node.js ≥22.12 환경에서 저장소를 클론했을 때
**When** `npm install` 후 `npm run dev`를 실행하면
**Then** 1920x1080 빈 Electron 윈도우가 표시된다
**And** Main 프로세스는 `contextIsolation:true`, `nodeIntegration:false`로 설정되어 있다

**Given** 개발 환경에서
**When** `npm run build`(electron-builder, NSIS 타깃)를 실행하면
**Then** Windows용 .exe 설치파일이 생성된다
**And** 설치 후 실행하면 동일한 빈 윈도우가 뜬다

### Story 1.2: 썸네일 등록 & 메타데이터 입력

As a 운영자,
I want 썸네일 이미지와 키워드/제목/홈페이지 URL을 한 화면에서 입력하길,
So that 콘텐츠별 출력 폴더가 자동으로 만들어지고 이후 단계에서 메타데이터를 재입력하지 않아도 된다.

**Acceptance Criteria:**

**Given** 앱을 실행한 상태에서
**When** 사용자가 썸네일 이미지 파일을 선택하고 키워드/제목/홈페이지 URL을 입력 후 등록하면
**Then** `output/{키워드}/{YYMMDD}/` 폴더가 생성된다
**And** 같은 폴더에 `meta.json`(키워드, 제목, URL 포함)이 저장된다
**And** 썸네일 원본 파일이 폴더에 복사된다

**Given** 동일 키워드로 같은 날 다시 등록을 시도했을 때
**When** 등록을 진행하면
**Then** 기존 폴더에 이어서 저장되고 meta.json은 최신 입력값으로 갱신된다

**Given** 키워드 또는 썸네일 파일을 입력하지 않은 상태에서
**When** 등록 버튼을 누르면
**Then** 어떤 항목이 비어있는지 알려주고 폴더를 생성하지 않는다

### Story 1.3: 참고이미지 → HTML 정보카드 생성

As a 운영자,
I want 참고이미지를 올리면 Claude가 동일 골격의 HTML 카드로 변환해주길,
So that 카드 디자인을 매번 손으로 코딩하지 않아도 된다.

**Acceptance Criteria:**

**Given** Story 1.2에서 등록된 콘텐츠 폴더가 선택된 상태에서
**When** 참고이미지 1장을 업로드하고 생성 요청을 하면
**Then** Claude API가 호출되어 1080x1350(4:5) HTML 카드 1장이 생성된다
**And** 생성된 HTML은 카드 골격계약(제목바/불릿박스/아이콘/푸터 영역에 `data-edit-id`, 색상은 `:root` CSS 변수)을 따른다
**And** 생성 결과는 즉시 미리보기로 렌더링되어 보인다

**Given** 참고이미지를 여러 장(최대 10장) 업로드했을 때
**When** 생성 요청을 하면
**Then** 각 이미지마다 별도의 카드 HTML이 생성되고 순서대로 미리보기에 나열된다

**Given** 생성된 카드의 텍스트 반영이 미흡하다고 판단했을 때
**When** 재생성 버튼을 누르면
**Then** 동일 참고이미지로 해당 카드만 다시 생성한다(다른 카드는 영향 없음)

### Story 1.4: 카드 인라인 편집

As a 운영자,
I want 미리보기에서 카드 텍스트를 직접 클릭해 고치길,
So that 코드를 몰라도 빠르게 다듬을 수 있다.

**Acceptance Criteria:**

**Given** Story 1.3에서 생성된 카드가 미리보기에 떠 있을 때
**When** 텍스트 요소를 클릭하고 내용을 수정하면
**Then** 별도 저장 버튼 없이 화면에 수정 내용이 즉시 반영된다
**And** 수정된 내용은 해당 카드의 HTML 소스에도 반영된다

**Given** 색상 변수가 적용된 영역을 수정했을 때
**When** 색상값을 변경하면
**Then** 변경 사항이 해당 카드의 CSS 변수 값으로 저장된다(구조는 그대로 유지)

### Story 1.5: 코드창 토글 및 동기화

As a 운영자,
I want 필요할 때 코드창을 열어 직접 HTML을 고치고, 미리보기 요소를 클릭하면 코드 위치를 바로 찾을 수 있길,
So that 인라인 편집으로 안 되는 미세조정도 빠르게 할 수 있다.

**Acceptance Criteria:**

**Given** 카드 미리보기 화면에서
**When** 코드창 토글을 켜면
**Then** 현재 카드의 HTML 소스가 코드창에 표시된다

**Given** 코드창이 열려있는 상태에서
**When** 미리보기의 특정 요소를 클릭하면
**Then** 코드창이 해당 요소의 코드 위치로 스크롤되고 하이라이트된다

**Given** 코드창에서 코드를 직접 수정했을 때
**When** 수정을 하면
**Then** 별도 적용 버튼 없이 미리보기 화면이 갱신된다

**Given** 코드창을 켠 상태에서
**When** 토글을 다시 끄면
**Then** 미리보기만 남고 마지막 수정 내용은 유지된다

### Story 1.6: 자연어 지시 기반 AI 편집

As a 운영자,
I want 자연어로 수정 지시를 입력하면 Claude가 카드 HTML을 고쳐주길,
So that 직접 코드를 건드리지 않고도 복잡한 수정을 빠르게 처리할 수 있다.

**Acceptance Criteria:**

**Given** 카드 미리보기/코드창이 열려있는 상태에서
**When** 자연어 지시(예: "이 카드 색상을 파란색으로 바꿔줘")를 입력하고 전송하면
**Then** 현재 카드의 HTML과 지시문이 Claude API(FR-1과 동일 키)로 전달되고, 수정된 HTML을 받아 미리보기와 코드창에 반영한다

**Given** Claude가 수정한 결과가 카드 골격계약(data-edit-id, CSS 색상변수)을 벗어났을 때
**When** 결과를 받으면
**Then** 적용을 거부하고 사용자에게 계약 위반 사실을 알린다(원본 유지)

**Given** AI 편집 결과가 만족스럽지 않을 때
**When** 되돌리기를 선택하면
**Then** AI 편집 적용 이전 상태로 복원된다

## Epic 2: 이미지/영상 렌더링

사용자는 Epic 1에서 완성한 정보카드를 PNG 이미지로 렌더링하고, 카드 진입 애니메이션과 음악 로테이션을 입혀 완성된 영상으로 만들 수 있다.

### Story 2.1: HTML → 이미지 렌더링

As a 운영자,
I want 완성된 카드 HTML들을 PNG로 일괄 렌더링하길,
So that 영상과 별개로 SNS 이미지 게시물로도 쓸 수 있다.

**Acceptance Criteria:**

**Given** 완성된 카드 HTML들이 있을 때
**When** 이미지 렌더링을 실행하면
**Then** 각 카드가 1080x1350 PNG로 `{YYMMDD}_{키워드}_{순번}.png` 형식으로 `image/` 폴더에 저장된다
**And** 원본 HTML도 동일 순번 규칙으로 `html/` 폴더에 보존된다

### Story 2.2: 카드 애니메이션 프레임캡처

As a 운영자,
I want 각 카드의 진입 애니메이션과 노출시간 전체가 영상 프레임으로 정확히 캡처되길,
So that 반복 모션이 있어도 끊기지 않고 영상에 담긴다.

**Acceptance Criteria:**

**Given** 카드 HTML과 노출시간(애니메이션+추가노출 3초)이 정해진 상태에서
**When** 프레임캡처를 실행하면
**Then** 60fps로 해당 노출시간 전체가 결정론적 프레임스테핑 방식으로 캡처된다(반복 모션 포함, 정지구간 가정 없음)
**And** 캡처된 프레임 시퀀스는 카드별 임시 폴더에 저장된다

**Given** 카드가 여러 장일 때
**When** 전체 프레임캡처를 실행하면
**Then** 모든 카드가 순서대로 캡처되고, 다음 카드로 넘어갈 때 별도 전환효과 없이 해당 카드 자체의 진입 애니메이션이 전환처럼 보인다

### Story 2.3: 음악 로테이션 영상 조립

As a 운영자,
I want 썸네일+카드별 프레임시퀀스를 음악과 함께 하나의 영상으로 합쳐주길,
So that 완성된 영상을 바로 게시할 수 있다.

**Acceptance Criteria:**

**Given** 썸네일 이미지(5초)와 카드별 프레임시퀀스(Story 2.2)가 준비된 상태에서
**When** 영상 조립을 실행하면
**Then** ffmpeg가 썸네일→카드1→카드2→...순으로 이어붙여 하나의 mp4를 만든다
**And** `/music/` 폴더의 곡을 순서대로 1곡 사용하고, 마지막 사용곡 정보를 갱신해 다음 실행 시 그 다음 곡을 사용한다(끝까지 쓰면 처음곡으로 순환)
**And** 완성된 영상은 `output/{키워드}/{YYMMDD}/video/{YYMMDD}_{키워드}.mp4`로 저장된다
**And** 조립에 사용된 임시 프레임 PNG들은 인코딩 완료 후 삭제된다

**Given** 음악 폴더에 곡이 1개뿐일 때
**When** 영상 조립을 실행하면
**Then** 그 곡을 반복 사용한다(순환구조가 1곡에서도 깨지지 않음)

## Epic 3: SNS 원고 생성

사용자는 완성된 카드(HTML+렌더링 이미지)를 바탕으로 4개 플랫폼 공통 원고를 자동 생성받는다. 연락처 템플릿과 홈페이지 URL(Epic 1 메타데이터)이 자동 삽입되고 해시태그도 자동 생성된다.

### Story 3.1: HTML+이미지 기반 원고 생성

As a 운영자,
I want 완성된 카드(HTML+이미지)를 보고 Claude가 4사 공통 원고를 자동 생성해주길,
So that 매번 직접 글을 쓰지 않아도 된다.

**Acceptance Criteria:**

**Given** 완성된 카드 HTML과 렌더링 이미지가 있는 상태에서
**When** 원고 생성을 요청하면
**Then** Claude API에 해당 카드들의 HTML 소스+렌더링 이미지가 함께 전달되어 원고가 생성된다
**And** 생성된 원고는 페인포인트 제시→핵심포인트 이모지 불릿→연락처 템플릿→해시태그 순서를 따른다
**And** 연락처 템플릿(전화/직통/카카오톡)이 고정 문구로 삽입된다
**And** 홈페이지 URL은 Story 1.2에서 등록된 `meta.json` 값이 자동으로 삽입된다
**And** 해시태그는 콘텐츠에 맞게 Claude가 자동 생성한다
**And** 완성된 원고는 `output/{키워드}/{YYMMDD}/원고.txt`로 저장된다

**Given** 생성된 원고가 만족스럽지 않을 때
**When** 재생성을 요청하면
**Then** 동일 입력으로 원고를 다시 생성한다

**Given** `meta.json`에 홈페이지 URL이 비어있는 상태에서
**When** 원고를 생성하면
**Then** URL 자리는 빈칸으로 남고 사용자에게 메타데이터가 비어있음을 알린다
