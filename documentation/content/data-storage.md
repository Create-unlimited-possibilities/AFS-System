---
id: data-storage
title: 数据存储说明
sidebar_label: 数据存储说明
slug: /data-storage
---

# 数据存储位置说明

## 概述

本项目采用**双重存储架构**：
- **MongoDB**: 存储用户、问题、答案等结构化数据
- **文件系统**: 存储记忆JSON文件，用于RAG检索和角色卡生成

## 📂 正确的目录结构

```
${PROJECT_ROOT}/
├── server/
│   ├── src/                    # 源代码
│   ├── storage/                 # 文件系统记忆数据
│   │   └── userdata/
│   │       ├── {userId}/
│   │       │   ├── A_set/     # 自己回答的问题
│   │       │   ├── B_sets/    # 家人协助回答
│   │       │   └── C_sets/    # 朋友协助回答
│   ├── migrate-to-new-storage.js
│   ├── package.json
│   └── .env                    # 环境配置（不提交git）
│
├── mongoserver/
│   ├── init/                    # MongoDB初始化脚本
│   ├── mongodb_data/            # MongoDB数据文件
│   │   ├── *.wt                # WiredTiger数据文件
│   │   ├── collection-*.wt      # 集合数据
│   │   ├── journal/            # 日志文件
│   │   └── .mongodb/           # MongoDB配置
│   ├── Dockerfile-mongoserver
│   └── mongod.conf
│
├── modelserver/
│   └── models/                  # Ollama模型文件
│
├── client/
│   └── public/
│
├── docker-compose.yml
└── .gitignore
```

## 🏗️ 容器职责划分

### server容器
- **职责**: 业务逻辑、API服务
- **数据存储**:
  - 文件系统记忆数据 (server/storage/userdata/)
- **数据访问**:
  - MongoDB（通过网络 `mongodb://mongoserver:27017`）
  - 文件系统（本地卷 `server/storage/`）

### mongoserver容器
- **职责**: 数据库服务
- **数据存储**:
  - MongoDB数据文件 (mongoserver/mongodb_data/)
- **服务提供**:
  - 通过网络端口 `27017:27018` 暴露

### modelserver容器
- **职责**: AI模型服务
- **数据存储**:
  - Ollama模型文件 (modelserver/models/)

### client容器
- **职责**: 前端服务
- **数据存储**:
  - 无（静态文件）

## 📝 Docker 配置

### docker-compose.yml

```yaml
services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile-server
    ports:
      - "3001:3000"
    volumes:
      - ./server/src:/app/src
      - ./server/storage:/app/storage        # 文件系统数据
      - ./server/.env:/app/.env:ro
    depends_on:
      - mongoserver
    env_file:
      - .env
    networks:
      - afs-network

  mongoserver:
    build:
      context: ./mongoserver
      dockerfile: Dockerfile-mongoserver
    ports:
      - "27018:27017"
    volumes:
      - ./mongoserver/mongodb_data:/data/db   # MongoDB数据
      - ./mongoserver/init:/docker-entrypoint-initdb.d
    environment:
      MONGO_INITDB_DATABASE: afs_db
    networks:
      - afs-network

  modelserver:
    build:
      context: ./modelserver
      dockerfile: Dockerfile-modelserver
    ports:
      - "8000:11434"
    volumes:
     - ./modelserver/models:/root/.ollama/models
    environment:
      - OLLAMA_HOST=0.0.0.0
    networks:
      - afs-network

  client:
    build:
      context: ./client
      dockerfile: Dockerfile-client
    ports:
      - "8080:80"
    volumes:
      - ./client/public:/usr/share/nginx/html:ro
    depends_on:
      - server
    networks:
      - afs-network

networks:
  afs-network:
    driver: bridge
```

## 🔄 数据流向

### 写入数据

