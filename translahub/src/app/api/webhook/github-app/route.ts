import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { translateLargeContent } from "@/lib/translation";
import { PROVIDER_BASE_URLS, AIConfig } from "@/lib/ai-provider";
import {
  fetchFileContentAsApp,
  createOrUpdateFileAsApp,
  createBranchAsApp,
  createPullRequestAsApp,
} from "@/lib/github-app";

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

function isInTranslationsDirectory(path: string): boolean {
  return path.startsWith("translations/");
}

function applyIgnoreRules(files: string[], ignoreRules: string | null): string[] {
  if (!ignoreRules) {
    return files;
  }

  const patterns = ignoreRules
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const regexPatterns = patterns.map((pattern) => {
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "{{DOUBLESTAR}}")
      .replace(/\*/g, "[^/]*")
      .replace(/{{DOUBLESTAR}}/g, ".*");
    return new RegExp(`^${regexPattern}$`);
  });

  return files.filter((file) => {
    return !regexPatterns.some((regex) => regex.test(file));
  });
}

function generateAutoTranslateBranchName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `translation/auto-${year}${month}${day}-${hour}${minute}${second}`;
}

async function findRepositoryByGitHubId(githubRepoId: number) {
  return prisma.repository.findFirst({
    where: { githubRepoId },
    include: { user: true },
  });
}

async function processInstallationEvent(payload: {
  action: string;
  installation: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
}) {
  const { action, installation } = payload;
  const githubLogin = installation.account.login;

  console.log(`Installation event: ${action} for ${githubLogin}`);

  const user = await prisma.user.findFirst({
    where: { githubLogin },
  });

  if (!user) {
    console.log(`User ${githubLogin} not found in database`);
    return { success: false, reason: "User not found" };
  }

  if (action === "created") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        githubAppInstallDismissed: true,
        updatedAt: new Date(),
      },
    });
    console.log(`User ${githubLogin} installed GitHub App`);
    return { success: true, action: "installed" };
  } else if (action === "deleted") {
    console.log(`User ${githubLogin} uninstalled GitHub App - clearing installationId from repositories`);
    // Clear installationId from all repositories for this user
    await prisma.repository.updateMany({
      where: { userId: user.id },
      data: {
        installationId: null,
        updatedAt: new Date(),
      },
    });
    console.log(`Cleared installationId for all repositories of user ${githubLogin}`);
    return { success: true, action: "uninstalled" };
  } else if (action === "suspended" || action === "unsuspended") {
    console.log(`User ${githubLogin} app ${action}`);
    return { success: true, action };
  }

  return { success: true, action: "ignored" };
}

async function processPushEventFromApp(payload: PushEventPayload) {
  const { repository: repo, commits, installation } = payload;

  const repository = await findRepositoryByGitHubId(repo.id);

  if (!repository) {
    console.log(`Repository ${repo.id} not found in database`);
    return { success: false, reason: "Repository not found in database" };
  }

  if (!repository.autoTranslate) {
    console.log(`Auto translate is disabled for repository ${repo.full_name}`);
    return { success: false, reason: "Auto translate is disabled" };
  }

  if (!repository.targetLanguages || (repository.targetLanguages as string[]).length === 0) {
    console.log(`No target languages configured for repository ${repo.full_name}`);
    return { success: false, reason: "No target languages configured" };
  }

  const targetLanguages = repository.targetLanguages as string[];
  const user = repository.user;

  let aiConfig: AIConfig | null = null;

  if (user.aiConfig) {
    const config = user.aiConfig as Record<string, string>;
    aiConfig = {
      provider: config.provider,
      baseURL: config.baseURL,
      apiKey: decrypt(config.apiKey),
      model: config.model,
    };
  } else if (user.openrouterApiKey) {
    aiConfig = {
      provider: "openrouter",
      baseURL: PROVIDER_BASE_URLS.openrouter,
      apiKey: decrypt(user.openrouterApiKey),
      model: process.env.DEFAULT_MODEL || "openai/gpt-4o-mini",
    };
  } else {
    aiConfig = {
      provider: "openrouter",
      baseURL: PROVIDER_BASE_URLS.openrouter,
      apiKey: process.env.OPENROUTER_API_KEY || "",
      model: process.env.DEFAULT_MODEL || "openai/gpt-4o-mini",
    };
  }

  if (!aiConfig?.apiKey) {
    return { success: false, reason: "No API key configured" };
  }

  const installationId = installation.id;

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

  let filteredFiles = Array.from(changedFiles);

  filteredFiles = filteredFiles.filter(
    (file) => !isInTranslationsDirectory(file),
  );

  if (filteredFiles.length === 0) {
    return { success: true, reason: "All changed files are in translations directory" };
  }

  filteredFiles = applyIgnoreRules(filteredFiles, repository.ignoreRules);

  if (filteredFiles.length === 0) {
    return { success: true, reason: "All files filtered by ignore rules" };
  }

  const branchName = generateAutoTranslateBranchName();

  const task = await prisma.translationTask.create({
    data: {
      repositoryId: repository.id,
      status: "running",
      type: "incremental",
      targetLanguages,
      totalFiles: filteredFiles.length * targetLanguages.length,
      processedFiles: 0,
      startedAt: new Date(),
      branchName,
    },
  });

  processTranslationInBackground(
    task.id,
    repository,
    filteredFiles,
    targetLanguages,
    aiConfig,
    installationId,
    branchName,
  );

  return {
    success: true,
    taskId: task.id,
    filesCount: filteredFiles.length,
    languages: targetLanguages,
    branchName,
  };
}

