import crypto from "crypto";
import fs from "fs";
import path from "path";

const GITHUB_API_URL = "https://api.github.com";

// Cache for installation tokens
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Read private key from file
 */
function readPrivateKey(): string {
  const privateKeyPath =
    process.env.GITHUB_APP_PRIVATE_KEY_PATH || "private-key.pem";
  const fullPath = path.isAbsolute(privateKeyPath)
    ? privateKeyPath
    : path.join(process.cwd(), privateKeyPath);

  console.log('[GitHub App] Private key path:', fullPath);
  console.log('[GitHub App] Key file exists:', fs.existsSync(fullPath));

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Private key file not found: ${fullPath}`);
  }

  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Generate a JWT for GitHub App authentication
 */
function generateJWT(): string {
  console.log('[GitHub App] Reading private key...');
  const privateKey = readPrivateKey();
  console.log('[GitHub App] Private key loaded, length:', privateKey.length);
  const appId = process.env.GITHUB_APP_ID;
  console.log('[GitHub App] App ID:', appId);

  if (!appId) {
    throw new Error("GITHUB_APP_ID is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60, // 5 minutes - GitHub requires exp to be within 10 minutes
    iss: appId,
  };

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signingInput = `${header}.${body}`;

  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);

  return `${header}.${body}.${signature.toString("base64url")}`;
}

/**
 * Get installation access token for a specific installation
 */
export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  // Check cache for valid token
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  console.log('[GitHub App] Generating JWT for installation:', installationId);
  const jwt = generateJWT();
  console.log('[GitHub App] JWT generated, length:', jwt.length);

  console.log('[GitHub App] Requesting installation token from:', `${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`);
  const response = await fetch(
    `${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[GitHub App] Failed to get installation token:', response.status, error);
    throw new Error(
      `Failed to get installation token: ${response.status} - ${error}`,
    );
  }

  const data = await response.json();
  console.log('[GitHub App] Installation token response:', {
    token: data.token ? '***' + data.token.slice(-5) : 'none',
    permissions: data.permissions,
    repository_selection: data.repository_selection,
    expires_at: data.expires_at,
  });

  // Cache the token (subtract 5 minutes for safety margin)
  const expiresIn = 55 * 60 * 1000; // 55 minutes in milliseconds
  tokenCache = {
    token: data.token,
    expiresAt: Date.now() + expiresIn,
  };

  return data.token;
}

/**
 * Get list of installations for the GitHub App
 */
export async function getInstallations(): Promise<
  Array<{
    id: number;
    account: {
      login: string;
      type: string;
    };
  }>
> {
  const jwt = generateJWT();

  const response = await fetch(`${GITHUB_API_URL}/app/installations`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[GitHub App] Failed to get installations: ${response.status}`, errorBody);
    throw new Error(`Failed to get installations: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Get repositories accessible to an installation
 */
export async function getInstallationRepositories(
  installationId: number,
): Promise<
  Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>
> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(`${GITHUB_API_URL}/installation/repositories`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get installation repositories: ${response.status}`,
    );
  }

  const data = await response.json();
  return data.repositories;
}

/**
 * Get installation ID for a specific repository
 */
export async function getInstallationIdForRepo(
  owner: string,
  repoName: string,
): Promise<number | null> {
  console.log(`[GitHub App] Looking for installation ID for ${owner}/${repoName}`);

  const installations = await getInstallations();
  console.log(`[GitHub App] Found ${installations.length} installations`);

  for (const installation of installations) {
    try {
      console.log(`[GitHub App] Checking installation ${installation.id} for account ${installation.account.login}`);
      const repos = await getInstallationRepositories(installation.id);
      console.log(`[GitHub App] Installation ${installation.id} has ${repos.length} repos`);

      const found = repos.find(
        (r) => r.full_name === `${owner}/${repoName}` || r.name === repoName,
      );
      if (found) {
        console.log(`[GitHub App] Found repo ${found.full_name} in installation ${installation.id}`);
        return installation.id;
      }
    } catch (error) {
      console.error(
        `Failed to get repos for installation ${installation.id}:`,
        error,
      );
    }
  }

  console.log(`[GitHub App] No installation found for ${owner}/${repoName}`);
  return null;
}

/**
 * Fetch file content using installation token
 */
export async function fetchFileContentAsApp(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{
  content: string;
  sha: string;
}> {
  const token = await getInstallationToken(installationId);

  let url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
  if (ref) {
    url += `?ref=${ref}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");

  return {
    content,
    sha: data.sha,
  };
}

/**
 * Create or update file using installation token
 */
export async function createOrUpdateFileAsApp(
  installationId: number,
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  message: string,
  sha?: string,
  branch?: string,
): Promise<{
  commit: { sha: string };
  content: { sha: string } | null;
}> {
  const token = await getInstallationToken(installationId);

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
  };

  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to create/update file: ${response.status} - ${error}`,
    );
  }

  return response.json();
}

/**
 * Create a pull request using installation token
 */
export async function createPullRequestAsApp(
  installationId: number,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<{
  number: number;
  html_url: string;
}> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        head,
        base,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PR: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Create a branch using installation token
 */
export async function createBranchAsApp(
  installationId: number,
  owner: string,
  repo: string,
  branchName: string,
  fromBranch: string = "main",
): Promise<void> {
  const token = await getInstallationToken(installationId);

  // Get the SHA of the source branch
  const refResponse = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!refResponse.ok) {
    throw new Error(`Failed to get source branch ref: ${refResponse.status}`);
  }

  const refData = await refResponse.json();
  const sha = refData.object.sha;

  // Create the new branch
  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create branch: ${response.status} - ${error}`);
  }
}

