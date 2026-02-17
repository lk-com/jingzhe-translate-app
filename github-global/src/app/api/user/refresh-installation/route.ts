import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import { getInstallationIdForRepo } from '@/lib/github-app'

export async function POST(request: NextRequest) {
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
      include: {
        repositories: {
          where: {
            installationId: null, // 只查询没有 installationId 的仓库
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.repositories.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All repositories already have installation ID',
        updated: 0,
      })
    }

    let updatedCount = 0

    // 对每个没有 installationId 的仓库，尝试获取 installationId
    for (const repo of user.repositories) {
      try {
        console.log(`[Refresh Installation] Checking installation for ${repo.owner}/${repo.name}`)
        const installationId = await getInstallationIdForRepo(repo.owner, repo.name)

        if (installationId) {
          await prisma.repository.update({
            where: { id: repo.id },
            data: { installationId },
          })
          updatedCount++
          console.log(`[Refresh Installation] Updated installationId for ${repo.owner}/${repo.name}: ${installationId}`)
        }
      } catch (error) {
        console.error(`[Refresh Installation] Failed to get installation for ${repo.owner}/${repo.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} repository installation IDs`,
      updated: updatedCount,
    })
  } catch (error) {
    console.error('Refresh installation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
