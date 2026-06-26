import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { loadHtml } from './cardImage'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const FRAME_INTERVAL_MS = 1000 / 60
const EXPOSURE_AFTER_ENTRY_MS = 3000
const FRAME_TEMP_FOLDER = 'sns-content-tool-frames'

export function getCardFrameDirPath(tempRoot: string, cardIndex: number): string {
  const sequence = String(cardIndex).padStart(2, '0')
  return join(tempRoot, FRAME_TEMP_FOLDER, `card-${sequence}`)
}

export async function captureCardFrames(
  html: string,
  entryDurationMs: number,
  outputDir: string
): Promise<{ frameCount: number }> {
  const win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    webPreferences: {
      offscreen: false
    }
  })

  try {
    await loadHtml(win, html)
    await win.webContents.executeJavaScript(
      'document.getAnimations().forEach(function (a) { a.pause(); });'
    )

    const totalDurationMs = entryDurationMs + EXPOSURE_AFTER_ENTRY_MS
    const frameCount = Math.ceil(totalDurationMs / FRAME_INTERVAL_MS)

    mkdirSync(outputDir, { recursive: true })

    for (let i = 0; i < frameCount; i++) {
      const currentTimeMs = i * FRAME_INTERVAL_MS
      await win.webContents.executeJavaScript(
        `document.getAnimations().forEach(function (a) { a.currentTime = ${currentTimeMs}; });`
      )
      const image = await win.webContents.capturePage()
      const resized = image.resize({ width: CARD_WIDTH, height: CARD_HEIGHT })
      const frameFileName = `frame-${String(i).padStart(5, '0')}.png`
      writeFileSync(join(outputDir, frameFileName), resized.toPNG())
    }

    return { frameCount }
  } finally {
    win.destroy()
  }
}
