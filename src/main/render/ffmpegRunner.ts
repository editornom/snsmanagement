import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

// child_process.spawn은 Electron의 asar 가상 파일시스템을 거치지 않는 OS 레벨 실행이라,
// asarUnpack으로 실제 바이너리가 app.asar.unpacked/에 있어도 ffmpeg-static이 돌려주는 경로
// 문자열은 여전히 app.asar/ 내부를 가리킨다 — 패키징된 앱에서 spawn ENOENT로 실패한다
// (실측으로 확인됨). 패키징 환경에서만 app.asar를 app.asar.unpacked로 치환해 보정한다.
function resolveSpawnablePath(rawPath: string): string {
  return rawPath.replace('app.asar', 'app.asar.unpacked')
}

export function runFfmpeg(args: string[]): Promise<void> {
  const resolvedFfmpegPath = ffmpegPath
  if (!resolvedFfmpegPath) {
    return Promise.reject(new Error('이 플랫폼에서는 ffmpeg 바이너리를 찾을 수 없습니다'))
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(resolveSpawnablePath(resolvedFfmpegPath), args)
    let stderr = ''

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    ffmpeg.on('error', (error) => {
      reject(error)
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      const tail = stderr.slice(-1000)
      reject(new Error(`ffmpeg가 코드 ${code}로 종료되었습니다: ${tail}`))
    })
  })
}
