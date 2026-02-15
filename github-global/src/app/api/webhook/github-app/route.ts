import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { translateLargeContent } from "@/lib/translation";
import {
  fetchFileContentAsApp,
  createOrUpdateFileAsApp,
  createBranchAsApp,
  createPullRequestAsApp,
} from "@/lib/github-app";

// GitHub App webhook signed JWT verification
interface GitHubAppWebhookPayload {
  action: string;
  installation: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  };
  sender: {
    login: string;
    type: string;
  };
}

interface PushEventPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
  installation: {
    id: number;
  };
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
}

function verifyGitHubAppSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function isMarkdownFile(path: string): boolean {
  return path.endsWith(".md") || path.endsWith(".mdx");
}

async function findRepositoryByGitHubId(githubRepoId: number) {
  return prisma.repository.findFirst({
    where: { githubRepoId },
    include: { user: true },
  });
}

async function processPushEventFromApp(payload: PushEventPayload) {
  const { repository: repo, commits, installation } = payload;

  // Find repository in database by GitHub repo ID
  const repository = await findRepositoryByGitHubId(repo.id);

  if (!repository) {
    console.log(`Repository ${repo.id} not found in database`);
    return { success: false, reason: "Repository not found in database" };
  }

  // Check if user is whitelisted (for GitHub App mode)
  if (!repository.user.isWhitelisted) {
    console.log(`User ${repository.userId} is not whitelisted`);
    return { success: false, reason: "User not whitelisted" };
  }

  // Check if target languages are configured
  if (!repository.targetLanguages) {
    return { success: false, reason: "No target languages configured" };
  }

  const targetLanguages = repository.targetLanguages as string[];
  const user = repository.user;

  let apiKey = process.env.OPENROUTER_API_KEY;
  if (user.openrouterApiKey) {
    apiKey = decrypt(user.openrouterApiKey);
  }

  if (!apiKey) {
    return { success: false, reason: "No API key configured" };
  }

  // Use installation ID from payload for GitHub App authentication
  const installationId = installation.id;

  // Collect changed markdown files
  const changedFiles = new Set<string>();

  for (const commit of commits) {
    commit.added.forEach((file) => {
      if (isMarkdownFile(file)) changedFiles.add(file);
    });
    commit.modified.forEach((file) => {
      if (isMarkdownFile(file)) changedFiles.add(file);
    });
  }

  if (changedFiles.size === 0) {
    return { success: true, reason: "No markdown files changed" };
  }

  // Create translation task
  const task = await prisma.translationTask.create({
    data: {
      repositoryId: repository.id,
      status: "running",
      type: "incremental",
      targetLanguages,
      totalFiles: changedFiles.size * targetLanguages.length,
      processedFiles: 0,
      startedAt: new Date(),
    },
  });

  // Process in background
  processTranslationInBackground(
    task.id,
    repository,
    Array.from(changedFiles),
    targetLanguages,
    apiKey,
    installationId,
  );

  return {
    success: true,
    taskId: task.id,
    filesCount: changedFiles.size,
    languages: targetLanguages,
  };
}

async function processTranslationInBackground(
  taskId: number,
  repository: {
    id: number;
    owner: string;
    name: string;
    defaultBranch: string;
    baseLanguage: string;
  },
  files: string[],
  targetLanguages: string[],
  apiKey: string,
  installationId: number,
) {
  const results: Record<
    string,
    Record<string, { path: string; translated: string; sha: string }>
  > = {};

  try {
    for (const lang of targetLanguages) {
      results[lang] = {};

      for (const filePath of files) {
        try {
          // Use GitHub App installation token instead of user token
          const fileData = await fetchFileContentAsApp(
            installationId,
            repository.owner,
            repository.name,
            filePath,
            repository.defaultBranch,
          );

          const translated = await translateLargeContent(
            fileData.content,
            lang,
            repository.baseLanguage,
            apiKey,
          );

          results[lang][filePath] = {
            path: filePath,
            translated,
            sha: fileData.sha,
          };

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              processedFiles: { increment: 1 },
            },
          });
        } catch (error) {
          console.error(`Failed to translate ${filePath} to ${lang}:`, error);

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              failedFiles: { increment: 1 },
            },
          });
        }
      }
    }

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: results,
      },
    });

    console.log(`Translation completed for task ${taskId}`);
  } catch (error) {
    console.error("Translation failed:", error);

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get GitHub App webhook secret from env
    const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "GitHub App webhook not configured" },
        { status: 500 },
      );
    }

    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");

    // Verify webhook signature
    const isValid = verifyGitHubAppSignature(body, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);

    // Handle different events
    switch (event) {
      case "push":
        const pushResult = await processPushEventFromApp(
          payload as PushEventPayload,
        );
        return NextResponse.json(pushResult);

      case "installation":
      case "installation_repositories":
        return NextResponse.json({
          message: "Installation event received",
          action: payload.action,
        });

      case "ping":
        return NextResponse.json({ message: "pong", zen: payload.zen });

      default:
        return NextResponse.json({
          message: "Event ignored",
          event,
        });
    }
  } catch (error) {
    console.error("GitHub App webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/webhook/github-app",
    description: "GitHub App webhook endpoint for automatic translation",
    events: ["push", "installation", "ping"],
  });
}
