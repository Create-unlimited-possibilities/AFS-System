---
sidebar_position: 3
---

# Environment Variables

AFS System uses environment variables to configure application behavior. This document details all available environment variables.

## Quick Start

1. Copy the environment variable template:
   ```bash
   cp .env.example .env
   ```

2. Modify values in the `.env` file as needed

3. Restart services for configuration to take effect

## Basic Configuration

### NODE_ENV

Runtime environment mode.

- **Default**: `development`
- **Options**: `development`, `production`
- **Description**: Affects logging level, error handling, etc.

```bash
NODE_ENV=development
```

### PORT

Backend service internal port.

- **Default**: `3000`
- **Description**: Port that Express service listens on, used inside container

```bash
PORT=3000
```

## MongoDB Configuration

### MONGO_URI

MongoDB connection string.

- **Default**: `mongodb://mongoserver:27017/afs_db`
- **Docker environment**: Use service name `mongoserver`
- **Local development**: Use `mongodb://localhost:27017/afs_db`
- **Production**: Recommended to use connection string with username and password

```bash
# Docker environment
MONGO_URI=mongodb://mongoserver:27017/afs_db

# Local development
MONGO_URI=mongodb://localhost:27017/afs_db

# Production (with authentication)
MONGO_URI=mongodb://username:password@mongoserver:27017/afs_db?authSource=admin
```

## JWT Configuration

### JWT_SECRET

JWT signing key.

- **Important**: Must be changed to a strong password in production
- **Requirement**: At least 32 character random string
- **Generation method**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

```bash
JWT_SECRET=your-jwt-secret-key-change-in-production
```

## Frontend Configuration

The following variables need to start with `NEXT_PUBLIC_` to be accessible on the client side:

### NEXT_PUBLIC_API_URL

Address for frontend to access backend API.

- **Default**: `http://localhost:3001`
- **Docker environment**: `http://localhost:3001` (accessed from host)
- **Description**: Frontend calls backend API through this address

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### NEXT_PUBLIC_DOCS_URL

Documentation site address.

- **Default**: `http://localhost:3003`
- **Description**: Used for navigating to documentation pages

```bash
NEXT_PUBLIC_DOCS_URL=http://localhost:3003
```

### NEXT_PUBLIC_GITHUB_URL

GitHub repository address.

- **Default**: `https://github.com/Create-unlimited-possibilities/AFS-System`
- **Description**: Used for GitHub link in footer

```bash
NEXT_PUBLIC_GITHUB_URL=https://github.com/Create-unlimited-possibilities/AFS-System
```

## LLM Backend Configuration

### LLM_BACKEND

LLM backend selection.

- **Default**: `ollama`
- **Options**: `ollama` (local), `deepseek` (cloud API)
- **Description**: Determines which LLM service to use

```bash
LLM_BACKEND=ollama
```

### Ollama Configuration

#### OLLAMA_BASE_URL

Ollama service address.

- **Default**: `http://modelserver:11434`
- **Docker environment**: Use service name `modelserver`
- **Local development**: `http://localhost:11434`

```bash
OLLAMA_BASE_URL=http://modelserver:11434
```

#### OLLAMA_MODEL

Default Ollama model to use.

- **Default**: `deepseek-r1:14b`
- **Available models**:
  - `deepseek-r1:14b` - DeepSeek reasoning model (14B parameters)
  - `deepseek-chat:7b` - DeepSeek chat model (7B parameters)
  - `qwen2.5:7b` - Qwen 2.5
  - `llama3.2:3b` - Llama 3.2 (lightweight)

```bash
OLLAMA_MODEL=deepseek-r1:14b
```

#### OLLAMA_TIMEOUT

Ollama health check timeout.

- **Default**: `30000` (30 seconds)
- **Unit**: Milliseconds
- **Description**: Large models take longer to load, so increase timeout appropriately

```bash
OLLAMA_TIMEOUT=30000
```

### DeepSeek API Configuration

#### DEEPSEEK_API_KEY

DeepSeek API key.

- **Get from**: https://platform.deepseek.com/
- **Required**: When `LLM_BACKEND=deepseek`

