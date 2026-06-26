import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runFfmpegMock = vi.fn(async (args: string[]) => {
  const outputPath = args[args.length - 1]
  writeFileSync(outputPath, 'fake-mp4-bytes')
})

vi.mock('./ffmpegRunner', () => ({
  runFfmpeg: (args: string[]) => runFfmpegMock(args)
}))

const peekNextMusicTrackMock = vi.fn()
const commitMusicTrackMock = vi.fn()

vi.mock('../storage/musicRotation', () => ({
  peekNextMusicTrack: (musicFolderPath: string, userDataPath: string) =>
    peekNextMusicTrackMock(musicFolderPath, userDataPath),
  commitMusicTrack: (userDataPath: string, trackFileName: string) =>
    commitMusicTrackMock(userDataPath, trackFileName)
}))

import { assembleVideo } from './videoAssembly'

describe('assembleVideo', () => {
  let root: string
  let thumbnailPath: string
  let cardFrameDirs: string[]
  let tempDir: string
  let outputVideoPath: string

  beforeEach(() => {
    runFfmpegMock.mockClear()
    peekNextMusicTrackMock.mockReset()
    commitMusicTrackMock.mockReset()
    peekNextMusicTrackMock.mockReturnValue({
      trackPath: 'C:\\music\\track.mp3',
      trackFileName: 'track.mp3'
    })

    root = mkdtempSync(join(tmpdir(), 'sns-video-test-'))
    thumbnailPath = join(root, 'thumbnail.png')
    writeFileSync(thumbnailPath, 'fake-png-bytes')

    cardFrameDirs = [join(root, 'frames-1'), join(root, 'frames-2')]
    for (const dir of cardFrameDirs) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'frame-00000.png'), 'fake-frame')
    }

    tempDir = join(root, 'video-build-temp')
    outputVideoPath = join(root, 'output', 'video', '260626_haion.mp4')
  })

  it('builds the thumbnail segment, then each card segment in order, then concatenates and mixes audio', async () => {
    await assembleVideo({
      thumbnailPath,
      cardFrameDirs,
      musicFolderPath: 'C:\\music',
      userDataPath: 'C:\\userdata',
      outputVideoPath,
      tempDir
    })

    const calls = runFfmpegMock.mock.calls.map((call) => call[0] as string[])

    // 1) 썸네일 세그먼트
    expect(calls[0]).toContain(thumbnailPath)
    expect(calls[0]).toContain(join(tempDir, 'segment-thumbnail.mp4'))

    // 2) 카드별 세그먼트 — 입력 순서 그대로(AC1)
    expect(calls[1]).toContain(join(cardFrameDirs[0], 'frame-%05d.png'))
    expect(calls[1]).toContain(join(tempDir, 'segment-card-0.mp4'))
    expect(calls[2]).toContain(join(cardFrameDirs[1], 'frame-%05d.png'))
    expect(calls[2]).toContain(join(tempDir, 'segment-card-1.mp4'))

    // 3) concat
    expect(calls[3]).toContain(join(tempDir, 'concat-filelist.txt'))
    expect(calls[3]).toContain(join(tempDir, 'concatenated.mp4'))

    // 4) 오디오 믹스 — 로테이션으로 선택된 트랙 사용
    expect(calls[4]).toContain(join(tempDir, 'concatenated.mp4'))
    expect(calls[4]).toContain('C:\\music\\track.mp3')

    expect(peekNextMusicTrackMock).toHaveBeenCalledWith('C:\\music', 'C:\\userdata')
    // 로테이션 상태는 오디오 믹스가 실제로 성공한 뒤에만 커밋된다.
    expect(commitMusicTrackMock).toHaveBeenCalledWith('C:\\userdata', 'track.mp3')
    expect(existsSync(outputVideoPath)).toBe(true)
  })

  it('deletes the card frame directories and the temp build directory after success (AC1)', async () => {
    await assembleVideo({
      thumbnailPath,
      cardFrameDirs,
      musicFolderPath: 'C:\\music',
      userDataPath: 'C:\\userdata',
      outputVideoPath,
      tempDir
    })

    expect(existsSync(cardFrameDirs[0])).toBe(false)
    expect(existsSync(cardFrameDirs[1])).toBe(false)
    expect(existsSync(tempDir)).toBe(false)
  })

  it('does not delete anything when a segment build fails partway through', async () => {
    runFfmpegMock.mockImplementationOnce(async (args: string[]) => {
      const outputPath = args[args.length - 1]
      writeFileSync(outputPath, 'fake-mp4-bytes')
    })
    runFfmpegMock.mockImplementationOnce(async () => {
      throw new Error('카드 세그먼트 인코딩 실패')
    })

    await expect(
      assembleVideo({
        thumbnailPath,
        cardFrameDirs,
        musicFolderPath: 'C:\\music',
        userDataPath: 'C:\\userdata',
        outputVideoPath,
        tempDir
      })
    ).rejects.toThrow('카드 세그먼트 인코딩 실패')

    expect(existsSync(cardFrameDirs[0])).toBe(true)
    expect(existsSync(cardFrameDirs[1])).toBe(true)
    expect(existsSync(outputVideoPath)).toBe(false)
  })

  it('propagates the error from peekNextMusicTrack (e.g. empty music folder) without deleting frame dirs', async () => {
    peekNextMusicTrackMock.mockImplementation(() => {
      throw new Error('음악 폴더에 곡이 없습니다')
    })

    await expect(
      assembleVideo({
        thumbnailPath,
        cardFrameDirs,
        musicFolderPath: 'C:\\music',
        userDataPath: 'C:\\userdata',
        outputVideoPath,
        tempDir
      })
    ).rejects.toThrow('음악 폴더에 곡이 없습니다')

    expect(existsSync(cardFrameDirs[0])).toBe(true)
    expect(commitMusicTrackMock).not.toHaveBeenCalled()
  })

  it('does not commit the music rotation state when audio mixing fails (regression: rotation must not advance for a video that was never produced)', async () => {
    runFfmpegMock
      .mockImplementationOnce(async (args: string[]) => {
        writeFileSync(args[args.length - 1], 'fake-mp4-bytes')
      })
      .mockImplementationOnce(async (args: string[]) => {
        writeFileSync(args[args.length - 1], 'fake-mp4-bytes')
      })
      .mockImplementationOnce(async (args: string[]) => {
        writeFileSync(args[args.length - 1], 'fake-mp4-bytes')
      })
      .mockImplementationOnce(async (args: string[]) => {
        writeFileSync(args[args.length - 1], 'fake-mp4-bytes')
      })
      .mockImplementationOnce(async () => {
        throw new Error('오디오 믹스 실패')
      })

    await expect(
      assembleVideo({
        thumbnailPath,
        cardFrameDirs,
        musicFolderPath: 'C:\\music',
        userDataPath: 'C:\\userdata',
        outputVideoPath,
        tempDir
      })
    ).rejects.toThrow('오디오 믹스 실패')

    expect(commitMusicTrackMock).not.toHaveBeenCalled()
    expect(existsSync(outputVideoPath)).toBe(false)
  })
})
