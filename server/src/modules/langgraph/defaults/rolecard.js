// server/src/modules/langgraph/defaults/rolecard.js
export const rolecardDefault = {
  flowId: 'rolecard',
  flowName: 'AI角色卡对话',
  description: '基于角色卡的AI伴侣对话流程 V3 - 支持倾诉模式与命理分析',
  // 流程开关配置
  flowSettings: {
    fortuneTellingEnabled: {
      type: 'boolean',
      default: true,
      description: '是否启用算命预测分支（用户直接要求算命时触发）'
    },
    ventingEnabled: {
      type: 'boolean',
      default: true,
      description: '是否启用倾诉倾听分支'
    }
  },
  nodes: [
    {
      nodeId: 'intent_classifier',
      nodeName: '意图分类',
      nodeType: 'start',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '用户消息', description: '用户输入的原始消息' },
        { name: '对话历史', description: '最近对话记录用于意图判断' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 200 },
      position: { x: 300, y: 50 }
    },
    {
      nodeId: 'token_monitor',
      nodeName: 'Token监控',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '当前Token数', description: '当前对话的Token使用量' },
        { name: '阈值状态', description: '是否达到60%/70%阈值' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 130 }
    },
    {
      nodeId: 'memory_check',
      nodeName: '记忆检查',
      nodeType: 'condition',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [{ name: '消息内容', description: '分析消息是否涉及记忆' }],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.3, maxTokens: 100 },
      position: { x: 300, y: 210 }
    },
    {
      nodeId: 'rag_retriever',
      nodeName: 'RAG检索',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '向量索引', description: '用户的对话记忆向量库' },
        { name: '检索查询', description: '基于消息生成的检索query' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 200 },
      position: { x: 150, y: 290 }
    },
    {
      nodeId: 'context_builder',
      nodeName: '上下文构建',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '角色卡设定', description: '从角色卡加载的人物设定' },
        { name: '对话历史', description: '最近N轮对话记录' },
        { name: 'RAG结果', description: '检索到的相关记忆（如有）' },
        { name: '当前消息', description: '用户的当前输入' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 370 }
    },
    {
      nodeId: 'response_generator',
      nodeName: '回复生成',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '系统提示词', description: '组装完成的完整系统提示词' },
        { name: '用户消息', description: '用户输入的消息' },
        { name: '上下文信息', description: 'RAG检索结果和对话历史' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 450 }
    },
    {
      nodeId: 'listening_phase',
      nodeName: '倾听阶段',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '用户消息', description: '用户倾诉的内容' },
        { name: '倾听轮次', description: '当前倾听次数' },
        { name: '角色卡设定', description: '角色卡的性格和关系' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.8, maxTokens: 300 },
      position: { x: 500, y: 290 }
    },
    {
      nodeId: 'chart_rag_retriever',
      nodeName: '命盘RAG检索',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '用户命盘', description: '紫微斗数命盘数据' },
        { name: '命理知识库', description: 'RAG检索命理相关知识' },
        { name: '核心关注点', description: '用户倾诉的核心问题' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 200 },
      position: { x: 500, y: 370 }
    },
    {
      nodeId: 'fortune_generator',
      nodeName: '命理分析',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '命盘数据', description: '用户命盘详细信息' },
        { name: 'RAG结果', description: '命理知识检索结果' },
        { name: '用户问题', description: '倾诉的核心关注点' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.5, maxTokens: 500 },
      position: { x: 500, y: 450 }
    },
    {
      nodeId: 'role_translator',
      nodeName: '角色口吻转换',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '命理分析', description: '内部命理分析报告' },
        { name: '角色卡设定', description: '角色卡的性格、口吻、关系' },
        { name: '隐藏术语', description: 'hideFortuneTerms配置' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.8, maxTokens: 500 },
      hideFortuneTerms: true,
      position: { x: 500, y: 530 }
    },
    {
      nodeId: 'token_response',
      nodeName: 'Token响应',
      nodeType: 'condition',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '生成响应', description: 'LLM生成的回复内容' },
        { name: 'Token状态', description: '是否触发疲劳提示或强制离线' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 610 }
    },
    {
      nodeId: 'output_formatter',
      nodeName: '输出格式化',
      nodeType: 'end',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: 'AI回复', description: '格式化后的最终回复' },
        { name: '元数据', description: '会话状态、周期信息等' }
      ],
      llmEnabled: false,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 300, y: 690 }
    }
  ],
  edges: [
    // 普通聊天分支
    { source: 'intent_classifier', target: 'token_monitor', conditionType: 'always', label: '' },
    { source: 'token_monitor', target: 'memory_check', conditionType: 'conditional', label: '普通聊天' },
    { source: 'memory_check', target: 'rag_retriever', conditionType: 'conditional', label: '涉及记忆' },
    { source: 'memory_check', target: 'context_builder', conditionType: 'conditional', label: '无需检索' },
    { source: 'rag_retriever', target: 'context_builder', conditionType: 'always', label: '' },
    { source: 'context_builder', target: 'response_generator', conditionType: 'always', label: '' },
    { source: 'response_generator', target: 'token_response', conditionType: 'always', label: '' },
    { source: 'token_response', target: 'output_formatter', conditionType: 'always', label: '' },

    // 倾诉-倾听分支
    { source: 'token_monitor', target: 'listening_phase', conditionType: 'conditional', label: '倾诉模式' },
    { source: 'listening_phase', target: 'chart_rag_retriever', conditionType: 'conditional', label: '进入分析' },
    { source: 'listening_phase', target: 'output_formatter', conditionType: 'conditional', label: '继续倾听' },
    { source: 'chart_rag_retriever', target: 'fortune_generator', conditionType: 'always', label: '' },
    { source: 'fortune_generator', target: 'role_translator', conditionType: 'always', label: '' },
    { source: 'role_translator', target: 'output_formatter', conditionType: 'always', label: '' },

    // 算命预测分支（直接进入分析，无倾听阶段）
    { source: 'token_monitor', target: 'chart_rag_retriever', conditionType: 'conditional', label: '算命预测' }
  ]
};
