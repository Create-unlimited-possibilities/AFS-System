# Questionnaire System Overview

## 1. Architecture Level

The Questionnaire System is a core component of the AFS (AI Family Story) platform that enables the collection, storage, and management of personal and family memories through structured questions. The system supports both self-answered questions and collaborative answering by family members and friends.

### 1.1 System Purpose

The questionnaire system serves three primary purposes:

1. **Memory Collection**: Gather biographical information and personal stories from elderly users
2. **Collaborative Contribution**: Allow family members and friends to contribute additional perspectives
3. **Role Card Foundation**: Provide data for generating AI companion personality profiles

### 1.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Questionnaire System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐      ┌─────────────────┐                  │
│  │  Question Set   │      │   Answer Set    │                  │
│  │  (Self-Answer)  │      │  (Assisted)     │                  │
│  │                 │      │                 │                  │
│  │  - Basic Layer  │      │  - Family Role  │                  │
│  │  - Emotional    │      │  - Friend Role  │                  │
│  │    Layer        │      │                 │                  │
│  └────────┬────────┘      └────────┬────────┘                  │
│           │                        │                            │
│           └────────────┬───────────┘                            │
│                        │                                        │
│           ┌────────────▼────────────┐                           │
│           │   Storage Service       │                           │
│           │  (Database + File System)│                          │
│           └────────────┬────────────┘                           │
│                        │                                        │
│           ┌────────────▼────────────┐                           │
│           │   Token Counter         │                           │
│           │   (Memory Usage)        │                           │
│           └─────────────────────────┘                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Module Structure

```
server/src/modules/qa/
├── models/
│   ├── question.js      # Question schema definition
│   └── answer.js        # Answer schema definition
├── repositories/
│   ├── question.js      # Question data access layer
│   └── answer.js        # Answer data access layer
├── services/
│   ├── question.js      # Question business logic
│   └── answer.js        # Answer business logic
├── routes/
│   ├── questions.js     # Question API endpoints
│   └── answers.js       # Answer API endpoints
└── controller.js        # Unified request handlers

web/app/
├── questions/
│   ├── page.tsx         # Self-questionnaire page
│   └── assist/
│       └── page.tsx     # Assisted questionnaire page
└── answers/
    └── page.tsx         # View answers from others
```

---

## 2. Function Level

### 2.1 Question Structure

Questions in the system are organized by three key dimensions:

#### Role Types
- **elder**: Questions designed for elderly users to answer about themselves
- **family**: Questions for family members to answer about their elders
- **friend**: Questions for friends to answer about their acquaintances

#### Layer Types
- **basic**: Surface-level questions about daily life, preferences, and facts
- **emotional**: Deeper questions about feelings, memories, and experiences

#### Question Types
- **text**: Single-line text input
- **textarea**: Multi-line text input (default)
- **voice**: Voice input (reserved for future implementation)

### 2.2 Answer Modes

#### Self-Answers
- Users answer questions about themselves
- Stored with `isSelfAnswer: true`
- Both `userId` and `targetUserId` point to the same user

#### Assisted Answers
- Family/friends answer questions about another user
- Stored with `isSelfAnswer: false`
- Links to an `AssistRelation` to track the relationship
- Requires an active assist relationship between users

### 2.3 Key Features

1. **Progress Tracking**: Calculate completion percentage for each question layer
2. **Batch Operations**: Save multiple answers in a single request
3. **Token Counting**: Track memory usage for role card generation
4. **Dual Storage**: Persist answers in both MongoDB and file system
5. **Answer History**: Track when answers were created and modified

---

## 3. Code Level

### 3.1 Question Schema

```javascript
const questionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['elder', 'family', 'friend'],
    required: true,
    index: true
  },
  layer: {
    type: String,
    enum: ['basic', 'emotional'],
    required: true,
    index: true
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  question: {
    type: String,
    required: true
  },
  significance: {
    type: String,
    default: '',
    description: '问题的意义说明，用于角色卡生成（最大200字）'
  },
  placeholder: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'voice'],
    default: 'textarea'
  },
  active: {
    type: Boolean,
    default: true
  }
});
```

### 3.2 Answer Schema

```javascript
const answerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  questionLayer: {
    type: String,
    enum: ['basic', 'emotional'],
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  isSelfAnswer: {
    type: Boolean,
    default: true
  },
  assistRelationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssistRelation',
    required: false
  },
  specificRelation: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});
```

### 3.3 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions` | Get questions by role and layer |
| GET | `/api/questions/progress` | Get user's answer progress |
| POST | `/api/questions/answer` | Save/update single answer |
| GET | `/api/answers/questions` | Get questions with user's answers |
| POST | `/api/answers/answer/self` | Save self-answer |
| POST | `/api/answers/answer/assist` | Save assisted answer |
| GET | `/api/answers/progress/self` | Get self-answer progress |
| GET | `/api/answers/answers/self` | Get all self-answers |
| GET | `/api/answers/answers/from-others` | Get answers from contributors |
| POST | `/api/answers/answers/batch-self` | Batch save self-answers |
| POST | `/api/answers/answers/batch-assist` | Batch save assisted answers |
| GET | `/api/answers/questions/assist` | Get assisted questions |

### 3.4 Frontend State Management

The frontend uses React hooks for state management:

```typescript
interface Question {
  _id: string
  category: string
  questionText: string
  questionType: 'text' | 'textarea' | 'choice'
  options?: string[]
  order: number
}

interface Answer {
  questionId: string
  answer: string
}
```

### 3.5 Storage Flow

```
User Input
    ↓
API Endpoint
    ↓
AnswerService.saveSelfAnswer() / saveAssistAnswer()
    ↓
AnswerRepository.create() / findOneAndUpdate()
    ↓
StorageService.saveAnswer()
    ↓
┌─────────────┬─────────────┐
│   MongoDB   │ File System │
│  (Answers)  │ (Memories)  │
└─────────────┴─────────────┘
    ↓
UserRepository.updateTokenCount()
    ↓
Response
```

---

## Dependencies

The Questionnaire System integrates with:

- **User Module**: User authentication and profile management
- **Assist Module**: Relationship management for assisted answers
- **Storage Module**: File system persistence for memory files
- **Token Utils**: Memory token counting for role card generation
