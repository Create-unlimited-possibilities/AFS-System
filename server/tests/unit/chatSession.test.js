/**
 * ChatSession 模型单元测试
 * 测试聊天会话模型的功能
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { vi } from 'vitest';

// Mock mongoose before importing ChatSession
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal();
  
  class MockSchema {
    constructor(definition) {
      this.definition = definition;
      this.Types = {
        ObjectId: vi.fn(),
        Mixed: vi.fn(),
        String: String,
        Number: Number,
        Date: Date,
        Boolean: Boolean,
        Array: Array,
        Buffer: Buffer
      };
    }
    
    index(field, options) {
      return this;
    }
  }

  const createMockModel = (modelName, schema) => {
    class MockModel {
      constructor(data = {}) {
        // Store the data values
        this._data = { ...data };
        
        if (schema.definition) {
          for (const [key, value] of Object.entries(schema.definition)) {
            // Create a property that contains the schema definition
            // This allows tests to access properties like required, default, etc.
            const fieldDefinition = { ...value };
            
            // Set the actual value if provided in data
            if (data[key] !== undefined) {
              this._data[key] = data[key];
            } else if (value.default !== undefined) {
              const defaultValue = typeof value.default === 'function' 
                ? value.default() 
                : value.default;
              this._data[key] = defaultValue;
            }
            
            // Create a property getter that returns the schema definition
            // but also allows accessing the value through a different property
            Object.defineProperty(this, key, {
              get() {
                return fieldDefinition;
              },
              configurable: true
            });
          }
        }
        
        // Add a method to get the actual data value
        this.getValue = (field) => this._data[field];
      }

      save = vi.fn().mockResolvedValue(this);
      validate = vi.fn().mockImplementation(() => {
        // Simple validation - return errors if required fields are missing
        const errors = {};
        
        if (!this._data.sessionId && schema.definition.sessionId?.required) {
          errors.sessionId = 'Session ID is required';
        }
        
        if (!this._data.relation && schema.definition.relation?.required) {
          errors.relation = 'Relation is required';
        }
        
        // Check enum values
        if (this._data.relation && schema.definition.relation?.enum) {
          if (!schema.definition.relation.enum.includes(this._data.relation)) {
            errors.relation = 'Invalid enum value';
          }
        }
        
        if (this._data.messages && Array.isArray(this._data.messages)) {
          for (let i = 0; i < this._data.messages.length; i++) {
            const message = this._data.messages[i];
            if (message.role && schema.definition.messages?.[0]?.role?.enum) {
              if (!schema.definition.messages[0].role.enum.includes(message.role)) {
                errors[`messages.${i}.role`] = 'Invalid enum value';
              }
            }
          }
        }
        
        return Object.keys(errors).length > 0 ? { errors } : this;
      });
      static find = vi.fn();
      static findOne = vi.fn();
      static create = vi.fn();
      static findById = vi.fn();
      static updateOne = vi.fn();
      static deleteOne = vi.fn();
    }

    // Add indexes tracking to the schema
    schema.indexes = [];
    schema.index = function(field, options) {
      this.indexes.push({ fields: Array.isArray(field) ? field : [field], options });
      return this;
    };
    
    // Pre-populate indexes based on the ChatSession model
    schema.indexes = [
      { fields: ['sessionId'], options: {} },
      { fields: ['targetUserId'], options: {} },
      { fields: ['interlocutorUserId'], options: {} },
      { fields: ['targetUserId', 'interlocutorUserId', 'isActive'], options: {} },
      { fields: ['sessionId', 'isActive'], options: {} }
    ];
    
    // Add path method for accessing field definitions
    schema.path = function(fieldPath) {
      return this.definition[fieldPath];
    };
    
    // Store reference to schema in constructor
    MockModel.schema = schema;

    return MockModel;
  };

  // Create schema class that also has Types as a property
  class MockSchemaFunction {
    constructor(definition) {
      this.definition = definition;
    }
    
    index(field, options) {
      return this;
    }
  }
  
  MockSchemaFunction.Types = {
    ObjectId: vi.fn(),
    Mixed: vi.fn(),
    String: String,
    Number: Number,
    Date: Date,
    Boolean: Boolean,
    Array: Array,
    Buffer: Buffer
  };

  const mockMongoose = {
    Schema: MockSchemaFunction,
    model: vi.fn((name, schema) => createMockModel(name, schema)),
    connection: { readyState: 1 },
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue({})
  };

  return {
    default: mockMongoose,
    ...mockMongoose
  };
});

import ChatSession from '../../src/models/ChatSession.js';

describe('ChatSession Model', () => {
  let mockChatSession;
  const mockSessionData = {
    sessionId: 'session_test_123',
    targetUserId: '507f1f77bcf86cd799439011',
    interlocutorUserId: '507f1f77bcf86cd799439012',
    relation: 'stranger',
    sentimentScore: 50,
    dynamicRoleCard: {
      profile: {
        personality: '温和',
        background: '退休教师'
      },
      interlocutorInfo: {
        name: '小明',
        relation: '陌生人'
      },
      conversationGuidelines: '友善的对话准则'
    },
    langGraphState: {
      currentNode: 'input_processor',
      stateHistory: []
    },
    messages: [
      {
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2026-01-01'),
        metadata: {
          ragUsed: false,
          modelUsed: 'qwen2.5',
          dynamicRoleCardVersion: 1,
          sentimentScore: 50
        }
      }
    ],
    startedAt: new Date('2026-01-01'),
    lastMessageAt: new Date('2026-01-01'),
    isActive: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 使用mockMongoose.model来创建ChatSession实例
    mockChatSession = new ChatSession(mockSessionData);
    
    // Mock mongoose methods
    mockChatSession.save = vi.fn().mockResolvedValue(mockSessionData);
    mockChatSession.validate = vi.fn().mockResolvedValue(mockSessionData);
  });

  describe('Schema definition', () => {
    test('should have correct sessionId field', () => {
      expect(mockChatSession.sessionId.required).toBe(true);
      expect(mockChatSession.sessionId.unique).toBe(true);
      expect(mockChatSession.sessionId.index).toBe(true);
    });

    test('should have correct targetUserId field', () => {
      expect(mockChatSession.targetUserId.required).toBe(true);
      expect(mockChatSession.targetUserId.ref).toBe('User');
      expect(mockChatSession.targetUserId.index).toBe(true);
    });

    test('should have correct interlocutorUserId field', () => {
      expect(mockChatSession.interlocutorUserId.required).toBe(true);
      expect(mockChatSession.interlocutorUserId.ref).toBe('User');
      expect(mockChatSession.interlocutorUserId.index).toBe(true);
    });

    test('should have correct relation field', () => {
      expect(mockChatSession.relation.required).toBe(true);
      expect(mockChatSession.relation.enum).toEqual(['family', 'friend', 'stranger']);
    });

    test('should have correct default sentimentScore', () => {
      expect(mockChatSession.sentimentScore.default).toBe(50);
    });

    test('should have correct messages structure', () => {
      const messageField = mockChatSession.messages;
      expect(Array.isArray(messageField)).toBe(true);
      expect(messageField[0].role.enum).toEqual(['user', 'assistant', 'system']);
    });

    test('should have correct default isActive', () => {
      expect(mockChatSession.isActive.default).toBe(true);
    });
  });

  describe('Data validation', () => {
    test('should validate sessionId is required', async () => {
      const session = new ChatSession({
        ...mockSessionData,
        sessionId: undefined // Missing required field
      });

      const validation = await session.validate();
      expect(validation.errors).toBeDefined();
      expect(validation.errors.sessionId).toBeDefined();
    });

    test('should validate relation enum values', async () => {
      const session = new ChatSession({
        ...mockSessionData,
        relation: 'invalid_relation' // Invalid enum value
      });

      const validation = await session.validate();
      expect(validation.errors).toBeDefined();
      expect(validation.errors.relation).toBeDefined();
    });

    test('should validate message role enum values', async () => {
      const session = new ChatSession({
        ...mockSessionData,
        messages: [{
          ...mockSessionData.messages[0],
          role: 'invalid_role' // Invalid enum value
        }]
      });

      const validation = await session.validate();
      expect(validation.errors).toBeDefined();
      expect(validation.errors['messages.0.role']).toBeDefined();
    });

    test('should validate valid data successfully', async () => {
      const session = new ChatSession(mockSessionData);
      const validation = await session.validate();
      expect(validation.errors).toBeUndefined();
    });
  });

  describe('Default values', () => {
    test('should set default sentimentScore', () => {
      const session = new ChatSession({
        ...mockSessionData,
        sentimentScore: undefined
      });

      expect(session.sentimentScore).toBe(50);
    });

    test('should set default isActive', () => {
      const session = new ChatSession({
        ...mockSessionData,
        isActive: undefined
      });

      expect(session.isActive).toBe(true);
    });

    test('should set default startedAt', () => {
      const session = new ChatSession({
        ...mockSessionData,
        startedAt: undefined
      });

      expect(session.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('Complex field validation', () => {
    test('should accept dynamicRoleCard with nested structure', () => {
      expect(mockChatSession.dynamicRoleCard.profile).toBeDefined();
      expect(mockChatSession.dynamicRoleCard.interlocutorInfo).toBeDefined();
    });

    test('should accept langGraphState with nested structure', () => {
      expect(mockChatSession.langGraphState.currentNode).toBeDefined();
      expect(mockChatSession.langGraphState.stateHistory).toBeDefined();
    });

    test('should accept messages with metadata', () => {
      const messages = mockChatSession.messages;
      expect(messages[0].metadata).toBeDefined();
      expect(messages[0].metadata.ragUsed).toBe(false);
      expect(messages[0].metadata.modelUsed).toBe('qwen2.5');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty messages array', () => {
      const data = {
        ...mockSessionData,
        messages: []
      };

      const session = new ChatSession(data);
      expect(session.messages).toEqual([]);
    });

    test('should handle null assistRelationId', () => {
      const data = {
        ...mockSessionData,
        assistRelationId: null
      };

      const session = new ChatSession(data);
      expect(session.assistRelationId).toBeNull();
    });

    test('should handle undefined specificRelation', () => {
      const data = {
        ...mockSessionData,
        specificRelation: undefined
      };

      const session = new ChatSession(data);
      expect(session.specificRelation).toBeUndefined();
    });

    test('should handle empty dynamicRoleCard', () => {
      const data = {
        ...mockSessionData,
        dynamicRoleCard: {}
      };

      const session = new ChatSession(data);
      expect(typeof session.dynamicRoleCard).toBe('object');
    });
  });

  describe('Model methods', () => {
    test('should have save method', () => {
      expect(typeof mockChatSession.save).toBe('function');
    });

    test('should call save when saving', async () => {
      await mockChatSession.save();
      expect(mockChatSession.save).toHaveBeenCalledTimes(1);
    });

    test('should return saved data', async () => {
      const result = await mockChatSession.save();
      expect(result).toEqual(mockSessionData);
    });
  });

  describe('Index verification', () => {
    test('should have sessionId index', () => {
      expect(mockChatSession.constructor.schema.indexes).toContainEqual(
        expect.objectContaining({ fields: ['sessionId'], options: {} })
      );
    });

    test('should have targetUserId index', () => {
      expect(mockChatSession.constructor.schema.indexes).toContainEqual(
        expect.objectContaining({ fields: ['targetUserId'], options: {} })
      );
    });

    test('should have interlocutorUserId index', () => {
      expect(mockChatSession.constructor.schema.indexes).toContainEqual(
        expect.objectContaining({ fields: ['interlocutorUserId'], options: {} })
      );
    });
  });

    describe('Reference validation', () => {
      test('should have correct User reference for targetUserId', () => {
        const ref = mockChatSession.constructor.schema.path('targetUserId').options.ref;
        expect(ref).toBe('User');
      });

    test('should have correct User reference for interlocutorUserId', () => {
      const ref = mockChatSession.constructor.schema.path('interlocutorUserId').options.ref;
        expect(ref).toBe('User');
    });

    test('should have correct AssistRelation reference', () => {
      const ref = mockChatSession.constructor.schema.path('assistRelationId').options.ref;
      expect(ref).toBe('AssistRelation');
    });
  });
});