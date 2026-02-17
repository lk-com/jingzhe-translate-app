import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import redis from './redis'

const SESSION_PREFIX = 'session:'
const SESSION_EXPIRY = 7 * 24 * 60 * 60 // 7 days in seconds

export interface SessionData {
  userId: number
  githubLogin: string
  expiresAt: number
}

interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  maxAge: number
  path: string
}

export async function createSession(userId: number, githubLogin: string): Promise<string> {
  const sessionId = uuidv4()
  const expiresAt = Date.now() + SESSION_EXPIRY * 1000

  const sessionData: SessionData = {
    userId,
    githubLogin,
    expiresAt,
  }

  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    SESSION_EXPIRY,
    JSON.stringify(sessionData)
  )

  return sessionId
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)

  if (!data) {
    return null
  }

  const session = JSON.parse(data) as SessionData

  // Check if session expired
  if (Date.now() > session.expiresAt) {
    await destroySession(sessionId)
    return null
  }

  return session
}

export async function destroySession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`)
}

export async function getCurrentUser(): Promise<SessionData | null> {
  const sessionId = await getSessionId()

  if (!sessionId) {
    return null
  }

  return getSession(sessionId)
}

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('session')?.value || null
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  let cookieString = `${name}=${value}`

  if (options.httpOnly) cookieString += '; HttpOnly'
  if (options.secure) cookieString += '; Secure'
  if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`
  if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`
  if (options.path) cookieString += `; Path=${options.path}`

  return cookieString
}

export function setSessionCookie(sessionId: string): string {
  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY,
    path: '/',
  }

  return serializeCookie('session', sessionId, options)
}

export function clearSessionCookie(): string {
  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }

  return serializeCookie('session', '', options)
}
