import { useState, useEffect, useCallback } from 'react'

// Check if user profile has complete birth info
const checkBirthInfoComplete = (profile: UserProfile | null): boolean => {
  if (!profile) return true // Assume complete if no data
  return !!(
    profile.birthDate &&
    profile.birthHour !== undefined &&
    profile.birthCalendar
  )
}

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

interface UserProfile {
  birthDate?: string
  birthHour?: number
  birthCalendar?: 'solar' | 'lunar'
}

export function useChat() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasCompleteBirthInfo, setHasCompleteBirthInfo] = useState(true)

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

  // Load user profile to check birth info
  const loadUserProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.success && data.profile) {
        const profileData = data.profile.profile || data.profile
        setUserProfile(profileData)
        setHasCompleteBirthInfo(checkBirthInfoComplete(profileData))
      }
    } catch (err) {
      console.error('Failed to load user profile:', err)
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

    // Check if this is XiaoShuDong
    const isXiaoShuDong = contact.targetUserId === 'xiaoshudong'

    if (isXiaoShuDong) {
      // Load user profile to check birth info status
      await loadUserProfile()

      // For XiaoShuDong, load conversation history from special endpoint
      setMessages([])
      setIsLoading(true)

      try {
        const token = localStorage.getItem('token')
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/xiaoshudong/history`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        if (data.success && data.messages) {
          setMessages(data.messages.map((msg: any) => ({
            id: msg._id || msg.timestamp || `xsd_${Date.now()}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp || msg.createdAt)
          })))
        }
      } catch (err) {
        console.error('加载小树洞历史失败:', err)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Regular contact handling
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
  }, [preloadSession, loadMessages, loadUserProfile])

  // 发送消息
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !selectedContact) return

    // Check if this is XiaoShuDong
    const isXiaoShuDong = selectedContact.targetUserId === 'xiaoshudong'

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
      let data: any

      if (isXiaoShuDong) {
        // Send to XiaoShuDong API
        const token = localStorage.getItem('token')
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/xiaoshudong/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ message: content })
          }
        )
        data = await res.json()
      } else {
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
          const sessionData = await res.json()
          if (sessionData.success) {
            sid = sessionData.session.sessionId
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
        data = await res.json()
      }

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

        // Use backend response for AI reply
        const response = data.response || data.message

        if (isXiaoShuDong && data.sentences && data.sentences.length > 0) {
          // 逐句显示 AI 回复 (小树洞)
          const sentences = data.sentences
          let currentIndex = 0

          const addNextSentence = () => {
            if (currentIndex >= sentences.length) return

            setMessages(prev => [...prev, {
              id: `ai_${Date.now()}_${currentIndex}`,
              role: 'assistant' as const,
              content: sentences[currentIndex],
              timestamp: new Date()
            }])

            currentIndex++

            if (currentIndex < sentences.length) {
              const delay = 1000 + Math.random() * 1000  // 1-2秒间隔
              setTimeout(addNextSentence, delay)
            }
          }

          const initialDelay = 1000 + Math.random() * 1000
          setTimeout(addNextSentence, initialDelay)
        } else {
          // 普通 AI 角色卡对话 - 直接显示完整回复
          setMessages(prev => [...prev, {
            id: `ai_${Date.now()}`,
            role: 'assistant' as const,
            content: response,
            timestamp: new Date()
          }])
        }

        if (!isXiaoShuDong) {
          await loadContacts()
        }
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
    setSelectedContact,
    hasCompleteBirthInfo
  }
}
