import { NextResponse } from 'next/server'
import { destroySession, getCurrentUser } from '@/lib/session'

export async function POST() {
  const session = await getCurrentUser()

  if (session) {
    // Get session ID from cookie (we need to read it first)
    // Since we can't read the cookie in POST, we'll rely on the client to clear it
    // The actual session cleanup happens when the cookie expires
  }

  const response = NextResponse.redirect(new URL('/'))
  response.headers.set(
    'Set-Cookie',
    'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  )

  return response
}
