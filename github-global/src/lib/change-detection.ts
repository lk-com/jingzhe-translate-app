import { compareCommitsAsApp, listCommitsAsApp, fetchRepoContentsAsApp } from './github-app'

export interface ChangedFile {
  path: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  oldPath?: string
}

export interface ChangeDetectionResult {
  hasChanges: boolean
  changedFiles: ChangedFile[]
  latestSha: string
  isForcePush: boolean
  baseSha?: string
}

export async function getLatestCommitSha(
  installationId: number,
  owner: string,
  repo: string
): Promise<string> {
  const commits = await listCommitsAsApp(installationId, owner, repo, 1)
  if (commits.length === 0) {
    throw new Error('No commits found in repository')
  }
  return commits[0].sha
}

export async function detectChanges(
  installationId: number,
  owner: string,
  repo: string,
  baselineSha: string | null
): Promise<ChangeDetectionResult> {
  const latestSha = await getLatestCommitSha(installationId, owner, repo)

  if (!baselineSha) {
    return {
      hasChanges: true,
      changedFiles: [],
      latestSha,
      isForcePush: false,
      baseSha: undefined,
    }
  }

  if (baselineSha === latestSha) {
    return {
      hasChanges: false,
      changedFiles: [],
      latestSha,
      isForcePush: false,
      baseSha: baselineSha,
    }
  }

  try {
    const comparison = await compareCommitsAsApp(installationId, owner, repo, baselineSha, latestSha)

    const changedFiles: ChangedFile[] = (comparison.files || [])
      .filter(file => file.status !== 'removed')
      .map(file => ({
        path: file.filename,
        status: file.status,
        oldPath: file.status === 'renamed' ? file.filename : undefined,
      }))

    return {
      hasChanges: changedFiles.length > 0,
      changedFiles,
      latestSha,
      isForcePush: false,
      baseSha: baselineSha,
    }
  } catch (error) {
    console.error('Compare commits error:', error)

    const commits = await listCommitsAsApp(installationId, owner, repo, 100)
    const baselineExists = commits.some(c => c.sha === baselineSha)

    if (!baselineExists) {
      console.log('Force push detected - baseline SHA not found in history')
      return {
        hasChanges: true,
        changedFiles: [],
        latestSha,
        isForcePush: true,
        baseSha: baselineSha,
      }
    }

    throw new Error('Failed to detect changes')
  }
}

export function filterMarkdownFiles(files: ChangedFile[]): ChangedFile[] {
  return files.filter(file => file.path.endsWith('.md'))
}

export function applyIgnoreRules(files: ChangedFile[], ignoreRules: string | null): ChangedFile[] {
  if (!ignoreRules) {
    return files
  }

  const patterns = ignoreRules
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  const regexPatterns = patterns.map(pattern => {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*')
    return new RegExp(`^${regexPattern}$`)
  })

  return files.filter(file => {
    return !regexPatterns.some(regex => regex.test(file.path))
  })
}

export async function getMarkdownFilesForIncremental(
  installationId: number,
  owner: string,
  repo: string,
  baselineSha: string | null,
  ignoreRules: string | null
): Promise<{
  files: Array<{ path: string; isNew: boolean }>
  latestSha: string
  isFullScan: boolean
}> {
  const changeResult = await detectChanges(installationId, owner, repo, baselineSha)

  if (!changeResult.hasChanges) {
    return {
      files: [],
      latestSha: changeResult.latestSha,
      isFullScan: false,
    }
  }

  if (!baselineSha || changeResult.isForcePush) {
    const allFiles = await getAllMarkdownFiles(installationId, owner, repo)
    const filteredFiles = applyIgnoreRules(
      allFiles.map(f => ({ path: f, status: 'added' as const })),
      ignoreRules
    )
    return {
      files: filteredFiles.map(f => ({ path: f.path, isNew: true })),
      latestSha: changeResult.latestSha,
      isFullScan: true,
    }
  }

  const markdownFiles = filterMarkdownFiles(changeResult.changedFiles)
  const filteredFiles = applyIgnoreRules(markdownFiles, ignoreRules)

  return {
    files: filteredFiles.map(f => ({
      path: f.path,
      isNew: f.status === 'added',
    })),
    latestSha: changeResult.latestSha,
    isFullScan: false,
  }
}

async function getAllMarkdownFiles(
  installationId: number,
  owner: string,
  repo: string
): Promise<string[]> {
  const files: string[] = []

  async function scanDirectory(path: string) {
    const contents = await fetchRepoContentsAsApp(installationId, owner, repo, path)

    for (const item of contents) {
      if (item.type === 'dir') {
        if (!['node_modules', '.git', 'dist', 'build', 'translations'].includes(item.name)) {
          await scanDirectory(item.path)
        }
      } else if (item.name.endsWith('.md')) {
        files.push(item.path)
      }
    }
  }

  await scanDirectory('')
  return files
}

export function generateBranchName(targetLanguages: string[]): string {
  const langSuffix = targetLanguages.length <= 3
    ? targetLanguages.join('-')
    : `${targetLanguages.length}-langs`
  const timestamp = Date.now()
  return `translation/${langSuffix}-${timestamp}`
}

export function generateCommitMessage(
  targetLanguages: string[],
  fileCount: number,
  isIncremental: boolean
): string {
  const langList = targetLanguages.length <= 3
    ? targetLanguages.map(l => getLanguageName(l)).join(', ')
    : `${targetLanguages.length} languages`

  const type = isIncremental ? 'Incremental' : 'Full'

  return `🌐 ${type} translation to ${langList}

- Translated ${fileCount} markdown file(s)
- Target languages: ${targetLanguages.join(', ')}

Generated by GitHub Global`
}

export function generatePRDescription(
  targetLanguages: string[],
  fileCount: number,
  isIncremental: boolean,
  taskId: number
): string {
  const langList = targetLanguages.map(l => `- ${getLanguageName(l)} (\`${l}\`)`).join('\n')

  return `## 🌐 Translation Update

This PR contains ${isIncremental ? 'incremental' : 'full'} translations for your documentation.

### Target Languages
${langList}

### Statistics
- **Files translated**: ${fileCount}
- **Translation type**: ${isIncremental ? 'Incremental (changed files only)' : 'Full (all files)'}

### Review Notes
- All translations are stored in \`translations/{lang}/\` directory
- Original file structure is preserved
- Technical terms and code blocks are preserved unchanged

---
*Task ID: ${taskId}*
*Generated by [GitHub Global](https://github.com/features/github-global)*`
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ru: 'Russian',
    pt: 'Portuguese',
    it: 'Italian',
    ar: 'Arabic',
    hi: 'Hindi',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    vi: 'Vietnamese',
    th: 'Thai',
    id: 'Indonesian',
    ms: 'Malay',
  }
  return names[code] || code
}
