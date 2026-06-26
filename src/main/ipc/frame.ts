import { app, ipcMain } from 'electron'
import {
  FRAME_CAPTURE_CHANNEL,
  type CaptureFramesRequest,
  type CaptureFramesResponseData,
  type FrameCaptureResult
} from '../../shared/ipc-frame'
import type { IpcResult } from '../../shared/ipc-content'
import { injectEntryAnimation } from '../render/cardAnimation'
import { captureCardFrames, getCardFrameDirPath } from '../render/frameCapture'

const NO_CARDS_MESSAGE = '프레임캡처할 카드가 없습니다'

export function registerFrameIpcHandlers(): void {
  ipcMain.handle(
    FRAME_CAPTURE_CHANNEL,
    async (
      _event,
      request: CaptureFramesRequest
    ): Promise<IpcResult<CaptureFramesResponseData>> => {
      if (!request.cards || request.cards.length === 0) {
        return { ok: false, error: { message: NO_CARDS_MESSAGE } }
      }

      const results: FrameCaptureResult[] = []
      const tempRoot = app.getPath('temp')

      for (const card of request.cards) {
        try {
          const { html: injectedHtml, entryDurationMs } = injectEntryAnimation(card.html)
          const frameDir = getCardFrameDirPath(tempRoot, card.index)
          const { frameCount } = await captureCardFrames(injectedHtml, entryDurationMs, frameDir)
          results.push({ status: 'success', index: card.index, frameDir, frameCount })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '프레임캡처 중 알 수 없는 오류가 발생했습니다'
          results.push({ status: 'failure', index: card.index, error: message })
        }
      }

      return { ok: true, data: { results } }
    }
  )
}
