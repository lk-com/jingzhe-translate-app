import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link href="/" className={styles.logo}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>GitHub Global</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/login" className={styles.btnLogin}>
              登录
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            AI 驱动翻译
          </div>
          <h1 className={styles.heroTitle}>
            立即翻译您的 GitHub
            <br />
            <span className={styles.highlight}>文档</span>
          </h1>
          <p className={styles.heroDescription}>
            使用先进的 AI 技术，自动将您的 README 和文档翻译成 20+
            种语言。让您的文档与代码保持同步。
          </p>
          <div className={styles.heroCta}>
            <Link href="/login" className={styles.btnPrimary}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              免费开始使用
            </Link>
            <Link href="#features" className={styles.btnSecondary}>
              了解更多
            </Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>20+</span>
              <span className={styles.statLabel}>语言</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>100%</span>
              <span className={styles.statLabel}>AI 准确率</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNumber}>免费</span>
              <span className={styles.statLabel}>开始使用</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.codePreview}>
            <div className={styles.codeHeader}>
              <div className={styles.codeDots}>
                <span className={styles.dotRed} />
                <span className={styles.dotYellow} />
                <span className={styles.dotGreen} />
              </div>
              <span className={styles.codeTitle}>README.md</span>
            </div>
            <pre className={styles.codeContent}>
              {`# My Project

## Getting Started

Install the package:

\`\`\`bash
npm install my-package
\`\`\`

## Features

- Fast and efficient
- Easy to use
- Well documented`}
            </pre>
            <div className={styles.codeTranslation}>
              <span className={styles.langBadge}>中文</span>
              <span className={styles.langBadge}>日本語</span>
              <span className={styles.langBadge}>Español</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresHeader}>
          <h2 className={styles.sectionTitle}>
            全球化您的文档
            <br />
            <span className={styles.highlight}>所需的一切</span>
          </h2>
          <p className={styles.sectionDescription}>
            强大的功能，帮助您触达全球受众
          </p>
        </div>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>多语言支持</h3>
            <p>支持翻译成 20+ 种语言，包括中文、日语、西班牙语、法语等。</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
            </div>
            <h3>智能缓存</h3>
            <p>仅翻译的文件。智能差异检测帮已修改您节省时间和 API 调用。</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
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
            <h3>GitHub 集成</h3>
            <p>连接您的 GitHub 账户，通过 PR 直接在您的仓库中进行翻译。</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <h3>预览和编辑</h3>
            <p>在提交前预览翻译结果。进行手动编辑以确保准确性。</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
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
            </div>
            <h3>安全可靠</h3>
            <p>您的令牌已加密。我们不会在未经许可的情况下存储您的数据。</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <h3>高质量翻译</h3>
            <p>由 GPT-4 和 Claude 提供支持，实现专业级翻译质量。</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2>准备好走向全球了吗？</h2>
          <p>立即开始翻译您的文档。个人开发者免费使用。</p>
          <Link href="/login" className={styles.btnPrimary}>
            开始翻译
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}>
              <svg
                width="24"
                height="24"
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
            </div>
            <p>面向全球开发者的 AI 驱动文档翻译服务。</p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerColumn}>
              <h4>产品</h4>
              <a href="#">功能</a>
              <a href="#">价格</a>
              <a href="#">文档</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>公司</h4>
              <a href="#">关于</a>
              <a href="#">博客</a>
              <a href="#">招聘</a>
            </div>
            <div className={styles.footerColumn}>
              <h4>法律</h4>
              <a href="#">隐私</a>
              <a href="#">条款</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; 2024 GitHub Global. 保留所有权利。</p>
        </div>
      </footer>
    </div>
  );
}
