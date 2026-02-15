# GitHub Global - 技术设计文档

## Context

### 项目背景

GitHub Global 是一个 SaaS 平台，帮助开源项目作者将文档自动翻译成多种语言。目标用户是开源项目维护者、技术博客作者以及希望让项目国际化的开发者。

### 技术调研结论

基于最新的 GitHub REST API (v3) 和 OpenRouter API 调研：

1. **GitHub OAuth**: 采用 Web Application Flow (Authorization Code Flow)，用户授权后获取 access token，用于代表用户访问 GitHub API，支持 PR 创建和 Webhook 配置
2. **GitHub API**: REST API v3 提供完整的仓库操作能力：
   - `GET /repos/{owner}/{repo}/contents/{path}` - 获取文件内容
   - `GET /repos/{owner}/{repo}/commits` - 获取提交历史
   - `PUT /repos/{owner}/{repo}/contents/{path}` - 创建/更新文件
3. **OpenRouter API**: 兼容 OpenAI SDK 的统一接口，支持 200+ AI 模型，通过 Bearer Token 认证

### 约束条件

- GitHub API Rate Limit: 5000 requests/hour (authenticated OAuth)
- 用户敏感信息（GitHub Token、API Key）必须加密存储
- MVP 阶段专注核心翻译功能，Webhook 自动触发作为 Phase 2 功能
- 平台需提供 AI 模型免费使用额度，并实现限流保护

## Goals / Non-Goals

**Goals:**

- 提供零配置的 GitHub 文档翻译 SaaS 服务
- 支持 GitHub OAuth 登录和仓库访问授权
- 实现基于 OpenRouter 的 AI 翻译引擎
- 支持增量翻译（仅翻译变更的文件）
- 自动生成 README 多语言切换链接
- 支持平台托管模式（管理员提供免费额度）和用户自带 API Key 模式
- 实现完善的限流机制，防止资源滥用
- 支持创建 PR 合并翻译结果

**Non-Goals:**

- 翻译非 Markdown 文件（如代码注释、HTML 等）- MVP 阶段仅支持 Markdown
- 实时 Webhook 自动触发翻译 - Phase 2 功能
- 翻译质量人工审核流程
- 团队协作和权限管理 - 单用户版
- 翻译记忆库和术语表管理

## Decisions

### 0. GitHub 平台集成方式技术分析

基于 GitHub 官方文档 (2025)，通过程序操作 GitHub 平台主要有两种实现方式：**GitHub App** 和 **OAuth App**。以下详细阐述两者的技术原理、功能特性及适用场景。

#### 0.1 GitHub App 技术优势与特性

**核心定位**：GitHub App 是 GitHub 推荐的现代集成方式，提供更安全、更精细的权限控制和更高的 API 限制。

##### 0.1.1 增强的安全性

| 安全特性               | GitHub App                                | OAuth App                                   |
| ---------------------- | ----------------------------------------- | ------------------------------------------- |
| **权限粒度**     | 细粒度权限，可单独请求只读内容权限        | 粗粒度 Scope，`repo` 包含所有仓库操作权限 |
| **仓库访问控制** | 安装时可选择特定仓库，用户/组织管理员控制 | 授权后可访问用户所有可访问仓库              |
| **令牌有效期**   | 短期令牌（默认 1 小时过期）               | 令牌长期有效，直到用户主动撤销              |
| **令牌泄露影响** | 影响范围小，令牌快速失效                  | 影响范围大，令牌长期有效                    |

**细粒度权限示例**：

- GitHub App 可单独请求 `contents:read`（只读仓库内容），而 OAuth App 必须请求整个 `repo` scope
- GitHub App 可单独请求 `issues:write` 而不获取代码访问权限
- OAuth App 无法使用细粒度权限，只能使用预定义的 scope 组合

##### 0.1.2 独立身份与自动化能力

**身份模式**：

| 模式               | 说明                                       | 适用场景                      |
| ------------------ | ------------------------------------------ | ----------------------------- |
| **App 身份** | 以 `@app-name[bot]` 身份执行操作         | 自动化工作流、定时任务、CI/CD |
| **用户身份** | 以用户身份执行，显示 "由 App 代表用户执行" | 需要归属到特定用户的操作      |
| **混合模式** | 根据场景灵活切换                           | 复杂业务流程                  |

**关键优势**：

- GitHub App 不绑定用户账户，不占用企业席位 (Seat)
- 安装者离开组织后，App 仍保持安装状态，业务不中断
- Bot 账户无密码，无法直接登录，安全性更高

##### 0.1.3 可扩展的 Rate Limit

| 认证方式                                  | Rate Limit                            | 扩展性                 |
| ----------------------------------------- | ------------------------------------- | ---------------------- |
| **GitHub App (Installation Token)** | 基础 5000/小时 + 按仓库数和用户数扩展 | 可扩展，支持企业级应用 |
| **OAuth App**                       | 固定 5000/小时 (用户配额)             | 不可扩展               |
| **匿名请求**                        | 60/小时                               | -                      |

**GitHub App Rate Limit 计算公式**：

```
Rate Limit = 5000 + (仓库数 × 250) + (组织用户数 × 50)
```

##### 0.1.4 内置 Webhook 支持

| 特性                   | GitHub App                                   | OAuth App                             |
| ---------------------- | -------------------------------------------- | ------------------------------------- |
| **Webhook 配置** | 内置集中式 Webhook，自动接收所有授权仓库事件 | 需为每个仓库单独创建 Webhook          |
| **事件范围**     | 所有授权仓库和组织的事件                     | 仅配置了 Webhook 的仓库               |
| **卸载处理**     | 自动禁用 Webhook                             | 需手动清理，无自动机制                |
| **组织级事件**   | 支持接收组织级事件                           | 需请求 `write:org` scope 并单独配置 |

##### 0.1.5 三种认证模式

GitHub App 支持三种认证模式，满足不同场景需求：

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub App 认证模式                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   App 身份认证   │  Installation   │      用户身份认证            │
│   (JWT)         │  Token          │      (User Access Token)    │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ 用于管理 App     │ 用于访问安装了    │ 用于代表用户执行操作          │
│ 自身资源         │ App 的仓库资源    │                             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ - 列出安装列表   │ - 读写仓库内容    │ - 以用户身份提交代码          │
│ - 管理 App 设置  │ - 创建 PR/Issue  │ - 用户操作审计追踪            │
│ - 获取安装令牌   │ - 配置 Webhook   │ - 用户权限边界控制            │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

#### 0.2 OAuth App 技术特性

**核心定位**：OAuth App 是传统的 GitHub 集成方式，适合需要代表用户执行操作的场景。

##### 0.2.1 技术原理

OAuth App 基于 OAuth 2.0 Authorization Code Flow：

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │     │   App    │     │  GitHub  │     │ GitHub   │
│          │     │  Server  │     │   OAuth  │     │   API    │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. 点击登录     │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ 2. 重定向到授权页 │                │
     │<───────────────────────────────>│                │
     │                │                │                │
     │ 3. 用户授权     │                │                │
     │───────────────────────────────>│                │
     │                │                │                │
     │                │ 4. 回调 code   │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │ 5. 用 code 换 token              │
     │                │───────────────>│                │
     │                │                │                │
     │                │ 6. access_token│                │
     │                │<───────────────│                │
     │                │                │                │
     │                │ 7. 调用 API    │                │
     │                │────────────────────────────────>│
     │                │                │                │
     │                │ 8. 返回数据     │                │
     │                │<────────────────────────────────│
