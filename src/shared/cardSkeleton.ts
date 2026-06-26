export const CARD_CSS_VARIABLES = [
  '--card-bg-color',
  '--card-primary-color',
  '--card-text-color',
  '--card-accent-color'
] as const

export type CardCssVariable = (typeof CARD_CSS_VARIABLES)[number]

function countDataEditId(html: string, editId: string): number {
  const regex = new RegExp(`data-edit-id="${editId}"`, 'g')
  return (html.match(regex) ?? []).length
}

export function validateCardSkeleton(html: string): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  const titleBarCount = countDataEditId(html, 'title-bar')
  if (titleBarCount !== 1) {
    violations.push(`제목바(title-bar) 영역이 정확히 1개여야 합니다(현재 ${titleBarCount}개)`)
  }

  const footerCount = countDataEditId(html, 'footer')
  if (footerCount !== 1) {
    violations.push(`푸터(footer) 영역이 정확히 1개여야 합니다(현재 ${footerCount}개)`)
  }

  let bulletIndex = 1
  while (countDataEditId(html, `bullet-${bulletIndex}`) > 0) {
    if (countDataEditId(html, `icon-${bulletIndex}`) === 0) {
      violations.push(
        `불릿(bullet-${bulletIndex})에 대응하는 아이콘(icon-${bulletIndex})이 없습니다`
      )
    }
    bulletIndex += 1
  }
  if (bulletIndex === 1) {
    violations.push('불릿(bullet-1) 영역이 최소 1개 있어야 합니다')
  }

  // The loop above stops at the first gap in the sequence. Scan a bounded range past that
  // point for any further bullet-N — if one exists, the numbering isn't sequential/gapless,
  // which the skeleton contract requires (e.g. bullet-1, bullet-2, bullet-4 with no bullet-3).
  const GAP_SCAN_RANGE = 20
  for (let n = bulletIndex; n < bulletIndex + GAP_SCAN_RANGE; n++) {
    if (countDataEditId(html, `bullet-${n}`) > 0) {
      violations.push(
        `불릿(bullet-${n})이 ${bulletIndex - 1}번 다음부터 순차적으로 이어지지 않습니다(bullet-${bulletIndex} 누락)`
      )
      break
    }
  }

  for (const variableName of CARD_CSS_VARIABLES) {
    if (!new RegExp(`${variableName}\\s*:`).test(html)) {
      violations.push(`CSS 변수 ${variableName}가 선언되지 않았습니다`)
    }
  }

  return { valid: violations.length === 0, violations }
}
