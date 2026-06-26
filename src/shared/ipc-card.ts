export const CARD_SELECT_REFERENCE_IMAGES_CHANNEL = 'card:select-reference-images'
export const CARD_GENERATE_CHANNEL = 'card:generate'
export const CARD_REGENERATE_CHANNEL = 'card:regenerate'
export const CARD_SAVE_HTML_CHANNEL = 'card:save-html'
export const CARD_EDIT_WITH_INSTRUCTION_CHANNEL = 'card:edit-with-instruction'

export interface GenerateCardsRequest {
  contentFolderPath: string
  keyword: string
  referenceImagePaths: string[]
}

export interface RegenerateCardRequest {
  contentFolderPath: string
  keyword: string
  referenceImagePath: string
  index: number
}

export interface CardSuccess {
  status: 'success'
  index: number
  htmlPath: string
  html: string
}

export interface CardFailure {
  status: 'failure'
  index: number
  error: string
}

export type CardResult = CardSuccess | CardFailure

export interface GenerateCardsResponseData {
  cards: CardResult[]
}

export interface RegenerateCardResponseData {
  card: CardResult
}

export interface SelectReferenceImagesResult {
  paths: string[]
  truncated: boolean
}

export interface SaveCardHtmlRequest {
  // htmlPath must be the exact path returned at generation time — recomputing it from
  // keyword+today's date would write a new dated file instead of overwriting the original
  // when editing happens on a different calendar day than generation.
  htmlPath: string
  html: string
}

export interface SaveCardHtmlResponseData {
  htmlPath: string
}

export interface EditCardWithInstructionRequest {
  htmlPath: string
  html: string
  instruction: string
}

export interface EditCardWithInstructionResponseData {
  html: string
}
