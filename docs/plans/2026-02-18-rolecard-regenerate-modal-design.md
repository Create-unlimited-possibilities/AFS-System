# 角色卡管理弹窗设计文档

## 概述

设计一个角色卡管理弹窗，允许用户查看各层的生成状态，并支持单独触发每个层的生成。

## 层结构说明

| 层 | 数量 | 存储位置 | 生成方式 |
|---|---|---|---|
| 核心层 | 1 | `/{userId}/core-layer.json` | 从 A 套题提取 |
| 校准层 | 1 | 跟随核心层 | 自动跟随核心层生成 |
| 安全护栏层 | 1 | 全局配置 | 静态加载，不需要生成 |
| 关系层 | N（每个协助者1个） | `/{userId}/relation-layers/{relationId}.json` | 从 B/C 套题提取 |

### 层依赖关系

- **校准层**：自动跟随核心层，不需要单独按钮
- **安全护栏层**：全局静态配置，只显示"已加载"状态
- **关系层**：独立生成，每个协助者单独处理

## 后端 API 设计

### 1. 获取各层状态

```
GET /api/rolecard/layers/status
```

**响应：**
```json
{
  "success": true,
  "data": {
    "coreLayer": {
      "exists": true,
      "generatedAt": "2024-01-15T10:30:00Z"
    },
    "calibrationLayer": {
      "exists": true
    },
    "safetyGuardrails": {
      "loaded": true
    },
    "relations": [
      {
        "relationId": "xxx",
        "assistantId": "yyy",
        "assistantName": "张三",
        "specificRelation": "儿子",
        "relationshipType": "family",
        "status": "insufficient_answers",
        "answerCount": 1
      },
      {
        "relationId": "aaa",
        "assistantId": "bbb",
        "assistantName": "李四",
        "specificRelation": "女儿",
        "relationshipType": "family",
        "status": "not_generated",
        "answerCount": 5
      },
      {
        "relationId": "ccc",
        "assistantId": "ddd",
        "assistantName": "王五",
        "specificRelation": "朋友",
        "relationshipType": "friend",
        "status": "generated",
        "generatedAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**状态说明：**
- `generated`: 已生成
- `not_generated`: 未生成（答案充足，可以生成）
- `insufficient_answers`: 答案不足（< 3）

### 2. 单独生成核心层（SSE）

```
POST /api/rolecard/layers/core/stream
```

**SSE 事件格式：**
```json
{
  "stage": "core_layer_extraction",
  "message": "核心层提取中: 15/35",
  "percentage": 45,
  "detail": {
    "current": 15,
    "total": 35
  }
}
```

### 3. 单独生成某个关系层（SSE）

```
POST /api/rolecard/layers/relation/:relationId/stream
```

### 4. 批量生成未生成的层（SSE）

```
POST /api/rolecard/layers/batch/stream
```

**请求体：**
```json
{
  "layers": ["relation:xxx", "relation:yyy"]
}
```

## 前端组件设计

### 组件结构

```
RoleCardPage
└── RegenerateModal
    ├── ModalHeader ("管理角色卡")
    ├── ModalBody (可滚动区域, max-height: 60vh)
    │   ├── CoreLayerSection
    │   │   ├── 核心层行
    │   │   ├── 校准层行 (显示"自动跟随核心层")
    │   │   └── 安全护栏行 (显示"全局配置")
    │   ├── Divider
    │   ├── RelationPendingSection ("关系层 - 未生成")
    │   │   └── 每个未生成的协助者行
    │   ├── Divider
    │   └── RelationGeneratedSection ("关系层 - 已生成")
    │       └── 每个已生成的协助者行
    ├── ProgressBar (生成时显示)
    └── ModalFooter
        ├── [生成全部未生成的关系层]
        └── [全部重新生成]
```

### 弹窗尺寸

```css
/* 桌面端 */
max-width: 480px;
max-height: 70vh;

/* 手机端 */
max-width: 95vw;
max-height: 80vh;

/* 内容区域 */
overflow-y: auto;
```

### 状态管理

```typescript
interface ModalState {
  layersStatus: LayersStatus | null;
  isLoading: boolean;
  generating: {
    type: 'core' | 'relation' | 'batch' | null;
    targetId?: string;
    progress: number;
    message: string;
  } | null;
}

interface LayersStatus {
  coreLayer: { exists: boolean; generatedAt?: string };
  calibrationLayer: { exists: boolean };
  safetyGuardrails: { loaded: boolean };
  relations: RelationStatus[];
}

interface RelationStatus {
  relationId: string;
  assistantId: string;
  assistantName: string;
  specificRelation: string;
  relationshipType: 'family' | 'friend';
  status: 'generated' | 'not_generated' | 'insufficient_answers';
  answerCount: number;
  generatedAt?: string;
}
```

## 交互流程

### 1. 打开弹窗

1. 用户点击"管理角色卡"按钮（原"重新生成"按钮）
2. 弹窗打开，显示 loading 状态
3. 调用 `GET /api/rolecard/layers/status`
4. 渲染各层状态列表

### 2. 单独生成某层

1. 用户点击"生成"或"重新生成"按钮
2. 按钮变为 disabled，底部显示进度条
3. 建立 SSE 连接
4. 实时更新进度
5. 完成后刷新状态

### 3. 批量生成

1. 用户点击"生成全部未生成的关系层"
2. 建立 SSE 连接
3. 显示整体进度
4. 完成后刷新状态

### 4. 答案不足处理

- 状态显示"答案不足 (N/3)"
- 按钮显示为 [--]，不可点击

## 样式规范

### 状态标签

| 状态 | 文字 | 样式 |
|---|---|---|
| 已生成 | `已生成` | `bg-green-100 text-green-700` |
| 已加载 | `已加载` | `bg-blue-100 text-blue-700` |
| 待生成 | `待生成` | `bg-gray-100 text-gray-600` |
| 答案不足 | `答案不足 (N/3)` | `bg-orange-100 text-orange-700` |

### 按钮

| 类型 | 样式 |
|---|---|
| 生成 | 橙色渐变 `bg-gradient-to-r from-orange-500 to-orange-600` |
| 重新生成 | 轮廓 `border border-gray-300` |
| 禁用 | 灰色 `bg-gray-100 text-gray-400 cursor-not-allowed` |

### 进度条

- 颜色：`bg-orange-500`
- 背景：`bg-gray-200`
- 高度：`h-2`
- 圆角：`rounded-full`

## 入口位置

- 原"重新生成"按钮更名为"管理角色卡"
- 点击后打开管理弹窗

## 与现有"角色卡生成"按钮的关系

- "角色卡生成"按钮保持独立，完整生成所有层
- "管理角色卡"弹窗用于精细化管理，可单独生成某层
- 两者互不影响，用户可自由选择
