---
baseline_commit: 11e5da4642e7e5fffe4e5d5591b6435eb73bcc0f
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-4-card-inline-editing.md
  - _bmad-output/implementation-artifacts/1-5-code-panel-sync.md
---

# Story 1.6: 자연어 지시 기반 AI 편집

Status: done

## Story

As a 운영자,
I want 자연어로 수정 지시를 입력하면 Claude가 카드 HTML을 고쳐주길,
so that 직접 코드를 건드리지 않고도 복잡한 수정을 빠르게 처리할 수 있다.

## Acceptance Criteria

1. **Given** 카드 미리보기/코드창이 열려있는 상태에서, **When** 자연어 지시(예: "이 카드 색상을 파란색으로 바꿔줘")를 입력하고 전송하면, **Then** 현재 카드의 HTML과 지시문이 Claude API(FR-1과 동일 키)로 전달되고, 수정된 HTML을 받아 미리보기와 코드창에 반영한다.
2. **Given** Claude가 수정한 결과가 카드 골격계약(data-edit-id, CSS 색상변수)을 벗어났을 때, **When** 결과를 받으면, **Then** 적용을 거부하고 사용자에게 계약 위반 사실을 알린다(원본 유지).
3. **Given** AI 편집 결과가 만족스럽지 않을 때, **When** 되돌리기를 선택하면, **Then** AI 편집 적용 이전 상태로 복원된다.

## Tasks / Subtasks

