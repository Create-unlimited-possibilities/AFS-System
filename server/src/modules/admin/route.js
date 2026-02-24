/**
 * Admin Routes
 * Defines all admin API endpoints
 *
 * @author AFS Team
 * @version 1.0.0
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import adminController from './controller.js';
import { protect, requireAdmin } from './middleware.js';
import User from '../user/model.js';
import Role from '../roles/models/role.js';
import InviteCode from './models/inviteCode.js';
import logger from '../../core/utils/logger.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || 'AFS-Admin-2024-Secure-Code';

// ============================================
// Public Auth Routes (No authentication required)
// ============================================

// Simple test route to verify routing works
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin routes working', timestamp: new Date().toISOString() });
});

/**
 * @route   POST /api/admin/auth/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/auth/login', async (req, res) => {
  logger.info('[AdminAuth] Login route hit, body:', req.body);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '请输入邮箱和密码'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('role');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: '账号已被禁用'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // Check if user has admin role
    if (!user.role || !user.role.isAdmin) {
      return res.status(403).json({
        success: false,
        error: '没有管理员权限'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`[AdminAuth] Admin login successful: ${email}`);

    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        name: user.name,
        uniqueCode: user.uniqueCode,
        role: user.role,
        lastLogin: user.lastLogin
      },
      token
    });
  } catch (error) {
    logger.error('[AdminAuth] Login error:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试'
    });
  }
});

/**
 * @route   POST /api/admin/auth/register
 * @desc    Admin registration with invite code
 * @access  Public
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body;

    if (!email || !password || !name || !inviteCode) {
      return res.status(400).json({
        success: false,
        error: '请填写所有必填字段'
      });
    }

    // Validate invite code
    let isValidCode = false;

    // Check against env variable first
    if (inviteCode === ADMIN_INVITE_CODE) {
      isValidCode = true;
    } else {
      // Check against database invite codes
      const dbInviteCode = await InviteCode.findOne({
        code: inviteCode,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (dbInviteCode && dbInviteCode.useCount < dbInviteCode.maxUses) {
        isValidCode = true;
        // Increment usage count
        dbInviteCode.useCount += 1;
        await dbInviteCode.save();
      }
    }

    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        error: '无效或已过期的邀请码'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }

    // Get or create admin role
    let adminRole = await Role.findOne({ isAdmin: true });
    if (!adminRole) {
      adminRole = await Role.create({
        name: 'admin',
        description: 'System administrator with full access',
        isAdmin: true,
        isSystem: true,
        permissions: []
      });
    }

    // Generate unique code
    const uniqueCode = await User.generateUniqueCode();

    // Create admin user
    const user = await User.create({
      uniqueCode,
      email: email.toLowerCase().trim(),
      password,
      name,
      role: adminRole._id,
      isActive: true
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: adminRole.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`[AdminAuth] Admin registration successful: ${email}`);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        name: user.name,
        uniqueCode: user.uniqueCode,
        role: adminRole
      },
      token
    });
  } catch (error) {
    logger.error('[AdminAuth] Registration error:', error);
    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试'
    });
  }
});

/**
 * @route   GET /api/admin/invite-codes/validate/:code
 * @desc    Validate invite code
 * @access  Public
 */
router.get('/invite-codes/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Check against env variable
    if (code === ADMIN_INVITE_CODE) {
      return res.json({
        success: true,
        valid: true
      });
    }

    // Check against database
    const inviteCode = await InviteCode.findOne({
      code,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (inviteCode && inviteCode.useCount < inviteCode.maxUses) {
      return res.json({
        success: true,
        valid: true
      });
    }

    res.json({
      success: true,
      valid: false
    });
  } catch (error) {
    logger.error('[AdminAuth] Validate invite code error:', error);
    res.status(500).json({
      success: false,
      error: '验证失败'
    });
  }
});

// ============================================
// Protected Routes (Require authentication and admin role)
// ============================================

// All routes below require authentication and admin role
router.use(protect);
router.use(requireAdmin);

