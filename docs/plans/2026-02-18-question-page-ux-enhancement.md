# 问题页面用户体验增强实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为问题回答页面添加状态标签、固定保存按钮和修改确认弹窗，提升用户体验

**Architecture:** 在现有页面组件中添加状态管理逻辑、CSS样式和Modal组件，保持API调用不变

**Tech Stack:** React (Next.js), TypeScript, Tailwind CSS

---

## Task 1: 添加问题状态标签系统（用户答题页面）

**Files:**
- Modify: `web/app/questions/page.tsx`

**Step 1: 添加 originalAnswers 状态**

在 `questions/page.tsx` 中，找到状态声明部分（约第47-51行），添加新状态：

```typescript
const [questions, setQuestions] = useState<Question[]>([])
const [answers, setAnswers] = useState<{ [key: string]: string }>({})
const [originalAnswers, setOriginalAnswers] = useState<{ [key: string]: string }>({})  // 新增
const [loading, setLoading] = useState(true)
```

**Step 2: 在 fetchQuestions 中保存原始答案**

找到 `fetchQuestions` 函数中设置 `setAnswers(answersMap)` 的位置（约第72行），在其后添加：

```typescript
setAnswers(answersMap)
setOriginalAnswers(answersMap)  // 新增：保存原始答案用于比较
```

**Step 3: 添加 getQuestionStatus 函数**

在 `handleAnswerChange` 函数后添加状态判断函数：

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

**Step 4: 在问题卡片中添加状态标签**

找到问题卡片的 `CardHeader` 部分（约第177-191行），在 `</CardHeader>` 后、`<CardContent>` 前添加状态标签：

```tsx
              </CardHeader>
              {/* 状态标签 */}
              <div className="px-6 pb-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusLabel(getQuestionStatus(question._id)).className}`}>
                  {getStatusLabel(getQuestionStatus(question._id)).text}
                </span>
              </div>
              <CardContent>
```

**Step 5: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 2: 添加问题状态标签系统（协助者答题页面）

**Files:**
- Modify: `web/app/questions/assist/page.tsx`

**Step 1-4:** 与 Task 1 相同的修改，应用到 `assist/page.tsx`

1. 添加 `originalAnswers` 状态（约第54行后）
2. 在 `fetchQuestions` 中保存原始答案（约第92行后）
3. 添加 `getQuestionStatus` 和 `getStatusLabel` 函数（约第113行后）
4. 在问题卡片中添加状态标签（约第255行后，在 `</CardHeader>` 和 `<CardContent>` 之间）

**Step 5: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 3: 固定浮动保存按钮（用户答题页面）

**Files:**
- Modify: `web/app/questions/page.tsx`

**Step 1: 添加 hasChanges 计算属性**

在 `getStatusLabel` 函数后添加：

```typescript
const hasChanges = Object.keys(answers).some(questionId => {
  const current = answers[questionId] || ''
  const original = originalAnswers[questionId] || ''
  return current !== original
})

