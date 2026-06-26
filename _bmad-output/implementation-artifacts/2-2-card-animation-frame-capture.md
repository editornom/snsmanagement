---
baseline_commit: c7829946e3c8ac38727a42db65941f2e756845b7
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/2-1-html-image-rendering.md
---

# Story 2.2: 카드 애니메이션 프레임캡처

Status: done

## Story

As a 운영자,
I want 각 카드의 진입 애니메이션과 노출시간 전체가 영상 프레임으로 정확히 캡처되길,
so that 반복 모션이 있어도 끊기지 않고 영상에 담긴다.

## Acceptance Criteria

1. **Given** 카드 HTML과 노출시간(애니메이션+추가노출 3초)이 정해진 상태에서, **When** 프레임캡처를 실행하면, **Then** 60fps로 해당 노출시간 전체가 결정론적 프레임스테핑 방식으로 캡처된다(반복 모션 포함, 정지구간 가정 없음). 캡처된 프레임 시퀀스는 카드별 임시 폴더에 저장된다.
2. **Given** 카드가 여러 장일 때, **When** 전체 프레임캡처를 실행하면, **Then** 모든 카드가 순서대로 캡처되고, 다음 카드로 넘어갈 때 별도 전환효과 없이 해당 카드 자체의 진입 애니메이션이 전환처럼 보인다.

## Tasks / Subtasks

- [x] Task 0: 설계 결정 (이번 스토리에서 신규 결정 — FR-5 패턴은 PRD에 `[ASSUMPTION]`으로만 표시돼 있고, 카드 골격 계약(AD-2)에는 애니메이션이 전혀 없음) (AC: 1, 2)
  - [x] **FR-5("모든 카드는 동일한 애니메이션 패턴, 카드별 랜덤화 없음")는 Claude가 카드별로 CSS 애니메이션을 생성하는 방식이 아니라, 프레임캡처 시점에 고정된 공용 CSS/JS를 주입하는 방식으로 구현한다.** 이유: (a) AD-2 골격 계약은 `data-edit-id`만 보장하므로 모든 카드에 동일한 셀렉터 기반 애니메이션을 적용할 수 있다, (b) "카드별 랜덤 다양화 없음" 요구사항을 Claude 생성에 맡기면 보장할 수 없다, (c) AD-4 "이 파이프라인은 Claude API를 호출하지 않는다"와 합치한다. **결과적으로 Story 1.3~1.6에서 만들어진 카드 HTML 파일(`html/` 폴더, 인라인편집 대상)에는 애니메이션 코드가 전혀 추가되지 않는다** — 애니메이션은 프레임캡처용 BrowserWindow에 로드되는 사본에만 주입된다(2.1의 `image:render`가 카드 HTML을 그대로 캡처하는 것과 달리, 이번 캡처는 주입된 변형본을 캡처).
  - [x] **공용 애니메이션 정의(고정값, 신규 모듈에 상수로 둔다):** `data-edit-id="title-bar"` → 0ms 시작, `data-edit-id="bullet-N"`/`icon-N"` → `80ms * N` 시작(불릿/아이콘은 함께 등장), `data-edit-id="footer"` → 가장 마지막 불릿 시작시각 + 80ms. 각 요소는 동일 키프레임(opacity 0→1 + translateY 24px→0, `ease-out`, 500ms, 1회, 반복 없음)을 사용한다. 진입 애니메이션 총 길이(`entryDurationMs`) = `마지막 요소 시작시각 + 500ms`이며, 카드의 불릿 개수(`bullet-N` 최대 N)에 따라 카드마다 달라진다 — 고정 상수가 아니라 DOM에서 실측해야 한다.
  - [x] **노출시간(캡처 총 길이) = `entryDurationMs + 3000ms`** (PRD §4.3/FR-6 "애니메이션 완료 후 3초 추가 노출" 그대로 적용). 추가노출 3초 구간에서는 모든 요소가 최종 상태(opacity:1, translateY:0)로 고정된 정지 프레임이 반복 캡처된다 — AD-4가 "반복 모션 포함, 정지구간 가정 없음"을 요구하므로 향후 카드에 반복(루핑) 모션이 추가되어도 이 캡처 메커니즘 자체는 변경 없이 동작해야 한다(아래 결정 참고).
  - [x] **결정론적 프레임스테핑 메커니즘(AD-4 핵심 요구):** `did-finish-load` 후 Web Animations API로 모든 애니메이션을 가져와(`document.getAnimations()`) 즉시 `pause()`한다. 이후 프레임 인덱스 `i = 0..totalFrames-1`마다 `executeJavaScript`로 각 애니메이션의 `currentTime = min(i * (1000/60), animation.effect.getTiming().duration ?? Infinity)`을 설정(애니메이션 종료 후에는 duration에 고정해 최종 상태 유지 — 반복(`iterations: Infinity`) 애니메이션이 향후 추가되면 `currentTime`을 그대로 진행시키면 자동으로 루프하므로 "정지구간 가정 없음" 요구를 그대로 만족) → 매 스텝마다 `capturePage()` 호출 → PNG로 저장. **실시간 재생을 보고 캡처하지 않는다** — 시간이 얼마나 걸리든 정확히 60fps 시퀀스가 나온다(AD-4 원문 그대로).
  - [x] **카드 1장씩 순차 처리, 카드별 독립 성공/실패 반환** — 2.1의 `image:render`와 동일한 `CardResult`류 부분실패 패턴을 재사용한다.

