# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- JavaScript (ES6+) - Server-side logic in `server/src/`
- TypeScript 5.3+ - Frontend in `web/` and admin panel
- Python 3.x - Model server utilities in `modelserver/`

**Secondary:**
- Markdown - Documentation in `docs/` and `documentation/`
- YAML - Docker Compose and configuration files
- JSON - Package manifests and data files

## Runtime

**Environment:**
- Node.js 20.x (Alpine Linux in Docker)
- npm package manager
- Python 3.x with pip for model server

**Package Manager:**
- npm (Node.js)
- Lockfiles: `package-lock.json` present in `server/` and `web/`

## Frameworks

**Core:**
- Next.js 15.1.0 - Frontend framework with App Router
- Express 4.19.2 - Backend REST API server
- LangChain 1.2.17 - LLM orchestration framework
- LangGraph 1.1.3 - Graph-based AI workflow orchestration

**Testing:**
- Vitest 4.0.18 - Unit and integration testing
- Jest 30.2.0 - Alternative test runner
- Supertest 7.2.2 - API endpoint testing

**Build/Dev:**
- Next.js built-in bundler - Frontend builds
- nodemon 3.1.7 - Development hot reload for server
- Docker - Containerized deployment

## Key Dependencies

**Critical:**
- `mongoose` 8.7.0 - MongoDB ODM for data persistence
- `@langchain/ollama` 1.2.2 - Ollama LLM integration
- `@langchain/core` 1.1.19 - Core LangChain abstractions
- `iztro` 2.5.7 - Chinese astrology (Purple Star) calculations
- `jsonwebtoken` 9.0.3 - JWT authentication
- `bcryptjs` 2.4.3 - Password hashing
- `openai` 4.73.0 - OpenAI API client
- `faiss-node` 0.5.1 - Vector similarity search

**Infrastructure:**
- `axios` 1.7.7 - HTTP client for external API calls
- `socket.io` 4.7.5 - WebSocket communication (available, not actively used in current routes)
- `winston` 3.19.0 - Logging framework
- `prom-client` 15.1.0 - Prometheus metrics
- `dotenv` 16.4.5 - Environment configuration
- `multer` 1.4.5-lts.1 - File upload handling
- `docx` 9.6.1 - Word document generation

**Frontend:**
- `react` 19.0.0 / `react-dom` 19.0.0 - UI library
- `zustand` 4.5.0 - State management
- `recharts` 3.7.0 - Data visualization
- `reactflow` 11.11.4 - Graph/flow diagram editor
- `lucide-react` 0.400.0 - Icon library
- `date-fns` 3.0.0 - Date manipulation
- `next-themes` 0.4.6 - Dark/light mode support

**UI Components:**
- Radix UI primitives:
  - `@radix-ui/react-dialog` 1.0.5
  - `@radix-ui/react-dropdown-menu` 2.0.6
  - `@radix-ui/react-select` 2.0.0
  - `@radix-ui/react-tabs` 1.0.4
  - `@radix-ui/react-toast` 1.1.5
  - `@radix-ui/react-checkbox` 1.3.3
  - `@radix-ui/react-switch` 1.2.6
- `tailwindcss` 3.4.0 - Utility-first CSS
- `tailwindcss-animate` 1.0.7 - Animation utilities
- `class-variance-authority` 0.7.0 - Component variants
- `clsx` 2.1.0 / `tailwind-merge` 2.2.0 - Class name utilities

**Documentation:**
- Docusaurus 3.9.2 - Documentation website

**Model Server (Python):**
- FastAPI 0.115.0+ - API framework
- uvicorn 0.30.0+ - ASGI server
- torch 2.0.0+ - PyTorch ML framework
- transformers 4.35.0+ - Hugging Face transformers
- peft 0.7.1 - Parameter-efficient fine-tuning
- bitsandbytes 0.41.1 - Quantization
- llama-cpp-python - GGUF model support
- ollama - Ollama Python client

## Configuration

**Environment:**
- `.env` file at project root (not committed)
- `.env.example` template provided
- Environment variables loaded via `dotenv`

**Build:**
- `docker-compose.yml` - Multi-service orchestration
- `Dockerfile-server` - Node.js server container
- `Dockerfile-modelserver` - Ollama model server container
- `tsconfig.json` - TypeScript configuration (web)
- `next.config.js` - Next.js configuration

**Key configs required:**
- `MONGO_URI` - MongoDB connection string
- `LLM_BACKEND` - Choose between 'ollama' or 'deepseek'
- `OLLAMA_BASE_URL` - Ollama server URL
- `JWT_SECRET` - JWT signing secret

## Platform Requirements

**Development:**
- Node.js 20.x or higher
- Docker and Docker Compose
- NVIDIA GPU (optional, for local LLM inference)
- 8GB+ RAM recommended

**Production:**
- Docker Swarm or Kubernetes for orchestration
- NVIDIA GPU with CUDA support for model inference
- MongoDB database (containerized or managed)
- ChromaDB for vector storage
- Ollama server for LLM inference

---

*Stack analysis: 2026-03-24*
