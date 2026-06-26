import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { extname, join } from 'path'
import { getContentFolderPath } from './naming'

export interface RegisterContentInput {
  documentsPath: string
  keyword: string
  title: string
  homepageUrl: string
  thumbnailPath: string
  now?: Date
}

export interface ContentMeta {
  keyword: string
  title: string
  homepageUrl: string
  createdAt: string
  updatedAt: string
}

export function registerContent(input: RegisterContentInput): { folderPath: string } {
  const now = input.now ?? new Date()
  const folderPath = getContentFolderPath(input.documentsPath, input.keyword, now)
  mkdirSync(folderPath, { recursive: true })

  const thumbnailExt = extname(input.thumbnailPath)
  copyFileSync(input.thumbnailPath, join(folderPath, `thumbnail${thumbnailExt}`))

  const metaPath = join(folderPath, 'meta.json')
  const nowIso = now.toISOString()
  let createdAt = nowIso
  if (existsSync(metaPath)) {
    const existing = JSON.parse(readFileSync(metaPath, 'utf-8')) as ContentMeta
    createdAt = existing.createdAt
  }

  const meta: ContentMeta = {
    keyword: input.keyword,
    title: input.title,
    homepageUrl: input.homepageUrl,
    createdAt,
    updatedAt: nowIso
  }
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

  return { folderPath }
}

export function findThumbnailPath(contentFolderPath: string): string {
  const match = readdirSync(contentFolderPath).find((fileName) => fileName.startsWith('thumbnail.'))
  if (!match) {
    throw new Error(`썸네일 파일을 찾을 수 없습니다: ${contentFolderPath}`)
  }
  return join(contentFolderPath, match)
}
