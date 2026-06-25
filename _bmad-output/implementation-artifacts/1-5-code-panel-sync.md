---
baseline_commit: b9b8fca1d9c2874d1b5839c359f8dc674321a54e
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-4-card-inline-editing.md
---

# Story 1.5: 코드창 토글 및 동기화

Status: done

## Story

As a 운영자,
I want 필요할 때 코드창을 열어 직접 HTML을 고치고, 미리보기 요소를 클릭하면 코드 위치를 바로 찾을 수 있길,
so that 인라인 편집으로 안 되는 미세조정도 빠르게 할 수 있다.

## Acceptance Criteria

1. **Given** 카드 미리보기 화면에서, **When** 코드창 토글을 켜면, **Then** 현재 카드의 HTML 소스가 코드창에 표시된다.
2. **Given** 코드창이 열려있는 상태에서, **When** 미리보기의 특정 요소를 클릭하면, **Then** 코드창이 해당 요소의 코드 위치로 스크롤되고 하이라이트된다.
3. **Given** 코드창에서 코드를 직접 수정했을 때, **When** 수정을 하면, **Then** 별도 적용 버튼 없이 미리보기 화면이 갱신된다.
4. **Given** 코드창을 켠 상태에서, **When** 토글을 다시 끄면, **Then** 미리보기만 남고 마지막 수정 내용은 유지된다.

## Tasks / Subtasks

- [x] Task 0: 구현 방식 결정 (이번 스토리에서 신규 결정 — PRD/아키텍처 모두 구체적 메커니즘 미정) (AC: 1, 2, 3, 4)
  - [x] **코드 에디터 = 일반 `<textarea>`, 신규 의존성 추가 없음.** 이 프로젝트는 지금까지 런타임 의존성을 `@anthropic-ai/sdk`/Electron 생태계로만 최소화해왔다(CodeMirror/Monaco 등 에디터 라이브러리 미사용). 구문 강조(syntax highlighting)는 AC에 명시되지 않았으므로 범위 밖으로 두고, 일반 `<textarea>` + 수동 스크롤/선택영역 계산으로 AC2(클릭→하이라이트)·AC3(편집→갱신)를 충족한다. 새 의존성이 필요하다고 판단되면 코드 작성 전 사용자 승인을 받을 것(`dev-story` HALT 조건).
  - [x] **클릭→코드 위치 매칭은 `data-edit-id` 영역 단위.** 1.4에서 leaf 텍스트 엘리먼트는 임의 클래스명이라 식별 불가능했던 것과 동일한 이유로, 클릭한 요소의 `closest('[data-edit-id]')`로 가장 가까운 영역(`title-bar`/`bullet-{n}`/`icon-{n}`/`footer`)을 찾아 그 영역 전체(여는 태그~매칭되는 닫는 태그)를 하이라이트한다. leaf 텍스트 하나하나를 정확히 짚지는 않음(범위 밖).
  - [x] **코드창이 닫혀있을 때 미리보기 클릭은 아무 동작도 하지 않는다.** AC2는 "코드창이 열려있는 상태에서"를 전제로 하므로, 닫혀있을 때 클릭해서 자동으로 열리게 하지 않는다(명시적 토글 액션만 코드창을 열고 닫는다).
  - [x] **코드창 텍스트는 카드별 독립 상태(`codeText`)로 보유하고, 디바운스(500ms) 후에만 iframe `srcDoc`/디스크에 반영한다.** 1.4의 inline 편집은 "절대 `card.html`/`srcDoc`을 갱신하지 않는다"는 결정이었지만, 코드창 편집은 정반대다 — 사용자가 raw HTML 자체를 고치는 행위이므로 변경을 즉시 반영하려면 iframe을 다시 로드(=`srcDoc` 갱신)하는 것이 올바른 동작이다. 단, 매 키 입력마다 iframe을 리로드하면 타이핑이 끊기므로 textarea 자체 값은 매 입력마다 즉시 갱신(컨트롤드 인풋)하되, `card.html`(=iframe `srcDoc`) 커밋과 디스크 저장은 500ms 디바운스로 묶는다.
  - [x] **코드창을 열 때마다 현재 iframe의 라이브 DOM에서 코드를 다시 읽어온다(React `card.html` 상태가 아니라).** 1.4의 inline contenteditable 편집은 `card.html` state를 갱신하지 않으므로, 코드창을 열기 전에 인라인 편집을 했다면 `card.html`은 이미 stale하다. 토글 ON 시 `iframeRefs`에 저장된 해당 카드 iframe의 `contentDocument`를 `serializeCardDocument`로 직렬화해 `codeText`의 초기값으로 사용해야 AC1("현재 카드의 HTML 소스")을 정확히 만족한다.
  - [x] **잘못된/불완전한 HTML 입력에 대한 별도 검증은 하지 않는다.** `DOMParser`는 깨진 마크업도 best-effort로 파싱하므로, 코드창에서 직접 수정한 내용은 검증 없이 그대로 반영한다(사용자가 코드를 직접 건드리는 기능의 의도된 동작 — 골격계약 위반 검증은 Story 1.6의 AI 편집 결과에만 적용된다).

