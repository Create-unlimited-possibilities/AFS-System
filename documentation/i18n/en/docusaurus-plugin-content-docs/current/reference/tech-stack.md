---
sidebar_position: 1
---

# Tech Stack

AFS System adopts a modern front-end and back-end separated architecture, combining AI technology to provide digital memory heritage services for the elderly.

## Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.1.x | React framework (App Router) |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.4.x | Styling solution |
| shadcn/ui | latest | Component library |
| Radix UI | latest | Accessible component primitives |
| Zustand | 4.5.x | State management |
| Axios | 1.7.x | HTTP client |
| Lucide React | 0.400+ | Icon library |
| date-fns | 3.x | Date handling |
| next-themes | 0.4.x | Theme switching |
| Recharts | 3.7.x | Charts library |

### Frontend Architecture Features

- **App Router**: Using Next.js 15's latest App Router architecture
- **Server Components**: Full utilization of React Server Components for performance optimization
- **Type Safety**: Global TypeScript ensures code quality
- **Responsive Design**: Support for desktop and mobile devices
- **Accessibility**: WCAG-compliant components based on Radix UI

## Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime environment |
| Express.js | 4.19.x | Web framework |
| MongoDB | 8.x | Primary database |
| Mongoose | 8.7.x | ODM (Object Document Mapping) |
| JWT | 9.x | Authentication |
| bcryptjs | 2.4.x | Password encryption |
| Socket.IO | 4.7.x | Real-time communication |
| Winston | 3.19.x | Logging management |
| Multer | 1.4.x | File upload handling |

### Backend Architecture Features

- **Three-tier Architecture**: Controller-Service-Repository layered design
- **Modular Design**: Code organized by functional modules (auth, user, chat, memory, etc.)
- **Dual Storage**: Hybrid storage solution with MongoDB + file system
- **RESTful API**: Standard REST API design
- **Real-time Communication**: Socket.IO for real-time chat

## AI/LLM Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| LangChain | 1.2.x | LLM application framework |
| LangGraph | 1.1.x | Conversation orchestration |
| LangChain Ollama | 1.2.x | Ollama integration |
| ChromaDB | latest | Vector database |
| OpenAI SDK | 4.73.x | API fallback option |
| tiktoken | 1.x | Token counting |
| Ollama | latest | Local model service |
| bge-m3 | latest | Embedding model |

### AI Architecture Features

- **Local First**: Using Ollama for local deployment to protect privacy
- **Multi-model Support**: Support for DeepSeek, ChatGLM, and other models
- **RAG System**: Retrieval Augmented Generation for improved conversation quality
- **Conversation Orchestration**: LangGraph for complex conversation flows
- **Vector Storage**: ChromaDB for semantic retrieval

## Containerization

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Service orchestration |
| Alpine Linux | Lightweight base image |

## Development Tools

| Tool | Purpose |
|------|---------|
| Vitest | Backend testing |
| Jest | Unit testing supplement |
| ESLint | Code linting |
| Docusaurus | Documentation site |
| Nodemon | Development hot reload |

## Service Port Mapping

| Service | Internal Port | External Port | Description |
|---------|---------------|---------------|-------------|
| Frontend Web | 3000 | 3002 | Next.js application |
| Backend API | 3000 | 3001 | Express service |
| Documentation Site | 80 | 3003 | Docusaurus documentation |
| Ollama | 11434 | 8000 | AI model service |
| ChromaDB | 8000 | 8001 | Vector database |
| MongoDB | 27017 | 27018 | Primary database |

## Directory Structure

```
afs-system/
├── web/                    # Next.js frontend application
│   ├── app/               # App Router pages
│   ├── components/        # React components and UI components
│   ├── lib/              # API client and utility functions
│   ├── stores/           # Zustand state management
│   └── types/            # TypeScript type definitions
├── server/                # Express backend API service
│   ├── src/
│   │   ├── controllers/   # Controller layer
│   │   ├── services/      # Business logic layer
│   │   ├── repositories/  # Data access layer
│   │   ├── models/        # Data models
│   │   ├── routes/        # Route definitions
│   │   ├── middleware/    # Middleware
│   │   ├── core/          # Core functionality (LLM, storage, logging)
│   │   └── modules/       # Business modules
│   └── storage/          # File storage
├── modelserver/           # AI model service
├── mongoserver/           # MongoDB configuration
├── documentation/         # Docusaurus documentation site
├── docker-compose.yml     # Container orchestration configuration
└── .env.example          # Environment variable template
```

## Database Design

### MongoDB Collections

- `users`: User basic information
- `roles`: AI role cards
- `questions`: Questionnaire questions
- `answers`: Questionnaire answers
- `chats`: Chat records
- `memories`: Memory data
- `sentiments`: Sentiment analysis
- `admins`: Administrator accounts
- `permissions`: Permission definitions
- `invitecodes`: Invitation code management

### File Storage

- `/storage/uploads`: User uploaded files
- `/storage/avatars`: User avatars
- `/storage/chroma_db`: ChromaDB data

## System Requirements

### Development Environment

- Node.js >= 20.0
- npm >= 9.0
- Docker & Docker Compose
- Git

### Production Environment Recommended Configuration

- CPU: 4 cores or more
- Memory: 8GB or more (AI model operation requires more)
- Storage: 50GB or more available space
- GPU: NVIDIA GPU (optional, for AI inference acceleration)

## Browser Compatibility

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## Related Documentation

- [Environment Variables](./env.md)
- [Docker Configuration](./config.md)
- [FAQ](./faq.md)
