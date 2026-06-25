---
baseline_commit: b449f119f41adb6bd605afafd0fb44e8ac781627
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/1-1-project-scaffolding.md
---

# Story 1.2: 썸네일 등록 & 메타데이터 입력

Status: done

## Story

As a 운영자,
I want 썸네일 이미지와 키워드/제목/홈페이지 URL을 한 화면에서 입력하길,
so that 콘텐츠별 출력 폴더가 자동으로 만들어지고 이후 단계에서 메타데이터를 재입력하지 않아도 된다.

## Acceptance Criteria

1. **Given** 앱을 실행한 상태에서, **When** 사용자가 썸네일 이미지 파일을 선택하고 키워드/제목/홈페이지 URL을 입력 후 등록하면, **Then** `output/{키워드}/{YYMMDD}/` 폴더가 생성된다. **And** 같은 폴더에 `meta.json`(키워드, 제목, URL 포함)이 저장된다. **And** 썸네일 원본 파일이 폴더에 복사된다.
2. **Given** 동일 키워드로 같은 날 다시 등록을 시도했을 때, **When** 등록을 진행하면, **Then** 기존 폴더에 이어서 저장되고 meta.json은 최신 입력값으로 갱신된다.
3. **Given** 키워드 또는 썸네일 파일을 입력하지 않은 상태에서, **When** 등록 버튼을 누르면, **Then** 어떤 항목이 비어있는지 알려주고 폴더를 생성하지 않는다.

## Tasks / Subtasks

- [x] Task 1: `storage/naming.ts` — 폴더/파일 네이밍 유틸 (AD-7) (AC: 1, 2)
  - [x] `formatYYMMDD(date: Date): string` — `YYMMDD` 포맷 (Story 1.1에는 없던 신규 유틸, 영상/이미지 네이밍에서도 이후 스토리가 재사용)
  - [x] `sanitizeKeyword(keyword: string): string` — Windows 경로 금지문자(`< > : " / \ | ? *`)를 제거/치환. PRD/아키텍처에 세부 규칙 없음 — 폴더 생성 실패(디스크 오류)를 막기 위한 최소 가드레일로 이번 스토리에서 결정
  - [x] `getOutputRoot(): string` — 출력 루트 경로. **이번 스토리 신규 결정:** `app.getPath('documents')/SNS콘텐츠제작도구/output`. 사유: 패키징된 앱의 설치 경로(퍼유저 `%LOCALAPPDATA%\Programs\...`)에 콘텐츠를 쓰면 재설치/제거 시 사라지고 사용자가 찾기도 어려움. `userData`는 AD-5에서 "도구 자체 상태"용으로 용도가 분리되어 있어 콘텐츠 산출물에 쓰면 안 됨. Documents 하위는 항상 쓰기 가능하고 탐색기에서 찾기 쉬움. (구현: Electron `app` 의존 없이 순수 테스트 가능하도록 `documentsPath`를 인자로 받는 시그니처로 작성 — 실제 `app.getPath('documents')` 호출은 IPC 핸들러에서 주입)
  - [x] `getContentFolderPath(documentsPath: string, keyword: string, date: Date): string` — `{getOutputRoot(documentsPath)}/{sanitizeKeyword(keyword)}/{formatYYMMDD(date)}` 반환(시그니처에 `documentsPath`가 추가된 이유는 위 항목 참고). 다른 모듈(Story 2.x, 3.x)은 이 함수만 호출하고 직접 경로를 조립하지 않는다(AD-7 핵심 규칙)
  - [x] Vitest 단위테스트 추가 (아래 "테스트 전략" 참고): `formatYYMMDD`, `sanitizeKeyword`, `getContentFolderPath` 순수 함수 검증

