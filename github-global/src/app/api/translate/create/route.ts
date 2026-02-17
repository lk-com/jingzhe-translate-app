import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchFileContentAsApp, fetchRepoContentsAsApp } from '@/lib/github-app'
import { decrypt } from '@/lib/crypto'
import { translateLargeContent } from '@/lib/translation'
import { getMarkdownFilesForIncremental, getLatestCommitSha } from '@/lib/change-detection'
import prisma from '@/lib/db'
import redis from '@/lib/redis'

interface TranslationFile {
  path: string
  content: string
  sha: string
}

async function getMarkdownFiles(
  installationId: number,
  owner: string,
  repo: string,
  ref: string
): Promise<TranslationFile[]> {
  const files: TranslationFile[] = []

  async function scanDirectory(path: string) {
    const contents = await fetchRepoContentsAsApp(installationId, owner, repo, path, ref)

    for (const item of contents) {
      if (item.type === 'dir') {
        if (!['node_modules', '.git', 'dist', 'build', 'translations'].includes(item.name)) {
          await scanDirectory(item.path)
        }
      } else if (item.name.endsWith('.md')) {
        try {
          const fileData = await fetchFileContentAsApp(installationId, owner, repo, item.path, ref)
          files.push({
            path: item.path,
            content: fileData.content,
            sha: fileData.sha,
          })
        } catch (error) {
          console.error(`Failed to fetch file: ${item.path}`, error)
        }
      }
    }
  }

  await scanDirectory('')
  return files
}

/**
 * 将中文文件名转换为英文命名格式
 * 规则：
 * - README.zh.md -> README.md (基准语言保持不变)
 * - 其他中文文档名保持原样，但添加语言后缀
 * - 非基准语言的文件统一使用英文命名
 */
function normalizeFileName(fileName: string, baseLanguage: string): string {
  // 如果已经是英文命名，直接返回
  if (/^[a-zA-Z0-9._-]+\.md$/.test(fileName)) {
    return fileName
  }

  // 中文 README 文件处理
  if (fileName.startsWith('README')) {
    // README.zh.md, README.cn.md -> README.md
    if (fileName.match(/\.zh\.md$/) || fileName.match(/\.cn\.md$/)) {
      return 'README.md'
    }
    // README.en.md -> README.en.md (保持不变)
    if (fileName.match(/\.en\.md$/)) {
      return fileName
    }
    // README.md -> README.md (保持不变)
    if (fileName === 'README.md') {
      return fileName
    }
  }

  // 其他中文文档名，尝试提取基础名称并转换
  // 例如："安装指南.zh.md" -> "installation-guide.zh.md"
  const baseName = fileName.replace(/\.md$/, '')
  const chineseToEnglishMap: Record<string, string> = {
    '安装指南': 'installation-guide',
    '快速开始': 'quick-start',
    '使用手册': 'user-guide',
    '开发文档': 'development-guide',
    'API 文档': 'api-reference',
    '贡献指南': 'contributing',
    '更新日志': 'changelog',
    '许可证': 'license',
    '常见问题': 'faq',
    '配置说明': 'configuration',
    '部署指南': 'deployment-guide',
    '用户指南': 'user-guide',
    '教程': 'tutorial',
    '示例': 'examples',
    '文档': 'docs',
    '说明': 'guide',
  }

  // 尝试匹配已知的中文文档名
  for (const [cn, en] of Object.entries(chineseToEnglishMap)) {
    if (baseName.includes(cn)) {
      // 保留语言后缀
      const langSuffix = fileName.match(/\.(zh|en|ja|ko|es|fr|de)\.md$/)?.[1]
      if (langSuffix && langSuffix !== baseLanguage) {
        return `${en}.${langSuffix}.md`
      }
      return `${en}.md`
    }
  }

  // 无法匹配的中文名称，使用拼音或保持原名
  return fileName
}

/**
 * 获取翻译后的文件路径
 * - 基准语言的文件名称保持不变
 * - 其他语言版本的文件名称统一转换为英文命名格式
 */
