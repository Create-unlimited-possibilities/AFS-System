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
