---
sidebar_position: 2
---

# AFS System Project Overview

## Project Introduction

AFS (Artificial Flashlight Simulation) is a digital memory heritage system designed for seniors. It creates personalized digital archives to help elderly users record their life stories and utilizes AI technology to provide personalized conversational experiences.

## Technical Architecture

### Core Components

- **Frontend (web)**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend Service (server)**: Node.js + Express with Controller-Service-Repository architecture
- **Database Service (mongoserver)**: MongoDB for structured data storage
- **AI Model Service (modelserver)**: Ollama for local AI model services
- **Vector Database (chromaserver)**: ChromaDB for semantic search
- **Container Deployment**: Docker + Docker Compose for one-click deployment

### Data Storage Architecture

The system uses a **dual storage architecture** combining MongoDB and file system:

- **MongoDB**: Stores users, questions, answers, and other structured data
- **File System**: Stores memory JSON files for RAG retrieval and role card generation
- **ChromaDB**: Vector database supporting semantic search

## Main Features

### 1. User Management
- User registration and login
- User profile management
- Role-based permission control

### 2. Questionnaire System
- Multi-layer question structure (basic/emotional)
- Role-based questions (elder/family/friend)
- Answer submission and progress tracking

### 3. AI Companion Chat
- LangGraph-based conversation orchestration
- RAG (Retrieval Augmented Generation) integration
- Personalized conversation based on user memories

### 4. Role Card System
- Automated role card generation from memories
- Multi-layer architecture (core, relation, safety calibration)
- Vector index for memory retrieval

### 5. Memory Management
- Dual storage (MongoDB + file system)
- Conversation memory persistence
- Memory compression and archival

### 6. Admin Panel
- User management and statistics
- Questionnaire management
- Memory database management
- System status monitoring
- Role and permission management
- Invite code system

## Service Ports

| Service | Port |
|---------|------|
| Frontend Web | 3000 |
| Backend API | 3001 |
| Documentation Site | 3003 |
| Ollama | 11434 |
| ChromaDB | 8000 |
| MongoDB | 27017 |

## Development Environment

- **Operating System**: Windows 10/11, macOS, Linux
- **Development Tools**: VS Code
- **Version Control**: Git
- **Container Technology**: Docker Desktop

## Quick Start

### Local Development
```bash
# Clone the project
git clone <your-repo-url>
cd AFS-System

# Configure environment
cp .env.example .env
# Edit .env file

# Start services
docker compose up -d
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Documentation: http://localhost:3003

## Documentation Structure

This project documentation is built with Docusaurus:

- [Project Overview](/docs/getting-started/project-overview)
- [Tech Stack](/docs/reference/tech-stack)
- [Architecture](/docs/architecture/overview)
- [Core Features](/docs/core/overview)
- [Getting Started](/docs/getting-started/installation)
- [Deployment](/docs/deployment/docker)

## Contributing

Contributions are welcome! Please ensure:

1. Follow project code standards
2. Add appropriate tests
3. Update relevant documentation
4. Submit clear commit messages

## Contact

- **Project Maintainers**: AFS Team
- **Last Updated**: 2026-02-23
