# 贡献指南 / Contributing Guide

## 目录结构规范 / Directory Structure Convention

```
AFS-System/
├── web/                    # Next.js 前端应用
│   ├── app/                # App Router 页面
│   ├── components/         # React 组件
│   ├── lib/                # API 客户端
│   └── types/              # TypeScript 类型
│
├── server/                 # Express 后端应用
│   ├── src/
│   │   ├── modules/        # 功能模块（按业务领域）
│   │   │   ├── auth/       #   认证模块
│   │   │   ├── user/       #   用户模块
│   │   │   ├── qa/         #   问答模块
│   │   │   ├── assist/     #   协助关系模块
│   │   │   ├── chat/       #   AI 对话模块
│   │   │   ├── rolecard/   #   角色卡模块
│   │   │   ├── sentiment/  #   好感度模块
│   │   │   ├── settings/   #   设置模块
│   │   │   └── roles/      #   角色权限模块
│   │   │
│   │   ├── core/           # 核心基础设施
│   │   │   ├── storage/    #   存储服务
│   │   │   ├── llm/        #   LLM 服务
│   │   │   ├── middleware/ #   全局中间件
│   │   │   ├── hooks/      #   自动 Hooks
│   │   │   ├── utils/      #   工具函数
│   │   │   └── config/     #   配置
│   │   │
│   │   └── server.js       # 入口文件
│   │
│   ├── tests/              # 测试文件
│   ├── scripts/            # 脚本文件
│   └── storage/            # 文件存储
│
├── documentation/          # Docusaurus 文档站点
│   ├── content/            # 正式文档
│   └── archive/            # 历史归档（不追踪）
│
├── modelserver/            # Ollama 模型服务
├── mongoserver/            # MongoDB 配置
│
├── AI陪伴功能/             # LangGraph 开发指引
│
└── .opencode/plans/        # 开发计划
```

---

## 后端模块结构规范 / Backend Module Structure

每个功能模块遵循以下结构：

```
modules/{module-name}/
├── controller.js           # 控制器（处理 HTTP 请求）
├── service.js              # 服务层（业务逻辑）
├── repository.js           # 仓库层（数据访问，可选）
├── model.js                # Mongoose 模型（可选）
├── route.js                # API 路由定义
└── {subdir}/               # 子目录（如需要）
```

### 模块示例

```
modules/user/
├── controller.js           # UserController
├── service.js              # userService
├── repository.js           # UserRepository
├── model.js                # User model
└── route.js                # /api/users 路由

modules/qa/
├── controller.js           # AnswerController
├── services/
│   ├── answer.js           # AnswerService
│   └── question.js         # QuestionService
├── repositories/
│   ├── answer.js           # AnswerRepository
│   └── question.js         # QuestionRepository
├── models/
│   ├── answer.js           # Answer model
│   └── question.js         # Question model
└── routes/
    ├── answers.js          # /api/answers 路由
    └── questions.js        # /api/questions 路由
```

---

## 新功能开发流程 / New Feature Development Flow

### 1. 创建新模块

```bash
# 在 server/src/modules/ 下创建新模块目录
mkdir -p server/src/modules/{module-name}
```

### 2. 模块文件结构

```javascript
// controller.js - 处理 HTTP 请求
import { service } from './service.js';

export default {
  async getItem(req, res) {
    const result = await service.getItem(req.params.id);
    res.json({ success: true, data: result });
  }
};

// service.js - 业务逻辑
import { repository } from './repository.js';

export const service = {
  async getItem(id) {
    return await repository.findById(id);
  }
};

// route.js - 路由定义
import express from 'express';
import controller from './controller.js';
import { protect } from '../../core/middleware/index.js';

const router = express.Router();
router.get('/:id', protect, controller.getItem);
export default router;
```

### 3. 注册路由

在 `server/src/server.js` 中注册新模块路由：

```javascript
import newModuleRouter from './modules/{module-name}/route.js';
// ...
app.use('/api/{module-name}', protect, newModuleRouter);
```

---

## 核心服务使用规范 / Core Services Usage

### 存储服务 (core/storage/)

```javascript
import { dualStorage } from '../../core/storage/dual.js';
import { vectorIndex } from '../../core/storage/vector.js';

// 双重存储
await dualStorage.saveUserProfile(userId, userData);

// 向量索引
await vectorIndex.buildIndex(userId);
```

### LLM 服务 (core/llm/)

```javascript
import { createDefaultLLMClient } from '../../core/llm/client.js';

const llm = createDefaultLLMClient();
const response = await llm.generate(prompt);
```

### 工具函数 (core/utils/)

```javascript
import { logger } from '../../core/utils/logger.js';
import { ProgressTracker } from '../../core/utils/progress.js';

logger.info('Operation started');
const tracker = new ProgressTracker(sessionId);
```

---

## Docker 使用规范 / Docker Usage

### 开发模式（默认，支持热更新）
```bash
docker compose up -d
```

### 生产模式
```bash
NODE_ENV=production docker compose build
NODE_ENV=production docker compose up -d
```

### 常用命令
```bash
# 查看日志
docker compose logs -f web

# 重建服务
docker compose build web
docker compose up -d web

# 停止所有服务
docker compose down
```

---

## 文档放置规则 / Documentation Rules

| 文档类型 | 位置 |
|---------|------|
| 正式技术文档 | `documentation/content/` |
| 开发计划 | `.opencode/plans/` |
| LangGraph 相关 | `AI陪伴功能/` |
| 历史报告/进度 | `documentation/archive/` (不追踪) |

---

## Commit Message 规范 / Commit Convention

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 代码重构
chore: 杂项（构建、配置等）
test: 测试相关
```

---

## 路径规范 / Path Convention

- **禁止使用绝对路径** (如 `F:\FPY\AFS-System`)
- 使用相对路径或环境变量 `${PROJECT_ROOT}`
- 确保 GitHub Clone 后可正常运行

---

## Import 路径规范 / Import Path Convention

```javascript
// ✅ 正确 - 从 core 导入
import { logger } from '../../core/utils/logger.js';
import { dualStorage } from '../../core/storage/dual.js';

// ✅ 正确 - 从其他模块导入
import { userService } from '../user/service.js';

// ❌ 错误 - 使用旧路径
import logger from '../utils/logger.js';
import dualStorage from '../services/dualStorage.js';
```
