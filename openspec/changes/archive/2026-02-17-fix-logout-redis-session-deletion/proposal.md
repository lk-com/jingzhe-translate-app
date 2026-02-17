## Why

用户执行退出登录操作后，系统仅清除了浏览器 Cookie，但未删除 Redis 中存储的会话数据。这导致会话数据在 Redis 中保留长达 7 天（直到自动过期），存在会话劫持风险和数据不一致问题。用户期望退出登录后，服务器端会话数据应立即失效。

## What Changes

- 在 `session.ts` 中新增 `getSessionId()` 函数，用于获取当前请求的 sessionId
- 修改 `logout/route.ts`，在退出登录时正确调用 `destroySession()` 删除 Redis 中的会话数据
- 确保退出登录流程完整执行：清除 Cookie + 删除 Redis 会话

## Capabilities

### New Capabilities

无新增能力。

### Modified Capabilities

- `github-auth`: 修改退出登录功能的需求，明确要求在退出时删除 Redis 会话数据

## Impact

**受影响的文件：**
- `github-global/src/lib/session.ts` - 新增 `getSessionId()` 函数
- `github-global/src/app/api/auth/logout/route.ts` - 修改退出登录逻辑

**API 行为变化：**
- `POST /api/auth/logout` 现在会删除 Redis 中的会话数据，而不仅仅是清除 Cookie

**安全影响：**
- 修复后会话在退出时立即失效，降低会话劫持风险
- 确保用户退出登录后，服务器端状态与客户端状态一致