- [x] Task 2: `storage/` 콘텐츠 등록 로직 (AC: 1, 2, 3)
  - [x] `registerContent(input: { keyword: string; title: string; homepageUrl: string; thumbnailPath: string }): { folderPath: string }` 함수 작성 (예: `storage/content.ts`)
  - [x] 빈 `keyword` 또는 빈/존재하지 않는 `thumbnailPath`는 이 함수를 호출하기 전 IPC 핸들러(Task 3)에서 검증 — `registerContent` 자체는 유효한 입력만 받는다고 가정해도 됨(검증 책임은 IPC 레이어, AC3는 "등록 버튼을 누르면" 시점의 UX 요구이므로 폴더 생성 이전에 막아야 함)
  - [x] `getContentFolderPath`로 폴더 경로 계산 후 `fs.mkdir(..., { recursive: true })`로 생성(이미 존재해도 에러 없이 통과 — AC2 재등록 케이스)
  - [x] 썸네일 원본을 `thumbnail{원본 확장자}`로 폴더에 복사(`fs.copyFile`). 재등록 시 기존 썸네일을 덮어쓴다
  - [x] `meta.json` 작성: `{ keyword, title, homepageUrl, createdAt, updatedAt }`(타임스탬프는 ISO 8601 — Consistency Conventions 규칙). 폴더에 기존 `meta.json`이 있으면 읽어서 `createdAt`은 보존하고 나머지 필드 + `updatedAt`만 갱신(AC2: "최신 입력값으로 갱신")
  - [x] 폴더 생성/파일 쓰기 등 모든 파일시스템 쓰기는 Main 프로세스에서만 수행(AD-1)

- [x] Task 3: IPC 핸들러 (main/ipc) (AC: 1, 2, 3)
  - [x] `content:select-thumbnail` (`ipcMain.handle`) — `dialog.showOpenDialog`로 이미지 파일(png/jpg/jpeg/webp) 단일 선택. 사용자가 취소하면 `null` 반환
  - [x] `content:register` (`ipcMain.handle`) — payload `{ keyword, title, homepageUrl, thumbnailPath }` 수신
    - `keyword`와 `thumbnailPath`가 비어있으면(trim 후 빈 문자열 또는 undefined) `registerContent` 호출 없이 즉시 `{ ok: false, error: { message: '<비어있는 항목 목록>' } }` 반환(AC3). 메시지는 비어있는 항목을 모두 나열(예: "키워드, 썸네일을 입력해주세요")
    - 유효하면 `registerContent` 호출 후 `{ ok: true, data: { folderPath } }` 반환
    - `title`/`homepageUrl`은 빈 문자열 허용(필수 아님 — PRD §4.5, FR-7에서 빈 URL을 별도 처리하는 전제와 일치)
  - [x] 두 핸들러 모두 IPC 응답 envelope `{ ok, data?, error?: { message } }` 고정 형식 준수(Consistency Conventions)
  - [x] `main/index.ts`(또는 신규 `main/ipc/content.ts`에서 등록 후 `index.ts`에서 import)에 핸들러 등록

- [x] Task 4: Preload 타입드 API 노출 (AC: 1, 2, 3)
  - [x] `src/preload/index.ts`의 빈 `api = {}`에 `selectThumbnail(): Promise<string | null>`, `registerContent(input): Promise<{ ok: boolean; data?: { folderPath: string }; error?: { message: string } }>` 추가, `ipcRenderer.invoke('content:select-thumbnail')` / `ipcRenderer.invoke('content:register', input)`로 위임
  - [x] `src/preload/index.d.ts`의 `Window.api: unknown`을 위 메서드를 가진 구체 인터페이스로 교체(현재 `unknown`이라 렌더러에서 타입 체크가 안 됨 — 이번 스토리에서 처음으로 실제 타입 필요)
  - [x] 공유 타입(`{ keyword, title, homepageUrl, thumbnailPath }` 입력, 응답 envelope)은 `src/shared/`에 정의해 preload와 main IPC 핸들러, renderer가 동일 타입을 import(AD-1 경계를 넘는 계약이므로 한 곳에서만 정의)