const changedCount = Object.keys(answers).filter(questionId => {
  const current = answers[questionId] || ''
  const original = originalAnswers[questionId] || ''
  return current !== original
}).length
```

**Step 2: 修改保存按钮区域为固定浮动样式**

找到保存按钮区域（约第240-261行），替换为：

```tsx
        {/* 固定浮动保存按钮 */}
        {questions.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 pb-safe">
            <div className="container mx-auto px-4 py-4 max-w-4xl">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className={`w-full gap-2 transition-all duration-300 ${
                  hasChanges
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg animate-pulse ring-4 ring-orange-400/50'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600'
                } text-white`}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    保存中...
                  </div>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    {hasChanges ? `保存回答 (${changedCount})` : '保存回答'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 底部占位，防止内容被固定按钮遮挡 */}
        {questions.length > 0 && <div className="h-24" />}
```

**Step 3: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 4: 固定浮动保存按钮（协助者答题页面）

**Files:**
- Modify: `web/app/questions/assist/page.tsx`

**Step 1-2:** 与 Task 3 相同的修改，应用到 `assist/page.tsx`

1. 添加 `hasChanges` 和 `changedCount` 计算属性
2. 修改保存按钮区域为固定浮动样式（替换约第304-325行的内容）

**Step 3: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 5: 创建确认弹窗组件

**Files:**
- Create: `web/components/ui/modal.tsx`

**Step 1: 创建 Modal 组件**

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 6: 添加修改确认弹窗（用户答题页面）

**Files:**
- Modify: `web/app/questions/page.tsx`

**Step 1: 导入 Modal 组件和 lucide 图标**

修改导入部分：

```tsx
import { Send, Mic, Save, MessageSquare, FileText, Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
```

在文件顶部添加 Modal 导入：

```tsx
import Modal from '@/components/ui/modal'
```

**Step 2: 添加弹窗状态**

在状态声明部分添加：

```typescript
const [showConfirmModal, setShowConfirmModal] = useState(false)
```

**Step 3: 添加获取修改问题的函数**

在 `changedCount` 计算后添加：

```typescript
const getModifiedQuestions = () => {
  return questions.filter(q => {
    const current = answers[q._id] || ''
    const original = originalAnswers[q._id] || ''
    return current !== original
  }).map(q => ({
    questionText: q.questionText,
    order: q.order,
    newAnswer: answers[q._id] || ''
  }))
}
```

**Step 4: 修改 handleSave 函数**

将 `handleSave` 函数替换为：

```typescript
const handleSave = async () => {
  // 如果有修改，显示确认弹窗
  if (hasChanges) {
    setShowConfirmModal(true)
    return
  }

  // 没有修改，直接保存
  await performSave()
}

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

    // 保存成功后更新原始答案
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

**Step 5: 在页面底部添加确认弹窗组件**

在 `return` 语句的最后一个 `</div>` 前添加：

```tsx
      {/* 修改确认弹窗 */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="确认修改"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              以下 <span className="font-semibold text-orange-600">{getModifiedQuestions().length}</span> 个问题的答案已修改：
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-3">
            {getModifiedQuestions().map((q, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">问题 {q.order}</div>
                <div className="text-sm font-medium text-gray-900 mb-2">{q.questionText}</div>
                <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                  {q.newAnswer || '(空)'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1"
            >
              重新考虑
            </Button>
            <Button
              onClick={performSave}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  确定；提交修改
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
```

**Step 6: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 7: 添加修改确认弹窗（协助者答题页面）

**Files:**
- Modify: `web/app/questions/assist/page.tsx`

**Step 1-5:** 与 Task 6 相同的修改，应用到 `assist/page.tsx`

1. 导入 Modal 组件和图标
2. 添加 `showConfirmModal` 状态
3. 添加 `getModifiedQuestions` 函数
4. 修改 `handleSave` 函数，添加 `performSave` 函数
5. 在页面底部添加确认弹窗组件

注意：`performSave` 中使用 `/answers/batch-assist` API，并传入 `targetUserId`

**Step 6: 验证构建**

Run: `cd web && npm run build 2>&1 | head -30`
Expected: Build successful

---

## Task 8: 集成测试和验证

**Step 1: 重启 Web 容器**

```bash
cd F:/FPY/AFS-System
docker compose restart web
```

**Step 2: 功能测试清单**

1. 访问 `/questions` 页面
   - [ ] 状态标签显示正确（未回答=灰、已回答=绿、修改中=红）
   - [ ] 保存按钮固定在底部
   - [ ] 有修改时按钮发光动画
   - [ ] 点击保存弹出确认弹窗
   - [ ] 弹窗显示修改的问题列表
   - [ ] "重新考虑"关闭弹窗
   - [ ] "确定；提交修改"执行保存

2. 访问 `/questions/assist?targetId=xxx` 页面
   - [ ] 所有功能同上

**Step 3: 验证 API 路由**

- [ ] `/api/answers/batch-self` 正常工作
- [ ] `/api/answers/batch-assist` 正常工作
- [ ] `/api/questions` 正常工作
- [ ] `/api/answers/questions/assist` 正常工作

---

## 验收清单

- [ ] 问题状态标签三种状态正确显示
- [ ] 保存按钮固定在屏幕底部
- [ ] 有未保存内容时按钮发光
- [ ] 保存按钮显示未保存数量
- [ ] 点击保存弹出确认弹窗
- [ ] 弹窗显示修改的问题列表（可滚动）
- [ ] "重新考虑"按钮关闭弹窗
- [ ] "确定；提交修改"按钮执行保存
- [ ] 所有现有功能不受影响
- [ ] 所有 API 路由正常工作
