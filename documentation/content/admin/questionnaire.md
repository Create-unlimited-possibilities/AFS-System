---
sidebar_position: 3
---

# Questionnaire Management

The Questionnaire Management module provides tools for configuring the questions used in the AFS System's user onboarding questionnaire.

## Architecture Level

### Module Structure

```
Questionnaire Management Module
├── Backend (server/src/modules/admin/)
│   ├── controller.js - getQuestions(), createQuestion(), updateQuestion(), etc.
│   ├── service.js - Question ordering, batch import logic
│   └── route.js - API endpoints (/admin/questions/*)
│
└── Frontend (web/app/admin/questionnaires/)
    ├── page.tsx - Question list with filters
    ├── components/
    │   ├── QuestionForm.tsx - Create/edit form
    │   └── QuestionList.tsx - Display list with actions
```

### Question Data Model

```
Question
├── _id: ObjectId
├── role: 'elder' | 'family' | 'friend'
├── layer: 'basic' | 'emotional'
├── order: Number (within role+layer)
├── question: String
├── placeholder: String (optional)
├── type: 'text' | 'textarea' | 'voice'
├── active: Boolean
├── significance: String (AI prompt context)
└── createdAt / updatedAt
```

### Question Organization

Questions are organized in a **two-level hierarchy**:

```
Role (Target)
├── elder (关于用户自己)
│   ├── basic layer (基础信息)
│   └── emotional layer (情感回忆)
├── family (关于家人)
│   ├── basic layer
│   └── emotional layer
└── friend (关于朋友)
    ├── basic layer
    └── emotional layer
```

## Function Level

### Features

#### 1. Question List

**Endpoint**: `GET /api/admin/questions`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| role | elder/family/friend | Filter by role |
| layer | basic/emotional | Filter by layer |
| active | boolean | Filter by active status |
| search | string | Search in question text |

**Response**:
```typescript
{
  success: true,
  questions: AdminQuestion[]
}
```

#### 2. Create Question

**Endpoint**: `POST /api/admin/questions`

**Body**:
```typescript
{
  role: 'elder' | 'family' | 'friend',
  layer: 'basic' | 'emotional',
  question: string,
  placeholder?: string,
  type: 'text' | 'textarea' | 'voice',
  active: boolean
}
```

**Behavior**: Automatically assigns the next order position within the role/layer.

#### 3. Update Question

**Endpoint**: `PUT /api/admin/questions/:id`

**Body**: Partial question data (same as create)

#### 4. Delete Question

**Endpoint**: `DELETE /api/admin/questions/:id`

**Behavior**: Cascade deletes associated answers.

#### 5. Reorder Question

**Endpoint**: `PATCH /api/admin/questions/:id/reorder`

**Body**:
```typescript
{
  order: number  // New position (1-based)
}
```

**Behavior**: Adjusts order of all questions in the same role/layer.

#### 6. Toggle Status

**Endpoint**: `PATCH /api/admin/questions/:id/status`

**Body**:
```typescript
{
  active: boolean
}
```

#### 7. Batch Import

**Endpoint**: `POST /admin/questions/batch-import`

**Body**:
```typescript
{
  questions: QuestionFormData[]
}
```

**Response**:
```typescript
{
  success: true,
  imported: number,
  failed: number,
  errors?: Array<{ question: string; error: string }>
}
```

#### 8. Export

**Endpoint**: `GET /api/admin/questions/export`

**Query Parameters**: role, layer (optional)

**Response**: JSON array of questions

## Code Level

### Backend: Create Question

**File**: `server/src/modules/admin/service.js`

```javascript
async createQuestion(questionData) {
  // Get the highest order for the given role and layer
  const lastQuestion = await Question.findOne({
    role: questionData.role,
    layer: questionData.layer
  }).sort({ order: -1 });

  const order = lastQuestion ? lastQuestion.order + 1 : 1;

  const question = await Question.create({
    ...questionData,
    order
  });

  return question;
}
```

### Backend: Reorder Question

**File**: `server/src/modules/admin/service.js`

