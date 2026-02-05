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
}
