import { ipcMain } from 'electron'
import {
  MANUSCRIPT_GENERATE_CHANNEL,
  type GenerateManuscriptRequest,
  type GenerateManuscriptResponseData
} from '../../shared/ipc-manuscript'
import type { IpcResult } from '../../shared/ipc-content'
import { generateManuscript } from '../api/claude'
import { generateManuscriptDocument } from '../storage/manuscript'
import { requireClaudeClient } from './requireClaudeClient'

const NO_CARDS_MESSAGE = '원고를 생성할 카드가 없습니다'
const MISSING_FOLDER_MESSAGE = '폴더 정보가 없습니다'
const API_KEY_MISSING_MESSAGE = 'Claude API 키를 먼저 설정해주세요'

export function registerManuscriptIpcHandlers(): void {
  ipcMain.handle(
    MANUSCRIPT_GENERATE_CHANNEL,
    async (
      _event,
      request: GenerateManuscriptRequest
    ): Promise<IpcResult<GenerateManuscriptResponseData>> => {
      if (!request.contentFolderPath?.trim()) {
        return { ok: false, error: { message: MISSING_FOLDER_MESSAGE } }
      }
      if (!request.cards || request.cards.length === 0) {
        return { ok: false, error: { message: NO_CARDS_MESSAGE } }
      }

      const client = requireClaudeClient()
      if (!client) {
        return { ok: false, error: { message: API_KEY_MISSING_MESSAGE } }
      }

      try {
        const { manuscript, manuscriptPath, homepageUrlMissing } = await generateManuscriptDocument(
          {
            contentFolderPath: request.contentFolderPath,
            cards: request.cards,
            generateManuscriptText: (cards) => generateManuscript(client, cards)
          }
        )
        return { ok: true, data: { manuscript, manuscriptPath, homepageUrlMissing } }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '원고 생성 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )
}
