# Frontend Components

## 1. Architecture Level

The Questionnaire System frontend provides user interfaces for answering questions, managing assisted responses, and viewing answers from other users. Built with Next.js and React, it features a responsive design with layer switching, progress tracking, and navigation guards.

### 1.1 Page Structure

```
web/app/
├── questions/
│   ├── page.tsx         # Self-questionnaire page
│   └── assist/
│       └── page.tsx     # Assisted questionnaire page
└── answers/
    └── page.tsx         # View answers from others
```

### 1.2 Component Hierarchy

```
QuestionsPage / AssistQuestionsPage
├── Header
│   ├── Title & Description
│   └── Back Button (Assist only)
├── Layer Switcher
│   ├── Basic Layer Button
│   └── Emotional Layer Button
├── Question Cards (List)
│   ├── Question Number
│   ├── Question Text
│   ├── Status Badge (Unanswered/Answered/Modified)
│   └── Input Component
│       ├── Text Input
│       ├── Textarea
│       └── Choice Options
├── Save Button (Sticky)
└── Modals
    ├── Confirmation Modal
    └── Leave Confirmation Modal (Assist only)

AnswersPage
├── Header
├── Filter Bar
│   ├── Search Input
│   └── User Filter
└── Answer Cards (List)
    ├── Question
    ├── Answerer Info
    ├── Date
    └── Answer Content
```

---

## 2. Function Level

### 2.1 Pages Overview

| Page | Route | Purpose |
|------|-------|---------|
| Questions Page | `/questions` | Users answer questions about themselves |
| Assist Questions | `/questions/assist?targetId=xxx` | Family/friends answer about another user |
| Answers Page | `/answers` | View answers contributed by others |

### 2.2 Shared Features

#### Layer Switching
Users toggle between Basic and Emotional layers:
- **Basic Layer**: Blue gradient theme
- **Emotional Layer**: Pink gradient theme

#### Progress Tracking
Each question displays a status badge:
- **Unanswered** (gray): No answer provided
- **Answered** (green): Answer saved and unchanged
- **Modified** (red): Answer changed since last save

#### Navigation Guards
- Detects unsaved changes before navigation
- Shows confirmation modals for leaving with changes
- Handles browser back button and refresh

#### Batch Saving
All answers are saved in a single batch operation:
```typescript
await api.post('/answers/batch-self', {
  answers: answersToSave
})
```

### 2.3 Page-Specific Features

#### Questions Page (`/questions`)
- Self-mode only
- Simple navigation flow
- Changes tracked per session

#### Assist Questions Page (`/questions/assist`)
- Requires `targetId` URL parameter
- Validates assist relationship
- Shows target user info and relationship type
- Enhanced leave confirmation

#### Answers Page (`/answers`)
- Displays all answers from contributors
- Search by question/answer/user
- Filter by specific contributor
- Grouped display by contributor

---

## 3. Code Level

### 3.1 Questions Page Component

**File: `web/app/questions/page.tsx`**

#### Key State

```typescript
const [questions, setQuestions] = useState<Question[]>([])
const [answers, setAnswers] = useState<{ [key: string]: string }>({})
const [originalAnswers, setOriginalAnswers] = useState<{ [key: string]: string }>({})
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)
const [currentLayer, setCurrentLayer] = useState<Layer>('basic')
const [showConfirmModal, setShowConfirmModal] = useState(false)
```

#### Data Fetching

```typescript
const fetchQuestions = async () => {
  try {
    setLoading(true)
    const res = await api.get(`/questions?layer=${currentLayer}&role=elder`)

    if (res && res.success && res.data?.questions) {
      setQuestions(res.data.questions || [])

      // Extract answers from response
      const answersMap: { [key: string]: string } = {}
      res.data.questions.forEach((q: any) => {
        if (q.answer && q._id) {
          answersMap[q._id] = q.answer
        }
      })
      setAnswers(answersMap)
      setOriginalAnswers(answersMap)
    }
  } catch (error) {
    console.error('获取问题失败:', error)
  } finally {
    setLoading(false)
  }
}
```

#### Status Tracking

