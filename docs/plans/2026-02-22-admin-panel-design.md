# AFS-System 后台管理系统设计文档

**创建日期**: 2026-02-22
**状态**: 已批准
**预计开发周期**: 完整开发 + 集成测试

---

## 一、概述

### 1.1 项目背景
为 AFS-System（老年人数字记忆传承系统）开发完整的后台管理系统，用于管理用户、问卷、记忆库、系统配置等。

### 1.2 部署方案
- **方案**: 同端口路由分离 (`/admin/*`)
- **端口**: 与用户端共享 3002 端口
- **前端框架**: Next.js 15 App Router

### 1.3 功能优先级
1. 用户管理
2. 问卷管理
3. 记忆库管理
4. 环境变量配置
5. 角色权限管理
6. 数据统计面板

---

## 二、系统架构

### 2.1 路由架构

```
Next.js 15 App Router (端口 3002)
├── /admin/*                    # 后台管理（新增）
│   ├── /admin/dashboard        # 数据面板
│   ├── /admin/login            # 管理员登录
│   ├── /admin/register         # 管理员注册
│   ├── /admin/users            # 用户管理
│   ├── /admin/questionnaires   # 问卷管理
│   ├── /admin/memories         # 记忆库管理
│   ├── /admin/settings         # 系统设置
│   │   ├── /admin/settings/env # 环境变量
│   │   └── /admin/settings/invite-codes # 邀请码
│   └── /admin/roles            # 角色权限
└── /*                          # 现有用户端（保持不变）
```

### 2.2 API架构

```
后端 API (端口 3001)
├── /api/admin/*                # 后台管理API（新增）
│   ├── /api/admin/users        # 用户管理
│   ├── /api/admin/questionnaires # 问卷管理
│   ├── /api/admin/memories     # 记忆库管理
│   ├── /api/admin/settings     # 系统设置
│   ├── /api/admin/roles        # 角色权限
│   ├── /api/admin/invite-codes # 邀请码管理
│   └── /api/admin/stats        # 统计数据
└── /api/*                      # 现有API（保持不变）
```

---

## 三、认证与授权

### 3.1 管理员注册机制

**独立注册入口**: `/admin/register`

**邀请码机制**（混合模式）:
1. **备用邀请码**: `.env` 中配置 `ADMIN_INVITE_CODE`
2. **动态邀请码**: 现有管理员在后台生成一次性邀请码

```
┌─────────────────┐     ┌─────────────────┐
│  .env 备用码    │     │  动态生成码      │
│  ADMIN_INVITE_  │     │  MongoDB存储    │
│  CODE=xxx       │     │  一次性使用      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  /admin/register    │
         │  验证邀请码          │
         └─────────────────────┘
```

### 3.2 权限控制

- 使用现有 `requirePermission` 中间件
- AdminLayout 组件进行前端路由保护
- 新增权限:
  - `admin:access` - 访问后台
  - `invite-code:create` - 生成邀请码
  - `env:view` / `env:update` - 环境变量管理

---

## 四、功能模块详细设计

### 4.1 用户管理 (`/admin/users`)

**功能列表**:
- 用户列表（分页、搜索、筛选）
- 用户详情查看
- 编辑用户信息
- 分配角色
- 禁用/启用用户
- 删除用户（软删除）

**API端点**:
- `GET /api/admin/users` - 获取用户列表
- `GET /api/admin/users/:id` - 获取用户详情
- `PUT /api/admin/users/:id` - 更新用户
- `PATCH /api/admin/users/:id/toggle-status` - 切换状态
- `DELETE /api/admin/users/:id` - 删除用户

### 4.2 问卷管理 (`/admin/questionnaires`)

**数据结构**:
```
Role (一级分类)
├── elder (老年人)
│   ├── basic (基础层次)
│   └── emotional (情感层次)
├── family (家属)
│   ├── basic
│   └── emotional
└── friend (朋友)
    ├── basic
    └── emotional
```

**功能列表**:
- 按Role+Layer筛选问题
- 新增/编辑/删除问题
- 问题排序（拖拽或上下移动）
- 批量导入/导出

**API端点**:
- `GET /api/admin/questionnaires` - 获取问题列表
- `POST /api/admin/questionnaires` - 创建问题
- `PUT /api/admin/questionnaires/:id` - 更新问题
- `DELETE /api/admin/questionnaires/:id` - 删除问题
- `PUT /api/admin/questionnaires/reorder` - 重新排序
- `POST /api/admin/questionnaires/import` - 批量导入
- `GET /api/admin/questionnaires/export` - 导出

### 4.3 记忆库管理 (`/admin/memories`)

**功能列表**:
- 按用户查看记忆数据
- 查看ChromaDB向量索引状态
- 手动触发重建向量索引
- 导出用户记忆数据
- 查看记忆详情

**API端点**:
- `GET /api/admin/memories/users` - 获取有记忆的用户列表
- `GET /api/admin/memories/users/:userId` - 获取用户记忆详情
- `POST /api/admin/memories/users/:userId/rebuild-index` - 重建索引
- `GET /api/admin/memories/users/:userId/export` - 导出记忆

### 4.4 环境变量配置 (`/admin/settings/env`)

**功能列表**:
- 查看所有环境变量
- 编辑可修改变量
- 敏感变量脱敏显示
- 保存到 `.env` 文件

