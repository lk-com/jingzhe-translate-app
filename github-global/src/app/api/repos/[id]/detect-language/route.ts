import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchRepoContents, fetchFileContent } from '@/lib/github'
import { detectLanguage } from '@/lib/language-detector'
import { decrypt } from '@/lib/crypto'
import prisma from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentUser()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const repoId = parseInt(id)

    // 获取仓库
    const repository = await prisma.repository.findUnique({
      where: { id: repoId }
    })

    if (!repository || repository.userId !== session.userId) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
    }

    // 获取用户 GitHub Token
    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const githubToken = decrypt(user.githubToken)

    // 获取 README 内容
    const readmeFiles = ['README.md', 'README.zh.md', 'README.en.md', 'README.cn.md']
    let content = ''

    for (const file of readmeFiles) {
      try {
        const result = await fetchFileContent(
          githubToken,
          repository.owner,
          repository.name,
          file,
          repository.defaultBranch
        )
        content = result.content
        break
      } catch {
        continue
      }
    }

    // 如果没有找到 README，尝试 docs 目录
    if (!content) {
      try {
        const docsContents = await fetchRepoContents(
          githubToken,
          repository.owner,
          repository.name,
          'docs',
          repository.defaultBranch
        )
        const mdFiles = docsContents.filter(f => f.type === 'file' && f.name.endsWith('.md'))

        for (const file of mdFiles.slice(0, 3)) {
          const result = await fetchFileContent(
            githubToken,
            repository.owner,
            repository.name,
            file.path,
            repository.defaultBranch
          )
          content += result.content + '\n'
        }
      } catch {
        // docs 目录不存在或为空
      }
    }

    // 检测语言
    const detectedLanguage = await detectLanguage(content.slice(0, 100 * 1024))

    // 更新仓库语言
    await prisma.repository.update({
      where: { id: repoId },
      data: { baseLanguage: detectedLanguage }
    })

    return NextResponse.json({ baseLanguage: detectedLanguage })
  } catch (error) {
    console.error('Language detection error:', error)
    return NextResponse.json(
      { error: 'Language detection failed' },
      { status: 500 }
    )
  }
}
