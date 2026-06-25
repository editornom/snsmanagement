# PRD Quality Review — SNS 콘텐츠 제작 자동화 도구

## Overall verdict

This is a tight, honest capability spec for a single-operator hobby tool, and it correctly resists over-formalization (no personas, no UJs, light Open Questions) — the right call for its shape. The core weakness is in Done-ness: several FRs lean on unbounded words ("즉시 반영") and one feature (FR-8 제목 필드) is scoped in without a stated purpose. Scope honesty is mostly solid but the Assumptions Index doesn't roundtrip with inline tags, and one underlying assumption (하이온넷's business identity) carries more weight than its single un-flagged mention suggests.

## Decision-readiness — adequate

The PRD makes real decisions and shows its work on at least one resolved tension: §8 explicitly records that the prior open question ("원고 생성 입력값: HTML 소스 vs 이미지") was resolved by using both, rather than silently picking one and erasing the debate. FR-1's Notes section is a genuine trade-off acknowledgment — no automated quality check on text-fidelity; the user must eyeball it and click regenerate. That's a real "what we gave up" statement (build cost of a verifier) rather than a smoothed-over "balance."

Where it's thinner: §6.2's only `[NOTE FOR PM]` flags the upload-tracking Excel deferral, which is a safe, uncontroversial deferral (already a Non-Goal). The more interesting tension — that FR-1 has no automatic failure detection and instead pushes 100% of QA onto the solo operator's judgment — is stated as fact in the Notes but never elevated to a callout, even though it's the kind of design choice a reviewer might push back on ("should there be at least a diff highlight?"). It's not dodged, but it's underweighted relative to its risk.

### Findings

- **low** Resolved trade-off not labeled as a trade-off (§4.1 Notes) — The decision to skip automated text-fidelity validation in favor of manual preview-and-regenerate is stated as a feature description, not flagged as a deliberate scope/cost trade-off. _Fix:_ Add a one-line `[NOTE FOR PM]` noting that automated diffing was considered and explicitly deferred, so a future reviewer knows it was a choice, not an oversight.

## Substance over theater — strong

No persona theater — the PRD explicitly skips personas/UJs with a stated reason (§2.1: "단일 운영자용 내부 도구이므로... 가벼운 JTBD 서술로 대체"). The Vision (§1) is specific to this product: it names the exact axis being optimized ("귀찮음 감소" not "시간 절약"), names what is deliberately NOT in scope (썸네일/일러스트), and ties that directly to a workflow chain (참고 이미지 → HTML 카드 → 미세 수정 → 렌더링 → 원고). This could not be swapped into another PRD unchanged — it's earned, not template filler. No NFR boilerplate; the one constraint section (§4.6) gives concrete numbers (1920x1080, $0.16~$0.27/call) instead of adjectives.

### Findings

(none — this dimension is strong, no findings needed)

## Strategic coherence — adequate

There is a real thesis: "귀찮음 감소, not 시간 절약" (§1), and it visibly drives scope decisions — thumbnails stay manual because they require creative judgment, while HTML/render/원고 steps are automated because they're repetitive-but-not-creative. SM-2 ("실제로 사용하고 한 달 내 포기하지 않음") is a coherent metric for a "reduce friction so I keep doing this" thesis — it measures adoption persistence, not vanity activity. MVP scope is the "problem-solving" kind and the scope logic (automate the repetitive, leave the creative) is consistent throughout §4.

Mild gap: SM-1 (90% text fidelity) validates FR-1's mechanics but doesn't by itself validate the "귀찮음 감소" thesis — a tool could hit 90% fidelity and still feel annoying to use (e.g., if regeneration is slow or the editor is clunky). There's no metric tied to the editing/rendering/원고 steps that constitute most of the claimed friction reduction.

### Findings

- **medium** Success Metrics only cover one of five automated steps (§7) — SM-1 validates FR-1 (HTML generation fidelity) only; FR-2/3 (editor), FR-4/5/6 (rendering), and FR-7 (원고 생성) have no corresponding success signal even though they're equally central to the "귀찮음 감소" thesis. _Fix:_ Either fold a lightweight qualitative check into SM-2 (e.g., "사용자가 매 단계에서 재작업 없이 진행할 수 있다") or accept that SM-2's usage-persistence metric is the de facto stand-in and say so explicitly.

## Done-ness clarity — thin

Several FRs are genuinely solid: FR-1's consequences are measurable (90% text fidelity, 1080x1350, 1-10 cards, variable color), FR-6's timing model is fully specified (5s thumbnail, +3s per slide, music rotation with last-played tracking persisted across runs), and FR-8's folder behavior is precise (`output/{키워드}/{YYMMDD}/`, append-on-rerun). This is the strongest part of the document.

But "즉시" (immediately/instantly) appears as the sole bound on FR-2 and FR-3's sync behavior with no numeric ceiling — for a solo desktop tool this may be fine in practice, but as written it's not falsifiable. FR-5's "반복 모션은 최초 1회 사이클 완료를 기준으로 다음 단계로 넘어간다" is good (testable), but "카드별 애니메이션 종류는 랜덤 다양화 없이 고정 패턴을 사용한다" doesn't say _which_ fixed pattern or how it's chosen per card — "고정 패턴" is underspecified the same way "user-friendly" would be flagged elsewhere. FR-8's title field ("제목 필드는 입력받아 저장되지만... 활용처가 없다") is honestly disclosed as inert, but it's still scope without a testable consequence — there's nothing to verify because it does nothing yet.

### Findings

