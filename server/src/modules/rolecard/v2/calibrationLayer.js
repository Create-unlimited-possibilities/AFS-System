// server/src/modules/rolecard/v2/calibrationLayer.js

import { profileLogger } from '../../../core/utils/logger.js';

/**
 * 默认校准配置 V2
 */
export const DEFAULT_CALIBRATION_CONFIG = {
  // 触发条件
  minConversationCount: 20,      // 最少对话数量触发分析
  analysisIntervalDays: 14,      // 分析间隔（天）

  // 变化判定阈值
  significanceThreshold: 'medium', // 变化显著程度阈值: 'low' | 'medium' | 'high'
  minConsistencyCount: 3,          // 连续出现才认定为变化

  // 提醒设置
  reminderCooldownDays: 7,         // 提醒冷却期（天）

  // 分析维度
  analysisFields: [
    'personality',
    'values',
    'communicationStyle',
    'emotionalNeeds'
  ]
};

/**
 * 变化显著程度权重
 */
const SIGNIFICANCE_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3
};

/**
 * 变化检测 Prompt
 */
const CHANGE_DETECTION_PROMPT = `你是一个角色分析专家。请分析以下记忆内容，判断用户是否有显著变化。

## 角色卡当前描述
{roleCardDescriptions}

## 近期记忆摘要（过去{days}天）
{recentMemorySummary}

## 分析任务
1. 对比记忆内容与角色卡描述
2. 判断是否有显著变化（非临时性波动，需要是持续性的改变）
3. 变化是否值得更新角色卡

## 注意事项
- 忽略临时性的情绪波动
- 关注持续性的行为模式变化
- 考虑生活事件对人的影响

## 输出格式（严格JSON）
{
  "hasSignificantChange": true或false,
  "changeAreas": ["变化的字段名列表"],
  "changeDetails": [
    {
      "field": "字段名",
      "originalSummary": "角色卡中的原始描述",
      "observedChange": "观察到的变化",
      "significance": "high或medium或low",
      "evidence": "支持判断的证据（引用记忆内容）"
    }
  ],
  "recommendation": "建议用户更新角色卡的原因，若无变化则为空字符串",
  "confidence": "high或medium或low"
}`;

/**
 * 校准层管理器 V2
 * 检测角色卡属性随时间/经历的变化，提醒用户更新校准
 */
