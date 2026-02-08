# Phase 2 API文档

## 1. 角色卡管理API

### 1.1 API规范

| 方法 | 路由 | 描述 | 需要认证 | 请求参数 | 响应格式 |
|------|------|------|---------|---------|---------|
| POST | /api/companionship/generate-rolecard | 生成角色卡 | ✅ | userId (可选) | {success, data: {roleCard, progress, currentMode, duration, isExisting}, message} |
| GET | /api/companionship/rolecard | 获取角色卡 | ✅ | userId (可选，路径参数) | {success, data: {roleCard, hasBaseModel, currentMode}} |
| GET | /api/companionship/progress/a-set | 检查A套题进度 | ✅ | userId (可选，路径参数) | {success, data: {total, answered, percentage, canGenerate}} |
| POST | /api/companionship/regenerate-rolecard | 重新生成角色卡 | ✅ | userId (可选) | {success, data: {roleCard, progress, currentMode, duration}, message} |

### 1.2 API流程图

```
角色卡生成流程

客户端请求 → 身份验证 → 权限检查 → 进度检查 → LLM调用 → 双重存储 → 返回结果
```

```
角色卡获取流程

客户端请求 → 身份验证 → 权限检查 → 查询数据库 → 返回结果
```

```
A套题进度检查流程

客户端请求 → 身份验证 → 权限检查 → 查询进度 → 返回结果
```

---

## 2. 对话准则预处理API

### 2.1 API规范

| 方法 | 路由 | 描述 | 需要认证 | 请求参数 | 响应格式 |
|------|------|------|---------|---------|---------|
| POST | /api/companionship/preprocess-guidelines | 预处理所有协助者的对话准则 | ✅ | userId (可选) | {success, data: {total, successful, failed, guidelines, errors, duration}, message} |
| POST | /api/companionship/preprocess-guideline/:assistantId | 预处理单个协助者的对话准则 | ✅ | userId (可选) | {success, data: {guideline, duration}, message} |
| POST | /api/companionship/update-guideline/:assistantId | 更新单个协助者的对话准则 | ✅ | userId (可选) | {success, data: {guideline, duration}, message} |
| GET | /api/companionship/guidelines/:assistantId | 获取单个协助者的对话准则 | ✅ | assistantId (路径参数) | {success, data: {guideline}} |
| GET | /api/companionship/all-guidelines | 获取所有协助者的对话准则 | ✅ | userId (可选) | {success, data: {guidelines, count, hasBaseModel}} |

### 2.2 API流程图

```
批量预处理流程

客户端请求 → 身份验证 → 权限检查 → 获取协助关系 → 循环处理每个协助者 → LLM压缩答案 → LLM生成准则 → 双重存储 → 返回结果
```

```
单个协助者处理流程

客户端请求 → 身份验证 → 权限检查 → 验证关系 → 收集答案 → LLM压缩 → LLM生成准则 → 双重存储 → 返回结果
```

```
增量更新流程

客户端请求 → 身份验证 → 权限检查 → 验证关系 → 重新处理 → 更新存储 → 返回结果
```

---

## 3. 错误处理规范

### 3.1 HTTP状态码

| 状态码 | 说明 | 场景 |
|--------|------|------|
| 200 | 成功 | 请求处理成功 |
| 400 | 请求参数错误 | 缺少必需参数或参数格式错误 |
| 401 | 未认证 | 未提供Token或Token无效 |
| 403 | 权限不足 | 用户没有访问该资源的权限 |
| 404 | 资源不存在 | 角色卡或对话准则不存在 |
| 500 | 服务器内部错误 | 服务器处理请求时发生错误 |

### 3.2 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "errors": null
}
```

### 3.3 常见错误场景

| 场景 | 状态码 | 错误信息 |
|------|--------|---------|
| 未提供Token | 401 | 未登录，请先登录 |
| Token无效 | 401 | 登录已过期，请重新登录 |
| 缺少userId | 400 | 用户ID不能为空 |
| A套题进度不足 | 400 | A套题进度不足（XX%），需要至少80% |
| 角色卡不存在 | 404 | 角色卡不存在 |
| 协助关系不存在 | 404 | 协助关系不存在 |
| 对话准则不存在 | 404 | 对话准则不存在 |
| 目标用户角色卡不存在 | 500 | 目标用户的角色卡不存在，请先生成角色卡 |
| LLM调用失败 | 500 | LLM调用失败: 错误信息 |
| 数据持久化失败 | 500 | 保存数据失败: 错误信息 |

---

## 4. API认证

### 4.1 认证方式

所有API端点都需要JWT认证，通过`Authorization`请求头传递Token。

### 4.2 Token格式

```
Authorization: Bearer {token}
```

### 4.3 Token生成

Token使用用户ID（`_id`）和JWT Secret生成，有效期为1小时。

### 4.4 Token验证

- 验证Token格式和有效性
- 从Token中提取用户ID（`_id`）
- 将用户信息添加到`req.user`对象

---

## 5. API权限

### 5.1 权限配置

| 权限名称 | 描述 |
|---------|------|
| companionship:view | 查看陪伴功能 |
| companionship:create | 创建陪伴功能 |
| companionship:update | 更新陪伴功能 |

### 5.2 权限中间件

使用`requirePermission`中间件验证用户权限。

### 5.3 权限验证流程

```
权限验证流程

