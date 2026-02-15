# 工作流引擎实施总结

## 已完成的功能

### 1. 数据模型层
- `Workflow.js` - 工作流定义模型
- `WorkflowInstance.js` - 工作流实例模型
- `WorkflowEvent.js` - 工作流事件模型
- `WorkflowNode.js` - 工作流节点模型

### 2. 数据访问层
- `WorkflowRepository.js` - 工作流数据访问
- `WorkflowInstanceRepository.js` - 实例数据访问
- `WorkflowEventRepository.js` - 事件数据访问
- `WorkflowNodeRepository.js` - 节点数据访问

### 3. 核心工作流引擎
- `WorkflowEngine.js` - 工作流执行引擎
- `NodeExecutor.js` - 节点执行器基类
- `ExecutorFactory.js` - 执行器工厂

### 4. 节点执行器
- `StartNodeExecutor.js` - 开始节点
- `EndNodeExecutor.js` - 结束节点
- `TaskNodeExecutor.js` - 任务节点（支持日志、脚本、HTTP、延迟）
- `ConditionNodeExecutor.js` - 条件节点
- `ParallelNodeExecutor.js` - 并行节点（支持 all/any/majority 模式）
- `LoopNodeExecutor.js` - 循环节点（支持计数、条件、迭代器）
- `DelayNodeExecutor.js` - 延迟节点
- `HttpNodeExecutor.js` - HTTP 请求节点
- `CustomNodeExecutor.js` - 自定义节点

### 5. 业务逻辑层
- `WorkflowService.js` - 工作流业务逻辑

### 6. 控制器层
- `WorkflowController.js` - 工作流控制器
- `WorkflowInstanceController.js` - 实例控制器
- `WorkflowEventController.js` - 事件控制器
- `WorkflowMonitorController.js` - 监控控制器

### 7. 路由层
- `workflows.js` - 工作流路由
- `workflowInstances.js` - 实例路由
- `workflowEvents.js` - 事件路由
- `workflowMonitor.js` - 监控路由

### 8. 示例工作流
- `simple-hello.json` - 简单问候
- `conditional-workflow.json` - 条件分支
- `http-workflow.json` - HTTP 请求
- `loop-workflow.json` - 循环迭代
- `retry-workflow.json` - 重试机制

### 9. 监控仪表板
- `workflow-monitor.html` - 可视化监控界面

### 10. 文档
- `WORKFLOW_ENGINE_README.md` - 完整文档

## 技术特性

### 核心能力
1. **串行执行** - 按顺序执行节点
2. **并行执行** - 同时执行多个分支（all/any/majority）
3. **条件分支** - 基于条件判断执行不同路径
4. **循环执行** - 支持计数、条件、迭代器循环

### 高级特性
1. **错误处理** - 完善的错误处理机制
2. **自动重试** - 支持指数退避的重试策略
3. **事件系统** - 记录所有工作流生命周期事件
4. **状态管理** - 实时追踪工作流状态
5. **持久化** - MongoDB 存储所有数据

### 可扩展性
1. **自定义节点** - 支持用户自定义节点类型
2. **插件架构** - 通过 ExecutorFactory 注册新节点
3. **变量插值** - 支持 `{{expression}}` 语法

## API 端点

### 工作流管理
- `POST /api/workflows` - 创建工作流
- `GET /api/workflows` - 获取工作流列表
- `GET /api/workflows/:id` - 获取工作流详情
- `PUT /api/workflows/:id` - 更新工作流
- `DELETE /api/workflows/:id` - 删除工作流
- `POST /api/workflows/:id/activate` - 激活工作流
- `POST /api/workflows/:id/archive` - 归档工作流
- `POST /api/workflows/:id/execute` - 执行工作流
- `POST /api/workflows/import` - 导入工作流
- `GET /api/workflows/:id/export` - 导出工作流

### 实例管理
- `GET /api/workflow-instances/:instanceId` - 获取实例详情
- `POST /api/workflow-instances/:instanceId/pause` - 暂停实例
- `POST /api/workflow-instances/:instanceId/resume` - 恢复实例
- `POST /api/workflow-instances/:instanceId/cancel` - 取消实例
- `POST /api/workflow-instances/:instanceId/retry` - 重试实例
- `GET /api/workflow-instances/:instanceId/events` - 获取实例事件

### 监控
- `GET /api/workflow-monitor/stats` - 获取统计数据
- `GET /api/workflow-events/recent` - 获取最近事件

