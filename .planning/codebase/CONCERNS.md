# Codebase Concerns

**Analysis Date:** 2026-03-24

## Tech Debt

**Large Service File - Admin Service:**
- Issue: `server/src/modules/admin/service.js` contains 2513 lines with multiple responsibilities (user management, dashboard stats, exports, system status, memory management, vector index operations)
- Files: `server/src/modules/admin/service.js`
- Impact: Difficult to maintain, test, and understand; changes may have unintended side effects
- Fix approach: Split into domain-specific services (UserService, DashboardService, ExportService, SystemStatusService)

**Admin Controller Bloat:**
- Issue: `server/src/modules/admin/controller.js` at 1587 lines with many endpoints
- Files: `server/src/modules/admin/controller.js`
- Impact: Hard to navigate and test individual routes
- Fix approach: Split controllers by domain (UserController, DashboardController, QuestionnaireController, etc.)

**Chat Orchestrator Complexity:**
- Issue: `server/src/modules/chat/orchestrator.js` at 1241 lines managing multiple node types, session states, and indexing flows
- Files: `server/src/modules/chat/orchestrator.js`
- Impact: High cognitive load for developers, difficult to debug chat flow issues
- Fix approach: Extract session management, node registry, and indexing logic into separate modules

**Web Admin API Client:**
- Issue: `web/lib/admin-api.ts` at 1447 lines with all admin API functions
- Files: `web/lib/admin-api.ts`
- Impact: Large bundle size impact, difficult to find specific API functions
- Fix approach: Split into domain-specific API modules (userApi, memoryApi, dashboardApi, etc.)

## Known Bugs

**ES Module Mock Issues in Tests:**
- Symptoms: Multiple test cases skipped due to ES module mocking problems
- Files: `server/tests/unit/dynamicRoleCardAssembler.test.js` (lines 236, 259, 395, 414)
- Trigger: ES module imports cannot be properly mocked in test environment
- Workaround: Tests marked with `test.skip` and labeled "TODO: ES module mock issue"

**Integration Test Skips:**
- Symptoms: Integration tests conditionally skipped
- Files: `server/tests/integration/xiaoshudong/workflow.test.js`, `server/tests/integration/companionship.test.js`
- Trigger: Missing external dependencies or environment setup
- Workaround: Using `describe.skipIf` pattern to skip when conditions not met

## Security Considerations

**Hardcoded JWT Secret:**
- Risk: Default JWT secret key exposed in codebase could be used in production if `JWT_SECRET` env var is not set
- Files: `server/src/modules/auth/middleware.js` (line 3), `server/src/modules/admin/middleware.js` (line 13)
- Current mitigation: Warning comment in code suggests changing in production
- Recommendations: Remove default value, throw error if JWT_SECRET not set in production environment

```javascript
// Current (risky):
const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';

// Recommended:
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-key';
```

**Token Logging in Frontend:**
- Risk: Authentication tokens logged to console in production builds
- Files: `web/lib/api.ts`, `web/lib/admin-api.ts`, `web/stores/auth.ts`, `web/stores/admin-auth.ts`
- Current mitigation: None - multiple `console.log` statements with token prefixes
- Recommendations: Remove or guard token logging behind development-only checks

**LocalStorage Token Storage:**
- Risk: Tokens stored in localStorage vulnerable to XSS attacks
- Files: `web/stores/auth.ts`, `web/stores/admin-auth.ts`
- Current mitigation: Standard JWT approach, but not optimal
- Recommendations: Consider httpOnly cookies for token storage for enhanced security

## Performance Bottlenecks

**Memory Scheduler Complexity:**
- Problem: `server/src/modules/memory/Scheduler.js` at 1078 lines with complex cycle management
- Files: `server/src/modules/memory/Scheduler.js`
- Cause: Growing complexity with legacy session handling (lines 569-626) and multiple scheduling modes
- Improvement path: Refactor to use event-driven architecture, extract legacy handling into adapter pattern

**Vector Index Operations:**
- Problem: Vector index status checks may be slow with large datasets
- Files: `server/src/modules/admin/service.js` (memory-related methods)
- Cause: Synchronous operations on potentially large vector stores
- Improvement path: Implement caching layer for status checks, add pagination for large memory lists

**Frontend Bundle Size:**
- Problem: Large admin API client adds to bundle size
- Files: `web/lib/admin-api.ts` (1447 lines)
- Cause: All admin API functions in single file
- Improvement path: Code splitting by admin route, lazy loading of admin API modules

## Fragile Areas

**Role Card V1/V2 Dual Format:**
- Files: `server/src/core/storage/rolecard.js`, `server/src/modules/rolecard/controller.js`
- Why fragile: Dual format handling requires careful type checking and format conversion
- Safe modification: Always test with both V1 and V2 role cards, maintain backward compatibility
- Test coverage: Gaps in V1/V2 conversion edge cases

**Chat Session State Management:**
- Files: `server/src/modules/chat/orchestrator.js`, `server/src/modules/chat/state/ConversationState.js`
- Why fragile: Multiple state transitions (active -> indexing -> offline), race conditions possible
- Safe modification: Use atomic database updates, add state transition logging
- Test coverage: Missing tests for concurrent message handling during state transitions

**LangGraph Flow Configuration:**
- Files: `server/src/modules/langgraph/defaults/rolecard.js`, `server/src/modules/langgraph/defaults/xiaoshudong.js`
- Why fragile: Node configurations marked as deprecated but still referenced
- Safe modification: Check all node references before removing deprecated nodes
- Test coverage: Integration tests skipped due to environment dependencies

