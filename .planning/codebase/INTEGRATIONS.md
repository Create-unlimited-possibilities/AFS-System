# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**LLM Providers:**

- **Ollama** (Primary local LLM)
  - Purpose: Local LLM inference for chat, role cards, and AI features
  - SDK/Client: `@langchain/ollama`, native HTTP API
  - Endpoint: `OLLAMA_BASE_URL` (default: `http://modelserver:11434`)
  - Default Model: `deepseek-r1:14b` (configurable via `OLLAMA_MODEL`)
  - Health Check: `/api/tags` endpoint (no token consumption)
  - Files: `server/src/core/llm/client.js`, `server/src/modules/langgraph/model.js`

- **DeepSeek API** (Cloud LLM alternative)
  - Purpose: Cloud-based LLM when local inference unavailable
  - SDK/Client: `@langchain/openai` (OpenAI-compatible)
  - Auth: `DEEPSEEK_API_KEY`
  - Endpoint: `DEEPSEEK_BASE_URL` (default: `https://api.deepseek.com/v1`)
  - Models: `deepseek-chat`, `deepseek-reasoner`
  - Files: `server/src/core/llm/client.js`

- **OpenAI API** (Backup/embeddings)
  - Purpose: Alternative LLM and embeddings
  - SDK/Client: `openai` npm package, `@langchain/openai`
  - Auth: `OPENAI_API_KEY`
  - Files: `server/src/core/llm/client.js`, `server/src/core/storage/embedding.js`

**Embedding Services:**

- **Ollama Embeddings** (Primary)
  - Purpose: Text embeddings for RAG and similarity search
  - Model: `bge-m3` (configurable via `EMBEDDING_MODEL`)
  - Files: `server/src/core/storage/embedding.js`

- **OpenAI Embeddings** (Alternative)
  - Purpose: Cloud-based embeddings
  - Model: `text-embedding-3-small`
  - Auth: `OPENAI_API_KEY`
  - Files: `server/src/core/storage/embedding.js`

**Translation Services:**

- **Google Cloud Translate** (Optional)
  - Purpose: Text translation
  - Auth: `GOOGLE_TRANSLATE_API_KEY`
  - Status: Optional integration

## Data Storage

**Databases:**

- **MongoDB**
  - Purpose: Primary database for users, sessions, role cards, chat history
  - Connection: `MONGO_URI` (default: `mongodb://mongoserver:27017/afs_db`)
  - Client: `mongoose` 8.7.0
  - Database Name: `afs_db`
  - Files: `server/src/core/database/connection.js`, `server/src/server.js`
  - Collections: Users, Roles, ChatSessions, RoleCards, Questions, Answers, LangGraphConfigs

**Vector Storage:**

- **ChromaDB**
  - Purpose: Vector database for RAG (Retrieval-Augmented Generation)
  - Connection: `CHROMA_URL` (default: `http://chromaserver:8000`)
  - API Version: v2 REST API
  - Client: Custom HTTP client (no npm package dependency)
  - Files: `server/src/core/storage/chroma.js`
  - Storage Path: `./server/storage/chroma_db`

- **FAISS** (Alternative)
  - Purpose: Local vector similarity search
  - Client: `faiss-node` 0.5.1
  - Files: Used in embedding and retrieval workflows

**File Storage:**

- **Local Filesystem**
  - Purpose: User uploads, role card data, chat exports
  - Path: `./server/storage/`
  - Client: `fs-extra` for enhanced file operations
  - Files: `server/src/core/storage/file.js`, `server/src/core/storage/dual.js`

**Caching:**

- None currently implemented (Redis available in requirements but not actively used)

## Authentication & Identity

**Auth Provider:**

- **Custom JWT Authentication**
  - Implementation: `jsonwebtoken` 9.0.3 + `bcryptjs` 2.4.3
  - Token Storage: localStorage on frontend
  - Token Header: `Authorization: Bearer <token>`
  - Files:
    - `server/src/modules/auth/middleware.js` - Token verification
    - `server/src/modules/auth/service.js` - Login/registration logic
    - `web/stores/auth.ts` - Frontend auth state

