"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  baseLanguage: string;
  configured: boolean;
}

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha?: string;
  children?: FileItem[];
}

interface TranslationTask {
  id: number;
  status: string;
  targetLanguages: string[];
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  failuresSummary?: Array<{
    language: string;
    path: string;
    error: string;
  }> | null;
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
];

export default function RepoDetailPage() {
  const params = useParams();
  const repoId = params.id;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [tasks, setTasks] = useState<TranslationTask[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [isReDetecting, setIsReDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Helper function to render file tree with collapsible folders
  const renderFileTree = (items: FileItem[], level: number = 0): React.ReactNode => {
    return items.map((item) => (
      <div key={item.path} style={{ paddingLeft: `${level * 16}px` }}>
        {item.type === 'dir' ? (
          <div className={styles.folderItem}>
            <button
              type="button"
              className={styles.folderButton}
              onClick={() => handleFolderToggle(item.path)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={expandedFolders.has(item.path) ? styles.folderIconExpanded : styles.folderIcon}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>{item.name}</span>
            </button>
            {expandedFolders.has(item.path) && item.children && (
              <div className={styles.folderChildren}>
                {renderFileTree(item.children, level + 1)}
              </div>
            )}
          </div>
        ) : (
          <label key={item.path} className={styles.fileItem}>
            <input
              type="checkbox"
              checked={selectedFiles.includes(item.path)}
              onChange={() => handleFileToggle(item.path)}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            <span>{item.path}</span>
          </label>
        )}
      </div>
    ));
  };

  useEffect(() => {
    fetchRepoDetail();
    fetchTasks();
  }, [repoId]);

  // Poll for task updates when there are running tasks
  useEffect(() => {
    const hasRunningTasks = tasks.some(task => task.status === 'running');

    if (!hasRunningTasks) return;

    const interval = setInterval(() => {
      fetchTasks();
    }, 3000); // Poll every 3 seconds for running tasks

    return () => clearInterval(interval);
  }, [tasks]);

  // Fetch files when file selector is opened
  useEffect(() => {
    if (showFileSelector && files.length === 0) {
      fetchFiles();
    }
  }, [showFileSelector]);

  const fetchRepoDetail = async () => {
    try {
      // Always fetch fresh data, no cache
      const response = await fetch(`/api/repos/${repoId}`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setRepo(data.repository);
      } else {
        setError("无法加载仓库详情");
      }
    } catch (err) {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      // Always fetch fresh data, no cache
      const response = await fetch(`/api/translate/tasks?repositoryId=${repoId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  const handleLanguageToggle = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const fetchFiles = async () => {
    try {
      // Always fetch fresh data, no cache
      const response = await fetch(`/api/repos/${repoId}/files`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.tree || []);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    }
  };

  const handleFileToggle = (path: string) => {
    setSelectedFiles((prev) =>
      prev.includes(path)
        ? prev.filter((f) => f !== path)
        : [...prev, path]
    );
  };

  const handleSelectAllFiles = () => {
    // Flatten all files from the tree
    const allFiles: string[] = [];
    const flattenFiles = (items: FileItem[]) => {
      for (const item of items) {
        if (item.type === 'file') {
          allFiles.push(item.path);
        } else if (item.children) {
          flattenFiles(item.children);
        }
      }
    };
    flattenFiles(files);
    setSelectedFiles(allFiles);
  };

  const handleDeselectAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleFolderToggle = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  };

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      const response = await fetch(`/api/repos/${repoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseLanguage: newLanguage })
      })
      if (response.ok) {
        setRepo({ ...repo!, baseLanguage: newLanguage })
      }
    } catch (err) {
      console.error('Failed to update language:', err)
    }
  }

  const handleReDetect = async () => {
    setIsReDetecting(true)
    try {
      const response = await fetch(`/api/repos/${repoId}/detect-language`, {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        setRepo({ ...repo!, baseLanguage: data.baseLanguage })
      }
    } catch (err) {
      console.error('Failed to re-detect language:', err)
    } finally {
      setIsReDetecting(false)
    }
  }

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) {
      setError("请至少选择一个目标语言");
      return;
    }

    setTranslating(true);
    setError(null);

    try {
      const response = await fetch("/api/translate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId: repoId,
          targetLanguages: selectedLanguages,
          type: "full",
          selectedFiles: selectedFiles.length > 0 ? selectedFiles : [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`翻译任务已创建！将翻译 ${data.totalFiles} 个文件到 ${selectedLanguages.length} 种语言。`);
        setSelectedLanguages([]);
        setSelectedFiles([]);
        fetchTasks();
      } else {
        const data = await response.json();
        setError(data.error || "创建翻译任务失败");
      }
    } catch (err) {
      setError("翻译请求失败");
    } finally {
      setTranslating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      running: { label: "翻译中", className: styles.statusRunning },
      completed: { label: "已完成", className: styles.statusCompleted },
      failed: { label: "失败", className: styles.statusFailed },
      pending: { label: "等待中", className: styles.statusPending },
    };
    const info = statusMap[status] || { label: status, className: "" };
    return <span className={`${styles.statusBadge} ${info.className}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>正在加载...</span>
        </div>
      </div>
    );
  }

  if (!repo) {
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
        <div className={styles.errorMessage}>仓库不存在</div>
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
        {/* Repository Info */}
        <div className={styles.card}>
          <div className={styles.repoHeader}>
            <div>
              <h1 className={styles.title}>{repo.fullName}</h1>
              <p className={styles.description}>{repo.description || "无描述"}</p>
            </div>
            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className={styles.repoLink}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15,3 21,3 21,9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              在 GitHub 查看
            </a>
          </div>

          <div className={styles.repoMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>默认分支</span>
              <span className={styles.metaValue}>{repo.defaultBranch}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>源语言</span>
              <div className={styles.languageSelector}>
                <select
                  value={repo.baseLanguage || 'zh'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className={styles.languageSelect}
                >
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
                <button
                  onClick={handleReDetect}
                  disabled={isReDetecting}
                  className={styles.reDetectButton}
                  title="重新检测语言"
                >
                  {isReDetecting ? (
                    <div className={styles.buttonSpinner}></div>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>状态</span>
              <span className={repo.configured ? styles.configured : styles.unconfigured}>
                {repo.configured ? "已配置" : "未配置"}
              </span>
            </div>
          </div>
        </div>

        {/* Translation Section */}
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            翻译文档
          </h2>

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

          <div className={styles.languageGrid}>
            {LANGUAGES.filter(l => l.code !== (repo.baseLanguage || "zh")).map((lang) => (
              <label key={lang.code} className={styles.languageOption}>
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(lang.code)}
                  onChange={() => handleLanguageToggle(lang.code)}
                  disabled={translating}
                />
                <span className={styles.langFlag}>{lang.flag}</span>
                <span className={styles.langName}>{lang.name}</span>
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => setShowFileSelector(true)}
              disabled={translating}
              className={styles.secondaryButton}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              选择文件 {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
            </button>
            <button
              onClick={handleTranslate}
              disabled={translating || selectedLanguages.length === 0}
              className={styles.primaryButton}
            >
              {translating ? (
                <>
                  <div className={styles.buttonSpinner}></div>
                  创建中...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21 5,3" />
                  </svg>
                  开始翻译 ({selectedLanguages.length} 种语言)
                </>
              )}
            </button>
          </div>
        </div>

        {/* File Selector Modal */}
        {showFileSelector && (
          <div className={styles.modalOverlay} onClick={() => setShowFileSelector(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>选择要翻译的文件</h3>
                <button
                  className={styles.closeButton}
                  onClick={() => setShowFileSelector(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.fileSelectorHeader}>
                  <div className={styles.fileSelectorInfo}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    <span>{files.length} 个 Markdown 文件</span>
                  </div>
                  <div className={styles.fileSelectorActions}>
                    <button
                      type="button"
                      onClick={handleSelectAllFiles}
                      className={styles.textButton}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFiles}
                      className={styles.textButton}
                    >
                      取消全选
                    </button>
                  </div>
                </div>
                <div className={styles.fileList}>
                  {files.length === 0 ? (
                    <div className={styles.loading}>
                      <div className={styles.spinner}></div>
                      <span>加载文件列表...</span>
                    </div>
                  ) : (
                    renderFileTree(files)
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <span className={styles.selectedCount}>
                  已选择 {selectedFiles.length} 个文件
                </span>
                <button
                  onClick={() => setShowFileSelector(false)}
                  className={styles.primaryButton}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Translation History */}
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            翻译历史
          </h2>

          {tasks.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <p>暂无翻译记录</p>
              <span>选择语言并开始您的第一次翻译</span>
            </div>
          ) : (
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <div key={task.id} className={styles.taskItem}>
                  <div className={styles.taskInfo}>
                    <div className={styles.taskHeader}>
                      <span className={styles.taskId}>#{task.id}</span>
                      {getStatusBadge(task.status)}
                    </div>
                    <div className={styles.taskLanguages}>
                      翻译为: {task.targetLanguages.join(", ")}
                    </div>
                    <div className={styles.taskProgress}>
                      {task.processedFiles} / {task.totalFiles} 文件
                      {task.failedFiles > 0 && (
                        <span className={styles.taskFailed}>
                          ({task.failedFiles} 失败)
                        </span>
                      )}
                      {task.status === "running" && (
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${(task.processedFiles / task.totalFiles) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {task.errorMessage && (
                      <div className={styles.taskError}>
                        {task.errorMessage}
                      </div>
                    )}
                    {task.failuresSummary && task.failuresSummary.length > 0 && (
                      <div className={styles.failuresList}>
                        <div className={styles.failuresHeader}>失败详情:</div>
                        {task.failuresSummary.map((failure, idx) => (
                          <div key={idx} className={styles.failureItem}>
                            <span className={styles.failurePath}>{failure.path}</span>
                            <span className={styles.failureLang}>({failure.language})</span>
                            <span className={styles.failureError}>{failure.error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.taskActions}>
                    {task.status === "completed" && (
                      <Link href={`/preview/${task.id}`} className={styles.previewLink}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        预览
                      </Link>
                    )}
                    <div className={styles.taskTime}>
                      {task.startedAt && new Date(task.startedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
