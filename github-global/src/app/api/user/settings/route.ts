import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { encrypt, decrypt } from '@/lib/crypto'
import prisma from '@/lib/db'

// 预设厂商列表，用于验证
const VALID_PROVIDERS = ['openrouter', 'deepseek', 'doubao', 'qwen', 'custom']

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
        aiConfig: true,
        githubAppInstallDismissed: true,
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

    // 处理 aiConfig 返回（不返回实际的 apiKey）
    let aiConfigResponse = null
    if (user.aiConfig) {
      const config = user.aiConfig as Record<string, string>
      aiConfigResponse = {
        provider: config.provider,
        model: config.model,
        baseURL: config.baseURL || undefined,
        hasApiKey: !!config.apiKey,
      }
    }

    // Return whether user has API key set (not the actual key)
    return NextResponse.json({
      hasApiKey: !!(user.aiConfig || user.openrouterApiKey),
      aiConfig: aiConfigResponse,
      githubAppInstallDismissed: user.githubAppInstallDismissed,
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
    const { openrouterApiKey, aiConfig } = body

    // 处理新的 aiConfig
    if (aiConfig) {
      const { provider, apiKey, model, baseURL } = aiConfig

      // 验证 provider
      if (!provider || !VALID_PROVIDERS.includes(provider)) {
        return NextResponse.json(
          { error: 'Invalid provider. Must be one of: ' + VALID_PROVIDERS.join(', ') },
          { status: 400 }
        )
      }

      // 验证 apiKey
      if (!apiKey || typeof apiKey !== 'string') {
        return NextResponse.json(
          { error: 'API key is required' },
          { status: 400 }
        )
      }

      // 验证 model
      if (!model || typeof model !== 'string') {
        return NextResponse.json(
          { error: 'Model is required' },
          { status: 400 }
        )
      }

      // 自定义 provider 需要 baseURL
      if (provider === 'custom') {
        if (!baseURL || typeof baseURL !== 'string') {
          return NextResponse.json(
            { error: 'Base URL is required for custom provider' },
            { status: 400 }
          )
        }
      }

      // 加密并存储 aiConfig
      const encryptedConfig = {
        provider,
        apiKey: encrypt(apiKey),
        model,
        baseURL: baseURL || null,
      }

      // 先检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true },
      })

      if (!existingUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      await prisma.user.update({
        where: { id: session.userId },
        data: {
          aiConfig: encryptedConfig,
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        hasApiKey: true,
        aiConfig: {
          provider,
          model,
          baseURL: baseURL || undefined,
          hasApiKey: true,
        },
      })
    }

    // 处理旧的 openrouterApiKey（向后兼容）
    if (openrouterApiKey !== undefined) {
      // Validate API key format if provided
      if (openrouterApiKey) {
        if (!openrouterApiKey.startsWith('sk-or-v1-')) {
          return NextResponse.json(
            { error: 'Invalid OpenRouter API key format. Must start with sk-or-v1-' },
            { status: 400 }
          )
        }
      }

      // 先检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true },
      })

      if (!existingUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Update user settings
      await prisma.user.update({
        where: { id: session.userId },
        data: {
          openrouterApiKey: openrouterApiKey ? encrypt(openrouterApiKey) : null,
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        hasApiKey: !!openrouterApiKey,
      })
    }

    return NextResponse.json(
      { error: 'No valid configuration provided' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
