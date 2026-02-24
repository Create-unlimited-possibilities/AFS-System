---
sidebar_position: 4
---

# Admin API

The Admin API provides endpoints for system administration, user management, content moderation, and system monitoring. Admin endpoints require both authentication and admin role.

## Base URL

```
http://localhost:3000/api/admin
```

## Admin Authentication

Admin authentication uses a separate path from regular user authentication.

### POST /admin-auth/login

Admin login with email and password.

**Authentication:** None

**Request Body:**

```json
{
  "email": "admin@example.com",
  "password": "adminPassword123"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "_id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "name": "Admin User",
    "uniqueCode": "ADM001",
    "role": {
      "_id": "role123",
      "name": "admin",
      "isAdmin": true,
      "permissions": [
        { "_id": "perm1", "name": "user:view" },
        { "_id": "perm2", "name": "user:create" }
      ]
    },
    "lastLogin": "2026-02-24T10:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**

- `400` - Missing email or password
- `401` - Invalid credentials or inactive account
- `403` - User does not have admin role

### POST /admin-auth/register

Register a new admin account with invite code.

**Authentication:** None

**Request Body:**

```json
{
  "email": "newadmin@example.com",
  "password": "securePassword123",
  "name": "New Admin",
  "inviteCode": "AFS-Admin-2024-Secure-Code"
}
```

**Response:** Same as login

**Errors:**

- `400` - Missing fields, invalid invite code, or email already registered

### GET /admin-auth/validate-invite/:code

Validate an invite code without registering.

**Authentication:** None

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | The invite code to validate |

**Response:**

```json
{
  "success": true,
  "valid": true
}
```

### GET /api/admin/invite-codes/validate/:code

Legacy endpoint for invite code validation.

**Authentication:** None

**Parameters and Response:** Same as above

---

## User Management

### GET /api/admin/users

Get all users with pagination and filters.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search by name, email, or uniqueCode |
| `role` | string | - | Filter by role ID |
| `isActive` | boolean | - | Filter by active status |

**Response:**

```json
{
  "success": true,
  "users": [
    {
      "_id": "user123",
      "email": "user@example.com",
      "name": "John Doe",
      "uniqueCode": "ABC123",
      "isActive": true,
      "role": {
        "_id": "role123",
        "name": "user"
      },
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastLogin": "2026-02-24T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET /api/admin/users/:id

Get detailed user information with statistics.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "user": {
    "_id": "user123",
    "email": "user@example.com",
    "name": "John Doe",
    "uniqueCode": "ABC123",
    "isActive": true,
    "role": { ... },
    "stats": {
      "memoryCount": 50,
      "chatSessionCount": 10,
      "totalMessages": 150
    }
  }
}
```

### PUT /api/admin/users/:id

Update user information.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "janedoe@example.com",
  "roleId": "newRole123"
}
```

**Response:**

```json
{
  "success": true,
  "user": { ... }
}
```

### DELETE /api/admin/users/:id

Delete a user (cascades to related data).

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### PATCH /api/admin/users/:id/status

Toggle user active status.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "isActive": false
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "_id": "user123",
    "isActive": false
  }
}
```

---

## Questionnaire Management

### GET /api/admin/questions

Get all questions with filters.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | string | Filter by role (elder, family, friend) |
| `layer` | string | Filter by layer (basic, emotional) |
| `active` | boolean | Filter by active status |
| `search` | string | Search in question text |

**Response:**

```json
{
  "success": true,
  "questions": [
    {
      "_id": "q123",
      "question": "What is your favorite childhood memory?",
      "placeholder": "Describe your memory...",
      "type": "textarea",
      "role": "elder",
      "layer": "basic",
      "order": 1,
      "active": true
    }
  ]
}
```

### GET /api/admin/questions/:id

Get a specific question by ID.

**Authentication:** Required (Admin)

### POST /api/admin/questions

Create a new question.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "question": "What makes you happy?",
  "placeholder": "Share what brings you joy...",
  "type": "textarea",
  "role": "elder",
  "layer": "emotional",
  "order": 1,
  "active": true
}
```

**Response:**

```json
{
  "success": true,
  "question": { ... }
}
```

### PUT /api/admin/questions/:id

Update a question.

**Authentication:** Required (Admin)

**Request Body:** Same as create question

### DELETE /api/admin/questions/:id

Delete a question (cascades to related answers).

**Authentication:** Required (Admin)

### PATCH /api/admin/questions/:id/reorder

Reorder a question and adjust others accordingly.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "newOrder": 5
}
```

### PATCH /api/admin/questions/:id/status

Toggle question active status.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "active": false
}
```

### POST /api/admin/questions/batch-import