- [x] Task 1: 공용 애니메이션 주입 모듈 (AC: 1, 2)
  - [x] `src/main/render/cardAnimation.ts`(신규): `injectEntryAnimation(html: string): { html: string; entryDurationMs: number }` — 원본 카드 HTML 문자열에 `<style>`(키프레임 + `data-edit-id` 셀렉터별 `animation-delay`)과 `<script>`(로드 즉시 모든 `Animation`을 `pause()` — 그래야 `loadURL` 시점에 임의로 재생되다가 캡처 시작 전에 끝나버리는 경쟁을 막는다)을 `</head>` 직전에 삽입한 새 HTML 문자열을 반환한다. `entryDurationMs`는 HTML 문자열에서 `bullet-(\d+)` 패턴의 최대 N을 정규식으로 스캔해 위 공식으로 계산한다(DOM 파싱 없이 문자열 스캔만으로 충분 — 정확한 값은 실제 캡처 시 DOM의 `getAnimations()` duration이 최종 근거이고 이 값은 `totalFrames` 계산용 사전 추정치).
  - [x] 단위테스트(`cardAnimation.test.ts`): 불릿 0개/1개/10개일 때 `entryDurationMs` 계산이 공식과 일치하는지, 반환된 HTML에 `<style>`/`<script>`가 삽입되고 원본 `data-edit-id` 구조가 그대로 보존되는지(문자열 포함 검증).

- [x] Task 2: 프레임 스테핑 캡처 모듈 (AC: 1, 2)
  - [x] `src/main/render/frameCapture.ts`(신규)에 `captureCardFrames(html: string, outputDir: string): Promise<{ frameCount: number }>` 작성: 2.1의 `cardImage.ts`와 동일한 `show:false`/`useContentSize:true`/1080x1350 `BrowserWindow` + data URI 로드 패턴을 재사용(중복 구현 금지 — `loadHtml` 유틸은 `cardImage.ts`에서 export해 공유하거나 동일 시그니처로 옮긴다). 로드 완료 후: (1) `executeJavaScript('document.getAnimations().forEach(a => a.pause())')`, (2) Task 1에서 계산한 `entryDurationMs` + 3000ms로 `totalDurationMs` 산출, `totalFrames = Math.ceil(totalDurationMs / (1000/60))`, (3) 프레임 루프: 매 스텝 `executeJavaScript`로 모든 애니메이션의 `currentTime` 설정 → `capturePage()` → `resize({width:1080,height:1350})` → `frame-{5자리 0패딩 순번}.png`로 `outputDir`에 저장(`mkdirSync(outputDir, {recursive:true})` 선행). `finally`에서 `win.destroy()`.
  - [x] 2.1과 동일하게 `did-fail-load`/30초 로드 타임아웃 처리(프레임 루프 자체는 로컬 동기 작업이라 별도 타임아웃 불필요).
  - [x] 임시 폴더 경로: `app.getPath('temp')/sns-content-tool-frames/card-{index 2자리}/`(AD-5에 따라 `output/`은 영구 콘텐츠 산출물 전용이고, 프레임 시퀀스는 2.3에서 ffmpeg 인코딩 후 삭제되는 휘발성 산출물이므로 OS 임시 디렉터리 사용 — `naming.ts`의 영구 산출물 네이밍 규칙과는 별개 경로 체계임을 명확히 한다). 이 경로 생성 로직은 `frameCapture.ts` 내부에 두되, 향후 2.3이 동일 규칙으로 폴더를 찾아야 하므로 `getCardFrameDirPath(tempRoot: string, cardIndex: number): string` 형태로 분리해 export한다(AD-7 정신 — 임시 경로도 한 곳에서만 조립).

