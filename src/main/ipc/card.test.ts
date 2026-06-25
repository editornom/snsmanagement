import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => '/fake/userData' },
  safeStorage: {
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf-8')
  },
  dialog: { showOpenDialog: vi.fn() },
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
  generateCardHtml: vi.fn()
}))

vi.mock('../storage/card', () => ({
  generateCard: vi.fn(),
  writeCardHtmlFile: vi.fn()
}))

import { dialog } from 'electron'
import {
  CARD_GENERATE_CHANNEL,
  CARD_REGENERATE_CHANNEL,
  CARD_SAVE_HTML_CHANNEL,
  CARD_SELECT_REFERENCE_IMAGES_CHANNEL
} from '../../shared/ipc-card'
import { getApiKey } from '../settings/apiKey'
import { generateCard, writeCardHtmlFile } from '../storage/card'
import { registerCardIpcHandlers } from './card'

describe('card IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerCardIpcHandlers()
  })

  it('reports truncation when more than 10 images are selected', async () => {
    const filePaths = Array.from({ length: 15 }, (_, i) => `/ref${i + 1}.png`)
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths })

    const handler = handlers.get(CARD_SELECT_REFERENCE_IMAGES_CHANNEL)!
    const result = (await handler(null)) as { paths: string[]; truncated: boolean }

    expect(result.paths).toHaveLength(10)
    expect(result.truncated).toBe(true)
  })

  it('does not report truncation when 10 or fewer images are selected', async () => {
    const filePaths = ['/ref1.png', '/ref2.png']
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths })

    const handler = handlers.get(CARD_SELECT_REFERENCE_IMAGES_CHANNEL)!
    const result = (await handler(null)) as { paths: string[]; truncated: boolean }

    expect(result.paths).toEqual(filePaths)
    expect(result.truncated).toBe(false)
  })

  it('returns an error when no API key is configured', async () => {
    vi.mocked(getApiKey).mockReturnValue(null)

    const handler = handlers.get(CARD_GENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePaths: ['/ref1.png']
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('Claude API 키를 먼저 설정해주세요')
    expect(generateCard).not.toHaveBeenCalled()
  })

  it('returns success for working images and per-card error for failing ones', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-test')
    vi.mocked(generateCard)
      .mockResolvedValueOnce({ htmlPath: '/content/html/01.html', html: '<html>1</html>' })
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockResolvedValueOnce({ htmlPath: '/content/html/03.html', html: '<html>3</html>' })

    const handler = handlers.get(CARD_GENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePaths: ['/ref1.png', '/ref2.png', '/ref3.png']
    })) as {
      ok: boolean
      data?: { cards: Array<{ index: number; error?: string; html?: string }> }
    }

    expect(result.ok).toBe(true)
    expect(result.data?.cards).toEqual([
      { status: 'success', index: 1, htmlPath: '/content/html/01.html', html: '<html>1</html>' },
      { status: 'failure', index: 2, error: 'rate limit exceeded' },
      { status: 'success', index: 3, htmlPath: '/content/html/03.html', html: '<html>3</html>' }
    ])
  })

  it('returns an error when contentFolderPath or keyword is missing', async () => {
    const handler = handlers.get(CARD_GENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '',
      keyword: 'haion',
      referenceImagePaths: ['/ref1.png']
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('폴더 또는 키워드 정보가 없습니다')
    expect(generateCard).not.toHaveBeenCalled()
  })

  it('returns an error when referenceImagePaths is empty', async () => {
    const handler = handlers.get(CARD_GENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePaths: []
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('참고이미지를 선택해주세요')
    expect(generateCard).not.toHaveBeenCalled()
  })

  it('caps reference images at 10 for generation', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-test')
    vi.mocked(generateCard).mockResolvedValue({ htmlPath: '/p.html', html: '<html></html>' })

    const referenceImagePaths = Array.from({ length: 15 }, (_, i) => `/ref${i + 1}.png`)
    const handler = handlers.get(CARD_GENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePaths
    })) as { ok: boolean; data?: { cards: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.cards).toHaveLength(10)
    expect(generateCard).toHaveBeenCalledTimes(10)
  })

  it('regenerates a single card without affecting others', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-test')
    vi.mocked(generateCard).mockResolvedValue({
      htmlPath: '/content/html/02.html',
      html: '<html>new</html>'
    })

    const handler = handlers.get(CARD_REGENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePath: '/ref2.png',
      index: 2
    })) as { ok: boolean; data?: { card: { index: number; htmlPath?: string } } }

    expect(result.ok).toBe(true)
    expect(result.data?.card).toEqual({
      status: 'success',
      index: 2,
      htmlPath: '/content/html/02.html',
      html: '<html>new</html>'
    })
    expect(generateCard).toHaveBeenCalledTimes(1)
  })

  it('returns an error when regenerate request is missing required fields', async () => {
    const handler = handlers.get(CARD_REGENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: '',
      referenceImagePath: '/ref2.png',
      index: 2
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('폴더 또는 키워드 정보가 없습니다')
    expect(generateCard).not.toHaveBeenCalled()
  })

  it('returns a failure card result when regeneration fails', async () => {
    vi.mocked(getApiKey).mockReturnValue('sk-test')
    vi.mocked(generateCard).mockRejectedValue(new Error('rate limit exceeded'))

    const handler = handlers.get(CARD_REGENERATE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      referenceImagePath: '/ref2.png',
      index: 2
    })) as { ok: boolean; data?: { card: { status: string; error?: string } } }

    expect(result.ok).toBe(true)
    expect(result.data?.card).toEqual({ status: 'failure', index: 2, error: 'rate limit exceeded' })
  })

  it('saves edited html without checking the API key', async () => {
    vi.mocked(writeCardHtmlFile).mockReturnValue({ htmlPath: '/content/html/01.html' })

    const handler = handlers.get(CARD_SAVE_HTML_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      index: 1,
      html: '<html>edited</html>'
    })) as { ok: boolean; data?: { htmlPath: string } }

    expect(result.ok).toBe(true)
    expect(result.data?.htmlPath).toBe('/content/html/01.html')
    expect(getApiKey).not.toHaveBeenCalled()
  })

  it('returns an error when save-html request is missing required fields', async () => {
    const handler = handlers.get(CARD_SAVE_HTML_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      index: 1,
      html: ''
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('저장할 폴더/키워드/HTML 정보가 없습니다')
    expect(writeCardHtmlFile).not.toHaveBeenCalled()
  })

  it('returns an error when writing the html file throws', async () => {
    vi.mocked(writeCardHtmlFile).mockImplementation(() => {
      throw new Error('disk full')
    })

    const handler = handlers.get(CARD_SAVE_HTML_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      index: 1,
      html: '<html>edited</html>'
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('disk full')
  })
})
