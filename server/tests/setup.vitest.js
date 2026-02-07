/**
 * Vitest 测试设置文件
 * 全局测试配置和环境初始化
 * 
 * @author AFS Team
 * @version 1.0.0
 */

import { vi } from 'vitest';

// 将 vi 添加到全局作用域以兼容现有的测试代码
global.jest = vi;

// 全局 Mock 对象
global.mocks = {};

// 控制台日志级别（减少测试输出）
const originalConsole = { ...console };

beforeAll(() => {
  // 减少不必要的控制台输出
  console.log = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  // 恢复原始控制台
  Object.assign(console, originalConsole);
});

// 每个测试前重置 Mock
beforeEach(() => {
  vi.clearAllMocks();
});

// 全局测试工具函数
global.testUtils = {
  /**
   * 创建模拟用户对象
   */
  createMockUser: (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    uniqueCode: 'TEST123456789012',
    email: 'test@example.com',
    name: '测试用户',
    role: '507f1f77bcf86cd799439012',
    isActive: true,
    companionChat: {
      roleCard: {
        personality: '温和',
        background: '退休教师',
        interests: ['阅读', '园艺'],
        communicationStyle: '友善',
        values: ['诚实', '善良'],
        emotionalNeeds: ['关爱', '理解'],
        lifeMilestones: ['退休', '孙子出生'],
        preferences: ['安静的环境'],
        memories: ['教学生涯的美好回忆'],
        strangerInitialSentiment: 50,
        generatedAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        memoryTokenCount: 1000
      },
      currentMode: 'mode1',
      modelStatus: {
        hasBaseModel: false,
        hasSFTModel: false,
        hasFullModel: false,
        lastTrainedAt: null,
        trainingInProgress: false
      },
      strangerSentiments: [],
      conversationsAsTarget: [],
      assistantsGuidelines: []
    },
    createdAt: new Date('2026-01-01'),
    lastLogin: new Date('2026-01-01'),
    ...overrides
  }),

  /**
   * 创建模拟聊天会话对象
   */
  createMockChatSession: (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439013',
    sessionId: 'session_123456',
    targetUserId: '507f1f77bcf86cd799439011',
    interlocutorUserId: '507f1f77bcf86cd799439012',
    relation: 'stranger',
    sentimentScore: 50,
    dynamicRoleCard: {
      profile: {
        personality: '温和',
        background: '退休教师',
        interests: ['阅读', '园艺'],
        communicationStyle: '友善'
      },
      interlocutorInfo: {
        name: '小明',
        relation: '陌生人',
        specificRelation: '',
        nickname: '小明'
      },
      conversationGuidelines: '友善的对话准则',
      generatedAt: new Date('2026-01-01')
    },
    langGraphState: {
      currentNode: 'input_processor',
      stateHistory: []
    },
    messages: [],
    startedAt: new Date('2026-01-01'),
    lastMessageAt: new Date('2026-01-01'),
    isActive: true,
    ...overrides
  }),

  /**
   * 创建模拟协助关系对象
   */
  createMockAssistRelation: (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439014',
    assistantId: '507f1f77bcf86cd799439012',
    targetId: '507f1f77bcf86cd799439011',
    relationshipType: 'family',
    specificRelation: '儿子',
    friendLevel: 'close',
    answerSummary: {
      hasAnswers: true,
      basicAnswersCount: 10,
      emotionalAnswersCount: 8,
      lastAnswerUpdatedAt: new Date('2026-01-01')
    },
    guidelinesGenerated: false,
    createdAt: new Date('2026-01-01'),
    isActive: true,
    ...overrides
  }),

  /**
   * 等待异步操作完成
   */
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * 创建 Mock Response 对象
   */
  createMockResponse: () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  }),

  /**
   * 创建 Mock Request 对象
   */
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    user: global.testUtils.createMockUser(),
    ...overrides
  })
};

// MongoDB Mock 工具
global.mockMongo = {
  /**
   * 创建 Mock Model
   */
  createMockModel: (mockData = []) => {
    return {
      find: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue(mockData),
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockReturnValue(mockData)
        }),
        populate: vi.fn().mockReturnValue(mockData)
      }),
      findById: vi.fn().mockImplementation(id => 
        Promise.resolve(mockData.find(item => item._id.toString() === id.toString()))
      ),
      findOne: vi.fn().mockReturnValue(mockData[0] || null),
      create: vi.fn().mockImplementation(data => 
        Promise.resolve({ _id: 'mock_id', ...data })
      ),
      updateOne: vi.fn().mockReturnValue({ modifiedCount: 1 }),
      updateMany: vi.fn().mockReturnValue({ modifiedCount: 1 }),
      deleteOne: vi.fn().mockReturnValue({ deletedCount: 1 }),
      deleteMany: vi.fn().mockReturnValue({ deletedCount: 1 }),
      countDocuments: vi.fn().mockReturnValue(mockData.length)
    };
  }
};

