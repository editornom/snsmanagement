import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>()

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp'
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, request?: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../render/cardAnimation', () => ({
  injectEntryAnimation: vi.fn()
}))

vi.mock('../render/frameCapture', () => ({
  captureCardFrames: vi.fn(),
  getCardFrameDirPath: vi.fn()
}))

import { FRAME_CAPTURE_CHANNEL } from '../../shared/ipc-frame'
import { injectEntryAnimation } from '../render/cardAnimation'
import { captureCardFrames, getCardFrameDirPath } from '../render/frameCapture'
import { registerFrameIpcHandlers } from './frame'

describe('frame IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetAllMocks()
    registerFrameIpcHandlers()
  })

  it('returns an error when no cards are provided', async () => {
    const handler = handlers.get(FRAME_CAPTURE_CHANNEL)!
    const result = (await handler(null, { cards: [] })) as {
      ok: boolean
      error?: { message: string }
    }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('프레임캡처할 카드가 없습니다')
    expect(captureCardFrames).not.toHaveBeenCalled()
  })

  it('injects the animation, captures frames per card, and returns success results', async () => {
    vi.mocked(injectEntryAnimation).mockImplementation((html) => ({
      html: `${html}<injected/>`,
      entryDurationMs: 660
    }))
    vi.mocked(getCardFrameDirPath).mockImplementation(
      (tempRoot, index) =>
        `${tempRoot}/sns-content-tool-frames/card-${String(index).padStart(2, '0')}`
    )
    vi.mocked(captureCardFrames).mockResolvedValue({ frameCount: 220 })

    const handler = handlers.get(FRAME_CAPTURE_CHANNEL)!
    const result = (await handler(null, {
      cards: [
        { index: 1, html: '<html>1</html>' },
        { index: 2, html: '<html>2</html>' }
      ]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      {
        status: 'success',
        index: 1,
        frameDir: '/tmp/sns-content-tool-frames/card-01',
        frameCount: 220
      },
      {
        status: 'success',
        index: 2,
        frameDir: '/tmp/sns-content-tool-frames/card-02',
        frameCount: 220
      }
    ])
    expect(captureCardFrames).toHaveBeenCalledWith(
      '<html>1</html><injected/>',
      660,
      '/tmp/sns-content-tool-frames/card-01'
    )
  })

  it('reports a per-card failure when frame capture throws, without affecting others', async () => {
    vi.mocked(injectEntryAnimation).mockImplementation((html) => ({ html, entryDurationMs: 580 }))
    vi.mocked(getCardFrameDirPath).mockImplementation((_tempRoot, index) => `/tmp/card-${index}`)
    vi.mocked(captureCardFrames)
      .mockRejectedValueOnce(new Error('캡처 시간 초과'))
      .mockResolvedValueOnce({ frameCount: 100 })

    const handler = handlers.get(FRAME_CAPTURE_CHANNEL)!
    const result = (await handler(null, {
      cards: [
        { index: 1, html: '<html>1</html>' },
        { index: 2, html: '<html>2</html>' }
      ]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      { status: 'failure', index: 1, error: '캡처 시간 초과' },
      { status: 'success', index: 2, frameDir: '/tmp/card-2', frameCount: 100 }
    ])
  })

  it('reports a per-card failure when animation injection throws', async () => {
    vi.mocked(injectEntryAnimation).mockImplementation(() => {
      throw new Error('애니메이션 주입 실패')
    })

    const handler = handlers.get(FRAME_CAPTURE_CHANNEL)!
    const result = (await handler(null, {
      cards: [{ index: 1, html: '<html>1</html>' }]
    })) as { ok: boolean; data?: { results: unknown[] } }

    expect(result.ok).toBe(true)
    expect(result.data?.results).toEqual([
      { status: 'failure', index: 1, error: '애니메이션 주입 실패' }
    ])
    expect(captureCardFrames).not.toHaveBeenCalled()
  })
})