```bash
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

#### DEEPSEEK_BASE_URL

DeepSeek API base URL.

- **Default**: `https://api.deepseek.com/v1`

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

#### DEEPSEEK_MODEL

DeepSeek model selection.

- **Default**: `deepseek-chat`
- **Options**:
  - `deepseek-chat` - General chat model
  - `deepseek-reasoner` - Reasoning enhanced model

```bash
DEEPSEEK_MODEL=deepseek-chat
```

## LLM Common Configuration

### LLM_TIMEOUT

LLM request timeout.

- **Default**: `60000` (60 seconds)
- **Unit**: Milliseconds

```bash
LLM_TIMEOUT=60000
```

### LLM_MAX_RETRIES

Maximum LLM request retry count.

- **Default**: `3`

```bash
LLM_MAX_RETRIES=3
```

### LLM_TEMPERATURE

LLM generation temperature parameter.

- **Default**: `0.7`
- **Range**: 0.0 - 2.0
- **Description**: Lower values produce more deterministic output, higher values produce more random output

```bash
LLM_TEMPERATURE=0.7
```

## Embedding Configuration

### EMBEDDING_BACKEND

Embedding backend selection.

- **Default**: `ollama`
- **Options**: `ollama` (local free), `openai` (requires API key)

```bash
EMBEDDING_BACKEND=ollama
```

### EMBEDDING_MODEL

Embedding model.

- **Default**: `bge-m3`
- **Description**: BGE-M3 is a multilingual embedding model

```bash
EMBEDDING_MODEL=bge-m3
```

## ChromaDB Configuration

### CHROMA_URL

ChromaDB service address.

- **Default**: `http://chromaserver:8000`
- **Docker environment**: Use service name `chromaserver`

```bash
CHROMA_URL=http://chromaserver:8000
```

## Health Check Configuration

### HEALTH_CHECK_TIMEOUT_MS

System status health check timeout.

- **Default**: `2000` (2 seconds)
- **Description**: Lower values make admin panel respond faster but may fail on slow systems

```bash
HEALTH_CHECK_TIMEOUT_MS=2000
```

## Admin Configuration

### ADMIN_INVITE_CODE

Admin registration invite code.

- **Default**: `your-secure-admin-invite-code-change-this`
- **Important**: Must be changed in production
- **Usage**: Used when registering admin at `/admin/register`

```bash
ADMIN_INVITE_CODE=your-secure-admin-invite-code-change-this
```

### ADMIN_EMAIL

Default admin account email.

- **Default**: `admin@afs-system.com`
- **Description**: Automatically created on first server startup
- **Important**: Must be changed in production

```bash
ADMIN_EMAIL=admin@afs-system.com
```

### ADMIN_PASSWORD

Default admin account password.

- **Default**: `admin123456`
- **Important**: Must be changed to a strong password in production
- **Description**: Automatically created on first server startup

```bash
ADMIN_PASSWORD=admin123456
```

## Optional Service Configuration

### Google Translate API

```bash
GOOGLE_TRANSLATE_API_KEY=your_key_here
```

### OpenAI API (backup)

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

## Environment Variable Priority

1. Docker Compose `environment` field
2. `.env` file
3. System environment variables
4. Default values in code

## Security Recommendations

### Must Do for Production

1. Change all default keys and passwords
2. Use strong password policies
3. Enable HTTPS
4. Configure CORS whitelist
5. Limit API access rate
6. Update dependencies regularly

### Key Generation

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Admin Invite Code
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Strong password generation
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

## Troubleshooting

### MongoDB Connection Failed

Check if `MONGO_URI` is correct:
- Use service name in Docker environment
- Use localhost for local development
- Confirm MongoDB container is running

### LLM Not Responding

Check Ollama configuration:
- Confirm `OLLAMA_BASE_URL` is correct
- Increase `OLLAMA_TIMEOUT` value
- Check if model is downloaded

### Frontend Cannot Access API

Check frontend configuration:
- Confirm `NEXT_PUBLIC_API_URL` is correct
- Check if backend service is running
- View browser console error messages

## Related Documentation

- [Configuration Files](./config)
- [Tech Stack](./tech-stack)
- [Docker Deployment](/docs/deployment/docker)
