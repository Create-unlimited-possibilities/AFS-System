---
sidebar_position: 3
---

# 环境变量

AFS System 使用环境变量来配置应用行为。本文档详细说明所有可用的环境变量。

## 快速开始

1. 复制环境变量模板：
   ```bash
   cp .env.example .env
   ```

2. 根据需要修改 `.env` 文件中的值

3. 重启服务使配置生效

## 基础配置

### NODE_ENV

运行环境模式。

- **默认值**: `development`
- **可选值**: `development`, `production`
- **说明**: 影响日志级别、错误处理等行为

```bash
NODE_ENV=development
```

### PORT

后端服务内部端口。

- **默认值**: `3000`
- **说明**: Express 服务监听的端口，容器内部使用

```bash
PORT=3000
```

## MongoDB 配置

### MONGO_URI

MongoDB 连接字符串。

- **默认值**: `mongodb://mongoserver:27017/afs_db`
- **Docker 环境**: 使用服务名 `mongoserver`
- **本地开发**: 使用 `mongodb://localhost:27017/afs_db`
- **生产环境**: 建议使用包含用户名密码的连接字符串

```bash
# Docker 环境
MONGO_URI=mongodb://mongoserver:27017/afs_db

# 本地开发
MONGO_URI=mongodb://localhost:27017/afs_db

# 生产环境（带认证）
MONGO_URI=mongodb://username:password@mongoserver:27017/afs_db?authSource=admin
```

## JWT 配置

### JWT_SECRET

JWT 签名密钥。

- **重要**: 生产环境必须更换为强密码
- **要求**: 至少 32 个字符的随机字符串
- **生成方法**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

```bash
JWT_SECRET=your-jwt-secret-key-change-in-production
```

## 前端配置

以下变量需要以 `NEXT_PUBLIC_` 开头才能在客户端访问：

### NEXT_PUBLIC_API_URL

前端访问后端 API 的地址。

- **默认值**: `http://localhost:3001`
- **Docker 环境**: `http://localhost:3001`（从宿主机访问）
- **说明**: 前端通过此地址调用后端 API

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### NEXT_PUBLIC_DOCS_URL

文档站点地址。

- **默认值**: `http://localhost:3003`
- **说明**: 用于导航到文档页面

```bash
NEXT_PUBLIC_DOCS_URL=http://localhost:3003
```

### NEXT_PUBLIC_GITHUB_URL

GitHub 仓库地址。

- **默认值**: `https://github.com/Create-unlimited-possibilities/AFS-System`
- **说明**: 用于页脚 GitHub 链接

```bash
NEXT_PUBLIC_GITHUB_URL=https://github.com/Create-unlimited-possibilities/AFS-System
```

## LLM 后端配置

### LLM_BACKEND

LLM 后端选择。

- **默认值**: `ollama`
- **可选值**: `ollama`（本地）, `deepseek`（云端 API）
- **说明**: 决定使用哪个 LLM 服务

```bash
LLM_BACKEND=ollama
```

### Ollama 配置

#### OLLAMA_BASE_URL

Ollama 服务地址。

- **默认值**: `http://modelserver:11434`
- **Docker 环境**: 使用服务名 `modelserver`
- **本地开发**: `http://localhost:11434`

```bash
OLLAMA_BASE_URL=http://modelserver:11434
```

#### OLLAMA_MODEL

默认使用的 Ollama 模型。

- **默认值**: `deepseek-r1:14b`
- **可选模型**:
  - `deepseek-r1:14b` - DeepSeek 推理模型（14B 参数）
  - `deepseek-chat:7b` - DeepSeek 对话模型（7B 参数）
  - `qwen2.5:7b` - 通义千问 2.5
  - `llama3.2:3b` - Llama 3.2（轻量级）

```bash
OLLAMA_MODEL=deepseek-r1:14b
```

#### OLLAMA_TIMEOUT

Ollama 健康检查超时时间。

- **默认值**: `30000`（30 秒）
- **单位**: 毫秒
- **说明**: 大型模型加载时间较长，需要适当增加超时时间

```bash
OLLAMA_TIMEOUT=30000
```

### DeepSeek API 配置

#### DEEPSEEK_API_KEY

DeepSeek API 密钥。

- **获取地址**: https://platform.deepseek.com/
- **必需**: 当 `LLM_BACKEND=deepseek` 时

