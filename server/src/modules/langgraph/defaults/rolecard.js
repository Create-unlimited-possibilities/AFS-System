// server/src/modules/langgraph/defaults/rolecard.js
export const rolecardDefault = {
  flowId: 'rolecard',
  flowName: 'AI角色卡对话',
  description: '基于角色卡的AI伴侣对话流程',
  nodes: [
    {
      nodeId: 'response_generator',
      nodeName: '回复生成',
      nodeType: 'process',
      promptType: 'none',
      staticPrompt: '',
      dynamicSources: [
        { name: '角色卡设定', description: '从角色卡加载的人物设定' },
        { name: '对话历史', description: '最近20轮对话记录' },
        { name: '当前消息', description: '用户的当前输入' }
      ],
      llmEnabled: true,
      llmConfig: { source: 'ollama', model: 'deepseek-r1:14b', temperature: 0.7, maxTokens: 500 },
      position: { x: 400, y: 200 }
    }
  ],
  edges: []
};
