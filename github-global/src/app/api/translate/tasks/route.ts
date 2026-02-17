import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
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

    const tasks = await prisma.translationTask.findMany({
      where: {
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    // Transform tasks to include result for debugging
    const tasksWithResult = tasks.map(task => ({
      ...task,
      // Only include failures summary in the API response to keep response size manageable
      failuresSummary: task.result && typeof task.result === 'object' && 'failures' in task.result
        ? Object.entries(task.result.failures as Record<string, Record<string, { path: string; error: string }>>)
            .flatMap(([lang, files]) =>
              Object.entries(files).map(([path, data]) => ({
                language: lang,
                path: data.path,
                error: data.error,
              }))
            )
        : null,
    }))

    return NextResponse.json({ tasks: tasksWithResult })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
