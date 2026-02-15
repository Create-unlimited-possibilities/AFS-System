import User from '../../modules/user/model.js';

export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          message: '未登录，请先登录' 
        });
      }

      const user = await User.findById(userId).populate('role');
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: '用户不存在' 
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ 
          success: false,
          message: '账号已被禁用' 
        });
      }

      if (!user.role) {
        return res.status(403).json({ 
          success: false,
          message: '未分配角色，无权访问' 
        });
      }

      await user.role.populate('permissions');
      
      const hasPermission = user.role.permissions.some(
        p => p.name === permissionName
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          success: false,
          message: '权限不足' 
        });
      }

      req.userWithRole = user;
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: '权限验证失败',
        error: error.message
      });
    }
  };
};

export const requireRole = (roleName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          message: '未登录，请先登录' 
        });
      }

      const user = await User.findById(userId).populate('role');
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: '用户不存在' 
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ 
          success: false,
          message: '账号已被禁用' 
        });
      }

      if (!user.role || user.role.name !== roleName) {
        return res.status(403).json({ 
          success: false,
          message: '角色权限不足' 
        });
      }

      req.userWithRole = user;
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: '角色验证失败',
        error: error.message
      });
    }
  };
};

export const requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          message: '未登录，请先登录' 
        });
      }

      const user = await User.findById(userId).populate('role');
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: '用户不存在' 
        });
      }

      if (!user.isActive) {
        return res.status(403).json({ 
          success: false,
          message: '账号已被禁用' 
        });
      }

      if (!user.role) {
        return res.status(403).json({ 
          success: false,
          message: '未分配角色，无权访问' 
        });
      }

      await user.role.populate('permissions');
      
      const hasAnyPermission = user.role.permissions.some(
        p => permissionNames.includes(p.name)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          success: false,
          message: '权限不足' 
        });
      }

      req.userWithRole = user;
      next();
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: '权限验证失败',
        error: error.message
      });
    }
  };
};
