# LangGraph Visual Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a visual editor for managing LangGraph workflows with prompt and LLM model configuration.

**Architecture:** MongoDB stores flow configs → Backend API provides CRUD operations → Frontend React Flow visualization → Config loaded on service restart.

**Tech Stack:** Express.js, MongoDB/Mongoose, Next.js, React Flow, Tailwind CSS

---

## Phase 1: Backend Foundation

### Task 1.1: Create LangGraph Config Model

**Files:**
- Create: `server/src/modules/langgraph/model.js`

**Step 1: Create the model file**

```javascript
/**
 * LangGraph Configuration Model
 * Stores flow node configurations for prompt and LLM settings
 */

import mongoose from 'mongoose';

const llmConfigSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['ollama', 'api'],
    default: 'ollama'
  },
  model: {
    type: String,
    default: 'deepseek-r1:14b'
  },
  apiProvider: {
    type: String,
    enum: ['deepseek', 'openai', null],
    default: null
  },
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 2
  },
  maxTokens: {
    type: Number,
    default: 500
  }
}, { _id: false });

const dynamicSourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const nodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  nodeType: {
    type: String,
    enum: ['start', 'process', 'condition', 'end'],
    default: 'process'
  },
  promptType: {
    type: String,
    enum: ['static', 'dynamic', 'none'],
    default: 'none'
  },
  staticPrompt: { type: String, default: '' },
  dynamicSources: [dynamicSourceSchema],
  editableSection: { type: String, default: '' },
  llmEnabled: { type: Boolean, default: false },
  llmConfig: { type: llmConfigSchema, default: () => ({}) },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
  label: { type: String, default: '' },
  conditionType: {
    type: String,
    enum: ['always', 'conditional'],
    default: 'always'
  }
}, { _id: false });

const langGraphConfigSchema = new mongoose.Schema({
  flowId: {
    type: String,
    required: true,
    unique: true,
    enum: ['rolecard', 'xiaoshudong']
  },
  flowName: { type: String, required: true },
  description: { type: String, default: '' },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default mongoose.model('LangGraphConfig', langGraphConfigSchema);
```

**Step 2: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/model.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/src/modules/langgraph/model.js
git commit -m "feat(langgraph): add LangGraphConfig model for flow configuration"
```

---

### Task 1.2: Create Default Config Files

**Files:**
- Create: `server/src/modules/langgraph/defaults/index.js`
- Create: `server/src/modules/langgraph/defaults/rolecard.js`
- Create: `server/src/modules/langgraph/defaults/xiaoshudong.js`

**Step 1: Create xiaoshudong defaults**

```javascript
// server/src/modules/langgraph/defaults/xiaoshudong.js
export const xiaoshudongDefault = {
  flowId: 'xiaoshudong',
  flowName: '小树洞对话',
  description: '心理咨询式匿名对话流程',
  nodes: [
    {
      nodeId: 'listening_response',
      nodeName: '倾听回复',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一位温暖、专业、有同理心的心理咨询师（小树洞）。

你的角色是倾听用户的烦恼，通过温和的引导帮助他们理清思绪。

## 回复原则

1. **简洁温暖**：回复2-4句话，用温暖平实的语言
2. **共情回应**：首先理解并回应用户的情绪
3. **温和引导**：每次可以问一个开放式问题帮助用户展开
4. **避免说教**：不要急于给建议，先倾听
5. **禁止命理词汇**：绝不使用命理、占卜、运势等词汇

只输出你的回复内容，不要有任何其他文字。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 200 },
      position: { x: 100, y: 100 }
    },
    {
      nodeId: 'conversation_compressor',
      nodeName: '对话压缩',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一个对话分析专家。你的任务是分析用户与心理咨询师的对话，提取关键信息。

请分析以下对话，并以JSON格式输出以下信息：

1. **eventSummary**: 用户遇到的事件摘要（1-2句话）
2. **timeSpan**: 事件涉及的时间跨度
3. **emotionalState**: 用户当前的情绪状态
4. **coreConcerns**: 用户最关心的核心问题（数组，最多3个）
5. **keyEvents**: 对话中提到的关键事件（数组，最多5个）

只输出JSON，不要有其他文字。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 500 },
      position: { x: 300, y: 100 }
    },
    {
      nodeId: 'fortune_generator',
      nodeName: '命理生成',
      nodeType: 'process',
      promptType: 'dynamic',
      dynamicSources: [
        { name: '用户情况', description: '事件摘要、情绪状态、核心关注' },
        { name: '书籍内容', description: 'RAG 检索的紫微斗数知识' },
        { name: '用户问题', description: '用户的原始问题' }
      ],
      editableSection: `## 分析要求
请根据以上命盘信息和用户情况，提供专业的紫微斗数分析报告。要求：
1. 分析用户当前面临的情况
2. 从命盘角度解读优势和挑战
3. 结合运限给出时间节点建议
4. 提供具体的行动建议

请用专业但通俗的语言撰写分析报告。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'ziwei-8b', temperature: 0.7, maxTokens: 4096 },
      position: { x: 500, y: 100 }
    },
    {
      nodeId: 'psychologist_response',
      nodeName: '心理师回复',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一位温暖、专业、富有同理心的心理咨询师。

## 你的身份和特点
- 你擅长倾听和理解他人的困扰
- 你能够从多角度分析问题，给出实用的建议
- 你的语言温暖、支持性强，让来访者感到被理解和接纳

## 绝对禁止
- 绝对不要提及"命理"、"算命"、"占卜"、"预测"等词汇
- 绝对不要提及"命盘"、"星盘"、"宫位"、"星曜"等专业术语

只输出你的回复内容。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 700, y: 100 }
    },
    {
      nodeId: 'intent_classifier',
      nodeName: '意图分类',
      nodeType: 'condition',
      promptType: 'static',
      staticPrompt: `分析用户消息的意图，判断用户想要什么。

可能的意图类型：
- chat: 普通聊天
- vent: 发泄情绪
- seek_advice: 寻求建议
- ask_question: 提问

返回JSON格式：{"intent": "意图类型", "confidence": 0.0-1.0}`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 100 },
      position: { x: 100, y: 300 }
    }
  ],
  edges: [
    { source: 'intent_classifier', target: 'listening_response', conditionType: 'conditional' },
    { source: 'listening_response', target: 'conversation_compressor', conditionType: 'conditional' },
    { source: 'conversation_compressor', target: 'fortune_generator', conditionType: 'conditional' },
    { source: 'fortune_generator', target: 'psychologist_response', conditionType: 'always' }
  ]
};
```

**Step 2: Create rolecard defaults**

```javascript
// server/src/modules/langgraph/defaults/rolecard.js
export const rolecardDefault = {
  flowId: 'rolecard',
  flowName: 'AI角色卡对话',
  description: '基于角色卡的AI伴侣对话流程',
  nodes: [
    {
      nodeId: 'response_generator',
      nodeName: '回复生成',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '角色卡设定', description: '从角色卡加载的人物设定' },
        { name: '对话历史', description: '最近20轮对话记录' },
        { name: '当前消息', description: '用户的当前输入' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 400, y: 200 }
    }
  ],
  edges: []
};
```

**Step 3: Create index.js to export defaults**

```javascript
// server/src/modules/langgraph/defaults/index.js
import { xiaoshudongDefault } from './xiaoshudong.js';
import { rolecardDefault } from './rolecard.js';

export function getDefaultConfig(flowId) {
  switch (flowId) {
    case 'xiaoshudong':
      return xiaoshudongDefault;
    case 'rolecard':
      return rolecardDefault;
    default:
      throw new Error(`Unknown flowId: ${flowId}`);
  }
}

export { xiaoshudongDefault, rolecardDefault };
```

**Step 4: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/defaults/index.js`
Expected: No output (success)

**Step 5: Commit**

```bash
git add server/src/modules/langgraph/defaults/
git commit -m "feat(langgraph): add default config files for xiaoshudong and rolecard flows"
```

---

### Task 1.3: Create ConfigLoader Service

**Files:**
- Create: `server/src/modules/langgraph/configLoader.js`

**Step 1: Create configLoader.js**

```javascript
/**
 * LangGraph Config Loader
 * Loads and caches flow configurations from MongoDB
 */

import LangGraphConfig from './model.js';
import { getDefaultConfig } from './defaults/index.js';
import logger from '../../core/utils/logger.js';

const configLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
  warn: (msg, meta = {}) => logger.warn(msg, { ...meta, module: 'LANGGRAPH_CONFIG' }),
};

