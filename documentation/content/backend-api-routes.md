# 后端 API 路由完整列表

## 认证相关 (/api/auth)

| 方法 | 路由 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息（需认证）|
| POST | `/api/auth/assist/verify` | 验证并创建协助关系（需认证）|
| GET | `/api/auth/assist/relations` | 获取所有协助关系（需认证）|
| GET | `/api/auth/assist/check-incomplete` | 检查未完成的协助关系（需认证）|
| POST | `/api/auth/assist/batch-update-relations` | 批量更新协助关系（需认证）|

## 回答相关 (/api/answers)

| 方法 | 路由 | 描述 |
|------|------|------|
| GET | `/api/answers/questions` | 获取问题列表（需认证）|
| POST | `/api/answers/answer/self` | 保存自己的回答（需认证）|
| POST | `/api/answers/answer/assist` | 保存协助的回答（需认证）|
| GET | `/api/answers/progress/self` | 获取自己的进度（需认证）|
| GET | `/api/answers/answers/self` | 获取自己的所有回答（需认证）|
| GET | `/api/answers/answers/from-others` | 获取他人的回答（需认证）|
| GET | `/api/answers/answers/contributor/:contributorId` | 获取特定贡献者的回答（需认证）|
| POST | `/api/answers/batch-self` | 批量保存自己的回答（需认证）|
| POST | `/api/answers/batch-assist` | 批量保存协助的回答（需认证）|

## 问题相关 (/api/questions)

| 方法 | 路由 | 描述 |
|------|------|------|
| GET | `/api/questions/progress` | 获取所有层次的进度（需认证）|
| GET | `/api/questions` | 获取某个层次的问题和答案（需认证）|
| POST | `/api/questions/answer` | 保存/更新单条答案（需认证）|

## 音频相关 (/api/audio)

| 方法 | 路由 | 描述 |
|------|------|------|
| POST | `/api/audio/transcribe` | 音频转文字（需认证）|
| POST | `/api/audio/translate` | 音频翻译（需认证）|

## 用户管理 (/api/users)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/users/*` | 用户管理功能 |

## 角色管理 (/api/roles)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/roles/*` | 角色管理功能 |

## 设置相关 (/api/settings)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/settings/*` | 设置功能 |

## 设备管理 (/api/devices)

| 方法 | 路由 | 描述 |
|------|------|------|
| POST | `/api/devices` | 创建设备 |
| GET | `/api/devices` | 获取设备列表 |
| GET | `/api/devices/:id` | 获取单个设备 |
| PUT | `/api/devices/:id` | 更新设备 |
| DELETE | `/api/devices/:id` | 删除设备 |
| POST | `/api/devices/data` | 接收设备数据 |
| GET | `/api/devices/:id/data` | 获取设备数据 |

## 任务管理 (/api/tasks)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/tasks/*` | 任务管理功能 |

## 天气相关 (/api/weather)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/weather/*` | 天气功能 |

## 农作物管理 (/api/crops)

| 方法 | 路由 | 描述 |
|------|------|------|
| POST | `/api/crops` | 创建农作物 |
| GET | `/api/crops` | 获取农作物列表 |
| GET | `/api/crops/attention` | 获取需要关注的农作物 |
| GET | `/api/crops/near-harvest` | 获取即将收获的农作物 |
| GET | `/api/crops/disease` | 获取有病害的农作物 |
| GET | `/api/crops/:id` | 获取单个农作物 |
| PUT | `/api/crops/:id` | 更新农作物 |
| DELETE | `/api/crops/:id` | 删除农作物 |
| POST | `/api/crops/:id/disease-detect` | 病害检测 |
| PUT | `/api/crops/:id/conditions` | 更新生长条件 |
| PATCH | `/api/crops/:id/health` | 更新健康状态 |

## 工作流管理 (/api/workflows)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/workflows/*` | 工作流功能 |

## 工作流实例 (/api/workflowInstances)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/workflowInstances/*` | 工作流实例功能 |

## 工作流事件 (/api/workflowEvents)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/workflowEvents/*` | 工作流事件功能 |

## 工作流监控 (/api/workflowMonitor)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/workflowMonitor/*` | 工作流监控功能 |

## 知识库 (/api/knowledge)

| 方法 | 路由 | 描述 |
|------|------|------|
| (未知) | `/api/knowledge/*` | 知识库功能 |

## AFS 系统核心 API

旧版前端使用的主要 API：
- `/api/auth/login` - 登录
- `/api/auth/register` - 注册
- `/api/auth/me` - 获取当前用户
- `/api/auth/assist/verify` - 创建协助关系
- `/api/auth/assist/relations` - 获取协助关系
- `/api/questions` - 获取问题
- `/api/questions/progress` - 获取进度
- `/api/questions/answer` - 保存答案
- `/api/answers/batch-self` - 批量保存自己的回答
- `/api/answers/batch-assist` - 批量保存协助的回答
- `/api/answers/answers/self` - 获取自己的回答
- `/api/answers/answers/from-others` - 获取他人的回答
- `/api/answers/answers/contributor/:contributorId` - 获取特定贡献者的回答

## 注意事项

1. 部分路由（如 `/api/users/*`, `/api/roles/*` 等）的具体实现未完全列出
2. 需要认证的路由使用 `protect` 中间件
3. 协助关系的创建使用 `/api/auth/assist/verify`（不是 `/api/assist/request`）
4. 问题的实际路由在 `/api/questions`，不是 `/api/answers/questions`
