// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  CARD_CSS_VARIABLES,
  enableInlineEditing,
  getCssVariableValues,
  serializeCardDocument,
  setCssVariable
} from './cardEditing'

const SAMPLE_HTML = `<!DOCTYPE html>
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
    <div class="title-icon-wrapper">
      <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"></circle></svg>
    </div>
    <div class="title-text">My Title</div>
  </div>
  <div data-edit-id="bullet-1">
    <div data-edit-id="icon-1">
      <svg viewBox="0 0 10 10"><rect width="10" height="10"></rect></svg>
    </div>
    <div class="bullet-title">Bullet One</div>
  </div>
  <div data-edit-id="footer">
    <div class="footer-label">footer text</div>
  </div>
</body>
</html>`

function parseSampleDocument(): Document {
  return new DOMParser().parseFromString(SAMPLE_HTML, 'text/html')
}

describe('enableInlineEditing', () => {
  it('marks leaf text elements as contentEditable', () => {
    const doc = parseSampleDocument()
    enableInlineEditing(doc)

    const titleText = doc.querySelector('.title-text') as HTMLElement
    const bulletTitle = doc.querySelector('.bullet-title') as HTMLElement
    const footerLabel = doc.querySelector('.footer-label') as HTMLElement

    expect(titleText.contentEditable).toBe('true')
    expect(bulletTitle.contentEditable).toBe('true')
    expect(footerLabel.contentEditable).toBe('true')
  })

  it('does not mark container elements with element children as editable', () => {
    const doc = parseSampleDocument()
    enableInlineEditing(doc)

    const titleBar = doc.querySelector('[data-edit-id="title-bar"]') as HTMLElement
    const bulletOne = doc.querySelector('[data-edit-id="bullet-1"]') as HTMLElement

    expect(titleBar.contentEditable).not.toBe('true')
    expect(bulletOne.contentEditable).not.toBe('true')
  })

  it('does not mark svg icon elements (no text content) as editable', () => {
    const doc = parseSampleDocument()
    enableInlineEditing(doc)

    const iconWrapper = doc.querySelector('.title-icon-wrapper') as HTMLElement
    expect(iconWrapper.contentEditable).not.toBe('true')
  })

  it('prevents Enter key from inserting a new block element', () => {
    const doc = parseSampleDocument()
    enableInlineEditing(doc)

    const titleText = doc.querySelector('.title-text') as HTMLElement
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    titleText.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })
})

describe('serializeCardDocument', () => {
  it('returns a string starting with the doctype declaration', () => {
    const doc = parseSampleDocument()
    const result = serializeCardDocument(doc)

    expect(result.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(result).toContain('data-edit-id="title-bar"')
  })
})

describe('getCssVariableValues / setCssVariable', () => {
  it('reads the 4 fixed CSS variables exposed via getComputedStyle', () => {
    const doc = parseSampleDocument()
    // jsdom does not apply <style> stylesheet rules to getComputedStyle, so
    // simulate the real browser's resolved :root values via inline style.
    doc.documentElement.style.setProperty('--card-bg-color', '#111111')
    doc.documentElement.style.setProperty('--card-accent-color', '#00ff00')

    const values = getCssVariableValues(doc)

    expect(Object.keys(values)).toEqual(CARD_CSS_VARIABLES)
    expect(values['--card-bg-color']).toBe('#111111')
    expect(values['--card-accent-color']).toBe('#00ff00')
  })

  it('overrides a variable via inline style, taking precedence over :root', () => {
    const doc = parseSampleDocument()
    setCssVariable(doc, '--card-bg-color', '#abcdef')

    const values = getCssVariableValues(doc)
    expect(values['--card-bg-color']).toBe('#abcdef')
    expect(doc.documentElement.getAttribute('style')).toContain('--card-bg-color')
  })

  it('preserves the original :root style block after overriding', () => {
    const doc = parseSampleDocument()
    setCssVariable(doc, '--card-bg-color', '#abcdef')

    const serialized = serializeCardDocument(doc)
    expect(serialized).toContain('--card-bg-color: #111111')
  })
})
