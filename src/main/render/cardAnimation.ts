const ANIMATION_DURATION_MS = 500
const STAGGER_MS = 80
const KEYFRAMES_NAME = '__entryFadeSlide__'

export function computeEntryDurationMs(html: string): number {
  const bulletNumbers = [...html.matchAll(/bullet-(\d+)/g)].map((match) => Number(match[1]))
  const maxBulletN = bulletNumbers.length > 0 ? Math.max(...bulletNumbers) : 0
  const footerStartMs = maxBulletN * STAGGER_MS + STAGGER_MS
  return footerStartMs + ANIMATION_DURATION_MS
}

export function injectEntryAnimation(html: string): { html: string; entryDurationMs: number } {
  const entryDurationMs = computeEntryDurationMs(html)

  const styleBlock = `<style>
@keyframes ${KEYFRAMES_NAME} {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
`
  // 엘리먼트를 querySelectorAll로 찾으므로 <body> 파싱이 끝난 뒤(</body> 바로 앞)에 실행돼야 한다.
  // <head>에 두면 파서가 아직 body를 만들기 전이라 아무 엘리먼트도 찾지 못한다.
  const scriptBlock = `<script>
(function () {
  var ANIMATION_DURATION_MS = ${ANIMATION_DURATION_MS};
  var STAGGER_MS = ${STAGGER_MS};
  var elements = document.querySelectorAll('[data-edit-id]');
  var maxBulletN = 0;
  elements.forEach(function (el) {
    var match = /^bullet-(\\d+)$/.exec(el.getAttribute('data-edit-id'));
    if (match) maxBulletN = Math.max(maxBulletN, parseInt(match[1], 10));
  });
  var footerStartMs = maxBulletN * STAGGER_MS + STAGGER_MS;
  elements.forEach(function (el) {
    var id = el.getAttribute('data-edit-id');
    var delayMs = 0;
    var bulletOrIconMatch = /^(?:bullet|icon)-(\\d+)$/.exec(id);
    if (id === 'footer') {
      delayMs = footerStartMs;
    } else if (bulletOrIconMatch) {
      delayMs = parseInt(bulletOrIconMatch[1], 10) * STAGGER_MS;
    }
    // fill:'both'가 필수다 — 'forwards'만 쓰면 delay 구간(아직 활성화 전)에는 애니메이션 효과가
    // 적용되지 않아 엘리먼트가 기본 스타일(불투명)로 보이다가 delay가 끝나는 순간 opacity:0으로
    // 튀었다가 다시 페이드인되는 깜빡임이 생긴다. 'both'로 delay 구간에도 from 키프레임을 적용한다.
    el.style.animation = '${KEYFRAMES_NAME} ' + ANIMATION_DURATION_MS + 'ms ease-out both';
    el.style.animationDelay = delayMs + 'ms';
  });
})();
</script>
`

  let withStyle = html
  const headCloseIndex = html.indexOf('</head>')
  if (headCloseIndex !== -1) {
    withStyle = html.slice(0, headCloseIndex) + styleBlock + html.slice(headCloseIndex)
  } else {
    withStyle = styleBlock + html
  }

  const bodyCloseIndex = withStyle.indexOf('</body>')
  if (bodyCloseIndex !== -1) {
    return {
      html: withStyle.slice(0, bodyCloseIndex) + scriptBlock + withStyle.slice(bodyCloseIndex),
      entryDurationMs
    }
  }

  return { html: withStyle + scriptBlock, entryDurationMs }
}
