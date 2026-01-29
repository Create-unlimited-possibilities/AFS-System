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

## 技术架构

本系统采用现代化的前后端分离架构，主要技术栈包括：

- **前端**: HTML5 + Bootstrap 5 + Vanilla JS
- **后端**: Node.js + Express.js
- **AI 服务**: Ollama + Python + LoRA 微调
- **数据库**: MongoDB
- **部署**: Docker + Docker Compose

系统由多个服务模块组成：
- `client`: 用户前端界面
- `server`: 后端 API 服务
- `modelserver`: AI 模型训练与推理服务
- `mongoserver`: MongoDB 数据库服务

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
   - 前端地址: http://localhost:8080
   - API 文档: http://localhost:3001/api-docs
   - Ollama API: http://localhost:11435

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
├── client/          # 前端网页界面
├── server/          # 后端 API 服务
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

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

本项目采用 MIT 许可证。

## 联系方式

- 项目维护者: AFS Team
- 版本: 1.0.0