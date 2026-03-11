/**
 * XiaoShuDong (小树洞) Conversation State
 * Extended state for fortune-telling chat role
 *
 * This state class manages the conversation state for the XiaoShuDong workflow,
 * including intent classification, natal chart data, RAG context, and responses.
 *
 * @author AFS Team
 * @version 1.0.0
 */

class XiaoShuDongState {
  /**
   * Create a new XiaoShuDong state
   * @param {Object} initialData - Initial state data
   * @param {string} initialData.userId - User ID
   * @param {string} initialData.userName - User name
   * @param {string} initialData.sessionId - Session ID
   * @param {Array} initialData.messages - Message history
   * @param {string} initialData.currentInput - Current user input
   * @param {Object} initialData.intent - Intent classification
   * @param {Object} initialData.natalChart - Natal chart data
   * @param {Object} initialData.horoscope - Horoscope data
   * @param {Array} initialData.ragContext - RAG retrieved context
   * @param {string} initialData.fortuneResponse - 8B model fortune response
   * @param {string} initialData.emotionalResponse - Emotional support response
   * @param {string} initialData.finalResponse - Final merged response
   * @param {Object} initialData.metadata - Additional metadata
   */
  constructor(initialData = {}) {
    // Handle null/undefined initialData
    const data = initialData || {};

    // Base fields
    this.userId = data.userId || '';
    this.userName = data.userName || '';
    this.sessionId = data.sessionId || '';
    this.messages = data.messages || [];
    this.currentInput = data.currentInput || '';
    this.generatedResponse = data.generatedResponse || '';

    // Two-Phase Tracking (Phase 1: Listening, Phase 2: Exploration)
    this.phase = data.phase || 'listening';  // 'listening' | 'exploration'
    this.emotionalTurns = data.emotionalTurns || 0;   // Count of pure emotional exchanges
    this.innerVoiceDetected = data.innerVoiceDetected || false;  // Set when user starts asking "why" or "how"

    // Intent classification
    this.intent = data.intent || {
      isEmotional: false,    // 情感倾诉 (emotional venting)
      needsAdvice: false,    // 需要建议 (needs advice)
      confidence: 0,
      advicePhrases: data.intent?.advicePhrases || [],  // Detected advice-seeking phrases
      directionPhrases: data.intent?.directionPhrases || []  // Detected direction-seeking phrases
    };

    // Natal chart data
    this.natalChart = data.natalChart ?? null;
    this.horoscope = data.horoscope ?? null;  // 流年/流月数据 (horoscope data)

    // RAG context (retrieved from ziwei knowledge base)
    this.ragContext = data.ragContext ?? [];

    // 8B model response (fortune analysis)
    this.fortuneResponse = data.fortuneResponse || '';

    // Emotional support response (psychological comfort)
    this.emotionalResponse = data.emotionalResponse || '';

    // Final merged response
    this.finalResponse = data.finalResponse || '';

    // Metadata
    this.metadata = {
      sessionId: data.sessionId || '',
      chartRetrieved: false,
      ragRetrieved: false,
      modelUsed: '',
      processingTime: 0,
      intentClassified: false,
      intentClassifiedAt: null,
      ...data.metadata
    };

    // Error tracking
    this.errors = data.errors || [];
  }

  /**
   * Update state with new values
   * @param {Object} updates - Object containing fields to update
   * @returns {XiaoShuDongState} This instance for chaining
   *
   * @example
   * state.setState({ currentInput: 'Hello', userId: 'user123' });
   */
  setState(updates) {
    Object.assign(this, updates);
    return this;
  }

  /**
   * Add a message to the conversation history
   * @param {string} role - Message role ('user', 'assistant', 'system')
   * @param {string} content - Message content
   * @param {Object} metadata - Optional metadata
   * @returns {XiaoShuDongState} This instance for chaining
   *
   * @example
   * state.addMessage('user', 'Hello', { timestamp: new Date() });
   */
  addMessage(role, content, metadata = {}) {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    return this;
  }

  /**
   * Add an error to the error list
   * @param {Error} error - Error object
   * @returns {XiaoShuDongState} This instance for chaining
   *
   * @example
   * try { ... } catch (err) { state.addError(err); }
   */
  addError(error) {
    this.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    return this;
  }

  /**
   * Check if user has complete birth info for chart calculation
   * @returns {boolean} True if natal chart is available
   *
   * @example
   * if (state.hasBirthInfo()) {
   *   // Proceed with fortune analysis
   * }
   */
  hasBirthInfo() {
    return this.natalChart != null;
  }

  /**
   * Check if RAG context was retrieved
   * @returns {boolean} True if RAG context is available
   */
  hasRagContext() {
    return Array.isArray(this.ragContext) && this.ragContext.length > 0;
  }

  /**
   * Check if fortune response was generated
   * @returns {boolean} True if fortune response is available
   */
  hasFortuneResponse() {
    return typeof this.fortuneResponse === 'string' && this.fortuneResponse.trim().length > 0;
  }

  /**
   * Check if emotional response was generated
   * @returns {boolean} True if emotional response is available
   */
  hasEmotionalResponse() {
    return typeof this.emotionalResponse === 'string' && this.emotionalResponse.trim().length > 0;
  }

  /**
   * Get intent summary for logging
   * @returns {string} Human-readable intent summary
   *
   * @example
   * logger.info(`Intent: ${state.getIntentSummary()}`);
   * // Output: "Intent: 情感倾诉 + 寻求建议"
   */
  getIntentSummary() {
    const intents = [];
    if (this.intent.isEmotional) intents.push('情感倾诉');
    if (this.intent.needsAdvice) intents.push('寻求建议');
    return intents.length > 0 ? intents.join(' + ') : '一般对话';
  }