// ======== User Management ========
/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and filters
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   search - Search by name, email, or uniqueCode
 * @query   role - Filter by role ID
 * @query   isActive - Filter by active status (true/false)
 */
router.get('/users', (req, res) => adminController.getUsers(req, res));

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user by ID with stats
 * @access  Admin
 */
router.get('/users/:id', (req, res) => adminController.getUserById(req, res));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update user
 * @access  Admin
 */
router.put('/users/:id', (req, res) => adminController.updateUser(req, res));

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user (cascades to related data)
 * @access  Admin
 */
router.delete('/users/:id', (req, res) => adminController.deleteUser(req, res));

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Toggle user active status
 * @access  Admin
 * @body    isActive - Boolean status to set
 */
router.patch('/users/:id/status', (req, res) => adminController.updateUser(req, res));

// ======== Questionnaire Management ========
/**
 * @route   GET /api/admin/questionnaires
 * @desc    Get all questions with filters (legacy endpoint)
 * @access  Admin
 * @query   role - Filter by role (elder, family, friend)
 * @query   layer - Filter by layer (basic, emotional)
 * @query   active - Filter by active status (true/false)
 */
router.get('/questionnaires', (req, res) => adminController.getQuestions(req, res));

/**
 * @route   GET /api/admin/questionnaires/:id
 * @desc    Get question by ID (legacy endpoint)
 * @access  Admin
 */
router.get('/questionnaires/:id', (req, res) => adminController.getQuestionById(req, res));

/**
 * @route   POST /api/admin/questionnaires
 * @desc    Create new question (legacy endpoint)
 * @access  Admin
 */
router.post('/questionnaires', (req, res) => adminController.createQuestion(req, res));

/**
 * @route   PUT /api/admin/questionnaires/:id
 * @desc    Update question (legacy endpoint)
 * @access  Admin
 */
router.put('/questionnaires/:id', (req, res) => adminController.updateQuestion(req, res));

/**
 * @route   DELETE /api/admin/questionnaires/:id
 * @desc    Delete question (legacy endpoint, cascades to answers)
 * @access  Admin
 */
router.delete('/questionnaires/:id', (req, res) => adminController.deleteQuestion(req, res));

// ======== Questions API (same as questionnaires, matching frontend expectations) ========
/**
 * @route   GET /api/admin/questions
 * @desc    Get all questions with filters
 * @access  Admin
 * @query   role - Filter by role (elder, family, friend)
 * @query   layer - Filter by layer (basic, emotional)
 * @query   active - Filter by active status (true/false)
 * @query   search - Search in question text
 */
router.get('/questions', (req, res) => adminController.getQuestions(req, res));

/**
 * @route   GET /api/admin/questions/:id
 * @desc    Get question by ID
 * @access  Admin
 */
router.get('/questions/:id', (req, res) => adminController.getQuestionById(req, res));

/**
 * @route   POST /api/admin/questions
 * @desc    Create new question
 * @access  Admin
 */
router.post('/questions', (req, res) => adminController.createQuestion(req, res));

/**
 * @route   PUT /api/admin/questions/:id
 * @desc    Update question
 * @access  Admin
 */
router.put('/questions/:id', (req, res) => adminController.updateQuestion(req, res));

/**
 * @route   DELETE /api/admin/questions/:id
 * @desc    Delete question (cascades to answers)
 * @access  Admin
 */
router.delete('/questions/:id', (req, res) => adminController.deleteQuestion(req, res));

/**
 * @route   PATCH /api/admin/questions/:id/reorder
 * @desc    Reorder question and adjust other questions accordingly
 * @access  Admin
 * @body    newOrder - New order position (1-based)
 */
router.patch('/questions/:id/reorder', (req, res) => adminController.reorderQuestion(req, res));

/**
 * @route   PATCH /api/admin/questions/:id/status
 * @desc    Toggle question active status
 * @access  Admin
 * @body    active - Boolean status to set
 */
router.patch('/questions/:id/status', (req, res) => adminController.toggleQuestionStatus(req, res));

