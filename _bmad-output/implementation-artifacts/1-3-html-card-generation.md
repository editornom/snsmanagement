---
baseline_commit: 4d3ded015d6644b45a249e71413c0364af37efa8
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-2-thumbnail-registration.md
---

# Story 1.3: 참고이미지 → HTML 정보카드 생성

Status: done

## Story

As a 운영자,
I want 참고이미지를 올리면 Claude가 동일 골격의 HTML 카드로 변환해주길,
so that 카드 디자인을 매번 손으로 코딩하지 않아도 된다.

## Acceptance Criteria

1. **Given** Story 1.2에서 등록된 콘텐츠 폴더가 선택된 상태에서, **When** 참고이미지 1장을 업로드하고 생성 요청을 하면, **Then** Claude API가 호출되어 1080x1350(4:5) HTML 카드 1장이 생성된다. **And** 생성된 HTML은 카드 골격계약(제목바/불릿박스/아이콘/푸터 영역에 `data-edit-id`, 색상은 `:root` CSS 변수)을 따른다. **And** 생성 결과는 즉시 미리보기로 렌더링되어 보인다.
2. **Given** 참고이미지를 여러 장(최대 10장) 업로드했을 때, **When** 생성 요청을 하면, **Then** 각 이미지마다 별도의 카드 HTML이 생성되고 순서대로 미리보기에 나열된다.
3. **Given** 생성된 카드의 텍스트 반영이 미흡하다고 판단했을 때, **When** 재생성 버튼을 누르면, **Then** 동일 참고이미지로 해당 카드만 다시 생성한다(다른 카드는 영향 없음).

## Tasks / Subtasks

- [x] Task 0: Claude API 키 설정 화면 (이 스토리에서 신규 결정 — 선행 스토리 어디에도 없던 전제조건) (AC: 1)
  - [x] `@anthropic-ai/sdk`(^0.105.0) 추가 (`npm install @anthropic-ai/sdk`)
  - [x] `main/settings/apiKey.ts`: `saveApiKey(userDataPath: string, apiKey: string): void`(Electron `safeStorage.encryptString`로 암호화 후 `{userDataPath}/settings.json`에 `{ apiKeyEncrypted: string(base64) }` 저장), `getApiKey(userDataPath: string): string | null`(파일 없거나 복호화 실패 시 `null`). `safeStorage`는 Electron 모듈이므로 이 파일은 순수 로직과 분리하기 어렵지만, 암복호화 호출부만 함수로 감싸 IPC 핸들러에서 주입하는 형태 유지(1.2의 `documentsPath` 주입 패턴과 동일하게 `userDataPath`를 인자로 받음 — 테스트 시 `safeStorage` 모킹 가능하도록)
  - [x] IPC 채널 신설: `settings:get-api-key-status`(저장된 키 존재 여부만 boolean으로 반환, 키 평문은 절대 renderer로 보내지 않음), `settings:save-api-key`(payload `{ apiKey: string }`, 빈 문자열이면 `{ok:false, error}`)
  - [x] `App.tsx` 상단에 "Claude API 키" 입력 섹션 추가: 저장 여부를 `settings:get-api-key-status`로 마운트 시 조회해 "설정됨"/"미설정" 표시, 입력창+저장 버튼으로 `settings:save-api-key` 호출. 이미 설정된 키 값은 화면에 노출하지 않음(보안)
  - [x] **스코프 경계:** 키 변경/삭제 UX, 키 유효성 사전검증(API 호출로 테스트)은 이번 스토리 범위 밖 — 저장된 키가 잘못되면 Task 3의 생성 시점에 Claude API 에러로 노출됨