class CalibrationLayerManager {
  constructor(config = {}, llmClient = null) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
    this.llmClient = llmClient;
  }

  /**
   * 设置 LLM 客户端
   */
  setLLMClient(client) {
    this.llmClient = client;
  }

  /**
   * 创建初始校准层
   */
  createInitialCalibrationLayer(coreLayer) {
    return {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // 基线信息
      baseline: {
        generatedAt: new Date().toISOString(),
        sourceQuestionIds: coreLayer.metadata?.sourceQuestionIds || [],
        fieldSummaries: this.extractFieldSummaries(coreLayer)
      },

      // 当前状态
      currentState: {
        lastAnalyzedAt: null,
        totalConversations: 0,
        lastConversationAt: null,
        pendingChanges: [],
        confirmedChanges: []
      },

      // 分析历史
      analysisHistory: [],

      // 提醒状态
      reminderStatus: {
        lastRemindedAt: null,
        dismissed: false,
        pendingReminder: false
      },

      // 配置
      calibrationConfig: this.config
    };
  }

  /**
   * 从核心层提取字段摘要（用于基线对比）
   */
  extractFieldSummaries(coreLayer) {
    const summaries = {};
    const fields = this.config.analysisFields;

    for (const field of fields) {
      if (coreLayer[field]) {
        summaries[field] = {
          summary: coreLayer[field].summary || '',
          keyPoints: coreLayer[field].keyPoints || [],
          extractedAt: new Date().toISOString()
        };
      }
    }

    return summaries;
  }

  /**
   * 更新对话统计
   */
  updateConversationStats(calibrationLayer, conversationData = {}) {
    const { messageCount = 1, timestamp = new Date() } = conversationData;

    calibrationLayer.currentState.totalConversations += messageCount;
    calibrationLayer.currentState.lastConversationAt = new Date(timestamp).toISOString();
    calibrationLayer.updatedAt = new Date().toISOString();

    return calibrationLayer;
  }

  /**
   * 检查是否需要进行校准分析
   */
  checkCalibrationNeeded(calibrationLayer) {
    const { currentState, calibrationConfig } = calibrationLayer;
    const now = new Date();

    // 检查对话数量
    if (currentState.totalConversations < calibrationConfig.minConversationCount) {
      return {
        needed: false,
        reason: `对话数量不足（${currentState.totalConversations}/${calibrationConfig.minConversationCount}）`,
        urgency: 'none'
      };
    }

    // 检查分析间隔
    const lastAnalyzed = currentState.lastAnalyzedAt
      ? new Date(currentState.lastAnalyzedAt)
      : null;

    if (lastAnalyzed) {
      const daysSinceAnalysis = (now.getTime() - lastAnalyzed.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceAnalysis < calibrationConfig.analysisIntervalDays) {
        return {
          needed: false,
          reason: `距上次分析仅 ${daysSinceAnalysis.toFixed(1)} 天`,
          urgency: 'none'
        };
      }
    }

    // 检查提醒冷却期
    const lastReminded = calibrationLayer.reminderStatus?.lastRemindedAt
      ? new Date(calibrationLayer.reminderStatus.lastRemindedAt)
      : null;

    if (lastReminded) {
      const daysSinceReminder = (now.getTime() - lastReminded.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceReminder < calibrationConfig.reminderCooldownDays) {
        return {
          needed: false,
          reason: `提醒冷却期内（${daysSinceReminder.toFixed(1)} 天）`,
          urgency: 'none'
        };
      }
    }

    return {
      needed: true,
      reason: '满足分析条件',
      urgency: 'normal'
    };
  }

  /**
   * 执行变化检测分析
   * @param {Object} calibrationLayer - 校准层数据
   * @param {Object} coreLayer - 核心层数据
   * @param {string} recentMemorySummary - 近期记忆摘要
   * @param {number} days - 分析的天数范围
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeChanges(calibrationLayer, coreLayer, recentMemorySummary, days = 30) {
    if (!this.llmClient) {
      throw new Error('LLM 客户端未设置');
    }

    // 构建角色卡描述
    const roleCardDescriptions = this.buildRoleCardDescriptions(coreLayer);

    // 构建 Prompt
    const prompt = CHANGE_DETECTION_PROMPT
      .replace('{roleCardDescriptions}', roleCardDescriptions)
      .replace('{recentMemorySummary}', recentMemorySummary)
      .replace('{days}', days.toString());

    try {
      const response = await this.llmClient.generate(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
        responseFormat: 'json'
      });

      const analysisResult = JSON.parse(response);

      // 记录分析历史
      const historyEntry = {
        analyzedAt: new Date().toISOString(),
        result: analysisResult,
        memoryDays: days
      };

      calibrationLayer.analysisHistory.push(historyEntry);
      calibrationLayer.currentState.lastAnalyzedAt = new Date().toISOString();

      // 限制历史记录长度
      if (calibrationLayer.analysisHistory.length > 20) {
        calibrationLayer.analysisHistory = calibrationLayer.analysisHistory.slice(-20);
      }

      // 更新待确认变化
      if (analysisResult.hasSignificantChange) {
        this.updatePendingChanges(calibrationLayer, analysisResult);
      }

      calibrationLayer.updatedAt = new Date().toISOString();

      return {
        success: true,
        result: analysisResult,
        shouldRemind: this.shouldTriggerReminder(calibrationLayer, analysisResult)
      };

    } catch (error) {
      profileLogger.error('变化检测分析失败', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 构建角色卡描述文本
   */
  buildRoleCardDescriptions(coreLayer) {
    const descriptions = [];
    const fields = this.config.analysisFields;

    const fieldNames = {
      personality: '性格',
      values: '价值观',
      communicationStyle: '沟通风格',
      emotionalNeeds: '情感需求'
    };

    for (const field of fields) {
      if (coreLayer[field]?.summary) {
        descriptions.push(`【${fieldNames[field] || field}】${coreLayer[field].summary}`);
      }
    }

    return descriptions.join('\n');
  }

  /**
   * 更新待确认的变化
   */
  updatePendingChanges(calibrationLayer, analysisResult) {
    const { changeDetails = [] } = analysisResult;

    for (const detail of changeDetails) {
      // 检查是否已存在该字段的待确认变化
      const existingIndex = calibrationLayer.currentState.pendingChanges.findIndex(
        c => c.field === detail.field
      );

      if (existingIndex >= 0) {
        // 更新现有记录
        const existing = calibrationLayer.currentState.pendingChanges[existingIndex];
        existing.observedChange = detail.observedChange;
        existing.significance = detail.significance;
        existing.detectedCount = (existing.detectedCount || 0) + 1;
        existing.lastDetectedAt = new Date().toISOString();
      } else {
        // 添加新记录
        calibrationLayer.currentState.pendingChanges.push({
          field: detail.field,
          originalSummary: detail.originalSummary,
          observedChange: detail.observedChange,
          significance: detail.significance,
          evidence: detail.evidence,
          detectedCount: 1,
          firstDetectedAt: new Date().toISOString(),
          lastDetectedAt: new Date().toISOString()
        });
      }
    }
  }

  /**
   * 判断是否应该触发用户提醒
   */
  shouldTriggerReminder(calibrationLayer, analysisResult) {
    const { pendingChanges } = calibrationLayer.currentState;
    const { minConsistencyCount, significanceThreshold } = this.config;

    // 检查是否有满足条件的变化
    const significantChanges = pendingChanges.filter(change => {
      // 检查连续检测次数
      const countOk = change.detectedCount >= minConsistencyCount;

      // 检查显著程度
      const weightOk = SIGNIFICANCE_WEIGHTS[change.significance] >=
                       SIGNIFICANCE_WEIGHTS[significanceThreshold];

      return countOk && weightOk;
    });

    return significantChanges.length > 0;
  }

  /**
   * 生成用户提醒内容
   */
  generateReminder(calibrationLayer) {
    const { pendingChanges } = calibrationLayer.currentState;
    const { minConsistencyCount, significanceThreshold } = this.config;

    // 过滤出满足条件的变化
    const significantChanges = pendingChanges.filter(change => {
      const countOk = change.detectedCount >= minConsistencyCount;
      const weightOk = SIGNIFICANCE_WEIGHTS[change.significance] >=
                       SIGNIFICANCE_WEIGHTS[significanceThreshold];
      return countOk && weightOk;
    });

    if (significantChanges.length === 0) {
      return null;
    }

    const fieldNames = {
      personality: '性格',
      values: '价值观',
      communicationStyle: '沟通风格',
      emotionalNeeds: '情感需求'
    };

    const changes = significantChanges.map(change => ({
      field: change.field,
      fieldName: fieldNames[change.field] || change.field,
      original: change.originalSummary,
      observed: change.observedChange,
      significance: change.significance
    }));

    return {
      type: 'calibration_needed',
      title: '角色卡可能需要更新',
      message: `根据近期的对话分析，您的角色卡在以下方面可能有变化：${changes.map(c => c.fieldName).join('、')}`,
      details: changes,
      action: {
        type: 'regenerate_rolecard',
        label: '更新角色卡'
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 标记提醒已处理
   */
  dismissReminder(calibrationLayer) {
    calibrationLayer.reminderStatus.lastRemindedAt = new Date().toISOString();
    calibrationLayer.reminderStatus.dismissed = true;
    calibrationLayer.reminderStatus.pendingReminder = false;
    calibrationLayer.updatedAt = new Date().toISOString();

    return calibrationLayer;
  }

  /**
   * 确认变化并移动到已确认列表
   */
  confirmChanges(calibrationLayer, fieldNames = null) {
    const { pendingChanges } = calibrationLayer.currentState;

    // 确认指定的字段或全部
    const toConfirm = fieldNames
      ? pendingChanges.filter(c => fieldNames.includes(c.field))
      : pendingChanges;

    for (const change of toConfirm) {
      calibrationLayer.currentState.confirmedChanges.push({
        ...change,
        confirmedAt: new Date().toISOString()
      });
    }

    // 从待确认列表移除
    calibrationLayer.currentState.pendingChanges = fieldNames
      ? pendingChanges.filter(c => !fieldNames.includes(c.field))
      : [];

    calibrationLayer.updatedAt = new Date().toISOString();

    return calibrationLayer;
  }

  /**
   * 获取校准层状态摘要
   */
  getStatusSummary(calibrationLayer) {
    const { currentState, reminderStatus, analysisHistory } = calibrationLayer;

    return {
      totalConversations: currentState.totalConversations,
      lastConversation: currentState.lastConversationAt,
      lastAnalyzed: currentState.lastAnalyzedAt,
      pendingChangesCount: currentState.pendingChanges.length,
      confirmedChangesCount: currentState.confirmedChanges.length,
      hasPendingReminder: reminderStatus.pendingReminder,
      analysisCount: analysisHistory.length,
      calibrationProgress: this.calculateProgress(calibrationLayer)
    };
  }

  /**
   * 计算校准进度（用于 UI 展示）
   */
  calculateProgress(calibrationLayer) {
    const { currentState } = calibrationLayer;
    const { minConversationCount } = this.config;

    const conversationProgress = Math.min(
      currentState.totalConversations / minConversationCount,
      1
    );

    const changeProgress = currentState.pendingChanges.length > 0 ? 0.5 : 0;

    return {
      conversations: conversationProgress,
      readyForAnalysis: conversationProgress >= 1,
      hasChanges: currentState.pendingChanges.length > 0,
      overall: (conversationProgress + changeProgress) / 2
    };
  }
}

export { CalibrationLayerManager };
export default new CalibrationLayerManager();
