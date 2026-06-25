---
baseline_commit: c9bd8d1ba97567f44350d6ab6f61fcd53e200f65
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-3-html-card-generation.md
---

# Story 1.4: 카드 인라인 편집

Status: in-progress

## Story

As a 운영자,
I want 미리보기에서 카드 텍스트를 직접 클릭해 고치길,
so that 코드를 몰라도 빠르게 다듬을 수 있다.

## Acceptance Criteria

1. **Given** Story 1.3에서 생성된 카드가 미리보기에 떠 있을 때, **When** 텍스트 요소를 클릭하고 내용을 수정하면, **Then** 별도 저장 버튼 없이 화면에 수정 내용이 즉시 반영된다. **And** 수정된 내용은 해당 카드의 HTML 소스에도 반영된다.
2. **Given** 색상 변수가 적용된 영역을 수정했을 때, **When** 색상값을 변경하면, **Then** 변경 사항이 해당 카드의 CSS 변수 값으로 저장된다(구조는 그대로 유지).

## Tasks / Subtasks

- [x] Task 0: 편집 대상 식별 알고리즘 확정 (이번 스토리에서 신규 결정 — PRD/아키텍처 모두 구체적 메커니즘 미정) (AC: 1)
  - [x] **결정 배경:** Story 1.3의 AD-2 골격계약은 `data-edit-id`를 영역 단위(`title-bar`, `bullet-{n}`, `icon-{n}`, `footer`)로만 부여하며, 영역 내부의 텍스트 요소(예: 제목 텍스트, 불릿 제목/본문)는 Claude가 매 생성마다 자유롭게 만드는 임의 클래스명(`title-text`, `bullet-title` 등)이라 특정 클래스명에 의존해 편집 대상을 찾을 수 없다(생성마다 클래스명이 달라질 수 있음). 따라서 구조 비의존적인 일반 알고리즘이 필요하다.
  - [x] `src/renderer/src/cardEditing.ts`(신규)에 `enableInlineEditing(doc: Document): void` 작성: `doc.body` 하위 모든 엘리먼트를 순회하며 **(1) 자식 엘리먼트가 없고(텍스트/주석 노드만 보유), (2) `textContent.trim()`이 비어있지 않은** 엘리먼트에만 `contentEditable = 'true'`를 설정한다. 이 조건만으로 아이콘(`<svg>`, 텍스트 없음)과 순수 레이아웃 컨테이너(자식 엘리먼트 보유)는 자연히 제외된다 — 클래스명에 의존하지 않는 범용 규칙이라 참고이미지별로 Claude가 다른 구조/클래스명을 생성해도 동작한다.
  - [x] 편집 가능 엘리먼트는 `keydown`에서 `Enter` 키를 `preventDefault()`로 차단(AC2 "구조는 그대로 유지" 요구와 일치 — 줄바꿈으로 새 블록 엘리먼트가 삽입되면 골격계약이 깨질 수 있음). `Tab`/`Escape`는 기본 동작 유지(포커스 이동용).
  - [x] 이번 스토리는 텍스트 내용 변경만 다룬다 — 새 불릿 추가/삭제, 아이콘 교체 등 구조 변경은 범위 밖(코드창 직접 수정으로 가능해질 Story 1.5의 영역)

- [x] Task 1: 카드 직렬화/저장 파이프라인 (AC: 1, 2)
  - [x] `cardEditing.ts`에 `serializeCardDocument(doc: Document): string` 추가 — `'<!DOCTYPE html>\n' + doc.documentElement.outerHTML` 반환. 색상 변수 변경(Task 3)이 `documentElement.style.setProperty()`로 인라인 스타일을 추가하므로, `outerHTML`을 직렬화하면 인라인 스타일이 자동으로 포함되어 별도 텍스트 치환 없이 색상 변경분까지 함께 저장된다.
  - [x] `main/storage/card.ts`의 `generateCard` 내부에서 경로 계산+`mkdirSync`+`writeFileSync`를 수행하던 부분을 `writeCardHtmlFile(contentFolderPath: string, keyword: string, date: Date, index: number, html: string): { htmlPath: string }`로 추출(리팩터링, AC 영향 없음 — 1.3에서 작성한 `generateCard`는 이 함수를 호출하도록 변경). 이렇게 분리해야 신규 저장 경로(Task 2)와 생성 경로가 동일한 파일쓰기 로직을 공유한다(AD-7 — 경로 조립은 여전히 `naming.ts`의 `getCardHtmlPath`만 호출)
  - [x] `main/storage/card.test.ts`의 기존 `generateCard` 테스트가 리팩터링 후에도 그대로 통과해야 한다(동작 변경 없음, 내부 구조만 분리) — 회귀 확인 필수

