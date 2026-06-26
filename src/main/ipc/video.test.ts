import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (event: unknown, request?: unknown) => unknown>()

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => `/fake/${name}`
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, request?: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))

vi.mock('../storage/content', () => ({
  findThumbnailPath: vi.fn()
}))

vi.mock('../storage/naming', () => ({
  getMusicFolderPath: vi.fn(),
  getVideoPath: vi.fn()
}))

vi.mock('../render/videoAssembly', () => ({
  assembleVideo: vi.fn()
}))

import { VIDEO_ASSEMBLE_CHANNEL } from '../../shared/ipc-video'
import { findThumbnailPath } from '../storage/content'
import { getMusicFolderPath, getVideoPath } from '../storage/naming'
import { assembleVideo } from '../render/videoAssembly'
import { registerVideoIpcHandlers } from './video'

describe('video IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetAllMocks()
    registerVideoIpcHandlers()
  })

  it('returns an error when no cards are provided', async () => {
    const handler = handlers.get(VIDEO_ASSEMBLE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      cards: []
    })) as {
      ok: boolean
      error?: { message: string }
    }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('영상에 포함할 카드가 없습니다')
    expect(assembleVideo).not.toHaveBeenCalled()
  })

  it('resolves the thumbnail and video path, sorts cards by index, and assembles the video', async () => {
    vi.mocked(findThumbnailPath).mockReturnValue('/content/thumbnail.png')
    vi.mocked(getVideoPath).mockReturnValue('/content/video/260626_haion.mp4')
    vi.mocked(getMusicFolderPath).mockReturnValue('/fake/documents/SNS콘텐츠제작도구/music')
    vi.mocked(assembleVideo).mockResolvedValue(undefined)

    const handler = handlers.get(VIDEO_ASSEMBLE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      cards: [
        { index: 2, frameDir: '/tmp/frames-2' },
        { index: 1, frameDir: '/tmp/frames-1' }
      ]
    })) as { ok: boolean; data?: { videoPath: string } }

    expect(result.ok).toBe(true)
    expect(result.data?.videoPath).toBe('/content/video/260626_haion.mp4')
    expect(assembleVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailPath: '/content/thumbnail.png',
        cardFrameDirs: ['/tmp/frames-1', '/tmp/frames-2'],
        musicFolderPath: '/fake/documents/SNS콘텐츠제작도구/music',
        userDataPath: '/fake/userData',
        outputVideoPath: '/content/video/260626_haion.mp4'
      })
    )
  })

  it('returns an error envelope when assembleVideo throws (e.g. empty music folder)', async () => {
    vi.mocked(findThumbnailPath).mockReturnValue('/content/thumbnail.png')
    vi.mocked(getVideoPath).mockReturnValue('/content/video/260626_haion.mp4')
    vi.mocked(getMusicFolderPath).mockReturnValue('/fake/documents/SNS콘텐츠제작도구/music')
    vi.mocked(assembleVideo).mockRejectedValue(new Error('음악 폴더에 곡이 없습니다'))

    const handler = handlers.get(VIDEO_ASSEMBLE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      cards: [{ index: 1, frameDir: '/tmp/frames-1' }]
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('음악 폴더에 곡이 없습니다')
  })

  it('returns an error envelope when findThumbnailPath throws', async () => {
    vi.mocked(findThumbnailPath).mockImplementation(() => {
      throw new Error('썸네일 파일을 찾을 수 없습니다')
    })

    const handler = handlers.get(VIDEO_ASSEMBLE_CHANNEL)!
    const result = (await handler(null, {
      contentFolderPath: '/content',
      keyword: 'haion',
      cards: [{ index: 1, frameDir: '/tmp/frames-1' }]
    })) as { ok: boolean; error?: { message: string } }

    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('썸네일 파일을 찾을 수 없습니다')
    expect(assembleVideo).not.toHaveBeenCalled()
  })
})
