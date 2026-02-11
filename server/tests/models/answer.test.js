/**
 * Answer Model Test - 验证模型修改
 * 验证Answer模型的新字段: assistRelationId和specificRelation
 * 不需要连接数据库，只验证Schema结构
 */

import { describe, it, expect } from 'vitest';

describe('Answer Model Schema Changes', () => {
  describe('Schema Fields', () => {
    it('should compile without errors', () => {
      const Answer = require('../../src/models/Answer.js').default;
      expect(Answer).toBeDefined();
    });

    it('should have assistRelationId field', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.assistRelationId).toBeDefined();
      expect(schemaPaths.assistRelationId.instance).toBe('ObjectId');
    });

    it('should have specificRelation field', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.specificRelation).toBeDefined();
      expect(schemaPaths.specificRelation.instance).toBe('String');
    });

    it('should NOT have relationshipType field', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.relationshipType).toBeUndefined();
    });
  });

  describe('Field Properties', () => {
    it('assistRelationId should reference AssistRelation model', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const field = Answer.schema.path('assistRelationId');
      expect(field.options.ref).toBe('AssistRelation');
      expect(field.options.required).toBe(false);
    });

    it('specificRelation should have default value', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const field = Answer.schema.path('specificRelation');
      expect(field.options.default).toBe('');
    });
  });

  describe('Static Method: getAnswerStats', () => {
    it('should have getAnswerStats method', () => {
      const Answer = require('../../src/models/Answer.js').default;
      expect(Answer.getAnswerStats).toBeDefined();
      expect(typeof Answer.getAnswerStats).toBe('function');
    });
  });

  describe('Indexes', () => {
    it('should have index on userId', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const field = Answer.schema.path('userId');
      expect(field.options.index).toBe(true);
    });

    it('should have index on targetUserId', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const field = Answer.schema.path('targetUserId');
      expect(field.options.index).toBe(true);
    });
  });

  describe('Timestamps', () => {
    it('should have createdAt field', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.createdAt).toBeDefined();
      expect(schemaPaths.createdAt.instance).toBe('Date');
    });

    it('should have updatedAt field', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.updatedAt).toBeDefined();
      expect(schemaPaths.updatedAt.instance).toBe('Date');
    });
  });

  describe('Other Required Fields', () => {
    it('should have all required fields', () => {
      const Answer = require('../../src/models/Answer.js').default;
      const schemaPaths = Answer.schema.paths;
      expect(schemaPaths.userId).toBeDefined();
      expect(schemaPaths.targetUserId).toBeDefined();
      expect(schemaPaths.questionId).toBeDefined();
      expect(schemaPaths.questionLayer).toBeDefined();
      expect(schemaPaths.answer).toBeDefined();
      expect(schemaPaths.isSelfAnswer).toBeDefined();
    });
  });
});
