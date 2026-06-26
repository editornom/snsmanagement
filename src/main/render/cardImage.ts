import { mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { BrowserWindow } from 'electron'

const RENDER_TIMEOUT_MS = 30_000
const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

export async function renderCardHtmlToPng(html: string, outputPath: string): Promise<void> {
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
    const image = await win.webContents.capturePage()
    const resized = image.resize({ width: CARD_WIDTH, height: CARD_HEIGHT })

    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, resized.toPNG())
  } finally {
    win.destroy()
  }
}

export function loadHtml(win: BrowserWindow, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('카드 이미지 렌더링이 시간 초과되었습니다'))
    }, RENDER_TIMEOUT_MS)

    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout)
      resolve()
    })
    win.webContents.once('did-fail-load', (_event, _code, description) => {
      clearTimeout(timeout)
      reject(new Error(`카드 이미지 렌더링 로드 실패: ${description}`))
    })

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}
