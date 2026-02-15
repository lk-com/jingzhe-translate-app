import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'

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

    // Get task
    const task = await prisma.translationTask.findFirst({
      where: {
        id: taskId,
        repository: {
          userId: session.userId,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
            owner: true,
            name: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      task: {
        id: task.id,
        status: task.status,
        type: task.type,
        targetLanguages: task.targetLanguages,
        totalFiles: task.totalFiles,
        processedFiles: task.processedFiles,
        failedFiles: task.failedFiles,
        errorMessage: task.errorMessage,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        createdAt: task.createdAt,
      },
      repository: {
        id: task.repository.id,
        owner: task.repository.owner,
        name: task.repository.name,
      },
    })
  } catch (error) {
    console.error('Get translation status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
