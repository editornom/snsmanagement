import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  IpcResult,
  RegisterContentRequest,
  RegisterContentResponseData
} from '../shared/ipc-content'
import type {
  EditCardWithInstructionRequest,
  EditCardWithInstructionResponseData,
  GenerateCardsRequest,
  GenerateCardsResponseData,
  RegenerateCardRequest,
  RegenerateCardResponseData,
  SaveCardHtmlRequest,
  SaveCardHtmlResponseData,
  SelectReferenceImagesResult
} from '../shared/ipc-card'
import type {
  GetApiKeyStatusResponseData,
  SaveApiKeyRequest,
  SaveApiKeyResponseData
} from '../shared/ipc-settings'
import type { RenderCardsRequest, RenderCardsResponseData } from '../shared/ipc-image'
import type { CaptureFramesRequest, CaptureFramesResponseData } from '../shared/ipc-frame'
import type { AssembleVideoRequest, AssembleVideoResponseData } from '../shared/ipc-video'
import type {
  GenerateManuscriptRequest,
  GenerateManuscriptResponseData
} from '../shared/ipc-manuscript'

export interface Api {
  selectThumbnail: () => Promise<string | null>
  registerContent: (
    request: RegisterContentRequest
  ) => Promise<IpcResult<RegisterContentResponseData>>
  getApiKeyStatus: () => Promise<IpcResult<GetApiKeyStatusResponseData>>
  saveApiKey: (request: SaveApiKeyRequest) => Promise<IpcResult<SaveApiKeyResponseData>>
  selectReferenceImages: () => Promise<SelectReferenceImagesResult>
  generateCards: (request: GenerateCardsRequest) => Promise<IpcResult<GenerateCardsResponseData>>
  regenerateCard: (request: RegenerateCardRequest) => Promise<IpcResult<RegenerateCardResponseData>>
  saveCardHtml: (request: SaveCardHtmlRequest) => Promise<IpcResult<SaveCardHtmlResponseData>>
  editCardWithInstruction: (
    request: EditCardWithInstructionRequest
  ) => Promise<IpcResult<EditCardWithInstructionResponseData>>
  renderCardsToImages: (request: RenderCardsRequest) => Promise<IpcResult<RenderCardsResponseData>>
  captureCardFrames: (
    request: CaptureFramesRequest
  ) => Promise<IpcResult<CaptureFramesResponseData>>
  assembleVideo: (request: AssembleVideoRequest) => Promise<IpcResult<AssembleVideoResponseData>>
  generateManuscript: (
    request: GenerateManuscriptRequest
  ) => Promise<IpcResult<GenerateManuscriptResponseData>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