- [x] Task 1: 코드 위치 매칭 유틸 (AC: 2)
  - [x] `src/renderer/src/cardEditing.ts`에 `findElementRange(html: string, editId: string): { start: number; end: number } | null` 추가: 정규식 `/<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g`로 `html` 문자열의 모든 여는/닫는 태그를 토큰화하면서, `data-edit-id="${editId}"`를 포함하는 여는 태그를 찾으면 그 태그의 태그이름으로 깊이(depth) 카운터를 시작하고, 같은 태그이름의 여는/닫는 태그를 깊이 추적해 깊이가 0으로 돌아오는 지점(매칭되는 닫는 태그의 끝)까지를 `{ start, end }`(문자 인덱스, `html.slice(start, end)`가 해당 엘리먼트의 전체 마크업)로 반환. 일치하는 `data-edit-id`가 없으면 `null` 반환. (1.3 골격계약상 `bullet-{n}` 내부에 `icon-{n}`이 중첩될 수 있으므로 단순 `indexOf` 매칭이 아니라 깊이 추적이 필요함 — Task 0 참고)
  - [x] `cardEditing.test.ts`에 단위테스트 추가: 중첩 구조(예: `bullet-1` 안에 `icon-1`)에서 `bullet-1` 전체 범위와 `icon-1`만의 좁은 범위를 각각 정확히 찾는지, 같은 태그이름이 형제로 여러 번 나와도(`bullet-1`, `bullet-2`) 혼동 없이 찾는지, 존재하지 않는 `editId`는 `null`을 반환하는지 검증.

- [x] Task 2: 코드창 토글 UI (AC: 1, 4)
  - [x] `App.tsx`에 카드별 상태 추가: `codePanelOpen: Record<number, boolean>`, `codeText: Record<number, string>`, 그리고 textarea DOM 참조용 `codeTextareaRefs = useRef(new Map<number, HTMLTextAreaElement>())`.
  - [x] 각 카드 미리보기(재생성 버튼 근처)에 "코드 보기" 토글 버튼 추가. 토글 ON 시: 해당 카드의 `iframeRefs.current.get(card.index)?.contentDocument`를 `serializeCardDocument`로 직렬화해 `codeText[card.index]`에 채우고 `codePanelOpen[card.index] = true`. 토글 OFF 시: `codePanelOpen[card.index] = false`로만 변경(이미 디바운스로 `card.html`/디스크에 반영된 `codeText`는 그대로 유지 — AC4가 요구하는 동작).
  - [x] `codePanelOpen[card.index]`가 true일 때만 `<textarea className="card-code-panel" ref={...}>` 렌더링, `value={codeText[card.index] ?? ''}`로 컨트롤드 인풋.

- [x] Task 3: 클릭 → 코드 위치 하이라이트 (AC: 2)
  - [x] `handleCardIframeLoad`(1.4에서 'input' 리스너를 등록하는 곳)에 'click' 리스너를 추가 등록: 클릭된 `event.target`에서 `(event.target as Element).closest('[data-edit-id]')`로 가장 가까운 영역을 찾고, 없으면 무시. 있으면 `data-edit-id` 값을 가지고 새 핸들러(`handleElementClick(cardIndex, editId)`)를 호출.
  - [x] `handleElementClick`: `codePanelOpen[cardIndex]`가 false면 아무 동작 없음(Task 0 결정). true면 `findElementRange(codeText[cardIndex], editId)`로 범위를 구하고, 결과가 있으면 해당 카드의 textarea를 `codeTextareaRefs`에서 찾아 `.focus()` 후 `.setSelectionRange(start, end)`로 선택(브라우저가 선택영역을 표시하는 것 자체가 "하이라이트") + 스크롤: `codeText[cardIndex].slice(0, start)`의 개행 수 × textarea의 한 줄 높이(`textarea.scrollHeight / 줄수` 또는 고정 `line-height` CSS 값 사용)로 대략적인 `scrollTop`을 계산해 설정.

