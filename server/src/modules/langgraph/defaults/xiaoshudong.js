// server/src/modules/langgraph/defaults/xiaoshudong.js
export const xiaoshudongDefault = {
  flowId: 'xiaoshudong',
  flowName: '小树洞对话',
  description: '心理咨询式匿名对话流程',
  nodes: [
    {
      nodeId: 'conversation_manager',
      nodeName: '对话管理',
      nodeType: 'start',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '对话状态', description: '当前对话阶段和轮次' },
        { name: '用户意图', description: '识别的用户意图' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 100 },
      position: { x: 300, y: 50 }
    },
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
      dynamicSources: [],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 200 },
      position: { x: 150, y: 150 }
    },
    {
      nodeId: 'conversation_compressor',
      nodeName: '对话压缩',
      nodeType: 'process',
      promptType: 'static',
      staticPrompt: `你是一个对话分析专家。分析用户与心理咨询师的对话，提取关键信息。

请以JSON格式输出：
1. **eventSummary**: 用户遇到的事件摘要（1-2句话）
2. **timeSpan**: 事件涉及的时间跨度
3. **emotionalState**: 用户当前的情绪状态
4. **coreConcerns**: 用户最关心的核心问题（数组，最多3个）
5. **keyEvents**: 对话中提到的关键事件（数组，最多5个）

只输出JSON，不要有其他文字。`,
      dynamicSources: [],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 500 },
      position: { x: 450, y: 150 }
    },
    {
      nodeId: 'chart_retriever',
      nodeName: '命盘检索',
      nodeType: 'condition',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '{userId}', description: '用户ID，用于检索命盘' },
        { name: '{natalChart}', description: '从存储读取的命盘数据（12宫、星曜等）' },
        { name: '{userInput}', description: '用户输入，用于识别相关宫位' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 100 },
      position: { x: 450, y: 230 }
    },
    {
      nodeId: 'rag_retriever',
      nodeName: '知识检索',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '书籍内容', description: 'RAG检索的紫微斗数知识' },
        { name: '用户情况', description: '事件摘要、情绪状态、核心关注' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 200 },
      position: { x: 450, y: 310 }
    },
    {
      nodeId: 'fortune_generator',
      nodeName: '命理生成',
      nodeType: 'process',
      promptType: 'dynamic',
      staticPrompt: '',
      dynamicSources: [
        { name: '{compressedData}', description: '用户情况：来自对话压缩节点的事件摘要、情绪状态、核心关注' },
        { name: '{editableSection}', description: '可编辑分析指引：管理员在后台编辑的分析要求' },
        { name: '{formattedChartText}', description: '命盘MD：从存储读取的命盘数据，包含12宫详解' },
        { name: '{ragContext}', description: '知识检索：RAG检索的紫微斗数书籍内容' }
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
      position: { x: 450, y: 390 }
    },
    {
      nodeId: 'psychologist_response',
      nodeName: '心理师回复',
      nodeType: 'end',
      promptType: 'dynamic',
      staticPrompt: '',
      dynamicSources: [
        { name: '{fortuneResponse}', description: '命理报告：来自命理生成节点的分析结果' },
        { name: '{editableSection}', description: '可编辑回复指引：管理员在后台编辑的回复要求' },
        { name: '{compressedData}', description: '用户情况：事件摘要、情绪状态、核心关注' },
        { name: '{userQuestion}', description: '用户原始问题' }
      ],
      editableSection: `## 回复要求
请基于内部分析报告，以温暖、专业的心理咨询师身份给出建议。

注意：
- 不要直接引用分析报告中的命理术语
- 用心理咨询的语言重新表述
- 保持温暖、支持性的语气`,
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 490 }
    }
  ],
  edges: [
    { source: 'conversation_manager', target: 'listening_response', conditionType: 'conditional', label: '倾听阶段' },
    { source: 'conversation_manager', target: 'conversation_compressor', conditionType: 'conditional', label: '分析阶段' },
    { source: 'conversation_compressor', target: 'chart_retriever', conditionType: 'always', label: '' },
    { source: 'chart_retriever', target: 'rag_retriever', conditionType: 'always', label: '' },
    { source: 'rag_retriever', target: 'fortune_generator', conditionType: 'always', label: '' },
    { source: 'fortune_generator', target: 'psychologist_response', conditionType: 'always', label: '' }
  ]
};
