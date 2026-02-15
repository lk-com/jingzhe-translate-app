# GitHub Global - 技术方案提案

## Why

开源项目国际化是扩大项目影响力的关键路径，但现有解决方案（如 GitHub Actions 或命令行工具）需要复杂的配置和技术背景。**GitHub Global** 旨在提供一个零配置的 SaaS 平台，让开源作者只需点击几下即可将文档翻译成多种语言，真正实现"零配置，一键翻译，让你的 GitHub 项目走向全球"。

## What Changes

本项目将构建一个完整的 Web SaaS 平台，核心变更包括：

- **新增 GitHub OAuth 认证系统** - 用户通过 GitHub 账号登录，授权访问仓库
- **新增仓库管理与配置系统** - 导入仓库、可视化配置翻译范围、目标语言
- **新增 AI 翻译引擎** - 基于 OpenRouter 统一接入多种 AI 模型进行翻译
- **新增变更检测与增量翻译** - 自动检测 GitHub commits 变更，仅翻译变更内容
- **新增 README 多语言链接生成** - AI 智能分析 README 结构，自动插入语言切换链接
- **新增翻译结果提交系统** - 将翻译后的文件自动提交回 GitHub 仓库

## Capabilities

### New Capabilities

根据 MVP 需求，将创建以下能力模块：

- `github-auth`: GitHub OAuth 认证与授权管理，包括用户登录、Token 加密存储、权限管理
- `repo-management`: 仓库管理，包括仓库导入、文件树展示、仓库配置持久化
- `translation-config`: 翻译配置管理，包括目标语言选择、翻译范围可视化配置、忽略规则管理
- `translation-engine`: 翻译执行引擎，基于 OpenRouter API 调用 AI 模型进行文档翻译
- `change-detection`: 变更检测与同步，通过 GitHub API 对比 commits，实现增量翻译
- `readme-processor`: README 智能处理，AI 分析 README 结构并插入多语言切换链接

### Modified Capabilities

- 无（本项目为全新系统）

## Impact

### 技术架构影响

- **前端**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui，提供全栈能力
- **后端**: Next.js API Routes，无需单独后端服务
- **数据库**: MySQL 8.0+，用户配置、仓库配置、翻译任务状态持久化
- **缓存**: Redis，用于翻译任务队列、GitHub API 缓存、限流计数
- **部署**: Docker 容器化，确保开发、测试、生产环境一致性
- **外部依赖**:
  - GitHub API (REST API v3) - 仓库访问、文件操作、Commit 创建
  - OpenRouter API - AI 翻译服务，统一接入多种模型

### 安全考虑

- GitHub OAuth Token 需加密存储（AES-256-GCM）
- OpenRouter API Key 需加密存储，支持用户自带密钥模式 (BYOK)
- 所有敏感操作需验证用户权限
- 实现多层限流机制防止资源滥用（全局/用户/IP/仓库）
- Session 安全配置：HttpOnly, Secure, SameSite
- CSRF 防护：OAuth state 参数验证

### 性能考虑

- GitHub API 有 Rate Limit (5000 requests/hour for authenticated users)
- OpenRouter API 调用成本需控制，支持多种模型选择以平衡成本与质量
- 翻译任务需异步处理，避免阻塞用户界面
- 多层限流保护：全局 10000 次/小时 (AI 调用)、用户 100 次/小时 (翻译文件数)、IP 60 次/分钟、仓库 5 次/小时
- 平台托管模式提供免费 AI 额度，用户可自带 API Key (BYOK) 绕过平台限制

---

*文档版本: v1.0*
*创建日期: 2026-02-14*
*关联需求文档: [需求文档.md](../../../github-global/需求文档.md)*
