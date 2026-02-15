import OpenAI from 'openai'

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
  model: string = 'openai/gpt-4o-mini'
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
  model: string = 'openai/gpt-4o-mini'
): Promise<string> {
  const chunks = chunkContent(content)

  if (chunks.length === 1) {
    return translateContent(content, targetLang, sourceLang, apiKey, model)
  }

  const translatedChunks: string[] = []

  for (const chunk of chunks) {
    const translated = await translateContent(chunk, targetLang, sourceLang, apiKey, model)
    translatedChunks.push(translated)
  }

  return mergeChunks(translatedChunks)
}
