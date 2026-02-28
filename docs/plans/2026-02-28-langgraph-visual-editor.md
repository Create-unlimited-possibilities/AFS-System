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

## Phase 2: Frontend Page (To be continued...)

## Phase 3: Node Integration (To be continued...)
