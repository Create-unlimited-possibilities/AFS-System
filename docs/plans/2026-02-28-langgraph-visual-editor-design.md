# LangGraph Visual Editor Design

## Overview

A visual editor for managing LangGraph workflows in the admin panel. Allows administrators to edit node prompts and LLM model configurations through a graphical interface.

## Requirements Summary

| Item | Decision |
|------|----------|
| UI Layout | Tab switching between "AI Role Card" and "XiaoShuDong" flows |
| Storage | MongoDB |
| Edit Scope | Prompt + LLM model selection only |
| Node Scope | Only nodes with prompt/LLM configuration |
| Effect Timing | Takes effect after service restart |
| Permission | Requires `langgraph:edit` permission |

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                        │
│  /admin/langgraph                                                   │
│  ├── Tab switcher component (AI Role Card | XiaoShuDong)            │
│  ├── Flow visualization component (React Flow)                      │
│  └── Node editor panel component                                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP API
┌──────────────────────────────▼──────────────────────────────────────┐
│                          Backend (Express)                          │
│  /api/admin/langgraph                                               │
│  ├── GET  /flows          - Get flow list                           │
│  ├── GET  /flows/:id      - Get flow detail with node configs       │
│  ├── PUT  /flows/:id/nodes/:nodeId - Update node config             │
│  └── GET  /models         - Get available model list                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                          MongoDB                                     │
│  langgraph_configs collection - Store flow node configs             │
│  permissions collection - Add langgraph:edit permission             │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Flow**:
1. Admin accesses page → Load flow configuration
2. Click node → Open editor panel
3. Modify Prompt/Model → Save to MongoDB
4. Restart service → Load config from MongoDB → Override defaults

---

## 2. Database Schema

### 2.1 Main Config Collection `langgraph_configs`

```javascript
{
  _id: ObjectId,
  flowId: String,              // "rolecard" | "xiaoshudong"
  flowName: String,            // "AI Role Card Chat" | "XiaoShuDong Chat"
  description: String,         // Flow description
  nodes: [
    {
      nodeId: String,          // Node identifier (matches code)
      nodeName: String,        // Node display name
      nodeType: String,        // "start" | "process" | "condition" | "end"

      // Prompt configuration
      promptType: String,      // "static" | "dynamic" | "none"
      staticPrompt: String,    // Full static prompt content (promptType="static")
      dynamicSources: [        // Dynamic data source description (promptType="dynamic")
        { name: String, description: String }
      ],
      editableSection: String, // Editable section (when promptType="dynamic")

      // LLM configuration
      llmEnabled: Boolean,     // Whether uses LLM
      llmConfig: {
        source: String,        // "ollama" | "api"
        model: String,         // Model name
        apiProvider: String,   // "deepseek" | "openai" (when source="api")
        temperature: Number,   // Default 0.7
        maxTokens: Number      // Default based on node
      },

      // Flow canvas position (for visualization)
      position: { x: Number, y: Number }
    }
  ],

  // Edge (connection) definitions
  edges: [
    {
      source: String,          // Source node ID
      target: String,          // Target node ID
      label: String,           // Edge label (optional)
      conditionType: String    // "always" | "conditional"
    }
  ],

  createdAt: Date,
  updatedAt: Date,
  updatedBy: ObjectId          // Modifier (admin ID)
}
```

### 2.2 Permission Record `permissions`

```javascript
{
  name: "langgraph:edit",
  description: "Edit LangGraph flow configuration",
  category: "system",
  createdAt: Date
}
```

---

## 3. API Design

### 3.1 Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/admin/langgraph/flows` | Get all flow list | `langgraph:edit` |
| GET | `/api/admin/langgraph/flows/:flowId` | Get single flow detail | `langgraph:edit` |
| PUT | `/api/admin/langgraph/flows/:flowId/nodes/:nodeId` | Update node config | `langgraph:edit` |
| GET | `/api/admin/langgraph/models` | Get available models | `langgraph:edit` |

### 3.2 API Details

#### GET `/api/admin/langgraph/flows`

**Response:**
```json
{
  "success": true,
  "data": [
    { "flowId": "rolecard", "flowName": "AI Role Card Chat", "nodeCount": 1 },
    { "flowId": "xiaoshudong", "flowName": "XiaoShuDong Chat", "nodeCount": 5 }
  ]
}
```

#### GET `/api/admin/langgraph/flows/:flowId`

**Response:**
```json
{
  "success": true,
  "data": {
    "flowId": "xiaoshudong",
    "flowName": "XiaoShuDong Chat",
    "nodes": [...],
    "edges": [...]
  }
}
```

#### PUT `/api/admin/langgraph/flows/:flowId/nodes/:nodeId`

**Request Body:**
```json
{
  "staticPrompt": "Modified prompt...",
  "editableSection": "Modified analysis instructions...",
  "llmConfig": {
    "source": "ollama",
    "model": "deepseek-r1:14b",
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Node config updated. Restart service to take effect.",
  "data": { "updatedAt": "2026-02-28T...", "updatedBy": "admin_id" }
}
```

