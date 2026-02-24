# AFS System (Artificial Flashlight Simulation)

[Chinese Doc](README.md) | [English Version](README.en.md)

## Project Overview

Artificial Flashlight Simulation System (AFS) is a digital memory heritage system designed for seniors. It creates personalized digital archives to help elderly users record their life stories and utilizes AI technology to train personalized conversational models. This allows the AI to communicate with warmth and familiarity, accompanying seniors as they revisit precious memories.

## Core Features

### 1. Digital Memory Archive
- Unique 16-digit exclusive ID for each senior
- Record fundamental information and emotional memories
- Structured storage for future review and preservation

### 2. AI Training and Conversation
- Personalized AI models trained on memory data (Ollama + LoRA)
- Exclusive AI communicates warmly and affectionately with seniors
- Continuously learning to better understand stories and emotions

### 3. Collaborative Filling Mechanism
- Family and friends can assist seniors via ID and email verification
- Multi-user collaboration to complete memory archives
- Age-friendly design to reduce usage barriers

### 4. Security and Privacy Protection
- Strict identity verification and access management
- Encrypted data storage for privacy protection
- Compliant with personal information protection regulations

### 5. Multi-Device Support
- Responsive web design for PC and mobile devices
- Intuitive user interface for easy operation
- Future extensibility to mini-programs, APPs, etc.

### 6. Admin Panel
- User management and statistics
- Questionnaire management
- Memory database monitoring
- System status monitoring (MongoDB, ChromaDB, LLM)
- Role and permission management
- Invite code system
- Environment variable online editing

## Technical Architecture

### Current Architecture (Post-Refactoring)

The system adopts a modern front-end and back-end decoupled architecture with the following main technology stack:

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express.js + Controller-Service-Repository Three-tier Architecture
- **AI Service**: Ollama + Python + LoRA fine-tuning
- **Database**: MongoDB + File System Dual Storage
- **Deployment**: Docker + Docker Compose

The system consists of multiple service modules:
- `web`: Next.js frontend application (port 3002)
- `server`: Express backend API service (port 3001)
- `docs`: Docusaurus documentation site (port 3003)
- `modelserver`: AI model training and inference service (port 8000)
- `chromaserver`: ChromaDB vector database (port 8001)
- `mongoserver`: MongoDB database service (port 27018)

### Refactoring History

The project was fully migrated from traditional HTML + Bootstrap frontend architecture to modern Next.js framework:

#### Refactoring Goals
- Migrate from traditional HTML + CSS + native JavaScript to modern Next.js framework
- Preserve existing Express + MongoDB backend (three-tier architecture, dual storage, questionnaire collection logic unchanged)
- Gradually implement modern frontend: componentization, type safety, responsive UI, better development/maintenance experience
- Reserve good extensibility for future digital life generation, LangGraph + LLM integration

#### Core Technical Decisions
- **Project Structure**: monorepo style unified code repository, but maintain container-separated deployment
- **Type System**: Global TypeScript enabled for type safety and refactoring reliability
- **Style Solution**: shadcn/ui + Tailwind CSS to replace Bootstrap 5
- **Data Fetching**: Hybrid approach of Server Components fetch + Server Actions
- **State Management**: Zustand lightweight state management to replace traditional state management

#### Architecture Changes
1. **Backend Architecture Refactoring**: Implemented Controller-Service-Repository pattern
2. **Frontend Modernization**: Next.js 15+ App Router + TypeScript + shadcn/ui + Tailwind
3. **Container Separation**: Frontend and backend containers deployed independently, maintaining physical separation
4. **API Compatibility**: Existing backend APIs completely unchanged, continue to be used

## Quick Start

### Environment Requirements

- Docker and Docker Compose
- Recommended configuration: Linux/macOS/Windows (WSL2) + NVIDIA GPU (for AI training acceleration)

### Local Deployment

1. Clone the project and navigate to the directory
   ```bash
   git clone <your-repo-url>
   cd afs-system
   ```

2. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit .env file to configure MongoDB and JWT keys
   ```

3. Start all services
   ```bash
   docker-compose up -d
   ```

4. Access the application
   - Frontend: http://localhost:3002 (Next.js application)
   - Backend API: http://localhost:3001 (Express service)
   - Documentation: http://localhost:3003 (Docusaurus)
   - AI Model Service: http://localhost:8000 (Ollama)
   - MongoDB: localhost:27018

### Usage Flow

1. **Account Registration**: Register with email, system auto-generates exclusive ID
2. **Fill Archive**: Log in and answer basic and emotional questions to create memory archive
3. **Collaborative Filling**: Share ID with family/friends to invite assistance
4. **Model Training**: System trains personalized AI model based on archive data
5. **Warm Conversation**: Engage in warm and friendly interactions with exclusive AI to revisit memories

## Development Guide

### Project Structure

```
afs-system/
├── web/             # Next.js frontend application
│   ├── app/         # Next.js App Router pages
│   ├── components/   # React components and UI components
│   ├── lib/         # API client and utility functions
│   └── stores/      # Zustand state management
├── server/          # Express backend API service
│   ├── src/
│   │   ├── controllers/  # Controller layer
│   │   ├── services/     # Business logic layer
│   │   ├── repositories/ # Data access layer
│   │   ├── models/       # Data models
│   │   ├── routes/       # Route definitions
│   │   └── middleware/   # Middleware
├── modelserver/     # AI model training and inference service
├── mongoserver/     # MongoDB configuration and initialization
├── docker-compose.yml  # Container orchestration configuration
└── README.md        # Project documentation
```

### Local Development

1. Install dependencies
   ```bash
   # Backend API service
   cd server && npm install
   
   # AI model service
   cd modelserver && pip install -r requirements.txt
   ```

2. Start services
   ```bash
   # Start MongoDB (Docker recommended for development)
   docker-compose up -d mongoserver
   
   # Start backend API
   cd server && npm run dev
   
   # Start frontend (live preview)
   cd client && npx live-server --port=8080
   ```

3. AI model local development
   ```bash
   # Start Ollama (requires GPU support)
   ollama serve
   
   # See modelserver/README.md for training and inference details
   ```

## Contribution Guidelines

Issues and Pull Requests are welcome!

## License

This project is licensed under the MIT License.

## Changelog

### v1.2.0 (2026-02-25)

#### New Features
- 🎛️ **Admin Panel**: Complete backend management system
  - Dashboard statistics and system status monitoring
  - User management (CRUD, status toggle, role assignment)
  - Questionnaire management (create, edit, reorder, batch import)
  - Memory management (view, vector index rebuild, export)
  - Role and permission management
  - Invite code system
  - Environment variable online editing
- 📚 **Documentation Site**: Docusaurus documentation system (port 3003)
- 💬 **AI Chat Optimization**: LangGraph workflow refactoring
  - Memory compression and extraction
  - Topic chunking
  - Proactive messaging management

#### Technical Improvements
- 🏗️ **Docker Port Adjustment**: Web port changed from 3000 to 3002, added docs port 3003
- 🎨 **Frontend Responsive Optimization**: Mobile adaptation improvements
- 🔧 **Fast System Status Check**: Docker container-based health checks

### v1.1.0 (2025-02-05)

#### New Features
- ✨ **Complete fix for "View Answers" functionality**: Resolved issue where assistant answers were not displaying correctly
- 🔧 **Dashboard statistics logic optimization**: "Received Answers" now only counts actual assistant answers, excluding user's own answers
- 📊 **Assist relations statistics correction**: "Assistants" count now accurately reflects real people assisting users

#### Technical Improvements
- 🏗️ **Backend API architecture optimization**: 
  - Fixed `AnswerController.getAnswersFromOthers()` return data structure
  - Added `questionId` field to returned answer objects
  - Created dedicated `getHelpers()` API for assistant statistics
- 🎨 **Frontend display optimization**:
  - Updated dashboard "Received Answers" display, showing basic and emotional layer answer distribution
  - Modified "Assistants" display text to accurately reflect functional meaning
  - Added detailed assistant answer statistics information

#### Bug Fixes
- 🐛 **Fixed "View Answers" page**: Assistant answers now display correctly
- 🐛 **Fixed dashboard statistics**: Resolved received answers statistics errors
- 🐛 **Fixed TypeScript type errors**: Added correct type definitions

#### Project Cleanup
- 🧹 **Deleted 17 redundant files**: Cleaned up ~618K of temporary and template files
- 📝 **Updated README documentation**: Added complete refactoring history
- 🗃️ **Preserved important data**: Protected MongoDB data, user file storage, and environment configuration

---

## Contact

- Project Maintainer: AFS Team
- Version: 1.2.0