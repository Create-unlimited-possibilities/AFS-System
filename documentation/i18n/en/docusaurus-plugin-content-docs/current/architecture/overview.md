---
sidebar_position: 2
---

# System Architecture

AFS System follows a modern microservices architecture designed for scalability and maintainability.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Next.js Frontend (Port 3002)                │    │
│  │         React + TypeScript + TailwindCSS                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            Express.js Backend (Port 3001)                │    │
│  │                 Modular Architecture                      │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │    │
│  │  │ Auth │ │ User │ │  QA  │ │ Chat │ │RoleCard│         │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌─────────────┐ ┌─────────────────┐
│    MongoDB        │ │  ChromaDB   │ │     Ollama      │
│  (Port 27018)     │ │ (Port 8001) │ │  (Port 8000)    │
│                   │ │             │ │                 │
│  User Data        │ │ Vector      │ │ Local LLM       │
│  Answers          │ │ Embeddings  │ │ Embeddings      │
│  Role Cards       │ │ RAG Index   │ │ BGE-M3 Model    │
└───────────────────┘ └─────────────┘ └─────────────────┘
```

## Core Components

### Frontend (Web)
- **Framework**: Next.js 15 with App Router
- **UI**: React 19 + TypeScript
- **Styling**: TailwindCSS
- **State**: Zustand
- **Theme**: next-themes for dark mode

### Backend (Server)
- **Framework**: Express.js
- **Architecture**: Modular with Repository-Service-Controller pattern
- **Validation**: Joi schemas
- **Authentication**: JWT-based

### AI Services
- **Conversation**: LangGraph stateful workflows
- **Embeddings**: BGE-M3 via Ollama
- **Vector Store**: ChromaDB for RAG

### Databases
- **MongoDB**: Primary data storage
- **File System**: User data and role card storage
- **ChromaDB**: Vector embeddings for RAG

## Data Flow

```
User Question → Controller → Service → Repository → Database
                    ↓
              LangGraph Agent
                    ↓
              RAG Retrieval (ChromaDB)
                    ↓
              LLM Response (Ollama)
                    ↓
              Structured Answer
```

## Design Principles

1. **Modularity** - Each feature is a self-contained module
2. **Separation of Concerns** - Clear layers for data, business, and presentation
3. **Scalability** - Services can be scaled independently
4. **Privacy First** - RBAC at every layer
