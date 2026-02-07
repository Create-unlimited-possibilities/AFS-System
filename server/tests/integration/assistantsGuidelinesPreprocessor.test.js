/**
 * AssistantsGuidelinesPreprocessor 集成测试
 * 测试协助者对话准则预处理器的完整功能
 * 
 * 注意：此测试需要真实的数据库连接和 LLM 服务
 */

// 在任何 import 之前，取消 mongoose 的 mock
import { vi } from 'vitest';
vi.unmock('mongoose');
vi.unmock('../../src/models/User.js');
vi.unmock('../../src/models/Answer.js');
vi.unmock('../../src/models/Question.js');
vi.unmock('../../src/models/AssistRelation.js');

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// 导入真实的 mongoose
import mongoose from 'mongoose';

// 导入服务
import { assistantsGuidelinesPreprocessor } from '../../src/services/langchain/assistantsGuidelinesPreprocessor.js';
import { multiLLMClient } from '../../src/services/langchain/multiLLMClient.js';
import DualStorage from '../../src/services/dualStorage.js';

// 导入模型
import User from '../../src/models/User.js';
import Answer from '../../src/models/Answer.js';
import Question from '../../src/models/Question.js';
import AssistRelation from '../../src/models/AssistRelation.js';

// 测试数据库 URI
// 在 Docker Compose 环境中使用 mongoserver:27017
// 在本地测试中使用 localhost:27018
const TEST_MONGODB_URI = process.env.MONGO_URI?.replace('/afs_db', '/afs_test') || 'mongodb://localhost:27018/afs_test';

// 测试用户邮箱
const TEST_USER_EMAIL = 'dxs@gmail.com';

