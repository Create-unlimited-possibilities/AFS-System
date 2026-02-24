/**
 * Conversation State Class
 * Used for LangGraph conversation flow management
 *
 * @author AFS Team
 * @version 2.1.0
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
