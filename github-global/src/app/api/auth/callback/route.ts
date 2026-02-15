import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, fetchUserInfo } from '@/lib/github'
import { createSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  // Handle user denial
  if (error) {
    const errorUrl = new URL('/login')
    errorUrl.searchParams.set('error', error)
    return NextResponse.redirect(errorUrl)
  }

  // Validate required parameters
  if (!code || !state) {
    const errorUrl = new URL('/login')
    errorUrl.searchParams.set('error', 'invalid_request')
    return NextResponse.redirect(errorUrl)
  }

  // Validate state parameter (CSRF protection)
  const returnUrl = await redis.get(`oauth:state:${state}`)
  if (!returnUrl) {
    const errorUrl = new URL('/login')
    errorUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(errorUrl)
  }

  // Clean up state
  await redis.del(`oauth:state:${state}`)

  try {
    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(code)

    if (tokenResponse.error) {
      throw new Error(tokenResponse.error_description || tokenResponse.error)
    }

    // Fetch user info from GitHub
    const { user, primaryEmail } = await fetchUserInfo(tokenResponse.access_token)

    // Encrypt the access token before storing
    const encryptedToken = encrypt(tokenResponse.access_token)

    // Create or update user in database
    const dbUser = await prisma.user.upsert({
      where: { githubId: user.id },
      update: {
        githubLogin: user.login,
        githubToken: encryptedToken,
        updatedAt: new Date(),
      },
      create: {
        githubId: user.id,
        githubLogin: user.login,
        githubToken: encryptedToken,
      },
    })

    // Create session
    const sessionId = await createSession(dbUser.id, user.login)

    // Set session cookie
    const response = NextResponse.redirect(new URL(returnUrl, request.url))
    response.headers.set('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`)

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)

    const errorUrl = new URL('/login')
    errorUrl.searchParams.set('error', 'auth_failed')

    return NextResponse.redirect(errorUrl)
  }
}
