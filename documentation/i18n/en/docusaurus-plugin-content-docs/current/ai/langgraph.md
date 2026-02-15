---
sidebar_position: 6
---

# LangGraph Conversation System

AFS System uses LangGraph for stateful AI conversations with memory persistence.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    LangGraph Flow                       │
│                                                         │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  START  │───▶│    Input    │───▶│   Context   │    │
│  │         │    │   Handler   │    │   Builder   │    │
│  └─────────┘    └─────────────┘    └─────────────┘    │
│                                            │            │
│                                            ▼            │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │  END    │◀───│  Response   │◀───│     LLM     │    │
│  │         │    │  Formatter  │    │    Node     │    │
│  └─────────┘    └─────────────┘    └─────────────┘    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Conversation Nodes

### Input Handler
- Validates user message
- Extracts intent and entities
- Sanitizes input

### Context Builder
- Retrieves user profile from MongoDB
- Fetches relevant memories via RAG
- Builds conversation history

### LLM Node
- Calls Ollama local LLM
- Manages token limits
- Handles streaming responses

### Response Formatter
- Structures AI response
- Extracts sentiment data
- Updates affinity scores

## State Management

```javascript
const conversationState = {
  messages: [],           // Chat history
  userProfile: {},        // User data
  retrievedMemories: [],  // RAG results
  sentiment: 0.5,        // Current sentiment
  affinityScore: 0,      // Relationship score
};
```

## RAG Integration

The conversation system integrates with ChromaDB for semantic memory retrieval:

1. User message is embedded using BGE-M3
2. ChromaDB searches for relevant memories
3. Top-k memories are injected into context
4. LLM generates response with memory awareness

## Configuration

```javascript
const graphConfig = {
  modelName: "qwen2.5:7b",
  embeddingModel: "bge-m3",
  maxTokens: 4096,
  temperature: 0.7,
  topK: 5,  // RAG retrieval count
};
```

## Memory Persistence

Conversations are persisted in two ways:
- **MongoDB**: Structured conversation logs
- **ChromaDB**: Embedded memories for RAG
