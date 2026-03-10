/**
 * Admin Service
 * Business logic for admin operations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import User from '../user/model.js';
import Question from '../qa/models/question.js';
import Answer from '../qa/models/answer.js';
import AssistRelation from '../assist/model.js';
import ChatSession from '../chat/model.js';
import InviteCode from './models/inviteCode.js';
import logger from '../../core/utils/logger.js';
import mongoose from 'mongoose';
import ChromaDBService from '../../core/storage/chroma.js';
import modelInfoService from '../../core/llm/modelInfoService.js';

class AdminService {
  /**
   * User Management
   */
  async getUsers({ page = 1, limit = 20, search = '', role = '', isActive = '' }) {
    const query = {};

    // Search by name, email, or uniqueCode
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uniqueCode: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== '') {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('role', 'name description isAdmin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
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
    const user = await User.findById(userId)
      .select('-password')
      .populate('role', 'name description isAdmin permissions')
      .lean();

    if (!user) {
      throw new Error('用户不存在');
    }

    // Get additional stats
    const [answerCount, sessionCount, relationCount] = await Promise.all([
      Answer.countDocuments({ targetUserId: userId }),
      ChatSession.countDocuments({ targetUserId: userId }),
      AssistRelation.countDocuments({ $or: [{ targetId: userId }, { assistantId: userId }] })
    ]);

    // Calculate profile completion for ziwei chart
    const profile = user.profile;
    const missingFields = [];
    if (!profile?.gender || profile.gender === '其他') {
      missingFields.push('性别');
    }
    if (!profile?.birthDate) {
      missingFields.push('出生日期');
    }
    if (profile?.birthHour === undefined || profile?.birthHour === null) {
      missingFields.push('出生时辰');
    }

    const profileCompletion = {
      isComplete: missingFields.length === 0,
      missingFields
    };

    return {
      ...user,
      stats: {
        answerCount,
        sessionCount,
        relationCount
      },
      profileCompletion
    };
  }

  async updateUser(userId, updateData) {
    const allowedUpdates = ['name', 'email', 'role', 'isActive', 'profile'];
    const filteredData = {};

    for (const key of allowedUpdates) {
      if (updateData[key] !== undefined) {
        filteredData[key] = updateData[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      filteredData,
      { new: true, runValidators: true }
    ).select('-password').populate('role', 'name description');

    if (!user) {
      throw new Error('用户不存在');
    }

    return user;
  }

  async deleteUser(userId) {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // Delete related data
    await Promise.all([
      Answer.deleteMany({ $or: [{ userId }, { targetUserId: userId }] }),
      ChatSession.deleteMany({ $or: [{ targetUserId: userId }, { interlocutorUserId: userId }] }),
      AssistRelation.deleteMany({ $or: [{ targetId: userId }, { assistantId: userId }] })
    ]);

    await User.findByIdAndDelete(userId);

    return { success: true, message: '用户已删除' };
  }

  /**
   * Questionnaire Management
   */
  async getQuestions({ role, layer, active }) {
    const query = {};

    if (role) query.role = role;
    if (layer) query.layer = layer;
    if (active !== undefined) query.active = active === 'true';

    const questions = await Question.find(query)
      .sort({ layer: 1, order: 1 })
      .lean();

    return questions;
  }

  async getQuestionById(questionId) {
    const question = await Question.findById(questionId).lean();

    if (!question) {
      throw new Error('问题不存在');
    }

    return question;
  }

  async createQuestion(questionData) {
    // Get the highest order for the given role and layer
    const lastQuestion = await Question.findOne({
      role: questionData.role,
      layer: questionData.layer
    }).sort({ order: -1 });

    const order = lastQuestion ? lastQuestion.order + 1 : 1;

    const question = await Question.create({
      ...questionData,
      order
    });

    return question;
  }

  async updateQuestion(questionId, updateData) {
    const question = await Question.findByIdAndUpdate(
      questionId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!question) {
      throw new Error('问题不存在');
    }

    return question;
  }

  async deleteQuestion(questionId) {
    const question = await Question.findByIdAndDelete(questionId);

    if (!question) {
      throw new Error('问题不存在');
    }

    // Delete associated answers
    await Answer.deleteMany({ questionId });

    return { success: true, message: '问题已删除' };
  }

  async reorderQuestion(questionId, newOrder) {
    if (typeof newOrder !== 'number' || newOrder < 1) {
      throw new Error('无效的顺序值');
    }

    const question = await Question.findById(questionId);

    if (!question) {
      throw new Error('问题不存在');
    }

    // Get all questions in the same role and layer
    const allQuestions = await Question.find({
      role: question.role,
      layer: question.layer
    }).sort({ order: 1 });

    if (newOrder > allQuestions.length) {
      throw new Error('顺序值超出范围');
    }

    // Update orders for affected questions
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (question.order < newOrder) {
        // Moving down - decrement questions between old and new position
        await Question.updateMany(
          {
            _id: { $ne: questionId },
            role: question.role,
            layer: question.layer,
            order: { $gt: question.order, $lte: newOrder }
          },
          { $inc: { order: -1 } },
          { session }
        );
      } else {
        // Moving up - increment questions between new and old position
        await Question.updateMany(
          {
            _id: { $ne: questionId },
            role: question.role,
            layer: question.layer,
            order: { $gte: newOrder, $lt: question.order }
          },
          { $inc: { order: 1 } },
          { session }
        );
      }

      // Update the moved question
      question.order = newOrder;
      await question.save({ session });

      await session.commitTransaction();
      return question;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async toggleQuestionStatus(questionId, active) {
    if (typeof active !== 'boolean') {
      throw new Error('无效的状态值');
    }

    const question = await Question.findByIdAndUpdate(
      questionId,
      { active },
      { new: true, runValidators: true }
    );

    if (!question) {
      throw new Error('问题不存在');
    }

    return question;
  }

  async batchImportQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('无效的问题列表');
    }

    const imported = [];
    const failed = [];
    const errors = [];

    for (const questionData of questions) {
      try {
        // Validate required fields
        if (!questionData.role || !questionData.layer || !questionData.question) {
          throw new Error('缺少必填字段 (role, layer, question)');
        }

        // Get the highest order for the given role and layer
        const lastQuestion = await Question.findOne({
          role: questionData.role,
          layer: questionData.layer
        }).sort({ order: -1 });

        const order = lastQuestion ? lastQuestion.order + 1 : 1;

        const question = await Question.create({
          role: questionData.role,
          layer: questionData.layer,
          question: questionData.question,
          significance: questionData.significance || '',
          placeholder: questionData.placeholder || '',
          type: questionData.type || 'textarea',
          active: questionData.active !== undefined ? questionData.active : true,
          order
        });

        imported.push(question);
      } catch (error) {
        failed.push(questionData);
        errors.push(`${questionData.question || 'Unknown'}: ${error.message}`);
      }
    }

    return {
      imported: imported.length,
      failed: failed.length,
      errors,
      questions: imported
    };
  }

  async exportQuestions({ role, layer }) {
    const query = {};

    if (role) query.role = role;
    if (layer) query.layer = layer;

    const questions = await Question.find(query)
      .sort({ role: 1, layer: 1, order: 1 })
      .lean();

    return questions;
  }

  /**
   * Memory Management
   */
  /**
   * Get user memory summaries for admin panel
   * Returns a list of users with their memory statistics
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search by name, email, or uniqueCode
   * @returns {Promise<Object>} Users with memory stats and pagination
   */
  async getUserMemorySummaries({ page = 1, limit = 20, search = '' }) {
    const query = {};

    // Search by name, email, or uniqueCode
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uniqueCode: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    // Get users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Get memory counts and vector index status for each user
    const VectorIndexService = (await import('../../core/storage/vector.js')).default;
    const vectorService = new VectorIndexService();

    const userSummaries = await Promise.all(
      users.map(async (user) => {
        // Count memories (Answer records where targetUserId = user._id)
        const memoryCount = await Answer.countDocuments({ targetUserId: user._id });

        // Get last memory update time
        const lastMemory = await Answer.findOne({ targetUserId: user._id })
          .sort({ createdAt: -1 })
          .select('createdAt')
          .lean();

        // Check if vector index exists
        let vectorIndexExists = false;
        try {
          vectorIndexExists = await vectorService.indexExists(String(user._id));
        } catch (error) {
          logger.warn(`[AdminService] Failed to check vector index for user ${user._id}:`, error.message);
        }

        // Check if roleCard is generated
        const roleCardGenerated = !!(user.companionChat?.roleCard &&
          (user.companionChat.roleCard.personality ||
           user.companionChat.roleCard.background ||
           user.companionChat.roleCard.generatedAt));

        return {
          _id: String(user._id),
          id: String(user._id),
          name: user.name,
          uniqueCode: user.uniqueCode,
          email: user.email,
          memoryCount,
          vectorIndexExists,
          lastMemoryUpdate: lastMemory?.createdAt?.toISOString() || null,
          roleCardGenerated
        };
      })
    );

    return {
      users: userSummaries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getMemories({ page = 1, limit = 20, userId, search = '' }) {
    const query = {};

    if (userId) {
      query.$or = [
        { userId: userId },
        { targetUserId: userId }
      ];
    }

    if (search) {
      query.answer = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [memories, total] = await Promise.all([
      Answer.find(query)
        .populate('userId', 'name email uniqueCode')
        .populate('targetUserId', 'name email uniqueCode')
        .populate('questionId', 'question')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Answer.countDocuments(query)
    ]);

    return {
      memories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getMemoryStats() {
    const [totalMemories, uniqueUsers, layerStats] = await Promise.all([
      Answer.countDocuments(),
      Answer.distinct('targetUserId').then(ids => ids.length),
      Answer.aggregate([
        {
          $group: {
            _id: '$questionLayer',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return {
      totalMemories,
      uniqueUsers,
      byLayer: layerStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }

  async getUserMemories(userId) {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const memories = [];

    // 1. Get questionnaire answers for this user
    const answers = await Answer.find({ targetUserId: userId })
      .populate('userId', 'name email uniqueCode')
      .populate('questionId', 'question role layer')
      .sort({ createdAt: -1 })
      .lean();

    // Transform Answer documents to UserMemory format
    for (const answer of answers) {
      // Map role to category (elder -> self)
      const roleToCategory = {
        'elder': 'self',
        'family': 'family',
        'friend': 'friend'
      };
      const role = answer.questionId?.role || 'elder';
      const category = roleToCategory[role] || 'self';

      memories.push({
        _id: String(answer._id),
        userId: String(answer.targetUserId?._id || answer.targetUserId),
        category: category,
        content: answer.answer || answer.content || '',
        sourceType: 'answer',
        tags: answer.tags || [],
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt || answer.createdAt
      });
    }

    // 2. Get conversation memories from MemoryStore
    try {
      const MemoryStore = (await import('../memory/MemoryStore.js')).default;
      const memoryStore = new MemoryStore();
      const conversationMemories = await memoryStore.loadUserMemories(userId);

      // Transform conversation memories to UserMemory format
      for (const [partnerId, partnerMemories] of Object.entries(conversationMemories)) {
        for (const mem of partnerMemories) {
          // Extract summary for display
          let summary = '';
          if (mem.content?.processed?.summary) {
            summary = mem.content.processed.summary;
          } else if (mem.content?.processed?.keyTopics?.length > 0) {
            summary = `话题: ${mem.content.processed.keyTopics.join(', ')}`;
          }

          // Parse raw content to get formatted messages
          let rawMessages = [];
          let rawContent = '';
          if (mem.content?.raw) {
            try {
              rawMessages = JSON.parse(mem.content.raw);
              rawContent = mem.content.raw;
            } catch (e) {
              rawContent = mem.content.raw;
            }
          }

          memories.push({
            _id: mem.memoryId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: String(userId),
            category: 'conversation', // Special category for conversation memories
            content: rawContent, // Full raw conversation (JSON string)
            summary: summary || null, // LLM-extracted summary
            keyTopics: mem.content?.processed?.keyTopics || [],
            facts: mem.content?.processed?.facts || [],
            rawMessages: rawMessages, // Parsed messages array for frontend display
            messageCount: mem.meta?.messageCount || rawMessages.length,
            sourceType: 'conversation',
            tags: mem.tags || [],
            partnerId: partnerId,
            indexed: mem.vectorIndex?.indexed || false,
            createdAt: mem.meta?.createdAt || new Date().toISOString(),
            updatedAt: mem.meta?.compressedAt || mem.meta?.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (error) {
      // MemoryStore might not have data, which is fine
      logger.debug('[AdminService] No conversation memories found for user:', userId, error.message);
    }

    // Sort all memories by createdAt descending
    memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get memory count
    const memoryCount = memories.length;

    // Check if roleCard exists
    const hasRoleCard = !!(user.companionChat?.roleCard &&
      (typeof user.companionChat.roleCard === 'object' &&
       Object.keys(user.companionChat.roleCard).length > 0));

    // Get vector index status
    let vectorIndex = null;
    try {
      const VectorIndexService = (await import('../../core/storage/vector.js')).default;
      const vectorService = new VectorIndexService();
      const stats = await vectorService.getStats(userId);
      const indexExists = await vectorService.indexExists(userId);

      vectorIndex = {
        exists: indexExists,
        memoryCount: stats.totalDocuments || 0,
        hasRoleCard: hasRoleCard,
        canBuild: memoryCount > 0,
        totalDocuments: stats.totalDocuments || 0,
        collectionName: stats.collectionName || `user_${userId}`,
        lastBuildTime: memories.length > 0 ? memories[0].createdAt : null
      };
    } catch (error) {
      logger.warn('[AdminService] Failed to get vector index status:', error.message);
      vectorIndex = {
        exists: false,
        memoryCount: 0,
        hasRoleCard: hasRoleCard,
        canBuild: memoryCount > 0,
        totalDocuments: 0,
        collectionName: `user_${userId}`,
        lastBuildTime: null,
        error: error.message
      };
    }

    return {
      memories,
      vectorIndex
    };
  }

  async getUserVectorStatus(userId) {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // Get memory count from database
    const memoryCount = await Answer.countDocuments({ targetUserId: userId });

    // Check if roleCard exists
    const hasRoleCard = !!(user.companionChat?.roleCard &&
      (typeof user.companionChat.roleCard === 'object' &&
       Object.keys(user.companionChat.roleCard).length > 0));

    try {
      const VectorIndexService = (await import('../../core/storage/vector.js')).default;
      const vectorService = new VectorIndexService();

      const stats = await vectorService.getStats(userId);
      const indexExists = await vectorService.indexExists(userId);

      return {
        exists: indexExists,
        memoryCount: stats.totalDocuments || 0,
        hasRoleCard: hasRoleCard,
        canBuild: memoryCount > 0,
        totalDocuments: stats.totalDocuments || 0,
        collectionName: stats.collectionName || `user_${userId}`,
        lastBuildTime: indexExists ? new Date().toISOString() : null
      };
    } catch (error) {
      logger.warn('[AdminService] Failed to get vector index status:', error.message);
      return {
        exists: false,
        memoryCount: 0,
        hasRoleCard: hasRoleCard,
        canBuild: memoryCount > 0,
        totalDocuments: 0,
        collectionName: `user_${userId}`,
        lastBuildTime: null,
        error: error.message
      };
    }
  }

  async rebuildUserVectorIndex(userId) {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    try {
      const VectorIndexService = (await import('../../core/storage/vector.js')).default;
      const vectorService = new VectorIndexService();

      // Rebuild the index
      const result = await vectorService.rebuildIndex(userId);

      return {
        message: '向量索引重建成功',
        ...result
      };
    } catch (error) {
      logger.error('[AdminService] Failed to rebuild vector index:', error);
      throw new Error(`向量索引重建失败: ${error.message}`);
    }
  }

  async exportUserMemories(userId) {
    // Validate user exists
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('用户不存在');
    }

    // Get all memories for this user
    const memories = await Answer.find({ targetUserId: userId })
      .populate('userId', 'name email uniqueCode')
      .populate('questionId', 'question role layer order')
      .sort({ createdAt: -1 })
      .lean();

    // Get vector index status
    let vectorStatus = null;
    try {
      const VectorIndexService = (await import('../../core/storage/vector.js')).default;
      const vectorService = new VectorIndexService();
      vectorStatus = {
        exists: await vectorService.indexExists(userId),
        stats: await vectorService.getStats(userId)
      };
    } catch (error) {
      vectorStatus = { error: error.message };
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        uniqueCode: user.uniqueCode,
        createdAt: user.createdAt
      },
      memories,
      vectorStatus,
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Statistics & Dashboard
   */
  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    const [
      totalUsers,
      activeUsers,
      totalQuestions,
      totalAnswers,
      totalSessions,
      newUsersThisMonth,
      newUsersThisWeek,
      answersThisMonth
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Question.countDocuments({ active: true }),
      Answer.countDocuments(),
      ChatSession.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Answer.countDocuments({ createdAt: { $gte: startOfMonth } })
    ]);

    // Get user activity trend (last 7 days)
    const activityTrend = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersThisMonth,
        newThisWeek: newUsersThisWeek
      },
      content: {
        totalQuestions,
        totalAnswers,
        totalSessions
      },
      activity: {
        answersThisMonth,
        trend: activityTrend
      }
    };
  }

  /**
   * Invite Code Management
   */
  async getInviteCodes({ page = 1, limit = 20, status = '' }) {
    const query = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'used') {
      query.usedBy = { $exists: true, $ne: null };
    } else if (status === 'unused') {
      query.usedBy = { $exists: false };
    }

    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      InviteCode.find(query)
        .populate('createdBy', 'name email uniqueCode')
        .populate('usedBy', 'name email uniqueCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InviteCode.countDocuments(query)
    ]);

    return {
      codes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async createInviteCode({ maxUses = 1, createdBy, expiresAt }) {
    const code = await InviteCode.generateCode();

    const inviteCode = await InviteCode.create({
      code,
      maxUses,
      createdBy,
      expiresAt
    });

    return inviteCode;
  }

  async deleteInviteCode(codeId) {
    const inviteCode = await InviteCode.findByIdAndDelete(codeId);

    if (!inviteCode) {
      throw new Error('邀请码不存在');
    }

    return { success: true, message: '邀请码已删除' };
  }

  /**
   * Environment Variables (Read-only for display)
   */
  async getEnvironmentConfig() {
    return {
      llm: {
        backend: process.env.LLM_BACKEND || 'ollama',
        ollamaModel: process.env.OLLAMA_MODEL || 'deepseek-r1:14b',
        deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
      },
      embedding: {
        backend: process.env.EMBEDDING_BACKEND || 'ollama',
        model: process.env.EMBEDDING_MODEL || 'bge-m3'
      },
      database: {
        mongoUri: process.env.MONGO_URI?.replace(/\/[^@]+@/, '/****@') || '',
        chromaUrl: process.env.CHROMA_URL || ''
      },
      features: {
        googleTranslateEnabled: !!process.env.GOOGLE_TRANSLATE_API_KEY,
        openAIEnabled: !!process.env.OPENAI_API_KEY
      }
    };
  }

  /**
   * Dashboard & System Status Methods
   */
  async getDashboardStatsV2() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      activeUsers,
      totalMemories,
      totalQuestions,
      totalConversations,
      answeredQuestionIds
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ isActive: true }),
      Answer.countDocuments(),
      Question.countDocuments({ active: true }),
      ChatSession.countDocuments(),
      Answer.distinct('questionId')
    ]);

    // Count how many unique questions have at least one answer
    const answeredQuestionsCount = answeredQuestionIds.filter(id => id != null).length;

    const completionRate = totalQuestions > 0
      ? (answeredQuestionsCount / totalQuestions) * 100
      : 0;

    return {
      totalUsers,
      newUsersToday,
      activeUsers,
      totalMemories,
      questionnaireCompletionRate: Math.round(completionRate * 10) / 10,
      totalConversations
    };
  }

  /**
   * Check if a Docker container is running
   * This is much faster than HTTP health checks
   * @param {string} containerName - Name of the Docker container
   * @returns {Promise<boolean>} - True if container is running
   */
  async _checkDockerContainer(containerName) {
    try {
      const { execSync } = await import('child_process');
      const result = execSync(
        `docker ps --filter "name=${containerName}" --filter "status=running" -q`,
        { encoding: 'utf-8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      return result.trim().length > 0;
    } catch (error) {
      // Docker command failed (container not running or docker not available)
      return false;
    }
  }

  /**
   * Get system status using real API health checks
   * All checks run in parallel for fast response
   *
   * @returns {Promise<Object>} - System status with API health states
   */
  async getSystemStatusFast() {
    const llmBackend = process.env.LLM_BACKEND || 'ollama';
    // Configurable health check timeout (default 5s for fast status)
    const healthCheckTimeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10);

    const status = {
      mongodb: {
        connected: false,
        latency: undefined,
        containerRunning: false
      },
      chromadb: {
        connected: false,
        latency: undefined,
        containerRunning: false
      },
      llm: {
        connected: false,
        provider: llmBackend, // Use actual backend name (deepseek, ollama, openai)
        model: llmBackend === 'deepseek'
          ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
          : (process.env.OLLAMA_MODEL || 'deepseek-r1:14b'),
        containerRunning: false
      },
      vectorStore: {
        status: 'unknown',
        totalIndexes: 0
      },
      ziweiModel: {
        registered: false,
        name: process.env.ZIWEI_MODEL || 'ziwei-8b',
        size: undefined
      },
      checkMethod: 'api'
    };

    // Import services for real API health checks
    const LLMClient = (await import('../../core/llm/client.js')).default;
    const ChromaDBService = (await import('../../core/storage/chroma.js')).default;

    // Ollama base URL for model list check
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
    const ziweiModelName = process.env.ZIWEI_MODEL || 'ziwei-8b';

    // Run all health checks in parallel
    const [
      dockerMongoRunning,
      dockerChromaRunning,
      dockerOllamaRunning,
      mongoHealth,
      chromaHealth,
      llmApiHealthy,
      totalIndexes,
      ziweiModelInfo
    ] = await Promise.all([
      // Docker container checks (as fallback info)
      this._checkDockerContainer('mongoserver').catch(() => false),
      this._checkDockerContainer('chromaserver').catch(() => false),
      this._checkDockerContainer('modelserver').catch(() => false),

      // Real MongoDB health check using mongoose connection
      (async () => {
        try {
          const startTime = Date.now();
          if (mongoose.connection.readyState === 1) {
            // Connected - measure latency with a ping
            await mongoose.connection.db.admin().ping();
            return { connected: true, latency: Date.now() - startTime };
          }
          return { connected: false, latency: undefined };
        } catch (error) {
          logger.warn('[AdminService] MongoDB health check failed:', error.message);
          return { connected: false, latency: undefined };
        }
      })(),

      // Real ChromaDB health check
      (async () => {
        try {
          const startTime = Date.now();
          const chromaService = new ChromaDBService();
          const isHealthy = await chromaService.healthCheck();
          return { connected: isHealthy, latency: Date.now() - startTime };
        } catch (error) {
          logger.warn('[AdminService] ChromaDB health check failed:', error.message);
          return { connected: false, latency: undefined };
        }
      })(),

      // Real LLM API health check with timeout
      (async () => {
        try {
          const llmClient = new LLMClient(undefined, { backend: llmBackend });
          return await llmClient.healthCheck({ timeout: healthCheckTimeout });
        } catch (error) {
          logger.warn('[AdminService] LLM API health check failed:', error.message);
          return false;
        }
      })(),

      // Count total vector indexes (collections)
      (async () => {
        try {
          const chromaService = new ChromaDBService();
          await chromaService.initialize();
          const collections = await chromaService.listCollections();
          return collections.length;
        } catch (error) {
          logger.warn('[AdminService] Failed to count vector indexes:', error.message);
          return 0;
        }
      })(),

      // Check if configured ZIWEI_MODEL is registered in Ollama
      (async () => {
        try {
          const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(healthCheckTimeout)
          });

          if (!response.ok) {
            return { registered: false, name: ziweiModelName, size: undefined };
          }

          const data = await response.json();
          const models = data.models || [];

          // Find the configured model (exact match or prefix match for tags like :latest)
          // e.g., ZIWEI_MODEL=mingli-14b should match "mingli-14b:latest"
          const configuredModel = models.find(m =>
            m.name === ziweiModelName ||
            m.name.startsWith(ziweiModelName + ':')
          );

          if (configuredModel) {
            return {
              registered: true,
              name: configuredModel.name,
              size: configuredModel.size || 0
            };
          }

          return { registered: false, name: ziweiModelName, size: undefined };
        } catch (error) {
          logger.warn('[AdminService] Failed to check ziwei model:', error.message);
          return { registered: false, name: ziweiModelName, size: undefined };
        }
      })()
    ]);

    // Set status from health check results
    status.mongodb.containerRunning = dockerMongoRunning;
    status.mongodb.connected = mongoHealth.connected;
    status.mongodb.latency = mongoHealth.latency;

    status.chromadb.containerRunning = dockerChromaRunning;
    status.chromadb.connected = chromaHealth.connected;
    status.chromadb.latency = chromaHealth.latency;

    status.llm.containerRunning = dockerOllamaRunning;
    status.llm.connected = llmApiHealthy;

    status.vectorStore.status = chromaHealth.connected ? 'ready' : 'error';
    status.vectorStore.totalIndexes = totalIndexes;

    status.ziweiModel = ziweiModelInfo;

    return status;
  }

  /**
   * Get system status with optimized health checks
   * All checks run in parallel with reduced timeouts for faster response
   * LLM timeout reduced from 10s to 2s (configurable via HEALTH_CHECK_TIMEOUT_MS env var)
   */
  async getSystemStatus() {
    const VectorIndexService = (await import('../../core/storage/vector.js')).default;
    const LLMClient = (await import('../../core/llm/client.js')).default;

    // Configurable health check timeout (default 2s, previously 10s)
    const healthCheckTimeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '2000', 10);

    const status = {
      mongodb: {
        connected: false,
        latency: undefined
      },
      chromadb: {
        connected: false,
        latency: undefined
      },
      llm: {
        connected: false,
        provider: 'ollama',
        model: undefined
      },
      vectorStore: {
        status: 'error',
        totalIndexes: 0
      }
    };

    const llmBackend = process.env.LLM_BACKEND || 'ollama';
    status.llm.provider = llmBackend; // Use actual backend name (deepseek, ollama, openai)
    status.llm.model = llmBackend === 'deepseek'
      ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
      : (process.env.OLLAMA_MODEL || 'deepseek-r1:14b');

    // Run all health checks in parallel with reduced timeouts
    await Promise.allSettled([
      // MongoDB health check
      (async () => {
        try {
          const startTime = Date.now();
          if (mongoose.connection.readyState === 1) {
            // Connected - measure latency with a ping
            await mongoose.connection.db.admin().ping();
            status.mongodb.connected = true;
            status.mongodb.latency = Date.now() - startTime;
          } else {
            status.mongodb.connected = false;
          }
        } catch (error) {
          logger.error('[AdminService] MongoDB health check failed:', error.message);
          status.mongodb.connected = false;
        }
      })(),

      // ChromaDB and Vector Store health check
      (async () => {
        try {
          const vectorService = new VectorIndexService();
          const healthStartTime = Date.now();
          const healthResult = await vectorService.healthCheck();
          status.chromadb.latency = Date.now() - healthStartTime;

          if (healthResult.chromadb === 'connected') {
            status.chromadb.connected = true;
            status.vectorStore.status = healthResult.status === 'healthy' ? 'ready' : 'error';
          } else {
            status.chromadb.connected = false;
            status.vectorStore.status = 'error';
          }
        } catch (error) {
          logger.error('[AdminService] ChromaDB health check failed:', error.message);
          status.chromadb.connected = false;
          status.vectorStore.status = 'error';
        }
      })(),

      // Count total vector indexes (collections)
      (async () => {
        try {
          const ChromaDBService = (await import('../../core/storage/chroma.js')).default;
          const chromaService = new ChromaDBService();
          await chromaService.initialize();
          const collections = await chromaService.listCollections();
          status.vectorStore.totalIndexes = collections.length;
        } catch (error) {
          logger.error('[AdminService] Failed to count vector indexes:', error.message);
        }
      })(),

      // LLM health check with configurable timeout (default 2s, previously 10s)
      (async () => {
        try {
          const llmClient = new LLMClient(undefined, { backend: llmBackend });
          const isHealthy = await llmClient.healthCheck({ timeout: healthCheckTimeout });
          status.llm.connected = isHealthy;
        } catch (error) {
          logger.error('[AdminService] LLM health check failed:', error.message);
          status.llm.connected = false;
        }
      })()
    ]);

    return status;
  }

  async getRecentActivity(limit = 10) {
    const activities = [];

    // Get recent user registrations
    const recentUsers = await User.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .select('name uniqueCode createdAt')
      .sort({ createdAt: -1 })
      .limit(Math.ceil(limit / 3))
      .lean();

    for (const user of recentUsers) {
      activities.push({
        _id: `user_${user._id}`,
        type: 'user_registered',
        userId: user._id,
        userName: user.name,
        description: `新用户 ${user.name} 注册`,
        createdAt: user.createdAt
      });
    }

    // Get recent memories created
    const recentMemories = await Answer.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .populate('targetUserId', 'name')
      .populate('questionId', 'question')
      .sort({ createdAt: -1 })
      .limit(Math.ceil(limit / 3))
      .lean();

    for (const memory of recentMemories) {
      activities.push({
        _id: `memory_${memory._id}`,
        type: 'memory_created',
        userId: memory.targetUserId._id,
        userName: memory.targetUserId.name,
        description: `创建了新记忆`,
        createdAt: memory.createdAt
      });
    }

    // Get recent conversations
    const recentSessions = await ChatSession.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .populate('targetUserId', 'name')
      .sort({ createdAt: -1 })
      .limit(Math.ceil(limit / 3))
      .lean();

    for (const session of recentSessions) {
      activities.push({
        _id: `session_${session._id}`,
        type: 'conversation_started',
        userId: session.targetUserId._id,
        userName: session.targetUserId.name,
        description: `开始了新对话`,
        createdAt: session.createdAt
      });
    }

    // Sort by date and limit
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return activities.slice(0, limit);
  }

  /**
   * User Growth Data
   * Returns daily user registration counts with cumulative totals
   */
  async getUserGrowthData(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate cumulative total and format response
    let cumulative = 0;
    return dailyData.map(d => ({
      date: d._id,
      count: d.count,
      cumulative: (cumulative += d.count)
    }));
  }

  /**
   * Role & Permission Management
   */
  async getRoles() {
    const Role = (await import('../roles/models/role.js')).default;
    const Permission = (await import('../roles/models/permission.js')).default;

    const roles = await Role.find()
      .populate('permissions', 'name description category')
      .sort({ isSystem: -1, name: 1 })
      .lean();

    return roles;
  }

  async getRoleById(roleId) {
    const Role = (await import('../roles/models/role.js')).default;

    const role = await Role.findById(roleId)
      .populate('permissions', 'name description category')
      .lean();

    if (!role) {
      throw new Error('角色不存在');
    }

    return role;
  }

  async createRole({ name, description, permissionIds = [] }) {
    const Role = (await import('../roles/models/role.js')).default;

    if (!name || !name.trim()) {
      throw new Error('角色名称不能为空');
    }

    // Check if role name already exists
    const existingRole = await Role.findOne({ name: name.trim() });
    if (existingRole) {
      throw new Error('角色名称已存在');
    }

    // Validate permission IDs
    if (permissionIds.length > 0) {
      const Permission = (await import('../roles/models/permission.js')).default;
      const validPermissions = await Permission.find({ _id: { $in: permissionIds } });
      if (validPermissions.length !== permissionIds.length) {
        throw new Error('部分权限ID无效');
      }
    }

    const role = await Role.create({
      name: name.trim(),
      description: description || '',
      permissions: permissionIds,
      isSystem: false,
      isAdmin: false
    });

    // Populate permissions before returning
    await role.populate('permissions', 'name description category');

    return role;
  }

  async updateRole(roleId, { name, description, permissionIds }) {
    const Role = (await import('../roles/models/role.js')).default;
    const Permission = (await import('../roles/models/permission.js')).default;

    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    // Prevent modification of system roles
    if (role.isSystem) {
      throw new Error('不能修改系统角色');
    }

    // Update name if provided
    if (name && name.trim()) {
      // Check if new name conflicts with existing role
      const existingRole = await Role.findOne({
        name: name.trim(),
        _id: { $ne: roleId }
      });
      if (existingRole) {
        throw new Error('角色名称已存在');
      }
      role.name = name.trim();
    }

    // Update description if provided
    if (description !== undefined) {
      role.description = description;
    }

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Validate permission IDs
      const validPermissions = await Permission.find({ _id: { $in: permissionIds } });
      if (validPermissions.length !== permissionIds.length) {
        throw new Error('部分权限ID无效');
      }
      role.permissions = permissionIds;
    }

    await role.save();
    await role.populate('permissions', 'name description category');

    return role;
  }

  async deleteRole(roleId) {
    const Role = (await import('../roles/models/role.js')).default;
    const User = (await import('../user/model.js')).default;

    const role = await Role.findById(roleId);
    if (!role) {
      throw new Error('角色不存在');
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      throw new Error('不能删除系统角色');
    }

    // Check if role is assigned to any users
    const userCount = await User.countDocuments({ role: roleId });
    if (userCount > 0) {
      throw new Error(`该角色已分配给 ${userCount} 个用户，无法删除`);
    }

    await Role.findByIdAndDelete(roleId);

    return { success: true, message: '角色已删除' };
  }

  async getAllPermissions() {
    const Permission = (await import('../roles/models/permission.js')).default;

    const permissions = await Permission.find()
      .sort({ category: 1, name: 1 })
      .lean();

    return permissions;
  }

  /**
   * Get ziwei chart for a user (for admin panel)
   * Uses cached chart from ziweiChartService
   */
  async getZiweiChart(userId, { targetDate } = {}) {
    const ziweiChartService = (await import('../ziwei/services/ziweiChartService.js')).default;

    // Get cached chart
    const chart = await ziweiChartService.getChart(userId);

    if (!chart) {
      return {
        success: false,
        error: '用户命盘不存在'
      };
    }

    // Convert Mongoose document to plain object if needed
    const chartData = chart.toObject ? chart.toObject() : chart;

    // Always compute horoscope (real-time, not stored)
    const horoscopeDate = targetDate || new Date().toISOString().split('T')[0];
    let horoscope = null;
    try {
      const result = await ziweiChartService.computeHoroscope(userId, horoscopeDate);
      // computeHoroscope returns { userId, targetDate, horoscope }
      // We only want the inner horoscope object
      horoscope = result.horoscope || result;
    } catch (error) {
      logger.warn('[AdminService] Failed to compute horoscope:', error.message);
    }

    return {
      success: true,
      userId,
      chart: {
        ...chartData,
        horoscope
      }
    };
  }

  /**
   * ============================================
   * Model Management Methods
   * ============================================
   */

  /**
   * Helper: Get Ollama base URL
   */
  _getOllamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL || 'http://modelserver:11434';
  }

  /**
   * Helper: Fetch models from Ollama API
   */
  async _fetchOllamaModels() {
    const ollamaBaseUrl = this._getOllamaBaseUrl();
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10);

    try {
      const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logger.warn('[AdminService] Failed to fetch Ollama models:', error.message);
      return null;
    }
  }

  /**
   * Get model management status
   * Returns status of ziwei model, GGUF files, and registered models
   */
  async getModelManagementStatus() {
    const ollamaBaseUrl = this._getOllamaBaseUrl();
    const ziweiModelName = process.env.ZIWEI_MODEL || 'ziwei-8b';

    // Fetch all data in parallel
    const [ollamaModels, ggufFiles, modelfiles] = await Promise.all([
      this._fetchOllamaModels(),
      this.listGgufFiles().catch(() => []),
      this.listModelfiles().catch(() => [])
    ]);

    // Fetch context limits for all models in parallel
    let modelsWithLimits = [];
    if (ollamaModels && ollamaModels.length > 0) {
      const limitPromises = ollamaModels.map(async (model) => {
        try {
          const contextLimit = await modelInfoService.getContextLimit(model.name);
          return { ...model, contextLimit };
        } catch (error) {
          logger.warn(`[AdminService] Failed to get context limit for ${model.name}: ${error.message}`);
          return { ...model, contextLimit: 65536 }; // Default fallback
        }
      });
      modelsWithLimits = await Promise.all(limitPromises);
    }

    // Check ziwei model registration
    let ziweiModelStatus = { registered: false, name: ziweiModelName, size: undefined };
    if (modelsWithLimits.length > 0) {
      const ziweiModel = modelsWithLimits.find(m =>
        m.name === ziweiModelName ||
        m.name.startsWith(ziweiModelName + ':')
      );
      if (ziweiModel) {
        ziweiModelStatus = {
          registered: true,
          name: ziweiModel.name,
          size: ziweiModel.size || 0,
          contextLimit: ziweiModel.contextLimit
        };
      }
    }

    // Return format matching frontend ModelStatus interface
    return {
      ollama: {
        baseUrl: ollamaBaseUrl,
        models: modelsWithLimits || []
      },
      ggufFiles: ggufFiles.map(f => f.name),  // string array
      modelfiles: modelfiles.map(f => f.name), // string array
      ziweiModel: ziweiModelStatus,
      envConfig: {
        ZIWEI_MODEL: ziweiModelName,
        ZIWEI_TIMEOUT: process.env.ZIWEI_TIMEOUT || '120000',
        OLLAMA_BASE_URL: ollamaBaseUrl
      }
    };
  }

  /**
   * List all Ollama models
   */
  async listOllamaModels() {
    const models = await this._fetchOllamaModels();
    return models || [];
  }

  /**
   * Get detailed info for a specific model
   */
  async getModelInfo(modelName) {
    const ollamaBaseUrl = this._getOllamaBaseUrl();
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '10000', 10);

    try {
      const response = await fetch(`${ollamaBaseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('[AdminService] Failed to get model info:', error.message);
      throw error;
    }
  }

  /**
   * List available GGUF model files
   */
  async listGgufFiles() {
    const fs = await import('fs/promises');
    const path = await import('path');

    // GGUF files directory - check common locations
    // Docker volume mount: .\modelserver\models\gguf -> /app/models/gguf
    const ggufDirs = [
      '/app/models/gguf',        // Docker container path (mounted)
      './modelserver/models/gguf', // Local development
      '../modelserver/models/gguf' // Alternative local path
    ];

    const files = [];

    for (const dir of ggufDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.gguf')) {
            const filePath = path.join(dir, entry.name);
            const stats = await fs.stat(filePath);
            files.push({
              name: entry.name,
              path: filePath,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
        // If we found files in this directory, stop searching
        if (files.length > 0) break;
      } catch (error) {
        // Directory doesn't exist, try next
        continue;
      }
    }

    return files;
  }

  /**
   * List available Modelfile files
   */
  async listModelfiles() {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Modelfiles are stored in the same directory as GGUF files
    // Docker volume mount: .\modelserver\models\gguf -> /app/models/gguf
    const modelfileDirs = [
      '/app/models/gguf',          // Docker container path (mounted)
      './modelserver/models/gguf', // Local development
      '../modelserver/models/gguf' // Alternative local path
    ];

    const files = [];

    for (const dir of modelfileDirs) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          // Modelfiles: Modelfile.* or *.modelfile
          if (entry.isFile() && !entry.name.startsWith('.') && !entry.name.endsWith('.gguf') && !entry.name.endsWith('.md')) {
            const filePath = path.join(dir, entry.name);
            const stats = await fs.stat(filePath);
            files.push({
              name: entry.name,
              path: filePath,
              size: stats.size,
              modified: stats.mtime
            });
          }
        }
        // If we found files in this directory, stop searching
        if (files.length > 0) break;
      } catch (error) {
        // Directory doesn't exist, try next
        continue;
      }
    }

    return files;
  }

  /**
   * Read Modelfile content
   */
  async readModelfile(filename) {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);

    const modelfileDirs = [
      '/app/models/gguf',          // Docker container path (mounted)
      './modelserver/models/gguf', // Local development
      '../modelserver/models/gguf' // Alternative local path
    ];

    for (const dir of modelfileDirs) {
      const filePath = path.join(dir, safeName);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { name: safeName, content };
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Modelfile not found: ${safeName}`);
  }

  /**
   * Save Modelfile content
   */
  async saveModelfile(filename, content) {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);

    // Primary directory to save (Docker mounted path)
    const modelfileDir = '/app/models/gguf';

    try {
      // Ensure directory exists
      await fs.mkdir(modelfileDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const filePath = path.join(modelfileDir, safeName);
    await fs.writeFile(filePath, content, 'utf-8');

    logger.info(`[AdminService] Modelfile saved: ${safeName}`);
    return { success: true, name: safeName, message: 'Modelfile saved successfully' };
  }

  /**
   * Create a new Ollama model from Modelfile
   */
  async createModel(modelName, modelfileName, options = {}) {
    const ollamaBaseUrl = this._getOllamaBaseUrl();
    const timeout = parseInt(process.env.OLLAMA_TIMEOUT || '300000', 10); // 5 minutes default

    // Read modelfile content
    const { content: modelfileContent } = await this.readModelfile(modelfileName);

    try {
      const response = await fetch(`${ollamaBaseUrl}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName,
          modelfile: modelfileContent,
          stream: false
        }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create model: ${error}`);
      }

      const result = await response.json();
      logger.info(`[AdminService] Model created: ${modelName}`);

      return {
        success: true,
        message: `Model ${modelName} created successfully`,
        details: result
      };
    } catch (error) {
      logger.error('[AdminService] Failed to create model:', error.message);
      throw error;
    }
  }

  /**
   * Delete an Ollama model
   */
  async deleteModel(modelName, options = {}) {
    const ollamaBaseUrl = this._getOllamaBaseUrl();
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '30000', 10);

    try {
      const response = await fetch(`${ollamaBaseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete model: ${error}`);
      }

      logger.info(`[AdminService] Model deleted: ${modelName}`);

      return {
        success: true,
        message: `Model ${modelName} deleted successfully`
      };
    } catch (error) {
      logger.error('[AdminService] Failed to delete model:', error.message);
      throw error;
    }
  }

  /**
   * Get Ziwei Books (fortune-telling knowledge base) content
   * Reads from ChromaDB 'ziwei_books' collection
   * @param {Object} options - Query options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search query
   * @param {string} options.source - Filter by source book
   * @returns {Promise<Object>} Books data with pagination
   */
  async getZiweiBooks({ page = 1, limit = 20, search = '', source = '' } = {}) {
    try {
      const chromaService = new ChromaDBService();
      await chromaService.initialize();

      const collection = await chromaService.getCollection('ziwei_books');
      if (!collection) {
        logger.warn('[AdminService] ziwei_books collection not found');
        return {
          books: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        };
      }

      // Get all documents from collection
      const allDocs = await collection.get({
        include: ['documents', 'metadatas']
      });

      let books = (allDocs.documents || []).map((doc, index) => ({
        _id: allDocs.ids[index],
        content: doc,
        source: allDocs.metadatas?.[index]?.source || 'unknown',
        chunk_id: allDocs.metadatas?.[index]?.chunk_id || 0
      }));

      // Filter by source if provided
      if (source) {
        books = books.filter(book => book.source === source);
      }

      // Filter by search query if provided
      if (search) {
        const searchLower = search.toLowerCase();
        books = books.filter(book =>
          book.content.toLowerCase().includes(searchLower) ||
          book.source.toLowerCase().includes(searchLower)
        );
      }

      // Calculate pagination
      const total = books.length;
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;
      const paginatedBooks = books.slice(skip, skip + limit);

      logger.info(`[AdminService] Retrieved ${paginatedBooks.length} ziwei books (page ${page}/${totalPages})`);

      return {
        books: paginatedBooks,
        pagination: { page, limit, total, totalPages }
      };
    } catch (error) {
      logger.error('[AdminService] Failed to get ziwei books:', error.message);
      throw error;
    }
  }

  /**
   * Get Ziwei Books sources list
   * Returns distinct sources and their chunk counts
   * @returns {Promise<Object>} Sources list with counts
   */
  async getZiweiBooksSources() {
    try {
      const chromaService = new ChromaDBService();
      await chromaService.initialize();

      const collection = await chromaService.getCollection('ziwei_books');
      if (!collection) {
        logger.warn('[AdminService] ziwei_books collection not found');
        return { sources: [] };
      }

      // Get all documents from collection
      const allDocs = await collection.get({
        include: ['metadatas']
      });

      // Count by source
      const sourceCounts = {};
      for (const meta of (allDocs.metadatas || [])) {
        const source = meta?.source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      }

      // Convert to array format
      const sources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      logger.info(`[AdminService] Found ${sources.length} ziwei book sources`);

      return { sources };
    } catch (error) {
      logger.error('[AdminService] Failed to get ziwei books sources:', error.message);
      throw error;
    }
  }

  /**
   * Get XiaoShuDong (小树洞) usage statistics
   * @param {Object} options - Query options
   * @param {string} options.startDate - Start date filter (ISO string)
   * @param {string} options.endDate - End date filter (ISO string)
   * @param {string} options.userId - Filter by specific user
   * @returns {Promise<Object>} Statistics data
   */
  async getXiaoshudongStats({ startDate, endDate, userId } = {}) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Determine base path
      const isDocker = process.env.DOCKER_CONTAINER === 'true' || process.env.NODE_ENV === 'docker';
      const basePath = isDocker
        ? '/app/storage/userdata'
        : path.join(process.cwd(), 'server', 'storage', 'userdata');

      // Parse date filters
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Initialize stats
      const stats = {
        totalConversations: 0,
        totalUsers: 0,
        activeSessions: 0,
        dailyStats: [],
        phaseDistribution: {
          listening: 0,
          analysis: 0,
          transition: 0
        },
        avgTurnCount: 0,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      };

      // Get active sessions from orchestrator
      try {
        const orchestrator = (await import('../xiaoshudong/orchestrator.js')).default;
        stats.activeSessions = orchestrator.getSessionCount();
      } catch (error) {
        logger.warn('[AdminService] Could not get active sessions from orchestrator:', error.message);
      }

      // Read all user directories
      let userDirs;
      try {
        userDirs = await fs.readdir(basePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          logger.info('[AdminService] No userdata directory found');
          return stats;
        }
        throw error;
      }

      // Daily stats map: date string -> count
      const dailyMap = new Map();
      let totalTurnCount = 0;
      let conversationCount = 0;
      const userSet = new Set();

      // Process each user directory
      for (const userDir of userDirs) {
        // Skip if filtering by userId and this is not the target user
        if (userId && userDir !== userId) continue;

        const xiaoshudongPath = path.join(basePath, userDir, 'conversations', 'with_xiaoshudong');

        try {
          const files = await fs.readdir(xiaoshudongPath);

          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            try {
              const filePath = path.join(xiaoshudongPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const memory = JSON.parse(content);

              // Get creation date
              const createdAt = memory.meta?.createdAt ? new Date(memory.meta.createdAt) : null;

              // Filter by date range
              if (createdAt && createdAt >= start && createdAt <= end) {
                conversationCount++;
                userSet.add(userDir);

                // Count message turns
                const msgCount = memory.meta?.messageCount || 0;
                totalTurnCount += msgCount;

                // Daily stats
                const dateKey = createdAt.toISOString().split('T')[0];
                dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);

                // Phase distribution
                const phase = memory.content?.processed?.phase || 'listening';
                if (phase === 'listening') {
                  stats.phaseDistribution.listening++;
                } else if (phase === 'analysis') {
                  stats.phaseDistribution.analysis++;
                } else {
                  stats.phaseDistribution.transition++;
                }
              }
            } catch (parseError) {
              logger.warn(`[AdminService] Failed to parse memory file: ${file}`, parseError.message);
            }
          }
        } catch (dirError) {
          // Directory doesn't exist for this user, skip
          if (dirError.code !== 'ENOENT') {
            logger.warn(`[AdminService] Error reading xiaoshudong directory for user ${userDir}:`, dirError.message);
          }
        }
      }

      // Set final stats
      stats.totalConversations = conversationCount;
      stats.totalUsers = userSet.size;
      stats.avgTurnCount = conversationCount > 0 ? totalTurnCount / conversationCount : 0;

      // Convert daily map to sorted array
      stats.dailyStats = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      logger.info(`[AdminService] XiaoShuDong stats: ${stats.totalConversations} conversations, ${stats.totalUsers} users`);

      return stats;
    } catch (error) {
      logger.error('[AdminService] Failed to get XiaoShuDong stats:', error.message);
      throw error;
    }
  }
}

export default new AdminService();
