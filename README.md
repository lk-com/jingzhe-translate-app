# TranslaHub - AI 驱动的文档翻译平台

TranslaHub 是一个基于 AI 的 GitHub 文档翻译 SaaS 平台，帮助开发者轻松将仓库文档翻译成 20+ 种语言，促进开源项目的全球化传播。

---

## 目录

1. [功能特性](#功能特性)
2. [快速开始](#快速开始)
3. [环境变量配置](#环境变量配置)
4. [GitHub OAuth 配置](#github-oauth-配置)
5. [GitHub App 配置](#github-app-配置)
6. [数据库设置](#数据库设置)
7. [Redis 设置](#redis-设置)
8. [AI 服务配置](#ai-服务配置)
9. [运行应用](#运行应用)
10. [使用指南](#使用指南)
11. [API 参考](#api-参考)
12. [生产部署](#生产部署)

---

## 功能特性

- **🚀 零配置体验**：无需配置 GitHub Actions，在线即可完成翻译
- **🤖 多 AI 支持**：支持 OpenRouter、DeepSeek、豆包、通义千问等多种大语言模型
- **🌍 多语言支持**：支持 20+ 种目标语言翻译
- **📝 格式保留**：完整保留 Markdown 格式、代码块和链接结构
- **⚡ 自动化工作流**：GitHub Webhook 触发自动翻译
- **🔒 安全加密**：敏感数据采用 AES-256 加密存储
- **📊 配额管理**：用户级翻译配额控制

---

## 快速开始

### 使用 Docker Compose（推荐）

```bash
cd translahub

# 1. 复制环境变量模板
cp .env.example .env

# 2. 编辑 .env 文件，填入你的配置
# 详见下方【环境变量配置】章节

# 3. 启动所有服务
docker-compose up -d

# 4. 运行数据库迁移
docker-compose exec app npx prisma migrate dev

# 5. 访问 http://localhost:3000
```

### 本地开发

```bash
cd translahub

# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env

# 3. 编辑 .env 文件

# 4. 生成 Prisma Client
npm run db:generate

# 5. 运行数据库迁移
npm run db:migrate

# 6. 启动开发服务器
npm run dev
```

---

## 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# ============================================
# 应用基础配置
# ============================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# 数据库 (MySQL 8.0)
# ============================================
DATABASE_URL="mysql://username:password@localhost:3306/translahub"

# ============================================
# Redis (会话存储、缓存、队列)
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# 会话加密 (至少 32 位)
# ============================================
SESSION_SECRET=your_session_secret_min_32_chars_long

# ============================================
# 数据加密 (至少 32 位，用于加密敏感数据)
# ============================================
ENCRYPTION_KEY=your_32_char_encryption_key

# ============================================
# GitHub OAuth (必需)
# ============================================
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback

# ============================================
# GitHub App (可选，用于自动翻译)
# ============================================
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_PRIVATE_KEY_PATH=private-key.pem
GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_GITHUB_APP_SLUG=your_github_app_slug

# ============================================
# AI 翻译服务 (OpenRouter 推荐)
# ============================================
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=TransLaHub

# 默认翻译模型
DEFAULT_MODEL=openai/gpt-4o-mini
```

---

## GitHub OAuth 配置

### 1. 创建 OAuth App

1. 打开 GitHub → Settings → Developer settings → OAuth Apps
2. 点击 **"New OAuth App"**
3. 填写表单：

| 字段 | 值 |
|------|-----|
| Application name | TranslaHub |
| Homepage URL | http://localhost:3000 |
| Authorization callback URL | http://localhost:3000/api/auth/callback |
| Application description | AI-powered documentation translation platform |

4. 点击 **"Register application"**
5. 复制生成的 **Client ID**
6. 点击 **"Generate a new client secret"**，复制 **Client secret**

### 2. 配置环境变量

```env
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

---

## GitHub App 配置

GitHub App 用于实现自动翻译功能（当文档更新时自动触发翻译）。

### 1. 创建 GitHub App

1. 打开 GitHub → Settings → Developer settings → **GitHub Apps**
2. 点击 **"New GitHub App"**
3. 填写表单：

| 字段 | 值 |
|------|-----|
| GitHub App name | TranslaHub |
| Homepage URL | http://localhost:3000 |
| Webhook URL | http://localhost:3000/api/webhook/github-app |
| Webhook secret | 生成一个随机字符串（用于验证 Webhook） |

4. **仓库权限** (Repository permissions)：
   - **Contents**: Read & write
   - **Pull requests**: Read & write
   - **Commit statuses**: Read

5. **用户权限** (User permissions)：
   - **Email addresses**: Read

6. **订阅事件** (Subscribe to events)：
   - ✅ Push
   - ✅ Pull request

7. 点击 **"Create GitHub App"**

### 2. 生成私钥

1. 在 App 设置页面，滚动到 **"Private keys"** 部分
2. 点击 **"Generate a private key"**
3. 下载的 `.pem` 文件保存为 `translahub/private-key.pem`

### 3. 配置环境变量

```env
GITHUB_APP_ID="your-app-id"
GITHUB_APP_PRIVATE_KEY_PATH=private-key.pem
GITHUB_APP_WEBHOOK_SECRET="your-webhook-secret"
NEXT_PUBLIC_GITHUB_APP_SLUG="your-github-app-slug"
```

### 4. 安装 GitHub App

1. 在 App 设置页面，点击 **"Install App"**
2. 选择要安装的个人账号或组织
3. 选择要授权访问的仓库（或全部仓库）
4. 点击 **"Install"**

---

## 数据库设置

### 使用 Docker（推荐）

已包含在 `docker-compose.yml` 中：

```yaml
mysql:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: password
    MYSQL_DATABASE: translahub
  ports:
    - "3306:3306"
  volumes:
    - mysql-data:/var/lib/mysql
```

### 本地安装 MySQL 8.0

```sql
-- 创建数据库
CREATE DATABASE translahub 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 创建用户（可选）
CREATE USER 'translahub'@'localhost' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON translahub.* TO 'translahub'@'localhost';
FLUSH PRIVILEGES;
```

### 运行数据库迁移

```bash
# 生成 Prisma Client
npm run db:generate

# 运行迁移
npm run db:migrate

# 或使用 Prisma Studio 查看数据
npm run db:studio
```

---

## Redis 设置

### 使用 Docker（推荐）

已包含在 `docker-compose.yml` 中：

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
```

### 本地安装

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows (WSL2):**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

---

## AI 服务配置

TranslaHub 支持多种 AI 提供商：

### OpenRouter（推荐）

1. 访问 [OpenRouter](https://openrouter.ai/) 注册账号
2. 进入 Dashboard → Keys 创建 API Key
3. 配置环境变量：

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=TransLaHub
DEFAULT_MODEL=openai/gpt-4o-mini
```

**推荐模型：**
- `openai/gpt-4o-mini` - 性价比高（默认）
- `anthropic/claude-3.5-sonnet` - 翻译质量高
- `google/gemini-pro-1.5` - 多语言能力强

### DeepSeek

```env
# 用户可在设置页面配置自己的 DeepSeek API Key
# 无需服务端配置
```

### 其他提供商

支持豆包、通义千问等，用户可在个人设置中配置各自的 API Key。

---

## 运行应用

### 开发模式

```bash
npm run dev
```
访问 http://localhost:3000

### 生产构建

```bash
npm run build
npm start
```

### Docker 生产部署

```bash
# 构建镜像
docker build -t translahub:latest .

# 运行容器
docker run -p 3000:3000 --env-file .env translahub:latest
```

---

## 使用指南

### 1. 登录

1. 访问 http://localhost:3000/login
2. 点击 **"Continue with GitHub"**
3. 完成 GitHub 授权

### 2. 添加仓库

1. 登录后进入 Dashboard
2. 点击 **"Add Repository"**
3. 从列表选择你的 GitHub 仓库
4. 配置：
   - **源语言**：文档的原始语言
   - **目标语言**：要翻译成的语言（可多选）
   - **忽略规则**：排除不需要翻译的文件（如 `node_modules/**`）

### 3. 开始翻译

1. 选择仓库，点击 **"Start Translation"**
2. 选择翻译类型：
   - **Full Translation**: 翻译整个仓库的文档
   - **Incremental Translation**: 仅翻译新增/修改的文件
3. 等待翻译完成
4. 预览翻译结果
5. 确认后自动创建 PR 到原仓库

### 4. 配置自动翻译（Webhook）

1. 在仓库详情页，点击 **"Setup Webhook"**
2. 系统会自动配置 GitHub Webhook
3. 当默认分支有新提交时，自动触发增量翻译

---

## API 参考

### 认证相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/auth/github` | 启动 GitHub OAuth 登录 |
| GET | `/api/auth/callback` | OAuth 回调处理 |
| POST | `/api/auth/logout` | 用户登出 |

### 仓库管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/repos` | 获取用户仓库列表 |
| POST | `/api/repos` | 添加新仓库 |
| GET | `/api/repos/[id]` | 获取仓库详情 |
| DELETE | `/api/repos/[id]` | 删除仓库配置 |
| GET | `/api/repos/[id]/files` | 获取仓库文件列表 |
| POST | `/api/repos/[id]/detect-language` | 检测文档语言 |

### 翻译任务

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/translate/create` | 创建翻译任务 |
| GET | `/api/translate/tasks` | 获取任务列表 |
| GET | `/api/translate/[id]` | 获取任务详情 |
| POST | `/api/translate/[id]/commit` | 提交翻译结果 |
| GET | `/api/translate/[id]/preview` | 预览翻译结果 |

### Webhook

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/webhook?repoId=<id>` | 仓库级 Webhook |
| POST | `/api/webhook/github-app` | GitHub App Webhook |
| POST | `/api/webhook/manage` | 创建/管理 Webhook |

### 用户设置

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/user/profile` | 获取用户信息 |
| POST | `/api/user/settings` | 更新用户设置 |
| POST | `/api/user/refresh-installation` | 刷新 GitHub App 安装状态 |

---

## 生产部署

### 环境变量检查清单

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
SESSION_SECRET=<生成强随机密钥，至少32位>
ENCRYPTION_KEY=<生成强随机密钥，至少32位>
```

### 安全建议

1. **使用 HTTPS**：配置 Nginx 或 Cloudflare 提供 HTTPS
2. **密钥管理**：使用密钥管理服务（如 AWS Secrets Manager、Azure Key Vault）
3. **数据库安全**：
   - 使用强密码
   - 限制访问 IP
   - 定期备份
4. **Redis 安全**：
   - 启用密码认证
   - 限制访问 IP

### 使用 Docker Compose 部署

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://root:password@mysql:3306/translahub
      - REDIS_URL=redis://redis:6379
      # ... 其他环境变量
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: <strong-password>
      MYSQL_DATABASE: translahub
    volumes:
      - mysql-data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass <strong-password>
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:
```

---

## 常见问题

### Q: 翻译请求失败怎么办？

检查：
1. AI 提供商 API Key 是否有效
2. 账户余额是否充足
3. 网络是否能访问 AI 服务
4. 查看任务详情中的错误信息

### Q: Webhook 没有触发翻译？

检查：
1. GitHub Webhook 是否显示绿色勾（成功送达）
2. 查看 GitHub Webhook delivery 日志
3. 确认仓库已配置目标语言
4. 验证 `GITHUB_APP_WEBHOOK_SECRET` 配置正确

### Q: 支持哪些文档格式？

- Markdown (.md)
- 纯文本 (.txt)
- JSON (.json)
- YAML (.yaml, .yml)
- HTML (.html)

### Q: 如何查看翻译日志？

在 Dashboard 中点击对应任务查看详情，包含：
- 处理文件数/总文件数
- 成功/失败状态
- 错误信息（如有）

---

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Prisma ORM
- **数据库**: MySQL 8.0
- **缓存**: Redis 7
- **AI SDK**: OpenAI SDK (兼容多厂商)
- **测试**: Vitest + Testing Library

---

## 许可证

MIT License

---

## 贡献

欢迎提交 Issue 和 Pull Request！
