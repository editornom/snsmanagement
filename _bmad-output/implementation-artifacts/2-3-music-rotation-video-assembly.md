---
baseline_commit: f934f59a329a410b5bea76611547ac4504dbe8e9
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md
  - _bmad-output/implementation-artifacts/2-2-card-animation-frame-capture.md
---

# Story 2.3: 음악 로테이션 영상 조립

Status: done

## Story

As a 운영자,
I want 썸네일+카드별 프레임시퀀스를 음악과 함께 하나의 영상으로 합쳐주길,
so that 완성된 영상을 바로 게시할 수 있다.

## Acceptance Criteria

1. **Given** 썸네일 이미지(5초)와 카드별 프레임시퀀스(Story 2.2)가 준비된 상태에서, **When** 영상 조립을 실행하면, **Then** ffmpeg가 썸네일→카드1→카드2→...순으로 이어붙여 하나의 mp4를 만든다. `/music/` 폴더의 곡을 순서대로 1곡 사용하고, 마지막 사용곡 정보를 갱신해 다음 실행 시 그 다음 곡을 사용한다(끝까지 쓰면 처음곡으로 순환). 완성된 영상은 `output/{키워드}/{YYMMDD}/video/{YYMMDD}_{키워드}.mp4`로 저장된다. 조립에 사용된 임시 프레임 PNG들은 인코딩 완료 후 삭제된다.
2. **Given** 음악 폴더에 곡이 1개뿐일 때, **When** 영상 조립을 실행하면, **Then** 그 곡을 반복 사용한다(순환구조가 1곡에서도 깨지지 않음).

## Tasks / Subtasks

