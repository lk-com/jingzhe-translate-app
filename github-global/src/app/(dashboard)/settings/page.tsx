"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

interface Settings {
  hasApiKey: boolean;
  githubAppInstallDismissed: boolean;
  dailyQuota: number;
  isWhitelisted: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshInstallation = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/user/refresh-installation", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({
          type: "success",
          text: data.message || "Installation status refreshed",
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to refresh installation status",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred while refreshing",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleInstallApp = () => {
    if (GITHUB_APP_SLUG) {
      window.open(
        `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`,
        "_blank"
      );
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/user/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterApiKey: apiKey }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key saved successfully" });
        setApiKey("");
        fetchSettings();
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to save API key",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm("Are you sure you want to remove your API key?")) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterApiKey: "" }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "API key removed successfully" });
        fetchSettings();
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>正在加载设置...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>设置</h1>
        <p className={styles.subtitle}>管理您的账户和 API 配置</p>
      </header>

      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.type === "success" ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          {message.text}
        </div>
      )}

      {/* API Key Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>OpenRouter API 密钥</h2>
            <p className={styles.sectionDescription}>
              配置您自己的 API 密钥以使用您自己的 AI 配额
            </p>
          </div>
          {settings?.hasApiKey && (
            <span className={styles.statusBadge}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
              已配置
            </span>
          )}
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className={styles.infoContent}>
            <p>
              从{" "}
              <a
                href="https://openrouter.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                openrouter.ai
              </a>{" "}
              获取免费 API 密钥。不配置则将使用平台共享配额。
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveApiKey} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="apiKey" className={styles.label}>
              API 密钥
            </label>
            <div className={styles.inputWrapper}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={styles.inputIcon}
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  settings?.hasApiKey
                    ? "输入新密钥以替换现有密钥"
                    : "sk-or-v1-..."
                }
                className={styles.input}
              />
            </div>
          </div>
          <div className={styles.buttonGroup}>
            <button
              type="submit"
              disabled={saving || !apiKey}
              className={styles.saveButton}
            >
              {saving ? (
                <>
                  <div className={styles.buttonSpinner}></div>
                  保存中...
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
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17,21 17,13 7,13 7,21" />
                    <polyline points="7,3 7,8 15,8" />
                  </svg>
                  保存 API 密钥
                </>
              )}
            </button>
            {settings?.hasApiKey && (
              <button
                type="button"
                onClick={handleDeleteApiKey}
                disabled={saving}
                className={styles.deleteButton}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="3,6 5,6 21,6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                移除
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Quota Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>每日配额</h2>
            <p className={styles.sectionDescription}>您当前的 API 请求限制</p>
          </div>
        </div>
        <div className={styles.quotaCard}>
          <div className={styles.quotaIcon}>
            {settings?.isWhitelisted ? (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            ) : (
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
          </div>
          <div className={styles.quotaInfo}>
            <span className={styles.quotaValue}>
              {settings?.isWhitelisted
                ? "无限"
                : `${settings?.dailyQuota || 100} 次/天`}
            </span>
            {settings?.isWhitelisted ? (
              <span className={styles.whitelistBadge}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
                白名单
              </span>
            ) : (
              <span className={styles.quotaNote}>免费套餐的平台配额</span>
            )}
          </div>
        </div>
      </section>

      {/* GitHub App Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>GitHub App 安装</h2>
            <p className={styles.sectionDescription}>
              安装 GitHub App 以启用提交翻译到仓库的功能
            </p>
          </div>
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoIcon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <div className={styles.infoContent}>
            <p>
              GitHub App 负责将翻译后的文件提交到您的仓库。如果您尚未安装，请先安装 GitHub App，然后点击"刷新安装状态"按钮。
            </p>
          </div>
        </div>

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={handleInstallApp}
            className={styles.saveButton}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            安装 GitHub App
          </button>
          <button
            type="button"
            onClick={handleRefreshInstallation}
            disabled={refreshing}
            className={styles.refreshButton}
          >
            {refreshing ? (
              <>
                <div className={styles.buttonSpinner}></div>
                刷新中...
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
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                刷新安装状态
              </>
            )}
          </button>
        </div>

        <p className={styles.hint}>
          提示：安装 GitHub App 后，请等待几秒钟，然后点击"刷新安装状态"按钮。
        </p>
      </section>
    </div>
  );
}
