"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      window.location.href = "/api/auth/github";
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className={styles.error}>
          {error === "access_denied" && "您已取消授权，请重试。"}
          {error === "invalid_state" && "会话已过期，请重试。"}
          {error === "auth_failed" && "认证失败，请重试。"}
          {!["access_denied", "invalid_state", "auth_failed"].includes(
            error || "",
          ) && "发生错误，请重试。"}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className={styles.githubButton}
      >
        {loading ? (
          <span className={styles.spinner} />
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            使用 GitHub 账户登录
          </>
        )}
      </button>

      <p className={styles.terms}>继续即表示您同意我们的服务条款和隐私政策。</p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.logoSection}>
          <Link href="/" className={styles.logo}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </Link>
          <h1>欢迎使用 TransLaHub</h1>
          <p>AI 驱动的文档翻译工具</p>
        </div>

        <Suspense fallback={<div className={styles.loading}>加载中...</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <div className={styles.features}>
        <div className={styles.featureItem}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
          <span>支持 20+ 种语言翻译</span>
        </div>
        <div className={styles.featureItem}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
          <span>智能增量翻译</span>
        </div>
        <div className={styles.featureItem}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20,6 9,17 4,12" />
          </svg>
          <span>提交前预览翻译结果</span>
        </div>
      </div>
    </div>
  );
}
