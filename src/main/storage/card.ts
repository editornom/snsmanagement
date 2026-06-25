import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, extname } from 'path'
import { getCardHtmlPath } from './naming'
import type { ReferenceImageMediaType } from '../api/claude'

export interface GenerateCardInput {
  contentFolderPath: string
  keyword: string
  referenceImagePath: string
  index: number
  now?: Date
  generateHtml: (
    referenceImageBase64: string,
    mediaType: ReferenceImageMediaType
  ) => Promise<string>
}

export function getReferenceImageMediaType(filePath: string): ReferenceImageMediaType {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  throw new Error(`지원하지 않는 참고이미지 형식입니다: ${ext}`)
}

export function writeCardHtmlFile(
  contentFolderPath: string,
  keyword: string,
  date: Date,
  index: number,
  html: string
): { htmlPath: string } {
  const htmlPath = getCardHtmlPath(contentFolderPath, keyword, date, index)
  overwriteCardHtmlFile(htmlPath, html)
  return { htmlPath }
}

export function overwriteCardHtmlFile(htmlPath: string, html: string): void {
  mkdirSync(dirname(htmlPath), { recursive: true })
  writeFileSync(htmlPath, html, 'utf-8')
}

export async function generateCard(
  input: GenerateCardInput
): Promise<{ htmlPath: string; html: string }> {
  const mediaType = getReferenceImageMediaType(input.referenceImagePath)
  const referenceImageBase64 = readFileSync(input.referenceImagePath).toString('base64')
  const html = await input.generateHtml(referenceImageBase64, mediaType)

  const now = input.now ?? new Date()
  const { htmlPath } = writeCardHtmlFile(
    input.contentFolderPath,
    input.keyword,
    now,
    input.index,
    html
  )

  return { htmlPath, html }
}
