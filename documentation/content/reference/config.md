---
sidebar_position: 2
---

# 配置文件

AFS System 使用多个配置文件来管理应用设置、环境变量和服务编排。本文档详细说明各个配置文件的用途和结构。

## Docker Compose 配置

`docker-compose.yml` 是整个系统的容器编排配置文件，定义了所有服务的部署方式。

### 服务概览

```yaml
services:
  docs:              # 文档站点 (Docusaurus)
  web:               # 前端应用 (Next.js)
  server:            # 后端 API (Express)
  chromaserver:      # 向量数据库 (ChromaDB)
  modelserver:       # AI 模型服务 (Ollama)
  mongoserver:       # 主数据库 (MongoDB)
```

### 网络配置

所有服务都连接到 `afs-network` 桥接网络，实现服务间通信：

```yaml
networks:
  afs-network:
    driver: bridge
```

### 服务详细配置

#### 文档站点 (docs)

```yaml
docs:
  build:
    context: ./documentation
    dockerfile: Dockerfile
    target: production
  ports:
    - "3003:80"
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/health"]
```

- **端口**: 3003
- **健康检查**: 每 30 秒检查一次
- **重启策略**: unless-stopped

#### 前端应用 (web)

```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
    target: ${NODE_ENV:-development}
  ports:
    - "3002:3000"
  volumes:
    - ./web/app:/app/app
    - ./web/lib:/app/lib
    - ./web/types:/app/types
    - ./web/components:/app/components
    - ./web/stores:/app/stores
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3001
    - NEXT_PUBLIC_DOCS_URL=http://localhost:3003
    - NODE_ENV=${NODE_ENV:-development}
```

- **端口**: 3002
- **挂载卷**: 开发热重载支持
- **依赖**: server, docs

#### 后端服务 (server)

```yaml
server:
  build:
    context: ./server
    dockerfile: Dockerfile-server
  ports:
    - "3001:3000"
  volumes:
    - ./server:/app
    - /app/node_modules
    - ./server/storage:/app/storage
  depends_on:
    - mongoserver
    - modelserver
    - chromaserver
  env_file:
    - .env
```

- **端口**: 3001
- **挂载卷**: 代码热重载 + 存储持久化
- **环境变量**: 从 .env 文件加载

#### AI 模型服务 (modelserver)

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

- **端口**: 8000（外部）-> 11434（内部）
- **GPU 支持**: NVIDIA GPU 加速
- **模型存储**: 持久化到本地卷

#### MongoDB 服务 (mongoserver)

```yaml
mongoserver:
  build:
    context: ./mongoserver
    dockerfile: Dockerfile-mongoserver
  ports:
    - "27018:27017"
  volumes:
    - ./mongoserver/mongodb_data:/data/db
    - ./mongoserver/init:/docker-entrypoint-initdb.d
  environment:
    MONGO_INITDB_DATABASE: afs_db
```

- **端口**: 27018（外部）-> 27017（内部）
- **数据持久化**: mongodb_data 卷
- **初始化**: 支持 init 脚本

#### 向量数据库 (chromaserver)

```yaml
chromaserver:
  image: chromadb/chroma:latest
  ports:
    - "8001:8000"
  volumes:
    - ./server/storage/chroma_db:/chroma/chroma
  environment:
    - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
    - CHROMA_SERVER_HOST=0.0.0.0
```

- **端口**: 8001（外部）-> 8000（内部）
- **CORS**: 允许所有来源
- **数据持久化**: chroma_db 卷

## 前端配置

### Next.js 配置

Next.js 的配置文件位于 `web/next.config.js`（如果存在）：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // 环境变量（客户端可访问）
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  },
};

module.exports = nextConfig;
```

### TypeScript 配置

`web/tsconfig.json` 定义了 TypeScript 编译选项：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Tailwind CSS 配置

`web/tailwind.config.ts` 定义了样式系统：

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // ... 更多颜色定义
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## 后端配置

### Nodemon 配置

开发环境下的热重载配置 `server/nodemon.json`：

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["src/**/*.test.js"],
  "exec": "node src/server.js"
}
```

### 测试配置

`server/vitest.config.js` 用于单元测试：

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## 文档配置

### Docusaurus 配置

`documentation/docusaurus.config.ts` 定义了文档站点的行为：

```typescript
const config = {
  title: 'AFS System',
  tagline: '面向老年人的数字记忆传承系统 - 技术文档',
  url: 'https://afs-system.example.com',
  baseUrl: '/',
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
  },
  // ... 更多配置
};
```

### 侧边栏配置

`documentation/sidebars.ts` 定义了文档导航结构：

```typescript
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/intro',
        'getting-started/project-overview',
        'getting-started/installation',
      ],
    },
    // ... 更多分类
  ],
};
```

## 配置文件位置汇总

| 配置文件 | 位置 | 用途 |
|---------|------|------|
| docker-compose.yml | 项目根目录 | 容器编排 |
| .env | 项目根目录 | 环境变量（需创建） |
| .env.example | 项目根目录 | 环境变量模板 |
| next.config.js | web/ | Next.js 配置 |
| tsconfig.json | web/ | TypeScript 配置 |
| tailwind.config.ts | web/ | Tailwind CSS 配置 |
| nodemon.json | server/ | 开发热重载 |
| vitest.config.js | server/ | 测试配置 |
| docusaurus.config.ts | documentation/ | 文档站点配置 |
| sidebars.ts | documentation/ | 文档导航 |

## 配置最佳实践

1. **环境变量管理**
   - 永远不要提交 `.env` 文件到版本控制
   - 使用 `.env.example` 作为模板
   - 为不同环境（开发、生产）使用不同的配置

2. **端口管理**
   - 开发环境使用标准端口（3000-3003）
   - 生产环境考虑使用反向代理（Nginx）
   - 注意容器内外端口映射差异

3. **卷管理**
   - 重要数据必须使用持久化卷
   - 开发环境可以挂载代码目录实现热重载
   - 生产环境只挂载必要的配置和数据目录

4. **网络配置**
   - 使用自定义网络实现服务间通信
   - 服务间使用服务名而非 localhost
   - 注意 CORS 配置

## 相关文档

- [环境变量详细说明](./env.md)
- [技术栈](./tech-stack.md)
- [部署指南](../deployment/docker.md)
