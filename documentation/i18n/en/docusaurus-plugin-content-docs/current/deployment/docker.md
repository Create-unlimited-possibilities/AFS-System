---
sidebar_position: 7
---

# Docker Deployment

Complete guide for deploying AFS System with Docker.

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                    (afs-network)                         │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   docs   │  │   web    │  │  server  │              │
│  │  :3003   │  │  :3002   │  │  :3001   │              │
│  │ Nginx    │  │ Next.js  │  │ Express  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                    │                     │
│           ┌────────────────────────┼────────────────┐   │
│           ▼                        ▼                ▼   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  mongoserver │  │ modelserver  │  │ chromaserver│  │
│  │    :27018    │  │    :8000     │  │    :8001    │  │
│  │   MongoDB    │  │   Ollama     │  │  ChromaDB   │  │
│  └──────────────┘  └──────────────┘  └─────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone repository
git clone https://github.com/Create-unlimited-possibilities/AFS-System.git
cd AFS-System

# Create environment file
cp .env.example .env

# Build and start all services
docker-compose up -d --build
```

## Service Configuration

### Web Service (Frontend)
```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
  ports:
    - "3002:3000"
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3001
    - NEXT_PUBLIC_DOCS_URL=http://localhost:3003
```

### Server Service (Backend)
```yaml
server:
  build:
    context: ./server
    dockerfile: Dockerfile-server
  ports:
    - "3001:3000"
  environment:
    - MODEL_SERVER_URL=http://modelserver:8000
    - CHROMA_URL=http://chromaserver:8000
```

### Docs Service (Documentation)
```yaml
docs:
  build:
    context: ./documentation
    dockerfile: Dockerfile
  ports:
    - "3003:80"
```

## GPU Support

For GPU-accelerated AI inference:

```yaml
modelserver:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

Verify GPU access:
```bash
docker exec -it afs-modelserver nvidia-smi
```

## Production Deployment

### 1. Build Optimized Images

```bash
docker-compose build --no-cache
```

### 2. Configure Environment

```env
NODE_ENV=production
MONGODB_URI=mongodb://mongoserver:27017/afs_db
MODEL_SERVER_URL=http://modelserver:8000
CHROMA_URL=http://chromaserver:8000
```

### 3. Enable HTTPS

Use a reverse proxy (Nginx/Traefik) with SSL certificates.

### 4. Set Up Backups

```bash
# MongoDB backup
docker exec mongoserver mongodump --out /backup

# Volume backup
docker run --rm -v afs_mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb.tar.gz /data
```

## Health Checks

All services include health checks:

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f [service_name]
```

## Troubleshooting

### Container won't start
```bash
docker-compose logs [service_name]
```

### GPU not detected
```bash
docker run --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### Network issues
```bash
docker network inspect afs-network
```
