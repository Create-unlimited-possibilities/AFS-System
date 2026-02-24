/**
 * Admin Middleware
 * Permission checking for admin routes
 *
 * @author AFS Team
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken';
import User from '../user/model.js';
import Role from '../roles/models/role.js';

const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';

/**
 * Check if user is authenticated
 */
export const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未登录，请先登录'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: '登录已过期，请重新登录'
    });
  }
};

/**
 * Check if user has admin role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // First ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: '未登录，请先登录'
      });
    }

    // Fetch user with role
    const user = await User.findById(req.user.id).populate('role');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '用户已被禁用'
      });
    }

    // Check if user has admin role
    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: '没有权限，需要管理员角色'
      });
    }

    // Check role permissions for admin access
    const role = await Role.findById(user.role._id);

    if (!role || !role.isAdmin) {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
    }

    req.adminUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '权限检查失败',
      error: error.message
    });
  }
};

/**
 * Check if user has specific permission
 * @param {string} permission - Permission name to check
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: '未登录，请先登录'
        });
      }

      const user = await User.findById(req.user.id).populate('role');

      if (!user || !user.role) {
        return res.status(403).json({
          success: false,
          message: '没有权限'
        });
      }

      const role = await Role.findById(user.role._id);

      if (!role) {
        return res.status(403).json({
          success: false,
          message: '角色不存在'
        });
      }

      // Check if role has the required permission
      const hasPermission = role.permissions.some(p => p.name === permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `需要权限: ${permission}`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: '权限检查失败',
        error: error.message
      });
    }
  };
};

/**
 * Check if user can manage specific user (by ID)
 * Allows managing if: admin OR managing own account
 */
export const canManageUser = (req, res, next) => {
  const targetUserId = req.params.id || req.params.userId;
  const currentUserId = req.user?.id;

  // Allow if admin (already checked by requireAdmin middleware)
  if (req.adminUser) {
    return next();
  }

  // Allow if managing own account
  if (targetUserId === currentUserId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: '没有权限操作该用户'
  });
};

export default {
  protect,
  requireAdmin,
  requirePermission,
  canManageUser
};