- [x] Task 3: `frame:capture` IPC 채널 + 핸들러 (AC: 1, 2)
  - [x] `src/shared/ipc-frame.ts`(신규): `FRAME_CAPTURE_CHANNEL = 'frame:capture'`, `CaptureFrameCardInput { index: number; html: string }`, `CaptureFramesRequest { cards: CaptureFrameCardInput[] }`, `FrameCaptureSuccess { status: 'success'; index: number; frameDir: string; frameCount: number }`, `FrameCaptureFailure { status: 'failure'; index: number; error: string }`, `FrameCaptureResult = FrameCaptureSuccess | FrameCaptureFailure`, `CaptureFramesResponseData { results: FrameCaptureResult[] }`. **2.1의 `ipc-image.ts`와 달리 `htmlPath`는 받지 않는다** — 이번 스토리는 디스크에 애니메이션이 적용된 파일을 쓰지 않으므로(Task 0 결정) `htmlPath` 기반 파생이 필요 없다.
  - [x] `src/main/ipc/frame.ts`(신규)에 `registerFrameIpcHandlers()`: 빈 배열 검증(2.1과 동일 에러 envelope 패턴) → 카드별 순차: `injectEntryAnimation(card.html)` → `captureCardFrames(injectedHtml, getCardFrameDirPath(tempRoot, card.index))` → 성공/실패 개별 처리(throw 금지, try/catch). `src/main/index.ts`에 등록 추가.
  - [x] `src/main/ipc/frame.test.ts`(신규): 2.1의 `image.test.ts`와 동일 구조 — `injectEntryAnimation`/`captureCardFrames` 모킹, 정상 다건/부분실패/빈 배열 케이스.

- [x] Task 4: Preload 타입드 API 노출 (AC: 1, 2)
  - [x] `src/preload/index.ts`/`index.d.ts`에 `captureCardFrames(request: CaptureFramesRequest): Promise<IpcResult<CaptureFramesResponseData>>` 추가. **이번 스토리는 UI 버튼을 추가하지 않는다** — 프레임 시퀀스는 그 자체로 사용자에게 보여줄 결과물이 아니라 Story 2.3(영상 조립)의 중간 입력이며, 2.3에서 "영상 만들기" 버튼이 이 IPC를 내부적으로 호출하는 파이프라인의 한 단계로 통합된다. UI 노출은 2.3 스토리의 범위.

- [x] Task 5: 테스트 및 실측 검증 (AC: 1, 2)
  - [x] `cardAnimation.test.ts`/`frame.test.ts`는 Task 1/3에서 작성.
  - [x] **CDP 실측(2.1과 동일 방법론):** 패키징된 앱을 `--remote-debugging-port`로 띄우고, 디버그 훅으로 더미 카드(`title-bar` 1개 + `bullet-1`~`bullet-3`/`icon-1`~`icon-3` + `footer`, 골격계약을 만족하는 간단한 HTML)를 주입한 뒤 `window.api.captureCardFrames(...)` 호출 → 응답의 `frameCount`가 예상 공식(`Math.ceil((entryDurationMs+3000)/(1000/60))`)과 일치하는지, 실제로 `frameDir`에 그 개수만큼 PNG가 생성됐는지, 첫 프레임(0ms)과 마지막 프레임의 PNG가 시각적으로 다른지(애니메이션이 실제로 진행됐는지 — 예: 픽셀 단위 비교 또는 파일 크기 차이로 1차 확인), IHDR로 1080x1350 크기 확인. 검증 후 임시 폴더/빌드 산출물 삭제.

