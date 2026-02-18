/**
 * CalibrationLayer V2 单元测试
 * 测试校准层的漂移检测、变化分析、用户提醒
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
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('minConversationCount');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('analysisIntervalDays');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('significanceThreshold');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('minConsistencyCount');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('reminderCooldownDays');
      expect(DEFAULT_CALIBRATION_CONFIG).toHaveProperty('analysisFields');
    });

    it('默认最少对话数量应为 20', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.minConversationCount).toBe(20);
    });

    it('默认分析间隔应为 14 天', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.analysisIntervalDays).toBe(14);
    });

    it('默认变化显著程度阈值应为 medium', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.significanceThreshold).toBe('medium');
    });

    it('默认连续检测次数应为 3', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.minConsistencyCount).toBe(3);
    });

    it('应包含分析维度列表', () => {
      expect(DEFAULT_CALIBRATION_CONFIG.analysisFields).toContain('personality');
      expect(DEFAULT_CALIBRATION_CONFIG.analysisFields).toContain('values');
      expect(DEFAULT_CALIBRATION_CONFIG.analysisFields).toContain('communicationStyle');
      expect(DEFAULT_CALIBRATION_CONFIG.analysisFields).toContain('emotionalNeeds');
    });
  });

  describe('CalibrationLayerManager 类', () => {
    describe('createInitialCalibrationLayer()', () => {
      it('应创建包含 version 的校准层', () => {
        const coreLayer = {
          personality: { summary: '测试性格', keyPoints: ['要点1'] }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('version');
        expect(calibrationLayer.version).toBe('2.0.0');
      });

      it('应创建包含 baseline 的校准层', () => {
        const coreLayer = {
          personality: { summary: '测试性格', keyPoints: ['要点1'] },
          values: { summary: '测试价值观', keyPoints: ['价值观1'] }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('baseline');
        expect(calibrationLayer.baseline).toHaveProperty('generatedAt');
        expect(calibrationLayer.baseline).toHaveProperty('fieldSummaries');
      });

      it('应创建包含 currentState 的校准层', () => {
        const coreLayer = { personality: { summary: '测试' } };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('currentState');
        expect(calibrationLayer.currentState.totalConversations).toBe(0);
        expect(calibrationLayer.currentState.lastAnalyzedAt).toBeNull();
      });

      it('应创建包含 analysisHistory 的校准层', () => {
        const coreLayer = { personality: { summary: '测试' } };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('analysisHistory');
        expect(Array.isArray(calibrationLayer.analysisHistory)).toBe(true);
      });

      it('应创建包含 reminderStatus 的校准层', () => {
        const coreLayer = { personality: { summary: '测试' } };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer).toHaveProperty('reminderStatus');
        expect(calibrationLayer.reminderStatus.dismissed).toBe(false);
        expect(calibrationLayer.reminderStatus.pendingReminder).toBe(false);
      });

      it('应提取各字段的摘要', () => {
        const coreLayer = {
          personality: { summary: '性格描述', keyPoints: ['要点1', '要点2'] },
          values: { summary: '价值观描述', keyPoints: ['价值观1'] },
          communicationStyle: { summary: '沟通风格描述', keyPoints: [] }
        };

        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        expect(calibrationLayer.baseline.fieldSummaries.personality.summary).toBe('性格描述');
        expect(calibrationLayer.baseline.fieldSummaries.values.summary).toBe('价值观描述');
      });
    });

    describe('updateConversationStats()', () => {
      it('应增加对话计数', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer, { messageCount: 1 });

        expect(calibrationLayer.currentState.totalConversations).toBe(1);
      });

      it('应更新最后对话时间', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer);

        expect(calibrationLayer.currentState.lastConversationAt).toBeDefined();
      });

      it('应更新顶层 updatedAt 时间', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        manager.updateConversationStats(calibrationLayer);

        expect(calibrationLayer.updatedAt).toBeDefined();
      });
    });

    describe('checkCalibrationNeeded()', () => {
      it('新创建的校准层不应需要校准（对话数量不足）', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        const result = manager.checkCalibrationNeeded(calibrationLayer);

        expect(result.needed).toBe(false);
        expect(result.reason).toContain('不足');
      });

      it('对话数量达到阈值后应触发分析', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 20;

        const result = manager.checkCalibrationNeeded(calibrationLayer);

        expect(result.needed).toBe(true);
      });

      it('分析间隔内不应再次触发', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 30;
        calibrationLayer.currentState.lastAnalyzedAt = new Date().toISOString();

        const result = manager.checkCalibrationNeeded(calibrationLayer);

        expect(result.needed).toBe(false);
        expect(result.reason).toContain('距上次分析');
      });

      it('提醒冷却期内不应再次提醒', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 30;
        calibrationLayer.reminderStatus.lastRemindedAt = new Date().toISOString();

        const result = manager.checkCalibrationNeeded(calibrationLayer);

        expect(result.needed).toBe(false);
        expect(result.reason).toContain('冷却期');
      });
    });

    describe('extractFieldSummaries()', () => {
      it('应从核心层提取字段摘要', () => {
        const coreLayer = {
          personality: { summary: '性格', keyPoints: ['a', 'b'] },
          values: { summary: '价值观', keyPoints: ['c'] }
        };

        const summaries = manager.extractFieldSummaries(coreLayer);

        expect(summaries.personality.summary).toBe('性格');
        expect(summaries.personality.keyPoints).toEqual(['a', 'b']);
        expect(summaries.values.summary).toBe('价值观');
      });

      it('缺失字段应跳过', () => {
        const coreLayer = {
          personality: { summary: '性格' }
        };

        const summaries = manager.extractFieldSummaries(coreLayer);

        expect(summaries.personality).toBeDefined();
        expect(summaries.values).toBeUndefined();
      });
    });

    describe('shouldTriggerReminder()', () => {
      it('无待确认变化时不应触发', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        const analysisResult = { hasSignificantChange: false };

        const shouldRemind = manager.shouldTriggerReminder(calibrationLayer, analysisResult);

        expect(shouldRemind).toBe(false);
      });

      it('变化检测次数不足时不应触发', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.pendingChanges = [
          { field: 'personality', significance: 'high', detectedCount: 1 }
        ];

        const analysisResult = { hasSignificantChange: true };

        const shouldRemind = manager.shouldTriggerReminder(calibrationLayer, analysisResult);

        expect(shouldRemind).toBe(false);
      });

      it('变化检测次数足够时应触发', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.pendingChanges = [
          { field: 'personality', significance: 'high', detectedCount: 3 }
        ];

        const analysisResult = { hasSignificantChange: true };

        const shouldRemind = manager.shouldTriggerReminder(calibrationLayer, analysisResult);

        expect(shouldRemind).toBe(true);
      });
    });

    describe('generateReminder()', () => {
      it('无满足条件的变化时应返回 null', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

        const reminder = manager.generateReminder(calibrationLayer);

        expect(reminder).toBeNull();
      });

      it('有满足条件的变化时应返回提醒对象', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.pendingChanges = [
          {
            field: 'personality',
            significance: 'high',
            detectedCount: 3,
            originalSummary: '原性格',
            observedChange: '新变化'
          }
        ];

        const reminder = manager.generateReminder(calibrationLayer);

        expect(reminder).not.toBeNull();
        expect(reminder.type).toBe('calibration_needed');
        expect(reminder.title).toBeDefined();
        expect(reminder.details).toHaveLength(1);
        expect(reminder.details[0].field).toBe('personality');
      });
    });

    describe('dismissReminder()', () => {
      it('应标记提醒已处理', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.reminderStatus.pendingReminder = true;

        manager.dismissReminder(calibrationLayer);

        expect(calibrationLayer.reminderStatus.dismissed).toBe(true);
        expect(calibrationLayer.reminderStatus.pendingReminder).toBe(false);
        expect(calibrationLayer.reminderStatus.lastRemindedAt).toBeDefined();
      });
    });

    describe('confirmChanges()', () => {
      it('应将待确认变化移动到已确认列表', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.pendingChanges = [
          { field: 'personality', significance: 'high', detectedCount: 3 }
        ];

        manager.confirmChanges(calibrationLayer);

        expect(calibrationLayer.currentState.pendingChanges).toHaveLength(0);
        expect(calibrationLayer.currentState.confirmedChanges).toHaveLength(1);
      });

      it('应支持指定字段确认', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.pendingChanges = [
          { field: 'personality', significance: 'high', detectedCount: 3 },
          { field: 'values', significance: 'medium', detectedCount: 3 }
        ];

        manager.confirmChanges(calibrationLayer, ['personality']);

        expect(calibrationLayer.currentState.pendingChanges).toHaveLength(1);
        expect(calibrationLayer.currentState.pendingChanges[0].field).toBe('values');
      });
    });

    describe('getStatusSummary()', () => {
      it('应返回状态摘要', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 10;
        calibrationLayer.currentState.pendingChanges = [{ field: 'test' }];

        const summary = manager.getStatusSummary(calibrationLayer);

        expect(summary.totalConversations).toBe(10);
        expect(summary.pendingChangesCount).toBe(1);
        expect(summary).toHaveProperty('calibrationProgress');
      });
    });

    describe('calculateProgress()', () => {
      it('应计算校准进度', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 10;

        const progress = manager.calculateProgress(calibrationLayer);

        expect(progress.conversations).toBe(0.5); // 10/20
        expect(progress.readyForAnalysis).toBe(false);
      });

      it('对话数量达到阈值时应标记为可分析', () => {
        const coreLayer = { personality: { summary: '测试' } };
        const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
        calibrationLayer.currentState.totalConversations = 20;

        const progress = manager.calculateProgress(calibrationLayer);

        expect(progress.conversations).toBe(1);
        expect(progress.readyForAnalysis).toBe(true);
      });
    });
  });

  describe('自定义配置测试', () => {
    it('应支持自定义最少对话数量', () => {
      const customManager = new CalibrationLayerManager({
        minConversationCount: 10
      });

      const coreLayer = { personality: { summary: '测试' } };
      const calibrationLayer = customManager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalConversations = 10;

      const result = customManager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });

    it('应支持自定义分析间隔', () => {
      const customManager = new CalibrationLayerManager({
        minConversationCount: 5,
        analysisIntervalDays: 7
      });

      const coreLayer = { personality: { summary: '测试' } };
      const calibrationLayer = customManager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalConversations = 10;
      calibrationLayer.currentState.lastAnalyzedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      const result = customManager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });
  });

  describe('边界情况测试', () => {
    it('应处理空的 coreLayer', () => {
      const calibrationLayer = manager.createInitialCalibrationLayer({});
      expect(calibrationLayer).toBeDefined();
      expect(calibrationLayer.baseline.fieldSummaries).toBeDefined();
    });

    it('应处理 null 字段值', () => {
      const coreLayer = {
        personality: null,
        values: { summary: '价值观' }
      };

      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
      expect(calibrationLayer).toBeDefined();
      expect(calibrationLayer.baseline.fieldSummaries.values).toBeDefined();
    });

    it('应处理超大对话数量', () => {
      const coreLayer = { personality: { summary: '测试' } };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalConversations = 1000000;

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });

    it('应处理负数对话数量（异常情况）', () => {
      const coreLayer = { personality: { summary: '测试' } };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);
      calibrationLayer.currentState.totalConversations = -100;

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result).toBeDefined();
    });
  });

  describe('实际业务场景测试', () => {
    it('模拟正常使用场景：逐步累积对话', () => {
      const coreLayer = {
        personality: { summary: '性格描述', keyPoints: ['要点1'] },
        values: { summary: '价值观描述', keyPoints: ['价值观1'] }
      };
      const calibrationLayer = manager.createInitialCalibrationLayer(coreLayer);

      // 模拟 20 次对话
      for (let i = 0; i < 20; i++) {
        manager.updateConversationStats(calibrationLayer);
      }

      expect(calibrationLayer.currentState.totalConversations).toBe(20);

      const result = manager.checkCalibrationNeeded(calibrationLayer);
      expect(result.needed).toBe(true);
    });
  });
});
