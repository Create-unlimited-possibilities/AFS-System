# Project Restructuring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure project for clean organization, unified Docker setup, portable paths, and development conventions.

**Architecture:** Rename docs/ to documentation/, merge two Docker web services into one with environment-based mode switching, delete merged worktrees, organize scattered files into archive.

**Tech Stack:** Docker, Docker Compose, Docusaurus, Git

---

## Task 1: Create Git Backup Tag

**Files:**
- N/A (Git operation only)

**Step 1: Create backup tag**

Run:
```bash
git tag pre-refactor-backup-20260215
```

Expected: Tag created successfully

**Step 2: Verify tag exists**

Run:
```bash
git tag -l "pre-refactor*"
```

Expected: `pre-refactor-backup-20260215`

**Step 3: Push tag to remote (optional)**

Run:
```bash
git push origin pre-refactor-backup-20260215
```

Expected: Tag pushed (or skip if no remote)

---

## Task 2: Stop Docker Containers

**Files:**
- N/A

**Step 1: Stop all running containers**

Run:
```bash
docker compose down
```

Expected: All containers stopped

**Step 2: Verify containers are stopped**

Run:
```bash
docker ps -a --filter "name=afs-system"
```

Expected: All containers show "Exited" or no containers

---

## Task 3: Delete Git Worktrees and Branches

**Files:**
- Delete: `.worktrees/ai-companion-frontend/`
- Delete: `.worktrees/sentiment-analyzer/`

**Step 1: Remove worktree ai-companion-frontend**

Run:
```bash
git worktree remove .worktrees/ai-companion-frontend --force
```

Expected: Worktree removed

**Step 2: Remove worktree sentiment-analyzer**

Run:
```bash
git worktree remove .worktrees/sentiment-analyzer --force
```

Expected: Worktree removed

**Step 3: Delete feature branch ai-companion-frontend**

Run:
```bash
git branch -D feature/ai-companion-frontend
```

Expected: Branch deleted

**Step 4: Delete feature branch sentiment-analyzer**

Run:
```bash
git branch -D feature/sentiment-analyzer
```

Expected: Branch deleted

**Step 5: Remove .worktrees directory**

Run:
```bash
rm -rf .worktrees
```

Expected: Directory removed

**Step 6: Verify cleanup**

Run:
```bash
git worktree list
git branch -a
```

Expected: Only main branch, no worktrees

**Step 7: Commit**

Run:
```bash
git add -A
git commit -m "chore: remove merged worktrees and feature branches"
```

---

## Task 4: Create Unified Dockerfile for Web

**Files:**
- Create: `web/Dockerfile` (new unified file)
- Delete: `web/Dockerfile-web` (after verification)
- Delete: `web/Dockerfile-web-dev` (after verification)

**Step 1: Create unified Dockerfile**

Create `web/Dockerfile`:

```dockerfile
# ============================================
# Development Stage (default)
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=development

EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "run", "dev"]

# ============================================
# Builder Stage (for production)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Step 2: Verify file created**

Run:
```bash
ls -la web/Dockerfile
```

Expected: File exists with content above

---

## Task 5: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (entire file)

**Step 1: Update docker-compose.yml with unified web service**

Replace entire `docker-compose.yml` with:

```yaml
services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      target: ${NODE_ENV:-development}
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:3001
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
      - NODE_ENV=${NODE_ENV:-development}
    depends_on:
      - server
    networks:
      - afs-network
    restart: unless-stopped

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
    environment:
      - PORT=3000
      - MODEL_SERVER_URL=http://modelserver:8000
      - WEATHER_API_KEY=your_api_key_here
      - CHROMA_URL=http://chromaserver:8000
    networks:
      - afs-network
    restart: unless-stopped

  chromaserver:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - ./server/storage/chroma_db:/chroma/chroma
    networks:
      - afs-network
    restart: unless-stopped
    environment:
      - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
      - CHROMA_SERVER_HOST=0.0.0.0

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
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - afs-network
    restart: unless-stopped

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
    networks:
      - afs-network
    restart: unless-stopped

networks:
  afs-network:
    driver: bridge
