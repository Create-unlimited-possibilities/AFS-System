# Admin Backend API

管理员后端API提供完整的用户、问卷、记忆和邀请码管理功能。

## 认证

所有API端点都需要JWT认证和管理员权限。请求头格式：
```
Authorization: Bearer <token>
```

## API端点

### 用户管理 (`/api/admin/users`)

| 方法 | 端点 | 描述 | 查询参数 |
|------|------|------|----------|
| GET | `/api/admin/users` | 获取用户列表 | `page`, `limit`, `search`, `role`, `isActive` |
| GET | `/api/admin/users/:id` | 获取用户详情 | - |
| PUT | `/api/admin/users/:id` | 更新用户 | - |
| DELETE | `/api/admin/users/:id` | 删除用户（级联删除相关数据） | - |

### 问卷管理 (`/api/admin/questionnaires`)

| 方法 | 端点 | 描述 | 查询参数 |
|------|------|------|----------|
| GET | `/api/admin/questionnaires` | 获取问题列表 | `role`, `layer`, `active` |
| GET | `/api/admin/questionnaires/:id` | 获取问题详情 | - |
| POST | `/api/admin/questionnaires` | 创建问题 | - |
| PUT | `/api/admin/questionnaires/:id` | 更新问题 | - |
| DELETE | `/api/admin/questionnaires/:id` | 删除问题（级联删除答案） | - |

### 记忆管理 (`/api/admin/memories`)

| 方法 | 端点 | 描述 | 查询参数 |
|------|------|------|----------|
| GET | `/api/admin/memories` | 获取记忆/答案列表 | `page`, `limit`, `userId`, `search` |
| GET | `/api/admin/memories/stats` | 获取记忆统计 | - |

### 统计数据 (`/api/admin/stats`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/admin/stats` | 获取仪表板统计数据 |

### 邀请码管理 (`/api/admin/invite-codes`)

| 方法 | 端点 | 描述 | 查询参数 |
|------|------|------|----------|
| GET | `/api/admin/invite-codes` | 获取邀请码列表 | `page`, `limit`, `status` |
| POST | `/api/admin/invite-codes` | 创建邀请码 | - |
| DELETE | `/api/admin/invite-codes/:id` | 删除邀请码 | - |

### 环境变量 (`/api/admin/settings/env`)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/admin/settings/env` | 获取环境配置（只读，已脱敏） |

## 数据模型

### 用户对象
```javascript
{
  _id: ObjectId,
  uniqueCode: String,
  email: String,
  name: String,
  role: { _id, name, isAdmin },
  isActive: Boolean,
  profile: { ... },
  stats: {
    answerCount: Number,
    sessionCount: Number,
    relationCount: Number
  },
  createdAt: Date
}
```

### 问题对象
```javascript
{
  _id: ObjectId,
  role: 'elder' | 'family' | 'friend',
  layer: 'basic' | 'emotional',
  order: Number,
  question: String,
  significance: String,
  placeholder: String,
  type: 'text' | 'textarea' | 'voice',
  active: Boolean
}
```

### 邀请码对象
```javascript
{
  _id: ObjectId,
  code: String,
  createdBy: { _id, name, email, uniqueCode },
  usedBy: { _id, name, email, uniqueCode },
  usedAt: Date,
  expiresAt: Date,
  isActive: Boolean,
  maxUses: Number,
  useCount: Number,
  description: String,
  createdAt: Date
}
```

## 初始化

### 创建管理员角色和用户

```bash
# 在服务器目录运行
node server/src/modules/admin/scripts/initAdmin.js <email> <password> <name>
```

或使用环境变量：
```bash
ADMIN_EMAIL=admin@afs-system.com ADMIN_PASSWORD=secure_password node server/src/modules/admin/scripts/initAdmin.js
```

## 文件结构

```
server/src/modules/admin/
├── controller.js       # 控制器层
├── service.js          # 业务逻辑层
├── middleware.js       # 权限中间件
├── route.js           # 路由定义
├── models/            # 数据模型
│   └── inviteCode.js  # 邀请码模型
├── scripts/           # 工具脚本
│   └── initAdmin.js   # 初始化管理员
└── index.js           # 模块导出
```

## 错误响应

所有API返回统一的错误格式：
```javascript
{
  success: false,
  error: "错误描述信息"
}
```

HTTP状态码：
- 200: 成功
- 400: 请求参数错误
- 401: 未认证
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器错误
