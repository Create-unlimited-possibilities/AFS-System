import Answer from '../models/Answer.js';
import FileStorage from './fileStorage.js';

export default class StorageService {
  constructor() {
    this.fileStorage = new FileStorage();
  }

  async saveAnswer(answerData) {
    const { userId, targetUserId, questionId, question, answer, layer, relationshipType, helper } = answerData;

    try {
      const dbAnswer = await Answer.findOneAndUpdate(
        { userId, targetUserId, questionId },
        {
          question,
          answer,
          questionLayer: layer,
          relationshipType,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      this.syncToFileSystem({ ...dbAnswer.toObject(), question }).catch(err => {
        console.error('[StorageService] 文件同步失败:', err);
      });

      return { success: true, answer: dbAnswer };
    } catch (err) {
      console.error('[StorageService] 保存失败:', err);
      return { success: false, error: err.message };
    }
  }

  async syncToFileSystem(answer) {
    await this.fileStorage.saveMemoryFile(answer);
  }

  async loadMemories(userId) {
    try {
      const fileMemories = await this.fileStorage.loadUserMemories(userId);
      if (fileMemories && fileMemories.length > 0) {
        return fileMemories;
      }

      const dbMemories = await Answer.find({ targetUserId: userId }).lean();
      return dbMemories;
    } catch (err) {
      console.error('[StorageService] 加载失败:', err);
      return [];
    }
  }
}
