/**
 * Conversation State Class
 * Used for LangGraph conversation flow management
 *
 * @author AFS Team
 * @version 3.0.0 - Added venting mode support
 */

class ConversationState {
  constructor(initialData = {}) {
    this.userId = initialData.userId || '';
    this.userName = initialData.userName || '';

    this.interlocutor = initialData.interlocutor || {
      id: '',
      relationType: 'stranger',
      specificId: '',
      nickname: '',
      sentimentScore: 50
    };

    this.messages = initialData.messages || [];

    this.retrievedMemories = initialData.retrievedMemories || [];

    this.roleCard = initialData.roleCard || {
      personality: '',
      background: '',
      interests: [],
      communicationStyle: ''
    };

    this.systemPrompt = initialData.systemPrompt || '';

    this.currentInput = initialData.currentInput || '';
    this.generatedResponse = initialData.generatedResponse || '';

    // ==================== Venting Mode Fields (v3.0) ====================
    // Conversation mode: 'chat' | 'venting' | 'analysis'
    this.conversationMode = initialData.conversationMode || 'chat';

    // Listening phase state
    this.listeningPhase = initialData.listeningPhase || {
      turnCount: 0,
      emotionalIntensity: 'low',  // 'low' | 'medium' | 'high'
      coreConcern: '',
      emotionalState: '',
      informationGathered: {},
      readyForAnalysis: false
    };

    // Fortune analysis phase state
    this.fortunePhase = initialData.fortunePhase || {
      chartRetrieved: false,
      ragRetrieved: false,
      fortuneGenerated: false,
      internalAnalysis: ''
    };

    // Conversation assessment from listening phase
    this.conversationAssessment = initialData.conversationAssessment || {
      readyForAnalysis: false,
      confidence: 0,
      coreConcern: '',
      emotionalState: ''
    };

    // Intent classification result
    this.intentClassification = initialData.intentClassification || null;

    // Listening response (direct output in listening mode)
    this.listeningResponse = initialData.listeningResponse || '';
    this.listeningAssessment = initialData.listeningAssessment || null;

    // Fortune analysis data
    this.natalChart = initialData.natalChart || null;
    this.horoscope = initialData.horoscope || null;
    this.ragContext = initialData.ragContext || '';
    this.formattedChartText = initialData.formattedChartText || '';
    this.relevantPalaces = initialData.relevantPalaces || [];
    this.fortuneResponse = initialData.fortuneResponse || '';
    this.translatedResponse = initialData.translatedResponse || '';

    // Role translator config
    this.hideFortuneTerms = initialData.hideFortuneTerms !== undefined
      ? initialData.hideFortuneTerms
      : true;
    // ==================== End Venting Mode Fields ====================

    // Initialize metadata with token-based prompt fields
    this.metadata = {
      // Session status: 'active', 'fatigue_prompt', 'indexing'
      sessionStatus: 'active',
      // Fatigue prompt flags (60% threshold)
      showFatiguePrompt: false,
      fatiguePromptType: null,  // 'soft'
      userChoseToContinue: false,
      usagePercent: 0,
      // Force offline flags (70% threshold)
      forceOffline: false,
      forceEnd: false,
      shouldEndSession: false,
      needMemoryUpdate: false,
      terminationReason: null,
      // Token info
      tokenInfo: null,
      // Venting mode metadata
      intent: null,              // 'chatting' | 'venting'
      endIntent: false,
      emotionalIntensity: 'low',
      readyForAnalysis: false,
      // Other metadata
      ...initialData.metadata
    };

    this.errors = initialData.errors || [];

    // Pending messages for indexing period (stored as unread)
    this.pendingMessages = initialData.pendingMessages || [];
  }

  setState(updates) {
    Object.assign(this, updates);
    return this;
  }

  getState() {
    return {
      userId: this.userId,
      userName: this.userName,
      interlocutor: this.interlocutor,
      messages: this.messages,
      retrievedMemories: this.retrievedMemories,
      roleCard: this.roleCard,
      systemPrompt: this.systemPrompt,
      currentInput: this.currentInput,
      generatedResponse: this.generatedResponse,
      // Venting mode state
      conversationMode: this.conversationMode,
      listeningPhase: this.listeningPhase,
      fortunePhase: this.fortunePhase,
      conversationAssessment: this.conversationAssessment,
      intentClassification: this.intentClassification,
      listeningResponse: this.listeningResponse,
      listeningAssessment: this.listeningAssessment,
      natalChart: this.natalChart,
      horoscope: this.horoscope,
      ragContext: this.ragContext,
      formattedChartText: this.formattedChartText,
      relevantPalaces: this.relevantPalaces,
      fortuneResponse: this.fortuneResponse,
      translatedResponse: this.translatedResponse,
      hideFortuneTerms: this.hideFortuneTerms,
      // End venting mode state
      metadata: this.metadata,
      errors: this.errors,
      pendingMessages: this.pendingMessages
    };
  }

  addError(error) {
    this.errors.push({
      message: error.message,
      timestamp: new Date(),
      stack: error.stack
    });
    return this;
  }

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
   * Add a pending message (stored as unread during indexing)
   * @param {string} role - Message role
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {ConversationState}
   */
  addPendingMessage(role, content, metadata = {}) {
    this.pendingMessages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    return this;
  }

  /**
   * Check if session is in indexing state
   * @returns {boolean}
   */
  isIndexing() {
    return this.metadata.sessionStatus === 'indexing';
  }

  /**
   * Check if fatigue prompt should be shown
   * @returns {boolean}
   */
  shouldShowFatiguePrompt() {
    return this.metadata.showFatiguePrompt === true && !this.metadata.userChoseToContinue;
  }
}

export default ConversationState;
