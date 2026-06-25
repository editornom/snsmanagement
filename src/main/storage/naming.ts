import { join } from 'path'

const OUTPUT_APP_FOLDER = 'SNS콘텐츠제작도구'
const INVALID_WINDOWS_PATH_CHARS = /[<>:"/\\|?*]/g

export function formatYYMMDD(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

export function sanitizeKeyword(keyword: string): string {
  return keyword.trim().replace(INVALID_WINDOWS_PATH_CHARS, '')
}

export function getOutputRoot(documentsPath: string): string {
  return join(documentsPath, OUTPUT_APP_FOLDER, 'output')
}

export function getContentFolderPath(documentsPath: string, keyword: string, date: Date): string {
  return join(getOutputRoot(documentsPath), sanitizeKeyword(keyword), formatYYMMDD(date))
}

export function getCardHtmlPath(
  contentFolderPath: string,
  keyword: string,
  date: Date,
  index: number
): string {
  const sequence = String(index).padStart(2, '0')
  return join(
    contentFolderPath,
    'html',
    `${formatYYMMDD(date)}_${sanitizeKeyword(keyword)}_${sequence}.html`
  )
}
