# AI 对话界面重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 将 AI 对话界面重构为类似 WhatsApp 的三栏布局

**Architecture:** 前端采用单页面 + 状态切换模式，后端新增 contacts API 并修复会话唯一性问题

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Express.js, MongoDB

---

## Phase 1: 后端 API 修改

### Task 1.1: 修复 createSession 为"查找或创建"模式

**Files:**
- Modify: `server/src/modules/chat/orchestrator.js:54-123`

**目标:** 确保同一用户对只能有一个会话

**修改内容:**

```javascript
// 在 createSession 方法开头添加查找逻辑
async createSession(options) {
  const { targetUserId, interlocutorUserId, targetUniqueCode } = options;

  // 新增：先查找现有会话
  let existingSession = await ChatSession.findOne({
    targetUserId,
    interlocutorUserId
  });

  if (existingSession) {
    logger.info(`[ChatGraphOrchestrator] 使用现有会话 - Session: ${existingSession.sessionId}`);
    return {
      sessionId: existingSession.sessionId,
      targetUser: {
        id: targetUserId,
        name: (await User.findById(targetUserId))?.name,
        uniqueCode: targetUniqueCode
      },
      interlocutorUser: {
        id: interlocutorUserId
      },
      relation: {
        type: existingSession.relation
      }
    };
  }

  // 原有创建逻辑...
}
```

**Commit:** `fix(chat): ensure one session per user pair`

---

### Task 1.2: 新增 getContacts API

**Files:**
- Modify: `server/src/modules/chat/controller.js`
- Modify: `server/src/modules/chat/route.js`

**controller.js 新增方法:**

```javascript
/**
 * 获取所有联系人（家人/朋友 + 有会话的陌生人）
 */
async getContacts(req, res) {
  try {
    const userId = req.user.id;

    // 1. 获取家人/朋友关系
    const relations = await AssistRelation.find({
      assistantId: userId,
      isActive: true
    }).populate('targetId', 'name uniqueCode');

    // 2. 获取所有会话（包含陌生人）
    const sessions = await ChatSession.find({
      interlocutorUserId: userId
    }).populate('targetUserId', 'name uniqueCode');

    // 3. 构建联系人 Map（去重）
    const contactMap = new Map();

    // 处理家人/朋友
    for (const rel of relations) {
      if (!rel.targetId) continue;
      const targetId = rel.targetId._id.toString();
      const session = sessions.find(s => s.targetUserId?._id?.toString() === targetId);

      contactMap.set(targetId, {
        targetUserId: targetId,
        targetUserName: rel.targetId.name,
        targetUniqueCode: rel.targetId.uniqueCode,
        relationType: rel.relationshipType,
        specificRelation: rel.specificRelation || '',
        sessionId: session?.sessionId || null,
        lastMessage: session?.messages?.slice(-1)[0]?.content || null,
        lastMessageAt: session?.lastMessageAt || null,
        sentimentScore: session?.sentimentScore || 50
      });
    }

    // 处理陌生人（只添加不在 relations 中的）
    for (const session of sessions) {
      if (!session.targetUserId) continue;
      const targetId = session.targetUserId._id.toString();

      if (!contactMap.has(targetId)) {
        contactMap.set(targetId, {
          targetUserId: targetId,
          targetUserName: session.targetUserId.name,
          targetUniqueCode: session.targetUserId.uniqueCode,
          relationType: 'stranger',
          specificRelation: '',
          sessionId: session.sessionId,
          lastMessage: session.messages?.slice(-1)[0]?.content || null,
          lastMessageAt: session.lastMessageAt || null,
          sentimentScore: session.sentimentScore || 50
        });
      }
    }

    // 4. 转为数组并排序（有消息的在前，按时间降序）
    const contacts = Array.from(contactMap.values()).sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    res.json({ success: true, contacts });
  } catch (error) {
    logger.error('[ChatController] 获取联系人失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

**route.js 新增路由:**

```javascript
// 在文件顶部附近添加
router.get('/contacts', protect, (req, res) => {
  chatController.getContacts(req, res);
});
```

**Commit:** `feat(chat): add getContacts API`

---

## Phase 2: 前端组件开发

### Task 2.1: 创建 hooks/useChat.ts

**Files:**
- Create: `web/app/chat/hooks/useChat.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'

interface Contact {
  targetUserId: string
  targetUserName: string
  targetUniqueCode: string
  relationType: 'family' | 'friend' | 'stranger'
  specificRelation: string
  sessionId: string | null
  lastMessage: string | null
  lastMessageAt: string | null
  sentimentScore: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pending?: boolean
  streaming?: boolean
}

