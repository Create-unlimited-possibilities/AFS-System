import Answer from '../../modules/qa/models/answer.js';
import FileStorage from './file.js';

export default class StorageService {
  constructor() {
    this.fileStorage = new FileStorage();
  }

  async saveAnswer(answerData) {
    const { userId, targetUserId, questionId, question, answer, layer, relationshipType, questionRole, questionOrder, helperId, helperNickname } = answerData;

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

      // 等待文件系统操作完成，并传播错误
      await this.syncToFileSystem({
        ...dbAnswer.toObject(),
        question,
        questionRole,
        questionOrder,
        helperId: helperId || null,
        helperNickname: helperNickname || null
      });

      return { success: true, answer: dbAnswer };
    } catch (err) {
      console.error('[StorageService] 保存失败:', err);
      return { success: false, error: err.message };
    }
  }

  async syncToFileSystem(answer) {
    try {
      await this.fileStorage.saveMemoryFile(answer);
      console.log('[StorageService] 文件同步成功:', answer.questionOrder);
    } catch (err) {
      console.error('[StorageService] 文件同步失败:', err);
      // 不再静默失败，将错误向上传播
      throw err;
    }
  }

  async loadMemories(userId) {
    try {
      const fileMemories = await this.fileStorage.loadUserMemories(userId);
      if (fileMemories && (fileMemories.A_set?.length > 0 || fileMemories.Bste?.length > 0 || fileMemories.Cste?.length > 0)) {
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
