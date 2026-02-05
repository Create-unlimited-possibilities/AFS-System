# AFS 工作流引擎

AFS 工作流引擎是一个基于 Node.js 和 MongoDB 的高可扩展性工作流管理系统，用于管理复杂的业务流程。

## 核心功能

### 1. 工作流定义
- 支持 JSON 格式的工作流定义
- 通过配置文件定义工作流
- 版本管理系统
- 支持草稿、激活、归档状态

### 2. 工作流执行
- **串行执行**：按顺序执行节点
- **并行执行**：同时执行多个分支（支持 all/any/majority 模式）
- **条件分支**：基于条件判断执行不同路径
- **循环执行**：支持计数循环、条件循环和迭代器循环

### 3. 节点系统
提供多种预构建的节点类型：

- **StartNode**（开始节点）：工作流入口
- **EndNode**（结束节点）：工作流出口
- **TaskNode**（任务节点）：执行各种任务（日志、脚本、HTTP 请求等）
- **ConditionNode**（条件节点）：条件判断
- **ParallelNode**（并行节点）：并行执行多个分支
- **LoopNode**（循环节点）：循环执行
- **DelayNode**（延迟节点）：延迟执行
- **HttpNode**（HTTP 节点）：HTTP 请求
- **CustomNode**（自定义节点）：用户自定义节点

### 4. 状态管理
- 实时追踪工作流实例运行状态
- 记录节点执行结果
- 完整的流程历史
- 上下文和变量管理

### 5. 错误处理
- 完善的错误处理机制
- 自动重试（支持指数退避）
- 错误日志记录
- 失败实例重试

### 6. 可视化监控
- 监控仪表板（workflow-monitor.html）
- 实时工作流统计
- 实例执行历史
- 事件日志查看

### 7. 事件系统
工作流生命周期事件：
- **started**：工作流启动
- **paused**：工作流暂停
- **resumed**：工作流恢复
- **completed**：工作流完成
- **failed**：工作流失败
- **cancelled**：工作流取消
- **node_started**：节点启动
- **node_completed**：节点完成
- **node_failed**：节点失败
- **retry**：重试执行

### 8. API 接口
完整的 RESTful API：
- 工作流管理（创建、查询、更新、删除）
- 工作流执行（启动、暂停、恢复、取消）
- 实例管理（查询、详情）
- 事件查询
- 监控统计

### 9. 持久化存储
- MongoDB 存储工作流定义和实例
- 完整的执行历史记录
- 事件日志持久化

## 架构设计

### 分层架构

```
server/src/
├── models/              # 数据模型层
│   ├── Workflow.js
│   ├── WorkflowInstance.js
│   ├── WorkflowEvent.js
│   └── WorkflowNode.js
├── repositories/         # 数据访问层
│   ├── WorkflowRepository.js
│   ├── WorkflowInstanceRepository.js
│   ├── WorkflowEventRepository.js
│   └── WorkflowNodeRepository.js
├── workflow/            # 工作流引擎核心
│   ├── WorkflowEngine.js
│   ├── NodeExecutor.js
│   ├── ExecutorFactory.js
│   └── nodes/          # 节点执行器
│       ├── StartNodeExecutor.js
│       ├── EndNodeExecutor.js
│       ├── TaskNodeExecutor.js
│       ├── ConditionNodeExecutor.js
│       ├── ParallelNodeExecutor.js
│       ├── LoopNodeExecutor.js
│       ├── DelayNodeExecutor.js
│       ├── HttpNodeExecutor.js
│       └── CustomNodeExecutor.js
├── services/           # 业务逻辑层
│   └── WorkflowService.js
├── controllers/        # 控制器层
│   ├── WorkflowController.js
│   ├── WorkflowInstanceController.js
│   ├── WorkflowEventController.js
│   └── WorkflowMonitorController.js
└── routes/             # 路由层
    ├── workflows.js
    ├── workflowInstances.js
    ├── workflowEvents.js
    └── workflowMonitor.js
```

### Controller-Service-Repository 三层架构

- **Controller 层**：处理 HTTP 请求和响应
- **Service 层**：实现业务逻辑
- **Repository 层**：数据访问（MongoDB）

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动 MongoDB

```bash
docker-compose up -d mongoserver
```

### 3. 启动后端服务

```bash
npm run dev
```

### 4. 访问监控仪表板