#### GET `/api/admin/langgraph/models`

**Response:**
```json
{
  "success": true,
  "data": {
    "ollama": ["deepseek-r1:14b", "ziwei-8b", "qwen2:7b"],
    "api": {
      "deepseek": ["deepseek-chat", "deepseek-reasoner"],
      "openai": ["gpt-4", "gpt-3.5-turbo"]
    }
  }
}
```

---

## 4. Frontend Design

### 4.1 Page Structure

```
web/app/admin/langgraph/
├── page.tsx                 # Main page
├── components/
│   ├── FlowTabs.tsx         # Tab switcher component
│   ├── FlowCanvas.tsx       # Flow canvas (React Flow)
│   ├── NodeEditor.tsx       # Node editor panel (sidebar/modal)
│   ├── PromptEditor.tsx     # Prompt editor
│   └── ModelSelector.tsx    # Model selector
└── hooks/
    └── useLangGraph.ts      # API call hook
```

### 4.2 Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Admin Layout (Shared Sidebar)                                      │
├─────────────────────────────────────────────────────────────────────┤
│  LangGraph Management                                               │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  [ AI Role Card ]  [ XiaoShuDong ]                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────┬────────────────────────┐│
│  │                                        │                        ││
│  │         Flow Canvas                    │    Node Editor Panel   ││
│  │    (React Flow visualization)          │    (Click node to show)││
│  │                                        │                        ││
│  │    ┌─────────┐    ┌─────────┐         │  Node: listening_xxx   ││
│  │    │ Node 1  │───►│ Node 2  │         │                        ││
│  │    └─────────┘    └─────────┘         │  Prompt Type: Static   ││
│  │         │                              │  ┌──────────────────┐  ││
│  │         ▼                              │  │ Prompt Editor    │  ││
│  │    ┌─────────┐                         │  │ (Textarea)       │  ││
│  │    │ Node 3  │                         │  └──────────────────┘  ││
│  │    └─────────┘                         │                        ││
│  │                                        │  LLM Model:            ││
│  │                                        │  [Ollama ▼] [model ▼]  ││
│  │                                        │                        ││
│  │                                        │  [Cancel]  [Save]      ││
│  └────────────────────────────────────────┴────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Dependencies

| Library | Purpose | Version |
|---------|---------|---------|
| `reactflow` | Flow visualization | ^11.x |
| `@monaco-editor/react` | Prompt editor (syntax highlighting) | ^4.x (optional) |
| `zustand` | State management (existing) | Current version |

---

## 5. Config Loading Mechanism

### 5.1 Initialization Flow

```
Service Start
    │
    ▼
┌─────────────────────────────┐
│ Check if config exists in DB│
└─────────────────────────────┘
    │
    ├── Exists ──► Load from MongoDB ──► Override defaults
    │
    └── Not exists ──► Use code defaults ──► Write to MongoDB (init)
```

### 5.2 Default Config Definition

**Location**: `server/src/modules/langgraph/defaults/`

```javascript
// xiaoshudong.js
export const xiaoshudongDefault = {
  flowId: "xiaoshudong",
  flowName: "XiaoShuDong Chat",
  nodes: [
    {
      nodeId: "listening_response",
      nodeName: "Listening Response",
      promptType: "static",
      staticPrompt: `You are a warm, professional, empathetic counselor...`,
      llmEnabled: true,
      llmConfig: { source: "ollama", model: "deepseek-r1:14b", temperature: 0.7 }
    },
    {
      nodeId: "fortune_generator",
      nodeName: "Fortune Generator",
      promptType: "dynamic",
      dynamicSources: [
        { name: "User Context", description: "Event summary, emotional state, core concerns" },
        { name: "Book Content", description: "RAG retrieved ZiWei knowledge" },
        { name: "User Question", description: "Original user question" }
      ],
      editableSection: "## Analysis Requirements\nPlease provide...",
      llmEnabled: true,
      llmConfig: { source: "ollama", model: "ziwei-8b", temperature: 0.7 }
    },
    // ... other nodes
  ],
  edges: [...]
};
```

### 5.3 Config Loader Service

**Location**: `server/src/modules/langgraph/configLoader.js`

```javascript
class LangGraphConfigLoader {
  constructor() {
    this.configs = {};  // Memory cache
  }

  async initialize() {
    for (const flow of ['rolecard', 'xiaoshudong']) {
      const saved = await LangGraphConfigModel.findOne({ flowId: flow });
      if (saved) {
        this.configs[flow] = saved;
      } else {
        const defaultConfig = getDefaultConfig(flow);
        await LangGraphConfigModel.create(defaultConfig);
        this.configs[flow] = defaultConfig;
      }
    }
  }

  getNodeConfig(flowId, nodeId) {
    return this.configs[flowId]?.nodes.find(n => n.nodeId === nodeId);
  }

  getPrompt(flowId, nodeId) {
    const node = this.getNodeConfig(flowId, nodeId);
    if (node.promptType === 'static') {
      return node.staticPrompt;
    }
    return node.editableSection;
  }
}

export const configLoader = new LangGraphConfigLoader();
```