- [x] Task 2: `card:save-html` IPC 핸들러 (AC: 1, 2)
  - [x] `src/shared/ipc-card.ts`에 `CARD_SAVE_HTML_CHANNEL = 'card:save-html'`, `SaveCardHtmlRequest { contentFolderPath: string; keyword: string; index: number; html: string }`, `SaveCardHtmlResponseData { htmlPath: string }` 추가
  - [x] `main/ipc/card.ts`에 핸들러 추가: `contentFolderPath`/`keyword`/`html`이 비어있으면(trim 후 빈 문자열) `{ok:false, error}`(1.3에서 확립한 검증 패턴 재사용) → 유효하면 `writeCardHtmlFile(request.contentFolderPath, request.keyword, new Date(), request.index, request.html)` 호출 → `{ok:true, data:{htmlPath}}`. 이 핸들러는 Claude API를 호출하지 않으므로 API 키 미설정 상태에서도 동작해야 한다(편집은 키 설정과 무관 — `getApiKey` 체크를 넣지 않는다)
  - [x] 파일쓰기 실패(디스크 오류 등)는 try/catch로 캐치해 `{ok:false, error}` 반환(throw 금지, 1.2/1.3에서 확립한 envelope 규칙 준수)

- [ ] Task 3: 색상 변수 편집 UI (AC: 2)
  - [ ] `cardEditing.ts`에 `CARD_CSS_VARIABLES = ['--card-bg-color', '--card-primary-color', '--card-text-color', '--card-accent-color'] as const` 상수 추가(Story 1.3에서 확정된 4개 변수명 그대로 재사용 — 임의 확장/변경 금지, 1.5/1.6도 동일 4개를 가정함)
  - [ ] `getCssVariableValues(doc: Document): Record<string, string>` — `getComputedStyle(doc.documentElement)`로 4개 변수의 현재 계산값(hex 등)을 읽어 반환. 카드 미리보기 로드 시 색상 입력 컨트롤의 초기값으로 사용
  - [ ] `setCssVariable(doc: Document, name: string, value: string): void` — `doc.documentElement.style.setProperty(name, value)`. `:root` 룰을 직접 수정하지 않고 `<html>` 엘리먼트에 인라인 스타일을 추가하는 방식 — 인라인 스타일이 `:root` 선택자보다 우선순위가 높아 즉시 화면에 반영되고, 원본 `<style>` 블록(`:root` 정의)은 그대로 보존된다("구조는 그대로 유지" 요구와 정확히 일치)
  - [ ] `App.tsx`의 각 카드 미리보기 하단(재생성 버튼 옆)에 4개 색상 입력(`<input type="color">`, 변수명 라벨과 함께)을 추가. 컨트롤은 iframe 로드 후 `getCssVariableValues`로 초기값 세팅, `onChange`마다 `setCssVariable` 호출 후 Task 4의 저장 파이프라인을 트리거

