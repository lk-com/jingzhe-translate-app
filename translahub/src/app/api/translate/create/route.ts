import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchFileContentAsApp, fetchRepoContentsAsApp } from '@/lib/github-app'
import { decrypt } from '@/lib/crypto'
import { translateLargeContent } from '@/lib/translation'
import { getMarkdownFilesForIncremental, getLatestCommitSha } from '@/lib/change-detection'
import { PROVIDER_BASE_URLS, AIConfig } from '@/lib/ai-provider'
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
 * 文件命名规范：
 * - 基准语言（baseLanguage）的文件：保持原始文件名不变
 * - 其他语言版本的文件：统一采用英文命名
 *
 * 示例：
 * - 基准语言(中文): 入门指南.md -> 入门指南.md
 * - 英文版本: 入门指南.md -> getting-started.md
 * - 日文版本: 入门指南.md -> getting-started.md
 */

/**
 * 判断文件名是否只包含基本拉丁字符（ASCII）
 * 排除中文、日文、韩文等非拉丁字母
 */
function isBasicLatinFileName(fileName: string): boolean {
    const nameWithoutExt = fileName.replace(/\.md$/, '')
    return /^[\x20-\x7E]+$/.test(nameWithoutExt)
}

/**
 * 将非基准语言的文件名转换为英文命名
 * 规则：
 * 1. 已经是英文/数字命名，直接返回
 * 2. 非拉丁字母文件名（中文/日文/韩文等）转换为英文
 * 3. 统一使用小写语言后缀
 */
function normalizeFileName(fileName: string, targetLanguage: string): string {
    // 统一转为小写
    const normalizedTargetLang = targetLanguage.toLowerCase()

    // 提取语言后缀（如 .en.md, .ja.md）
    const langSuffixMatch = fileName.match(/\.([a-z]{2}(-[a-z]{2})?)\.md$/i)
    const hasLangSuffix = !!langSuffixMatch

    // 移除语言后缀进行处理
    let baseName = hasLangSuffix
        ? fileName.replace(/\.([a-z]{2}(-[a-z]{2})?)\.md$/i, '.md')
        : fileName

    // 如果已经是基本拉丁字符命名，直接返回
    if (isBasicLatinFileName(baseName)) {
        return hasLangSuffix
            ? baseName.replace('.md', `.${normalizedTargetLang}.md`)
            : baseName
    }

    // 中文到英文的映射表
    const chineseToEnglishMap: Record<string, string> = {
        '安装指南': 'installation-guide',
        '安装': 'installation',
        '快速开始': 'quick-start',
        '快速入门': 'quick-start',
        '开始': 'getting-started',
        '入门': 'getting-started',
        '入门指南': 'getting-started',
        '使用手册': 'user-guide',
        '使用指南': 'user-guide',
        '用户指南': 'user-guide',
        '用户手册': 'user-manual',
        '开发文档': 'development-guide',
        '开发者指南': 'developer-guide',
        '开发指南': 'development-guide',
        '贡献指南': 'contributing',
        '贡献': 'contributing',
        'API 文档': 'api-reference',
        'API文档': 'api-reference',
        'API': 'api',
        '接口文档': 'api-reference',
        '更新日志': 'changelog',
        '更新记录': 'changelog',
        '变更日志': 'changelog',
        '许可证': 'license',
        '授权': 'license',
        '版权': 'copyright',
        '常见问题': 'faq',
        'FAQ': 'faq',
        '问答': 'faq',
        '配置说明': 'configuration',
        '配置': 'configuration',
        '设置': 'settings',
        '部署指南': 'deployment-guide',
        '部署': 'deployment',
        '教程': 'tutorial',
        '教程指南': 'tutorial',
        '示例': 'examples',
        '样例': 'examples',
        '案例': 'examples',
        '文档': 'docs',
        '说明': 'guide',
        '总览': 'overview',
        '概述': 'overview',
        '简介': 'introduction',
        '介绍': 'introduction',
        '架构': 'architecture',
        '设计': 'design',
        '安全': 'security',
        '测试': 'testing',
        '发布': 'release',
        '版本': 'version',
        '关于': 'about',
        '联系': 'contact',
        '博客': 'blog',
        '新闻': 'news',
        '团队': 'team',
        '社区': 'community',
        '支持': 'support',
        '功能': 'features',
        '特性': 'features',
        '优势': 'benefits',
        '对比': 'comparison',
        '比较': 'comparison',
    }

    // 尝试匹配已知的中文文档名
    let englishName = baseName.replace(/\.md$/, '')
    for (const [cn, en] of Object.entries(chineseToEnglishMap)) {
        if (englishName.includes(cn) || englishName === cn) {
            englishName = en
            break
        }
    }

    // 检查是否成功转换
    if (englishName === baseName.replace(/\.md$/, '')) {
        englishName = baseName.replace(/\.md$/, '')
    }

    // 重新添加语言后缀（小写）
    return hasLangSuffix
        ? `${englishName}.${normalizedTargetLang}.md`
        : `${englishName}.md`
}