### 5.4 Node Code Usage Example

```javascript
// Modified listening_response node
import { configLoader } from '../../langgraph/configLoader.js';

export async function listeningResponse(state) {
  const prompt = configLoader.getPrompt('xiaoshudong', 'listening_response');
  const llmConfig = configLoader.getNodeConfig('xiaoshudong', 'listening_response').llmConfig;

  const response = await generateResponse(prompt, state, llmConfig);
  return { ...state, response };
}
```

---

## 6. Permission Control

### 6.1 Permission Initialization

**Migration**: `server/src/modules/langgraph/migrations/addPermission.js`

```javascript
async function ensureLangGraphPermission() {
  const existing = await Permission.findOne({ name: 'langgraph:edit' });
  if (!existing) {
    await Permission.create({
      name: 'langgraph:edit',
      description: 'Edit LangGraph flow configuration',
      category: 'system',
      createdAt: new Date()
    });
  }
}
```

### 6.2 Route Middleware

```javascript
import { protect, requirePermission } from '../admin/middleware.js';

const router = Router();

router.use(protect);
router.use(requirePermission('langgraph:edit'));

router.get('/flows', controller.getFlows);
// ... other routes
```

### 6.3 Frontend Permission Check

```typescript
// AdminSidebar.tsx
const menuItems = [
  // ... existing items
  ...(userPermissions.includes('langgraph:edit')
    ? [{ name: 'LangGraph Management', href: '/admin/langgraph', icon: GitBranch }]
    : [])
];
```

---

## 7. File Structure

### 7.1 New Backend Files

```
server/src/modules/langgraph/
├── index.js                    # Module entry
├── route.js                    # API routes
├── controller.js               # Controllers
├── service.js                  # Business logic
├── model.js                    # MongoDB Schema
├── configLoader.js             # Config loader
├── migrations/
│   └── addPermission.js        # Permission init
└── defaults/
    ├── index.js                # Default config export
    ├── rolecard.js             # AI role card defaults
    └── xiaoshudong.js          # XiaoShuDong defaults
```

### 7.2 New Frontend Files

```
web/app/admin/langgraph/
├── page.tsx                    # Main page
├── components/
│   ├── FlowTabs.tsx            # Tab switcher
│   ├── FlowCanvas.tsx          # Flow canvas
│   ├── NodeEditor.tsx          # Node editor panel
│   ├── PromptEditor.tsx        # Prompt editor
│   ├── ModelSelector.tsx       # Model selector
│   └── DynamicSources.tsx      # Dynamic sources display
└── hooks/
    └── useLangGraph.ts         # API Hook
```

### 7.3 Files to Modify

| File | Modification |
|------|-------------|
| `server/src/server.js` | Register langgraph route + load config on startup |
| `server/src/modules/xiaoshudong/nodes/*.js` | Use configLoader for prompts |
| `server/src/modules/chat/nodes/responseGenerator.js` | Use configLoader for LLM config |
| `web/components/admin/AdminSidebar.tsx` | Add LangGraph menu item |
| `web/lib/admin-api.ts` | Add langgraph API functions |
| `web/package.json` | Add reactflow dependency |

---

## 8. Implementation Phases

### Phase 1: Backend Foundation
- 1.1 Create Model (langgraph_configs)
- 1.2 Create default config files
- 1.3 Create ConfigLoader service
- 1.4 Create permission migration
- 1.5 Create API (Service + Controller + Route)

### Phase 2: Frontend Page
- 2.1 Install reactflow dependency
- 2.2 Create API Hook (useLangGraph)
- 2.3 Create page layout + tabs
- 2.4 Create flow canvas
- 2.5 Create node editor panel
- 2.6 Update sidebar menu

### Phase 3: Node Integration
- 3.1 Modify XiaoShuDong nodes to use configLoader
- 3.2 Modify Role Card nodes to use configLoader
- 3.3 Initialize config on service startup

---

## 9. Editable Nodes Summary

### XiaoShuDong Flow

| Node | Prompt Type | Editable Content |
|------|-------------|------------------|
| listening_response | Static | Full prompt |
| conversation_compressor | Static | Full prompt |
| fortune_generator | Dynamic | Show sources + edit analysis section |
| psychologist_response | Static | Full prompt |
| intent_classifier | Static | Full prompt |

### AI Role Card Flow

| Node | Prompt Type | Editable Content |
|------|-------------|------------------|
| response_generator | None (from role card) | LLM model only |

---

## 10. Technical Notes

- **Prompt Type "static"**: Full prompt is editable in a textarea
- **Prompt Type "dynamic"**: Shows data sources (read-only) + editable analysis section
- **Prompt Type "none"**: Only LLM model selection available
- **Model selection**: Dynamically fetch from Ollama + API providers
- **Config persistence**: MongoDB with updatedAt/updatedBy tracking
- **Effect timing**: Changes take effect on service restart
