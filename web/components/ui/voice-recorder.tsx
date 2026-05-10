"use client"

import * as React from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceRecorderProps {
  onTranscript?: (text: string) => void  // 转录文字回调（预留接口）
  disabled?: boolean
  className?: string
  size?: "sm" | "md" | "lg"
}

/**
 * VoiceRecorder 组件 - 语音录制按钮
 *
 * 当前状态：MOCK 实现（仅视觉效果，无后端调用）
 * - 点击开始"录音"，显示高对比度动画
 * - 再次点击停止"录音"
 *
 * TODO: 接入后端 WebSocket 实现真实转录功能
 */
export function VoiceRecorder({
  onTranscript,
  disabled = false,
  className,
  size = "md"
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  }

  const handleToggleRecording = () => {
    if (disabled) return

    if (!isRecording) {
      // 开始"录音" - 仅视觉效果
      setIsRecording(true)
      console.log("[VoiceRecorder] Mock: 开始录音（仅视觉效果）")
    } else {
      // 停止"录音"
      setIsRecording(false)
      console.log("[VoiceRecorder] Mock: 停止录音（仅视觉效果）")

      // 预留回调接口 - 未来真实实现时使用
      // if (onTranscript) {
      //   onTranscript("转录的文字内容")
      // }
    }
  }

  return (
    <div className="relative inline-flex">
      {/* 录音时的脉冲动画背景 */}
      {isRecording && (
        <>
          {/* 外层脉冲圈 */}
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping",
              "bg-red-500/40",
              sizeClasses[size]
            )}
            style={{ animationDuration: "1.5s" }}
          />
          {/* 中层脉冲圈 */}
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-pulse",
              "bg-red-500/30",
              sizeClasses[size]
            )}
            style={{ animationDuration: "1s" }}
          />
          {/* 录音波纹效果 */}
          <span
            className={cn(
              "absolute inset-0 rounded-full",
              "border-2 border-red-500",
              sizeClasses[size],
              isRecording && "animate-[ripple_1.5s_ease-out_infinite]"
            )}
          />
        </>
      )}

      {/* 主按钮 */}
      <button
        type="button"
        onClick={handleToggleRecording}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={disabled}
        className={cn(
          "relative z-10 rounded-full transition-all duration-200",
          "flex items-center justify-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          sizeClasses[size],
          // 录音状态样式 - 高对比度红色
          isRecording
            ? "bg-red-500 text-white shadow-lg shadow-red-500/50 scale-110 focus-visible:ring-red-500"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 focus-visible:ring-gray-400",
          // 禁用状态
          disabled && "opacity-50 cursor-not-allowed",
          // 悬停效果（非录音状态）
          !isRecording && isHovered && "scale-105",
          className
        )}
        title={isRecording ? "点击停止录音" : "点击开始语音输入"}
      >
        {isRecording ? (
          <MicOff size={iconSizes[size]} className="animate-pulse" />
        ) : (
          <Mic size={iconSizes[size]} />
        )}
      </button>

      {/* 录音状态指示文字 */}
      {isRecording && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-red-500 animate-pulse">
          录音中...
        </span>
      )}
    </div>
  )
}

VoiceRecorder.displayName = "VoiceRecorder"