- [ ] Task 4: 편집 → 저장 연결 (renderer) (AC: 1, 2)
  - [ ] 카드 `<iframe>`의 `onLoad` 핸들러에서 `enableInlineEditing(iframe.contentDocument)` 호출 + 색상 입력 초기값 세팅(Task 3) + 텍스트/색상 편집 시 호출할 디바운스된 저장 함수 등록
  - [ ] 디바운스 저장 함수(간단한 `setTimeout` 기반, 약 500ms — 별도 라이브러리 불필요): iframe 내부에서 `input`(contenteditable 텍스트 편집) 또는 색상 변경이 발생하면 `serializeCardDocument(iframe.contentDocument)` 결과를 `window.api.saveCardHtml({ contentFolderPath: folderPath, keyword, index: card.index, html })`로 저장
  - [ ] **iframe을 React 상태로 다시 렌더링하지 않는다 — 핵심 설계 결정:** 현재 카드 미리보기는 `srcDoc={card.html}`로 1.3에서 구현되어 있다. 편집 중 매 키 입력마다 `card.html` 상태(`setCards`)를 갱신해 `srcDoc`을 다시 설정하면 iframe이 통째로 리로드되어 커서 위치/포커스가 사라지고 방금 입력한 내용이 날아간다. 따라서 **텍스트/색상 편집 결과는 React `cards` 상태에 절대 반영하지 않고**, iframe의 라이브 DOM 안에서만 유지하며 디스크 저장만 비동기로 수행한다. `card.html` 상태는 최초 생성/재생성 시점의 값으로만 유지되고(재생성을 누르면 의도적으로 편집 내용이 사라지며 새로 생성됨 — 기존 1.3 재생성 동작과 일치), 편집 중에는 변경되지 않는다
  - [ ] 저장 실패 시(디스크 오류 등) 카드 영역에 작게 에러 메시지를 표시하되, 편집 자체(화면 반영)는 막지 않는다(AC1의 "화면에 즉시 반영"은 항상 보장되어야 함 — 저장 실패가 편집 UX를 막아서는 안 됨)

- [x] Task 5: Preload 타입드 API (AC: 1, 2)
  - [x] `src/preload/index.ts`의 `api`에 `saveCardHtml(request: SaveCardHtmlRequest): Promise<IpcResult<SaveCardHtmlResponseData>>` 추가, `src/preload/index.d.ts`의 `Api` 인터페이스에도 추가

- [ ] Task 6: 테스트 (AC: 1, 2)
  - [x] `cardEditing.ts`는 순수 DOM 조작 로직이라 Electron 없이 jsdom으로 단위테스트 가능 — **이번 스토리에서 처음 도입**: `jsdom`을 devDependency로 추가하고, `src/renderer/src/cardEditing.test.ts` 파일 맨 위에 `// @vitest-environment jsdom` 주석 추가(현재 `vitest.config.ts`는 기본 node 환경이므로 파일 단위로 오버라이드 — 다른 테스트 파일에 영향 없음)
  - [x] `cardEditing.test.ts`: `enableInlineEditing`이 텍스트 보유 리프 엘리먼트만 `contentEditable=true`로 만들고 컨테이너/`<svg>`는 건너뛰는지, `serializeCardDocument`가 `<!DOCTYPE html>`로 시작하는 문자열을 반환하는지, `getCssVariableValues`/`setCssVariable`이 4개 변수를 올바르게 읽고 쓰는지 검증
  - [x] `main/storage/card.test.ts`: `writeCardHtmlFile` 추출 리팩터링 후 기존 `generateCard` 테스트 회귀 확인 + `writeCardHtmlFile` 자체의 신규 단위테스트(파일 생성, 폴더 자동 생성)
  - [x] `main/ipc/card.test.ts`: `card:save-html` 핸들러 테스트(정상 저장, 필수 필드 누락 시 에러, API 키 미설정이어도 정상 동작하는지 — `getApiKey`를 호출하지 않음을 확인)
  - [ ] **Claude API 호출 없이 검증 가능 — 비용 발생 없음.** Electron 런타임 실측(contenteditable 편집, 디바운스 저장, 색상피커, srcDoc 재설정 안 됨 확인)은 패키징된 `.exe`를 CDP로 검증. 참고이미지를 매번 새로 생성하지 않고, 1.3 골격계약을 따르는 고정 샘플 HTML(`data-edit-id` 5종 + CSS 변수 4종 포함)을 테스트 폴더에 직접 배치한 뒤 `card:save-html`/contenteditable 동작을 CDP로 직접 호출/조작해 검증