在浏览器中打开：
```
http://localhost:8080/workflow-monitor.html
```

## API 文档

### 工作流管理

#### 创建工作流
```http
POST /api/workflows
Content-Type: application/json

{
  "name": "我的工作流",
  "description": "工作流描述",
  "definition": {
    "nodes": [...],
    "connections": [...]
  },
  "format": "json"
}
```

#### 获取所有工作流
```http
GET /api/workflows?page=1&limit=20&status=active
```

#### 获取单个工作流
```http
GET /api/workflows/:id
```

#### 更新工作流
```http
PUT /api/workflows/:id
Content-Type: application/json

{
  "name": "更新的工作流",
  "definition": {...}
}
```

#### 激活工作流
```http
POST /api/workflows/:id/activate
```

#### 归档工作流
```http
POST /api/workflows/:id/archive
```

#### 删除工作流
```http
DELETE /api/workflows/:id
```

### 工作流执行

#### 执行工作流
```http
POST /api/workflows/:id/execute
Content-Type: application/json

{
  "input": {
    "key": "value"
  }
}
```

### 实例管理

#### 获取实例详情
```http
GET /api/workflow-instances/:instanceId
```

#### 暂停实例
```http
POST /api/workflow-instances/:instanceId/pause
```

#### 恢复实例
```http
POST /api/workflow-instances/:instanceId/resume
```

#### 取消实例
```http
POST /api/workflow-instances/:instanceId/cancel
```

#### 重试实例
```http
POST /api/workflow-instances/:instanceId/retry
```

#### 获取实例事件
```http
GET /api/workflow-instances/:instanceId/events
```

### 监控

#### 获取统计数据
```http
GET /api/workflow-monitor/stats
```

#### 获取最近事件
```http
GET /api/workflow-events/recent?limit=50
```

## 工作流定义示例

### 简单串行工作流

```json
{
  "name": "简单问候工作流",
  "version": "1.0.0",
  "nodes": [
    {
      "nodeId": "start",
      "nodeType": "start",
      "name": "开始"
    },
    {
      "nodeId": "log_hello",
      "nodeType": "task",
      "name": "输出问候",
      "config": {
        "action": "log",
        "message": "欢迎使用 AFS 工作流引擎！"
      }
    },
    {
      "nodeId": "end",
      "nodeType": "end",
      "name": "结束"
    }
  ],
  "connections": [
    {
      "source": "start",
      "target": "log_hello"
    },
    {
      "source": "log_hello",
      "target": "end"
    }
  ]
}
```

### 条件分支工作流

```json
{
  "name": "条件分支工作流",
  "nodes": [
    {
      "nodeId": "check_input",
      "nodeType": "condition",
      "name": "检查输入",
      "config": {
        "condition": "input.value > 10",
        "branches": {
          "true": "process_high",
          "false": "process_low"
        }
      }
    },
    {
      "nodeId": "process_high",
      "nodeType": "task",
      "name": "处理高值"
    },
    {
      "nodeId": "process_low",
      "nodeType": "task",
      "name": "处理低值"
    }
  ]
}
```

### 并行工作流

