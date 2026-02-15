const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_URL = 'https://api.github.com'

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
  html_url: string
}

export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

export function buildAuthorizationUrl(state: string, returnUrl?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: 'repo user:email read:user',
    state,
    allow_signup: 'true',
  })

  if (returnUrl) {
    params.set('return_url', returnUrl)
  }

  return `${GITHUB_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`)
  }

  return response.json()
}

export async function fetchUserInfo(accessToken: string): Promise<{
  user: GitHubUser
  primaryEmail: string
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  const [userResponse, emailsResponse] = await Promise.all([
    fetch(`${GITHUB_API_URL}/user`, { headers }),
    fetch(`${GITHUB_API_URL}/user/emails`, { headers }),
  ])

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user: ${userResponse.status}`)
  }

  const user: GitHubUser = await userResponse.json()
  const emails: GitHubEmail[] = await emailsResponse.json()

  const primaryEmail = emails.find(e => e.primary)?.email || user.email

  if (!primaryEmail) {
    throw new Error('Unable to get user email')
  }

  return { user, primaryEmail }
}

export async function fetchUserRepositories(
  accessToken: string,
  page: number = 1,
  perPage: number = 30
): Promise<{
  repos: Array<{
    id: number
    name: string
    full_name: string
    description: string | null
    private: boolean
    html_url: string
    default_branch: string
    updated_at: string
  }>
  hasMore: boolean
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  const response = await fetch(
    `${GITHUB_API_URL}/user/repos?sort=updated&page=${page}&per_page=${perPage}`,
    { headers }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch repositories: ${response.status}`)
  }

  const repos = await response.json()
  const hasMore = repos.length === perPage

  return { repos, hasMore }
}

export async function fetchRepoContents(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = '',
  ref?: string
): Promise<Array<{
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  sha: string
}>> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  let url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`
  if (ref) {
    url += `?ref=${ref}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch contents: ${response.status}`)
  }

  return response.json()
}

export async function fetchFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{
  content: string
  encoding: string
  sha: string
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  let url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`
  if (ref) {
    url += `?ref=${ref}`
  }

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }

  const data = await response.json()

  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8')

  return {
    content,
    encoding: data.encoding,
    sha: data.sha,
  }
}

export async function getDefaultBranch(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch repo: ${response.status}`)
  }

  const data = await response.json()
  return data.default_branch
}

export async function createOrUpdateFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
  branch?: string
): Promise<{
  commit_sha: string
  content: {
    path: string
    sha: string
  }
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString('base64'),
  }

  if (sha) body.sha = sha
  if (branch) body.branch = branch

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create/update file: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function createPullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{
  number: number
  html_url: string
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        head,
        base,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create PR: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function listCommits(
  accessToken: string,
  owner: string,
  repo: string,
  perPage: number = 100
): Promise<Array<{
  sha: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
}>> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    { headers }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch commits: ${response.status}`)
  }

  return response.json()
}

export async function compareCommits(
  accessToken: string,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{
  files: Array<{
    filename: string
    status: 'added' | 'removed' | 'modified' | 'renamed'
    additions: number
    deletions: number
    patch?: string
  }>
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  }

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/compare/${base}...${head}`,
    { headers }
  )

  if (!response.ok) {
    throw new Error(`Failed to compare commits: ${response.status}`)
  }

  return response.json()
}