## Dev Notes

- **편집 단위 = "텍스트 리프 엘리먼트"(Task 0의 신규 결정):** Claude가 생성하는 카드 내부 구조(클래스명, DOM 깊이)는 참고이미지마다 달라지므로, 특정 클래스명에 의존한 편집 대상 지정은 불가능하다. "자식 엘리먼트 없음 + 텍스트 보유"라는 구조 무관 규칙으로 일반화한 것이 이번 스토리의 핵심 결정이며, Story 1.5(코드창 동기화)도 동일한 "리프 텍스트 엘리먼트" 단위를 클릭→코드 위치 매핑의 기준으로 재사용해야 한다.
- **색상 변수는 `:root` 텍스트를 고치지 않고 `documentElement` 인라인 스타일로 덮어쓴다(Task 3 신규 결정):** CSS 우선순위상 인라인 스타일이 `:root{...}` 선택자보다 항상 우선하므로 즉시 적용되고, 원본 `<style>` 블록은 변경되지 않아 "구조는 그대로 유지"를 자연히 만족한다. `outerHTML` 직렬화 시 인라인 스타일도 함께 저장되므로 재로드 후에도 색상이 유지된다.
- **iframe `srcDoc`은 생성/재생성 시점에만 설정한다(Task 4 핵심 결정, 매우 중요):** React 상태(`card.html`)를 편집 중 갱신하면 `srcDoc` 변경 → iframe 전체 리로드 → 편집 내용 소실. 편집은 iframe의 라이브 DOM 안에서만 일어나고, 디스크 저장은 별도 채널(`card:save-html`)로 비동기 수행하며 React 상태와는 분리한다. **이 경계를 어기면 AC1("화면에 즉시 반영")이 깨진다.**
- **AD-1 준수:** 파일쓰기(`card:save-html`)는 Main에서만. Renderer는 `window.api.saveCardHtml`로만 요청.
- **AD-2 준수:** `data-edit-id` 영역 자체나 CSS 변수 4종의 이름을 이 스토리에서 변경하지 않는다 — Task 0/Task 3 모두 1.3이 확정한 계약을 그대로 소비만 한다.
- **AD-7 준수:** 저장 경로는 여전히 `naming.ts`의 `getCardHtmlPath` 단일 경유. `writeCardHtmlFile`은 이 경로를 계산만 호출하고 직접 조립하지 않는다.
- **API 키 무관:** 이번 스토리의 모든 기능(`card:save-html`)은 Claude API를 호출하지 않는다. API 키 미설정 상태에서도 인라인 편집이 동작해야 한다 — 1.3의 `getApiKey` 가드를 이 핸들러에 넣지 않도록 주의(실수로 복붙하면 키 없을 때 편집이 막히는 회귀가 생김).
- **디바운스:** 별도 라이브러리 없이 `setTimeout`/`clearTimeout` 기반 자체 구현으로 충분(약 500ms). 매 키 입력마다 IPC+디스크 쓰기를 하면 비용은 없지만(로컬 파일 IO) 불필요하게 빈번한 쓰기가 발생하므로 디바운스로 묶는다.

### Project Structure Notes