- [x] Task 0: 설계 결정 (이번 스토리에서 신규 결정 — ffmpeg-static은 아직 설치 안 됨, `/music/` 폴더 실제 경로·음악로테이션 상태 파일 형식·영상 경로 네이밍 전부 미확정) (AC: 1, 2)
  - [x] **`ffmpeg-static`을 신규 런타임 의존성으로 추가한다(아키텍처 Stack에 이미 예정돼 있던 패키지, AD-4).** `fluent-ffmpeg` 등 추가 래퍼는 쓰지 않는다 — 아키텍처 Stack 표에 `ffmpeg-static`만 명시돼 있고, CLI 인자를 직접 구성하는 것이 이번 스토리 범위(세그먼트 생성→concat→오디오 믹스 3단계, 복잡한 filter_complex 불필요)에 충분하다. `child_process.spawn(ffmpegPath, args)`로 직접 실행하고 stderr를 모아 실패 시 에러 메시지로 사용한다. **패키징 시 `ffmpeg-static`의 플랫폼 바이너리는 asar 안에 있으면 실행 불가능하므로, `electron-builder.yml`의 `asarUnpack`에 `node_modules/ffmpeg-static/**`를 추가해야 한다**(기존에는 `resources/**`만 있음).
  - [x] **`/music/` 폴더의 실제 경로 = `app.getPath('documents')/SNS콘텐츠제작도구/music/`** (Story 1.2가 출력 루트를 `Documents/SNS콘텐츠제작도구/output/`로 확정한 것과 동일한 이유 — 패키징 설치 경로는 재설치 시 사라지고, `userData`는 도구 자체 상태 전용(AD-5)이라 사용자가 직접 mp3를 넣고 빼는 폴더로 부적합. 아키텍처 Structural Seed에서도 `music/`이 `output/`과 같은 최상위 레벨에 나란히 그려져 있어 동일 루트의 sibling으로 해석). `naming.ts`의 기존 `OUTPUT_APP_FOLDER` 상수를 재사용해 `getMusicFolderPath(documentsPath): string`을 추가한다. **개발 중 사용자가 직접 곡 3개를 넣어둔 프로젝트 루트의 `music/` 폴더(`<repo>/music/*.mp3`)는 `npm run dev`의 `process.cwd()` 기준 편의 폴더일 뿐, 패키징된 앱이 실제로 읽는 경로가 아니다** — 이번 스토리 CDP 실측 시에는 실제 `Documents/SNS콘텐츠제작도구/music/`에 테스트용 곡 파일을 직접 복사해 넣어야 한다.
  - [x] **영상 경로 = `getVideoPath(contentFolderPath, keyword): string`을 `naming.ts`에 추가.** 2.1의 `getCardImagePathFromHtmlPath`와 동일한 "날짜 재계산 금지" 원칙을 적용 — `contentFolderPath`의 마지막 경로 세그먼트가 이미 `{YYMMDD}`이므로 `basename(contentFolderPath)`로 추출해 재사용하고, 오늘 날짜로 새로 계산하지 않는다. 결과: `join(contentFolderPath, 'video', `${date}_${sanitizeKeyword(keyword)}.mp4`)`.
  - [x] **음악 로테이션 상태(AD-5, `userData/music-state.json`): `{ lastUsedTrack: string }`(파일명만 저장, 인덱스 아님).** 인덱스가 아니라 파일명을 저장하는 이유 — 사용자가 `/music/` 폴더에 곡을 추가/삭제하면 인덱스가 가리키는 곡이 달라질 수 있다. 매번 폴더를 다시 스캔해 정렬(파일명 알파벳순, 결정론적) 한 뒤 `lastUsedTrack`의 현재 인덱스를 찾아 `(index+1) % length`로 다음 곡을 고른다. `lastUsedTrack`이 없거나 현재 목록에서 찾을 수 없으면(첫 실행, 또는 그 곡이 삭제됨) 인덱스 0부터 시작한다. 폴더에 곡이 1개뿐이면 항상 같은 곡이 선택돼 AC2를 자연히 만족한다. 폴더가 비어있으면 명확한 에러(`'음악 폴더에 곡이 없습니다'`)로 실패 처리한다(AC에 0개 케이스 명시 없음 — 에러로 막는 것이 가장 안전).
  - [x] **세그먼트별 mp4를 먼저 만들고 concat demuxer로 합친 뒤 마지막에 오디오를 입히는 3단계 파이프라인을 쓴다(하나의 거대한 filter_complex 대신).** (1) 썸네일 1장 → 5초 정지 mp4(`-loop 1 -t 5 -framerate 60`, `scale+pad`로 비율 유지하며 1080x1350에 맞춤 — 사용자가 올린 썸네일은 임의 비율이라 단순 stretch(`scale=1080:1350`만 사용)는 왜곡을 일으킴), (2) 카드별 프레임시퀀스(Story 2.2의 `getCardFrameDirPath` 결과 폴더, `frame-%05d.png`) → mp4(`-framerate 60`), (3) 모든 세그먼트를 ffmpeg concat demuxer(`-f concat -safe 0 -i filelist.txt -c copy`)로 무손실 연결(모든 세그먼트가 동일 코덱/해상도/fps라 스트림 복사 가능), (4) 음악 트랙을 `-stream_loop -1`(곡이 영상보다 짧으면 반복) + `-shortest`(영상 길이에 맞춰 자름)로 입혀 최종 mp4 완성. 이 분리 방식은 각 단계를 독립적으로 단위테스트(`runFfmpeg` 모킹)할 수 있게 한다.
  - [x] **카드 간 전환효과 없음(AD-4 그대로) — concat만 하고 `xfade` 등 별도 필터 적용하지 않는다.** 다음 카드 자체의 진입 애니메이션(Story 2.2가 이미 프레임에 구워넣음)이 전환처럼 보인다.
  - [x] **이번 스토리는 영상 1개 전체가 성공/실패하는 단일 결과다(2.1/2.2의 카드별 부분실패 배열 패턴이 아니다)** — 카드 일부만 영상에 넣고 나머지를 빼는 식의 "부분 성공"은 의미가 없다(영상은 하나로 합쳐지는 산출물). 실패 시 임시로 만든 세그먼트 mp4와 (가능하다면) 캡처된 프레임 폴더까지 정리하고 에러를 반환한다.
  - [x] **썸네일 원본 파일 경로는 Renderer의 state(`thumbnailPath`)를 그대로 믿지 않고 Main이 `contentFolderPath`에서 직접 찾는다.** Story 1.2가 썸네일을 `{contentFolderPath}/thumbnail{ext}`로 복사해뒀으므로(`content.ts`의 `registerContent`), `storage/content.ts`에 `findThumbnailPath(contentFolderPath): string`을 추가해 `readdirSync`로 `thumbnail.*` 패턴 파일을 찾아 반환한다(없으면 throw). 이렇게 하면 IPC 요청에 `thumbnailPath`를 따로 넘길 필요가 없고, 폴더가 단일 진실 소스(AD-5)라는 원칙도 지켜진다.

- [x] Task 1: ffmpeg 바이너리 실행 유틸 (AC: 1, 2)
  - [x] `npm install ffmpeg-static`로 의존성 추가. `electron-builder.yml`의 `asarUnpack`에 `node_modules/ffmpeg-static/**` 추가.
  - [x] `src/main/render/ffmpegRunner.ts`(신규): `runFfmpeg(args: string[]): Promise<void>` — `import ffmpegPath from 'ffmpeg-static'`로 바이너리 경로를 얻어(패키징 환경에서는 `app.asar.unpacked/...`로 자동 치환됨) `child_process.spawn(ffmpegPath, args)` 실행, stderr를 버퍼에 모아 종료코드가 0이 아니면 `Error(stderr 마지막 일부)`로 reject, 정상 종료면 resolve. 타임아웃은 두지 않는다(영상 인코딩은 카드 수/길이에 따라 가변적이고 로컬 작업이라 외부 API처럼 멈춰있을 이유가 없음 — 2.1/2.2의 30초 타임아웃과는 성격이 다름).
  - [x] 단위테스트(`ffmpegRunner.test.ts`): `child_process.spawn`을 모킹해 정상종료(exit 0)/비정상종료(exit 1, stderr 메시지 포함) 케이스 검증.

