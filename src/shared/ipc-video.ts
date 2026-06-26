export const VIDEO_ASSEMBLE_CHANNEL = 'video:assemble'

export interface AssembleVideoCardInput {
  index: number
  frameDir: string
}

export interface AssembleVideoRequest {
  contentFolderPath: string
  keyword: string
  cards: AssembleVideoCardInput[]
}

export interface AssembleVideoResponseData {
  videoPath: string
}
