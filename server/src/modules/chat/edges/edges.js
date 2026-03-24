/**
 * LangGraph Edge Definitions V3
 * AI角色卡对话升级 - 支持倾诉模式与命理分析
 *
 * 新增流程:
 * - 意图分类: 普通聊天 / 倾诉模式
 * - 倾听阶段: 继续倾听 / 进入分析
 * - 分析阶段: 命盘检索 -> 命理生成 -> 角色转换
 *
 * @author AFS Team
 * @version 3.0.0
 */

export const edges = {
  // ==================== 通用入口 ====================
  // 1. 意图分类 -> Token 监控
  'intent_classifier': 'token_monitor',

  // ==================== 普通聊天分支 ====================
  // Token monitor 的路由由 conditionalEdges.routeByIntent 处理
  // 这里设置默认路由到 memory_check（普通聊天）
  'token_monitor': 'memory_check',

  // Memory check -> RAG retriever (涉及记忆时)
  'rag_retriever': 'context_builder',

  // Context builder -> Response generator
  'context_builder': 'response_generator',

  // Response generator -> Token response
  'response_generator': 'token_response',

  // ==================== 倾诉-倾听分支 ====================
  // Listening phase -> 继续倾听或进入分析 (条件路由)

  // 分析阶段
  'chart_rag_retriever': 'fortune_generator',
  'fortune_generator': 'role_translator',
  'role_translator': 'output_formatter',

  // ==================== 输出 ====================
  // Token response -> Output formatter
  'token_response': 'output_formatter'
};

export const conditionalEdges = {
  // 根据意图分类路由 (倾诉/聊天)
  'token_monitor': routeByIntent,

  // 普通聊天: 根据是否需要记忆检索路由
  'memory_check': routeByMemoryCheck,

  // 倾听阶段: 根据是否准备好分析路由
  'listening_phase': routeByListeningPhase,

  // Token 阈值状态路由
  'token_response': routeByTokenState
};

/**
 * 根据意图分类路由
 * @param {Object} state - Current conversation state
 * @returns {string} Next node name
 */
export function routeByIntent(state) {
  const intent = state.metadata?.intent;

  // 如果检测到结束意图
  if (state.metadata?.endIntent) {
    return 'token_response';
  }

  // 算命预测分支 - 检查开关是否启用
  if (intent === 'fortune_telling') {
    const fortuneEnabled = state.metadata?.fortuneTellingEnabled ?? true;
    if (fortuneEnabled) {
      // 直接进入命盘检索，无需倾听阶段
      return 'chart_rag_retriever';
    }
    // 如果禁用，回退到普通聊天
    return 'memory_check';
  }

  // 倾诉模式 -> 进入倾听阶段
  if (intent === 'venting') {
    return 'listening_phase';
  }

  // 普通聊天 -> 进入记忆检查
  return 'memory_check';
}

/**
 * 根据倾听阶段状态路由
 * @param {Object} state - Current conversation state
 * @returns {string} Next node name
 */
export function routeByListeningPhase(state) {
  // 如果准备好分析，进入分析阶段
  if (state.metadata?.readyForAnalysis === true) {
    return 'chart_rag_retriever';
  }

  // 继续倾听，直接输出
  return 'output_formatter';
}

/**
 * Route based on message content to determine if RAG retrieval is needed
 * @param {Object} state - Current conversation state
 * @returns {string} Next node name
 */
export function routeByMemoryCheck(state) {
  // If message involves memory, retrieve from RAG
  if (state.metadata?.involvesMemory) {
    return 'rag_retriever';
  }

  // Otherwise, build context directly
  return 'context_builder';
}

/**
 * Route based on token threshold state after token response
 * @param {Object} state - Current conversation state
 * @returns {string} Next node name
 */
export function routeByTokenState(state) {
  const { metadata } = state;

  // Force offline (70% threshold) - end conversation, trigger memory save
  if (metadata?.forceOffline) {
    // The orchestrator handles memory save and indexing
    // Route to output_formatter to return the closing message
    return 'output_formatter';
  }

  // Fatigue prompt (60% threshold) - continue but show dialog
  if (metadata?.showFatiguePrompt) {
    // Frontend handles dialog, continue to output
    return 'output_formatter';
  }

  // Normal flow - continue to output formatter
  return 'output_formatter';
}
