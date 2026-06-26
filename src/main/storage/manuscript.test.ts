import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  applyContactTemplate,
  buildContactBlock,
  CONTACT_BLOCK_PLACEHOLDER,
  generateManuscriptDocument,
  writeManuscriptFile
} from './manuscript'
import { getCardHtmlPath, getCardImagePathFromHtmlPath } from './naming'

describe('buildContactBlock', () => {
  it('builds the fixed contact template with the homepage URL filled in', () => {
    expect(buildContactBlock('https://haion.net')).toBe(
      [
        '대표전화 1588-1456',
        '담당자 직통 010-9945-7510(09:00~18:00)',
        '24시 채팅상담 카카오톡 @하이온넷',
        '홈페이지 https://haion.net'
      ].join('\n')
    )
  })

  it('leaves the URL slot blank when homepageUrl is empty', () => {
    expect(buildContactBlock('')).toBe(
      [
        '대표전화 1588-1456',
        '담당자 직통 010-9945-7510(09:00~18:00)',
        '24시 채팅상담 카카오톡 @하이온넷',
        '홈페이지 '
      ].join('\n')
    )
  })
})

describe('applyContactTemplate', () => {
  it('replaces a single placeholder occurrence and reports homepageUrlMissing=false', () => {
    const raw = `페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#해시태그`
    const result = applyContactTemplate(raw, 'https://haion.net')
    expect(result.manuscript).toBe(
      '페인포인트\n' + buildContactBlock('https://haion.net') + '\n#해시태그'
    )
    expect(result.homepageUrlMissing).toBe(false)
  })

  it('reports homepageUrlMissing=true when homepageUrl is empty', () => {
    const raw = `페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#해시태그`
    const result = applyContactTemplate(raw, '')
    expect(result.homepageUrlMissing).toBe(true)
  })

  it('throws a "missing" message when the placeholder is absent', () => {
    expect(() => applyContactTemplate('페인포인트만 있음', 'https://haion.net')).toThrow(
      '포함하지 않습니다'
    )
  })

  it('throws a distinct "duplicated" message when the placeholder appears more than once', () => {
    const raw = `${CONTACT_BLOCK_PLACEHOLDER}\n${CONTACT_BLOCK_PLACEHOLDER}`
    expect(() => applyContactTemplate(raw, 'https://haion.net')).toThrow('중복으로 포함')
  })

  it('does not throw when homepageUrl is undefined (treated as empty)', () => {
    const raw = `페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#해시태그`
    const result = applyContactTemplate(raw, undefined as unknown as string)
    expect(result.homepageUrlMissing).toBe(true)
  })
})

describe('writeManuscriptFile', () => {
  it('creates the content folder if needed and writes the manuscript text', () => {
    const contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    const { manuscriptPath } = writeManuscriptFile(contentFolderPath, '원고 내용')
    expect(existsSync(manuscriptPath)).toBe(true)
    expect(readFileSync(manuscriptPath, 'utf-8')).toBe('원고 내용')
  })
})

describe('generateManuscriptDocument', () => {
  let contentFolderPath: string

  function setupCard(
    index: number,
    withImage: boolean
  ): { index: number; htmlPath: string; html: string } {
    const htmlPath = getCardHtmlPath(contentFolderPath, 'haion망분리', new Date(2026, 5, 25), index)
    mkdirSync(join(contentFolderPath, 'html'), { recursive: true })
    writeFileSync(htmlPath, `<html>${index}</html>`, 'utf-8')
    if (withImage) {
      const imagePath = getCardImagePathFromHtmlPath(htmlPath)
      mkdirSync(join(contentFolderPath, 'image'), { recursive: true })
      writeFileSync(imagePath, 'fake-png-bytes')
    }
    return { index, htmlPath, html: `<html>${index}</html>` }
  }

  function writeMeta(homepageUrl: string): void {
    writeFileSync(
      join(contentFolderPath, 'meta.json'),
      JSON.stringify({
        keyword: 'haion망분리',
        title: '제목',
        homepageUrl,
        createdAt: '2026-06-25T00:00:00.000Z',
        updatedAt: '2026-06-25T00:00:00.000Z'
      }),
      'utf-8'
    )
  }

  it('fails before calling Claude when a card image has not been rendered yet', async () => {
    contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    writeMeta('https://haion.net')
    const card1 = setupCard(1, true)
    const card2 = setupCard(2, false)

    const generateManuscriptText = vi.fn()

    await expect(
      generateManuscriptDocument({
        contentFolderPath,
        cards: [card1, card2],
        generateManuscriptText
      })
    ).rejects.toThrow('2')
    expect(generateManuscriptText).not.toHaveBeenCalled()
  })

  it('passes html+imageBase64 pairs to generateManuscriptText and writes the result', async () => {
    contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    writeMeta('https://haion.net')
    const card1 = setupCard(1, true)

    const generateManuscriptText = vi
      .fn()
      .mockResolvedValue(`페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#태그`)

    const result = await generateManuscriptDocument({
      contentFolderPath,
      cards: [card1],
      generateManuscriptText
    })

    expect(generateManuscriptText).toHaveBeenCalledWith([
      { html: card1.html, imageBase64: Buffer.from('fake-png-bytes').toString('base64') }
    ])
    expect(result.homepageUrlMissing).toBe(false)
    expect(result.manuscript).toContain('대표전화 1588-1456')
    expect(existsSync(result.manuscriptPath)).toBe(true)
  })

  it('reports homepageUrlMissing when meta.json has an empty homepageUrl', async () => {
    contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    writeMeta('')
    const card1 = setupCard(1, true)

    const generateManuscriptText = vi
      .fn()
      .mockResolvedValue(`페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#태그`)

    const result = await generateManuscriptDocument({
      contentFolderPath,
      cards: [card1],
      generateManuscriptText
    })

    expect(result.homepageUrlMissing).toBe(true)
  })

  it('does not crash when meta.json has no homepageUrl field at all', async () => {
    contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    writeFileSync(
      join(contentFolderPath, 'meta.json'),
      JSON.stringify({ keyword: 'haion망분리', title: '제목' }),
      'utf-8'
    )
    const card1 = setupCard(1, true)

    const generateManuscriptText = vi
      .fn()
      .mockResolvedValue(`페인포인트\n${CONTACT_BLOCK_PLACEHOLDER}\n#태그`)

    const result = await generateManuscriptDocument({
      contentFolderPath,
      cards: [card1],
      generateManuscriptText
    })

    expect(result.homepageUrlMissing).toBe(true)
  })

  it('reports a malformed htmlPath as a missing image rather than throwing past the loop', async () => {
    contentFolderPath = mkdtempSync(join(tmpdir(), 'sns-manuscript-test-'))
    writeMeta('https://haion.net')
    const card1 = setupCard(1, true)
    const malformedCard = {
      index: 2,
      htmlPath: join(contentFolderPath, 'no-html-dir.html'),
      html: '<html></html>'
    }

    const generateManuscriptText = vi.fn()

    await expect(
      generateManuscriptDocument({
        contentFolderPath,
        cards: [card1, malformedCard],
        generateManuscriptText
      })
    ).rejects.toThrow('2')
    expect(generateManuscriptText).not.toHaveBeenCalled()
  })
})
