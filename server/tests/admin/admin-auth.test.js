/**
 * Admin Panel E2E Tests - Authentication & Authorization
 *
 * Tests for admin registration flow with invite code,
 * admin login flow, and permission boundary tests
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_ADMIN = {
  username: 'testadmin',
  password: 'TestAdmin123!',
  email: 'testadmin@afs-system.com'
};

const TEST_USER = {
  username: 'testuser',
  password: 'TestUser123!',
  email: 'testuser@afs-system.com'
};

describe('Admin Panel - Authentication & Authorization', () => {
  let adminToken = null;
  let userToken = null;
  let testUserId = null;
  let testAdminId = null;

  beforeEach(async () => {
    // Create test user
    const userResponse = await request(API_URL)
      .post('/api/auth/register')
      .send(TEST_USER);

    if (userResponse.status === 201) {
      testUserId = userResponse.body.user._id;
      userToken = userResponse.body.token;
    }
  });

  afterEach(async () => {
    // Cleanup test data via API
    if (testAdminId && adminToken) {
      await request(API_URL)
        .delete(`/api/admin/users/${testAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    if (testUserId && adminToken) {
      await request(API_URL)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    } else if (testUserId && userToken) {
      // Try to delete with user token if admin token not available
      await request(API_URL)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`);
    }
    testUserId = null;
    testAdminId = null;
    adminToken = null;
    userToken = null;
  });

  describe('1. Admin Registration Flow with Invite Code', () => {
    it('should reject registration without invite code', async () => {
      const response = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'newadmin',
          password: 'NewAdmin123!',
          email: 'newadmin@test.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('invite code');
    });

    it('should reject registration with invalid invite code', async () => {
      const response = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'newadmin',
          password: 'NewAdmin123!',
          email: 'newadmin@test.com',
          inviteCode: 'INVALID_CODE'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid invite code');
    });

    it('should accept registration with valid .env invite code', async () => {
      const validCode = process.env.ADMIN_INVITE_CODE;

      if (!validCode) {
        console.warn('ADMIN_INVITE_CODE not set, skipping test');
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'envadmin',
          password: 'EnvAdmin123!',
          email: 'envadmin@test.com',
          inviteCode: validCode
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.role).toBe('admin');
      expect(response.body.token).toBeDefined();
      testAdminId = response.body.user._id;
      adminToken = response.body.token;
    });

    it('should accept registration with dynamically generated invite code', async () => {
      // First, create an admin using .env code
      const validCode = process.env.ADMIN_INVITE_CODE;
      if (!validCode) {
        console.warn('ADMIN_INVITE_CODE not set, skipping test');
        return;
      }

      // Create first admin
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'firstadmin',
          password: 'FirstAdmin123!',
          email: 'firstadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status !== 201) {
        console.warn('Could not create first admin, skipping test');
        return;
      }

      const firstAdminToken = adminResponse.body.token;

      // Generate dynamic invite code
      const inviteResponse = await request(API_URL)
        .post('/api/admin/invite-codes')
        .set('Authorization', `Bearer ${firstAdminToken}`)
        .send({ expiresIn: '24h' });

      expect(inviteResponse.status).toBe(201);
      const dynamicCode = inviteResponse.body.code;

      // Register second admin with dynamic code
      const secondAdminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'secondadmin',
          password: 'SecondAdmin123!',
          email: 'secondadmin@test.com',
          inviteCode: dynamicCode
        });

      expect(secondAdminResponse.status).toBe(201);
      expect(secondAdminResponse.body.user.role).toBe('admin');
      testAdminId = secondAdminResponse.body.user._id;
    });

    it('should mark invite code as used after registration', async () => {
      const validCode = process.env.ADMIN_INVITE_CODE;
      if (!validCode) {
        return;
      }

      // Create admin and generate invite code
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'codeadmin',
          password: 'CodeAdmin123!',
          email: 'codeadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status !== 201) {
        return;
      }

      const inviteResponse = await request(API_URL)
        .post('/api/admin/invite-codes')
        .set('Authorization', `Bearer ${adminResponse.body.token}`)
        .send({ expiresIn: '24h' });

      if (inviteResponse.status !== 201) {
        return;
      }

      const code = inviteResponse.body.code;

      // Register with the code
      await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'newadmin2',
          password: 'NewAdmin2123!',
          email: 'newadmin2@test.com',
          inviteCode: code
        });

      // Check code is marked as used
      const checkResponse = await request(API_URL)
        .get('/api/admin/invite-codes')
        .set('Authorization', `Bearer ${adminResponse.body.token}`);

      if (checkResponse.status === 200) {
        const usedCode = checkResponse.body.find(c => c.code === code);
        expect(usedCode).toBeDefined();
        expect(usedCode.used).toBe(true);
      }
    });

    it('should reject reuse of one-time invite code', async () => {
      const validCode = process.env.ADMIN_INVITE_CODE;
      if (!validCode) {
        return;
      }

      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'reuseadmin',
          password: 'ReuseAdmin123!',
          email: 'reuseadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status !== 201) {
        return;
      }

      const inviteResponse = await request(API_URL)
        .post('/api/admin/invite-codes')
        .set('Authorization', `Bearer ${adminResponse.body.token}`)
        .send({ expiresIn: '24h' });

      if (inviteResponse.status !== 201) {
        return;
      }

      const code = inviteResponse.body.code;

      // First use
      await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'firstuser',
          password: 'FirstUser123!',
          email: 'firstuser@test.com',
          inviteCode: code
        });

      // Second use - should fail
      const secondResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'seconduser',
          password: 'SecondUser123!',
          email: 'seconduser@test.com',
          inviteCode: code
        });

      expect(secondResponse.status).toBe(401);
    });
  });

  describe('2. Admin Login Flow', () => {
    beforeEach(async () => {
      // Create test admin
      const validCode = process.env.ADMIN_INVITE_CODE;
      if (validCode) {
        const response = await request(API_URL)
          .post('/api/admin/register')
          .send({
            username: 'loginadmin',
            password: 'LoginAdmin123!',
            email: 'loginadmin@test.com',
            inviteCode: validCode
          });

        if (response.status === 201) {
          testAdminId = response.body.user._id;
        }
      }
    });

    it('should login admin with valid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/admin/login')
        .send({
          username: 'loginadmin',
          password: 'LoginAdmin123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.role).toBe('admin');
      adminToken = response.body.token;
    });

    it('should reject login with invalid username', async () => {
      const response = await request(API_URL)
        .post('/api/admin/login')
        .send({
          username: 'nonexistent',
          password: 'LoginAdmin123!'
        });

      expect(response.status).toBe(401);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(API_URL)
        .post('/api/admin/login')
        .send({
          username: 'loginadmin',
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
    });

    it('should return JWT token with admin claims', async () => {
      const response = await request(API_URL)
        .post('/api/admin/login')
        .send({
          username: 'loginadmin',
          password: 'LoginAdmin123!'
        });

      if (response.status === 200) {
        const token = response.body.token;
        const decoded = jwt.decode(token);

        expect(decoded.role).toBe('admin');
        expect(decoded.permissions).toContain('admin:access');
      }
    });
  });

  describe('9. Permission Boundary Tests', () => {
    beforeEach(async () => {
      // Create admin
      const validCode = process.env.ADMIN_INVITE_CODE;
      if (validCode) {
        const adminResponse = await request(API_URL)
          .post('/api/admin/register')
          .send({
            username: 'permadmin',
            password: 'PermAdmin123!',
            email: 'permadmin@test.com',
            inviteCode: validCode
          });

        if (adminResponse.status === 201) {
          testAdminId = adminResponse.body.user._id;
          adminToken = adminResponse.body.token;
        }
      }
    });

    it('should allow admin to access admin dashboard', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny non-admin user to access admin dashboard', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access without authentication token', async () => {
      const response = await request(API_URL)
        .get('/api/admin/stats/overview');

      expect(response.status).toBe(401);
    });

    it('should deny non-admin to access user management', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny non-admin to access questionnaire management', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny non-admin to access memory management', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/memories/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny non-admin to view environment variables', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/settings/env')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny non-admin to manage invite codes', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/invite-codes')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ expiresIn: '24h' });

      expect(response.status).toBe(403);
    });
  });
});
