# Questions Module

## 1. Architecture Level

The Questions Module is responsible for managing the question database that serves as the foundation for memory collection in the AFS System. It provides a flexible, multi-dimensional question structure that supports different user roles, relationship types, and depth levels.

### 1.1 Question Organization

```
Question Structure
├── Role (Who answers?)
│   ├── elder        - Elderly users answering about themselves
│   ├── family       - Family members answering about elders
│   └── friend       - Friends answering about acquaintances
│
├── Layer (Question depth)
│   ├── basic        - Surface-level facts and preferences
│   └── emotional    - Deep feelings and memories
│
└── Type (Input method)
    ├── text         - Single-line input
    ├── textarea     - Multi-line input (default)
    └── voice        - Voice input (future)
```

### 1.2 Module Components

```
server/src/modules/qa/
├── models/
│   └── question.js           # Question Mongoose schema
├── repositories/
│   └── question.js           # Question data access layer
├── services/
│   └── question.js           # Question business logic
└── routes/
    └── questions.js          # Question API routes
```

---

## 2. Function Level

### 2.1 Question Model Features

#### Core Fields
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | String | Yes | Target user role (elder/family/friend) |
| `layer` | String | Yes | Question depth (basic/emotional) |
| `order` | Number | Yes | Display order (starts at 1) |
| `question` | String | Yes | The question text |
| `significance` | String | No | Purpose description for role card generation |
| `placeholder` | String | No | Input placeholder text |
| `type` | String | No | Input type (default: textarea) |
| `active` | Boolean | No | Enable/disable question (default: true) |

#### Indexes
```javascript
// Compound index for efficient queries
questionSchema.index({ role: 1, layer: 1, order: 1 });
questionSchema.index({ layer: 1, order: 1 });
```

### 2.2 Repository Layer

The `QuestionRepository` class provides data access methods:

```javascript
class QuestionRepository {
  async findOne(query)              // Find single question
  async findById(id)                // Find by ObjectId
  async find(query)                 // Find with sort by order
  async countDocuments(query)       // Count matching questions
  async getQuestionsByLayer(layer)  // Get all active by layer
  async getAllActiveQuestions()     // Get all active questions
}
```

### 2.3 Service Layer

The `QuestionService` class provides business logic:

```javascript
class QuestionService {
  // Get questions filtered by role and layer
  async getQuestionsByRoleAndLayer(role, layer)

  // Calculate progress statistics
  async getProgressByLayer(userId, role, layer)
}
```

---

## 3. Code Level

### 3.1 Question Schema Definition

**File: `server/src/modules/qa/models/question.js`**

```javascript
import mongoose from 'mongoose';

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

// 索引
questionSchema.index({ role: 1, layer: 1, order: 1 });
questionSchema.index({ layer: 1, order: 1 });

// 静态方法：获取特定层级的所有问题
questionSchema.statics.getQuestionsByLayer = async function(layer) {
  return this.find({ layer, active: true }).sort({ order: 1 });
};

// 静态方法：获取所有激活的问题
questionSchema.statics.getAllActiveQuestions = async function() {
  return this.find({ active: true }).sort({ layer: 1, order: 1 });
};

export default mongoose.model('Question', questionSchema);
```

### 3.2 Repository Implementation

**File: `server/src/modules/qa/repositories/question.js`**

```javascript
import Question from '../models/question.js';

export default class QuestionRepository {
  async findOne(query) {
    return await Question.findOne(query);
  }

  async findById(id) {
    return await Question.findById(id);
  }

  async find(query) {
    return await Question.find(query).sort({ order: 1 }).lean();
  }

  async countDocuments(query) {
    return await Question.countDocuments(query);
  }

  async getQuestionsByLayer(layer) {
    return await Question.find({ layer, active: true }).sort({ order: 1 });
  }

  async getAllActiveQuestions() {
    return await Question.find({ active: true }).sort({ layer: 1, order: 1 });
  }
}
```

### 3.3 Service Implementation

**File: `server/src/modules/qa/services/question.js`**

```javascript
import QuestionRepository from '../repositories/question.js';

export default class QuestionService {
  constructor() {
    this.questionRepository = new QuestionRepository();
  }

  async getQuestionsByRoleAndLayer(role, layer) {
    const query = { active: true };

    if (role) {
      query.role = role;
    }

    if (layer) {
      query.layer = layer;
    }

    return await this.questionRepository.find(query);
  }

  async getProgressByLayer(userId, role, layer) {
    const totalQuestions = await this.questionRepository.countDocuments({
      role,
      layer,
      active: true
    });

    return {
      total: totalQuestions,
      answered: 0,
      progress: 0
    };
  }
}
```

### 3.4 API Routes

**File: `server/src/modules/qa/routes/questions.js`**

