// 双重存储系统 - 所有资料同时存储在MongoDB和本地文件系统
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export default class DualStorage {
  constructor() {
    // 检测是否在 Docker 容器内运行
    const isDocker = fs.existsSync('/.dockerenv') || 
                     process.env.DOCKER_CONTAINER === 'true' ||
                     process.env.NODE_ENV === 'docker';
    
    // Docker 环境使用 /app/storage/userdata（挂载卷路径）
    // 本地环境使用相对路径 server/storage/userdata
    if (isDocker) {
      this.basePath = '/app/storage/userdata';
    } else {
      this.basePath = path.join(projectRoot, 'server', 'storage', 'userdata');
    }
  }

  async initialize() {
    await fsPromises.mkdir(this.basePath, { recursive: true });
  }

  /**
   * 双重存储角色卡
   * @param {string} userId - 用户ID
   * @param {object} roleCard - 角色卡对象
   */
  async saveRoleCard(userId, roleCard) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'rolecard.json');

    try {
      await fsPromises.writeFile(filePath, JSON.stringify(roleCard, null, 2), 'utf-8');
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
      const data = await fsPromises.readFile(filePath, 'utf-8');
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
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'profile.json');

    try {
      await fsPromises.writeFile(filePath, JSON.stringify(userData, null, 2), 'utf-8');
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
      const data = await fsPromises.readFile(filePath, 'utf-8');
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
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'assist-relations.json');

    try {
      let relations = [];
      try {
        const data = await fsPromises.readFile(filePath, 'utf-8');
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

      await fsPromises.writeFile(filePath, JSON.stringify(relations, null, 2), 'utf-8');
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
      const data = await fsPromises.readFile(filePath, 'utf-8');
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
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'assistants-guidelines.json');

    try {
      const dataToSave = {
        userId,
        guidelines,
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      await fsPromises.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
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
      const data = await fsPromises.readFile(filePath, 'utf-8');
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
      const stats = fsPromises.stat(filePath);
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
      await fsPromises.rm(userPath, { recursive: true, force: true });
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
    await fsPromises.mkdir(userPath, { recursive: true });
    const filePath = path.join(userPath, 'strangerSentiments.json');
    try {
      await fsPromises.writeFile(filePath, JSON.stringify(sentiments, null, 2), 'utf-8');
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
    await fsPromises.mkdir(userPath, { recursive: true });
    const filePath = path.join(userPath, 'conversationsAsTarget.json');
    try {
      await fsPromises.writeFile(filePath, JSON.stringify(conversations, null, 2), 'utf-8');
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
    await fsPromises.mkdir(answerPath, { recursive: true });
    const filePath = path.join(answerPath, 'answer.json');
    try {
      await fsPromises.writeFile(filePath, JSON.stringify(answer, null, 2), 'utf-8');
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
    await fsPromises.mkdir(sessionPath, { recursive: true });
    const filePath = path.join(sessionPath, 'session.json');
    try {
      await fsPromises.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
      console.log(`[DualStorage] 会话已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 会话保存失败:`, error);
      throw error;
    }
  }

  async loadSentiments(userId) {
    const filePath = path.join(this.basePath, String(userId), 'strangerSentiments.json');
    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const sentiments = JSON.parse(data);
      console.log(`[DualStorage] 陌生人好感度已从文件系统加载: ${filePath}`);
      return sentiments;
    } catch (error) {
      console.warn(`[DualStorage] 陌生人好感度从文件系统加载失败: ${userId}:`, error.message);
      return null;
    }
  }

  async loadConversations(userId) {
    const filePath = path.join(this.basePath, String(userId), 'conversationsAsTarget.json');
    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const conversations = JSON.parse(data);
      console.log(`[DualStorage] 对话历史已从文件系统加载: ${filePath}`);
      return conversations;
    } catch (error) {
      console.warn(`[DualStorage] 对话历史从文件系统加载失败: ${userId}:`, error.message);
      return null;
    }
  }

  async loadAnswer(answerId) {
    const filePath = path.join(this.basePath, 'answers', String(answerId), 'answer.json');
    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const answer = JSON.parse(data);
      console.log(`[DualStorage] 答案已从文件系统加载: ${filePath}`);
      return answer;
    } catch (error) {
      console.warn(`[DualStorage] 答案从文件系统加载失败: ${answerId}:`, error.message);
      return null;
    }
  }

  async loadChatSession(sessionId) {
    const filePath = path.join(this.basePath, 'chatSessions', String(sessionId), 'session.json');
    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const session = JSON.parse(data);
      console.log(`[DualStorage] 会话已从文件系统加载: ${filePath}`);
      return session;
    } catch (error) {
      console.warn(`[DualStorage] 会话从文件系统加载失败: ${sessionId}:`, error.message);
      return null;
    }
  }

  /**
   * 保存 V2 角色卡
   */
  async saveRoleCardV2(userId, roleCardV2) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'rolecard-v2.json');

    try {
      await fsPromises.writeFile(filePath, JSON.stringify(roleCardV2, null, 2), 'utf-8');
      console.log(`[DualStorage] V2角色卡已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] V2角色卡保存失败:`, error);
      throw error;
    }
  }

  /**
   * 加载 V2 角色卡
   */
  async loadRoleCardV2(userId) {
    const filePath = path.join(this.basePath, String(userId), 'rolecard-v2.json');

    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const roleCard = JSON.parse(data);
      console.log(`[DualStorage] V2角色卡已加载: ${filePath}`);

      // 合并单独的关系层文件
      const individualLayers = await this.loadAllRelationLayers(userId);
      if (Object.keys(individualLayers).length > 0) {
        // 确保 relationLayers 对象存在
        if (!roleCard.relationLayers) {
          roleCard.relationLayers = {};
        }
        // 合并单独的关系层（单独文件优先，因为它们是最新生成的）
        roleCard.relationLayers = { ...roleCard.relationLayers, ...individualLayers };
        console.log(`[DualStorage] 已合并 ${Object.keys(individualLayers).length} 个关系层到角色卡`);
      }

      return roleCard;
    } catch (error) {
      console.warn(`[DualStorage] V2角色卡加载失败 ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * 保存关系层
   */
  async saveRelationLayer(userId, relationId, relationLayer) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId), 'relation-layers');
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, `${relationId}.json`);

    try {
      await fsPromises.writeFile(filePath, JSON.stringify(relationLayer, null, 2), 'utf-8');
      console.log(`[DualStorage] 关系层已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 关系层保存失败:`, error);
      throw error;
    }
  }

  /**
   * 加载所有关系层
   */
  async loadAllRelationLayers(userId) {
    const dirPath = path.join(this.basePath, String(userId), 'relation-layers');

    try {
      const files = await fsPromises.readdir(dirPath);
      const layers = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(dirPath, file);
          const data = await fsPromises.readFile(filePath, 'utf-8');
          const layer = JSON.parse(data);
          layers[layer.relationId || file.replace('.json', '')] = layer;
        }
      }

      console.log(`[DualStorage] 已加载 ${Object.keys(layers).length} 个关系层`);
      return layers;
    } catch (error) {
      console.warn(`[DualStorage] 关系层加载失败 ${userId}:`, error.message);
      return {};
    }
  }

  /**
   * 保存核心层 V2
   */
  async saveCoreLayer(userId, coreLayer) {
    await this.initialize();

    const userPath = path.join(this.basePath, String(userId));
    await fsPromises.mkdir(userPath, { recursive: true });

    const filePath = path.join(userPath, 'core-layer.json');

    try {
      await fsPromises.writeFile(filePath, JSON.stringify(coreLayer, null, 2), 'utf-8');
      console.log(`[DualStorage] 核心层已保存: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error(`[DualStorage] 核心层保存失败:`, error);
      throw error;
    }
  }

  /**
   * 加载核心层 V2
   */
  async loadCoreLayer(userId) {
    const filePath = path.join(this.basePath, String(userId), 'core-layer.json');

    try {
      const data = await fsPromises.readFile(filePath, 'utf-8');
      const coreLayer = JSON.parse(data);
      console.log(`[DualStorage] 核心层已加载: ${filePath}`);
      return coreLayer;
    } catch (error) {
      console.warn(`[DualStorage] 核心层加载失败 ${userId}:`, error.message);
      return null;
    }
  }
}
