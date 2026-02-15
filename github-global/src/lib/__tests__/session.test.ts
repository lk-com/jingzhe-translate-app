import { describe, it, expect } from 'vitest'
import { serializeCookie, setSessionCookie, clearSessionCookie } from '@/lib/session'

describe('session', () => {
  describe('serializeCookie', () => {
    it('should serialize cookie with all options', () => {
      const result = serializeCookie('test', 'value', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      })

      expect(result).toContain('test=value')
      expect(result).toContain('HttpOnly')
      expect(result).toContain('Secure')
      expect(result).toContain('SameSite=lax')
      expect(result).toContain('Max-Age=3600')
      expect(result).toContain('Path=/')
    })

    it('should handle minimal options', () => {
      const result = serializeCookie('session', 'abc123', {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      })

      expect(result).toBe('session=abc123; SameSite=lax; Max-Age=3600; Path=/')
    })
  })

  describe('setSessionCookie', () => {
    it('should set HttpOnly and secure in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const result = setSessionCookie('session123')

      expect(result).toContain('HttpOnly')
      expect(result).toContain('Secure')
      expect(result).toContain('SameSite=lax')

      process.env.NODE_ENV = originalEnv
    })

    it('should not set Secure in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const result = setSessionCookie('session123')

      expect(result).toContain('HttpOnly')
      expect(result).not.toContain('Secure')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('clearSessionCookie', () => {
    it('should clear session cookie', () => {
      const result = clearSessionCookie()

      expect(result).toContain('HttpOnly')
      expect(result).toContain('session=')
    })
  })
})
