import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  IpcResult,
  RegisterContentRequest,
  RegisterContentResponseData
} from '../shared/ipc-content'

export interface ContentApi {
  selectThumbnail: () => Promise<string | null>
  registerContent: (
    request: RegisterContentRequest
  ) => Promise<IpcResult<RegisterContentResponseData>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ContentApi
  }
}