/**
 * Get branch info using installation token
 */
export async function getBranchAsApp(
  installationId: number,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ name: string; commit: { sha: string } }> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null as unknown as { name: string; commit: { sha: string } };
    }
    throw new Error(`Failed to get branch: ${response.status}`);
  }

  return response.json();
}

/**
 * Get user repositories using installation token
 */
export async function fetchUserRepositoriesAsApp(
  installationId: number,
  page: number = 1,
  perPage: number = 30
): Promise<{
  repos: Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    default_branch: string;
    updated_at: string;
  }>;
  hasMore: boolean;
}> {
  const token = await getInstallationToken(installationId);

  console.log('[GitHub App] Fetching repos with token:', token.slice(-10));
  const response = await fetch(
    `${GITHUB_API_URL}/installation/repositories?page=${page}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GitHub App] Failed to fetch repositories:', response.status, response.statusText, errorText);
    throw new Error(`Failed to fetch repositories: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const repos = data.repositories || [];
  return {
    repos,
    hasMore: repos.length === perPage,
  };
}

/**
 * Get repository contents using installation token
 */
export async function fetchRepoContentsAsApp(
  installationId: number,
  owner: string,
  repo: string,
  path: string = "",
  ref?: string
): Promise<Array<{
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}>> {
  const token = await getInstallationToken(installationId);

  let url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
  if (ref) {
    url += `?ref=${ref}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contents: ${response.status}`);
  }

  const data = await response.json();
  // API returns a single object if path is a file, array if it's a directory
  return Array.isArray(data) ? data : [data];
}

/**
 * Get default branch using installation token
 */
export async function getDefaultBranchAsApp(
  installationId: number,
  owner: string,
  repo: string
): Promise<string> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get repository: ${response.status}`);
  }

  const data = await response.json();
  return data.default_branch;
}

/**
 * List commits using installation token
 */
export async function listCommitsAsApp(
  installationId: number,
  owner: string,
  repo: string,
  perPage: number = 100
): Promise<Array<{
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}>> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch commits: ${response.status}`);
  }

  return response.json();
}

/**
 * Compare commits using installation token
 */
export async function compareCommitsAsApp(
  installationId: number,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{
  files: Array<{
    filename: string;
    status: "added" | "removed" | "modified" | "renamed";
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${owner}/${repo}/compare/${base}...${head}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to compare commits: ${response.status}`);
  }

  return response.json();
}
