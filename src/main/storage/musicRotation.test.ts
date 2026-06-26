import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { commitMusicTrack, listMusicTracks, peekNextMusicTrack } from './musicRotation'

describe('listMusicTracks', () => {
  let musicFolderPath: string

  beforeEach(() => {
    musicFolderPath = mkdtempSync(join(tmpdir(), 'sns-music-test-'))
  })

  it('returns an empty array when the folder does not exist', () => {
    expect(listMusicTracks(join(musicFolderPath, 'missing'))).toEqual([])
  })

  it('filters to known audio extensions and sorts alphabetically', () => {
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')
    writeFileSync(join(musicFolderPath, 'a.wav'), '')
    writeFileSync(join(musicFolderPath, 'desktop.ini'), '')
    writeFileSync(join(musicFolderPath, 'notes.txt'), '')

    expect(listMusicTracks(musicFolderPath)).toEqual(['a.wav', 'b.mp3'])
  })
})

describe('peekNextMusicTrack / commitMusicTrack', () => {
  let musicFolderPath: string
  let userDataPath: string

  beforeEach(() => {
    musicFolderPath = mkdtempSync(join(tmpdir(), 'sns-music-test-'))
    userDataPath = mkdtempSync(join(tmpdir(), 'sns-userdata-test-'))
  })

  it('picks the first track (alphabetically) on the first run', () => {
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')

    const { trackPath, trackFileName } = peekNextMusicTrack(musicFolderPath, userDataPath)
    expect(trackPath).toBe(join(musicFolderPath, 'a.mp3'))
    expect(trackFileName).toBe('a.mp3')
  })

  it('does not write any state by itself — peeking has no side effects', () => {
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')

    peekNextMusicTrack(musicFolderPath, userDataPath)

    expect(existsSync(join(userDataPath, 'music-state.json'))).toBe(false)
  })

  it('rotates through three tracks in order across repeated peek+commit calls', () => {
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')
    writeFileSync(join(musicFolderPath, 'c.mp3'), '')

    function peekAndCommit(): string {
      const { trackPath, trackFileName } = peekNextMusicTrack(musicFolderPath, userDataPath)
      commitMusicTrack(userDataPath, trackFileName)
      return trackPath
    }

    expect(peekAndCommit()).toBe(join(musicFolderPath, 'a.mp3'))
    expect(peekAndCommit()).toBe(join(musicFolderPath, 'b.mp3'))
    expect(peekAndCommit()).toBe(join(musicFolderPath, 'c.mp3'))
    // 한 바퀴 돌면 처음 곡으로 순환한다.
    expect(peekAndCommit()).toBe(join(musicFolderPath, 'a.mp3'))
  })

  it('always returns the same track when only one track exists (AC2)', () => {
    writeFileSync(join(musicFolderPath, 'only.mp3'), '')

    const first = peekNextMusicTrack(musicFolderPath, userDataPath)
    commitMusicTrack(userDataPath, first.trackFileName)
    const second = peekNextMusicTrack(musicFolderPath, userDataPath)

    expect(first.trackPath).toBe(join(musicFolderPath, 'only.mp3'))
    expect(second.trackPath).toBe(join(musicFolderPath, 'only.mp3'))
  })

  it('falls back to index 0 when the last used track was removed from the folder', () => {
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')
    writeFileSync(
      join(userDataPath, 'music-state.json'),
      JSON.stringify({ lastUsedTrack: 'deleted.mp3' })
    )

    expect(peekNextMusicTrack(musicFolderPath, userDataPath).trackPath).toBe(
      join(musicFolderPath, 'a.mp3')
    )
  })

  it('commitMusicTrack persists the chosen track as lastUsedTrack', () => {
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')

    commitMusicTrack(userDataPath, 'a.mp3')

    const statePath = join(userDataPath, 'music-state.json')
    expect(existsSync(statePath)).toBe(true)
    expect(JSON.parse(readFileSync(statePath, 'utf-8'))).toEqual({ lastUsedTrack: 'a.mp3' })
  })

  it('does not advance rotation when a commit is skipped (simulating a failed assembly)', () => {
    writeFileSync(join(musicFolderPath, 'a.mp3'), '')
    writeFileSync(join(musicFolderPath, 'b.mp3'), '')

    // 1번째 시도: a를 골랐지만 commit하지 않음(오디오 믹스 실패를 가정).
    const attempt1 = peekNextMusicTrack(musicFolderPath, userDataPath)
    expect(attempt1.trackFileName).toBe('a.mp3')

    // 재시도해도 여전히 a가 선택돼야 한다 — 실패한 시도가 로테이션을 전진시키지 않았다.
    const attempt2 = peekNextMusicTrack(musicFolderPath, userDataPath)
    expect(attempt2.trackFileName).toBe('a.mp3')
  })

  it('throws when the music folder has no tracks', () => {
    expect(() => peekNextMusicTrack(musicFolderPath, userDataPath)).toThrow(
      '음악 폴더에 곡이 없습니다'
    )
  })
})