class LangGraphConfigLoader {
  constructor() {
    this.configs = {};
    this.initialized = false;
  }

  /**
   * Initialize configs from MongoDB or defaults
   * Called on server startup
   */
  async initialize() {
    if (this.initialized) {
      configLogger.warn('ConfigLoader already initialized');
      return;
    }

    const flowIds = ['rolecard', 'xiaoshudong'];

    for (const flowId of flowIds) {
      try {
        const saved = await LangGraphConfig.findOne({ flowId });

        if (saved) {
          this.configs[flowId] = saved.toObject();
          configLogger.info(`Loaded config from DB: ${flowId}`);
        } else {
          // First time, create from defaults
          const defaultConfig = getDefaultConfig(flowId);
          const created = await LangGraphConfig.create(defaultConfig);
          this.configs[flowId] = created.toObject();
          configLogger.info(`Created config from defaults: ${flowId}`);
        }
      } catch (error) {
        configLogger.error(`Failed to load config ${flowId}:`, { error: error.message });
        // Fallback to defaults in memory
        this.configs[flowId] = getDefaultConfig(flowId);
      }
    }

    this.initialized = true;
    configLogger.info('LangGraph ConfigLoader initialized');
  }

  /**
   * Get all flow configurations
   */
  getAllConfigs() {
    return Object.values(this.configs).map(config => ({
      flowId: config.flowId,
      flowName: config.flowName,
      nodeCount: config.nodes?.length || 0
    }));
  }

  /**
   * Get full config for a flow
   */
  getConfig(flowId) {
    return this.configs[flowId] || null;
  }

  /**
   * Get node config by flow and node ID
   */
  getNodeConfig(flowId, nodeId) {
    const config = this.configs[flowId];
    if (!config) return null;
    return config.nodes?.find(n => n.nodeId === nodeId) || null;
  }

  /**
   * Get prompt for a node
   * Returns staticPrompt for static type, editableSection for dynamic type
   */
  getPrompt(flowId, nodeId) {
    const node = this.getNodeConfig(flowId, nodeId);
    if (!node) return null;

    if (node.promptType === 'static') {
      return node.staticPrompt;
    } else if (node.promptType === 'dynamic') {
      return node.editableSection;
    }
    return null;
  }

  /**
   * Get LLM config for a node
   */
  getLLMConfig(flowId, nodeId) {
    const node = this.getNodeConfig(flowId, nodeId);
    if (!node || !node.llmEnabled) return null;
    return node.llmConfig;
  }

  /**
   * Reload config from database (after update)
   */
  async reloadConfig(flowId) {
    try {
      const saved = await LangGraphConfig.findOne({ flowId });
      if (saved) {
        this.configs[flowId] = saved.toObject();
        configLogger.info(`Reloaded config: ${flowId}`);
        return true;
      }
      return false;
    } catch (error) {
      configLogger.error(`Failed to reload config ${flowId}:`, { error: error.message });
      return false;
    }
  }
}

// Singleton instance
export const configLoader = new LangGraphConfigLoader();
export default configLoader;
```

**Step 2: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/configLoader.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/src/modules/langgraph/configLoader.js
git commit -m "feat(langgraph): add configLoader service for loading flow configs"
```

---

### Task 1.4: Create Permission Migration

**Files:**
- Create: `server/src/modules/langgraph/migrations/addPermission.js`

**Step 1: Create migration file**

