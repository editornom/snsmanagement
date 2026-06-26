import { describe, expect, it } from 'vitest'
import {
  formatYYMMDD,
  getCardHtmlPath,
  getCardImagePathFromHtmlPath,
  getContentFolderPath,
  getManuscriptPath,
  getMusicFolderPath,
  getOutputRoot,
  getVideoPath,
  sanitizeKeyword
} from './naming'

describe('formatYYMMDD', () => {
  it('formats a date as YYMMDD using local date components', () => {
    expect(formatYYMMDD(new Date(2026, 5, 25))).toBe('260625')
  })

  it('pads single-digit month and day with zero', () => {
    expect(formatYYMMDD(new Date(2026, 0, 5))).toBe('260105')
  })
})

describe('sanitizeKeyword', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeKeyword('  haion망분리  ')).toBe('haion망분리')
  })

  it('removes characters that are invalid in Windows folder names', () => {
    expect(sanitizeKeyword('haion<>:"/\\|?*망분리')).toBe('haion망분리')
  })
})

describe('getOutputRoot', () => {
  it('joins documents path with the fixed app folder and output segment', () => {
    expect(getOutputRoot('C:\\Users\\junghoo\\Documents')).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output'
    )
  })
})

describe('getContentFolderPath', () => {
  it('builds {outputRoot}/{sanitized keyword}/{YYMMDD}', () => {
    const result = getContentFolderPath(
      'C:\\Users\\junghoo\\Documents',
      '  haion<>망분리  ',
      new Date(2026, 5, 25)
    )
    expect(result).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625'
    )
  })
})

describe('getCardHtmlPath', () => {
  it('builds {contentFolderPath}/html/{YYMMDD}_{keyword}_{2-digit index}.html', () => {
    const result = getCardHtmlPath(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625',
      'haion망분리',
      new Date(2026, 5, 25),
      1
    )
    expect(result).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625\\html\\260625_haion망분리_01.html'
    )
  })

  it('pads double-digit index without truncating', () => {
    const result = getCardHtmlPath('C:\\content', 'haion', new Date(2026, 5, 25), 10)
    expect(result).toBe('C:\\content\\html\\260625_haion_10.html')
  })

  it('sanitizes the keyword used in the file name', () => {
    const result = getCardHtmlPath('C:\\content', 'haion<>망분리', new Date(2026, 5, 25), 3)
    expect(result).toBe('C:\\content\\html\\260625_haion망분리_03.html')
  })
})

describe('getMusicFolderPath', () => {
  it('joins documents path with the fixed app folder and music segment', () => {
    expect(getMusicFolderPath('C:\\Users\\junghoo\\Documents')).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\music'
    )
  })
})

describe('getVideoPath', () => {
  it('builds {contentFolderPath}/video/{date}_{keyword}.mp4 reusing the folder name as the date', () => {
    const result = getVideoPath(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625',
      'haion망분리'
    )
    expect(result).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625\\video\\260625_haion망분리.mp4'
    )
  })

  it('reuses the date embedded in the folder name rather than recomputing today’s date', () => {
    // contentFolderPath날짜(260101)는 "오늘"이 아니더라도 그대로 재사용돼야 한다.
    const result = getVideoPath('C:\\content\\haion\\260101', 'haion')
    expect(result).toBe('C:\\content\\haion\\260101\\video\\260101_haion.mp4')
  })

  it('sanitizes the keyword used in the file name', () => {
    const result = getVideoPath('C:\\content\\haion망분리\\260625', 'haion<>망분리')
    expect(result).toBe('C:\\content\\haion망분리\\260625\\video\\260625_haion망분리.mp4')
  })
})

describe('getManuscriptPath', () => {
  it('joins the content folder path with the fixed manuscript file name', () => {
    expect(
      getManuscriptPath(
        'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625'
      )
    ).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625\\원고.txt'
    )
  })
})

describe('getCardImagePathFromHtmlPath', () => {
  it('replaces the html directory segment with image and the extension with .png', () => {
    const htmlPath = getCardHtmlPath(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625',
      'haion망분리',
      new Date(2026, 5, 25),
      1
    )
    expect(getCardImagePathFromHtmlPath(htmlPath)).toBe(
      'C:\\Users\\junghoo\\Documents\\SNS콘텐츠제작도구\\output\\haion망분리\\260625\\image\\260625_haion망분리_01.png'
    )
  })

  it('supports forward-slash separators', () => {
    expect(getCardImagePathFromHtmlPath('C:/content/html/260625_haion_10.html')).toBe(
      'C:/content/image/260625_haion_10.png'
    )
  })

  it('throws when the path has no html directory segment', () => {
    expect(() => getCardImagePathFromHtmlPath('C:\\content\\260625_haion_01.html')).toThrow()
  })

  it('throws when the extension is not .html', () => {
    expect(() => getCardImagePathFromHtmlPath('C:\\content\\html\\260625_haion_01.txt')).toThrow()
  })
})
