import { app, safeStorage } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import { createClaudeClient } from '../api/claude'
import { getApiKey } from '../settings/apiKey'

export function requireClaudeClient(): Anthropic | null {
  const apiKey = getApiKey(app.getPath('userData'), safeStorage)
  if (!apiKey) return null
  return createClaudeClient(apiKey)
}
