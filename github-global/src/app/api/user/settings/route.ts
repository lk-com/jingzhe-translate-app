import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { encrypt, decrypt } from '@/lib/crypto'
import prisma from '@/lib/db'

export async function GET() {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        openrouterApiKey: true,
        dailyQuota: true,
        isWhitelisted: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Return whether user has API key set (not the actual key)
    return NextResponse.json({
      hasApiKey: !!user.openrouterApiKey,
      dailyQuota: user.dailyQuota,
      isWhitelisted: user.isWhitelisted,
    })
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { openrouterApiKey } = body

    // Validate API key format if provided
    if (openrouterApiKey) {
      if (!openrouterApiKey.startsWith('sk-or-v1-')) {
        return NextResponse.json(
          { error: 'Invalid OpenRouter API key format. Must start with sk-or-v1-' },
          { status: 400 }
        )
      }
    }

    // Update user settings
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        openrouterApiKey: openrouterApiKey ? encrypt(openrouterApiKey) : null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        githubLogin: true,
        openrouterApiKey: true,
      },
    })

    return NextResponse.json({
      success: true,
      hasApiKey: !!user.openrouterApiKey,
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
