---
baseline_commit: NO_VCS
---

# Story 1.1: 프로젝트 스캐폴딩

Status: review

## Story

As a 운영자(Junghoo),
I want Electron+TypeScript 기반 프로젝트가 세팅되어 실행/패키징 가능하길,
so that 이후 모든 기능을 이 위에 쌓을 수 있다.

## Acceptance Criteria

1. **Given** Node.js ≥22.12 환경에서 저장소를 클론했을 때, **When** `npm install` 후 `npm run dev`를 실행하면, **Then** 1920x1080 빈 Electron 윈도우가 표시된다. **And** Main 프로세스는 `contextIsolation:true`, `nodeIntegration:false`로 설정되어 있다.
2. **Given** 개발 환경에서, **When** `npm run build`(electron-builder, NSIS 타깃)를 실행하면, **Then** Windows용 .exe 설치파일이 생성된다. **And** 설치 후 실행하면 동일한 빈 윈도우가 뜬다.

## Tasks / Subtasks

- [x] Task 1: electron-vite 프로젝트 스캐폴딩 (AC: 1)
  - [x] `npm create @quick-start/electron@latest` 실행, template `react-ts` 선택 (`--skip` 플래그로 비대화형 실행, 별도 임시 폴더에 생성 후 루트로 병합 — 루트에 기존 기획문서가 있어 직접 대상 지정시 삭제확인 프롬프트가 뜸)
  - [x] `package.json`에 `"engines": { "node": ">=22.12" }` 명시
  - [x] 생성된 폴더 구조를 아키텍처 스파인 Structural Seed와 비교 — `src/main`, `src/preload`, `src/renderer` 그대로 일치, 차이는 Task 4에서 보정
- [x] Task 2: Main 윈도우/보안 설정 (AC: 1) — AD-1 준수
  - [x] `src/main/index.ts`에서 `BrowserWindow` 옵션을 `width:1920, height:1080`으로 설정
  - [x] `webPreferences: { contextIsolation: true, nodeIntegration: false, preload: <preload경로> }` 명시적 설정(템플릿 기본값에 없던 contextIsolation/nodeIntegration 명시 추가)
  - [x] `npm run dev` 실행 확인 — Electron이 직접 보고한 `mainWindow.getBounds()` = `{width:1920, height:1080}`로 검증(임시 디버그 로그로 확인 후 제거)
- [x] Task 3: electron-builder NSIS 패키징 설정 (AC: 2)
  - [x] `electron-builder.yml`에 `appId: net.haion.sns-content-tool`, `productName`, `win.target: nsis` 설정 (mac/linux 섹션 및 미사용 publish/auto-update 설정 제거 — NFR1 Windows 전용, AD 자동업데이트 없음 결정과 일치)
  - [x] `npm run build:win` 실행해 `dist/sns-content-tool-1.0.0-setup.exe` 생성 확인
  - [x] 설치파일 자체 실행은 시스템 레지스트리/시작메뉴를 변경하는 행위라 보류, 대신 `dist/win-unpacked/sns-content-tool.exe`(패키징된 미설치 빌드)를 직접 실행해 동일한 1920x1080 Electron 윈도우가 뜨는 것을 확인
- [x] Task 4: 소스 트리 골격 정리 (AC: 1, 2) — 아키텍처 스파인 Structural Seed 반영
  - [x] `src/main/api/`, `src/main/render/`, `src/main/storage/`, `src/main/ipc/`에 `.gitkeep` 생성
  - [x] `src/templates/`, `src/shared/`에 `.gitkeep` 생성 (`src/preload`는 electron-vite 기본 스캐폴딩에 이미 존재)
  - [x] electron-vite 기본 생성 구조와 충돌 없이 병합 확인

## Dev Notes

