import { describe, expect, it } from 'vitest'
import { CARD_CSS_VARIABLES, validateCardSkeleton } from './cardSkeleton'

const VALID_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  :root {
    --card-bg-color: #111111;
    --card-primary-color: #222222;
    --card-text-color: #ffffff;
    --card-accent-color: #00ff00;
  }
</style>
</head>
<body>
  <div data-edit-id="title-bar">
    <div class="title-text">My Title</div>
  </div>
  <div data-edit-id="bullet-1">
    <div data-edit-id="icon-1"><svg></svg></div>
    <div class="bullet-title">Bullet One</div>
  </div>
  <div data-edit-id="bullet-2">
    <div data-edit-id="icon-2"><svg></svg></div>
    <div class="bullet-title">Bullet Two</div>
  </div>
  <div data-edit-id="footer">
    <div class="footer-label">footer text</div>
  </div>
</body>
</html>`

describe('validateCardSkeleton', () => {
  it('passes a well-formed card with no violations', () => {
    const result = validateCardSkeleton(VALID_HTML)
    expect(result).toEqual({ valid: true, violations: [] })
  })

  it('flags a missing title-bar', () => {
    const html = VALID_HTML.replace('data-edit-id="title-bar"', 'data-edit-id="something-else"')
    const result = validateCardSkeleton(html)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('title-bar'))).toBe(true)
  })

  it('flags a duplicated footer', () => {
    const html = VALID_HTML.replace(
      '</body>',
      '<div data-edit-id="footer"><div class="footer-label">extra</div></div></body>'
    )
    const result = validateCardSkeleton(html)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('footer'))).toBe(true)
  })

  it('flags a bullet without a matching icon', () => {
    const html = VALID_HTML.replace(
      '<div data-edit-id="icon-2"><svg></svg></div>\n    <div class="bullet-title">Bullet Two</div>',
      '<div class="bullet-title">Bullet Two</div>'
    )
    const result = validateCardSkeleton(html)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('icon-2'))).toBe(true)
  })

  it('flags a gap in the bullet sequence (bullet-1, bullet-2, bullet-4 with no bullet-3)', () => {
    const html = VALID_HTML.replace(
      '<div data-edit-id="bullet-2">\n    <div data-edit-id="icon-2"><svg></svg></div>\n    <div class="bullet-title">Bullet Two</div>\n  </div>',
      '<div data-edit-id="bullet-4">\n    <div data-edit-id="icon-4"><svg></svg></div>\n    <div class="bullet-title">Bullet Four</div>\n  </div>'
    )
    const result = validateCardSkeleton(html)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('bullet-4'))).toBe(true)
  })

  it('flags a missing CSS variable declaration', () => {
    const html = VALID_HTML.replace('--card-accent-color: #00ff00;', '')
    const result = validateCardSkeleton(html)
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.includes('--card-accent-color'))).toBe(true)
  })

  it('exposes the 4 fixed CSS variable names', () => {
    expect(CARD_CSS_VARIABLES).toEqual([
      '--card-bg-color',
      '--card-primary-color',
      '--card-text-color',
      '--card-accent-color'
    ])
  })
})