```

##### 0.2.2 OAuth Scope 权限体系

| Scope               | 权限范围       | 说明                                           |
| ------------------- | -------------- | ---------------------------------------------- |
| `repo`            | 完整仓库访问   | 包含读写所有公开/私有仓库、Issues、PR、Webhook |
| `repo:status`     | Commit 状态    | 仅访问 commit status API                       |
| `repo_deployment` | 部署状态       | 访问 deployment status API                     |
| `public_repo`     | 公开仓库       | 仅访问公开仓库                                 |
| `repo:invite`     | 仓库邀请       | 邀请协作者                                     |
| `user`            | 用户信息       | 读写用户资料                                   |
| `read:user`       | 读取用户信息   | 只读用户资料                                   |
| `user:email`      | 用户邮箱       | 读取用户邮箱地址                               |
| `user:follow`     | 关注关系       | 关注/取消关注用户                              |
| `read:org`        | 读取组织       | 读取组织信息                                   |
| `write:org`       | 写入组织       | 管理组织                                       |
| `gist`            | Gist           | 创建 Gist                                      |
| `notifications`   | 通知           | 读取通知                                       |
| `write:packages`  | 包管理         | 上传包到 GitHub Packages                       |
| `read:packages`   | 读取包         | 从 GitHub Packages 下载包                      |
| `delete:packages` | 删除包         | 删除包                                         |
| `workflow`        | GitHub Actions | 更新 workflow 文件                             |

##### 0.2.3 OAuth App 的局限性

1. **权限粒度粗**：无法单独请求只读权限，`repo` scope 包含所有仓库操作权限
2. **令牌长期有效**：令牌不会自动过期，泄露风险高
3. **访问范围不可控**：授权后可访问用户所有仓库，无法限制到特定仓库
4. **Rate Limit 固定**：使用用户配额，无法扩展
5. **Webhook 配置繁琐**：需为每个仓库单独配置 Webhook
6. **依赖用户账户**：用户离开组织后，集成可能中断

#### 0.3 技术对比总览

| 对比维度              | GitHub App                           | OAuth App                  |
| --------------------- | ------------------------------------ | -------------------------- |
| **权限模型**    | 细粒度权限（按资源类型分别设置读写） | 粗粒度 Scope               |
| **仓库访问**    | 安装时选择特定仓库                   | 授权后访问所有仓库         |
| **令牌有效期**  | 1 小时，可刷新                       | 永久，直到撤销             |
| **Rate Limit**  | 可扩展（基础 5000 + 动态增加）       | 固定 5000/小时             |
| **Webhook**     | 内置集中式，自动管理                 | 需单独配置每个仓库         |
| **身份模式**    | App 身份 / 用户身份                  | 仅用户身份                 |
| **企业席位**    | 不占用                               | 占用用户席位               |
| **组织依赖**    | 独立于用户                           | 依赖授权用户               |
| **企业级资源**  | 不支持（如 enterprise object）       | 支持                       |
| **实现复杂度**  | 较高（JWT + Installation Token）     | 较低（OAuth 2.0 标准流程） |
| **GitHub 推荐** | ✅ 推荐首选                          | 传统方式                   |

#### 0.4 适用场景分析

##### 0.4.1 GitHub App 适用场景

| 场景                       | 原因                                        |
| -------------------------- | ------------------------------------------- |
| **CI/CD 工具**       | 需要独立身份执行自动化任务，不依赖特定用户  |
| **代码审查机器人**   | 需要细粒度权限（如只读代码 + 写入 PR 评论） |
| **安全扫描工具**     | 需要限制访问范围，只扫描授权仓库            |
| **组织级应用**       | 需要跨多个仓库/组织的自动化工作流           |
| **SaaS 服务集成**    | 需要可扩展的 Rate Limit 和独立身份          |
| **长期运行的自动化** | 不依赖用户账户，用户离开不影响服务          |

##### 0.4.2 OAuth App 适用场景

| 场景                     | 原因                                     |
| ------------------------ | ---------------------------------------- |
| **用户身份操作**   | 需要以用户身份提交代码，显示用户为提交者 |
| **企业级资源访问** | 需要访问 enterprise object 等企业级资源  |
| **快速原型开发**   | 实现简单，快速验证产品概念               |
| **个人工具**       | 个人使用的脚本或工具，不需要组织级部署   |
| **现有系统集成**   | 已有 OAuth 基础设施，迁移成本低          |

#### 0.5 GitHub Global 项目选型决策

基于以上分析，**GitHub Global 项目选择 OAuth App** 的决策依据：

**选择 OAuth App 的理由**：

1. **用户身份操作**：翻译文件需要以用户身份提交到用户仓库，创建 PR 时显示用户为提交者
2. **MVP 快速验证**：OAuth App 实现简单，可快速上线验证产品价值
3. **用户授权流程熟悉**：用户对 OAuth 授权流程更熟悉，降低使用门槛
4. **企业级功能暂不需要**：MVP 阶段不需要访问 enterprise object

**未来迁移到 GitHub App 的考量**：

| 迁移时机 | 触发条件                       |
| -------- | ------------------------------ |
| Phase 2  | 需要实现 Webhook 自动触发翻译  |
| 用户增长 | Rate Limit 成为瓶颈            |
| 企业客户 | 需要细粒度权限控制和组织级管理 |
| 安全合规 | 需要短期令牌和更严格的访问控制 |

**迁移路径**：

1. 保留 OAuth App 用于用户身份操作
2. 新增 GitHub App 用于自动化任务（Webhook 处理、定时任务）
3. 逐步将自动化功能迁移到 GitHub App
4. 最终实现 OAuth App + GitHub App 混合架构

### 1. 认证方案: GitHub OAuth App vs GitHub App

**决策**: 使用 **GitHub OAuth App**

**理由**:

- OAuth App 更适合代表用户执行操作（以用户身份提交翻译文件、创建 PR）
- 实现简单，用户授权流程熟悉
- 无需处理 GitHub App 的 JWT 和 Installation Token 复杂度
- 支持 Webhook 配置和 PR 创建权限

**OAuth Scope 权限配置**:

| Scope          | 用途                                                           |
| -------------- | -------------------------------------------------------------- |
| `repo`       | 读取仓库内容、写入翻译文件、创建 commit、创建 PR、配置 Webhook |
| `user:email` | 获取用户邮箱用于 commit 提交                                   |
| `read:user`  | 获取用户基本信息                                               |

**注意**: `repo` 权限范围较广，包括读写所有公开和私有仓库，这是 GitHub OAuth App 的限制，无法进行细粒度控制。

**替代方案**: GitHub App 提供更细粒度权限，但实现复杂度较高，MVP 阶段优先选择 OAuth App 快速验证产品。

### 1.1 GitHub OAuth 登录流程详细实现

#### 1.1.1 流程概述

GitHub OAuth 2.0 认证采用 Authorization Code Flow，整体流程如下：

```
用户 → 前端 → 后端 → GitHub OAuth Server → GitHub API
  │       │       │           │               │
  │  点击登录  │       │           │               │
  │───────>│       │           │               │
  │       │  重定向到GitHub     │               │
  │       │───────>│           │               │
  │       │       │  构造授权URL│               │
  │       │       │───────────>│               │
  │       │       │           │  用户授权页面  │
  │<──────────────────────────│               │
  │       │       │           │               │
  │  用户授权  │       │           │               │
  │───────────────────────────>│               │
  │       │       │           │  返回code     │
  │       │       │<───────────│               │
  │       │       │  用code换token             │
  │       │       │───────────────────────────>│
  │       │       │           │               │
  │       │       │  获取用户信息              │
  │       │       │───────────────────────────>│
  │       │       │           │               │
  │  登录成功  │       │           │               │
  │<───────│<───────│           │               │
```

**核心步骤**：

1. **用户发起登录** - 用户点击"Login with GitHub"按钮
2. **重定向授权** - 系统构造授权 URL 并重定向用户到 GitHub 授权页面
3. **用户授权** - 用户在 GitHub 页面确认授权应用访问其账户
4. **回调处理** - GitHub 重定向回应用回调 URL，携带授权码 (code)
5. **令牌交换** - 后端使用授权码换取访问令牌 (access_token)
6. **获取用户信息** - 使用访问令牌调用 GitHub API 获取用户信息
7. **创建会话** - 系统创建或更新用户记录，建立登录会话

#### 1.1.2 前置条件

**GitHub 开发者账号配置**：

1. **注册 OAuth App**

   - 访问 GitHub Settings → Developer settings → OAuth Apps → New OAuth App
   - 填写应用信息：
     - Application name: `GitHub Global`
     - Homepage URL: `https://github-global.example.com` (生产环境)
     - Authorization callback URL: `https://github-global.example.com/api/auth/callback`
   - 获取 `Client ID` 和生成 `Client Secret`
2. **环境变量配置**

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=https://github-global.example.com/api/auth/callback
SESSION_SECRET=your_session_secret_min_32_chars
```

3. **OAuth App 权限配置**

| 配置项            | 值                                              | 说明            |
| ----------------- | ----------------------------------------------- | --------------- |
| Authorization URL | `https://github.com/login/oauth/authorize`    | 用户授权页面    |
| Token URL         | `https://github.com/login/oauth/access_token` | 令牌交换端点    |
| API Base URL      | `https://api.github.com`                      | GitHub REST API |
| Scopes            | `repo,user:email,read:user`                   | 请求的权限范围  |