- [x] Task 4: 코드 편집 → 미리보기 갱신 + 저장 연결 (AC: 3, 4)
  - [x] textarea `onChange`: `codeText[cardIndex]`를 즉시(디바운스 없이) 갱신해 타이핑이 끊기지 않게 한다. 동시에 기존 `scheduleSave`와 유사한 패턴으로 새 디바운스 타이머(500ms, 카드별로 기존 `saveTimers` 재사용 가능 — 단 inline 편집과 코드 편집이 동시에 같은 카드에 일어나는 경우는 없다고 가정하고 동일 타이머 슬롯을 공유해도 무방)를 걸어, 타이머 만료 시: (a) `setCards`로 해당 카드의 `html` 필드를 최신 `codeText` 값으로 갱신(iframe `srcDoc`가 바뀌며 자동 리로드되어 AC3 "미리보기 화면이 갱신된다" 충족), (b) `window.api.saveCardHtml({ htmlPath, html: codeText값 })` 호출(1.4와 동일한 저장 경로, htmlPath는 기존 `card.htmlPath` 재사용).
  - [x] iframe이 코드 편집으로 리로드되면 `onLoad`가 다시 호출되어 `enableInlineEditing`/click/input 리스너가 자동 재등록됨(1.4 기존 동작 그대로, 추가 작업 불필요) — 단 `iframeRefs`/`cardCssValues` 갱신도 자동으로 다시 일어나는지 확인.
  - [x] 저장 실패 시 기존 `card.saveError` 표시 메커니즘을 그대로 재사용(별도 UI 불필요).

- [x] Task 5: 테스트 (AC: 1, 2, 3, 4)
  - [x] `findElementRange` 단위테스트는 Task 1에서 작성.
  - [x] **Claude API 호출 없이 검증 가능 — 비용 발생 없음.** Electron 런타임 실측(CDP, 1.4와 동일한 방법론): 1.3 골격계약을 따르는 고정 샘플 HTML을 카드 상태에 주입한 뒤 (1) 토글 ON 시 코드창에 현재 소스가 표시되는지, (2) 미리보기 요소 클릭 시 코드창 선택영역이 해당 `data-edit-id` 범위로 이동하는지, (3) 코드창 텍스트를 변경하면 디바운스 후 iframe이 갱신되고 `card:save-html`이 새 HTML로 호출되는지, (4) 토글 OFF 후에도 마지막 수정 내용이 `card.html`/디스크에 남아있는지 확인. 전부 PASS — 추가로 (5) 코드창이 닫혀있을 때 미리보기 클릭이 아무 동작도 하지 않는지, (6) 코드창을 다시 열면 인라인 편집(contenteditable)으로 변경된 라이브 DOM의 최신 내용이 반영되는지도 PASS 확인.

### Review Findings

- [x] [Review][Patch] 카드 재생성 시 열려있던 코드창이 재생성 이전 HTML을 그대로 보여줘, 사용자가 그 상태에서 코드를 수정하면 방금 재생성된 파일을 stale 내용으로 덮어쓸 수 있던 문제 — 이미 반영됨: `handleRegenerateCard` 시작 시 해당 카드의 코드창을 자동으로 닫음(`codePanelOpen[index] = false`) [src/renderer/src/App.tsx]
- [x] [Review][Patch] 코드창 토글 ON 시 해당 카드의 iframe이 아직 로드되지 않아 `iframeRefs`에 항목이 없으면(타이밍上 매우 좁은 구간) `codeText`가 채워지지 않아 빈 패널이 표시되던 문제 — 이미 반영됨: 라이브 iframe 문서가 없으면 `cardsRef`의 `card.html`로 폴백 [src/renderer/src/App.tsx]
- [x] [Review][Defer] `findElementRange`의 `full.includes(marker)` 매칭이, 사용자가 코드창에서 직접 편집해 다른 속성값 안에 우연히 `data-edit-id="X"` 리터럴 문자열이 들어가는 극단적 경우 잘못된 여는 태그를 찾을 수 있음 [src/renderer/src/cardEditing.ts] — deferred, 속성명까지 구분하는 파싱이 필요해 비용 대비 위험이 낮음(사용자가 의도적으로 그런 텍스트를 attrs에 넣는 경우만 발생).

## Dev Notes

