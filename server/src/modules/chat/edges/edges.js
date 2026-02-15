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
  'rolecard_assemble': 'route_by_relation',
  'rag_retriever': 'context_builder',
  'sentiment_analyzer': 'context_builder',
  'context_builder': 'response_generator',
  'response_generator': 'memory_updater',
  'memory_updater': 'output_formatter'
};

export const conditionalEdges = {
  'route_by_relation': routeByRelation
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