- **렌더러 프레임워크 결정(이번 스토리에서 신규 확정):** 아키텍처 스파인은 렌더러 프레임워크를 명시하지 않았음. 이후 스토리들(등록 폼, 인라인 에디터, 코드패널, 설정화면)의 구현 편의를 위해 **React + TypeScript**로 결정(electron-vite 공식 템플릿 `react-ts` 사용). 코드패널은 추후 스토리(1.5)에서 CodeMirror/Monaco 등 라이브러리를 추가로 검토.
- AD-1(Main/Renderer 권한분리) 준수가 이 스토리의 핵심: `contextIsolation:true`, `nodeIntegration:false`는 협상 불가 — 이후 모든 IPC가 이 경계를 전제로 설계됨.
- 이 스토리는 빈 윈도우만 띄우는 것이 목표이며 IPC 채널, Claude API 클라이언트, 렌더링 파이프라인 등은 다루지 않음(각각 후속 스토리에서 해당 폴더에 구현).
- DB/엔티티 생성 없음(아키텍처 AD-5: 파일시스템 단일화, 이 스토리에서는 해당사항 없음).
- **테스트 방식**: 아키텍처 스파인에 테스트 프레임워크 지정이 없고, 이 스토리는 비즈니스 로직이 없는 순수 스캐폴딩/설정 작업이라 단위테스트 대상이 없음. AC는 실제 빌드/실행(개발모드+패키징된 실행파일)으로 검증함. 추후 비즈니스 로직이 생기는 스토리(1.3 이후)부터 테스트 프레임워크 도입 여부를 재검토.

### Project Structure Notes

- 그린필드 프로젝트라 기존 코드와의 충돌 없음.
- electron-vite 기본 스캐폴딩이 만드는 `src/main`, `src/preload`, `src/renderer`는 아키텍처 스파인의 Structural Seed와 이름이 일치하므로 그대로 사용. `src/main` 하위에 `api/`, `render/`, `storage/`, `ipc/` 서브폴더만 추가로 만들면 됨.
- `src/templates/`, `src/shared/`는 electron-vite 기본 구조에 없는 신규 폴더 — 이번 스토리에서 빈 폴더로 미리 만들어둠(내용은 Story 1.3 이후에 채워짐).

### References

