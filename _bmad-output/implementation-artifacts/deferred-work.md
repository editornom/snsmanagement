# Deferred Work

## Deferred from: code review of 1-3-html-card-generation (2026-06-25)

- iframe에 렌더링되는 Claude 생성 HTML에 대한 정제(sanitization)/골격계약 강제 검증 부재 — Story 1.6의 명시적 범위(계약 위반 거부 로직)이며 이번 스토리는 시스템 프롬프트로만 유도하기로 스펙에서 이미 결정됨.
- `settings.json` 비원자적 읽기-수정-쓰기(crash 시 손상 가능) — 필드 1개뿐인 현재로선 위험 낮음, 설정 항목이 늘어나면 원자적 쓰기(temp+rename) 재검토.
- Claude SDK 에러 메시지를 가공 없이 렌더러로 전달 — 구체적 키 유출 사례 미확인, 일반적 하드닝이라 후속 스토리에서 재검토.
- 카드 생성 배치 취소/진행률 UI 부재 — AC에 없는 UX 개선, 별도 스토리로 검토.
- 재생성 시 기존 HTML 덮어쓰기 확인 다이얼로그 없음 — Story 1.4/1.5 인라인 편집 도입 이후 "덮어쓰기 보호" 필요성을 재평가.
- 참고이미지 파일 크기 상한 검사 없음 — 구체적 장애 사례 없는 일반 하드닝.
- 동시에 generate/regenerate 호출 시 렌더러 상태 경쟁 가능성 — 발생 확률 낮고 수정 시 세대(epoch) 가드 등 설계가 필요해 범위 초과.
- 선택된 참고이미지가 생성 시점에 삭제된 경우 노출되는 에러 메시지가 사용자 친화적이지 않음(raw ENOENT) — 이미 개별 카드 단위로 캐치되어 동작은 정상, 메시지 품질만 낮음.
- `@anthropic-ai/sdk`의 webhook 서명 검증용 전이 의존성(`standardwebhooks` 등) — 공식 SDK의 의존성이라 직접 조치 불가.

## Deferred from: code review of 1-4-card-inline-editing (2026-06-26)

- Claude가 생성하는 카드 HTML에 인라인 태그(`<span>`/`<b>` 등)가 섞이면 leaf-text 감지 규칙("자식 엘리먼트 없음")이 깨질 수 있음 — 1.3 골격계약상 카드 내부 텍스트는 단순 텍스트로 가정되며 이번 스토리는 구조 변경을 범위 밖으로 명시함. 시스템 프롬프트가 향후 인라인 태그를 생성하게 되면 재검토 필요.
- `serializeCardDocument`의 `outerHTML` 직렬화가 주석/SVG 네임스페이스/속성 순서 등 더 복잡한 실제 생성 마크업에서도 구조를 온전히 보존하는지는 단순 골격계약 샘플 1종으로만 CDP 검증됨 — 실측은 PASS했으나 다양한 실제 생성 결과물에 대한 자동화 회귀 테스트는 없음.
- `iframeRefs`/`saveTimers` Map이 카드 인덱스 기준으로 정리(cleanup)되지 않아 매우 오래 유지되는 세션에서 약간의 메모리 누적 가능성 — 현재 앱은 `App` 컴포넌트가 실질적으로 unmount되지 않는 단일 세션 구조라 실사용 영향은 낮음.

## Deferred from: code review of 1-5-code-panel-sync (2026-06-26)

- `findElementRange`의 `full.includes(marker)` 매칭이, 사용자가 코드창에서 직접 편집해 다른 속성값 안에 우연히 `data-edit-id="X"` 리터럴 문자열이 들어가는 극단적 경우 잘못된 여는 태그를 찾을 수 있음 — 속성명까지 구분하는 파싱이 필요해 비용 대비 위험이 낮음(사용자가 의도적으로 그런 텍스트를 attrs에 넣는 경우만 발생).

## Deferred from: code review of 1-6-ai-instruction-editing (2026-06-26)

- `validateCardSkeleton`의 CSS 변수 선언 검사가 단순 문자열/정규식 매칭이라 `:root`/`<style>` 블록 밖(주석, 본문 텍스트 등)에 변수명이 등장해도 통과시킬 수 있음 — 실제 CSS 파싱이 필요해 비용 대비 위험 낮음(현재 시스템 프롬프트가 그런 응답을 유도할 가능성 낮음).
- `editCardHtml` 응답에 마크다운 코드블록(```)이 섞여도 별도로 제거하지 않음 — 1.3의 `generateCardHtml`도 동일한 위험을 시스템 프롬프트로만 방지하는 기존 패턴과 일관됨, 새 회귀 아님.
- `validateCardSkeleton`의 불릿 탐색/gap 스캔 루프에 명시적 상한이 있지만, 입력 HTML 자체 크기에 대한 상한은 없음 — Claude 응답이 `max_tokens`(8192)로 이미 사실상 제한되어 실사용 위험 낮음.
- 재생성/AI편집/되돌리기 사이에 완전한 동시성 가드(세대/epoch 토큰)는 없음 — UI 버튼 비활성화로 일반적인 사용자 트리거 경쟁은 막았지만, 프로그래밍적으로 동시에 두 작업을 발생시키는 극단적 케이스까지는 막지 않음. 풀가드는 설계 변경 규모라 범위 초과.
- `countDataEditId`가 `editId` 문자열을 정규식에 그대로 보간해 메타문자를 escape하지 않음 — 현재 호출부는 전부 고정 리터럴 패턴만 전달해 실질 위험 없음, 향후 신뢰되지 않은 입력에 노출될 경우 재검토.
