# AFS System 文档站点重构设计方案

> 设计日期: 2026-02-24
> 状态: 待批准
> 作者: Claude (Team Lead)

---

## Part 1: 项目概述

### 1.1 背景

当前文档站点存在以下问题：
- 内容混乱，结构不清晰
- 缺少代码级别的详细解释
- UI 设计不够现代化
- 部分模块文档缺失（Admin Panel, Memory System）

### 1.2 目标

重构文档站点为：
- **开发者友好**：面向技术人员，提供代码级文档
- **视觉现代化**：科技风 + 高级感 UI
- **结构清晰**：三级渐进式（架构→功能→代码）
- **国际化支持**：中英双语切换

### 1.3 目标受众

- 全栈开发者
- 前端/后端工程师
- AI/LLM 开发者
- DevOps 工程师

---

## Part 2: UI/UX 设计规范

### 2.1 主题配置

**深色主题 (默认)**
```css
:root[data-theme='dark'] {
  --primary: #6366f1;        /* 靛蓝色 - 主色 */
  --primary-light: #818cf8;
  --secondary: #06b6d4;      /* 青色 - 辅助色 */
  --accent: #8b5cf6;         /* 紫色 - 强调色 */
  --background: #0f172a;     /* 深蓝灰 - 背景 */
  --surface: #1e293b;        /* 卡片背景 */
  --border: #334155;         /* 边框 */
  --text: #f1f5f9;           /* 主文字 */
  --text-muted: #94a3b8;     /* 次要文字 */
  --gradient-start: #6366f1;
  --gradient-end: #8b5cf6;
}
```

**浅色主题**
```css
:root[data-theme='light'] {
  --primary: #4f46e5;
  --primary-light: #6366f1;
  --secondary: #0891b2;
  --accent: #7c3aed;
  --background: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-muted: #64748b;
  --gradient-start: #4f46e5;
  --gradient-end: #7c3aed;
}
```

### 2.2 视觉元素

| 元素 | 规范 |
|------|------|
| **渐变** | 主色到强调色的 135° 线性渐变，用于按钮、标题、边框 |
| **微动画** | 页面切换 200ms ease，悬停效果 150ms，代码块淡入 300ms |
| **阴影** | 多层阴影 (0 4px 6px -1px, 0 2px 4px -2px) 带主题色 |
| **圆角** | 按钮 8px，卡片 12px，代码块 8px |
| **代码风格** | VSCode Dark+ 主题风格，支持语法高亮 |

### 2.3 组件设计

**导航栏**
- 固定顶部，毛玻璃效果
- Logo + 导航菜单 + 语言切换 + 主题切换
- 渐变下边框

**侧边栏**
- 可折叠分类
- 当前页面高亮（渐变左边框）
- 悬停微动画

**代码块**
- VSCode 风格标题栏（文件名 + 语言标签）
- 行号显示
- 一键复制按钮
- 支持代码差异对比 (diff)

**卡片组件**
- 悬停上浮效果
- 渐变边框（透明到主色）
- 图标 + 标题 + 描述

---

## Part 3: 文档结构设计

### 3.1 顶层结构

```
📚 AFS System Documentation
│
├─ 🏠 首页 (Home)
│   └─ Hero + 功能概览 + 快速链接
│
├─ 🚀 Getting Started / 快速入门
│   ├─ Introduction / 项目介绍
│   ├─ Installation / 安装部署
│   └─ Quick Start / 5分钟上手
│
├─ 📖 Core Features / 核心功能
│   ├─ User System / 用户系统
│   ├─ Questionnaire System / 问卷系统
│   ├─ AI Chat System / AI对话系统
│   ├─ Memory System / 记忆系统
│   └─ RoleCard System / 角色卡系统
│
├─ 🔧 Admin Panel / 管理后台
│   ├─ Overview / 功能概览
│   ├─ User Management / 用户管理
│   ├─ Questionnaire Management / 问卷管理
│   ├─ Memory Management / 记忆管理
│   ├─ Role & Permission / 角色权限
│   └─ Dashboard / 仪表盘
│
├─ 📡 API Reference / API参考
│   ├─ REST API
│   ├─ WebSocket
│   └─ Admin API
│
└─ 📚 Reference / 参考资料
    ├─ Tech Stack / 技术栈
    ├─ Configuration / 配置说明
    ├─ Environment Variables / 环境变量
    └─ FAQ / 常见问题
```

