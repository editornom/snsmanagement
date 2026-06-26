---
baseline_commit: ba744d44259dd21de7396c704de63302bff2e66b
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/2-3-music-rotation-video-assembly.md
---

# Story 3.1: HTML+이미지 기반 원고 생성

Status: done

## Story

As a 운영자,
I want 완성된 카드(HTML+이미지)를 보고 Claude가 4사 공통 원고를 자동 생성해주길,
so that 매번 직접 글을 쓰지 않아도 된다.

## Acceptance Criteria

1. **Given** 완성된 카드 HTML과 렌더링 이미지가 있는 상태에서, **When** 원고 생성을 요청하면, **Then** Claude API에 해당 카드들의 HTML 소스+렌더링 이미지가 함께 전달되어 원고가 생성된다. 생성된 원고는 페인포인트 제시→핵심포인트 이모지 불릿→연락처 템플릿→해시태그 순서를 따른다. 연락처 템플릿(전화/직통/카카오톡)이 고정 문구로 삽입된다. 홈페이지 URL은 Story 1.2에서 등록된 `meta.json` 값이 자동으로 삽입된다. 해시태그는 콘텐츠에 맞게 Claude가 자동 생성한다. 완성된 원고는 `output/{키워드}/{YYMMDD}/원고.txt`로 저장된다.
2. **Given** 생성된 원고가 만족스럽지 않을 때, **When** 재생성을 요청하면, **Then** 동일 입력으로 원고를 다시 생성한다.
3. **Given** `meta.json`에 홈페이지 URL이 비어있는 상태에서, **When** 원고를 생성하면, **Then** URL 자리는 빈칸으로 남고 사용자에게 메타데이터가 비어있음을 알린다.

## Tasks / Subtasks

- [x] Task 0: 설계 결정 (이번 스토리에서 신규 결정 — 연락처 템플릿 삽입 방식, 원고 입력 구성, 출력 경로, 부분실패 패턴 전부 미확정) (AC: 1, 2, 3)
  - [x] **연락처 템플릿은 Claude가 텍스트를 생성하게 하지 않고, Main 프로세스가 결정론적으로 삽입한다.** PRD §3에서 연락처 템플릿 문구가 정확히 고정돼 있다(`대표전화 1588-1456 / 담당자 직통 010-9945-7510(09:00~18:00) / 24시 채팅상담 카카오톡 @하이온넷 / 홈페이지 {URL}`) — 전화번호 같은 정확한 텍스트를 LLM 생성에 맡기면 카드 골격계약(data-edit-id, CSS 변수)과 동일한 부류의 "정확성이 핵심인 고정 영역"이 된다. 이번에는 별도 검증-거부 루프 대신, Claude에게는 연락처 자리에 리터럴 토큰 `{{CONTACT_BLOCK}}`만 출력하도록 시스템 프롬프트로 지시하고, Main이 응답을 받은 후 그 토큰을 실제 연락처 블록(고정 문구 + `meta.json`의 `homepageUrl`)으로 치환한다. 토큰이 응답에 정확히 1번 없으면(0번 또는 2번 이상) Claude가 지시를 어긴 것으로 보고 에러로 실패시킨다(원고 저장하지 않음) — 자연어 편집(FR-9)의 골격계약 위반 거부와 동일한 사상.
  - [x] **홈페이지 URL이 비어있을 때(AC3)**: `{{CONTACT_BLOCK}}` 치환 시 URL 부분을 빈 문자열로 두고(연락처 블록 자체는 그대로 생성), IPC 응답에 `homepageUrlMissing: true` 플래그를 포함해 Renderer가 사용자에게 알리게 한다. 원고 생성 자체는 막지 않는다(AC3은 "빈칸으로 남기고 알린다"이지 생성을 거부하라는 요구가 아님).
  - [x] **입력 구성: 카드별로 `{HTML 텍스트 블록 + 렌더링 이미지 블록}`을 순서대로 메시지에 추가한다.** 렌더링 이미지는 Story 2.1이 만든 PNG(`getCardImagePathFromHtmlPath(htmlPath)`)를 그대로 읽어 base64 인코딩(media_type은 항상 `'image/png'` — `cardImage.ts`가 PNG로만 저장하므로 카드 생성(FR-1)의 `getReferenceImageMediaType`처럼 확장자 분기할 필요 없음). **이미지가 아직 렌더링되지 않은 카드(2.1 미실행)가 있으면 원고 생성 전체를 실패시킨다** — 영상 조립(2.3)처럼 원고도 모든 카드의 텍스트+이미지가 함께 한 번에 Claude에 들어가는 단일 산출물이라 "이미지 있는 카드만 부분적으로 사용"이 의미가 없다(AC1 "완성된 카드 HTML과 렌더링 이미지가 있는 상태에서"라는 전제와도 일치). 에러 메시지에 누락된 카드 인덱스를 포함해 사용자가 먼저 "이미지로 렌더링"을 실행하도록 안내한다.
  - [x] **원고 경로는 `getManuscriptPath(contentFolderPath: string): string`을 `naming.ts`에 추가** — PRD/AC가 파일명에 날짜/키워드를 넣지 않고 고정 `원고.txt`로 명시(`output/{키워드}/{YYMMDD}/원고.txt`), `getVideoPath`처럼 날짜를 파일명에 새로 조합할 필요가 없다. `join(contentFolderPath, '원고.txt')`.
  - [x] **`meta.json` 읽기 함수가 아직 없다(Story 1.2는 쓰기만 구현).** `storage/content.ts`에 `readContentMeta(contentFolderPath: string): ContentMeta`를 추가 — `meta.json`이 없으면 throw(콘텐츠 폴더가 선택된 상태에서 호출되므로 정상 흐름에서는 항상 존재해야 함, 1.2의 `registerContent`가 항상 같이 생성).
  - [x] **재생성(AC2)은 별도 IPC 채널이 아니라 동일 `manuscript:generate` 채널을 동일 입력으로 다시 호출하는 것으로 처리한다.** 영상/이미지 렌더링과 달리 원고는 카드별 "재생성" 개념이 없고(AC가 "동일 입력으로 다시 생성"이라고만 함) 전체 재호출이 곧 재생성이다 — 새 코드 경로 불필요.

