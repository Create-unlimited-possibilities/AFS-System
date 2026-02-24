---
sidebar_position: 2
---

# REST API Endpoints

Complete reference for all REST API endpoints in the AFS System.

## Health Check

### GET /api/health

Check server health status.

**Authentication:** None

**Response:**

```json
{
  "status": "ok",
  "service": "AFS Backend",
  "mongodb": "connected",
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## Authentication

### POST /api/auth/register

Register a new user account.

**Authentication:** None

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "uniqueCode": "ABC123",
    "role": {
      "name": "user"
    }
  }
}
```

### POST /api/auth/login

Login with email and password.

**Authentication:** None

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** Same as register

### GET /api/auth/me

Get current user profile.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "uniqueCode": "ABC123",
    "role": { ... }
  }
}
```

---

## Assist Relationships

### GET /api/auth/assist/search

Search for users to establish assist relationships.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (name, email, or code) |

### POST /api/auth/assist/verify

Create an assist relationship with another user.

**Authentication:** Required

**Request Body:**

```json
{
  "targetUserId": "507f1f77bcf86cd799439011",
  "relationshipType": "family"
}
```

**Response:**

```json
{
  "success": true,
  "relation": {
    "id": "relation123",
    "targetUser": { ... },
    "relationshipType": "family",
    "status": "pending"
  }
}
```

### GET /api/auth/assist/relations

Get all assist relationships for current user.

**Authentication:** Required

### GET /api/auth/assist/helpers

Get users who have established relationships with the current user.

**Authentication:** Required

### DELETE /api/auth/assist/relations/:relationId

Delete an assist relationship.

**Authentication:** Required

### GET /api/auth/assist/check-incomplete

Check for incomplete assist relationships that need verification.

**Authentication:** Required

### POST /api/auth/assist/batch-update-relations

Batch update relationship information.

**Authentication:** Required

---

## Users

### GET /api/users/profile

Get current user's profile.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "uniqueCode": "ABC123",
    "avatar": null,
    "isActive": true,
    "role": { ... },
    "companionChat": { ... }
  }
}
```

### PUT /api/users/profile

Update current user's profile.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "Jane Doe",
  "avatar": "https://example.com/avatar.jpg"
}
```

### GET /api/users/stats

Get user statistics (requires permission).

**Authentication:** Required | **Permission:** `user:view`

### GET /api/users

Get all users with pagination (requires permission).

**Authentication:** Required | **Permission:** `user:view`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |
| `search` | string | - | Search by name or email |

### GET /api/users/:id

Get user by ID (requires permission).

**Authentication:** Required | **Permission:** `user:view`

### POST /api/users

Create a new user (requires permission).

**Authentication:** Required | **Permission:** `user:create`

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "roleId": "role_id_here"
}
```

### PUT /api/users/:id

Update user (requires permission).

**Authentication:** Required | **Permission:** `user:update`

### DELETE /api/users/:id

Delete user (requires permission).

**Authentication:** Required | **Permission:** `user:delete`

### PATCH /api/users/:id/toggle-status

Toggle user active status (requires permission).

**Authentication:** Required | **Permission:** `user:update`

---

## Chat

### POST /api/chat/sessions/by-code

Create a chat session using a user's unique code.

**Authentication:** Required

**Request Body:**

```json
{
  "targetCode": "ABC123"
}
```

**Response:**

```json
{
  "success": true,
  "session": {
    "id": "session123",
    "targetUser": { ... },
    "isActive": true,
    "createdAt": "2026-02-24T10:00:00.000Z"
  }
}
```

### POST /api/chat/sessions/:sessionId/messages

Send a message in a chat session.

**Authentication:** Required

**Request Body:**

```json
{
  "content": "Hello, how are you?"
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    "id": "msg123",
    "content": "Hello, how are you?",
    "role": "user",
    "timestamp": "2026-02-24T10:00:00.000Z"
  },
  "reply": {
    "id": "msg124",
    "content": "I'm doing well, thank you!",
    "role": "assistant",
    "timestamp": "2026-02-24T10:00:01.000Z"
  }
}
```

### GET /api/chat/sessions/:sessionId/messages

