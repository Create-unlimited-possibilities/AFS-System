# 传家之宝 AFS System

[中文文档](README.md) | [English Version](README.en.md)

## 项目简介

传家之宝（Artificial Flashlight Simulation System，AFS）是一个面向老年人的数字记忆传承系统。它通过创建个性化的数字档案，帮助老人记录人生故事，并利用 AI 技术训练专属的对话模型，让 AI 能够以温暖、熟悉的方式与老人交流，陪伴他们重温过往记忆。

## 核心功能

### 1. 数字记忆档案
- 为每位老人创建唯一的 16 位专属编号
- 记录基础信息和情感行为层面的珍贵记忆
- 结构化存储，便于未来回顾和传承

### 2. AI 训练与对话
- 基于记忆数据训练个性化 AI 模型 (Ollama + LoRA)
- 专属 AI 能够以温暖亲切的方式与老人对话
- 持续学习，让 AI 更懂老人的故事和情感

### 3. 协助填写机制
- 亲友可通过编号和邮箱验证协助老人填写档案
- 多人协作，共同完善记忆档案
- 适老化设计，降低使用门槛

### 4. 安全隐私保护
- 严格的身份验证和权限管理
- 数据加密存储，保障隐私安全
- 符合个人信息保护法规要求

### 5. 多端使用支持
- 响应式网页设计，支持 PC 和移动设备
- 简洁直观的用户界面，易于操作
- 未来可扩展至小程序、APP 等平台

### 6. 管理面板
- 用户管理与统计
- 问卷问题管理
- 记忆数据库监控
- 系统状态监控（MongoDB、ChromaDB、LLM）
- 角色与权限管理
- 邀请码系统
- 环境变量在线编辑

## 技术架构

### 当前架构 (重构后)

本系统采用现代化的前后端分离架构，主要技术栈包括：

- **前端**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Node.js + Express.js + Controller-Service-Repository 三层架构
- **AI 服务**: Ollama + Python + LoRA 微调
- **数据库**: MongoDB + 文件系统双重存储
- **部署**: Docker + Docker Compose

系统由多个服务模块组成：
- `web`: Next.js 前端应用 (端口3002)
- `server`: Express 后端 API 服务 (端口3001)
- `docs`: Docusaurus 文档站点 (端口3003)
- `modelserver`: AI 模型训练与推理服务 (端口8000)
- `chromaserver`: ChromaDB 向量数据库 (端口8001)
- `mongoserver`: MongoDB 数据库服务 (端口27018)

### 重构历史

项目从传统 HTML + Bootstrap 前端架构全面迁移到现代 Next.js 框架：

#### 重构目标
- 从传统 HTML + CSS + 原生 JavaScript 迁移到现代 Next.js 框架
- 保留现有 Express + MongoDB 后端（三层架构、双重存储、问卷收集逻辑不变）
- 逐步实现现代化前端：组件化、类型安全、响应式 UI、更好的开发/维护体验
- 为后续数字人生成、LangGraph + LLM 集成预留良好扩展性

#### 核心技术决策
- **项目结构**: monorepo 风格统一代码仓库，但保持容器分离部署
- **类型系统**: 全局启用 TypeScript 提供类型安全和重构可靠性
- **样式方案**: shadcn/ui + Tailwind CSS 替代 Bootstrap 5
- **数据获取**: Server Components fetch + Server Actions 混合方式
- **状态管理**: Zustand 轻量级状态管理替代传统状态管理

#### 架构变化
1. **后端架构重构**: 实现 Controller-Service-Repository 模式
2. **前端现代化**: Next.js 15+ App Router + TypeScript + shadcn/ui + Tailwind
3. **容器分离**: 前后端容器独立部署，保持物理分离
4. **API 兼容**: 现有后端 API 完全不动，继续使用

## 快速开始

### 环境要求

- Docker 和 Docker Compose
- 推荐配置: Linux/macOS/Windows (WSL2) + NVIDIA GPU (用于 AI 训练加速)

### 本地部署

1. 克隆项目并进入目录
   ```bash
   git clone <your-repo-url>
   cd afs-system
   ```