```

**Step 2: Delete old Dockerfiles**

Run:
```bash
rm web/Dockerfile-web web/Dockerfile-web-dev
```

Expected: Old files deleted

**Step 3: Verify new structure**

Run:
```bash
ls web/Dockerfile*
```

Expected: Only `web/Dockerfile` exists

**Step 4: Commit**

Run:
```bash
git add docker-compose.yml web/Dockerfile web/Dockerfile-web web/Dockerfile-web-dev
git commit -m "refactor: unify Docker web service with environment-based mode switching

- Merge Dockerfile-web and Dockerfile-web-dev into single Dockerfile
- Use multi-stage build with development and production targets
- Remove profiles, use NODE_ENV environment variable instead
- Development mode (default): hot reload enabled
- Production mode: set NODE_ENV=production"
```

---

## Task 6: Create New Documentation Directory Structure

**Files:**
- Create: `documentation/` (rename from docs/)
- Create: `documentation/content/`
- Create: `documentation/archive/`
- Create: `documentation/archive/reports/`
- Create: `documentation/archive/progress/`
- Create: `documentation/archive/deprecated/`

**Step 1: Rename docs to documentation**

Run:
```bash
git mv docs documentation
```

Expected: Directory renamed

**Step 2: Create archive subdirectories**

Run:
```bash
mkdir -p documentation/archive/reports
mkdir -p documentation/archive/progress
mkdir -p documentation/archive/deprecated
```

Expected: Directories created

**Step 3: Create content directory**

Run:
```bash
mkdir -p documentation/content
```

Expected: Directory created

**Step 4: Create .gitkeep files for archive**

Run:
```bash
touch documentation/archive/.gitkeep
touch documentation/archive/reports/.gitkeep
touch documentation/archive/progress/.gitkeep
touch documentation/archive/deprecated/.gitkeep
```

Expected: Placeholder files created

---

## Task 7: Move Documentation Files

**Files:**
- Move: `documentation/docs/*` → `documentation/content/`
- Move: Report files to `documentation/archive/reports/`
- Move: Progress files to `documentation/archive/progress/`

**Step 1: Move main docs to content folder**

Run:
```bash
mv documentation/docs/* documentation/content/
rmdir documentation/docs
```

Expected: docs subdirectory removed, files in content/

**Step 2: Move report files to archive/reports**

Run:
```bash
mv documentation/dual-storage-fix-final-report.md documentation/archive/reports/
mv documentation/root-cause-analysis-report.md documentation/archive/reports/
```

Expected: Report files moved

**Step 3: Move progress files to archive/progress**

Run:
```bash
mv documentation/refactor-progress.md documentation/archive/progress/
mv documentation/refactor-summary.md documentation/archive/progress/
mv documentation/nextjs-progress-report.md documentation/archive/progress/
mv documentation/frontend-migration-check.md documentation/archive/progress/
mv documentation/frontend-migration-complete.md documentation/archive/progress/
```

Expected: Progress files moved

**Step 4: Move deprecated files to archive/deprecated**

Run:
```bash
mv documentation/dual-storage-fix-report.md documentation/archive/deprecated/
mv documentation/dual-storage-fix-report-v2.md documentation/archive/deprecated/
mv documentation/dual-storage-fix-summary.md documentation/archive/deprecated/
mv documentation/dual-storage-summary.md documentation/archive/progress/
```

Expected: Deprecated files moved

**Step 5: Commit**

Run:
```bash
git add -A
git commit -m "refactor: reorganize documentation structure

- Rename docs/ to documentation/
- Create content/ for official documentation
- Create archive/ with reports/, progress/, deprecated/ subdirectories
- Move scattered md files to appropriate locations"
```

---

## Task 8: Move Server Documentation Files

**Files:**
- Move: `server/*.md` → `documentation/content/`

**Step 1: Move server documentation files**

Run:
```bash
mv server/INTEGRATION_TEST.md documentation/content/
mv server/LOCAL_EMBEDDING_IMPLEMENTATION_SUMMARY.md documentation/content/
mv server/MIGRATION_GUIDE.md documentation/content/
mv server/WORKFLOW_ENGINE_README.md documentation/content/
mv server/WORKFLOW_IMPLEMENTATION_SUMMARY.md documentation/content/
mv server/VERIFICATION_REPORT.md documentation/archive/reports/
```

Expected: Server md files moved

**Step 2: Commit**

Run:
```bash
git add -A
git commit -m "refactor: move server documentation to documentation/content"
```

---

## Task 9: Clean Up Root Directory Files

**Files:**
- Delete: `前端报错.txt`
- Move: `TASK_11_SUMMARY.md` → `documentation/archive/progress/`
- Move: `双重储存系统.md` → `documentation/archive/deprecated/`

**Step 1: Delete temporary error log**

Run:
```bash
rm "前端报错.txt"
```

Expected: File deleted

**Step 2: Move task summary to archive**

Run:
```bash
git mv TASK_11_SUMMARY.md documentation/archive/progress/
```

Expected: File moved

**Step 3: Move duplicate doc to deprecated**

Run:
```bash
git mv "双重储存系统.md" documentation/archive/deprecated/
```

Expected: File moved

**Step 4: Commit**

Run:
```bash
git add -A
git commit -m "chore: clean up root directory temporary files

- Delete 前端报错.txt (error log)
- Move TASK_11_SUMMARY.md to archive/progress
- Move 双重储存系统.md to archive/deprecated"
```

---

## Task 10: Fix Absolute Paths in Documentation

**Files:**
- Modify: `documentation/content/*.md` (all files with F:\FPY\AFS-System)

**Step 1: Find files with absolute paths**

Run:
```bash
grep -r "F:\\\\FPY\\\\AFS-System\|F:/FPY/AFS-System" documentation/content/ --include="*.md" -l
```

Expected: List of files to fix

**Step 2: Replace absolute paths with relative placeholders**

For each file found, replace:
- `F:\FPY\AFS-System` or `F:/FPY/AFS-System` with `/path/to/AFS-System` or `${PROJECT_ROOT}`

Files to check (based on earlier grep):
- `documentation/content/project-overview.md`
- `documentation/content/demo-scripts-en.md`
- `documentation/content/demo-preparation.md`
- `documentation/content/dual-storage-architecture.md`
- `documentation/content/data-storage.md`

**Step 3: Verify no absolute paths remain**

Run:
```bash
grep -r "F:\\\\\|F:/" documentation/ --include="*.md" || echo "No absolute paths found"
```

Expected: "No absolute paths found"

**Step 4: Commit**

Run:
```bash
git add -A
git commit -m "fix: replace absolute paths with portable relative paths in documentation"
```

---

## Task 11: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add archive exclusions to .gitignore**

Add to end of `.gitignore`:

```gitignore
# Archive - historical documents (keep structure, ignore contents)
documentation/archive/reports/*
documentation/archive/progress/*
documentation/archive/deprecated/*
!documentation/archive/.gitkeep
!documentation/archive/*/.gitkeep
```

**Step 2: Verify .gitignore updated**

Run:
```bash
tail -10 .gitignore
```

Expected: New archive rules visible

**Step 3: Commit**

Run:
```bash
git add .gitignore
git commit -m "chore: update .gitignore to exclude archive contents"
```

---

## Task 12: Update Docusaurus Configuration

**Files:**
- Modify: `documentation/docusaurus.config.ts`

**Step 1: Update docs path in docusaurus.config.ts**

Find the `docs` section in presets and change `path` to point to `content`:

```typescript
presets: [
  [
    'classic',
    {
      docs: {
        path: 'content',
        sidebarPath: './sidebars.ts',
        // ... rest of config
      },
      // ...
    },
  ],
],
```

**Step 2: Verify configuration**

Run:
```bash
grep -A 5 "docs:" documentation/docusaurus.config.ts
```

Expected: Shows `path: 'content'`

**Step 3: Commit**

Run:
```bash
git add documentation/docusaurus.config.ts
git commit -m "fix: update Docusaurus config to use content/ directory"
```

---

## Task 13: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Create contributing guide**

Create `CONTRIBUTING.md`:

```markdown
# 贡献指南 / Contributing Guide

