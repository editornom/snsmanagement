import { app, dialog, ipcMain } from 'electron'
import {
  CONTENT_REGISTER_CHANNEL,
  CONTENT_SELECT_THUMBNAIL_CHANNEL,
  type IpcResult,
  type RegisterContentRequest,
  type RegisterContentResponseData
} from '../../shared/ipc-content'
import { registerContent } from '../storage/content'
import { sanitizeKeyword } from '../storage/naming'

const REQUIRED_FIELD_LABELS = {
  keyword: '키워드',
  thumbnailPath: '썸네일'
} as const

type RequiredField = keyof typeof REQUIRED_FIELD_LABELS

export function getMissingRequiredFields(request: RegisterContentRequest): RequiredField[] {
  const missing: RequiredField[] = []
  if (!request.keyword?.trim()) missing.push('keyword')
  if (!request.thumbnailPath?.trim()) missing.push('thumbnailPath')
  return missing
}

// 키워드가 전부 금지문자(또는 "."/"..")로만 구성되면 폴더명 새니타이즈 후
// 빈 문자열이거나 상위 폴더를 가리키게 된다 — 등록 직전에 막아야 한다.
export function isUnusableKeyword(keyword: string): boolean {
  const sanitized = sanitizeKeyword(keyword)
  return sanitized === '' || sanitized === '.' || sanitized === '..'
}

export function registerContentIpcHandlers(): void {
  ipcMain.handle(CONTENT_SELECT_THUMBNAIL_CHANNEL, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    CONTENT_REGISTER_CHANNEL,
    (_event, request: RegisterContentRequest): IpcResult<RegisterContentResponseData> => {
      const missing = getMissingRequiredFields(request)
      if (missing.length > 0) {
        const labels = missing.map((field) => REQUIRED_FIELD_LABELS[field])
        return { ok: false, error: { message: `${labels.join(', ')}을(를) 입력해주세요` } }
      }

      if (isUnusableKeyword(request.keyword)) {
        return {
          ok: false,
          error: { message: '키워드에 사용할 수 있는 문자가 없습니다. 다른 키워드를 입력해주세요' }
        }
      }

      try {
        const { folderPath } = registerContent({
          documentsPath: app.getPath('documents'),
          keyword: request.keyword,
          title: request.title,
          homepageUrl: request.homepageUrl,
          thumbnailPath: request.thumbnailPath
        })

        return { ok: true, data: { folderPath } }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '등록 중 알 수 없는 오류가 발생했습니다'
        return { ok: false, error: { message } }
      }
    }
  )
}
