import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, fetchUserInfo } from '@/lib/github'
import { createSession } from '@/lib/session'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  // Build correct base URL for redirect (handle reverse proxy)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url

  // Handle user denial
  if (error) {
    const errorUrl = new URL('/login', baseUrl)
    errorUrl.searchParams.set('error', error)
    return NextResponse.redirect(errorUrl)
  }

  // Validate required parameters
  if (!code || !state) {
    const errorUrl = new URL('/login', baseUrl)
    errorUrl.searchParams.set('error', 'invalid_request')
    return NextResponse.redirect(errorUrl)
  }

  // Validate state parameter (CSRF protection)
  const returnUrl = await redis.get(`oauth:state:${state}`)
  if (!returnUrl) {
    const errorUrl = new URL('/login', baseUrl)
    errorUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(errorUrl)
  }

  // Clean up state
  await redis.del(`oauth:state:${state}`)

  try {
    // Exchange code for token
    console.log('[Auth] Exchanging code for token...')
    const tokenResponse = await exchangeCodeForToken(code)
    console.log('[Auth] Token response:', tokenResponse)

    if (tokenResponse.error) {
      throw new Error(tokenResponse.error_description || tokenResponse.error)
    }

    // Fetch user info from GitHub
    console.log('[Auth] Fetching user info...')
    const { user, primaryEmail } = await fetchUserInfo(tokenResponse.access_token)
    console.log('[Auth] User info:', user)

    // Create or update user in database (不再存储 githubToken)
    const dbUser = await prisma.user.upsert({
      where: { githubId: user.id },
      update: {
        githubLogin: user.login,
        updatedAt: new Date(),
      },
      create: {
        githubId: user.id,
        githubLogin: user.login,
      },
    })

    // Create session
    const sessionId = await createSession(dbUser.id, user.login)

    // Build correct base URL for redirect (handle reverse proxy)
    const response = NextResponse.redirect(new URL(returnUrl, baseUrl))
    response.headers.set('Set-Cookie', `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`)

    return response
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err)
    console.error('[Auth] Error details:', err instanceof Error ? err.stack : err)

    const errorUrl = new URL('/login', baseUrl)
    errorUrl.searchParams.set('error', 'auth_failed')

    return NextResponse.redirect(errorUrl)
  }
}