- [x] Task 1: 카드 골격계약 스키마 확정 + 시스템 프롬프트 (AD-2 — 아키텍처에서 "에픽/스토리 단계에서 확정"으로 위임된 항목, 이번 스토리에서 결정) (AC: 1, 2)
  - [x] `data-edit-id` 네이밍 확정: 제목바 `"title-bar"`, 불릿박스는 반복 가능하므로 `"bullet-{n}"`(1부터 시작하는 정수), 아이콘은 불릿에 종속되므로 `"icon-{n}"`(대응 불릿과 동일 n), 푸터 `"footer"`. 카드당 불릿 개수는 가변(참고이미지에 따라 Claude가 결정) — 고정 개수 강제하지 않음
  - [x] CSS 변수 네이밍 확정: `--card-bg-color`(배경), `--card-primary-color`(제목바/강조), `--card-text-color`(본문 텍스트), `--card-accent-color`(아이콘/포인트). 4개로 고정 — Claude가 임의로 변수명을 늘리지 않도록 시스템 프롬프트에 정확히 이 4개만 쓰라고 명시(Story 1.4 인라인 편집의 색상 수정 UI가 이 4개 변수를 가정하고 동작할 것이므로 임의 확장 시 1.4가 깨짐)
  - [x] `templates/card-system-prompt.ts`: 위 계약을 자연어로 강제하는 시스템 프롬프트 문자열 작성. 포함 내용: (1) 출력은 완전한 단일 HTML 문서(`<!DOCTYPE html>`부터, 외부 리소스 링크 금지 — 폰트는 시스템 폰트 또는 base64 인라인만), (2) 1080x1350px 고정 캔버스, (3) 위 `data-edit-id` 5종 네이밍 규칙, (4) 위 CSS 변수 4종을 `:root`에 정의하고 색상은 반드시 이 변수로만 참조(하드코딩 hex/rgb 금지), (5) 참고이미지의 텍스트 내용을 최대한 그대로 반영(텍스트 반영률 90% 이상 — PRD §4.1), (6) 비주얼(아이콘 모양, 불릿 스타일, 배치)은 참고이미지를 참조해 자유롭게 생성. **출력 형식: HTML 코드만 단독으로 반환(마크다운 코드블록 fence나 설명 텍스트 없이)** — 이래야 Task 3에서 Claude 응답을 그대로 파일로 저장 가능
  - [x] 이 스토리는 결과 HTML이 계약을 따르는지 강제 검증(파싱/거부)하지 않는다 — 시스템 프롬프트로만 유도. 계약 위반 시 거부 로직은 Story 1.6(AI 편집)의 AC에 명시된 요구사항이며 이번 스토리 범위 밖(스코프 경계, 과잉 구현 금지)

- [x] Task 2: `main/api/claude.ts` — Claude API 클라이언트 래퍼 (AC: 1, 2, 3)
  - [x] `createClaudeClient(apiKey: string): Anthropic` — `@anthropic-ai/sdk`의 `Anthropic` 인스턴스 생성 헬퍼(매번 `new Anthropic({ apiKey })` 직접 호출 대신 한 곳에서 — Story 1.6/3.1도 동일 클라이언트 생성 방식 재사용)
  - [x] `generateCardHtml(client: Anthropic, referenceImageBase64: string, mediaType: 'image/png' | 'image/jpeg' | 'image/webp'): Promise<string>` — `client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 8192, system: CARD_SYSTEM_PROMPT, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: referenceImageBase64 } }, { type: 'text', text: '이 참고이미지를 정보카드 HTML로 변환해줘' }] }] })` 호출 후 응답의 텍스트 블록을 이어붙여 반환. 응답이 비어있거나 텍스트 블록이 없으면 Error throw(호출부에서 캐치해 IPC 에러로 변환)
  - [x] 이미지 파일 → base64 변환은 이 함수 밖(IPC 핸들러)에서 수행해 이 함수는 Anthropic SDK 의존성만 가짐(테스트 시 SDK 클라이언트를 모킹하기 쉽게)