#### 1.1.3 详细步骤实现

**Step 1: 用户发起登录请求**

触发机制：

- 用户访问首页，点击 "Login with GitHub" 按钮
- 前端发送请求到 `/api/auth/github` 端点

**Step 2: 构造授权 URL 并重定向**

授权 URL 构造规则：

```
https://github.com/login/oauth/authorize?
  client_id={GITHUB_CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  scope=repo+user:email+read:user&
  state={RANDOM_STATE}&
  allow_signup=true
```

参数说明：

| 参数             | 必填 | 说明                          |
| ---------------- | ---- | ----------------------------- |
| `client_id`    | 是   | OAuth App 的 Client ID        |
| `redirect_uri` | 是   | 授权回调 URL，需与注册时一致  |
| `scope`        | 是   | 请求的权限范围，空格分隔      |
| `state`        | 是   | CSRF 防护随机字符串，需验证   |
| `allow_signup` | 否   | 是否允许未注册用户注册 GitHub |

**Step 3: 用户授权**

用户在 GitHub 授权页面看到：

- 应用名称：GitHub Global
- 请求的权限范围
- 授权/拒绝按钮

用户可选择：

- **Authorize**: 授权应用访问，GitHub 重定向回 callback URL
- **Cancel**: 拒绝授权，GitHub 重定向回 callback URL 并附带 `error` 参数

**Step 4: 回调 URL 处理**

回调 URL 格式：

```
{REDIRECT_URI}?code={AUTHORIZATION_CODE}&state={STATE}
```

处理逻辑：

1. 验证 `state` 参数与 session 中存储的 state 是否一致
2. 使用 `code` 向 GitHub 请求 access_token
3. 存储加密后的 access_token

**Step 5: 获取访问令牌**

令牌交换请求：

```http
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "{GITHUB_CLIENT_ID}",
  "client_secret": "{GITHUB_CLIENT_SECRET}",
  "code": "{AUTHORIZATION_CODE}",
  "redirect_uri": "{REDIRECT_URI}"
}
```

响应示例：

```json
{
  "access_token": "gho_16C7e42F292c6912E7710c838347Ae178B4a",
  "token_type": "bearer",
  "scope": "repo,user:email,read:user"
}
```

**Step 6: 获取用户信息**

调用 GitHub API：

```http
GET https://api.github.com/user
Authorization: Bearer {ACCESS_TOKEN}
Accept: application/vnd.github.v3+json
```

响应示例：

```json
{
  "id": 12345678,
  "login": "username",
  "name": "User Name",
  "email": "user@example.com",
  "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
  "html_url": "https://github.com/username"
}
```

获取用户邮箱（如果主邮箱未公开）：

```http
GET https://api.github.com/user/emails
Authorization: Bearer {ACCESS_TOKEN}
```

**Step 7: 用户身份关联**

处理逻辑：

1. 根据 `github_id` 查询现有用户
2. 如果存在：更新用户信息和 token
3. 如果不存在：创建新用户记录
4. 创建登录会话

#### 1.1.4 安全考量

**CSRF 防护**：

```typescript
interface OAuthState {
  random: string;
  timestamp: number;
  returnUrl?: string;
}

function generateState(): string {
  const state: OAuthState = {
    random: crypto.randomBytes(32).toString('hex'),
    timestamp: Date.now(),
  };
  return base64url.encode(JSON.stringify(state));
}

function validateState(receivedState: string, sessionState: string): boolean {
  const MAX_STATE_AGE = 10 * 60 * 1000;
  const parsed = JSON.parse(base64url.decode(receivedState));
  const session = JSON.parse(base64url.decode(sessionState));
  
  return (
    parsed.random === session.random &&
    Date.now() - parsed.timestamp < MAX_STATE_AGE
  );
}
```

**令牌安全存储**：

```typescript
import { encrypt, decrypt } from '@/lib/crypto';

async function storeUserToken(userId: number, token: string): Promise<void> {
  const encryptedToken = await encrypt(token, process.env.ENCRYPTION_KEY);
  await db.users.update({
    where: { id: userId },
    data: { github_token: encryptedToken },
  });
}

async function getUserToken(userId: number): Promise<string> {
  const user = await db.users.findUnique({ where: { id: userId } });
  return decrypt(user.github_token, process.env.ENCRYPTION_KEY);
}
```

**令牌过期处理**：

GitHub OAuth Token 默认不过期，但用户可随时撤销。处理策略：

1. API 调用返回 401 时，清除本地 session
2. 提示用户重新授权
3. 记录日志用于审计

**权限范围控制**：

```typescript
const REQUIRED_SCOPES = ['repo', 'user:email', 'read:user'];

function validateScopes(grantedScopes: string[]): boolean {
  const scopes = grantedScopes.join(',').split(',');
  return REQUIRED_SCOPES.every(scope => scopes.includes(scope));
}
```

**Session 安全**：

```typescript
const sessionConfig = {
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60,
  },
  secret: process.env.SESSION_SECRET,
};
```

#### 1.1.5 错误处理

**错误类型定义**：

| 错误码                    | 场景             | 处理方式                         |
| ------------------------- | ---------------- | -------------------------------- |
| `access_denied`         | 用户拒绝授权     | 重定向到登录页，显示提示信息     |
| `redirect_uri_mismatch` | 回调地址不匹配   | 记录错误日志，提示管理员检查配置 |
| `invalid_code`          | 授权码无效或过期 | 提示用户重新登录                 |
| `bad_verification_code` | 授权码格式错误   | 记录日志，提示用户重试           |
| `rate_limit_exceeded`   | API 请求频率超限 | 等待后重试，提示用户稍后再试     |

**错误处理流程**：

```typescript
interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

async function handleCallback(code: string, state: string): Promise<AuthResult> {
  try {
    if (!validateState(state, getSessionState())) {
      throw new OAuthError('invalid_state', 'State validation failed');
    }

    const tokenResponse = await exchangeCodeForToken(code);
    if (tokenResponse.error) {
      throw new OAuthError(
        tokenResponse.error,
        tokenResponse.error_description
      );
    }

    const userInfo = await fetchUserInfo(tokenResponse.access_token);
    const user = await upsertUser(userInfo, tokenResponse.access_token);
  
    return { success: true, user };
  } catch (error) {
    if (error instanceof OAuthError) {
      logger.warn('OAuth error', { error: error.error, description: error.message });
      return { success: false, error: error.error };
    }
    throw error;
  }
}
```

**用户提示机制**：

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: '您取消了授权，请重新登录以使用完整功能。',
  invalid_state: '登录会话已过期，请重新登录。',
  rate_limit_exceeded: '系统繁忙，请稍后再试。',
  default: '登录过程中出现错误，请重试。',
};

function getErrorMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default;
}
```

#### 1.1.6 时序图

```
┌────────┐          ┌────────┐          ┌────────┐          ┌──────────┐          ┌──────────┐
│  User  │          │ Browser│          │ Backend│          │  GitHub  │          │GitHub API│
└───┬────┘          └───┬────┘          └───┬────┘          │   OAuth  │          └────┬─────┘
    │                   │                   │               │  Server  │               │
    │  Click Login      │                   │               └────┬─────┘               │
    │──────────────────>│                   │                    │                     │
    │                   │  GET /api/auth    │                    │                     │
    │                   │  /github          │                    │                     │
    │                   │──────────────────>│                    │                     │
    │                   │                   │  Generate State    │                     │
    │                   │                   │  Store in Session  │                     │
    │                   │                   │                    │                     │
    │                   │  302 Redirect     │                    │                     │
    │                   │  to GitHub        │                    │                     │
    │                   │<──────────────────│                    │                     │
    │                   │                   │                    │                     │
    │                   │  GET /authorize?  │                    │                     │
    │                   │  client_id&scope  │                    │                     │
    │                   │  &state&redirect  │                    │                     │
    │                   │───────────────────────────────────────>│                     │
    │                   │                   │                    │                     │
    │                   │                   │     Login Page     │                     │
    │<──────────────────────────────────────────────────────────│                     │
    │                   │                   │                    │                     │
    │  Authorize App    │                   │                    │                     │
    │───────────────────────────────────────────────────────────>│                     │
    │                   │                   │                    │                     │
    │                   │  302 Redirect     │                    │                     │
    │                   │  /callback?code&  │                    │                     │
    │                   │  state            │                    │                     │
    │                   │<──────────────────────────────────────│                     │
    │                   │                   │                    │                     │
    │                   │  GET /callback    │                    │                     │
    │                   │  ?code&state      │                    │                     │
    │                   │──────────────────>│                    │                     │
    │                   │                   │                    │                     │
    │                   │                   │  Validate State    │                     │
    │                   │                   │                    │                     │
    │                   │                   │  POST /access_token│                     │
    │                   │                   │  code&client_id    │                     │
    │                   │                   │  &client_secret    │                     │
    │                   │                   │───────────────────>│                     │
    │                   │                   │                    │                     │
    │                   │                   │  access_token      │                     │
    │                   │                   │<───────────────────│                     │
    │                   │                   │                    │                     │
    │                   │                   │  GET /user         │                     │
    │                   │                   │  Authorization:    │                     │
    │                   │                   │  Bearer token      │                     │
    │                   │                   │────────────────────────────────────────>│
    │                   │                   │                    │                     │
    │                   │                   │  User Info         │                     │
    │                   │                   │<────────────────────────────────────────│
    │                   │                   │                    │                     │
    │                   │                   │  Create/Update User│                     │
    │                   │                   │  Store Token       │                     │
    │                   │                   │  Create Session    │                     │
    │                   │                   │                    │                     │
    │                   │  302 Redirect     │                    │                     │
    │                   │  to Dashboard     │                    │                     │
    │                   │<──────────────────│                    │                     │
    │                   │                   │                    │                     │
    │  Dashboard Page   │                   │                    │                     │
    │<──────────────────│                   │                    │                     │
    │                   │                   │                    │                     │
```

#### 1.1.7 关键代码示例

**授权 URL 生成**：

```typescript
import { nanoid } from 'nanoid';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';

interface AuthParams {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  allow_signup?: boolean;
}

export function buildAuthorizationUrl(returnUrl?: string): string {
  const state = nanoid(32);
  
  const params: AuthParams = {
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_REDIRECT_URI!,
    scope: 'repo user:email read:user',
    state: state,
    allow_signup: true,
  };

  const queryString = new URLSearchParams(
    params as Record<string, string>
  ).toString();

  return `${GITHUB_AUTH_URL}?${queryString}`;
}
```

**令牌交换**：

```typescript
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}
```

**用户信息获取**：

```typescript
const GITHUB_API_URL = 'https://api.github.com';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export async function fetchUserInfo(accessToken: string): Promise<{
  user: GitHubUser;
  primaryEmail: string;
}> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json',
  };

  const [userResponse, emailsResponse] = await Promise.all([
    fetch(`${GITHUB_API_URL}/user`, { headers }),
    fetch(`${GITHUB_API_URL}/user/emails`, { headers }),
  ]);

  const user: GitHubUser = await userResponse.json();
  const emails: GitHubEmail[] = await emailsResponse.json();

  const primaryEmail = emails.find(e => e.primary)?.email || user.email;

  if (!primaryEmail) {
    throw new Error('Unable to get user email');
  }

  return { user, primaryEmail };
}
```

**用户创建/更新**：

```typescript
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

export async function upsertUser(
  githubUser: GitHubUser,
  email: string,
  accessToken: string
): Promise<User> {
  const encryptedToken = await encrypt(accessToken);

  return db.users.upsert({
    where: { github_id: githubUser.id },
    update: {
      github_login: githubUser.login,
      github_token: encryptedToken,
      updated_at: new Date(),
    },
    create: {
      github_id: githubUser.id,
      github_login: githubUser.login,
      github_token: encryptedToken,
    },
  });
}
```

**Next.js API Route 实现**：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizationUrl } from '@/lib/oauth';

export async function GET(request: NextRequest) {
  const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/';
  
  const authUrl = buildAuthorizationUrl(returnUrl);
  
  return NextResponse.redirect(authUrl);
}
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, fetchUserInfo, upsertUser } from '@/lib/oauth';
import { createSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', error);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=invalid_request', request.url));
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code);
  
    if (tokenResponse.error) {
      throw new Error(tokenResponse.error);
    }

    const { user, primaryEmail } = await fetchUserInfo(tokenResponse.access_token);
    const dbUser = await upsertUser(user, primaryEmail, tokenResponse.access_token);
  
    await createSession(dbUser.id);

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
```

#### 1.1.8 测试验证

**功能测试要点**：

| 测试场景       | 验证内容           | 预期结果                       |
| -------------- | ------------------ | ------------------------------ |
| 正常登录流程   | 完整授权流程       | 用户成功登录，session 创建     |
| 用户拒绝授权   | 点击 Cancel 按钮   | 重定向到登录页，显示错误提示   |
| 重复登录       | 已登录用户再次登录 | 更新 token，保持或刷新 session |
| 新用户注册     | 首次授权的用户     | 创建新用户记录                 |
| 现有用户登录   | 已注册用户登录     | 更新用户信息和 token           |
| State 验证失败 | 篡改 state 参数    | 拒绝请求，返回错误             |
| Code 过期      | 使用过期授权码     | 提示重新登录                   |
| Token 撤销     | 用户撤销应用授权   | API 调用失败，提示重新授权     |

**安全测试要点**：

| 测试场景     | 验证内容          | 预期结果                   |
| ------------ | ----------------- | -------------------------- |
| CSRF 攻击    | 伪造 state 参数   | 请求被拒绝                 |
| 重定向劫持   | 篡改 redirect_uri | GitHub 拒绝请求            |
| Token 泄露   | 数据库 token 字段 | 已加密存储                 |
| Session 劫持 | Cookie 安全属性   | HttpOnly, Secure, SameSite |
| 权限提升     | 请求未授权 scope  | 仅授予请求的 scope         |
| 重放攻击     | 重复使用授权码    | GitHub 拒绝请求            |

**测试用例示例**：

```typescript
describe('GitHub OAuth Flow', () => {
  it('should complete successful login', async () => {
    const response = await fetch('/api/auth/github');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('github.com/login/oauth/authorize');
  });

  it('should handle user denial', async () => {
    const response = await fetch('/api/auth/callback?error=access_denied');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/login?error=access_denied');
  });

  it('should validate state parameter', async () => {
    const response = await fetch('/api/auth/callback?code=valid&state=invalid');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('error=invalid_state');
  });

  it('should store encrypted token', async () => {
    const user = await db.users.findByGithubId(12345678);
    expect(user.github_token).not.toContain('gho_');
    expect(user.github_token).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
```

### 2. 技术栈选择

**决策**:

