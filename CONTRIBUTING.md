# 贡献指南 / Contributing Guide

## 目录结构规范 / Directory Structure Convention

```
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
```

## 新功能开发流程 / New Feature Development Flow

1. **创建分支**: `git checkout -b feature/your-feature-name`
2. **编写代码**: 遵循现有目录结构
3. **添加文档**: 正式文档放 `documentation/content/`
4. **测试验证**: 确保功能正常
5. **提交代码**: 使用规范的 commit message

## Docker 使用规范 / Docker Usage

### 开发模式（默认，支持热更新）
```bash
docker compose up -d
```

### 生产模式
```bash
NODE_ENV=production docker compose build
NODE_ENV=production docker compose up -d
```

### 常用命令
```bash
# 查看日志
docker compose logs -f web

# 重建服务
docker compose build web
docker compose up -d web

# 停止所有服务
docker compose down
```

## 文档放置规则 / Documentation Rules

| 文档类型 | 位置 |
|---------|------|
| 正式技术文档 | `documentation/content/` |
| 开发计划 | `.opencode/plans/` |
| LangGraph 相关 | `AI陪伴功能/` |
| 历史报告/进度 | `documentation/archive/` (不追踪) |

## Commit Message 规范 / Commit Convention

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
refactor: 代码重构
chore: 杂项（构建、配置等）
test: 测试相关
```

## 路径规范 / Path Convention

- **禁止使用绝对路径** (如 `F:\FPY\AFS-System`)
- 使用相对路径或环境变量 `${PROJECT_ROOT}`
- 确保 GitHub Clone 后可正常运行
