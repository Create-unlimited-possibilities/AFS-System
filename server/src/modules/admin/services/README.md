# Environment Variable Management Service

环境变量管理服务提供安全的环境变量配置管理功能。

## 功能特性

### 1. 变量分类

**可编辑变量 (Editable)**
- `LLM_BACKEND`: LLM后端选择 (ollama | deepseek)
- `OLLAMA_BASE_URL`: Ollama服务地址
- `OLLAMA_MODEL`: Ollama模型名称
- `DEEPSEEK_BASE_URL`: DeepSeek API地址
- `DEEPSEEK_MODEL`: DeepSeek模型名称 (deepseek-chat | deepseek-reasoner)
- `LLM_TIMEOUT`: LLM请求超时时间 (ms)
- `LLM_MAX_RETRIES`: LLM最大重试次数
- `LLM_TEMPERATURE`: LLM生成温度 (0-2)
- `EMBEDDING_BACKEND`: Embedding后端选择
- `EMBEDDING_MODEL`: Embedding模型名称
- `CHROMA_URL`: ChromaDB服务地址

**只读变量 (Read-only)**
- `MONGO_URI`: MongoDB连接字符串
- `JWT_SECRET`: JWT密钥
- `PORT`: 服务器端口
- `NODE_ENV`: 运行环境

**敏感变量 (Sensitive)**
- `DEEPSEEK_API_KEY`: DeepSeek API密钥
- `OPENAI_API_KEY`: OpenAI API密钥
- `GOOGLE_TRANSLATE_API_KEY`: Google翻译API密钥

### 2. 安全特性

- **自动备份**: 修改前自动创建.env备份
- **数据验证**: 类型检查、范围验证、枚举值验证
- **敏感数据脱敏**: API响应中自动隐藏敏感值
- **备份保留**: 保留最近5个备份文件
- **回滚支持**: 可从任意备份恢复

### 3. API端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/admin/settings/env/full` | 获取所有变量及元数据 |
| PUT | `/api/admin/settings/env` | 批量更新环境变量 |
| POST | `/api/admin/settings/env/validate` | 验证单个变量值 |
| GET | `/api/admin/settings/env/schema` | 获取变量配置schema |
| GET | `/api/admin/settings/env/backups` | 列出所有备份 |
| POST | `/api/admin/settings/env/restore` | 从备份恢复 |

### 4. 使用示例

#### 获取所有环境变量
```bash
GET /api/admin/settings/env/full
Authorization: Bearer <token>

Response:
{
  "success": true,
  "editable": {
    "LLM_BACKEND": {
      "value": "ollama",
      "default": "ollama",
      "description": "LLM后端选择",
      "category": "llm",
      "type": "enum",
      "options": ["ollama", "deepseek"]
    },
    ...
  },
  "readOnly": {
    "MONGO_URI": {
      "value": "mongodb://***:***@mongoserver:27017/afs_db",
      ...
    }
  },
  "sensitive": {
    "DEEPSEEK_API_KEY": {
      "value": "sk--****1234",
      "isSet": true,
      ...
    }
  }
}
```

#### 更新环境变量
```bash
PUT /api/admin/settings/env
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": {
    "LLM_BACKEND": {
      "value": "deepseek"
    },
    "DEEPSEEK_MODEL": {
      "value": "deepseek-chat"
    }
  },
  "backup": true
}

Response:
{
  "success": true,
  "updated": ["LLM_BACKEND", "DEEPSEEK_MODEL"],
  "message": "环境变量已更新，需要重启服务以应用更改"
}
```

#### 验证变量值
```bash
POST /api/admin/settings/env/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "LLM_TEMPERATURE",
  "value": "1.5"
}

Response:
{
  "success": true
}
```

#### 从备份恢复
```bash
GET /api/admin/settings/env/backups
Authorization: Bearer <token>

Response:
{
  "success": true,
  "backups": [
    {
      "filename": ".env.backup.2026-02-22T14:30:00.000Z",
      "path": "/path/to/.env.backup.2026-02-22T14:30:00.000Z",
      "createdAt": "2026-02-22T14:30:00.000Z"
    }
  ]
}

POST /api/admin/settings/env/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "backupPath": "/path/to/.env.backup.2026-02-22T14:30:00.000Z"
}

Response:
{
  "success": true,
  "message": "已从备份恢复"
}
```

## 配置schema

每个变量的配置包含：

```javascript
{
  type: 'enum' | 'number' | 'string' | 'url',
  default: '默认值',
  description: '变量描述',
  category: 'llm' | 'embedding' | 'database' | 'api' | 'security' | 'server',
  values: ['option1', 'option2'],  // for enum type
  min: 0,  // for number type
  max: 2,  // for number type
  step: 0.1  // for number type
}
```

## 错误处理

验证错误响应：
```javascript
{
  "success": false,
  "errors": [
    { "key": "LLM_TEMPERATURE", "error": "最大值为 2" },
    { "key": "LLM_BACKEND", "error": "必须是以下值之一: ollama, deepseek" }
  ]
}
```

## 注意事项

1. **重启服务**: 修改环境变量后需要重启服务才能生效
2. **敏感变量**: 编辑敏感变量需要二次确认
3. **备份管理**: 系统自动保留最近5个备份
4. **文件权限**: 确保.env文件有适当的读写权限
