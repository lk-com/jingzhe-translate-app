import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import prisma from '@/lib/db'
import { generateToken } from '@/lib/crypto'

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
    const { repositoryId } = body

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Missing repositoryId' },
        { status: 400 }
      )
    }

    // Verify repository belongs to user
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

    // Generate webhook secret
    const webhookSecret = generateToken()

    // Update repository with webhook secret
    await prisma.repository.update({
      where: { id: repositoryId },
      data: {
        webhookSecret,
      },
    })

    // Construct webhook URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/webhook?repoId=${repositoryId}`

    return NextResponse.json({
      webhookUrl,
      secret: webhookSecret,
      instructions: [
        '1. Go to your GitHub repository Settings > Webhooks',
        '2. Add new webhook with the URL above',
        '3. Set content type to application/json',
        '4. Add the secret key provided above',
        '5. Select events: push, pull requests',
      ],
    })
  } catch (error) {
    console.error('Create webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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

    const { searchParams } = new URL(request.url)
    const repositoryId = searchParams.get('repositoryId')

    if (!repositoryId) {
      return NextResponse.json(
        { error: 'Missing repositoryId' },
        { status: 400 }
      )
    }

    const repository = await prisma.repository.findFirst({
      where: {
        id: parseInt(repositoryId, 10),
        userId: session.userId,
      },
    })

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/webhook?repoId=${repositoryId}`

    return NextResponse.json({
      webhookUrl,
      hasSecret: !!repository.webhookSecret,
      repository: {
        id: repository.id,
        name: repository.name,
        owner: repository.owner,
      },
    })
  } catch (error) {
    console.error('Get webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