  /**
   * Get state summary for debugging
   * @returns {Object} Summary of current state
   */
  getSummary() {
    return {
      userId: this.userId,
      sessionId: this.sessionId || this.metadata.sessionId,
      phase: this.getPhaseSummary(),
      intent: this.getIntentSummary(),
      hasChart: this.hasBirthInfo(),
      hasRagContext: this.hasRagContext(),
      hasFortuneResponse: this.hasFortuneResponse(),
      hasEmotionalResponse: this.hasEmotionalResponse(),
      messageCount: this.messages.length,
      emotionalTurns: this.emotionalTurns,
      innerVoiceDetected: this.innerVoiceDetected,
      errorCount: this.errors.length,
      processingTime: this.metadata.processingTime
    };
  }

  /**
   * Reset the state for a new conversation
   * @param {Object} newInitialData - New initial data for the fresh state
   * @returns {XiaoShuDongState} Fresh state instance
   */
  reset(newInitialData = {}) {
    const preservedFields = {
      userId: this.userId,
      userName: this.userName,
      sessionId: this.metadata.sessionId
    };
    return new XiaoShuDongState({ ...preservedFields, ...newInitialData });
  }

  /**
   * Check if should transition to exploration phase
   * @returns {boolean} True if ready for Phase 2 (Exploration)
   *
   * Phase Transition Conditions:
   * 1. User explicitly asks for advice (怎么办, 怎么做, etc.)
   * 2. Emotional turns threshold reached AND user starts reflecting
   * 3. User explicitly asks about future/direction
   */
  shouldTransitionToExploration() {
    const input = this.currentInput || '';

    // Condition 1: User explicitly asks for advice
    const advicePhrases = ['怎么办', '怎么做', '给我建议', '帮我看看', '有什么办法'];
    if (advicePhrases.some(p => input.includes(p))) {
      return true;
    }

    // Condition 2: Emotional turns threshold reached AND user starts reflecting
    if (this.emotionalTurns >= 3 && this.innerVoiceDetected) {
      return true;
    }

    // Condition 3: User explicitly asks about future/direction
    const directionPhrases = ['接下来', '未来', '方向', '怎么走'];
    if (directionPhrases.some(p => input.includes(p))) {
      return true;
    }

    return false;
  }

  /**
   * Transition to exploration phase
   * @returns {XiaoShuDongState} This instance for chaining
   */
  transitionToExploration() {
    this.phase = 'exploration';
    return this;
  }

  /**
   * Check if user is showing inner voice (reflection/curiosity)
   * @returns {boolean} True if inner voice detected
   */
  hasInnerVoice() {
    const input = this.currentInput || '';
    const innerVoicePhrases = ['为什么', '为啥', '怎么回事', '如何', '怎么', '为什么总是'];
    return innerVoicePhrases.some(p => input.includes(p));
  }

  /**
   * Check if user input is emotional (venting)
   * @returns {boolean} True if input is emotional
   */
  isEmotionalInput() {
    const input = this.currentInput || '';
    const emotionalPhrases = [
      '难过', '伤心', '痛苦', '郁闷', '烦躁', '焦虑', '害怕', '恐惧',
      '生气', '愤怒', '失望', '绝望', '委屈', '无助', '迷茫',
      '哭', '流泪', '痛苦', '累了', '不想', '受不了', '压力', '痛苦'
    ];
    return emotionalPhrases.some(p => input.includes(p));
  }

  /**
   * Increment emotional turns counter
   * @returns {XiaoShuDongState} This instance for chaining
   */
  incrementEmotionalTurns() {
    this.emotionalTurns += 1;
    return this;
  }

  /**
   * Check if currently in listening phase
   * @returns {boolean} True if in listening phase
   */
  isListening() {
    return this.phase === 'listening';
  }

  /**
   * Check if currently in exploration phase
   * @returns {boolean} True if in exploration phase
   */
  isExploring() {
    return this.phase === 'exploration';
  }

  /**
   * Get phase summary for logging
   * @returns {string} Human-readable phase summary
   */
  getPhaseSummary() {
    const phases = {
      'listening': 'Phase 1: Listening (倾听阶段)',
      'exploration': 'Phase 2: Exploration (探索方向)'
    };
    return phases[this.phase] || `Unknown phase: ${this.phase}`;
  }

  /**
   * Update metadata with birth info status
   * @param {boolean} hasBirthInfo - Whether user has birth info
   * @returns {XiaoShuDongState} This instance for chaining
   */
  updateBirthInfoStatus(hasBirthInfo) {
    this.metadata.hasBirthInfo = hasBirthInfo;
    return this;
  }

  /**
   * Convert state to a plain object (for serialization)
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      userId: this.userId,
      userName: this.userName,
      sessionId: this.sessionId,
      messages: this.messages,
      currentInput: this.currentInput,
      generatedResponse: this.generatedResponse,
      // Phase tracking
      phase: this.phase,
      emotionalTurns: this.emotionalTurns,
      innerVoiceDetected: this.innerVoiceDetected,
      // Intent
      intent: this.intent,
      // Natal chart
      natalChart: this.natalChart,
      horoscope: this.horoscope,
      ragContext: this.ragContext,
      fortuneResponse: this.fortuneResponse,
      emotionalResponse: this.emotionalResponse,
      finalResponse: this.finalResponse,
      metadata: this.metadata,
      errors: this.errors.map(e => ({
        message: e.message,
        timestamp: e.timestamp
        // Exclude stack trace from JSON
      }))
    };
  }

  /**
   * Create a state from JSON data
   * @param {Object} json - JSON object
   * @returns {XiaoShuDongState} New state instance
   */
  static fromJSON(json) {
    return new XiaoShuDongState(json);
  }
}

export default XiaoShuDongState;
