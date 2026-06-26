import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { extname, join } from 'path'

const MUSIC_STATE_FILE_NAME = 'music-state.json'
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg'])

interface MusicState {
  lastUsedTrack?: string
}

function getMusicStatePath(userDataPath: string): string {
  return join(userDataPath, MUSIC_STATE_FILE_NAME)
}

function readMusicState(userDataPath: string): MusicState {
  const statePath = getMusicStatePath(userDataPath)
  if (!existsSync(statePath)) return {}
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as MusicState
  } catch {
    return {}
  }
}

function writeMusicState(userDataPath: string, state: MusicState): void {
  writeFileSync(getMusicStatePath(userDataPath), JSON.stringify(state, null, 2), 'utf-8')
}

export function listMusicTracks(musicFolderPath: string): string[] {
  if (!existsSync(musicFolderPath)) return []
  return readdirSync(musicFolderPath)
    .filter((fileName) => AUDIO_EXTENSIONS.has(extname(fileName).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
}

export interface NextMusicTrack {
  trackPath: string
  trackFileName: string
}

// 상태 기록(commitMusicTrack)과 분리한 이유 — 영상 조립은 이 트랙을 실제로 오디오 믹스에
// 성공적으로 사용한 뒤에야 "이번 실행에 이 곡을 썼다"고 확정할 수 있다. 트랙을 고르는
// 시점에 곧바로 상태를 써버리면, 그 이후 단계(오디오 믹스 등)가 실패해도 로테이션은 이미
// 전진해 있어 다음 성공한 실행이 한 곡을 건너뛰게 된다.
export function peekNextMusicTrack(musicFolderPath: string, userDataPath: string): NextMusicTrack {
  const tracks = listMusicTracks(musicFolderPath)
  if (tracks.length === 0) {
    throw new Error('음악 폴더에 곡이 없습니다')
  }

  const state = readMusicState(userDataPath)
  const lastIndex = state.lastUsedTrack ? tracks.indexOf(state.lastUsedTrack) : -1
  const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % tracks.length
  const trackFileName = tracks[nextIndex]

  return { trackPath: join(musicFolderPath, trackFileName), trackFileName }
}

export function commitMusicTrack(userDataPath: string, trackFileName: string): void {
  writeMusicState(userDataPath, { lastUsedTrack: trackFileName })
}
