import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt, generateToken } from '@/lib/crypto'

// Set up test encryption key
const TEST_ENCRYPTION_KEY = 'test-encryption-key-32-chars-min!'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
})

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const originalText = 'Hello, World!'
      const encrypted = encrypt(originalText)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(originalText)
    })

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const text = 'Test message'
      const encrypted1 = encrypt(text)
      const encrypted2 = encrypt(text)

      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2)

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(text)
      expect(decrypt(encrypted2)).toBe(text)
    })

    it('should handle empty string', () => {
      const encrypted = encrypt('')
      expect(decrypt(encrypted)).toBe('')
    })

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const encrypted = encrypt(specialChars)
      expect(decrypt(encrypted)).toBe(specialChars)
    })

    it('should handle unicode characters', () => {
      const unicode = '你好世界🌍🎉'
      const encrypted = encrypt(unicode)
      expect(decrypt(encrypted)).toBe(unicode)
    })

    it('should handle long strings', () => {
      const longString = 'A'.repeat(10000)
      const encrypted = encrypt(longString)
      expect(decrypt(encrypted)).toBe(longString)
    })

    it('should throw error for invalid encrypted text format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format')
    })

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be at least 32 characters')
    })
  })

  describe('generateToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]+$/)
    })

    it('should generate unique tokens', () => {
      const token1 = generateToken()
      const token2 = generateToken()
      expect(token1).not.toBe(token2)
    })
  })
})
