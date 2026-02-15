/**
 * 进度跟踪器
 * 用于角色卡生成进度跟踪和统计
 */

export default class ProgressTracker {
  constructor(totalQuestions, userId) {
    this.userId = userId;
    this.total = totalQuestions;
    this.processed = 0;
    this.success = 0;
    this.failed = 0;
    this.startTime = Date.now();
    this.stats = {}; // 按 "Aset_basic", "Bset_emotional" 等分类统计
  }

  /**
   * 记录成功
   * @param {string} category - 分类（如 "Aset_basic"）
   */
  recordSuccess(category) {
    this.update(category, true);
  }

  /**
   * 记录失败
   * @param {string} category - 分类（如 "Aset_basic"）
   * @param {string} [error] - 错误信息
   */
  recordFailure(category, error) {
    this.update(category, false, null, error);
  }

  /**
   * 更新进度
   * @param {string} category - 分类（如 "Aset_basic"）
   * @param {boolean} success - 是否成功
   * @param {string} question - 问题标识
   * @param {string} [error] - 错误信息（失败时）
   */
  update(category, success, question, error) {
    // 初始化分类统计
    if (!this.stats[category]) {
      this.stats[category] = { total: 0, success: 0, failed: 0, errors: [] };
    }

    // 更新分类统计
    this.stats[category].total++;
    this.stats[category][success ? 'success' : 'failed']++;
    if (!success && error) {
      this.stats[category].errors.push({ question, error });
    }

    // 更新全局统计
    this.processed++;
    if (success) {
      this.success++;
    } else {
      this.failed++;
    }
  }

  /**
   * 获取当前进度
   * @returns {Object} 进度对象
   */
  getProgress() {
    return {
      userId: this.userId,
      total: this.total,
      processed: this.processed,
      success: this.success,
      failed: this.failed,
      percentage: Math.round((this.processed / this.total) * 100),
      duration: Date.now() - this.startTime,
      stats: this.stats
    };
  }

  /**
   * 获取摘要（用于 SSE complete 事件）
   * @returns {Object} 摘要对象
   */
  getSummary() {
    return {
      totalQuestions: this.total,
      success: this.success,
      failed: this.failed,
      duration: Date.now() - this.startTime,
      stats: this.stats
    };
  }
}
