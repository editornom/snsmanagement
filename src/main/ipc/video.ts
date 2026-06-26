import { app, ipcMain } from 'electron'
import { join } from 'path'
import {
  VIDEO_ASSEMBLE_CHANNEL,
  type AssembleVideoRequest,
  type AssembleVideoResponseData
} from '../../shared/ipc-video'
import type { IpcResult } from '../../shared/ipc-content'
import { findThumbnailPath } from '../storage/content'
import { getMusicFolderPath, getVideoPath } from '../storage/naming'
import { assembleVideo } from '../render/videoAssembly'

const NO_CARDS_MESSAGE = '영상에 포함할 카드가 없습니다'

export function registerVideoIpcHandlers(): void {
  ipcMain.handle(
    VIDEO_ASSEMBLE_CHANNEL,
    async (
      _event,
      request: AssembleVideoRequest
    ): Promise<IpcResult<AssembleVideoResponseData>> => {
      if (!request.cards || request.cards.length === 0) {
        return { ok: false, error: { message: NO_CARDS_MESSAGE } }
      }

      try {
        const thumbnailPath = findThumbnailPath(request.contentFolderPath)
        const outputVideoPath = getVideoPath(request.contentFolderPath, request.keyword)
        const sortedCards = [...request.cards].sort((a, b) => a.index - b.index)

        await assembleVideo({
          thumbnailPath,
          cardFrameDirs: sortedCards.map((card) => card.frameDir),
          musicFolderPath: getMusicFolderPath(app.getPath('documents')),
          userDataPath: app.getPath('userData'),
          outputVideoPath,
          tempDir: join(app.getPath('temp'), 'sns-content-tool-video-build')
        })

        return { ok: true, data: { videoPath: outputVideoPath } }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '영상 조립 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )
}