- [x] Task 5: 등록 폼 UI (renderer) (AC: 1, 2, 3)
  - [x] `src/renderer/src/App.tsx`의 스캐폴딩 데모(로고/안내문/`Versions`)를 등록 폼으로 교체: 키워드/제목/홈페이지 URL 입력창, 썸네일 선택 버튼(클릭 시 `api.selectThumbnail()` 호출해 선택된 경로를 상태로 저장하고 파일명 표시), 등록 버튼
  - [x] 등록 버튼 클릭 시 `api.registerContent({ keyword, title, homepageUrl, thumbnailPath })` 호출
  - [x] 응답이 `{ ok: false }`이면 `error.message`를 화면에 표시(AC3), 폼 입력값은 유지(재시도 가능하게)
  - [x] 응답이 `{ ok: true }`이면 생성된 `data.folderPath`를 성공 메시지로 표시
  - [x] 더 이상 쓰이지 않는 스캐폴딩 전용 파일(`components/Versions.tsx`, `assets/electron.svg`, `assets/wavy-lines.svg`)은 참조가 모두 제거되면 함께 삭제(미사용 코드 방치 금지)

- [x] Task 6 (계획에 없던 추가 작업): 패키징된 빌드에서 IPC가 전혀 동작하지 않는 회귀 버그 수정 (AC: 1, 2, 3)
  - [x] AC 실측 검증(CDP로 실제 패키징된 `.exe` 구동) 중 `window.api`가 `undefined`로 나타나는 문제 발견 — preload 스크립트가 `sandbox:true` 상태에서 asar 패키징 시 `@electron-toolkit/preload`의 `package.json` `exports` 맵을 Electron 내장 `preloadRequire`가 해석하지 못해 로드 자체에 실패(Electron 42 확인). 개발모드(`npm run dev`)에서는 드러나지 않고 패키징 빌드에서만 재현됨
  - [x] `src/main/index.ts`의 `BrowserWindow` `webPreferences.sandbox`를 `true → false`로 변경해 해결. `contextIsolation:true`/`nodeIntegration:false`(AD-1 필수)는 그대로 유지 — `sandbox`는 Story 1.1 코드리뷰에서 추가된 자체 하드닝 옵션으로 AD-1 요구사항이 아니었음
  - [x] 수정 후 패키징된 `.exe`를 CDP(`--remote-debugging-port`)로 재검증해 AC1/AC2/AC3 모두 실제 동작 확인

## Dev Notes

