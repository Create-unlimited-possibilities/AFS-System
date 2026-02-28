// server/src/modules/langgraph/defaults/xiaoshudong.js
export const xiaoshudongDefault = {
  flowId: 'xiaoshudong',
  flowName: '小树洞对话',
  description: '心理咨询式匿名对话流程',
  nodes: [
    {
      nodeId: 'listening_response',
      nodeName: '倾听回复',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一位温暖、专业、有同理心的心理咨询师（小树洞）。

你的角色是倾听用户的烦恼，通过温和的引导帮助他们理清思绪。

## 回复原则

1. **简洁温暖**：回复2-4句话，用温暖平实的语言
2. **共情回应**：首先理解并回应用户的情绪
3. **温和引导**：每次可以问一个开放式问题帮助用户展开
4. **避免说教**：不要急于给建议，先倾听
5. **禁止命理词汇**：绝不使用命理、占卜、运势等词汇

只输出你的回复内容，不要有任何其他文字。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 200 },
      position: { x: 100, y: 100 }
    },
    {
      nodeId: 'conversation_compressor',
      nodeName: '对话压缩',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一个对话分析专家。你的任务是分析用户与心理咨询师的对话，提取关键信息。

请分析以下对话，并以JSON格式输出以下信息：

1. **eventSummary**: 用户遇到的事件摘要（1-2句话）
2. **timeSpan**: 事件涉及的时间跨度
3. **emotionalState**: 用户当前的情绪状态
4. **coreConcerns**: 用户最关心的核心问题（数组，最多3个）
5. **keyEvents**: 对话中提到的关键事件（数组，最多5个）

只输出JSON，不要有其他文字。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 500 },
      position: { x: 300, y: 100 }
    },
    {
      nodeId: 'fortune_generator',
      nodeName: '命理生成',
      nodeType: 'process',
      promptType: 'dynamic',
      dynamicSources: [
        { name: '用户情况', description: '事件摘要、情绪状态、核心关注' },
        { name: '书籍内容', description: 'RAG 检索的紫微斗数知识' },
        { name: '用户问题', description: '用户的原始问题' }
      ],
      editableSection: `## 分析要求
请根据以上命盘信息和用户情况，提供专业的紫微斗数分析报告。要求：
1. 分析用户当前面临的情况
2. 从命盘角度解读优势和挑战
3. 结合运限给出时间节点建议
4. 提供具体的行动建议

请用专业但通俗的语言撰写分析报告。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'ziwei-8b', temperature: 0.7, maxTokens: 4096 },
      position: { x: 500, y: 100 }
    },
    {
      nodeId: 'psychologist_response',
      nodeName: '心理师回复',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一位温暖、专业、富有同理心的心理咨询师。

## 你的身份和特点
- 你擅长倾听和理解他人的困扰
- 你能够从多角度分析问题，给出实用的建议
- 你的语言温暖、支持性强，让来访者感到被理解和接纳

## 绝对禁止
- 绝对不要提及"命理"、"算命"、"占卜"、"预测"等词汇
- 绝对不要提及"命盘"、"星盘"、"宫位"、"星曜"等专业术语

只输出你的回复内容。`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 700, y: 100 }
    },
    {
      nodeId: 'intent_classifier',
      nodeName: '意图分类',
      nodeType: 'condition',
      promptType: 'static',
      staticPrompt: `分析用户消息的意图，判断用户想要什么。

可能的意图类型：
- chat: 普通聊天
- vent: 发泄情绪
- seek_advice: 寻求建议
- ask_question: 提问

返回JSON格式：{"intent": "意图类型", "confidence": 0.0-1.0}`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 100 },
      position: { x: 100, y: 300 }
    }
  ],
  edges: [
    { source: 'intent_classifier', target: 'listening_response', conditionType: 'conditional' },
    { source: 'listening_response', target: 'conversation_compressor', conditionType: 'conditional' },
    { source: 'conversation_compressor', target: 'fortune_generator', conditionType: 'conditional' },
    { source: 'fortune_generator', target: 'psychologist_response', conditionType: 'always' }
  ]
};