export function useChat() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 加载联系人列表
  const loadContacts = useCallback(async () => {
    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/contacts`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (data.success) {
      setContacts(data.contacts)
    }
  }, [])

  // 选择联系人
  const selectContact = useCallback(async (contact: Contact) => {
    setSelectedContact(contact)
    setMessages([])

    if (contact.sessionId) {
      setSessionId(contact.sessionId)
      await loadMessages(contact.sessionId)
    } else {
      setSessionId(null)
    }
  }, [])

  // 加载消息历史
  const loadMessages = useCallback(async (sid: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/${sid}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (data.success && data.session?.messages) {
      setMessages(data.session.messages.map((msg: any) => ({
        id: msg._id || msg.timestamp,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp || msg.createdAt)
      })))
    }
  }, [])

  // 发送消息
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !selectedContact) return

    // 乐观更新
    const tempId = `temp_${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content,
      timestamp: new Date(),
      pending: true
    }])

    setIsLoading(true)

    try {
      // 确保有会话
      let sid = sessionId
      if (!sid) {
        const token = localStorage.getItem('token')
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/by-code`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ targetUniqueCode: selectedContact.targetUniqueCode })
          }
        )
        const data = await res.json()
        if (data.success) {
          sid = data.session.sessionId
          setSessionId(sid)
        }
      }

      // 发送消息
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/${sid}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ message: content })
        }
      )
      const data = await res.json()

      if (data.success) {
        // 移除临时消息，添加真实消息
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId)
          return [...filtered, {
            id: `real_${Date.now()}`,
            role: 'user' as const,
            content,
            timestamp: new Date()
          }, {
            id: `ai_${Date.now()}`,
            role: 'assistant' as const,
            content: data.message || data.response,
            timestamp: new Date()
          }]
        })
        await loadContacts()
      }
    } catch (err) {
      console.error('发送失败:', err)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsLoading(false)
    }
  }, [selectedContact, sessionId, loadContacts])

  // 过滤联系人
  const filteredContacts = contacts.filter(c =>
    c.targetUserName.includes(searchQuery) ||
    c.targetUniqueCode.includes(searchQuery)
  )

  return {
    contacts: filteredContacts,
    selectedContact,
    messages,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadContacts,
    selectContact,
    sendMessage,
    setSelectedContact
  }
}
```

**Commit:** `feat(chat): add useChat hook`

---

### Task 2.2: 创建 Sidebar 组件

**Files:**
- Create: `web/app/chat/components/Sidebar.tsx`

```tsx
'use client'

import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-16 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <Link
        href="/chat/new"
        className="p-4 hover:bg-gray-50 border-b border-gray-200 flex flex-col items-center"
        title="返回"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
        <span className="text-xs mt-1 text-gray-500">返回</span>
      </Link>
      <Link
        href="/dashboard"
        className="p-4 hover:bg-gray-50 border-b border-gray-200 flex flex-col items-center"
        title="个人中心"
      >
        <User className="w-5 h-5 text-gray-600" />
        <span className="text-xs mt-1 text-gray-500">中心</span>
      </Link>
    </aside>
  )
}
```

**Commit:** `feat(chat): add Sidebar component`

---

### Task 2.3: 创建 SearchBar 组件

**Files:**
- Create: `web/app/chat/components/SearchBar.tsx`

```tsx
'use client'

import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="p-3 border-b border-gray-200">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索名字/编号..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
    </div>
  )
}
```

**Commit:** `feat(chat): add SearchBar component`

---

### Task 2.4: 创建 UserListItem 组件

**Files:**
- Create: `web/app/chat/components/UserListItem.tsx`

```tsx
'use client'

interface Contact {
  targetUserId: string
  targetUserName: string
  targetUniqueCode: string
  relationType: string
  lastMessage: string | null
  lastMessageAt: string | null
}

interface UserListItemProps {
  contact: Contact
  isSelected: boolean
  onClick: () => void
}

export function UserListItem({ contact, isSelected, onClick }: UserListItemProps) {
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 cursor-pointer border-b border-gray-100 transition-colors ${
        isSelected ? 'bg-orange-50 border-l-2 border-l-orange-500' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-start">
        <span className="font-medium text-gray-900">{contact.targetUserName}</span>
        <span className="text-xs text-gray-400">{formatTime(contact.lastMessageAt)}</span>
      </div>
      <div className="text-xs text-gray-500">#{contact.targetUniqueCode}</div>
      <div className="text-sm text-gray-400 truncate mt-1">
        {contact.lastMessage || '开始对话'}
      </div>
    </div>
  )
}
```

**Commit:** `feat(chat): add UserListItem component`

---

### Task 2.5: 创建 UserList 组件

**Files:**
- Create: `web/app/chat/components/UserList.tsx`

```tsx
'use client'

import { Plus } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { UserListItem } from './UserListItem'

interface Contact {
  targetUserId: string
  targetUserName: string
  targetUniqueCode: string
  relationType: string
  lastMessage: string | null
  lastMessageAt: string | null
}

interface UserListProps {
  contacts: Contact[]
  selectedId: string | null
  searchQuery: string
  onSearchChange: (value: string) => void
  onSelect: (contact: Contact) => void
  onAddFriend: () => void
}

export function UserList({
  contacts,
  selectedId,
  searchQuery,
  onSearchChange,
  onSelect,
  onAddFriend
}: UserListProps) {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">聊天</h2>
        <button
          onClick={onAddFriend}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="新增好友"
        >
          <Plus className="w-5 h-5 text-orange-500" />
        </button>
      </div>

      {/* Search */}
      <SearchBar value={searchQuery} onChange={onSearchChange} />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            还没有对话，点击右上角添加好友
          </div>
        ) : (
          contacts.map((contact) => (
            <UserListItem
              key={contact.targetUserId}
              contact={contact}
              isSelected={selectedId === contact.targetUserId}
              onClick={() => onSelect(contact)}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

**Commit:** `feat(chat): add UserList component`

---

### Task 2.6: 创建 ChatPanel 组件

**Files:**
- Create: `web/app/chat/components/ChatPanel.tsx`

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'

interface Contact {
  targetUserName: string
  targetUniqueCode: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  pending?: boolean
}

interface ChatPanelProps {
  contact: Contact | null
  messages: Message[]
  isLoading: boolean
  onSend: (message: string) => void
  onBack?: () => void
  isMobile?: boolean
}

export function ChatPanel({
  contact,
  messages,
  isLoading,
  onSend,
  onBack,
  isMobile
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input)
    setInput('')
  }

  // 未选择用户
  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">请选择左侧用户开始对话</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shrink-0">
        {isMobile && onBack && (
          <button onClick={onBack} className="mr-3 p-1">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <h1 className="font-bold text-gray-900">{contact.targetUserName}</h1>
          <p className="text-xs text-gray-500">#{contact.targetUniqueCode}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-black'
                  : 'bg-white border border-gray-200 text-black'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <span className="text-xs text-gray-500 mt-1 block">
                {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Commit:** `feat(chat): add ChatPanel component`

---

### Task 2.7: 创建 AddFriendModal 组件

**Files:**
- Create: `web/app/chat/components/AddFriendModal.tsx`

```tsx
'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

interface AddFriendModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddFriendModal({ isOpen, onClose, onSuccess }: AddFriendModalProps) {
  const [uniqueCode, setUniqueCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!uniqueCode.trim()) {
      setError('请输入特殊编号')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/by-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ targetUniqueCode: uniqueCode })
        }
      )

      const data = await res.json()

      if (data.success) {
        setUniqueCode('')
        onSuccess()
        onClose()
      } else {
        setError(data.error || '添加失败')
      }
    } catch (err) {
      setError('网络错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-80 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">新增好友</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <input
          type="text"
          placeholder="输入特殊编号"
          value={uniqueCode}
          onChange={(e) => setUniqueCode(e.target.value.toUpperCase())}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />

        {error && (
          <p className="text-red-500 text-sm mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            '确认'
          )}
        </button>
      </div>
    </div>
  )
}
```

**Commit:** `feat(chat): add AddFriendModal component`

---

### Task 2.8: 创建主页面 page.tsx

**Files:**
- Create: `web/app/chat/page.tsx`

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { UserList } from './components/UserList'
import { ChatPanel } from './components/ChatPanel'
import { AddFriendModal } from './components/AddFriendModal'
import { useChat } from './hooks/useChat'

export default function ChatPage() {
  const {
    contacts,
    selectedContact,
    messages,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadContacts,
    selectContact,
    sendMessage,
    setSelectedContact
  } = useChat()

  const [showAddModal, setShowAddModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    loadContacts()

    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [loadContacts])

  // 手机端视图控制
  const showUserList = !isMobile || !selectedContact
  const showChat = !isMobile || !!selectedContact

  const handleBack = () => {
    setSelectedContact(null)
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* 左侧导航栏 */}
      {showUserList && <Sidebar />}

      {/* 中间用户列表 */}
      {showUserList && (
        <UserList
          contacts={contacts}
          selectedId={selectedContact?.targetUserId || null}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={selectContact}
          onAddFriend={() => setShowAddModal(true)}
        />
      )}

      {/* 右侧会话面板 */}
      {showChat && (
        <ChatPanel
          contact={selectedContact}
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onBack={handleBack}
          isMobile={isMobile}
        />
      )}

      {/* 新增好友弹窗 */}
      <AddFriendModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadContacts}
      />
    </div>
  )
}
```

**Commit:** `feat(chat): create main chat page with three-column layout`

---

## Phase 3: 清理旧文件

### Task 3.1: 删除废弃文件

**Files:**
- Delete: `web/app/chat/new/page.tsx`
- Delete: `web/app/chat/[sessionId]/page.tsx`

**Commit:** `refactor(chat): remove deprecated chat pages`

---

## 执行顺序

1. Task 1.1 → 1.2 (后端)
2. Task 2.1 → 2.8 (前端)
3. Task 3.1 (清理)

**验证方式:**
```bash
# 后端
docker-compose build server && docker-compose up -d server
docker-compose logs server

# 前端
cd web && npm run dev
# 访问 http://localhost:3000/chat
```