- [x] Task 3: 카드 생성 IPC 핸들러 (AC: 1, 2, 3)
  - [x] `main/storage/naming.ts`에 `getCardHtmlPath(contentFolderPath: string, keyword: string, date: Date, index: number): string` 추가 — `{contentFolderPath}/html/{YYMMDD}_{키워드}_{순번 2자리}.html`(AD-7, index는 1부터, `String(index).padStart(2, '0')`). `contentFolderPath`를 인자로 받는 이유: 호출부가 이미 Story 1.2의 `getContentFolderPath` 결과를 갖고 있으므로 중복 계산 방지(1.2 Dev Notes의 "이 유틸만 호출" 원칙 준수)
  - [x] IPC 채널 신설(`card` 도메인, 1.2 Dev Notes에서 예고된 패턴): `card:select-reference-images`(`dialog.showOpenDialog`, `properties: ['openFile', 'multiSelections']`, 동일 이미지 필터, 최대 10장 — 10장 초과 선택 시 처음 10장만 사용하고 나머지는 무시), `card:generate`(payload `{ contentFolderPath: string; keyword: string; referenceImagePaths: string[] }` → 각 이미지를 순서대로 처리해 `{ cards: Array<{ index: number; htmlPath: string; html: string } | { index: number; error: string }> }` 반환 — 일부 카드 실패해도 나머지는 성공 응답에 포함, 부분 실패 허용), `card:regenerate`(payload `{ contentFolderPath: string; keyword: string; referenceImagePath: string; index: number }` → 단일 카드 재생성, 동일 `htmlPath`에 덮어쓰기)
  - [x] `card:generate`/`card:regenerate` 핸들러 내부: 저장된 API 키를 `getApiKey(app.getPath('userData'))`로 조회 → 없으면 즉시 `{ok:false, error:{message:'Claude API 키를 먼저 설정해주세요'}}`(Task 0 선행조건 미충족 케이스) → 있으면 참고이미지를 `readFileSync` + `toString('base64')`로 읽고 확장자로 `mediaType` 결정 → `generateCardHtml` 호출 → 성공 시 `getCardHtmlPath`로 경로 계산 후 `mkdirSync(html폴더, {recursive:true})` + `writeFileSync`로 저장 → 경로+HTML 문자열 반환
  - [x] Claude API 호출 실패(네트워크, 인증, rate limit 등)는 개별 카드 단위로 캐치해 해당 인덱스만 `error`로 표시(AC2의 "각 이미지마다 별도" 요구와 일치 — 한 장 실패가 전체를 막지 않음)
  - [x] 모든 핸들러는 1.2와 동일한 IPC 응답 envelope `{ ok, data?, error?: { message } }` 준수, throw 금지(1.2 코드리뷰에서 발견된 unhandled rejection 버그 재발 방지 — 모든 async 핸들러에 try/catch 필수)

- [x] Task 4: Preload 타입드 API + 공유 타입 (AC: 1, 2, 3)
  - [x] `src/shared/ipc-settings.ts`: `SETTINGS_GET_API_KEY_STATUS_CHANNEL`, `SETTINGS_SAVE_API_KEY_CHANNEL`, 요청/응답 타입
  - [x] `src/shared/ipc-card.ts`: `CARD_SELECT_REFERENCE_IMAGES_CHANNEL`, `CARD_GENERATE_CHANNEL`, `CARD_REGENERATE_CHANNEL`, 요청/응답 타입(`CardResult = { index: number; htmlPath: string; html: string } | { index: number; error: string }`)
  - [x] `src/preload/index.ts`의 `api` 객체에 `getApiKeyStatus()`, `saveApiKey(apiKey)`, `selectReferenceImages()`, `generateCards(input)`, `regenerateCard(input)` 추가
  - [x] `src/preload/index.d.ts`의 `ContentApi` 인터페이스를 확장(또는 이름을 더 일반적인 `Api`로 변경 — 더 이상 content 전용이 아니므로. 변경 시 참조하는 모든 곳 함께 수정)