**Admin Authentication:**

- Separate admin auth system with invite codes
  - Invite Code: `ADMIN_INVITE_CODE`
  - Default Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  - Files: `server/src/modules/admin/authRoute.js`, `web/stores/admin-auth.ts`

## Monitoring & Observability

**Error Tracking:**

- Winston logger for structured logging
  - Files: `server/src/core/utils/logger.js`
  - Log levels: error, warn, info, debug
  - Request logging middleware in `server/src/server.js`

**Metrics:**

- **Prometheus**
  - Client: `prom-client` 15.1.0
  - Purpose: System and application metrics
  - Endpoint: Available for scraping

**Health Checks:**

- `/api/health` - Backend health endpoint
- LLM health check via `LLMClient.healthCheck()` method
- Ollama: `/api/tags` endpoint
- DeepSeek/OpenAI: `/v1/models` endpoint

## CI/CD & Deployment

**Hosting:**

- **Docker Compose**
  - Multi-container orchestration
  - Services: web, server, mongoserver, modelserver, chromaserver, docs
  - Network: `afs-network` (bridge driver)

**Container Services:**

| Service | Port | Purpose |
|---------|------|---------|
| web | 3002 | Next.js frontend |
| server | 3001 | Express backend API |
| mongoserver | 27018 | MongoDB database |
| modelserver | 8000 | Ollama LLM server |
| chromaserver | 8001 | ChromaDB vector store |
| docs | 3003 | Docusaurus documentation |

**CI Pipeline:**

- Not detected - No CI configuration files found

## Environment Configuration

**Required env vars:**

```bash
# Database
MONGO_URI=mongodb://mongoserver:27017/afs_db

# Authentication
JWT_SECRET=your-jwt-secret-key
ADMIN_INVITE_CODE=your-admin-invite-code

# LLM Configuration
LLM_BACKEND=ollama|deepseek
OLLAMA_BASE_URL=http://modelserver:11434
OLLAMA_MODEL=deepseek-r1:14b
DEEPSEEK_API_KEY=your-deepseek-api-key  # If using deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Embedding
EMBEDDING_BACKEND=ollama|openai
EMBEDDING_MODEL=bge-m3

# Vector Database
CHROMA_URL=http://chromaserver:8000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_DOCS_URL=http://localhost:3003

# Optional
OPENAI_API_KEY=your-openai-api-key
GOOGLE_TRANSLATE_API_KEY=your-google-api-key
```

**Secrets location:**

- `.env` file at project root (not committed to git)
- Listed in `.gitignore`
- Template provided in `.env.example`

## Domain-Specific Integrations

**Chinese Astrology (Purple Star / Ziwei):**

- **iztro Library**
  - Purpose: Natal chart computation for role card generation
  - Version: 2.5.7
  - Features: 本命盘 (natal chart), 运限 (horoscope)
  - Files: `server/src/core/ziwei/ziweiService.js`

**Chat Orchestration:**

- **LangGraph**
  - Purpose: Multi-node AI workflow for chat conversations
  - Version: 1.1.3
  - Nodes: input processor, intent classifier, RAG retriever, response generator
  - Files: `server/src/modules/chat/orchestrator.js`, `server/src/modules/chat/nodes/`

## Webhooks & Callbacks

**Incoming:**

- None detected

**Outgoing:**

- None detected

## Integration Patterns

**LLM Client Factory:**

```javascript
// server/src/core/llm/client.js
const client = new LLMClient(model, {
  backend: 'ollama' | 'deepseek',
  temperature: 0.7,
  maxRetries: 3,
  timeout: 60000
});

// Generate response
const response = await client.generate(prompt);

// Stream response
await client.generateStream(prompt, {}, (chunk) => {
  // Handle chunk
});
```

**API Request Pattern (Frontend):**

```typescript
// web/lib/api.ts
import { apiRequest } from '@/lib/api';

const result = await apiRequest<ResponseType>('/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

---

*Integration audit: 2026-03-24*
