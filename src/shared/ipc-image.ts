export const IMAGE_RENDER_CHANNEL = 'image:render'

export interface RenderImageCardInput {
  index: number
  htmlPath: string
  html: string
}

export interface RenderCardsRequest {
  cards: RenderImageCardInput[]
}

export interface ImageRenderSuccess {
  status: 'success'
  index: number
  imagePath: string
}

export interface ImageRenderFailure {
  status: 'failure'
  index: number
  error: string
}

export type ImageRenderResult = ImageRenderSuccess | ImageRenderFailure

export interface RenderCardsResponseData {
  results: ImageRenderResult[]
}
