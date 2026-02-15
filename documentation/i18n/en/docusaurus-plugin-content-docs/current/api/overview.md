---
sidebar_position: 4
---

# API Overview

RESTful API documentation for AFS System.

## Base URL

```
Development: http://localhost:3001
Production: https://api.your-domain.com
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

## Response Format

All responses follow a standard format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Main Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Questions & Answers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | List all questions |
| GET | `/api/questions/:id` | Get question details |
| POST | `/api/answers` | Submit answer |
| GET | `/api/answers/user/:userId` | Get user answers |

### AI Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send chat message |
| GET | `/api/chat/history/:sessionId` | Get chat history |

### Role Cards

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rolecard/generate/:userId` | Generate role card |
| GET | `/api/rolecard/:userId` | Get user role card |

## Rate Limiting

API requests are limited to 100 requests per minute per user.

## Error Codes

| Code | Description |
|------|-------------|
| AUTH001 | Invalid credentials |
| AUTH002 | Token expired |
| AUTH003 | Insufficient permissions |
| DATA001 | Resource not found |
| DATA002 | Validation error |
| AI001 | AI service unavailable |