### 3.2 单模块文档结构（三级深度）

每个模块文档遵循统一模板：

```markdown
# [模块名称] / [Module Name]

## Overview / 概述
<!-- Level 1: 架构层面 -->
- 模块定位和职责
- 与其他模块的关系图
- 数据流向图

## Architecture / 架构详解
<!-- Level 1: 架构层面 -->
- 目录结构
- 核心文件说明
- 依赖关系

## Features / 功能说明
<!-- Level 2: 功能层面 -->
- 功能列表
- 每个功能的用途
- 使用场景

## Code Deep Dive / 代码详解
<!-- Level 3: 代码层面 -->
- 核心类/函数说明
- 代码片段 + 注释
- 关键实现逻辑

## API / 接口说明
- 暴露的 API 端点
- 参数和返回值
- 调用示例

## Configuration / 配置项
- 相关环境变量
- 配置文件说明
```

---

## Part 4: 团队结构与分工

### 4.1 团队角色

| 角色 ID | 角色名称 | 模型 | 职责 |
|---------|----------|------|------|
| `pm` | Project Manager | Opus | 总协调、任务分配、文档审核、用户沟通 |
| `frontend-doc` | Frontend Doc Writer | Sonnet | web/ 目录所有模块的代码文档 |
| `backend-doc` | Backend Doc Writer | Sonnet | server/src/modules/ 核心模块代码文档 |
| `ai-doc` | AI/LLM Doc Writer | Sonnet | Chat, RoleCard, Memory, LangGraph 相关 |
| `infra-doc` | Infrastructure Doc Writer | Sonnet | Docker, MongoDB, ChromaDB, Config |
| `ui-designer` | UI/UX Designer | Sonnet | 站点视觉设计、CSS、主题、组件 |
| `doc-architect` | Doc Structure Architect | Sonnet | 侧边栏、导航、i18n 配置、规范制定 |

### 4.2 任务分配矩阵

| 文档模块 | 负责人 | 协作人 |
|----------|--------|--------|
| 首页设计 | ui-designer | pm |
| 快速入门 | pm | infra-doc |
| 用户系统 | backend-doc | frontend-doc |
| 问卷系统 | backend-doc | frontend-doc |
| AI对话系统 | ai-doc | backend-doc |
| 记忆系统 | ai-doc | backend-doc |
| 角色卡系统 | ai-doc | - |
| 管理后台 | backend-doc | frontend-doc |
| API 参考 | backend-doc | - |
| 技术栈/配置 | infra-doc | - |
| 侧边栏/导航 | doc-architect | pm |
| i18n 配置 | doc-architect | All |

### 4.3 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                      PM (Team Lead)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 分配任务 │→│ 监控进度 │→│ 审核文档 │→│ 整合发布 │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
   ┌─────────────────────────────────────────────────────┐
   │                   Expert Team                        │
   │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
   │  │ 探索代码  │→│ 编写文档  │→│ 提交审核  │          │
   │  └──────────┘  └──────────┘  └──────────┘          │
   └─────────────────────────────────────────────────────┘
