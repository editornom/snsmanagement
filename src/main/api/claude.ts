import Anthropic from '@anthropic-ai/sdk'
import { CARD_SYSTEM_PROMPT } from '../../templates/card-system-prompt'

export type ReferenceImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp'

const CARD_MODEL = 'claude-sonnet-4-6'
const CARD_MAX_TOKENS = 8192
const CARD_REQUEST_TIMEOUT_MS = 120_000

export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey })
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

  const html = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!html.trim()) {
    throw new Error('Claude API가 빈 응답을 반환했습니다')
  }

  return html
}
