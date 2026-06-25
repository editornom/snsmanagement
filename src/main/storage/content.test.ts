import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { registerContent, type ContentMeta } from './content'
import { getContentFolderPath } from './naming'

describe('registerContent', () => {
  let documentsPath: string
  let thumbnailPath: string

  beforeEach(() => {
    documentsPath = mkdtempSync(join(tmpdir(), 'sns-content-test-'))
    thumbnailPath = join(documentsPath, 'source-thumbnail.png')
    writeFileSync(thumbnailPath, 'fake-png-bytes')
  })

  afterEach(() => {
    // tmpdir cleanup handled by OS; nothing else to do.
  })

  it('creates the output folder, copies the thumbnail, and writes meta.json', () => {
    const registeredAt = new Date(2026, 5, 25)

    const { folderPath } = registerContent({
      documentsPath,
      keyword: 'haion망분리',
      title: '제목',
      homepageUrl: 'https://haion.net',
      thumbnailPath,
      now: registeredAt
    })

    expect(folderPath).toBe(getContentFolderPath(documentsPath, 'haion망분리', registeredAt))
    expect(existsSync(join(folderPath, 'thumbnail.png'))).toBe(true)

    const meta = JSON.parse(readFileSync(join(folderPath, 'meta.json'), 'utf-8')) as ContentMeta
    expect(meta.keyword).toBe('haion망분리')
    expect(meta.title).toBe('제목')
    expect(meta.homepageUrl).toBe('https://haion.net')
    expect(meta.createdAt).toBe(registeredAt.toISOString())
    expect(meta.updatedAt).toBe(registeredAt.toISOString())
  })

  it('re-registering the same keyword/day updates fields but preserves createdAt', () => {
    const firstRun = new Date(2026, 5, 25, 9, 0, 0)
    const secondRun = new Date(2026, 5, 25, 15, 0, 0)

    const first = registerContent({
      documentsPath,
      keyword: 'haion망분리',
      title: '초안 제목',
      homepageUrl: '',
      thumbnailPath,
      now: firstRun
    })

    const second = registerContent({
      documentsPath,
      keyword: 'haion망분리',
      title: '최종 제목',
      homepageUrl: 'https://haion.net',
      thumbnailPath,
      now: secondRun
    })

    expect(second.folderPath).toBe(first.folderPath)

    const meta = JSON.parse(
      readFileSync(join(first.folderPath, 'meta.json'), 'utf-8')
    ) as ContentMeta
    expect(meta.title).toBe('최종 제목')
    expect(meta.homepageUrl).toBe('https://haion.net')
    expect(meta.createdAt).toBe(firstRun.toISOString())
    expect(meta.updatedAt).toBe(secondRun.toISOString())
  })
})
