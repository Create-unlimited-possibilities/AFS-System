/**
 * 角色卡生成配置
 * 管理方法A和方法B的配置参数
 */

const roleCardConfig = {
  // 角色卡生成方法：'A' 或 'B'（通过环境变量配置）
  generationMethod: process.env.ROLECARD_METHOD || 'A',

  // 方法B 配置
  methodB: {
    concurrentLimit: 5,              // 并发限制
    retryCount: 2,                   // 失败重试次数
    retryDelay: 1000,                // 重试延迟
    temperature: 0.7,                 // LLM 温度
    maxTokens: 200,                  // LLM 最大 token 数（压缩任务只需少量）
    progressUpdateThreshold: 5       // 每处理 N 题推送一次进度
  },

  // 方法A 配置（保留原有设置）
  methodA: {
    minProgress: 0.8,                // 80% 完成度
    temperature: 0.7,
    maxTokens: 1500
  }
};

export default roleCardConfig;
