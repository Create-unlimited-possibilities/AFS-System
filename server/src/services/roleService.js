import Role from '../models/Role.js';
import Permission from '../models/Permission.js';

class RoleService {
  async getAllRoles(filters = {}) {
    const { page = 1, limit = 10, search } = filters;
    
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const [roles, total] = await Promise.all([
      Role.find(query)
        .populate('permissions')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Role.countDocuments(query)
    ]);

    return {
      roles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getRoleById(roleId) {
    const role = await Role.findById(roleId).populate('permissions');
    if (!role) {
      throw new Error('角色不存在');
    }
    return role;
  }

  async createRole(data) {
    const { name, description, permissions = [] } = data;

    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      throw new Error('角色名称已存在');
    }

    const role = new Role({
      name,
      description,
      permissions
    });

    await role.save();
    return await role.populate('permissions');
  }

  async updateRole(roleId, updateData) {
    const { name, description, permissions } = updateData;

    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    if (role.isSystem) {
      throw new Error('系统角色不可修改');
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();
    return await role.populate('permissions');
  }

  async deleteRole(roleId) {
    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    if (role.isSystem) {
      throw new Error('系统角色不可删除');
    }

    const User = (await import('../models/User.js')).default;
    const usersWithRole = await User.countDocuments({ role: roleId });
    if (usersWithRole > 0) {
      throw new Error('该角色正在被使用，无法删除');
    }

    await Role.findByIdAndDelete(roleId);
    return { message: '角色已删除' };
  }

  async getAllPermissions() {
    const permissions = await Permission.find().sort({ category: 1, name: 1 });
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    return { permissions, grouped };
  }

  async createPermission(data) {
    const { name, description, category } = data;

    const existingPermission = await Permission.findOne({ name });
    if (existingPermission) {
      throw new Error('权限名称已存在');
    }

    const permission = new Permission({
      name,
      description,
      category
    });

    await permission.save();
    return permission;
  }

  async updatePermission(permissionId, updateData) {
    const permission = await Permission.findById(permissionId);
    if (!permission) {
      throw new Error('权限不存在');
    }

    const { name, description, category } = updateData;
    if (name) permission.name = name;
    if (description !== undefined) permission.description = description;
    if (category) permission.category = category;

    await permission.save();
    return permission;
  }

  async deletePermission(permissionId) {
    const permission = await Permission.findById(permissionId);
    if (!permission) {
      throw new Error('权限不存在');
    }

    const rolesWithPermission = await Role.countDocuments({ permissions: permissionId });
    if (rolesWithPermission > 0) {
      throw new Error('该权限正在被使用，无法删除');
    }

    await Permission.findByIdAndDelete(permissionId);
    return { message: '权限已删除' };
  }

  async initializeDefaultRoles() {
    const defaultPermissions = [
      { name: 'user:view', description: '查看用户', category: 'user' },
      { name: 'user:create', description: '创建用户', category: 'user' },
      { name: 'user:update', description: '更新用户', category: 'user' },
      { name: 'user:delete', description: '删除用户', category: 'user' },
      { name: 'role:view', description: '查看角色', category: 'role' },
      { name: 'role:create', description: '创建角色', category: 'role' },
      { name: 'role:update', description: '更新角色', category: 'role' },
      { name: 'role:delete', description: '删除角色', category: 'role' },
      { name: 'permission:view', description: '查看权限', category: 'role' },
      { name: 'system:view', description: '查看系统设置', category: 'system' },
      { name: 'system:update', description: '更新系统设置', category: 'system' },
      { name: 'content:manage', description: '管理内容', category: 'content' }
    ];

    for (const permData of defaultPermissions) {
      const existing = await Permission.findOne({ name: permData.name });
      if (!existing) {
        await Permission.create(permData);
      }
    }

    const adminRole = await Role.findOne({ name: '管理员' });
    if (!adminRole) {
      const allPermissions = await Permission.find();
      await Role.create({
        name: '管理员',
        description: '拥有所有权限的系统管理员',
        permissions: allPermissions.map(p => p._id),
        isSystem: true
      });
    }

    const userRole = await Role.findOne({ name: '普通用户' });
    if (!userRole) {
      const userPermissions = await Permission.find({ 
        name: { $in: ['content:manage'] } 
      });
      await Role.create({
        name: '普通用户',
        description: '普通用户，基础权限',
        permissions: userPermissions.map(p => p._id),
        isSystem: true
      });
    }

    return { message: '默认角色和权限初始化完成' };
  }
}

export default new RoleService();
