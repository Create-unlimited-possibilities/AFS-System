---
sidebar_position: 2
---

# Installation Guide

This guide will help you set up AFS System on your local machine or server. AFS System uses Docker Compose for easy deployment, with all services containerized for consistent environments.

## Prerequisites

Before you begin, ensure you have the following installed:

| Component | Version | Purpose |
|-----------|---------|---------|
| Docker | 20.10+ | Container runtime |
| Docker Compose | 2.0+ | Service orchestration |
| Node.js | 20.0+ | Development environment |
| Git | Any | Version control |

### Checking Prerequisites

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Check Node.js version
node --version

# Check Git version
git --version
```

## Quick Start with Docker

The fastest way to get AFS System running is using Docker Compose:

### 1. Clone the Repository

```bash
git clone https://github.com/Create-unlimited-possibilities/AFS-System.git
cd AFS-System
```

### 2. Configure Environment Variables

Copy the environment variable template and configure necessary parameters:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Service Ports
WEB_PORT=3002
SERVER_PORT=3001

# Database Configuration
MONGO_URI=mongodb://mongoserver:27017/afs_db

# JWT Configuration
JWT_SECRET=your-secret-key-change-this

# AI Services
OLLAMA_BASE_URL=http://modelserver:11434
CHROMA_URL=http://chromaserver:8000

# Optional: External Services
WEATHER_API_KEY=your_weather_api_key_here
```

### 3. Start All Services

```bash
docker compose up -d
```

This command will start all services:
- **web** - Next.js frontend application
- **server** - Express.js backend API
- **mongoserver** - MongoDB database
- **modelserver** - Ollama AI model service
- **chromaserver** - ChromaDB vector database

### 4. Verify Services

Check that all services are running:

```bash
docker compose ps
```

Access the services at these URLs:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3002 | Main web application |
| Backend API | http://localhost:3001/api/health | API health check |
| Ollama | http://localhost:8000 | AI model service |
| ChromaDB | http://localhost:8001 | Vector database |
| Documentation | http://localhost:3003 | Documentation site |

## Service Port Mappings

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| web | 3000 | 3002 |
| server | 3001 | 3001 |
| mongoserver | 27017 | 27018 |
| modelserver | 11434 | 8000 |
| chromaserver | 8000 | 8001 |

## Local Development Setup

For local development without Docker, you'll need to run each service individually:

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install web dependencies
cd ../web
npm install

# Install documentation dependencies (optional)
cd ../documentation
npm install
```

### 2. Start External Services

Start MongoDB, ChromaDB, and Ollama (requires local installation):

```bash
# Start MongoDB
mongod --dbpath ./data/db

# Start ChromaDB
chroma run --host 0.0.0.0 --port 8000

# Start Ollama
ollama serve

# Pull required AI model
ollama pull qwen2.5
```

### 3. Configure Environment

Create `.env` files for each service:

**Server (server/.env)**:
```env
PORT=3001
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/afs_db
JWT_SECRET=your-local-dev-secret
OLLAMA_BASE_URL=http://localhost:11434
CHROMA_URL=http://localhost:8000
```

**Web (web/.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Start Applications

```bash
# Terminal 1: Start backend server
cd server
npm run dev

# Terminal 2: Start frontend
cd web
npm run dev

# Terminal 3: Start documentation (optional)
cd documentation
npm start
```

## Development Mode

### Frontend Development

```bash
cd web
npm run dev
```

The frontend will be available at http://localhost:3000

### Backend Development

```bash
cd server
npm run dev
```

The backend API will be available at http://localhost:3001

### Documentation Site

```bash
cd documentation
npm start
```

The documentation will be available at http://localhost:3003

## First-Time Setup

After starting the services:

1. **Register a new account** at http://localhost:3002/register
2. **Login** with your credentials
3. **Answer some questions** to build initial memories
4. **Try the AI chat** feature to experience personalized conversations
5. **Explore the admin panel** (if you have admin permissions)

## Troubleshooting

### Docker Build Failures

**Problem**: Docker build fails with out of memory errors

**Solution**: Ensure Docker has sufficient memory allocated (recommended 8GB+)

```bash
# Check Docker resource usage
docker stats

# Rebuild with no cache
docker compose build --no-cache
```

### MongoDB Connection Issues

**Problem**: Backend server cannot connect to MongoDB

**Solution**: Wait for MongoDB to fully initialize (approximately 30 seconds)

```bash
# Check MongoDB container status
docker compose ps mongoserver

# Restart the server service
docker compose restart server

# View MongoDB logs
docker compose logs mongoserver
```

### Ollama Model Not Downloaded

**Problem**: AI chat returns errors about missing models

**Solution**: Download the required model manually

```bash
# Enter the model server container
docker compose exec modelserver bash

# Pull the required model
ollama pull qwen2.5

# Exit the container
exit
```

### Port Conflicts

**Problem**: Services fail to start due to port conflicts

**Solution**: Modify port mappings in `docker-compose.yml` or stop conflicting services

```bash
# Check what's using a port (example: 3001)
lsof -i :3001  # Linux/macOS
netstat -ano | findstr :3001  # Windows

# Or change ports in .env file
```

### Permission Errors

**Problem**: File permission errors in containers

**Solution**: Fix file permissions

```bash
# On Linux/macOS, fix permissions
sudo chown -R $USER:$USER .

# Rebuild containers
docker compose down
docker compose up -d --build
```

### Container Won't Start

**Problem**: Service containers exit immediately

**Solution**: Check logs and fix configuration

```bash
# View logs for all services
docker compose logs

# View logs for specific service
docker compose logs server

# Restart specific service
docker compose restart server
```

## Production Deployment

For production deployment, please refer to the [Deployment Guide](/docs/deployment/docker) for detailed instructions on:

- Environment configuration for production
- SSL/HTTPS setup
- Backup strategies
- Scaling recommendations
- Security hardening

## Getting Help

If you encounter issues not covered here:

1. Check the [Architecture Documentation](/docs/architecture/overview) for system design details
2. Review the [API Reference](/docs/api/overview) for endpoint information
3. Consult the [Tech Stack](/docs/reference/tech-stack) for version requirements
4. Check existing issues on GitHub

## Next Steps

- [Project Overview](/docs/getting-started/project-overview) - Learn about project structure
- [Core Features](/docs/core/overview) - Explore all features
- [Admin Panel](/docs/admin/overview) - System administration guide
