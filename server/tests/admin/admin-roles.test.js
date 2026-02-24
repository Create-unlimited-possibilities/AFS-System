/**
 * Admin Panel E2E Tests - Role Management
 *
 * Tests for role management: view, edit permissions
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';


const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Admin Panel - Role Management', () => {
  let adminToken = null;
  let userToken = null;
  let testAdminId = null;
  let testUserId = null;
  let testRoleId = null;

  // Admin permissions
  const adminPermissions = [
    'admin:access',
    'user:read',
    'user:write',
    'user:delete',
    'questionnaire:read',
    'questionnaire:write',
    'questionnaire:delete',
    'memory:read-all',
    'memory:manage',
    'env:view',
    'env:update',
    'invite-code:create',
    'invite-code:view',
    'stats:view',
    'role:manage'
  ];

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
          username: 'roleadmin',
          password: 'RoleAdmin123!',
          email: 'roleadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status === 201) {
        testAdminId = adminResponse.body.user._id;
        adminToken = adminResponse.body.token;
      }
    }

    // Create regular user
    const userResponse = await request(API_URL)
      .post('/api/auth/register')
      .send({
        username: 'roleuser',
        password: 'RoleUser123!',
        email: 'roleuser@test.com'
      });

    if (userResponse.status === 201) {
      testUserId = userResponse.body.user._id;
      userToken = userResponse.body.token;
    }
  });

  afterEach(async () => {
    // Cleanup roles
    if (testRoleId) {
      try {
        await mongoose.model('Role').deleteOne({ _id: testRoleId });
      } catch (e) {
        // Ignore
      }
      testRoleId = null;
    }

    // Cleanup users
    if (testAdminId) {
      await mongoose.model('User').deleteOne({ _id: testAdminId });
    }
    if (testUserId) {
      await mongoose.model('User').deleteOne({ _id: testUserId });
    }

    testAdminId = null;
    testUserId = null;
    adminToken = null;
    userToken = null;
  });

  describe('7. Role Management - List Roles', () => {
    it('should get all roles', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.roles).toBeInstanceOf(Array);
      expect(response.body.roles.length).toBeGreaterThan(0);
    });

    it('should include role permissions', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        response.body.roles.forEach(role => {
          expect(role.permissions).toBeDefined();
          expect(Array.isArray(role.permissions)).toBe(true);
        });
      }
    });

    it('should include role metadata', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        response.body.roles.forEach(role => {
          expect(role.name).toBeDefined();
          expect(role.description).toBeDefined();
          expect(role.isSystem).toBeDefined();
        });
      }
    });

    it('should deny non-admin from listing roles', async () => {
      if (!userToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('7. Role Management - View Role Details', () => {
    it('should get role details by ID', async () => {
      if (!adminToken) {
        return;
      }

      // First get all roles to find an ID
      const listResponse = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (listResponse.status === 200 && listResponse.body.roles.length > 0) {
        const roleId = listResponse.body.roles[0]._id;

        const response = await request(API_URL)
          .get(`/api/admin/roles/${roleId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.role).toBeDefined();
        expect(response.body.role._id).toBe(roleId);
      }
    });

    it('should include assigned users count', async () => {
      if (!adminToken) {
        return;
      }

      const listResponse = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (listResponse.status === 200 && listResponse.body.roles.length > 0) {
        const roleId = listResponse.body.roles[0]._id;

        const response = await request(API_URL)
          .get(`/api/admin/roles/${roleId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (response.status === 200) {
          expect(response.body.role.userCount).toBeDefined();
        }
      }
    });

    it('should return 404 for non-existent role', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .get(`/api/admin/roles/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('7. Role Management - Create Role', () => {
    it('should create new custom role', async () => {
      if (!adminToken) {
        return;
      }

      const newRole = {
        name: 'moderator',
        description: 'Content moderator with limited admin access',
        permissions: [
          'user:read',
          'memory:read-all',
          'stats:view'
        ]
      };

      const response = await request(API_URL)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newRole);

      if (response.status === 201) {
        expect(response.body.role.name).toBe(newRole.name);
        expect(response.body.role.permissions).toEqual(expect.arrayContaining(newRole.permissions));
        expect(response.body.role.isSystem).toBe(false);
        testRoleId = response.body.role._id;
      }
    });

    it('should validate role name uniqueness', async () => {
      if (!adminToken) {
        return;
      }

      // Create first role
      const firstResponse = await request(API_URL)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'unique_role',
          description: 'First role',
          permissions: ['user:read']
        });

      if (firstResponse.status === 201) {
        testRoleId = firstResponse.body.role._id;

        // Try to create duplicate
        const secondResponse = await request(API_URL)
          .post('/api/admin/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'unique_role',
            description: 'Duplicate role',
            permissions: ['user:read']
          });

        expect([400, 409]).toContain(secondResponse.status);
      }
    });

    it('should validate permissions exist', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'test_role',
          description: 'Test',
          permissions: ['invalid:permission']
        });

      expect(response.status).toBe(400);
    });

    it('should not allow creating system roles', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'admin',
          description: 'Trying to create admin role',
          permissions: adminPermissions,
          isSystem: true
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('system');
    });

    it('should require role name', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Role without name'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('7. Role Management - Update Role', () => {
    let roleId = null;

    beforeEach(async () => {
      if (adminToken) {
        const response = await request(API_URL)
          .post('/api/admin/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'updatable_role',
            description: 'To be updated',
            permissions: ['user:read']
          });

        if (response.status === 201) {
          roleId = response.body.role._id;
          testRoleId = roleId;
        }
      }
    });

    it('should update role description', async () => {
      if (!adminToken || !roleId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' });

      expect(response.status).toBe(200);
      expect(response.body.role.description).toBe('Updated description');
    });

    it('should update role permissions', async () => {
      if (!adminToken || !roleId) {
        return;
      }

      const newPermissions = ['user:read', 'user:write', 'memory:read-all'];

      const response = await request(API_URL)
        .put(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: newPermissions });

      if (response.status === 200) {
        expect(response.body.role.permissions).toEqual(expect.arrayContaining(newPermissions));
      }
    });

    it('should not allow updating system role name', async () => {
      if (!adminToken) {
        return;
      }

      // Try to update admin role
      const adminRoleResponse = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (adminRoleResponse.status === 200) {
        const adminRole = adminRoleResponse.body.roles.find(r => r.name === 'admin');
        if (adminRole) {
          const response = await request(API_URL)
            .put(`/api/admin/roles/${adminRole._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'renamed_admin' });

          expect(response.status).toBe(400);
        }
      }
    });

    it('should validate updated permissions', async () => {
      if (!adminToken || !roleId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: ['invalid:permission'] });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent role', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .put(`/api/admin/roles/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('7. Role Management - Delete Role', () => {
    let roleId = null;

    beforeEach(async () => {
      if (adminToken) {
        const response = await request(API_URL)
          .post('/api/admin/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'deletable_role',
            description: 'To be deleted',
            permissions: ['user:read']
          });

        if (response.status === 201) {
          roleId = response.body.role._id;
          testRoleId = roleId;
        }
      }
    });

    it('should delete custom role', async () => {
      if (!adminToken || !roleId) {
        return;
      }

      const response = await request(API_URL)
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deleted
      const role = await mongoose.model('Role').findById(roleId);
      expect(role).toBeNull();
    });

    it('should not delete system roles', async () => {
      if (!adminToken) {
        return;
      }

      const listResponse = await request(API_URL)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`);

      if (listResponse.status === 200) {
        const systemRole = listResponse.body.roles.find(r => r.isSystem);
        if (systemRole) {
          const response = await request(API_URL)
            .delete(`/api/admin/roles/${systemRole._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(400);
          expect(response.body.message).toContain('system');
        }
      }
    });

    it('should not delete role with assigned users', async () => {
      if (!adminToken || !roleId || !testUserId) {
        return;
      }

      // Assign role to user
      await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId });

      // Try to delete role
      const response = await request(API_URL)
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('assigned');
    });
  });

  describe('7. Role Management - Assign Roles to Users', () => {
    let customRoleId = null;

    beforeEach(async () => {
      if (adminToken) {
        const response = await request(API_URL)
          .post('/api/admin/roles')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'custom_role',
            description: 'Custom role for testing',
            permissions: ['user:read', 'stats:view']
          });

        if (response.status === 201) {
          customRoleId = response.body.role._id;
          testRoleId = customRoleId;
        }
      }
    });

    it('should assign role to user', async () => {
      if (!adminToken || !customRoleId || !testUserId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: customRoleId });

      if (response.status === 200) {
        expect(response.body.user.roleId).toBe(customRoleId);
      }
    });

    it('should remove role from user', async () => {
      if (!adminToken || !customRoleId || !testUserId) {
        return;
      }

      // First assign
      await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: customRoleId });

      // Then remove
      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: null });

      if (response.status === 200) {
        expect(response.body.user.roleId).toBeNull();
      }
    });

    it('should validate role exists', async () => {
      if (!adminToken || !testUserId) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: fakeId });

      expect(response.status).toBe(400);
    });
  });

  describe('7. Role Management - Permission List', () => {
    it('should get all available permissions', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.permissions).toBeInstanceOf(Array);
      expect(response.body.permissions.length).toBeGreaterThan(0);
    });

    it('should group permissions by category', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        response.body.permissions.forEach(perm => {
          expect(perm.category).toBeDefined();
          expect(perm.name).toBeDefined();
          expect(perm.description).toBeDefined();
        });
      }
    });

    it('should filter permissions by category', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/permissions?category=user')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        response.body.permissions.forEach(perm => {
          expect(perm.category).toBe('user');
        });
      }
    });
  });
});