2. 配置环境变量
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，配置 MongoDB 和 JWT 密钥
   ```

3. 启动所有服务
   ```bash
   docker-compose up -d
   ```

4. 访问应用
   - 前端地址: http://localhost:3002 (Next.js 应用)
   - 后端 API: http://localhost:3001 (Express 服务)
   - 文档站点: http://localhost:3003 (Docusaurus)
   - AI 模型服务: http://localhost:8000 (Ollama)
   - MongoDB: localhost:27018

### 使用流程

1. **注册账户**: 使用邮箱注册，系统自动生成专属编号
2. **填写档案**: 登录后回答基础和情感问题，创建记忆档案
3. **协助填写**: 分享编号给亲友，邀请他们协助完善档案
4. **训练模型**: 系统基于档案数据训练专属 AI 模型
5. **温暖对话**: 与专属 AI 进行温馨互动，重温记忆时光

## 开发指南

### 项目结构

```
afs-system/
├── web/             # Next.js 前端应用
│   ├── app/         # Next.js App Router 页面
│   ├── components/   # React 组件和 UI 组件
│   ├── lib/         # API 客户端和工具函数
│   └── stores/      # Zustand 状态管理
├── server/          # Express 后端 API 服务
│   ├── src/
│   │   ├── controllers/  # 控制器层
│   │   ├── services/     # 业务逻辑层
│   │   ├── repositories/ # 数据访问层
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # 路由定义
│   │   └── middleware/   # 中间件
├── modelserver/     # AI 模型训练与推理服务
├── mongoserver/     # MongoDB 配置与初始化
├── docker-compose.yml  # 容器编排配置
└── README.md        # 项目说明文档
```

### 本地开发

1. 安装依赖
   ```bash
   # 后端 API 服务
   cd server && npm install
   
   # AI 模型服务
   cd modelserver && pip install -r requirements.txt
   ```

2. 启动服务
   ```bash
   # 启动 MongoDB (开发环境可使用 Docker)
   docker-compose up -d mongoserver
   
   # 启动后端 API
   cd server && npm run dev
   
   # 启动前端 (实时预览)
   cd client && npx live-server --port=8080
   ```

3. AI 模型本地开发
   ```bash
   # 启动 Ollama (需要 GPU 支持)
   ollama serve
   
   # 训练和推理详见 modelserver/README.md
   ```

## AI 陪伴 (Chat-Beta)

系统提供了智能 AI 陪伴功能，基于用户回答的三套问题（A/B/C 套）生成个性化 AI 对话模型，支持关系识别、好感度管理和记忆检索。

### 功能特性
- **双重存储**：答案同步保存到 MongoDB 和本地记忆库
- **关系识别**：自动识别对话者关系（家人/朋友/陌生人）
- **好感度系统**：动态调整好感度（仅对陌生人）
- **角色卡生成**：基于记忆创建个性化角色画像
- **RAG 检索**：向量索引 + 记忆检索
- **Three Modes**：
  - Mode 1 (<30K tokens): 角色卡 + RAG + 基底模型
  - Mode 2 (30-200K tokens): 专属 SFT 微调模型
  - Mode 3 (≥200K tokens): 继续预训练 + SFT

### 使用方法
1. 注册账户并完成 A/B/C 三套问题
2. 生成角色卡（记忆量 ≥ 1,000 token）
3. 与 AI 开始对话

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目采用 MIT 许可证。

## 更新日志

### v1.2.0 (2026-02-25)

#### 新增功能
- 🎛️ **管理面板**: 完整的后台管理系统
  - 仪表板统计与系统状态监控
  - 用户管理（CRUD、状态切换、角色分配）
  - 问卷问题管理（创建、编辑、排序、批量导入）
  - 记忆管理（查看、向量索引重建、导出）
  - 角色与权限管理
  - 邀请码系统
  - 环境变量在线编辑
- 📚 **文档站点**: Docusaurus 文档系统 (端口3003)
- 💬 **AI 对话优化**: LangGraph 工作流重构
  - 记忆压缩与提取
  - 话题分块
  - 主动消息管理

#### 技术改进
- 🏗️ **Docker 端口调整**: Web 端口从 3000 改为 3002，新增文档站点端口 3003
- 🎨 **前端响应式优化**: 移动端适配改进
- 🔧 **系统状态快速检测**: 基于 Docker 容器状态的健康检查

### v1.1.0 (2025-02-05)

#### 新增功能
- ✨ **查看回答功能完全修复**: 解决了协助者回答无法正确显示的问题
- 🔧 **仪表板统计逻辑优化**: "收到回答"现在只统计真正的协助者回答，不包括用户自己的回答
- 📊 **协助关系统计修正**: "协助者"统计现在准确反映协助用户回答的真实人数

#### 技术改进
- 🏗️ **后端API架构优化**: 
  - 修复了`AnswerController.getAnswersFromOthers()`返回数据结构
  - 添加了`questionId`字段到返回的answer对象
  - 创建了专门的`getHelpers()`API获取协助者统计
- 🎨 **前端显示优化**:
  - 更新了仪表板"收到回答"显示，显示基础和情感层次回答分布
  - 修改了"协助者"显示文案，更准确反映功能含义
  - 添加了详细的协助者回答统计信息

#### 问题修复
- 🐛 **修复了查看回答页面**: 协助者的回答现在能够正确显示
- 🐛 **修复了仪表板统计**: 解决了收到回答统计错误的问题
- 🐛 **修复了TypeScript类型错误**: 添加了正确的类型定义

#### 项目清理
- 🧹 **删除了17个多余文件**: 清理了约618K的临时和模板文件
- 📝 **更新了README文档**: 添加了完整的重构历史说明
- 🗃️ **保留了重要数据**: 保护了MongoDB数据、用户文件存储和环境配置

---

## 联系方式

- 项目维护者: AFS Team
- 版本: 1.2.0