```typescript
const getQuestionStatus = (questionId: string): 'unanswered' | 'answered' | 'modified' => {
  const currentAnswer = answers[questionId] || ''
  const originalAnswer = originalAnswers[questionId] || ''

  if (currentAnswer === '' && originalAnswer === '') {
    return 'unanswered'
  }
  if (currentAnswer === originalAnswer) {
    return 'answered'
  }
  return 'modified'
}

const getStatusLabel = (status: 'unanswered' | 'answered' | 'modified') => {
  switch (status) {
    case 'unanswered': return { text: '未回答', className: 'bg-gray-100 text-gray-600' }
    case 'answered': return { text: '已回答', className: 'bg-green-100 text-green-700' }
    case 'modified': return { text: '修改中', className: 'bg-red-100 text-red-700' }
  }
}
```

#### Change Detection

```typescript
const hasChanges = Object.keys(answers).some(questionId => {
  const current = answers[questionId] || ''
  const original = originalAnswers[questionId] || ''
  return current !== original
})

// Register navigation guard
useEffect(() => {
  setHasUnsavedChanges(hasChanges)
}, [hasChanges, setHasUnsavedChanges])
```

#### Save Function

```typescript
const performSave = async () => {
  try {
    setSaving(true)
    setShowConfirmModal(false)

    const answersToSave = Object.entries(answers)
      .filter(([_, answer]) => answer && answer !== '')
      .map(([questionId, answer]) => ({ questionId, answer }))

    if (answersToSave.length === 0) {
      return
    }

    await api.post('/answers/batch-self', {
      answers: answersToSave
    })

    // Update original answers on success
    setOriginalAnswers({ ...answers })
    alert('保存成功！')
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败，请重试')
  } finally {
    setSaving(false)
  }
}
```

#### Question Card Rendering

```typescript
{questions.map((question, index) => (
  <Card key={question._id}>
    <CardHeader>
      <CardTitle>
        <span className="question-number">{question.order}</span>
        {question.questionText}
      </CardTitle>
    </CardHeader>
    <div className="status-badge">
      <span className={getStatusLabel(getQuestionStatus(question._id)).className}>
        {getStatusLabel(getQuestionStatus(question._id)).text}
      </span>
    </div>
    <CardContent>
      {question.questionType === 'choice' && question.options ? (
        // Choice options rendering
      ) : question.questionType === 'textarea' ? (
        <textarea
          value={answers[question._id] || ''}
          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
        />
      ) : (
        <Input
          type="text"
          value={answers[question._id] || ''}
          onChange={(e) => handleAnswerChange(question._id, e.target.value)}
        />
      )}
    </CardContent>
  </Card>
))}
```

### 3.2 Assist Questions Page Component

**File: `web/app/questions/assist/page.tsx`**

#### Additional State

```typescript
const [targetUser, setTargetUser] = useState<TargetUser | null>(null)
const [relationType, setRelationType] = useState<'family' | 'friend' | null>(null)
const [specificRelation, setSpecificRelation] = useState<string>('')
const [showLeaveModal, setShowLeaveModal] = useState(false)
const allowNavigationRef = useRef(false)
const pendingNavigationRef = useRef<(() => void) | null>(null)
```

#### URL Parameter Handling

```typescript
const searchParams = useSearchParams()
const router = useRouter()
const targetId = searchParams.get('targetId')

useEffect(() => {
  if (!targetId) {
    setError('缺少目标用户ID')
    setLoading(false)
    return
  }
  fetchQuestions()
}, [currentLayer, targetId])
```

#### Enhanced Navigation Guard

```typescript
// Handle browser back button
const handlePopState = (e: PopStateEvent) => {
  if (hasChanges && !allowNavigationRef.current) {
    e.preventDefault()
    window.history.pushState(null, '', window.location.href)
    setShowLeaveModal(true)
  }
}

// Handle back button click
const handleBackClick = (e: React.MouseEvent) => {
  e.preventDefault()
  if (hasChanges) {
    pendingNavigationRef.current = () => router.push('/assist')
    setShowLeaveModal(true)
  } else {
    router.push('/assist')
  }
}

// Leave without saving
const handleLeaveWithoutSave = useCallback(() => {
  allowNavigationRef.current = true
  setShowLeaveModal(false)
  if (pendingNavigationRef.current) {
    pendingNavigationRef.current()
    pendingNavigationRef.current = null
  } else {
    router.push('/assist')
  }
}, [router])
```

#### Assist-Specific Fetching