- [x] Task 0: 구현 방식 결정 (이번 스토리에서 신규 결정 — PRD/아키텍처 모두 구체적 메커니즘 미정) (AC: 1, 2, 3)
  - [x] **골격계약 검증 규칙(AC2)을 구체화한다.** 1.3 시스템 프롬프트(`card-system-prompt.ts`)가 강제하는 계약을 그대로 검증 기준으로 사용: (a) `data-edit-id="title-bar"`가 정확히 1개, (b) `data-edit-id="footer"`가 정확히 1개, (c) `bullet-{n}`/`icon-{n}` 쌍이 1부터 빠짐없이 순차 증가하며 개수가 서로 일치, (d) `--card-bg-color`/`--card-primary-color`/`--card-text-color`/`--card-accent-color` 4개 변수가 모두 `:`로 선언된 형태로 등장. 이 4가지 중 하나라도 깨지면 위반으로 간주하고 적용을 거부한다. 텍스트 내용 자체의 적절성(원본 90% 반영 등)은 검증하지 않는다(자동 검증 범위 밖, AC2는 "구조" 계약만 명시).
  - [x] **`CARD_CSS_VARIABLES` 상수와 검증 로직을 `src/shared/cardSkeleton.ts`(신규)로 옮긴다.** 현재 `CARD_CSS_VARIABLES`는 `src/renderer/src/cardEditing.ts`에만 존재하는데, 이번 스토리의 검증은 Main 프로세스(Claude 응답을 받는 곳, AD-1 — API 호출은 Main에서만)에서 실행되어야 하므로 Renderer 전용 모듈을 Main이 import할 수 없다(electron-vite가 renderer/main 빌드를 분리하며, `cardEditing.ts`는 브라우저 DOM API(`Document`, `getComputedStyle`)에 의존해 Main에서 동작하지 않음). 공유 가능한 순수 상수/문자열 로직만 `src/shared/cardSkeleton.ts`로 분리하고, `cardEditing.ts`는 이 모듈의 `CARD_CSS_VARIABLES`를 재노출(`export { CARD_CSS_VARIABLES } from '../../shared/cardSkeleton'`)해 기존 import(`App.tsx`, `cardEditing.test.ts`)가 깨지지 않게 한다.
  - [x] **AI 편집용 새 시스템 프롬프트(`card-edit-system-prompt.ts`, 신규)를 만든다.** 기존 `CARD_SYSTEM_PROMPT`(1.3)는 "참고이미지 → 신규 생성"을 가정한 프롬프트라 "기존 HTML + 자연어 지시 → 수정"이라는 다른 입력 형태에 맞지 않는다. 새 프롬프트는 동일한 골격계약 규칙(Task 0 첫 항목과 동일한 4가지)을 반복 명시하고, "전달된 기존 HTML을 지시에 따라 최소한으로 수정해 반환하라, 골격계약과 무관한 부분은 최대한 원본 그대로 유지하라, 마크다운 코드블록/설명 텍스트 없이 완전한 HTML 문서만 반환하라"를 요구한다.
  - [x] **AI 편집 요청 시 전달하는 HTML은 항상 "라이브 iframe DOM"을 직렬화한 것이다(React `card.html` 상태가 아니라).** 1.5에서 코드창을 열 때 라이브 DOM을 다시 읽어오기로 한 것과 동일한 이유 — 인라인 편집/코드창 편집이 아직 `card.html`에 커밋되지 않은 상태일 수 있으므로, AI에게 보내는 "현재 카드의 HTML"(AC1)은 화면에 실제로 보이는 최신 상태여야 한다.
  - [x] **되돌리기(AC3)는 단일 단계(1-depth)만 지원한다.** AI 편집을 적용할 때마다 적용 직전의 `card.html`을 카드별 `previousHtml` 상태에 1개만 저장(이전 값은 덮어씀)하고, "되돌리기"는 그 값으로 복원 후 다시 디스크에 저장한다. 여러 단계 undo 히스토리, redo는 AC에 없으므로 범위 밖. 되돌리기를 한 번 사용하면 `previousHtml`은 비워져 같은 카드에서 연속으로 되돌리기를 누를 수 없다(되돌릴 대상이 없으므로).
  - [x] **AI 편집은 비용이 드는 실제 Claude API 호출이다 — 단위테스트는 1.3의 `generateHtml` 주입 패턴과 동일하게 `editCardHtml` 함수를 의존성 주입 가능한 형태로 만들어 모킹하고, 실제 토큰 비용 없이 검증한다.** Main IPC 핸들러 로직(검증 통과/실패 분기, API 키 체크, 디스크 쓰기)은 전부 모킹된 응답으로 테스트 가능. 단, "Claude가 실제로 골격계약을 지키는 결과를 반환하는지"는 자동 테스트 범위 밖이다(이미 1.3에서 동일하게 시스템 프롬프트로만 유도하기로 결정됨 — `deferred-work.md` 참고).

- [x] Task 1: 골격계약 검증 유틸 (AC: 2)
  - [x] `src/shared/cardSkeleton.ts`(신규)에 `CARD_CSS_VARIABLES`(기존 `cardEditing.ts`에서 이동) + `validateCardSkeleton(html: string): { valid: boolean; violations: string[] }` 추가: Task 0에서 정한 4가지 규칙을 각각 검사해 위반 항목을 한국어 메시지 배열로 모아 반환(예: `'제목바(title-bar) 영역이 없습니다'`, `'불릿(bullet-2)에 대응하는 아이콘(icon-2)이 없습니다'`, `'CSS 변수 --card-accent-color가 선언되지 않았습니다'`). 하나도 위반이 없으면 `{ valid: true, violations: [] }`.
  - [x] `src/renderer/src/cardEditing.ts`를 수정해 `CARD_CSS_VARIABLES`를 `../../shared/cardSkeleton`에서 재노출하도록 변경(중복 선언 제거, 기존 import 경로 유지).
  - [x] `src/shared/cardSkeleton.test.ts`(신규)에 단위테스트 추가: 정상 골격(1.3/1.4/1.5에서 쓰던 샘플 HTML)은 `valid: true`, title-bar 누락/footer 중복/bullet-icon 개수 불일치/누락된 CSS 변수 각각에 대해 정확한 위반 메시지가 포함된 `valid: false`를 반환하는지 검증.

