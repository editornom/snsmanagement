import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateCard, getReferenceImageMediaType } from './card'

describe('getReferenceImageMediaType', () => {
  it('maps known extensions to media types', () => {
    expect(getReferenceImageMediaType('ref.png')).toBe('image/png')
    expect(getReferenceImageMediaType('ref.JPG')).toBe('image/jpeg')
    expect(getReferenceImageMediaType('ref.jpeg')).toBe('image/jpeg')
    expect(getReferenceImageMediaType('ref.webp')).toBe('image/webp')
  })

  it('throws for unsupported extensions', () => {
    expect(() => getReferenceImageMediaType('ref.gif')).toThrow()
  })
})

describe('generateCard', () => {
  let tempDir: string
  let referenceImagePath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sns-card-'))
    referenceImagePath = join(tempDir, 'reference.png')
    writeFileSync(referenceImagePath, Buffer.from('fake-png-bytes'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('reads the reference image, calls generateHtml, and writes the html file', async () => {
    const contentFolderPath = join(tempDir, 'content')
    let calledWith: { base64: string; mediaType: string } | undefined

    const result = await generateCard({
      contentFolderPath,
      keyword: 'haion망분리',
      referenceImagePath,
      index: 1,
      now: new Date(2026, 5, 25),
      generateHtml: async (base64, mediaType) => {
        calledWith = { base64, mediaType }
        return '<!DOCTYPE html><html></html>'
      }
    })

    expect(calledWith?.mediaType).toBe('image/png')
    expect(calledWith?.base64).toBe(Buffer.from('fake-png-bytes').toString('base64'))

    const expectedPath = join(contentFolderPath, 'html', '260625_haion망분리_01.html')
    expect(result.htmlPath).toBe(expectedPath)
    expect(result.html).toBe('<!DOCTYPE html><html></html>')
    expect(existsSync(expectedPath)).toBe(true)
    expect(readFileSync(expectedPath, 'utf-8')).toBe('<!DOCTYPE html><html></html>')
  })

  it('propagates errors from generateHtml without writing a file', async () => {
    const contentFolderPath = join(tempDir, 'content')

    await expect(
      generateCard({
        contentFolderPath,
        keyword: 'haion',
        referenceImagePath,
        index: 2,
        now: new Date(2026, 5, 25),
        generateHtml: async () => {
          throw new Error('Claude API 호출 실패')
        }
      })
    ).rejects.toThrow('Claude API 호출 실패')

    const expectedPath = join(contentFolderPath, 'html', '260625_haion_02.html')
    expect(existsSync(expectedPath)).toBe(false)
  })
})
