// 双重存储系统 - 所有资料同时存储在MongoDB和本地文件系统
import fs from 'fs/promises';
import path from 'path';

export default class DualStorage {
  constructor() {
    this.basePath = '/app/storage/userdata';
  }

  async initialize() {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * 双重存储角色卡
   * @param {string} userId - 用户ID
   * @param {object} roleCard - 角色卡对象
   */
  async saveRoleCard(userId, roleCard) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'rolecard.json');

    try {
      await fs.writeFile(filePath, JSON.stringify(roleCard, null, 2), 'utf-8');
      console.log(`[DualStorage] 角色卡已保存到文件系统: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 角色卡保存到文件系统失败:`, error);
      throw error;
    }
  }

  /**
   * 从文件系统加载角色卡
   * @param {string} userId - 用户ID
   */
  async loadRoleCard(userId) {
    const filePath = path.join(this.basePath, String(userId), 'rolecard.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const roleCard = JSON.parse(data);
      console.log(`[DualStorage] 角色卡已从文件系统加载: ${filePath}`);
      return roleCard;
    } catch (error) {
      console.warn(`[DualStorage] 角色卡从文件系统加载失败: ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * 双重存储用户资料
   * @param {string} userId - 用户ID
   * @param {object} userData - 用户资料对象
   */
  async saveUserProfile(userId, userData) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'profile.json');

    try {
      await fs.writeFile(filePath, JSON.stringify(userData, null, 2), 'utf-8');
      console.log(`[DualStorage] 用户资料已保存到文件系统: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 用户资料保存到文件系统失败:`, error);
      throw error;
    }
  }

  /**
   * 从文件系统加载用户资料
   * @param {string} userId - 用户ID
   */
  async loadUserProfile(userId) {
    const filePath = path.join(this.basePath, String(userId), 'profile.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const profile = JSON.parse(data);
      console.log(`[DualStorage] 用户资料已从文件系统加载: ${filePath}`);
      return profile;
    } catch (error) {
      console.warn(`[DualStorage] 用户资料从文件系统加载失败: ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * 双重存储协助关系
   * @param {string} userId - 用户ID
   * @param {object} relation - 关系对象
   */
  async saveAssistRelation(userId, relation) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'assist-relations.json');

    try {
      let relations = [];
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        relations = JSON.parse(data);
      } catch (err) {
        // 文件不存在，创建新数组
      }

      // 检查是否已存在
      const existingIndex = relations.findIndex(r => r.relationId === relation.relationId);

      if (existingIndex >= 0) {
        relations[existingIndex] = { ...relations[existingIndex], ...relation, updatedAt: new Date().toISOString() };
      } else {
        relations.push({ ...relation, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }

      await fs.writeFile(filePath, JSON.stringify(relations, null, 2), 'utf-8');
      console.log(`[DualStorage] 协助关系已保存到文件系统: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 协助关系保存到文件系统失败:`, error);
      throw error;
    }
  }

  /**
   * 从文件系统加载协助关系
   * @param {string} userId - 用户ID
   */
  async loadAssistRelations(userId) {
    const filePath = path.join(this.basePath, String(userId), 'assist-relations.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const relations = JSON.parse(data);
      console.log(`[DualStorage] 协助关系已从文件系统加载: ${filePath}`);
      return relations;
    } catch (error) {
      console.warn(`[DualStorage] 协助关系从文件系统加载失败: ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * 双重存储协助者对话准则
   * @param {string} userId - 用户ID
   * @param {Array} guidelines - 协助者对话准则数组
   */
  async saveAssistantsGuidelines(userId, guidelines) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'assistants-guidelines.json');

    try {
      const dataToSave = {
        userId,
        guidelines,
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      console.log(`[DualStorage] 协助者对话准则已保存到文件系统: ${filePath}`);
      return { success: true, filePath, count: guidelines.length };
    } catch (error) {
      console.error(`[DualStorage] 协助者对话准则保存到文件系统失败:`, error);
      throw error;
    }
  }

  /**
   * 从文件系统加载协助者对话准则
   * @param {string} userId - 用户ID
   */
  async loadAssistantsGuidelines(userId) {
    const filePath = path.join(this.basePath, String(userId), 'assistants-guidelines.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`[DualStorage] 协助者对话准则已从文件系统加载: ${filePath}`);
      return parsed.guidelines || [];
    } catch (error) {
      console.warn(`[DualStorage] 协助者对话准则从文件系统加载失败: ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * 更新单个协助者的对话准则（增量更新）
   * @param {string} userId - 用户ID
   * @param {string} assistantId - 协助者ID
   * @param {Object} guideline - 协助者对话准则
   */
  async updateOneAssistantGuideline(userId, assistantId, guideline) {
    await this.initialize();

    try {
      // 先加载现有的准则
      const existingGuidelines = await this.loadAssistantsGuidelines(userId);
      
      // 查找并更新或添加新的准则
      const index = existingGuidelines.findIndex(g => g.assistantId === assistantId);
      
      if (index >= 0) {
        existingGuidelines[index] = {
          ...existingGuidelines[index],
          ...guideline,
          updatedAt: new Date().toISOString()
        };
      } else {
        existingGuidelines.push({
          ...guideline,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      // 保存更新后的准则
      return await this.saveAssistantsGuidelines(userId, existingGuidelines);
    } catch (error) {
      console.error(`[DualStorage] 更新协助者对话准则失败:`, error);
      throw error;
    }
  }

  /**
   * 删除指定协助者的对话准则
   * @param {string} userId - 用户ID
   * @param {string} assistantId - 协助者ID
   */
  async removeAssistantGuideline(userId, assistantId) {
    await this.initialize();

    try {
      const existingGuidelines = await this.loadAssistantsGuidelines(userId);
      const filteredGuidelines = existingGuidelines.filter(g => g.assistantId !== assistantId);
      
      return await this.saveAssistantsGuidelines(userId, filteredGuidelines);
    } catch (error) {
      console.error(`[DualStorage] 删除协助者对话准则失败:`, error);
      throw error;
    }
  }

  /**
   * 获取协助者对话准则统计信息
   * @param {string} userId - 用户ID
   */
  getAssistantsGuidelinesStats(userId) {
    const filePath = path.join(this.basePath, String(userId), 'assistants-guidelines.json');

    try {
      const stats = fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        filePath
      };
    } catch (error) {
      return {
        exists: false,
        filePath
      };
    }
  }

  /**
   * 删除用户的所有文件系统数据
   * @param {string} userId - 用户ID
   */
  async deleteUserFiles(userId) {
    const userPath = path.join(this.basePath, String(userId));

    try {
      await fs.rm(userPath, { recursive: true, force: true });
      console.log(`[DualStorage] 用户文件系统数据已删除: ${userPath}`);
      return { success: true };
    } catch (error) {
      console.error(`[DualStorage] 用户文件系统数据删除失败:`, error);
      throw error;
    }
  }

  /**
   * 备份用户数据（导出为压缩文件）
   * @param {string} userId - 用户ID
   * @param {string} backupPath - 备份路径
   */
  async backupUserData(userId, backupPath) {
    // 这是一个预留方法，后续可以实现数据备份功能
    throw new Error('备份功能尚未实现');
  }

  async saveSentiments(userId, sentiments) {
    await this.initialize();
    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });
    const filePath = path.join(userPath, 'strangerSentiments.json');
    try {
      await fs.writeFile(filePath, JSON.stringify(sentiments, null, 2), 'utf-8');
      console.log(`[DualStorage] 陌生人好感度已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 陌生人好感度保存失败:`, error);
      throw error;
    }
  }

  async saveConversations(userId, conversations) {
    await this.initialize();
    const userPath = path.join(this.basePath, String(userId));
    await fs.mkdir(userPath, { recursive: true });
    const filePath = path.join(userPath, 'conversationsAsTarget.json');
    try {
      await fs.writeFile(filePath, JSON.stringify(conversations, null, 2), 'utf-8');
      console.log(`[DualStorage] 对话历史已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 对话历史保存失败:`, error);
      throw error;
    }
  }

  async saveAnswer(answerId, answer) {
    await this.initialize();
    const answerPath = path.join(this.basePath, 'answers', String(answerId));
    await fs.mkdir(answerPath, { recursive: true });
    const filePath = path.join(answerPath, 'answer.json');
    try {
      await fs.writeFile(filePath, JSON.stringify(answer, null, 2), 'utf-8');
      console.log(`[DualStorage] 答案已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 答案保存失败:`, error);
      throw error;
    }
  }

  async saveChatSession(sessionId, session) {
    await this.initialize();
    const sessionPath = path.join(this.basePath, 'chatSessions', String(sessionId));
    await fs.mkdir(sessionPath, { recursive: true });
    const filePath = path.join(sessionPath, 'session.json');
    try {
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
      console.log(`[DualStorage] 会话已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 会话保存失败:`, error);
      throw error;
    }
  }
}
