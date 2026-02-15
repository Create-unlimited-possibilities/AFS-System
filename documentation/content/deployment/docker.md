---
sidebar_position: 1
---

# Docker 部署

## 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                            │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │   web   │  │ server  │  │ model   │  │ chroma  │        │
│  │  :3002  │─▶│  :3001  │─▶│ :8000   │  │ :8001   │        │
│  └─────────┘  └────┬────┘  └─────────┘  └─────────┘        │
│                    │                                         │
│                    ▼                                         │
│              ┌─────────┐                                     │
│              │  mongo  │                                     │
│              │ :27018  │                                     │
│              └─────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## 快速启动

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f server
```

## 服务配置

### Web 服务

```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
  ports:
    - "3002:3000"
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3001
  depends_on:
    - server
  volumes:
    - ./web/app:/app/app
    - ./web/lib:/app/lib
```

### Server 服务

```yaml
server:
  build:
    context: ./server
    dockerfile: Dockerfile-server
  ports:
    - "3001:3000"
  environment:
    - PORT=3000
    - MODEL_SERVER_URL=http://modelserver:8000
    - CHROMA_URL=http://chromaserver:8000
  depends_on:
    - mongoserver
    - modelserver
    - chromaserver
```

### ModelServer 服务

```yaml
modelserver:
  build:
    context: ./modelserver
    dockerfile: Dockerfile-modelserver
  ports:
    - "8000:11434"
  volumes:
    - ./modelserver/models:/root/.ollama/models
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

## 数据持久化

| 服务 | 挂载路径 | 说明 |
|------|---------|------|
| mongoserver | `./mongoserver/mongodb_data:/data/db` | 数据库数据 |
| server | `./server/storage:/app/storage` | 文件存储 |
| modelserver | `./modelserver/models:/root/.ollama/models` | 模型文件 |
| chromaserver | `./server/storage/chroma_db:/chroma/chroma` | 向量数据 |

## 常用命令

```bash
# 重建服务
docker-compose build server

# 重启服务
docker-compose restart server

# 停止所有服务
docker-compose down

# 清理数据（危险！）
docker-compose down -v

# 查看资源使用
docker stats
```

## 生产环境

```bash
# 设置环境变量
export NODE_ENV=production

# 构建生产镜像
docker-compose build

# 启动生产服务
docker-compose up -d
```
