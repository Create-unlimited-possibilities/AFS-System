import User from './model.js';
import bcrypt from 'bcryptjs';

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
}

export default new UserService();