- [x] Task 1: `naming.ts` / `content.ts` 확장 (AC: 1, 3)
  - [x] `getManuscriptPath(contentFolderPath: string): string` 추가 — `join(contentFolderPath, '원고.txt')`.
  - [x] `content.ts`에 `readContentMeta(contentFolderPath: string): ContentMeta` 추가 — `meta.json` 경로를 읽어 `JSON.parse`, 파일이 없으면 명확한 에러(`` `메타데이터를 찾을 수 없습니다: ${contentFolderPath}` ``)로 throw.
  - [x] `naming.test.ts`/`content.test.ts`에 단위테스트 추가: `getManuscriptPath`가 `원고.txt`로 끝나는 경로를 반환하는지, `readContentMeta`가 정상 파싱/파일 없을 때 에러를 던지는지.

- [x] Task 2: 연락처 템플릿 모듈 (AC: 1, 3)
  - [x] `src/main/storage/manuscript.ts`(신규)에 `CONTACT_BLOCK_PLACEHOLDER = '{{CONTACT_BLOCK}}'` 상수와 `buildContactBlock(homepageUrl: string): string`(PRD §3 고정 문구 그대로: `대표전화 1588-1456\n담당자 직통 010-9945-7510(09:00~18:00)\n24시 채팅상담 카카오톡 @하이온넷\n홈페이지 ${homepageUrl}` — `homepageUrl`이 빈 문자열이면 "홈페이지 " 뒤에 빈 값이 그대로 와서 AC3의 "빈칸으로 남는다"를 만족) 작성.
  - [x] `applyContactTemplate(rawManuscript: string, homepageUrl: string): { manuscript: string; homepageUrlMissing: boolean }` — `rawManuscript`에서 `CONTACT_BLOCK_PLACEHOLDER`의 등장 횟수를 세어 정확히 1이 아니면 `Error('Claude 응답이 연락처 템플릿 자리표시자를 포함하지 않습니다')`를 throw, 1이면 치환 후 `{ manuscript, homepageUrlMissing: !homepageUrl.trim() }` 반환.
  - [x] `writeManuscriptFile(contentFolderPath: string, manuscript: string): { manuscriptPath: string }` — `getManuscriptPath`로 경로를 얻어 `mkdirSync(dirname, {recursive:true})` 후 `writeFileSync(..., 'utf-8')`(card.ts의 `overwriteCardHtmlFile`과 동일 패턴).
  - [x] 단위테스트(`manuscript.test.ts`): `buildContactBlock`이 URL 채워진/빈 경우 각각 정확한 문자열을 만드는지, `applyContactTemplate`이 토큰 0개/1개/2개 케이스를 올바르게 처리하는지(0개·2개는 throw, 1개는 치환+`homepageUrlMissing` 플래그), `writeManuscriptFile`이 디렉터리를 만들고 파일을 쓰는지.