```javascript
/**
 * LangGraph Permission Migration
 * Ensures langgraph:edit permission exists
 */

import Permission from '../../roles/models/permission.js';
import logger from '../../../core/utils/logger.js';

const migrationLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_MIGRATION' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_MIGRATION' }),
};

export async function ensureLangGraphPermission() {
  try {
    const existing = await Permission.findOne({ name: 'langgraph:edit' });

    if (existing) {
      migrationLogger.info('langgraph:edit permission already exists');
      return existing;
    }

    const permission = await Permission.create({
      name: 'langgraph:edit',
      description: '编辑 LangGraph 流程配置',
      category: 'system'
    });

    migrationLogger.info('Created langgraph:edit permission');
    return permission;
  } catch (error) {
    migrationLogger.error('Failed to create langgraph:edit permission:', { error: error.message });
    throw error;
  }
}

export default ensureLangGraphPermission;
```

**Step 2: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/migrations/addPermission.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/src/modules/langgraph/migrations/addPermission.js
git commit -m "feat(langgraph): add permission migration for langgraph:edit"
```

---

### Task 1.5: Create API (Service + Controller + Route)

**Files:**
- Create: `server/src/modules/langgraph/service.js`
- Create: `server/src/modules/langgraph/controller.js`
- Create: `server/src/modules/langgraph/route.js`
- Create: `server/src/modules/langgraph/index.js`

**Step 1: Create service.js**

```javascript
/**
 * LangGraph Service
 * Business logic for flow configuration management
 */

import LangGraphConfig from './model.js';
import { getDefaultConfig } from './defaults/index.js';
import configLoader from './configLoader.js';
import logger from '../../core/utils/logger.js';

const serviceLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_SERVICE' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_SERVICE' }),
};

class LangGraphService {
  /**
   * Get all flows summary
   */
  async getFlows() {
    return configLoader.getAllConfigs();
  }

  /**
   * Get flow detail by ID
   */
  async getFlowById(flowId) {
    const config = configLoader.getConfig(flowId);
    if (!config) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    return config;
  }

  /**
   * Update node config
   */
  async updateNodeConfig(flowId, nodeId, updates, updatedBy) {
    const config = await LangGraphConfig.findOne({ flowId });
    if (!config) {
      throw new Error(`Flow not found: ${flowId}`);
    }

    const nodeIndex = config.nodes.findIndex(n => n.nodeId === nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const node = config.nodes[nodeIndex];

    // Update staticPrompt if provided and node is static type
    if (updates.staticPrompt !== undefined && node.promptType === 'static') {
      node.staticPrompt = updates.staticPrompt;
    }

    // Update editableSection if provided and node is dynamic type
    if (updates.editableSection !== undefined && node.promptType === 'dynamic') {
      node.editableSection = updates.editableSection;
    }

    // Update LLM config if provided
    if (updates.llmConfig) {
      node.llmConfig = { ...node.llmConfig, ...updates.llmConfig };
    }

    config.updatedBy = updatedBy;
    await config.save();

    // Reload in memory
    await configLoader.reloadConfig(flowId);

    serviceLogger.info(`Updated node config: ${flowId}/${nodeId}`, { updatedBy });

    return {
      nodeId,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy
    };
  }

  /**
   * Get available models from Ollama and API providers
   */
  async getAvailableModels(ollamaBaseUrl) {
    const models = {
      ollama: [],
      api: {
        deepseek: ['deepseek-chat', 'deepseek-reasoner'],
        openai: ['gpt-4', 'gpt-3.5-turbo']
      }
    };

    // Fetch Ollama models
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        models.ollama = data.models?.map(m => m.name) || [];
      }
    } catch (error) {
      serviceLogger.warn('Failed to fetch Ollama models:', { error: error.message });
    }

    return models;
  }
}

export default new LangGraphService();
```

**Step 2: Create controller.js**

```javascript
/**
 * LangGraph Controller
 * HTTP request handlers for flow configuration
 */

import langGraphService from './service.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

