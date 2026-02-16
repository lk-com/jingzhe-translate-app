import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchUserRepositories, getDefaultBranch, fetchRepoContents, fetchFileContent } from '@/lib/github'
import { detectLanguage } from '@/lib/language-detector'
import { decrypt } from '@/lib/crypto'
import prisma from '@/lib/db'

// 语言检测辅助函数
async function detectRepoLanguage(
  githubToken: string,
  owner: string,
  name: string,
  defaultBranch: string
): Promise<string> {
  try {
    // 获取文档文件列表
    const docFiles = [
      'README.md',
      'README.zh.md',
      'README.en.md',
      'README.cn.md',
      'docs/README.md',
    ]

    let combinedContent = ''

    // 尝试获取 README 文件
    for (const file of docFiles) {
      try {
        const content = await fetchFileContent(githubToken, owner, name, file, defaultBranch)
        combinedContent += content.content + '\n'
        break // 获取到一个 README 就足够了
      } catch {
        // 文件不存在，继续下一个
        continue
      }
    }

    // 如果没有找到 README，尝试获取 docs 目录
    if (!combinedContent) {
      try {
        const docsContents = await fetchRepoContents(githubToken, owner, name, 'docs', defaultBranch)
        const mdFiles = docsContents.filter(f => f.type === 'file' && f.name.endsWith('.md'))

        for (const file of mdFiles.slice(0, 3)) {
          const content = await fetchFileContent(githubToken, owner, name, file.path, defaultBranch)
          combinedContent += content.content + '\n'
        }
      } catch {
        // docs 目录不存在或为空
      }
    }

    // 限制内容长度（取前100KB，足够检测语言）
    const truncatedContent = combinedContent.slice(0, 100 * 1024)

    // 检测语言
    const detectedLanguage = await detectLanguage(truncatedContent)
    return detectedLanguage
  } catch (error) {
    console.error('Language detection error:', error)
    return 'en' // 默认英文
  }
}

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
        id: true,
        githubRepoId: true,
        targetLanguages: true,
        baseLanguage: true,
        lastCommitSha: true,
      },
    })

    const savedReposMap = new Map<number, { id: number; githubRepoId: number; targetLanguages: unknown; baseLanguage: string; lastCommitSha: string | null }>(
      savedRepos.map((r) => [r.githubRepoId, r])
    )

    // Merge GitHub repos with saved config
    const repositories = repos.map(repo => {
      const saved = savedReposMap.get(repo.id)
      return {
        id: saved ? saved.id : repo.id, // Use database ID if saved, otherwise GitHub ID
        githubRepoId: repo.id, // Always include GitHub repo ID for reference
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        configured: !!saved,
        targetLanguages: saved?.targetLanguages || [],
        baseLanguage: saved?.baseLanguage || 'zh',
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

    // 在创建仓库前先检测语言
    const detectedLanguage = await detectRepoLanguage(githubToken, owner, name, defaultBranch)

    // Create repository record
    const repository = await prisma.repository.create({
      data: {
        userId: user.id,
        githubRepoId,
        owner,
        name,
        defaultBranch,
        baseLanguage: baseLanguage || detectedLanguage, // 优先使用用户指定的语言，否则使用检测结果
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
