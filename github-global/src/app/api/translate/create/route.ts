import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchRepoContents, fetchFileContent } from '@/lib/github'
import { decrypt } from '@/lib/crypto'
import { translateLargeContent } from '@/lib/translation'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

interface TranslationFile {
  path: string
  content: string
  sha: string
}

async function getMarkdownFiles(
  accessToken: string,
  owner: string,
  repo: string,
  ref: string
): Promise<TranslationFile[]> {
  const files: TranslationFile[] = []

  async function scanDirectory(path: string) {
    const contents = await fetchRepoContents(accessToken, owner, repo, path, ref)

    for (const item of contents) {
      if (item.type === 'dir') {
        if (!['node_modules', '.git', 'dist', 'build'].includes(item.name)) {
          await scanDirectory(item.path)
        }
      } else if (item.name.endsWith('.md')) {
        try {
          const fileData = await fetchFileContent(accessToken, owner, repo, item.path, ref)
          files.push({
            path: item.path,
            content: fileData.content,
            sha: fileData.sha,
          })
        } catch (error) {
          console.error(`Failed to fetch file: ${item.path}`, error)
        }
      }
    }
  }

  await scanDirectory('')
  return files
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { repositoryId, targetLanguages, type = 'full' } = body

    if (!repositoryId || !targetLanguages || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: repositoryId, targetLanguages' },
        { status: 400 }
      )
    }

    // Get repository from database
    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
        userId: session.userId,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Determine which API key to use
    let apiKey = process.env.OPENROUTER_API_KEY

    if (user.openrouterApiKey) {
      apiKey = decrypt(user.openrouterApiKey)
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please add your OpenRouter API key in settings.' },
        { status: 400 }
      )
    }

    // Get GitHub token
    const githubToken = decrypt(user.githubToken)

    // Get markdown files
    const markdownFiles = await getMarkdownFiles(
      githubToken,
      repository.owner,
      repository.name,
      repository.defaultBranch
    )

    // Create translation task
    const task = await prisma.translationTask.create({
      data: {
        repositoryId: repository.id,
        status: 'running',
        type,
        targetLanguages: targetLanguages,
        totalFiles: markdownFiles.length * targetLanguages.length,
        processedFiles: 0,
        startedAt: new Date(),
      },
    })

    // Start translation in background
    translateInBackground(task.id, repository, markdownFiles, targetLanguages, apiKey)

    return NextResponse.json({
      taskId: task.id,
      totalFiles: markdownFiles.length,
      targetLanguages,
    })
  } catch (error) {
    console.error('Create translation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function translateInBackground(
  taskId: number,
  repository: {
    id: number
    owner: string
    name: string
    defaultBranch: string
    baseLanguage: string
  },
  files: TranslationFile[],
  targetLanguages: string[],
  apiKey: string
) {
  const results: Record<string, Record<string, { path: string; translated: string; sha: string }>> = {}

  try {
    for (const lang of targetLanguages) {
      results[lang] = {}

      for (const file of files) {
        try {
          const translated = await translateLargeContent(
            file.content,
            lang,
            repository.baseLanguage,
            apiKey
          )

          results[lang][file.path] = {
            path: file.path,
            translated,
            sha: file.sha,
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

          // Store intermediate result in Redis
          await redis.hset(`translation:${taskId}:results`, lang, JSON.stringify(results[lang]))
        } catch (error) {
          console.error(`Failed to translate ${file.path} to ${lang}:`, error)

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

    // Update repository last commit SHA
    await prisma.repository.update({
      where: { id: repository.id },
      data: {
        lastCommitSha: 'translated',
      },
    })
  } catch (error) {
    console.error('Translation task failed:', error)

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
