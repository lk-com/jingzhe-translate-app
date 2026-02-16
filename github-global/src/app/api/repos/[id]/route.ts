import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const repositoryId = parseInt(id)

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: 'Invalid repository ID' },
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

    return NextResponse.json({
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: `${repository.owner}/${repository.name}`,
        description: null, // Could be fetched from GitHub API if needed
        htmlUrl: `https://github.com/${repository.owner}/${repository.name}`,
        defaultBranch: repository.defaultBranch,
        baseLanguage: repository.baseLanguage,
        targetLanguages: repository.targetLanguages,
        configured: true,
        lastCommitSha: repository.lastCommitSha,
        ignoreRules: repository.ignoreRules,
      },
    })
  } catch (error) {
    console.error('Get repo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const repositoryId = parseInt(id)

    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: 'Invalid repository ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { baseLanguage, targetLanguages, ignoreRules } = body

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

    // Update repository
    const updatedRepository = await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        ...(baseLanguage !== undefined && { baseLanguage }),
        ...(targetLanguages !== undefined && { targetLanguages }),
        ...(ignoreRules !== undefined && { ignoreRules }),
      },
    })

    return NextResponse.json({
      success: true,
      repository: {
        id: updatedRepository.id,
        name: updatedRepository.name,
        fullName: `${updatedRepository.owner}/${updatedRepository.name}`,
        baseLanguage: updatedRepository.baseLanguage,
        targetLanguages: updatedRepository.targetLanguages,
      },
    })
  } catch (error) {
    console.error('Update repo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
