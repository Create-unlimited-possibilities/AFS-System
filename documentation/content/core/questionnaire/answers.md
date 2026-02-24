# Answers Module

## 1. Architecture Level

The Answers Module manages user responses to questionnaire items. It handles both self-answered questions (where users answer about themselves) and assisted answers (where family/friends answer about another user). The module ensures data integrity through relationship validation and maintains token counts for role card generation.

### 1.1 Answer Flow

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │ POST /api/answers/answer/self
       │ POST /api/answers/answer/assist
       │ POST /api/answers/answers/batch-self
       │ POST /api/answers/answers/batch-assist
       ▼
┌─────────────────────┐
│ AnswerController    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ AnswerService       │
│ - Validate relation │
│ - Calculate tokens  │
│ - Upsert answer     │
└──────┬──────────────┘
       │
       ├──────────────┬───────────────┐
       ▼              ▼               ▼
┌─────────────┐ ┌──────────┐ ┌─────────────┐
│   MongoDB   │ │File System│ │User Model   │
│ (Answer)    │ │(Memories) │ │(Token Count)│
└─────────────┘ └──────────┘ └─────────────┘
```

### 1.2 Module Structure

```
server/src/modules/qa/
├── models/
│   └── answer.js           # Answer Mongoose schema
├── repositories/
│   └── answer.js           # Answer data access layer
├── services/
│   └── answer.js           # Answer business logic
├── routes/
│   └── answers.js          # Answer API routes
└── controller.js           # Unified request handlers
```

---

## 2. Function Level

### 2.1 Answer Model

#### Core Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | ObjectId | Yes | ID of user who provided the answer |
| `targetUserId` | ObjectId | Yes | ID of user the answer is about |
| `questionId` | ObjectId | Yes | ID of the question being answered |
| `questionLayer` | String | Yes | Question depth (basic/emotional) |
| `answer` | String | Yes | The answer content |
| `isSelfAnswer` | Boolean | No | Self-answer flag (default: true) |
| `assistRelationId` | ObjectId | No | Link to assist relationship |
| `specificRelation` | String | No | Additional relationship detail |
| `createdAt` | Date | No | Creation timestamp |
| `updatedAt` | Date | No | Last update timestamp |

#### Unique Constraint
```javascript
// One answer per (userId, targetUserId, questionId) combination
answerSchema.index({ userId: 1, targetUserId: 1, questionId: 1 }, { unique: true });
```

### 2.2 Answer Types

#### Self-Answers
- `userId === targetUserId`
- `isSelfAnswer: true`
- No assist relation required
- Used for building personal role cards

#### Assisted Answers
- `userId !== targetUserId`
- `isSelfAnswer: false`
- Requires valid `assistRelationId`
- Links answerer to target via relationship

### 2.3 Service Layer Functions

| Function | Description |
|----------|-------------|
| `saveSelfAnswer(userId, questionId, answer)` | Save/update self-answer |
| `saveAssistAnswer(userId, targetUserId, questionId, answer)` | Save/update assisted answer |
| `getSelfProgress(userId)` | Get completion progress |
| `getSelfAnswers(userId, layer)` | Get all self-answers |
| `getAnswersFromOthers(targetUserId)` | Get answers from contributors |
| `getContributorAnswers(targetUserId, contributorId)` | Get specific contributor's answers |
| `batchSaveSelfAnswers(userId, answers)` | Batch save self-answers |
| `batchSaveAssistAnswers(userId, targetUserId, answers)` | Batch save assisted answers |
| `getAssistAnswers(userId, targetUserId)` | Get assisted answers |

---

## 3. Code Level

### 3.1 Answer Schema Definition

**File: `server/src/modules/qa/models/answer.js`**

```javascript
import mongoose from 'mongoose';

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

// 复合索引：确保同一用户对同一目标的同一问题只能回答一次
answerSchema.index({ userId: 1, targetUserId: 1, questionId: 1 }, { unique: true });

// 更新时间戳
answerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 静态方法：获取用户的回答进度
answerSchema.statics.getProgress = async function(userId, targetUserId, layer) {
  const Question = mongoose.model('Question');

  const totalQuestions = await Question.countDocuments({
    role: 'elder',
    layer,
    active: true
  });

  const answeredQuestions = await this.countDocuments({
    userId,
    targetUserId: userId,
    questionLayer: layer,
    isSelfAnswer: true
  });

  return {
    total: totalQuestions,
    answered: answeredQuestions,
    percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
  };
};

export default mongoose.model('Answer', answerSchema);
```

### 3.2 Repository Implementation

**File: `server/src/modules/qa/repositories/answer.js`**

```javascript
import Answer from '../models/answer.js';

export default class AnswerRepository {
  async create(answerData) {
    const answer = new Answer(answerData);
    return await answer.save();
  }

  async findOne(query) {
    return await Answer.findOne(query).populate('questionId');
  }