### Review Findings

- [x] [Review][Patch] `injectEntryAnimation`이 `el.style.animation`에 `fill: forwards`만 지정해, `animation-delay`가 있는 엘리먼트(불릿/아이콘/푸터)가 delay 구간(애니메이션 비활성 상태) 동안 키프레임의 `from` 상태가 아니라 기본(불투명) 스타일로 보이다가, delay가 끝나는 순간 `opacity:0`으로 튀고 다시 페이드인되는 깜빡임이 발생하던 문제 — CDP로 `getComputedStyle().opacity`를 직접 측정해 확인(delay 160ms 엘리먼트: `currentTime=0`/`80`에서 opacity `1`, `currentTime=160`에서 갑자기 `0`). `fill: both`로 변경해 delay 구간에도 `from` 키프레임이 적용되도록 수정, 동일 측정으로 `opacityAtZero`/`opacityDuringDelay`가 `0`으로 정정됐음을 재확인(PASS). [src/main/render/cardAnimation.ts]
- [x] [Review][Defer] `computeEntryDurationMs`(Node, `entryDurationMs` 사전추정)는 HTML 문자열 전체에서 `/bullet-(\d+)/g`를 비anchored로 스캔하고, 주입된 `<script>`(브라우저, `footerStartMs` 실제 적용값)는 `data-edit-id` 속성값을 `^bullet-(\d+)$`로 엄격 매칭한다 — 두 계산이 서로 다른 소스(문자열 스캔 vs DOM 속성)라서, 카드 HTML에 `data-edit-id` 속성이 아닌 곳(예: CSS 클래스명, 텍스트 콘텐츠)에 우연히 "bullet-N" 패턴이 등장하면 Node의 사전추정이 실제 애니메이션 완료시점과 달라질 수 있음(주로 과대추정 → 프레임이 약간 더 캡처되어 끝부분에 정지 프레임이 늘어나는 정도로, AC를 깨뜨리지는 않음). deferred — 카드 골격 계약(AD-2)상 `data-edit-id`는 지정된 영역에만 부여되고 자유 텍스트는 별도 마크업 요소 안에 들어가 `bullet-N` 문자열이 그대로 등장할 가능성이 낮음. 완전히 봉쇄하려면 Node가 추정하지 않고 브라우저가 실측한 `entryDurationMs`를 IPC로 되돌려받는 구조 변경이 필요해 범위 초과로 판단.

## Dev Notes