- [x] Task 5: 카드 생성 UI (renderer) (AC: 1, 2, 3)
  - [x] `App.tsx`: 등록 성공(`folderPath` 보유) 후 카드 생성 섹션을 조건부 렌더링(등록 폼을 대체하지 않고 같은 화면에 이어서 표시 — 멀티스크린 라우팅은 이번 스토리 범위 밖)
  - [x] 참고이미지 선택 버튼(`selectReferenceImages`, 최대 10장 결과를 상태로 보관) + 선택된 파일 개수/이름 표시 + "카드 생성" 버튼
  - [x] 생성 버튼 클릭 시 `generateCards({ contentFolderPath: folderPath, keyword, referenceImagePaths })` 호출, 로딩 중 버튼 비활성화(1.2와 동일하게 `finally`로 항상 해제)
  - [x] 카드 목록을 `index` 순서로 렌더링, 각 카드는 `<iframe sandbox="allow-same-origin" srcDoc={card.html} />`로 미리보기(AD-1 위반 없음 — iframe은 별도 프로세스가 아니라 동일 렌더러 내 DOM 요소이며 Node 접근 없음, `srcDoc`은 신뢰할 수 있는 자체 생성 콘텐츠). 1080x1350 비율을 유지한 채 화면에 맞게 축소 표시(`width`/`height` 고정 후 CSS `transform: scale()` 또는 `aspect-ratio` 컨테이너)
  - [x] 에러난 카드(`error` 필드 존재)는 미리보기 대신 에러 메시지 표시
  - [x] 각 카드 하단에 "재생성" 버튼 → `regenerateCard({ contentFolderPath, keyword, referenceImagePath: 해당 카드의 원본 참고이미지 경로, index })` 호출 후 해당 인덱스만 갱신(다른 카드 상태 불변 — AC3)
  - [x] 카드 목록/참고이미지 경로 매핑은 렌더러 메모리 상태로만 유지(세션 한정). 앱 재시작 시 기존 `html/` 폴더에서 카드 목록을 복원하는 기능은 이번 스토리 범위 밖(향후 스토리 과제로 남김 — 1.4/1.5가 같은 세션 내 편집을 전제하므로 지금 당장 필요하지 않음)

- [x] Task 6: 테스트 (AC: 1, 2, 3)
  - [x] `storage/naming.test.ts`에 `getCardHtmlPath` 단위테스트 추가(순번 2자리 패딩, 키워드/날짜 조합)
  - [x] `main/ipc/card.test.ts`(신규): API 키 미설정 시 에러 분기, 부분 실패(여러 이미지 중 1개만 Claude 호출 실패) 시 나머지는 성공으로 반환되는지 — `Anthropic` 클라이언트와 `getApiKey`를 모킹(vitest `vi.mock`)해 실제 API 호출 없이 검증
  - [x] `main/settings/apiKey.test.ts`(신규): `safeStorage` 모킹으로 저장/조회 로직 검증(암복호화 자체가 아니라 파일 읽기/쓰기 흐름 검증)
  - [x] Electron 런타임 실측(파일 다이얼로그, 실제 Claude API 호출, iframe 미리보기)은 1.1/1.2처럼 패키징된 `.exe`를 CDP로 검증. **실제 Claude API 호출 검증 시 운영자 본인의 API 키로 1회 이상 실측 필요(비용 발생, NFR4 허용 범위 — 1회 약 $0.16~$0.27)**

## Dev Notes