// 测试数据工厂
global.testData = {
  /**
   * 感情分析测试数据
   */
  sentimentTestData: [
    { message: '我今天心情很好', expected: { sentiment: 'positive', score: 5 } },
    { message: '很难过的事情发生了', expected: { sentiment: 'negative', score: -5 } },
    { message: '今天天气不错', expected: { sentiment: 'neutral', score: 0 } },
    { message: '', expected: { sentiment: 'neutral', score: 0 } },
    { message: '我很高兴见到你！你真是一个好朋友！', expected: { sentiment: 'positive', score: 8 } }
  ],

  /**
   * 好感度测试数据
   */
  sentimentData: [
    {
      currentScore: 50,
      factors: { sentiment: 5, frequency: 0.5, quality: 1, decay: 0 },
      expectedChange: 3.3 // 5*0.6 + 0.5*0.2 + 1*0.1 + 0*0.1 = 3.3
    },
    {
      currentScore: 70,
      factors: { sentiment: -3, frequency: 0.2, quality: 0, decay: -1 },
      expectedChange: -2.3 // -3*0.6 + 0.2*0.2 + 0*0.1 + (-1)*0.1 = -2.3
    }
  ]
};

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/afs_test';

// MongoDB 模型 Mock
const mockSchemaConstructor = function(schemaDef) {
  this.pre = vi.fn();
  this.post = vi.fn();
  this.index = vi.fn();
  this.static = vi.fn();
  this.methods = vi.fn();
  this.statics = {};
  this.Types = {
    ObjectId: vi.fn().mockImplementation((val) => val),
    Mixed: vi.fn(),
    String: vi.fn(),
    Number: vi.fn(),
    Date: vi.fn(),
    Boolean: vi.fn(),
    Array: vi.fn()
  };
};

const mongooseMock = {
  Schema: vi.fn(mockSchemaConstructor),
  model: vi.fn().mockReturnValue({
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    countDocuments: vi.fn(),
    distinct: vi.fn(),
    aggregate: vi.fn(),
    populate: vi.fn(),
    sort: vi.fn(),
    limit: vi.fn(),
    skip: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn()
  }),
  SchemaTypes: {
    ObjectId: vi.fn().mockImplementation((val) => val),
    Mixed: vi.fn(),
    String: vi.fn(),
    Number: vi.fn(),
    Date: vi.fn(),
    Boolean: vi.fn(),
    Array: vi.fn()
  }
};

mongooseMock.SchemaTypes.ObjectId = mongooseMock.SchemaTypes.ObjectId;
mongooseMock.SchemaTypes.Mixed = mongooseMock.SchemaTypes.Mixed;
mongooseMock.SchemaTypes.String = mongooseMock.SchemaTypes.String;
mongooseMock.SchemaTypes.Number = mongooseMock.SchemaTypes.Number;
mongooseMock.SchemaTypes.Date = mongooseMock.SchemaTypes.Date;
mongooseMock.SchemaTypes.Boolean = mongooseMock.SchemaTypes.Boolean;
mongooseMock.SchemaTypes.Array = mongooseMock.SchemaTypes.Array;

mongooseMock.Schema.Types = mongooseMock.SchemaTypes;

vi.mock('mongoose', () => {
  return {
    default: {
      Schema: mongooseMock.Schema,
      model: mongooseMock.model,
      SchemaTypes: mongooseMock.SchemaTypes
    },
    Schema: mongooseMock.Schema,
    model: mongooseMock.model,
    SchemaTypes: mongooseMock.SchemaTypes
  };
});

export { mongooseMock };

// 创建一个简单的 ChatSession 模型模拟
vi.mock('../../src/models/ChatSession.js', () => {
  class MockChatSession {
    constructor(data) {
      Object.assign(this, {
        sessionId: data.sessionId || 'default_session',
        targetUserId: data.targetUserId,
        interlocutorUserId: data.interlocutorUserId,
        relation: data.relation || 'stranger',
        sentimentScore: data.sentimentScore || 50,
        dynamicRoleCard: data.dynamicRoleCard || {},
        langGraphState: data.langGraphState || { currentNode: 'input_processor', stateHistory: [] },
        messages: data.messages || [],
        startedAt: data.startedAt || new Date(),
        lastMessageAt: data.lastMessageAt || new Date(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        ...data
      });
    }

    static findById(id) {
      return vi.fn().mockResolvedValue(new MockChatSession({ _id: id }));
    }

    async save() {
      return this;
    }

    async validate() {
      return this;
    }
  }

  return {
    default: MockChatSession
  };
});

// User 模型的 mock
vi.mock('../../src/models/User.js', () => {
  class MockUser {
    static findById(id) {
      return vi.fn().mockResolvedValue({
        _id: id,
        name: 'Test User',
        email: 'test@example.com'
      });
    }

    static create(data) {
      return vi.fn().mockResolvedValue({
        _id: 'mock_id',
        ...data
      });
    }
  }

  return {
    default: MockUser
  };
});

// Answer 模型的 mock
vi.mock('../../src/models/Answer.js', () => {
  class MockAnswer {
    static getProgress(userId, targetUserId, layer) {
      return Promise.resolve({
        total: 10,
        answered: 10,
        percentage: 100
      });
    }

    static find(query) {
      return {
        sort(fn) {
          return this;
        },
        async exec() {
          return [];
        }
      };
    }
  }

  return {
    default: MockAnswer
  };
});

// Question 模型的 mock
vi.mock('../../src/models/Question.js', () => {
  class MockQuestion {
    static findById(id) {
      return Promise.resolve({
        _id: id,
        question: '测试问题',
        order: 1,
        layer: 'basic',
        active: true
      });
    }
  }

  return {
    default: MockQuestion
  };
});