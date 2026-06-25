export const SETTINGS_GET_API_KEY_STATUS_CHANNEL = 'settings:get-api-key-status'
export const SETTINGS_SAVE_API_KEY_CHANNEL = 'settings:save-api-key'

export interface GetApiKeyStatusResponseData {
  hasApiKey: boolean
}

export interface SaveApiKeyRequest {
  apiKey: string
}

export type SaveApiKeyResponseData = Record<string, never>
