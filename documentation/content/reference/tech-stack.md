---
sidebar_position: 1
---

# 技术栈

AFS System 采用现代化的前后端分离架构，结合 AI 技术为老年人提供数字记忆传承服务。

## 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.1.x | React 框架（App Router） |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 3.4.x | 样式解决方案 |
| shadcn/ui | latest | 组件库 |
| Radix UI | latest | 无障碍组件基础 |
| Zustand | 4.5.x | 状态管理 |
| Axios | 1.7.x | HTTP 客户端 |
| Lucide React | 0.400+ | 图标库 |
| date-fns | 3.x | 日期处理 |
| next-themes | 0.4.x | 主题切换 |
| Recharts | 3.7.x | 图表库 |

### 前端架构特点

- **App Router**: 使用 Next.js 15 最新的 App Router 架构
- **服务端组件**: 充分利用 React Server Components 优化性能
- **类型安全**: 全局 TypeScript 保证代码质量
- **响应式设计**: 支持桌面和移动设备
- **无障碍支持**: 基于 Radix UI 的 WCAG 兼容组件

## 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x | 运行时环境 |
| Express.js | 4.19.x | Web 框架 |
| MongoDB | 8.x | 主数据库 |
| Mongoose | 8.7.x | ODM（对象文档映射） |
| JWT | 9.x | 身份验证 |
| bcryptjs | 2.4.x | 密码加密 |
| Socket.IO | 4.7.x | 实时通信 |
| Winston | 3.19.x | 日志管理 |
| Multer | 1.4.x | 文件上传处理 |

### 后端架构特点

- **三层架构**: Controller-Service-Repository 分层设计
- **模块化**: 按功能模块组织代码（auth, user, chat, memory 等）
- **双存储**: MongoDB + 文件系统的混合存储方案
- **RESTful API**: 标准的 REST API 设计
- **实时通信**: Socket.IO 支持实时聊天

## AI/LLM 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| LangChain | 1.2.x | LLM 应用框架 |
| LangGraph | 1.1.x | 对话编排 |
| LangChain Ollama | 1.2.x | Ollama 集成 |
| ChromaDB | latest | 向量数据库 |
| OpenAI SDK | 4.73.x | API 备用方案 |
| tiktoken | 1.x | Token 计数 |
| Ollama | latest | 本地模型服务 |
| bge-m3 | latest | 嵌入模型 |

### AI 架构特点

- **本地优先**: 使用 Ollama 本地部署，保护隐私
- **多模型支持**: 支持 DeepSeek、ChatGLM 等多种模型
- **RAG 系统**: 检索增强生成提升对话质量
- **对话编排**: LangGraph 实现复杂的对话流程
- **向量存储**: ChromaDB 用于语义检索

## 容器化技术

| 技术 | 用途 |
|------|------|
| Docker | 容器化 |
| Docker Compose | 服务编排 |
| Alpine Linux | 轻量级基础镜像 |

## 开发工具

| 工具 | 用途 |
|------|------|
| Vitest | 后端测试 |
| Jest | 单元测试补充 |
| ESLint | 代码检查 |
| Docusaurus | 文档站点 |
| Nodemon | 开发热重载 |

## 服务端口映射

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Frontend Web | 3000 | 3002 | Next.js 应用 |
| Backend API | 3000 | 3001 | Express 服务 |
| Documentation Site | 80 | 3003 | Docusaurus 文档 |
| Ollama | 11434 | 8000 | AI 模型服务 |
| ChromaDB | 8000 | 8001 | 向量数据库 |
| MongoDB | 27017 | 27018 | 主数据库 |

## 目录结构

```
afs-system/
├── web/                    # Next.js 前端应用
│   ├── app/               # App Router 页面
│   ├── components/        # React 组件和 UI 组件
│   ├── lib/              # API 客户端和工具函数
│   ├── stores/           # Zustand 状态管理
│   └── types/            # TypeScript 类型定义
├── server/                # Express 后端 API 服务
│   ├── src/
│   │   ├── controllers/   # 控制器层
│   │   ├── services/      # 业务逻辑层
│   │   ├── repositories/  # 数据访问层
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由定义
│   │   ├── middleware/    # 中间件
│   │   ├── core/          # 核心功能（LLM、存储、日志）
│   │   └── modules/       # 业务模块
│   └── storage/          # 文件存储
├── modelserver/           # AI 模型服务
├── mongoserver/           # MongoDB 配置
├── documentation/         # Docusaurus 文档站点
├── docker-compose.yml     # 容器编排配置
└── .env.example          # 环境变量示例
```

## 数据库设计

### MongoDB 集合

- `users`: 用户基本信息
- `roles`: AI 角色卡片
- `questions`: 问卷问题
- `answers`: 问卷答案
- `chats`: 聊天记录
- `memories`: 记忆数据
- `sentiments`: 情感分析
- `admins`: 管理员账户
- `permissions`: 权限定义
- `invitecodes`: 邀请码管理

### 文件存储

- `/storage/uploads`: 用户上传文件
- `/storage/avatars`: 用户头像
- `/storage/chroma_db`: ChromaDB 数据

## 系统要求

### 开发环境

- Node.js >= 20.0
- npm >= 9.0
- Docker & Docker Compose
- Git

### 生产环境推荐配置

- CPU: 4 核心以上
- 内存: 8GB 以上（AI 模型运行需要更多）
- 存储: 50GB 以上可用空间
- GPU: NVIDIA GPU（可选，用于加速 AI 推理）

## 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 相关文档

- [环境变量配置](./env.md)
- [Docker 配置](./config.md)
- [常见问题](./faq.md)
