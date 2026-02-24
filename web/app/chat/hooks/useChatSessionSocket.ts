import { useEffect, useCallback, useRef } from 'react'
import { useChatSessionStore } from '@/stores/chatSession'

/**
 * WebSocket event types for chat session
 */
interface TokenThresholdEvent {
  sessionId: string
  threshold: 60 | 70
  message?: string
  roleCardInfo: {
    name: string
    avatar?: string
  }
}

interface IndexingStatusEvent {
  sessionId: string
  status: 'started' | 'completed'
  pendingMessageCount?: number
}

interface RoleCardOnlineEvent {
  sessionId: string
  readyToChat: boolean
}

type WebSocketEventType = 'token_threshold' | 'indexing_status' | 'role_card_online'

interface WebSocketMessage {
  event: WebSocketEventType
  data: TokenThresholdEvent | IndexingStatusEvent | RoleCardOnlineEvent
}

/**
 * Hook options
 */
interface UseChatSessionSocketOptions {
  url?: string
  autoConnect?: boolean
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
}

/**
 * Hook return type
 */
interface UseChatSessionSocketReturn {
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  send: (data: any) => void
}

/**
 * Custom hook for handling WebSocket events related to chat session
 * including fatigue dialog (60%) and offline notification (70%)
 */
export function useChatSessionSocket(
  options: UseChatSessionSocketOptions = {}
): UseChatSessionSocketReturn {
  const {
    url = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'}/ws/chat`,
    autoConnect = true,
    onConnected,
    onDisconnected,
    onError,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const isConnectedRef = useRef(false)

  // Get store actions
  const {
    setShowFatigueDialog,
    setOffline,
    setIndexing,
    setPendingMessageCount,
    setSessionId,
    reset,
  } = useChatSessionStore()

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        const { event: eventType, data } = message

        switch (eventType) {
          case 'token_threshold': {
            const thresholdData = data as TokenThresholdEvent

            // Update session ID
            setSessionId(thresholdData.sessionId)

            if (thresholdData.threshold === 60) {
              // 60% threshold - Show fatigue dialog
              setShowFatigueDialog(true, thresholdData.message, thresholdData.roleCardInfo)
            } else if (thresholdData.threshold === 70) {
              // 70% threshold - Force offline
              setOffline(true)
              setShowFatigueDialog(false)
            }
            break
          }

          case 'indexing_status': {
            const indexingData = data as IndexingStatusEvent

            if (indexingData.status === 'started') {
              setIndexing(true)
            } else if (indexingData.status === 'completed') {
              setIndexing(false)
              if (indexingData.pendingMessageCount !== undefined) {
                setPendingMessageCount(indexingData.pendingMessageCount)
              }
            }
            break
          }

          case 'role_card_online': {
            const onlineData = data as RoleCardOnlineEvent

            if (onlineData.readyToChat) {
              // Role card is back online
              setOffline(false)
              setIndexing(false)
              setPendingMessageCount(0)
            }
            break
          }

          default:
            console.warn('[ChatSessionSocket] Unknown event type:', eventType)
        }
      } catch (error) {
        console.error('[ChatSessionSocket] Failed to parse message:', error)
      }
    },
    [setShowFatigueDialog, setOffline, setIndexing, setPendingMessageCount, setSessionId]
  )

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket(url)

    ws.onopen = () => {
      isConnectedRef.current = true
      console.log('[ChatSessionSocket] Connected')
      onConnected?.()
    }

    ws.onclose = () => {
      isConnectedRef.current = false
      console.log('[ChatSessionSocket] Disconnected')
      onDisconnected?.()
    }

    ws.onerror = (error) => {
      console.error('[ChatSessionSocket] Error:', error)
      onError?.(error)
    }

    ws.onmessage = handleMessage

    wsRef.current = ws
  }, [url, handleMessage, onConnected, onDisconnected, onError])

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      isConnectedRef.current = false
      reset()
    }
  }, [reset])

  // Send message through WebSocket
  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('[ChatSessionSocket] Cannot send - not connected')
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    isConnected: isConnectedRef.current,
    connect,
    disconnect,
    send,
  }
}

/**
 * Simulated hook for testing without WebSocket connection
 * Can be used during development or for E2E testing
 */
export function useChatSessionSimulator() {
  const {
    setShowFatigueDialog,
    setOffline,
    setIndexing,
    setPendingMessageCount,
    setSessionId,
    reset,
  } = useChatSessionStore()

  // Simulate 60% threshold (fatigue dialog)
  const simulateFatigue = useCallback(
    (message?: string, roleCardInfo?: { name: string; avatar?: string }) => {
      setSessionId('test-session-id')
      setShowFatigueDialog(
        true,
        message || '聊了这么久，我有点累了，想休息一下...',
        roleCardInfo || { name: 'Test User' }
      )
    },
    [setShowFatigueDialog, setSessionId]
  )

  // Simulate 70% threshold (forced offline)
  const simulateOffline = useCallback(() => {
    setOffline(true)
    setShowFatigueDialog(false)
  }, [setOffline, setShowFatigueDialog])

  // Simulate indexing start
  const simulateIndexingStart = useCallback(() => {
    setIndexing(true)
  }, [setIndexing])

  // Simulate indexing complete
  const simulateIndexingComplete = useCallback(
    (pendingCount?: number) => {
      setIndexing(false)
      setPendingMessageCount(pendingCount || 0)
    },
    [setIndexing, setPendingMessageCount]
  )

  // Simulate back online
  const simulateOnline = useCallback(() => {
    setOffline(false)
    setIndexing(false)
    setPendingMessageCount(0)
  }, [setOffline, setIndexing, setPendingMessageCount])

  // Reset simulation
  const simulateReset = useCallback(() => {
    reset()
  }, [reset])

  return {
    simulateFatigue,
    simulateOffline,
    simulateIndexingStart,
    simulateIndexingComplete,
    simulateOnline,
    simulateReset,
  }
}
