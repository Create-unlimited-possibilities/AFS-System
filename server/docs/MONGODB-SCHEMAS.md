# MongoDB Schemas Documentation

## Overview

This document describes all Mongoose schemas used in the AFS-System with MongoDB 7.0.14.

## Connection Details

- **Host**: mongoserver:27017 (Docker) or localhost:27018 (local)
- **Database**: afs_db
- **Version**: MongoDB 7.0.14
- **ODM**: Mongoose

---

## Collections

### 1. users

User account and profile information with AI companion chat features.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| uniqueCode | String | Yes | Yes (unique) | 16-character unique identifier |
| email | String | Yes | Yes (unique) | User email (lowercase) |
| password | String | Yes | No | Hashed password |
| name | String | No | No | Display name (default: "用户") |
| role | ObjectId | No | No | Reference to Role collection |
| isActive | Boolean | No | No | Account status (default: true) |
| createdAt | Date | No | No | Account creation date |
| lastLogin | Date | No | No | Last login timestamp |

#### Nested: profile (Personal Profile)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| gender | String | Yes* | Enum: ['男', '女', '其他'] |
| birthDate | Date | Yes* | Date of birth |
| birthHour | Number | Yes* | Hour of birth (0-23) |
| birthPlace | Object | Yes* | Province/city info |
| residence | Object | No | Current residence |
| nationality | String | No | Nationality |
| ethnicity | String | No | Ethnic group |
| occupation | String | No | Occupation |
| education | String | No | Education level |
| maritalStatus | String | No | Enum: ['未婚', '已婚', '离异', '丧偶'] |
| children | Object | No | {sons: Number, daughters: Number} |
| height | Number | No | Height in cm |
| appearanceFeatures | String | No | Physical appearance notes |

#### Nested: companionChat (AI Companion Features)

##### roleCard (Role Card/Persona)

| Field | Type | Description |
|-------|------|-------------|
| personality | String | Personality traits |
| background | String | Life background |
| interests | Array[String] | Hobbies and interests |
| communicationStyle | String | Communication preferences |
| values | Array[String] | Core values |
| emotionalNeeds | Array[String] | Emotional requirements |
| lifeMilestones | Array[String] | Important life events |
| preferences | Array[String] | General preferences |
| memories | Array[String] | Important memories |
| strangerInitialSentiment | Number | Initial stranger sentiment (0-100) |

##### assistantsGuidelines (Assistant Conversation Guidelines)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assistantId | ObjectId | Yes | Reference to User |
| assistantName | String | No | Assistant's name |
| assistantUniqueCode | String | No | Assistant's unique code |
| assistRelationId | ObjectId | No | Reference to AssistRelation |
| relationType | String | Yes | Enum: ['family', 'friend'] |
| specificRelation | String | Yes | Specific relationship |
| conversationGuidelines | String | Yes | Pre-processed guidelines |
| compressedAnswers | Array | No | Compressed Q&A pairs |

##### strangerSentiments (Stranger Sentiment Tracking)

| Field | Type | Description |
|-------|------|-------------|
| strangerId | ObjectId | Reference to User |
| currentScore | Number | Current sentiment (0-100) |
| initialScore | Number | Initial sentiment value |
| history | Array | Sentiment change history |
| totalConversations | Number | Total conversation count |
| totalMessages | Number | Total message count |

##### conversationsAsTarget (Conversation History as Target)

| Field | Type | Description |
|-------|------|-------------|
| sessionId | String | Unique session identifier |
| interlocutorId | ObjectId | Conversation partner |
| relationType | String | Enum: ['family', 'friend', 'stranger'] |
| messages | Array | Conversation messages |

#### Indexes

- `uniqueCode`: unique
- `email`: unique
- `companionChat.assistantsGuidelines.assistantId`
- `companionChat.strangerSentiments.strangerId`
- `companionChat.conversationsAsTarget.sessionId`

---

### 2. chatsessions

Chat session management with LangGraph state and conversation cycles.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| sessionId | String | Yes | Yes (unique) | Unique session ID |
| targetUserId | ObjectId | Yes | Yes | User being conversed with |
| interlocutorUserId | ObjectId | Yes | Yes | Conversation initiator |
| relation | String | Yes | No | Enum: ['family', 'friend', 'stranger'] |
| assistRelationId | ObjectId | No | No | Reference to AssistRelation |
| specificRelation | String | No | No | Specific relationship |
| sentimentScore | Number | No | No | Sentiment (default: 50) |

#### Nested: dynamicRoleCard

| Field | Type | Description |
|-------|------|-------------|
| profile | Object | Personality, background, interests |
| interlocutorInfo | Object | Partner information |
| conversationGuidelines | String | Generated guidelines |
| generatedAt | Date | Generation timestamp |

#### Nested: langGraphState

| Field | Type | Description |
|-------|------|-------------|
| currentNode | String | Current LangGraph node |
| stateHistory | Array | Node transition history |