- [x] Task 2: AI 편집 Claude API 클라이언트 함수 (AC: 1)
  - [x] `src/templates/card-edit-system-prompt.ts`(신규)에 `CARD_EDIT_SYSTEM_PROMPT` 작성(Task 0 세 번째 항목 내용 그대로).
  - [x] `src/main/api/claude.ts`에 `editCardHtml(client: Anthropic, currentHtml: string, instruction: string): Promise<string>` 추가: `generateCardHtml`과 동일한 모델/타임아웃/응답 텍스트 추출 패턴을 재사용하되, `system: CARD_EDIT_SYSTEM_PROMPT`로 바꾸고 `messages`는 이미지 블록 없이 텍스트만(현재 HTML 전체 + 지시문)으로 구성. 빈 응답이면 `generateCardHtml`과 동일하게 에러 throw.

- [x] Task 3: `card:edit-with-instruction` IPC 핸들러 (AC: 1, 2)
  - [x] `src/shared/ipc-card.ts`에 `CARD_EDIT_WITH_INSTRUCTION_CHANNEL = 'card:edit-with-instruction'`, `EditCardWithInstructionRequest { htmlPath: string; html: string; instruction: string }`, `EditCardWithInstructionResponseData { html: string }` 추가.
  - [x] `src/main/ipc/card.ts`에 핸들러 추가: `htmlPath`/`html`/`instruction`이 비어있으면(trim 후 빈 문자열) 에러 반환(기존 검증 패턴 재사용) → API 키 미설정이면 `API_KEY_MISSING_MESSAGE` 반환(이 핸들러는 Claude API를 호출하므로 1.4의 `card:save-html`과 달리 키 체크가 **필요**함 — 혼동 주의) → `editCardHtml(client, request.html, request.instruction)` 호출 → 결과를 `validateCardSkeleton`으로 검증 → 위반 시 `{ok:false, error:{message: violations.join('; ')}}` 반환(디스크에 쓰지 않음, 원본 유지 = AC2) → 통과 시 `overwriteCardHtmlFile(request.htmlPath, html)`로 저장 후 `{ok:true, data:{html}}` 반환.
  - [x] API 호출 자체가 실패(네트워크 오류 등)하면 try/catch로 캐치해 `{ok:false, error}` 반환(throw 금지, 기존 envelope 규칙 준수).
  - [x] `src/main/ipc/card.test.ts`에 핸들러 테스트 추가: 정상 편집(검증 통과 → 저장 호출됨), 골격계약 위반 응답(저장 호출 안 됨 + 위반 메시지 반환), API 키 미설정 시 에러, 필수 필드 누락 시 에러, Claude API 호출 자체가 실패하는 경우. `'../api/claude'` 모듈의 `editCardHtml`을 모킹해 실제 토큰 비용 없이 검증(Task 0 참고). (부수적으로 `vi.clearAllMocks()`가 이전 테스트의 `mockImplementation`을 지우지 않아 테스트 간 오염이 발생하는 기존 버그를 발견해 `vi.resetAllMocks()`로 교체)

