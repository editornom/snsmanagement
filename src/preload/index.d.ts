import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  IpcResult,
  RegisterContentRequest,
  RegisterContentResponseData
} from '../shared/ipc-content'
import type {
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