API请求 → 身份验证 → 查询用户角色 → 查询角色权限 → 验证权限 → 允许/拒绝访问
```

---

## 6. 请求参数规范

### 6.1 角色卡相关

#### 6.1.1 生成角色卡

**请求体**:
```json
{
  "userId": "用户ID（可选，默认使用Token中的用户ID）"
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "roleCard": {
      "personality": "性格特点",
      "background": "生活背景",
      "interests": ["兴趣1", "兴趣2"],
      "communicationStyle": "沟通风格",
      "values": ["价值观1", "价值观2"],
      "emotionalNeeds": ["情感需求1", "情感需求2"],
      "lifeMilestones": ["里程碑1", "里程碑2"],
      "preferences": ["偏好1", "偏好2"]
    },
    "progress": {
      "total": 20,
      "answered": 20,
      "percentage": 100,
      "canGenerate": true
    },
    "currentMode": "mode1",
    "duration": 15000,
    "isExisting": false
  },
  "message": "角色卡生成成功"
}
```

#### 6.1.2 获取角色卡

**响应体**:
```json
{
  "success": true,
  "data": {
    "roleCard": {
      "personality": "性格特点",
      "background": "生活背景",
      ...
    },
    "hasBaseModel": true,
    "currentMode": "mode1"
  }
}
```

#### 6.1.3 检查A套题进度

**响应体**:
```json
{
  "success": true,
  "data": {
    "total": 20,
    "answered": 16,
    "percentage": 80,
    "canGenerate": true
  }
}
```

#### 6.1.4 重新生成角色卡

**请求体**:
```json
{
  "userId": "用户ID（可选，默认使用Token中的用户ID）"
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "roleCard": { ... },
    "progress": { ... },
    "currentMode": "mode1",
    "duration": 15000
  },
  "message": "角色卡重新生成成功"
}
```

### 6.2 对话准则相关

#### 6.2.1 批量预处理

**请求体**:
```json
{
  "userId": "用户ID（可选，默认使用Token中的用户ID）"
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "guidelines": [
      {
        "assistantId": "协助者ID",
        "assistantName": "协助者名称",
        "conversationGuidelines": "对话准则内容",
        "generatedAt": "2026-02-06T12:00:00Z",
        "isValid": true
      }
    ],
    "errors": [],
    "duration": 25000
  },
  "message": "对话准则预处理完成"
}
```

#### 6.2.2 单个协助者处理

**请求体**:
```json
{
  "userId": "用户ID（可选，默认使用Token中的用户ID）"
}
```

**路径参数**: `assistantId` - 协助者ID

**响应体**:
```json
{
  "success": true,
  "data": {
    "guideline": {
      "assistantId": "协助者ID",
      "assistantName": "协助者名称",
      "assistantUniqueCode": "协助者编码",
      "assistRelationId": "关系ID",
      "relationType": "关系类型",
      "specificRelation": "具体关系",
      "conversationGuidelines": "对话准则内容",
      "compressedAnswers": [
        {
          "questionId": "问题ID",
          "question": "问题内容",
          "originalAnswer": "原始答案",
          "compressed": "压缩答案",
          "questionLayer": "问题层级",
          "compressedAt": "2026-02-06T12:00:00Z"
        }
      ],
      "generatedAt": "2026-02-06T12:00:00Z",
      "updatedAt": "2026-02-06T12:00:00Z",
      "isValid": true
    },
    "duration": 8000
  },
  "message": "对话准则预处理完成"
}
```

#### 6.2.3 单个协助者更新

**请求体**:
```json
{
  "userId": "用户ID（可选，默认使用Token中的用户ID）"
}
```

**路径参数**: `assistantId` - 协助者ID

**响应体**:
```json
{
  "success": true,
  "data": {
    "guideline": { ... },
    "duration": 8000
  },
  "message": "对话准则更新完成"
}
```

#### 6.2.4 获取单个协助者准则

**路径参数**: `assistantId` - 协助者ID

**响应体**:
```json
{
  "success": true,
  "data": {
    "guideline": {
      "assistantId": "协助者ID",
      "assistantName": "协助者名称",
      "conversationGuidelines": "对话准则内容",
      ...
    }
  }
}
```

#### 6.2.5 获取所有协助者准则

**响应体**:
```json
{
  "success": true,
  "data": {
    "guidelines": [
      {
        "assistantId": "协助者ID",
        "assistantName": "协助者名称",
        "conversationGuidelines": "对话准则内容",
        ...
      }
    ],
    "count": 3,
    "hasBaseModel": true
  }
}
```

---

## 7. API版本

**当前版本**: v1.0

**版本历史**:
- v1.0 (2026-02-06): 初始版本，实现所有API端点

---

## 8. API性能指标

### 8.1 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 角色卡生成时间 | < 5s | 包含LLM调用和数据持久化 |
| 对话准则预处理时间 | < 10s | 批量处理所有协助者 |
| 单个协助者处理时间 | < 5s | 单个协助者的完整流程 |
| 并发处理能力 | 10并发 | 10个并发请求无失败 |

### 8.2 实际性能（待测试）

性能测试将在后续Phase补充。

---

**文档版本**: v1.0  
**创建日期**: 2026-02-06  
**作者**: AFS Team  
**最后更新**: 2026-02-06
