# 后端模块分析报告

**日期**: 2026-02-15
**目的**: 后端源代码重构前的模块状态分析

---

## 📋 功能模块完整列表

### ✅ 已完成且正在使用的模块

| 模块 | API 路由 | 文件数 | 状态 |
|-----|---------|-------|------|
| **auth** | `/api/auth/*` | 4 | ✅ 稳定 |
| - 注册/登录 | `POST /register`, `POST /login` | | |
| - 获取当前用户 | `GET /me` | | |
| **user** | `/api/users/*` | 4 | ✅ 稳定 |
| - 用户 CRUD | `GET/POST/PUT/DELETE /users` | | |
| - 用户统计 | `GET /users/stats` | | |
| **qa** (问答) | `/api/questions/*`, `/api/*` | 10 | ✅ 稳定 |
| - 获取问题 | `GET /questions` | | |
| - 提交答案 | `POST /answer/self`, `/answer/assist` | | |
| - 查看进度 | `GET /progress/self` | | |
| **settings** | `/api/settings/*` | 2 | ✅ 稳定 |
| - 系统设置 | `GET/PUT /settings` | | |
| - 系统信息 | `GET /settings/info` | | |
| **roles** | `/api/roles/*` | 3 | ✅ 稳定 |
| - 角色 CRUD | `GET/POST/PUT/DELETE /roles` | | |
| - 权限管理 | `GET/POST/PUT/DELETE /permissions` | | |

---

### 🟡 开发中/未完全测试的模块

| 模块 | API 路由 | 文件数 | 状态 | 完成度 |
|-----|---------|-------|------|--------|
| **chat** (AI对话) | `/api/chat/*` | 15 | 🟡 开发中 | 85% |
| - 创建会话 | `POST /sessions/by-code` | | Phase 3 | |
| - 发送消息 | `POST /sessions/:id/messages` | | | |
| - 获取消息 | `GET /sessions/:id/messages` | | | |
| **rolecard** (角色卡) | `/api/rolecard/*` | 8 | 🟡 开发中 | 98% |
| - 生成角色卡 | `POST /generate` | | Phase 2 | |
| - 更新角色卡 | `PUT /` | | | |
| - 向量索引 | `POST /vector-index/build` | | | |
| **sentiment** (好感度) | `/api/sentiment/*` | 3 | 🟡 开发中 | 75% |
| - 获取好感度 | `GET /:targetUserId/:strangerId` | | Phase 1 | |
| - 更新好感度 | `PUT /:targetUserId/:strangerId` | | | |
| **assist** (协助关系) | 嵌入在 `/api/auth/assist/*` | 4 | ✅ 稳定 | 100% |
| - 搜索用户 | `GET /assist/search` | | 需独立 | |
| - 建立关系 | `POST /assist/verify` | | | |

---

### 🔧 核心基础设施

| 分类 | 文件 | 状态 |
|-----|------|------|
| **存储服务** | | |
| - dualStorage.js | 双重存储 | ✅ 使用中 |
| - fileStorage.js | 文件存储 | ✅ 使用中 |
| - storageService.js | 存储服务 | ✅ 使用中 |
| - vectorIndexService.js | 向量索引 | 🟡 开发中 |
| - EmbeddingService.js | 嵌入服务 | 🟡 新增 |
| **LangChain** | | |
| - llmConfig.js | LLM 配置 | ✅ 使用中 |
| - multiLLMClient.js | 多 LLM 客户端 | ✅ 使用中 |
| - roleCardGenerator.js | 角色卡生成器 A | ✅ 使用中 |
| - roleCardGeneratorB.js | 角色卡生成器 B | ✅ 使用中 |
| - sentimentManager.js | 好感度管理器 | 🟡 开发中 |
| - assistantsGuidelinesPreprocessor.js | 预处理器 | ✅ 使用中 |
| **LangGraph** (chat/) | | |
| - ChatGraphOrchestrator.js | 对话编排器 | 🟡 开发中 |
| - DynamicRoleCardAssembler.js | 动态角色卡 | 🟡 开发中 |
| - nodes/* (9个文件) | 对话节点 | 🟡 开发中 |
| - edges/edges.js | 边定义 | 🟡 开发中 |
| - state/ConversationState.js | 对话状态 | 🟡 开发中 |
| **工具** | | |
| - utils/llmClient.js | LLM 客户端封装 | ✅ 使用中 |
| - utils/logger.js | 日志工具 | ✅ 使用中 |
| - utils/ProgressTracker.js | 进度追踪 | ✅ 使用中 |
| - utils/rolecardStorage.js | 角色卡存储 | ✅ 使用中 |
| - utils/simpleFileLock.js | 文件锁 | ✅ 使用中 |
| - utils/tokenCounter.js | Token 计数 | ✅ 使用中 |

---

### ✅ 可疑文件分析结果（均在使用中）

| 文件 | 分析结果 | 使用位置 |
|-----|---------|---------|
| `utils/llmClient.js` | ✅ 使用中 | responseGenerator.js, multiLLMClient.js, sentimentManager.js |
| `services/simpleSyncQueue.js` | ✅ 使用中 | server.js（双重存储同步核心） |
| `services/autoHookRegistry.js` | ✅ 使用中 | server.js（MongoDB hooks 注册） |

---

## 📊 统计摘要

| 分类 | 数量 |
|-----|------|
| **总计 JS 文件** | 74 个 |
| **已完成模块** | 5 个 (auth, user, qa, settings, roles) |
| **开发中模块** | 4 个 (chat, rolecard, sentiment, assist) |
| **API 端点** | ~60 个 |

---

## 重构计划

按功能模块重新组织 `server/src/` 目录结构：

```
server/src/
├── modules/
│   ├── auth/          # 认证模块
│   ├── user/          # 用户模块
│   ├── qa/            # 问答模块
│   ├── chat/          # AI 对话模块
│   ├── rolecard/      # 角色卡模块
│   ├── sentiment/     # 情感分析模块
│   ├── assist/        # 协助关系模块（独立）
│   ├── settings/      # 设置模块
│   └── roles/         # 角色权限模块
│
├── core/              # 核心基础设施
│   ├── storage/
│   ├── langchain/
│   ├── middleware/
│   ├── config/
│   └── utils/
│
└── server.js
```

---

**报告生成时间**: 2026-02-15
