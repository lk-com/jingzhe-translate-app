import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import { getInstallationIdForRepo, clearInstallationToken } from '@/lib/github-app'

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if force refresh is requested (clears stale installationIds first)
    const body = await request.json().catch(() => ({}))
    const forceRefresh = body.force === true

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        repositories: forceRefresh ? true : {
          where: {
            installationId: null,
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

    // If force refresh, get all repositories that have a stale installationId
    let reposToRefresh = user.repositories
    if (forceRefresh) {
      // Get repositories with installationId that might be stale
      const reposWithInstallations = await prisma.repository.findMany({
        where: { userId: session.userId },
        select: { id: true, owner: true, name: true, installationId: true },
      })
      reposToRefresh = reposWithInstallations as any

      if (reposToRefresh.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No repositories found',
          updated: 0,
        })
      }
    }

    if (reposToRefresh.length === 0) {
      return NextResponse.json({
        success: true,
        message: forceRefresh
          ? 'All repositories are ready (no stale installation IDs)'
          : 'All repositories already have installation ID',
        updated: 0,
      })
    }

    let updatedCount = 0
    let clearedCount = 0

    // For each repository, clear stale installationId and try to get a new one
    for (const repo of reposToRefresh) {
      try {
        // Clear the old installation token from cache
        if (repo.installationId) {
          clearInstallationToken(repo.installationId)
          clearedCount++
        }

        console.log(`[Refresh Installation] Checking installation for ${repo.owner}/${repo.name}`)
        const installationId = await getInstallationIdForRepo(repo.owner, repo.name)

        if (installationId) {
          await prisma.repository.update({
            where: { id: repo.id },
            data: { installationId },
          })
          updatedCount++
          console.log(`[Refresh Installation] Updated installationId for ${repo.owner}/${repo.name}: ${installationId}`)
        } else {
          // No installation found - clear the installationId
          await prisma.repository.update({
            where: { id: repo.id },
            data: { installationId: null },
          })
          clearedCount++
          console.log(`[Refresh Installation] Cleared installationId for ${repo.owner}/${repo.name} (not installed)`)
        }
      } catch (error) {
        console.error(`[Refresh Installation] Failed to get installation for ${repo.owner}/${repo.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedCount} stale installation IDs, updated ${updatedCount} repositories`,
      cleared: clearedCount,
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