- [x] Task 2: `naming.ts` 확장 (AC: 1)
  - [x] `getMusicFolderPath(documentsPath: string): string` 추가 — `join(getOutputRoot(documentsPath, ...).replace('output', ...))` 대신 명시적으로 `join(documentsPath, OUTPUT_APP_FOLDER, 'music')`로 작성(기존 `OUTPUT_APP_FOLDER` 상수 재사용, 문자열 치환 금지).
  - [x] `getVideoPath(contentFolderPath: string, keyword: string): string` 추가 — `basename(contentFolderPath)`로 `{YYMMDD}`를 추출(재계산 금지), `join(contentFolderPath, 'video', `${date}_${sanitizeKeyword(keyword)}.mp4`)` 반환.
  - [x] `naming.test.ts`에 단위테스트 추가: `getMusicFolderPath` 경로 조립 검증, `getVideoPath`가 폴더명의 날짜를 그대로 재사용하는지(다른 날짜를 가진 `contentFolderPath`로 호출해 시스템 현재 날짜와 무관하게 폴더명의 날짜가 나오는지) 검증.

- [x] Task 3: 음악 로테이션 모듈 (AC: 1, 2)
  - [x] `src/main/storage/musicRotation.ts`(신규): `listMusicTracks(musicFolderPath: string): string[]`(오디오 확장자 `.mp3`/`.wav`/`.m4a`/`.ogg`만 필터링, 파일명 알파벳순 정렬, 폴더가 없으면 빈 배열) / `getNextMusicTrack(musicFolderPath: string, userDataPath: string): string`(트랙 0개면 throw `'음악 폴더에 곡이 없습니다'`, 아니면 `music-state.json`의 `lastUsedTrack`을 읽어 현재 목록에서 인덱스를 찾고 `(index+1) % length`로 다음 트랙 결정, 못 찾으면 인덱스 0, 선택한 트랙 파일명으로 상태 갱신·저장 후 절대경로 반환).
  - [x] `music-state.json` 읽기/쓰기는 `settings/apiKey.ts`의 `readSettings`/`writeFileSync` 패턴(존재하지 않으면 빈 객체, JSON 파싱 실패 시에도 빈 객체로 폴백)을 그대로 재사용한다 — 별도 새 패턴 만들지 않는다.
  - [x] 단위테스트(`musicRotation.test.ts`, 임시 디렉터리에 실제 파일 생성 또는 `fs` 모킹): 곡 3개일 때 호출마다 순서대로 도는지(3번째 다음은 다시 0번째), 곡 1개일 때 항상 같은 곡(AC2), `lastUsedTrack`이 현재 목록에 없을 때(곡 삭제됨) 인덱스 0으로 폴백, 상태 파일이 없을 때(첫 실행) 인덱스 0, 폴더가 비어있을 때 에러.

- [x] Task 4: 영상 조립 파이프라인 (AC: 1, 2)
  - [x] `src/main/render/videoAssembly.ts`(신규)에 내부 헬퍼들과 메인 함수 작성:
    - `buildThumbnailSegment(thumbnailPath: string, outputPath: string): Promise<void>` — `runFfmpeg(['-y', '-loop', '1', '-framerate', '60', '-t', '5', '-i', thumbnailPath, '-vf', 'scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2:color=white', '-pix_fmt', 'yuv420p', outputPath])`.
    - `buildFrameSequenceSegment(frameDir: string, outputPath: string): Promise<void>` — `runFfmpeg(['-y', '-framerate', '60', '-i', join(frameDir, 'frame-%05d.png'), '-pix_fmt', 'yuv420p', outputPath])`.
    - `concatSegments(segmentPaths: string[], outputPath: string, tempDir: string): Promise<void>` — `tempDir`에 concat용 파일 목록(`file '<절대경로>'` 줄들)을 작성한 뒤 `runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', filelistPath, '-c', 'copy', outputPath])`.
    - `muxAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void>` — `runFfmpeg(['-y', '-i', videoPath, '-stream_loop', '-1', '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', outputPath])`.
    - `assembleVideo(input: { thumbnailPath: string; cardFrameDirs: string[]; musicFolderPath: string; userDataPath: string; outputVideoPath: string; tempDir: string }): Promise<void>` — 위 함수들을 순서대로 호출해 썸네일 세그먼트 + 카드별 세그먼트(입력 순서 그대로, AC1 "썸네일→카드1→카드2...") 생성 → concat → `getNextMusicTrack`으로 곡 선택 → mux → `mkdirSync(dirname(outputVideoPath), {recursive:true})` 후 최종 결과를 `outputVideoPath`로 이동(`renameSync`) → **성공 시점에만** 각 `cardFrameDirs`와 `tempDir`(세그먼트/concat 파일목록 임시파일) 전체를 `rmSync(..., {recursive:true, force:true})`로 삭제(AC1 "임시 프레임 PNG는 인코딩 완료 후 삭제"). 실패(어느 단계든 throw)하면 정리하지 않고 그대로 에러를 던진다(부분적으로 남은 임시파일은 디버깅에 유용하고, 실패 케이스의 정리 로직까지 desire하면 범위가 커진다 — 다음 실행이 동일 `tempDir`/카드 인덱스를 다시 쓰면 자연히 덮어써짐).
  - [x] 단위테스트(`videoAssembly.test.ts`): `ffmpegRunner`/`musicRotation`/`fs` 모킹으로 (1) 정상 흐름에서 호출 순서(썸네일→카드들→concat→mux)와 각 호출 인자 검증, (2) 성공 후 `cardFrameDirs`/`tempDir`가 삭제되는지, (3) 도중 실패 시 삭제가 호출되지 않는지, (4) `getNextMusicTrack`이 던진 에러(곡 없음)가 그대로 전파되는지.