```

---

## Part 5: 模块文档清单

### 5.1 需要编写的文档列表

#### Getting Started (快速入门)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| GS-01 | intro.md | 项目介绍 | Introduction | pm |
| GS-02 | installation.md | 安装部署 | Installation | infra-doc |
| GS-03 | quick-start.md | 5分钟上手 | Quick Start | pm |

#### Core Features - User System (用户系统)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| US-01 | user/overview.md | 用户系统概述 | User System Overview | backend-doc |
| US-02 | user/auth.md | 认证模块 | Authentication Module | backend-doc |
| US-03 | user/profile.md | 用户资料 | User Profile | frontend-doc |
| US-04 | user/assist.md | 协助关系 | Assist Relations | backend-doc |

#### Core Features - Questionnaire System (问卷系统)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| QS-01 | questionnaire/overview.md | 问卷系统概述 | Questionnaire Overview | backend-doc |
| QS-02 | questionnaire/questions.md | 问题管理 | Question Management | backend-doc |
| QS-03 | questionnaire/answers.md | 答案处理 | Answer Processing | backend-doc |
| QS-04 | questionnaire/frontend.md | 前端实现 | Frontend Implementation | frontend-doc |

#### Core Features - AI Chat System (AI对话系统)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| CS-01 | chat/overview.md | 对话系统概述 | Chat System Overview | ai-doc |
| CS-02 | chat/langgraph.md | LangGraph 编排 | LangGraph Orchestration | ai-doc |
| CS-03 | chat/nodes.md | 节点详解 | Node Deep Dive | ai-doc |
| CS-04 | chat/frontend.md | 前端实现 | Frontend Implementation | frontend-doc |

#### Core Features - Memory System (记忆系统)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| MS-01 | memory/overview.md | 记忆系统概述 | Memory System Overview | ai-doc |
| MS-02 | memory/storage.md | 存储架构 | Storage Architecture | ai-doc |
| MS-03 | memory/extraction.md | 记忆提取 | Memory Extraction | ai-doc |
| MS-04 | memory/compression.md | 记忆压缩 | Memory Compression | ai-doc |

#### Core Features - RoleCard System (角色卡系统)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| RC-01 | rolecard/overview.md | 角色卡概述 | RoleCard Overview | ai-doc |
| RC-02 | rolecard/v2-architecture.md | V2架构 | V2 Architecture | ai-doc |
| RC-03 | rolecard/layers.md | 分层系统 | Layer System | ai-doc |
| RC-04 | rolecard/assembler.md | 组装器 | Assembler | ai-doc |

#### Admin Panel (管理后台)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| AP-01 | admin/overview.md | 管理后台概述 | Admin Panel Overview | backend-doc |
| AP-02 | admin/user-management.md | 用户管理 | User Management | backend-doc |
| AP-03 | admin/questionnaire.md | 问卷管理 | Questionnaire Management | backend-doc |
| AP-04 | admin/memory.md | 记忆管理 | Memory Management | backend-doc |
| AP-05 | admin/roles.md | 角色权限 | Roles & Permissions | backend-doc |
| AP-06 | admin/dashboard.md | 仪表盘 | Dashboard | frontend-doc |

#### API Reference (API参考)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| API-01 | api/rest.md | REST API | REST API Reference | backend-doc |
| API-02 | api/websocket.md | WebSocket | WebSocket Reference | backend-doc |
| API-03 | api/admin.md | Admin API | Admin API Reference | backend-doc |

#### Reference (参考资料)
| 文档 ID | 文件名 | 中文标题 | 英文标题 | 负责人 |
|---------|--------|----------|----------|--------|
| REF-01 | reference/tech-stack.md | 技术栈 | Tech Stack | infra-doc |
| REF-02 | reference/config.md | 配置说明 | Configuration | infra-doc |
| REF-03 | reference/env.md | 环境变量 | Environment Variables | infra-doc |
| REF-04 | reference/faq.md | 常见问题 | FAQ | pm |

---

## Part 6: 文档编写规范

### 6.1 文件命名规范

```
content/
├─ getting-started/
│   ├─ intro.md
│   ├─ installation.md
│   └─ quick-start.md
├─ core/
│   ├─ user/
│   │   ├─ overview.md
│   │   ├─ auth.md
│   │   └─ ...
│   ├─ questionnaire/
│   ├─ chat/
│   ├─ memory/
│   └─ rolecard/
├─ admin/
│   ├─ overview.md
│   └─ ...
├─ api/
│   ├─ rest.md
│   └─ ...
└─ reference/
    ├─ tech-stack.md
    └─ ...
```

### 6.2 Markdown 模板

**标准文档模板**：
```markdown
---
id: [module-name]
title: [模块名称 | Module Name]
sidebar_label: [侧边栏显示名]
---

# [模块名称] / [Module Name]

import {ApiEndpoint, CodeBlock, Diagram} from '@site/src/components';