Get all messages in a chat session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "id": "msg123",
      "content": "Hello",
      "role": "user",
      "timestamp": "2026-02-24T10:00:00.000Z"
    }
  ]
}
```

### POST /api/chat/sessions/:sessionId/end

End a chat session.

**Authentication:** Required

### POST /api/chat/sessions/:sessionId/end-chat

End chat session and update memory.

**Authentication:** Required

### GET /api/chat/sessions/active

Get all active chat sessions for current user.

**Authentication:** Required

### GET /api/chat/sessions/preload/:targetUserId

Preload a chat session with a target user.

**Authentication:** Required

### GET /api/chat/stats

Get chat statistics for current user.

**Authentication:** Required

### GET /api/chat/sentiment/:strangerId

Get sentiment analysis for a relationship.

**Authentication:** Required

### GET /api/chat/contacts

Get all contacts (users with chat sessions).

**Authentication:** Required

---

## Questions

### GET /api/questions

Get questions by role and layer.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `role` | string | elder | Role type (elder, family, friend) |
| `layer` | string | basic | Layer type (basic, emotional) |

**Response:**

```json
{
  "success": true,
  "questions": [
    {
      "_id": "q123",
      "order": 1,
      "question": "What is your favorite memory?",
      "placeholder": "Enter your answer...",
      "type": "textarea"
    }
  ],
  "total": 10,
  "answered": 5,
  "progress": 50
}
```

### GET /api/questions/progress

Get question answering progress by layer.

**Authentication:** Required

**Response:**

```json
{
  "basic": {
    "total": 10,
    "answered": 5,
    "progress": 50
  },
  "emotional": {
    "total": 15,
    "answered": 3,
    "progress": 20
  }
}
```

### POST /api/questions/answer

Save or update an answer for a question.

**Authentication:** Required

**Request Body:**

```json
{
  "questionOrder": 1,
  "answer": "My favorite memory is...",
  "layer": "basic",
  "targetCode": "ABC123",
  "targetEmail": "user@example.com",
  "relationshipType": "family"
}
```

---

## Answers

### GET /api/answers/questions

Get all questions for answering.

**Authentication:** Required

### POST /api/answers/answer/self

Save self-answer (about yourself).

**Authentication:** Required

**Request Body:**

```json
{
  "questionId": "q123",
  "answer": "My answer...",
  "layer": "basic"
}
```

### POST /api/answers/answer/assist

Save assist-answer (about someone else).

**Authentication:** Required

**Request Body:**

```json
{
  "questionId": "q123",
  "answer": "Their answer...",
  "targetUserId": "target_user_id",
  "relationshipType": "family"
}
```

### GET /api/answers/progress/self

Get self-answer progress.

**Authentication:** Required

### GET /api/answers/answers/self

Get self-answers.

**Authentication:** Required

### GET /api/answers/answers/from-others

Get answers others have provided about you.

**Authentication:** Required

### GET /api/answers/answers/contributor/:contributorId

Get answers provided by a specific contributor.

**Authentication:** Required

### POST /api/answers/answers/batch-self

Batch save self-answers.

**Authentication:** Required

**Request Body:**

```json
{
  "answers": [
    {
      "questionId": "q123",
      "answer": "Answer 1",
      "layer": "basic"
    },
    {
      "questionId": "q124",
      "answer": "Answer 2",
      "layer": "basic"
    }
  ]
}
```

### POST /api/answers/answers/batch-assist

Batch save assist-answers.

**Authentication:** Required

### GET /api/answers/questions/assist

Get questions for assisting (answering about others).

**Authentication:** Required

---

## RoleCard

### POST /api/rolecard/generate

Generate a role card for the current user.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "rolecard": {
    "userId": "user123",
    "coreLayer": { ... },
    "relationLayers": [ ... ],
    "status": "completed"
  }
}
```

### POST /api/rolecard/generate/stream

Generate role card with SSE progress updates.

**Authentication:** Required

**Response:** Server-Sent Events stream

### GET /api/rolecard

Get current user's role card.

**Authentication:** Required

### PUT /api/rolecard

Update current user's role card.

**Authentication:** Required

### DELETE /api/rolecard

Delete current user's role card.

**Authentication:** Required

### POST /api/rolecard/assistants/:assistantId/regenerate

Regenerate guidelines for a specific assistant.

**Authentication:** Required

### POST /api/rolecard/vector-index/build

Build vector index for role card.

**Authentication:** Required

### GET /api/rolecard/vector-index/status

Get vector index status.

**Authentication:** Required

### GET /api/rolecard/layers/status

Get generation status for all layers.

**Authentication:** Required

### POST /api/rolecard/layers/core/stream

Generate core layer with SSE progress.

**Authentication:** Required

### POST /api/rolecard/layers/relation/:relationId/stream

Generate relation layer with SSE progress.

**Authentication:** Required

### POST /api/rolecard/layers/batch/stream

Batch generate all pending layers with SSE progress.

**Authentication:** Required

---

## Memory

### GET /api/memory/index/status

