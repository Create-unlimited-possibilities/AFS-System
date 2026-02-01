// 聊天引擎服务 - 实现 Mode 1（角色卡 + RAG + 基底模型）
import RoleCardGenerator from './roleCardGenerator.js';
import VectorIndexService from './vectorIndexService.js';
import SentimentAnalyzer from './sentimentAnalyzer.js';
import TokenManager from './tokenManager.js';
import DialogueMemoryService from './dialogueMemoryService.js';

export default class ChatEngine {
  constructor() {
    this.roleCardGenerator = new RoleCardGenerator();
    this.vectorService = new VectorIndexService();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.tokenManager = new TokenManager();
    this.dialogueMemoryService = new DialogueMemoryService();

    // 基底模型配置
    this.baseModelConfig = {
      'mode1': {
        chinese: 'Qwen/Qwen2.5-7B-Instruct',  // 可配置
        english: 'meta-llama/Llama-3.2-3B-Instruct'
      },
      endpoint: 'http://localhost:11435/api/generate' // Ollama API
    };
  }

  async startChat(userId, targetUserId, initialMessage) {
    // 初始化或加载用户 Token 使用量
    const User = (await import('../models/User.js')).default;
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      throw new Error('目标用户不存在');
    }

    // 检查模式
    const tokenCount = targetUser.chatBeta?.memoryTokenCount || 0;
    const mode = this.determineMode(tokenCount);

    // 检查是否已生成角色卡
    if (mode === 'mode1' && !targetUser.chatBeta?.roleCard) {
      throw new Error('请先生成角色卡');
    }

    // 获取关系信息
    const AssistRelation = (await import('../models/AssistRelation.js')).default;
    const hasRelation = await AssistRelation.hasRelation(userId, targetUserId);
    
    let relation;
    const existingRel = targetUser.chatBeta?.relationships?.find(
      r => r.userId.toString() === userId
    );

    if (existingRel) {
      relation = {
        relationType: existingRel.relationType || (hasRelation ? 'family' : 'stranger'),
        isAssisted: existingRel.isAssisted || hasRelation,
        affinityScore: existingRel.affinityScore || 0,
        showAffinity: !(existingRel.isAssisted || hasRelation)
      };
    } else {
      relation = {
        relationType: hasRelation ? 'family' : 'stranger',
        isAssisted: hasRelation,
        affinityScore: 0,
        showAffinity: !hasRelation
      };
    }

    return {
      mode,
      relation,
      targetUser: {
        name: targetUser.name,
        uniqueCode: targetUser.uniqueCode
      }
    };
  }

  determineMode(tokenCount) {
    if (tokenCount < 30000) return 'mode1';
    if (tokenCount < 200000) return 'mode2';
    return 'mode3';
  }

  async processMessage(userId, targetUserId, message, context = {}) {
    const User = (await import('../models/User.js')).default;
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      throw new Error('目标用户不存在');
    }

    // 检查 Token 限制
    const tokenCheck = await this.checkTokenLimit(targetUserId);
    if (tokenCheck.status !== 'ok') {
      return {
        success: false,
        message: tokenCheck.message,
        action: tokenCheck.action || null
      };
    }

    // 获取关系信息
    const { relation } = context;

    // 更新好感度（如果是陌生人）
    if (!relation.isAssisted) {
      await this.updateAffinity(targetUserId, userId, message);
      relation.affinityScore = await this.getAffinityScore(targetUserId, userId);
      relation.relationLevel = this.sentimentAnalyzer.getRelationLevel(relation.affinityScore);
    }

    // RAG 检索相关记忆
    const ragResults = await this.vectorService.search(targetUserId, message, 5);

    // 加载角色卡
    const roleCard = targetUser.chatBeta?.roleCard;

    // 构建回复
    const response = await this.generateResponse(roleCard, relation, ragResults, message);

    // 更新 Token 使用量
    const messageTokens = await this.estimateTokens(message + response);
    await this.tokenManager.addMessageTokens(targetUserId, messageTokens);

    // 保存对话记忆
    await this.saveDialogue(userId, targetUserId, message, response, relation.relationType);

    return {
      success: true,
      response,
      ragResults: ragResults.results || [],
      relation: relation.relationLevel || 'stranger',
      tokenUsage: this.tokenManager.getUserUsage(targetUserId)
    };
  }

  async checkTokenLimit(userId) {
    const usage = this.tokenManager.getUserUsage(userId);
    const total = usage.total || 0;

    if (total >= 100000 && total / 100000 >= 1.0) {
      return {
        status: 'blocked',
        message: '对话已达上限，请开启新对话。'
      };
    }

    return { status: 'ok' };
  }

  async updateAffinity(targetUserId, userId, message) {
    const sentimentScore = this.sentimentAnalyzer.analyze(message);
    const User = (await import('../models/User.js')).default;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser || !targetUser.chatBeta?.relationships) return;

    const rel = targetUser.chatBeta.relationships.find(
      r => r.userId.toString() === userId
    );

    if (rel) {
      const newScore = this.sentimentAnalyzer.adjustAffinity(rel.affinityScore, sentimentScore);
      
      await User.updateOne(
        { _id: targetUserId, 'chatBeta.relationships.userId': userId },
        {
          $set: {
            'chatBeta.relationships.$.affinityScore': newScore,
            'chatBeta.relationships.$.lastInteractionDate': new Date()
          }
        }
      );
    }
  }

  async getAffinityScore(targetUserId, userId) {
    const User = (await import('../models/User.js')).default;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser?.chatBeta?.relationships) return 0;

    const rel = targetUser.chatBeta.relationships.find(
      r => r.userId.toString() === userId
    );

    return rel?.affinityScore || 0;
  }

  async generateResponse(roleCard, relation, ragResults, message) {
    // 简化的响应生成（实际应调用 Ollama 或其他 LLM API）
    const hasAffinity = relation.showAffinity;
    const affinityMessage = hasAffinity
      ? `当前好感度${relation.affinityScore}，你需要根据好感度调整回复深度（低好感更谨慎，高好感更开放）。`
      : '你们关系非常亲密，可以充分表达情感。';

    const ragText = ragResults.results && ragResults.results.length > 0
      ? `以下是你的相关记忆：\n${ragResults.results.map(r => r.content).join('\n\n')}`
      : '';

    const traits = roleCard?.sections?.selfCognition?.traits || ['温和', '善良'];
    const vulnerabilities = roleCard?.sections?.selfCognition?.vulnerabilities || [];

    // 这里简化处理，实际应调用模型
    const response = `明白了。`;
    
    return response;
  }

  async saveDialogue(sourceUserId, targetUserId, userMessage, aiResponse, relationType) {
    const dialogueId = `dialogue_${Date.now()}`;
    const content = `用户：${userMessage}\nAI：${aiResponse}`;

    await this.dialogueMemoryService.saveDialogueForParticipants(
      dialogueId,
      sourceUserId,
      targetUserId,
      content
    );
  }

  async estimateTokens(text) {
    // 简单估算
    const coefficient = /[\u4e00-\u9fa5]/.test(text) ? 0.65 : 1.0;
    return Math.ceil(text.length * coefficient);
  }

  async rebuildIndex(userId) {
    return await this.vectorService.rebuildIndex(userId);
  }
}