/**
 * @route   POST /api/admin/questions/batch-import
 * @desc    Import multiple questions at once
 * @access  Admin
 * @body    questions - Array of question objects
 */
router.post('/questions/batch-import', (req, res) => adminController.batchImportQuestions(req, res));

/**
 * @route   GET /api/admin/questions/export
 * @desc    Export questions with optional filters
 * @access  Admin
 * @query   role - Filter by role (elder, family, friend)
 * @query   layer - Filter by layer (basic, emotional)
 */
router.get('/questions/export', (req, res) => adminController.exportQuestions(req, res));

// ======== Memory Management ========
/**
 * @route   GET /api/admin/memories/user-summaries
 * @desc    Get user memory summaries with statistics
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   search - Search by name, email, or uniqueCode
 */
router.get('/memories/user-summaries', (req, res) => adminController.getUserMemorySummaries(req, res));

/**
 * @route   GET /api/admin/memories
 * @desc    Get all memories/answers with pagination
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   userId - Filter by user ID (as target or answerer)
 * @query   search - Search by answer content
 */
router.get('/memories', (req, res) => adminController.getMemories(req, res));

/**
 * @route   GET /api/admin/memories/stats
 * @desc    Get memory statistics
 * @access  Admin
 */
router.get('/memories/stats', (req, res) => adminController.getMemoryStats(req, res));

/**
 * @route   GET /api/admin/memories/:userId
 * @desc    Get user's memory data with vector index status
 * @access  Admin
 */
router.get('/memories/:userId', (req, res) => adminController.getUserMemories(req, res));

/**
 * @route   GET /api/admin/memories/:userId/vector-status
 * @desc    Get vector index status for user
 * @access  Admin
 */
router.get('/memories/:userId/vector-status', (req, res) => adminController.getUserVectorStatus(req, res));

/**
 * @route   POST /api/admin/memories/:userId/rebuild-index
 * @desc    Trigger vector index rebuild for user
 * @access  Admin
 */
router.post('/memories/:userId/rebuild-index', (req, res) => adminController.rebuildUserVectorIndex(req, res));

/**
 * @route   GET /api/admin/memories/:userId/export
 * @desc    Export user's memory data as JSON
 * @access  Admin
 */
router.get('/memories/:userId/export', (req, res) => adminController.exportUserMemories(req, res));

// ======== Statistics & Dashboard ========
/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics (legacy)
 * @access  Admin
 */
router.get('/stats', (req, res) => adminController.getDashboardStats(req, res));

/**
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get dashboard statistics for admin panel
 * @access  Admin
 */
router.get('/dashboard/stats', (req, res) => adminController.getDashboardStatsV2(req, res));

/**
 * @route   GET /api/admin/dashboard/system-status
 * @desc    Get system status (MongoDB, ChromaDB, LLM, VectorStore)
 * @access  Admin
 */
router.get('/dashboard/system-status', (req, res) => adminController.getSystemStatus(req, res));

/**
 * @route   GET /api/admin/dashboard/system-status-fast
 * @desc    Get system status using Docker container checks (fast - <1 second)
 * @access  Admin
 */
router.get('/dashboard/system-status-fast', (req, res) => adminController.getSystemStatusFast(req, res));

/**
 * @route   GET /api/admin/dashboard/activity
 * @desc    Get recent system activity (user registrations, memories, conversations)
 * @access  Admin
 * @query   limit - Number of activities to return (default: 10)
 */
router.get('/dashboard/activity', (req, res) => adminController.getRecentActivity(req, res));

/**
 * @route   GET /api/admin/dashboard/growth
 * @desc    Get user growth data over time (daily registrations with cumulative totals)
 * @access  Admin
 * @query   days - Number of days to look back (default: 30)
 */
router.get('/dashboard/growth', (req, res) => adminController.getUserGrowthData(req, res));

// ======== Invite Code Management ========
/**
 * @route   GET /api/admin/invite-codes
 * @desc    Get all invite codes with pagination
 * @access  Admin
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   status - Filter by status (active, used, expired)
 */
