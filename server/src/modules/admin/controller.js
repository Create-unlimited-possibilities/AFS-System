/**
 * Admin Controller
 * Handles admin API requests
 *
 * @author AFS Team
 * @version 1.0.0
 */

import adminService from './service.js';
import envService from './services/envService.js';
import logger from '../../core/utils/logger.js';

class AdminController {
  /**
   * User Management
   */
  async getUsers(req, res) {
    try {
      const { page, limit, search, role, isActive } = req.query;
      const result = await adminService.getUsers({ page, limit, search, role, isActive });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getUsers error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.getUserById(id);

      res.json({
        success: true,
        user
      });
    } catch (error) {
      logger.error('[AdminController] getUserById error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const adminId = req.user.id;

      const user = await adminService.updateUser(id, updateData, adminId);

      res.json({
        success: true,
        user
      });
    } catch (error) {
      logger.error('[AdminController] updateUser error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reset user password (admin action)
   */
  async resetUserPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const adminId = req.user.id;

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          error: '请输入新密码'
        });
      }

      const result = await adminService.resetUserPassword(id, newPassword, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] resetUserPassword error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const result = await adminService.deleteUser(id, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteUser error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Questionnaire Management
   */
  async getQuestions(req, res) {
    try {
      const { role, layer, active } = req.query;
      const questions = await adminService.getQuestions({ role, layer, active });

      res.json({
        success: true,
        questions
      });
    } catch (error) {
      logger.error('[AdminController] getQuestions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getQuestionById(req, res) {
    try {
      const { id } = req.params;
      const question = await adminService.getQuestionById(id);

      res.json({
        success: true,
        question
      });
    } catch (error) {
      logger.error('[AdminController] getQuestionById error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async createQuestion(req, res) {
    try {
      const questionData = req.body;
      const adminId = req.user.id;
      const question = await adminService.createQuestion(questionData, adminId);

      res.json({
        success: true,
        question
      });
    } catch (error) {
      logger.error('[AdminController] createQuestion error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateQuestion(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const adminId = req.user.id;

      const question = await adminService.updateQuestion(id, updateData, adminId);

      res.json({
        success: true,
        question
      });
    } catch (error) {
      logger.error('[AdminController] updateQuestion error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteQuestion(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const result = await adminService.deleteQuestion(id, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteQuestion error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async reorderQuestion(req, res) {
    try {
      const { id } = req.params;
      const { newOrder } = req.body;
      const adminId = req.user.id;

      const question = await adminService.reorderQuestion(id, newOrder, adminId);

      res.json({
        success: true,
        question
      });
    } catch (error) {
      logger.error('[AdminController] reorderQuestion error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async toggleQuestionStatus(req, res) {
    try {
      const { id } = req.params;
      const { active } = req.body;
      const adminId = req.user.id;

      const question = await adminService.toggleQuestionStatus(id, active, adminId);

      res.json({
        success: true,
        question
      });
    } catch (error) {
      logger.error('[AdminController] toggleQuestionStatus error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchImportQuestions(req, res) {
    try {
      const { questions } = req.body;
      const adminId = req.user.id;

      const result = await adminService.batchImportQuestions(questions, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] batchImportQuestions error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportQuestions(req, res) {
    try {
      const { role, layer } = req.query;

      const questions = await adminService.exportQuestions({ role, layer });

      res.json({
        success: true,
        questions
      });
    } catch (error) {
      logger.error('[AdminController] exportQuestions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Memory Management
   */
  async getUserMemorySummaries(req, res) {
    try {
      const { page, limit, search } = req.query;
      const result = await adminService.getUserMemorySummaries({ page, limit, search });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getUserMemorySummaries error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getMemories(req, res) {
    try {
      const { page, limit, userId, search } = req.query;
      const result = await adminService.getMemories({ page, limit, userId, search });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getMemories error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getMemoryStats(req, res) {
    try {
      const stats = await adminService.getMemoryStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getMemoryStats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserMemories(req, res) {
    try {
      const { userId } = req.params;
      const { partnerId, category } = req.query;

      const result = await adminService.getUserMemories(userId, { partnerId, category });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getUserMemories error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserVectorStatus(req, res) {
    try {
      const { userId } = req.params;

      const status = await adminService.getUserVectorStatus(userId);

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('[AdminController] getUserVectorStatus error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async rebuildUserVectorIndex(req, res) {
    try {
      const { userId } = req.params;

      const result = await adminService.rebuildUserVectorIndex(userId, {
        actorId: req.user.id,
        actorName: req.user.name || req.user.email
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] rebuildUserVectorIndex error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportUserMemories(req, res) {
    try {
      const { userId } = req.params;

      const data = await adminService.exportUserMemories(userId, {
        actorId: req.user.id,
        actorName: req.user.name || req.user.email
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('[AdminController] exportUserMemories error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Statistics & Dashboard
   */
  async getDashboardStats(req, res) {
    try {
      const stats = await adminService.getDashboardStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getDashboardStats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Invite Code Management
   */
  async getInviteCodes(req, res) {
    try {
      const { page, limit, status } = req.query;
      const result = await adminService.getInviteCodes({ page, limit, status });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getInviteCodes error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createInviteCode(req, res) {
    try {
      const { maxUses, expiresAt } = req.body;
      const createdBy = req.user.id;

      const inviteCode = await adminService.createInviteCode({
        maxUses: maxUses || 1,
        createdBy,
        expiresAt
      });

      res.json({
        success: true,
        code: inviteCode
      });
    } catch (error) {
      logger.error('[AdminController] createInviteCode error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteInviteCode(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteInviteCode(id, { deletedBy: req.user.id });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteInviteCode error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Environment Variables (Read-only)
   */
  async getEnvironmentConfig(req, res) {
    try {
      const config = await adminService.getEnvironmentConfig();

      res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('[AdminController] getEnvironmentConfig error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Environment Variables Management (Full CRUD)
   */
  async getEnvironmentVariables(req, res) {
    try {
      const envVars = await envService.getEnvironmentVariables();

      res.json({
        success: true,
        ...envVars
      });
    } catch (error) {
      logger.error('[AdminController] getEnvironmentVariables error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateEnvironmentVariables(req, res) {
    try {
      const { updates, backup = true } = req.body;

      const result = await envService.updateEnvironmentVariables(updates, {
        backup,
        actorId: req.user.id,
        actorName: req.user.name || req.user.email
      });

      if (result.success) {
        res.json({
          success: true,
          ...result
        });
      } else {
        res.status(400).json({
          success: false,
          errors: result.errors
        });
      }
    } catch (error) {
      logger.error('[AdminController] updateEnvironmentVariables error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async validateEnvVariable(req, res) {
    try {
      const { key, value } = req.body;

      const validation = envService.validateVariable(key, value);

      res.json({
        success: validation.valid,
        ...validation
      });
    } catch (error) {
      logger.error('[AdminController] validateEnvVariable error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getEnvSchema(req, res) {
    try {
      const schema = envService.getSchema();

      res.json({
        success: true,
        schema
      });
    } catch (error) {
      logger.error('[AdminController] getEnvSchema error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async listEnvBackups(req, res) {
    try {
      const backups = await envService.listBackups();

      res.json({
        success: true,
        backups
      });
    } catch (error) {
      logger.error('[AdminController] listEnvBackups error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async restoreEnvBackup(req, res) {
    try {
      const { backupPath } = req.body;

      const result = await envService.restoreFromBackup(backupPath);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] restoreEnvBackup error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Dashboard & System Status Endpoints
   */
  async getDashboardStatsV2(req, res) {
    try {
      const stats = await adminService.getDashboardStatsV2();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getDashboardStatsV2 error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSystemStatus(req, res) {
    try {
      const status = await adminService.getSystemStatus();

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('[AdminController] getSystemStatus error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSystemStatusFast(req, res) {
    try {
      // Fast check using Docker container status (<1 second vs ~30 seconds)
      const status = await adminService.getSystemStatusFast();

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('[AdminController] getSystemStatusFast error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRecentActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const activities = await adminService.getRecentActivity(limit);

      res.json({
        success: true,
        activities
      });
    } catch (error) {
      logger.error('[AdminController] getRecentActivity error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserGrowthData(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const data = await adminService.getUserGrowthData(days);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('[AdminController] getUserGrowthData error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Role & Permission Management
   */
  async getRoles(req, res) {
    try {
      const roles = await adminService.getRoles();

      res.json({
        success: true,
        roles
      });
    } catch (error) {
      logger.error('[AdminController] getRoles error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRoleById(req, res) {
    try {
      const { id } = req.params;
      const role = await adminService.getRoleById(id);

      res.json({
        success: true,
        role
      });
    } catch (error) {
      logger.error('[AdminController] getRoleById error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async createRole(req, res) {
    try {
      const roleData = req.body;
      const adminId = req.user.id;
      const role = await adminService.createRole(roleData, adminId);

      res.json({
        success: true,
        role
      });
    } catch (error) {
      logger.error('[AdminController] createRole error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const adminId = req.user.id;

      const role = await adminService.updateRole(id, updateData, adminId);

      res.json({
        success: true,
        role
      });
    } catch (error) {
      logger.error('[AdminController] updateRole error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const result = await adminService.deleteRole(id, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteRole error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllPermissions(req, res) {
    try {
      const permissions = await adminService.getAllPermissions();

      res.json({
        success: true,
        permissions
      });
    } catch (error) {
      logger.error('[AdminController] getAllPermissions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get Ziwei Books (fortune-telling knowledge base) content
   */
  async getZiweiBooks(req, res) {
    try {
      const { page = 1, limit = 20, search = '', source = '' } = req.query;

      const result = await adminService.getZiweiBooks({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        source
      });

      // Transform books to chunks format for frontend compatibility
      const chunks = (result.books || []).map(book => ({
        id: book._id,
        content: book.content,
        source: book.source,
        chunk_id: book.chunk_id || 0
      }));

      res.json({
        success: true,
        chunks,
        pagination: result.pagination,
        stats: {
          totalChunks: result.pagination?.total || 0,
          sources: []
        }
      });
    } catch (error) {
      logger.error('[AdminController] getZiweiBooks error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get Ziwei Books sources list
   */
  async getZiweiBooksSources(req, res) {
    try {
      const result = await adminService.getZiweiBooksSources();

      // Transform sources format for frontend compatibility
      const sources = (result.sources || []).map(s => ({
        name: s.source,
        count: s.count
      }));

      const totalChunks = sources.reduce((sum, s) => sum + s.count, 0);

      res.json({
        success: true,
        sources,
        totalChunks
      });
    } catch (error) {
      logger.error('[AdminController] getZiweiBooksSources error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * XiaoShuDong Statistics
   * Get usage statistics for XiaoShuDong feature
   */
  async getXiaoshudongStats(req, res) {
    try {
      const { startDate, endDate, userId } = req.query;

      const stats = await adminService.getXiaoshudongStats({
        startDate,
        endDate,
        userId
      });

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getXiaoshudongStats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get XiaoShuDong conversations for a user
   */
  async getUserXiaoshudongConversations(req, res) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      const result = await adminService.getUserXiaoshudongConversations(id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getUserXiaoshudongConversations error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ======== Model Management ========

  /**
   * Get model management status overview
   */
  async getModelManagementStatus(req, res) {
    try {
      const status = await adminService.getModelManagementStatus();
      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('[AdminController] getModelManagementStatus error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List all Ollama models
   */
  async listOllamaModels(req, res) {
    try {
      const models = await adminService.listOllamaModels();
      res.json({
        success: true,
        models
      });
    } catch (error) {
      logger.error('[AdminController] listOllamaModels error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(req, res) {
    try {
      const { name } = req.params;
      const info = await adminService.getModelInfo(name);
      if (!info) {
        return res.status(404).json({
          success: false,
          error: '模型不存在'
        });
      }
      res.json({
        success: true,
        info
      });
    } catch (error) {
      logger.error('[AdminController] getModelInfo error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List GGUF files
   */
  async listGgufFiles(req, res) {
    try {
      const files = await adminService.listGgufFiles();
      res.json({
        success: true,
        files
      });
    } catch (error) {
      logger.error('[AdminController] listGgufFiles error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * List Modelfiles
   */
  async listModelfiles(req, res) {
    try {
      const files = await adminService.listModelfiles();
      res.json({
        success: true,
        files
      });
    } catch (error) {
      logger.error('[AdminController] listModelfiles error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Read Modelfile content
   */
  async readModelfile(req, res) {
    try {
      const { filename } = req.params;
      const result = await adminService.readModelfile(filename);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      logger.error('[AdminController] readModelfile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Save Modelfile content
   */
  async saveModelfile(req, res) {
    try {
      const { filename } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: '内容不能为空'
        });
      }

      const result = await adminService.saveModelfile(filename, content);
      res.json(result);
    } catch (error) {
      logger.error('[AdminController] saveModelfile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create model from Modelfile
   */
  async createModel(req, res) {
    try {
      const { modelName, modelfileName } = req.body;

      if (!modelName || !modelfileName) {
        return res.status(400).json({
          success: false,
          error: 'modelName 和 modelfileName 不能为空'
        });
      }

      const result = await adminService.createModel(modelName, modelfileName, {
        actorId: req.user.id,
        actorName: req.user.name || req.user.email
      });
      res.json(result);
    } catch (error) {
      logger.error('[AdminController] createModel error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete model
   */
  async deleteModel(req, res) {
    try {
      const { name } = req.params;
      const result = await adminService.deleteModel(name, {
        actorId: req.user.id,
        actorName: req.user.name || req.user.email
      });
      res.json(result);
    } catch (error) {
      logger.error('[AdminController] deleteModel error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ======== Memory Deletion ========

  /**
   * Delete a single conversation memory
   */
  async deleteMemory(req, res) {
    try {
      const { userId, memoryId } = req.params;
      const adminId = req.user.id;

      const result = await adminService.deleteMemory(userId, memoryId, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteMemory error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch delete conversation memories
   */
  async batchDeleteMemories(req, res) {
    try {
      const { userId } = req.params;
      const { memoryIds } = req.body;
      const adminId = req.user.id;

      if (!memoryIds || !Array.isArray(memoryIds) || memoryIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'memoryIds must be a non-empty array'
        });
      }

      const result = await adminService.batchDeleteMemories(userId, memoryIds, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] batchDeleteMemories error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete a questionnaire answer
   */
  async deleteAnswer(req, res) {
    try {
      const { userId, answerId } = req.params;
      const adminId = req.user.id;

      const result = await adminService.deleteAnswer(userId, answerId, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] deleteAnswer error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // ======== Recycle Bin ========

  /**
   * Get recycle bin items
   */
  async getRecycleBin(req, res) {
    try {
      const { page, limit, itemType, userId, status, search, startDate, endDate } = req.query;

      const result = await adminService.getRecycleBin({
        page,
        limit,
        itemType,
        userId,
        status,
        search,
        startDate,
        endDate
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getRecycleBin error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get recycle bin item by ID
   */
  async getRecycleBinItem(req, res) {
    try {
      const { id } = req.params;
      const item = await adminService.getRecycleBinItem(id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      res.json({
        success: true,
        item
      });
    } catch (error) {
      logger.error('[AdminController] getRecycleBinItem error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Restore item from recycle bin
   */
  async restoreRecycleBinItem(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const result = await adminService.restoreRecycleBinItem(id, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] restoreRecycleBinItem error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Permanently delete item from recycle bin
   */
  async purgeRecycleBinItem(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const result = await adminService.purgeRecycleBinItem(id, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] purgeRecycleBinItem error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch restore items
   */
  async batchRestoreRecycleBin(req, res) {
    try {
      const { ids } = req.body;
      const adminId = req.user.id;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ids must be a non-empty array'
        });
      }

      const result = await adminService.batchRestoreRecycleBin(ids, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] batchRestoreRecycleBin error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Batch permanently delete items
   */
  async batchPurgeRecycleBin(req, res) {
    try {
      const { ids } = req.body;
      const adminId = req.user.id;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ids must be a non-empty array'
        });
      }

      const result = await adminService.batchPurgeRecycleBin(ids, adminId);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] batchPurgeRecycleBin error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get recycle bin statistics
   */
  async getRecycleBinStats(req, res) {
    try {
      const stats = await adminService.getRecycleBinStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getRecycleBinStats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // ======== Activity Logs ========

  /**
   * Get activity logs
   */
  async getActivityLogs(req, res) {
    try {
      const { page, limit, category, operation, actorId, targetId, success, startDate, endDate, search } = req.query;

      const result = await adminService.getActivityLogs({
        page,
        limit,
        category,
        operation,
        actorId,
        targetId,
        success,
        startDate,
        endDate,
        search
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getActivityLogs error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get activity log statistics
   */
  async getActivityLogStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const stats = await adminService.getActivityLogStats({ startDate, endDate });

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[AdminController] getActivityLogStats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Export activity logs
   */
  async exportActivityLogs(req, res) {
    try {
      const { format = 'json', category, operation, actorId, startDate, endDate, search } = req.query;

      const result = await adminService.exportActivityLogs({
        category,
        operation,
        actorId,
        startDate,
        endDate,
        search
      }, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="activity_logs.csv"');
        res.send(result.data);
      } else {
        res.json({
          success: true,
          data: result.data
        });
      }
    } catch (error) {
      logger.error('[AdminController] exportActivityLogs error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get Ziwei chart for a user
   */
  async getZiweiChart(req, res) {
    try {
      const { id } = req.params;
      const { targetDate } = req.query;

      const result = await adminService.getZiweiChart(id, { targetDate });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('[AdminController] getZiweiChart error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AdminController();
