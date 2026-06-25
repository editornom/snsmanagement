export const CARD_SELECT_REFERENCE_IMAGES_CHANNEL = 'card:select-reference-images'
export const CARD_GENERATE_CHANNEL = 'card:generate'
export const CARD_REGENERATE_CHANNEL = 'card:regenerate'
export const CARD_SAVE_HTML_CHANNEL = 'card:save-html'

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
  contentFolderPath: string
  keyword: string
  index: number
  html: string
}

export interface SaveCardHtmlResponseData {
  htmlPath: string
}