```typescript
const fetchQuestions = async () => {
  if (!targetId) return

  try {
    setLoading(true)
    const res = await api.get(`/questions/assist?targetUserId=${targetId}`)

    if (res && res.success && res.data) {
      setQuestions(res.data.questions || [])
      setTargetUser(res.data.targetUser || null)
      setRelationType(res.data.relationType || null)
      setSpecificRelation(res.data.specificRelation || '')

      const answersMap: { [key: string]: string } = {}
      res.data.questions.forEach((q: any) => {
        if (q.answer && q._id) {
          answersMap[q._id] = q.answer
        }
      })
      setAnswers(answersMap)
      setOriginalAnswers(answersMap)
    }
  } catch (error) {
    setError('获取问题失败，请稍后重试')
  }
}
```

#### Assist Save

```typescript
const performSave = async () => {
  const answersToSave = Object.entries(answers)
    .filter(([_, answer]) => answer && answer !== '')
    .map(([questionId, answer]) => ({ questionId, answer }))

  const res = await api.post('/answers/batch-assist', {
    targetUserId: targetId,
    answers: answersToSave
  })

  if (res.success) {
    setOriginalAnswers({ ...answers })
    alert(`成功保存 ${answersToSave.length} 个回答`)
  }
}
```

### 3.3 Answers Page Component

**File: `web/app/answers/page.tsx`**

#### State

```typescript
const [answers, setAnswers] = useState<Answer[]>([])
const [filteredAnswers, setFilteredAnswers] = useState<Answer[]>([])
const [loading, setLoading] = useState(true)
const [searchTerm, setSearchTerm] = useState('')
const [filterUser, setFilterUser] = useState('all')
```

#### Data Fetching

```typescript
const fetchAnswers = async () => {
  try {
    setLoading(true)
    const res = await api.get('/answers/from-others')
    const responseData = res.data || {}
    const contributors = responseData.contributors || []

    // Flatten grouped data
    const flattenedAnswers = (contributors as Contributor[]).flatMap(
      (contributor: Contributor) =>
        contributor.answers.map(answer => ({
          _id: answer.id,
          userId: contributor.contributor.id,
          questionId: answer.questionId,
          questionText: answer.question,
          answer: answer.answer,
          userName: contributor.contributor.name,
          createdAt: answer.createdAt
        }))
    )

    setAnswers(flattenedAnswers)
  } catch (error) {
    console.error('获取回答失败:', error)
  } finally {
    setLoading(false)
  }
}
```

#### Filtering

```typescript
const filterAnswers = () => {
  let filtered = answers

  if (filterUser !== 'all') {
    filtered = filtered.filter(a => a.userId === filterUser)
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter(a =>
      a.questionText.toLowerCase().includes(term) ||
      a.answer.toLowerCase().includes(term) ||
      a.userName.toLowerCase().includes(term)
    )
  }

  setFilteredAnswers(filtered)
}
```

#### Answer Card

```typescript
{filteredAnswers.map((answer) => (
  <Card key={answer._id}>
    <CardHeader>
      <CardTitle>{answer.questionText}</CardTitle>
      <CardDescription>
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {answer.userName}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(answer.createdAt).toLocaleDateString('zh-CN')}
        </span>
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="whitespace-pre-wrap">{answer.answer}</p>
    </CardContent>
  </Card>
))}
```

### 3.4 API Integration

All API calls use the centralized `api` helper:

```typescript
import { api } from '@/lib/api'

// GET request
const res = await api.get(`/questions?layer=${layer}&role=elder`)

// POST request
const res = await api.post('/answers/batch-self', {
  answers: answersToSave
})
```

### 3.5 Theme Configuration

Layer-specific styling:

```typescript
const LAYERS = {
  basic: {
    label: '基础层次',
    description: '日常基本信息相关问题',
    color: 'from-blue-500 to-blue-600',
    bg: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200'
  },
  emotional: {
    label: '情感层次',
    description: '深层次情感交流相关问题',
    color: 'from-pink-500 to-pink-600',
    bg: 'from-pink-50 to-rose-50',
    borderColor: 'border-pink-200'
  }
}
```

---

## Dependencies

The frontend components depend on:
- **Next.js**: App Router and routing
- **React**: State management and hooks
- **UI Components**: Card, Button, Input, Modal components
- **API Library**: Centralized API communication
- **Auth Store**: User authentication state
- **NavigationGuard**: Unsaved changes protection
- **Lucide Icons**: UI icons
