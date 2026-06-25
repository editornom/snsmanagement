import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE_NAME = 'settings.json'

interface SettingsFile {
  apiKeyEncrypted?: string
}

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

function getSettingsPath(userDataPath: string): string {
  return join(userDataPath, SETTINGS_FILE_NAME)
}

function readSettings(userDataPath: string): SettingsFile {
  const settingsPath = getSettingsPath(userDataPath)
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf-8')) as SettingsFile
  } catch {
    return {}
  }
}

export function saveApiKey(
  userDataPath: string,
  apiKey: string,
  safeStorage: SafeStorageLike
): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('이 환경에서는 API 키를 안전하게 암호화할 수 없습니다')
  }

  const encrypted = safeStorage.encryptString(apiKey)
  const settings: SettingsFile = {
    ...readSettings(userDataPath),
    apiKeyEncrypted: encrypted.toString('base64')
  }
  writeFileSync(getSettingsPath(userDataPath), JSON.stringify(settings, null, 2), 'utf-8')
}

export function getApiKey(userDataPath: string, safeStorage: SafeStorageLike): string | null {
  const settings = readSettings(userDataPath)
  if (!settings.apiKeyEncrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(settings.apiKeyEncrypted, 'base64'))
  } catch {
    return null
  }
}

export function hasApiKey(userDataPath: string): boolean {
  return Boolean(readSettings(userDataPath).apiKeyEncrypted)
}
