import User from './model.js';
import bcrypt from 'bcryptjs';
import DualStorage from '../../core/storage/dual.js';

// 创建 DualStorage 实例
const dualStorage = new DualStorage();

class UserService {
  async getAllUsers(filters = {}) {
    const { page = 1, limit = 10, search, role, isActive } = filters;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uniqueCode: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      query.role = role;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query)
        .populate('role')
        .select('-password')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      User.countDocuments(query)
    ]);

    return {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(userId) {
    const user = await User.findById(userId).populate('role').select('-password');
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  }

  async updateUser(userId, updateData) {
    const { name, email, role, isActive, password } = updateData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;

    await user.save();
    return await user.populate('role');
  }

  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    await User.findByIdAndDelete(userId);
    return { message: '用户已删除' };
  }

  async createUser(data) {
    const { email, password, name, role } = data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('该邮箱已被注册');
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name: name || '用户',
      role,
      uniqueCode: await User.generateUniqueCode()
    });

    await user.save();
    return await user.populate('role');
  }

  async toggleUserStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    user.isActive = !user.isActive;
    await user.save();
    return await user.populate('role');
  }

  async getUserStats() {
    const [total, active, inactive] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false })
    ]);

    return { total, active, inactive };
  }

  /**
   * 获取用户个人档案
   * @param {string} userId - 用户ID
   */
  async getProfile(userId) {
    const user = await User.findById(userId).select('name email profile uniqueCode');
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  }

  /**
   * 更新用户个人档案
   * @param {string} userId - 用户ID
   * @param {object} profileData - 档案数据
   */
  async updateProfile(userId, profileData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 更新档案字段
    const allowedFields = [
      'gender', 'birthDate', 'birthHour',
      'birthPlace', 'residence',
      'nationality', 'ethnicity', 'occupation', 'education',
      'maritalStatus', 'children', 'height', 'appearanceFeatures'
    ];

    // 初始化 profile 对象（如果不存在）
    if (!user.profile) {
      user.profile = {};
    }

    // 只更新允许的字段
    for (const field of allowedFields) {
      if (profileData[field] !== undefined) {
        user.profile[field] = profileData[field];
      }
    }

    // 更新元数据
    user.profile.updatedAt = new Date();

    // 保存到 MongoDB
    await user.save();

    // 同步到文件系统（双重存储）
    try {
      await dualStorage.saveUserProfile(userId, {
        ...user.profile.toObject(),
        userId,
        name: user.name,
        email: user.email,
        uniqueCode: user.uniqueCode,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('[UserService] 同步档案到文件系统失败:', error);
      // 文件系统存储失败不影响主流程
    }

    return user;
  }
}

export default new UserService();