```bash
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

#### DEEPSEEK_BASE_URL

DeepSeek API 基础 URL。

- **默认值**: `https://api.deepseek.com/v1`

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

#### DEEPSEEK_MODEL

DeepSeek 模型选择。

- **默认值**: `deepseek-chat`
- **可选值**:
  - `deepseek-chat` - 通用对话模型
  - `deepseek-reasoner` - 推理增强模型

```bash
DEEPSEEK_MODEL=deepseek-chat
```

## LLM 通用配置

### LLM_TIMEOUT

LLM 请求超时时间。

- **默认值**: `60000`（60 秒）
- **单位**: 毫秒

```bash
LLM_TIMEOUT=60000
```

### LLM_MAX_RETRIES

LLM 请求最大重试次数。

- **默认值**: `3`

```bash
LLM_MAX_RETRIES=3
```

### LLM_TEMPERATURE

LLM 生成温度参数。

- **默认值**: `0.7`
- **范围**: 0.0 - 2.0
- **说明**: 值越低输出越确定性，值越高输出越随机

```bash
LLM_TEMPERATURE=0.7
```

## Embedding 配置

### EMBEDDING_BACKEND

Embedding 后端选择。

- **默认值**: `ollama`
- **可选值**: `ollama`（本地免费）, `openai`（需要 API Key）

```bash
EMBEDDING_BACKEND=ollama
```

### EMBEDDING_MODEL

Embedding 模型。

- **默认值**: `bge-m3`
- **说明**: BGE-M3 是一个多语言嵌入模型

```bash
EMBEDDING_MODEL=bge-m3
```

## ChromaDB 配置

### CHROMA_URL

ChromaDB 服务地址。

- **默认值**: `http://chromaserver:8000`
- **Docker 环境**: 使用服务名 `chromaserver`

```bash
CHROMA_URL=http://chromaserver:8000
```

## 健康检查配置

### HEALTH_CHECK_TIMEOUT_MS

系统状态健康检查超时时间。

- **默认值**: `2000`（2 秒）
- **说明**: 较低的值使管理面板响应更快，但在慢速系统上可能失败

```bash
HEALTH_CHECK_TIMEOUT_MS=2000
```

## 管理员配置

### ADMIN_INVITE_CODE

管理员注册邀请码。

- **默认值**: `your-secure-admin-invite-code-change-this`
- **重要**: 生产环境必须更改
- **用途**: 在 `/admin/register` 注册管理员时使用

```bash
ADMIN_INVITE_CODE=your-secure-admin-invite-code-change-this
```

### ADMIN_EMAIL

默认管理员账户邮箱。

- **默认值**: `admin@afs-system.com`
- **说明**: 首次启动服务器时自动创建
- **重要**: 生产环境必须更改

```bash
ADMIN_EMAIL=admin@afs-system.com
```

### ADMIN_PASSWORD

默认管理员账户密码。

- **默认值**: `admin123456`
- **重要**: 生产环境必须更改为强密码
- **说明**: 首次启动服务器时自动创建

```bash
ADMIN_PASSWORD=admin123456
```

## 可选服务配置

### Google 翻译 API

```bash
GOOGLE_TRANSLATE_API_KEY=your_key_here
```

### OpenAI API（备用）

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

## 环境变量优先级

1. Docker Compose `environment` 字段
2. `.env` 文件
3. 系统环境变量
4. 代码中的默认值

## 安全建议

### 生产环境必做

1. 更换所有默认密钥和密码
2. 使用强密码策略
3. 启用 HTTPS
4. 配置 CORS 白名单
5. 限制 API 访问频率
6. 定期更新依赖

### 密钥生成

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Admin Invite Code
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# 强密码生成
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

## 故障排查

### MongoDB 连接失败

检查 `MONGO_URI` 是否正确：
- Docker 环境使用服务名
- 本地开发使用 localhost
- 确认 MongoDB 容器正在运行

### LLM 无响应

检查 Ollama 配置：
- 确认 `OLLAMA_BASE_URL` 正确
- 增加 `OLLAMA_TIMEOUT` 值
- 检查模型是否已下载

### 前端无法访问 API

检查前端配置：
- 确认 `NEXT_PUBLIC_API_URL` 正确
- 检查后端服务是否运行
- 查看浏览器控制台错误信息

## 相关文档

- [配置文件说明](./config.md)
- [技术栈](./tech-stack.md)
- [Docker 部署](../deployment/docker.md)
