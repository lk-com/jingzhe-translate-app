## 1. Session Library Updates

- [x] 1.1 Add `getSessionId()` function to `session.ts` to retrieve current session ID from cookie
- [x] 1.2 Add unit tests for `getSessionId()` function

## 2. Logout API Fix

- [x] 2.1 Update `logout/route.ts` to call `getSessionId()` and `destroySession()`
- [x] 2.2 Use `clearSessionCookie()` helper for consistent cookie clearing
- [x] 2.3 Add error handling for Redis deletion failures

## 3. Testing

- [x] 3.1 Add integration test for logout flow verifying Redis deletion
- [x] 3.2 Test logout with invalid/expired session
- [x] 3.3 Test logout with Redis failure scenario