- **AD-6(필수): API 키는 절대 평문으로 renderer에 전달하지 않는다.** `settings:get-api-key-status`는 boolean만 반환, 저장된 키 값을 읽어 화면에 표시하는 기능은 만들지 않는다.
- **AD-1(필수):** `@anthropic-ai/sdk` 호출, 파일 읽기(이미지→base64), HTML 파일 쓰기는 전부 Main에서만. Renderer는 Task 4의 preload API로만 요청.
- **AD-2(이번 스토리에서 확정):** Task 1에서 결정한 `data-edit-id` 5종(`title-bar`, `bullet-{n}`, `icon-{n}`, `footer`)과 CSS 변수 4종(`--card-bg-color`, `--card-primary-color`, `--card-text-color`, `--card-accent-color`)은 이후 Story 1.4(인라인 편집), 1.5(코드창 동기화), 1.6(AI 편집)이 그대로 의존하는 계약이다. 임의로 이름을 바꾸거나 변수를 추가하면 후속 스토리가 깨진다.
- **AD-7(필수):** `getCardHtmlPath`는 `storage/naming.ts`에만 추가하고 다른 모듈이 직접 경로를 조립하지 않는다. 1.2가 만든 `getContentFolderPath`와 조합해서만 사용.
- **IPC 응답 envelope 고정 + throw 금지:** 1.2 코드리뷰에서 예외 처리 누락이 "등록 버튼 영구 비활성화" 버그로 이어진 사례가 있었다. 이번 스토리는 외부 API(Claude) 호출이 포함되어 실패 가능성이 1.2보다 훨씬 높으므로(네트워크, 인증, rate limit, 타임아웃) Task 3/Task 5 모두 try/catch/finally를 빠뜨리지 않는다.
- **AD-3 관련 주의:** Task 5의 iframe 미리보기는 offscreen `BrowserWindow`+`capturePage()`(Story 2.1)와는 다른 용도다. AD-3는 "미리보기와 실제 PNG 출력이 같은 렌더링 엔진"을 요구하는데, 둘 다 Chromium(Electron 내장)이므로 위반이 아니다. 다만 Story 2.1에서 실제 PNG 렌더링 시 iframe 방식이 아니라 별도 offscreen window로 다시 로드하므로, 이번 스토리에서 iframe 전용 CSS 트릭(예: iframe 자체에만 적용되는 스케일링)이 카드 HTML 내부에 섞여 들어가지 않도록 주의 — 스케일링은 카드 HTML이 아니라 iframe을 감싸는 React 컨테이너에서만 적용한다.
- **이미지 인코딩:** Claude Vision API는 base64 인라인 이미지를 받는다. 참고이미지를 디스크에서 읽어 `Buffer.toString('base64')`로 변환하고, `media_type`은 파일 확장자로 결정(`png→image/png`, `jpg/jpeg→image/jpeg`, `webp→image/webp`). 참고이미지 자체는 `output/` 폴더에 복사/보관하지 않는다(AC에 요구 없음, 재생성은 렌더러가 들고 있는 원본 파일 경로로 재호출하면 충분 — 스코프 경계).
- **모델/SDK 버전:** `@anthropic-ai/sdk` 최신 안정 버전(0.105.0, 2026-06 기준) 사용, 모델은 `claude-sonnet-4-6`(비전 지원).
- **비용(NFR4):** 카드 1장 생성당 비전 입력 토큰 비용 발생. 10장 동시 생성 시 순차 처리(Task 3에서 `Promise.all` 대신 순차 `for` 루프 권장 — 동시 10개 요청은 rate limit에 걸릴 가능성이 높고, 부분 실패 시 어느 카드가 실패했는지 추적이 순차 처리가 더 단순함. 성능보다 신뢰성 우선).

### Project Structure Notes

