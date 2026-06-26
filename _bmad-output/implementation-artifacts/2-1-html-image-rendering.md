---
baseline_commit: 00d1bb2f33de1084467c7795d67b5c563eb7fac1
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-6-ai-instruction-editing.md
---

# Story 2.1: HTML → 이미지 렌더링

Status: done

## Story

As a 운영자,
I want 완성된 카드 HTML들을 PNG로 일괄 렌더링하길,
so that 영상과 별개로 SNS 이미지 게시물로도 쓸 수 있다.

## Acceptance Criteria

1. **Given** 완성된 카드 HTML들이 있을 때, **When** 이미지 렌더링을 실행하면, **Then** 각 카드가 1080x1350 PNG로 `{YYMMDD}_{키워드}_{순번}.png` 형식으로 `image/` 폴더에 저장된다.
2. (위 AC의 두 번째 절) 원본 HTML도 동일 순번 규칙으로 `html/` 폴더에 보존된다.

## Tasks / Subtasks

- [x] Task 0: 구현 방식 결정 (이번 스토리에서 신규 결정 — PRD/아키텍처는 AD-3로 엔진만 정하고 세부 메커니즘은 미정) (AC: 1, 2)
  - [x] **렌더링 입력은 디스크 재읽기가 아니라 Renderer가 보내는 라이브 HTML이다.** 1.5/1.6에서 확립한 "항상 라이브 iframe DOM을 직렬화해 보낸다" 패턴을 그대로 따른다 — 인라인 편집(1.4)은 디바운스 저장이라 디스크 파일이 화면보다 최신이 아닐 수 있다. 따라서 Renderer는 렌더링 실행 시 각 카드의 iframe `contentDocument`를 `serializeCardDocument`로 직렬화해 `{ index, htmlPath, html }[]` 배열로 Main에 전달한다.
  - [x] **PNG 경로는 새로 날짜를 계산하지 않고 기존 `htmlPath`에서 파생시킨다.** `htmlPath`는 카드 생성 시점에 확정된 값(`.../html/{YYMMDD}_{키워드}_{순번}.html`)이고, 오늘 날짜로 다시 조립하면 1.4 코드리뷰에서 고친 "날짜 재계산 버그"가 재발한다(생성일과 렌더링 실행일이 다른 날일 수 있음). `naming.ts`에 `getCardImagePathFromHtmlPath(htmlPath: string): string`을 추가해 경로 문자열의 `\html\` 디렉터리 세그먼트를 `\image\`로, `.html` 확장자를 `.png`로 치환한다(둘 다 `getCardHtmlPath`가 생성한 형식이라 구조가 고정적임을 신뢰할 수 있다).
  - [x] **렌더링 핸들러는 PNG를 만들기 전에 받은 `html`로 해당 `htmlPath`를 덮어쓴다(`overwriteCardHtmlFile` 재사용).** 이렇게 하면 (a) AC2 "html도 보존"이 항상 "지금 렌더링한 것과 동일한 내용"을 가리키게 되고, (b) 아직 디바운스 저장이 실행되지 않은 라이브 편집분도 이 시점에 디스크로 플러시된다. PNG와 HTML 파일이 서로 다른 내용을 가리키는 불일치를 방지하기 위한 결정.
  - [x] **렌더링 메커니즘은 AD-3을 그대로 따른다: `show:false`인 일반 `BrowserWindow`(Electron의 특수 `webPreferences.offscreen:true` 페인팅 모드가 아님) + `loadURL`(data: URI)+`capturePage()`.** `offscreen:true` 모드는 별도 페인트 이벤트 파이프라인이 필요해 복잡도가 크고, 미리보기(`<iframe>`)와 동일한 일반 Chromium 렌더링 경로를 타는 `show:false` 창이 AD-3의 "미리보기와 동일 엔진" 취지에 더 부합한다. 카드 HTML은 외부 리소스를 쓰지 않는 완전한 단일 문서(`card-system-prompt.ts` 규칙)이므로 임시 파일 없이 `data:text/html;charset=utf-8,${encodeURIComponent(html)}`로 직접 로드 가능하다.
  - [x] **창 크기는 `useContentSize:true, width:1080, height:1350`으로 고정하고, 캡처 후 `NativeImage.resize({width:1080,height:1350})`로 한 번 더 강제한다.** `capturePage()`는 호스트 디스플레이의 배율(devicePixelRatio)에 따라 1080x1350보다 큰 물리 픽셀로 캡처될 수 있다(고DPI 모니터에서 흔한 함정). 캡처된 이미지를 명시적으로 리사이즈해 항상 정확히 1080x1350 PNG가 나오도록 보장한다.
  - [x] **카드 1장씩 순차 처리하고, 카드별 성공/실패를 독립적으로 반환한다.** 1.3/1.6의 `card:generate`/`card:regenerate`와 동일한 `CardResult`류 패턴(부분 실패가 다른 카드에 영향 없음)을 재사용해 일관성을 유지한다.

- [x] Task 1: 이미지 경로 파생 유틸 (AC: 1, 2)
  - [x] `src/main/storage/naming.ts`에 `getCardImagePathFromHtmlPath(htmlPath: string): string` 추가: `htmlPath` 문자열에서 마지막 `\html\` 또는 `/html/` 세그먼트를 `image`로 바꾸고 확장자 `.html` → `.png`로 치환. 입력이 예상 형식(`.../html/....html`)이 아니면 에러를 throw한다(naming.ts의 기존 함수들처럼 추측성 fallback을 두지 않는다).
  - [x] `src/main/storage/naming.test.ts`에 단위테스트 추가: 정상 변환(Windows `\` 구분자 기준 기존 `getCardHtmlPath` 출력값을 입력으로 사용), 예상 형식이 아닌 입력(예: `html/` 세그먼트 없음)에 대한 에러 케이스.

- [x] Task 2: 카드 HTML → PNG 렌더링 모듈 (AC: 1)
  - [x] `src/main/render/cardImage.ts`(신규)에 `renderCardHtmlToPng(html: string, outputPath: string): Promise<void>` 작성: `show:false`, `useContentSize:true`, `width:1080`, `height:1350`인 `BrowserWindow` 생성 → `loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))` → `did-finish-load` 이벤트 대기 → `webContents.capturePage()` → 결과 `NativeImage`를 `resize({width:1080,height:1350})` → `mkdirSync(dirname(outputPath), {recursive:true})` 후 `writeFileSync(outputPath, image.toPNG())` → `win.destroy()`(성공/실패 모두 `finally`에서 반드시 호출해 창이 누적되지 않도록 한다).
  - [x] 로드 실패(`did-fail-load`)도 별도로 리스닝해 reject하고 타임아웃(예: 30초, 로컬 렌더링이라 1.3/1.6의 120초 API 타임아웃보다 훨씬 짧게)도 둔다 — 외부 네트워크 호출이 없는 로컬 렌더링이 멈춰있을 이유가 없으므로 30초 초과 시 명확한 에러로 실패 처리.

- [x] Task 3: `image:render` IPC 채널 + 핸들러 (AC: 1, 2)
  - [x] `src/shared/ipc-image.ts`(신규)에 `IMAGE_RENDER_CHANNEL = 'image:render'`, `RenderImageCardInput { index: number; htmlPath: string; html: string }`, `RenderCardsRequest { cards: RenderImageCardInput[] }`, `ImageRenderSuccess { status: 'success'; index: number; imagePath: string }`, `ImageRenderFailure { status: 'failure'; index: number; error: string }`, `ImageRenderResult = ImageRenderSuccess | ImageRenderFailure`, `RenderCardsResponseData { results: ImageRenderResult[] }` 정의.
  - [x] `src/main/ipc/image.ts`(신규)에 `registerImageIpcHandlers()` 작성: `request.cards`가 비어있으면 에러 envelope 반환(`{ok:false, error:{message:'렌더링할 카드가 없습니다'}}`) → 카드별로 순차 처리: `overwriteCardHtmlFile(card.htmlPath, card.html)`(Task 0 결정) → `getCardImagePathFromHtmlPath(card.htmlPath)`로 이미지 경로 계산 → `renderCardHtmlToPng(card.html, imagePath)` → 성공 시 `{status:'success', index, imagePath}`, 실패 시 try/catch로 잡아 `{status:'failure', index, error: message}`(throw 금지, 1.3/1.6과 동일한 envelope 규칙) → 전체를 `{ok:true, data:{results}}`로 반환(개별 카드 실패가 있어도 envelope 자체는 ok, 1.3/1.6의 부분실패 패턴과 동일).
  - [x] `src/main/index.ts`에 `registerImageIpcHandlers()` import 및 `app.whenReady()` 내 다른 핸들러들과 함께 호출 추가.
  - [x] `src/main/ipc/image.test.ts`(신규)에 핸들러 테스트: 정상 렌더링(여러 카드, `overwriteCardHtmlFile`/`renderCardHtmlToPng` 호출 검증), 일부 카드만 렌더링 실패해도 나머지는 성공으로 반환됨, 빈 배열 입력 시 에러, `renderCardHtmlToPng` 자체가 throw하는 경우. `'../render/cardImage'`의 `renderCardHtmlToPng`와 `'../storage/card'`의 `overwriteCardHtmlFile`을 모킹해 실제 BrowserWindow 생성 없이 검증.

- [x] Task 4: Preload 타입드 API + Renderer UI (AC: 1, 2)
  - [x] `src/preload/index.ts`/`index.d.ts`에 `renderCardsToImages(request: RenderCardsRequest): Promise<IpcResult<RenderCardsResponseData>>` 추가.
  - [x] `App.tsx`에 카드 목록 영역에 "이미지로 렌더링" 버튼 추가(카드가 1장 이상 있을 때만 노출, 이미 진행 중이면 비활성화 — `renderingImages: boolean` 상태). 클릭 시 `handleRenderImages()`: (1) `cards` 중 `status`가 success(즉 `htmlPath` 보유)인 카드 각각의 iframe `contentDocument`를 `serializeCardDocument`로 직렬화(Task 0의 라이브 DOM 패턴), (2) `window.api.renderCardsToImages({cards: [{index, htmlPath, html}, ...]})` 호출, (3) 응답의 `results`를 카드별 성공/실패 메시지로 화면에 표시(`cardsMessage`와 유사하게 카드 인덱스별 결과 텍스트, 예: "카드 1: image/260626_haion_01.png 저장 완료" / "카드 3: 렌더링 실패 - ...").
  - [x] 렌더링 중에는 버튼을 비활성화하고 간단한 로딩 표시(`renderingImages`) — 로컬 렌더링이라 API 호출보다 빠르지만 카드 수가 많으면 수 초 걸릴 수 있어 중복 클릭 방지.

- [x] Task 5: 테스트 (AC: 1, 2)
  - [x] `naming.test.ts`는 Task 1에서 작성.
  - [x] `main/ipc/image.test.ts`는 Task 3에서 작성.
  - [x] **실제 BrowserWindow 렌더링 1회는 비용이 들지 않는 로컬 동작이므로 CDP로 직접 실측 검증한다.** 패키징된 앱을 `--remote-debugging-port`로 띄우고(1.4/1.5/1.6과 동일 방법론) 실제 카드 생성 없이도 검증 가능하도록, 디버그 훅으로 `cards` 상태에 더미 HTML(고정 텍스트의 1080x1350 div 등 골격계약을 만족하는 간단한 HTML)을 주입한 뒤 "이미지로 렌더링" 버튼을 실제 클릭 → 응답에서 반환된 `imagePath` 파일이 실제로 디스크에 생성됐는지, PNG 헤더(IHDR 청크의 width/height 바이트, offset 16~23)를 읽어 정확히 1080x1350인지 확인. 검증 후 디버그 훅 제거.

### Review Findings

- [x] [Review][Patch] `handleRenderImages`가 보류 중인 디바운스 저장 타이머(`saveTimers`)를 취소하지 않고 라이브 DOM을 읽어 렌더링을 시작해, 1.6/재생성과 동일한 "지연 저장이 늦게 실행되어 막 처리한 결과와 경쟁"하는 패턴 위험이 있던 문제 — 1.6/재생성에서 이미 확립된 패턴(시작 시 해당 카드의 타이머 취소)을 동일하게 적용 [src/renderer/src/App.tsx]
- [x] [Review][Defer] `getCardImagePathFromHtmlPath`의 정규식이 "html" 세그먼트 앞뒤 구분자 문자가 동일해야 매치되는데(백레퍼런스 `\2`), 혼합 구분자(`\`와 `/`가 같은 경로에 섞인 경우) 입력에는 매치되지 않고 throw됨 [src/main/storage/naming.ts] — deferred, 이 함수에 전달되는 `htmlPath`는 항상 `getCardHtmlPath`(같은 파일, `path.join` 사용)가 생성한 값이라 실사용에서 구분자가 섞일 수 없음. 존재하지 않는 입력에 대한 방어 로직 추가는 과잉설계로 판단해 보류.
- [x] [Review][Defer] `handleRenderImages`의 `item.html as string`/`item.htmlPath as string` 캐스팅이 "htmlPath가 있으면 html도 있다"는 코드베이스 전반의 암묵적 불변식에 의존함 [src/renderer/src/App.tsx] — deferred, `handleGenerateCards`/`handleRegenerateCard`/`handleApplyInstruction`/`handleRevertInstruction` 전부 둘을 항상 함께 설정/유지해 현재 코드 경로상 깨질 수 없음. 만약 깨지더라도 Main 쪽 `overwriteCardHtmlFile`이 throw해 해당 카드만 실패로 처리되고(다른 카드 영향 없음) 크래시로 이어지지 않음.
- [x] [Review][Defer] `image:render` 핸들러가 카드를 순차적으로 렌더링해 `BrowserWindow` 생성/소멸 오버헤드가 카드 수에 비례해 누적됨(병렬화 시 단축 가능) [src/main/ipc/image.ts] — deferred, Task 0에서 "카드별 독립 성공/실패, 1.3/1.6과 동일한 순차 패턴"으로 의도적으로 결정한 사항이고, 1인 도구 특성상 카드 수가 많지 않아 체감 차이가 작음. 병렬화는 여러 `BrowserWindow`를 동시에 띄우는 리소스 사용 패턴 변경이라 범위 초과.

## Dev Notes

- **이번 스토리는 Epic 2의 첫 스토리이며 `main/render/` 폴더에 처음으로 실제 구현이 들어간다.** 기존 `.gitkeep`만 있던 폴더(Story 1.1에서 구조 시드로 미리 만들어둠)를 사용한다.
- **AD-1 준수:** `BrowserWindow` 생성/`capturePage`/파일쓰기는 전부 Main에서만. Renderer는 `window.api.renderCardsToImages`로만 요청.
- **AD-3 준수 — "미리보기와 동일 엔진" 해석.** 미리보기는 `<iframe>`(일반 Chromium 렌더링), 렌더링은 `show:false` `BrowserWindow`(역시 일반 Chromium 렌더링) — 둘 다 Playwright 등 별도 엔진을 쓰지 않는다는 점에서 AD-3을 만족한다. Electron의 특수 `offscreen:true` 페인팅 모드는 쓰지 않기로 Task 0에서 결정(불필요한 복잡도).
- **AD-7 준수:** 이미지 경로는 `naming.ts`(`getCardImagePathFromHtmlPath`)에서만 파생시킨다. 다른 모듈이 직접 문자열을 조립하지 않는다.
- **htmlPath 재사용 원칙 — 1.4에서 정립된 패턴의 재적용.** "저장은 항상 생성 시점에 확정된 `htmlPath`를 그대로 쓰고, 현재 날짜로 재계산하지 않는다"는 원칙이 이번 스토리(이미지 경로 파생)에도 그대로 적용된다. `getCardImagePathFromHtmlPath`가 문자열 치환 방식을 택한 이유.
- **렌더링 시 html 파일을 함께 덮어쓰는 이유(Task 0 참고):** AC가 "원본 HTML도 보존된다"고 명시하므로, 렌더링한 PNG와 디스크의 HTML 파일이 항상 같은 내용을 가리키도록 렌더링 직전에 동기화한다. 이는 동시에 디바운스 미반영 편집분을 플러시하는 부수효과도 가진다(1.4/1.5의 디바운스 저장과의 상호작용 주의).
- **이 파이프라인은 Claude API를 호출하지 않는다(AD-4 문서에도 명시).** 토큰 비용 없음 — 테스트/CDP 실측에서 비용 걸림 없이 자유롭게 반복 실행 가능.
- **고DPI 캡처 함정:** `capturePage()`가 호스트 모니터 배율에 따라 1080x1350보다 큰 픽셀로 캡처될 수 있다는 점을 잊지 말 것(Task 2 참고) — 이를 놓치면 운영 PC의 모니터 설정에 따라 출력 PNG 크기가 들쭉날쭉해지는 재현 어려운 버그가 된다.

### Project Structure Notes

- `src/main/storage/naming.ts` 수정(`getCardImagePathFromHtmlPath` 추가), `naming.test.ts` 수정.
- `src/main/render/cardImage.ts` 신규(`.gitkeep` 자리에 첫 구현 추가).
- `src/shared/ipc-image.ts` 신규.
- `src/main/ipc/image.ts` 신규, `image.test.ts` 신규.
- `src/main/index.ts` 수정(`registerImageIpcHandlers` 등록).
- `src/preload/index.ts`/`index.d.ts` 수정.
- `src/renderer/src/App.tsx` 수정(렌더링 버튼/핸들러/결과 표시 UI).
- 신규 런타임 의존성 없음(Electron 자체 API만 사용, AD-3).

### References

- [ARCHITECTURE-SPINE.md#AD-3, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 렌더 엔진 단일화, 파일 네이밍 단일 유틸
- [PRD §4.3, FR-4](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — HTML→이미지 렌더링
- [epics.md#Story-2.1](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-3-html-card-generation.md](./1-3-html-card-generation.md) — `CardResult`(success/failure 부분실패) 패턴, `card-system-prompt.ts`의 카드 HTML 자체완결성(외부 리소스 없음) 보장
- [1-4-card-inline-editing.md](./1-4-card-inline-editing.md) — `htmlPath`는 생성 시점 값을 그대로 재사용(날짜 재계산 금지) 원칙의 원본 사례
- [1-6-ai-instruction-editing.md](./1-6-ai-instruction-editing.md) — "항상 라이브 iframe DOM을 직렬화해 전달" 패턴, IPC envelope/부분실패 규칙, CDP 실측 방법론

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 실제 BrowserWindow 렌더링을 패키징된 앱(`npm run build:unpack`)에서 CDP(`--remote-debugging-port=9333`)로 실측 검증: Node `WebSocket`으로 CDP에 직접 접속해 `Runtime.evaluate`로 `window.api.renderCardsToImages(...)`를 더미 카드 1장(1080x1350 배경색 div)으로 호출 → `{ok:true, data:{results:[{status:'success', index:1, imagePath:...}]}}` 응답 확인 → 디스크에서 PNG 파일 존재 확인 + IHDR 청크(offset 16~23)를 직접 읽어 폭/높이가 정확히 `0x438`(1080)/`0x546`(1350)임을 확인 → 동일 경로의 html 파일도 저장되어 있음을 확인(AC2). 검증 후 테스트 출력 폴더(`output/cdptest/`) 삭제, 빌드 산출물(`dist/`) 삭제, electron 프로세스 종료. 비용 0(Claude API 미호출, 로컬 렌더링).

### Completion Notes List

- Task 0: 렌더링 입력은 Renderer가 보내는 라이브 HTML(디스크 재읽기 안 함), PNG 경로는 `htmlPath` 문자열 치환으로 파생(날짜 재계산 금지 원칙 재적용), 렌더링 핸들러가 PNG 생성 전 html을 디스크에 먼저 덮어써 PNG/HTML 내용 불일치를 방지, `show:false` 일반 BrowserWindow + `capturePage()`(Electron 특수 offscreen 페인팅 모드 아님) 사용, 캡처 후 명시적 리사이즈로 고DPI 환경에서도 정확히 1080x1350 보장, 카드별 독립 성공/실패(CardResult류 패턴 재사용) 결정.
- Task 1: `naming.ts`에 `getCardImagePathFromHtmlPath` 추가(정규식으로 `\html\`/`/html/` 세그먼트와 `.html` 확장자를 치환, 형식이 다르면 throw). 단위테스트 4건(정상 변환, 슬래시 구분자, html 세그먼트 없음 에러, 확장자 불일치 에러) 전부 통과.
- Task 2: `src/main/render/cardImage.ts`(신규) — `show:false`/`useContentSize:true`/1080x1350 `BrowserWindow`에 data URI로 카드 HTML 로드, `did-finish-load` 대기 후 `capturePage()` → `resize({1080,1350})` → PNG 파일 쓰기, `did-fail-load`/30초 타임아웃 처리, `finally`에서 항상 `win.destroy()`.
- Task 3: `image:render` IPC 채널/타입(`shared/ipc-image.ts`), 핸들러(`main/ipc/image.ts`)는 빈 배열 검증 → 카드별로 html 덮어쓰기 → 이미지 경로 파생 → 렌더링 → 성공/실패 결과 누적(부분 실패가 다른 카드에 영향 없음, throw 금지). `main/index.ts`에 등록 추가. 단위테스트 4건(빈 배열 에러, 정상 다건 렌더링, 일부 실패해도 나머지 성공, 경로 파생 실패도 개별 실패로 처리) 전부 통과.
- Task 4: preload(`renderCardsToImages`) 노출, `App.tsx`에 "이미지로 렌더링" 버튼 + `handleRenderImages`(라이브 iframe DOM 직렬화 → IPC 호출 → 카드별 성공/실패 메시지 표시) + `renderingImages` 로딩/중복클릭 방지 상태 추가.
- Task 5: 단위테스트 86건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과. CDP 실측(위 Debug Log 참고)으로 실제 PNG 생성 및 1080x1350 정확한 크기, html 보존을 직접 확인(PASS). 모든 태스크 완료.

### File List

- `src/main/storage/naming.ts` (수정 — `getCardImagePathFromHtmlPath` 추가)
- `src/main/storage/naming.test.ts` (수정 — 단위테스트 추가)
- `src/main/render/cardImage.ts` (신규)
- `src/main/render/.gitkeep` (삭제 — 실제 구현으로 대체)
- `src/shared/ipc-image.ts` (신규)
- `src/main/ipc/image.ts` (신규)
- `src/main/ipc/image.test.ts` (신규)
- `src/main/index.ts` (수정 — `registerImageIpcHandlers` 등록)
- `src/preload/index.ts` (수정 — `renderCardsToImages` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `renderCardsToImages` 추가)
- `src/renderer/src/App.tsx` (수정 — "이미지로 렌더링" 버튼/핸들러/결과 표시 UI)

### Change Log

- 2026-06-26: Story 2.1 구현 완료 — HTML→PNG 렌더링(AC1), html 보존(AC2). `main/render/cardImage.ts`로 Electron `BrowserWindow`+`capturePage()` 기반 로컬 렌더링 신규 구현, `naming.ts`에 htmlPath→imagePath 파생 유틸 추가. CDP 실측으로 실제 PNG 생성 및 정확한 1080x1350 크기 확인(PASS). Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(line-by-line/removed-behavior/cross-file/cleanup-efficiency-altitude-conventions 8개 앵글) 진행, patch 1건 발견 즉시 반영 — `handleRenderImages`가 보류 중인 디바운스 저장 타이머를 취소하지 않던 문제. defer 3건은 위 Review Findings에 기록(정규식 구분자 불변식, html/htmlPath 캐스팅 불변식, 순차 렌더링 효율). 전체 테스트/typecheck/lint 재확인 통과. Status: review → done.