- **AD-1 (필수):** 파일 다이얼로그, 폴더 생성, 파일 복사, JSON 쓰기는 전부 Main에서만 수행. Renderer는 Task 4의 preload API로만 요청한다. `nodeIntegration:false`/`contextIsolation:true`는 Story 1.1에서 이미 고정됨 — 건드리지 않는다.
- **AD-5 (출력 루트 결정 — 이번 스토리 신규):** `output/`은 DB 없이 파일시스템이 단일 진실 소스라는 원칙은 그대로지만, 아키텍처 스파인의 Structural Seed는 `output/{키워드}/{YYMMDD}/`의 상위 디렉토리(어디 밑에 두는지)를 명시하지 않았다. 이번 스토리에서 `app.getPath('documents')/SNS콘텐츠제작도구/output/`로 확정한다(Task 1 참고). 이후 모든 스토리(2.1, 2.3, 3.1 등 `output/{키워드}/{YYMMDD}/`를 참조하는 모든 곳)는 이 루트를 그대로 따라야 하며, `naming.ts`의 `getContentFolderPath`만 호출해야 한다.
- **AD-7 (필수):** 폴더/파일 네이밍은 전부 `storage/naming.ts`를 통해서만 생성한다. 이 스토리에서 만드는 `getContentFolderPath`/`formatYYMMDD`/`sanitizeKeyword`는 이후 Story 2.1(이미지 렌더링 `{YYMMDD}_{키워드}_{순번}.png`), 2.3(영상 `{YYMMDD}_{키워드}.mp4`), 3.1(원고.txt)이 모두 재사용할 기반 유틸이므로 이름과 시그니처를 신중히 정할 것.
- **IPC 채널 네이밍:** `domain:action` 형식(Consistency Conventions). 이 스토리는 `content` 도메인을 신설 — `content:select-thumbnail`, `content:register`. 향후 `card:generate`(Story 1.3) 등도 동일 패턴을 따른다.
- **IPC 응답 envelope 고정:** `{ ok: boolean, data?, error?: { message } }`. 검증 실패도 IPC `reject`가 아니라 `{ ok:false, error }`로 정상 반환한다(throw 금지) — Renderer가 항상 동일한 모양으로 응답을 처리할 수 있어야 한다.
- **meta.json 스키마(이번 스토리에서 확정):** `{ keyword: string, title: string, homepageUrl: string, createdAt: string, updatedAt: string }` (타임스탬프 ISO 8601). Story 3.1(원고생성)이 `homepageUrl`을 읽어 자동삽입하므로 필드명을 그대로 유지할 것 — 임의 변경 시 3.1이 깨진다.
- **재등록(AC2) 처리:** 폴더 경로는 `키워드+날짜`로 결정되므로 같은 날 같은 키워드면 자동으로 같은 폴더를 가리킨다. 별도의 "기존 폴더 찾기" 로직 불필요 — `mkdir recursive` + `meta.json` 덮어쓰기(단 `createdAt`은 기존 값 보존)로 자연스럽게 충족된다.
- **검증 책임 분리:** 폴더를 생성하기 전에 막아야 하는 검증(AC3)은 IPC 핸들러(Task 3)에서 수행하고, `registerContent`(Task 2)는 이미 유효한 입력만 받는다고 가정한다. Task 2 함수 내부에 중복 검증을 넣지 말 것(스토리 범위를 벗어난 방어코드).
- **스코프 경계:** 이번 스토리는 `output/{키워드}/{YYMMDD}/` 폴더와 `meta.json`, `thumbnail.*`만 만든다. `html/`, `image/`, `video/`, `원고.txt`는 각각 Story 1.3/2.1/2.3/3.1이 필요할 때 직접 만든다 — 이번 스토리에서 미리 빈 서브폴더를 만들지 않는다(범위 외 작업).

### 테스트 전략(이번 스토리에서 첫 도입)

- Story 1.1은 비즈니스 로직이 없어 테스트 프레임워크를 도입하지 않았고, "1.3 이후 재검토"로 유보했다. 이번 스토리(1.2)부터 순수 로직(네이밍/검증)이 생기므로 **Vitest**를 도입한다 — electron-vite 공식 템플릿이 Vite 기반이라 Vitest와 설정 마찰이 가장 적고, 별도 러너 설정이 거의 필요 없다.
- 단위테스트 대상은 `storage/naming.ts`의 순수 함수(`formatYYMMDD`, `sanitizeKeyword`, `getContentFolderPath`)로 한정한다. Electron 런타임에 의존하는 부분(파일 다이얼로그, IPC, 실제 파일시스템 쓰기, React 폼)은 Story 1.1처럼 `npm run dev` 실측으로 AC를 검증한다(이 영역까지 단위테스트로 끌고 가면 Electron mocking 비용이 스토리 범위를 초과함).
- `package.json`에 `vitest`를 devDependency로 추가하고 `"test": "vitest run"` 스크립트를 추가한다.

### Project Structure Notes

