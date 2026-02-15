import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchUserRepositories, getDefaultBranch } from '@/lib/github'
import { decrypt } from '@/lib/crypto'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const perPage = parseInt(request.nextUrl.searchParams.get('per_page') || '30')

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get GitHub token
    const githubToken = decrypt(user.githubToken)

    // Fetch repositories from GitHub
    const { repos, hasMore } = await fetchUserRepositories(githubToken, page, perPage)

    // Get saved repos from database
    const savedRepos = await prisma.repository.findMany({
      where: { userId: user.id },
      select: {
        githubRepoId: true,
        targetLanguages: true,
        baseLanguage: true,
        lastCommitSha: true,
      },
    })

    const savedReposMap = new Map<number, { githubRepoId: number; targetLanguages: unknown; baseLanguage: string; lastCommitSha: string | null }>(
      savedRepos.map((r: { githubRepoId: number; targetLanguages: unknown; baseLanguage: string; lastCommitSha: string | null }) => [r.githubRepoId, r])
    )

    // Merge GitHub repos with saved config
    const repositories = repos.map(repo => {
      const saved = savedReposMap.get(repo.id)
      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        configured: !!saved,
        targetLanguages: saved?.targetLanguages || [],
        baseLanguage: saved?.baseLanguage || 'en',
        lastCommitSha: saved?.lastCommitSha,
      }
    })

    return NextResponse.json({
      repositories,
      pagination: {
        page,
        perPage,
        hasMore,
      },
    })
  } catch (error) {
    console.error('Get repos error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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
    const { owner, name, githubRepoId, targetLanguages, baseLanguage, ignoreRules } = body

    if (!owner || !name || !githubRepoId) {
      return NextResponse.json(
        { error: 'Missing required fields: owner, name, githubRepoId' },
        { status: 400 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if repo already imported
    const existingRepo = await prisma.repository.findUnique({
      where: {
        userId_githubRepoId: {
          userId: user.id,
          githubRepoId,
        },
      },
    })

    if (existingRepo) {
      return NextResponse.json(
        { error: 'Repository already imported' },
        { status: 409 }
      )
    }

    // Get default branch from GitHub
    const githubToken = decrypt(user.githubToken)
    const defaultBranch = await getDefaultBranch(githubToken, owner, name)

    // Create repository record
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        githubRepoId,
        owner,
        name,
        defaultBranch,
        baseLanguage: baseLanguage || 'en',
        targetLanguages: targetLanguages || [],
        ignoreRules: ignoreRules || '',
      },
    })

    return NextResponse.json({
      success: true,
      repository: {
        id: repository.id,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch,
      },
    })
  } catch (error) {
    console.error('Import repo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