- [x] Task 4: Preload 타입드 API + Renderer UI (AC: 1, 2, 3)
  - [x] `src/preload/index.ts`/`index.d.ts`에 `editCardWithInstruction(request: EditCardWithInstructionRequest): Promise<IpcResult<EditCardWithInstructionResponseData>>` 추가.
  - [x] `App.tsx`에 카드별 상태 추가: `instructionText: Record<number, string>`(입력창 값), `previousHtml: Record<number, string>`(되돌리기용 1단계 스냅샷), `applyingInstruction: Record<number, boolean>`(전송 중 로딩).
  - [x] 각 카드 미리보기에 자연어 지시 입력(`<input type="text">` 또는 `<textarea>`, 작은 크기) + "적용" 버튼 추가. 클릭 시 `handleApplyInstruction(card)`: (1) 라이브 iframe `contentDocument`를 `serializeCardDocument`로 직렬화해 현재 HTML 확보(Task 0 결정), (2) `window.api.editCardWithInstruction({htmlPath: card.htmlPath, html: 현재HTML, instruction: instructionText[card.index]})` 호출, (3) 성공 시 적용 직전 `card.html`을 `previousHtml[card.index]`에 저장 → `setCards`로 `card.html`을 응답받은 새 HTML로 갱신(iframe이 리로드되며 미리보기에 반영, AC1) → 코드창이 열려있으면(`codePanelOpen[card.index]`) `codeText[card.index]`도 같은 새 HTML로 갱신(AC1 "코드창에도 반영"), (4) 실패 시(계약 위반 또는 API 오류) `card.html`을 변경하지 않고 에러 메시지를 표시(AC2 "원본 유지").
  - [x] `previousHtml[card.index]`가 존재할 때만 "되돌리기" 버튼 표시. 클릭 시 `handleRevertInstruction(card)`: `card.html`을 `previousHtml[card.index]` 값으로 되돌리고, `window.api.saveCardHtml({htmlPath: card.htmlPath, html: 되돌린값})`으로 디스크에도 반영(파일과 화면 상태 일치 유지), `previousHtml[card.index]`를 삭제(1단계 제한, Task 0 참고). 코드창이 열려있으면 `codeText[card.index]`도 함께 갱신. (1.5 코드리뷰에서 발견된 "재생성 시 stale 상태" 패턴을 미리 방지하기 위해 재생성 시에도 `previousHtml`을 함께 삭제하도록 `handleRegenerateCard`에 추가.)
  - [x] 전송 중에는 "적용" 버튼 비활성화 + 간단한 로딩 표시(`applyingInstruction[card.index]`), Claude 응답이 1~2분 걸릴 수 있으므로(기존 `generateCardHtml`과 동일한 120초 타임아웃) 사용자가 중복 클릭하지 않도록 한다.

- [x] Task 5: 테스트 (AC: 1, 2, 3)
  - [x] `cardSkeleton.test.ts`는 Task 1에서 작성.
  - [x] `main/ipc/card.test.ts` 추가 테스트는 Task 3에서 작성.
  - [x] **Claude API 호출 없이 검증 가능 — 비용 발생 없음.** Renderer UI 와이어링은 1.4/1.5와 동일한 CDP 방법론으로 검증. `window.api`가 frozen이라 성공 응답을 가정한 상태 반영은 임시 디버그 훅(`setCards`/`setPreviousHtml`/`setFolderPath`/`setKeyword`/`setInstructionText` 노출, 검증 후 제거)으로 시뮬레이션해 확인: (1) 지시 입력 시 적용 버튼이 활성화되는지, (2) 적용 성공을 가정한 상태 주입 시 미리보기(iframe `srcDoc`)가 새 HTML로 갱신되고 되돌리기 버튼이 나타나는지. 되돌리기(AC3)는 **실제 `window.api.saveCardHtml` IPC를 그대로 호출하는 실제 `handleRevertInstruction`을 클릭으로 직접 실행**해 검증(비용 없음, Claude 미호출) — 클릭 후 미리보기가 직전 상태로 정확히 복원되고 되돌리기 버튼이 사라지며(1단계 제한), 디스크 파일도 복원된 내용으로 갱신됨을 확인. PASS. 적용 실패(AC2, 계약 위반 거부) 경로는 Main IPC 핸들러 단위테스트(Task 3)로 이미 검증되어 있고, 실패 시 `card.html`을 전혀 건드리지 않는 단순한 분기라 추가 CDP 검증은 생략.

### Review Findings

