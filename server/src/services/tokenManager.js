// Token 管理服务 - 用于监控对话 token 用量并触发防幻觉机制
export default class TokenManager {
  constructor() {
    this.CONTEXT_LIMIT = 128000; // 128K tokens
    this.warningThreshold = 0.5; // 50%
    this.criticalThreshold = 0.7; // 70%
    this.hardLimit = 1.0; // 100%
    
    // 每个用户的 token 使用量
    this.userTokenUsage = new Map();
  }

  initializeUser(userId, initialTokens = 0) {
    this.userTokenUsage.set(userId, {
      total: initialTokens,
      current: 0,
      messageCount: 0,
      lastReset: new Date(),
      isCoolingDown: false,
      isBlocked: false
    });
  }

  addMessageTokens(userId, tokens) {
    const usage = this.userTokenUsage.get(userId);
    if (!usage) {
      this.initializeUser(userId);
    }

    const updatedUsage = this.userTokenUsage.get(userId) || { current: 0, messageCount: 0 };
    updatedUsage.current += tokens;
    updatedUsage.messageCount += 1;
    this.userTokenUsage.set(userId, updatedUsage);
    
    return this.checkLimits(userId);
  }

  checkLimits(userId) {
    const usage = this.userTokenUsage.get(userId);
    if (!usage) {
      return { status: 'ok' };
    }

    // 计算使用比例
    const ratio = usage.current / this.CONTEXT_LIMIT;

    if (ratio >= this.hardLimit) {
      return {
        status: 'blocked',
        message: '对话已达上限，请开启新对话。',
        shouldTerminate: true
      };
    }

    if (ratio >= this.criticalThreshold) {
      return {
        status: 'critical',
        message: '我太累了，必须休息一下。',
        shouldTerminate: true,
        action: 'force_close'
      };
    }

    if (ratio >= this.warningThreshold) {
      if (!usage.isCoolingDown) {
        usage.isCoolingDown = true;
        return {
          status: 'warning',
          message: '我有些累了，需要休息一下。',
          action: 'cooldown',
          cooldownDuration: 5 * 60 * 1000 // 5 分钟
        };
      }
    }

    return { status: 'ok' };
  }

  resetUserTokens(userId) {
    const usage = this.userTokenUsage.get(userId);
    if (usage) {
      usage.current = 0;
      usage.messageCount = 0;
      usage.lastReset = new Date();
      usage.isCoolingDown = false;
    }
  }

  getUserUsage(userId) {
    return this.userTokenUsage.get(userId) || {
      total: 0,
      current: 0,
      messageCount: 0
    };
  }

  shouldPromptUpdate(userId) {
    const usage = this.userTokenUsage.get(userId) || {};
    
    // 达到 50% 提示可能需要重建索引
    if (usage.current / this.CONTEXT_LIMIT >= 0.5) {
      return true;
    }
    
    return false;
  }
}