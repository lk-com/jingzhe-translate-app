# GitHub Global - 实现任务清单

## 设计文档

- 技术设计: [design.md](./design.md)
- API 规范: [openapi.yaml](./api-docs/openapi.yaml) - 基于 OpenAPI 3.0.3 标准

---

# 第一阶段：后端开发

## 1. 项目基础设施

- [X] 1.1 创建 Next.js (App Router) + TypeScript 项目结构
- [X] 1.2 配置环境变量管理（.env 示例文件）
- [X] 1.3 配置 MySQL 8.0 数据库连接和 Prisma ORM
- [X] 1.4 配置 Redis 连接（任务队列、缓存、限流）
- [X] 1.5 配置 Docker 多阶段构建和 Docker Compose

## 2. GitHub OAuth 认证模块

- [X] 2.1 在 GitHub 开发者设置中创建 OAuth App
- [X] 2.2 实现 GitHub OAuth Web Application Flow
- [X] 2.3 实现 OAuth 回调处理和 token 交换
- [X] 2.4 实现 AES-256-GCM 加密工具类
- [X] 2.5 实现用户会话管理
- [X] 2.6 实现 GitHub Token 加密存储
- [X] 2.7 实现用户登出功能
- [X] 2.8 实现 CSRF 防护
- [X] 2.9 实现白名单用户管理

## 3. 用户设置 API

- [X] 3.1 创建用户设置 API 端点
- [X] 3.2 实现 OpenRouter API Key 加密存储
- [X] 3.3 实现 API Key 格式验证
- [X] 3.4 实现平台托管 AI 额度管理
- [X] 3.5 实现多级限流机制

## 4. 仓库管理 API

- [X] 4.1 实现 GitHub 仓库列表获取 API
- [X] 4.2 实现仓库导入功能
- [X] 4.3 实现仓库去重检查
- [X] 4.4 实现仓库数据库模型和迁移

## 5. 文件树 API

- [X] 5.1 实现 GitHub API 获取仓库内容
- [X] 5.2 实现递归文件树构建
- [X] 5.3 实现大仓库分页/懒加载

## 6. 翻译配置 API

- [X] 6.1 定义支持的语言列表常量
- [X] 6.2 实现文件选择功能
- [X] 6.3 实现 .github-global-ignore 规则解析
- [X] 6.4 实现 OpenRouter 可用模型列表获取

## 7. 翻译引擎核心

- [X] 7.1 实现 OpenRouter API 客户端
- [X] 7.2 实现 Markdown 翻译 prompt 模板
- [X] 7.3 实现大文件分块翻译
- [X] 7.4 实现翻译结果合并逻辑
- [X] 7.5 创建翻译任务队列

## 8. 异步任务管理

- [X] 8.1 实现翻译任务状态机
- [X] 8.2 实现任务进度跟踪
- [X] 8.3 实现重试机制
- [X] 8.4 实现任务状态查询 API

## 9. 翻译预览 API

- [X] 9.1 实现翻译结果存储
- [X] 9.2 实现原文/译文对比 API

## 10. 变更检测

- [X] 10.1 实现 Git commit SHA 对比逻辑
- [X] 10.2 实现变更文件列表获取
- [X] 10.3 实现 baseline SHA 记录和更新
- [X] 10.4 处理 force push 回退逻辑

## 11. GitHub 提交

- [X] 11.1 实现翻译结果提交到 GitHub
- [X] 11.2 实现翻译目录结构创建
- [X] 11.3 实现 commit 消息生成
- [X] 11.4 处理提交冲突检测
- [X] 11.5 实现 PR 创建功能

## 12. README 语言链接

- [X] 12.1 实现 README 结构分析
- [X] 12.2 实现语言切换链接生成
- [X] 12.3 实现链接插入位置确定
- [X] 12.4 实现现有语言区域更新

## 13. 健康检查

- [X] 13.1 实现健康检查端点

---

# 第二阶段：前端开发

## 14. 用户设置界面

- [X] 14.1 实现用户设置页面前端

## 15. 仓库管理界面

- [X] 15.1 创建仓库列表页面前端

## 16. 文件树界面

- [X] 16.1 创建仓库文件树组件前端

## 17. 翻译配置界面

- [X] 17.1 实现语言选择组件
- [X] 17.2 创建翻译配置页面前端

## 18. 任务进度界面

- [X] 18.1 创建任务进度展示组件

## 19. 翻译预览界面

- [X] 19.1 创建翻译预览页面

## 20. 主界面

- [X] 20.1 创建项目首页
- [X] 20.2 创建导航栏和布局
- [X] 20.3 实现响应式设计
- [X] 20.4 添加加载状态和错误提示
- [X] 20.5 添加国际化（i18n）

