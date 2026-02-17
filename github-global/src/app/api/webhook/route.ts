import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { translateLargeContent } from '@/lib/translation'
import { fetchFileContentAsApp } from '@/lib/github-app'
import { PROVIDER_BASE_URLS, AIConfig } from '@/lib/ai-provider'

// GitHub webhook event types
type WebhookEvent = 'push' | 'pull_request' | 'ping'

interface PushEvent {
  ref: string
  before: string
  after: string
  repository: {
    id: number
    name: string
    full_name: string
  }
  pusher: {
    name: string
    email: string
  }
  commits: Array<{
    id: string
    message: string
    added: string[]
    removed: string[]
    modified: string[]
  }>
}

interface PullRequestEvent {
  action: string
  number: number
  pull_request: {
    id: number
    title: string
    head: {
      ref: string
      sha: string
    }
    base: {
      ref: string
    }
  }
  repository: {
    id: number
    name: string
    full_name: string
  }
}

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    )
  } catch {
    return false
  }
}

function isMarkdownFile(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.mdx')
}

async function processPushEvent(
  repositoryId: number,
  commits: PushEvent['commits'],
  userId: number
) {
  // Get repository info
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  })

  if (!repository || !repository.targetLanguages) {
    return { success: false, reason: 'Repository not found or no target languages' }
  }

  const targetLanguages = repository.targetLanguages as string[]
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { success: false, reason: 'User not found' }
  }

  // Check if repository has installationId (GitHub App)
  if (!repository.installationId) {
    return { success: false, reason: 'GitHub App not installed on this repository' }
  }

  // 获取 AI 配置
  let aiConfig: AIConfig | null = null

  if (user.aiConfig) {
    const config = user.aiConfig as Record<string, string>
    aiConfig = {
      provider: config.provider,
      baseURL: config.baseURL,
      apiKey: decrypt(config.apiKey),
      model: config.model,
    }
  } else if (user.openrouterApiKey) {
    aiConfig = {
      provider: 'openrouter',
      baseURL: PROVIDER_BASE_URLS.openrouter,
      apiKey: decrypt(user.openrouterApiKey),
      model: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
    }
  } else {
    aiConfig = {
      provider: 'openrouter',
      baseURL: PROVIDER_BASE_URLS.openrouter,
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
    }
  }

  if (!aiConfig?.apiKey) {
    return { success: false, reason: 'No API key configured' }
  }

  // Collect all changed markdown files
  const changedFiles = new Set<string>()

  for (const commit of commits) {
    commit.added.forEach((file) => {
      if (isMarkdownFile(file)) changedFiles.add(file)
    })
    commit.modified.forEach((file) => {
      if (isMarkdownFile(file)) changedFiles.add(file)
    })
  }

  if (changedFiles.size === 0) {
    return { success: true, reason: 'No markdown files changed' }
  }

  // Create translation task
  const task = await prisma.translationTask.create({
    data: {
      repositoryId: repository.id,
      status: 'running',
      type: 'incremental',
      targetLanguages: targetLanguages,
      totalFiles: changedFiles.size * targetLanguages.length,
      processedFiles: 0,
      startedAt: new Date(),
    },
  })

  // Process translation in background
  processIncrementalTranslation(
    task.id,
    repository,
    Array.from(changedFiles),
    targetLanguages,
    aiConfig!,
    repository.installationId
  )

  return {
    success: true,
    taskId: task.id,
    filesCount: changedFiles.size,
    languages: targetLanguages,
  }
}

async function processIncrementalTranslation(
  taskId: number,
  repository: {
    id: number
    owner: string
    name: string
    defaultBranch: string
    baseLanguage: string
    installationId: number | null
  },
  files: string[],
  targetLanguages: string[],
  aiConfig: AIConfig,
  installationId: number | null
) {
  if (!installationId) {
    console.error('Installation ID is required for translation')
    return
  }

  const results: Record<string, Record<string, { path: string; translated: string; sha: string }>> = {}

  try {
    for (const lang of targetLanguages) {
      results[lang] = {}

      for (const filePath of files) {
        try {
          // Fetch original file
          const fileData = await fetchFileContentAsApp(
            installationId,
            repository.owner,
            repository.name,
            filePath,
            repository.defaultBranch
          )

          // Translate content
          const translated = await translateLargeContent(
            fileData.content,
            lang,
            repository.baseLanguage,
            aiConfig!
          )

          results[lang][filePath] = {
            path: filePath,
            translated,
            sha: fileData.sha,
          }

          // Update progress
          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              processedFiles: {
                increment: 1,
              },
            },
          })
        } catch (error) {
          console.error(`Failed to translate ${filePath} to ${lang}:`, error)

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              failedFiles: {
                increment: 1,
              },
            },
          })
        }
      }
    }

    // Update task as completed
    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: results,
      },
    })

    // Create a branch for the translation changes
    const branchName = `translation-${Date.now()}`

    // Note: Full PR creation would require more complex logic
    // For now, we just complete the translation task
    console.log(`Translation completed for task ${taskId}`)
  } catch (error) {
    console.error('Incremental translation failed:', error)

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    const event = request.headers.get('x-github-event') as WebhookEvent

    // Get repository ID from query params
    const { searchParams } = new URL(request.url)
    const repoId = searchParams.get('repoId')

    if (!repoId) {
      return NextResponse.json(
        { error: 'Missing repository ID' },
        { status: 400 }
      )
    }

    const repositoryId = parseInt(repoId, 10)

    // Get repository and its webhook secret
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        user: true,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      )
    }

    // Verify webhook signature if secret exists
    if (repository.webhookSecret) {
      const isValid = verifySignature(body, signature, repository.webhookSecret)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Handle ping event
    if (event === 'ping') {
      return NextResponse.json({ message: 'pong' })
    }

    // Handle push event
    if (event === 'push') {
      const payload = JSON.parse(body) as PushEvent

      // Only process pushes to default branch
      if (payload.ref !== `refs/heads/${repository.defaultBranch}`) {
        return NextResponse.json({
          message: 'Ignored: not a push to default branch',
        })
      }

      const result = await processPushEvent(
        repositoryId,
        payload.commits,
        repository.userId
      )

      return NextResponse.json(result)
    }

    // Handle pull request event
    if (event === 'pull_request') {
      const payload = JSON.parse(body) as PullRequestEvent

      // Only process opened and synchronize events
      if (!['opened', 'synchronize'].includes(payload.action)) {
        return NextResponse.json({
          message: 'Ignored: not an open or sync event',
        })
      }

      // For PR events, we could create a preview translation
      // This is a placeholder for future implementation
      return NextResponse.json({
        message: 'Pull request event received',
        action: payload.action,
        prNumber: payload.number,
      })
    }

    return NextResponse.json({
      message: 'Event ignored',
      event,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return webhook endpoint info
  return NextResponse.json({
    endpoint: '/api/webhook?repoId=<repository-id>',
    events: ['push', 'pull_request', 'ping'],
    description: 'GitHub webhook endpoint for automatic translation',
  })
}