```json
{
  "name": "并行任务工作流",
  "nodes": [
    {
      "nodeId": "parallel_tasks",
      "nodeType": "parallel",
      "name": "并行任务",
      "config": {
        "mode": "all",
        "branches": [
          {
            "name": "task_a",
            "nodes": [
              {
                "nodeId": "parallel_task_a",
                "nodeType": "task",
                "name": "并行任务A"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### HTTP 请求工作流

```json
{
  "name": "HTTP 请求工作流",
  "nodes": [
    {
      "nodeId": "fetch_user",
      "nodeType": "http",
      "name": "获取用户信息",
      "config": {
        "method": "GET",
        "url": "https://api.example.com/users/{{input.userId}}",
        "timeout": 5000
      }
    }
  ]
}
```

## 节点配置说明

### StartNode（开始节点）
无需配置，工作流的入口节点。

### EndNode（结束节点）
无需配置，工作流的出口节点。

### TaskNode（任务节点）
```json
{
  "action": "log|script|sleep",
  "message": "日志消息",
  "script": "return { result: 'value' }",
  "duration": 1000
}
```

**支持的 action：**
- `log`：输出日志
- `script`：执行 JavaScript 脚本
- `sleep`：延迟执行

### ConditionNode（条件节点）
```json
{
  "condition": "input.value > 10",
  "branches": {
    "true": "node_id_true",
    "false": "node_id_false"
  }
}
```

### ParallelNode（并行节点）
```json
{
  "mode": "all|any|majority",
  "branches": [
    {
      "name": "branch_name",
      "nodes": [...]
    }
  ]
}
```

**mode 说明：**
- `all`：所有分支必须成功
- `any`：任一分支成功即可
- `majority`：多数分支成功

### LoopNode（循环节点）
```json
{
  "mode": "count|condition|iterator",
  "count": 3,
  "condition": "value < 10",
  "variableName": "item",
  "items": [1, 2, 3],
  "nodes": [...]
}
```

**mode 说明：**
- `count`：计数循环
- `condition`：条件循环
- `iterator`：迭代器循环

### DelayNode（延迟节点）
```json
{
  "duration": 1000
}
```

### HttpNode（HTTP 节点）
```json
{
  "method": "GET|POST|PUT|DELETE",
  "url": "https://api.example.com/endpoint",
  "headers": {
    "Authorization": "Bearer token"
  },
  "body": {},
  "timeout": 30000
}
```

### CustomNode（自定义节点）
```json
{
  "handler": "function(config) { return { result: 'custom' } }"
}
```

## 扩展自定义节点

### 1. 创建节点执行器

```javascript
import { NodeExecutor } from './NodeExecutor.js';

export class MyCustomNodeExecutor extends NodeExecutor {
  async execute() {
    this.logger?.(`Executing custom node: ${this.node.nodeId}`);
    
    const config = this.node.config || {};
    
    const result = await this.performCustomTask(config);
    
    return {
      status: 'success',
      output: result
    };
  }
  
  async performCustomTask(config) {
    return { message: 'Custom task completed' };
  }
}
```

### 2. 注册节点类型

```javascript
import { registerExecutor } from './ExecutorFactory.js';
import { MyCustomNodeExecutor } from './nodes/MyCustomNodeExecutor.js';

registerExecutor('mycustom', MyCustomNodeExecutor);
```

### 3. 在工作流中使用

```json
{
  "nodeId": "my_custom_node",
  "nodeType": "mycustom",
  "name": "我的自定义节点",
  "config": {
    "customOption": "value"
  }
}
```

## 示例工作流

项目提供了多个示例工作流，位于 `server/src/workflow/examples/` 目录：

- `simple-hello.json` - 简单问候工作流
- `conditional-workflow.json` - 条件分支工作流
- `http-workflow.json` - HTTP 请求工作流
- `loop-workflow.json` - 循环迭代工作流
- `retry-workflow.json` - 重试机制工作流

## 监控仪表板

访问 `http://localhost:8080/workflow-monitor.html` 查看：

- 工作流统计（总数、活跃、草稿等）
- 实例统计（运行中、完成、失败等）
- 成功率计算
- 工作流列表
- 实例历史
- 实时事件日志

## 错误处理与重试

### 重试策略

每个节点可以配置重试策略：

```json
{
  "retryPolicy": {
    "maxRetries": 3,
    "retryDelay": 1000,
    "backoffMultiplier": 2
  }
}
```

**参数说明：**
- `maxRetries`：最大重试次数
- `retryDelay`：初始重试延迟（毫秒）
- `backoffMultiplier`：退避乘数（指数退避）

### 错误处理

- 节点执行失败会记录到执行历史
- 可以通过 API 查看失败实例并重试
- 事件系统会记录所有失败事件

## 性能优化

### 数据库索引

已为以下字段创建索引：
- Workflow: name+version, createdBy, status
- WorkflowInstance: workflowId, status, startedBy
- WorkflowEvent: instanceId, eventType, timestamp

### 分页查询

所有列表查询都支持分页：
```javascript
{
  page: 1,
  limit: 20
}
```

## 安全性

- 所有工作流 API 都需要认证（JWT）
- 支持用户级别权限控制
- 工作流定义验证
- 脚本执行沙箱（待实现）

## 未来规划

- [ ] 可视化工作流编辑器
- [ ] 工作流模板市场
- [ ] 定时任务调度
- [ ] WebSocket 实时推送
- [ ] 工作流导入/导出（YAML）
- [ ] 更多预构建节点
- [ ] 工作流版本回滚
- [ ] 分布式执行支持
- [ ] 性能监控和告警

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
