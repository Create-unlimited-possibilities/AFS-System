# Next.js 前端重构方案

## 项目结构选择

### 方案：根目录 Monorepo 风格

**关于容器合并的说明**：
❌ **不会合并容器** - 前后端仍然是独立的服务和容器
✅ **只是代码组织** - 便于统一管理和共享配置

### 推荐的目录结构

```
afs-system/
├── server/                    # 后端服务 (已存在)
│   ├── src/
│   ├── package.json
│   └── Dockerfile-server
├── web/                       # 前端服务 (新建)
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # 认证相关页面组
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (main)/           # 主页面组
│   │   │   ├── dashboard/    # 个人档案
│   │   │   ├── questions/    # 回答问题
│   │   │   ├── assist/       # 协助他人
│   │   │   ├── answers/      # 查看答案
│   │   │   └── layout.tsx
│   │   ├── api/              # Next.js API Routes (如需要)
│   │   ├── layout.tsx        # 根布局
│   │   └── page.tsx          # 首页
│   ├── components/           # React组件
│   │   ├── ui/              # shadcn/ui组件
│   │   ├── forms/           # 表单组件
│   │   ├── layout/          # 布局组件
│   │   └── features/        # 功能组件
│   ├── lib/                 # 工具函数
│   │   ├── api.ts          # API客户端
│   │   ├── auth.ts         # 认证工具
│   │   └── utils.ts        # 通用工具
│   ├── stores/              # Zustand状态管理
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   └── questions.ts
│   ├── types/               # TypeScript类型
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── index.ts
│   ├── hooks/               # 自定义Hooks
│   │   ├── useAuth.ts
│   │   └── useApi.ts
│   ├── public/              # 静态资源
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.mjs
│   └── Dockerfile-web
├── modelserver/             # AI服务 (保留)
├── mongoserver/             # MongoDB (保留)
├── docs/                    # 文档
├── docker-compose.yml       # 容器编排 (更新)
└── README.md
```

### Docker配置更新

**保持容器分离**：

```yaml
services:
  web:                       # 前端容器
    build:
      context: ./web
      dockerfile: Dockerfile-web
    ports:
      - "3000:3000"         # Next.js默认端口
    environment:
      - NEXT_PUBLIC_API_URL=http://server:3001
    depends_on:
      - server

  server:                    # 后端容器
    build:
      context: ./server
      dockerfile: Dockerfile-server
    ports:
      - "3001:3000"
    environment:
      - MONGO_URI=mongodb://mongoserver:27017/afs_db
    depends_on:
      - mongoserver

  mongoserver:               # MongoDB容器
    ...
```

## 技术栈

### 前端技术栈
- **框架**: Next.js 15/16 (App Router)
- **语言**: TypeScript
- **UI组件**: shadcn/ui (基于Radix UI)
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **表单**: React Hook Form + Zod
- **数据获取**: fetch API + Server Actions (混合)
- **路由**: Next.js App Router
- **图标**: Lucide React

### 核心依赖
```json
{
  "next": "^15.0.0",
  "react": "^19.0.0",
  "typescript": "^5.0.0",
  "zustand": "^4.5.0",
  "@radix-ui/react-*": "*",     // shadcn/ui基础
  "tailwindcss": "^3.4.0",
  "react-hook-form": "^7.51.0",
  "zod": "^3.22.0"
}
```

## 迁移策略

### 阶段1：项目初始化
- [ ] 创建Next.js项目
- [ ] 配置TypeScript
- [ ] 安装shadcn/ui
- [ ] 配置Tailwind CSS
- [ ] 创建基础目录结构
- [ ] 配置Zustand stores

### 阶段2：基础设施
- [ ] 创建API客户端 (lib/api.ts)
- [ ] 创建认证工具 (lib/auth.ts)
- [ ] 创建类型定义 (types/)
- [ ] 创建布局组件
- [ ] 配置路由

### 阶段3：组件开发
- [ ] UI组件库 (shadcn/ui组件)
- [ ] 布局组件 (Navbar, Footer等)
- [ ] 表单组件
- [ ] 功能组件

### 阶段4：页面迁移
- [ ] 首页 (/)
- [ ] 登录页 (/login)
- [ ] 注册页 (/register)
- [ ] 个人档案 (/dashboard)
- [ ] 回答问题 (/questions)
- [ ] 协助他人 (/assist)
- [ ] 查看答案 (/answers)

### 阶段5：优化和测试
- [ ] 性能优化
- [ ] 响应式设计
- [ ] 测试编写
- [ ] 错误处理

## 页面路由映射

| 旧页面 (HTML) | 新页面 (Next.js) | 说明 |
|---------------|------------------|------|
| index.html | / | 首页 |
| login.html | /login | 登录页 |
| register.html | /register | 注册页 |
| profile.html | /dashboard | 个人档案 |
| answer-questions.html | /questions | 回答问题 |
| assist.html | /assist | 协助他人 |
| view-answers.html | /answers | 查看答案 |
| settings.html | /dashboard/settings | 设置 |

## API交互方式

### 混合使用策略

**1. Server Actions (用于表单提交)**
```typescript
// app/actions/auth.ts
'use server'

export async function loginAction(formData: FormData) {
  const result = await authService.login(...)
  return result
}
```

**2. 客户端fetch (用于数据查询)**
```typescript
// components/Profile.tsx
const response = await fetch('/api/user/profile', {
  headers: { Authorization: `Bearer ${token}` }
})
```

## 状态管理架构

### Zustand Stores
```typescript
// stores/auth.ts
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (user, token) => set({ user, token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false })
}))
```

## shadcn/ui组件

### 基础组件
- Button, Input, Card, Dialog, Form, Table等
- 完全可定制
- 支持暗黑模式

### 自定义组件
在shadcn/ui基础上构建业务组件
- ProfileCard, QuestionCard, ProgressBar等

## 开发流程

### 本地开发
```bash
# 后端
cd server && npm run dev

# 前端
cd web && npm run dev

# MongoDB (Docker)
docker-compose up -d mongoserver
```

### 构建部署
```bash
# 前端
cd web && npm run build

# 启动所有容器
docker-compose up -d
```

## 注意事项

### ✅ 保持不变
- 后端API端点完全兼容
- 后端数据库结构不变
- 功能逻辑不变

### 🔄 需要调整
- 前端样式重写 (Tailwind CSS)
- 状态管理从localStorage迁移到Zustand
- 表单验证改为React Hook Form + Zod

### 🎯 开发原则
1. **类型安全**: 充分利用TypeScript
2. **组件复用**: 创建可复用的UI组件
3. **代码规范**: 使用ESLint + Prettier
4. **性能优化**: Next.js自动优化 + 手动优化
5. **可测试性**: 编写可测试的组件代码

## 下一步行动

在开始之前，请确认：
1. ✅ 项目结构是否满意？
2. ✅ 技术栈选择是否合适？
3. ✅ 页面路由映射是否正确？
4. ✅ 是否有特殊需求或调整？

确认后，我们将开始创建Next.js项目！
