import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import {
  createOrUpdateFileAsApp,
  createPullRequestAsApp,
  createBranchAsApp,
  getBranchAsApp,
  fetchFileContentAsApp,
} from '@/lib/github-app'
import {
  generateBranchName,
  generateCommitMessage,
  generatePRDescription,
} from '@/lib/change-detection'
import {
  updateReadmeWithTranslations,
  generateReadmeUpdateCommitMessage,
} from '@/lib/readme-updater'

export async function POST(
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
    const body = await request.json()
    const { createPR = true, branchName: customBranchName } = body

    const task = await prisma.translationTask.findFirst({
      where: {
        id: taskId,
        repository: {
          userId: session.userId,
        },
      },
      include: {
        repository: true,
        results: {
          where: {
            status: 'completed',
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

    if (task.status !== 'completed') {
      return NextResponse.json(
        { error: 'Translation task not completed yet' },
        { status: 400 }
      )
    }

    if (task.results.length === 0) {
      return NextResponse.json(
        { error: 'No completed translations to commit' },
        { status: 400 }
      )
    }

    const { owner, name, defaultBranch, installationId } = task.repository

    if (!installationId) {
      return NextResponse.json(
        { error: 'GitHub App not installed on this repository. Please install the GitHub App first.' },
        { status: 400 }
      )
    }

    const targetLanguages = task.targetLanguages as string[]
    const branchName = customBranchName || generateBranchName(targetLanguages)

    const existingBranch = await getBranchAsApp(installationId, owner, name, branchName).catch(() => null)

    if (existingBranch) {
      const timestamp = Date.now()
      const newBranchName = `${branchName}-${timestamp}`
      await createBranchAsApp(installationId, owner, name, newBranchName, defaultBranch)
      await commitTranslationsAsApp(
        installationId,
        owner,
        name,
        newBranchName,
        task.results,
        targetLanguages,
        task.type === 'incremental',
        task.repository.defaultBranch
      )

      const prResult = createPR
        ? await createPullRequestAsApp(
            installationId,
            owner,
            name,
            `🌐 Translation Update (${targetLanguages.join(', ')})`,
            generatePRDescription(targetLanguages, task.results.length, task.type === 'incremental', taskId),
            newBranchName,
            defaultBranch
          ).catch(err => {
            console.error('Failed to create PR:', err)
            return null
          })
        : null

      await prisma.translationTask.update({
        where: { id: taskId },
        data: {
          branchName: newBranchName,
          prUrl: prResult?.html_url,
          prNumber: prResult?.number,
        },
      })

      return NextResponse.json({
        success: true,
        branchName: newBranchName,
        prUrl: prResult?.html_url,
        prNumber: prResult?.number,
        filesCommitted: task.results.length,
      })
    }

    await createBranchAsApp(installationId, owner, name, branchName, defaultBranch)

    await commitTranslationsAsApp(
      installationId,
      owner,
      name,
      branchName,
      task.results,
      targetLanguages,
      task.type === 'incremental',
      task.repository.defaultBranch
    )

    const prResult = createPR
      ? await createPullRequestAsApp(
          installationId,
          owner,
          name,
          `🌐 Translation Update (${targetLanguages.join(', ')})`,
          generatePRDescription(targetLanguages, task.results.length, task.type === 'incremental', taskId),
          branchName,
          defaultBranch
        ).catch(err => {
          console.error('Failed to create PR:', err)
          return null
        })
      : null

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        branchName,
        prUrl: prResult?.html_url,
        prNumber: prResult?.number,
      },
    })

    await prisma.repository.update({
      where: { id: task.repository.id },
      data: {
        baselineSha: task.repository.lastCommitSha,
      },
    })

    return NextResponse.json({
      success: true,
      branchName,
      prUrl: prResult?.html_url,
      prNumber: prResult?.number,
      filesCommitted: task.results.length,
    })
  } catch (error) {
    console.error('Commit translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

async function commitTranslationsAsApp(
  installationId: number,
  owner: string,
  repo: string,
  branch: string,
  results: Array<{
    originalPath: string
    translatedPath: string
    language: string
    translatedContent: any
  }>,
  targetLanguages: string[],
  isIncremental: boolean,
  defaultBranch: string
) {
  const filesByPath = new Map<string, { language: string; content: string; path: string }>()

  for (const result of results) {
    const translatedContent = typeof result.translatedContent === 'string'
      ? result.translatedContent
      : JSON.stringify(result.translatedContent)

    filesByPath.set(result.translatedPath, {
      language: result.language,
      content: translatedContent,
      path: result.translatedPath,
    })
  }

  const sortedFiles = Array.from(filesByPath.values()).sort((a, b) => {
    const pathA = a.path.split('/')
    const pathB = b.path.split('/')
    return pathA.length - pathB.length || a.path.localeCompare(b.path)
  })

  let commitCount = 0
  const batchSize = 10

  for (let i = 0; i < sortedFiles.length; i += batchSize) {
    const batch = sortedFiles.slice(i, i + batchSize)

    for (const file of batch) {
      const commitMessage = generateCommitMessage(
        [file.language],
        1,
        isIncremental
      )

      try {
        let fileSha: string | undefined
        try {
          const existingFile = await fetchFileContentAsApp(
            installationId,
            owner,
            repo,
            file.path,
            branch
          )
          fileSha = existingFile.sha
        } catch {
          // 文件不存在，创建新文件
        }

        await createOrUpdateFileAsApp(
          installationId,
          owner,
          repo,
          file.path,
          file.content,
          commitMessage,
          fileSha,
          branch
        )
        commitCount++
      } catch (error) {
        console.error(`Failed to commit ${file.path}:`, error)
        throw error
      }
    }
  }

  // 更新 README.md 添加多语言翻译列表
  try {
    console.log('Updating README.md with translation list...')

    // 尝试获取主 README.md
    const readmePath = 'README.md'
    let originalReadmeContent = '# README'
    let readmeSha: string | undefined

    try {
      const readmeData = await fetchFileContentAsApp(
        installationId,
        owner,
        repo,
        readmePath,
        defaultBranch
      )
      originalReadmeContent = readmeData.content
      readmeSha = readmeData.sha
    } catch (error) {
      console.log('README.md not found, will create a new one')
    }

    // 准备翻译信息
    const translationInfo = results.map(r => ({
      language: r.language,
      path: r.translatedPath,
    }))

    // 生成更新后的 README 内容
    const updatedReadme = updateReadmeWithTranslations(originalReadmeContent, translationInfo, {
      owner,
      name: repo,
      defaultBranch,
    })

    // 提交更新后的 README
    const readmeCommitMessage = generateReadmeUpdateCommitMessage(targetLanguages)
    await createOrUpdateFileAsApp(
      installationId,
      owner,
      repo,
      readmePath,
      updatedReadme,
      readmeCommitMessage,
      readmeSha,
      branch
    )
    console.log('README.md updated successfully')
  } catch (error) {
    console.error('Failed to update README.md:', error)
    // README 更新失败不影响翻译文件的提交
  }

  return commitCount
}
