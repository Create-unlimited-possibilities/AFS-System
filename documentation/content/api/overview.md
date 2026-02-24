---
sidebar_position: 1
---

# API Overview

The AFS System provides a comprehensive REST API for managing users, AI conversations, memories, questionnaires, and administration. The API is built on Express.js with MongoDB for data persistence.

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000` |
| Production | `https://your-domain.com` |

## Authentication

Most endpoints require authentication using JWT (JSON Web Token) tokens.

### Getting a Token

After login or registration, you'll receive a token in the response:

```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "uniqueCode": "ABC123",
    "role": {
      "name": "user",
      "permissions": []
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Using the Token

Include the token in the Authorization header for protected requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/users/profile
```

```javascript
fetch('/api/users/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message description"
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

## API Modules

The AFS System API is organized into the following modules:

| Module | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| Authentication | `/api/auth` | User registration, login, session management | Partial |
| Users | `/api/users` | User profile and management | Yes |
| Chat | `/api/chat` | AI conversation sessions and messaging | Yes |
| Questions | `/api/questions` | Questionnaire questions | Yes |
| Answers | `/api/answers` | Questionnaire answers | Yes |
| RoleCard | `/api/rolecard` | AI role card generation and management | Yes |
| Memory | `/api/memory` | Memory indexing, compression, retrieval | No* |
| Sentiment | `/api/sentiment` | Relationship sentiment tracking | Yes |
| Roles | `/api/roles` | Role and permission management | Yes |
| Settings | `/api/settings` | System settings configuration | Yes |
| Regions | `/api/regions` | China administrative regions data | No |
| Admin | `/api/admin` | Administrative operations | Yes |
| Admin Auth | `/admin-auth` | Admin login/register | No |

*Memory routes have their own authentication middleware

## Pagination

List endpoints support pagination using query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

Example request:

```bash
GET /api/admin/users?page=2&limit=50
```

Response format:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

## Filtering and Search

Many endpoints support filtering and search:

```bash
# Search users
GET /api/admin/users?search=john

# Filter by role
GET /api/questions?role=elder&layer=basic

# Filter by status
GET /api/admin/users?isActive=true
```

## SSE (Server-Sent Events)

Some endpoints support Server-Sent Events for streaming responses:

- RoleCard generation with progress
- Real-time AI responses

Example:

```javascript
const eventSource = new EventSource('/api/rolecard/generate/stream', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.progress);
};
```

## Admin API

The Admin API has dedicated authentication routes and requires admin role:

- Admin Login: `POST /admin-auth/login`
- Admin Register: `POST /admin-auth/register`
- Admin endpoints: `GET /api/admin/*` (requires admin role)

See [Admin API Documentation](/docs/api/admin) for details.