- [ARCHITECTURE-SPINE.md#AD-1](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — Main/Renderer 권한 분리, contextIsolation/nodeIntegration 규칙
- [ARCHITECTURE-SPINE.md#Stack](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — Electron ^42, electron-vite, TypeScript ^5, electron-builder ^26, Node ≥22.12
- [ARCHITECTURE-SPINE.md#Structural-Seed](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — 소스 트리 골격
- [PRD §4.6](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — NFR1(데스크탑 GUI/.exe), NFR2(1920x1080 창 해상도)
- [epics.md#Story-1.1](../planning-artifacts/epics.md) — 원본 스토리 정의

### Latest Tech Notes (2026-06 웹 리서치)

- **electron-vite**는 2026년 기준 신규 Electron 프로젝트의 공식 권장 스캐폴딩/빌드 도구로, main/preload/renderer 관심사 분리를 기본 제공함 — 본 프로젝트 아키텍처 파라다임과 정확히 일치. 스캐폴딩 명령: `npm create @quick-start/electron@latest`. ([electron-vite.org](https://electron-vite.org/))
- **electron-builder** NSIS 타깃 설정 시 주요 옵션: `oneClick`(원클릭 설치 여부), `perMachine`(전체 사용자 설치 여부), `allowToChangeInstallationDirectory`(설치경로 변경 허용) — 1인 도구이므로 기본값(oneClick:false 권장, 설치경로 변경 허용)으로 시작해도 무방. ([electron.build/nsis](https://www.electron.build/nsis.html))

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `npm create @quick-start/electron@latest .` 대상으로 바로 실행하면 "Current directory is not empty. Remove existing files and continue?" 프롬프트가 뜸(루트에 `_bmad-output` 등 기획문서가 있어서) — 비대화형 환경이라 답할 수 없으므로, 별도 디렉터리(`scaffold-tmp`)에 스캐폴딩 후 생성된 파일만 루트로 이동하는 방식으로 회피. `--skip` 플래그 + 점(`.`) 없는 유효한 패키지명 디렉터리를 줘야 프롬프트 없이 진행됨.
- 최초 `npm run dev` 시 `Error: Electron uninstall` — `electron` 패키지의 postinstall 바이너리 다운로드가 `npm install` 중 누락됨. `node node_modules/electron/install.js` 수동 실행으로 해결.
- 그 다음 `npm run dev` 시 `TypeError: Cannot read properties of undefined (reading 'isPackaged')` — 원인은 셸 환경변수 `ELECTRON_RUN_AS_NODE=1`이 설정되어 있어 Electron 바이너리가 일반 Node처럼 동작함. `env -u ELECTRON_RUN_AS_NODE`로 해당 변수를 제거하고 실행해야 정상 동작. **다음 스토리에서도 `npm run dev`/패키징된 exe 실행 시 이 환경변수를 제거하고 실행해야 함.**
- 창 크기 외부 검증(PowerShell `GetWindowRect`)이 DPI 가상화로 왜곡된 값(1610x848)을 반환함 — Electron 자체의 `mainWindow.getBounds()`로 재검증해 1920x1080 정확히 일치함을 확인. 외부 OS API로 Electron 창 크기를 검증할 때는 DPI 보정 문제를 감안할 것.

### Completion Notes List

- electron-vite(react-ts 템플릿) 기반으로 프로젝트 스캐폴딩 완료, Electron을 아키텍처 스파인이 지정한 `^42`(설치된 버전 42.5.0)로 업그레이드(템플릿 기본값은 39.x였음).
- AD-1(contextIsolation:true, nodeIntegration:false)을 main 윈도우 생성 코드에 명시적으로 설정.
- electron-builder.yml을 Windows/NSIS 전용으로 정리(mac/linux/auto-update publish 설정 제거 — PRD NFR1, 아키텍처 AD 자동업데이트 미사용 결정과 일치).
- AC1, AC2 모두 실제 실행으로 검증(개발모드 + 패키징된 미설치 실행 파일 양쪽에서 1920x1080 윈도우, contextIsolation/nodeIntegration 설정 확인). NSIS 설치파일 자체의 설치 절차(레지스트리/시작메뉴 변경)는 시스템 변경을 수반해 실행하지 않고, 패키징된 결과물 실행으로 동등 검증함.
- 소스 트리에 `src/main/{api,render,storage,ipc}`, `src/templates`, `src/shared` 빈 폴더(`.gitkeep`) 추가 — 후속 스토리(1.2~3.1)가 채울 위치.

### File List

- `package.json` (수정 — name/description/author/engines/electron 버전)
- `electron-builder.yml` (수정 — appId/productName/win-only NSIS 설정)
- `electron.vite.config.ts` (신규, 스캐폴딩 기본값)
- `src/main/index.ts` (수정 — 윈도우 크기/보안설정, ping IPC 테스트 코드 제거)
- `src/preload/index.ts`, `src/preload/index.d.ts` (신규, 스캐폴딩 기본값)
- `src/renderer/**` (신규, 스캐폴딩 기본 React 템플릿 — index.html, App.tsx, main.tsx, components/Versions.tsx, assets/*)
- `src/main/api/.gitkeep`, `src/main/render/.gitkeep`, `src/main/storage/.gitkeep`, `src/main/ipc/.gitkeep` (신규)
- `src/templates/.gitkeep`, `src/shared/.gitkeep` (신규)
- `.editorconfig`, `.gitignore`, `.prettierignore`, `.prettierrc.yaml`, `eslint.config.mjs`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` (신규, 스캐폴딩 기본값)
- `.vscode/*`, `build/*`(아이콘/entitlements), `resources/icon.png`, `README.md` (신규, 스캐폴딩 기본값)

## Change Log

- 2026-06-25: Story 1.1 구현 완료 — electron-vite(react-ts) 스캐폴딩, AD-1 보안설정, electron-builder NSIS 패키징, 소스트리 골격. Electron ^42, 렌더러 프레임워크(React+TS) 결정을 아키텍처 스파인에 반영.
- 2026-06-25: 코드리뷰 반영 — `tsconfig.node.json`/`tsconfig.web.json`에 `src/templates`, `src/shared` include 추가(누락 시 Story 1.3+에서 composite 빌드 깨짐), `App.tsx`의 죽은 'Send IPC' 데모 버튼 제거, `setAppUserModelId`를 실제 appId와 일치시킴, `sandbox: false → true`로 강화, 미사용 `build:mac`/`build:linux` 스크립트 제거. `git init`으로 버전관리 시작.