## Scaling Limits

**In-Memory Session Storage:**
- Current capacity: `activeSessions` Map in orchestrator holds all active chat sessions
- Limit: Memory exhaustion with high concurrent user count
- Scaling path: Move to Redis or distributed cache, implement session eviction policy

**MongoDB Connection Pooling:**
- Current capacity: Single mongoose connection
- Limit: Connection pool exhaustion under high load
- Scaling path: Configure connection pool size, implement read replicas for queries

**ChromaDB Vector Store:**
- Current capacity: Single ChromaDB instance
- Limit: Query latency increases with vector count
- Scaling path: Implement collection sharding, add caching for frequent queries

## Dependencies at Risk

**bcryptjs (Pure JS Implementation):**
- Risk: Slower than native bcrypt, may impact performance under high auth load
- Impact: Login/registration latency
- Migration plan: Consider switching to native `bcrypt` with fallback for Windows dev environments

**Mixed Test Frameworks (Jest + Vitest):**
- Risk: Dual test setup adds maintenance burden, potential for inconsistent test behavior
- Impact: Developer confusion, CI complexity
- Migration plan: Standardize on Vitest (currently primary), remove Jest configuration

**faiss-node Dependency:**
- Risk: Native module with platform-specific builds
- Impact: Installation issues on some platforms, deployment complexity
- Migration plan: Consider pure-JS alternatives or document platform requirements clearly

## Missing Critical Features

**API Rate Limiting:**
- Problem: No rate limiting on public API endpoints
- Blocks: Protection against abuse, DDoS mitigation

**Request Validation Schema:**
- Problem: Ad-hoc validation in controllers rather than centralized schema validation
- Blocks: Consistent error responses, easy API documentation generation

**Health Check Endpoints:**
- Problem: Limited health check beyond basic LLM health
- Blocks: Proper load balancer integration, container orchestration readiness probes

## Test Coverage Gaps

**ES Module Mocking:**
- What's not tested: Dynamic role card assembler error handling paths
- Files: `server/tests/unit/dynamicRoleCardAssembler.test.js`
- Risk: Production errors in edge cases not caught by tests
- Priority: High - multiple test cases skipped

**Integration Test Environment:**
- What's not tested: Full XiaoShuDong workflow, companionship chat flows
- Files: `server/tests/integration/xiaoshudong/`, `server/tests/integration/companionship.test.js`
- Risk: Integration issues not detected before production
- Priority: Medium - tests exist but conditionally skipped

**Admin Dashboard Metrics:**
- What's not tested: Dashboard statistics calculations, system status checks
- Files: `server/tests/admin/` (dashboard tests limited)
- Risk: Incorrect metrics displayed to admins
- Priority: Medium - affects admin decision-making

**Frontend Component Testing:**
- What's not tested: React component rendering, user interactions
- Files: No test files found in `web/` directory
- Risk: UI regressions, broken user flows
- Priority: High - no frontend test infrastructure detected

## Code Quality Issues

**Excessive `any` Type Usage:**
- Files: `web/lib/api.ts`, `web/lib/admin-api.ts`, `web/stores/permission.ts`, `web/types/index.ts`
- Issue: Multiple uses of `any` type reducing type safety
- Examples:
  - `web/lib/api.ts:112`: `body: any`
  - `web/stores/permission.ts:9`: `[key: string]: any`
  - `web/types/index.ts:282`: `retrievedMemories?: any[]`
- Fix approach: Define proper TypeScript interfaces for all API payloads

**Console Logging in Production Code:**
- Files: Multiple files in `web/` and `server/src/`
- Issue: Debug console.log statements left in code, including sensitive token information
- Examples:
  - `web/lib/api.ts:68-71`: Token logging
  - `web/stores/auth.ts:27-75`: Auth state changes logged
  - `server/src/modules/sentiment/manager.js`: Multiple debug logs
- Fix approach: Use proper logging library with levels, remove or guard debug logs

**Deprecated Code Markers:**
- Files: Multiple files with `@deprecated` and `deprecated` markers
- Issue: Deprecated code not removed, adding maintenance burden
- Examples:
  - `server/src/core/storage/rolecard.js:23`: `@deprecated` marker for V1 role card handling
  - `server/src/modules/langgraph/defaults/xiaoshudong.js:51`: `deprecated: true` node configuration
  - `server/src/modules/xiaoshudong/edges.js:25,35`: Deprecated edge handling
- Fix approach: Create migration plan to remove deprecated code paths, add deprecation timeline

**Silent Error Catching:**
- Files: `server/src/modules/admin/authRoute.js`
- Issue: Empty catch blocks silently swallowing errors
- Examples:
  - Lines 69, 90, 114, 137, 169, 299, 390: `.catch(() => {})` patterns
- Fix approach: At minimum log caught errors, better to handle specific error cases

## Legacy Endpoints

**Admin Routes Marked Legacy:**
- Files: `server/src/modules/admin/route.js` (lines 346-377, 519)
- Issue: Multiple endpoints marked as "legacy endpoint" without deprecation timeline
- Examples:
  - `/api/admin/questions` - Legacy question CRUD
  - `/api/admin/dashboard/stats` - Legacy dashboard statistics
- Fix approach: Document replacement endpoints, set deprecation timeline, add warning headers

---

*Concerns audit: 2026-03-24*
