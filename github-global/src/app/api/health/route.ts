import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
    health.services.database = 'ok'
  } catch (error) {
    health.services.database = 'error'
    health.status = 'degraded'
  }

  // Check Redis
  try {
    await redis.ping()
    health.services.redis = 'ok'
  } catch (error) {
    health.services.redis = 'error'
    health.status = 'degraded'
  }

  const statusCode = health.status === 'ok' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}
