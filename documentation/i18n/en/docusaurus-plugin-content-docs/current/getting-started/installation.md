---
sidebar_position: 1
---

# Installation Guide

This guide will help you set up AFS System on your local machine or server.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (20.10+) and Docker Compose
- **Node.js** (18+) - for development
- **Git** - for cloning the repository
- **GPU** (optional) - for local AI model acceleration

## Quick Start with Docker

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/Create-unlimited-possibilities/AFS-System.git
cd AFS-System

# Create environment file
cp .env.example .env

# Start all services
docker-compose up -d
```

## Service Ports

After starting the services, they will be available at:

| Service | Port | URL |
|---------|------|-----|
| Frontend (Web) | 3002 | http://localhost:3002 |
| Backend API | 3001 | http://localhost:3001 |
| Documentation | 3003 | http://localhost:3003 |
| MongoDB | 27018 | localhost:27018 |
| ChromaDB | 8001 | http://localhost:8001 |
| Ollama (LLM) | 8000 | http://localhost:8000 |

## Environment Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://mongoserver:27017/afs_db

# AI Services
MODEL_SERVER_URL=http://modelserver:8000
CHROMA_URL=http://chromaserver:8000

# Optional: Weather API
WEATHER_API_KEY=your_api_key_here
```

## Development Setup

For local development without Docker:

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install web dependencies
cd ../web
npm install
```

### 2. Start Services

```bash
# Start MongoDB (requires local installation)
mongod --dbpath ./data/db

# Start ChromaDB
chroma run --host 0.0.0.0 --port 8000

# Start Ollama
ollama serve
```

### 3. Start Applications

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend
cd web
npm run dev

# Terminal 3: Start docs (optional)
cd documentation
npm start
```

## Verifying Installation

1. Open http://localhost:3002 in your browser
2. Register a new account
3. Try answering some questions
4. Check the AI conversation feature

## Troubleshooting

### Port Conflicts

If you encounter port conflicts, modify the port mappings in `docker-compose.yml`.

### GPU Not Detected

Ensure NVIDIA Docker runtime is installed:
```bash
docker run --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Database Connection Issues

Check if MongoDB is running:
```bash
docker-compose ps mongoserver
```
