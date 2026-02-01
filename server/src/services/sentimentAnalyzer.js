// 情感分析服务 - 用于分析对话内容并计算情感得分
export default class SentimentAnalyzer {
  constructor() {
    this.positiveKeywords = [
      '喜欢', '爱', '开心', '高兴', '快乐', '幸福', '美好', '不错',
      '谢谢', '感谢', '感激', '满意', '棒', '太好了', '真棒',
      '喜欢', '想念', '在意', '关心', '爱护', '珍惜', '温暖'
    ];

    this.negativeKeywords = [
      '讨厌', '恨', '生气', '愤怒', '不开心', '难过', '痛苦', '悲伤',
      '糟糕', '不好', '讨厌你', '烦', '烦人', '讨厌死',
      '不想理', '走开', '离开', '别烦我', '去死', '恨死你'
    ];

    this.intensifiers = ['非常', '特别', '超级', '太', '很', '相当'];
  }

  analyze(text) {
    if (!text) return 0;

    let score = 0;
    const lowerText = text.toLowerCase();

    // 检测正面词汇
    for (const word of this.positiveKeywords) {
      const count = (text.match(new RegExp(word, 'g')) || []).length;
      score += count;

      // 检测程度副词
      for (const intensifier of this.intensifiers) {
        if (text.includes(intensifier + word)) {
          score += count * 0.5;
        }
      }
    }

    // 检测负面词汇
    for (const word of this.negativeKeywords) {
      const count = (text.match(new RegExp(word, 'g')) || []).length;
      score -= count;

      // 检测程度副词
      for (const intensifier of this.intensifiers) {
        if (text.includes(intensifier + word)) {
          score -= count * 0.5;
        }
      }
    }

    // 标准化到 -1 到 1 之间
    return Math.max(-1, Math.min(1, score / 5));
  }

  // 基于情感得分调整好感度
  adjustAffinity(currentScore, sentimentScore, multiplier = 5) {
    const change = sentimentScore * multiplier;
    const newScore = Math.max(-100, Math.min(100, currentScore + change));
    return Math.round(newScore);
  }

  // 判断对话是否应该被拒绝
  shouldRejectDialog(affinityScore) {
    return affinityScore <= -50;
  }

  // 判断对话是否应该被禁止
  shouldBan(affinityScore) {
    return affinityScore <= -80;
  }

  // 获取关系等级
  getRelationLevel(affinityScore) {
    if (affinityScore >= 80) return 'intimate';
    if (affinityScore >= 50) return 'close';
    if (affinityScore >= 20) return 'casual';
    if (affinityScore <= -50) return 'rejected';
    return 'stranger';
  }
}