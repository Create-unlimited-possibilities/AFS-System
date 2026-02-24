'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, Loader2, Mail, AlertCircle } from 'lucide-react'

interface OfflineNotificationProps {
  isOffline: boolean
  isIndexing: boolean
  pendingMessageCount: number
  onOnline: () => void
}

/**
 * OfflineNotification Component
 *
 * Displays when token usage reaches 70% threshold (forced offline).
 * Shows:
 * - Offline status indicator
 * - Pending message count
 * - Indexing progress indicator
 * - Online notification when indexing completes
 */
export function OfflineNotification({
  isOffline,
  isIndexing,
  pendingMessageCount,
  onOnline,
}: OfflineNotificationProps) {
  const [showOnlineNotification, setShowOnlineNotification] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Track offline-to-online transition
  useEffect(() => {
    if (isOffline) {
      setWasOffline(true)
      setShowOnlineNotification(false)
    } else if (wasOffline && !isOffline) {
      // Just came back online
      setShowOnlineNotification(true)
      onOnline()

      // Auto-hide the online notification after 3 seconds
      const timer = setTimeout(() => {
        setShowOnlineNotification(false)
        setWasOffline(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [isOffline, wasOffline, onOnline])

  // Don't render anything if not in offline state and no online notification
  if (!isOffline && !showOnlineNotification) {
    return null
  }

  // Online notification (brief success message)
  if (showOnlineNotification && !isOffline) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <Wifi className="w-5 h-5" />
          <span className="font-medium">角色卡已恢复在线</span>
        </div>
      </div>
    )
  }

  // Offline notification bar
  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {/* Left side: Offline status */}
        <div className="flex items-center gap-3">
          {isIndexing ? (
            <>
              <Loader2 className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  正在索引记忆中...
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  请稍候，正在处理对话内容
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  用户已离线休息
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  角色卡正在休息中
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right side: Pending messages indicator */}
        {pendingMessageCount > 0 && (
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded-full">
              <Mail className="w-4 h-4" />
              <span className="text-xs font-medium">{pendingMessageCount} pending</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ChatInputOverlay Component
 *
 * Overlay to disable chat input when offline.
 * Displays a message explaining why input is disabled.
 */
export function ChatInputOverlay({ isOffline }: { isOffline: boolean }) {
  if (!isOffline) {
    return null
  }

  return (
    <div className="absolute inset-0 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-lg">
      <div className="text-center p-4">
        <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Chat is disabled while offline
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Messages will be delivered when back online
        </p>
      </div>
    </div>
  )
}
