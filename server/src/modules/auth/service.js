// server/src/services/authService.js - 认证服务
import jwt from 'jsonwebtoken';
import User from '../user/model.js';
import Role from '../roles/models/role.js';
import RolecardStorage from '../../core/storage/rolecard.js';
import DualStorage from '../../core/storage/dual.js';

const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';

class AuthService {
  /**
   * 生成唯一专属编号
   */
  async generateUniqueCode() {
    const code = Math.random().toString(36).substring(2, 18).toUpperCase();
    return code;
  }

  /**
   * 获取默认角色
   */
  async getDefaultRole() {
    let defaultRole = await Role.findOne({ isSystem: true });
    if (!defaultRole) {
      // 如果不存在系统默认角色，创建一个
      defaultRole = await Role.create({
        name: 'user',
        description: '默认用户角色',
        isSystem: true,
        permissions: []
      });
    }
    return defaultRole;
  }

  /**
   * 格式化用户数据以兼容前端
   */
  async formatUserData(user) {
    const userData = {
      _id: user._id,
      id: user._id,
      uniqueCode: user.uniqueCode,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    // 尝试从文件系统加载角色卡（优先级：V2 > V1 > 旧版RolecardStorage）
    const dualStorage = new DualStorage();
    const rolecardStorage = new RolecardStorage();

    let roleCardFromFileSystem = null;
    try {
      // 1. 优先检查 DualStorage V2 (rolecard-v2.json)
      roleCardFromFileSystem = await dualStorage.loadRoleCardV2(String(user._id));

      // 2. 如果没有V2，检查 DualStorage V1 (rolecard.json)
      if (!roleCardFromFileSystem) {
        roleCardFromFileSystem = await dualStorage.loadRoleCard(String(user._id));
      }

      // 3. 如果DualStorage都没有，检查旧版RolecardStorage (rolecard_latest.json)
      if (!roleCardFromFileSystem) {
        const legacyRolecard = await rolecardStorage.getLatestRolecard(String(user._id));
        if (legacyRolecard) {
          roleCardFromFileSystem = {
            personality: legacyRolecard.systemPrompt,
            background: '',
            interests: [],
            communicationStyle: '',
            values: [],
            emotionalNeeds: [],
            lifeMilestones: [],
            preferences: [],
            strangerInitialSentiment: '',
            generatedAt: legacyRolecard.generatedAt,
            updatedAt: legacyRolecard.generatedAt
          };
        }
      }
    } catch (error) {
      console.error('[AuthService] 从文件系统读取角色卡失败:', error);
    }

    // 如果用户没有companionChat，从文件系统读取的角色卡创建
    if (!user.companionChat) {
      if (roleCardFromFileSystem) {
        userData.companionChat = {
          memoryTokenCount: 0,
          currentMode: 'mode1',
          relationships: [],
          roleCard: {
            personality: roleCardFromFileSystem.personality || '',
            background: roleCardFromFileSystem.background || '',
            interests: roleCardFromFileSystem.interests || [],
            communicationStyle: roleCardFromFileSystem.communicationStyle || '',
            values: roleCardFromFileSystem.values || [],
            emotionalNeeds: roleCardFromFileSystem.emotionalNeeds || [],
            lifeMilestones: roleCardFromFileSystem.lifeMilestones || [],
            preferences: roleCardFromFileSystem.preferences || [],
            strangerInitialSentiment: roleCardFromFileSystem.strangerInitialSentiment || '',
            generatedAt: roleCardFromFileSystem.generatedAt,
            updatedAt: roleCardFromFileSystem.updatedAt,
            memoryTokenCount: 0
          },
          modelStatus: { hasCustomModel: false, trainingStatus: 'none' }
        };
      } else {
        userData.companionChat = {
          memoryTokenCount: 0,
          currentMode: 'mode1',
          relationships: [],
          roleCard: {
            personality: '',
            background: '',
            interests: [],
            communicationStyle: '',
            values: [],
            emotionalNeeds: [],
            lifeMilestones: [],
            preferences: [],
            strangerInitialSentiment: '',
            generatedAt: null,
            updatedAt: null
          },
          modelStatus: { hasCustomModel: false, trainingStatus: 'none' }
        };
      }
    } else {
      // 如果用户有companionChat，直接使用
      userData.companionChat = user.companionChat;

      // 但如果文件系统有角色卡而MongoDB没有，使用文件系统的数据
      if (roleCardFromFileSystem && !user.companionChat.roleCard) {
        userData.companionChat.roleCard = {
          personality: roleCardFromFileSystem.personality || '',
          background: roleCardFromFileSystem.background || '',
          interests: roleCardFromFileSystem.interests || [],
          communicationStyle: roleCardFromFileSystem.communicationStyle || '',
          values: roleCardFromFileSystem.values || [],
          emotionalNeeds: roleCardFromFileSystem.emotionalNeeds || [],
          lifeMilestones: roleCardFromFileSystem.lifeMilestones || [],
          preferences: roleCardFromFileSystem.preferences || [],
          strangerInitialSentiment: roleCardFromFileSystem.strangerInitialSentiment || '',
          generatedAt: roleCardFromFileSystem.generatedAt,
          updatedAt: roleCardFromFileSystem.updatedAt
        };
      }
    }

    // 如果用户有角色但没有companionChat.roleCard，尝试从文件系统加载
    if (user.role && !userData.companionChat?.roleCard && roleCardFromFileSystem) {
      userData.companionChat.roleCard = {
        personality: roleCardFromFileSystem.personality || '',
        background: roleCardFromFileSystem.background || '',
        interests: roleCardFromFileSystem.interests || [],
        communicationStyle: roleCardFromFileSystem.communicationStyle || '',
        values: roleCardFromFileSystem.values || [],
        emotionalNeeds: roleCardFromFileSystem.emotionalNeeds || [],
        lifeMilestones: roleCardFromFileSystem.lifeMilestones || [],
        preferences: roleCardFromFileSystem.preferences || [],
        strangerInitialSentiment: roleCardFromFileSystem.strangerInitialSentiment || '',
        generatedAt: roleCardFromFileSystem.generatedAt,
        updatedAt: roleCardFromFileSystem.updatedAt
      };
    }

    // 如果用户有角色，添加角色信息
    if (user.role && typeof user.role === 'object') {
      userData.role = user.role;
    } else {
      // 兼容旧数据：添加默认角色
      userData.role = {
        _id: 'default',
        name: 'user',
        description: '默认用户',
        permissions: [],
        isSystem: true
      };
    }

    return userData;
  }

  /**
   * 注册新用户
   */
  async register({ email, password, name }) {
    // 添加参数检查
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new Error('邮箱格式不正确');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('密码长度至少为6位');
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('姓名不能为空');
    }

    // 检查邮箱是否已存在
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('该邮箱已被注册');
    }