#### Nested: cycles (Conversation Cycles)

| Field | Type | Description |
|-------|------|-------------|
| cycleId | String | Cycle identifier |
| startedAt | Date | Start timestamp |
| endedAt | Date | End timestamp |
| messages | Array | Messages in this cycle |

#### Indexes

- `{ targetUserId: 1, interlocutorUserId: 1, isActive: 1 }`
- `{ sessionId: 1, isActive: 1 }`

---

### 3. assistrelations

Assistance relationships between users.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| assistantId | ObjectId | Yes | Yes | Assistant user ID |
| targetId | ObjectId | Yes | Yes | Target user ID |
| relationshipType | String | Yes | No | Enum: ['family', 'friend'] |
| specificRelation | String | No | No | Relationship description |
| friendLevel | String | No | No | Enum: ['casual', 'close', 'intimate'] |
| createdAt | Date | No | No | Creation timestamp |
| isActive | Boolean | No | No | Active status |

#### Nested: answerSummary

| Field | Type | Description |
|-------|------|-------------|
| hasAnswers | Boolean | Whether answers exist |
| basicAnswersCount | Number | Basic layer answer count |
| emotionalAnswersCount | Number | Emotional layer count |
| lastAnswerUpdatedAt | Date | Last update timestamp |

#### Indexes

- `{ assistantId: 1, targetId: 1 }`: unique

---

### 4. questions

Question bank for user profiling.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| role | String | Yes | Yes | Enum: ['elder', 'family', 'friend'] |
| layer | String | Yes | Yes | Enum: ['basic', 'emotional'] |
| order | Number | Yes | No | Display order (min: 1) |
| question | String | Yes | No | Question text |
| significance | String | No | No | Question significance (max 200 chars) |
| placeholder | String | No | No | Input placeholder |
| type | String | No | No | Enum: ['text', 'textarea', 'voice'] |
| active | Boolean | No | No | Active status (default: true) |

#### Indexes

- `{ role: 1, layer: 1, order: 1 }`
- `{ layer: 1, order: 1 }`

#### Static Methods

- `getQuestionsByLayer(layer)` - Get questions by layer
- `getAllActiveQuestions()` - Get all active questions

---

### 5. answers

User answers to questions.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| userId | ObjectId | Yes | Yes | Answering user |
| targetUserId | ObjectId | Yes | Yes | User being answered about |
| questionId | ObjectId | Yes | No | Reference to Question |
| questionLayer | String | Yes | No | Enum: ['basic', 'emotional'] |
| answer | String | Yes | No | Answer text |
| isSelfAnswer | Boolean | No | No | Self-answer flag |
| assistRelationId | ObjectId | No | No | Reference to AssistRelation |
| specificRelation | String | No | No | Relationship description |
| createdAt | Date | No | No | Creation timestamp |
| updatedAt | Date | No | No | Update timestamp |

#### Indexes

- `{ userId: 1, targetUserId: 1, questionId: 1 }`: unique

#### Static Methods

- `getProgress(userId, targetUserId, layer)` - Get answer progress
- `getAnswerStats(targetUserId)` - Get answer statistics

---

### 6. roles

User roles for permissions management.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| name | String | Yes | Yes (unique) | Role name |
| description | String | No | No | Role description |
| permissions | Array[ObjectId] | No | No | Reference to Permission |
| isSystem | Boolean | No | No | System role flag |
| createdAt | Date | No | No | Creation timestamp |
| updatedAt | Date | No | No | Update timestamp |

---

### 7. permissions

Permission definitions.

#### Schema

| Field | Type | Required | Indexed | Description |
|-------|------|----------|---------|-------------|
| name | String | Yes | Yes (unique) | Permission name |
| description | String | No | No | Permission description |
| category | String | No | No | Enum: ['user', 'role', 'system', 'content', 'other'] |
| createdAt | Date | No | No | Creation timestamp |

---

## Error Handling

All schemas include proper error handling for:

1. **Validation Errors** - Schema validation failures
2. **Duplicate Key Errors** - Unique constraint violations
3. **Cast Errors** - Type conversion failures
4. **Network Errors** - Connection issues

## Connection Status Codes

| Code | State | Description |
|------|-------|-------------|
| 0 | disconnected | Not connected |
| 1 | connected | Connected and ready |
| 2 | connecting | Currently connecting |
| 3 | disconnecting | Currently disconnecting |

## Best Practices

1. **Always use indexes** for frequently queried fields
2. **Use populate()** for referenced documents
3. **Implement proper error handling** for all database operations
4. **Use transactions** for multi-document operations
5. **Monitor connection state** for health checks
6. **Use lean()** for read-only queries to improve performance

## Testing

Run MongoDB tests using:

```bash
node server/scripts/test-mongodb.js
```

This will verify:
- Connection health
- Schema validation
- CRUD operations
- Index configuration
- Error handling
