import { acquireLock } from '../utils/simpleFileLock.js';
import FileStorage from './fileStorage.js';
import Answer from '../models/Answer.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import AssistRelation from '../models/AssistRelation.js';
import ChatSession from '../models/ChatSession.js';

export default class SimpleSyncQueue {
  constructor(dualStorage) {
    this.dualStorage = dualStorage;
    this.fileStorage = new FileStorage();
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
    const user = await User.findById(id).lean();
    if (user) {
      await this.dualStorage.saveUserProfile(id, user);
      await this.dualStorage.saveRoleCard(id, user.companionChat?.roleCard);
      await this.dualStorage.saveSentiments(id, user.companionChat?.strangerSentiments);
      await this.dualStorage.saveConversations(id, user.companionChat?.conversationsAsTarget);
      await this.dualStorage.saveAssistantsGuidelines(id, user.companionChat?.assistantsGuidelines);
    }
  }

  async syncAnswer(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const answer = await Answer.findById(id).lean();
    if (answer) {
      await this.dualStorage.saveAnswer(id, answer);

      const question = await Question.findById(answer.questionId).lean();
      if (question) {
        await this.fileStorage.saveMemoryFile({
          ...answer,
          question: question.question,
          questionRole: question.role,
          questionOrder: question.order,
          helperId: null,
          helperNickname: null
        });
      }
    }
  }

  async syncAssistRelation(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const relation = await AssistRelation.findById(id).lean();
    if (relation) {
      await this.dualStorage.saveAssistRelation(id, relation);
    }
  }

  async syncChatSession(id, operation, data) {
    if (operation === 'delete') {
      return;
    }
    const session = await ChatSession.findById(id).lean();
    if (session) {
      await this.dualStorage.saveChatSession(id, session);
    }
  }
}