router.get('/invite-codes', (req, res) => adminController.getInviteCodes(req, res));

/**
 * @route   POST /api/admin/invite-codes
 * @desc    Create new invite code
 * @access  Admin
 * @body    maxUses - Maximum number of uses (default: 1)
 * @body    expiresAt - Expiration date (optional)
 */
router.post('/invite-codes', (req, res) => adminController.createInviteCode(req, res));

/**
 * @route   DELETE /api/admin/invite-codes/:id
 * @desc    Delete invite code
 * @access  Admin
 */
router.delete('/invite-codes/:id', (req, res) => adminController.deleteInviteCode(req, res));

// ======== Environment Variables (Read-only) ========
/**
 * @route   GET /api/admin/settings/env
 * @desc    Get environment configuration (read-only, sanitized)
 * @access  Admin
 */
router.get('/settings/env', (req, res) => adminController.getEnvironmentConfig(req, res));

// ======== Environment Variables Management ========
/**
 * @route   GET /api/admin/settings/env/full
 * @desc    Get all environment variables with metadata
 * @access  Admin
 */
router.get('/settings/env/full', (req, res) => adminController.getEnvironmentVariables(req, res));

/**
 * @route   PUT /api/admin/settings/env
 * @desc    Update environment variables (with backup)
 * @access  Admin
 * @body    updates - Object with key-value pairs to update
 * @body    backup - Whether to create backup (default: true)
 */
router.put('/settings/env', (req, res) => adminController.updateEnvironmentVariables(req, res));

/**
 * @route   POST /api/admin/settings/env/validate
 * @desc    Validate an environment variable value without updating
 * @access  Admin
 * @body    key - Variable name
 * @body    value - Value to validate
 */
router.post('/settings/env/validate', (req, res) => adminController.validateEnvVariable(req, res));

/**
 * @route   GET /api/admin/settings/env/schema
 * @desc    Get environment variable configuration schema
 * @access  Admin
 */
router.get('/settings/env/schema', (req, res) => adminController.getEnvSchema(req, res));

/**
 * @route   GET /api/admin/settings/env/backups
 * @desc    List available .env backups
 * @access  Admin
 */
router.get('/settings/env/backups', (req, res) => adminController.listEnvBackups(req, res));

/**
 * @route   POST /api/admin/settings/env/restore
 * @desc    Restore .env from backup
 * @access  Admin
 * @body    backupPath - Path to backup file
 */
router.post('/settings/env/restore', (req, res) => adminController.restoreEnvBackup(req, res));

// ======== Role & Permission Management ========
/**
 * @route   GET /api/admin/roles
 * @desc    Get all roles with permissions
 * @access  Admin
 */
router.get('/roles', (req, res) => adminController.getRoles(req, res));

/**
 * @route   GET /api/admin/roles/:id
 * @desc    Get role by ID with permissions
 * @access  Admin
 */
router.get('/roles/:id', (req, res) => adminController.getRoleById(req, res));

/**
 * @route   POST /api/admin/roles
 * @desc    Create new role
 * @access  Admin
 * @body    name - Role name
 * @body    description - Role description
 * @body    permissionIds - Array of permission IDs
 */
router.post('/roles', (req, res) => adminController.createRole(req, res));

/**
 * @route   PUT /api/admin/roles/:id
 * @desc    Update role
 * @access  Admin
 * @body    name - Role name (optional)
 * @body    description - Role description (optional)
 * @body    permissionIds - Array of permission IDs (optional)
 */
router.put('/roles/:id', (req, res) => adminController.updateRole(req, res));

/**
 * @route   DELETE /api/admin/roles/:id
 * @desc    Delete role (only if not system role and not assigned to users)
 * @access  Admin
 */
router.delete('/roles/:id', (req, res) => adminController.deleteRole(req, res));

/**
 * @route   GET /api/admin/permissions
 * @desc    Get all permissions
 * @access  Admin
 */
router.get('/permissions', (req, res) => adminController.getAllPermissions(req, res));

export default router;
