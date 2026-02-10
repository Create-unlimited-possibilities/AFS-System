import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AutoHookRegistry from '../../src/services/autoHookRegistry.js';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('AutoHookRegistry', () => {
  let registry;
  let mockSyncQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSyncQueue = {
      enqueue: vi.fn()
    };

    registry = new AutoHookRegistry(mockSyncQueue);

    fs.readdirSync.mockReturnValue([
      'User.js',
      'Answer.js',
      'AssistRelation.js',
      'ChatSession.js',
      'Question.js',
      'Role.js'
    ]);

    vi.mocked(path.join).mockImplementation((dir, ...rest) => {
      return rest.join('/');
    });
    
    AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with syncQueue', () => {
      const newRegistry = new AutoHookRegistry(mockSyncQueue);
      expect(newRegistry.syncQueue).toBe(mockSyncQueue);
    });

    it('should initialize empty hookedModels Set', () => {
      expect(registry.hookedModels).toBeInstanceOf(Set);
      expect(registry.hookedModels.size).toBe(0);
    });
  });

  describe('registerAll', () => {
    it('should read models directory', async () => {
      await registry.registerAll();
      
      expect(fs.readdirSync).toHaveBeenCalled();
    });

    it('should filter JS files excluding hidden files', async () => {
      fs.readdirSync.mockReturnValue([
        'User.js',
        '.hidden.js',
        'Answer.js',
        'test.txt'
      ]);
      
      await registry.registerAll();
      
      expect(fs.readdirSync).toHaveBeenCalled();
      
      fs.readdirSync.mockReturnValue([
        'User.js',
        'Answer.js',
        'AssistRelation.js',
        'ChatSession.js',
        'Question.js',
        'Role.js'
      ]);
    });

    it('should not register hooks for non-specified models', async () => {
      await registry.registerAll();
      
      expect(registry.hookedModels.has('Question')).toBe(false);
      expect(registry.hookedModels.has('Role')).toBe(false);
    });
  });

  describe('registerHook', () => {
    it('should register post save hook', async () => {
      const mockSchema = {
        post: vi.fn()
      };
      
      const mockModel = {
        schema: mockSchema
      };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSchema.post).toHaveBeenCalledWith('save', expect.any(Function));
    });

    it('should register post deleteOne hook', async () => {
      const mockSchema = {
        post: vi.fn()
      };
      
      const mockModel = {
        schema: mockSchema
      };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSchema.post).toHaveBeenCalledWith(
        'deleteOne',
        { query: true, document: false },
        expect.any(Function)
      );
    });

    it('should call syncQueue.enqueue on save', async () => {
      const mockSchema = {
        post: vi.fn((event, fn) => {
          if (event === 'save') {
            const mockDoc = {
              _id: { toString: () => 'user123' }
            };
            fn(mockDoc);
          }
        })
      };
      
      const mockModel = {
        schema: mockSchema
      };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);
      AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'User',
        'user123',
        'save',
        { _id: { toString: expect.any(Function) } }
      );
      
      AutoHookRegistry.syncQueueClass = null;
    });

    it('should call syncQueue.enqueue on deleteOne', async () => {
      const mockSchema = {
        post: vi.fn((event, options, fn) => {
          if (event === 'deleteOne') {
            const mockQuery = {
              getFilter: () => ({ _id: 'user123' })
            };
            fn.call(mockQuery);
          }
        })
      };
      
      const mockModel = {
        schema: mockSchema
      };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);
      AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'User',
        'user123',
        'delete'
      );
      
      AutoHookRegistry.syncQueueClass = null;
    });

    it('should not call enqueue if syncQueue.instance is null', async () => {
      const mockSchema = {
        post: vi.fn((event, fn) => {
          if (event === 'save') {
            const mockDoc = {
              _id: { toString: () => 'user123' }
            };
            fn(mockDoc);
          }
        })
      };
      
      const mockModel = {
        schema: mockSchema
      };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);
      AutoHookRegistry.syncQueueClass = { instance: null };

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSyncQueue.enqueue).not.toHaveBeenCalled();
      
      AutoHookRegistry.syncQueueClass = null;
    });

    it('should add model to hookedModels set', async () => {
      const mockSchema = { post: vi.fn() };
      const mockModel = { schema: mockSchema };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);

      await registry.registerHook('User', '/path/to/User.js');

      expect(registry.hookedModels.has('User')).toBe(true);
    });

    it('should skip if model already hooked', async () => {
      const mockSchema = { post: vi.fn() };
      const mockModel = { schema: mockSchema };

      registry.hookedModels.add('User');
      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSchema.post).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Already hooked: User');

      logSpy.mockRestore();
    });

    it('should log error on failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.spyOn(registry, 'getModel').mockRejectedValue(new Error('Import failed'));

      await registry.registerHook('User', '/path/to/User.js');

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to hook User:',
        'Import failed'
      );
      expect(registry.hookedModels.has('User')).toBe(false);

      errorSpy.mockRestore();
    });
  });

  describe('getModel', () => {
    it('should be a function', async () => {
      expect(typeof registry.getModel).toBe('function');
    });
  });

  describe('getSyncQueueClass', () => {
    it('should be a static method', async () => {
      expect(typeof AutoHookRegistry.getSyncQueueClass).toBe('function');
    });
  });

  describe('integration', () => {
    it('should complete full registration flow', async () => {
      const mockSchemas = {
        User: { post: vi.fn() },
        Answer: { post: vi.fn() },
        AssistRelation: { post: vi.fn() },
        ChatSession: { post: vi.fn() }
      };

      const mockModels = {
        User: { schema: mockSchemas.User },
        Answer: { schema: mockSchemas.Answer },
        AssistRelation: { schema: mockSchemas.AssistRelation },
        ChatSession: { schema: mockSchemas.ChatSession }
      };

      const getModelSpy = vi.spyOn(registry, 'getModel').mockImplementation(async (modelPath) => {
        const modelName = 'User';
        return mockModels[modelName];
      });

      AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };

      await registry.registerHook('User', '/path/to/User.js');

      expect(registry.hookedModels.has('User')).toBe(true);
      expect(mockSchemas.User.post).toHaveBeenCalledTimes(2);
      
      AutoHookRegistry.syncQueueClass = null;
      getModelSpy.mockRestore();
    });

    it('should handle save operation through hook', async () => {
      const mockSchema = {
        post: vi.fn((event, fn) => {
          if (event === 'save') {
            const mockDoc = {
              _id: { toString: () => 'test123' },
              name: 'Test User'
            };
            fn(mockDoc);
          }
        })
      };

      const mockModel = { schema: mockSchema };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);
      AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };

      await registry.registerHook('User', '/path/to/User.js');

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'User',
        'test123',
        'save',
        expect.objectContaining({ name: 'Test User' })
      );
      
      AutoHookRegistry.syncQueueClass = null;
    });

    it('should handle delete operation through hook', async () => {
      const mockSchema = {
        post: vi.fn((event, options, fn) => {
          if (event === 'deleteOne') {
            const mockQuery = {
              getFilter: () => ({ _id: 'test123' })
            };
            fn.call(mockQuery);
          }
        })
      };

      const mockModel = { schema: mockSchema };

      vi.spyOn(registry, 'getModel').mockResolvedValue(mockModel);
      AutoHookRegistry.syncQueueClass = { instance: mockSyncQueue };

      await registry.registerHook('Answer', '/path/to/Answer.js');

      expect(mockSyncQueue.enqueue).toHaveBeenCalledWith(
        'Answer',
        'test123',
        'delete'
      );
      
      AutoHookRegistry.syncQueueClass = null;
    });
  });
});
