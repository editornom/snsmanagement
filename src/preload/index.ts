import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  CONTENT_REGISTER_CHANNEL,
  CONTENT_SELECT_THUMBNAIL_CHANNEL,
  type IpcResult,
  type RegisterContentRequest,
  type RegisterContentResponseData
} from '../shared/ipc-content'

// Custom APIs for renderer
const api = {
  selectThumbnail: (): Promise<string | null> =>
    ipcRenderer.invoke(CONTENT_SELECT_THUMBNAIL_CHANNEL),
  registerContent: (
    request: RegisterContentRequest
  ): Promise<IpcResult<RegisterContentResponseData>> =>
    ipcRenderer.invoke(CONTENT_REGISTER_CHANNEL, request)
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