- **medium** Unbounded "즉시" in sync consequences (§4.2, FR-2 and FR-3) — "즉시 반영된다" / "즉시 반영" has no latency bound. For a hobby tool this is low-stakes, but it's exactly the kind of adjective the rubric flags. _Fix:_ Either state a rough bound ("UI 입력 후 1프레임/100ms 이내 반영") or explicitly note it's a non-bounded UX expectation and leave it qualitative on purpose.
- **low** "고정 패턴" undefined (§4.3, FR-5) — Which animation maps to which card position, or is it one single animation for all cards? Currently not verifiable. _Fix:_ One sentence naming the pattern (e.g., "모든 카드는 페이드인 고정 사용" or "카드 순서대로 페이드인→슬라이드인 교대").
- **low** FR-8 제목 필드 has no consequence to test (§4.5) — The FR captures and stores a field explicitly noted as unused. Not wrong, but it's scope-with-no-acceptance-criteria. _Fix:_ Either move it to a `[NON-GOAL for MVP]`-adjacent note under FR-8 ("저장만 하고 미사용") so it reads as intentional placeholder rather than an FR, or cut until it has a consumer.

## Scope honesty — adequate

§5 Non-Goals is doing real work — five concrete exclusions, each with a one-line reason (썸네일 자동화 = 디자인 자유도, 업로드 자동화 = 정책 복잡도, 다중 사용자 = 1인 도구라 불필요). §6.2 has one well-placed `[NOTE FOR PM]` at the upload-tracking deferral. Open-items density (zero open questions, one NOTE FOR PM, one assumption) is appropriately low for a hobby-tier, single-reviewer PRD — no red flag there.

The gap is mechanical but real: §9 Assumptions Index lists one assumption (하이온넷's business identity as B2B network infra) "indexed" against §1, but there is no inline `[ASSUMPTION: ...]` tag anywhere in §1 or elsewhere in the document. The rubric calls for inline tags that roundtrip to the index; right now the index entry exists without an inline counterpart. This particular assumption also matters more than its quiet placement suggests — it implicitly shapes what "원고" content and tone should look like (FR-7), yet that linkage is never made explicit in §4.4.

### Findings

- **medium** Assumptions Index entry has no inline tag (§1, §9) — §9 references "§1 — 하이온넷은... B2B 네트워크 인프라 서비스" but §1's text contains no `[ASSUMPTION: ...]` marker. _Fix:_ Add the inline tag at the point in §1 where the brand identity is implied, so the index entry roundtrips per the mechanical convention.
- **low** Business-identity assumption not connected to FR-7 (§4.4) — The 원고 생성 FR never states that content/tone assumes a B2B infra audience, even though that's presumably why 연락처 템플릿 and 페인포인트 framing look the way they do. _Fix:_ One clause in FR-7's description tying the tone assumption back to §1/§9, or accept it's implicit and leave as-is given hobby-tier stakes.

## Downstream usability — not a primary concern (standalone PRD)

§0 states explicitly: "별도 UX 문서나 선행 리서치는 없으며, 본 PRD가 유일한 기획 문서다." There is no architecture or story-creation pipeline consuming this PRD that the validator is aware of, so per the rubric this dimension matters less here. That said, the FR numbering (FR-1 through FR-8) is contiguous and unique, and the Glossary (§3) terms (정보카드, 썸네일, 키워드, 원고, 연락처 템플릿, 출력 폴더) are used consistently in the FR sections without drift — so even on a light pass, the mechanics are clean enough to support a future downstream consumer if one appears.

### Findings

(none — dimension is low-stakes for this standalone PRD)

## Shape fit — strong

This is the PRD's best dimension. §2.1 explicitly de-scopes personas and UJs with a stated rationale appropriate to a single-operator internal tool, rather than padding the document with a persona that exists only to look thorough. §7's Success Metrics are operational (사용 지속성, 텍스트 반영률) rather than forced into a user-facing engagement-metric template. The Constraints section (§4.6) reads like a capability spec — fixed resolution, single API key, no auth/multi-tenancy — exactly matching a hobby/solo tool. Nothing here is over-formalized for its stakes; if anything the document is slightly under-specified on the "done-ness" axis (see above) rather than over-built on ceremony.

### Findings

(none — this dimension is strong, no findings needed)

## Mechanical notes

- **Glossary drift**: None detected — 정보카드, 썸네일, 키워드, 원고, 연락처 템플릿, 출력 폴더 are each used consistently in their defined sense across §3 and the FR sections (§4.1–4.5).
- **ID continuity**: FR-1 through FR-8 are contiguous, unique, and each is referenced correctly where cross-referenced (e.g., §7 SM-1 cites "FR-1 검증"; §5/§6.2 Non-Goals reference features without numeric FR drift). No gaps or duplicates found.
- **Assumptions Index roundtrip**: Broken in one direction — §9 has one indexed assumption (하이온넷 = B2B 네트워크 인프라 브랜드) but there is no corresponding inline `[ASSUMPTION: ...]` tag in §1 or elsewhere. See Scope Honesty finding above.
- **UJ protagonist naming**: N/A — UJs are explicitly and appropriately omitted (§2.1) for this single-operator tool; no floating UJs exist to check.
- **Required sections for stakes/type**: All sections expected for a hobby/solo internal-tool PRD are present (Vision, Target User/JTBD, Glossary, Features/FRs, Constraints, Non-Goals, MVP Scope, Success Metrics, Open Questions, Assumptions Index). No missing section given the agreed shape.