  async find(query) {
    return await Answer.find(query)
      .populate('questionId')
      .populate('userId', 'name email uniqueCode')
      .sort({ createdAt: -1 });
  }

  async findWithAssistRelation(query) {
    return await Answer.find(query)
      .populate('questionId')
      .populate('userId', 'name email uniqueCode')
      .populate('assistRelationId')
      .sort({ createdAt: -1 });
  }

  async findOneAndUpdate(query, update, options = {}) {
    return await Answer.findOneAndUpdate(query, update, options);
  }

  async deleteMany(query) {
    return await Answer.deleteMany(query);
  }

  async insertMany(documents) {
    return await Answer.insertMany(documents);
  }

  async countDocuments(query) {
    return await Answer.countDocuments(query);
  }

  async getProgress(userId, targetUserId, layer) {
    const Question = (await import('../models/question.js')).default;

    const totalQuestions = await Question.countDocuments({
      role: 'elder',
      layer,
      active: true
    });

    const answeredQuestions = await this.countDocuments({
      userId,
      targetUserId: userId,
      questionLayer: layer,
      isSelfAnswer: true
    });

    return {
      total: totalQuestions,
      answered: answeredQuestions,
      percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    };
  }
}
```

### 3.3 Service Implementation (Key Functions)

**File: `server/src/modules/qa/services/answer.js`**

```javascript
import AnswerRepository from '../repositories/answer.js';
import QuestionRepository from '../repositories/question.js';
import UserRepository from '../../user/repository.js';
import AssistRelationRepository from '../../assist/repository.js';
import StorageService from '../../../core/storage/service.js';
import { countTokens } from '../../../core/utils/tokens.js';

export default class AnswerService {
  constructor() {
    this.answerRepository = new AnswerRepository();
    this.questionRepository = new QuestionRepository();
    this.userRepository = new UserRepository();
    this.assistRelationRepository = new AssistRelationRepository();
    this.storageService = new StorageService();
  }

  async saveSelfAnswer(userId, questionId, answer) {
    const question = await this.questionRepository.findById(questionId);
    if (!question) {
      throw new Error('问题不存在');
    }

    const existingAnswer = await this.answerRepository.findOne({
      userId,
      targetUserId: userId,
      questionId
    });

    if (existingAnswer) {
      const oldTokenCount = countTokens(existingAnswer.answer);
      const newTokenCount = countTokens(answer);
      const tokenDiff = newTokenCount - oldTokenCount;

      existingAnswer.answer = answer;
      existingAnswer.updatedAt = new Date();
      await existingAnswer.save();

      await this.storageService.saveAnswer({
        userId,
        targetUserId: userId,
        questionId: question._id,
        question,
        answer,
        layer: question.layer,
        questionRole: question.role,
        questionOrder: question.order,
        helperId: null,
        helperNickname: null
      });

      // 更新 token 数
      if (tokenDiff !== 0) {
        await this.userRepository.findByIdAndUpdate(userId, {
          $inc: { 'companionChat.roleCard.memoryTokenCount': tokenDiff }
        });
      }

      return existingAnswer;
    }

    // Create new answer
    const newAnswer = await this.answerRepository.create({
      userId,
      targetUserId: userId,
      questionId,
      questionLayer: question.layer,
      answer,
      isSelfAnswer: true,
      assistRelationId: null,
      specificRelation: ''
    });

    await this.storageService.saveAnswer({
      userId,
      targetUserId: userId,
      questionId: question._id,
      question,
      answer,
      layer: question.layer,
      questionRole: question.role,
      questionOrder: question.order,
      helperId: null,
      helperNickname: null
    });

    const tokenCount = countTokens(answer);
    await this.userRepository.findByIdAndUpdate(userId, {
      $inc: { 'companionChat.roleCard.memoryTokenCount': tokenCount }
    });

    return newAnswer;
  }

  async saveAssistAnswer(userId, targetUserId, questionId, answer) {
    const relation = await this.assistRelationRepository.findOne({
      assistantId: userId,
      targetId: targetUserId,
      isActive: true
    });

    if (!relation) {
      throw new Error('您没有协助该用户的权限');
    }

    const question = await this.questionRepository.findById(questionId);
    if (!question) {
      throw new Error('问题不存在');
    }

    // Similar logic to saveSelfAnswer but with relation info...
    // (Implementation follows same pattern with assistRelationId)
  }

  async getSelfProgress(userId) {
    const basicProgress = await this.getProgress(userId, userId, 'basic');
    const emotionalProgress = await this.getProgress(userId, userId, 'emotional');

    const totalProgress = basicProgress.total + emotionalProgress.total;
    const totalAnswered = basicProgress.answered + emotionalProgress.answered;
    const overallPercentage = totalProgress > 0
      ? Math.round((totalAnswered / totalProgress) * 100)
      : 0;

    return {
      basic: basicProgress,
      emotional: emotionalProgress,
      overall: {
        total: totalProgress,
        answered: totalAnswered,
        percentage: overallPercentage
      }
    };
  }