**安全考虑**:
- 敏感变量只显示 `****`
- 只读变量不可编辑
- 修改需确认

**API端点**:
- `GET /api/admin/settings/env` - 获取环境变量
- `PUT /api/admin/settings/env` - 更新环境变量

**可编辑变量**:
- LLM_BACKEND, OLLAMA_MODEL, OLLAMA_TIMEOUT
- DEEPSEEK_MODEL, LLM_TEMPERATURE, LLM_MAX_RETRIES
- EMBEDDING_BACKEND, EMBEDDING_MODEL

**只读变量**:
- MONGO_URI, JWT_SECRET
- API Keys (DEEPSEEK_API_KEY, OPENAI_API_KEY, etc.)

### 4.5 角色权限管理 (`/admin/roles`)

**功能列表**:
- 角色列表
- 创建/编辑/删除角色
- 权限分配（勾选框）

**API端点**:
- 复用现有 `/api/roles/*` 端点

### 4.6 数据统计面板 (`/admin/dashboard`)

**展示内容**:
- 统计卡片: 总用户数、今日新增、问卷完成率、活跃用户
- 用户增长趋势图（折线图）
- 系统状态: MongoDB、ChromaDB、LLM、Ollama
- 最近活动日志

**API端点**:
- `GET /api/admin/stats/overview` - 概览数据
- `GET /api/admin/stats/users` - 用户统计
- `GET /api/admin/stats/system` - 系统状态
- `GET /api/admin/stats/activities` - 最近活动

### 4.7 邀请码管理 (`/admin/settings/invite-codes`)

**功能列表**:
- 查看所有邀请码
- 生成新邀请码
- 作废邀请码
- 查看使用状态

**API端点**:
- `GET /api/admin/invite-codes` - 获取邀请码列表
- `POST /api/admin/invite-codes` - 生成邀请码
- `DELETE /api/admin/invite-codes/:id` - 作废邀请码

---

## 五、文件结构

### 5.1 前端文件

```
web/app/admin/
├── layout.tsx                 # Admin布局 + 权限检查
├── page.tsx                   # Dashboard首页
├── login/
│   └── page.tsx               # 管理员登录
├── register/
│   └── page.tsx               # 管理员注册（邀请码）
├── users/
│   ├── page.tsx               # 用户列表
│   └── [id]/
│       └── page.tsx           # 用户详情/编辑
├── questionnaires/
│   ├── page.tsx               # 问卷列表
│   └── components/
│       ├── QuestionForm.tsx   # 问题表单
│       └── QuestionList.tsx   # 问题列表
├── memories/
│   └── page.tsx               # 记忆库管理
├── roles/
│   ├── page.tsx               # 角色列表
│   └── components/
│       └── PermissionEditor.tsx # 权限编辑器
└── settings/
    ├── page.tsx               # 设置首页
    ├── env/
    │   └── page.tsx           # 环境变量配置
    └── invite-codes/
        └── page.tsx           # 邀请码管理

web/components/admin/
├── AdminSidebar.tsx           # 侧边栏导航
├── AdminHeader.tsx            # 顶部导航
├── StatsCard.tsx              # 统计卡片
├── DataTable.tsx              # 通用数据表格
└── ConfirmDialog.tsx          # 确认对话框
```

### 5.2 后端文件

```
server/src/modules/admin/
├── route.js                   # 管理API路由
├── controller.js              # 控制器
├── service.js                 # 业务逻辑
├── middleware.js              # 管理员权限中间件
└── models/
    └── inviteCode.js          # 邀请码模型
```

---

## 六、数据库变更

### 6.1 新增集合: InviteCode

```javascript
const inviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usedAt: { type: Date },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
```

### 6.2 新增权限

```javascript
// 新增到 Permission 集合
{ name: 'admin:access', description: '访问后台管理系统' }
{ name: 'invite-code:create', description: '生成管理员邀请码' }
{ name: 'invite-code:view', description: '查看邀请码列表' }
{ name: 'env:view', description: '查看环境变量' }
{ name: 'env:update', description: '修改环境变量' }
{ name: 'questionnaire:create', description: '创建问卷问题' }
{ name: 'questionnaire:update', description: '编辑问卷问题' }
{ name: 'questionnaire:delete', description: '删除问卷问题' }
{ name: 'memory:view-all', description: '查看所有用户记忆' }
{ name: 'memory:manage', description: '管理用户记忆' }
{ name: 'stats:view', description: '查看系统统计' }
```

---

## 七、环境变量变更

### 7.1 新增环境变量

```bash
# .env 新增
ADMIN_INVITE_CODE=your-secure-admin-invite-code
```

---

## 八、测试计划

### 8.1 单元测试
- 邀请码生成/验证逻辑
- 权限中间件
- 环境变量读写

### 8.2 集成测试
- 管理员注册流程
- 用户CRUD操作
- 问卷管理操作
- 记忆库管理操作
- 环境变量配置

### 8.3 E2E测试
- 完整管理流程测试
- 权限边界测试
- 多角色场景测试

---

## 九、交付标准

1. **功能完整**: 所有6个模块功能完整实现
2. **代码质量**: TypeScript类型完整，无ESLint错误
3. **测试通过**: 单元测试 + 集成测试 + E2E测试全部通过
4. **UI一致性**: 符合现有设计风格
5. **文档完善**: API文档和使用说明

---

*文档版本: 1.0*
*最后更新: 2026-02-22*
