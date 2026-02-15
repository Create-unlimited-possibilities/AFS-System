// server/src/modules/rolecard/v2/calibrationLayer.js

import logger from '../../../core/utils/logger.js';

export const DEFAULT_CALIBRATION_CONFIG = {
  tokenCountThreshold: 10000,
  minSampleCount: 5,
  minTokensPerConversation: 100,
  maxCalibrationIntervalDays: 14,
  sampleDecayHalfLife: 7,
  minValidSampleWeight: 0.1,
  quickCalibration: { tokenRatio: 0.5, minDays: 3 },
  highActivityCalibration: { tokensPerDay: 2000, minDays: 2 },
  learningWeight: 0.1,
  baselineWeight: 0.9
};

const TRAIT_TO_NUMBER = {
  boundaryThickness: { thick: 0, medium: 0.5, thin: 1 },
  discretionLevel: { excellent: 0, good: 0.33, moderate: 0.66, poor: 1 },
  impulsiveSpeech: { rare: 0, occasional: 0.33, often: 0.66, frequent: 1 },
  emotionalExpression: { reserved: 0, moderate: 0.5, expressive: 1 },
  socialCautiousness: { high: 0, moderate: 0.5, low: 1 }
};

class CalibrationLayerManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
  }

  createInitialCalibrationLayer(coreLayer) {
    const traitVector = this.traitsToVector(coreLayer.personalityTraits);

    return {
      baseline: {
        traitVector,
        behavioralIndicators: coreLayer.behavioralIndicators || [],
        generatedAt: new Date().toISOString(),
        sourceQuestionIds: coreLayer.sourceQuestionIds || []
      },
      currentState: {
        traitVector: { ...traitVector },
        lastUpdatedAt: new Date().toISOString(),
        totalConversations: 0,
        totalTokens: 0
      },
      learningSamples: { pending: [], incorporated: [], rejected: [], maxSamples: 100 },
      calibrationConfig: this.config,
      calibrationHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  traitsToVector(traits) {
    const vector = {};
    // 处理 null/undefined traits，使用默认值
    const safeTraits = traits || {};
    for (const [key, mapping] of Object.entries(TRAIT_TO_NUMBER)) {
      const value = safeTraits[key];
      vector[key] = mapping[value] ?? 0.5;
    }
    return vector;
  }

  calculateDriftDistance(v1, v2) {
    const dimensions = Object.keys(TRAIT_TO_NUMBER);
    const squaredDiffs = dimensions.map(dim => Math.pow((v1[dim] ?? 0.5) - (v2[dim] ?? 0.5), 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0)) / Math.sqrt(dimensions.length);
  }

  calculateTimeDecayWeight(timestamp, currentTime = new Date()) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const ageInDays = (currentTime.getTime() - new Date(timestamp).getTime()) / msPerDay;
    const lambda = Math.LN2 / this.config.sampleDecayHalfLife;
    return Math.exp(-lambda * ageInDays);
  }

  checkCalibrationNeeded(calibrationLayer) {
    const { baseline, currentState, calibrationConfig } = calibrationLayer;
    const now = new Date();
    const driftDistance = this.calculateDriftDistance(baseline.traitVector, currentState.traitVector);

    if (currentState.totalTokens >= calibrationConfig.tokenCountThreshold) {
      return { needed: true, reason: `Token数达到阈值`, urgency: 'high', driftDistance };
    }

    const lastUpdate = new Date(currentState.lastUpdatedAt);
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (24 * 60 * 60 * 1000);

    if (daysSinceUpdate >= calibrationConfig.maxCalibrationIntervalDays) {
      return { needed: true, reason: `距上次更新已过 ${daysSinceUpdate.toFixed(1)} 天`, urgency: 'medium', driftDistance };
    }

    const quickThreshold = calibrationConfig.tokenCountThreshold * calibrationConfig.quickCalibration.tokenRatio;
    if (currentState.totalTokens >= quickThreshold && daysSinceUpdate >= calibrationConfig.quickCalibration.minDays) {
      return { needed: true, reason: `快速校准条件满足`, urgency: 'low', driftDistance };
    }

    return { needed: false, reason: '无需校准', urgency: 'low', driftDistance };
  }

  updateConversationStats(calibrationLayer, tokens) {
    calibrationLayer.currentState.totalConversations += 1;
    calibrationLayer.currentState.totalTokens += tokens;
    calibrationLayer.currentState.lastUpdatedAt = new Date().toISOString();
    calibrationLayer.updatedAt = new Date().toISOString();
    return calibrationLayer;
  }
}

export { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG };
export default new CalibrationLayerManager();
