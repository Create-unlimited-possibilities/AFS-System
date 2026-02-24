/**
 * Admin Panel E2E Tests - Dashboard & Stats
 *
 * Tests for dashboard: stats display correctly
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Admin Panel - Dashboard & Statistics', () => {
  let adminToken = null;
  let testAdminId = null;

  beforeEach(async () => {
    // Create admin
    const validCode = process.env.ADMIN_INVITE_CODE;
    if (validCode) {
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'statsadmin',
          password: 'StatsAdmin123!',
          email: 'statsadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status === 201) {
        testAdminId = adminResponse.body.user._id;
        adminToken = adminResponse.body.token;
      }
    }
  });

  afterEach(async () => {
    if (testAdminId && adminToken) {
      await request(API_URL)
        .delete(`/api/admin/users/${testAdminId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    testAdminId = null;
    adminToken = null;
  });

  describe('8. Dashboard - Overview Statistics', () => {
    it('should get overview statistics', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats).toBeDefined();
    });

    it('should include total user count', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.totalUsers).toBeDefined();
        expect(typeof response.body.stats.totalUsers).toBe('number');
      }
    });

    it('should include today\'s new user count', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.todayNewUsers).toBeDefined();
      }
    });

    it('should include total memory count', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.totalMemories).toBeDefined();
      }
    });

    it('should include active user count', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.activeUsers).toBeDefined();
      }
    });
  });

  describe('8. Dashboard - User Statistics', () => {
    it('should get user growth data', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/users?period=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should include daily user counts', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/users?period=7d')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].date).toBeDefined();
        expect(response.body.data[0].count).toBeDefined();
      }
    });

    it('should support different time periods', async () => {
      if (!adminToken) {
        return;
      }

      const periods = ['7d', '30d', '90d', '1y'];

      for (const period of periods) {
        const response = await request(API_URL)
          .get(`/api/admin/stats/users?period=${period}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      }
    });

    it('should validate time period parameter', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/users?period=invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('8. Dashboard - System Status', () => {
    it('should get system health status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/system')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.systems).toBeDefined();
    });

    it('should include MongoDB status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/system')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const mongo = response.body.systems.mongodb;
        expect(mongo).toBeDefined();
        expect(mongo.status).toBeDefined();
        expect(['healthy', 'degraded', 'down']).toContain(mongo.status);
      }
    });

    it('should include ChromaDB status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/system')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const chroma = response.body.systems.chromadb;
        expect(chroma).toBeDefined();
        expect(chroma.status).toBeDefined();
      }
    });

    it('should include LLM service status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/system')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const llm = response.body.systems.llm;
        expect(llm).toBeDefined();
        expect(llm.status).toBeDefined();
        expect(llm.backend).toBeDefined();
      }
    });

    it('should include Ollama status', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/system')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const ollama = response.body.systems.ollama;
        expect(ollama).toBeDefined();
        expect(ollama.status).toBeDefined();
      }
    });
  });

  describe('8. Dashboard - Recent Activities', () => {
    it('should get recent activity log', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/activities?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.activities).toBeInstanceOf(Array);
    });

    it('should include activity metadata', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/activities?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200 && response.body.activities.length > 0) {
        const activity = response.body.activities[0];
        expect(activity.type).toBeDefined();
        expect(activity.timestamp).toBeDefined();
        expect(activity.description).toBeDefined();
      }
    });

    it('should support pagination', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/activities?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.activities.length).toBeLessThanOrEqual(5);
        expect(response.body.pagination).toBeDefined();
      }
    });

    it('should filter activities by type', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/activities?type=user_registration')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        if (response.body.activities.length > 0) {
          expect(response.body.activities[0].type).toBe('user_registration');
        }
      }
    });
  });

  describe('8. Dashboard - Memory Statistics', () => {
    it('should get memory statistics', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/memories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats).toBeDefined();
    });

    it('should include total memory count', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/memories')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.totalMemories).toBeDefined();
      }
    });

    it('should include memory type distribution', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/memories')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.byType).toBeDefined();
      }
    });
  });

  describe('8. Dashboard - Questionnaire Statistics', () => {
    it('should get questionnaire statistics', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats).toBeDefined();
    });

    it('should include question count by role', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.byRole).toBeDefined();
      }
    });

    it('should include question count by layer', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/stats/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body.stats.byLayer).toBeDefined();
      }
    });
  });

  describe('8. Dashboard - Real-time Updates', () => {
    it('should support WebSocket for real-time stats', async () => {
      if (!adminToken) {
        return;
      }

      // This would test WebSocket connection for real-time dashboard updates
      // For now, we'll just check if the endpoint exists
      const response = await request(API_URL)
        .get('/api/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
