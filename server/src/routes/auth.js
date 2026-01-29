// server/src/routes/auth.js - 重构版（统一注册登录）
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AssistRelation from '../models/AssistRelation.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'afs-super-secret-key-2025-change-me-in-production';

// 统一注册接口（仅需邮箱+密码）
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '邮箱和密码为必填项' 
      });
    }

    // 检查邮箱是否已存在
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: '该邮箱已被注册' 
      });
    }

    // 生成唯一专属编号
    const uniqueCode = await User.generateUniqueCode();

    // 创建新用户
    const newUser = new User({
      email: email.toLowerCase(),
      password,
      name: name || '用户',
      uniqueCode
    });

    await newUser.save();

    // 生成JWT token
    const token = jwt.sign(
      { 
        id: newUser._id, 
        email: newUser.email,
        uniqueCode: newUser.uniqueCode
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        uniqueCode: newUser.uniqueCode
      }
    });

  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 统一登录接口（邮箱+密码）
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入邮箱和密码' 
      });
    }

    // 查找用户
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: '密码错误' 
      });
    }

    // 更新最后登录时间
    user.lastLogin = new Date();
    await user.save();

    // 生成JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        uniqueCode: user.uniqueCode
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        uniqueCode: user.uniqueCode
      }
    });

  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 验证并创建协助关系
router.post('/assist/verify', protect, async (req, res) => {
  try {
    const { targetCode, targetEmail, relationshipType } = req.body;
    const assistantId = req.user.id; // 从auth中间件获取

    // 验证必填字段
    if (!targetCode || !targetEmail || !relationshipType) {
      return res.status(400).json({ 
        success: false, 
        message: '请填写完整信息' 
      });
    }

    // 验证关系类型
    if (!['family', 'friend'].includes(relationshipType)) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的关系类型' 
      });
    }

    // 查找目标用户（需要编号和邮箱都匹配）
    const targetUser = await User.findOne({ 
      uniqueCode: targetCode,
      email: targetEmail.toLowerCase()
    });

    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: '用户信息不匹配，请检查编号和邮箱' 
      });
    }

    // 不能协助自己
    if (targetUser._id.toString() === assistantId) {
      return res.status(400).json({ 
        success: false, 
        message: '不能协助自己' 
      });
    }

    // 检查是否已存在协助关系
    const existingRelation = await AssistRelation.findOne({
      assistantId,
      targetId: targetUser._id
    });

    if (existingRelation) {
      return res.status(409).json({ 
        success: false, 
        message: '已经建立了协助关系' 
      });
    }

    // 创建协助关系
    const assistRelation = new AssistRelation({
      assistantId,
      targetId: targetUser._id,
      relationshipType
    });

    await assistRelation.save();

    res.json({
      success: true,
      message: '协助关系建立成功',
      relation: {
        targetUser: {
          id: targetUser._id,
          name: targetUser.name,
          uniqueCode: targetUser.uniqueCode
        },
        relationshipType
      }
    });

  } catch (err) {
    console.error('验证协助关系失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取我的所有协助关系
router.get('/assist/relations', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const relations = await AssistRelation.getAssistRelations(userId);

    res.json({
      success: true,
      relations: relations.map(r => ({
        id: r._id,
        targetUser: {
          id: r.targetId._id,
          name: r.targetId.name,
          uniqueCode: r.targetId.uniqueCode,
          email: r.targetId.email
        },
        relationshipType: r.relationshipType,
        createdAt: r.createdAt
      }))
    });

  } catch (err) {
    console.error('获取协助关系失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

// 获取当前用户信息
router.get('/me', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        uniqueCode: user.uniqueCode,
        createdAt: user.createdAt
      }
    });

  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
});

export default router;