  async batchSaveSelfAnswers(userId, answers) {
    // Get all questions with layer info
    const answerDataWithLayers = [];
    for (const answerData of answers) {
      const question = await this.questionRepository.findById(answerData.questionId);
      if (!question) continue;
      answerDataWithLayers.push({
        ...answerData,
        layer: question.layer,
        questionObj: question
      });
    }

    // Group by layer
    const answersByLayer = {
      basic: [],
      emotional: []
    };

    for (const data of answerDataWithLayers) {
      if (answersByLayer[data.layer]) {
        answersByLayer[data.layer].push(data);
      }
    }

    // Use bulkWrite for batch upsert
    let totalTokenCount = 0;
    const allSavedAnswers = [];

    for (const layer of ['basic', 'emotional']) {
      const layerAnswers = answersByLayer[layer];
      if (layerAnswers.length > 0) {
        const bulkOps = [];

        for (const answerData of layerAnswers) {
          const question = answerData.questionObj;

          // Save to file system
          await this.storageService.saveAnswer({
            userId,
            targetUserId: userId,
            questionId: question._id,
            question,
            answer: answerData.answer,
            layer: question.layer,
            questionRole: question.role,
            questionOrder: question.order,
            helperId: null,
            helperNickname: null
          });

          bulkOps.push({
            replaceOne: {
              filter: {
                userId,
                targetUserId: userId,
                questionId: question._id
              },
              replacement: {
                userId,
                targetUserId: userId,
                questionId: question._id,
                questionLayer: question.layer,
                answer: answerData.answer,
                isSelfAnswer: true,
                assistRelationId: null,
                specificRelation: '',
                updatedAt: new Date()
              },
              upsert: true
            }
          });

          totalTokenCount += countTokens(answerData.answer);
        }

        if (bulkOps.length > 0) {
          await Answer.bulkWrite(bulkOps, { ordered: false });
          const savedAnswers = await this.answerRepository.find({
            userId,
            targetUserId: userId,
            questionLayer: layer
          });
          allSavedAnswers.push(...savedAnswers);
        }
      }
    }

    // Recalculate total token count
    if (allSavedAnswers.length > 0) {
      const newTotalTokenCount = allSavedAnswers.reduce((sum, a) => sum + countTokens(a.answer), 0);
      await this.userRepository.findByIdAndUpdate(userId, {
        $set: { 'companionChat.roleCard.memoryTokenCount': newTotalTokenCount }
      });
    }

    return { savedCount: allSavedAnswers.length };
  }
}
```

### 3.4 API Routes

**File: `server/src/modules/qa/routes/answers.js`**

```javascript
import express from 'express';
import answerController from '../controller.js';
import { protect } from '../../auth/middleware.js';

const router = express.Router();

router.get('/questions', protect, (req, res) => {
  answerController.getQuestions(req, res);
});

router.post('/answer/self', protect, (req, res) => {
  answerController.saveSelfAnswer(req, res);
});

router.post('/answer/assist', protect, (req, res) => {
  answerController.saveAssistAnswer(req, res);
});

router.get('/progress/self', protect, (req, res) => {
  answerController.getSelfProgress(req, res);
});

router.get('/answers/self', protect, (req, res) => {
  answerController.getSelfAnswers(req, res);
});

router.get('/answers/from-others', protect, (req, res) => {
  answerController.getAnswersFromOthers(req, res);
});

router.get('/answers/contributor/:contributorId', protect, (req, res) => {
  answerController.getContributorAnswers(req, res);
});

router.post('/answers/batch-self', protect, (req, res) => {
  answerController.batchSaveSelfAnswers(req, res);
});

router.post('/answers/batch-assist', protect, (req, res) => {
  answerController.batchSaveAssistAnswers(req, res);
});

router.get('/questions/assist', protect, (req, res) => {
  answerController.getAssistQuestions(req, res);
});

export default router;
```

### 3.5 Storage Integration

Answers are stored in two locations:

1. **MongoDB (Answer Collection)**: Structured queryable data
2. **File System (Memory Files)**: Unstructured memory storage for AI processing

The `StorageService.saveAnswer()` method handles dual storage:

```javascript
async saveAnswer(answerData) {
  const { userId, targetUserId, questionId, question, answer, layer } = answerData;

  // 1. Save to MongoDB
  const dbAnswer = await Answer.findOneAndUpdate(
    { userId, targetUserId, questionId },
    { question, answer, questionLayer: layer, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  // 2. Sync to file system
  await this.syncToFileSystem({
    ...dbAnswer.toObject(),
    question,
    questionRole,
    questionOrder,
    helperId: helperId || null,
    helperNickname: helperNickname || null
  });

  return { success: true, answer: dbAnswer };
}
```

---

## Dependencies

The Answers Module integrates with:
- **User Module**: User profiles and token counting
- **Question Module**: Question validation
- **Assist Module**: Relationship validation for assisted answers
- **Storage Module**: File system persistence
- **Auth Module**: User authentication and authorization
