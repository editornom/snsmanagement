export const CARD_CSS_VARIABLES = [
  '--card-bg-color',
  '--card-primary-color',
  '--card-text-color',
  '--card-accent-color'
] as const

export type CardCssVariable = (typeof CARD_CSS_VARIABLES)[number]

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
