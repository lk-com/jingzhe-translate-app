import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import redis from '@/lib/redis'

export async function GET(request: NextRequest) {
  const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/repos'

  // Generate state for CSRF protection
  const state = nanoid(32)

  // Store state in Redis with 10 minute expiry
  await redis.setex(`oauth:state:${state}`, 600, returnUrl)

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: 'repo user:email read:user',
    state,
    allow_signup: 'true',
  })

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
