import { describe, expect, it } from 'vitest'
import { computeEntryDurationMs, injectEntryAnimation } from './cardAnimation'

function cardHtml(bulletCount: number): string {
  const bullets = Array.from(
    { length: bulletCount },
    (_, i) => `<div data-edit-id="bullet-${i + 1}"></div><div data-edit-id="icon-${i + 1}"></div>`
  ).join('')
  return `<!DOCTYPE html><html><head><style>:root{--card-bg-color:#fff;}</style></head><body><div data-edit-id="title-bar"></div>${bullets}<div data-edit-id="footer"></div></body></html>`
}

describe('computeEntryDurationMs', () => {
  it('returns footer-start + animation duration when there are no bullets', () => {
    expect(computeEntryDurationMs(cardHtml(0))).toBe(0 * 80 + 80 + 500)
  })

  it('accounts for a single bullet', () => {
    expect(computeEntryDurationMs(cardHtml(1))).toBe(1 * 80 + 80 + 500)
  })

  it('accounts for the maximum bullet number among ten bullets', () => {
    expect(computeEntryDurationMs(cardHtml(10))).toBe(10 * 80 + 80 + 500)
  })
})

describe('injectEntryAnimation', () => {
  it('inserts the keyframes style before </head> and the element-delay script before </body>', () => {
    const { html, entryDurationMs } = injectEntryAnimation(cardHtml(2))

    expect(html).toContain('@keyframes __entryFadeSlide__')
    expect(html).toContain('document.querySelectorAll')
    expect(html.indexOf('@keyframes')).toBeLessThan(html.indexOf('</head>'))
    // 스크립트가 querySelectorAll로 엘리먼트를 찾으므로, body가 파싱된 뒤(</body> 바로 앞)에 있어야 한다.
    expect(html.indexOf('document.querySelectorAll')).toBeGreaterThan(html.indexOf('</head>'))
    expect(html.indexOf('document.querySelectorAll')).toBeLessThan(html.indexOf('</body>'))
    expect(entryDurationMs).toBe(2 * 80 + 80 + 500)
  })

  it('preserves the original data-edit-id skeleton', () => {
    const original = cardHtml(3)
    const { html } = injectEntryAnimation(original)

    expect(html).toContain('data-edit-id="title-bar"')
    expect(html).toContain('data-edit-id="bullet-3"')
    expect(html).toContain('data-edit-id="icon-3"')
    expect(html).toContain('data-edit-id="footer"')
  })

  it('appends after </body> when there is no </head>', () => {
    const html = '<html><body><div data-edit-id="title-bar"></div></body></html>'
    const result = injectEntryAnimation(html)

    expect(result.html).toContain('@keyframes')
    expect(result.html.indexOf('@keyframes')).toBeLessThan(result.html.indexOf('</body>'))
  })

  it('still wraps style+script around the original markup when there is neither </head> nor </body>', () => {
    const html = '<div data-edit-id="title-bar"></div>'
    const result = injectEntryAnimation(html)

    expect(result.html).toContain(html)
    expect(result.html).toContain('@keyframes')
    expect(result.html).toContain('document.querySelectorAll')
  })
})