function getTranslatedPath(
  originalPath: string,
  targetLanguage: string,
  baseLanguage: string,
): string {
  const normalizedTarget = targetLanguage.toLowerCase();
  const normalizedBase = baseLanguage.toLowerCase();

  const pathParts = originalPath.split("/");
  const fileName = pathParts.pop() || "README.md";

  let finalFileName: string;

  if (normalizedTarget === normalizedBase) {
    finalFileName = fileName;
  } else {
    finalFileName = fileName;
  }

  const translatedDir = pathParts.join("/");
  const translatedPath = translatedDir
    ? `translations/${normalizedTarget}/${translatedDir}/${finalFileName}`
    : `translations/${normalizedTarget}/${finalFileName}`;

  return translatedPath.replace(/\/+/g, "/");
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
  aiConfig: AIConfig,
  installationId: number,
  branchName: string,
) {
  const results: Record<
    string,
    Record<string, { path: string; translated: string; sha: string }>
  > = {};
  let failedCount = 0;
  let successCount = 0;

  try {
    await createBranchAsApp(
      installationId,
      repository.owner,
      repository.name,
      branchName,
      repository.defaultBranch,
    );

    console.log(`Created branch ${branchName} for task ${taskId}`);

    for (const lang of targetLanguages) {
      results[lang] = {};

      for (const filePath of files) {
        try {
          const fileData = await fetchFileContentAsApp(
            installationId,
            repository.owner,
            repository.name,
            filePath,
            repository.defaultBranch,
          );

          if (!fileData) {
            console.error(`Source file not found: ${filePath}`);
            failedCount++;
            continue;
          }

          const translated = await translateLargeContent(
            fileData.content,
            lang,
            repository.baseLanguage,
            aiConfig,
          );

          results[lang][filePath] = {
            path: filePath,
            translated,
            sha: fileData.sha,
          };

          const translatedPath = getTranslatedPath(
            filePath,
            lang,
            repository.baseLanguage,
          );

          // For incremental translation, get the sha of the existing translated file
          const translatedFileData = await fetchFileContentAsApp(
            installationId,
            repository.owner,
            repository.name,
            translatedPath,
            branchName,
          );
          const translatedSha = translatedFileData?.sha;

          await createOrUpdateFileAsApp(
            installationId,
            repository.owner,
            repository.name,
            translatedPath,
            translated,
            `🌐 Translate ${filePath} to ${lang}`,
            translatedSha,
            branchName,
          );

          // Save translation result to database for preview
          await prisma.translationResult.create({
            data: {
              taskId,
              originalPath: filePath,
              translatedPath,
              language: lang,
              originalContent: fileData.content,
              translatedContent: translated,
              originalSha: fileData.sha,
              status: "completed",
            },
          });

          successCount++;

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              processedFiles: successCount + failedCount,
            },
          });
        } catch (error) {
          console.error(`Failed to translate ${filePath} to ${lang}:`, error);
          failedCount++;

          // Save failed translation result
          await prisma.translationResult.create({
            data: {
              taskId,
              originalPath: filePath,
              translatedPath: getTranslatedPath(filePath, lang, repository.baseLanguage),
              language: lang,
              originalContent: "",
              translatedContent: "",
              originalSha: "",
              status: "failed",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            },
          });

          await prisma.translationTask.update({
            where: { id: taskId },
            data: {
              failedFiles: { increment: 1 },
            },
          });
        }
      }
    }

    const totalFiles = files.length * targetLanguages.length;
    const isAllFailed = failedCount === totalFiles;

    let prUrl: string | null = null;
    let prNumber: number | null = null;

    if (!isAllFailed && successCount > 0) {
      try {
        const pr = await createPullRequestAsApp(
          installationId,
          repository.owner,
          repository.name,
          `🌐 Auto Translation - ${branchName}`,
          generatePRBody(targetLanguages, files.length, successCount, failedCount, taskId),
          branchName,
          repository.defaultBranch,
        );

        prUrl = pr.html_url;
        prNumber = pr.number;

        console.log(`Created PR #${prNumber} for task ${taskId}`);
      } catch (error) {
        console.error(`Failed to create PR for task ${taskId}:`, error);
      }
    }

    await prisma.translationTask.update({
      where: { id: taskId },
      data: {
        status: isAllFailed ? "failed" : "completed",
        completedAt: new Date(),
        result: results,
        prUrl,
        prNumber,
        errorMessage:
          failedCount > 0
            ? `${failedCount}/${totalFiles} files failed to translate`
            : null,
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

function generatePRBody(
  targetLanguages: string[],
  fileCount: number,
  successCount: number,
  failedCount: number,
  taskId: number,
): string {
  const langList = targetLanguages
    .map((l) => `- ${getLanguageName(l)} (\`${l}\`)`)
    .join("\n");

  const statusSection =
    failedCount > 0
      ? `### ⚠️ 部分翻译失败
- 成功: ${successCount} 个文件
- 失败: ${failedCount} 个文件`
      : `### ✅ 翻译完成
- 全部 ${successCount} 个文件翻译成功`;

  return `## 🌐 自动翻译更新

此 PR 由 GitHub Webhook 自动触发，包含基准语言文档的最新翻译。

### 目标语言
${langList}

### 统计信息
- **翻译文件数**: ${fileCount}
- **翻译类型**: 增量翻译（仅变更文件）

${statusSection}

### 说明
- 所有翻译文件存储在 \`translations/{lang}/\` 目录
- 保持原始文件结构
- 技术术语和代码块保持不变

---
*任务 ID: ${taskId}*
*由 [TransLaHub](https://translahub.com) 自动生成*`;
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: "English",
    zh: "中文",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    ja: "日本語",
    ko: "한국어",
    es: "Español",
    fr: "Français",
    de: "Deutsch",
    ru: "Русский",
    pt: "Português",
    it: "Italiano",
    ar: "العربية",
    hi: "हिन्दी",
    nl: "Nederlands",
    pl: "Polski",
    tr: "Türkçe",
    vi: "Tiếng Việt",
    th: "ไทย",
    id: "Bahasa Indonesia",
    ms: "Bahasa Melayu",
  };
  return names[code] || code;
}

export async function POST(request: NextRequest) {
  try {
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

    const isValid = verifyGitHubAppSignature(body, signature, webhookSecret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);

    switch (event) {
      case "push":
        const pushResult = await processPushEventFromApp(
          payload as PushEventPayload,
        );
        return NextResponse.json(pushResult);

      case "installation":
        const installResult = await processInstallationEvent(payload);
        return NextResponse.json(installResult);

      case "installation_repositories":
        return NextResponse.json({
          message: "Installation repositories event received",
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
