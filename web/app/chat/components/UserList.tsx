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
