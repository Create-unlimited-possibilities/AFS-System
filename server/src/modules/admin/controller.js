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

      const user = await adminService.updateUser(id, updateData);

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

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteUser(id);

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
      const question = await adminService.createQuestion(questionData);

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

      const question = await adminService.updateQuestion(id, updateData);

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
      const result = await adminService.deleteQuestion(id);

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

      const question = await adminService.reorderQuestion(id, newOrder);

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

      const question = await adminService.toggleQuestionStatus(id, active);

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

      const result = await adminService.batchImportQuestions(questions);

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

      const result = await adminService.getUserMemories(userId);

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

      const result = await adminService.rebuildUserVectorIndex(userId);

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

      const data = await adminService.exportUserMemories(userId);

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
      const result = await adminService.deleteInviteCode(id);

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

      const result = await envService.updateEnvironmentVariables(updates, { backup });

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
      const role = await adminService.createRole(roleData);

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

      const role = await adminService.updateRole(id, updateData);

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
      const result = await adminService.deleteRole(id);

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
}

export default new AdminController();