## 目录结构

```
server/src/
├── models/                      # 数据模型
│   ├── Workflow.js
│   ├── WorkflowInstance.js
│   ├── WorkflowEvent.js
│   └── WorkflowNode.js
├── repositories/                 # 数据访问层
│   ├── WorkflowRepository.js
│   ├── WorkflowInstanceRepository.js
│   ├── WorkflowEventRepository.js
│   └── WorkflowNodeRepository.js
├── workflow/                    # 工作流引擎核心
│   ├── WorkflowEngine.js
│   ├── NodeExecutor.js
│   ├── ExecutorFactory.js
│   ├── examples/               # 示例工作流
│   │   ├── simple-hello.json
│   │   ├── conditional-workflow.json
│   │   ├── http-workflow.json
│   │   ├── loop-workflow.json
│   │   └── retry-workflow.json
│   └── nodes/                 # 节点执行器
│       ├── StartNodeExecutor.js
│       ├── EndNodeExecutor.js
│       ├── TaskNodeExecutor.js
│       ├── ConditionNodeExecutor.js
│       ├── ParallelNodeExecutor.js
│       ├── LoopNodeExecutor.js
│       ├── DelayNodeExecutor.js
│       ├── HttpNodeExecutor.js
│       └── CustomNodeExecutor.js
├── services/                   # 业务逻辑层
│   └── WorkflowService.js
├── controllers/                # 控制器层
│   ├── WorkflowController.js
│   ├── WorkflowInstanceController.js
│   ├── WorkflowEventController.js
│   └── WorkflowMonitorController.js
├── routes/                    # 路由层
│   ├── workflows.js
│   ├── workflowInstances.js
│   ├── workflowEvents.js
│   └── workflowMonitor.js
└── server.js                  # 已集成工作流路由

web/
└── workflow-monitor.html       # 监控仪表板
```

## 使用示例

### 1. 创建工作流

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "我的工作流",
    "description": "测试工作流",
    "definition": {...},
    "format": "json"
  }'
```

### 2. 执行工作流

```bash
curl -X POST http://localhost:3000/api/workflows/WORKFLOW_ID/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "input": {
      "value": 100
    }
  }'
```

### 3. 查看实例

```bash
curl http://localhost:3000/api/workflow-instances/INSTANCE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. 查看统计

```bash
curl http://localhost:3000/api/workflow-monitor/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 快速测试

1. 导入示例工作流
```bash
curl -X POST http://localhost:3000/api/workflows/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @server/src/workflow/examples/simple-hello.json
```

2. 激活工作流
```bash
curl -X POST http://localhost:3000/api/workflows/WORKFLOW_ID/activate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. 执行工作流
```bash
curl -X POST http://localhost:3000/api/workflows/WORKFLOW_ID/execute \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. 查看监控
```
打开浏览器访问: http://localhost:8080/workflow-monitor.html
```

## 扩展指南

### 添加自定义节点

1. 创建节点执行器类：

```javascript
import { NodeExecutor } from './NodeExecutor.js';

export class MyCustomNodeExecutor extends NodeExecutor {
  async execute() {
    const config = this.node.config || {};
    const result = await this.performTask(config);
    
    return {
      status: 'success',
      output: result
    };
  }
  
  async performTask(config) {
    return { message: 'Task completed' };
  }
}
```

2. 注册节点类型：

```javascript
import { registerExecutor } from './ExecutorFactory.js';
import { MyCustomNodeExecutor } from './nodes/MyCustomNodeExecutor.js';

registerExecutor('mycustom', MyCustomNodeExecutor);
```

3. 在工作流定义中使用：

```json
{
  "nodeId": "my_node",
  "nodeType": "mycustom",
  "name": "我的自定义节点",
  "config": {
    "customOption": "value"
  }
}
```

## 注意事项

1. 所有工作流 API 都需要 JWT 认证
2. 工作流定义必须包含 start 和 end 节点
3. 节点 nodeId 必须唯一
4. 建议在激活工作流前先在草稿状态测试
5. 并行任务模式：all（全部成功）、any（任一成功）、majority（多数成功）

## 性能建议

1. 使用数据库索引已优化查询性能
2. 分页查询避免返回大量数据
3. 定期清理归档的工作流和实例
4. 监控长时间运行的工作流实例

## 安全建议

1. 脚本执行需要添加沙箱保护
2. 限制 HTTP 请求的目标域名
3. 控制工作流执行的超时时间
4. 审计用户创建的工作流
