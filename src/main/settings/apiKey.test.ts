import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getApiKey, hasApiKey, saveApiKey, type SafeStorageLike } from './apiKey'

function createFakeSafeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) => Buffer.from(`enc:${plainText}`, 'utf-8'),
    decryptString: (encrypted: Buffer) => encrypted.toString('utf-8').replace(/^enc:/, '')
  }
}

describe('apiKey settings', () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'sns-settings-'))
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('returns null and false when no key has been saved', () => {
    expect(hasApiKey(userDataPath)).toBe(false)
    expect(getApiKey(userDataPath, createFakeSafeStorage())).toBeNull()
  })

  it('saves and retrieves an encrypted api key', () => {
    const safeStorage = createFakeSafeStorage()
    saveApiKey(userDataPath, 'sk-test-123', safeStorage)

    expect(hasApiKey(userDataPath)).toBe(true)
    expect(getApiKey(userDataPath, safeStorage)).toBe('sk-test-123')
  })

  it('overwrites a previously saved key', () => {
    const safeStorage = createFakeSafeStorage()
    saveApiKey(userDataPath, 'sk-old', safeStorage)
    saveApiKey(userDataPath, 'sk-new', safeStorage)

    expect(getApiKey(userDataPath, safeStorage)).toBe('sk-new')
  })

  it('returns null when decryption fails', () => {
    const safeStorage = createFakeSafeStorage()
    saveApiKey(userDataPath, 'sk-test-123', safeStorage)

    const brokenSafeStorage: SafeStorageLike = {
      isEncryptionAvailable: () => true,
      encryptString: safeStorage.encryptString,
      decryptString: () => {
        throw new Error('decryption failed')
      }
    }

    expect(getApiKey(userDataPath, brokenSafeStorage)).toBeNull()
  })

  it('throws when encryption is unavailable on this platform', () => {
    const unavailableSafeStorage: SafeStorageLike = {
      isEncryptionAvailable: () => false,
      encryptString: () => Buffer.from(''),
      decryptString: () => ''
    }

    expect(() => saveApiKey(userDataPath, 'sk-test', unavailableSafeStorage)).toThrow(
      '이 환경에서는 API 키를 안전하게 암호화할 수 없습니다'
    )
  })
})
