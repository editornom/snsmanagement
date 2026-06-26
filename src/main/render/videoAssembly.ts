import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { runFfmpeg } from './ffmpegRunner'
import { commitMusicTrack, peekNextMusicTrack } from '../storage/musicRotation'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const FRAME_RATE = 60
const THUMBNAIL_DURATION_SEC = 5

export async function buildThumbnailSegment(
  thumbnailPath: string,
  outputPath: string
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-loop',
    '1',
    '-framerate',
    String(FRAME_RATE),
    '-t',
    String(THUMBNAIL_DURATION_SEC),
    '-i',
    thumbnailPath,
    '-vf',
    `scale=${CARD_WIDTH}:${CARD_HEIGHT}:force_original_aspect_ratio=decrease,pad=${CARD_WIDTH}:${CARD_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=white`,
    '-pix_fmt',
    'yuv420p',
    outputPath
  ])
}

export async function buildFrameSequenceSegment(
  frameDir: string,
  outputPath: string
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-framerate',
    String(FRAME_RATE),
    '-i',
    join(frameDir, 'frame-%05d.png'),
    '-pix_fmt',
    'yuv420p',
    outputPath
  ])
}

export async function concatSegments(
  segmentPaths: string[],
  outputPath: string,
  tempDir: string
): Promise<void> {
  const filelistPath = join(tempDir, 'concat-filelist.txt')
  const filelistContent = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
    .join('\n')
  writeFileSync(filelistPath, filelistContent, 'utf-8')

  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    filelistPath,
    '-c',
    'copy',
    outputPath
  ])
}

export async function muxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    videoPath,
    '-stream_loop',
    '-1',
    '-i',
    audioPath,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    outputPath
  ])
}

export interface AssembleVideoInput {
  thumbnailPath: string
  cardFrameDirs: string[]
  musicFolderPath: string
  userDataPath: string
  outputVideoPath: string
  tempDir: string
}

export async function assembleVideo(input: AssembleVideoInput): Promise<void> {
  const { thumbnailPath, cardFrameDirs, musicFolderPath, userDataPath, outputVideoPath, tempDir } =
    input

  mkdirSync(tempDir, { recursive: true })

  const thumbnailSegmentPath = join(tempDir, 'segment-thumbnail.mp4')
  await buildThumbnailSegment(thumbnailPath, thumbnailSegmentPath)

  const cardSegmentPaths: string[] = []
  for (let i = 0; i < cardFrameDirs.length; i++) {
    const segmentPath = join(tempDir, `segment-card-${i}.mp4`)
    await buildFrameSequenceSegment(cardFrameDirs[i], segmentPath)
    cardSegmentPaths.push(segmentPath)
  }

  const concatenatedPath = join(tempDir, 'concatenated.mp4')
  await concatSegments([thumbnailSegmentPath, ...cardSegmentPaths], concatenatedPath, tempDir)

  const { trackPath: musicTrackPath, trackFileName } = peekNextMusicTrack(
    musicFolderPath,
    userDataPath
  )

  const withAudioPath = join(tempDir, 'with-audio.mp4')
  await muxAudio(concatenatedPath, musicTrackPath, withAudioPath)

  // 오디오 믹스까지 성공한 뒤에야 로테이션 상태를 전진시킨다 — 그 전에 커밋하면 이후
  // 단계가 실패했을 때 로테이션만 진행되고 영상은 만들어지지 않는 불일치가 생긴다.
  commitMusicTrack(userDataPath, trackFileName)

  mkdirSync(dirname(outputVideoPath), { recursive: true })
  renameSync(withAudioPath, outputVideoPath)

  for (const frameDir of cardFrameDirs) {
    rmSync(frameDir, { recursive: true, force: true })
  }
  rmSync(tempDir, { recursive: true, force: true })
}