- [x] Task 3: Claude API 멀티카드 멀티모달 호출 (AC: 1)
  - [x] `src/templates/manuscript-system-prompt.ts`(신규): `MANUSCRIPT_SYSTEM_PROMPT` 작성. 핵심 지시:
    - 입력: 카드별로 `[HTML 소스 텍스트] + [렌더링 이미지]`가 순서대로 주어짐(텍스트는 정확한 문구 확인용, 이미지는 시각적 맥락/톤 참고용).
    - 출력 구조(이 순서, 이 4개 섹션만): (1) 페인포인트 제시(1~2문장) → (2) 핵심 포인트 이모지 불릿(카드 내용 기반, 이모지+짧은 문장) → (3) 연락처 자리에 리터럴 토큰 `{{CONTACT_BLOCK}}` **정확히 한 번만**(절대 직접 전화번호/문구를 쓰지 않는다) → (4) 해시태그(콘텐츠에 맞게 자동 생성, `#`로 시작하는 단어 여러 개).
    - 4개 플랫폼(유튜브/인스타/페이스북/틱톡) 공통으로 쓰일 단일 원고이므로 플랫폼별 분기 없음.
    - 마크다운 코드블록/설명 텍스트 없이 원고 본문만 반환.
  - [x] `src/main/api/claude.ts`에 `generateManuscript(client: Anthropic, cards: { html: string; imageBase64: string }[]): Promise<string>` 추가 — `MANUSCRIPT_MODEL`/`MAX_TOKENS`/`TIMEOUT_MS`는 기존 `CARD_*` 상수와 동일 값 재사용(같은 모델·타임아웃 정책), `messages[0].content`를 카드 배열을 순회하며 `{type:'text', text: 카드 N HTML}` + `{type:'image', source:{type:'base64', media_type:'image/png', data: imageBase64}}`를 순서대로 push, 마지막에 `{type:'text', text:'위 카드들을 바탕으로 SNS 공통 원고를 생성해줘'}` 추가. 응답 텍스트가 비어있으면 기존 `generateCardHtml`/`editCardHtml`과 동일하게 에러.
  - [x] (테스트는 Claude API 실제 호출을 모킹하지 않는 기존 컨벤션을 따른다 — `claude.ts`는 단위테스트 없음, IPC/storage 레이어에서 콜백 주입으로 테스트.)

- [x] Task 4: 원고 생성 오케스트레이션 (AC: 1, 2, 3)
  - [x] `manuscript.ts`에 `generateManuscriptDocument(input: { contentFolderPath: string; cards: { index: number; htmlPath: string; html: string }[]; generateManuscriptText: (cards: {html:string; imageBase64:string}[]) => Promise<string> }): Promise<{ manuscript: string; manuscriptPath: string; homepageUrlMissing: boolean }>` 작성:
    1. 각 카드의 `getCardImagePathFromHtmlPath(card.htmlPath)`가 `existsSync`인지 확인, 하나라도 없으면 누락된 인덱스를 모아 `` `다음 카드의 이미지가 아직 렌더링되지 않았습니다: ${누락인덱스.join(', ')}` ``로 throw(Task 0 결정).
    2. 각 이미지를 `readFileSync(...).toString('base64')`로 읽어 `{html, imageBase64}[]` 구성.
    3. `readContentMeta(contentFolderPath)`로 `homepageUrl` 획득.
    4. `generateManuscriptText(cardsWithImage)` 호출(Claude API).
    5. `applyContactTemplate(raw, meta.homepageUrl)`로 연락처 치환.
    6. `writeManuscriptFile(contentFolderPath, manuscript)`.
    7. `{ manuscript, manuscriptPath, homepageUrlMissing }` 반환.
  - [x] 단위테스트(`manuscript.test.ts`에 추가): 이미지 누락 카드가 있을 때 `generateManuscriptText`를 호출하지 않고 바로 에러(인덱스 포함), 정상 흐름에서 `generateManuscriptText`에 올바른 `{html, imageBase64}[]`가 전달되는지, `homepageUrlMissing` 플래그가 메타데이터 상태에 따라 정확한지, 파일이 저장되는지(모두 `fs`/`readContentMeta` 모킹).

