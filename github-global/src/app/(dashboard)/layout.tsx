"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import styles from "./layout.module.css";
import GitHubAppInstallModal from "@/components/GitHubAppInstallModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      // Use credentials: 'same-origin' to ensure cookies are sent with the request
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      // Navigate regardless of response status - redirect from API is expected
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      // Navigate anyway to ensure user can log in fresh
      router.push("/");
    }
  };

  // 检查是否需要显示安装引导弹窗
  useEffect(() => {
    const checkInstallStatus = async () => {
      try {
        // 从 API 获取用户的安装引导状态
        const response = await fetch("/api/user/settings");
        if (response.ok) {
          const data = await response.json();

          // 如果用户已标记为忽略安装引导，则不显示弹窗
          if (data.githubAppInstallDismissed === true) {
            setLoading(false);
            return;
          }

          // 显示安装引导弹窗（使用环境变量中的 GitHub App Slug）
          setShowInstallModal(true);
        }
      } catch (error) {
        console.error("Check install status error:", error);
      } finally {
        setLoading(false);
      }
    };

    checkInstallStatus();
  }, []);

  const handleModalClose = () => {
    setShowInstallModal(false);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.container}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link href="/repos" className={styles.logo}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>GitHub Global</span>
            </Link>
          </div>

          <nav className={styles.nav}>
            <Link
              href="/repos"
              className={`${styles.navLink} ${pathname === "/repos" || pathname.startsWith("/repos/") ? styles.active : ""}`}
            >
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
              仓库
            </Link>
            <Link
              href="/settings"
              className={`${styles.navLink} ${pathname === "/settings" ? styles.active : ""}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              设置
            </Link>
          </nav>

          <div className={styles.sidebarFooter}>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              退出登录
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={styles.main}>{children}</main>
      </div>

      {/* GitHub APP 安装引导弹窗 */}
      <GitHubAppInstallModal
        isOpen={showInstallModal}
        onClose={handleModalClose}
      />
    </>
  );
}
