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
  failed?: boolean  // 消息发送失败
  error?: string    // 错误信息
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

  // 加载消息历史 - 必须在 selectContact 之前定义
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

  // 预加载会话 - 点击联系人时调用，提前加载角色卡和复杂关系层
  const preloadSession = useCallback(async (targetUserId: string) => {
    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/preload/${targetUserId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (data.success) {
      return data.session
    }
    return null
  }, [])

  // 选择联系人
  const selectContact = useCallback(async (contact: Contact) => {
    setSelectedContact(contact)
    setMessages([])
    setIsLoading(true)

    try {
      // 调用预加载API，提前加载角色卡和复杂关系层
      const session = await preloadSession(contact.targetUserId)

      if (session) {
        setSessionId(session.sessionId)
        // 如果有历史消息，加载它们
        if (session.hasHistory) {
          await loadMessages(session.sessionId)
        }
      } else {
        setSessionId(null)
      }
    } catch (err) {
      console.error('预加载会话失败:', err)
      setSessionId(null)
    } finally {
      setIsLoading(false)
    }
  }, [preloadSession, loadMessages])

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
        // 移除临时消息，添加真实用户消息
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId)
          return [...filtered, {
            id: `real_${Date.now()}`,
            role: 'user' as const,
            content,
            timestamp: new Date()
          }]
        })

        // 使用后端返回的分割后的句子（如果有）
        const sentences = data.sentences || [data.message || data.response]

        // 逐句添加AI消息，每句间隔1-2秒
        let currentIndex = 0

        const addNextSentence = () => {
          if (currentIndex >= sentences.length) {
            return
          }

          setMessages(prev => [...prev, {
            id: `ai_${Date.now()}_${currentIndex}`,
            role: 'assistant' as const,
            content: sentences[currentIndex],
            timestamp: new Date()
          }])

          currentIndex++

          if (currentIndex < sentences.length) {
            const delay = 1000 + Math.random() * 1000
            setTimeout(addNextSentence, delay)
          }
        }

        // 第一句延迟1-2秒后显示
        const initialDelay = 1000 + Math.random() * 1000
        setTimeout(addNextSentence, initialDelay)

        await loadContacts()
      } else {
        // 消息发送失败 - 标记用户消息为失败，不保存到历史
        console.error('消息发送失败:', data.error)
        setMessages(prev => prev.map(m =>
          m.id === tempId
            ? { ...m, pending: false, failed: true, error: data.error || '发送失败' }
            : m
        ))
      }
    } catch (err) {
      console.error('发送失败:', err)
      // 标记消息为失败
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, pending: false, failed: true, error: '网络错误' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }, [selectedContact, sessionId, loadContacts])

  // 结束会话
  const endSession = useCallback(async () => {
    if (!sessionId) return

    const token = localStorage.getItem('token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/chat/sessions/${sessionId}/end-chat`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    const data = await res.json()
    if (data.success) {
      setSessionId(null)
      setMessages([])
      setSelectedContact(null)
      await loadContacts()
    }
    return data
  }, [sessionId, loadContacts])

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
    endSession,
    setSelectedContact
  }
}
