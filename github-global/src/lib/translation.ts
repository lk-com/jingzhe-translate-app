import OpenAI from 'openai'

// Error code to user-friendly message mapping
const ERROR_MESSAGES: Record<string, { zh: string; en: string }> = {
  '402': {
    zh: 'API 余额不足，请充值后再试',
    en: 'Insufficient API credits, please top up',
  },
  '429': {
    zh: '请求过于频繁，请稍后重试',
    en: 'Rate limit exceeded, please try again later',
  },
  '401': {
    zh: 'API 密钥无效，请检查配置',
    en: 'Invalid API key, please check configuration',
  },
  '403': {
    zh: '无权限访问，请检查 API 密钥权限',
    en: 'Access forbidden, please check API key permissions',
  },
  '500': {
    zh: 'API 服务器内部错误',
    en: 'API server internal error',
  },
  '503': {
    zh: 'API 服务暂时不可用',
    en: 'API service temporarily unavailable',
  },
}

/**
 * Extract user-friendly error message from OpenRouter API errors
 */
function getUserFriendlyError(error: unknown): string {
  // Check if it's an OpenRouter error with status code
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>

    // Try to get status code
    const status = err.status as number | undefined

    if (status && ERROR_MESSAGES[status.toString()]) {
      return ERROR_MESSAGES[status.toString()].zh
    }

    // Try to extract error from error.error for OpenRouter
    const errorObj = err.error as Record<string, unknown> | undefined
    if (errorObj) {
      const errorCode = errorObj.code as string | undefined
      const errorMessage = errorObj.message as string | undefined

      if (errorCode === 'insufficient_quota' || errorMessage?.includes('quota')) {
        return 'API 配额不足，请充值后再试'
      }
      if (errorMessage) {
        return errorMessage
      }
    }

    // Check for specific error messages in the error
    const message = err.message as string | undefined
    if (message) {
      if (message.includes('402')) return ERROR_MESSAGES['402'].zh
      if (message.includes('429')) return ERROR_MESSAGES['429'].zh
      if (message.includes('401')) return ERROR_MESSAGES['401'].zh
      if (message.includes('rate_limit')) return ERROR_MESSAGES['429'].zh
      if (message.includes('quota')) return 'API 配额不足，请充值后再试'
    }
  }

  // Fallback to original error message
  if (error instanceof Error) {
    return error.message
  }

  return '未知错误'
}

/**
 * Wrap translateContent with better error handling
 */
async function translateContentWithErrorHandling(
  content: string,
  targetLang: string,
  sourceLang: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    return await translateContent(content, targetLang, sourceLang, apiKey, model)
  } catch (error) {
    const friendlyMessage = getUserFriendlyError(error)
    throw new Error(friendlyMessage)
  }
}

// Translation system prompt
const TRANSLATION_SYSTEM_PROMPT = `You are a professional technical documentation translator specializing in software development and open-source projects. Your translations must:

1. **Accuracy**: Preserve the exact meaning of the original text without adding, removing, or altering information.
2. **Technical Terms**: Keep technical terms, API names, function names, and code snippets unchanged. Do not translate:
   - Programming language keywords
   - Library/framework names (React, Vue, Docker, etc.)
   - API endpoints and URLs
   - Code blocks and inline code
   - Command-line instructions
   - File paths and environment variables

3. **Markdown Structure**: Maintain all Markdown formatting exactly:
   - Headers (#, ##, ###)
   - Lists (-, *, 1.)
   - Code blocks (\`\`\`language)
   - Links [text](url)
   - Images ![alt](url)
   - Tables
   - Blockquotes (>)

4. **Natural Flow**: Translate into natural, fluent target language that native speakers would write, not literal word-for-word translations.

5. **Consistency**: Use consistent terminology throughout the document. Create a mental glossary for recurring terms.

6. **Links Handling**:
   - Keep URLs unchanged
   - Translate link text unless it's a technical term
   - Preserve relative links structure

7. **Code Comments**: Translate code comments if they are in natural language, but keep code syntax unchanged.

Output only the translated content without any explanations or meta-commentary.`

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  pt: 'Portuguese',
  it: 'Italian',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
}

export function buildTranslationPrompt(
  content: string,
  targetLang: string,
  sourceLang: string = 'en'
): string {
  const targetLangName = LANG_NAMES[targetLang] || targetLang
  const sourceLangName = LANG_NAMES[sourceLang] || sourceLang

  return `Translate the following Markdown document from ${sourceLangName} to ${targetLangName}.

Source content:
---
${content}
---

Translated content:`
}

export async function translateContent(
  content: string,
  targetLang: string,
  sourceLang: string = 'en',
  apiKey: string,
  model: string = process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini'
): Promise<string> {
  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'GitHub Global',
    },
  })

  const response = await openrouter.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: buildTranslationPrompt(content, targetLang, sourceLang) },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  })

  return response.choices[0].message.content || ''
}

// Chunk large files for translation
export function chunkContent(content: string, maxChunkSize: number = 8000): string[] {
  const chunks: string[] = []
  const lines = content.split('\n')

  let currentChunk = ''
  let currentSize = 0

  for (const line of lines) {
    const lineSize = line.length + 1

    if (currentSize + lineSize > maxChunkSize && currentChunk.trim()) {
      chunks.push(currentChunk.trim())
      currentChunk = ''
      currentSize = 0
    }

    currentChunk += line + '\n'
    currentSize += lineSize
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// Merge translated chunks
export function mergeChunks(translatedChunks: string[]): string {
  return translatedChunks.join('\n\n')
}

// Translation with chunking for large files
export async function translateLargeContent(
  content: string,
  targetLang: string,
  sourceLang: string = 'en',
  apiKey: string,
  model: string = process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini'
): Promise<string> {
  const chunks = chunkContent(content)

  if (chunks.length === 1) {
    return translateContentWithErrorHandling(content, targetLang, sourceLang, apiKey, model)
  }

  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const translated = await translateContentWithErrorHandling(chunk, targetLang, sourceLang, apiKey, model)
    translatedChunks.push(translated)
  }

  return mergeChunks(translatedChunks)
}

export { getUserFriendlyError }
