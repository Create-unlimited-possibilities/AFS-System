import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import AnswerService from '../../src/services/AnswerService.js';
import QuestionRepository from '../../repositories/QuestionRepository.js';
import UserRepository from '../../repositories/UserRepository.js';
import Answer from '../../models/Answer.js';
import User from '../../models/User.js';
import Question from '../../models/Question.js';

describe('Double Storage Integration Test', () => {
  let mongoServer;
  let testUserId;
  let testQuestionId;
  let storageBasePath;
  let answerService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    await User.deleteMany({});
    await Answer.deleteMany({});
    await Question.deleteMany({});

    storageBasePath = path.join(process.cwd(), 'test-storage');
    await fs.rm(storageBasePath, { recursive: true, force: true }).catch(() => {});

    answerService = new AnswerService();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    await fs.rm(storageBasePath, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await Answer.deleteMany({});
    await User.deleteMany({});
  });

  afterEach(async () => {
    await fs.rm(storageBasePath, { recursive: true, force: true }).catch(() => {});
  });

  describe('RED: AutoHookRegistry.syncQueueClass not set', () => {
    it('should fail: syncQueueClass is null when server starts', async () => {
      const AutoHookRegistry = (await import('../../src/services/autoHookRegistry.js')).default;

      expect(AutoHookRegistry.syncQueueClass).toBeNull();
      expect(AutoHookRegistry.syncQueueClass?.instance).toBeUndefined();
    });
  });

  describe('RED: Answer save triggers FileStorage', () => {
    it('should fail: FileStorage does not save when Answer.save() is called', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password123',
        uniqueCode: 'TEST123'
      });

      const question = await Question.create({
        role: 'elder',
        layer: 'basic',
        order: 1,
        question: '测试问题',
        active: true
      });

      testUserId = user._id.toString();
      testQuestionId = question._id.toString();

      await answerService.saveSelfAnswer(testUserId, testQuestionId, '测试答案');

      const userPath = path.join(storageBasePath, 'userdata', testUserId, 'A_set', 'self', 'basic');
      const filePath = path.join(userPath, 'question_1.json');

      let fileExists = false;
      try {
        await fs.access(filePath);
        fileExists = true;
      } catch (err) {
        fileExists = false;
      }

      expect(fileExists).toBe(false);
    });
  });

  describe('RED: DualStorage saves backup', () => {
    it('should fail: DualStorage.backup not saved when Answer.save() is called', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password123',
        uniqueCode: 'TEST123'
      });

      const question = await Question.create({
        role: 'elder',
        layer: 'basic',
        order: 1,
        question: '测试问题',
        active: true
      });

      testUserId = user._id.toString();
      testQuestionId = question._id.toString();

      const answer = await answerService.saveSelfAnswer(testUserId, testQuestionId, '测试答案');

      const backupPath = path.join(storageBasePath, 'userdata', 'answers', answer._id.toString(), 'answer.json');

      let fileExists = false;
      try {
        await fs.access(backupPath);
        fileExists = true;
      } catch (err) {
        fileExists = false;
      }

      expect(fileExists).toBe(false);
    });
  });
});
