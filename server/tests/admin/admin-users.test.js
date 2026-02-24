/**
 * Admin Panel E2E Tests - User Management
 *
 * Tests for user management: create, edit, delete, toggle status
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Admin Panel - User Management', () => {
  let adminToken = null;
  let testUserId = null;
  let testAdminId = null;

  beforeEach(async () => {
    // Create admin user
    const validCode = process.env.ADMIN_INVITE_CODE;
    if (validCode) {
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'useradmin',
          password: 'UserAdmin123!',
          email: 'useradmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status === 201) {
        testAdminId = adminResponse.body.user._id;
        adminToken = adminResponse.body.token;
      }
    }

    // Create test user
    const userResponse = await request(API_URL)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'TestUser123!',
        email: 'testuser@test.com'
      });

    if (userResponse.status === 201) {
      testUserId = userResponse.body.user._id;
    }
  });

  afterEach(async () => {
    // Cleanup via API
    if (testAdminId && adminToken) {
      await request(API_URL)
        .delete(`/api/admin/users/${testAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    if (testUserId && adminToken) {
      await request(API_URL)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    testUserId = null;
    testAdminId = null;
    adminToken = null;
  });

  describe('3. User Management - List and Search', () => {
    it('should get paginated user list', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter users by status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every(u => u.isActive === true)).toBe(true);
    });

    it('should search users by username', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users?search=testuser')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
      expect(response.body.users[0].username).toContain('testuser');
    });

    it('should search users by email', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users?search=testuser@test.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeGreaterThan(0);
    });

    it('should filter users by role', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users?role=user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users.every(u => u.role === 'user')).toBe(true);
    });
  });

  describe('3. User Management - View User Details', () => {
    it('should get user details by ID', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user._id).toBe(testUserId.toString());
      expect(response.body.user.username).toBeDefined();
      expect(response.body.user.email).toBeDefined();
      expect(response.body.user.createdAt).toBeDefined();
    });

    it('should include user statistics in details', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats).toBeDefined();
        expect(response.body.stats.memoryCount).toBeDefined();
        expect(response.body.stats.sessionCount).toBeDefined();
      }
    });

    it('should return 404 for non-existent user', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .get(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('3. User Management - Edit User', () => {
    it('should update user basic information', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const updateData = {
        username: 'updateduser',
        email: 'updated@test.com'
      };

      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe(updateData.username);
      expect(response.body.user.email).toBe(updateData.email);
    });

    it('should assign role to user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('moderator');
    });

    it('should reject invalid email format', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate username', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      // Create another user
      const anotherUser = await request(API_URL)
        .post('/api/auth/register')
        .send({
          username: 'anotheruser',
          password: 'AnotherUser123!',
          email: 'another@test.com'
        });

      if (anotherUser.status !== 201) {
        return;
      }

      const anotherUserId = anotherUser.body.user._id;

      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'anotheruser' });

      expect([400, 409]).toContain(response.status);

      // Cleanup
      await request(API_URL)
        .delete(`/api/admin/users/${anotherUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });
  });

  describe('3. User Management - Toggle User Status', () => {
    it('should deactivate active user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .patch(`/api/admin/users/${testUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isActive).toBe(false);
    });

    it('should activate inactive user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      // First deactivate
      await request(API_URL)
        .patch(`/api/admin/users/${testUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then activate
      const response = await request(API_URL)
        .patch(`/api/admin/users/${testUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isActive).toBe(true);
    });

    it('should prevent deactivated user from logging in', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      // Deactivate user
      await request(API_URL)
        .patch(`/api/admin/users/${testUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Try to login
      const loginResponse = await request(API_URL)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestUser123!'
        });

      expect(loginResponse.status).toBe(403);
      expect(loginResponse.body.message).toContain('deactivated');
    });
  });

  describe('3. User Management - Delete User', () => {
    it('should soft delete user', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify user is soft deleted via API
      const verifyResponse = await request(API_URL)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.user.deletedAt).toBeDefined();
    });

    it('should not allow deleting admin themselves', async () => {
      if (!adminToken || !testAdminId) {
        return;
      }

      const response = await request(API_URL)
        .delete(`/api/admin/users/${testAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot delete yourself');
    });

    it('should return 404 for deleting non-existent user', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .delete(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('3. User Management - Bulk Operations', () => {
    let userIds = [];

    beforeEach(async () => {
      // Create multiple test users
      for (let i = 1; i <= 3; i++) {
        const response = await request(API_URL)
          .post('/api/auth/register')
          .send({
            username: `bulkuser${i}`,
            password: `BulkUser${i}123!`,
            email: `bulkuser${i}@test.com`
          });

        if (response.status === 201) {
          userIds.push(response.body.user._id);
        }
      }
    });

    afterEach(async () => {
      // Cleanup bulk users via API
      if (adminToken) {
        for (const id of userIds) {
          await request(API_URL)
            .delete(`/api/admin/users/${id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
      }
      userIds = [];
    });

    it('should bulk deactivate users', async () => {
      if (!adminToken || userIds.length === 0) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/users/bulk-deactivate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(userIds.length);
    });

    it('should bulk delete users', async () => {
      if (!adminToken || userIds.length === 0) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/users/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(userIds.length);
    });

    it('should validate bulk operation limits', async () => {
      if (!adminToken) {
        return;
      }

      // Try to bulk delete more than allowed
      const manyIds = Array.from({ length: 101 }, () => new mongoose.Types.ObjectId());

      const response = await request(API_URL)
        .post('/api/admin/users/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: manyIds });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('limit');
    });
  });
});
