import { acquireLock } from '../utils/simpleFileLock.js';

export default class SimpleSyncQueue {
  constructor(dualStorage) {
    this.dualStorage = dualStorage;
    this.pending = new Set();
    this.timer = null;
    this.buffer = new Map();
  }

  enqueue(collection, id, operation, data = null) {
    const key = `${collection}:${id}`;
    this.pending.add(key);
    this.buffer.set(key, { collection, id, operation, data });
    
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 100);
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    const operations = Array.from(this.buffer.values());
    
    for (const op of operations) {
      try {
        await this.executeOperation(op);
      } catch (err) {
        console.error(`Sync failed for ${op.collection}:${op.id}`, err.message);
      }
    }
    
    this.buffer.clear();
    this.pending.clear();
  }

  async executeOperation({ collection, id, operation, data }) {
    const release = await acquireLock(`sync-operation-${collection}`);
    
    try {
      switch (collection) {
        case 'User':
          await this.syncUser(id, operation, data);
          break;
        case 'Answer':
          await this.syncAnswer(id, operation, data);
          break;
        case 'AssistRelation':
          await this.syncAssistRelation(id, operation, data);
          break;
        case 'ChatSession':
          await this.syncChatSession(id, operation, data);
          break;
        default:
          console.warn(`Unknown collection: ${collection}`);
      }
    } finally {
      await release();
    }
  }

  async syncUser(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const User = await import('../models/User.js');
    const user = await User.default.findById(id).lean();
    if (user) {
      await this.dualStorage.saveUserProfile(id, user.profile);
      await this.dualStorage.saveRoleCard(id, user.roleCard);
      await this.dualStorage.saveSentiments(id, user.strangerSentiments);
      await this.dualStorage.saveConversations(id, user.conversationsAsTarget);
      await this.dualStorage.saveAssistantsGuidelines(id, user.assistantsGuidelines);
    }
  }

  async syncAnswer(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const Answer = await import('../models/Answer.js');
    const answer = await Answer.default.findById(id).lean();
    if (answer) {
      await this.dualStorage.saveAnswer(id, answer);
    }
  }

  async syncAssistRelation(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const AssistRelation = await import('../models/AssistRelation.js');
    const relation = await AssistRelation.default.findById(id).lean();
    if (relation) {
      await this.dualStorage.saveAssistRelation(id, relation);
    }
  }

  async syncChatSession(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const ChatSession = await import('../models/ChatSession.js');
    const session = await ChatSession.default.findById(id).lean();
    if (session) {
      await this.dualStorage.saveChatSession(id, session);
    }
  }
}
