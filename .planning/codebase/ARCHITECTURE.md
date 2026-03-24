# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Modular Monolith with Service-Oriented Backend and Next.js Frontend

**Key Characteristics:**
- Backend follows a layered architecture with modular feature organization (modules pattern)
- Frontend uses Next.js App Router with client-side state management via Zustand
- LLM orchestration via LangGraph with node-based processing pipeline
- Dual storage strategy: MongoDB for persistence + local filesystem for user data
- Microservices-style deployment via Docker Compose

## Layers

**API Layer:**
- Purpose: HTTP request handling and routing
- Location: `server/src/modules/*/route.js`, `server/src/modules/*/controller.js`
- Contains: Express routes, request validation, response formatting
- Depends on: Service layer, middleware
- Used by: Frontend web app, external clients

**Service Layer:**
- Purpose: Business logic and orchestration
- Location: `server/src/modules/*/service.js`, `server/src/core/llm/`
- Contains: Domain logic, LLM integration, memory management
- Depends on: Data layer, external services (Ollama, ChromaDB)
- Used by: Controllers

**Data Layer:**
- Purpose: Data persistence and retrieval
- Location: `server/src/modules/*/model.js`, `server/src/modules/*/repository.js`, `server/src/core/storage/`
- Contains: Mongoose models, MongoDB operations, dual storage logic
- Depends on: MongoDB, filesystem
- Used by: Services

**Core Layer:**
- Purpose: Cross-cutting concerns and shared utilities
- Location: `server/src/core/`
- Contains: Database connection, logging, middleware, LLM client, storage abstractions
- Depends on: External packages
- Used by: All other layers

## Data Flow

**Chat Message Flow (Primary Path):**

1. Frontend sends message via `web/lib/chat.ts` -> API endpoint
2. `server/src/modules/chat/route.js` receives request
3. `ChatGraphOrchestrator.preloadSession()` loads role card and relation layers
4. `ChatGraphOrchestrator.sendMessage()` creates `ConversationState`
5. LangGraph pipeline executes nodes:
   - `intent_classifier`: Classifies intent (chatting vs venting)
   - `token_monitor`: Checks token usage thresholds
   - Route by intent:
     - Chat path: `memory_check` -> `rag_retriever` -> `context_builder` -> `response_generator`
     - Venting path: `listening_phase` -> `chart_rag_retriever` -> `fortune_generator` -> `role_translator`
   - `token_response`: Handles fatigue prompts
   - `output_formatter`: Final response formatting
6. Response returned to frontend
7. Memory saved via `MemoryExtractor` and `TopicChunker`

**Role Card Generation Flow:**

1. User answers questionnaires
2. `CoreLayerGenerator` extracts personality traits from answers
3. `RelationLayerGenerator` creates relation-specific layers
4. `PromptAssembler` combines core + relation + guardrails
5. Saved to both MongoDB and filesystem via `DualStorage`

**State Management:**
- Frontend: Zustand stores (`web/stores/`) for global state
- Backend: In-memory `activeSessions` Map + MongoDB for persistence
- Conversation: `ConversationState` class holds all conversation context

## Key Abstractions

**ConversationState:**
- Purpose: Encapsulates all conversation context for LangGraph nodes
- Examples: `server/src/modules/chat/state/ConversationState.js`
- Pattern: Mutable state object passed through pipeline nodes

**ChatGraphOrchestrator:**
- Purpose: Manages LangGraph execution, session lifecycle, memory storage
- Examples: `server/src/modules/chat/orchestrator.js`
- Pattern: Facade + State Machine

**DualStorage:**
- Purpose: Ensures data redundancy across MongoDB and filesystem
- Examples: `server/src/core/storage/dual.js`
- Pattern: Repository with dual-write strategy

**Memory System:**
- Purpose: Extract, compress, and store conversation memories
- Examples: `server/src/modules/memory/` (MemoryStore, MemoryExtractor, Compressor, TopicChunker)
- Pattern: Pipeline with chunking strategy

## Entry Points

**Backend Server:**
- Location: `server/src/server.js`
- Triggers: Node.js process start
- Responsibilities: MongoDB connection, route registration, middleware setup, scheduler start

**Frontend App:**
- Location: `web/app/layout.tsx`
- Triggers: Next.js server start
- Responsibilities: Provider setup (Theme, Permission, NavigationGuard), root layout

**LangGraph Pipeline:**
- Location: `server/src/modules/chat/orchestrator.js` -> `executeGraph()`
- Triggers: User message via `sendMessage()`
- Responsibilities: Node execution orchestration, conditional routing, performance tracking

**Model Server:**
- Location: `modelserver/api/main.py`
- Triggers: FastAPI startup
- Responsibilities: LLM inference via Ollama proxy

## Error Handling

**Strategy:** Centralized error handling with logging

**Patterns:**
- Winston logger for structured logging: `server/src/core/utils/logger.js`
- Try-catch blocks in controllers return error responses
- LLM errors return `{ success: false, error: message }` without throwing
- Database operations use retry logic: `MongoDBConnection.withRetry()`

## Cross-Cutting Concerns

**Logging:** Winston-based structured logging with file rotation
- Logger: `server/src/core/utils/logger.js`
- Request logging middleware: `requestLogger`, `apiLogger`

**Validation:**
- Mongoose schema validation for database models
- Manual validation in controllers
- No centralized validation library

**Authentication:**
- JWT-based authentication
- Middleware: `server/src/modules/auth/middleware.js` -> `protect` function
- Token stored in localStorage on frontend
- Admin auth uses separate route: `/admin-auth`

**Authorization:**
- Permission-based system for admin routes
- Role-based access control
- Permission provider in frontend: `web/components/providers/PermissionProvider.tsx`

## Deployment Architecture

**Docker Compose Services:**
- `web`: Next.js frontend (port 3002)
- `server`: Express backend (port 3001)
- `mongoserver`: MongoDB 7.0 (port 27018)
- `modelserver`: Ollama LLM server (port 8000)
- `chromaserver`: ChromaDB vector store (port 8001)
- `docs`: Docusaurus documentation (port 3003)

**Network:** All services on `afs-network` bridge network

---

*Architecture analysis: 2026-03-24*
