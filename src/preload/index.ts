import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  CONTENT_REGISTER_CHANNEL,
  CONTENT_SELECT_THUMBNAIL_CHANNEL,
  type IpcResult,
  type RegisterContentRequest,
  type RegisterContentResponseData
} from '../shared/ipc-content'
import {
  CARD_EDIT_WITH_INSTRUCTION_CHANNEL,
  CARD_GENERATE_CHANNEL,
  CARD_REGENERATE_CHANNEL,
  CARD_SAVE_HTML_CHANNEL,
  CARD_SELECT_REFERENCE_IMAGES_CHANNEL,
  type EditCardWithInstructionRequest,
  type EditCardWithInstructionResponseData,
  type GenerateCardsRequest,
  type GenerateCardsResponseData,
  type RegenerateCardRequest,
  type RegenerateCardResponseData,
  type SaveCardHtmlRequest,
  type SaveCardHtmlResponseData,
  type SelectReferenceImagesResult
} from '../shared/ipc-card'
import {
  SETTINGS_GET_API_KEY_STATUS_CHANNEL,
  SETTINGS_SAVE_API_KEY_CHANNEL,
  type GetApiKeyStatusResponseData,
  type SaveApiKeyRequest,
  type SaveApiKeyResponseData
} from '../shared/ipc-settings'
import {
  IMAGE_RENDER_CHANNEL,
  type RenderCardsRequest,
  type RenderCardsResponseData
} from '../shared/ipc-image'
import {
  FRAME_CAPTURE_CHANNEL,
  type CaptureFramesRequest,
  type CaptureFramesResponseData
} from '../shared/ipc-frame'
import {
  VIDEO_ASSEMBLE_CHANNEL,
  type AssembleVideoRequest,
  type AssembleVideoResponseData
} from '../shared/ipc-video'
import {
  MANUSCRIPT_GENERATE_CHANNEL,
  type GenerateManuscriptRequest,
  type GenerateManuscriptResponseData
} from '../shared/ipc-manuscript'

// Custom APIs for renderer
const api = {
  selectThumbnail: (): Promise<string | null> =>
    ipcRenderer.invoke(CONTENT_SELECT_THUMBNAIL_CHANNEL),
  registerContent: (
    request: RegisterContentRequest
  ): Promise<IpcResult<RegisterContentResponseData>> =>
    ipcRenderer.invoke(CONTENT_REGISTER_CHANNEL, request),
  getApiKeyStatus: (): Promise<IpcResult<GetApiKeyStatusResponseData>> =>
    ipcRenderer.invoke(SETTINGS_GET_API_KEY_STATUS_CHANNEL),
  saveApiKey: (request: SaveApiKeyRequest): Promise<IpcResult<SaveApiKeyResponseData>> =>
    ipcRenderer.invoke(SETTINGS_SAVE_API_KEY_CHANNEL, request),
  selectReferenceImages: (): Promise<SelectReferenceImagesResult> =>
    ipcRenderer.invoke(CARD_SELECT_REFERENCE_IMAGES_CHANNEL),
  generateCards: (request: GenerateCardsRequest): Promise<IpcResult<GenerateCardsResponseData>> =>
    ipcRenderer.invoke(CARD_GENERATE_CHANNEL, request),
  regenerateCard: (
    request: RegenerateCardRequest
  ): Promise<IpcResult<RegenerateCardResponseData>> =>
    ipcRenderer.invoke(CARD_REGENERATE_CHANNEL, request),
  saveCardHtml: (request: SaveCardHtmlRequest): Promise<IpcResult<SaveCardHtmlResponseData>> =>
    ipcRenderer.invoke(CARD_SAVE_HTML_CHANNEL, request),
  editCardWithInstruction: (
    request: EditCardWithInstructionRequest
  ): Promise<IpcResult<EditCardWithInstructionResponseData>> =>
    ipcRenderer.invoke(CARD_EDIT_WITH_INSTRUCTION_CHANNEL, request),
  renderCardsToImages: (request: RenderCardsRequest): Promise<IpcResult<RenderCardsResponseData>> =>
    ipcRenderer.invoke(IMAGE_RENDER_CHANNEL, request),
  captureCardFrames: (
    request: CaptureFramesRequest
  ): Promise<IpcResult<CaptureFramesResponseData>> =>
    ipcRenderer.invoke(FRAME_CAPTURE_CHANNEL, request),
  assembleVideo: (request: AssembleVideoRequest): Promise<IpcResult<AssembleVideoResponseData>> =>
    ipcRenderer.invoke(VIDEO_ASSEMBLE_CHANNEL, request),
  generateManuscript: (
    request: GenerateManuscriptRequest
  ): Promise<IpcResult<GenerateManuscriptResponseData>> =>
    ipcRenderer.invoke(MANUSCRIPT_GENERATE_CHANNEL, request)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