- **이번 스토리의 핵심 긴장 관계: 1.4의 "srcDoc 절대 갱신 금지" 규칙이 코드창 편집에는 적용되지 않는다.** 1.4 Dev Notes는 inline contenteditable 편집 시 `card.html`을 갱신하면 iframe이 리로드되어 커서/포커스가 날아간다고 경고했다. 코드창 편집은 다르다 — 사용자의 입력 포커스는 textarea에 있고, iframe은 단지 "결과 미리보기"이므로 iframe이 리로드되어도 사용자 입력 흐름이 끊기지 않는다. 따라서 코드창 변경은 디바운스 후 `card.html`을 갱신해도 안전하며, AC3("미리보기 화면이 갱신된다")가 정확히 이 갱신을 요구한다. 두 편집 경로(inline vs 코드창)의 `card.html` 갱신 정책이 다르다는 점을 dev-story 실행 시 반드시 인지할 것.
- **`findElementRange`는 1.4의 `enableInlineEditing`과 같은 파일(`cardEditing.ts`)에 추가한다.** 순수 문자열/DOM 로직이라 Electron 없이 테스트 가능한 기존 패턴을 따른다.
- **AD-2 준수:** `data-edit-id` 영역 자체의 명명 규칙을 이 스토리에서 변경하지 않는다 — 1.3에서 확정된 5종(`title-bar`/`bullet-{n}`/`icon-{n}`/`footer`)을 그대로 클릭 대상 식별에 사용한다.
- **AD-1 준수:** `card:save-html` 외 새 IPC 채널은 필요 없다 — 코드창 저장도 1.4에서 만든 동일 채널/`htmlPath` 계약을 재사용한다.
- **1.4 코드리뷰에서 고친 두 버그(자정 경계 날짜 재계산, 재생성 시 stale 타이머)는 이미 `htmlPath` 직접 재사용 + 재생성 시 타이머 취소로 해결되어 있다.** 코드창의 디바운스 저장도 동일한 `cardsRef.current.find(...).htmlPath` 룩업 패턴을 그대로 따라야 같은 버그가 재발하지 않는다 — `scheduleSave` 함수를 재사용하거나 그 패턴을 그대로 복제할 것.
- **디바운스 타이머 공유 여부:** inline 편집(`input` 이벤트)과 코드창 편집이 같은 `saveTimers` 맵 슬롯(카드 인덱스 키)을 공유해도 문제없다 — 두 편집 경로가 사실상 동시에 같은 카드에 발생하는 경우는 UX상 없다고 가정(코드창이 열려있으면 보통 inline 편집보다 코드 편집을 사용). 굳이 분리할 필요 없음.

### Project Structure Notes