---

# 第三阶段：部署与测试

- [X] 21.1 编写单元测试
- [X] 21.2 编写集成测试
- [X] 21.3 配置 CI/CD 流水线
- [ ] 21.4 生产环境部署验证
- [X] 2.2 实现 GitHub OAuth Web Application Flow (Authorization Code Flow)
- [X] 2.3 实现 OAuth 回调处理和 token 交换
- [X] 2.4 实现 AES-256-GCM 加密工具类
- [X] 2.5 实现用户会话管理（Session with HttpOnly, Secure, SameSite）
- [X] 2.6 实现 GitHub Token 加密存储
- [X] 2.7 实现用户登出功能
- [X] 2.8 实现 CSRF 防护（OAuth state 参数验证）
- [X] 2.9 实现白名单用户管理

## 3. 用户设置管理

- [X] 3.1 创建用户设置 API 端点
- [X] 3.2 实现 OpenRouter API Key 加密存储
- [X] 3.3 实现 API Key 格式验证
- [X] 3.4 实现用户设置页面前端
- [X] 3.5 实现平台托管 AI 额度管理
- [X] 3.6 实现多级限流机制（全局/用户/IP/仓库）

## 4. 仓库管理模块

- [X] 4.1 实现 GitHub 仓库列表获取 API
- [X] 4.2 实现仓库导入功能
- [X] 4.3 实现仓库去重检查
- [X] 4.4 实现仓库数据库模型和迁移
- [X] 4.5 创建仓库列表页面前端

## 5. 文件树展示

- [X] 5.1 实现 GitHub API 获取仓库内容
- [X] 5.2 实现递归文件树构建
- [X] 5.3 实现大仓库分页/懒加载
- [X] 5.4 创建仓库文件树组件前端

## 6. 翻译配置模块

- [X] 6.1 定义支持的语言列表常量
- [X] 6.2 实现语言选择组件
- [X] 6.3 实现文件选择功能
- [X] 6.4 实现 .github-global-ignore 规则解析
- [X] 6.5 实现 OpenRouter 可用模型列表获取
- [X] 6.6 创建翻译配置页面前端

## 7. 翻译引擎核心

- [X] 7.1 实现 OpenRouter API 客户端
- [X] 7.2 实现 Markdown 翻译 prompt 模板
- [X] 7.3 实现大文件分块翻译
- [X] 7.4 实现翻译结果合并逻辑
- [X] 7.5 创建翻译任务队列（内存队列 MVP）

## 8. 异步任务管理

- [X] 8.1 实现翻译任务状态机（pending/running/completed/failed）
- [X] 8.2 实现任务进度跟踪
- [X] 8.3 实现重试机制（指数退避，最多3次）
- [X] 8.4 实现任务状态查询 API
- [X] 8.5 创建任务进度展示组件

## 9. 翻译预览功能

- [X] 9.1 实现翻译结果存储
- [X] 9.2 实现原文/译文对比 API
- [X] 9.3 创建翻译预览页面

## 10. 变更检测模块

- [X] 10.1 实现 Git commit SHA 对比逻辑
- [X] 10.2 实现变更文件列表获取
- [X] 10.3 实现 baseline SHA 记录和更新
- [X] 10.4 处理 force push 回退逻辑

## 11. GitHub 提交功能

- [X] 11.1 实现翻译结果提交到 GitHub
- [X] 11.2 实现翻译目录结构创建
- [X] 11.3 实现 commit 消息生成
- [X] 11.4 处理提交冲突检测
- [X] 11.5 实现 PR 创建功能

## 12. README 语言链接处理

- [X] 12.1 实现 README 结构分析 AI prompt
- [X] 12.2 实现语言切换链接生成
- [X] 12.3 实现链接插入位置确定
- [X] 12.4 实现现有语言区域更新
- [X] 12.5 实现子目录 README 路径调整

## 13. 前端界面完善

- [X] 13.1 创建项目首页
- [X] 13.2 创建导航栏和布局
- [X] 13.3 实现响应式设计
- [X] 13.4 添加加载状态和错误提示
- [X] 13.5 添加国际化（i18n）

## 14. 部署与测试

- [X] 14.1 配置 Docker 多阶段构建（node:20-alpine）
- [X] 14.2 配置 Docker Compose（app, mysql, redis 服务）
- [X] 14.3 实现数据库自动迁移
- [X] 14.4 编写单元测试（目标 80%+ 覆盖率）
- [X] 14.5 编写集成测试
- [X] 14.6 配置 CI/CD 流水线
- [ ] 14.7 生产环境部署验证
- [X] 14.8 实现健康检查端点（/api/health）

---

# 文件选择器优化任务

## Task 1: 修改后端 API - 移除排序逻辑，保持原始顺序

