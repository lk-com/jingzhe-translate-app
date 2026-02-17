## Context

当前退出登录实现存在缺陷：

```
┌─────────────────────────────────────────────────────────────────┐
│                     当前实现问题                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  logout/route.ts 调用 getCurrentUser()                          │
│       │                                                         │
│       ▼                                                         │
│  返回 SessionData { userId, githubLogin, expiresAt }            │
│       │                                                         │
│       ▼                                                         │
│  ❌ 没有 sessionId，无法调用 destroySession(sessionId)           │
│       │                                                         │
│       ▼                                                         │
│  仅清除 Cookie，Redis session 数据残留 7 天                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- 在退出登录时正确删除 Redis 中的会话数据
- 提供获取当前 sessionId 的能力
- 确保退出登录流程的完整性和安全性

**Non-Goals:**
- 不改变会话存储机制（仍使用 Redis）
- 不改变会话过期时间（仍为 7 天）
- 不添加新的认证机制

## Decisions

### Decision 1: 新增 `getSessionId()` 函数

**选择**: 在 `session.ts` 中新增 `getSessionId()` 函数

**理由**:
- `getCurrentUser()` 返回的是 `SessionData`，不包含 `sessionId`
- `destroySession()` 需要 `sessionId` 作为参数
- 保持 API 语义清晰：`getCurrentUser()` 获取用户数据，`getSessionId()` 获取会话标识

**替代方案**:
1. 修改 `getCurrentUser()` 返回值包含 `sessionId` - 会破坏现有调用方
2. 创建新的 `getSessionAndId()` 函数 - 增加复杂度

**最终选择**: 新增独立的 `getSessionId()` 函数，最小化改动

### Decision 2: 修改 logout API 实现

**选择**: 在 logout handler 中获取 sessionId 并调用 destroySession

**实现**:
```typescript
export async function POST(request: NextRequest) {
  const sessionId = await getSessionId()

  if (sessionId) {
    await destroySession(sessionId)
  }

  const response = NextResponse.redirect(new URL('/', request.url))
  response.headers.set('Set-Cookie', clearSessionCookie())

  return response
}
```

**理由**:
- 简单直接，符合现有代码风格
- 使用已有的 `clearSessionCookie()` 函数保持一致性

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| Redis 删除失败时 Cookie 已清除 | 用户下次访问时 session 已不存在，无实际影响 |
| 并发请求可能使用已删除的 session | Redis 删除是原子操作，并发请求会收到 session 无效响应 |

## Migration Plan

无需迁移，这是 bug 修复，直接部署即可。

## Open Questions

无。