```javascript
async reorderQuestion(questionId, newOrder) {
  if (typeof newOrder !== 'number' || newOrder < 1) {
    throw new Error('无效的顺序值');
  }

  const question = await Question.findById(questionId);
  if (!question) {
    throw new Error('问题不存在');
  }

  // Get all questions in the same role and layer
  const allQuestions = await Question.find({
    role: question.role,
    layer: question.layer
  }).sort({ order: 1 });

  if (newOrder > allQuestions.length) {
    throw new Error('顺序值超出范围');
  }

  // Update orders for affected questions (transaction)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (question.order < newOrder) {
      // Moving down - decrement questions between old and new position
      await Question.updateMany(
        {
          _id: { $ne: questionId },
          role: question.role,
          layer: question.layer,
          order: { $gt: question.order, $lte: newOrder }
        },
        { $inc: { order: -1 } },
        { session }
      );
    } else {
      // Moving up - increment questions between new and old position
      await Question.updateMany(
        {
          _id: { $ne: questionId },
          role: question.role,
          layer: question.layer,
          order: { $gte: newOrder, $lt: question.order }
        },
        { $inc: { order: 1 } },
        { session }
      );
    }

    // Update the moved question
    question.order = newOrder;
    await question.save({ session });

    await session.commitTransaction();
    return question;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Backend: Batch Import

**File**: `server/src/modules/admin/service.js`

```javascript
async batchImportQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('无效的问题列表');
  }

  const imported = [];
  const failed = [];
  const errors = [];

  for (const questionData of questions) {
    try {
      // Validate required fields
      if (!questionData.role || !questionData.layer || !questionData.question) {
        throw new Error('缺少必填字段 (role, layer, question)');
      }

      // Get the highest order for the given role and layer
      const lastQuestion = await Question.findOne({
        role: questionData.role,
        layer: questionData.layer
      }).sort({ order: -1 });

      const order = lastQuestion ? lastQuestion.order + 1 : 1;

      const question = await Question.create({
        role: questionData.role,
        layer: questionData.layer,
        question: questionData.question,
        significance: questionData.significance || '',
        placeholder: questionData.placeholder || '',
        type: questionData.type || 'textarea',
        active: questionData.active !== undefined ? questionData.active : true,
        order
      });

      imported.push(question);
    } catch (error) {
      failed.push(questionData);
      errors.push(`${questionData.question || 'Unknown'}: ${error.message}`);
    }
  }

  return {
    imported: imported.length,
    failed: failed.length,
    errors,
    questions: imported
  };
}
```

### Frontend: Questionnaires Page

**File**: `web/app/admin/questionnaires/page.tsx`

```typescript
export default function QuestionnairesPage() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<AdminQuestion[]>([]);

  const [filters, setFilters] = useState<QuestionFilters>({
    role: 'all',
    layer: 'all',
    active: null,
    search: '',
  });

  const applyFilters = () => {
    let filtered = [...questions];

    if (filters.role && filters.role !== 'all') {
      filtered = filtered.filter((q) => q.role === filters.role);
    }

    if (filters.layer && filters.layer !== 'all') {
      filtered = filtered.filter((q) => q.layer === filters.layer);
    }

    if (filters.active !== null) {
      filtered = filtered.filter((q) => q.active === filters.active);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.question.toLowerCase().includes(searchLower) ||
          (q.placeholder && q.placeholder.toLowerCase().includes(searchLower))
      );
    }

    filtered.sort((a, b) => a.order - b.order);
    setFilteredQuestions(filtered);
  };

  const handleToggleStatus = async (questionId: string, active: boolean) => {
    const result = await toggleQuestionStatus(questionId, active);
    if (result.success) {
      await loadQuestions();
    }
  };

  const handleMoveUp = async (questionId: string) => {
    const index = filteredQuestions.findIndex((q) => q._id === questionId);
    if (index > 0) {
      const targetOrder = filteredQuestions[index - 1].order;
      await reorderQuestion(questionId, targetOrder);
      await loadQuestions();
    }
  };

  const handleExport = async () => {
    const result = await exportQuestions(filters);
    if (result.success && result.questions) {
      const dataStr = JSON.stringify(result.questions, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questions-${Date.now()}.json`;
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Select value={filters.role} onValueChange={(v) => setFilters({ ...filters, role: v })}>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="elder">老人</SelectItem>
              <SelectItem value="family">家人</SelectItem>
              <SelectItem value="friend">朋友</SelectItem>
            </Select>
            <Select value={filters.layer} onValueChange={(v) => setFilters({ ...filters, layer: v })}>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="basic">基础层</SelectItem>
              <SelectItem value="emotional">情感层</SelectItem>
            </Select>
            <Select value={filters.active === null ? 'all' : String(filters.active)} onValueChange={(v) => setFilters({ ...filters, active: v === 'all' ? null : v === 'true' })}>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="true">启用</SelectItem>
              <SelectItem value="false">禁用</SelectItem>
            </Select>
            <Input placeholder="搜索问题..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Question List */}
      <QuestionList
        questions={filteredQuestions}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
      />
    </div>
  );
}
```

### Frontend: Question Form

**File**: `web/app/admin/questionnaires/components/QuestionForm.tsx`

```typescript
interface QuestionFormProps {
  initialData?: AdminQuestion;
  onSubmit: (data: QuestionFormData) => Promise<{ success: boolean }>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function QuestionForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = '创建问题'
}: QuestionFormProps) {
  const [formData, setFormData] = useState<QuestionFormData>({
    role: initialData?.role || 'elder',
    layer: initialData?.layer || 'basic',
    question: initialData?.question || '',
    placeholder: initialData?.placeholder || '',
    type: initialData?.type || 'textarea',
    active: initialData?.active !== undefined ? initialData.active : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>角色</Label>
          <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="elder">老人 (自己)</SelectItem>
              <SelectItem value="family">家人</SelectItem>
              <SelectItem value="friend">朋友</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>层级</Label>
          <Select value={formData.layer} onValueChange={(v) => setFormData({ ...formData, layer: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">基础层</SelectItem>
              <SelectItem value="emotional">情感层</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>问题</Label>
        <Textarea
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          placeholder="输入问题..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>输入类型</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">单行文本</SelectItem>
            <SelectItem value="textarea">多行文本</SelectItem>
            <SelectItem value="voice">语音输入</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.active}
          onCheckedChange={(v) => setFormData({ ...formData, active: !!v })}
        />
        <Label>启用此问题</Label>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '保存中...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```

## Related Documentation

- [Admin Overview](./overview) - Admin panel architecture
- [Memory Management](./memory) - How answers become memories
- [Roles & Permissions](./roles) - Access control for questionnaire management
