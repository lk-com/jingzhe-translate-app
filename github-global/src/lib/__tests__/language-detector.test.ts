import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectLanguage, getSupportedLanguages, isValidLanguageCode } from '../language-detector'

// Mock franc-min - francAll returns array of [code, score] tuples
vi.mock('franc-min', () => ({
  francAll: vi.fn()
}))

import { francAll } from 'franc-min'

describe('language-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectLanguage', () => {
    it('should return zh when franc returns cmn (Chinese)', async () => {
      vi.mocked(francAll).mockReturnValue([['cmn', 1]])
      const result = await detectLanguage('你好世界')
      expect(result).toBe('zh')
    })

    it('should return zh when franc returns zho (Chinese)', async () => {
      vi.mocked(francAll).mockReturnValue([['zho', 1]])
      const result = await detectLanguage('中文测试')
      expect(result).toBe('zh')
    })

    it('should return en when franc returns eng (English)', async () => {
      vi.mocked(francAll).mockReturnValue([['eng', 1]])
      const result = await detectLanguage('Hello World')
      expect(result).toBe('en')
    })

    it('should return en for unknown language codes', async () => {
      vi.mocked(francAll).mockReturnValue([['und', 1]])
      const result = await detectLanguage('some text')
      expect(result).toBe('en')
    })

    it('should return default language for empty text', async () => {
      const result = await detectLanguage('')
      expect(result).toBe('en')
    })

    it('should return default language for whitespace-only text', async () => {
      const result = await detectLanguage('   ')
      expect(result).toBe('en')
    })

    it('should return default language when franc throws error', async () => {
      vi.mocked(francAll).mockImplementation(() => {
        throw new Error('Detection failed')
      })
      const result = await detectLanguage('test')
      expect(result).toBe('en')
    })

    it('should handle ISO 639-1 codes directly', async () => {
      vi.mocked(francAll).mockReturnValue([['zh', 1]])
      const result = await detectLanguage('测试')
      expect(result).toBe('zh')
    })
  })

  describe('getSupportedLanguages', () => {
    it('should return supported language codes', () => {
      const languages = getSupportedLanguages()
      expect(languages).toContain('zh')
      expect(languages).toContain('en')
      expect(languages.length).toBe(2)
    })
  })

  describe('isValidLanguageCode', () => {
    it('should return true for valid language codes', () => {
      expect(isValidLanguageCode('zh')).toBe(true)
      expect(isValidLanguageCode('en')).toBe(true)
    })

    it('should return false for invalid language codes', () => {
      expect(isValidLanguageCode('fr')).toBe(false)
      expect(isValidLanguageCode('de')).toBe(false)
      expect(isValidLanguageCode('')).toBe(false)
    })
  })
})
