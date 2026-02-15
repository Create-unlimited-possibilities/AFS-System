---
sidebar_position: 1
---

# LangGraph 对话系统

## 概述

AFS System 使用 **LangGraph** 构建 AI 对话编排系统，实现基于个人记忆的个性化对话体验。

## 对话流程

```
用户输入
    │
    ▼
┌─────────────────┐
│ inputProcessor  │  处理用户输入
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ relationConfirm │  确认对话者关系
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 家人/朋友   陌生人
    │         │
    ▼         ▼
┌─────────────────┐
│roleCardAssemble │  组装角色卡
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ragRetriever   │  RAG 检索记忆
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│sentimentAnalyzer│  情感分析
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ contextBuilder  │  构建上下文
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│responseGenerator│  生成响应
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  memoryUpdater  │  更新记忆
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ outputFormatter │  格式化输出
└────────┬────────┘
         │
         ▼
     返回响应
```

## 节点说明

### 1. inputProcessor（输入处理）
- 清理用户输入
- 提取关键信息
- 标准化格式

### 2. relationConfirm（关系确认）
- 识别对话者身份
- 确定关系类型：家人/朋友/陌生人
- 加载对应配置

### 3. roleCardAssemble（角色卡组装）
- 根据 V2 分层架构动态组装角色卡
- 加载核心层和对应关系层
- 应用安全护栏和校准层
- 组装系统提示词

:::info V2 升级
角色卡系统已升级为 V2 分层架构，详见 [角色卡系统 V2](./rolecard-v2.md)。
:::

### 4. ragRetriever（RAG 检索）
- 向量相似度搜索
- 检索相关记忆
- 陌生人不检索

### 5. sentimentAnalyzer（情感分析）
- 分析用户输入情感
- 陌生人模式更新好感度
- 记录情感变化

### 6. contextBuilder（上下文构建）
- 组装对话历史
- 添加检索到的记忆
- 构建完整上下文

### 7. responseGenerator（响应生成）
- 调用 LLM 生成回复
- 支持流式输出
- 处理生成错误

### 8. memoryUpdater（记忆更新）
- 保存对话历史
- 更新好感度记录
- 同步到存储

### 9. outputFormatter（输出格式化）
- 格式化响应结构
- 添加元数据
- 返回最终结果

## 对话状态

```typescript
interface ConversationState {
  sessionId: string;
  targetUserId: string;
  interlocutorUserId: string;
  relation: {
    type: 'family' | 'friend' | 'stranger';
    specificRelation: string;
  };
  roleCardMode: 'A' | 'B' | 'C';
  systemPrompt: string;
  sentimentScore: number;
  messages: Message[];
  isActive: boolean;
}
```

## 关系类型处理

| 关系类型 | 角色卡模式 | 记忆检索 | 好感度追踪 |
|---------|-----------|---------|-----------|
| 家人 | B 套 | 检索家人记忆 | 否 |
| 朋友 | C 套 | 检索朋友记忆 | 否 |
| 陌生人 | 默认 | 不检索 | 是 |