- **이번 스토리부터 `main/render/`에 "캡처용 변형 HTML"이라는 새로운 개념이 생긴다.** 2.1까지는 항상 "카드의 실제 HTML(디스크에 저장되는 것과 동일)"을 그대로 렌더링했지만, 이번 스토리는 애니메이션이 주입된 별도 사본만 캡처하고 원본 카드 HTML 파일은 건드리지 않는다(Task 0). 이 차이를 다음 스토리(2.3) 작성자도 알아야 한다 — 프레임 시퀀스의 "내용"은 카드 HTML과 100% 같지 않다(애니메이션 코드가 추가된 상태).
- **AD-1 준수:** `BrowserWindow`/`capturePage`/파일쓰기는 전부 Main에서만.
- **AD-3 해석 — 프레임캡처도 "동일 엔진" 범위.** `show:false BrowserWindow` + `capturePage()`를 그대로 재사용하므로 Playwright 등 별도 엔진을 추가하지 않는다.
- **AD-4 핵심 — 이번 스토리가 AD-4를 처음으로 구현한다.** 60fps 고정, 결정론적 프레임스테핑(Web Animations API `currentTime` 강제 설정, 실시간 재생 캡처 금지), 반복 모션을 가정한 설계(향후 looping 애니메이션이 추가돼도 메커니즘 변경 불필요), ffmpeg 전환효과(`xfade`) 없음(2.3에서 단순 연결), Claude API 미호출(주입 애니메이션은 고정 상수) — 전부 이번 스토리의 설계 결정에 반영됨.
- **AD-7 정신 확장:** 영구 산출물 네이밍은 `naming.ts`가 단일 소스이지만, 이번 스토리가 다루는 임시 프레임 경로는 영구 산출물이 아니므로 `naming.ts`에 넣지 않고 `frameCapture.ts`의 `getCardFrameDirPath`로 분리한다(나중에 2.3이 동일 함수를 import해서 찾는다 — 직접 문자열 조립 금지).
- **2.1과의 차이를 명확히:** `image:render`(2.1)는 사용자가 보는 최종 PNG 산출물이라 `output/{키워드}/{YYMMDD}/image/`에 영구 저장되고 `htmlPath` 기반 경로 파생이 필요했다. `frame:capture`(이번 스토리)는 2.3에서 곧 삭제될 중간 산출물이라 OS 임시 디렉터리를 쓰고, 영구 파일 경로(`htmlPath`)와 무관하게 카드 인덱스만으로 폴더를 정한다. 이 차이로 `ipc-frame.ts`는 `ipc-image.ts`와 입력 형태가 다르다(Task 3 참고) — 그대로 복붙하지 말 것.
- **`document.getAnimations()`는 Electron의 Chromium(최신 버전)에서 표준 지원되는 Web Animations API다** — 별도 폴리필 불필요. CSS `animation` 속성으로 정의된 애니메이션도 이 API로 조회/제어 가능(브라우저가 내부적으로 Animation 객체를 생성).
- **불릿 개수가 0개인 카드(이론상 가능, AC상 "개수는 내용에 맞게 자유")도 처리해야 한다** — 그 경우 `entryDurationMs`는 `title-bar`(0ms 시작) + `footer`(바로 다음 시작) 두 요소만의 타임라인으로 계산된다. Task 1의 정규식 스캔이 0건 매치해도 에러 없이 동작해야 한다.

### Project Structure Notes

- `src/main/render/cardAnimation.ts` 신규, `cardAnimation.test.ts` 신규.
- `src/main/render/frameCapture.ts` 신규(`cardImage.ts`의 `loadHtml` 유틸 재사용 — 필요시 `cardImage.ts`에서 export로 변경).
- `src/shared/ipc-frame.ts` 신규.
- `src/main/ipc/frame.ts` 신규, `frame.test.ts` 신규.
- `src/main/index.ts` 수정(`registerFrameIpcHandlers` 등록).
- `src/preload/index.ts`/`index.d.ts` 수정(`captureCardFrames` 노출, UI 버튼 없음).
- `App.tsx` 수정 없음(이번 스토리는 UI 변경 없음 — Task 4 참고).
- 신규 런타임 의존성 없음(Electron 자체 API만 사용, AD-3/AD-4).

### References

