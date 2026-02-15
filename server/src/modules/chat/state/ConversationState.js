/**
 * 对话状态类
 * 用于LangGraph的对话流程管理
 * 
 * @author AFS Team
 * @version 1.0.0
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
    this.roleCardMode = initialData.roleCardMode || 'dynamic';
    
    this.currentInput = initialData.currentInput || '';
    this.generatedResponse = initialData.generatedResponse || '';
    
    this.metadata = initialData.metadata || {};
    this.errors = initialData.errors || [];
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
      roleCardMode: this.roleCardMode,
      currentInput: this.currentInput,
      generatedResponse: this.generatedResponse,
      metadata: this.metadata,
      errors: this.errors
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
}

export default ConversationState;
