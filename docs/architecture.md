# AFS System 重构架构文档

## 项目概述

传家之宝（AFS System）是一个面向老年人的数字记忆传承系统，采用现代化的前后端分离架构。

## 技术栈

- **前端**: HTML5 + Bootstrap 5 + Vanilla JS
- **后端**: Node.js + Express.js
- **数据库**: MongoDB
- **部署**: Docker + Docker Compose

## 新架构设计

### 后端架构 - Controller-Service-Repository 三层架构

```
server/src/
├── controllers/        # 控制器层 - 处理HTTP请求和响应
│   ├── AuthController.js
│   ├── AnswerController.js
│   └── AssistController.js
├── services/          # 服务层 - 业务逻辑
│   ├── AuthService.js
│   ├── AnswerService.js
│   ├── QuestionService.js
│   ├── AssistService.js
│   ├── dualStorage.js      # 双重存储服务
│   ├── fileStorage.js      # 文件存储服务
│   └── storageService.js   # 存储服务封装
├── repositories/      # 仓储层 - 数据访问
│   ├── UserRepository.js
│   ├── AnswerRepository.js
│   ├── QuestionRepository.js
│   └── AssistRelationRepository.js
├── models/            # 数据模型
│   ├── User.js
│   ├── Answer.js
│   ├── Question.js
│   └── AssistRelation.js
├── routes/            # 路由层
│   ├── auth/
│   │   ├── index.js
│   │   └── assist.js
│   ├── answers.js
│   └── questions.js
├── middleware/        # 中间件
│   └── auth.js
└── server.js          # 服务器入口
```

### 前端架构

```
client/public/
├── index.html          # 首页
├── login.html          # 登录页
├── register.html       # 注册页
├── profile.html        # 个人档案
├── answer-questions.html  # 回答问题
├── assist.html         # 协助他人
├── view-answers.html   # 查看答案
└── assets/
    ├── css/
    │   ├── global.css
    │   └── ...
    └── js/
        ├── api.js
        ├── auth-utils.js
        ├── profile.js
        └── ...
```

## 核心功能模块

### 1. 问题收集系统

**功能描述**:
- 为老人创建个性化的数字档案
- 通过回答问题记录人生故事
- 支持多个层次：基础层面、情感及行为层面
- 支持他人协助填写

**API端点**:
- `GET /api/questions` - 获取问题列表
- `GET /api/progress/self` - 获取自己的回答进度
- `POST /api/answer/self` - 保存自己的答案
- `POST /api/answer/assist` - 保存协助答案
- `GET /api/answers/self` - 获取自己的答案
- `GET /api/answers/from-others` - 获取他人为我的回答
- `POST /api/answers/batch-self` - 批量保存自己的答案
- `POST /api/answers/batch-assist` - 批量保存协助答案

### 2. 双重存储系统

**功能描述**:
- 所有数据同时存储在MongoDB和本地文件系统
- 保证数据可靠性和可移植性
- 支持数据备份和迁移

**实现**:
- `storageService.js` - 存储服务封装
- `dualStorage.js` - 双重存储实现
- `fileStorage.js` - 文件存储实现

### 3. 用户认证系统

**功能描述**:
- 用户注册和登录
- 生成唯一的16位专属编号
- JWT令牌认证
- 协助关系管理

**API端点**:
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/assist/verify` - 建立协助关系
- `GET /api/auth/assist/relations` - 获取协助关系列表
- `GET /api/auth/assist/check-incomplete` - 检查未完成的关系
- `POST /api/auth/assist/batch-update-relations` - 批量更新关系

### 4. 协助关系管理

**功能描述**:
- 用户可以协助他人填写档案
- 支持家人和朋友两种关系类型
- 支持具体关系描述（如：夫妻、母子等）

## 数据模型

### User (用户)
```javascript
{
  uniqueCode: String,      // 16位专属编号
  email: String,          // 邮箱
  password: String,        // 密码（加密）
  name: String,           // 姓名
  createdAt: Date,
  lastLogin: Date,
  chatBeta: {
    memoryTokenCount: Number,
    currentMode: String,
    relationships: [Array],
    roleCard: {Object},
    modelStatus: {Object}
  }
}
```

### Question (问题)
```javascript
{
  role: String,            // elder/family/friend
  layer: String,          // basic/emotional
  order: Number,          // 排序
  question: String,       // 问题内容
  placeholder: String,    // 占位符
  type: String,           // text/textarea/voice
  active: Boolean         // 是否激活
}
```

### Answer (答案)
```javascript
{
  userId: ObjectId,       // 回答者
  targetUserId: ObjectId, // 目标用户
  questionId: ObjectId,   // 问题ID
  questionLayer: String,  // 问题层级
  answer: String,         // 答案内容
  isSelfAnswer: Boolean,  // 是否为自己回答
  relationshipType: String, // 关系类型
  createdAt: Date,
  updatedAt: Date
}
```

### AssistRelation (协助关系)
```javascript
{
  assistantId: ObjectId,  // 协助者
  targetId: ObjectId,     // 被协助者
  relationshipType: String, // family/friend
  specificRelation: String, // 具体关系
  friendLevel: String,    // casual/close/intimate
  isActive: Boolean,
  createdAt: Date
}
```

## 已移除的功能

以下功能已从系统中移除，待后续重新开发：

1. **Chat-Beta功能**:
   - AI对话功能
   - 角色卡生成
   - RAG检索
   - 向量索引
   - 对话记忆管理

2. **相关文件**:
   - 所有chatbeta相关的routes、services、前端文件
   - RAG引擎
   - WebSocket实时通信

## 开发指南

### 本地开发

1. **安装依赖**
```bash
cd server && npm install
```

2. **启动MongoDB**
```bash
docker-compose up -d mongoserver
```

3. **启动后端**
```bash
cd server && npm run dev
```

4. **启动前端**
```bash
cd client && npx live-server --port=8080
```

### 代码规范

1. **命名规范**:
   - 文件名使用PascalCase (UserRepository.js)
   - 类名使用PascalCase (UserRepository)
   - 函数名使用camelCase (getUserById)
   - 常量使用UPPER_SNAKE_CASE (JWT_SECRET)

2. **代码组织**:
   - 遵循Controller-Service-Repository分层
   - 每个文件只导出一个类或对象
   - 使用ES6模块语法 (import/export)

3. **错误处理**:
   - 使用try-catch捕获异常
   - 返回统一的错误格式
   - 记录错误日志

### 测试

（待补充）

## 未来规划

1. **前端重构**:
   - 采用React或Vue框架
   - 组件化开发
   - 状态管理
   - 路由管理

2. **测试体系**:
   - 单元测试
   - 集成测试
   - E2E测试

3. **文档完善**:
   - API文档
   - 开发指南
   - 部署文档

4. **性能优化**:
   - 数据库索引优化
   - 缓存机制
   - CDN加速

5. **Chat-Beta重新开发**:
   - 基于新架构重新实现
   - 模块化设计
   - 可扩展性