## 概述 / Overview

<!-- 简短描述，1-2段 -->

## 架构 / Architecture

<Diagram src="/img/diagrams/[module]-architecture.svg" />

### 目录结构

```
path/to/module/
├─ file1.js     # 说明
├─ file2.js     # 说明
└─ subdir/
```

## 功能说明 / Features

### 功能 1

描述...

### 功能 2

描述...

## 代码详解 / Code Deep Dive

### 核心类: `ClassName`

<CodeBlock language="typescript" title="path/to/file.ts">

\`\`\`typescript
// 代码示例
export class Example {
  // ...
}
\`\`\`

</CodeBlock>

#### 方法: `methodName`

| 参数 | 类型 | 描述 |
|------|------|------|
| param1 | string | 参数说明 |

#### 实现逻辑

1. 步骤一
2. 步骤二
3. 步骤三

## API / 接口

<ApiEndpoint
  method="POST"
  path="/api/example"
  description="描述"
/>

### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| param | string | Yes | 说明 |

### 响应示例

\`\`\`json
{
  "success": true,
  "data": {}
}
\`\`\`

## 配置 / Configuration

| 环境变量 | 默认值 | 描述 |
|----------|--------|------|
| EXAMPLE_VAR | default | 说明 |

## 相关文档 / Related

- [相关文档1](./related1)
- [相关文档2](./related2)
```

### 6.3 i18n 双语规范

Docusaurus i18n 结构：
```
i18n/
├─ zh-Hans/
│   └─ docusaurus-plugin-content-docs/
│       └─ current/
│           ├─ intro.md
│           └─ ...
└─ en/
    └─ docusaurus-plugin-content-docs/
        └─ current/
            ├─ intro.md
            └─ ...
```

**双语编写流程**：
1. 先编写中文版本 (默认语言)
2. 提交 PM 审核
3. 审核通过后，复制到 `i18n/en/` 目录
4. 翻译为英文版本

### 6.4 代码块规范

- 使用 TypeScript/JavaScript 语法高亮
- 必须包含文件路径标题
- 重要代码行添加行内注释
- 超过 50 行的代码使用折叠

### 6.5 图表规范

- 架构图使用 SVG 格式
- 数据流图使用 Mermaid
- 存放路径: `static/img/diagrams/`

---

## Part 7: 实施计划

### 7.1 阶段划分

| 阶段 | 任务 | 时长 | 产出 |
|------|------|------|------|
| **Phase 1** | UI 设计 + 结构搭建 | - | 主题配置、侧边栏、首页 |
| **Phase 2** | 快速入门 + 核心模块 | - | GS文档 + User + Questionnaire |
| **Phase 3** | AI 模块文档 | - | Chat + Memory + RoleCard |
| **Phase 4** | 管理后台 + API | - | Admin + API 文档 |
| **Phase 5** | 参考资料 + i18n | - | Reference + 英文翻译 |

### 7.2 Phase 1 详细任务

#### UI 设计任务
- [ ] 配置深色/浅色主题 CSS 变量
- [ ] 设计导航栏组件（毛玻璃效果）
- [ ] 设计侧边栏组件（折叠+高亮）
- [ ] 设计代码块组件（VSCode 风格）
- [ ] 设计首页 Hero 区域
- [ ] 添加渐变和微动画效果

#### 结构搭建任务
- [ ] 配置 docusaurus.config.ts
- [ ] 设置 i18n 中英文支持
- [ ] 配置 sidebars.ts 多侧边栏
- [ ] 创建文档目录结构
- [ ] 编写文档规范文件

---

## 附录：审核清单

### 文档审核标准

- [ ] 结构完整（三级深度）
- [ ] 代码示例可运行
- [ ] 中英双语完整
- [ ] 图表清晰易懂
- [ ] 链接有效
- [ ] 格式统一

### 视觉审核标准

- [ ] 深色/浅色切换正常
- [ ] 响应式布局
- [ ] 动画流畅
- [ ] 代码高亮正确
- [ ] 导航清晰

---

> **文档状态**: 待用户批准
> **下一步**: 批准后调用 writing-plans skill 创建详细实施计划
