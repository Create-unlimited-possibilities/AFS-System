---
date: "2026-03-25 00:02"
promoted: false
---

语音转文字+粤语翻译功能 - 已完成设计文档 docs/superpowers/specs/2026-03-24-voice-to-text-design.md

## 功能概述
- 语音转文字：实时转录用户语音，自动填入文本框
- 粤语检测：检测文本是否包含粤语口语特征
- 粤语翻译：将粤语口语翻译为普通话书面语
- 翻译开关：用户可自主启用/禁用翻译功能

## 技术栈
- 前端：VoiceRecorder 组件 (Next.js + WebSocket)
- 转录服务：Python FastAPI + faster-whisper (large-v3-turbo)
- 翻译服务：Node.js + CantoneseLLMChat-7B (硬编码)

## 使用场景
- 个人问答页面 (/questions)
- 协助者问答页面 (/questions/assist)
- AI 对话界面 (/chat)

## 状态
设计文档已完成，待实现。