Import multiple questions at once.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "questions": [
    {
      "question": "Question 1",
      "role": "elder",
      "layer": "basic",
      "order": 1
    },
    {
      "question": "Question 2",
      "role": "elder",
      "layer": "basic",
      "order": 2
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "imported": 2,
  "failed": 0,
  "questions": [ ... ]
}
```

### GET /api/admin/questions/export

Export questions with optional filters.

**Authentication:** Required (Admin)

**Query Parameters:** Same as GET questions

**Response:**

```json
{
  "success": true,
  "questions": [ ... ]
}
```

---

## Memory Management

### GET /api/admin/memories/user-summaries

Get user memory summaries with statistics.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search by name, email, or uniqueCode |

**Response:**

```json
{
  "success": true,
  "summaries": [
    {
      "userId": "user123",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "uniqueCode": "ABC123",
      "memoryCount": 50,
      "tokenCount": 15000,
      "vectorIndexStatus": "built"
    }
  ],
  "pagination": { ... }
}
```

### GET /api/admin/memories

Get all memories/answers with pagination.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `userId` | string | - | Filter by user ID |
| `search` | string | - | Search by answer content |

**Response:**

```json
{
  "success": true,
  "memories": [
    {
      "_id": "mem123",
      "targetUserId": "user123",
      "userId": "user456",
      "question": "What is your favorite memory?",
      "answer": "My favorite memory is...",
      "layer": "basic",
      "createdAt": "2026-02-24T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### GET /api/admin/memories/stats

Get memory statistics.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalMemories": 5000,
    "totalUsers": 100,
    "avgMemoriesPerUser": 50,
    "totalTokens": 1500000
  }
}
```

### GET /api/admin/memories/:userId

Get user's memory data with vector index status.

**Authentication:** Required (Admin)

### GET /api/admin/memories/:userId/vector-status

Get vector index status for a user.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "status": {
    "indexed": true,
    "vectorCount": 50,
    "lastIndexed": "2026-02-24T10:00:00.000Z"
  }
}
```

### POST /api/admin/memories/:userId/rebuild-index

Trigger vector index rebuild for a user.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Index rebuild initiated"
}
```

### GET /api/admin/memories/:userId/export

Export user's memory data as JSON.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "memories": [ ... ],
  "user": { ... }
}
```

---

## Dashboard & Statistics

### GET /api/admin/dashboard/stats

Get comprehensive dashboard statistics.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "stats": {
    "users": {
      "total": 150,
      "active": 120,
      "newThisWeek": 5
    },
    "memories": {
      "total": 5000,
      "newThisWeek": 200
    },
    "chatSessions": {
      "total": 1000,
      "active": 50
    },
    "questions": {
      "total": 100,
      "active": 80
    }
  }
}
```

### GET /api/admin/dashboard/system-status

Get system status for all components.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "status": {
    "mongodb": {
      "status": "connected",
      "host": "localhost",
      "database": "afs-system"
    },
    "chromadb": {
      "status": "connected",
      "collectionCount": 100
    },
    "llm": {
      "status": "operational",
      "provider": "ollama",
      "model": "llama2"
    },
    "vectorStore": {
      "status": "operational",
      "indexedCount": 5000
    }
  }
}
```

### GET /api/admin/dashboard/system-status-fast

Get system status using Docker container checks (fast endpoint).

**Authentication:** Required (Admin)

**Response:** Similar to system-status but optimized for speed

### GET /api/admin/dashboard/activity

Get recent system activity.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 10 | Number of activities to return |

**Response:**

```json
{
  "success": true,
  "activities": [
    {
      "type": "user_registered",
      "message": "New user registered: john@example.com",
      "timestamp": "2026-02-24T10:00:00.000Z"
    },
    {
      "type": "memory_created",
      "message": "User added 5 new memories",
      "timestamp": "2026-02-24T09:55:00.000Z"
    }
  ]
}
```

### GET /api/admin/dashboard/growth

Get user growth data over time.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Number of days to look back |

**Response:**

```json
{
  "success": true,
  "growth": [
    {
      "date": "2026-01-25",
      "newUsers": 5,
      "cumulativeUsers": 100
    },
    {
      "date": "2026-01-26",
      "newUsers": 3,
      "cumulativeUsers": 103
    }
  ]
}
```

---

## Invite Code Management

### GET /api/admin/invite-codes

Get all invite codes with pagination.

**Authentication:** Required (Admin)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `status` | string | - | Filter by status (active, used, expired) |

**Response:**

```json
{
  "success": true,
  "inviteCodes": [
    {
      "_id": "code123",
      "code": "INVITE-ABC-123",
      "useCount": 2,
      "maxUses": 10,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### POST /api/admin/invite-codes

Create a new invite code.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "maxUses": 10,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "inviteCode": {
    "_id": "code123",
    "code": "INVITE-XYZ-789",
    "useCount": 0,
    "maxUses": 10,
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }
}
```