- `src/renderer/src/cardEditing.ts` 수정(`findElementRange` 추가), `cardEditing.test.ts` 수정(신규 테스트).
- `src/renderer/src/App.tsx` 수정(코드창 토글 UI, 클릭 핸들러, 디바운스 커밋 로직). 신규 파일 없음.
- 신규 의존성 없음(Task 0 결정 참고). `assets/main.css`에 `.card-code-panel` 등 최소 스타일(예: `font-family: monospace`, 고정 height) 추가는 허용.

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-2](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 권한분리, 카드 골격계약(`data-edit-id`)
- [PRD §4.2, FR-2/FR-3](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 코드창 토글/동기화
- [epics.md#Story-1.5](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-4-card-inline-editing.md](./1-4-card-inline-editing.md) — `data-edit-id` 5종/CSS 변수 4종, inline 편집 vs 코드창 편집의 `srcDoc` 정책 차이, `card:save-html`/`htmlPath` 계약, 코드리뷰에서 발견된 날짜 재계산·재생성 경쟁조건 버그와 수정 방법, CDP 실측 검증 방법론

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- CDP 실측은 1.4와 동일한 방법론(빌드된 앱을 `--remote-debugging-port`로 직접 기동 + `App.tsx`에 `setCards`/`setFolderPath`/`setKeyword`를 노출하는 임시 디버그 훅 주입 → 검증 후 즉시 제거 + 재빌드)을 재사용. `ELECTRON_RUN_AS_NODE` 환경변수가 켜져 있으면 `electron.exe`가 일반 Node로 동작해 앱이 뜨지 않는 함정도 동일하게 `env -u ELECTRON_RUN_AS_NODE`로 우회.
- 실측 시나리오: (1) 토글 ON → 코드창에 현재 소스 표시 확인, (2) `.bullet-title`(중첩된 `icon-1`을 포함하는 `bullet-1` 영역) 클릭 → 코드창 선택영역이 `bullet-1` 전체 마크업과 정확히 일치 + 포커스/스크롤 이동 확인, (3) 코드창에서 제목 텍스트를 직접 수정 → 500ms 후 iframe `srcDoc`/라이브 DOM 갱신 + 디스크 파일에 반영 확인, (4) 토글 OFF 후 iframe에 마지막 수정 내용이 그대로 남아있는지 확인, (5) 코드창이 닫힌 상태에서 미리보기 클릭 시 아무 동작도 하지 않는지(에러 없음, 코드창 안 열림) 확인, (6) 인라인 contenteditable 편집(코드창과 무관하게 `card.html`을 갱신하지 않는 1.4의 경로) 후 코드창을 다시 열면 라이브 DOM의 최신 내용이 반영되는지 확인. 전부 PASS.

### Completion Notes List

- Task 0: 구현 방식 결정 — 신규 의존성 없이 `<textarea>` 기반 코드창, `data-edit-id` 영역 단위 클릭→하이라이트, 코드창 편집은 1.4의 "srcDoc 절대 갱신 금지"와 반대로 디바운스 후 `srcDoc`/디스크 반영을 허용.
- Task 1: `cardEditing.ts`에 `findElementRange(html, editId)` 추가 — 태그 토큰화 + 같은 태그이름 깊이 추적으로 중첩된 `data-edit-id` 영역(예: `bullet-1` 안의 `icon-1`)도 정확히 매칭. 단위테스트 4건(중첩 전체범위/좁은범위, 형제 태그명 혼동 방지, 존재하지 않는 editId → null) 추가, 전부 통과.
- Task 2: `App.tsx`에 카드별 `codePanelOpen`/`codeText` 상태와 토글 버튼("코드 보기"/"코드 닫기") 추가. 토글 ON 시 `iframeRefs`의 라이브 iframe `contentDocument`를 `serializeCardDocument`로 직렬화해 `codeText`를 채움(React `card.html` 상태가 아니라 — 1.4의 inline 편집이 `card.html`을 갱신하지 않으므로 stale 방지).
- Task 3: `handleCardIframeLoad`에 'click' 리스너 추가, `closest('[data-edit-id]')`로 가장 가까운 영역을 찾아 `handleElementClick` 호출. `codePanelOpenRef`/`codeTextRef`(useRef로 최신 상태 추적, 기존 `cardsRef` 패턴과 동일)를 통해 한 번만 등록된 클릭 리스너 클로저에서도 항상 최신 상태를 참조하도록 구현. `findElementRange`로 범위를 구해 `textarea.setSelectionRange` + 줄 수 기반 `scrollTop` 계산으로 스크롤.
- Task 4: textarea `onChange`는 `codeText`를 즉시 갱신(타이핑 끊김 없음) + `scheduleCodeCommit`으로 500ms 디바운스 후 `card.html` 갱신(iframe 리로드) + `window.api.saveCardHtml` 호출. `htmlPath` 룩업은 1.4 코드리뷰에서 확립된 `cardsRef.current.find(...).htmlPath` 패턴을 그대로 재사용(날짜 재계산 버그 재발 방지).
- Task 5: 단위테스트 58건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과, CDP 실측 전체 PASS(AC1~4 + 추가 엣지케이스 2건). 모든 태스크 완료.

### File List

- `src/renderer/src/cardEditing.ts` (수정 — `findElementRange` 추가)
- `src/renderer/src/cardEditing.test.ts` (수정 — `findElementRange` 단위테스트 4건 추가)
- `src/renderer/src/App.tsx` (수정 — 코드창 토글 상태/UI, 클릭→하이라이트 핸들러, 코드 편집→미리보기 갱신/저장 디바운스 로직)
- `src/renderer/src/assets/main.css` (수정 — `.card-code-panel` 스타일 추가)

### Change Log

- 2026-06-26: Story 1.5 구현 완료 — 코드창 토글(AC1), 클릭→코드 위치 하이라이트(AC2), 코드 편집→미리보기 실시간 갱신(AC3), 토글 OFF 후 수정 유지(AC4). 신규 의존성 없음(`<textarea>` 기반). CDP 실측 검증 전체 PASS. Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(Edge Case Hunter) 진행, patch 2건 발견 즉시 반영 — 재생성 시 stale 코드창 자동 닫기, 토글 시 iframe 미로드 상태의 `card.html` 폴백. defer 1건은 `deferred-work.md`에 기록. Status: review → done.
