import express from 'express';
import memoryStorage from '../services/memoryStorage.js';
import SentimentAnalyzer from '../services/sentimentAnalyzer.js';
import RoleCardGenerator from '../services/roleCardGenerator.js';
import VectorIndexService from '../services/vectorIndexService.js';
import DialogueMemoryService from '../services/dialogueMemoryService.js';
import ChatEngine from '../services/chatEngine.js';

const router = express.Router();
const sentimentAnalyzer = new SentimentAnalyzer();
const roleCardGenerator = new RoleCardGenerator();
const vectorService = new VectorIndexService();
const dialogueMemoryService = new DialogueMemoryService();
const chatEngine = new ChatEngine();

router.post('/init', async (req, res) => {
  try {
    const { userId } = req.body;
    
    await memoryStorage.initializeUserFolder(userId);
    
    res.json({ success: true, message: 'Chat-Beta initialized successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status/:userId', async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      success: true,
      data: {
        memoryTokenCount: user.chatBeta?.memoryTokenCount || 0,
        currentMode: user.chatBeta?.currentMode || 'mode1',
        modelStatus: user.chatBeta?.modelStatus || {},
        relationshipsCount: user.chatBeta?.relationships?.length || 0,
        hasRoleCard: !!user.chatBeta?.roleCard,
        roleCardVersion: user.chatBeta?.roleCard?.version || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 步骤 3.1：登录与关系识别
router.post('/login', async (req, res) => {
  try {
    const { myUserId, targetUserId } = req.body;
    const User = (await import('../models/User.js')).default;
    const AssistRelation = (await import('../models/AssistRelation.js')).default;
    const Question = (await import('../models/Question.js')).default;

    if (!myUserId || !targetUserId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const myUser = await User.findById(myUserId);
    const targetUser = await User.findById(targetUserId);

    if (!myUser || !targetUser) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 检查协助关系
    const hasRelation = await AssistRelation.hasRelation(myUserId, targetUserId);
    let relation = {
      relationType: 'stranger',
      specificRelation: null,
      isAssisted: false,
      showAffinity: true,
      affinityScore: 0
    };

    if (hasRelation) {
      const relationDoc = await AssistRelation.findOne({
        assistantId: myUserId,
        targetId: targetUserId,
        isActive: true
      });
      
      relation.relationType = relationDoc.relationshipType;
      relation.isAssisted = true;
      relation.showAffinity = false;

      // 尝试加载或创建关系记录
      const existingRel = targetUser.chatBeta?.relationships?.find(
        r => r.userId.toString() === myUserId
      );

      if (existingRel) {
        relation.affinityScore = existingRel.affinityScore || 0;
        relation.specificRelation = existingRel.specificRelation || null;
      }

      // 尝试识别具体关系（从问题的答案中推断）
      const answers = await (await import('../models/Answer.js')).default.find({
        userId: myUserId,
        targetUserId
      });
      
      if (answers.length > 0 && answers[0].relationshipType === 'family') {
        const familyQuestion = await Question.findOne({ role: 'family' });
        if (familyQuestion) {
          relation.specificRelation = 'family_member';
        }
      }
    } else {
      // 陌生人，初始化好感度
      const existingRel = targetUser.chatBeta?.relationships?.find(
        r => r.userId.toString() === myUserId
      );

      if (existingRel) {
        relation.affinityScore = existingRel.affinityScore || 0;
      } else {
        // 首次对话，初始化关系
        await User.findByIdAndUpdate(targetUserId, {
          $push: {
            'chatBeta.relationships': {
              userId: myUserId,
              relationType: 'stranger',
              affinityScore: 0,
              isAssisted: false
            }
          }
        });
      }
    }

    res.json({
      success: true,
      relation,
      targetUser: {
        name: targetUser.name,
        uniqueCode: targetUser.uniqueCode
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 步骤 3.2：更新好感度（仅对陌生人）
router.post('/affinity/update', async (req, res) => {
  try {
    const { targetUserId, dialogPartnerId, message } = req.body;
    const User = (await import('../models/User.js')).default;

    if (!targetUserId || !dialogPartnerId || !message) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const relation = targetUser.chatBeta?.relationships?.find(
      r => r.userId.toString() === dialogPartnerId
    );

    if (!relation) {
      return res.status(404).json({ success: false, error: '关系不存在' });
    }

    // 已协助关系不更新好感度
    if (relation.isAssisted) {
      return res.json({
        success: true,
        message: '已协助关系，无需更新好感度',
        affinityScore: relation.affinityScore
      });
    }

    // 分析情感得分
    const sentimentScore = sentimentAnalyzer.analyze(message);
    
    // 调整好感度
    const newScore = sentimentAnalyzer.adjustAffinity(relation.affinityScore, sentimentScore);
    
    // 判断是否应该拒绝/禁止对话
    const shouldReject = sentimentAnalyzer.shouldRejectDialog(newScore);
    const shouldBan = sentimentAnalyzer.shouldBan(newScore);

    // 更新关系记录
    const updateResult = await User.updateOne(
      { _id: targetUserId, 'chatBeta.relationships.userId': dialogPartnerId },
      {
        $set: {
          'chatBeta.relationships.$.affinityScore': newScore,
          'chatBeta.relationships.$.lastInteractionDate': new Date()
        }
      }
    );

    res.json({
      success: true,
      affinityScore: newScore,
      sentimentScore,
      relationLevel: sentimentAnalyzer.getRelationLevel(newScore),
      canChat: !shouldReject,
      isBanned: shouldBan
    });
  } catch (error) {
    console.error('更新好感度失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 步骤 4.1+4.2：生成角色卡
router.post('/rolecard/generate', async (req, res) => {
  try {
    const { userId, tokenCount } = req.body;
    const User = (await import('../models/User.js')).default;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    // 检查记忆 token 量
    const requiredTokenCount = 1000; // 最低要求
    const currentTokenCount = user.chatBeta?.memoryTokenCount || 0;

    if (currentTokenCount < requiredTokenCount) {
      return res.status(400).json({ 
        success: false, 
        error: `记忆量不足，当前：${currentTokenCount}，最低要求：${requiredTokenCount}` 
      });
    }

    // 生成角色卡
    const roleCard = await roleCardGenerator.generateRoleCard(userId);

    // 存储到数据库
    await User.findByIdAndUpdate(userId, {
      $set: { 'chatBeta.roleCard': roleCard }
    });

    res.json({
      success: true,
      message: '角色卡生成成功',
      roleCard
    });
  } catch (error) {
    console.error('生成角色卡失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 步骤 4.3：检查是否需要更新角色卡
router.post('/rolecard/check-update', async (req, res) => {
  try {
    const { userId } = req.body;
    const User = (await import('../models/User.js')).default;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const currentTokenCount = user.chatBeta?.memoryTokenCount || 0;
    const tokenThreshold = 1000 * 1000; // 1000K

    // 检查是否需要更新
    const needsUpdate = currentTokenCount >= tokenThreshold &&
                       (!user.chatBeta?.roleCard || currentTokenCount >= (user.chatBeta?.roleCard?.lastUpdateToken || 0) + tokenThreshold);

    if (needsUpdate) {
      // 生成新角色卡
      const newRoleCard = await roleCardGenerator.generateRoleCard(userId);
      newRoleCard.lastUpdateToken = currentTokenCount;

      await User.findByIdAndUpdate(userId, {
        $set: { 'chatBeta.roleCard': newRoleCard }
      });

      res.json({
        success: true,
        message: '角色卡已自动更新',
        roleCard: newRoleCard
      });
    } else {
      res.json({
        success: true,
        message: '无需更新角色卡',
        needsUpdate
      });
    }
  } catch (error) {
    console.error('检查角色卡更新失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 第五部分：RAG 检索
// 步骤 5.1+5.2：构建向量索引和 RAG 检索
router.post('/rag/build-index', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户ID' });
    }

    const result = await vectorService.rebuildIndex(userId);
    res.json(result);
  } catch (error) {
    console.error('构建索引失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rag/search', async (req, res) => {
  try {
    const { userId, query, topK = 5, relationType } = req.body;

    if (!userId || !query) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const results = await vectorService.search(userId, query, topK);
    
    // 根据关系调整结果深度（陌生人简化，已协助关系完整）
    const simplifiedResults = relationType === 'stranger' 
      ? results.results.map(r => ({ ...r, content: r.content.slice(0, 100) + '...' }))
      : results.results;

    res.json({
      success: true,
      results: simplifiedResults,
      query
    });
  } catch (error) {
    console.error('RAG 搜索失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 第五、六部分：对话功能（Mode 1）
// 步骤 6.1+6.2：模式切换与 Mode 1 实现
router.post('/chat/start', async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const context = await chatEngine.startChat(userId, targetUserId);
    res.json({ success: true, context });
  } catch (error) {
    console.error('开始对话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/chat/send', async (req, res) => {
  try {
    const { userId, targetUserId, message, context } = req.body;

    if (!userId || !targetUserId || !message) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const result = await chatEngine.processMessage(userId, targetUserId, message, context);
    res.json(result);
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 步骤 6.5：Token 管理与防幻觉
router.get('/chat/token-usage/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const usage = chatEngine.tokenManager.getUserUsage(userId);
    res.json({ success: true, usage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/chat/reset-tokens/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    chatEngine.tokenManager.resetUserTokens(userId);
    res.json({ success: true, message: 'Token 已重置' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 对话记忆管理（第七部分）
router.post('/memories/self', async (req, res) => {
  try {
    const { content, tags = [] } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ success: false, error: '内容不能为空' });
    }

    const memory = await dialogueMemoryService.saveDialogueMemory(userId, {
      content,
      relationType: 'family',
      participants: [userId]
    });

    res.json({ success: true, memory });
  } catch (error) {
    console.error('保存自述失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/memories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { relationType } = req.query;

    const memories = await dialogueMemoryService.loadDialogueMemories(userId, relationType);
    res.json({ success: true, memories });
  } catch (error) {
    console.error('加载记忆失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;