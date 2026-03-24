# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
AFS-System/
├── .planning/              # Planning documents (codebase analysis)
├── data/                   # Static data files (ziwei-chunks for RAG)
├── docs/                   # Project documentation and plans
├── documentation/          # Docusaurus documentation site
├── logs/                   # Application logs
├── modelserver/            # Python FastAPI LLM server (Ollama proxy)
├── mongoserver/            # MongoDB initialization and config
├── scripts/                # Deployment and utility scripts
├── server/                 # Node.js Express backend
├── web/                    # Next.js frontend application
├── .env                    # Environment variables (not committed)
├── docker-compose.yml      # Docker service orchestration
├── README.md               # Project documentation
└── CONTRIBUTING.md         # Contribution guidelines
```

## Directory Purposes

**server/:**
- Purpose: Node.js/Express backend API
- Contains: REST API endpoints, business logic, LLM integration, memory system
- Key files: `src/server.js` (entry), `package.json` (dependencies)

**web/:**
- Purpose: Next.js 15 frontend application
- Contains: Pages, components, hooks, stores, API client
- Key files: `app/layout.tsx` (root), `package.json` (dependencies)

**modelserver/:**
- Purpose: Python FastAPI server for LLM inference
- Contains: Ollama proxy, model management, training notebooks
- Key files: `api/main.py` (entry), `requirements.txt` (dependencies)

**data/:**
- Purpose: Static data for RAG (Retrieval Augmented Generation)
- Contains: `ziwei-chunks/` - Chinese astrology knowledge base

**documentation/:**
- Purpose: Docusaurus-based project documentation site
- Contains: Markdown docs, blog posts, static assets

**mongoserver/:**
- Purpose: MongoDB configuration and initialization
- Contains: Docker init scripts, database files

## Server Structure (`server/src/`)

```
server/src/
├── server.js               # Main entry point - Express app setup
├── core/                   # Cross-cutting concerns
│   ├── config/             # Configuration management
│   ├── database/           # MongoDB connection (connection.js)
│   ├── hooks/              # Auto-hook registry for lifecycle events
│   ├── llm/                # LLM client, multi-provider support, prompts
│   ├── middleware/         # Express middleware
│   ├── storage/            # Dual storage (MongoDB + filesystem)
│   ├── utils/              # Logger and utilities
│   └── ziwei/              # Chinese astrology calculations
├── modules/                # Feature modules
│   ├── admin/              # Admin panel: users, permissions, settings
│   ├── auth/               # Authentication (JWT, login/register)
│   ├── chat/               # AI chat with LangGraph orchestration
│   ├── langgraph/          # LangGraph config management
│   ├── memory/             # Conversation memory system
│   ├── qa/                 # Question-answer system
│   ├── rolecard/           # AI role card generation (v2)
│   ├── roles/              # User roles and permissions
│   ├── sentiment/          # Sentiment analysis
│   ├── settings/           # System settings
│   ├── user/               # User management
│   ├── xiaoshudong/        # "Little Tree Hole" feature (psychological support)
│   └── ziwei/              # Ziwei Doushu (Chinese astrology) charts
└── storage/                # Persistent storage (userdata, chroma_db)
```

### Module Structure Pattern

Each module typically contains:
- `route.js` - Express router definitions
- `controller.js` - Request handlers
- `service.js` - Business logic
- `model.js` - Mongoose models
- `repository.js` - Data access (optional)
- `middleware.js` - Module-specific middleware (optional)
- `nodes/` - LangGraph nodes (for chat/xiaoshudong)
- `state/` - State classes (for conversation management)
- `prompts/` - LLM prompt templates

## Web Structure (`web/`)

```
web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth group layout
│   ├── admin/              # Admin panel pages
│   │   ├── langgraph/      # LangGraph configuration UI
│   │   ├── users/          # User management
│   │   ├── memories/       # Memory viewer
│   │   ├── models/         # LLM model management
│   │   └── ...
│   ├── chat/               # Main chat interface
│   │   ├── components/     # Chat-specific components
│   │   └── hooks/          # useChat hook
│   ├── rolecard/           # Role card viewer
│   ├── login/              # Login page
│   ├── register/           # Registration page
│   └── dashboard/          # User dashboard
├── components/             # Shared components
│   ├── admin/              # Admin components
│   ├── chat/               # Chat components
│   ├── providers/          # Context providers
│   └── ui/                 # UI primitives (shadcn/ui)
├── hooks/                  # Global custom hooks
├── lib/                    # Utilities and API clients
│   ├── api.ts              # Main API client
│   ├── admin-api.ts        # Admin API client
│   ├── chat.ts             # Chat-specific API
│   ├── permissions.ts      # Permission utilities
│   └── utils.ts            # General utilities
├── stores/                 # Zustand stores
│   ├── auth.ts             # Authentication state
│   ├── chatSession.ts      # Chat session state
│   ├── permission.ts       # Permission state
│   └── admin-auth.ts       # Admin auth state
├── types/                  # TypeScript type definitions
└── public/                 # Static assets
```

## Key File Locations

**Entry Points:**
- `server/src/server.js`: Backend entry point
- `web/app/layout.tsx`: Frontend root layout
- `modelserver/api/main.py`: LLM server entry
- `docker-compose.yml`: Container orchestration

**Configuration:**
- `server/package.json`: Backend dependencies and scripts
- `web/package.json`: Frontend dependencies and scripts
- `modelserver/requirements.txt`: Python dependencies
- `.env`: Environment variables (not in repo)

**Core Logic:**
- `server/src/modules/chat/orchestrator.js`: LangGraph orchestration
- `server/src/modules/chat/state/ConversationState.js`: Conversation state
- `server/src/modules/chat/edges/edges.js`: Graph routing logic
- `server/src/modules/chat/nodes/*.js`: Processing nodes
- `server/src/core/llm/`: LLM client and providers

**Data Models:**
- `server/src/modules/user/model.js`: User model
- `server/src/modules/chat/model.js`: Chat session model
- `server/src/modules/memory/MemoryStore.js`: Memory storage
- `server/src/modules/rolecard/v2/`: Role card generators

**Testing:**
- `server/tests/`: Test files (unit, integration)
- `server/vitest.config.*`: Test configuration

## Naming Conventions

**Files:**
- Modules: lowercase with dashes (`role-card-generator.js`)
- React components: PascalCase (`ChatPanel.tsx`, `Sidebar.tsx`)
- Hooks: camelCase with `use` prefix (`useChat.ts`, `useLangGraph.ts`)
- Utilities: camelCase (`logger.js`, `api.ts`)
- Test files: `.test.js` or `.spec.js` suffix

**Directories:**
- Modules: lowercase, singular (`chat/`, `memory/`, `user/`)
- Pages: lowercase (`admin/`, `chat/`, `login/`)
- Components: lowercase (`components/`, `ui/`)

**Code:**
- Classes: PascalCase (`ChatGraphOrchestrator`, `ConversationState`)
- Functions: camelCase (`sendMessage`, `preloadSession`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_GUARDRAIL_RULES`)
- Private methods: underscore prefix (`_connectWithRetry`)

## Where to Add New Code

**New API Endpoint:**
1. Create module in `server/src/modules/<feature>/`
2. Add `route.js`, `controller.js`, `service.js`
3. Register route in `server/src/server.js`
4. Add frontend API client in `web/lib/`

**New Chat Node:**
1. Create node file: `server/src/modules/chat/nodes/<name>.js`
2. Register in `orchestrator.js` this.nodes
3. Add edge/route in `edges/edges.js`
4. Update `ConversationState.js` if new state fields needed

**New Frontend Page:**
1. Create directory: `web/app/<page-name>/`
2. Add `page.tsx` (and `layout.tsx` if needed)
3. Create components in `web/components/<page-name>/` or reuse
4. Add hooks in `web/app/<page-name>/hooks/` or `web/hooks/`

**New Memory Feature:**
1. Add logic to `server/src/modules/memory/`
2. Create or update prompts in `memory/prompts/`
3. Integrate with `MemoryExtractor` or `TopicChunker`

**New UI Component:**
1. Shared component: `web/components/`
2. Page-specific: `web/app/<page>/components/`
3. UI primitive: `web/components/ui/` (shadcn/ui style)

## Special Directories

**server/storage/userdata/:**
- Purpose: User-specific data files (role cards, profiles)
- Generated: Yes (by DualStorage)
- Committed: No (in .gitignore)

**server/storage/chroma_db/:**
- Purpose: ChromaDB vector database files
- Generated: Yes
- Committed: No

**data/ziwei-chunks/:**
- Purpose: Pre-processed Chinese astrology knowledge for RAG
- Generated: No (manually curated)
- Committed: Yes

**web/.next/:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**.planning/:**
- Purpose: Codebase analysis and planning documents
- Generated: Yes (by GSD commands)
- Committed: Yes

---

*Structure analysis: 2026-03-24*