- `src/main/api/.gitkeep`(Story 1.1부터 빈 폴더) 위치에 `claude.ts` 신규 — `.gitkeep` 삭제.
- `src/templates/.gitkeep` 위치에 `card-system-prompt.ts` 신규 — `.gitkeep` 삭제.
- `src/main/storage/naming.ts`/`naming.test.ts`는 신규 파일 추가가 아니라 기존 파일에 함수 추가(수정).
- `src/main/settings/`(신규 폴더, Structural Seed에 명시되지 않았던 폴더 — Task 0이 이번 스토리에서 처음 필요해진 영역이라 `storage/`와 분리해 신설. `storage/`는 콘텐츠 산출물 전용, `settings/`는 도구 자체 설정 전용으로 관심사 분리)
- `src/main/ipc/card.ts`, `src/main/ipc/settings.ts` 신규.
- `src/shared/ipc-card.ts`, `src/shared/ipc-settings.ts` 신규.
- 기존 `tsconfig.node.json`/`tsconfig.web.json`이 `src/main`, `src/shared` 전체를 include 하고 있어(1.1/1.2에서 확인됨) 신규 폴더(`settings/`) 추가에 별도 tsconfig 수정 불필요 — 확인만 할 것.

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-6, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 권한분리, 카드 골격계약, 렌더엔진 단일화, API 키 보관, 네이밍 유틸
- [ARCHITECTURE-SPINE.md#Structural-Seed](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — `html/` 폴더, `{userData}/settings.json` 위치
- [ARCHITECTURE-SPINE.md#Deferred](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — `data-edit-id` 스키마/색상변수 명명규칙이 "에픽/스토리 단계에서 확정"으로 위임된 사실(이번 스토리 Task 1에서 확정)
- [PRD §4.1, FR-1](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 텍스트 반영률 90% 이상, 카드 수 1~10장 가변, 색상값 CSS 변수 처리
- [PRD §4.6, NFR3/NFR4](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — Claude API 단일 키, 비용 허용범위
- [epics.md#Story-1.3](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-2-thumbnail-registration.md](./1-2-thumbnail-registration.md) — `getContentFolderPath`/`naming.ts` 패턴, IPC envelope 고정, `sandbox:false` 결정 배경, "검증은 IPC 레이어, 로직 함수는 유효 입력 가정" 분리 원칙

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 패키징된 `.exe`(`dist/win-unpacked/sns-content-tool.exe`)를 1.1/1.2와 동일하게 `--remote-debugging-port=9333`으로 띄워 CDP로 실측. 이번에도 `ELECTRON_RUN_AS_NODE=1`이 쉘 환경변수로 남아있어 그대로 실행하면 `bad option: --remote-debugging-port=9333` 에러로 죽는 동일 증상 재현 — `env -u ELECTRON_RUN_AS_NODE`로 언셋 후 정상 기동(1-1 Dev Notes에 기록된 이슈와 동일 원인).
- Node 22의 전역 `WebSocket`을 이용해 별도 `ws` 패키지 설치 없이 CDP(`Runtime.evaluate`)에 직접 접속하는 1회용 스크립트로 `window.api.*`를 호출(좌표 기반 클릭은 1.1/1.2에서 DPI 가상화로 신뢰 불가 판정된 것과 동일 이유로 회피, 파일 다이얼로그를 여는 `selectThumbnail`/`selectReferenceImages` 버튼 클릭도 CDP로는 자동화할 수 없어 1.2와 동일하게 해당 IPC 함수를 우회해 직접 호출).
- 운영자 본인의 Claude API 키로 `settings:save-api-key` → `content:register`(테스트용 키워드 `story13검증`) → `card:generate`(참고이미지 2장, `resources/icon.png`/`build/icon.png`) → `card:regenerate`(1번 카드) 순서로 실제 Claude API를 호출해 AC1/AC2/AC3를 모두 실측 검증. 생성된 HTML이 골격계약(`data-edit-id` 5종, CSS 변수 4종, 1080x1350 고정 캔버스, 마크다운 펜스 없음)을 정확히 따르는지 파일 내용을 직접 읽어 확인.
- iframe 미리보기(Task 5)는 `sandbox="allow-same-origin"` + `srcDoc`으로 실제 생성된 HTML을 렌더링시켜 `data-edit-id` 엘리먼트 탐색/CSS 변수 계산값/엘리먼트 bounding rect를 CDP로 직접 확인해 미리보기 렌더링이 정상 동작함을 검증.
- 검증 후 테스트로 생성된 `output/story13검증/` 폴더와 패키징된 실행파일 프로세스는 모두 정리.

### Completion Notes List

- Task 0(API 키 설정)은 어떤 선행 스토리에도 없던 신규 전제조건으로 이번 스토리에서 처음 도입: `@anthropic-ai/sdk`(^0.105.0) 추가, `main/settings/apiKey.ts`(safeStorage 암복호화, 테스트를 위해 `SafeStorageLike` 인터페이스로 의존성 주입), `settings:*` IPC 2종, `App.tsx` 상단 API 키 입력 섹션(저장된 키 값은 절대 화면에 노출하지 않음).
- Task 1(골격계약 확정)에서 `data-edit-id` 5종(`title-bar`, `bullet-{n}`, `icon-{n}`, `footer`)과 CSS 변수 4종(`--card-bg-color`, `--card-primary-color`, `--card-text-color`, `--card-accent-color`)을 확정하고 `templates/card-system-prompt.ts`에 시스템 프롬프트로 강제. 실제 Claude API 호출 결과 두 장 모두 계약을 정확히 준수함을 확인(불릿 개수는 4~5개로 참고이미지에 따라 가변).
- Task 2(`main/api/claude.ts`)는 Anthropic SDK 의존성을 이 파일에만 가두고, 이미지→base64 변환은 호출부(Task 3)에서 수행하도록 분리해 테스트 시 SDK를 직접 모킹하지 않아도 되게 설계.
- Task 3은 `main/storage/card.ts`(순수 fs 로직, `generateHtml`을 함수로 주입받아 Anthropic SDK와 완전히 분리 — vitest로 SDK 없이 단위테스트 가능)와 `main/ipc/card.ts`(IPC 레이어, API 키 조회/클라이언트 생성/순차 처리/부분 실패 처리)로 분리. 카드 생성은 동시성 대신 순차 `for` 루프로 처리해 부분 실패 시 어느 인덱스가 실패했는지 명확히 추적(Dev Notes의 신뢰성 우선 결정 반영).
- Task 4: `preload/index.d.ts`의 `ContentApi`를 더 이상 content 전용이 아닌 `Api`로 이름 변경하고 카드/설정 API를 추가. 참조하는 곳은 `index.d.ts` 자체뿐이라 추가 변경 없음.
- Task 5: `App.tsx`에 API 키 입력 섹션 + 카드 생성 섹션(등록 폼 아래 `folderPath` 보유 시 조건부 렌더링)을 추가. 카드 미리보기는 `iframe sandbox="allow-same-origin" srcDoc`으로 구현하고, 1080x1350 원본 크기를 유지한 채 `transform: scale(0.25)`로 화면에 맞게 축소 표시(스케일링은 iframe 컨테이너에만 적용, 카드 HTML 내부에는 손대지 않음 — AD-3 주의사항 준수).
- Task 6: 단위테스트 19건 추가(`naming.test.ts` +3, `card.test.ts`(storage) 신규 4건, `card.test.ts`(ipc) 신규 4건, `apiKey.test.ts` 신규 4건 등, 총 32건 전체 통과). 운영자 본인 API 키로 패키징된 실행파일에서 실제 Claude API 호출까지 포함한 AC1/AC2/AC3 전체 실측 검증 완료(상세는 Debug Log Reference 참고).
- 검증: 단위테스트 32건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과, `npm run build:win` 성공, 패키징된 실행파일에서 실제 Claude API 호출 포함 CDP 실측 검증 완료.

### File List

- `package.json` (수정 — `@anthropic-ai/sdk` dependency 추가)
- `src/main/settings/apiKey.ts` (신규)
- `src/main/settings/apiKey.test.ts` (신규)
- `src/main/ipc/settings.ts` (신규)
- `src/shared/ipc-settings.ts` (신규)
- `src/templates/card-system-prompt.ts` (신규)
- `src/templates/.gitkeep` (삭제)
- `src/main/api/claude.ts` (신규)
- `src/main/api/.gitkeep` (삭제)
- `src/main/storage/naming.ts` (수정 — `getCardHtmlPath` 추가)
- `src/main/storage/naming.test.ts` (수정 — `getCardHtmlPath` 단위테스트 추가)
- `src/main/storage/card.ts` (신규)
- `src/main/storage/card.test.ts` (신규)
- `src/main/ipc/card.ts` (신규)
- `src/main/ipc/card.test.ts` (신규)
- `src/shared/ipc-card.ts` (신규)
- `src/preload/index.ts` (수정 — `getApiKeyStatus`/`saveApiKey`/`selectReferenceImages`/`generateCards`/`regenerateCard` API 노출)
- `src/preload/index.d.ts` (수정 — `ContentApi` → `Api`로 확장)
- `src/main/index.ts` (수정 — `registerCardIpcHandlers`/`registerSettingsIpcHandlers` 등록)
- `src/renderer/src/App.tsx` (수정 — API 키 입력 섹션, 카드 생성/미리보기/재생성 섹션 추가)
- `src/renderer/src/assets/main.css` (수정 — API 키 폼/카드 생성 섹션/카드 미리보기 스타일 추가, 공통 버튼/메시지 스타일을 `.app-root`/`.message`로 일반화)

## Change Log

- 2026-06-25: Story 1.3 구현 완료 — 참고이미지 → HTML 정보카드 생성(FR-1). 선행 전제조건이었던 Claude API 키 설정(safeStorage 암호화, AD-6)을 신규 도입하고, 카드 골격계약(AD-2: `data-edit-id` 5종 + CSS 변수 4종)을 이번 스토리에서 확정해 시스템 프롬프트로 강제. `main/api/claude.ts`(Anthropic SDK 래퍼), `main/storage/card.ts`(파일 저장 로직), `card:*`/`settings:*` IPC 핸들러, iframe 기반 카드 미리보기 UI 구현. 단위테스트 19건 추가(총 32건). 운영자 본인의 Claude API 키로 패키징된 실행파일에서 실제 API 호출(참고이미지 2장 생성 + 1장 재생성)까지 포함해 AC1/AC2/AC3 전체 실측 검증 완료 — 생성된 HTML이 골격계약을 정확히 준수함을 확인.

## Review Findings

- [x] [Review][Patch] `card:generate`/`card:regenerate`에 `contentFolderPath`/`keyword`/`referenceImagePaths` 누락 검증 추가 [src/main/ipc/card.ts]
- [x] [Review][Patch] 등록 성공 후 키워드 입력을 잠가 `folderPath`/`keyword` 불일치 방지 [src/renderer/src/App.tsx]
- [x] [Review][Patch] 참고이미지 10장 초과 선택 시 잘림을 사용자에게 안내 [src/main/ipc/card.ts, src/renderer/src/App.tsx]
- [x] [Review][Patch] `CardResult`에 명시적 discriminant 필드 추가해 duck-typing 제거 [src/shared/ipc-card.ts, src/renderer/src/App.tsx]
- [x] [Review][Patch] `safeStorage.isEncryptionAvailable()` 사전 체크 추가 [src/main/settings/apiKey.ts, src/main/ipc/settings.ts]
- [x] [Review][Patch] Claude API 호출에 타임아웃 설정 추가 [src/main/api/claude.ts]
- [x] [Review][Defer] iframe에 렌더링되는 Claude 생성 HTML에 대한 정제(sanitization)/골격계약 강제 검증 부재 — deferred, Story 1.6의 명시적 범위(계약 위반 거부 로직)이며 이번 스토리는 시스템 프롬프트로만 유도하기로 스펙에서 이미 결정됨
- [x] [Review][Defer] `settings.json` 비원자적 쓰기(crash 시 손상 가능) — deferred, 필드 1개뿐인 현재로선 위험 낮음, 설정 항목이 늘어나면 원자적 쓰기(temp+rename) 재검토
- [x] [Review][Defer] Claude SDK 에러 메시지를 가공 없이 렌더러로 전달 — deferred, 구체적 키 유출 사례 미확인, 일반적 하드닝이라 후속 스토리에서 재검토
- [x] [Review][Defer] 카드 생성 배치 취소/진행률 UI 부재 — deferred, AC에 없는 UX 개선, 별도 스토리로 검토
- [x] [Review][Defer] 재생성 시 기존 HTML 덮어쓰기 확인 다이얼로그 없음 — deferred, Story 1.4/1.5 인라인 편집 도입 이후 "덮어쓰기 보호" 필요성을 재평가
- [x] [Review][Defer] 참고이미지 파일 크기 상한 검사 없음 — deferred, 구체적 장애 사례 없는 일반 하드닝
- [x] [Review][Defer] 동시에 generate/regenerate 호출 시 렌더러 상태 경쟁 가능성 — deferred, 발생 확률 낮고 수정 시 세대(epoch) 가드 등 설계가 필요해 범위 초과
- [x] [Review][Defer] 선택된 참고이미지가 생성 시점에 삭제된 경우 노출되는 에러 메시지가 사용자 친화적이지 않음(raw ENOENT) — deferred, 이미 개별 카드 단위로 캐치되어 동작은 정상, 메시지 품질만 낮음
- [x] [Review][Defer] `@anthropic-ai/sdk`의 webhook 서명 검증용 전이 의존성(`standardwebhooks` 등) — deferred, 공식 SDK의 의존성이라 직접 조치 불가
