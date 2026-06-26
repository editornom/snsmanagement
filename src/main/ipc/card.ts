import { dialog, ipcMain } from 'electron'
import {
  CARD_EDIT_WITH_INSTRUCTION_CHANNEL,
  CARD_GENERATE_CHANNEL,
  CARD_REGENERATE_CHANNEL,
  CARD_SAVE_HTML_CHANNEL,
  CARD_SELECT_REFERENCE_IMAGES_CHANNEL,
  type CardResult,
  type EditCardWithInstructionRequest,
  type EditCardWithInstructionResponseData,
  type GenerateCardsRequest,
  type GenerateCardsResponseData,
  type RegenerateCardRequest,
  type RegenerateCardResponseData,
  type SaveCardHtmlRequest,
  type SaveCardHtmlResponseData,
  type SelectReferenceImagesResult
} from '../../shared/ipc-card'
import type { IpcResult } from '../../shared/ipc-content'
import { validateCardSkeleton } from '../../shared/cardSkeleton'
import { editCardHtml, generateCardHtml } from '../api/claude'
import { generateCard, overwriteCardHtmlFile } from '../storage/card'
import { requireClaudeClient } from './requireClaudeClient'

const MAX_REFERENCE_IMAGES = 10
const API_KEY_MISSING_MESSAGE = 'Claude API 키를 먼저 설정해주세요'
const MISSING_FOLDER_OR_KEYWORD_MESSAGE = '폴더 또는 키워드 정보가 없습니다'
const NO_REFERENCE_IMAGES_MESSAGE = '참고이미지를 선택해주세요'
const MISSING_SAVE_FIELDS_MESSAGE = '저장할 파일 경로/HTML 정보가 없습니다'
const MISSING_EDIT_FIELDS_MESSAGE = '카드 경로/HTML/지시문 정보가 없습니다'

export function registerCardIpcHandlers(): void {
  ipcMain.handle(
    CARD_SELECT_REFERENCE_IMAGES_CHANNEL,
    async (): Promise<SelectReferenceImagesResult> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      })
      if (result.canceled) return { paths: [], truncated: false }
      return {
        paths: result.filePaths.slice(0, MAX_REFERENCE_IMAGES),
        truncated: result.filePaths.length > MAX_REFERENCE_IMAGES
      }
    }
  )

  ipcMain.handle(
    CARD_GENERATE_CHANNEL,
    async (
      _event,
      request: GenerateCardsRequest
    ): Promise<IpcResult<GenerateCardsResponseData>> => {
      if (!request.contentFolderPath?.trim() || !request.keyword?.trim()) {
        return { ok: false, error: { message: MISSING_FOLDER_OR_KEYWORD_MESSAGE } }
      }
      if (!request.referenceImagePaths || request.referenceImagePaths.length === 0) {
        return { ok: false, error: { message: NO_REFERENCE_IMAGES_MESSAGE } }
      }

      const client = requireClaudeClient()
      if (!client) {
        return { ok: false, error: { message: API_KEY_MISSING_MESSAGE } }
      }
      const referenceImagePaths = request.referenceImagePaths.slice(0, MAX_REFERENCE_IMAGES)
      const cards: CardResult[] = []

      for (let i = 0; i < referenceImagePaths.length; i++) {
        const index = i + 1
        try {
          const { htmlPath, html } = await generateCard({
            contentFolderPath: request.contentFolderPath,
            keyword: request.keyword,
            referenceImagePath: referenceImagePaths[i],
            index,
            generateHtml: (base64, mediaType) => generateCardHtml(client, base64, mediaType)
          })
          cards.push({ status: 'success', index, htmlPath, html })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '카드 생성 중 알 수 없는 오류가 발생했습니다'
          cards.push({ status: 'failure', index, error: message })
        }
      }

      return { ok: true, data: { cards } }
    }
  )

  ipcMain.handle(
    CARD_REGENERATE_CHANNEL,
    async (
      _event,
      request: RegenerateCardRequest
    ): Promise<IpcResult<RegenerateCardResponseData>> => {
      if (
        !request.contentFolderPath?.trim() ||
        !request.keyword?.trim() ||
        !request.referenceImagePath?.trim()
      ) {
        return { ok: false, error: { message: MISSING_FOLDER_OR_KEYWORD_MESSAGE } }
      }

      const client = requireClaudeClient()
      if (!client) {
        return { ok: false, error: { message: API_KEY_MISSING_MESSAGE } }
      }

      try {
        const { htmlPath, html } = await generateCard({
          contentFolderPath: request.contentFolderPath,
          keyword: request.keyword,
          referenceImagePath: request.referenceImagePath,
          index: request.index,
          generateHtml: (base64, mediaType) => generateCardHtml(client, base64, mediaType)
        })
        return {
          ok: true,
          data: { card: { status: 'success', index: request.index, htmlPath, html } }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '카드 재생성 중 알 수 없는 오류가 발생했습니다'
        return {
          ok: true,
          data: { card: { status: 'failure', index: request.index, error: message } }
        }
      }
    }
  )

  ipcMain.handle(
    CARD_SAVE_HTML_CHANNEL,
    (_event, request: SaveCardHtmlRequest): IpcResult<SaveCardHtmlResponseData> => {
      if (!request.htmlPath?.trim() || !request.html?.trim()) {
        return { ok: false, error: { message: MISSING_SAVE_FIELDS_MESSAGE } }
      }

      try {
        overwriteCardHtmlFile(request.htmlPath, request.html)
        return { ok: true, data: { htmlPath: request.htmlPath } }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '카드 저장 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )

  ipcMain.handle(
    CARD_EDIT_WITH_INSTRUCTION_CHANNEL,
    async (
      _event,
      request: EditCardWithInstructionRequest
    ): Promise<IpcResult<EditCardWithInstructionResponseData>> => {
      if (!request.htmlPath?.trim() || !request.html?.trim() || !request.instruction?.trim()) {
        return { ok: false, error: { message: MISSING_EDIT_FIELDS_MESSAGE } }
      }

      const client = requireClaudeClient()
      if (!client) {
        return { ok: false, error: { message: API_KEY_MISSING_MESSAGE } }
      }

      try {
        const editedHtml = await editCardHtml(client, request.html, request.instruction)

        const { valid, violations } = validateCardSkeleton(editedHtml)
        if (!valid) {
          return { ok: false, error: { message: violations.join('; ') } }
        }

        overwriteCardHtmlFile(request.htmlPath, editedHtml)
        return { ok: true, data: { html: editedHtml } }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'AI 편집 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )
}
