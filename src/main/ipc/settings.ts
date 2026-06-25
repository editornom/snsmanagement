import { app, ipcMain, safeStorage } from 'electron'
import {
  SETTINGS_GET_API_KEY_STATUS_CHANNEL,
  SETTINGS_SAVE_API_KEY_CHANNEL,
  type GetApiKeyStatusResponseData,
  type SaveApiKeyRequest,
  type SaveApiKeyResponseData
} from '../../shared/ipc-settings'
import type { IpcResult } from '../../shared/ipc-content'
import { hasApiKey, saveApiKey } from '../settings/apiKey'

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(
    SETTINGS_GET_API_KEY_STATUS_CHANNEL,
    (): IpcResult<GetApiKeyStatusResponseData> => {
      return { ok: true, data: { hasApiKey: hasApiKey(app.getPath('userData')) } }
    }
  )

  ipcMain.handle(
    SETTINGS_SAVE_API_KEY_CHANNEL,
    (_event, request: SaveApiKeyRequest): IpcResult<SaveApiKeyResponseData> => {
      if (!request.apiKey?.trim()) {
        return { ok: false, error: { message: 'API 키를 입력해주세요' } }
      }

      try {
        saveApiKey(app.getPath('userData'), request.apiKey.trim(), safeStorage)
        return { ok: true, data: {} }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'API 키 저장 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )
}