```
用户填写答案
    ↓
server容器接收
    ↓
┌────────────────────────────────┐
│  StorageService.saveAnswer()   │
└────────┬───────────────────────┘
         │
     ┌────┴────┐
     ↓         ↓
 MongoDB    文件系统
 (网络)      (本地)
     ↓         ↓
mongoserver/ server/
mongodb_data/ storage/
```

### 读取数据

```
前端查看答案
    ↓
server容器接收
    ↓
┌────────────────────────────────┐
│  MongoDB查询（最新数据）        │
└────────────┬───────────────────┘
             │
         ┌────┴────┐
         ↓         ↓
     MongoDB   本地读取
     (网络）    (可选）
         ↓         ↓
    返回数据  降级方案
```

### 批量处理

```
生成角色卡
    ↓
server容器
    ↓
┌────────────────────────────────┐
│  FileStorage.loadUserMemories()  │
└────────────┬───────────────────┘
             │
             ↓
       文件系统读取
       server/storage/
       userdata/{userId}/
             ↓
       批量加载JSON
             ↓
         返回数据
```

## 🎯 数据使用策略

| 场景 | 数据来源 | 访问方式 |
|------|---------|---------|
| **用户填写答案** | MongoDB（同步）+ 文件系统（异步） | server容器 → mongoserver |
| **前端查看答案** | MongoDB（最新数据） | server容器 → mongoserver |
| **生成角色卡** | 文件系统（批量读取） | server容器 → 本地卷 |
| **RAG检索** | ChromaDB向量索引 | server容器 → 本地卷 |
| **降级读取** | MongoDB（文件系统为空时） | server容器 → mongoserver |

## 🔑 关键原则

### 1. 数据归属
- MongoDB数据 → `mongoserver/mongodb_data/`
- 文件系统数据 → `server/storage/userdata/`
- 各容器负责自己的数据

### 2. 访问方式
- MongoDB：通过网络访问 (`mongodb://mongoserver:27017`)
- 文件系统：通过绑定挂载访问 (本地卷)

### 3. 职责清晰
- server容器：业务逻辑 + 文件系统
- mongoserver容器：数据库服务
- modelserver容器：AI模型服务

## 💾 数据管理

### 访问数据

#### MongoDB数据
```bash
# 在容器内访问
docker exec -it afs-system-mongoserver-1 mongosh afs_db

# 从外部访问
mongosh "mongodb://localhost:27018/afs_db"

# 本地文件位置
${PROJECT_ROOT}/mongoserver/mongodb_data/
```

#### 文件系统数据
```bash
# 在容器内访问
docker exec -it afs-system-server-1 sh
cd /app/storage/userdata/

# 本地文件位置
${PROJECT_ROOT}/server/storage/userdata/
```

### 备份数据

#### 备份MongoDB
```bash
# mongodump备份
docker exec afs-system-mongoserver-1 mongodump --db afs_db --out /tmp/backup
docker cp afs-system-mongoserver-1:/tmp/backup ./backup/

# 或直接复制文件
copy mongoserver\mongodb_data\ backup\mongodb_data\
```

#### 备份文件系统
```bash
# 复制整个storage目录
copy server\storage\ backup\storage\
```

## ⚠️ 注意事项

### 1. Git协作
- 数据文件已添加到 `.gitignore`
- 不要提交敏感数据到Git
- 其他人克隆后会创建空目录

### 2. 容器重启
- 数据持久化在本地目录
- 容器重启不会丢失数据

### 3. 跨容器访问
- MongoDB：通过网络端口访问
- 文件系统：每个容器有自己的卷

## 📊 数据统计

### 当前后端数据
- 用户数：13
- 答案记录：270条
- 记忆文件：270个JSON

### 存储空间
- MongoDB数据：约XX MB (`mongoserver/mongodb_data/`）
- 文件系统数据：约XX MB (`server/storage/userdata/`)

---

**最后更新**: 2026-02-03  
**维护者**: 项目团队