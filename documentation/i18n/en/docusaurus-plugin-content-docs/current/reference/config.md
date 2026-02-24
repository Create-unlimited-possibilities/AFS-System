---
sidebar_position: 2
---

# Configuration Files

AFS System uses multiple configuration files to manage application settings, environment variables, and service orchestration. This document details the purpose and structure of each configuration file.

## Docker Compose Configuration

`docker-compose.yml` is the container orchestration configuration file for the entire system, defining the deployment method for all services.

### Service Overview

```yaml
services:
  docs:              # Documentation site (Docusaurus)
  web:               # Frontend application (Next.js)
  server:            # Backend API (Express)
  chromaserver:      # Vector database (ChromaDB)
  modelserver:       # AI model service (Ollama)
  mongoserver:       # Primary database (MongoDB)
```

### Network Configuration

All services connect to the `afs-network` bridge network for inter-service communication:

```yaml
networks:
  afs-network:
    driver: bridge
```

### Detailed Service Configuration

#### Documentation Site (docs)

```yaml
docs:
  build:
    context: ./documentation
    dockerfile: Dockerfile
    target: production
  ports:
    - "3003:80"
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/health"]
```

- **Port**: 3003
- **Health check**: Every 30 seconds
- **Restart policy**: unless-stopped

#### Frontend Application (web)

```yaml
web:
  build:
    context: ./web
    dockerfile: Dockerfile
    target: ${NODE_ENV:-development}
  ports:
    - "3002:3000"
  volumes:
    - ./web/app:/app/app
    - ./web/lib:/app/lib
    - ./web/types:/app/types
    - ./web/components:/app/components
    - ./web/stores:/app/stores
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:3001
    - NEXT_PUBLIC_DOCS_URL=http://localhost:3003
    - NODE_ENV=${NODE_ENV:-development}
```

- **Port**: 3002
- **Mount volumes**: Development hot reload support
- **Dependencies**: server, docs

#### Backend Service (server)

```yaml
server:
  build:
    context: ./server
    dockerfile: Dockerfile-server
  ports:
    - "3001:3000"
  volumes:
    - ./server:/app
    - /app/node_modules
    - ./server/storage:/app/storage
  depends_on:
    - mongoserver
    - modelserver
    - chromaserver
  env_file:
    - .env
```

- **Port**: 3001
- **Mount volumes**: Code hot reload + storage persistence
- **Environment variables**: Loaded from .env file

#### AI Model Service (modelserver)

```yaml
modelserver:
  build:
    context: ./modelserver
    dockerfile: Dockerfile-modelserver
  ports:
    - "8000:11434"
  volumes:
    - ./modelserver/models:/root/.ollama/models
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

- **Port**: 8000 (external) -> 11434 (internal)
- **GPU Support**: NVIDIA GPU acceleration
- **Model storage**: Persisted to local volume

#### MongoDB Service (mongoserver)

```yaml
mongoserver:
  build:
    context: ./mongoserver
    dockerfile: Dockerfile-mongoserver
  ports:
    - "27018:27017"
  volumes:
    - ./mongoserver/mongodb_data:/data/db
    - ./mongoserver/init:/docker-entrypoint-initdb.d
  environment:
    MONGO_INITDB_DATABASE: afs_db
```

- **Port**: 27018 (external) -> 27017 (internal)
- **Data persistence**: mongodb_data volume
- **Initialization**: Supports init scripts

#### Vector Database (chromaserver)

```yaml
chromaserver:
  image: chromadb/chroma:latest
  ports:
    - "8001:8000"
  volumes:
    - ./server/storage/chroma_db:/chroma/chroma
  environment:
    - CHROMA_SERVER_CORS_ALLOW_ORIGINS=*
    - CHROMA_SERVER_HOST=0.0.0.0
```

- **Port**: 8001 (external) -> 8000 (internal)
- **CORS**: Allows all origins
- **Data persistence**: chroma_db volume

## Frontend Configuration

### Next.js Configuration

The Next.js configuration file is located at `web/next.config.js` (if it exists):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Environment variables (client accessible)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  },
};

module.exports = nextConfig;
```

### TypeScript Configuration

`web/tsconfig.json` defines TypeScript compilation options:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Tailwind CSS Configuration

`web/tailwind.config.ts` defines the style system:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // ... more color definitions
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

## Backend Configuration

### Nodemon Configuration

Development environment hot reload configuration at `server/nodemon.json`:

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["src/**/*.test.js"],
  "exec": "node src/server.js"
}
```

### Test Configuration

`server/vitest.config.js` for unit testing:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

## Documentation Configuration

### Docusaurus Configuration

`documentation/docusaurus.config.ts` defines the documentation site behavior:

```typescript
const config = {
  title: 'AFS System',
  tagline: 'Digital Memory Heritage System for Seniors - Technical Documentation',
  url: 'https://afs-system.example.com',
  baseUrl: '/',
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
  },
  // ... more configuration
};
```

### Sidebar Configuration

`documentation/sidebars.ts` defines the documentation navigation structure:

```typescript
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/intro',
        'getting-started/project-overview',
        'getting-started/installation',
      ],
    },
    // ... more categories
  ],
};
```

## Configuration File Location Summary

| Configuration File | Location | Purpose |
|-------------------|----------|---------|
| docker-compose.yml | Project root | Container orchestration |
| .env | Project root | Environment variables (must be created) |
| .env.example | Project root | Environment variable template |
| next.config.js | web/ | Next.js configuration |
| tsconfig.json | web/ | TypeScript configuration |
| tailwind.config.ts | web/ | Tailwind CSS configuration |
| nodemon.json | server/ | Development hot reload |
| vitest.config.js | server/ | Test configuration |
| docusaurus.config.ts | documentation/ | Documentation site configuration |
| sidebars.ts | documentation/ | Documentation navigation |

## Configuration Best Practices

1. **Environment Variable Management**
   - Never commit `.env` files to version control
   - Use `.env.example` as a template
   - Use different configurations for different environments (development, production)

2. **Port Management**
   - Use standard ports in development (3000-3003)
   - Consider using reverse proxy (Nginx) in production
   - Be aware of port mapping differences between container and host

3. **Volume Management**
   - Important data must use persistent volumes
   - Development environment can mount code directories for hot reload
   - Production environment only mounts necessary configuration and data directories

4. **Network Configuration**
   - Use custom networks for inter-service communication
   - Use service names instead of localhost for service-to-service communication
   - Pay attention to CORS configuration

## Related Documentation

- [Environment Variables](./env)
- [Tech Stack](./tech-stack)
- [Deployment Guide](/docs/deployment/docker)
