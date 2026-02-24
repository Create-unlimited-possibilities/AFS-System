'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MessageCircle, LogOut } from 'lucide-react'

interface FatigueDialogProps {
  isOpen: boolean
  onClose: () => void
  onContinue: () => void
  onEnd: () => void
  message: string
  roleCardInfo: {
    name: string
    avatar?: string
  }
}

/**
 * FatigueDialog Component
 *
 * Displays when token usage reaches 60% threshold.
 * Shows the role card's tired message and offers two options:
 * - Continue chatting for a while longer
 * - End the conversation and save memory
 *
 * Note: Dialog cannot be closed by clicking outside or pressing ESC.
 * User must explicitly choose an option.
 */
export function FatigueDialog({
  isOpen,
  onClose,
  onContinue,
  onEnd,
  message,
  roleCardInfo,
}: FatigueDialogProps) {
  const defaultTiredMessage = '聊了这么久，我有点累了，想休息一下...'
  const displayMessage = message || defaultTiredMessage

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  const handleContinue = () => {
    onContinue()
    onClose()
  }

  const handleEnd = () => {
    onEnd()
    onClose()
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="items-center text-center sm:text-left">
          {/* Avatar Section */}
          <div className="mx-auto mb-4 flex items-center justify-center">
            {roleCardInfo.avatar ? (
              <img
                src={roleCardInfo.avatar}
                alt={roleCardInfo.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-orange-200 dark:border-orange-800"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold">
                {getInitials(roleCardInfo.name)}
              </div>
            )}
          </div>

          {/* Title with role card name */}
          <DialogTitle className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
            {roleCardInfo.name}
          </DialogTitle>

          {/* Tired message as description */}
          <DialogDescription className="text-center text-base text-gray-600 dark:text-gray-300 mt-2">
            "{displayMessage}"
          </DialogDescription>
        </DialogHeader>

        {/* Action Buttons */}
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
          <Button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            <MessageCircle className="w-4 h-4" />
            <span>继续聊多一会</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleEnd}
            className="flex-1 flex items-center justify-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
          >
            <LogOut className="w-4 h-4" />
            <span>结束对话</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