- [x] Task 5: `manuscript:generate` IPC 채널 + 핸들러 (AC: 1, 2, 3)
  - [x] `src/shared/ipc-manuscript.ts`(신규): `MANUSCRIPT_GENERATE_CHANNEL = 'manuscript:generate'`, `GenerateManuscriptCardInput { index: number; htmlPath: string; html: string }`, `GenerateManuscriptRequest { contentFolderPath: string; cards: GenerateManuscriptCardInput[] }`, `GenerateManuscriptResponseData { manuscript: string; manuscriptPath: string; homepageUrlMissing: boolean }`.
  - [x] `src/main/ipc/manuscript.ts`(신규)에 `registerManuscriptIpcHandlers()`: `request.cards`가 비어있으면 에러 envelope(`NO_CARDS_MESSAGE`), 아니면 `getApiKey`로 API 키 확인(없으면 기존 `API_KEY_MISSING_MESSAGE`와 동일한 패턴), `createClaudeClient` 생성 후 `generateManuscriptDocument({ contentFolderPath: request.contentFolderPath, cards: request.cards, generateManuscriptText: (cards) => generateManuscript(client, cards) })` 호출 → try/catch로 감싸 성공 시 `{ok:true, data:{...}}`, 실패 시 `{ok:false, error:{message}}`(throw 금지, 기존 envelope 규칙 — 영상조립 패턴과 동일한 단일 성공/실패).
  - [x] `src/main/index.ts`에 `registerManuscriptIpcHandlers()` 등록.
  - [x] 단위테스트(`src/main/ipc/manuscript.test.ts`): 빈 배열 에러, API 키 없음 에러, `generateManuscriptDocument` 성공/실패 각각의 envelope 검증(`generateManuscriptDocument`/`getApiKey`/`createClaudeClient` 모킹).

- [x] Task 6: Preload + UI 통합 (AC: 1, 2, 3)
  - [x] `src/preload/index.ts`/`index.d.ts`에 `generateManuscript(request: GenerateManuscriptRequest): Promise<IpcResult<GenerateManuscriptResponseData>>` 추가.
  - [x] `App.tsx`에 "원고 생성" 버튼 추가 — `handleRenderImages`/`handleAssembleVideo`와 같은 위치(카드 생성 섹션), `cards.some(c => c.htmlPath)`일 때 노출, `generatingManuscript: boolean` 상태로 중복클릭 방지. `handleGenerateManuscript()`: (1) 다른 핸들러와 동일하게 보류 중인 디바운스 저장 타이머 취소, (2) `htmlPath` 있는 카드들의 라이브 iframe DOM을 `serializeCardDocument`로 직렬화, (3) `window.api.generateManuscript({contentFolderPath: folderPath, cards: [{index, htmlPath, html}, ...]})` 호출, (4) 성공 시 원고 본문을 화면에 표시(`<textarea readOnly>` 또는 `<pre>`)하고 저장 경로 메시지(`원고 생성 완료: ${manuscriptPath}`), `homepageUrlMissing`이면 추가 경고 메시지("홈페이지 URL이 비어있어 빈칸으로 저장되었습니다") 표시. 실패 시(이미지 미렌더링 카드 포함) 에러 메시지 그대로 노출 — 이미지 렌더링을 먼저 하라고 안내하는 문구는 에러 메시지 자체(Task 4)에 이미 포함됨.
  - [x] "재생성" 동작은 동일 버튼을 다시 누르는 것으로 충분(Task 0 결정) — 별도 버튼 불필요.
  - [x] 버튼 비활성화 상태에서 로딩 표시("원고 생성 중...").

- [x] Task 7: 테스트 및 실측 검증 (AC: 1, 2, 3)
  - [x] `naming.test.ts`/`content.test.ts`/`manuscript.test.ts`/`manuscript.test.ts`(ipc)는 Task 1~5에서 작성.
  - [x] `npx vitest run` / `npm run typecheck` / `npm run lint` 전체 통과 확인.
  - [x] **CDP 실측(2.1~2.3과 동일 방법론):** 패키징된 앱(`npm run build:unpack`)을 CDP로 띄우고, `window.api.registerContent`(홈페이지 URL 채워서) → 더미 카드 1장 생성/저장 → `window.api.renderCardsToImages`로 이미지까지 만든 뒤 → `window.api.generateManuscript(...)`를 `Runtime.evaluate`로 호출. 응답의 `manuscript`가 4개 섹션(페인포인트→불릿→연락처→해시태그) 순서를 따르는지, `{{CONTACT_BLOCK}}` 토큰이 실제 전화번호/카카오톡/URL 텍스트로 치환돼 있는지, `원고.txt` 파일이 실제로 생성됐는지 확인(PASS). 이미지 렌더링을 건너뛴 카드로 호출해 에러(카드 인덱스 포함)가 나는지 확인(PASS, Claude 호출 전에 차단됨). `homepageUrl`을 빈 문자열로 등록한 콘텐츠로 재시도해 `homepageUrlMissing: true`와 "홈페이지 " 뒤 빈칸을 확인(PASS). 검증 후 테스트 콘텐츠 폴더/저장된 API 키/빌드 산출물 전부 삭제.

## Dev Notes

