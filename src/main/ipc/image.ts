import { ipcMain } from 'electron'
import {
  IMAGE_RENDER_CHANNEL,
  type ImageRenderResult,
  type RenderCardsRequest,
  type RenderCardsResponseData
} from '../../shared/ipc-image'
import type { IpcResult } from '../../shared/ipc-content'
import { renderCardHtmlToPng } from '../render/cardImage'
import { overwriteCardHtmlFile } from '../storage/card'
import { getCardImagePathFromHtmlPath } from '../storage/naming'

const NO_CARDS_MESSAGE = '렌더링할 카드가 없습니다'

export function registerImageIpcHandlers(): void {
  ipcMain.handle(
    IMAGE_RENDER_CHANNEL,
    async (_event, request: RenderCardsRequest): Promise<IpcResult<RenderCardsResponseData>> => {
      if (!request.cards || request.cards.length === 0) {
        return { ok: false, error: { message: NO_CARDS_MESSAGE } }
      }

      const results: ImageRenderResult[] = []

      for (const card of request.cards) {
        try {
          overwriteCardHtmlFile(card.htmlPath, card.html)
          const imagePath = getCardImagePathFromHtmlPath(card.htmlPath)
          await renderCardHtmlToPng(card.html, imagePath)
          results.push({ status: 'success', index: card.index, imagePath })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : '이미지 렌더링 중 알 수 없는 오류가 발생했습니다'
          results.push({ status: 'failure', index: card.index, error: message })
        }
      }

      return { ok: true, data: { results } }
    }
  )
}
