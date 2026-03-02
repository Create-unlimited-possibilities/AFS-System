/**
 * Edge definitions for XiaoShuDong workflow v2.0
 * 智能渐进式对话流程
 *
 * 流程设计：
 * Phase 1 - Listening:
 *   conversation_manager → listening_response → output
 *
 * Phase 2 - Analysis:
 *   conversation_manager → conversation_compressor → chart_retriever →
 *   rag_retriever → fortune_generator → psychologist_response → output
 *
 * @author AFS Team
 * @version 2.0.0
 */

/**
 * 节点流程定义
 */
export const edges = {
  // 入口：对话管理
  'conversation_manager': 'conditional_route',

  // 倾听分支
  'listening_response': 'output',

  // 分析分支 v2.0
  'conversation_compressor': 'chart_retriever',
  'chart_retriever': 'rag_retriever',
  'rag_retriever': 'fortune_generator',
  'fortune_generator': 'psychologist_response',
  'psychologist_response': 'output',

  // 旧版兼容 (deprecated)
  'response_polisher': 'output'
};

/**
 * 智能路由 - 根据对话状态决定下一步
 *
 * @param {string} currentNode - 当前节点名
 * @param {Object} state - 对话状态
 * @returns {string} 下一个节点名或 'output'
 */
export function getNextNode(currentNode, state) {
  switch (currentNode) {
    // 对话管理节点后的智能路由
    case 'conversation_manager':
    case 'conditional_route':
      return routeAfterConversationManager(state);

    // 倾听分支 - 直接输出
    case 'listening_response':
      return 'output';

    // 分析分支 v2.0 - 按顺序执行
    case 'conversation_compressor':
      return 'chart_retriever';

    case 'chart_retriever':
      // 用户必须填写完整资料才能使用小树洞，所以一定有命盘
      return 'rag_retriever';

    case 'rag_retriever':
      return 'fortune_generator';

    case 'fortune_generator':
      return 'psychologist_response';

    case 'psychologist_response':
      return 'output';

    // 旧版兼容
    case 'response_polisher':
      return 'output';

    default:
      return edges[currentNode] || 'output';
  }
}

/**
 * 对话管理后的路由逻辑
 */
function routeAfterConversationManager(state) {
  const phase = state.conversationPhase?.current || 'listening';

  // 如果用户明确要求跳过倾听，直接进入分析
  if (state.metadata?.skipListening) {
    return 'conversation_compressor';
  }

  // 如果已经准备好分析
  if (state.metadata?.readyForAnalysis === true) {
    return 'conversation_compressor';
  }

  // 根据对话阶段决定路由
  switch (phase) {
    case 'listening':
      // 继续倾听阶段
      return 'listening_response';

    case 'transition':
    case 'analysis':
      // 进入分析阶段 - 先压缩对话
      return 'conversation_compressor';

    default:
      // 默认继续倾听
      return 'listening_response';
  }
}

/**
 * 检查工作流是否应该继续
 *
 * @param {string} currentNode - 当前节点名
 * @returns {boolean}
 */
export function shouldContinue(currentNode) {
  return currentNode !== 'output' && currentNode !== null && currentNode !== undefined;
}

/**
 * 获取工作流路径描述（用于日志）
 * @param {Object} state - 对话状态
 * @returns {string}
 */
export function getWorkflowPath(state) {
  const phase = state.conversationPhase?.current || 'listening';
  const turnCount = state.conversationPhase?.turnCount || 0;

  if (phase === 'listening') {
    return `倾听阶段 (第${turnCount}轮)`;
  } else if (phase === 'transition') {
    return `过渡阶段 → 准备分析`;
  } else {
    const compressed = state.compressedData?.eventSummary?.substring(0, 20) || '未知';
    return `分析阶段 (事件: ${compressed}...)`;
  }
}

export default { edges, getNextNode, shouldContinue, getWorkflowPath };
