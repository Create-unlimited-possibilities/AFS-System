/**
 * AssistService Test - 验证协助关系服务
 * 测试重复关系验证功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock models using factory functions
vi.mock('../../src/models/AssistRelation.js', () => ({
  default: vi.fn().mockImplementation(function(data) {
    this._id = '507f1f77bcf86cd799439013';
    this.assistantId = data?.assistantId;
    this.targetId = data?.targetId;
    this.relationshipType = data?.relationshipType;
    this.specificRelation = data?.specificRelation;
    this.friendLevel = data?.friendLevel;
    this.save = vi.fn().mockResolvedValue(this);
  })
}));

vi.mock('../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn()
  }
}));

import assistService from '../../src/services/assistService.js';
import AssistRelation from '../../src/models/AssistRelation.js';
import User from '../../src/models/User.js';

// Add static methods to the mocked constructor
AssistRelation.findOne = vi.fn();
AssistRelation.create = vi.fn();
AssistRelation.find = vi.fn().mockReturnValue({
  populate: vi.fn().mockReturnValue([])
});

describe('AssistService - checkDuplicateRelation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success cases', () => {
    it('should return false when no duplicate relation exists', async () => {
      const assistantId = '507f1f77bcf86cd799439011';
      const targetId = '507f1f77bcf86cd799439012';

      AssistRelation.findOne.mockResolvedValue(null);

      const result = await assistService.checkDuplicateRelation(assistantId, targetId);

      expect(result).toBe(false);
      expect(AssistRelation.findOne).toHaveBeenCalledWith({
        assistantId,
        targetId,
        isActive: true
      });
    });
  });

  describe('Error cases', () => {
    it('should throw error when duplicate active relation exists', async () => {
      const assistantId = '507f1f77bcf86cd799439011';
      const targetId = '507f1f77bcf86cd799439012';

      AssistRelation.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439013',
        assistantId,
        targetId,
        isActive: true
      });

      await expect(assistService.checkDuplicateRelation(assistantId, targetId))
        .rejects.toThrow('该用户已在您的协助列表中');
    });
  });
});

describe('AssistService - createRelation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Duplicate relation handling', () => {
    it('should throw error when trying to create duplicate relation', async () => {
      const assistantId = '507f1f77bcf86cd799439011';
      const targetCode = 'TEST123456789012';
      const targetEmail = 'target@example.com';

      const mockTargetUser = {
        _id: '507f1f77bcf86cd799439012',
        uniqueCode: targetCode,
        email: targetEmail.toLowerCase()
      };

      User.findOne.mockResolvedValue(mockTargetUser);
      AssistRelation.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439013',
        assistantId,
        targetId: mockTargetUser._id,
        isActive: true
      });

      await expect(assistService.createRelation({
        assistantId,
        targetCode,
        targetEmail,
        relationshipType: 'friend',
        specificRelation: '好朋友',
        friendLevel: 'close'
      })).rejects.toThrow('该用户已在您的协助列表中');
    });

    it('should allow creating relation when no active relation exists', async () => {
      const assistantId = '507f1f77bcf86cd799439011';
      const targetCode = 'TEST123456789012';
      const targetEmail = 'target@example.com';

      const mockTargetUser = {
        _id: '507f1f77bcf86cd799439012',
        uniqueCode: targetCode,
        email: targetEmail.toLowerCase(),
        name: 'Test User'
      };

      User.findOne.mockResolvedValue(mockTargetUser);
      AssistRelation.findOne.mockResolvedValue(null);

      const result = await assistService.createRelation({
        assistantId,
        targetCode,
        targetEmail,
        relationshipType: 'friend',
        specificRelation: '好朋友',
        friendLevel: 'close'
      });

      expect(AssistRelation.findOne).toHaveBeenCalledWith({
        assistantId,
        targetId: mockTargetUser._id,
        isActive: true
      });
      expect(result).toBeDefined();
    });
  });

  describe('Normal creation flow', () => {
    it('should call checkDuplicateRelation before creating relation', async () => {
      const assistantId = '507f1f77bcf86cd799439011';
      const targetCode = 'TEST123456789012';
      const targetEmail = 'target@example.com';

      const mockTargetUser = {
        _id: '507f1f77bcf86cd799439012',
        uniqueCode: targetCode,
        email: targetEmail.toLowerCase(),
        name: 'Test User'
      };

      User.findOne.mockResolvedValue(mockTargetUser);
      AssistRelation.findOne.mockResolvedValue(null);

      const result = await assistService.createRelation({
        assistantId,
        targetCode,
        targetEmail,
        relationshipType: 'friend',
        specificRelation: '好朋友',
        friendLevel: 'close'
      });

      expect(AssistRelation.findOne).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