- [x] Task 5: `video:assemble` IPC 채널 + 핸들러 (AC: 1, 2)
  - [x] `src/shared/ipc-video.ts`(신규): `VIDEO_ASSEMBLE_CHANNEL = 'video:assemble'`, `AssembleVideoCardInput { index: number; frameDir: string }`, `AssembleVideoRequest { contentFolderPath: string; keyword: string; cards: AssembleVideoCardInput[] }`, `AssembleVideoResponseData { videoPath: string }`. **2.1/2.2와 달리 카드별 결과 배열이 아니라 단일 결과**(Task 0 결정).
  - [x] `src/main/ipc/video.ts`(신규)에 `registerVideoIpcHandlers()`: `request.cards`가 비어있으면 에러 envelope, 아니면 `index` 순으로 정렬 → `findThumbnailPath(contentFolderPath)` → `getVideoPath(contentFolderPath, keyword)` → `assembleVideo({ thumbnailPath, cardFrameDirs: cards.map(c => c.frameDir), musicFolderPath: getMusicFolderPath(app.getPath('documents')), userDataPath: app.getPath('userData'), outputVideoPath, tempDir: join(app.getPath('temp'), 'sns-content-tool-video-build') })` → 성공 시 `{ok:true, data:{videoPath: outputVideoPath}}`, 실패 시 try/catch로 잡아 `{ok:false, error:{message}}`(throw 금지, 기존 envelope 규칙). `src/main/index.ts`에 등록 추가.
  - [x] `src/main/ipc/video.test.ts`(신규): `findThumbnailPath`/`assembleVideo`/`getVideoPath`/`getMusicFolderPath` 모킹, 빈 배열 에러/정상 성공/`assembleVideo` 실패 시 에러 전파 케이스.

- [x] Task 6: Preload + UI 통합 (AC: 1, 2)
  - [x] `src/preload/index.ts`/`index.d.ts`에 `assembleVideo(request: AssembleVideoRequest): Promise<IpcResult<AssembleVideoResponseData>>` 추가.
  - [x] `App.tsx`에 "영상 만들기" 버튼 추가(`cards.some(c => c.htmlPath)`이고 `folderPath`가 있을 때 노출, `assemblingVideo: boolean` 상태로 중복클릭 방지). `handleAssembleVideo()`: (1) `handleRenderImages`와 동일하게 보류 중인 디바운스 저장 타이머를 카드별로 취소, (2) `htmlPath`가 있는 카드들의 라이브 iframe DOM을 `serializeCardDocument`로 직렬화, (3) `window.api.captureCardFrames({cards: [{index, html}, ...]})` 호출해 카드별 `frameDir` 획득(부분실패 카드는 영상에서 제외하고 사용자에게 알림), (4) 성공한 카드들의 `{index, frameDir}`로 `window.api.assembleVideo({contentFolderPath: folderPath, keyword, cards: [...]})` 호출, (5) 결과를 `assembleVideoMessage`(성공: `영상 생성 완료: ${videoPath}`, 실패: 에러 메시지)로 표시.
  - [x] 버튼 비활성화 상태에서 로딩 표시("영상 만드는 중...") — 프레임캡처(카드 수 x 수백 프레임)+ffmpeg 인코딩이라 2.1의 이미지 렌더링보다 훨씬 오래 걸릴 수 있음(체감 수 초~수십 초).

