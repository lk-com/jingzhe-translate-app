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

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Private key file not found: ${fullPath}`);
  }

  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Generate a JWT for GitHub App authentication
 */
function generateJWT(): string {
  const privateKey = readPrivateKey();
  const appId = process.env.GITHUB_APP_ID;

  if (!appId) {
    throw new Error("GITHUB_APP_ID is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time, 60 seconds in the past to account for clock drift
    exp: now + 10 * 60, // JWT expiration time (10 minutes max)
    iss: appId, // GitHub App ID
  };

  // Create JWT using RSA-SHA256
  const token = crypto.sign(
    "RSA-SHA256",
    Buffer.from(
      JSON.stringify({
        alg: "RS256",
        typ: "JWT",
      }) +
        "." +
        JSON.stringify(payload),
    ),
    privateKey,
  );

  // Encode header and payload in base64
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = token.toString("base64url");

  return `${header}.${body}.${signature}`;
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

  const jwt = generateJWT();

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
    throw new Error(
      `Failed to get installation token: ${response.status} - ${error}`,
    );
  }

  const data = await response.json();

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
    throw new Error(`Failed to get installations: ${response.status}`);
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
