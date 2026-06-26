import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { getManuscriptPath, getCardImagePathFromHtmlPath } from './naming'
import { readContentMeta } from './content'
import type { GenerateManuscriptCardInput } from '../../shared/ipc-manuscript'

export const CONTACT_BLOCK_PLACEHOLDER = '{{CONTACT_BLOCK}}'

export function buildContactBlock(homepageUrl: string): string {
  return [
    '대표전화 1588-1456',
    '담당자 직통 010-9945-7510(09:00~18:00)',
    '24시 채팅상담 카카오톡 @하이온넷',
    `홈페이지 ${homepageUrl}`
  ].join('\n')
}

export function applyContactTemplate(
  rawManuscript: string,
  homepageUrl: string
): { manuscript: string; homepageUrlMissing: boolean } {
  const occurrences = rawManuscript.split(CONTACT_BLOCK_PLACEHOLDER).length - 1
  if (occurrences === 0) {
    throw new Error('Claude 응답이 연락처 템플릿 자리표시자를 포함하지 않습니다')
  }
  if (occurrences > 1) {
    throw new Error('Claude 응답이 연락처 템플릿 자리표시자를 중복으로 포함합니다')
  }

  const safeHomepageUrl = homepageUrl ?? ''
  const manuscript = rawManuscript.replace(
    CONTACT_BLOCK_PLACEHOLDER,
    buildContactBlock(safeHomepageUrl)
  )
  return { manuscript, homepageUrlMissing: !safeHomepageUrl.trim() }
}

export function writeManuscriptFile(
  contentFolderPath: string,
  manuscript: string
): { manuscriptPath: string } {
  const manuscriptPath = getManuscriptPath(contentFolderPath)
  mkdirSync(dirname(manuscriptPath), { recursive: true })
  writeFileSync(manuscriptPath, manuscript, 'utf-8')
  return { manuscriptPath }
}

export interface GenerateManuscriptDocumentInput {
  contentFolderPath: string
  cards: GenerateManuscriptCardInput[]
  generateManuscriptText: (cards: { html: string; imageBase64: string }[]) => Promise<string>
}

export async function generateManuscriptDocument(
  input: GenerateManuscriptDocumentInput
): Promise<{ manuscript: string; manuscriptPath: string; homepageUrlMissing: boolean }> {
  const missingImageIndexes: number[] = []
  const imagePathsByCard: { card: GenerateManuscriptCardInput; imagePath: string }[] = []

  for (const card of input.cards) {
    let imagePath: string
    try {
      imagePath = getCardImagePathFromHtmlPath(card.htmlPath)
    } catch {
      missingImageIndexes.push(card.index)
      continue
    }
    if (!existsSync(imagePath)) {
      missingImageIndexes.push(card.index)
      continue
    }
    imagePathsByCard.push({ card, imagePath })
  }

  if (missingImageIndexes.length > 0) {
    throw new Error(
      `다음 카드의 이미지가 아직 렌더링되지 않았습니다: ${missingImageIndexes.join(', ')}`
    )
  }

  const cardsWithImage = imagePathsByCard.map(({ card, imagePath }) => ({
    html: card.html,
    imageBase64: readFileSync(imagePath).toString('base64')
  }))

  const meta = readContentMeta(input.contentFolderPath)
  const rawManuscript = await input.generateManuscriptText(cardsWithImage)
  const { manuscript, homepageUrlMissing } = applyContactTemplate(rawManuscript, meta.homepageUrl)
  const { manuscriptPath } = writeManuscriptFile(input.contentFolderPath, manuscript)

  return { manuscript, manuscriptPath, homepageUrlMissing }
}
