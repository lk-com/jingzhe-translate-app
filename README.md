# GitHub Global 配置指南

## 概述

GitHub Global 是一个 AI 驱动的文档翻译 SaaS 平台，支持将 GitHub 仓库的文档翻译成 20+ 种语言。

---

## 1. 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库 (MySQL 8.0)
DATABASE_URL="mysql://username:password@localhost:3306/github_global"

# Redis
REDIS_URL="redis://localhost:6379"

# Next.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-key-min-32-chars"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# OpenRouter (AI 翻译)
OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 加密密钥（至少32位）
ENCRYPTION_KEY="your-encryption-key-min-32-characters"

# GitHub App Webhook（可选，用于 GitHub App 模式）
GITHUB_APP_WEBHOOK_SECRET="your-github-app-webhook-secret"
```

---

## 2. GitHub OAuth App 创建步骤

### 2.1 创建 OAuth App

1. 打开 GitHub → Settings → Developer settings → OAuth Apps
2. 点击 "New OAuth App"
3. 填写表单：

| 字段 | 值 |
|------|-----|
| Application name | GitHub Global |
| Homepage URL | http://localhost:3000 |
| Authorization callback URL | http://localhost:3000/api/auth/callback |
| Application description | (可选) AI-powered documentation translation |

4. 点击 "Register application"
5. 复制生成的 `Client ID`
6. 点击 "Generate a new client secret"，复制 `Client secret`

### 2.2 配置环境变量

```env
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
```

### 2.3 GitHub App（可选，用于仓库级 Webhook）

如果你想在 GitHub App 级别配置 webhook（而不是仓库级别），按以下步骤操作：

1. 打开 GitHub → Settings → Developer settings → GitHub Apps
2. 点击 "New GitHub App"
3. 填写表单：

| 字段 | 值 |
|------|-----|
| GitHub App name | GitHub Global |
| Homepage URL | http://localhost:3000 |
| Webhook URL | http://localhost:3000/api/webhook/github-app |
| Webhook secret | 生成一个随机字符串 |

4. 设置仓库权限（Repository permissions）：
   - Contents: Read
   - Pull requests: Read & write
   - Commit statuses: Read

5. 设置用户权限（User permissions）：
   - Email addresses: Read

6. 订阅事件（Subscribe to events）：
   - Push
   - Pull request

7. 点击 "Create GitHub App"
8. 保存生成的：
   - App ID
   - Client ID
   - Generate a new client secret
   - 生成或导入 Private key

9. 在环境变量中添加：
```env
GITHUB_APP_ID="your-app-id"
GITHUB_APP_CLIENT_ID="your-app-client-id"
GITHUB_APP_CLIENT_SECRET="your-app-client-secret"
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET="your-webhook-secret"
```

---

## 3. 数据库设置

### 3.1 MySQL 8.0

**方式一：Docker Compose（推荐）**

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: github_global
      MYSQL_USER: github_global
      MYSQL_PASSWORD: github_global_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

运行：
```bash
docker-compose up -d mysql
```

**方式二：本地安装**

1. 安装 MySQL 8.0
2. 创建数据库和用户：
```sql
CREATE DATABASE github_global CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'github_global'@'localhost' IDENTIFIED BY 'your-password';
GRANT ALL PRIVILEGES ON github_global.* TO 'github_global'@'localhost';
FLUSH PRIVILEGES;
```

### 3.2 运行 Prisma 迁移

```bash
cd github-global
npx prisma migrate dev --name init
```

### 3.3 建表语句（可选，手动创建）

如果需要手动创建数据库，可以使用以下 SQL 语句：

```sql
-- 创建数据库
CREATE DATABASE github_global CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE github_global;