- [x] Task 7: 테스트 및 실측 검증 (AC: 1, 2)
  - [x] `ffmpegRunner.test.ts`/`naming.test.ts`(추가분)/`musicRotation.test.ts`/`videoAssembly.test.ts`/`video.test.ts`는 Task 1~5에서 작성.
  - [x] **CDP 실측(2.1/2.2와 동일 방법론, 단 이번엔 실제 ffmpeg 바이너리로 실행):** 사전 준비로 실제 `Documents/SNS콘텐츠제작도구/music/`에 테스트용 짧은 mp3 1~2개를 복사해둔다(Task 0 참고 — 프로젝트 로컬 `music/` 폴더가 아님). 패키징된 앱을 CDP로 띄우고 `window.api.captureCardFrames(...)`로 더미 카드 1~2장의 프레임을 실제로 캡처한 뒤, 그 결과(`frameDir`)와 임시 썸네일 이미지 경로(테스트용 PNG를 `contentFolderPath/thumbnail.png`에 직접 배치)로 `window.api.assembleVideo(...)`를 호출 → 응답의 `videoPath`에 실제 mp4 파일이 생성됐는지, ffprobe 없이도 파일 크기>0과 컨테이너 매직바이트(`ftyp`)로 1차 확인, 가능하면 `ffmpeg -i`로 duration/해상도 출력을 읽어 1080x1350·예상 길이(5초+카드별 노출시간 합)와 맞는지 확인. 곡 1개만 둔 상태로 2번 연속 실행해 같은 곡이 다시 선택되는지(AC2), 곡 2개를 두고 2번 실행해 번갈아 선택되는지(AC1 로테이션) `userData/music-state.json` 내용으로 확인. 임시 프레임 폴더가 성공 후 삭제됐는지 확인. 검증 후 테스트로 만든 영상/임시 음악 파일/빌드 산출물 삭제.

### Review Findings

- [x] [Review][Patch] `videoAssembly.ts`의 음악 로테이션 상태가 오디오 믹스 성공 여부와 무관하게 트랙을 고르는 즉시 `userData/music-state.json`에 기록되던 문제 — `concatSegments` 이후 `getNextMusicTrack`을 호출하면 그 시점에 바로 상태가 갱신되는데, 바로 다음 단계인 `muxAudio`(ffmpeg 인코딩, 외부 요인으로 실패 가능)가 실패하면 영상은 만들어지지 않았는데도 로테이션은 이미 한 칸 전진해버려, 다음 성공한 실행이 원래 재생됐어야 할 곡을 건너뛰게 됨. `musicRotation.ts`를 `peekNextMusicTrack`(상태 읽기 전용, 부작용 없음)과 `commitMusicTrack`(상태 쓰기)으로 분리하고, `videoAssembly.ts`가 `muxAudio` 성공 *이후*에만 `commitMusicTrack`을 호출하도록 수정. 회귀 방지 단위테스트 추가(`videoAssembly.test.ts`: "오디오 믹스 실패 시 커밋 안 함", `musicRotation.test.ts`: "커밋을 건너뛰면 로테이션이 전진하지 않음"). CDP로 실제 ffmpeg 바이너리를 통한 전체 파이프라인 재검증(PASS) — 곡 1개 반복/2개 순환 동작은 수정 전후 동일하게 정상. [src/main/storage/musicRotation.ts, src/main/render/videoAssembly.ts]

## Dev Notes

- **이번 스토리는 Epic 2의 마지막 스토리이자, Story 2.2(프레임캡처)의 직접적인 소비자다.** `frame:capture`(2.2)가 만든 `frameDir`(임시 폴더의 PNG 시퀀스)를 입력으로 받아 영상으로 인코딩하고, 인코딩이 끝나면 그 폴더를 삭제하는 것까지가 이번 스토리의 책임이다 — 2.2는 "삭제"를 자기 책임으로 명시하지 않았다(스토리 경계가 여기서 나뉜다).
- **AD-1 준수:** ffmpeg 실행/파일 이동/삭제는 전부 Main에서만. Renderer는 `window.api.captureCardFrames`+`window.api.assembleVideo`로만 요청.
- **AD-4 핵심:** 카드 간 전환효과(`xfade` 등) 없음 — concat만. 모션그래픽 자체(2.2가 이미 프레임에 구워넣음)가 전환처럼 보이는 것이 의도된 디자인.
- **AD-5/AD-7 확장:** `/music/` 폴더 경로(`getMusicFolderPath`)와 영상 경로(`getVideoPath`)를 `naming.ts`에 추가해 단일 소스를 유지한다. 음악 로테이션 상태(`music-state.json`)는 도구 자체 상태이므로 `userData`에 둔다(AD-5).
- **"날짜 재계산 금지" 원칙이 또 적용된다(1.4/2.1에서 확립).** `getVideoPath`는 오늘 날짜로 새로 조립하지 않고 `contentFolderPath`의 폴더명에서 날짜를 그대로 가져온다 — 콘텐츠 등록일과 영상 조립 실행일이 다를 수 있다(예: 카드를 만든 다음 날 영상을 조립).
- **음악 로테이션은 "트랙 1개일 때도 깨지지 않아야 한다"는 AC2가 핵심 제약이다.** 인덱스 기반이 아니라 "현재 목록에서 마지막 사용 파일명을 찾아 다음으로" 방식이라, 목록 길이가 1이면 자기 자신의 인덱스(0)를 찾고 `(0+1)%1=0`이 되어 자동으로 반복된다 — 별도 분기 처리 불필요.
- **개발 중 사용자가 프로젝트 루트에 직접 넣어둔 `music/` 폴더(샘플 곡 3개)는 이번 스토리가 실제로 읽는 경로가 아니다.** 패키징된 앱은 `app.getPath('documents')/SNS콘텐츠제작도구/music/`만 본다 — CDP 실측 시 반드시 이 경로에 테스트 파일을 복사해둘 것(Task 7 참고). 프로젝트 루트의 `music/`은 `.gitignore`에 의해 mp3 파일 자체는 git 추적 대상이 아니다(이전 세션에서 정리됨).
- **영상 조립은 카드별 부분실패 패턴(2.1/2.2)을 따르지 않는다.** 영상은 하나로 합쳐지는 단일 산출물이라 "일부 카드만 성공"이 의미가 없다 — 어느 단계든 실패하면 전체가 실패고, `video:assemble` 응답은 `{ok, data:{videoPath}}` 또는 `{ok:false, error}`의 단일 결과다. 다만 프레임캡처(`frame:capture`, 2.2) 단계에서는 카드별 부분실패가 그대로 일어날 수 있으므로(2.2 자체의 동작), Renderer가 그 결과에서 성공한 카드만 추려 `assembleVideo`에 넘겨야 한다(Task 6).
- **ffmpeg 인자 구성은 위 Task 4에 적은 형태가 출발점이며, 실제 ffmpeg 동작 확인 후 화질/인코딩 옵션(예: `-crf`, `-preset`)을 조정할 수 있다** — AC가 특정 비트레이트/품질을 요구하지 않으므로 기본값으로 시작해 CDP 실측에서 재생 가능한 결과물이 나오면 충분하다.

