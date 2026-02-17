"use client";

import { useState } from "react";
import styles from "./GitHubAppInstallModal.module.css";

interface GitHubAppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// GitHub App Slug 从环境变量获取
const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

export default function GitHubAppInstallModal({
  isOpen,
  onClose,
}: GitHubAppInstallModalProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = () => {
    setIsInstalling(true);
    // 打开 GitHub APP 安装页面
    if (GITHUB_APP_SLUG) {
      window.open(
        `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`,
        "_blank"
      );
    }
    // 3 秒后关闭弹窗
    // 注意：用户安装完成后，Webhook 会通知服务器更新数据库
    setTimeout(() => {
      setIsInstalling(false);
      onClose();
    }, 3000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={styles.icon}
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <h2 className={styles.title}>安装 GitHub App</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="关闭"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.description}>
            欢迎使用 TransLaHub！为了提供完整的翻译功能，请安装我们的 GitHub App。
          </p>

          <div className={styles.features}>
            <div className={styles.featureItem}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
              <span>自动翻译 Markdown 文档</span>
            </div>
            <div className={styles.featureItem}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
              <span>增量更新翻译内容</span>
            </div>
            <div className={styles.featureItem}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
              <span>支持 20+ 种语言</span>
            </div>
            <div className={styles.featureItem}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <polyline points="20,6 9,17 4,12" />
              </svg>
              <span>安全的只读访问</span>
            </div>
          </div>

          <div className={styles.permissions}>
            <h4 className={styles.permissionsTitle}>权限说明：</h4>
            <ul className={styles.permissionsList}>
              <li>
                <span className={styles.badge}>只读</span>
                仓库内容访问权限
              </li>
              <li>
                <span className={styles.badge}>只读</span>
                元数据访问权限
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className={styles.primaryButton}
          >
            {isInstalling ? (
              <>
                <span className={styles.spinner}></span>
                正在打开...
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                立即安装
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
