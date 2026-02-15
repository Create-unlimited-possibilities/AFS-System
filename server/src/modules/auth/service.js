// server/src/services/authService.js - 认证服务
import jwt from 'jsonwebtoken';
import User from '../user/model.js';
import Role from '../roles/models/role.js';
import RolecardStorage from '../../core/storage/rolecard.js';

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

    // 如果用户没有companionChat，从文件系统读取角色卡数据
    if (!user.companionChat) {
      try {
        const rolecardStorage = new RolecardStorage();
        const rolecard = await rolecardStorage.getLatestRolecard(user._id);

        if (rolecard) {
          userData.companionChat = {
            memoryTokenCount: 0,
            currentMode: 'mode1',
            relationships: [],
            roleCard: {
              personality: rolecard.systemPrompt,
              background: '',
              interests: [],
              communicationStyle: '',
              values: [],
              emotionalNeeds: [],
              lifeMilestones: [],
              preferences: [],
              strangerInitialSentiment: '',
              generatedAt: rolecard.generatedAt,
              updatedAt: rolecard.generatedAt,
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
      } catch (error) {
        console.error('[AuthService] 从文件系统读取角色卡失败:', error);
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
    }

    // 如果用户有角色但没有companionChat，添加到companionChat
    if (user.role && !userData.companionChat?.roleCard) {
      const rolecardStorage = new RolecardStorage();
      const rolecard = await rolecardStorage.getLatestRolecard(user._id);

      if (rolecard) {
        userData.companionChat.roleCard = {
          personality: rolecard.systemPrompt,
          background: '',
          interests: [],
          communicationStyle: '',
          values: [],
          emotionalNeeds: [],
          lifeMilestones: [],
          preferences: [],
          strangerInitialSentiment: '',
          generatedAt: rolecard.generatedAt,
          updatedAt: rolecard.generatedAt
        };
      }
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