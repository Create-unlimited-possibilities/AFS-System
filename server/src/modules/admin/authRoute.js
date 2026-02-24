/**
 * Admin Authentication Routes
 * Public routes for admin login/register - NO MIDDLEWARE
 *
 * @author AFS Team
 * @version 1.0.0
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../user/model.js';
import Role from '../roles/models/role.js';
import InviteCode from './models/inviteCode.js';
import logger from '../../core/utils/logger.js';

console.log('=== ADMIN AUTH ROUTE LOADED ===');
logger.info('=== ADMIN AUTH ROUTE LOADED ===');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || 'AFS-Admin-2024-Secure-Code';

/**
 * @route   POST /api/admin/auth/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/login', async (req, res) => {
  logger.info('[AdminAuth] Login attempt:', { email: req.body?.email });
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '请输入邮箱和密码'
      });
    }

    // Find user by email - populate role AND permissions inside role
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          select: '_id name'
        }
      });

    if (!user) {
      logger.warn('[AdminAuth] User not found:', email);
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
      logger.warn('[AdminAuth] Password mismatch for:', email);
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // Check if user has admin role
    if (!user.role || !user.role.isAdmin) {
      logger.warn('[AdminAuth] Non-admin user tried to login:', email);
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
router.post('/register', async (req, res) => {
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

    // Get or create admin role - populate permissions
    let adminRole = await Role.findOne({ isAdmin: true })
      .populate('permissions', '_id name');
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
 * @route   GET /api/admin/auth/validate-invite/:code
 * @desc    Validate invite code
 * @access  Public
 */
router.get('/validate-invite/:code', async (req, res) => {
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

export default router;