function getTranslatedPath(originalPath: string, language: string, baseLanguage: string): string {
  const pathParts = originalPath.split('/')
  const fileName = pathParts.pop() || 'README.md'

  // 如果不是基准语言，需要转换文件名
  const normalizedFileName = language !== baseLanguage
    ? normalizeFileName(fileName, baseLanguage)
    : fileName

  return `translations/${language}/${pathParts.join('/')}/${normalizedFileName}`.replace(/\/+/g, '/')
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
    const { repositoryId, targetLanguages, type = 'full', selectedFiles = [] } = body

    const repositoryIdNum = parseInt(repositoryId, 10)

    if (!repositoryIdNum || !targetLanguages || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: repositoryId, targetLanguages' },
        { status: 400 }
      )
    }

    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryIdNum,
        userId: session.userId,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let apiKey = process.env.OPENROUTER_API_KEY

    if (user.openrouterApiKey) {
      apiKey = decrypt(user.openrouterApiKey)
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please add your OpenRouter API key in settings.' },
        { status: 400 }
      )
    }

    // Check if installationId exists (GitHub App must be installed)
    if (!repository.installationId) {
      return NextResponse.json(
        { error: 'GitHub App not installed. Please install the GitHub App first.' },
        { status: 400 }
      )
    }

    let markdownFiles: TranslationFile[] = []
    let latestSha: string | null = null
    let isIncremental = false

    if (type === 'incremental' && repository.baselineSha) {
      isIncremental = true
      const incrementalResult = await getMarkdownFilesForIncremental(
        repository.installationId,
        repository.owner,
        repository.name,
        repository.baselineSha,
        repository.ignoreRules
      )

      latestSha = incrementalResult.latestSha

      if (incrementalResult.files.length === 0) {
        return NextResponse.json({
          message: 'No changes detected since last translation',
          hasChanges: false,
          latestSha,
        })
      }

      const filePaths = incrementalResult.files.map(f => f.path)
      const allFiles = await getMarkdownFiles(
        repository.installationId,
        repository.owner,
        repository.name,
        repository.defaultBranch
      )
      markdownFiles = allFiles.filter(f => filePaths.includes(f.path))
    } else {
      markdownFiles = await getMarkdownFiles(
        repository.installationId,
        repository.owner,
        repository.name,
        repository.defaultBranch
      )

      try {
        latestSha = await getLatestCommitSha(repository.installationId, repository.owner, repository.name)
      } catch (e) {
        console.error('Failed to get latest SHA:', e)
      }
    }

    if (selectedFiles.length > 0) {
      const selectedPaths = new Set(selectedFiles)
      markdownFiles = markdownFiles.filter(f => selectedPaths.has(f.path))
    }

    if (markdownFiles.length === 0) {
      return NextResponse.json(
        { error: 'No translatable files found' },
        { status: 400 }
      )
    }

    const task = await prisma.translationTask.create({
      data: {
        repositoryId: repository.id,
        status: 'running',
        type: isIncremental ? 'incremental' : 'full',
        targetLanguages: targetLanguages,
        totalFiles: markdownFiles.length * targetLanguages.length,
        processedFiles: 0,
        startedAt: new Date(),
      },
    })

    translateInBackground(
      task.id,
      {
        id: repository.id,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch,
        baseLanguage: repository.baseLanguage,
      },
      markdownFiles,
      targetLanguages,
      apiKey,
      latestSha
    )

    return NextResponse.json({
      taskId: task.id,
      totalFiles: markdownFiles.length,
      targetLanguages,
      type: isIncremental ? 'incremental' : 'full',
    })
  } catch (error) {
    console.error('Create translation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function translateInBackground(
  taskId: number,
  repository: {
    id: number
    owner: string
    name: string
    defaultBranch: string
    baseLanguage: string
  },
  files: TranslationFile[],
  targetLanguages: string[],
  apiKey: string,
  latestSha: string | null
) {
  const results: Record<string, Record<string, { path: string; translated: string; sha: string }>> = {}
  const failures: Record<string, Record<string, { path: string; error: string }>> = {}
  let failedCount = 0
  let successCount = 0

  try {
    for (const lang of targetLanguages) {
      results[lang] = {}
      failures[lang] = {}

      for (const file of files) {
        try {
          const translated = await translateLargeContent(
            file.content,
            lang,
            repository.baseLanguage,
            apiKey
          )

          results[lang][file.path] = {
            path: file.path,
            translated,
            sha: file.sha,
          }

          const translatedPath = getTranslatedPath(file.path, lang, repository.baseLanguage)

          await prisma.translationResult.create({
            data: {
              taskId,
              originalPath: file.path,
              translatedPath,
              language: lang,
              originalContent: file.content,
              translatedContent: translated,
              originalSha: file.sha,
              status: 'completed',
            },
          })

          successCount++

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              processedFiles: successCount + failedCount,
            },
          })

          await redis.hset(`translation:${taskId}:results`, lang, JSON.stringify(results[lang]))
        } catch (error) {
          console.error(`Failed to translate ${file.path} to ${lang}:`, error)
          failedCount++

          failures[lang][file.path] = {
            path: file.path,
            error: error instanceof Error ? error.message : 'Unknown error',
          }

          const translatedPath = getTranslatedPath(file.path, lang, repository.baseLanguage)
          await prisma.translationResult.create({
            data: {
              taskId,
              originalPath: file.path,
              translatedPath,
              language: lang,
              originalContent: file.content,
              translatedContent: '',
              originalSha: file.sha,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch(e => console.error('Failed to record error:', e))
        }
      }
    }

    const totalFiles = files.length * targetLanguages.length
    const isAllFailed = failedCount === totalFiles

    let errorSummary: string | null = null
    if (failedCount > 0) {
      const uniqueErrors = new Set<string>()
      Object.values(failures).forEach(langFailures => {
        Object.values(langFailures).forEach(failure => {
          uniqueErrors.add(failure.error)
        })
      })

      if (uniqueErrors.size === 1) {
        errorSummary = `${failedCount}/${totalFiles} files failed: ${Array.from(uniqueErrors)[0]}`
      } else if (uniqueErrors.size <= 3) {
        errorSummary = `${failedCount}/${totalFiles} files failed. Errors: ${Array.from(uniqueErrors).join('; ')}`
      } else {
        errorSummary = `${failedCount}/${totalFiles} files failed. ${uniqueErrors.size} different errors occurred.`
      }
    }

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: isAllFailed ? 'failed' : 'completed',
        completedAt: new Date(),
        result: {
          translations: results,
          failures: failures,
        },
        errorMessage: errorSummary,
      },
    })

    if (latestSha) {
      await prisma.repository.update({
        where: { id: repository.id },
        data: {
          lastCommitSha: latestSha,
        },
      })
    }
  } catch (error) {
    console.error('Translation task failed:', error)

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}
