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
    <div className="h-full flex bg-gray-100">
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
