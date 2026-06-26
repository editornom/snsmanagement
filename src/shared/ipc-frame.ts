export const FRAME_CAPTURE_CHANNEL = 'frame:capture'

export interface CaptureFrameCardInput {
  index: number
  html: string
}

export interface CaptureFramesRequest {
  cards: CaptureFrameCardInput[]
}

export interface FrameCaptureSuccess {
  status: 'success'
  index: number
  frameDir: string
  frameCount: number
}

export interface FrameCaptureFailure {
  status: 'failure'
  index: number
  error: string
}

export type FrameCaptureResult = FrameCaptureSuccess | FrameCaptureFailure

export interface CaptureFramesResponseData {
  results: FrameCaptureResult[]
}
