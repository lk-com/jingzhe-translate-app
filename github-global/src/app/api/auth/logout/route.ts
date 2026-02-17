import { NextRequest, NextResponse } from 'next/server'
import { destroySession, getSessionId, clearSessionCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
  const sessionId = await getSessionId()

  if (sessionId) {
    try {
      await destroySession(sessionId)
    } catch (error) {
      console.error('Failed to destroy session in Redis:', error)
    }
  }

  const response = NextResponse.redirect(new URL('/', request.url))
  response.headers.set('Set-Cookie', clearSessionCookie())

  return response
}
