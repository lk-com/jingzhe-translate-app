import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { fetchRepoContentsAsApp, fetchFileContentAsApp } from '@/lib/github-app'
import prisma from '@/lib/db'

interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  sha: string
  children?: FileTreeItem[]
}

async function buildFileTree(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<FileTreeItem[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  const contents = await fetchRepoContentsAsApp(installationId, owner, repo, path, ref)

  const items: FileTreeItem[] = []

  for (const item of contents) {
    if (item.type === 'dir') {
      // Skip common directories we don't need to explore
      if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(item.name)) {
        continue
      }

      const children = await buildFileTree(
        installationId,
        owner,
        repo,
        item.path,
        ref,
        maxDepth,
        currentDepth + 1
      )

      items.push({
        name: item.name,
        path: item.path,
        type: 'dir',
        sha: item.sha,
        children,
      })
    } else {
      // Only include markdown files
      if (item.name.endsWith('.md') || item.name === '.github-global-ignore') {
        items.push({
          name: item.name,
          path: item.path,
          type: 'file',
          sha: item.sha,
        })
      }
    }
  }

  // Sort: directories first, then files
  return items.sort((a, b) => {
    if (a.type === 'dir' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'dir') return 1
    return a.name.localeCompare(b.name)
  })
}

export async function GET(
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

    const repoId = parseInt(id)
    const path = request.nextUrl.searchParams.get('path') || ''
    const filePath = request.nextUrl.searchParams.get('filePath')
    const ref = request.nextUrl.searchParams.get('ref')

    // Get repository from database
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        userId: session.userId,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      )
    }

    // Check installationId
    if (!repository.installationId) {
      return NextResponse.json(
        { error: 'GitHub App not installed on this repository' },
        { status: 400 }
      )
    }

    // If filePath is provided, return file content
    if (filePath) {
      try {
        const fileData = await fetchFileContentAsApp(
          repository.installationId,
          repository.owner,
          repository.name,
          filePath,
          ref || repository.defaultBranch
        )

        return NextResponse.json({
          content: fileData.content,
          sha: fileData.sha,
        })
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to fetch file content' },
          { status: 500 }
        )
      }
    }

    // Otherwise, return file tree
    const fileTree = await buildFileTree(
      repository.installationId,
      repository.owner,
      repository.name,
      path,
      ref || repository.defaultBranch
    )

    return NextResponse.json({
      tree: fileTree,
    })
  } catch (error) {
    console.error('Get files error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
