/**
 * LangGraph边定义
 * 定义节点之间的连接关系
 *
 * @author AFS Team
 * @version 1.0.0
 */

export const edges = {
  'input_processor': 'relation_confirm',
  'relation_confirm': 'rolecard_assemble',
  'rolecard_assemble': 'token_monitor',
  'token_monitor': 'route_by_relation',
  'rag_retriever': 'context_builder',
  'sentiment_analyzer': 'context_builder',
  'context_builder': 'response_generator',
  'response_generator': 'token_response',
  'token_response': 'memory_updater',
  'memory_updater': 'output_formatter'
};

export const conditionalEdges = {
  'route_by_relation': routeByRelation,
  'token_response': routeAfterTokenResponse
};

/**
 * 根据关系类型路由到下一个节点
 * @param {Object} state - 当前对话状态
 * @returns {string} 下一个节点名称
 */
export function routeByRelation(state) {
  const relationType = state.interlocutor?.relationType || 'stranger';

  switch (relationType) {
    case 'family':
      return 'rag_retriever';
    case 'friend':
      return 'rag_retriever';
    case 'stranger':
      return 'sentiment_analyzer';
    default:
      return 'sentiment_analyzer';
  }
}

/**
 * Route after token response check
 * If token monitoring triggered termination, skip memory_updater and go to output
 * Otherwise continue to memory_updater
 *
 * @param {Object} state - Current conversation state
 * @returns {string} Next node name
 */
export function routeAfterTokenResponse(state) {
  // Check if token monitoring triggered termination
  if (state.metadata?.tokenTerminated || state.metadata?.shouldEndSession) {
    // Skip memory_updater for terminated sessions
    return 'output_formatter';
  }

  // Normal flow - continue to memory updater
  return 'memory_updater';
}