- `src/main/storage/.gitkeep`(Story 1.1에서 빈 폴더로 생성됨) 위치에 `naming.ts`, `content.ts` 신규 생성 — `.gitkeep`은 삭제.
- `src/main/ipc/.gitkeep` 위치에 `content.ts`(또는 동등 파일) 신규 생성 — `.gitkeep` 삭제.
- `src/shared/.gitkeep` 위치에 IPC 계약 타입 파일(예: `ipc-content.ts`) 신규 생성 — `.gitkeep` 삭제.
- `tsconfig.node.json`/`tsconfig.web.json`이 `src/shared`를 이미 include 하고 있음(Story 1.1 코드리뷰에서 추가됨) — 신규 파일 추가 시 별도 tsconfig 수정 불필요. 확인만 할 것.
- Vitest 설정 파일이 `electron.vite.config.ts`와 충돌하지 않도록 별도 `vitest.config.ts`(또는 `vite-node` 환경)로 분리하는 것을 권장 — electron-vite의 멀티 빌드 설정(`main`/`preload`/`renderer`)에 테스트 러너를 끼워 넣지 말 것.

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-5, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 권한분리, 파일시스템 단일 진실소스, 네이밍 유틸 단일화
- [ARCHITECTURE-SPINE.md#Consistency-Conventions](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — IPC 채널 네이밍(`domain:action`), 응답 envelope, 날짜 포맷(YYMMDD/ISO8601)
- [ARCHITECTURE-SPINE.md#Structural-Seed](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — `output/{키워드}/{YYMMDD}/meta.json` 구조
- [PRD §4.5, FR-8](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 출력 폴더/메타데이터 요구사항 및 재실행 시 동작
- [PRD §4.4 FR-7 / 4.6](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — `homepageUrl`이 빈 값일 수 있다는 전제(3.1과의 계약)
- [epics.md#Story-1.2](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [1-1-project-scaffolding.md](./1-1-project-scaffolding.md) — `ELECTRON_RUN_AS_NODE` 환경변수 이슈, React+TS 렌더러 결정, 소스 트리 골격

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `npm install -D vitest` 후 `vitest.config.ts` 분리 설정(`electron.vite.config.ts`와 무관) — `src/**/*.test.ts`만 포함.
- 초기 AC 실측 검증 시 패키징된 `.exe`(`dist/win-unpacked/sns-content-tool.exe`)를 `--remote-debugging-port=9333`으로 띄워 CDP(Chrome DevTools Protocol)로 직접 검증(좌표 기반 마우스 클릭은 Story 1.1에서도 겪은 DPI 가상화 왜곡 때문에 신뢰 불가 — 1-1 Dev Notes 참고).
- CDP로 빈 값 등록 클릭 시 버튼이 `disabled` 상태로 멈추고 아무 메시지도 뜨지 않는 현상 발견 → `Runtime.consoleAPICalled`/`Runtime.exceptionThrown` 이벤트를 구독해 원인 추적 → `Unable to load preload script ... Error: module not found: @electron-toolkit/preload` 콘솔 에러 확인.
- `asarUnpack`에 `@electron-toolkit/**`를 추가해봤지만(파일 자체는 `app.asar.unpacked`에 정상 존재 확인) 동일 에러 재현 — asar 압축 여부와 무관하게 Electron의 사Sandbox 전용 `preloadRequire`가 패키지의 `exports` 맵을 해석하지 못하는 것이 근본 원인으로 판단, `asarUnpack` 변경은 되돌림.
- `webPreferences.sandbox: true → false`로 변경 후 재빌드, 동일 CDP 방식으로 재검증 — `window.api`가 정상 노출되고 빈 값 제출 시 `"키워드, 썸네일을(를) 입력해주세요"` 메시지 확인, 정상 입력 + 재등록 시나리오도 `window.api.registerContent()`를 CDP로 직접 호출해 폴더/`meta.json`/`thumbnail.png` 생성 및 `createdAt` 보존을 파일시스템에서 직접 확인 후 테스트 폴더 정리.

### Completion Notes List

- `storage/naming.ts`(`formatYYMMDD`, `sanitizeKeyword`, `getOutputRoot`, `getContentFolderPath`)와 `storage/content.ts`(`registerContent`)를 순수 함수/모듈로 작성하고 Vitest 단위테스트 8건 추가. `getOutputRoot`/`getContentFolderPath`는 Electron `app` 모듈에 의존하지 않도록 `documentsPath`를 인자로 받는 시그니처로 설계해 Electron 런타임 없이도 테스트 가능하게 함(스토리 문서의 시그니처보다 인자 1개 추가, Dev Notes에 사유 기록).
- `main/ipc/content.ts`에 `content:select-thumbnail`/`content:register` IPC 핸들러 구현, 검증 책임(빈 키워드/썸네일 체크)을 `getMissingRequiredFields`라는 순수 함수로 분리해 단위테스트 5건 추가.
- `shared/ipc-content.ts`에 IPC 채널 상수 + 요청/응답 타입 정의, preload(`index.ts`/`index.d.ts`)와 main IPC 핸들러, renderer가 동일 타입을 import하도록 연결.
- `App.tsx`를 스캐폴딩 데모에서 등록 폼(키워드/제목/홈페이지 URL/썸네일 선택/등록)으로 교체하고, 더 이상 쓰이지 않는 `components/Versions.tsx`, `assets/electron.svg`, `assets/wavy-lines.svg`와 데모 전용 CSS를 제거.
- **회귀 버그 수정(계획 외):** 패키징된 빌드에서 `sandbox:true` + `@electron-toolkit/preload`의 `exports` 맵 조합이 Electron 42의 sandboxed preload 로더와 충돌해 preload 전체가 로드되지 않는 문제를 발견하고 `sandbox:false`로 수정. AD-1이 요구하는 `contextIsolation:true`/`nodeIntegration:false`는 변경하지 않음.
- 검증: 단위테스트 13건 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과, `npm run build:win` 성공, 패키징된 실행파일을 CDP로 직접 구동해 AC1(폴더+meta.json+썸네일 생성)/AC2(재등록 시 `createdAt` 보존 + 나머지 필드 갱신)/AC3(빈 값 제출 시 누락 항목 안내) 모두 실측 확인.
- **코드리뷰 반영(8개 관점 병렬 리뷰 후 3건 수정):**
  1. `main/ipc/content.ts`의 `content:register` 핸들러와 `App.tsx`의 `handleSubmit`에 예외 처리 누락 — `registerContent`가 던지는 예외(존재하지 않는 썸네일 경로, 손상된 `meta.json` 등)가 IPC 경유로 unhandled rejection이 되어 등록 버튼이 영구적으로 `disabled` 상태에 멈추고 아무 메시지도 안 뜨는 버그 발견(실제로 이번 스토리의 sandbox 버그 디버깅 중 동일 증상을 직접 목격함). `content.ts`에 `try/catch` 추가해 모든 실패를 `{ok:false, error}`로 정상 반환하도록 수정, `App.tsx`에도 `try/catch/finally`를 추가해 어떤 경우에도 `setSubmitting(false)`가 호출되도록 보강.
  2. `sanitizeKeyword`가 Windows 금지문자만 제거하고 새니타이즈 결과가 빈 문자열이거나 `"."`/`".."`가 되는 경우를 막지 않아, 키워드가 전부 금지문자면 같은 날 다른 등록과 폴더가 충돌하고, 키워드가 정확히 `".."`이면 `path.join`이 이를 상위 폴더 이동으로 해석해 `output/` 바로 위(앱 전용 폴더 루트)에 `meta.json`/썸네일을 쓰는 문제 발견 — `isUnusableKeyword` 검증을 추가해 `content:register`에서 사전에 거부(단위테스트 4건 추가, 패키징된 실행파일에서 CDP로 재검증).
  3. `sandbox:false`(이번 스토리에서 preload 회귀 수정으로 도입)는 의도된 트레이드오프로 유지 — 다만 보안 완화 범위가 BrowserWindow 전체에 적용되는 점은 알려진 한계로 기록(아래 Change Log 참고). 더 좁은 수정(예: `@electron-toolkit/preload` 자체 패치/대체)은 이번 스토리 범위를 벗어나 후속 과제로 남김.
  - 리뷰에서 추가로 식별됐으나 이번 스토리 범위에서는 보류한 항목(낮은 심각도, 1인 운영 도구 위협모델 고려): `registerContent`가 자체적으로 입력을 재검증하지 않고 IPC 레이어의 사전검증에 암묵적으로 의존하는 점, 썸네일 파일의 실제 확장자/존재 여부를 서버 측에서 재검증하지 않는 점(파일 다이얼로그 필터는 UI 편의일 뿐), `mkdirSync`/`copyFileSync` 등 동기 파일시스템 호출이 메인 프로세스를 블로킹할 수 있는 점.

### File List

- `package.json` (수정 — `vitest` devDependency, `test` 스크립트 추가)
- `vitest.config.ts` (신규)
- `electron-builder.yml` (수정 없음 — 디버깅 중 `asarUnpack` 추가했다가 되돌림, 최종 변경 없음)
- `src/main/index.ts` (수정 — `content:register` IPC 핸들러 등록, `sandbox: true → false`)
- `src/main/storage/naming.ts` (신규)
- `src/main/storage/naming.test.ts` (신규)
- `src/main/storage/content.ts` (신규)
- `src/main/storage/content.test.ts` (신규)
- `src/main/storage/.gitkeep` (삭제)
- `src/main/ipc/content.ts` (신규, 코드리뷰 추가 수정 — `isUnusableKeyword` 검증, `registerContent` 호출부 `try/catch`)
- `src/main/ipc/content.test.ts` (신규, 코드리뷰 추가 수정 — `isUnusableKeyword` 단위테스트 4건)
- `src/main/ipc/.gitkeep` (삭제)
- `src/shared/ipc-content.ts` (신규)
- `src/shared/.gitkeep` (삭제)
- `src/preload/index.ts` (수정 — `selectThumbnail`/`registerContent` API 노출)
- `src/preload/index.d.ts` (수정 — `Window.api` 타입을 `ContentApi`로 구체화)
- `src/renderer/src/App.tsx` (수정 — 스캐폴딩 데모 → 등록 폼, 코드리뷰 추가 수정 — `handleSubmit`에 `try/catch/finally`)
- `src/renderer/src/assets/main.css` (수정 — 데모 스타일 제거, 등록 폼 스타일 추가)
- `src/renderer/src/components/Versions.tsx` (삭제 — 미사용)
- `src/renderer/src/assets/electron.svg` (삭제 — 미사용)
- `src/renderer/src/assets/wavy-lines.svg` (삭제 — 미사용)

## Change Log

- 2026-06-25: Story 1.2 구현 완료 — 썸네일 등록 & 메타데이터 입력(FR-8). `storage/naming.ts`(AD-7 네이밍 유틸, 출력 루트를 `Documents/SNS콘텐츠제작도구/output`으로 신규 확정), `storage/content.ts`(등록/재등록 로직), `content:*` IPC 핸들러, preload 타입드 API, 등록 폼 UI 구현. 이번 스토리부터 Vitest 도입(순수 로직 13건 단위테스트). 패키징 빌드에서만 재현되는 preload 로딩 회귀 버그(`sandbox:true`+`@electron-toolkit/preload` exports 맵 비호환)를 발견해 `sandbox:false`로 수정. AC1/AC2/AC3 모두 패키징된 실행파일에서 CDP로 실측 검증.
- 2026-06-25: 코드리뷰 반영(8개 관점 병렬 리뷰) — IPC 핸들러/렌더러에 예외 처리 누락으로 등록 버튼이 영구 비활성화되는 버그 수정, 키워드가 `".."`이거나 전부 금지문자일 때 출력 폴더를 이탈/충돌시키는 문제를 `isUnusableKeyword` 검증으로 차단(단위테스트 4건 추가, 총 17건). 패키징된 실행파일에서 CDP로 재검증 완료. `sandbox:false`는 의도된 트레이드오프로 유지, 좁은 범위 재수정은 후속 과제로 기록.
