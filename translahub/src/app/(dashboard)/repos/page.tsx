"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  configured: boolean;
  language?: string;
  stars?: number;
  forks?: number;
  updatedAt?: string;
}

export default function ReposPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "configured" | "unconfigured">(
    "all",
  );

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    try {
      const response = await fetch("/api/repos");
      if (response.ok) {
        const data = await response.json();
        setRepos(data.repositories);
      }
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (repo: Repository) => {
    setImporting(repo.id);
    try {
      const response = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.fullName.split("/")[0],
          name: repo.name,
          githubRepoId: repo.id,
        }),
      });

      if (response.ok) {
        fetchRepos();
      }
    } catch (error) {
      console.error("Failed to import repo:", error);
    } finally {
      setImporting(null);
    }
  };

  const filteredRepos = repos.filter((repo) => {
    if (filter === "configured") return repo.configured;
    if (filter === "unconfigured") return !repo.configured;
    return true;
  });

  const stats = {
    total: repos.length,
    configured: repos.filter((r) => r.configured).length,
    unconfigured: repos.filter((r) => !r.configured).length,
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>正在加载仓库...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>仓库</h1>
            <p className={styles.subtitle}>管理和配置您的 GitHub 仓库</p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>仓库总数</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconSuccess}`}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.configured}</span>
            <span className={styles.statLabel}>已配置</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconWarning}`}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.unconfigured}</span>
            <span className={styles.statLabel}>未配置</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterBar}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            className={`${styles.filterTab} ${filter === "configured" ? styles.filterTabActive : ""}`}
            onClick={() => setFilter("configured")}
          >
            已配置
          </button>
          <button
            className={`${styles.filterTab} ${filter === "unconfigured" ? styles.filterTabActive : ""}`}
            onClick={() => setFilter("unconfigured")}
          >
            未配置
          </button>
        </div>
        <span className={styles.resultCount}>
          {filteredRepos.length}{" "}
          {filteredRepos.length === 1 ? "repository" : "repositories"}
        </span>
      </div>

      {/* Repo List */}
      <div className={styles.repoList}>
        {filteredRepos.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </div>
            <h3>未找到仓库</h3>
            <p>导入仓库以开始翻译您的文档</p>
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <div key={repo.id} className={styles.repoCard}>
              <div className={styles.repoCardLeft}>
                <div
                  className={`${styles.repoIcon} ${repo.private ? styles.repoIconPrivate : ""}`}
                >
                  {repo.private ? (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                  )}
                </div>
                <div className={styles.repoInfo}>
                  <h3 className={styles.repoName}>
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {repo.fullName}
                    </a>
                  </h3>
                  <p className={styles.repoDescription}>
                    {repo.description || "暂无描述"}
                  </p>
                  <div className={styles.repoMeta}>
                    <span className={styles.metaItem}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      {repo.defaultBranch}
                    </span>
                    {repo.language && (
                      <span className={styles.metaItem}>
                        <span className={styles.languageDot}></span>
                        {repo.language}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.repoCardRight}>
                {repo.configured ? (
                  <Link
                    href={`/repos/${repo.id}`}
                    className={styles.manageButton}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    管理
                  </Link>
                ) : (
                  <button
                    onClick={() => handleImport(repo)}
                    disabled={importing === repo.id}
                    className={styles.importButton}
                  >
                    {importing === repo.id ? (
                      <>
                        <div className={styles.buttonSpinner}></div>
                        导入中...
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17,8 12,3 7,8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        导入
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