## 目录结构规范 / Directory Structure Convention

\`\`\`
AFS-System/
├── web/                    # Next.js 前端应用
│   ├── app/                # App Router 页面
│   ├── components/         # React 组件
│   ├── lib/                # API 客户端
│   └── types/              # TypeScript 类型
│
├── server/                 # Express 后端应用
│   ├── src/
│   │   ├── controllers/    # 控制器层
│   │   ├── services/       # 业务逻辑层
│   │   ├── repositories/   # 数据访问层
│   │   ├── models/         # Mongoose 模型
│   │   └── routes/         # API 路由
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
\`\`\`

## 新功能开发流程 / New Feature Development Flow

1. **创建分支**: `git checkout -b feature/your-feature-name`
2. **编写代码**: 遵循现有目录结构
3. **添加文档**: 正式文档放 `documentation/content/`
4. **测试验证**: 确保功能正常
5. **提交代码**: 使用规范的 commit message

## Docker 使用规范 / Docker Usage

### 开发模式（默认，支持热更新）
\`\`\`bash
docker compose up -d
\`\`\`

### 生产模式
\`\`\`bash
NODE_ENV=production docker compose build
NODE_ENV=production docker compose up -d
\`\`\`

### 常用命令
\`\`\`bash
# 查看日志
docker compose logs -f web

# 重建服务
docker compose build web
docker compose up -d web

# 停止所有服务
docker compose down
\`\`\`

## 文档放置规则 / Documentation Rules

| 文档类型 | 位置 |
|---------|------|
| 正式技术文档 | `documentation/content/` |
| 开发计划 | `.opencode/plans/` |
| LangGraph 相关 | `AI陪伴功能/` |
| 历史报告/进度 | `documentation/archive/` (不追踪) |

## Commit Message 规范 / Commit Convention

\`\`\`
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 代码重构
chore: 杂项（构建、配置等）
test: 测试相关
\`\`\`

## 路径规范 / Path Convention

- **禁止使用绝对路径** (如 `F:\FPY\AFS-System`)
- 使用相对路径或环境变量 `${PROJECT_ROOT}`
- 确保 GitHub Clone 后可正常运行
\`\`\`

**Step 2: Commit**

Run:
```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md with development conventions"
```

---

## Task 14: Rebuild and Test Docker

**Files:**
- N/A

**Step 1: Remove old containers and images**

Run:
```bash
docker compose down --rmi local
```

Expected: Old containers and images removed

**Step 2: Rebuild with new configuration**

Run:
```bash
docker compose build
```

Expected: All services build successfully

**Step 3: Start containers**

Run:
```bash
docker compose up -d
```

Expected: All containers start

**Step 4: Verify containers running**

Run:
```bash
docker ps --filter "name=afs-system"
```

Expected: 5 containers running (web, server, chromaserver, modelserver, mongoserver)

**Step 5: Test web frontend**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002
```