- **Epic 3의 첫 스토리이자 마지막 스토리(Epic 3 = Story 3.1 하나뿐).** Epic 1(카드 HTML)·Epic 2(이미지 렌더링)·Story 1.2(`meta.json`)의 산출물을 모두 입력으로 소비하는 통합 스토리다 — 새로운 산출물 종류(`원고.txt`, 텍스트 파일)를 처음 다루지만 IPC/envelope/네이밍 패턴은 기존과 동일하게 따른다.
- **AD-1 준수:** Claude API 호출/파일 읽기쓰기는 전부 Main에서만. Renderer는 `window.api.generateManuscript`로만 요청.
- **AD-7 준수:** 원고 경로(`getManuscriptPath`)는 `naming.ts`에 추가해 단일 소스를 유지.
- **연락처 템플릿을 LLM에 직접 쓰게 하지 않는 이유(Task 0의 핵심 결정, 카드 골격계약과 같은 사상):** 전화번호 같은 정확한 문자열은 LLM이 미묘하게 틀리게 재현할 위험이 있다 — 카드 HTML의 `data-edit-id`/CSS 변수 계약을 검증-거부하는 것과 동일한 이유로, 이번에는 처음부터 LLM에게 정확한 문구를 맡기지 않고 리터럴 placeholder만 받아 Main이 결정론적으로 채운다.
- **이미지 렌더링이 선행되지 않은 카드가 있으면 원고 생성 자체를 막는다(부분실패 배열 패턴 아님).** 영상 조립(2.3)과 같은 이유 — 원고는 모든 카드를 한 번에 Claude에 넣어 만드는 단일 산출물이라 "이미지 있는 카드만 부분 사용"이 의미 없다. 사용자는 에러 메시지를 보고 먼저 "이미지로 렌더링"(2.1)을 실행하면 된다.
- **media_type은 항상 `'image/png'` 고정**(카드 생성(FR-1)의 참고이미지처럼 확장자 분기 불필요 — `cardImage.ts`(2.1)가 항상 PNG로 저장하므로).
- **재생성(AC2)은 새 코드 경로가 아니라 동일 IPC를 동일 입력으로 다시 호출하는 것** — 영상조립처럼 "재생성" 전용 채널을 만들지 않는다.
- **`readContentMeta`는 Story 1.2 이후 처음 추가되는 `meta.json` 읽기 함수.** 이번 스토리부터 `meta.json`이 "쓰기만 되는 메타데이터"에서 "다른 기능이 읽어가는 메타데이터"로 처음 소비된다(PRD §4.5에서 예고된 동작).
- **`원고.txt`는 날짜/키워드를 파일명에 포함하지 않는 유일한 산출물.** `getVideoPath`/`getCardHtmlPath`와 패턴이 다르므로 혼동하지 말 것 — `contentFolderPath` 자체가 이미 키워드/날짜 단위 폴더이므로 폴더 하나당 원고 파일 하나면 충분하다(AC1 경로 형식 그대로).

### Project Structure Notes

- `src/main/storage/naming.ts` 수정(`getManuscriptPath` 추가), `naming.test.ts` 수정.
- `src/main/storage/content.ts` 수정(`readContentMeta` 추가), `content.test.ts` 수정.
- `src/main/storage/manuscript.ts` 신규, `manuscript.test.ts` 신규.
- `src/templates/manuscript-system-prompt.ts` 신규.
- `src/main/api/claude.ts` 수정(`generateManuscript` 추가).
- `src/shared/ipc-manuscript.ts` 신규.
- `src/main/ipc/manuscript.ts` 신규, `manuscript.test.ts` 신규.
- `src/main/index.ts` 수정(`registerManuscriptIpcHandlers` 등록).
- `src/preload/index.ts`/`index.d.ts` 수정(`generateManuscript` 노출).
- `src/renderer/src/App.tsx` 수정("원고 생성" 버튼/핸들러/결과 표시 UI).

### References