class LangGraphController {
  async getFlows(req, res) {
    try {
      const flows = await langGraphService.getFlows();
      res.json({ success: true, data: flows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getFlowById(req, res) {
    try {
      const { flowId } = req.params;
      const flow = await langGraphService.getFlowById(flowId);
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async updateNodeConfig(req, res) {
    try {
      const { flowId, nodeId } = req.params;
      const updates = req.body;
      const updatedBy = req.user?.id;

      const result = await langGraphService.updateNodeConfig(flowId, nodeId, updates, updatedBy);

      res.json({
        success: true,
        message: '节点配置已更新，重启服务后生效',
        data: result
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getAvailableModels(req, res) {
    try {
      const models = await langGraphService.getAvailableModels(OLLAMA_BASE_URL);
      res.json({ success: true, data: models });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new LangGraphController();
```

**Step 3: Create route.js**

```javascript
/**
 * LangGraph Routes
 * API endpoints for flow configuration management
 */

import express from 'express';
import { protect, requirePermission } from '../admin/middleware.js';
import langGraphController from './controller.js';

const router = express.Router();

// All routes require authentication and langgraph:edit permission
router.use(protect);
router.use(requirePermission('langgraph:edit'));

/**
 * @route   GET /api/admin/langgraph/flows
 * @desc    Get all flows summary
 */
router.get('/flows', (req, res) => langGraphController.getFlows(req, res));

/**
 * @route   GET /api/admin/langgraph/flows/:flowId
 * @desc    Get flow detail by ID
 */
router.get('/flows/:flowId', (req, res) => langGraphController.getFlowById(req, res));

/**
 * @route   PUT /api/admin/langgraph/flows/:flowId/nodes/:nodeId
 * @desc    Update node config
 * @body    staticPrompt, editableSection, llmConfig
 */
router.put('/flows/:flowId/nodes/:nodeId', (req, res) => langGraphController.updateNodeConfig(req, res));

/**
 * @route   GET /api/admin/langgraph/models
 * @desc    Get available models (Ollama + API)
 */
router.get('/models', (req, res) => langGraphController.getAvailableModels(req, res));

export default router;
```

**Step 4: Create index.js (module entry)**

```javascript
/**
 * LangGraph Module Entry
 */

import langGraphRouter from './route.js';
import configLoader from './configLoader.js';
import { ensureLangGraphPermission } from './migrations/addPermission.js';

export {
  langGraphRouter,
  configLoader,
  ensureLangGraphPermission
};

export default {
  router: langGraphRouter,
  configLoader,
  ensureLangGraphPermission
};
```

**Step 5: Verify all files**

Run:
```bash
cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/service.js
cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/controller.js
cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/route.js
cd F:/FPY/AFS-System/server && node --check src/modules/langgraph/index.js
```
Expected: No output (success)

**Step 6: Commit**

```bash
git add server/src/modules/langgraph/
git commit -m "feat(langgraph): add service, controller, route for flow config API"
```

---

### Task 1.6: Register Module in Server

**Files:**
- Modify: `server/src/server.js`

**Step 1: Add imports and registration**

In `server/src/server.js`, add the following:

After line 27 (after ziweiRouter import):
```javascript
import { langGraphRouter, configLoader, ensureLangGraphPermission } from './modules/langgraph/index.js';
```

After line 73 (after logger.info('自动挂钩已注册');):
```javascript
  // Initialize LangGraph config and permission
  try {
    await ensureLangGraphPermission();
    await configLoader.initialize();
    logger.info('LangGraph module initialized');
  } catch (error) {
    logger.warn('LangGraph initialization skipped:', error.message);
  }
```

After line 100 (after app.use('/api/admin', adminRouter);):
```javascript
app.use('/api/admin/langgraph', langGraphRouter);
```

**Step 2: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/server.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/src/server.js
git commit -m "feat(langgraph): register langgraph module in server startup"
```

---

## Phase 1 Complete ✅

After completing Phase 1:
- Backend model, service, controller, routes are ready
- Permission `langgraph:edit` will be auto-created on startup
- Config loaded from MongoDB on server startup
- API endpoints available at `/api/admin/langgraph/*`

---

## Phase 2: Frontend Page

### Task 2.1: Install React Flow Dependency

**Step 1: Install reactflow**

Run:
```bash
cd F:/FPY/AFS-System/web && npm install reactflow
```

Expected: Package installed successfully

**Step 2: Verify installation**

Run: `cd F:/FPY/AFS-System/web && cat package.json | grep reactflow`
Expected: `"reactflow": "^11.x.x"`

**Step 3: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "feat(langgraph): add reactflow dependency for flow visualization"
```

---

### Task 2.2: Create API Hook

**Files:**
- Create: `web/app/admin/langgraph/hooks/useLangGraph.ts`

**Step 1: Create the hook**

```typescript
// web/app/admin/langgraph/hooks/useLangGraph.ts
import { useState, useCallback } from 'react';
import { adminApiRequest } from '@/lib/admin-api';

export interface LangGraphFlow {
  flowId: string;
  flowName: string;
  nodeCount: number;
}

export interface DynamicSource {
  name: string;
  description: string;
}

export interface LLMConfig {
  source: 'ollama' | 'api';
  model: string;
  apiProvider?: 'deepseek' | 'openai' | null;
  temperature: number;
  maxTokens: number;
}

export interface LangGraphNode {
  nodeId: string;
  nodeName: string;
  nodeType: 'start' | 'process' | 'condition' | 'end';
  promptType: 'static' | 'dynamic' | 'none';
  staticPrompt: string;
  dynamicSources: DynamicSource[];
  editableSection: string;
  llmEnabled: boolean;
  llmConfig: LLMConfig;
  position: { x: number; y: number };
}

export interface LangGraphEdge {
  source: string;
  target: string;
  label: string;
  conditionType: 'always' | 'conditional';
}

export interface LangGraphFlowDetail {
  flowId: string;
  flowName: string;
  description: string;
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableModels {
  ollama: string[];
  api: {
    deepseek: string[];
    openai: string[];
  };
}

export function useLangGraph() {
  const [flows, setFlows] = useState<LangGraphFlow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<LangGraphFlowDetail | null>(null);
  const [models, setModels] = useState<AvailableModels | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; data: LangGraphFlow[] }>('/admin/langgraph/flows');
      if (result.success && result.data) {
        setFlows(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFlowDetail = useCallback(async (flowId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; data: LangGraphFlowDetail }>(`/admin/langgraph/flows/${flowId}`);
      if (result.success && result.data) {
        setCurrentFlow(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flow detail');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateNodeConfig = useCallback(async (
    flowId: string,
    nodeId: string,
    updates: {
      staticPrompt?: string;
      editableSection?: string;
      llmConfig?: Partial<LLMConfig>;
    }
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ success: boolean; message: string; data: any }>(
        `/admin/langgraph/flows/${flowId}/nodes/${nodeId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      if (result.success) {
        // Refresh flow detail
        await fetchFlowDetail(flowId);
        return { success: true, message: result.message };
      }
      return { success: false, message: 'Update failed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update node';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [fetchFlowDetail]);

  const fetchModels = useCallback(async () => {
    try {
      const result = await adminApiRequest<{ success: boolean; data: AvailableModels }>('/admin/langgraph/models');
      if (result.success && result.data) {
        setModels(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  }, []);

  return {
    flows,
    currentFlow,
    models,
    isLoading,
    error,
    fetchFlows,
    fetchFlowDetail,
    updateNodeConfig,
    fetchModels,
  };
}
```

**Step 2: Verify TypeScript**

Run: `cd F:/FPY/AFS-System/web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add web/app/admin/langgraph/hooks/useLangGraph.ts
git commit -m "feat(langgraph): add useLangGraph API hook"
```

---

### Task 2.3: Create Page Layout and Tabs

**Files:**
- Create: `web/app/admin/langgraph/page.tsx`
- Create: `web/app/admin/langgraph/components/FlowTabs.tsx`

**Step 1: Create FlowTabs component**

```typescript
// web/app/admin/langgraph/components/FlowTabs.tsx
'use client';

import { cn } from '@/lib/utils';
import { GitBranch, MessageSquareHeart, User } from 'lucide-react';

interface FlowTab {
  flowId: string;
  flowName: string;
  icon: React.ReactNode;
}

const flowTabs: FlowTab[] = [
  { flowId: 'rolecard', flowName: 'AI角色卡对话', icon: <User className="w-4 h-4" /> },
  { flowId: 'xiaoshudong', flowName: '小树洞对话', icon: <MessageSquareHeart className="w-4 h-4" /> },
];

interface FlowTabsProps {
  activeFlowId: string;
  onFlowChange: (flowId: string) => void;
}

export function FlowTabs({ activeFlowId, onFlowChange }: FlowTabsProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
      {flowTabs.map((tab) => (
        <button
          key={tab.flowId}
          onClick={() => onFlowChange(tab.flowId)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            activeFlowId === tab.flowId
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          )}
        >
          {tab.icon}
          {tab.flowName}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Create main page**

```typescript
// web/app/admin/langgraph/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import { useLangGraph } from './hooks/useLangGraph';
import { FlowTabs } from './components/FlowTabs';
import { FlowCanvas } from './components/FlowCanvas';
import { NodeEditor } from './components/NodeEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitBranch, AlertCircle, Loader2 } from 'lucide-react';
import type { LangGraphNode } from './hooks/useLangGraph';

export default function LangGraphPage() {
  const { can } = usePermissionStore();
  const {
    flows,
    currentFlow,
    models,
    isLoading,
    error,
    fetchFlows,
    fetchFlowDetail,
    updateNodeConfig,
    fetchModels,
  } = useLangGraph();

  const [activeFlowId, setActiveFlowId] = useState<string>('xiaoshudong');
  const [selectedNode, setSelectedNode] = useState<LangGraphNode | null>(null);

  useEffect(() => {
    if (can('langgraph:edit')) {
      fetchFlows();
      fetchModels();
    }
  }, [can, fetchFlows, fetchModels]);

  useEffect(() => {
    if (activeFlowId) {
      fetchFlowDetail(activeFlowId);
      setSelectedNode(null);
    }
  }, [activeFlowId, fetchFlowDetail]);

  const handleFlowChange = (flowId: string) => {
    setActiveFlowId(flowId);
  };

  const handleNodeClick = (node: LangGraphNode) => {
    // Only select nodes that have editable content
    if (node.promptType !== 'none' || node.llmEnabled) {
      setSelectedNode(node);
    }
  };

  const handleSaveNode = async (updates: {
    staticPrompt?: string;
    editableSection?: string;
    llmConfig?: any;
  }) => {
    if (!selectedNode) return;

    const result = await updateNodeConfig(activeFlowId, selectedNode.nodeId, updates);
    if (result.success) {
      // Show success message
      alert('配置已保存，重启服务后生效');
    } else {
      alert('保存失败: ' + result.message);
    }
  };

  if (!can('langgraph:edit')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限访问 LangGraph 管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-orange-500" />
            LangGraph 管理
          </h1>
          <p className="text-gray-600">可视化编辑 LangGraph 流程配置</p>
        </div>
      </div>

      {/* Flow Tabs */}
      <FlowTabs activeFlowId={activeFlowId} onFlowChange={handleFlowChange} />

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow Canvas */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="text-lg">
                {currentFlow?.flowName || '流程图'}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[520px] p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : currentFlow ? (
                <FlowCanvas
                  nodes={currentFlow.nodes}
                  edges={currentFlow.edges}
                  selectedNodeId={selectedNode?.nodeId}
                  onNodeClick={handleNodeClick}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  选择一个流程查看
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Node Editor Panel */}
        <div className="lg:col-span-1">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedNode ? selectedNode.nodeName : '节点编辑'}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto h-[520px]">
              {selectedNode ? (
                <NodeEditor
                  node={selectedNode}
                  models={models}
                  onSave={handleSaveNode}
                  onCancel={() => setSelectedNode(null)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <GitBranch className="w-12 h-12 mb-2" />
                  <p>点击流程图中的节点进行编辑</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add web/app/admin/langgraph/page.tsx web/app/admin/langgraph/components/FlowTabs.tsx
git commit -m "feat(langgraph): add main page layout with flow tabs"
```

---

### Task 2.4: Create Flow Canvas Component

**Files:**
- Create: `web/app/admin/langgraph/components/FlowCanvas.tsx`

**Step 1: Create FlowCanvas component**

```typescript
// web/app/admin/langgraph/components/FlowCanvas.tsx
'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeTypes,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '@/lib/utils';
import type { LangGraphNode, LangGraphEdge } from '../hooks/useLangGraph';

interface FlowCanvasProps {
  nodes: LangGraphNode[];
  edges: LangGraphEdge[];
  selectedNodeId: string | null;
  onNodeClick: (node: LangGraphNode) => void;
}

// Custom node component
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const isEditable = data.promptType !== 'none' || data.llmEnabled;

  return (
    <div
      className={cn(
        'px-4 py-2 rounded-lg border-2 min-w-[120px] text-center transition-all',
        selected ? 'border-orange-500 shadow-lg' : 'border-gray-300',
        isEditable ? 'bg-white cursor-pointer hover:border-orange-400' : 'bg-gray-100 cursor-default',
        data.nodeType === 'condition' && 'rounded-full'
      )}
    >
      <div className="font-medium text-sm">{data.label}</div>
      {isEditable && (
        <div className="text-xs text-gray-500 mt-1">
          {data.promptType === 'static' && '📝 静态Prompt'}
          {data.promptType === 'dynamic' && '⚡ 动态Prompt'}
          {data.promptType === 'none' && '🤖 仅模型'}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function FlowCanvas({ nodes, edges, selectedNodeId, onNodeClick }: FlowCanvasProps) {
  // Convert to ReactFlow format
  const flowNodes: Node[] = useMemo(() =>
    nodes.map((node) => ({
      id: node.nodeId,
      type: 'custom',
      position: { x: node.position.x, y: node.position.y },
      data: {
        label: node.nodeName,
        nodeType: node.nodeType,
        promptType: node.promptType,
        llmEnabled: node.llmEnabled,
      },
    })),
    [nodes]
  );

  const flowEdges: Edge[] = useMemo(() =>
    edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      animated: edge.conditionType === 'conditional',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: {
        stroke: edge.conditionType === 'conditional' ? '#f97316' : '#94a3b8',
      },
    })),
    [edges]
  );

  const [reactNodes, setReactNodes, onNodesChange] = useNodesState(flowNodes);
  const [reactEdges, setReactEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes when props change
  useMemo(() => {
    setReactNodes(flowNodes);
  }, [flowNodes, setReactNodes]);

  useMemo(() => {
    setReactEdges(flowEdges);
  }, [flowEdges, setReactEdges]);

  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const originalNode = nodes.find((n) => n.nodeId === node.id);
      if (originalNode) {
        onNodeClick(originalNode);
      }
    },
    [nodes, onNodeClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={reactNodes}
        edges={reactEdges}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.id === selectedNodeId) return '#f97316';
            return '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add web/app/admin/langgraph/components/FlowCanvas.tsx
git commit -m "feat(langgraph): add FlowCanvas component with React Flow"
```

---

### Task 2.5: Create Node Editor Panel

**Files:**
- Create: `web/app/admin/langgraph/components/NodeEditor.tsx`
- Create: `web/app/admin/langgraph/components/PromptEditor.tsx`
- Create: `web/app/admin/langgraph/components/ModelSelector.tsx`

**Step 1: Create PromptEditor component**

```typescript
// web/app/admin/langgraph/components/PromptEditor.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info, FileText } from 'lucide-react';
import type { DynamicSource } from '../hooks/useLangGraph';

interface PromptEditorProps {
  promptType: 'static' | 'dynamic' | 'none';
  staticPrompt: string;
  dynamicSources: DynamicSource[];
  editableSection: string;
  onChange: (value: string) => void;
}

export function PromptEditor({
  promptType,
  staticPrompt,
  dynamicSources,
  editableSection,
  onChange,
}: PromptEditorProps) {
  const [value, setValue] = useState(
    promptType === 'static' ? staticPrompt : editableSection
  );

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(newValue);
  };

  if (promptType === 'none') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-sm">
        此节点的 Prompt 由系统动态生成，不可编辑
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Prompt Type Badge */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full',
            promptType === 'static'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          )}
        >
          {promptType === 'static' ? '📝 静态 Prompt' : '⚡ 动态 Prompt'}
        </span>
      </div>

      {/* Dynamic Sources Info */}
      {promptType === 'dynamic' && dynamicSources.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg">
          <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
            <Info className="w-4 h-4" />
            动态数据来源
          </div>
          <ul className="space-y-1">
            {dynamicSources.map((source, index) => (
              <li key={index} className="text-sm text-purple-600">
                • <strong>{source.name}</strong>: {source.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prompt Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {promptType === 'static' ? 'Prompt 内容' : '可编辑部分'}
        </label>
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full h-64 p-3 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="在此编辑 Prompt..."
        />
      </div>
    </div>
  );
}
```

**Step 2: Create ModelSelector component**

```typescript
// web/app/admin/langgraph/components/ModelSelector.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Cpu, Cloud } from 'lucide-react';
import type { AvailableModels, LLMConfig } from '../hooks/useLangGraph';

interface ModelSelectorProps {
  config: LLMConfig;
  models: AvailableModels | null;
  onChange: (config: Partial<LLMConfig>) => void;
}

export function ModelSelector({ config, models, onChange }: ModelSelectorProps) {
  const [source, setSource] = useState<'ollama' | 'api'>(config.source);

  const handleSourceChange = (newSource: 'ollama' | 'api') => {
    setSource(newSource);
    onChange({ source: newSource });
  };

  const handleModelChange = (model: string) => {
    onChange({ model });
  };

  const handleProviderChange = (provider: 'deepseek' | 'openai') => {
    onChange({ apiProvider: provider });
  };

  return (
    <div className="space-y-4">
      {/* Model Source Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          模型来源
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleSourceChange('ollama')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
              source === 'ollama'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Cpu className="w-4 h-4" />
            Ollama (本地)
          </button>
          <button
            onClick={() => handleSourceChange('api')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
              source === 'api'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Cloud className="w-4 h-4" />
            API (远程)
          </button>
        </div>
      </div>

      {/* Ollama Model Selection */}
      {source === 'ollama' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ollama 模型
          </label>
          <select
            value={config.model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="">选择模型...</option>
            {models?.ollama?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {(!models?.ollama || models.ollama.length === 0) && (
            <p className="mt-1 text-xs text-gray-500">
              无法获取 Ollama 模型列表，请手动输入
            </p>
          )}
        </div>
      )}

      {/* API Provider Selection */}
      {source === 'api' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 提供商
            </label>
            <select
              value={config.apiProvider || 'deepseek'}
              onChange={(e) => handleProviderChange(e.target.value as 'deepseek' | 'openai')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 模型
            </label>
            <select
              value={config.model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">选择模型...</option>
              {config.apiProvider === 'openai'
                ? models?.api?.openai?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                : models?.api?.deepseek?.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
            </select>
          </div>
        </>
      )}

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Temperature: {config.temperature}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={config.temperature}
          onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>精确 (0)</span>
          <span>创意 (2)</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max Tokens
        </label>
        <input
          type="number"
          min="50"
          max="8192"
          value={config.maxTokens}
          onChange={(e) => onChange({ maxTokens: parseInt(e.target.value) })}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  );
}
```

**Step 3: Create NodeEditor component**

```typescript
// web/app/admin/langgraph/components/NodeEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { PromptEditor } from './PromptEditor';
import { ModelSelector } from './ModelSelector';
import { Button } from '@/components/ui/button';
import { Save, X, AlertTriangle } from 'lucide-react';
import type { LangGraphNode, AvailableModels, LLMConfig } from '../hooks/useLangGraph';

interface NodeEditorProps {
  node: LangGraphNode;
  models: AvailableModels | null;
  onSave: (updates: {
    staticPrompt?: string;
    editableSection?: string;
    llmConfig?: Partial<LLMConfig>;
  }) => void;
  onCancel: () => void;
}

export function NodeEditor({ node, models, onSave, onCancel }: NodeEditorProps) {
  const [promptValue, setPromptValue] = useState(
    node.promptType === 'static' ? node.staticPrompt : node.editableSection
  );
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(node.llmConfig);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPromptValue(
      node.promptType === 'static' ? node.staticPrompt : node.editableSection
    );
    setLlmConfig(node.llmConfig);
    setHasChanges(false);
  }, [node]);

  const handlePromptChange = (value: string) => {
    setPromptValue(value);
    setHasChanges(true);
  };

  const handleLLMConfigChange = (updates: Partial<LLMConfig>) => {
    setLlmConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: any = {};

    if (node.promptType === 'static') {
      updates.staticPrompt = promptValue;
    } else if (node.promptType === 'dynamic') {
      updates.editableSection = promptValue;
    }

    if (node.llmEnabled) {
      updates.llmConfig = llmConfig;
    }

    onSave(updates);
  };

  return (
    <div className="space-y-6">
      {/* Node Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="font-medium">{node.nodeName}</div>
        <div className="text-sm text-gray-500">ID: {node.nodeId}</div>
      </div>

      {/* Prompt Editor (if applicable) */}
      {node.promptType !== 'none' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Prompt 配置</h3>
          <PromptEditor
            promptType={node.promptType}
            staticPrompt={node.staticPrompt}
            dynamicSources={node.dynamicSources}
            editableSection={node.editableSection}
            onChange={handlePromptChange}
          />
        </div>
      )}

      {/* LLM Config (if enabled) */}
      {node.llmEnabled && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">LLM 模型配置</h3>
          <ModelSelector
            config={llmConfig}
            models={models}
            onChange={handleLLMConfigChange}
          />
        </div>
      )}

      {/* Restart Warning */}
      <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-700">
          <strong>注意:</strong> 配置保存后需要重启服务才能生效
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
        >
          <Save className="w-4 h-4 mr-2" />
          保存配置
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add web/app/admin/langgraph/components/NodeEditor.tsx web/app/admin/langgraph/components/PromptEditor.tsx web/app/admin/langgraph/components/ModelSelector.tsx
git commit -m "feat(langgraph): add node editor panel with prompt and model config"
```

---

### Task 2.6: Update Sidebar Menu

**Files:**
- Modify: `web/components/admin/AdminSidebar.tsx`
- Modify: `web/lib/admin-api.ts`

**Step 1: Add menu item to AdminSidebar.tsx**

In `navItems` array (around line 80), add new item:

```typescript
{
  title: 'LangGraph 管理',
  href: '/admin/langgraph',
  icon: GitBranch,
  permission: 'langgraph:edit',
},
```

Also add import for GitBranch if not already present:
```typescript
import { GitBranch } from 'lucide-react';
```

**Step 2: Verify TypeScript**

Run: `cd F:/FPY/AFS-System/web && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add web/components/admin/AdminSidebar.tsx
git commit -m "feat(langgraph): add LangGraph menu item to admin sidebar"
```

---

## Phase 2 Complete ✅

After completing Phase 2:
- React Flow installed for visualization
- API hook for data fetching
- Page layout with tab switching
- Flow canvas with node visualization
- Node editor panel with prompt/model editing
- Sidebar menu updated

---

## Phase 3: Node Integration

### Task 3.1: Modify XiaoShuDong Nodes to Use ConfigLoader

**Files:**
- Modify: `server/src/modules/xiaoshudong/nodes/listeningResponse.js`
- Modify: `server/src/modules/xiaoshudong/nodes/conversationCompressor.js`
- Modify: `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js`
- Modify: `server/src/modules/xiaoshudong/nodes/psychologistResponse.js`
- Modify: `server/src/modules/xiaoshudong/nodes/intentClassifier.js`

**Step 1: Modify listeningResponse.js**

Add import and use configLoader:

```javascript
// Add at top of file
import { configLoader } from '../../langgraph/configLoader.js';

// In generateListeningLLMResponse function, replace:
// let systemPrompt = LISTENING_SYSTEM_PROMPT;
// With:
let systemPrompt = configLoader.getPrompt('xiaoshudong', 'listening_response') || LISTENING_SYSTEM_PROMPT;

// Get LLM config from configLoader
const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'listening_response');
const llmOptions = {
  temperature: nodeConfig?.llmConfig?.temperature || 0.7,
  maxTokens: nodeConfig?.llmConfig?.maxTokens || 200
};
```

**Step 2: Modify conversationCompressor.js**

```javascript
// Add at top of file
import { configLoader } from '../../langgraph/configLoader.js';

// In conversationCompressorNode function, replace:
// { role: 'system', content: COMPRESSOR_SYSTEM_PROMPT },
// With:
const systemPrompt = configLoader.getPrompt('xiaoshudong', 'conversation_compressor') || COMPRESSOR_SYSTEM_PROMPT;
// ... use systemPrompt in messages

// Get LLM config
const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'conversation_compressor');
const llmOptions = {
  temperature: nodeConfig?.llmConfig?.temperature || 0.3,
  maxTokens: nodeConfig?.llmConfig?.maxTokens || 500
};
```

**Step 3: Modify fortuneGenerator.js**

```javascript
// Add import
import { configLoader } from '../../langgraph/configLoader.js';

// In buildFortunePrompt or generate function, use editable section:
const editableSection = configLoader.getPrompt('xiaoshudong', 'fortune_generator');
// Append editableSection to the prompt

// Get LLM config for model selection
const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'fortune_generator');
// Use nodeConfig.llmConfig.model for model selection
```

**Step 4: Modify psychologistResponse.js**

```javascript
// Add import
import { configLoader } from '../../langgraph/configLoader.js';

// Replace PSYCHOLOGIST_SYSTEM_PROMPT with configLoader.getPrompt
const systemPrompt = configLoader.getPrompt('xiaoshudong', 'psychologist_response') || PSYCHOLOGIST_SYSTEM_PROMPT;

// Get LLM config
const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'psychologist_response');
```

**Step 5: Modify intentClassifier.js**

```javascript
// Add import
import { configLoader } from '../../langgraph/configLoader.js';

// Replace INTENT_CLASSIFICATION_PROMPT with configLoader.getPrompt
const systemPrompt = configLoader.getPrompt('xiaoshudong', 'intent_classifier') || INTENT_CLASSIFICATION_PROMPT;

// Get LLM config
const nodeConfig = configLoader.getNodeConfig('xiaoshudong', 'intent_classifier');
```

**Step 6: Verify syntax**

Run:
```bash
cd F:/FPY/AFS-System/server && node --check src/modules/xiaoshudong/nodes/listeningResponse.js
cd F:/FPY/AFS-System/server && node --check src/modules/xiaoshudong/nodes/conversationCompressor.js
cd F:/FPY/AFS-System/server && node --check src/modules/xiaoshudong/nodes/fortuneGenerator.js
cd F:/FPY/AFS-System/server && node --check src/modules/xiaoshudong/nodes/psychologistResponse.js
cd F:/FPY/AFS-System/server && node --check src/modules/xiaoshudong/nodes/intentClassifier.js
```
Expected: No output (success)

**Step 7: Commit**

```bash
git add server/src/modules/xiaoshudong/nodes/
git commit -m "feat(langgraph): integrate configLoader into xiaoshudong nodes"
```

---

### Task 3.2: Modify Role Card Node to Use ConfigLoader

**Files:**
- Modify: `server/src/modules/chat/nodes/responseGenerator.js`

**Step 1: Add configLoader import and usage**

```javascript
// Add import
import { configLoader } from '../../langgraph/configLoader.js';

// In responseGeneratorNode function, after getting llmClient:
const nodeConfig = configLoader.getNodeConfig('rolecard', 'response_generator');

// Use config for LLM options if available
const llmOptions = {
  temperature: nodeConfig?.llmConfig?.temperature || 0.7,
  maxTokens: nodeConfig?.llmConfig?.maxTokens || 500
};

// Note: Prompt comes from role card, so we only use LLM config here
```

**Step 2: Verify syntax**

Run: `cd F:/FPY/AFS-System/server && node --check src/modules/chat/nodes/responseGenerator.js`
Expected: No output (success)

**Step 3: Commit**

```bash
git add server/src/modules/chat/nodes/responseGenerator.js
git commit -m "feat(langgraph): integrate configLoader into rolecard response generator"
```

---

### Task 3.3: Final Verification and Testing

**Step 1: Start server and verify initialization**

Run: `cd F:/FPY/AFS-System/server && npm run dev`

Expected log output:
```
[LANGGRAPH_CONFIG] Created config from defaults: rolecard
[LANGGRAPH_CONFIG] Created config from defaults: xiaoshudong
[LANGGRAPH_CONFIG] LangGraph ConfigLoader initialized
LangGraph module initialized
```

**Step 2: Test API endpoints**

```bash
# Get flows
curl -H "Authorization: Bearer <admin_token>" http://localhost:3001/api/admin/langgraph/flows

# Get flow detail
curl -H "Authorization: Bearer <admin_token>" http://localhost:3001/api/admin/langgraph/flows/xiaoshudong

# Get available models
curl -H "Authorization: Bearer <admin_token>" http://localhost:3001/api/admin/langgraph/models

# Update node config
curl -X PUT -H "Authorization: Bearer <admin_token>" -H "Content-Type: application/json" \
  -d '{"llmConfig":{"temperature":0.8}}' \
  http://localhost:3001/api/admin/langgraph/flows/xiaoshudong/nodes/listening_response
```

**Step 3: Test frontend**

1. Login as admin with `langgraph:edit` permission
2. Navigate to `/admin/langgraph`
3. Verify tab switching works
4. Verify flow canvas displays nodes
5. Click a node and verify editor panel shows
6. Edit prompt and save
7. Verify success message

**Step 4: Verify config persistence**

1. After saving changes, restart server
2. Check that changes persisted in MongoDB
3. Verify nodes use updated config

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(langgraph): complete LangGraph visual editor implementation

- Backend: Model, service, controller, routes for flow config
- Frontend: React Flow visualization, node editor panel
- Integration: ConfigLoader integrated into xiaoshudong and rolecard nodes
- Permission: langgraph:edit permission for access control

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3 Complete ✅

After completing Phase 3:
- XiaoShuDong nodes use configLoader for prompts and LLM config
- Role card node uses configLoader for LLM config
- Configuration persists in MongoDB
- Changes take effect on server restart

---

## Implementation Complete 🎉

All phases completed:
- **Phase 1**: Backend foundation (model, service, routes)
- **Phase 2**: Frontend page (React Flow, editor components)
- **Phase 3**: Node integration (configLoader in nodes)

### Key Features:
- ✅ Tab-based flow switching (AI角色卡 | 小树洞)
- ✅ Visual flow diagram with React Flow
- ✅ Node editor for prompt and model configuration
- ✅ Static and dynamic prompt types supported
- ✅ Ollama and API model selection
- ✅ Permission-based access control
- ✅ MongoDB persistence
- ✅ Configuration loaded on server restart

### File Summary:

**Backend (New):**
- `server/src/modules/langgraph/model.js`
- `server/src/modules/langgraph/service.js`
- `server/src/modules/langgraph/controller.js`
- `server/src/modules/langgraph/route.js`
- `server/src/modules/langgraph/configLoader.js`
- `server/src/modules/langgraph/index.js`
- `server/src/modules/langgraph/defaults/index.js`
- `server/src/modules/langgraph/defaults/rolecard.js`
- `server/src/modules/langgraph/defaults/xiaoshudong.js`
- `server/src/modules/langgraph/migrations/addPermission.js`

**Backend (Modified):**
- `server/src/server.js`
- `server/src/modules/xiaoshudong/nodes/listeningResponse.js`
- `server/src/modules/xiaoshudong/nodes/conversationCompressor.js`
- `server/src/modules/xiaoshudong/nodes/fortuneGenerator.js`
- `server/src/modules/xiaoshudong/nodes/psychologistResponse.js`
- `server/src/modules/xiaoshudong/nodes/intentClassifier.js`
- `server/src/modules/chat/nodes/responseGenerator.js`

**Frontend (New):**
- `web/app/admin/langgraph/page.tsx`
- `web/app/admin/langgraph/hooks/useLangGraph.ts`
- `web/app/admin/langgraph/components/FlowTabs.tsx`
- `web/app/admin/langgraph/components/FlowCanvas.tsx`
- `web/app/admin/langgraph/components/NodeEditor.tsx`
- `web/app/admin/langgraph/components/PromptEditor.tsx`
- `web/app/admin/langgraph/components/ModelSelector.tsx`

**Frontend (Modified):**
- `web/package.json` (added reactflow)
- `web/components/admin/AdminSidebar.tsx`
