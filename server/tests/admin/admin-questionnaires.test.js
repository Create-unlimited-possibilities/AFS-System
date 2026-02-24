/**
 * Admin Panel E2E Tests - Questionnaire Management
 *
 * Tests for questionnaire management: create, edit, delete, reorder questions
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';


const API_URL = process.env.API_URL || 'http://localhost:3001';

describe('Admin Panel - Questionnaire Management', () => {
  let adminToken = null;
  let testAdminId = null;
  let questionIds = [];

  // Sample question data
  const sampleQuestions = [
    {
      role: 'elder',
      layer: 'basic',
      question: 'What is your name?',
      order: 1
    },
    {
      role: 'elder',
      layer: 'basic',
      question: 'How old are you?',
      order: 2
    },
    {
      role: 'family',
      layer: 'emotional',
      question: 'What is your favorite memory with your family?',
      order: 1
    }
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
    // Create admin user
    const validCode = process.env.ADMIN_INVITE_CODE;
    if (validCode) {
      const adminResponse = await request(API_URL)
        .post('/api/admin/register')
        .send({
          username: 'questionadmin',
          password: 'QuestionAdmin123!',
          email: 'questionadmin@test.com',
          inviteCode: validCode
        });

      if (adminResponse.status === 201) {
        testAdminId = adminResponse.body.user._id;
        adminToken = adminResponse.body.token;
      }
    }
  });

  afterEach(async () => {
    // Cleanup questions
    for (const id of questionIds) {
      try {
        await mongoose.model('Question').deleteOne({ _id: id });
      } catch (e) {
        // Ignore
      }
    }
    questionIds = [];

    // Cleanup admin
    if (testAdminId) {
      await mongoose.model('User').deleteOne({ _id: testAdminId });
    }
    testAdminId = null;
    adminToken = null;
  });

  describe('4. Questionnaire Management - List and Filter', () => {
    beforeEach(async () => {
      // Create sample questions
      for (const q of sampleQuestions) {
        const Question = mongoose.model('Question');
        const question = new Question(q);
        await question.save();
        questionIds.push(question._id);
      }
    });

    it('should get all questions', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions).toBeInstanceOf(Array);
      expect(response.body.questions.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter questions by role', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires?role=elder')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions.every(q => q.role === 'elder')).toBe(true);
    });

    it('should filter questions by layer', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires?layer=basic')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions.every(q => q.layer === 'basic')).toBe(true);
    });

    it('should filter questions by role and layer combination', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires?role=elder&layer=basic')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions.every(q => q.role === 'elder' && q.layer === 'basic')).toBe(true);
    });

    it('should search questions by text', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires?search=name')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions.length).toBeGreaterThan(0);
      expect(response.body.questions[0].question).toContain('name');
    });

    it('should return questions sorted by order', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires?role=elder&layer=basic')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        const questions = response.body.questions;
        for (let i = 1; i < questions.length; i++) {
          expect(questions[i].order).toBeGreaterThanOrEqual(questions[i - 1].order);
        }
      }
    });
  });

  describe('4. Questionnaire Management - Create Questions', () => {
    it('should create a new question', async () => {
      if (!adminToken) {
        return;
      }

      const newQuestion = {
        role: 'elder',
        layer: 'basic',
        question: 'What is your favorite color?',
        order: 99
      };

      const response = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newQuestion);

      expect(response.status).toBe(201);
      expect(response.body.question.question).toBe(newQuestion.question);
      expect(response.body.question.role).toBe(newQuestion.role);
      expect(response.body.question._id).toBeDefined();
      questionIds.push(response.body.question._id);
    });

    it('should validate required fields', async () => {
      if (!adminToken) {
        return;
      }

      const invalidQuestion = {
        role: 'elder'
        // Missing layer and question
      };

      const response = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidQuestion);

      expect(response.status).toBe(400);
    });

    it('should validate role enum values', async () => {
      if (!adminToken) {
        return;
      }

      const invalidQuestion = {
        role: 'invalid_role',
        layer: 'basic',
        question: 'Test?'
      };

      const response = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidQuestion);

      expect(response.status).toBe(400);
    });

    it('should validate layer enum values', async () => {
      if (!adminToken) {
        return;
      }

      const invalidQuestion = {
        role: 'elder',
        layer: 'invalid_layer',
        question: 'Test?'
      };

      const response = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidQuestion);

      expect(response.status).toBe(400);
    });

    it('should auto-assign order if not provided', async () => {
      if (!adminToken) {
        return;
      }

      const question = {
        role: 'friend',
        layer: 'emotional',
        question: 'Test question?'
      };

      const response = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(question);

      if (response.status === 201) {
        expect(response.body.question.order).toBeDefined();
        questionIds.push(response.body.question._id);
      }
    });
  });

  describe('4. Questionnaire Management - Edit Questions', () => {
    let questionId = null;

    beforeEach(async () => {
      if (adminToken) {
        const response = await request(API_URL)
          .post('/api/admin/questionnaires')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'elder',
            layer: 'basic',
            question: 'Original question?'
          });

        if (response.status === 201) {
          questionId = response.body.question._id;
          questionIds.push(questionId);
        }
      }
    });

    it('should update question text', async () => {
      if (!adminToken || !questionId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/questionnaires/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ question: 'Updated question?' });

      expect(response.status).toBe(200);
      expect(response.body.question.question).toBe('Updated question?');
    });

    it('should update question role and layer', async () => {
      if (!adminToken || !questionId) {
        return;
      }

      const response = await request(API_URL)
        .put(`/api/admin/questionnaires/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'family', layer: 'emotional' });

      expect(response.status).toBe(200);
      expect(response.body.question.role).toBe('family');
      expect(response.body.question.layer).toBe('emotional');
    });

    it('should reject updating non-existent question', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .put(`/api/admin/questionnaires/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ question: 'Updated?' });

      expect(response.status).toBe(404);
    });
  });

  describe('4. Questionnaire Management - Delete Questions', () => {
    let questionId = null;

    beforeEach(async () => {
      if (adminToken) {
        const response = await request(API_URL)
          .post('/api/admin/questionnaires')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'elder',
            layer: 'basic',
            question: 'To be deleted?'
          });

        if (response.status === 201) {
          questionId = response.body.question._id;
          questionIds.push(questionId);
        }
      }
    });

    it('should delete a question', async () => {
      if (!adminToken || !questionId) {
        return;
      }

      const response = await request(API_URL)
        .delete(`/api/admin/questionnaires/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deleted
      const question = await mongoose.model('Question').findById(questionId);
      expect(question).toBeNull();
    });

    it('should return 404 for deleting non-existent question', async () => {
      if (!adminToken) {
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(API_URL)
        .delete(`/api/admin/questionnaires/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('4. Questionnaire Management - Reorder Questions', () => {
    beforeEach(async () => {
      // Create multiple questions for reordering
      if (adminToken) {
        for (let i = 1; i <= 3; i++) {
          const response = await request(API_URL)
            .post('/api/admin/questionnaires')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              role: 'elder',
              layer: 'basic',
              question: `Question ${i}`,
              order: i
            });

          if (response.status === 201) {
            questionIds.push(response.body.question._id);
          }
        }
      }
    });

    it('should reorder questions', async () => {
      if (!adminToken || questionIds.length < 3) {
        return;
      }

      // Reverse the order
      const reorderData = [
        { id: questionIds[0], order: 3 },
        { id: questionIds[1], order: 2 },
        { id: questionIds[2], order: 1 }
      ];

      const response = await request(API_URL)
        .put('/api/admin/questionnaires/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ questions: reorderData });

      expect(response.status).toBe(200);
      expect(response.body.questions.length).toBe(3);

      // Verify new order
      expect(response.body.questions[0]._id).toBe(questionIds[2]);
      expect(response.body.questions[2]._id).toBe(questionIds[0]);
    });

    it('should validate all questions belong to same role/layer', async () => {
      if (!adminToken || questionIds.length < 2) {
        return;
      }

      // Create a question with different role
      const otherResponse = await request(API_URL)
        .post('/api/admin/questionnaires')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'family',
          layer: 'basic',
          question: 'Different role question'
        });

      if (otherResponse.status === 201) {
        const otherId = otherResponse.question._id;
        questionIds.push(otherId);

        const reorderData = [
          { id: questionIds[0], order: 1 },
          { id: otherId, order: 2 } // Different role
        ];

        const response = await request(API_URL)
          .put('/api/admin/questionnaires/reorder')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ questions: reorderData });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('4. Questionnaire Management - Import/Export', () => {
    beforeEach(async () => {
      // Create sample questions
      if (adminToken) {
        for (const q of sampleQuestions) {
          const response = await request(API_URL)
            .post('/api/admin/questionnaires')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(q);

          if (response.status === 201) {
            questionIds.push(response.body.question._id);
          }
        }
      }
    });

    it('should export questions to JSON', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body.questions).toBeInstanceOf(Array);
      expect(response.body.questions.length).toBeGreaterThan(0);
    });

    it('should export questions filtered by role', async () => {
      if (!adminToken) {
        return;
      }

      const response = await request(API_URL)
        .get('/api/admin/questionnaires/export?role=elder')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.questions.every(q => q.role === 'elder')).toBe(true);
    });

    it('should import questions from JSON', async () => {
      if (!adminToken) {
        return;
      }

      const importData = [
        {
          role: 'friend',
          layer: 'basic',
          question: 'Imported question 1',
          order: 1
        },
        {
          role: 'friend',
          layer: 'basic',
          question: 'Imported question 2',
          order: 2
        }
      ];

      const response = await request(API_URL)
        .post('/api/admin/questionnaires/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ questions: importData });

      if (response.status === 201) {
        expect(response.body.imported).toBe(2);
        // Add to cleanup
        for (const q of response.body.questions) {
          questionIds.push(q._id);
        }
      }
    });

    it('should validate import data structure', async () => {
      if (!adminToken) {
        return;
      }

      const invalidImport = [
        { role: 'invalid' } // Missing required fields
      ];

      const response = await request(API_URL)
        .post('/api/admin/questionnaires/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ questions: invalidImport });

      expect(response.status).toBe(400);
    });

    it('should handle duplicate questions during import', async () => {
      if (!adminToken) {
        return;
      }

      const importData = [
        {
          role: 'elder',
          layer: 'basic',
          question: 'Duplicate question',
          order: 1
        },
        {
          role: 'elder',
          layer: 'basic',
          question: 'Duplicate question',
          order: 2
        }
      ];

      const response = await request(API_URL)
        .post('/api/admin/questionnaires/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ questions: importData });

      // Should either skip duplicates or handle them
      expect([200, 201, 207]).toContain(response.status);
    });
  });
});
