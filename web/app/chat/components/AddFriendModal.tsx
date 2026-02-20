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
