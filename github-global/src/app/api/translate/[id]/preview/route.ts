import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const taskId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('language')
    const filePath = searchParams.get('path')

    const task = await prisma.translationTask.findFirst({
      where: {
        id: taskId,
        repository: {
          userId: session.userId,
        },
      },
      include: {
        repository: true,
        results: language ? {
          where: { language },
        } : undefined,
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    if (task.status !== 'completed') {
      return NextResponse.json({
        status: task.status,
        message: 'Translation not completed yet',
        progress: {
          total: task.totalFiles,
          processed: task.processedFiles,
          failed: task.failedFiles,
        },
      })
    }

    if (filePath && language) {
      const result = await prisma.translationResult.findUnique({
        where: {
          taskId_originalPath_language: {
            taskId,
            originalPath: filePath,
            language,
          },
        },
      })

      if (!result) {
        return NextResponse.json(
          { error: 'Translation result not found for this file' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        file: {
          originalPath: result.originalPath,
          translatedPath: result.translatedPath,
          language: result.language,
          originalContent: result.originalContent,
          translatedContent: result.translatedContent,
          status: result.status,
        },
      })
    }

    if (language) {
      const langResults = await prisma.translationResult.findMany({
        where: {
          taskId,
          language,
        },
        select: {
          originalPath: true,
          translatedPath: true,
          status: true,
        },
      })

      return NextResponse.json({
        language,
        files: langResults,
        totalFiles: langResults.length,
        completedFiles: langResults.filter(r => r.status === 'completed').length,
      })
    }

    const allResults = await prisma.translationResult.groupBy({
      by: ['language'],
      where: { taskId },
      _count: {
        id: true,
      },
    })

    const languages = (task.targetLanguages as string[]) || []

    const summary = languages.map(lang => {
      const langData = allResults.find(r => r.language === lang)
      return {
        language: lang,
        totalFiles: langData?._count.id || 0,
      }
    })

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      type: task.type,
      repository: {
        owner: task.repository.owner,
        name: task.repository.name,
      },
      languages: summary,
      branchName: task.branchName,
      prUrl: task.prUrl,
      prNumber: task.prNumber,
    })
  } catch (error) {
    console.error('Get translation preview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
