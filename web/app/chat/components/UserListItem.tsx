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
