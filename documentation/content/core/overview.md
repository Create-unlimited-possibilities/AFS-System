---
sidebar_position: 1
---

# Module Overview

The backend uses a **modular architecture**, where each module is complete and independent, containing:

- `controller.js` - Controller (handles HTTP requests)
- `service.js` - Business logic
- `repository.js` - Data access (optional)
- `model.js` - Data model (optional)
- `route.js` - Route definitions

## Module List

| Module | Path | Description |
|--------|------|-------------|
| **Auth** | `modules/auth/` | User login, registration, JWT authentication |
| **User** | `modules/user/` | User CRUD, statistics, status management |
| **Roles** | `modules/roles/` | Role management, permission control |
| **QA** | `modules/qa/` | Question management, answer saving |
| **Assist** | `modules/assist/` | Assist relationship establishment, management |
| **Chat** | `modules/chat/` | LangGraph conversation orchestration |
| **RoleCard** | `modules/rolecard/` | Role card generation V2 (layered architecture), vector index |
| **Memory** | `modules/memory/` | Memory storage, compression, scheduling |
| **Sentiment** | `modules/sentiment/` | Stranger sentiment tracking |
| **Settings** | `modules/settings/` | System configuration management |
| **Admin** | `modules/admin/` | Admin panel backend services |

## Admin Module Features

The Admin module provides comprehensive backend management:

### User Management
- User list with pagination and search
- User detail viewing and editing
- User status toggle (active/inactive)
- Role assignment

### Questionnaire Management
- Question CRUD operations
- Question ordering
- Batch import/export
- Status management

### Memory Management
- User memory summaries
- Memory detail viewing
- Vector index status
- Index rebuilding

### Dashboard
- System statistics
- User growth charts
- Recent activity feed
- System status monitoring

### Role & Permission Management
- Role CRUD
- Permission assignment
- System permission definitions

### Invite Code System
- Code generation
- Usage tracking
- Expiration management

## Core Infrastructure

### Storage Services

Location: `core/storage/`

| File | Description |
|------|-------------|
| `dual.js` | Dual storage coordination |
| `file.js` | File system operations |
| `vector.js` | Vector index service |
| `embedding.js` | Text embedding service |
| `syncQueue.js` | Synchronization queue |

### LLM Services

Location: `core/llm/`

| File | Description |
|------|-------------|
| `client.js` | LLM client wrapper |
| `config.js` | Model configuration |
| `multi.js` | Multi-model management |

### Utility Functions

Location: `core/utils/`

| File | Description |
|------|-------------|
| `logger.js` | Logging |
| `tokens.js` | Token counting |
| `progress.js` | Progress tracking |
| `lock.js` | File locking |
| `response.js` | Response formatting |

## Module Dependencies

```
                    ┌──────────┐
                    │   Auth   │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  User   │    │  Roles  │    │ Settings│
    └────┬────┘    └─────────┘    └─────────┘
         │
         ├───────────────┬───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │   QA    │    │  Assist │    │RoleCard │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │               │
         └──────────────┼───────────────┘
                        │
         ┌──────────────┼───────────────┐
         │              │               │
         ▼              ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  Chat   │    │ Memory  │    │ Admin   │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │               │
         └──────────────┼───────────────┘
                        │
                        ▼
                   ┌─────────┐
                   │Sentiment│
                   └─────────┘
```

## Admin Module API Endpoints

### Authentication
- `POST /admin-auth/register` - Admin registration
- `POST /admin-auth/login` - Admin login
- `GET /admin-auth/validate-invite/:code` - Validate invite code

### User Management
- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `PATCH /api/admin/users/:id/status` - Toggle user status

### Questionnaire Management
- `GET /api/admin/questions` - List questions
- `POST /api/admin/questions` - Create question
- `PUT /api/admin/questions/:id` - Update question
- `DELETE /api/admin/questions/:id` - Delete question
- `PATCH /api/admin/questions/:id/reorder` - Reorder question

### Memory Management
- `GET /api/admin/memories/user-summaries` - List user memory summaries
- `GET /api/admin/memories/:userId` - Get user memories
- `GET /api/admin/memories/:userId/vector-status` - Get vector status
- `POST /api/admin/memories/:userId/rebuild-index` - Rebuild vector index

### Dashboard
- `GET /api/admin/dashboard/stats` - Get statistics
- `GET /api/admin/dashboard/system-status` - Get system status
- `GET /api/admin/dashboard/activity` - Get recent activity

### Roles & Permissions
- `GET /api/admin/roles` - List roles
- `POST /api/admin/roles` - Create role
- `PUT /api/admin/roles/:id` - Update role
- `DELETE /api/admin/roles/:id` - Delete role
- `GET /api/admin/permissions` - List all permissions