describe('AssistantsGuidelinesPreprocessor Integration Tests', () => {
  let testUserId = null;
  let testAssistantId = null;
  let testTargetId = null;
  let testRelationId = null;
  let testQuestionIds = [];

  beforeAll(async () => {
    // 确保数据库连接
    if (mongoose.connection.readyState !== 1) {
      console.log(`[Test] 连接到 MongoDB: ${TEST_MONGODB_URI}`);
      await mongoose.connect(TEST_MONGODB_URI);
    }
  });

  afterAll(async () => {
    // 关闭数据库连接
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // 查找或创建测试用户
    let testUser = await User.findOne({ email: TEST_USER_EMAIL });
    if (!testUser) {
      // 在测试数据库中创建测试用户
      testUser = await User.create({
        uniqueCode: 'DXS' + Date.now(),
        email: TEST_USER_EMAIL,
        password: 'password123',
        name: 'Test User',
        role: null,
        isActive: true
      });
    }
    testUserId = testUser._id;

    // 创建一个测试用的协助者用户
    const assistantUser = await User.create({
      uniqueCode: 'TEST' + Date.now(),
      email: `assistant_${Date.now()}@test.com`,
      password: 'password123',
      name: 'Test Assistant',
      role: testUser.role
    });
    testAssistantId = assistantUser._id;

    // 创建一个测试用的目标用户
    const targetUser = await User.create({
      uniqueCode: 'TARGET' + Date.now(),
      email: `target_${Date.now()}@test.com`,
      password: 'password123',
      name: 'Test Target User',
      role: testUser.role,
      companionChat: {
        roleCard: {
          personality: '温和友善',
          background: '普通的生活经历',
          interests: ['阅读', '旅行', '音乐'],
          communicationStyle: '友好且耐心',
          values: ['诚实', '尊重', '友善'],
          emotionalNeeds: ['被理解', '被关心', '陪伴'],
          lifeMilestones: ['成长经历', '学习经历', '工作经历'],
          preferences: ['安静的环境', '简单的生活', '和谐的关系'],
          memories: [],
          strangerInitialSentiment: 50,
          generatedAt: new Date(),
          updatedAt: new Date(),
          memoryTokenCount: 1000
        },
        modelStatus: {
          hasBaseModel: true
        }
      }
    });
    testTargetId = targetUser._id;

    // 创建测试问题（B套题和C套题）
    const basicQuestion = await Question.create({
      role: 'family',
      layer: 'basic',
      order: 1,
      question: '目标用户有什么爱好？',
      placeholder: '请描述爱好',
      type: 'textarea',
      active: true
    });
    testQuestionIds.push(basicQuestion._id);

    const emotionalQuestion = await Question.create({
      role: 'family',
      layer: 'emotional',
      order: 1,
      question: '目标用户最在乎什么？',
      placeholder: '请描述情感需求',
      type: 'textarea',
      active: true
    });
    testQuestionIds.push(emotionalQuestion._id);

    // 创建测试答案
    await Answer.create({
      userId: testAssistantId,
      targetUserId: testTargetId,
      questionId: basicQuestion._id,
      questionLayer: 'basic',
      answer: '喜欢看书、听音乐、旅游',
      isSelfAnswer: false,
      relationshipType: 'family'
    });

    await Answer.create({
      userId: testAssistantId,
      targetUserId: testTargetId,
      questionId: emotionalQuestion._id,
      questionLayer: 'emotional',
      answer: '最在乎家人的健康和幸福',
      isSelfAnswer: false,
      relationshipType: 'family'
    });

    // 创建协助关系
    const relation = await AssistRelation.create({
      assistantId: testUserId,
      targetId: testTargetId,
      relationshipType: 'family',
      specificRelation: '父子',
      friendLevel: 'close',
      isActive: true,
      guidelinesGenerated: false
    });
    testRelationId = relation._id;
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await AssistRelation.deleteMany({ assistantId: testUserId });
      await Answer.deleteMany({ userId: testAssistantId, targetUserId: testTargetId });
      await Question.deleteMany({ _id: { $in: testQuestionIds } });
      if (testAssistantId) {
        await User.deleteOne({ _id: testAssistantId });
      }
      if (testTargetId) {
        await User.deleteOne({ _id: testTargetId });
      }
    } catch (error) {
      console.error('清理测试数据失败:', error);
    }
  });

  describe('getAssistRelations', () => {
    it('应该成功获取所有协助者关系', async () => {
      const relations = await assistantsGuidelinesPreprocessor.getAssistRelations(testUserId);

      expect(relations).toBeDefined();
      expect(Array.isArray(relations)).toBe(true);
      expect(relations.length).toBeGreaterThan(0);
      expect(relations[0].targetId).toBeDefined();
      expect(relations[0].targetId.email).toBeDefined();
    });

    it('当用户没有协助者关系时应该抛出错误', async () => {
      const randomUserId = new mongoose.Types.ObjectId();

      await expect(
        assistantsGuidelinesPreprocessor.getAssistRelations(randomUserId)
      ).rejects.toThrow('未找到任何协助者关系');
    });
  });

  describe('collectAnswers', () => {
    it('应该成功收集B/C套题答案', async () => {
      const answers = await assistantsGuidelinesPreprocessor.collectAnswers(testAssistantId, testTargetId);

      expect(answers).toBeDefined();
      expect(answers.basic).toBeDefined();
      expect(answers.emotional).toBeDefined();
      expect(answers.basic.length).toBeGreaterThan(0);
      expect(answers.emotional.length).toBeGreaterThan(0);
      expect(answers.basic[0].question).toBeDefined();
      expect(answers.basic[0].answers).toBeDefined();
      expect(Array.isArray(answers.basic[0].answers)).toBe(true);
    });

    it('当没有答案时应该返回空数组', async () => {
      const randomTargetId = new mongoose.Types.ObjectId();
      const answers = await assistantsGuidelinesPreprocessor.collectAnswers(testAssistantId, randomTargetId);

      expect(answers.basic).toEqual([]);
      expect(answers.emotional).toEqual([]);
    });
  });

  describe('compressAnswers', () => {
    it('应该成功压缩答案', async () => {
      const answersWithQuestion = [
        {
          questionId: testQuestionIds[0],
          question: '目标用户有什么爱好？',
          questionLayer: 'basic',
          answers: [
            { userId: testAssistantId, answer: '喜欢看书', createdAt: new Date() },
            { userId: testAssistantId, answer: '喜欢听音乐', createdAt: new Date() }
          ]
        }
      ];

      const roleCard = {
        personality: '温和友善',
        communicationStyle: '友好且耐心'
      };

      // Mock LLM 响应
      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
        JSON.stringify({
          keyPoints: ['喜欢看书', '喜欢听音乐'],
          summary: '目标用户喜欢看书和听音乐'
        })
      );

      const compressed = await assistantsGuidelinesPreprocessor.compressAnswers(answersWithQuestion, roleCard);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBe(1);
      expect(compressed[0].questionId).toBeDefined();
      expect(compressed[0].compressed).toBeDefined();
      expect(compressed[0].originalAnswer).toBeDefined();
      expect(compressed[0].compressedAt).toBeDefined();

      vi.restoreAllMocks();
    });

    it('当LLM失败时应该保留原始答案', async () => {
      const answersWithQuestion = [
        {
          questionId: testQuestionIds[0],
          question: '目标用户有什么爱好？',
          questionLayer: 'basic',
          answers: [
            { userId: testAssistantId, answer: '喜欢看书', createdAt: new Date() }
          ]
        }
      ];

      const roleCard = {
        personality: '温和友善'
      };

      // Mock LLM 失败
      vi.spyOn(multiLLMClient, 'generate').mockRejectedValue(new Error('LLM调用失败'));

      const compressed = await assistantsGuidelinesPreprocessor.compressAnswers(answersWithQuestion, roleCard);

      expect(compressed.length).toBe(1);
      expect(compressed[0].compressed).toBeNull();
      expect(compressed[0].error).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('generateGuidelines', () => {
    it('应该成功生成对话准则', async () => {
      const compressedAnswers = [
        {
          questionId: testQuestionIds[0],
          question: '目标用户有什么爱好？',
          originalAnswer: '喜欢看书、听音乐',
          compressed: JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' }),
          questionLayer: 'basic'
        }
      ];

      const relation = {
        _id: testRelationId,
        relationshipType: 'family',
        specificRelation: '父子',
        assistantId: testTargetId
      };

      const targetRoleCard = {
        personality: '温和友善',
        communicationStyle: '友好且耐心',
        interests: ['阅读', '旅行', '音乐'],
        emotionalNeeds: ['被理解', '被关心']
      };

      // Mock LLM 响应
      const mockGuidelines = '语气：温和、友好\n\n沟通风格：耐心倾听，给予鼓励，用简单易懂的语言交流，避免使用复杂词汇\n\n话题建议：\n1. 家庭生活：聊聊家庭日常、子女情况、孙辈成长等\n2. 兴趣爱好：分享读书心得、旅游经历、音乐欣赏等\n3. 健康状况：关心身体状况，提醒按时吃药、适当运动\n4. 回忆往事：引导分享美好的回忆和经历\n\n避免话题：\n1. 不愉快的回忆和痛苦经历\n2. 争议性话题（政治、宗教等）\n3. 让人感到焦虑或恐惧的内容\n\n通过温和友好的语气，耐心倾听用户的需求，积极给予鼓励和支持。保持沟通的简单明了，避免使用复杂的专业词汇。选择用户感兴趣的话题，创造轻松愉快的交流氛围。';

      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(mockGuidelines);

      const guidelines = await assistantsGuidelinesPreprocessor.generateGuidelines(
        compressedAnswers,
        relation,
        targetRoleCard
      );

      expect(guidelines).toBeDefined();
      expect(typeof guidelines).toBe('string');
      expect(guidelines.length).toBeGreaterThan(200);

      vi.restoreAllMocks();
    });

    it('生成的准则应该包含关键信息', async () => {
      const compressedAnswers = [];
      const relation = { relationshipType: 'friend', specificRelation: '好朋友' };
      const targetRoleCard = { personality: '开朗' };

      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
        '语气：友好自然\n沟通风格：轻松随意\n话题建议：兴趣爱好、生活趣事\n避免话题：敏感话题'
      );

      const guidelines = await assistantsGuidelinesPreprocessor.generateGuidelines(
        compressedAnswers,
        relation,
        targetRoleCard
      );

      expect(guidelines).toContain('语气');
      expect(guidelines).toContain('沟通风格');

      vi.restoreAllMocks();
    });
  });

  describe('saveOneGuideline', () => {
    it('应该成功保存单个协助者的对话准则', async () => {
      const guideline = {
        assistantId: testTargetId,
        assistantName: 'Test Target User',
        assistantUniqueCode: 'TARGET',
        assistRelationId: testRelationId,
        relationType: 'family',
        specificRelation: '父子',
        conversationGuidelines: '语气：温和友好\n沟通风格：耐心倾听',
        compressedAnswers: [],
        generatedAt: new Date(),
        updatedAt: new Date(),
        isValid: true
      };

      const result = await assistantsGuidelinesPreprocessor.saveOneGuideline(testUserId, guideline);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.guideline).toBeDefined();
      expect(result.guideline.assistantId.toString()).toBe(testTargetId.toString());

      // 验证文件系统保存
      const dualStorage = new DualStorage();
      const loadedGuidelines = await dualStorage.loadAssistantsGuidelines(testUserId);
      expect(loadedGuidelines.length).toBeGreaterThan(0);
      expect(loadedGuidelines.some(g => g.assistantId.toString() === testTargetId.toString())).toBe(true);

      // 验证 MongoDB 保存
      const user = await User.findById(testUserId);
      expect(user.companionChat.assistantsGuidelines).toBeDefined();
      expect(user.companionChat.assistantsGuidelines.length).toBeGreaterThan(0);
      expect(user.companionChat.assistantsGuidelines.some(g => g.assistantId.toString() === testTargetId.toString())).toBe(true);
    });
  });

  describe('saveAllGuidelines', () => {
    it('应该成功保存所有协助者的对话准则', async () => {
      const guidelines = [
        {
          assistantId: testTargetId,
          assistantName: 'Test Target User',
          assistantUniqueCode: 'TARGET',
          assistRelationId: testRelationId,
          relationType: 'family',
          specificRelation: '父子',
          conversationGuidelines: '语气：温和友好',
          compressedAnswers: [],
          generatedAt: new Date(),
          updatedAt: new Date(),
          isValid: true
        }
      ];

      const result = await assistantsGuidelinesPreprocessor.saveAllGuidelines(testUserId, guidelines);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.count).toBe(guidelines.length);

      // 验证 MongoDB 更新
      const user = await User.findById(testUserId);
      expect(user.companionChat.assistantsGuidelines.length).toBe(guidelines.length);
      expect(user.companionChat.modelStatus.hasBaseModel).toBe(true);

      // 验证 AssistRelation 更新
      const relation = await AssistRelation.findById(testRelationId);
      expect(relation.guidelinesGenerated).toBe(true);
    });
  });

  describe('preprocessOne', () => {
    it('应该成功预处理单个协助者的对话准则', async () => {
      const relation = await AssistRelation.findById(testRelationId);

      // Mock LLM 响应
      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
        JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' })
      );
      vi.spyOn(multiLLMClient, 'generate').mockResolvedValueOnce(
        JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' })
      ).mockResolvedValueOnce(
        '语气：温和友好\n沟通风格：耐心倾听\n话题建议：家庭生活\n避免话题：不愉快回忆'
      );

      const result = await assistantsGuidelinesPreprocessor.preprocessOne(testUserId, testTargetId, relation);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.guideline).toBeDefined();
      expect(result.guideline.assistantId.toString()).toBe(testTargetId.toString());
      expect(result.guideline.conversationGuidelines).toBeDefined();
      expect(result.guideline.compressedAnswers).toBeDefined();
      expect(Array.isArray(result.guideline.compressedAnswers)).toBe(true);

      vi.restoreAllMocks();
    });

    it('当目标用户没有角色卡时应该抛出错误', async () => {
      // Mock LLM 以避免实际调用
      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
        '语气：温和友好\n沟通风格：耐心倾听\n话题建议：家庭生活\n避免话题：不愉快回忆'
      );

      // 创建一个没有角色卡的新用户
      const newUser = await User.create({
        uniqueCode: 'NO_ROLECARD' + Date.now(),
        email: `norolecard_${Date.now()}@test.com`,
        password: 'password123',
        name: 'No Rolecard User',
        role: null
      });

      // 创建协助关系
      const newRelation = await AssistRelation.create({
        assistantId: testUserId,
        targetId: newUser._id,
        relationshipType: 'family',
        specificRelation: '父子',
        friendLevel: 'close',
        isActive: true,
        guidelinesGenerated: false
      });

      await expect(
        assistantsGuidelinesPreprocessor.preprocessOne(testUserId, newUser._id, newRelation)
      ).rejects.toThrow('目标用户的角色卡不存在');

      vi.restoreAllMocks();
    });
  });

  describe('preprocessAll', () => {
    it('应该成功预处理所有协助者的对话准则', async () => {
      // Mock LLM 响应
      vi.spyOn(multiLLMClient, 'generate')
        .mockResolvedValue(JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' }))
        .mockResolvedValueOnce(JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' }))
        .mockResolvedValueOnce('语气：温和友好\n沟通风格：耐心倾听\n话题建议：家庭生活\n避免话题：不愉快回忆');

      const result = await assistantsGuidelinesPreprocessor.preprocessAll(testUserId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.total).toBeGreaterThan(0);
      expect(result.successful).toBeGreaterThan(0);
      expect(result.guidelines).toBeDefined();
      expect(Array.isArray(result.guidelines)).toBe(true);

      vi.restoreAllMocks();
    });

    it('应该记录处理失败的协助者', async () => {
      // Mock LLM 响应
      vi.spyOn(multiLLMClient, 'generate').mockRejectedValue(new Error('LLM调用失败'));

      const result = await assistantsGuidelinesPreprocessor.preprocessAll(testUserId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe('updateOneGuideline', () => {
    it('应该成功更新单个协助者的对话准则', async () => {
      const relation = await AssistRelation.findById(testRelationId);

      // Mock LLM 响应
      vi.spyOn(multiLLMClient, 'generate').mockResolvedValue(
        JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' })
      );
      vi.spyOn(multiLLMClient, 'generate')
        .mockResolvedValueOnce(JSON.stringify({ keyPoints: ['喜欢看书'], summary: '喜欢看书' }))
        .mockResolvedValueOnce('语气：温和友好\n沟通风格：耐心倾听\n话题建议：家庭生活\n避免话题：不愉快回忆');

      const result = await assistantsGuidelinesPreprocessor.updateOneGuideline(testUserId, testTargetId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.guideline).toBeDefined();

      vi.restoreAllMocks();
    });

    it('当协助关系不存在时应该抛出错误', async () => {
      const randomAssistantId = new mongoose.Types.ObjectId();

      await expect(
        assistantsGuidelinesPreprocessor.updateOneGuideline(testUserId, randomAssistantId)
      ).rejects.toThrow('协助关系不存在');
    });
  });
});
