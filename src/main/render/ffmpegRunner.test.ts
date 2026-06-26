import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}))

vi.mock('ffmpeg-static', () => ({
  default: '/fake/ffmpeg.exe'
}))

import { runFfmpeg } from './ffmpegRunner'

class FakeChildProcess extends EventEmitter {
  stderr = new EventEmitter()
}

describe('runFfmpeg', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  it('resolves when ffmpeg exits with code 0', async () => {
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    const promise = runFfmpeg(['-y', '-i', 'in.png', 'out.mp4'])
    child.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
    expect(spawnMock).toHaveBeenCalledWith('/fake/ffmpeg.exe', ['-y', '-i', 'in.png', 'out.mp4'])
  })

  it('rejects with the captured stderr tail when ffmpeg exits with a non-zero code', async () => {
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    const promise = runFfmpeg(['-y'])
    child.stderr.emit('data', Buffer.from('인코딩 실패: 잘못된 입력'))
    child.emit('close', 1)

    await expect(promise).rejects.toThrow(/인코딩 실패: 잘못된 입력/)
  })

  it('rejects when the spawned process emits an error', async () => {
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    const promise = runFfmpeg(['-y'])
    const spawnError = new Error('ENOENT')
    child.emit('error', spawnError)

    await expect(promise).rejects.toBe(spawnError)
  })
})

describe('runFfmpeg with a packaged (asar) ffmpeg-static path', () => {
  it('rewrites app.asar to app.asar.unpacked before spawning, since spawn bypasses the asar virtual filesystem', async () => {
    vi.resetModules()
    vi.doMock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }))
    vi.doMock('ffmpeg-static', () => ({
      default: 'C:\\app\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe'
    }))
    spawnMock.mockReset()

    const { runFfmpeg: runFfmpegWithAsarPath } = await import('./ffmpegRunner')
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    const promise = runFfmpegWithAsarPath(['-y'])
    child.emit('close', 0)
    await promise

    expect(spawnMock).toHaveBeenCalledWith(
      'C:\\app\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe',
      ['-y']
    )

    vi.doUnmock('ffmpeg-static')
    vi.doUnmock('child_process')
    vi.resetModules()
  })
})