- **框架**: Next.js (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **数据库**: MySQL 8.0+
- **缓存**: Redis (翻译任务队列、GitHub API 缓存、限流计数)
- **部署**: Docker 容器化

**理由**:

- Next.js 提供全栈能力，API Routes 可处理后端逻辑，无需单独后端服务
- shadcn/ui 基于 Radix UI，提供高质量可定制组件，与 Tailwind CSS 完美集成
- MySQL 成熟稳定，团队熟悉度高，适合关系型数据存储
- Docker 容器化确保开发、测试、生产环境一致性

**替代方案**: PostgreSQL 功能更丰富，但 MySQL 在简单场景下性能足够且运维成本更低。

### 2.1 OpenRouter 集成方案详细设计

#### 2.1.1 概述

OpenRouter 作为统一的 AI 模型接入层，提供兼容 OpenAI SDK 的标准化接口，支持 200+ 主流大语言模型。本节详细阐述 OpenRouter 集成的技术实现方案。

**核心优势**：

- **统一接口**: 兼容 OpenAI Chat Completions API，迁移成本极低
- **多模型支持**: GPT-4、Claude、Gemini、Llama、Mistral 等主流模型
- **灵活计费**: 按实际使用量计费，支持预付费和后付费
- **高可用性**: 自动路由到可用的模型提供商

#### 2.1.2 API 配置参数说明

**基础配置**：

| 配置项          | 值                               | 说明             |
| --------------- | -------------------------------- | ---------------- |
| Base URL        | `https://openrouter.ai/api/v1` | API 基础路径     |
| Chat Endpoint   | `/chat/completions`            | 对话补全端点     |
| Models Endpoint | `/models`                      | 获取可用模型列表 |
| Auth Method     | Bearer Token                     | 认证方式         |
| Content-Type    | `application/json`             | 请求体格式       |

**环境变量配置**：

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://github-global.example.com
OPENROUTER_SITE_NAME=GitHub Global
```

**请求头配置**：

```typescript
interface OpenRouterHeaders {
  'Authorization': `Bearer ${string}`;
  'Content-Type': 'application/json';
  'HTTP-Referer'?: string;
  'X-Title'?: string;
}
```

| Header            | 必填 | 说明                                              |
| ----------------- | ---- | ------------------------------------------------- |
| `Authorization` | 是   | Bearer Token 认证，格式为 `Bearer sk-or-v1-xxx` |
| `Content-Type`  | 是   | 固定为 `application/json`                       |
| `HTTP-Referer`  | 否   | 应用站点 URL，用于 OpenRouter 统计和排名          |
| `X-Title`       | 否   | 应用名称，用于 OpenRouter 仪表板显示              |

**模型标识符格式**：

```
{provider}/{model-name}[:{variant}]
```

示例：

- `openai/gpt-4-turbo` - OpenAI GPT-4 Turbo
- `anthropic/claude-3-opus` - Anthropic Claude 3 Opus
- `google/gemini-pro` - Google Gemini Pro
- `meta-llama/llama-3-70b-instruct` - Meta Llama 3 70B

#### 2.1.3 Chat Completion API 调用实现

**请求体结构**：

```typescript
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  user?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}
```

**核心参数说明**：

| 参数                  | 类型    | 默认值   | 说明                                  |
| --------------------- | ------- | -------- | ------------------------------------- |
| `model`             | string  | 必填     | 模型标识符，如 `openai/gpt-4-turbo` |
| `messages`          | array   | 必填     | 对话消息数组，按顺序排列              |
| `temperature`       | number  | 1.0      | 随机性控制，0-2，翻译场景建议 0.3     |
| `top_p`             | number  | 1.0      | 核采样，0-1，与 temperature 二选一    |
| `max_tokens`        | number  | 模型默认 | 最大生成 token 数                     |
| `stream`            | boolean | false    | 是否启用流式响应                      |
| `stop`              | array   | -        | 停止生成的序列                        |
| `frequency_penalty` | number  | 0        | 频率惩罚，-2.0 到 2.0                 |
| `presence_penalty`  | number  | 0        | 存在惩罚，-2.0 到 2.0                 |
| `user`              | string  | -        | 终端用户标识，用于滥用监控            |

**TypeScript 实现示例**：

```typescript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
    'X-Title': process.env.OPENROUTER_SITE_NAME,
  },
});

async function translateMarkdown(
  content: string,
  targetLang: string,
  sourceLang: string = 'en'
): Promise<string> {
  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4-turbo',
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: buildTranslationPrompt(content, targetLang, sourceLang) },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  return response.choices[0].message.content || '';
}
```

**响应体结构**：

```typescript
interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: TokenUsage;
}

interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
```

#### 2.1.4 翻译场景 Prompt 设计规范

**System Prompt 设计**：

```typescript
const TRANSLATION_SYSTEM_PROMPT = `You are a professional technical documentation translator specializing in software development and open-source projects. Your translations must:

1. **Accuracy**: Preserve the exact meaning of the original text without adding, removing, or altering information.
2. **Technical Terms**: Keep technical terms, API names, function names, and code snippets unchanged. Do not translate:
   - Programming language keywords
   - Library/framework names (React, Vue, Docker, etc.)
   - API endpoints and URLs
   - Code blocks and inline code
   - Command-line instructions
   - File paths and environment variables

3. **Markdown Structure**: Maintain all Markdown formatting exactly:
   - Headers (#, ##, ###)
   - Lists (-, *, 1.)
   - Code blocks (\`\`\`language)
   - Links [text](url)
   - Images ![alt](url)
   - Tables
   - Blockquotes (>)

4. **Natural Flow**: Translate into natural, fluent target language that native speakers would write, not literal word-for-word translations.

5. **Consistency**: Use consistent terminology throughout the document. Create a mental glossary for recurring terms.

6. **Links Handling**: 
   - Keep URLs unchanged
   - Translate link text unless it's a technical term
   - Preserve relative links structure

7. **Code Comments**: Translate code comments if they are in natural language, but keep code syntax unchanged.

Output only the translated content without any explanations or meta-commentary.`;
```

**User Prompt 模板**：

```typescript
function buildTranslationPrompt(
  content: string,
  targetLang: string,
  sourceLang: string
): string {
  const langNames: Record<string, string> = {
    'en': 'English',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ru': 'Russian',
    'pt': 'Portuguese',
    'it': 'Italian',
    'ar': 'Arabic',
  };

  return `Translate the following Markdown document from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}.

Source content:
---
${content}
---

Translated content:`;
}
```

**Prompt 优化策略**：

| 场景       | 优化方法                       |
| ---------- | ------------------------------ |
| 长文档     | 分段翻译，每段添加上下文摘要   |
| 代码密集   | 明确标注代码块边界，防止误译   |
| 专业术语   | 提供术语表 (Few-shot examples) |
| 多语言链接 | 指导保留原始链接结构           |
| 格式复杂   | 添加格式保留示例               |

**Few-shot 示例增强**：

```typescript
const FEW_SHOT_EXAMPLES = `
Example translation (English to Chinese):

Source:
## Getting Started

Install the package using npm:
\`\`\`bash
npm install my-package
\`\`\`

Target:
## 快速开始

使用 npm 安装包：
\`\`\`bash
npm install my-package
\`\`\`

Note: "Getting Started" is translated, but "npm install my-package" command is preserved.
`;
```

#### 2.1.5 Streaming 响应处理机制

**流式响应优势**：

- 降低首字节响应时间 (TTFB)
- 提升用户体验，实时显示翻译进度
- 支持大文档翻译时的进度反馈
- 便于实现超时控制和取消操作

**流式请求实现**：

```typescript
async function* translateMarkdownStream(
  content: string,
  targetLang: string,
  sourceLang: string = 'en',
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const stream = await openrouter.chat.completions.create(
    {
      model: 'openai/gpt-4-turbo',
      messages: [
        { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
        { role: 'user', content: buildTranslationPrompt(content, targetLang, sourceLang) },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      stream: true,
    },
    {
      signal,
    }
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}
```

**流式响应数据格式**：

```
data: {"id":"gen-xxx","object":"chat.completion.chunk","created":1234567890,"model":"openai/gpt-4-turbo","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"gen-xxx","object":"chat.completion.chunk","created":1234567890,"model":"openai/gpt-4-turbo","choices":[{"index":0,"delta":{"content":"##"},"finish_reason":null}]}

data: {"id":"gen-xxx","object":"chat.completion.chunk","created":1234567890,"model":"openai/gpt-4-turbo","choices":[{"index":0,"delta":{"content":" 快"},"finish_reason":null}]}

data: [DONE]
```

**SSE (Server-Sent Events) 处理**：

```typescript
interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamChoice[];
}

interface StreamChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

function parseSSELine(line: string): StreamChunk | null {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    if (data === '[DONE]') {
      return null;
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}
```

**前端流式消费示例**：

```typescript
async function consumeTranslationStream(
  content: string,
  targetLang: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  let fullText = '';
  
  try {
    for await (const chunk of translateMarkdownStream(content, targetLang)) {
      fullText += chunk;
      onChunk(chunk);
    }
    onComplete(fullText);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Translation cancelled by user');
    } else {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
```

**流式超时控制**：

```typescript
const STREAM_TIMEOUT_MS = 120000;

async function translateWithTimeout(
  content: string,
  targetLang: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    let result = '';
    for await (const chunk of translateMarkdownStream(
      content,
      targetLang,
      'en',
      controller.signal
    )) {
      result += chunk;
    }
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### 2.1.6 错误处理与重试策略

**错误分类与处理**：

| 错误类型   | HTTP 状态码          | 处理策略                                |
| ---------- | -------------------- | --------------------------------------- |
| 认证失败   | 401                  | 检查 API Key 配置，记录日志，通知管理员 |
| 权限不足   | 403                  | 检查账户余额，提示用户充值或使用 BYOK   |
| 资源不存在 | 404                  | 检查模型标识符，尝试 fallback 模型      |
| 请求超限   | 429                  | 读取 `Retry-After` 头，指数退避重试   |
| 模型过载   | 529                  | 切换到备用模型，记录告警                |
| 内容过滤   | 400 (content_filter) | 记录日志，提示用户检查内容              |
| 服务错误   | 500/502/503          | 指数退避重试，超过阈值则告警            |

**错误响应结构**：

```typescript
interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code: string;
    metadata?: {
      reason?: string;
      provider_name?: string;
      model_id?: string;
    };
  };
}
```

**指数退避重试实现**：

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 529],
};

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    
      const statusCode = extractStatusCode(error);
      if (!config.retryableStatusCodes.includes(statusCode)) {
        throw error;
      }

      if (attempt === config.maxRetries) {
        break;
      }

      const retryAfter = extractRetryAfter(error);
      const waitTime = retryAfter || Math.min(delay, config.maxDelayMs);
    
      console.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${waitTime}ms`);
      await sleep(waitTime);
    
      delay *= config.backoffMultiplier;
    }
  }

  throw lastError;
}

function extractRetryAfter(error: unknown): number | null {
  if (error instanceof OpenAI.APIError && error.headers) {
    const retryAfter = error.headers['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter, 10) * 1000;
    }
  }
  return null;
}
```

**断路器模式**：

```typescript
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    status: 'closed',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0,
  };

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeoutMs: number = 60000,
    private halfOpenSuccessThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.status === 'open') {
      if (Date.now() - this.state.lastFailureTime > this.recoveryTimeoutMs) {
        this.state.status = 'half-open';
        this.state.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state.status === 'half-open') {
      this.state.successCount++;
      if (this.state.successCount >= this.halfOpenSuccessThreshold) {
        this.state.status = 'closed';
        this.state.failureCount = 0;
      }
    } else {
      this.state.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
  
    if (this.state.failureCount >= this.failureThreshold) {
      this.state.status = 'open';
    }
  }
}
```

**错误日志与监控**：

```typescript
interface TranslationErrorLog {
  timestamp: Date;
  userId: string;
  repositoryId: string;
  model: string;
  errorType: string;
  errorMessage: string;
  statusCode?: number;
  retryCount: number;
  duration: number;
  inputTokens?: number;
}

function logTranslationError(log: TranslationErrorLog): void {
  console.error(JSON.stringify({
    level: 'ERROR',
    ...log,
    timestamp: log.timestamp.toISOString(),
  }));
  
  if (process.env.NODE_ENV === 'production') {
    sendToMonitoringService(log);
  }
}
```

#### 2.1.7 多模型 Fallback 机制设计

**Fallback 策略概述**：

```
Primary Model → Secondary Model → Tertiary Model → Failure
     ↓               ↓                 ↓
   GPT-4-Turbo    Claude-3-Sonnet   Gemini-Pro
     ↓               ↓                 ↓
   (失败)          (失败)            (失败)
     ↓               ↓                 ↓
   重试 3 次       重试 2 次         重试 1 次
```

**模型优先级配置**：

```typescript
interface ModelConfig {
  id: string;
  priority: number;
  maxRetries: number;
  timeout: number;
  costPerToken: number;
  qualityScore: number;
  languages: string[];
}

const MODEL_PRIORITY: ModelConfig[] = [
  {
    id: 'openai/gpt-4-turbo',
    priority: 1,
    maxRetries: 3,
    timeout: 60000,
    costPerToken: 0.00001,
    qualityScore: 95,
    languages: ['*'],
  },
  {
    id: 'anthropic/claude-3-sonnet',
    priority: 2,
    maxRetries: 2,
    timeout: 60000,
    costPerToken: 0.000003,
    qualityScore: 90,
    languages: ['*'],
  },
  {
    id: 'google/gemini-pro',
    priority: 3,
    maxRetries: 2,
    timeout: 45000,
    costPerToken: 0.0000005,
    qualityScore: 85,
    languages: ['*'],
  },
  {
    id: 'meta-llama/llama-3-70b-instruct',
    priority: 4,
    maxRetries: 1,
    timeout: 30000,
    costPerToken: 0.0000007,
    qualityScore: 80,
    languages: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'],
  },
];
```

**Fallback 执行器实现**：

```typescript
class TranslationFallbackExecutor {
  private models: ModelConfig[];
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor(models: ModelConfig[] = MODEL_PRIORITY) {
    this.models = models.sort((a, b) => a.priority - b.priority);
    this.circuitBreakers = new Map(
      models.map(m => [m.id, new CircuitBreaker()])
    );
  }

  async translate(
    content: string,
    targetLang: string,
    sourceLang: string = 'en'
  ): Promise<TranslationResult> {
    const errors: Error[] = [];

    for (const model of this.models) {
      if (!this.supportsLanguage(model, targetLang)) {
        continue;
      }

      const circuitBreaker = this.circuitBreakers.get(model.id)!;
    
      try {
        const result = await circuitBreaker.execute(async () => {
          return await withRetry(
            () => this.callModel(model, content, targetLang, sourceLang),
            {
              ...DEFAULT_RETRY_CONFIG,
              maxRetries: model.maxRetries,
            }
          );
        });

        return {
          success: true,
          content: result,
          model: model.id,
          fallbackUsed: model.priority > 1,
        };
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        console.warn(`Model ${model.id} failed, trying next model`);
      }
    }

    return {
      success: false,
      error: 'All models failed',
      errors: errors.map(e => e.message),
    };
  }

  private supportsLanguage(model: ModelConfig, lang: string): boolean {
    return model.languages.includes('*') || model.languages.includes(lang);
  }

  private async callModel(
    model: ModelConfig,
    content: string,
    targetLang: string,
    sourceLang: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), model.timeout);

    try {
      const response = await openrouter.chat.completions.create(
        {
          model: model.id,
          messages: [
            { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
            { role: 'user', content: buildTranslationPrompt(content, targetLang, sourceLang) },
          ],
          temperature: 0.3,
        },
        { signal: controller.signal }
      );

      return response.choices[0].message.content || '';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

interface TranslationResult {
  success: boolean;
  content?: string;
  model?: string;
  fallbackUsed?: boolean;
  error?: string;
  errors?: string[];
}
```

**模型健康检查**：

```typescript
interface ModelHealthStatus {
  modelId: string;
  isHealthy: boolean;
  lastCheckTime: Date;
  latency: number;
  errorRate: number;
}

async function checkModelHealth(modelId: string): Promise<ModelHealthStatus> {
  const startTime = Date.now();
  
  try {
    await openrouter.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    });

    return {
      modelId,
      isHealthy: true,
      lastCheckTime: new Date(),
      latency: Date.now() - startTime,
      errorRate: 0,
    };
  } catch (error) {
    return {
      modelId,
      isHealthy: false,
      lastCheckTime: new Date(),
      latency: Date.now() - startTime,
      errorRate: 1,
    };
  }
}
```

**动态模型选择**：

```typescript
class DynamicModelSelector {
  private healthCache: Map<string, ModelHealthStatus> = new Map();
  private lastRefreshTime: number = 0;
  private refreshIntervalMs: number = 300000;

  async selectBestModel(
    targetLang: string,
    preferences: { preferSpeed?: boolean; preferQuality?: boolean }
  ): Promise<ModelConfig> {
    await this.refreshHealthIfNeeded();

    const availableModels = MODEL_PRIORITY.filter(m =>
      this.supportsLanguage(m, targetLang) && this.isModelHealthy(m.id)
    );

    if (availableModels.length === 0) {
      return MODEL_PRIORITY[0];
    }

    if (preferences.preferSpeed) {
      return availableModels.reduce((fastest, current) =>
        this.getLatency(current.id) < this.getLatency(fastest.id) ? current : fastest
      );
    }

    if (preferences.preferQuality) {
      return availableModels.reduce((best, current) =>
        current.qualityScore > best.qualityScore ? current : best
      );
    }

    return availableModels[0];
  }

  private async refreshHealthIfNeeded(): Promise<void> {
    if (Date.now() - this.lastRefreshTime > this.refreshIntervalMs) {
      await Promise.all(
        MODEL_PRIORITY.map(m => checkModelHealth(m.id).then(status => {
          this.healthCache.set(m.id, status);
        }))
      );
      this.lastRefreshTime = Date.now();
    }
  }

  private isModelHealthy(modelId: string): boolean {
    return this.healthCache.get(modelId)?.isHealthy ?? true;
  }

  private getLatency(modelId: string): number {
    return this.healthCache.get(modelId)?.latency ?? Infinity;
  }

  private supportsLanguage(model: ModelConfig, lang: string): boolean {
    return model.languages.includes('*') || model.languages.includes(lang);
  }
}
```

#### 2.1.8 平台托管环境下的限流控制方案

**多层级限流架构**：

```
┌─────────────────────────────────────────────────────────────┐
│                      限流控制层级                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 全局限流 (Global Rate Limit)                       │
│  ├── 平台总 API 调用配额                                      │
│  └── 保护平台整体资源                                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 用户限流 (User Rate Limit)                         │
│  ├── 免费用户: 100 次/天                                      │
│  ├── 付费用户: 1000 次/天                                     │
│  └── 白名单用户: 无限制                                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 仓库限流 (Repository Rate Limit)                   │
│  ├── 单仓库翻译频率限制                                       │
│  └── 防止单仓库过度消耗资源                                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 模型限流 (Model Rate Limit)                        │
│  ├── 高成本模型调用限制                                       │
│  └── 引导用户使用性价比模型                                   │
└─────────────────────────────────────────────────────────────┘
```

**限流配置表**：

| 限流层级    | 维度         | 限制值     | 时间窗口 | 实现方式         |
| ----------- | ------------ | ---------- | -------- | ---------------- |
| 全局        | 平台总调用量 | 100,000 次 | 1 小时   | Redis + Lua 脚本 |
| 用户-免费   | 用户 ID      | 100 次     | 1 天     | Redis + 滑动窗口 |
| 用户-付费   | 用户 ID      | 1,000 次   | 1 天     | Redis + 滑动窗口 |
| 用户-白名单 | 用户 ID      | 无限制     | -        | 配置白名单       |
| 仓库        | 仓库 ID      | 10 次      | 1 小时   | Redis + 滑动窗口 |
| 模型-GPT4   | 模型 ID      | 10,000 次  | 1 天     | Redis + 计数器   |
| IP          | IP 地址      | 60 次      | 1 分钟   | Redis + 滑动窗口 |

**Redis 限流实现**：

```typescript
import { Redis } from 'ioredis';

class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local windowMs = tonumber(ARGV[4])

      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
      local current = redis.call('ZCARD', key)
    
      if current < limit then
        redis.call('ZADD', key, now, now .. '-' .. math.random())
        redis.call('PEXPIRE', key, windowMs)
        return {1, limit - current - 1, limit}
      else
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local resetTime = tonumber(oldest[2]) + windowMs
        return {0, 0, limit, resetTime - now}
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      redisKey,
      now.toString(),
      windowStart.toString(),
      limit.toString(),
      windowMs.toString()
    ) as [number, number, number, number?];

    const [allowed, remaining, total, retryAfter] = result;

    return {
      allowed: allowed === 1,
      remaining,
      limit: total,
      retryAfter: retryAfter || 0,
    };
  }

  async incrementCounter(key: string): Promise<number> {
    return await this.redis.incr(`counter:${key}`);
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number;
}
```

**用户配额管理**：

```typescript
interface UserQuota {
  userId: string;
  tier: 'free' | 'paid' | 'whitelist';
  dailyLimit: number;
  usedToday: number;
  resetTime: Date;
}

class QuotaManager {
  private rateLimiter: RateLimiter;
  private tierLimits: Record<string, number> = {
    free: 100,
    paid: 1000,
    whitelist: Infinity,
  };

  async checkUserQuota(userId: string, tier: string): Promise<QuotaCheckResult> {
    if (tier === 'whitelist') {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    const limit = this.tierLimits[tier] || this.tierLimits.free;
    const result = await this.rateLimiter.checkLimit(
      `user:${userId}`,
      limit,
      86400000
    );

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
      resetTime: new Date(Date.now() + result.retryAfter),
    };
  }

  async consumeQuota(userId: string): Promise<void> {
    await this.rateLimiter.incrementCounter(`user:${userId}:consumed`);
  }
}

interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime?: Date;
}
```

**限流中间件实现**：

```typescript
import { Request, Response, NextFunction } from 'express';

function createRateLimitMiddleware(
  quotaManager: QuotaManager,
  globalLimiter: RateLimiter
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const repositoryId = req.body?.repositoryId;
    const ip = req.ip;

    const checks: Promise<RateLimitResult>[] = [];

    checks.push(
      globalLimiter.checkLimit('global:api', 100000, 3600000)
    );

    if (userId) {
      const userTier = req.user?.tier || 'free';
      checks.push(
        quotaManager.checkUserQuota(userId, userTier) as Promise<RateLimitResult>
      );
    }

    if (repositoryId) {
      checks.push(
        globalLimiter.checkLimit(`repo:${repositoryId}`, 10, 3600000)
      );
    }

    checks.push(
      globalLimiter.checkLimit(`ip:${ip}`, 60, 60000)
    );

    const results = await Promise.all(checks);
    const failedCheck = results.find(r => !r.allowed);

    if (failedCheck) {
      res.setHeader('X-RateLimit-Limit', failedCheck.limit);
      res.setHeader('X-RateLimit-Remaining', failedCheck.remaining);
      res.setHeader('Retry-After', Math.ceil(failedCheck.retryAfter / 1000));

      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: failedCheck.retryAfter,
      });
    }

    res.setHeader('X-RateLimit-Limit', results[0].limit);
    res.setHeader('X-RateLimit-Remaining', results[0].remaining);

    next();
  };
}
```

**配额预警与通知**：

```typescript
interface QuotaAlert {
  type: 'user_exhausted' | 'global_high' | 'model_high';
  userId?: string;
  currentUsage: number;
  threshold: number;
  timestamp: Date;
}

class QuotaMonitor {
  private alertThresholds = {
    userWarning: 0.8,
    globalWarning: 0.7,
    globalCritical: 0.9,
  };

  async checkAndAlert(
    userId: string,
    currentUsage: number,
    limit: number
  ): Promise<void> {
    const usageRatio = currentUsage / limit;

    if (usageRatio >= this.alertThresholds.userWarning) {
      await this.sendUserWarning(userId, usageRatio);
    }

    if (usageRatio >= 1) {
      await this.sendUserExhaustedAlert(userId);
    }
  }

  private async sendUserWarning(userId: string, ratio: number): Promise<void> {
    console.log(`User ${userId} has used ${(ratio * 100).toFixed(0)}% of quota`);
  }

  private async sendUserExhaustedAlert(userId: string): Promise<void> {
    console.warn(`User ${userId} has exhausted their quota`);
  }
}
```

**BYOK (Bring Your Own Key) 模式限流**：

```typescript
class BYOKRateLimiter {
  private userKeys: Map<string, string> = new Map();

  async translateWithUserKey(
    userId: string,
    content: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const userKey = this.userKeys.get(userId);
  
    if (!userKey) {
      throw new Error('User API key not configured');
    }

    const userClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: userKey,
    });

    try {
      const response = await userClient.chat.completions.create({
        model: 'openai/gpt-4-turbo',
        messages: [
          { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: buildTranslationPrompt(content, targetLang) },
        ],
        temperature: 0.3,
      });

      return {
        success: true,
        content: response.choices[0].message.content || '',
        model: 'openai/gpt-4-turbo',
        byok: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        byok: true,
      };
    }
  }

  setUserKey(userId: string, apiKey: string): void {
    this.userKeys.set(userId, apiKey);
  }

  removeUserKey(userId: string): void {
    this.userKeys.delete(userId);
  }
}
```

**限流响应标准格式**：

```typescript
interface RateLimitResponse {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      limit: number;
      remaining: number;
      resetAt: string;
      retryAfter: number;
    };
  };
  links: {
    upgrade?: string;
    documentation?: string;
  };
}

function formatRateLimitResponse(
  limit: number,
  remaining: number,
  retryAfter: number
): RateLimitResponse {
  return {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'You have exceeded the rate limit. Please try again later.',
      details: {
        limit,
        remaining,
        resetAt: new Date(Date.now() + retryAfter).toISOString(),
        retryAfter: Math.ceil(retryAfter / 1000),
      },
    },
    links: {
      upgrade: '/pricing',
      documentation: '/docs/rate-limits',
    },
  };
}
```

### 3. 翻译存储策略

**决策**: 翻译文件存储在用户仓库的 `translations/{lang}/` 目录下，并且翻译通过用户自己 PR 合并

**理由**:

- 与原始文件分离，避免污染主目录
- 符合国际化项目常见组织方式
- 用户拥有完全控制权，可随时删除或修改
- 通过 PR 合并让用户可以审核翻译内容后再发布

**替代方案**: 存储在平台数据库或对象存储中，但这会增加用户依赖，不符合"用户拥有数据"的开源精神。

### 4. AI 模型使用模式

**决策**: 采用 **平台托管优先 + 用户自带 Key 备选** 的双模式

**平台托管模式**:

- 管理员提供 AI 大模型免费使用额度
- 用户无需配置即可使用翻译服务
- 平台统一管理和计费

**用户自带 Key 模式 (BYOK)**:

- 用户可配置自己的 OpenRouter API Key
- 优先级低于平台托管模式（平台额度用尽后可使用）
- 用户自行承担 API 调用费用

**理由**:

- 降低用户使用门槛，提升产品吸引力
- 平台托管模式便于控制成本和质量
- BYOK 模式满足高级用户需求，减少平台成本压力

### 5. 限流机制设计

**决策**: 实现多层限流保护机制

**限流层级**:

| 层级 | 限制规则                 | 实现方式        |
| ---- | ------------------------ | --------------- |
| 全局 | 10000 次/小时 (AI 调用)  | Redis 计数器    |
| 用户 | 100 次/小时 (翻译文件数) | Redis + 用户 ID |
| IP   | 60 次/分钟 (API 请求)    | Redis + IP      |
| 仓库 | 5 次/小时 (翻译任务)     | Redis + 仓库 ID |

**限流策略**:

- 滑动窗口算法，平滑限流
- 返回剩余配额信息，引导用户合理安排
- 超限返回 429 状态码，附带重试时间
- 管理员可配置白名单用户（无限制）

**理由**:

- 防止恶意用户攻击导致资源滥用
- 保护平台 AI 调用额度不被耗尽
- 确保服务公平可用

### 6. AI 翻译接口选择

**决策**: 使用 **OpenRouter API** 作为统一入口

**理由**:

- 支持 200+ 模型，包括 GPT-4、Claude、Gemini 等
- 兼容 OpenAI SDK，迁移成本低
- 支持 BYOK (Bring Your Own Key) 模式，降低平台成本
- 自动 fallback 机制，提高可用性

**替代方案**: 直接对接各 AI 提供商 API，但维护成本高。

### 7. 增量翻译实现

**决策**: 基于 Git commit SHA 对比实现增量检测

**实现方案**:

1. 每次翻译后记录当前 commit SHA
2. 下次翻译时获取该 SHA 与最新 SHA 之间的变更文件
3. 仅翻译发生变更且属于目标语言的 Markdown 文件

**理由**:

- 比基于文件内容哈希更简单可靠
- 利用 Git 原生变更追踪能力
- 自然支持"跳过已翻译文件"的需求

### 8. README 链接插入策略

**决策**: 使用 AI 分析 README 结构确定插入位置

**优先级策略**:

1. 如果已有语言切换区域，更新该区域
2. 如果有目录(TOC)，在目录前插入
3. 如果标题后有介绍段落，在介绍后插入
4. 兜底：在文件开头插入

**理由**:

- 纯规则匹配难以应对各种 README 格式
- AI 能理解文档结构，找到最佳插入点
- 一次分析成本低，效果优于硬编码规则

### 9. 密钥存储方案

**决策**: 使用 AES-256-GCM 加密存储敏感信息

**实现细节**:

- 每个用户独立的加密密钥 (DEK)
- DEK 由主密钥 (KEK) 加密存储
- KEK 存储在环境变量/密钥管理系统中

**理由**:

- 即使数据库泄露，没有 KEK 无法解密
- 符合安全最佳实践
- 支持密钥轮换

## Risks / Trade-offs

| 风险                  | 影响                         | 缓解措施                                         |
| --------------------- | ---------------------------- | ------------------------------------------------ |
| GitHub API Rate Limit | 大量用户同时操作可能触发限制 | 实现请求队列和缓存；向用户展示剩余配额；优雅降级 |
| OpenRouter API 不可用 | 翻译服务中断                 | 实现重试机制；支持用户自带 API Key 绕过平台配额  |
| AI 翻译质量不稳定     | 用户体验差                   | 提供翻译预览功能；支持手动编辑后提交             |
| 大文件翻译超时        | 任务失败                     | 分块翻译；异步处理；设置合理的超时和重试策略     |
| 用户 Token 泄露       | 安全问题                     | 加密存储；最小权限原则；支持用户撤销授权         |

### 技术债务

- **短期**: 为了快速验证产品，初期使用轮询方式检查翻译进度，后续应改为 WebSocket 或 Server-Sent Events
- **中期**: 翻译任务当前使用内存队列，用户量增长后需要迁移到专业的任务队列（如 Bull + Redis）
- **长期**: 考虑引入翻译缓存层，相同内容的重复翻译可直接复用结果

## 数据库 Schema (MVP)

```sql
-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    github_id INT UNIQUE NOT NULL,
    github_login VARCHAR(255) NOT NULL,
    github_token TEXT NOT NULL,
    openrouter_api_key TEXT,
    is_whitelisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_github_id (github_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 仓库表
CREATE TABLE repositories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    github_repo_id INT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    default_branch VARCHAR(255) DEFAULT 'main',
    base_language VARCHAR(10) DEFAULT 'zh-CN',
    target_languages JSON,
    ignore_rules TEXT,
    last_commit_sha VARCHAR(40),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_repo (user_id, github_repo_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 翻译任务表
CREATE TABLE translation_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repository_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    type VARCHAR(50),
    target_languages JSON,
    total_files INT DEFAULT 0,
    processed_files INT DEFAULT 0,
    failed_files INT DEFAULT 0,
    result JSON,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_repository_id (repository_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 限流记录表
CREATE TABLE rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    limit_type ENUM('global', 'user', 'ip', 'repo') NOT NULL,
    request_count INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_identifier_type (identifier, limit_type),
    INDEX idx_window_start (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## API 设计概览

### 核心端点

```
POST   /api/auth/github          - GitHub OAuth 登录回调
GET    /api/user/profile         - 获取用户信息
PUT    /api/user/settings        - 更新用户设置（API Key 等）

GET    /api/repos                - 获取用户仓库列表
POST   /api/repos                - 导入 GitHub 仓库
GET    /api/repos/:id            - 获取仓库详情
GET    /api/repos/:id/files      - 获取仓库文件树
PUT    /api/repos/:id/config     - 更新仓库翻译配置

POST   /api/translate            - 创建翻译任务
GET    /api/translate/:id        - 获取翻译任务状态
GET    /api/translate/:id/preview - 预览翻译结果
POST   /api/translate/:id/commit - 提交翻译到 GitHub
```

## 部署架构 (MVP)

采用 Docker 容器化部署，确保环境一致性：

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Next.js App                         │    │
│  │              (Port 3000)                             │    │
│  │  ┌─────────────┐    ┌──────────────────────────┐   │    │
│  │  │   Frontend  │    │   API Routes (Backend)   │   │    │
│  │  │  (React)    │    │   (Translation Logic)    │   │    │
│  │  └─────────────┘    └──────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│           │                    │                    │        │
│           ▼                    ▼                    ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    MySQL     │    │    Redis     │    │   Context7   │  │
│  │   (Port      │    │   (Port      │    │   (External  │  │
│  │    3306)     │    │    6379)     │    │    API)      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │       External APIs       │
              │  ┌─────────────────────┐  │
              │  │     GitHub API      │  │
              │  └─────────────────────┘  │
              │  ┌─────────────────────┐  │
              │  │   OpenRouter API    │  │
              │  └─────────────────────┘  │
              └───────────────────────────┘
```

**Docker 服务配置**:

| 服务  | 镜像           | 用途           |
| ----- | -------------- | -------------- |
| app   | node:20-alpine | Next.js 应用   |
| mysql | mysql:8.0      | 数据存储       |
| redis | redis:7-alpine | 缓存/队列/限流 |

**部署流程**:

1. 构建 Docker 镜像：`docker build -t github-global .`
2. 启动服务：`docker-compose up -d`
3. 数据库迁移：自动执行或手动运行 migration 脚本
4. 健康检查：`/api/health` 端点监控服务状态

---

*文档版本: v1.1*
*关联文档: [proposal.md](./proposal.md)*