Get indexing status and memory statistics.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "isIndexing": false,
  "pendingCount": 0,
  "indexedCount": 150,
  "stats": {
    "totalMemories": 150,
    "totalTokens": 45000
  }
}
```

### GET /api/memory/busy

Check if memory system is busy.

**Authentication:** Required

### GET /api/memory/pending-topics

Get pending conversation topics (legacy).

**Authentication:** Required

### GET /api/memory/pending-topics/v2

Get pending conversation topics from dedicated manager.

**Authentication:** Required

### POST /api/memory/pending-topics

Add a new pending topic.

**Authentication:** Required

**Request Body:**

```json
{
  "topic": "Childhood memories",
  "withUserId": "target_user_id"
}
```

### DELETE /api/memory/pending-topics/:topicId

Clear a pending topic (legacy).

**Authentication:** Required

### DELETE /api/memory/pending-topics/v2/:topicId

Clear a pending topic from dedicated manager.

**Authentication:** Required

### POST /api/memory/index/trigger

Trigger indexing for all pending memories.

**Authentication:** Required

### GET /api/memory/stats

Get memory statistics for current user.

**Authentication:** Required

### GET /api/memory/proactive/check/:withUserId

Check if should send a proactive message.

**Authentication:** Required

### POST /api/memory/proactive/generate/:withUserId

Generate a proactive message.

**Authentication:** Required

### GET /api/memory/proactive/status/:withUserId

Get proactive messaging status.

**Authentication:** Required

---

## Sentiment

### GET /api/sentiment/:targetUserId/:strangerId

Get sentiment between two users.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "sentiment": {
    "score": 75,
    "status": "positive",
    "interactions": 10
  }
}
```

### PUT /api/sentiment/:targetUserId/:strangerId

Update sentiment between two users.

**Authentication:** Required

**Request Body:**

```json
{
  "score": 80
}
```

### POST /api/sentiment/:targetUserId/:strangerId/analyze

Analyze sentiment for a relationship.

**Authentication:** Required

### GET /api/sentiment/:targetUserId/stats

Get sentiment statistics for a user.

**Authentication:** Required

### POST /api/sentiment/batch-update

Batch update sentiment values.

**Authentication:** Required

---

## Roles

### GET /api/roles/permissions

Get all permissions (requires permission).

**Authentication:** Required | **Permission:** `permission:view`

**Response:**

```json
{
  "success": true,
  "permissions": [
    {
      "_id": "perm123",
      "name": "user:view",
      "description": "View user information"
    }
  ]
}
```

### POST /api/roles/permissions

Create a new permission (requires permission).

**Authentication:** Required | **Permission:** `permission:create`

**Request Body:**

```json
{
  "name": "custom:action",
  "description": "Custom permission description"
}
```

### PUT /api/roles/permissions/:id

Update a permission (requires permission).

**Authentication:** Required | **Permission:** `permission:update`

### DELETE /api/roles/permissions/:id

Delete a permission (requires permission).

**Authentication:** Required | **Permission:** `permission:delete`

### GET /api/roles

Get all roles (requires permission).

**Authentication:** Required | **Permission:** `role:view`

### GET /api/roles/:id

Get role by ID (requires permission).

**Authentication:** Required | **Permission:** `role:view`

### POST /api/roles

Create a new role (requires permission).

**Authentication:** Required | **Permission:** `role:create`

**Request Body:**

```json
{
  "name": "moderator",
  "description": "Content moderator",
  "permissions": ["perm123", "perm456"]
}
```

### PUT /api/roles/:id

Update a role (requires permission).

**Authentication:** Required | **Permission:** `role:update`

### DELETE /api/roles/:id

Delete a role (requires permission).

**Authentication:** Required | **Permission:** `role:delete`

### POST /api/roles/initialize

Initialize default roles and permissions.

**Authentication:** Required

---

## Settings

### GET /api/settings

Get all system settings (requires permission).

**Authentication:** Required | **Permission:** `system:view`

**Response:**

```json
{
  "success": true,
  "settings": {
    "llm": { ... },
    "database": { ... },
    "features": { ... }
  }
}
```

### PUT /api/settings/:category

Update settings category (requires permission).

**Authentication:** Required | **Permission:** `system:update`

### GET /api/settings/info

Get system information (requires permission).

**Authentication:** Required | **Permission:** `system:view`

### POST /api/settings/reset

Reset system to defaults (requires permission).

**Authentication:** Required | **Permission:** `system:update`

---

## Regions

### GET /api/regions/provinces

Get all provinces in China.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "provinces": [
    {
      "code": "110000",
      "name": "北京市"
    },
    {
      "code": "310000",
      "name": "上海市"
    }
  ]
}
```

### GET /api/regions/cities/:provinceCode

Get cities by province code.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "cities": [
    {
      "code": "110100",
      "name": "市辖区"
    }
  ]
}
```

### GET /api/regions/tree

Get complete provinces and cities tree structure.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "tree": [
    {
      "code": "110000",
      "name": "北京市",
      "cities": [ ... ]
    }
  ]
}
```
