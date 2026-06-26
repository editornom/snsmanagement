import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' },
  safeStorage: {
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf-8')
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, request?: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../settings/apiKey', () => ({
  getApiKey: vi.fn()
}))

vi.mock('../api/claude', () => ({
  createClaudeClient: vi.fn(() => ({})),
  generateManuscript: vi.fn()
}))

vi.mock('../storage/manuscript', () => ({
  generateManuscriptDocument: vi.fn()
}))

import { MANUSCRIPT_GENERATE_CHANNEL } from '../../shared/ipc-manuscript'
import { getApiKey } from '../settings/apiKey'
import { generateManuscriptDocument } from '../storage/manuscript'
import { registerManuscriptIpcHandlers } from './manuscript'

describe('manuscript IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetAllMocks()
    registerManuscriptIpcHandlers()
  })

  function getHandler(): (event: unknown, request?: unknown) => unknown {
    return handlers.get(MANUSCRIPT_GENERATE_CHANNEL)!
  }

  it('returns an error when contentFolderPath is missing', async () => {
    const result = (await getHandler()(null, {
      contentFolderPath: '',
      cards: [{ index: 1, htmlPath: '/content/html/1.html', html: '<html></html>' }]
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('폴더 정보가 없습니다')
    expect(generateManuscriptDocument).not.toHaveBeenCalled()
  })

  it('returns an error when no cards are provided', async () => {
    const result = (await getHandler()(null, { contentFolderPath: '/content', cards: [] })) as {
      ok: boolean
      error?: { message: string }
    }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('원고를 생성할 카드가 없습니다')
    expect(generateManuscriptDocument).not.toHaveBeenCalled()
  })

  it('returns an error when the API key is missing', async () => {
    vi.mocked(getApiKey).mockReturnValue(null)

    const result = (await getHandler()(null, {
      contentFolderPath: '/content',
      cards: [{ index: 1, htmlPath: '/content/html/1.html', html: '<html></html>' }]
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('Claude API 키를 먼저 설정해주세요')
    expect(generateManuscriptDocument).not.toHaveBeenCalled()
  })

  it('returns the generated manuscript on success', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-ant-fake')
    vi.mocked(generateManuscriptDocument).mockResolvedValue({
      manuscript: '원고 내용',
      manuscriptPath: '/content/원고.txt',
      homepageUrlMissing: false
    })

    const result = (await getHandler()(null, {
      contentFolderPath: '/content',
      cards: [{ index: 1, htmlPath: '/content/html/1.html', html: '<html></html>' }]
    })) as {
      ok: boolean
      data?: { manuscript: string; manuscriptPath: string; homepageUrlMissing: boolean }
    }

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      manuscript: '원고 내용',
      manuscriptPath: '/content/원고.txt',
      homepageUrlMissing: false
    })
  })

  it('returns an error envelope when generateManuscriptDocument throws', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-ant-fake')
    vi.mocked(generateManuscriptDocument).mockRejectedValue(
      new Error('다음 카드의 이미지가 아직 렌더링되지 않았습니다: 2')
    )

    const result = (await getHandler()(null, {
      contentFolderPath: '/content',
      cards: [{ index: 2, htmlPath: '/content/html/2.html', html: '<html></html>' }]
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('다음 카드의 이미지가 아직 렌더링되지 않았습니다: 2')
  })
})
