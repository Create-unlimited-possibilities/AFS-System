# 项目重构设计方案

**日期**: 2026-02-15
**状态**: 已批准
**目标**: 整理项目结构、统一Docker容器、修复绝对路径、建立开发规范

---

## 1. 备份策略

创建 Git 标签作为回退点：
```bash
git tag pre-refactor-backup-20260215
```

---

## 2. Docker 容器整合

### 变更内容

**当前结构：**
- `Dockerfile-web` - 生产模式（多阶段构建）
- `Dockerfile-web-dev` - 开发模式（单阶段）
- `docker-compose.yml` 中两个服务通过 profiles 区分

**整合后：**
- 单一 `Dockerfile` - 多阶段构建，支持两种模式
- 单一 `web` 服务 - 通过 `NODE_ENV` 环境变量切换

### 使用方式

```bash
# 开发模式（默认，支持热更新）
docker compose up -d

# 生产模式
NODE_ENV=production docker compose build
NODE_ENV=production docker compose up -d
```

---

## 3. Git Worktrees 清理

删除已合并的 worktrees 和分支：

| 分支 | 状态 | 操作 |
|-----|------|------|
| `feature/ai-companion-frontend` | 已合并到 main | 删除 |
| `feature/sentiment-analyzer` | 已合并到 main | 删除 |

---

## 4. 目录结构重组

### 变更前
```
AFS-System/
├── docs/                    ← Docusaurus + 散落文件
├── server/
│   └── *.md (6个散落文件)
├── TASK_11_SUMMARY.md
├── 前端报错.txt
├── 双重储存系统.md
└── ...
```

### 变更后
```
AFS-System/
├── documentation/           ← 重命名自 docs/
│   ├── content/             ← 正式文档
│   ├── archive/             ← 历史归档
│   │   ├── reports/
│   │   ├── progress/
│   │   └── deprecated/
│   └── (Docusaurus 配置)
├── server/                  ← 清理后
├── AI陪伴功能/              ← 保留
├── README.md
└── README.en.md
```

---

## 5. 文件移动清单

| 来源 | 目标 | 文件 |
|-----|------|------|
| `server/` | `documentation/content/` | 6个技术文档 |
| `docs/docs/` | `documentation/content/` | 正式文档 |
| `docs/` | `documentation/archive/reports/` | 最终报告 |
| `docs/` | `documentation/archive/progress/` | 进度记录 |
| `docs/` | `documentation/archive/deprecated/` | 过时文档 |
| 根目录 | 删除 | 前端报错.txt |

---

## 6. 绝对路径修复

修复文档中的硬编码路径 `F:\FPY\AFS-System`，改用相对路径或占位符。

---

## 7. .gitignore 更新

```gitignore
# Archive - historical documents not tracked
documentation/archive/

# Keep structure but ignore contents
!documentation/archive/.gitkeep
```

---

## 8. 开发规范文档

创建 `CONTRIBUTING.md`，包含：
- 目录结构规范
- 新功能开发流程
- Docker 使用规范
- 文档放置规则

---

## 9. 执行顺序

1. 创建 Git 标签备份
2. 删除 worktrees 和分支
3. 重构 Docker 配置
4. 重组目录结构
5. 移动文件到新位置
6. 修复绝对路径
7. 更新 .gitignore
8. 更新 Docusaurus 配置
9. 创建开发规范文档
10. 测试验证

---

## 回滚方案

如需回滚：
```bash
git checkout pre-refactor-backup-20260215
```
