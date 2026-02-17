import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serializeCookie, setSessionCookie, clearSessionCookie, getSessionId } from '@/lib/session'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { cookies } from 'next/headers'

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
    const originalEnv = process.env.NODE_ENV

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('should set HttpOnly and secure in production', () => {
      const result = setSessionCookie('session123')

      expect(result).toContain('HttpOnly')
      expect(result).toContain('Secure')
      expect(result).toContain('SameSite=lax')
    })

    it('should not set Secure in development', () => {
      vi.stubEnv('NODE_ENV', 'development')

      const result = setSessionCookie('session123')

      expect(result).toContain('HttpOnly')
      expect(result).not.toContain('Secure')
    })
  })

  describe('clearSessionCookie', () => {
    it('should clear session cookie', () => {
      const result = clearSessionCookie()

      expect(result).toContain('HttpOnly')
      expect(result).toContain('session=')
    })
  })

  describe('getSessionId', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return session ID when cookie exists', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'test-session-id' }),
      } as any)

      const result = await getSessionId()

      expect(result).toBe('test-session-id')
    })

    it('should return null when cookie does not exist', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as any)

      const result = await getSessionId()

      expect(result).toBeNull()
    })

    it('should return null when cookie value is empty', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: '' }),
      } as any)

      const result = await getSessionId()

      expect(result).toBeNull()
    })
  })
})
