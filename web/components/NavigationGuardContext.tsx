'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react'
import Modal from '@/components/ui/modal'
import { AlertCircle, Save, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavigationGuardContextType {
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (value: boolean) => void
  onSaveAndLeave: (() => Promise<void>) | null
  setOnSaveAndLeave: (callback: (() => Promise<void>) | null) => void
  checkAndBlock: (targetPath: string, onConfirm: () => void) => boolean
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined)

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext)
  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider')
  }
  return context
}

interface NavigationGuardProviderProps {
  children: ReactNode
}

export function NavigationGuardProvider({ children }: NavigationGuardProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const onSaveAndLeaveRef = useRef<(() => Promise<void>) | null>(null)
  const pendingNavigationRef = useRef<(() => void) | null>(null)

  const setOnSaveAndLeave = useCallback((callback: (() => Promise<void>) | null) => {
    onSaveAndLeaveRef.current = callback
  }, [])

  const handleLeaveWithoutSave = useCallback(() => {
    setHasUnsavedChanges(false)  // 重置未保存状态
    setShowModal(false)
    if (pendingNavigationRef.current) {
      pendingNavigationRef.current()
      pendingNavigationRef.current = null
    }
  }, [])

  const handleSaveAndLeave = useCallback(async () => {
    if (onSaveAndLeaveRef.current) {
      try {
        setIsSaving(true)
        await onSaveAndLeaveRef.current()
        setHasUnsavedChanges(false)  // 重置未保存状态
        setShowModal(false)
        if (pendingNavigationRef.current) {
          pendingNavigationRef.current()
          pendingNavigationRef.current = null
        }
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        setIsSaving(false)
      }
    }
  }, [])

  const checkAndBlock = useCallback((targetPath: string, onConfirm: () => void): boolean => {
    if (hasUnsavedChanges) {
      pendingNavigationRef.current = onConfirm
      setShowModal(true)
      return true // 已拦截
    }
    return false // 未拦截，继续导航
  }, [hasUnsavedChanges])

  return (
    <NavigationGuardContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        onSaveAndLeave: onSaveAndLeaveRef.current,
        setOnSaveAndLeave,
        checkAndBlock,
      }}
    >
      {children}

      {/* 全局离开确认弹窗 */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="离开页面"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              您有未保存的修改，确定要离开吗？
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleLeaveWithoutSave}
              className="flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" />
              不保存离开
            </Button>
            <Button
              onClick={handleSaveAndLeave}
              disabled={isSaving}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  保存中...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </NavigationGuardContext.Provider>
  )
}
