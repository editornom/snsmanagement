export const MANUSCRIPT_GENERATE_CHANNEL = 'manuscript:generate'

export interface GenerateManuscriptCardInput {
  index: number
  htmlPath: string
  html: string
}

export interface GenerateManuscriptRequest {
  contentFolderPath: string
  cards: GenerateManuscriptCardInput[]
}

export interface GenerateManuscriptResponseData {
  manuscript: string
  manuscriptPath: string
  homepageUrlMissing: boolean
}
