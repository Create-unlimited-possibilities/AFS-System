/**
 * 角色卡生成配置
 * V2 统一配置参数
 */

const roleCardConfig = {
  // 并发限制
  concurrentLimit: 5,

  // 失败重试
  retryCount: 2,
  retryDelay: 1000,

  // LLM 参数
  temperature: 0.7,
  maxTokens: 1500,

  // 进度更新阈值
  progressUpdateThreshold: 5,

  // 最低完成度要求
  minProgress: 0.8
};

export default roleCardConfig;
