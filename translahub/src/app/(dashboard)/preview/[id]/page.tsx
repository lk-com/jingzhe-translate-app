"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface TranslationResult {
  originalPath: string;
  translatedPath: string;
  language: string;
  originalContent: string;
  translatedContent: string;
  status: string;
}

interface TaskInfo {
  id: number;
  status: string;
  type: string;
  targetLanguages: string[];
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
}

interface RepositoryInfo {
  owner: string;
  name: string;
}

interface LanguageSummary {
  language: string;
  totalFiles: number;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  fr: "French",
  de: "German",
  ru: "Russian",
  pt: "Portuguese",
  it: "Italian",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  ms: "Malay",
};

function PreviewContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const taskId = params.id;

  const [task, setTask] = useState<TaskInfo | null>(null);
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [languages, setLanguages] = useState<LanguageSummary[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ originalPath: string; translatedPath: string; status: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [taskId]);

  useEffect(() => {
    const lang = searchParams.get("language");
    if (lang) {
      setSelectedLanguage(lang);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedLanguage) {
      fetchLanguageFiles(selectedLanguage);
    }
  }, [selectedLanguage]);

  const fetchPreview = async () => {
    try {
      const response = await fetch(`/api/translate/${taskId}/preview`);
      if (response.ok) {
        const data = await response.json();
        setTask(data);
        setRepository(data.repository);
        setLanguages(data.languages || []);

        if (data.languages && data.languages.length > 0 && !selectedLanguage) {
          setSelectedLanguage(data.languages[0].language);
        }
      } else {
        setError("Failed to load preview");
      }
    } catch (err) {
      setError("Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const fetchLanguageFiles = async (language: string) => {
    try {
      const response = await fetch(`/api/translate/${taskId}/preview?language=${language}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setSelectedFile(null);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  };

  const fetchFileContent = async (path: string, language: string) => {
    try {
      const response = await fetch(
        `/api/translate/${taskId}/preview?language=${language}&path=${encodeURIComponent(path)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedFile(data.file);
      }
    } catch (err) {
      console.error("Failed to fetch file content:", err);
    }
  };

  const handleCommit = async () => {
    if (!confirm("确定要将翻译提交到 GitHub 并创建 PR 吗？")) {
      return;
    }

    setCommitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/translate/${taskId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createPR: true }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`提交成功！\n分支: ${data.branchName}\n${data.prUrl ? `PR: ${data.prUrl}` : ""}`);
        fetchPreview();
      } else {
        const data = await response.json();
        setError(data.error || "提交失败");
      }
    } catch (err) {
      setError("提交请求失败");
    } finally {
      setCommitting(false);
    }
  };

  const getLanguageName = (code: string) => LANG_NAMES[code] || code;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>正在加载预览...</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/repos" className={styles.backLink}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回仓库列表
          </Link>
        </div>
        <div className={styles.errorMessage}>任务不存在</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/repos" className={styles.backLink}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          返回仓库列表
        </Link>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.taskHeader}>
            <div>
              <h1 className={styles.title}>翻译预览 #{task.id}</h1>
              <p className={styles.subtitle}>
                {repository?.owner}/{repository?.name} · {task.type === "incremental" ? "增量翻译" : "完整翻译"}
              </p>
            </div>
            <div className={styles.taskActions}>
              {task.status === "completed" && !task.prUrl && (
                <button onClick={handleCommit} disabled={committing} className={styles.primaryButton}>
                  {committing ? (
                    <>
                      <div className={styles.buttonSpinner}></div>
                      提交中...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22,4 12,14.01 9,11.01" />
                      </svg>
                      提交到 GitHub
                    </>
                  )}
                </button>
              )}
              {task.prUrl && (
                <a href={task.prUrl} target="_blank" rel="noopener noreferrer" className={styles.prLink}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  查看 PR #{task.prNumber}
                </a>
              )}
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{task.totalFiles}</span>
              <span className={styles.statLabel}>总文件数</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{task.processedFiles}</span>
              <span className={styles.statLabel}>已翻译</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{task.failedFiles}</span>
              <span className={styles.statLabel}>失败</span>
            </div>
          </div>
        </div>

        <div className={styles.previewLayout}>
          <div className={styles.sidebar}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>目标语言</h3>
              <div className={styles.languageList}>
                {languages.map((lang) => (
                  <button
                    key={lang.language}
                    className={`${styles.languageButton} ${selectedLanguage === lang.language ? styles.active : ""}`}
                    onClick={() => setSelectedLanguage(lang.language)}
                  >
                    <span className={styles.langName}>{getLanguageName(lang.language)}</span>
                    <span className={styles.langCount}>{lang.totalFiles} 文件</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedLanguage && (
              <div className={styles.card}>
                <h3 className={styles.sectionTitle}>文件列表</h3>
                <div className={styles.fileList}>
                  {files.map((file) => (
                    <button
                      key={file.originalPath}
                      className={`${styles.fileButton} ${selectedFile?.originalPath === file.originalPath ? styles.active : ""}`}
                      onClick={() => fetchFileContent(file.originalPath, selectedLanguage)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14,2 14,8 20,8" />
                      </svg>
                      <span className={styles.fileName}>{file.originalPath}</span>
                      <span className={`${styles.fileStatus} ${file.status === "completed" ? styles.success : styles.failed}`}>
                        {file.status === "completed" ? "✓" : "✗"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.mainContent}>
            {selectedFile ? (
              <div className={styles.card}>
                <div className={styles.previewHeader}>
                  <h3 className={styles.sectionTitle}>{selectedFile.originalPath}</h3>
                </div>

                <div className={styles.previewContent}>
                  <div className={styles.sideBySide}>
                      <div className={styles.contentPanel}>
                        <div className={styles.panelHeader}>原文</div>
                        <pre className={styles.codeBlock}>{selectedFile.originalContent}</pre>
                      </div>
                      <div className={styles.contentPanel}>
                        <div className={styles.panelHeader}>译文 ({getLanguageName(selectedFile.language)})</div>
                        <pre className={styles.codeBlock}>{selectedFile.translatedContent}</pre>
                      </div>
                    </div>
                </div>
              </div>
            ) : (
              <div className={styles.card}>
                <div className={styles.emptyState}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                  <p>选择一个文件查看翻译预览</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <span>正在加载...</span>
          </div>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
