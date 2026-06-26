import Anthropic from '@anthropic-ai/sdk'
import { CARD_EDIT_SYSTEM_PROMPT } from '../../templates/card-edit-system-prompt'
import { CARD_SYSTEM_PROMPT } from '../../templates/card-system-prompt'
import { MANUSCRIPT_SYSTEM_PROMPT } from '../../templates/manuscript-system-prompt'

export type ReferenceImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp'

const CARD_MODEL = 'claude-sonnet-4-6'
const CARD_MAX_TOKENS = 8192
const CARD_REQUEST_TIMEOUT_MS = 120_000

// 원고 생성은 카드 여러 장의 HTML+이미지를 한 요청에 모두 담으므로(카드 1장당 호출하는
// CARD_*보다 입력이 훨씬 큼), 토큰/타임아웃 한도를 카드 수에 비례해 따로 둔다.
const MANUSCRIPT_MAX_TOKENS = 8192
const MANUSCRIPT_REQUEST_TIMEOUT_MS = 300_000

export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey })
}

function extractResponseText(response: Anthropic.Messages.Message): string {
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!text.trim()) {
    throw new Error('Claude API가 빈 응답을 반환했습니다')
  }

  return text
}

export async function generateCardHtml(
  client: Anthropic,
  referenceImageBase64: string,
  mediaType: ReferenceImageMediaType
): Promise<string> {
  const response = await client.messages.create(
    {
      model: CARD_MODEL,
      max_tokens: CARD_MAX_TOKENS,
      system: CARD_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: referenceImageBase64 }
            },
            { type: 'text', text: '이 참고이미지를 정보카드 HTML로 변환해줘' }
          ]
        }
      ]
    },
    { timeout: CARD_REQUEST_TIMEOUT_MS }
  )

  return extractResponseText(response)
}

export async function generateManuscript(
  client: Anthropic,
  cards: { html: string; imageBase64: string }[]
): Promise<string> {
  const content: Anthropic.Messages.ContentBlockParam[] = []
  for (let i = 0; i < cards.length; i++) {
    content.push({ type: 'text', text: `카드 ${i + 1} HTML:\n${cards[i].html}` })
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: cards[i].imageBase64 }
    })
  }
  content.push({ type: 'text', text: '위 카드들을 바탕으로 SNS 공통 원고를 생성해줘' })

  const response = await client.messages.create(
    {
      model: CARD_MODEL,
      max_tokens: MANUSCRIPT_MAX_TOKENS,
      system: MANUSCRIPT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }]
    },
    { timeout: MANUSCRIPT_REQUEST_TIMEOUT_MS }
  )

  return extractResponseText(response)
}

export async function editCardHtml(
  client: Anthropic,
  currentHtml: string,
  instruction: string
): Promise<string> {
  const response = await client.messages.create(
    {
      model: CARD_MODEL,
      max_tokens: CARD_MAX_TOKENS,
      system: CARD_EDIT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `현재 카드 HTML:\n${currentHtml}` },
            { type: 'text', text: `수정 지시: ${instruction}` }
          ]
        }
      ]
    },
    { timeout: CARD_REQUEST_TIMEOUT_MS }
  )

  return extractResponseText(response)
}