- `src/renderer/src/cardEditing.ts`, `cardEditing.test.ts` 신규 — 렌더러 코드지만 Electron/React에 의존하지 않는 순수 DOM 로직이라 별도 모듈로 분리(테스트 용이성).
- `src/main/storage/card.ts` 수정(리팩터링 — `writeCardHtmlFile` 추출), `src/main/ipc/card.ts` 수정(핸들러 추가), `src/shared/ipc-card.ts` 수정(타입 추가), `src/preload/index.ts`/`index.d.ts` 수정.
- `vitest.config.ts`는 수정하지 않는다 — 파일별 `// @vitest-environment jsdom` 주석으로 충분(electron-vite 멀티빌드 설정과 무관하게 vitest 레벨에서만 처리).
- `jsdom`을 devDependency로 추가(`npm install -D jsdom`).

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 권한분리, 카드 골격계약, 네이밍 유틸 단일화
- [PRD §4.2, FR-2](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 인라인 편집: 클릭 즉시수정, 별도 저장 버튼 없음
- [epics.md#Story-1.4](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-3-html-card-generation.md](./1-3-html-card-generation.md) — `data-edit-id` 5종/CSS 변수 4종 확정 내역, iframe `sandbox="allow-same-origin" srcDoc` 미리보기 구현, `card:*` IPC 패턴, IPC envelope 규칙, "검증은 IPC 레이어" 원칙

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 작업 중간 지점에서 사용자 요청으로 일시 정지(`작업 여기까지만 하고 저장해줘`). Task 0/1/2/5 및 Task 6의 단위테스트 3개 항목까지 완료, Task 3/4(색상 UI, 디바운스 저장 연결)와 Task 6의 CDP 실측 검증은 미완. 중단 시점에 코드가 깨지지 않도록 `card:save-html` 핸들러/preload 와이어링까지 완결한 상태로 체크포인트.

### Completion Notes List

- Task 0: `src/renderer/src/cardEditing.ts`에 `enableInlineEditing` 작성. 클래스명 비의존 규칙("자식 엘리먼트 없음 + 텍스트 보유")으로 리프 텍스트 엘리먼트만 `contentEditable=true` 설정, `Enter` 키 차단.
- Task 1: `main/storage/card.ts`에서 `writeCardHtmlFile`을 추출(경로계산+mkdir+write), `generateCard`가 이를 호출하도록 리팩터링. 기존 `generateCard` 테스트 회귀 없음 확인.
- Task 2: `card:save-html` IPC 채널 추가(`shared/ipc-card.ts` 타입, `main/ipc/card.ts` 핸들러). API 키 체크 없이 동작하도록 의도적으로 `getApiKey` 호출 생략(Dev Notes 경고사항 반영) — 테스트로 `getApiKey`가 호출되지 않음을 명시적으로 검증.
- Task 5: `src/preload/index.ts`/`index.d.ts`에 `saveCardHtml` API 노출.
- Task 6(일부): `cardEditing.test.ts`를 jsdom 환경(`// @vitest-environment jsdom`)으로 신규 작성(8건) — jsdom이 `<style>` 블록의 CSS 커스텀 프로퍼티를 cascade하지 않는 한계가 있어, "computed value 읽기" 테스트는 인라인 스타일로 시뮬레이션해 검증(실제 Electron Chromium 환경에서는 `:root` cascade가 정상 동작하므로 CDP 실측에서 재확인 필요 — 아직 미실시). `card.test.ts`(storage)에 `writeCardHtmlFile` 단위테스트 2건 추가. `card.test.ts`(ipc)에 `card:save-html` 핸들러 테스트 3건 추가(정상 저장/필드누락/쓰기실패, API 키 미체크 확인).
- 검증: 단위테스트 52건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과. **남은 작업(Task 3/4 UI 와이어링, Task 6 CDP 실측)은 후속 세션에서 이어서 진행 필요 — dev-story 워크플로가 아직 완료되지 않았으므로 Status는 `ready-for-dev`로 유지(코드 변경 사항은 Tasks/File List/Dev Agent Record에 정직하게 기록).**

### File List

- `package.json` (수정 — `jsdom` devDependency 추가)
- `src/renderer/src/cardEditing.ts` (신규)
- `src/renderer/src/cardEditing.test.ts` (신규)
- `src/main/storage/card.ts` (수정 — `writeCardHtmlFile` 추출)
- `src/main/storage/card.test.ts` (수정 — `writeCardHtmlFile` 단위테스트 추가)
- `src/shared/ipc-card.ts` (수정 — `CARD_SAVE_HTML_CHANNEL`, `SaveCardHtmlRequest`/`SaveCardHtmlResponseData` 추가)
- `src/main/ipc/card.ts` (수정 — `card:save-html` 핸들러 추가)
- `src/main/ipc/card.test.ts` (수정 — `card:save-html` 핸들러 테스트 추가)
- `src/preload/index.ts` (수정 — `saveCardHtml` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `saveCardHtml` 추가)