**Files:**
- Modify: `github-global/src/app/api/repos/[id]/files/route.ts:69-74`

**Step 1: 查看当前代码**

```typescript
// 当前代码 (第 69-74 行)
// Sort: directories first, then files
return items.sort((a, b) => {
  if (a.type === 'dir' && b.type === 'file') return -1
  if (a.type === 'file' && b.type === 'dir') return 1
  return a.name.localeCompare(b.name)
})
```

**Step 2: 移除排序逻辑**

将上述代码修改为直接返回 items：

```typescript
// 保持 GitHub API 返回的原始顺序
return items
```

**Step 3: 验证更改**

运行: `cd github-global && npm run build`
预期: 编译成功

**Step 4: 提交**

```bash
cd github-global
git add src/app/api/repos/[id]/files/route.ts
git commit -m "feat(file-selector): 移除文件排序，保持 GitHub API 原始顺序"
```

---

## Task 2: 修改后端 API - 仅保留 .md 文件过滤

**Files:**
- Modify: `github-global/src/app/api/repos/[id]/files/route.ts:57-58`

**Step 1: 查看当前代码**

```typescript
// 当前代码 (第 57-58 行)
// Only include markdown files
if (item.name.endsWith('.md') || item.name === '.github-global-ignore') {
```

**Step 2: 修改过滤条件，仅保留 .md**

```typescript
// Only include .md files
if (item.name.endsWith('.md')) {
```

**Step 3: 验证更改**

运行: `cd github-global && npm run build`
预期: 编译成功

**Step 4: 提交**

```bash
cd github-global
git add src/app/api/repos/[id]/files/route.ts
git commit -m "feat(file-selector): 仅过滤 .md 文件"
```

---

## Task 3: 前端 - 添加目录展开/折叠状态管理

**Files:**
- Modify: `github-global/src/app/(dashboard)/repos/[id]/page.tsx:61-104`

**Step 1: 添加状态变量**

在 `export default function RepoDetailPage()` 函数内，添加：

```typescript
// 目录展开状态管理
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
```

**Step 2: 添加展开/折叠处理函数**

在 `handleDeselectAllFiles` 函数后添加：

```typescript
const handleFolderToggle = (path: string) => {
  setExpandedFolders(prev => {
    const next = new Set(prev)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    return next
  })
}
```

**Step 3: 重写 renderFileTree 函数**

将现有 `renderFileTree` 函数 (第 77-104 行) 替换为支持折叠的版本，包含：
- 目录使用 button 元素，点击触发 handleFolderToggle
- 展开状态通过 expandedFolders.has(path) 判断
- 子目录仅在展开时渲染

**Step 4: 验证更改**

运行: `cd github-global && npm run build`
预期: 编译成功

**Step 5: 提交**

```bash
cd github-global
git add src/app/(dashboard)/repos/[id]/page.tsx
git commit -m "feat(file-selector): 添加目录展开/折叠功能，默认折叠"
```

---

## Task 4: 添加必要的 CSS 样式

**Files:**
- Modify: `github-global/src/app/(dashboard)/repos/[id]/page.module.css`

**Step 1: 在 CSS 文件末尾添加新样式**

```css
/* 目录展开/折叠样式 */
.folderButton {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary, #1f2937);
  font-size: 14px;
  width: 100%;
  text-align: left;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.folderButton:hover {
  background-color: var(--hover-bg, #f3f4f6);
}

.folderIcon {
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.folderIconExpanded {
  transform: rotate(90deg);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.folderChildren {
  margin-left: 8px;
  border-left: 1px solid var(--border-color, #e5e7eb);
  padding-left: 8px;
}
```

**Step 2: 验证更改**

运行: `cd github-global && npm run build`
预期: 编译成功

**Step 3: 提交**

```bash
cd github-global
git add src/app/(dashboard)/repos/[id]/page.module.css
git commit -m "feat(file-selector): 添加目录折叠展开的 CSS 样式"
```

---

## Task 5: 全量验证

**Step 1: 运行 TypeScript 检查**

运行: `cd github-global && npx tsc --noEmit`
预期: 无错误

**Step 2: 测试文件选择弹框功能**

1. 启动开发服务器: `cd github-global && npm run dev`
2. 打开浏览器访问仓库详情页
3. 点击「选择文件」按钮
4. 验证：
   - [ ] 目录默认折叠
   - [ ] 点击目录可展开/折叠
   - [ ] 只显示 .md 文件
   - [ ] 文件顺序与 GitHub 仓库一致

**Step 3: 提交最终更改**

```bash
cd github-global
git add -A
git commit -m "feat: 优化文件选择器 - 目录折叠 + Markdown 过滤 + 保持原始顺序"
```
