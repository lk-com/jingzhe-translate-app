import { francAll } from 'franc-min'

// ISO 639-3 到项目语言代码的映射
const LANGUAGE_CODE_MAP: Record<string, string> = {
  // 中文
  'cmn': 'zh',  // Mandarin Chinese
  'zho': 'zh',  // Chinese
  'wuu': 'zh',  // Wu Chinese
  'yue': 'zh',  // Cantonese
  'zh': 'zh',   // 兼容 ISO 639-1

  // 英文
  'eng': 'en',  // English
  'en': 'en',   // 兼容 ISO 639-1
}

const DEFAULT_LANGUAGE = 'en'

/**
 * 检测文本语言
 * @param text 要检测的文本
 * @returns 语言代码 'zh' | 'en'
 */
export async function detectLanguage(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return DEFAULT_LANGUAGE
  }

  try {
    // 使用 franc-min 检测语言
    const result = francAll(text)

    // francAll 返回三元组数组，取第一个（最可能的语言）
    const detectedCode = result[0]?.[0] || 'und'

    // 映射到项目语言代码
    const mappedCode = LANGUAGE_CODE_MAP[detectedCode]

    return mappedCode || DEFAULT_LANGUAGE
  } catch (error) {
    console.error('Language detection error:', error)
    return DEFAULT_LANGUAGE
  }
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages(): string[] {
  return ['zh', 'en']
}

/**
 * 验证语言代码是否有效
 */
export function isValidLanguageCode(code: string): boolean {
  return getSupportedLanguages().includes(code)
}