- [x] [Review][Patch] `handleApplyInstruction`이 보류 중인 디바운스 저장 타이머(`saveTimers`)를 취소하지 않아, AI 편집 완료 후 stale 인라인/코드창 저장이 늦게 실행되어 방금 편집한 파일을 덮어쓸 수 있던 문제 — 이미 반영됨: 1.4/1.5에서 재생성 시 적용한 동일 패턴(시작 시 타이머 취소)을 적용 [src/renderer/src/App.tsx]
- [x] [Review][Patch] 재생성과 AI 지시 편집이 사용자 액션으로 동시에 트리거될 수 있어 마지막에 끝나는 쪽이 다른 쪽 결과를 조용히 덮어쓰던 경쟁 조건 — 이미 반영됨: "재생성" 버튼은 `applyingInstruction` 중 비활성화, "적용"/지시 입력/"되돌리기"는 `card.regenerating` 중 비활성화 [src/renderer/src/App.tsx]
- [x] [Review][Patch] `handleRevertInstruction`이 디스크 저장 완료를 기다리지 않고 `previousHtml` 스냅샷을 먼저 삭제해, 저장이 실패하면 화면/디스크가 불일치하고 재시도할 스냅샷도 사라지던 문제 — 이미 반영됨: 저장 성공 시에만 스냅샷 삭제 [src/renderer/src/App.tsx]
- [x] [Review][Patch] `validateCardSkeleton`의 불릿 번호 검증이 첫 번째 빈틈(gap)에서 루프를 멈춰, 빈틈 이후의 불릿(예: bullet-1, bullet-2, bullet-4에서 bullet-3 누락)을 전혀 검사하지 않고 통과시키던 false-pass — 이미 반영됨: 빈틈 발견 시 이후 범위(최대 20)를 추가로 스캔해 비순차 불릿 존재를 위반으로 기록, 단위테스트 추가 [src/shared/cardSkeleton.ts, cardSkeleton.test.ts]
- [x] [Review][Patch] `handleRegenerateCard`가 재생성 시작 시점에 무조건 코드창을 닫고 되돌리기 스냅샷을 삭제해, 재생성이 실패해도(card.html 불변) 사용자의 코드창/되돌리기 기능이 불필요하게 사라지던 문제 — 이미 반영됨: 두 정리 작업을 성공 분기로 이동 [src/renderer/src/App.tsx]
- [x] [Review][Patch] "적용" 버튼이 React state 기반 `disabled`만으로 막혀있어, state가 아직 반영되기 전 빠른 더블클릭 시 동시에 두 번 호출될 수 있던 경쟁 조건 — 이미 반영됨: 함수 진입 시 동기적으로 확인하는 `Set` 기반 ref 가드 추가 [src/renderer/src/App.tsx]
- [x] [Review][Patch] AI 편집 적용 성공 후 지시 입력창의 텍스트가 그대로 남아있어 실수로 같은 지시를 재전송하기 쉬운 UX 문제 — 이미 반영됨: 성공 시 `instructionText` 초기화 [src/renderer/src/App.tsx]
- [x] [Review][Defer] `validateCardSkeleton`의 CSS 변수 선언 검사가 단순 문자열/정규식 매칭이라 `:root`/`<style>` 블록 밖(주석, 본문 텍스트 등)에 변수명이 등장해도 통과시킬 수 있음 [src/shared/cardSkeleton.ts] — deferred, 실제 CSS 파싱이 필요해 비용 대비 위험 낮음(현재 시스템 프롬프트가 그런 응답을 유도할 가능성 낮음).
- [x] [Review][Defer] `editCardHtml` 응답에 마크다운 코드블록(\`\`\`)이 섞여도 별도로 제거하지 않음 [src/main/api/claude.ts] — deferred, 1.3의 `generateCardHtml`도 동일한 위험을 시스템 프롬프트로만 방지하는 기존 패턴과 일관됨, 새 회귀 아님.
- [x] [Review][Defer] `validateCardSkeleton`의 불릿 탐색 루프(및 신규 gap 스캔)에 명시적 상한이 있지만, 입력 HTML 자체 크기에 대한 상한은 없음 [src/shared/cardSkeleton.ts] — deferred, Claude 응답이 `max_tokens`(8192)로 이미 사실상 제한되어 실사용 위험 낮음.
- [x] [Review][Defer] 재생성/AI편집/되돌리기 사이에 완전한 동시성 가드(세대/epoch 토큰)는 없음 — UI 버튼 비활성화(patch)로 일반적인 사용자 트리거 경쟁은 막았지만, 프로그래밍적으로 동시에 두 작업을 발생시키는 극단적 케이스까지는 막지 않음 — deferred, 풀가드는 설계 변경 규모라 범위 초과.
- [x] [Review][Defer] `countDataEditId`가 `editId` 문자열을 정규식에 그대로 보간해 메타문자를 escape하지 않음 [src/shared/cardSkeleton.ts] — deferred, 현재 호출부는 전부 고정 리터럴 패턴만 전달해 실질 위험 없음, 향후 신뢰되지 않은 입력에 노출될 경우 재검토.

## Dev Notes

- **이번 스토리는 1.3(생성)과 다른 입력 형태의 새 Claude 호출을 추가한다.** 1.3의 `generateCardHtml`은 "참고이미지 → 신규 생성"이고, 이번 `editCardHtml`은 "기존 HTML + 자연어 지시 → 수정"이다. 모델/클라이언트(`createClaudeClient`)는 동일하게 재사용하지만 시스템 프롬프트는 입력 형태에 맞게 분리한다(Task 0/2 참고).
- **AD-1 준수:** Claude API 호출(`editCardHtml`)과 디스크 쓰기(`overwriteCardHtmlFile`)는 전부 Main에서만. Renderer는 `window.api.editCardWithInstruction`으로만 요청.
- **AD-2 준수, 그리고 이번 스토리가 AD-2를 "검증"으로 처음 강제하는 지점이다.** 1.3~1.5는 골격계약을 시스템 프롬프트로 "유도"만 했고 실제 위반 검증/거부 로직은 없었다(`1-3-html-card-generation.md` 코드리뷰에서 deferred 처리됨). 이번 스토리에서 처음으로 `validateCardSkeleton`이 실제 강제 로직이 된다 — PRD/에픽이 AC2로 이 스토리에 명시했기 때문.
- **API 키 체크 필요 — 1.4/1.5와 반대.** `card:save-html`(1.4)은 Claude를 호출하지 않아 `getApiKey` 체크가 없었다. `card:edit-with-instruction`은 Claude를 호출하므로 `card:generate`/`card:regenerate`(1.3)와 동일하게 `getApiKey` 체크가 **반드시** 있어야 한다. 이 둘을 혼동해 체크를 빼먹지 않도록 주의(1.4 Dev Notes의 반대 방향 주의사항).
- **AC3 되돌리기는 디스크에도 반영해야 한다.** 되돌리기를 화면(`card.html`)만 바꾸고 디스크 파일은 그대로 두면, 다음에 코드창을 열거나 앱을 재시작했을 때(향후 스토리에서 불러오기 기능이 생기면) 화면과 파일이 불일치하게 된다. `handleRevertInstruction`이 `card:save-html`을 함께 호출하는 이유.
- **htmlPath 룩업/디바운스 패턴 재사용:** 이번 스토리의 저장은 디바운스가 필요 없다(사용자가 명시적으로 "적용"/"되돌리기"를 누른 시점에만 저장, 매 입력마다 저장하지 않음) — 1.4/1.5의 `scheduleSave`/`scheduleCodeCommit`과는 다른 결인 즉시 저장 패턴임을 인지할 것. 다만 `htmlPath`는 여전히 `card.htmlPath`(생성 시점에 확정된 값)를 그대로 사용 — 1.4 코드리뷰에서 고친 날짜 재계산 버그를 재발시키지 않는다.

### Project Structure Notes

- `src/shared/cardSkeleton.ts`, `cardSkeleton.test.ts` 신규(Main/Renderer 공유 순수 로직).
- `src/renderer/src/cardEditing.ts` 수정(`CARD_CSS_VARIABLES` 재노출로 변경, 다른 함수는 그대로).
- `src/templates/card-edit-system-prompt.ts` 신규.
- `src/main/api/claude.ts` 수정(`editCardHtml` 추가).
- `src/shared/ipc-card.ts` 수정(타입 추가), `src/main/ipc/card.ts` 수정(핸들러 추가), `src/main/ipc/card.test.ts` 수정(테스트 추가).
- `src/preload/index.ts`/`index.d.ts` 수정.
- `src/renderer/src/App.tsx` 수정(지시 입력/적용/되돌리기 UI).
- 신규 런타임 의존성 없음.

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-2](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 권한분리, 카드 골격계약(이번 스토리에서 검증 강제화)
- [PRD §4.2, FR-9](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 자연어 AI 편집
- [epics.md#Story-1.6](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-3-html-card-generation.md](./1-3-html-card-generation.md) — `CARD_SYSTEM_PROMPT`/골격계약 원본 정의, `generateCardHtml`/`createClaudeClient` 패턴, 골격계약 검증 부재가 deferred 처리된 배경
- [1-4-card-inline-editing.md](./1-4-card-inline-editing.md) — `card:save-html`/`htmlPath` 계약, API 키 체크 유무 차이, `window.api`가 frozen이라 CDP에서 직접 몬키패치 불가능했던 교훈
- [1-5-code-panel-sync.md](./1-5-code-panel-sync.md) — "항상 라이브 iframe DOM을 다시 읽는다" 패턴, 코드창 동기화 갱신 포인트

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- CDP 실측은 1.4/1.5와 동일한 방법론(빌드된 앱 `--remote-debugging-port` 직접 기동 + 임시 디버그 훅 주입 → 검증 후 즉시 제거 + 재빌드). 이번에는 `editCardWithInstruction`이 실제 비용이 드는 Claude 호출이라 성공/실패 경로 전체를 실측하지 않고, (a) UI 반응(버튼 활성화, 상태 시뮬레이션 주입 시 미리보기 갱신)만 디버그 훅으로 시뮬레이션, (b) `되돌리기`는 Claude를 호출하지 않는 실제 코드 경로(`window.api.saveCardHtml`)라 클릭으로 직접 실행해 실측 검증. 비용 0.
- 테스트 작성 중 기존 `src/main/ipc/card.test.ts`의 `beforeEach`가 `vi.clearAllMocks()`를 사용해 이전 테스트의 `mockImplementation`(예: `overwriteCardHtmlFile`이 에러를 throw하도록 설정한 것)이 다음 테스트로 누수되는 잠재 버그를 발견 — `vi.resetAllMocks()`로 교체해 해결(회귀 없음, 전체 테스트 재확인).

### Completion Notes List

- Task 0: 골격계약 검증 규칙 4가지(title-bar/footer 단일성, bullet-icon 쌍, CSS 변수 4종) 확정. `CARD_CSS_VARIABLES`를 `src/shared/cardSkeleton.ts`로 이전해 Main/Renderer 공유. AI 편집 전용 시스템 프롬프트 신규 작성. AI 편집 입력 HTML은 항상 라이브 iframe DOM. 되돌리기는 1단계 스냅샷.
- Task 1: `src/shared/cardSkeleton.ts`에 `CARD_CSS_VARIABLES` + `validateCardSkeleton` 작성, `cardEditing.ts`는 재노출로 변경. 단위테스트 6건(정상/title-bar 누락/footer 중복/bullet-icon 불일치/CSS 변수 누락/CARD_CSS_VARIABLES 노출) 전부 통과.
- Task 2: `card-edit-system-prompt.ts` 신규, `main/api/claude.ts`에 `editCardHtml` 추가(`generateCardHtml`과 동일한 모델/타임아웃 패턴 재사용, 텍스트 전용 메시지로 구성).
- Task 3: `card:edit-with-instruction` IPC 채널/타입 추가, 핸들러는 필드 검증 → API 키 체크 → `editCardHtml` 호출 → `validateCardSkeleton` 검증(위반 시 저장 안 함, 원본 유지) → 통과 시 `overwriteCardHtmlFile` 저장. 단위테스트 5건(정상 편집/계약 위반 거부/API 키 없음/필드 누락/API 호출 실패) 전부 통과.
- Task 4: preload에 `editCardWithInstruction` 노출. `App.tsx`에 카드별 지시 입력/적용/되돌리기 UI, `handleApplyInstruction`(라이브 DOM 직렬화 → IPC 호출 → 성공 시 스냅샷+상태 갱신, 실패 시 원본 유지+에러 표시)/`handleRevertInstruction`(스냅샷 복원+디스크 재저장+스냅샷 삭제) 구현. 1.5 코드리뷰에서 발견된 "재생성 시 stale 상태" 패턴을 선제적으로 방지하기 위해 재생성 시 `previousHtml` 스냅샷도 함께 삭제하도록 처리.
- Task 5: 단위테스트 69건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과, CDP 실측 PASS(지시 입력→적용 버튼 활성화, 상태 시뮬레이션→미리보기 갱신+되돌리기 버튼 노출, 실제 되돌리기 클릭→복원+디스크 반영+버튼 소멸). 모든 태스크 완료.

### File List

- `src/shared/cardSkeleton.ts` (신규)
- `src/shared/cardSkeleton.test.ts` (신규)
- `src/renderer/src/cardEditing.ts` (수정 — `CARD_CSS_VARIABLES`를 `shared/cardSkeleton`에서 재노출)
- `src/templates/card-edit-system-prompt.ts` (신규)
- `src/main/api/claude.ts` (수정 — `editCardHtml` 추가)
- `src/shared/ipc-card.ts` (수정 — `CARD_EDIT_WITH_INSTRUCTION_CHANNEL`, `EditCardWithInstructionRequest`/`EditCardWithInstructionResponseData` 추가)
- `src/main/ipc/card.ts` (수정 — `card:edit-with-instruction` 핸들러 추가)
- `src/main/ipc/card.test.ts` (수정 — 핸들러 테스트 5건 추가, `vi.clearAllMocks()` → `vi.resetAllMocks()` 교체)
- `src/preload/index.ts` (수정 — `editCardWithInstruction` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `editCardWithInstruction` 추가)
- `src/renderer/src/App.tsx` (수정 — 지시 입력/적용/되돌리기 UI 및 핸들러)
- `src/renderer/src/assets/main.css` (수정 — `.card-instruction-row` 스타일 추가)

### Change Log

- 2026-06-26: Story 1.6 구현 완료 — 자연어 지시 기반 AI 편집(AC1), 골격계약 위반 거부(AC2), 1단계 되돌리기(AC3). 신규 공유 모듈 `cardSkeleton.ts`로 Main/Renderer 골격계약 검증 로직 통합. CDP 실측(시뮬레이션+실제 되돌리기 경로) 전부 PASS. Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(Blind Hunter/Edge Case Hunter/Acceptance Auditor 3개 레이어) 진행, patch 7건 발견 즉시 반영 — 디바운스 저장 타이머 미취소, 재생성↔AI편집 경쟁조건, 되돌리기 저장실패 시 스냅샷 유실, 불릿 번호 gap false-pass, 재생성 실패 시 불필요한 상태 초기화, 더블클릭 경쟁조건, 적용 성공 후 지시문 미초기화. defer 5건은 `deferred-work.md`에 기록. Status: review → done.
