import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, request?: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../storage/card', () => ({
  overwriteCardHtmlFile: vi.fn()
}))

vi.mock('../storage/naming', () => ({
  getCardImagePathFromHtmlPath: vi.fn()
}))

vi.mock('../render/cardImage', () => ({
  renderCardHtmlToPng: vi.fn()
}))

import { IMAGE_RENDER_CHANNEL } from '../../shared/ipc-image'
import { renderCardHtmlToPng } from '../render/cardImage'
import { overwriteCardHtmlFile } from '../storage/card'
import { getCardImagePathFromHtmlPath } from '../storage/naming'
import { registerImageIpcHandlers } from './image'

describe('image IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetAllMocks()
    registerImageIpcHandlers()
  })

  it('returns an error when no cards are provided', async () => {
    const handler = handlers.get(IMAGE_RENDER_CHANNEL)!
    const result = (await handler(null, { cards: [] })) as {
      ok: boolean
      error?: { message: string }
    }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('렌더링할 카드가 없습니다')
    expect(renderCardHtmlToPng).not.toHaveBeenCalled()
  })

  it('persists the html, renders each card to its derived image path, and returns success results', async () => {
    vi.mocked(getCardImagePathFromHtmlPath).mockImplementation((htmlPath) =>
      htmlPath.replace('/html/', '/image/').replace('.html', '.png')
    )
    vi.mocked(renderCardHtmlToPng).mockResolvedValue(undefined)

    const handler = handlers.get(IMAGE_RENDER_CHANNEL)!
    const result = (await handler(null, {
      cards: [
        { index: 1, htmlPath: '/content/html/260101_haion_01.html', html: '<html>1</html>' },
        { index: 2, htmlPath: '/content/html/260101_haion_02.html', html: '<html>2</html>' }
      ]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      { status: 'success', index: 1, imagePath: '/content/image/260101_haion_01.png' },
      { status: 'success', index: 2, imagePath: '/content/image/260101_haion_02.png' }
    ])
    expect(overwriteCardHtmlFile).toHaveBeenCalledWith(
      '/content/html/260101_haion_01.html',
      '<html>1</html>'
    )
    expect(renderCardHtmlToPng).toHaveBeenCalledWith(
      '<html>1</html>',
      '/content/image/260101_haion_01.png'
    )
  })

  it('reports a per-card failure when rendering one card throws, without affecting others', async () => {
    vi.mocked(getCardImagePathFromHtmlPath).mockImplementation((htmlPath) =>
      htmlPath.replace('/html/', '/image/').replace('.html', '.png')
    )
    vi.mocked(renderCardHtmlToPng)
      .mockRejectedValueOnce(new Error('렌더링 시간 초과'))
      .mockResolvedValueOnce(undefined)

    const handler = handlers.get(IMAGE_RENDER_CHANNEL)!
    const result = (await handler(null, {
      cards: [
        { index: 1, htmlPath: '/content/html/260101_haion_01.html', html: '<html>1</html>' },
        { index: 2, htmlPath: '/content/html/260101_haion_02.html', html: '<html>2</html>' }
      ]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      { status: 'failure', index: 1, error: '렌더링 시간 초과' },
      { status: 'success', index: 2, imagePath: '/content/image/260101_haion_02.png' }
    ])
  })

  it('reports a per-card failure when deriving the image path throws', async () => {
    vi.mocked(getCardImagePathFromHtmlPath).mockImplementation(() => {
      throw new Error('예상한 카드 HTML 경로 형식이 아닙니다')
    })

    const handler = handlers.get(IMAGE_RENDER_CHANNEL)!
    const result = (await handler(null, {
      cards: [{ index: 1, htmlPath: '/content/01.html', html: '<html>1</html>' }]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      { status: 'failure', index: 1, error: '예상한 카드 HTML 경로 형식이 아닙니다' }
    ])
    expect(renderCardHtmlToPng).not.toHaveBeenCalled()
  })
})