### Project Structure Notes

- `src/main/render/ffmpegRunner.ts` 신규, `ffmpegRunner.test.ts` 신규.
- `src/main/render/videoAssembly.ts` 신규, `videoAssembly.test.ts` 신규.
- `src/main/storage/musicRotation.ts` 신규, `musicRotation.test.ts` 신규.
- `src/main/storage/naming.ts` 수정(`getMusicFolderPath`/`getVideoPath` 추가), `naming.test.ts` 수정.
- `src/main/storage/content.ts` 수정(`findThumbnailPath` 추가).
- `src/shared/ipc-video.ts` 신규.
- `src/main/ipc/video.ts` 신규, `video.test.ts` 신규.
- `src/main/index.ts` 수정(`registerVideoIpcHandlers` 등록).
- `src/preload/index.ts`/`index.d.ts` 수정(`assembleVideo` 노출).
- `src/renderer/src/App.tsx` 수정("영상 만들기" 버튼/핸들러/결과 표시 UI).
- `package.json` 수정(`ffmpeg-static` 의존성 추가).
- `electron-builder.yml` 수정(`asarUnpack`에 `node_modules/ffmpeg-static/**` 추가).

### References

- [ARCHITECTURE-SPINE.md#AD-4, AD-5, AD-7](../planning-artifacts/architecture/architecture-SNS관리현황-2026-06-25/ARCHITECTURE-SPINE.md) — ffmpeg 사용 범위(전환효과 없음, Claude API 미호출), 파일시스템 단일 진실 소스, 네이밍 단일 유틸
- [PRD §4.3, FR-6](../planning-artifacts/prds/prd-SNS관리현황-2026-06-24/prd.md) — 타이밍 규칙(썸네일 5초/카드별 애니메이션+3초), 음악 로테이션, 영상 경로 형식
- [epics.md#Story-2.3](../planning-artifacts/epics.md) — 원본 스토리 정의 및 AC
- [2-2-card-animation-frame-capture.md](./2-2-card-animation-frame-capture.md) — `frame:capture`/`getCardFrameDirPath`(이번 스토리의 직접 입력), 임시 폴더가 영구 산출물이 아니라는 결정의 배경, CDP 실측 방법론
- [2-1-html-image-rendering.md](./2-1-html-image-rendering.md) — "날짜 재계산 금지" 원칙, IPC envelope/throw 금지 규칙
- `src/main/settings/apiKey.ts` — `userData` JSON 상태 파일 읽기/쓰기(존재하지 않거나 파싱 실패 시 빈 객체로 폴백) 패턴 — `music-state.json`이 그대로 재사용

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 패키징된 앱(`npm run build:unpack`)을 CDP(`--remote-debugging-port=9337`/`9338`)로 띄우고, 실제 `Documents/SNS콘텐츠제작도구/music/`에 테스트 mp3(`track-a.mp3`)와 `Documents/.../output/{키워드}/{날짜}/thumbnail.png`(ffmpeg로 생성한 800x600 단색 PNG)를 준비한 뒤, `window.api.registerContent` → `window.api.captureCardFrames`(더미 카드 2장) → `window.api.assembleVideo`를 CDP `Runtime.evaluate`로 순서대로 호출해 실측.
  - 1차 실측에서 `assembleVideo`가 `spawn ... app.asar\node_modules\ffmpeg-static\ffmpeg.exe ENOENT`로 실패하는 회귀를 발견. 원인: `child_process.spawn`은 Electron의 asar 가상 파일시스템(여러 `fs` 함수에 적용되는 패치)을 거치지 않는 OS 레벨 프로세스 생성이라, `asarUnpack`으로 실제 바이너리가 `app.asar.unpacked/`에 풀려 있어도 `ffmpeg-static`이 `path.join(__dirname, ...)`로 계산해 돌려주는 경로 문자열은 여전히 `app.asar` 내부를 가리켜 실행 파일을 찾지 못함(2.1/2.2의 `BrowserWindow`/`fs.readFileSync` 계열은 Electron의 asar 패치를 타므로 이 문제가 없었음 — `spawn`만의 문제). `ffmpegRunner.ts`에 `app.asar` → `app.asar.unpacked` 문자열 치환을 추가해 해결, 재검증 PASS.
  - 수정 후 재검증: 더미 카드 2장(불릿 1개/2개, `entryDurationMs` 660ms/810ms → `frameCount` 220/225)으로 영상 조립 성공. 결과 mp4를 `ffmpeg -i`로 직접 분석 — `Duration: 00:00:12.42`(5초 썸네일 + 220/60 + 225/60 ≈ 3.667 + 3.75 = 12.417초, 공식과 일치), `Video: h264, 1080x1350, 60 fps`(AC 그대로), `Audio: aac, 44100Hz, stereo`(음악 믹스 확인). 성공 후 카드 프레임 임시폴더(`%TEMP%/sns-content-tool-frames/`)와 영상 빌드 임시폴더(`%TEMP%/sns-content-tool-video-build/`)가 모두 삭제됨을 확인(AC1).
  - 음악 로테이션 실측: 곡 1개(`track-a.mp3`)만 있을 때 연속 호출이 같은 곡을 다시 선택함(AC2) 확인. 곡 2개(`track-a.mp3`, `track-b.mp3`)로 늘린 뒤 연속 3회 실행 — `music-state.json`의 `lastUsedTrack`이 `track-a → track-b → track-a`로 정확히 순환함을 확인(AC1).
  - 검증 후 테스트로 만든 영상/콘텐츠 폴더, `Documents/SNS콘텐츠제작도구/music/`(테스트 mp3 포함), `music-state.json`, 임시 프레임/빌드 폴더, 빌드 산출물(`dist/`) 전부 삭제.

### Completion Notes List

- Task 0: `ffmpeg-static`만 추가(별도 래퍼 없음), CLI 인자는 `child_process.spawn`으로 직접 구성. `/music/` 폴더 실제 경로를 `Documents/SNS콘텐츠제작도구/music/`로 확정(Story 1.2 output 루트 결정과 동일 근거). 음악 로테이션 상태를 파일명 기반(`lastUsedTrack`)으로 설계해 곡 추가/삭제에 안전하고 1곡일 때도 자동으로 반복되게 함. 썸네일 세그먼트→카드별 세그먼트→concat→오디오 믹스 3단계 파이프라인으로 설계해 각 단계를 독립적으로 단위테스트 가능하게 함. 영상 조립은 2.1/2.2와 달리 단일 성공/실패 결과(부분실패 배열 아님)로 결정. 썸네일은 Renderer state가 아니라 Main이 `contentFolderPath`에서 직접 찾도록 결정(`findThumbnailPath`).
- Task 1: `ffmpegRunner.ts`(`runFfmpeg`) — `child_process.spawn` + stderr 캡처. **CDP 실측에서 발견한 버그**: asar 패키징 환경에서 `ffmpeg-static`이 반환하는 경로가 `spawn`(asar 가상 파일시스템을 타지 않음)에서 ENOENT가 나, `app.asar`→`app.asar.unpacked` 치환 로직(`resolveSpawnablePath`)을 추가해 해결(단위테스트로도 회귀 방지 — 가짜 asar 경로를 모킹해 치환 여부 검증). `electron-builder.yml`에 `node_modules/ffmpeg-static/**` asarUnpack 추가, 실제 패키징 빌드에서 해당 디렉터리가 `app.asar.unpacked/`에 풀려 있음을 확인.
- Task 2: `naming.ts`에 `getMusicFolderPath`/`getVideoPath` 추가(기존 `OUTPUT_APP_FOLDER` 상수 재사용, `getVideoPath`는 폴더명에서 날짜를 그대로 가져옴 — 재계산 금지 원칙). 단위테스트 5건 추가.
- Task 3: `musicRotation.ts`(`listMusicTracks`/`getNextMusicTrack`) — `apiKey.ts`의 JSON 상태파일 읽기/쓰기 패턴 재사용. 단위테스트 8건(3곡 순환, 1곡 반복, 상태파일에 없는 트랙 폴백, 첫 실행, 빈 폴더 에러 등) 전체 통과.
- Task 4: `videoAssembly.ts` — 세그먼트 빌드/concat/오디오 믹스 함수들과 `assembleVideo` 오케스트레이션, 성공 시에만 프레임 폴더/임시 빌드 폴더 삭제. 단위테스트 4건(`runFfmpeg`/`getNextMusicTrack` 모킹, 호출 순서/인자, 성공 시 정리, 실패 시 정리 안 함, 음악 에러 전파) 전체 통과.
- Task 5: `ipc-video.ts`/`main/ipc/video.ts`(`registerVideoIpcHandlers`) — 빈 배열 검증, 카드 인덱스 정렬, 썸네일/영상경로 해석, 단일 성공/실패 envelope. `main/index.ts`에 등록. 단위테스트 4건 전체 통과.
- Task 6: preload(`assembleVideo`) 노출, `App.tsx`에 "영상 만들기" 버튼/`handleAssembleVideo`(디바운스 타이머 취소 → 라이브 DOM 직렬화 → `captureCardFrames` → 성공한 카드만 추려 `assembleVideo` → 결과/실패 카드 수 표시) 추가.
- Task 7: 단위테스트 116건(코드리뷰 반영 후 119건) 전체 통과(`npx vitest run`), `npm run typecheck`/`npm run lint` 통과. CDP 실측(위 Debug Log 참고)으로 실제 ffmpeg 바이너리 실행, asar 경로 버그 발견·수정, mp4 duration/해상도/fps/오디오 트랙 확인, 음악 로테이션(1곡 반복/2곡 순환) 확인, 임시 폴더 정리 확인 — 전부 PASS.

### File List

- `package.json` (수정 — `ffmpeg-static` 의존성 추가)
- `electron-builder.yml` (수정 — `asarUnpack`에 `node_modules/ffmpeg-static/**` 추가)
- `src/main/render/ffmpegRunner.ts` (신규)
- `src/main/render/ffmpegRunner.test.ts` (신규)
- `src/main/render/videoAssembly.ts` (신규)
- `src/main/render/videoAssembly.test.ts` (신규)
- `src/main/storage/musicRotation.ts` (신규)
- `src/main/storage/musicRotation.test.ts` (신규)
- `src/main/storage/naming.ts` (수정 — `getMusicFolderPath`/`getVideoPath` 추가)
- `src/main/storage/naming.test.ts` (수정 — 단위테스트 추가)
- `src/main/storage/content.ts` (수정 — `findThumbnailPath` 추가)
- `src/main/storage/content.test.ts` (수정 — 단위테스트 추가)
- `src/shared/ipc-video.ts` (신규)
- `src/main/ipc/video.ts` (신규)
- `src/main/ipc/video.test.ts` (신규)
- `src/main/index.ts` (수정 — `registerVideoIpcHandlers` 등록)
- `src/preload/index.ts` (수정 — `assembleVideo` API 노출)
- `src/preload/index.d.ts` (수정 — `Api` 인터페이스에 `assembleVideo` 추가)
- `src/renderer/src/App.tsx` (수정 — "영상 만들기" 버튼/핸들러/결과 표시 UI)

### Change Log

- 2026-06-26: Story 2.3 컨텍스트 생성 — ffmpeg-static 신규 의존성 추가 결정(asarUnpack 필요), `/music/` 폴더 실제 경로를 `Documents/SNS콘텐츠제작도구/music/`로 확정(Story 1.2의 output 루트 결정과 동일 근거), 음악 로테이션 상태를 파일명 기반(인덱스 아님)으로 설계, 세그먼트 생성→concat→오디오 믹스 3단계 ffmpeg 파이프라인 설계, 영상 조립은 카드별 부분실패가 아닌 단일 성공/실패 결과로 결정. Status: ready-for-dev.
- 2026-06-26: Story 2.3 구현 완료 — ffmpeg-static 연동(`ffmpegRunner.ts`), 음악 로테이션(`musicRotation.ts`), 영상 조립 파이프라인(`videoAssembly.ts`), `video:assemble` IPC, "영상 만들기" UI. CDP 실측 중 "asar 패키징 환경에서 `child_process.spawn`이 asar 가상 파일시스템을 타지 않아 ffmpeg 바이너리를 ENOENT로 못 찾는" 회귀를 발견해 즉시 수정(`app.asar`→`app.asar.unpacked` 경로 치환) — 수정 후 실제 mp4 생성/재생 가능한 결과물(1080x1350, 60fps, 오디오 트랙 포함) 확인, 음악 로테이션(1곡 반복/2곡 순환) 확인. 단위테스트 116건/typecheck/lint 전체 통과. Status: ready-for-dev → review.
- 2026-06-26: 코드 리뷰(line-by-line/removed-behavior/cross-file/cleanup-efficiency-altitude-conventions 8개 앵글) 진행, patch 1건 발견 즉시 반영 — 음악 로테이션 상태가 오디오 믹스 성공 전에 커밋돼 실패 시 로테이션만 전진하던 문제, `peekNextMusicTrack`/`commitMusicTrack` 분리로 수정. 회귀 방지 테스트 3건 추가(전체 119건), CDP로 실제 ffmpeg 파이프라인 재검증(PASS). 다른 7개 앵글에서는 추가 패치 대상 없음. Status: review → done.