### DELETE /api/admin/invite-codes/:id

Delete an invite code.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Invite code deleted"
}
```

---

## Environment Variables

### GET /api/admin/settings/env

Get environment configuration (read-only, sanitized).

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "config": {
    "NODE_ENV": "production",
    "PORT": "3000",
    "LLM_PROVIDER": "ollama",
    "LLM_MODEL": "llama2"
  }
}
```

### GET /api/admin/settings/env/full

Get all environment variables with metadata.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "variables": [
    {
      "key": "MONGO_URI",
      "value": "mongodb://localhost:27017/afs-system",
      "isSecret": true,
      "description": "MongoDB connection string"
    }
  ]
}
```

### PUT /api/admin/settings/env

Update environment variables (with backup).

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "updates": {
    "LLM_MODEL": "llama3",
    "MAX_TOKENS": "4096"
  },
  "backup": true
}
```

**Response:**

```json
{
  "success": true,
  "updated": 2,
  "backupPath": "/backups/.env.20260224"
}
```

### POST /api/admin/settings/env/validate

Validate an environment variable value without updating.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "key": "MAX_TOKENS",
  "value": "4096"
}
```

**Response:**

```json
{
  "success": true,
  "valid": true
}
```

### GET /api/admin/settings/env/schema

Get environment variable configuration schema.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "schema": [
    {
      "key": "LLM_MODEL",
      "type": "string",
      "required": true,
      "description": "Default LLM model",
      "options": ["llama2", "llama3", "mistral"]
    }
  ]
}
```

### GET /api/admin/settings/env/backups

List available .env backups.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "backups": [
    {
      "path": "/backups/.env.20260224",
      "createdAt": "2026-02-24T10:00:00.000Z",
      "size": 1024
    }
  ]
}
```

### POST /api/admin/settings/env/restore

Restore .env from backup.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "backupPath": "/backups/.env.20260224"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Environment restored from backup"
}
```

---

## Role & Permission Management

### GET /api/admin/roles

Get all roles with permissions.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "roles": [
    {
      "_id": "role123",
      "name": "admin",
      "description": "System administrator",
      "isAdmin": true,
      "isSystem": true,
      "permissions": [
        {
          "_id": "perm1",
          "name": "user:view",
          "description": "View user information"
        }
      ]
    }
  ]
}
```

### GET /api/admin/roles/:id

Get a specific role with permissions.

**Authentication:** Required (Admin)

### POST /api/admin/roles

Create a new role.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "name": "moderator",
  "description": "Content moderator with limited access",
  "permissionIds": ["perm1", "perm2"]
}
```

**Response:**

```json
{
  "success": true,
  "role": { ... }
}
```

### PUT /api/admin/roles/:id

Update a role.

**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "name": "senior_moderator",
  "description": "Senior moderator with extended access",
  "permissionIds": ["perm1", "perm2", "perm3"]
}
```

### DELETE /api/admin/roles/:id

Delete a role (only non-system roles not assigned to users).

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "message": "Role deleted"
}
```

**Errors:**

- `400` - Cannot delete system role
- `400` - Role is assigned to users

### GET /api/admin/permissions

Get all permissions.

**Authentication:** Required (Admin)

**Response:**

```json
{
  "success": true,
  "permissions": [
    {
      "_id": "perm1",
      "name": "user:view",
      "description": "View user information"
    },
    {
      "_id": "perm2",
      "name": "user:create",
      "description": "Create new users"
    }
  ]
}
```

---

## Test Endpoint

### GET /api/admin/test

Simple test endpoint to verify admin routes are working.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "message": "Admin routes working",
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## Permission System

Admin API uses a role-based permission system. Each admin endpoint requires:

1. **Authentication** - Valid JWT token from admin login
2. **Admin Role** - User's role must have `isAdmin: true`
3. **Specific Permissions** - Some endpoints require additional permissions

### Available Permissions

| Permission | Description |
|------------|-------------|
| `user:view` | View user information |
| `user:create` | Create new users |
| `user:update` | Update user information |
| `user:delete` | Delete users |
| `role:view` | View roles and permissions |
| `role:create` | Create new roles |
| `role:update` | Update roles |
| `role:delete` | Delete roles |
| `permission:view` | View permissions |
| `permission:create` | Create new permissions |
| `permission:update` | Update permissions |
| `permission:delete` | Delete permissions |
| `system:view` | View system settings |
| `system:update` | Update system settings |

### Permission Middleware

The API uses middleware to enforce permissions:

```javascript
import { requirePermission } from './core/middleware/permission.js';

router.get('/users', protect, requirePermission('user:view'), (req, res) => {
  // Handler code
});
```

If a user lacks the required permission, the API returns:

```json
{
  "success": false,
  "error": "Insufficient permissions"
}
```

HTTP Status: 403 Forbidden
