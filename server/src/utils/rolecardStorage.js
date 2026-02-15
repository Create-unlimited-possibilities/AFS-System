/**
 * 角色卡存储管理器
 * 管理方法B生成的角色卡文件（仅本地文件系统，不同步到MongoDB）
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import fs from 'fs-extra';
import path from 'path';
import logger from './logger.js';

const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER_CONTAINER === 'true';
const ROLECARDS_DIR = isDocker
  ? path.join('/app', 'storage', 'rolecards')
  : path.join(process.cwd(), 'server', 'storage', 'rolecards');

/**
 * 角色卡存储类
 */
class RolecardStorage {
  constructor() {
    this.rolecardsDir = ROLECARDS_DIR;
  }

  /**
   * 保存角色卡（方法B）
   * @param {string} userId - 用户ID
   * @param {string} systemPrompt - 完整的system prompt（markdown格式）
   * @param {Object} metadata - 元数据
   * @returns {Promise<Object>} 保存结果
   */
  async saveRolecard(userId, systemPrompt, metadata = {}) {
    try {
      const userDir = path.join(this.rolecardsDir, userId);
      await fs.ensureDir(userDir);

      const currentVersion = await this.getCurrentVersion(userId);
      const nextVersion = currentVersion + 1;

      const filename = `rolecard_v${nextVersion}.json`;
      const filepath = path.join(userDir, filename);

      const rolecardData = {
        version: nextVersion,
        userId,
        generatedAt: new Date().toISOString(),
        systemPrompt,
        metadata
      };

      await fs.writeJson(filepath, rolecardData, { spaces: 2 });

      await this.updateLatestLink(userId, filepath);

      logger.info(`[RolecardStorage] 角色卡保存成功 - User: ${userId}, Version: ${nextVersion}`);

      return {
        version: nextVersion,
        filepath,
        latest: path.join(userDir, 'rolecard_latest.json')
      };
    } catch (error) {
      logger.error('[RolecardStorage] 保存角色卡失败:', error);
      throw error;
    }
  }

  /**
   * 获取最新角色卡
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 角色卡数据
   */
  async getLatestRolecard(userId) {
    try {
      const latestPath = path.join(this.rolecardsDir, userId, 'rolecard_latest.json');

      if (!(await fs.pathExists(latestPath))) {
        logger.warn(`[RolecardStorage] 角色卡不存在 - User: ${userId}`);
        return null;
      }

      const rolecard = await fs.readJson(latestPath);
      logger.info(`[RolecardStorage] 加载最新角色卡成功 - User: ${userId}, Version: ${rolecard.version}`);
      
      return rolecard;
    } catch (error) {
      logger.error('[RolecardStorage] 获取最新角色卡失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定版本的角色卡
   * @param {string} userId - 用户ID
   * @param {number} version - 版本号
   * @returns {Promise<Object|null>} 角色卡数据
   */
  async getRolecardByVersion(userId, version) {
    try {
      const filepath = path.join(this.rolecardsDir, userId, `rolecard_v${version}.json`);

      if (!(await fs.pathExists(filepath))) {
        logger.warn(`[RolecardStorage] 角色卡版本不存在 - User: ${userId}, Version: ${version}`);
        return null;
      }

      return await fs.readJson(filepath);
    } catch (error) {
      logger.error('[RolecardStorage] 获取指定版本角色卡失败:', error);
      throw error;
    }
  }

  /**
   * 列出所有版本
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 版本列表
   */
  async listVersions(userId) {
    try {
      const userDir = path.join(this.rolecardsDir, userId);

      if (!(await fs.pathExists(userDir))) {
        return [];
      }

      const files = await fs.readdir(userDir);
      const versionFiles = files
        .filter(f => f.match(/^rolecard_v\d+\.json$/))
        .map(f => {
          const match = f.match(/rolecard_v(\d+)\.json$/);
          return {
            version: parseInt(match[1]),
            filename: f
          };
        })
        .sort((a, b) => b.version - a.version);

      return versionFiles;
    } catch (error) {
      logger.error('[RolecardStorage] 列出版本失败:', error);
      throw error;
    }
  }

  /**
   * 获取当前版本号
   * @param {string} userId - 用户ID
   * @returns {Promise<number>} 当前版本号
   */
  async getCurrentVersion(userId) {
    const versions = await this.listVersions(userId);
    return versions.length > 0 ? versions[0].version : 0;
  }

  /**
   * 更新latest副本
   * @param {string} userId - 用户ID
   * @param {string} sourcePath - 源文件路径
   */
  async updateLatestLink(userId, sourcePath) {
    try {
      const userDir = path.join(this.rolecardsDir, userId);
      const latestPath = path.join(userDir, 'rolecard_latest.json');

      await fs.copy(sourcePath, latestPath, { overwrite: true });
      
      logger.debug(`[RolecardStorage] 更新latest副本成功 - User: ${userId}`);
    } catch (error) {
      logger.error('[RolecardStorage] 更新latest副本失败:', error);
      throw error;
    }
  }
}

export default RolecardStorage;