- [ARCHITECTURE-SPINE.md#AD-4](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 결정론적 프레임스테핑, 60fps, 반복모션 가정, Claude API 미호출 규칙의 원본
- [PRD §4.3, FR-5/FR-6](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 모션그래픽 패턴(ASSUMPTION이었던 페이드인+슬라이드인을 이번 스토리에서 확정), 타이밍 규칙(애니메이션+3초)
- [epics.md#Story-2.2](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [2-1-html-image-rendering.md](./2-1-html-image-rendering.md) — `show:false BrowserWindow`+`capturePage()`+data URI 로드 패턴(`cardImage.ts`), `CardResult` 부분실패 패턴, IPC envelope 규칙, CDP 실측 방법론(동일하게 재사용)
- `src/templates/card-system-prompt.ts` — 카드 골격 계약 원본(`data-edit-id` 네이밍: `title-bar`/`bullet-N`/`icon-N`/`footer`) — 이번 스토리의 애니메이션 셀렉터가 의존하는 계약

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 패키징된 앱(`npm run build:unpack`)을 CDP(`--remote-debugging-port=9333`/`9334`)로 띄우고 `window.api.captureCardFrames(...)`를 직접 호출해 실측 검증(2.1과 동일 방법론, 단 이번 스토리는 디스크 카드 상태에 의존하지 않아 디버그 훅 없이 더미 HTML을 즉석에서 전달).
  - 1차 실측에서 모든 프레임 PNG가 바이트 단위로 동일(`frame-00000.png === frame-00050.png === frame-00229.png`)한 회귀를 발견 — 원인: `injectEntryAnimation`이 엘리먼트 탐색 `<script>`를 `</head>` 직전에 넣어, HTML 파서가 아직 `<body>`를 만들기 전에 스크립트가 실행되어 `querySelectorAll('[data-edit-id]')`가 0건 매치(애니메이션이 전혀 적용되지 않음 → `getAnimations()`가 빈 배열 → `currentTime` 설정/캡처가 전부 무의미). `cardAnimation.ts`를 수정해 엘리먼트 탐색 스크립트만 `</body>` 직전(키프레임 `<style>`은 그대로 `</head>` 직전)으로 옮겨 해결.
  - 수정 후 재검증: 불릿 3개 카드 → `entryDurationMs=820ms`, `frameCount=230`(공식과 일치) — `frame-00000.png`와 `frame-00050.png`가 다른 내용(애니메이션 진행 확인), `frame-00050.png`부터 `frame-00229.png`까지 동일(진입 애니메이션 종료 후 3초 정지노출 정상 유지), 전체 1080x1350(IHDR 확인).
  - 2장 동시 캡처(불릿 1개/5개) → 카드별로 독립된 `entryDurationMs`(660ms/980ms)에 따라 다른 `frameCount`(220/239)가 반환됨을 확인(AC2 — 카드마다 자기 진입 애니메이션 길이만큼 독립 캡처).
  - 검증 후 임시 프레임 폴더(`%TEMP%/sns-content-tool-frames/`), 빌드 산출물(`dist/`) 삭제, electron 프로세스 종료. 비용 0(Claude API 미호출, 로컬 렌더링).

### Completion Notes List

- Task 0: FR-5(모든 카드 동일 애니메이션, 랜덤화 없음)는 Claude 생성이 아니라 프레임캡처 시점 공용 CSS/JS 주입 방식으로 결정(카드 HTML 디스크 파일은 변경하지 않음). 공용 애니메이션: title-bar(0ms)→bullet-N/icon-N(80ms*N)→footer(마지막 불릿+80ms) 순서로 opacity+translateY 500ms 1회. 노출시간=entryDurationMs+3000ms. 프레임스테핑은 Web Animations API `currentTime`을 경과시간 그대로 설정하는 방식으로 단순화(각 애니메이션의 `fill:forwards`가 자체적으로 종료 후 최종 상태를 유지하므로, Task 설계 초안의 `min(..., duration)` 클램프 로직 없이도 동일한 결과를 얻음 — 향후 반복(loop) 애니메이션이 추가돼도 `currentTime`이 자동으로 순환하므로 메커니즘 변경 불필요).
- Task 1: `cardAnimation.ts`에 `computeEntryDurationMs`(bullet-N 정규식 스캔)와 `injectEntryAnimation`(키프레임 `<style>`은 `</head>` 직전, 엘리먼트 탐색/딜레이 부여 `<script>`는 `</body>` 직전에 삽입) 작성. 단위테스트 7건(불릿 0/1/10개 공식 검증, 골격 보존, `</head>`/`</body>` 유무에 따른 fallback 3종) 전체 통과.
- Task 2: `frameCapture.ts`에 `captureCardFrames(html, entryDurationMs, outputDir)` 작성 — `cardImage.ts`의 `loadHtml`을 export해 재사용, 로드 후 모든 애니메이션 `pause()` → `frameCount = Math.ceil((entryDurationMs+3000)/(1000/60))`개 프레임을 매 스텝 `currentTime` 설정+`capturePage()`+리사이즈로 캡처해 `frame-{5자리}.png`로 저장. `getCardFrameDirPath(tempRoot, cardIndex)`로 임시 경로 단일화(`app.getPath('temp')/sns-content-tool-frames/card-{2자리}/`). **설계 초안과의 차이:** `entryDurationMs`를 `frameCapture.ts` 내부에서 다시 계산하지 않고 호출부(IPC 핸들러)가 `injectEntryAnimation`에서 받은 값을 그대로 전달하도록 시그니처를 `(html, entryDurationMs, outputDir)`로 변경(중복 계산 방지, 단일 진실 소스 유지).
- Task 3: `ipc-frame.ts`(`FRAME_CAPTURE_CHANNEL`, 타입 정의, `htmlPath` 없음)와 `main/ipc/frame.ts`(`registerFrameIpcHandlers` — 빈 배열 검증, 카드별 순차 `injectEntryAnimation`→`captureCardFrames`, 부분실패 패턴) 작성, `main/index.ts`에 등록. 단위테스트 4건(빈 배열 에러, 정상 다건, 일부 실패해도 나머지 성공, 애니메이션 주입 실패 시 개별 실패 처리) 전체 통과.
- Task 4: preload(`captureCardFrames`) 노출. 스토리 결정대로 UI 버튼 없음(2.3에서 통합 예정).
- Task 5: 단위테스트 89건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과(prettier 경고 3건 `--write`로 정리). CDP 실측에서 1차 회귀(스크립트가 `<head>`에서 실행돼 애니메이션이 전혀 적용되지 않던 버그)를 발견·수정 후 재검증 PASS — 프레임 개수 공식 일치, 진입 애니메이션 진행 확인(프레임 내용 변화), 3초 정지노출 구간 안정성 확인, 1080x1350 크기 확인, 카드별 독립 길이 캡처 확인(2장 동시 테스트).

### File List

- `src/main/render/cardImage.ts` (수정 — `loadHtml`을 export로 변경, `frameCapture.ts`에서 재사용)
- `src/main/render/cardAnimation.ts` (신규)
- `src/main/render/cardAnimation.test.ts` (신규)
- `src/main/render/frameCapture.ts` (신규)
- `src/shared/ipc-frame.ts` (신규)
- `src/main/ipc/frame.ts` (신규)
- `src/main/ipc/frame.test.ts` (신규)
- `src/main/index.ts` (수정 — `registerFrameIpcHandlers` 등록)
- `src/preload/index.ts` (수정 — `captureCardFrames` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `captureCardFrames` 추가)

### Change Log

- 2026-06-26: Story 2.2 컨텍스트 생성 — FR-5("모든 카드 동일 애니메이션 패턴")를 Claude 생성이 아닌 프레임캡처 시점 고정 주입 방식으로 구현하기로 결정(AD-2/AD-4 근거), Web Animations API `currentTime` 강제 설정 기반 결정론적 60fps 프레임스테핑 메커니즘 설계. Status: ready-for-dev.
- 2026-06-26: Story 2.2 구현 완료 — 공용 진입 애니메이션 주입(`cardAnimation.ts`), 결정론적 60fps 프레임스테핑 캡처(`frameCapture.ts`), `frame:capture` IPC. CDP 실측 중 "엘리먼트 탐색 스크립트가 `<head>`에서 실행돼 애니메이션이 전혀 적용되지 않는" 회귀를 발견해 즉시 수정(스크립트를 `</body>` 직전으로 이동) — 수정 후 재검증 PASS. 단위테스트 89건/typecheck/lint 전체 통과. Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(line-by-line/removed-behavior/cross-file/cleanup-efficiency-altitude-conventions 8개 앵글) 진행, patch 1건 발견 즉시 반영 — `fill: forwards`만 지정해 delay 구간에서 깜빡임(opacity 1→0 팝)이 발생하던 문제, CDP로 `getComputedStyle().opacity` 실측 확인 후 `fill: both`로 수정·재검증 PASS. defer 1건은 위 Review Findings에 기록(Node/브라우저 이중 `entryDurationMs` 계산 소스 불일치 가능성, 실사용 위험 낮음). 전체 단위테스트/typecheck/lint 재확인 통과. Status: review → done.