    // 生成唯一专属编号
    const uniqueCode = await this.generateUniqueCode();

    // 获取默认角色
    const defaultRole = await this.getDefaultRole();

    // 创建新用户
    const newUser = new User({
      email: email.toLowerCase(),
      password,
      name: name || '用户',
      uniqueCode,
      role: defaultRole._id
    });

    await newUser.save();

    // 返回格式化的用户数据
    return this.formatUserData(newUser);
  }

  /**
   * 登录用户
   */
  async login(email, password) {
    // 添加参数检查
    if (!email || typeof email !== 'string' || email.trim() === '') {
      throw new Error('邮箱格式不正确');
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new Error('密码不能为空');
    }

    // 查找用户并填充角色
    const user = await User.findOne({ email: email.toLowerCase() }).populate('role');
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('密码错误');
    }

    // 更新最后登录时间
    user.lastLogin = new Date();
    await user.save();

    // 返回格式化的用户数据
    return this.formatUserData(user);
  }

  /**
   * 生成JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        id: user._id || user.id,
        email: user.email,
        uniqueCode: user.uniqueCode
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId) {
    const user = await User.findById(userId).populate('role');
    if (!user) {
      throw new Error('用户不存在');
    }
    return this.formatUserData(user);
  }
}

export default new AuthService();