/**
 * CalibrationLayer V2 单元测试
 * 测试校准层的漂移计算、校准触发条件、时间衰减
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG } from '../../../src/modules/rolecard/v2/calibrationLayer.js';

describe('CalibrationLayer V2', () => {
  let manager;

  beforeEach(() => {
    manager = new CalibrationLayerManager();
  });

  describe('DEFAULT_CALIBRATION_CONFIG 常量', () => {
    it('应包含所有必要配置项', () => {
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('tokenCountThreshold');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('minSampleCount');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('minTokensPerConversation');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('maxCalibrationIntervalDays');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('sampleDecayHalfLife');
    });

    it('默认 Token 阈值应为 10000', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.tokenCountThreshold).toBe(10000);
    });

    it('默认最大校准间隔应为 14 天', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.maxCalibrationIntervalDays).toBe(14);
    });

    it('应包含快速校准配置', () => {
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('quickCalibration');
      expect(DEFAULT_CALIBRATION_CONFIG.quickCalibration).toHaveProperty('tokenRatio');
      expect(DEFAULT_CALIBRATION_CONFIG.quickCalibration).toHaveProperty('minDays');
    });

    it('应包含高活跃度校准配置', () => {
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('highActivityCalibration');
      expect(DEFAULT_CALIBRATION_CONFIG.highActivityCalibration).toHaveProperty('tokensPerDay');
    });
  });

  describe('CalibrationLayerManager 类', () => {
    describe('traitsToVector()', () => {
      it('应将边界厚度特征转换为数值向量', () => {
        const traits = { boundaryThickness: 'thick' };
        const vector = manager.traitsToVector(traits);
        expect(vector.boundaryThickness).toBe(0);
      });

      it('应正确处理中等值', () => {
        const traits = { boundaryThickness: 'medium' };
        const vector = manager.traitsToVector(traits);
        expect(vector.boundaryThickness).toBe(0.5);
      });

      it('应正确处理薄边界', () => {
        const traits = { boundaryThickness: 'thin' };
        const vector = manager.traitsToVector(traits);
        expect(vector.boundaryThickness).toBe(1);
      });

      it('对未知值应返回默认值 0.5', () => {
        const traits = { boundaryThickness: 'unknown' };
        const vector = manager.traitsToVector(traits);
        expect(vector.boundaryThickness).toBe(0.5);
      });

      it('应处理缺失的特征', () => {
        const traits = {};
        const vector = manager.traitsToVector(traits);
        // 所有维度都应该有默认值 0.5
        expect(vector.boundaryThickness).toBe(0.5);
        expect(vector.discretionLevel).toBe(0.5);
        expect(vector.impulsiveSpeech).toBe(0.5);
        expect(vector.emotionalExpression).toBe(0.5);
        expect(vector.socialCautiousness).toBe(0.5);
      });

      it('应转换所有五种特征', () => {
        const traits = {
          boundaryThickness: 'thick',
          discretionLevel: 'excellent',
          impulsiveSpeech: 'rare',
          emotionalExpression: 'reserved',
          socialCautiousness: 'high'
        };
        const vector = manager.traitsToVector(traits);
        expect(vector.boundaryThickness).toBe(0);
        expect(vector.discretionLevel).toBe(0);
        expect(vector.impulsiveSpeech).toBe(0);
        expect(vector.emotionalExpression).toBe(0);
        expect(vector.socialCautiousness).toBe(0);
      });
    });

    describe('calculateDriftDistance()', () => {
      it('相同向量间的漂移距离应为 0', () => {
        const v1 = { boundaryThickness: 0.5, discretionLevel: 0.5, impulsiveSpeech: 0.5, emotionalExpression: 0.5, socialCautiousness: 0.5 };
        const v2 = { boundaryThickness: 0.5, discretionLevel: 0.5, impulsiveSpeech: 0.5, emotionalExpression: 0.5, socialCautiousness: 0.5 };
        const distance = manager.calculateDriftDistance(v1, v2);
        expect(distance).toBe(0);
      });

      it('不同向量间应有正漂移距离', () => {
        const v1 = { boundaryThickness: 0, discretionLevel: 0, impulsiveSpeech: 0, emotionalExpression: 0, socialCautiousness: 0 };
        const v2 = { boundaryThickness: 1, discretionLevel: 1, impulsiveSpeech: 1, emotionalExpression: 1, socialCautiousness: 1 };
        const distance = manager.calculateDriftDistance(v1, v2);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThanOrEqual(1);
      });

      it('漂移距离应在 0-1 范围内', () => {
        const v1 = { boundaryThickness: 0.3, discretionLevel: 0.7, impulsiveSpeech: 0.2, emotionalExpression: 0.8, socialCautiousness: 0.4 };
        const v2 = { boundaryThickness: 0.6, discretionLevel: 0.4, impulsiveSpeech: 0.9, emotionalExpression: 0.1, socialCautiousness: 0.7 };
        const distance = manager.calculateDriftDistance(v1, v2);
        expect(distance).toBeGreaterThanOrEqual(0);
        expect(distance).toBeLessThanOrEqual(1);
      });

      it('应处理缺失维度（使用默认值 0.5）', () => {
        const v1 = { boundaryThickness: 0.5 };
        const v2 = { boundaryThickness: 0.8 };
        const distance = manager.calculateDriftDistance(v1, v2);
        expect(distance).toBeGreaterThanOrEqual(0);
      });
    });

    describe('calculateTimeDecayWeight()', () => {
      it('当前时间的权重应为 1', () => {
        const now = new Date();
        const weight = manager.calculateTimeDecayWeight(now.toISOString(), now);
        expect(weight).toBeCloseTo(1, 1);
      });

      it('经过一个半衰期后权重应约为 0.5', () => {
        const halfLife = DEFAULT_CALIBRATION_CONFIG.sampleDecayHalfLife; // 7 天
        const now = new Date();
        const past = new Date(now.getTime() - halfLife * 24 * 60 * 60 * 1000);
        const weight = manager.calculateTimeDecayWeight(past.toISOString(), now);
        expect(weight).toBeCloseTo(0.5, 1);
      });

      it('时间越久权重越低', () => {
        const now = new Date();
        const one = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        const seven = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteen = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const weight1 = manager.calculateTimeDecayWeight(one.toISOString(), now);
        const weight7 = manager.calculateTimeDecayWeight(seven.toISOString(), now);
        const weight14 = manager.calculateTimeDecayWeight(fourteen.toISOString(), now);

        expect(weight1).toBeGreaterThan(weight7);
        expect(weight7).toBeGreaterThan(weight14);
      });

      it('权重始终大于 0', () => {
        const now = new Date();
        const veryOld = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 一年前
        const weight = manager.calculateTimeDecayWeight(veryOld.toISOString(), now);
        expect(weight).toBeGreaterThan(0);
      });
    });

    describe('createInitialCalibrationLayer()', () => {
      it('应创建包含 baseline 的校准层', () => {
        const coreLayer = {
          personalityTraits: {
            boundaryThickness: 'medium',
            discretionLevel: 'good',
            impulsiveSpeech: 'occasional',
            emotionalExpression: 'moderate',
            socialCautiousness: 'moderate'
          }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('baseline');
        expect(calibrationLayer.baseline).toHaveProperty('traitVector');
        expect(calibrationLayer.baseline).toHaveProperty('generatedAt');
      });

      it('应创建包含 currentState 的校准层', () => {
        const coreLayer = {
          personalityTraits: {
            boundaryThickness: 'medium',
            discretionLevel: 'good',
            impulsiveSpeech: 'occasional',
            emotionalExpression: 'moderate',
            socialCautiousness: 'moderate'
          }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('currentState');
        expect(calibrationLayer.currentState.totalConversations).toBe(0);
        expect(calibrationLayer.currentState.totalTokens).toBe(0);
      });

      it('baseline 和 currentState 的 traitVector 应相同', () => {
        const coreLayer = {
          personalityTraits: {
            boundaryThickness: 'thick',
            discretionLevel: 'excellent',
            impulsiveSpeech: 'rare',
            emotionalExpression: 'reserved',
            socialCautiousness: 'high'
          }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer.baseline.traitVector).toEqual(calibrationLayer.currentState.traitVector);
      });

      it('应包含 calibrationHistory 数组', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        expect(Array.isArray(calibrationLayer.calibrationHistory)).toBe(true);
      });

      it('应包含 learningSamples 结构', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        expect(calibrationLayer).toHaveProperty('learningSamples');
        expect(calibrationLayer.learningSamples).toHaveProperty('pending');
        expect(calibrationLayer.learningSamples).toHaveProperty('incorporated');
        expect(calibrationLayer.learningSamples).toHaveProperty('rejected');
      });
    });

    describe('checkCalibrationNeeded()', () => {
      it('新创建的校准层不应需要校准', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        const result = manager.checkCalibrationNeeded(calibrationLayer);
        expect(result.needed).toBe(false);
      });

      it('Token 达到阈值应触发高优先级校准', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalTokens = 10000;

        const result = manager.checkCalibrationNeeded(calibrationLayer);
        expect(result.needed).toBe(true);
        expect(result.urgency).toBe('high');
        expect(result.reason).toContain('Token');
      });

      it('超过最大间隔天数应触发中优先级校准', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        // 模拟 15 天前的更新
        const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        calibrationLayer.currentState.lastUpdatedAt = oldDate.toISOString();

        const result = manager.checkCalibrationNeeded(calibrationLayer);
        expect(result.needed).toBe(true);
        expect(result.urgency).toBe('medium');
        expect(result.reason).toContain('天');
      });

      it('满足快速校准条件应触发低优先级校准', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        // 模拟快速校准条件：50% token 阈值 + 3 天
        calibrationLayer.currentState.totalTokens = 5000;
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
        calibrationLayer.currentState.lastUpdatedAt = fourDaysAgo.toISOString();

        const result = manager.checkCalibrationNeeded(calibrationLayer);
        expect(result.needed).toBe(true);
        expect(result.urgency).toBe('low');
      });

      it('应返回漂移距离', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        const result = manager.checkCalibrationNeeded(calibrationLayer);
        expect(result).toHaveProperty('driftDistance');
        expect(typeof result.driftDistance).toBe('number');
      });
    });

    describe('updateConversationStats()', () => {
      it('应增加对话计数', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer, 100);

        expect(calibrationLayer.currentState.totalConversations).toBe(1);
      });

      it('应累加 Token 数', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer, 100);
        manager.updateConversationStats(calibrationLayer, 200);

        expect(calibrationLayer.currentState.totalTokens).toBe(300);
      });

      it('应更新 lastUpdatedAt 时间', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        const beforeUpdate = calibrationLayer.currentState.lastUpdatedAt;

        // 等待 1ms 确保时间不同
        manager.updateConversationStats(calibrationLayer, 100);

        const afterUpdate = calibrationLayer.currentState.lastUpdatedAt;
        expect(new Date(afterUpdate).getTime()).toBeGreaterThanOrEqual(new Date(beforeUpdate).getTime());
      });

      it('应更新顶层 updatedAt 时间', () => {
        const coreLayer = { personalityTraits: {} };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer, 100);

        expect(calibrationLayer.updatedAt).toBeDefined();
      });
    });
  });

  describe('自定义配置测试', () => {
    it('应支持自定义 Token 阈值', () => {
      const customManager = new CalibrationLayerManager({
        tokenCountThreshold: 5000
      });

      const coreLayer = { personalityTraits: {} };
      const calibrationLayer = customManager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalTokens = 5000;

      const result = customManager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
      expect(result.urgency).toBe('high');
    });

    it('应支持自定义最大间隔天数', () => {
      const customManager = new CalibrationLayerManager({
        maxCalibrationIntervalDays: 7
      });

      const coreLayer = { personalityTraits: {} };
      const calibrationLayer = customManager.createInitialCalibrationLayer(coreLayer);

      // 模拟 8 天前
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      calibrationLayer.currentState.lastUpdatedAt = oldDate.toISOString();

      const result = customManager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });
  });

  describe('边界情况测试', () => {
    it('应处理空 personalityTraits（使用默认值）', () => {
      const calibrationLayer = manager.createInitialCalibrationLayer({ personalityTraits: {} });
      expect(calibrationLayer).toBeDefined();
      expect(calibrationLayer.baseline.traitVector).toBeDefined();
      // 所有特征应使用默认值 0.5
      expect(calibrationLayer.baseline.traitVector.boundaryThickness).toBe(0.5);
    });

    it('应处理 null personalityTraits（使用默认值）', () => {
      // 修复后：应优雅处理 null
      const calibrationLayer = manager.createInitialCalibrationLayer({ personalityTraits: null });
      expect(calibrationLayer).toBeDefined();
      expect(calibrationLayer.baseline.traitVector).toBeDefined();
      // 所有特征应使用默认值 0.5
      expect(calibrationLayer.baseline.traitVector.boundaryThickness).toBe(0.5);
    });

    it('应处理 undefined personalityTraits（使用默认值）', () => {
      const calibrationLayer = manager.createInitialCalibrationLayer({ personalityTraits: undefined });
      expect(calibrationLayer).toBeDefined();
      expect(calibrationLayer.baseline.traitVector.boundaryThickness).toBe(0.5);
    });

    it('应处理超大 Token 数', () => {
      const coreLayer = { personalityTraits: {} };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalTokens = 1000000000;

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });

    it('应处理负数 Token（异常情况）', () => {
      const coreLayer = { personalityTraits: {} };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalTokens = -100;

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result).toBeDefined();
    });

    it('应处理未来时间（异常情况）', () => {
      const coreLayer = { personalityTraits: {} };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      calibrationLayer.currentState.lastUpdatedAt = futureDate.toISOString();

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result).toBeDefined();
    });
  });

  describe('实际业务场景测试', () => {
    it('模拟正常使用场景：逐步累积 Token', () => {
      const coreLayer = {
        personalityTraits: {
          boundaryThickness: 'medium',
          discretionLevel: 'good',
          impulsiveSpeech: 'occasional',
          emotionalExpression: 'moderate',
          socialCautiousness: 'moderate'
        }
      };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

      // 模拟 50 次对话，每次平均 200 tokens
      for (let i = 0; i < 50; i++) {
        manager.updateConversationStats(calibrationLayer, 200);

        if (i < 49) {
          const result = manager.checkCalibrationNeeded(calibrationLayer);
          // 前 49 次不应触发高优先级校准
          if (result.urgency !== 'high') {
            expect(result.needed).toBe(false);
          }
        }
      }

      // 第 50 次后，totalTokens = 10000，应触发高优先级校准
      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
      expect(result.urgency).toBe('high');
      expect(calibrationLayer.currentState.totalConversations).toBe(50);
    });
  });
});
