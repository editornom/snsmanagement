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
