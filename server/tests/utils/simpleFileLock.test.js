import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { acquireLock } from '../../src/utils/simpleFileLock.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_DIR = path.join(__dirname, '../../.locks');

describe('simpleFileLock', () => {
  beforeEach(() => {
    if (fs.existsSync(LOCK_DIR)) {
      fs.rmSync(LOCK_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(LOCK_DIR)) {
      fs.rmSync(LOCK_DIR, { recursive: true, force: true });
    }
  });

  describe('acquireLock', () => {
    test('should acquire lock successfully', async () => {
      const testFilePath = path.join(__dirname, '../data/test.json');
      const release = await acquireLock(testFilePath);
      
      expect(release).toBeDefined();
      expect(typeof release).toBe('function');
      
      await release();
    });

    test('should create lock directory if not exists', async () => {
      expect(fs.existsSync(LOCK_DIR)).toBe(false);
      
      const testFilePath = path.join(__dirname, '../data/test.json');
      const release = await acquireLock(testFilePath);
      
      expect(fs.existsSync(LOCK_DIR)).toBe(true);
      
      await release();
    });

    test('should release lock when release function is called', async () => {
      const testFilePath = path.join(__dirname, '../data/test.json');
      const release = await acquireLock(testFilePath);
      
      await release();
      
      const release2 = await acquireLock(testFilePath);
      expect(release2).toBeDefined();
      await release2();
    });

    test('should handle different file paths with different locks', async () => {
      const filePath1 = path.join(__dirname, '../data/test1.json');
      const filePath2 = path.join(__dirname, '../data/test2.json');
      
      const release1 = await acquireLock(filePath1);
      const release2 = await acquireLock(filePath2);
      
      expect(release1).toBeDefined();
      expect(release2).toBeDefined();
      
      await release1();
      await release2();
    });

    test('should fail when trying to acquire same lock concurrently', async () => {
      const testFilePath = path.join(__dirname, '../data/test.json');
      
      const release1 = await acquireLock(testFilePath);
      
      await expect(acquireLock(testFilePath)).rejects.toThrow(/Failed to acquire lock/);
      
      await release1();
    });
  });

  describe('getLockKey', () => {
    test('should convert file path to lock key', async () => {
      const testFilePath = path.join(__dirname, '../data/test.json');
      const release = await acquireLock(testFilePath);
      
      const lockKey = path.relative(path.join(__dirname, '../..'), testFilePath).replace(/[^a-z0-9]/gi, '_');
      const expectedLockFile = path.join(LOCK_DIR, `${lockKey}.lock.lock`);
      
      expect(fs.existsSync(expectedLockFile)).toBe(true);
      
      await release();
    });
  });
});
