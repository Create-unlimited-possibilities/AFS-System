/**
 * LangGraph Edge Definitions V2
 * Defines connections between nodes in the conversation flow
 *
 * @author AFS Team
 * @version 2.1.0
 */

export const edges = {
  // 1. Input processor -> Token monitor
  'input_processor': 'token_monitor',

  // 2. Token monitor -> Memory check (check if RAG retrieval needed)
  'token_monitor': 'memory_check',

  // 3. RAG retriever -> Context builder
  'rag_retriever': 'context_builder',

  // 4. Context builder -> Response generator
  'context_builder': 'response_generator',

  // 5. Response generator -> Token response
  'response_generator': 'token_response',

  // 6. Token response -> Output formatter (default path)
  'token_response': 'output_formatter'
};

export const conditionalEdges = {
  // Route based on whether memory retrieval is needed
  'memory_check': routeByMemoryCheck,

  // Route based on token threshold state (fatigue prompt, force offline)
  'token_response': routeByTokenState
};

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
