import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/logout/route'
import { getSessionId, destroySession, clearSessionCookie } from '@/lib/session'

vi.mock('@/lib/session', () => ({
  getSessionId: vi.fn(),
  destroySession: vi.fn(),
  clearSessionCookie: vi.fn(),
}))

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    redirect: vi.fn().mockReturnValue({
      headers: {
        set: vi.fn(),
      },
    }),
  },
}))

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(clearSessionCookie).mockReturnValue('session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  })

  it('should destroy session in Redis when session ID exists', async () => {
    vi.mocked(getSessionId).mockResolvedValue('test-session-id')
    vi.mocked(destroySession).mockResolvedValue(undefined)

    const mockRequest = {
      url: 'http://localhost:3000/api/auth/logout',
    } as any

    await POST(mockRequest)

    expect(getSessionId).toHaveBeenCalled()
    expect(destroySession).toHaveBeenCalledWith('test-session-id')
  })

  it('should not call destroySession when session ID is null', async () => {
    vi.mocked(getSessionId).mockResolvedValue(null)

    const mockRequest = {
      url: 'http://localhost:3000/api/auth/logout',
    } as any

    await POST(mockRequest)

    expect(getSessionId).toHaveBeenCalled()
    expect(destroySession).not.toHaveBeenCalled()
  })

  it('should clear session cookie even when Redis deletion fails', async () => {
    vi.mocked(getSessionId).mockResolvedValue('test-session-id')
    vi.mocked(destroySession).mockRejectedValue(new Error('Redis connection failed'))

    const mockRequest = {
      url: 'http://localhost:3000/api/auth/logout',
    } as any

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await POST(mockRequest)

    expect(destroySession).toHaveBeenCalledWith('test-session-id')
    expect(clearSessionCookie).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to destroy session in Redis:',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })

  it('should redirect to homepage after logout', async () => {
    vi.mocked(getSessionId).mockResolvedValue('test-session-id')
    vi.mocked(destroySession).mockResolvedValue(undefined)

    const mockRequest = {
      url: 'http://localhost:3000/api/auth/logout',
    } as any

    const response = await POST(mockRequest)

    expect(response.headers.set).toHaveBeenCalledWith('Set-Cookie', expect.any(String))
  })
})
