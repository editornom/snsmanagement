import { CARD_CSS_VARIABLES, type CardCssVariable } from '../../shared/cardSkeleton'

export { CARD_CSS_VARIABLES, type CardCssVariable }

function isLeafTextElement(element: Element): boolean {
  const hasElementChild = Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.ELEMENT_NODE
  )
  return !hasElementChild && Boolean(element.textContent?.trim())
}

export function enableInlineEditing(doc: Document): void {
  const elements = doc.body.querySelectorAll('*')
  elements.forEach((element) => {
    if (!isLeafTextElement(element)) return

    const editable = element as HTMLElement
    editable.contentEditable = 'true'
    editable.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
      }
    })
  })
}

export function serializeCardDocument(doc: Document): string {
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

export function getCssVariableValues(doc: Document): Record<CardCssVariable, string> {
  const computed = getComputedStyle(doc.documentElement)
  const values = {} as Record<CardCssVariable, string>
  for (const name of CARD_CSS_VARIABLES) {
    values[name] = computed.getPropertyValue(name).trim()
  }
  return values
}

export function setCssVariable(doc: Document, name: CardCssVariable, value: string): void {
  doc.documentElement.style.setProperty(name, value)
}

export function findElementRange(
  html: string,
  editId: string
): { start: number; end: number } | null {
  const marker = `data-edit-id="${editId}"`
  const tagRegex = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g
  let match: RegExpExecArray | null
  let start = -1
  let tagName = ''
  let depth = 0

  while ((match = tagRegex.exec(html)) !== null) {
    const [full, closingSlash, name, attrs] = match
    const isClosing = closingSlash === '/'
    const isSelfClosing = attrs.trimEnd().endsWith('/')

    if (start === -1) {
      if (!isClosing && full.includes(marker)) {
        start = match.index
        tagName = name
        if (isSelfClosing) return { start, end: match.index + full.length }
        depth = 1
      }
      continue
    }

    if (name !== tagName || isSelfClosing) continue

    depth += isClosing ? -1 : 1
    if (depth === 0) {
      return { start, end: match.index + full.length }
    }
  }

  return null
}