Expected: HTTP 200 or redirect

**Step 6: Test backend API**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
```

Expected: HTTP 200 or 404 (if no health endpoint)

---

## Task 15: Final Verification and Summary Commit

**Files:**
- N/A

**Step 1: Verify directory structure**

Run:
```bash
ls -la
```

Expected: Clean root with `documentation/`, `server/`, `web/`, etc.

**Step 2: Verify no worktrees**

Run:
```bash
git worktree list
```

Expected: Only main worktree

**Step 3: Verify branches**

Run:
```bash
git branch -a
```

Expected: Only main branch (and remote main)

**Step 4: Create summary of changes**

Run:
```bash
git log --oneline pre-refactor-backup-20260215..HEAD
```

Expected: List of all refactor commits

**Step 5: Final commit (if any remaining changes)**

Run:
```bash
git status
```

If clean, no action needed. If changes exist:
```bash
git add -A
git commit -m "chore: cleanup after project restructuring"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create Git backup tag | ⬜ |
| 2 | Stop Docker containers | ⬜ |
| 3 | Delete worktrees and branches | ⬜ |
| 4 | Create unified Dockerfile | ⬜ |
| 5 | Update docker-compose.yml | ⬜ |
| 6 | Create documentation directory structure | ⬜ |
| 7 | Move documentation files | ⬜ |
| 8 | Move server documentation files | ⬜ |
| 9 | Clean up root directory | ⬜ |
| 10 | Fix absolute paths | ⬜ |
| 11 | Update .gitignore | ⬜ |
| 12 | Update Docusaurus config | ⬜ |
| 13 | Create CONTRIBUTING.md | ⬜ |
| 14 | Rebuild and test Docker | ⬜ |
| 15 | Final verification | ⬜ |

---

## Rollback

If issues occur, rollback to backup tag:
```bash
git checkout pre-refactor-backup-20260215
```