/**
 * 从文件名推断基准语言
 */
function detectBaseLanguageFromFileName(fileName: string): string | null {
    const langMatch = fileName.match(/\.([a-z]{2}(-[a-z]{2})?)\.md$/i)
    if (langMatch) {
        const lang = langMatch[1].toLowerCase()
        if (lang === 'cn') return 'zh'
        if (lang === 'tw' || lang === 'hk') return 'zh-TW'
        return lang
    }
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(fileName)) return 'zh'
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(fileName)) return 'ja'
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(fileName)) return 'ko'
    return null
}

/**
 * 获取有效的基准语言
 */
function getEffectiveBaseLanguage(repositoryBaseLanguage: string | null, fileName: string): string {
    if (repositoryBaseLanguage) return repositoryBaseLanguage
    const detected = detectBaseLanguageFromFileName(fileName)
    return detected || 'zh'
}

/**
 * 获取翻译后的文件路径
 * - 基准语言的文件名称保持不变
 * - 其他语言版本的文件名称统一转换为英文命名格式
 *
 * 示例：
 * - 原文: docs/入门指南.md, 基准语言: zh -> translations/zh/docs/入门指南.md
 * - 原文: docs/入门指南.md, 目标语言: en -> translations/en/docs/getting-started.md
 * - 原文: docs/README.md, 基准语言: en -> translations/en/docs/README.md
 */
function getTranslatedPath(originalPath: string, targetLanguage: string, baseLanguage: string): string {
    // 统一转为小写进行比对
    const normalizedTarget = targetLanguage.toLowerCase()
    const normalizedBase = baseLanguage.toLowerCase()

    const pathParts = originalPath.split('/')
    const fileName = pathParts.pop() || 'README.md'

    let finalFileName: string

    if (normalizedTarget === normalizedBase) {
        // 基准语言：保持原始文件名不变
        finalFileName = fileName
    } else {
        // 其他语言：转换为英文命名
        finalFileName = normalizeFileName(fileName, normalizedTarget)
    }

    // 构建最终路径：translations/{语言}/{目录}/{文件名}
    const translatedDir = pathParts.join('/')
    const translatedPath = translatedDir
        ? `translations/${normalizedTarget}/${translatedDir}/${finalFileName}`
        : `translations/${normalizedTarget}/${finalFileName}`

    return translatedPath.replace(/\/+/g, '/')
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

    // 获取 AI 配置
    const userWithAIConfig = user as (typeof user & { aiConfig: Record<string, string> | null })
    let aiConfig: AIConfig | null = null

    // 优先使用新的 aiConfig
    if (userWithAIConfig.aiConfig) {
      const config = userWithAIConfig.aiConfig
      aiConfig = {
        provider: config.provider,
        baseURL: config.baseURL,
        apiKey: decrypt(config.apiKey),
        model: config.model,
      }
    } else if (userWithAIConfig.openrouterApiKey) {
      // 向后兼容旧的 openrouterApiKey
      aiConfig = {
        provider: 'openrouter',
        baseURL: PROVIDER_BASE_URLS.openrouter,
        apiKey: decrypt(userWithAIConfig.openrouterApiKey),
        model: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
      }
    } else {
      // 使用系统默认
      aiConfig = {
        provider: 'openrouter',
        baseURL: PROVIDER_BASE_URLS.openrouter,
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model: process.env.DEFAULT_MODEL || 'openai/gpt-4o-mini',
      }
    }

    if (!aiConfig?.apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please add your API key in settings.' },
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
      aiConfig!,
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
  aiConfig: AIConfig,
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
            aiConfig!
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
