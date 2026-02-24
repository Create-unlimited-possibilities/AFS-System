import { create } from 'zustand'

/**
 * Role card information for fatigue dialog
 */
interface RoleCardInfo {
  name: string
  avatar?: string
}

/**
 * Chat session state for fatigue dialog and offline notification
 */
interface ChatSessionState {
  // Fatigue Dialog State (60% threshold)
  showFatigueDialog: boolean
  fatigueMessage: string
  roleCardInfo: RoleCardInfo | null

  // Offline State (70% threshold)
  isOffline: boolean
  isIndexing: boolean
  pendingMessageCount: number

  // Session ID for tracking
  sessionId: string | null

  // Actions - Fatigue Dialog
  setShowFatigueDialog: (show: boolean, message?: string, info?: RoleCardInfo) => void
  setFatigueMessage: (message: string) => void
  setRoleCardInfo: (info: RoleCardInfo | null) => void

  // Actions - Offline
  setOffline: (offline: boolean) => void
  setIndexing: (indexing: boolean) => void
  setPendingMessageCount: (count: number) => void
  incrementPendingCount: () => void

  // Actions - Session
  setSessionId: (id: string | null) => void

  // Actions - Reset
  reset: () => void
}

const initialState = {
  showFatigueDialog: false,
  fatigueMessage: '',
  roleCardInfo: null,
  isOffline: false,
  isIndexing: false,
  pendingMessageCount: 0,
  sessionId: null,
}

/**
 * Zustand store for managing chat session state
 * including fatigue dialog and offline notification
 */
export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  ...initialState,

  // Fatigue Dialog Actions
  setShowFatigueDialog: (show, message, info) => {
    set({
      showFatigueDialog: show,
      ...(message && { fatigueMessage: message }),
      ...(info && { roleCardInfo: info }),
    })
  },

  setFatigueMessage: (message) => {
    set({ fatigueMessage: message })
  },

  setRoleCardInfo: (info) => {
    set({ roleCardInfo: info })
  },

  // Offline Actions
  setOffline: (offline) => {
    set({ isOffline: offline })
  },

  setIndexing: (indexing) => {
    set({ isIndexing: indexing })
  },

  setPendingMessageCount: (count) => {
    set({ pendingMessageCount: count })
  },

  incrementPendingCount: () => {
    set((state) => ({ pendingMessageCount: state.pendingMessageCount + 1 }))
  },

  // Session Actions
  setSessionId: (id) => {
    set({ sessionId: id })
  },

  // Reset
  reset: () => {
    set(initialState)
  },
}))

/**
 * Selector hooks for better performance
 */
export const useFatigueDialogState = () =>
  useChatSessionStore((state) => ({
    showFatigueDialog: state.showFatigueDialog,
    fatigueMessage: state.fatigueMessage,
    roleCardInfo: state.roleCardInfo,
  }))

export const useOfflineState = () =>
  useChatSessionStore((state) => ({
    isOffline: state.isOffline,
    isIndexing: state.isIndexing,
    pendingMessageCount: state.pendingMessageCount,
  }))