- [ARCHITECTURE-SPINE.md#AD-1, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — Main/Renderer 분리, 네이밍 단일 유틸
- [PRD §3, §4.4, FR-7](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 원고 구조(페인포인트→불릿→연락처→해시태그), 연락처 템플릿 고정 문구 원문, 4사 공통(분기 없음)
- [epics.md#Story-3.1](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- `src/main/ipc/card.ts`, `src/main/api/claude.ts`, `src/templates/card-edit-system-prompt.ts` — 멀티모달 Claude 호출 패턴, 골격계약 검증-거부 패턴(이번 스토리의 `{{CONTACT_BLOCK}}` 검증이 동일 사상)
- `src/main/storage/content.ts`(Story 1.2) — `ContentMeta` 타입, `meta.json` 쓰기 패턴(이번 스토리에서 읽기 함수 추가)
- [2-1-html-image-rendering.md](./2-1-html-image-rendering.md) — `getCardImagePathFromHtmlPath`, IPC envelope/throw 금지 규칙
- [2-3-music-rotation-video-assembly.md](./2-3-music-rotation-video-assembly.md) — 단일 성공/실패(부분실패 배열 아님) 패턴의 선례

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 패키징된 앱(`npm run build:unpack`)을 CDP(`--remote-debugging-port=9555`~`9557`, 재빌드마다 포트 변경)로 띄우고, `window.api.saveApiKey` → `window.api.registerContent`(홈페이지 URL 채워서) → 더미 카드 1장(HTML 직접 작성, 골격계약 준수) → `window.api.renderCardsToImages` → `window.api.generateManuscript`를 CDP `Runtime.evaluate`로 순서대로 호출해 실측.
  - **1차 실측에서 발견(처음엔 버그로 의심했으나 실제로는 설계가 의도대로 동작한 케이스):** 더미 카드 텍스트를 `"테스트용 더미 텍스트"`처럼 노골적으로 작성하자 Claude가 이를 실제 콘텐츠가 아닌 placeholder로 인식해 정상 원고 대신 "실제 콘텐츠를 알려달라"는 확인 질문을 반환했고, 그 응답에는 `{{CONTACT_BLOCK}}` 토큰이 없어 `applyContactTemplate`이 정확히 설계대로 에러를 던지며 거부했다(원고 파일 저장 안 됨). 디버그 로그(`console.error`로 raw 응답 임시 출력 후 확인, 검증 후 제거)로 원인을 확인 — 실제 콘텐츠처럼 보이는 더미 텍스트("사무실 망분리, 이렇게 준비하세요" 등)로 바꾸자 매번 정상적으로 4개 섹션 구조의 원고가 생성됨.
  - **2차 혼란(테스트 하니스 버그, 제품 코드 버그 아님):** CDP로 보낼 `Runtime.evaluate` 표현식을 생성할 때 카드 HTML을 미리 파일로 캐싱해뒀다가, 더미 카드 내용을 수정한 뒤 캐시된 표현식 파일을 재생성하지 않고 재사용해 `renderCardsToImages`가 옛 HTML로 디스크 파일을 다시 덮어쓰는 일이 반복됐다(이미지 렌더링 핸들러가 요청받은 `html`로 `overwriteCardHtmlFile`을 호출하는 정상 동작 — `card.htmlPath`에 쓰기 전에 항상 최신 표현식을 재생성해야 함을 확인).
  - **최종 검증(PASS):** 정상 입력으로 `generateManuscript` 호출 시 `manuscript`가 페인포인트→이모지 불릿→연락처 템플릿(`대표전화 1588-1456`/`담당자 직통 010-9945-7510(09:00~18:00)`/`24시 채팅상담 카카오톡 @하이온넷`/`홈페이지 https://haion.net`)→해시태그 순서로 정확히 생성되고 `원고.txt`가 실제로 디스크에 저장됨을 확인. `meta.json`의 `homepageUrl`을 빈 문자열로 바꿔 재호출하니 `homepageUrlMissing: true`와 "홈페이지 " 뒤 빈칸을 정확히 반환(AC3). 이미지가 렌더링되지 않은 카드 인덱스로 호출하니 Claude API를 호출하지 않고 즉시 `"다음 카드의 이미지가 아직 렌더링되지 않았습니다: 2"` 에러를 반환(불필요한 API 비용 발생 없음).
  - 검증 후 저장된 API 키(`%APPDATA%/sns-content-tool/settings.json`), 테스트 콘텐츠 폴더(`Documents/SNS콘텐츠제작도구/output/스토리31테스트/`), `dist/` 빌드 산출물 전부 삭제.

### Completion Notes List

- Task 0: 연락처 템플릿을 Claude가 직접 생성하지 않고 리터럴 placeholder(`{{CONTACT_BLOCK}}`)로 받아 Main이 결정론적으로 치환하도록 결정(카드 골격계약과 동일 사상). 이미지가 렌더링되지 않은 카드가 있으면 Claude 호출 전에 전체 실패시키기로 결정(2.3의 단일 성공/실패 패턴과 동일, 불필요한 API 비용 방지). 재생성은 별도 채널 없이 동일 IPC 재호출로 처리.
- Task 1: `naming.ts`에 `getManuscriptPath` 추가(날짜/키워드 없는 고정 파일명 `원고.txt`), `content.ts`에 첫 `meta.json` 읽기 함수 `readContentMeta` 추가. 단위테스트 추가, 전체 통과.
- Task 2/4: `src/main/storage/manuscript.ts` 신규 — `buildContactBlock`/`applyContactTemplate`(placeholder 0개·2개 이상이면 throw)/`writeManuscriptFile`/`generateManuscriptDocument`(이미지 누락 검증→Claude 호출→연락처 치환→파일저장 오케스트레이션). 단위테스트 10건 전체 통과.
- Task 3: `src/templates/manuscript-system-prompt.ts` 신규(4개 섹션 구조 지시, `{{CONTACT_BLOCK}}` 정확히 1회 지시), `src/main/api/claude.ts`에 `generateManuscript` 추가(카드별 텍스트+이미지 블록을 순서대로 쌓는 멀티모달 호출, 기존 `CARD_*` 상수 재사용).
- Task 5: `src/shared/ipc-manuscript.ts`/`src/main/ipc/manuscript.ts`(`registerManuscriptIpcHandlers`) 신규 — 빈 배열/API 키 없음 에러, 성공/실패 단일 envelope(영상조립과 동일 패턴). `main/index.ts`에 등록. 단위테스트 4건 전체 통과.
- Task 6: preload(`generateManuscript`) 노출, `App.tsx`에 "원고 생성" 버튼/`handleGenerateManuscript`(디바운스 타이머 취소 → 라이브 DOM 직렬화 → IPC 호출 → 결과/홈페이지 URL 누락 경고 표시) 추가, 생성된 원고를 읽기 전용 textarea로 표시.
- Task 7: 단위테스트 136건/typecheck/lint 전체 통과. CDP 실측(위 Debug Log 참고)으로 실제 Claude API 호출 검증 — 정상 흐름(구조/연락처/URL/해시태그/파일저장), AC3(홈페이지 URL 누락), 이미지 미렌더링 카드 에러(API 비용 발생 없이 차단) 전부 PASS. 검증 중 발견한 두 가지 현상 모두 제품 코드 버그가 아님을 확인(Claude의 의도된 거부 응답 처리 정상 동작, 테스트 하니스의 캐시된 표현식 재사용 실수)했고 추가 코드 수정 없음.

### File List

- `src/main/storage/naming.ts` (수정 — `getManuscriptPath` 추가)
- `src/main/storage/naming.test.ts` (수정 — 단위테스트 추가)
- `src/main/storage/content.ts` (수정 — `readContentMeta` 추가)
- `src/main/storage/content.test.ts` (수정 — 단위테스트 추가)
- `src/main/storage/manuscript.ts` (신규)
- `src/main/storage/manuscript.test.ts` (신규)
- `src/templates/manuscript-system-prompt.ts` (신규)
- `src/main/api/claude.ts` (수정 — `generateManuscript` 추가)
- `src/shared/ipc-manuscript.ts` (신규)
- `src/main/ipc/manuscript.ts` (신규)
- `src/main/ipc/manuscript.test.ts` (신규)
- `src/main/index.ts` (수정 — `registerManuscriptIpcHandlers` 등록)
- `src/preload/index.ts` (수정 — `generateManuscript` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `generateManuscript` 추가)
- `src/renderer/src/App.tsx` (수정 — "원고 생성" 버튼/핸들러/결과 표시 UI, 디바운스 취소 로직을 `cancelPendingSaveTimers` 공용 헬퍼로 추출)
- `src/main/ipc/requireClaudeClient.ts` (신규 — `getApiKey`+`createClaudeClient` 중복 4곳을 하나로 통합)
- `src/main/ipc/card.ts` (수정 — `requireClaudeClient` 사용으로 전환)

### Review Findings

- [x] [Review][Bug] `applyContactTemplate`이 `homepageUrl`이 undefined/null이면(legacy/손상된 `meta.json`) `.trim()` 호출에서 크래시. `safeHomepageUrl = homepageUrl ?? ''`로 가드 추가. [src/main/storage/manuscript.ts]
- [x] [Review][Bug] `generateManuscriptDocument`가 라이브 DOM에서 직렬화한 HTML 텍스트를 보내지만 이미지는 디스크의 마지막 렌더링 결과를 그대로 사용 — 카드 수정 후 재렌더링 없이 원고 생성 시 텍스트/이미지 불일치. 완전 자동 동기화는 범위가 커 UI에 안내 문구 추가로 처리. [src/renderer/src/App.tsx]
- [x] [Review][Bug] `ipc/manuscript.ts`가 `request.contentFolderPath`를 검증하지 않아 빈 값이 이미지 I/O까지 통과한 뒤에야 실패 — `card.ts`와 동일한 패턴으로 사전 검증 추가. [src/main/ipc/manuscript.ts]
- [x] [Review][Bug] `getCardImagePathFromHtmlPath`가 잘못된 형식의 `htmlPath`에 대해 루프 중간에서 캐치되지 않고 throw — 다른 카드의 "이미지 미렌더링" 목록 수집이 중단됨. try/catch로 감싸 누락 인덱스에 합류시킴. [src/main/storage/manuscript.ts]
- [x] [Review][Bug] `applyContactTemplate`의 에러 메시지가 placeholder 0회/2회+ 모두 동일("포함하지 않습니다") — 두 케이스를 구분하는 메시지로 분리. [src/main/storage/manuscript.ts]
- [x] [Review][Bug] `generateManuscript`가 카드 1장용 `CARD_MAX_TOKENS`/`CARD_REQUEST_TIMEOUT_MS`를 그대로 재사용 — 카드 여러 장 멀티모달 입력에 맞춘 `MANUSCRIPT_REQUEST_TIMEOUT_MS`(300s)로 분리. [src/main/api/claude.ts]
- [x] [Review][Bug] 이미지 누락 카드 발생 시에도 그 전 카드들의 이미지를 다 읽고 base64 인코딩한 뒤에야 실패 — 존재 확인을 모두 마친 뒤에만 읽기를 수행하도록 2단계로 분리. [src/main/storage/manuscript.ts]
- [x] [Review][Cleanup] `claude.ts`의 "응답 텍스트 추출+빈 응답 체크" 로직이 3곳에 중복 — `extractResponseText` 공용 헬퍼로 통합. [src/main/api/claude.ts]
- [x] [Review][Cleanup] `App.tsx`의 디바운스 타이머 취소 루프가 3곳에 중복 — `cancelPendingSaveTimers` 공용 헬퍼로 통합. [src/renderer/src/App.tsx]
- [x] [Review][Cleanup] `getApiKey`+`createClaudeClient`+키 없음 체크 패턴이 `card.ts`(3곳)+`manuscript.ts`(1곳) 총 4곳에 중복 — `requireClaudeClient()` 공용 헬퍼로 통합(기존 테스트의 `getApiKey`/`createClaudeClient` 모킹이 그대로 적용되어 테스트 파일 수정 불필요). [src/main/ipc/requireClaudeClient.ts, src/main/ipc/card.ts, src/main/ipc/manuscript.ts]

### Change Log

- 2026-06-26: Story 3.1 컨텍스트 생성 — 연락처 템플릿을 LLM 생성이 아닌 리터럴 placeholder(`{{CONTACT_BLOCK}}`) + Main 결정론적 치환 방식으로 설계(카드 골격계약과 동일 사상), 이미지 미렌더링 카드가 있으면 원고 생성 전체 실패(부분실패 배열 아님, 2.3과 동일 패턴), `meta.json` 첫 읽기 함수(`readContentMeta`) 추가 결정, `원고.txt` 경로는 날짜/키워드 없이 폴더당 고정 파일명. Status: ready-for-dev.
- 2026-06-26: Story 3.1 구현 완료 — `manuscript.ts`(연락처 템플릿 치환/오케스트레이션), `generateManuscript`(Claude 멀티모달 호출), `manuscript:generate` IPC, "원고 생성" UI. 단위테스트 136건/typecheck/lint 전체 통과. CDP로 실제 Claude API 호출 실측 — 정상 흐름(4개 섹션 구조, 연락처/URL/해시태그, 파일저장), AC3(홈페이지 URL 누락 시 빈칸+플래그), 이미지 미렌더링 카드 에러(API 호출 전 차단) 전부 PASS. 검증 중 발견한 두 현상(Claude의 더미 콘텐츠 거부 응답, 테스트 스크립트의 캐시된 표현식 재사용 실수)은 제품 코드 결함이 아님을 확인해 추가 패치 없음. Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(8개 앵글: line-by-line/removed-behavior/cross-file/reuse/simplification/efficiency/altitude/conventions) 진행, recall-biased 1-vote 검증을 거쳐 버그 7건+정리 3건 반영. 핵심 수정: `homepageUrl` undefined 가드, 텍스트/이미지 불일치 안내, `contentFolderPath` 사전검증, `getCardImagePathFromHtmlPath` 예외를 누락이미지로 흡수, placeholder 0회/2회+ 에러메시지 분리, 원고용 타임아웃 분리, 이미지 존재확인-읽기 2단계 분리. 정리: `extractResponseText`/`cancelPendingSaveTimers`/`requireClaudeClient` 공용 헬퍼 추출(`card.ts`도 함께 정리). 회귀 방지 테스트 4건 추가(전체 140건), 기존 테스트는 모킹 구조 변경 없이 그대로 통과. typecheck/lint 전체 통과. Status: review → done.