-- 用户表
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    `github_id` INTEGER NOT NULL COMMENT 'GitHub用户ID',
    `github_login` VARCHAR(191) NOT NULL COMMENT 'GitHub登录名',
    `github_token` VARCHAR(191) NOT NULL COMMENT 'GitHub访问令牌（加密存储）',
    `openrouter_api_key` VARCHAR(191) NULL COMMENT 'OpenRouter API密钥（加密存储）',
    `is_whitelisted` BOOLEAN NOT NULL DEFAULT false COMMENT '是否在白名单中',
    `daily_quota` INTEGER NOT NULL DEFAULT 100 COMMENT '每日配额',
    `used_quota` INTEGER NOT NULL DEFAULT 0 COMMENT '已使用配额',
    `quota_reset_date` DATETIME(3) NULL COMMENT '配额重置日期',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',
    UNIQUE INDEX `users_github_id_key`(`github_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 仓库表
CREATE TABLE `repositories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '仓库ID',
    `user_id` INTEGER NOT NULL COMMENT '用户ID',
    `github_repo_id` INTEGER NOT NULL COMMENT 'GitHub仓库ID',
    `owner` VARCHAR(191) NOT NULL COMMENT '仓库所有者',
    `name` VARCHAR(191) NOT NULL COMMENT '仓库名称',
    `default_branch` VARCHAR(191) NOT NULL DEFAULT 'main' COMMENT '默认分支',
    `base_language` VARCHAR(191) NOT NULL DEFAULT 'en' COMMENT '源语言',
    `target_languages` JSON NULL COMMENT '目标语言列表',
    `ignore_rules` VARCHAR(191) NULL COMMENT '忽略规则',
    `last_commit_sha` String(191) NULL COMMENT '最后提交SHA',
    `webhook_secret` VARCHAR(191) NULL COMMENT 'Webhook密钥',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',
    INDEX `repositories_user_id_idx`(`user_id`),
    UNIQUE INDEX `repositories_user_id_github_repo_id_key`(`user_id`, `github_repo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 翻译任务表
CREATE TABLE `translation_tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '任务ID',
    `repository_id` INTEGER NOT NULL COMMENT '仓库ID',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending' COMMENT '任务状态: pending/running/completed/failed',
    `type` VARCHAR(191) NULL COMMENT '翻译类型: full/incremental',
    `target_languages` JSON NOT NULL COMMENT '目标语言列表',
    `total_files` INTEGER NOT NULL DEFAULT 0 COMMENT '总文件数',
    `processed_files` INTEGER NOT NULL DEFAULT 0 COMMENT '已处理文件数',
    `failed_files` INTEGER NOT NULL DEFAULT 0 COMMENT '失败文件数',
    `result` JSON NULL COMMENT '翻译结果',
    `error_message` VARCHAR(191) NULL COMMENT '错误信息',
    `started_at` DATETIME(3) NULL COMMENT '开始时间',
    `completed_at` DATETIME(3) NULL COMMENT '完成时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    INDEX `translation_tasks_status_idx`(`status`),
    INDEX `translation_tasks_repository_id_idx`(`repository_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 限流表
CREATE TABLE `rate_limits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '限流ID',
    `identifier` VARCHAR(191) NOT NULL COMMENT '标识符（用户ID/IP/仓库ID）',
    `limit_type` VARCHAR(191) NOT NULL COMMENT '限流类型: global/user/ip/repo',
    `request_count` INTEGER NOT NULL DEFAULT 1 COMMENT '请求计数',
    `window_start` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '窗口开始时间',
    INDEX `rate_limits_window_start_idx`(`window_start`),
    UNIQUE INDEX `rate_limits_identifier_limit_type_key`(`identifier`, `limit_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 外键约束
ALTER TABLE `repositories` ADD CONSTRAINT `repositories_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `translation_tasks` ADD CONSTRAINT `translation_tasks_repository_id_fkey`
    FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 4. Redis 设置

### 4.1 Docker Compose（推荐）

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 4.2 本地安装

**Windows (WSL2):**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

**Windows (直接):**
下载 Redis for Windows 并运行。

---

## 5. OpenRouter 配置

### 5.1 注册账号

1. 打开 [OpenRouter](https://openrouter.ai/)
2. 注册并登录
3. 进入 Dashboard → Keys
4. 创建新的 API Key

### 5.2 选择模型

推荐用于翻译的模型：
- `deepseek/deepseek-chat` - 性价比高
- `anthropic/claude-3.5-sonnet` - 翻译质量高
- `google/gemini-pro-1.5` - 多语言能力强

### 5.3 配置环境变量

```env
OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 6. 运行应用

### 6.1 开发模式

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 运行开发服务器
npm run dev
```

访问 http://localhost:3000

### 6.2 Docker 完整运行

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

---

## 7. 功能使用流程

### 7.1 登录

1. 访问 http://localhost:3000/login
2. 点击 "Continue with GitHub"
3. 完成 GitHub 授权

### 7.2 添加仓库

1. 登录后进入 Dashboard
2. 点击 "Add Repository"
3. 从下拉列表选择你的 GitHub 仓库
4. 配置目标语言

### 7.3 翻译文档

1. 选择仓库
2. 点击 "Start Translation"
3. 选择翻译类型：
   - **Full Translation**: 翻译整个仓库的文档
   - **Incremental Translation**: 仅翻译新增/修改的文件
4. 等待翻译完成
5. 预览翻译结果
6. 确认后自动创建 PR 到原仓库

### 7.4 配置 Webhook（自动翻译）

Webhook 允许在代码推送到仓库时自动触发增量翻译。

#### 7.4.1 创建 Webhook

1. 在 Dashboard 中选择仓库
2. 点击 "Settings" 或 "Webhook" 设置
3. 点击 "Setup Webhook"
4. 系统会生成 Webhook URL 和 Secret

#### 7.4.2 在 GitHub 中配置

1. 进入 GitHub 仓库 → Settings → Webhooks
2. 点击 "Add webhook"
3. 填写配置：

| 字段 | 值 |
|------|-----|
| Payload URL | 生成的 Webhook URL |
| Content type | application/json |
| Secret | 生成的 Secret |
| Events | push, pull requests |

4. 点击 "Add webhook"

#### 7.4.3 Webhook 事件

| 事件 | 说明 |
|------|------|
| push | 当代码推送到默认分支时，自动触发增量翻译 |
| pull_request | PR 事件（预留） |
| ping | 测试连接 |

---

## 8. Webhook API 参考

### 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/webhook?repoId=<id>` | 仓库 Webhook（OAuth 模式） |
| POST | `/api/webhook/github-app` | GitHub App Webhook |
| POST | `/api/webhook/manage` | 创建 Webhook（需认证） |
| GET | `/api/webhook/manage?repoId=<id>` | 获取 Webhook 信息（需认证） |

### 两种模式对比

| 特性 | OAuth 模式 | GitHub App 模式 |
|------|-----------|----------------|
| Webhook 配置 | 仓库级别 | App 级别 |
| 权限管理 | 用户授权 | App 权限 |
| 使用场景 | 个人项目 | 组织/多仓库 |

### Webhook 签名验证

所有 webhook 请求都经过 HMAC SHA-256 签名验证：
- Header: `X-Hub-Signature-256`
- 算法: `sha256=<hmac-sha256>`

---

## 9. 常见问题

### Q: 翻译请求失败怎么办？

检查：
1. OpenRouter API Key 是否有效
2. 账户余额是否充足
3. 网络是否能访问 OpenRouter

### Q: 如何查看翻译日志？

在 Dashboard 中点击对应任务查看详情。

### Q: 支持哪些文档格式？

- Markdown (.md)
- Text (.txt)
- JSON (.json)
- YAML (.yaml)
- HTML (.html)

### Q: Webhook 没有触发翻译怎么办？

检查：
1. GitHub webhook 是否显示绿色勾（成功）
2. 查看 GitHub webhook delivery 日志
3. 确认仓库已配置目标语言
4. 验证 webhook URL 可访问

---

## 10. 生产部署

### 10.1 构建 Docker 镜像

```bash
docker build -t github-global:latest .
```

### 10.2 环境变量（生产）

确保设置：
```env
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<生成强随机密钥>
ENCRYPTION_KEY=<至少32位随机密钥>
```

### 10.3 HTTPS

建议使用 Nginx 或 Cloudflare 配置 HTTPS。
