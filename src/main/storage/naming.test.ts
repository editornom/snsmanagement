import { describe, expect, it } from 'vitest'
import { formatYYMMDD, getContentFolderPath, getOutputRoot, sanitizeKeyword } from './naming'

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
