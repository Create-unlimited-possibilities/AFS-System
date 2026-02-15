---
sidebar_position: 1
---

# 安装部署

## 环境要求

| 组件 | 版本要求 |
|------|---------|
| Docker | 20.0+ |
| Docker Compose | 2.0+ |
| Node.js | 20.0+ (开发环境) |
| Git | 任意版本 |

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Create-unlimited-possibilities/AFS-System.git
cd AFS-System
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的参数：

```env
# 服务端口
WEB_PORT=3002
SERVER_PORT=3001

# MongoDB
MONGO_URI=mongodb://mongoserver:27017/afs_db

# JWT 密钥
JWT_SECRET=your-secret-key-here

# Ollama 模型服务
OLLAMA_BASE_URL=http://modelserver:11434
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 验证服务

访问以下地址验证服务是否正常：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3002 |
| 后端 API | http://localhost:3001/api/health |
| Ollama | http://localhost:8000 |

## 服务端口映射

| 服务 | 容器端口 | 主机端口 |
|------|---------|---------|
| web | 3000 | 3002 |
| server | 3000 | 3001 |
| modelserver | 11434 | 8000 |
| chromaserver | 8000 | 8001 |
| mongoserver | 27017 | 27018 |

## 开发环境

### 前端开发

```bash
cd web
npm install
npm run dev
```

### 后端开发

```bash
cd server
npm install
npm run dev
```

### 文档站点

```bash
cd documentation
npm install
npm run start
```

文档站点运行在 http://localhost:3003

## 常见问题

### Docker 构建失败

确保 Docker 有足够的内存（建议 8GB+）：

```bash
# 查看资源使用
docker stats
```

### MongoDB 连接失败

等待 MongoDB 完全启动（约 30 秒），或重启服务：

```bash
docker-compose restart server
```

### Ollama 模型未下载

首次运行需要下载模型：

```bash
docker-compose exec modelserver ollama pull qwen2.5
```
