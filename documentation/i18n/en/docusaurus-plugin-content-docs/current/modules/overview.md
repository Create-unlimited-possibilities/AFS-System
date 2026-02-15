---
sidebar_position: 5
---

# Module Overview

AFS System backend is organized into 9 independent modules following the Repository-Service-Controller pattern.

## Module List

| Module | Path | Description |
|--------|------|-------------|
| Auth | `/auth` | Authentication & authorization |
| User | `/user` | User management |
| Question | `/question` | Question templates |
| Answer | `/answer` | Answer storage & retrieval |
| Chat | `/chat` | AI conversation (LangGraph) |
| RoleCard | `/rolecard` | Character profile generation |
| Sentiment | `/sentiment` | Sentiment/affinity analysis |
| Assist | `/assist` | Helper relationships |
| Permission | `/permission` | RBAC management |

## Module Structure

Each module follows a consistent structure:

```
module/
├── controller.js    # HTTP request handling
├── service.js       # Business logic
├── repository.js    # Data access
├── routes.js        # Route definitions
├── validator.js     # Input validation (Joi)
└── model.js         # Mongoose schema
```

## Dependency Graph

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│   Auth  │────▶│   User  │────▶│Question │
└─────────┘     └─────────┘     └─────────┘
     │              │               │
     ▼              ▼               ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│Permission│    │ Assist  │     │ Answer  │
└─────────┘     └─────────┘     └─────────┘
     │              │               │
     └──────────────┼───────────────┘
                    ▼
              ┌─────────┐     ┌─────────┐
              │  Chat   │────▶│RoleCard │
              └─────────┘     └─────────┘
                    │
                    ▼
              ┌─────────┐
              │Sentiment│
              └─────────┘
```

## Core Modules

### Auth Module
Handles JWT-based authentication including registration, login, and session management.

### User Module
Manages user profiles, preferences, and account settings.

### Question Module
Provides categorized question templates with basic and emotional levels.

### Answer Module
Stores and retrieves user answers with file system backup support.

## AI Modules

### Chat Module
LangGraph-based conversation system with memory persistence and RAG integration.

### RoleCard Module
Generates AI-powered character profiles from user answers.

### Sentiment Module
Analyzes conversation sentiment and tracks user affinity scores.