```javascript
import express from 'express';
import Question from '../models/question.js';
import Answer from '../models/answer.js';
import User from '../../user/model.js';
import { protect } from '../../auth/middleware.js';
import StorageService from '../../../core/storage/service.js';
import { countTokens } from '../../../core/utils/tokens.js';

const router = express.Router();
const storageService = new StorageService();

// 1. 获取所有层次的进度（用于左侧面板）
router.get('/progress', protect, async (req, res) => {
  try {
    const { role = 'elder' } = req.query;
    const userId = req.user.id;

    const layers = ['basic', 'emotional'];
    const result = {};

    for (const layer of layers) {
      const questions = await Question.countDocuments({ role, layer, active: true });
      const answered = await Answer.countDocuments({
        targetUserId: userId,
        userId: userId,
        questionLayer: layer
      });

      result[layer] = {
        total: questions,
        answered,
        progress: questions > 0 ? Math.round((answered / questions) * 100) : 0
      };
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取进度失败' });
  }
});

// 2. 获取某个层次的所有问题 + 已答答案
router.get('/', protect, async (req, res) => {
  try {
    const { role = 'elder', layer = 'basic' } = req.query;
    const userId = req.user.id;

    const questions = await Question.find({ role, layer, active: true })
      .sort({ order: 1 })
      .lean();

    const memories = await Answer.find({
      targetUserId: userId,
      userId: userId,
      questionLayer: layer
    }).lean();

    const answerMap = {};
    memories.forEach(m => {
      const questionId = m.questionId._id ? m.questionId._id.toString() : m.questionId.toString();
      answerMap[questionId] = m.answer;
    });

    const result = questions.map(q => ({
      _id: q._id,
      order: q.order,
      question: q.question,
      placeholder: q.placeholder || '',
      type: q.type || 'textarea',
      answer: answerMap[q._id.toString()] || ''
    }));

    const total = questions.length;
    const answered = Object.keys(answerMap).length;

    res.json({
      success: true,
      questions: result,
      total,
      answered,
      progress: total > 0 ? Math.round((answered / total) * 100) : 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// 3. 保存/更新单条答案（支持批量保存）
router.post('/answer', protect, async (req, res) => {
  try {
    const { questionOrder, answer, layer, targetCode, targetEmail, relationshipType } = req.body;
    const userId = req.user.id;

    // 验证目标用户
    const targetUser = await User.findOne({
      uniqueCode: targetCode,
      email: targetEmail.toLowerCase()
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    if (targetUser._id.toString() === userId.toString()) {
      return res.status(400).json({ success: false, error: '不能为自己回答问题' });
    }

    const question = await Question.findOne({
      order: questionOrder,
      layer,
      active: true
    });

    if (!question) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }

    const isSelfAnswer = false;
    const targetUserId = targetUser._id;

    const answerData = {
      userId,
      targetUserId,
      questionId: question._id,
      question,
      answer,
      layer,
      isSelfAnswer,
      relationshipType: relationshipType || 'friend',
      helper: req.user
    };

    const result = await storageService.saveAnswer(answerData);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const tokenCount = countTokens(answer);
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { 'companionChat.roleCard.memoryTokenCount': tokenCount }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '保存答案失败' });
  }
});

export default router;
```

### 3.5 Usage Examples

#### Fetch Questions by Layer

```javascript
// GET /api/questions?layer=basic&role=elder
const response = await fetch('/api/questions?layer=basic&role=elder', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
// Returns: { success: true, questions: [...], total: 10, answered: 5, progress: 50 }
```

#### Get Progress

```javascript
// GET /api/questions/progress?role=elder
const response = await fetch('/api/questions/progress?role=elder', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
// Returns: { basic: { total: 10, answered: 5, progress: 50 }, emotional: {...} }
```

### 3.6 Question Examples

#### Basic Layer Examples
```javascript
{
  role: 'elder',
  layer: 'basic',
  order: 1,
  question: '您叫什么名字？',
  type: 'text',
  placeholder: '请输入您的姓名',
  active: true
}

{
  role: 'elder',
  layer: 'basic',
  order: 2,
  question: '您的出生日期是？',
  type: 'text',
  placeholder: 'YYYY-MM-DD',
  active: true
}
```

#### Emotional Layer Examples
```javascript
{
  role: 'elder',
  layer: 'emotional',
  order: 1,
  question: '童年最快乐的记忆是什么？',
  type: 'textarea',
  placeholder: '请分享您的童年回忆...',
  significance: '了解用户的核心记忆，用于构建共情对话',
  active: true
}
```

---

## Relationships

The Questions Module depends on:
- **MongoDB**: For persistent storage
- **Auth Module**: For user authentication (`protect` middleware)
- **Answer Module**: For calculating progress
- **Storage Module**: For saving memory files
