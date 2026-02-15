---
sidebar_position: 1
---

# API 概述

## 基础信息

| 项目 | 值 |
|------|-----|
| 基础 URL | `http://localhost:3001/api` |
| 认证方式 | JWT Token (Cookie) |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |

## 认证

所有需要认证的接口都需要在请求中携带 JWT Token：

```http
Cookie: token=<your-jwt-token>
```

或在 Header 中：

```http
Authorization: Bearer <your-jwt-token>
```

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述",
  "error": "ERROR_CODE"
}
```

## API 模块

| 模块 | 路由前缀 | 描述 |
|------|---------|------|
| 认证 | `/api/auth` | 登录、注册、Token 验证 |
| 用户 | `/api/users` | 用户 CRUD、统计 |
| 角色 | `/api/roles` | 角色权限管理 |
| 问题 | `/api/questions` | 问题列表、进度 |
| 回答 | `/api/answers` | 回答保存、查询 |
| 协助 | `/api/auth/assist` | 协助关系管理 |
| 对话 | `/api/chat` | AI 对话会话 |
| 角色卡 | `/api/rolecard` | 角色卡生成、管理 |
| 好感度 | `/api/sentiment` | 好感度追踪 |
| 设置 | `/api/settings` | 系统设置 |

## HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

## 速率限制

- 每个 IP 每分钟最多 100 次请求
- 超出限制返回 429 状态码
