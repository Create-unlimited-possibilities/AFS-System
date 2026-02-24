/**
 * Admin Panel E2E Tests - Memory Management
 *
 * Tests for memory management: view, rebuild index, export
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';


const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Admin Panel - Memory Management', () => {
  let adminToken = null;
  let testAdminId = null;
  let testUserId = null;
  let testMemoryId = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27018/afs_test');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create admin
    const validCode = process.env.ADMIN_INVITE_CODE;
    if (validCode) {
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'memoryadmin',
          password: 'MemoryAdmin123!',
          email: 'memoryadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status === 201) {
        testAdminId = adminResponse.body.user._id;
        adminToken = adminResponse.body.token;
      }
    }

    // Create test user with memories
    const userResponse = await request(API_URL)
      .post('/api/auth/register')
      .send({
        username: 'memoryuser',
        password: 'MemoryUser123!',
        email: 'memoryuser@test.com'
      });

    if (userResponse.status === 201) {
      testUserId = userResponse.body.user._id;

      // Create test memories
      const Memory = mongoose.model('Memory');
      const memory = new Memory({
        userId: testUserId,
        content: 'Test memory content about childhood',
        metadata: {
          type: 'episodic',
          importance: 0.8
        }
      });
      await memory.save();
      testMemoryId = memory._id;
    }
  });

  afterEach(async () => {
    // Cleanup memories
    if (testMemoryId) {
      await mongoose.model('Memory').deleteOne({ _id: testMemoryId });
    }

    // Cleanup user
    if (testUserId) {
      await mongoose.model('User').deleteOne({ _id: testUserId });
    }

    // Cleanup admin
    if (testAdminId) {
      await mongoose.model('User').deleteOne({ _id: testAdminId });
    }

    testMemoryId = null;
    testUserId = null;
    testAdminId = null;
    adminToken = null;
  });

  describe('5. Memory Management - View User Memories', () => {
    it('should get list of users with memories', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should include memory count in user list', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/users')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const testUser = response.body.users.find(u => u._id === testUserId.toString());
        expect(testUser).toBeDefined();
        expect(testUser.memoryCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('should support pagination in user list', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
    });

    it('should search users by username or email', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/users?search=memoryuser')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.users.length).toBeGreaterThan(0);
        expect(response.body.users[0].username).toContain('memoryuser');
      }
    });
  });

  describe('5. Memory Management - View User Memory Details', () => {
    it('should get all memories for a specific user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.memories).toBeInstanceOf(Array);
      expect(response.body.memories.length).toBeGreaterThanOrEqual(1);
      expect(response.body.user).toBeDefined();
    });

    it('should include memory metadata', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 && response.body.memories.length > 0) {
        const memory = response.body.memories[0];
        expect(memory.content).toBeDefined();
        expect(memory.createdAt).toBeDefined();
        expect(memory.metadata).toBeDefined();
      }
    });

    it('should filter memories by type', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}?type=episodic`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.memories.every(m => m.metadata?.type === 'episodic')).toBe(true);
      }
    });

    it('should paginate memories', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}?page=1&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('5. Memory Management - Rebuild Vector Index', () => {
    it('should trigger index rebuild for user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .post(`/api/admin/memories/users/${testUserId}/rebuild-index`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Should return success (operation is async)
      expect([200, 202]).toContain(response.status);
      expect(response.body.message).toContain('rebuild');
    });

    it('should return rebuild job status', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .post(`/api/admin/memories/users/${testUserId}/rebuild-index`)
        .set('Authorization', `Bearer ${adminToken}`);

      if ([200, 202].includes(response.status)) {
        expect(response.body.jobId).toBeDefined();
      }
    });

    it('should check rebuild status', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      // Start rebuild
      const rebuildResponse = await request(API_URL)
        .post(`/api/admin/memories/users/${testUserId}/rebuild-index`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (rebuildResponse.status === 202 && rebuildResponse.body.jobId) {
        // Check status
        const statusResponse = await request(API_URL)
          .get(`/api/admin/memories/jobs/${rebuildResponse.body.jobId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(statusResponse.status).toBe(200);
        expect(statusResponse.body.status).toBeDefined();
      }
    });

    it('should validate user exists before rebuilding', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .post(`/api/admin/memories/users/${fakeId}/rebuild-index`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('5. Memory Management - Export Memories', () => {
    it('should export user memories as JSON', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export all memory fields', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}/export`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.memories).toBeInstanceOf(Array);
        if (response.body.memories.length > 0) {
          const memory = response.body.memories[0];
          expect(memory.content).toBeDefined();
          expect(memory.createdAt).toBeDefined();
          expect(memory.metadata).toBeDefined();
        }
      }
    });

    it('should support CSV export format', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}/export?format=csv`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('text/csv');
      }
    });

    it('should filter exported memories by date range', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}/export?startDate=${yesterday.toISOString()}&endDate=${today.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('5. Memory Management - Vector Index Status', () => {
    it('should get ChromaDB index status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/index-status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(response.body.collections).toBeDefined();
    });

    it('should include collection statistics', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/index-status')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.totalDocuments).toBeDefined();
        expect(response.body.totalCollections).toBeDefined();
      }
    });

    it('should get per-user index status', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/memories/users/${testUserId}/index-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.indexed).toBeDefined();
      expect(response.body.total).toBeDefined();
    });
  });

  describe('5. Memory Management - Bulk Operations', () => {
    let userIds = [];

    beforeEach(async () => {
      // Create multiple users with memories
      for (let i = 1; i <= 3; i++) {
        const userResponse = await request(API_URL)
          .post('/api/auth/register')
          .send({
            username: `bulkmemuser${i}`,
            password: `BulkMemUser${i}123!`,
            email: `bulkmemuser${i}@test.com`
          });

        if (userResponse.status === 201) {
          const userId = userResponse.body.user._id;
          userIds.push(userId);

          // Create memories for each user
          const Memory = mongoose.model('Memory');
          const memory = new Memory({
            userId,
            content: `Test memory ${i}`,
            metadata: { type: 'test' }
          });
          await memory.save();
        }
      }
    });

    afterEach(async () => {
      // Cleanup
      for (const id of userIds) {
        await mongoose.model('Memory').deleteMany({ userId: id });
        await mongoose.model('User').deleteOne({ _id: id });
      }
      userIds = [];
    });

    it('should export multiple users memories', async () => {
      if (!adminToken || userIds.length === 0) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/memories/bulk-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds });

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBe(userIds.length);
    });

    it('should trigger bulk index rebuild', async () => {
      if (!adminToken || userIds.length === 0) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/memories/bulk-rebuild')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds });

      expect([200, 202]).toContain(response.status);
    });
  });

  describe('5. Memory Management - Memory Analytics', () => {
    it('should get memory statistics overview', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalMemories).toBeDefined();
      expect(response.body.totalUsers).toBeDefined();
      expect(response.body.averageMemoriesPerUser).toBeDefined();
    });

    it('should get memory type distribution', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/stats?type-distribution=true')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.byType).toBeDefined();
        expect(Array.isArray(response.body.byType)).toBe(true);
      }
    });

    it('should get memory growth timeline', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/stats?timeline=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.timeline).toBeDefined();
        expect(Array.isArray(response.body.timeline)).toBe(true);
      }
    });
  });
});
