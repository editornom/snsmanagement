import { describe, expect, it } from 'vitest'
import { getMissingRequiredFields, isUnusableKeyword } from './content'

describe('getMissingRequiredFields', () => {
  it('returns empty array when keyword and thumbnailPath are present', () => {
    expect(
      getMissingRequiredFields({
        keyword: 'haion망분리',
        title: '',
        homepageUrl: '',
        thumbnailPath: 'C:\\tmp\\thumb.png'
      })
    ).toEqual([])
  })

  it('flags missing keyword', () => {
    expect(
      getMissingRequiredFields({
        keyword: '   ',
        title: '',
        homepageUrl: '',
        thumbnailPath: 'C:\\tmp\\thumb.png'
      })
    ).toEqual(['keyword'])
  })

  it('flags missing thumbnailPath', () => {
    expect(
      getMissingRequiredFields({
        keyword: 'haion망분리',
        title: '',
        homepageUrl: '',
        thumbnailPath: ''
      })
    ).toEqual(['thumbnailPath'])
  })

  it('flags both when keyword and thumbnailPath are both empty', () => {
    expect(
      getMissingRequiredFields({
        keyword: '',
        title: '',
        homepageUrl: '',
        thumbnailPath: ''
      })
    ).toEqual(['keyword', 'thumbnailPath'])
  })

  it('does not require title or homepageUrl', () => {
    expect(
      getMissingRequiredFields({
        keyword: 'haion망분리',
        title: '',
        homepageUrl: '',
        thumbnailPath: 'C:\\tmp\\thumb.png'
      })
    ).toEqual([])
  })
})

describe('isUnusableKeyword', () => {
  it('returns false for a normal keyword', () => {
    expect(isUnusableKeyword('haion망분리')).toBe(false)
  })

  it('returns true when the keyword sanitizes to an empty string', () => {
    expect(isUnusableKeyword('<>:"/\\|?*')).toBe(true)
  })

  it('returns true for ".." which would escape the output root after path.join', () => {
    expect(isUnusableKeyword('..')).toBe(true)
  })

  it('returns true for "."', () => {
    expect(isUnusableKeyword('.')).toBe(true)
  })
})
