#!/usr/bin/env node
/**
 * MongoDB Connection and Schema Test Script
 * Tests MongoDB 7.0.14 connection, all schemas, and CRUD operations
 *
 * Usage: node server/scripts/test-mongodb.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db';

// Import all models
import User from '../src/modules/user/model.js';
import ChatSession from '../src/modules/chat/model.js';
import AssistRelation from '../src/modules/assist/model.js';
import Question from '../src/modules/qa/models/question.js';
import Answer from '../src/modules/qa/models/answer.js';
import Role from '../src/modules/roles/models/role.js';
import Permission from '../src/modules/roles/models/permission.js';

// Test results tracking
const testResults = {
  connection: false,
  schemas: {},
  crud: {},
  errors: []
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  const color = passed ? 'green' : 'red';
  log(`[${status}] ${name}`, color);
  if (details) {
    console.log(`     ${details}`);
  }
}

// Test MongoDB Connection
async function testConnection() {
  logSection('Testing MongoDB Connection');

  try {
    log(`Connecting to: ${MONGO_URI.replace(/:.*@/, ':****@')}`, 'blue');

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000
    });

    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    logTest('MongoDB Connection', state === 1, `State: ${states[state]}`);

    if (state === 1) {
      testResults.connection = true;

      // Get database info
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      log(`Active Collections: ${collections.length}`, 'yellow');

      const serverInfo = await db.admin().serverInfo();
      log(`MongoDB Version: ${serverInfo.version}`, 'yellow');
    }

    return state === 1;
  } catch (error) {
    logTest('MongoDB Connection', false, error.message);
    testResults.errors.push({ test: 'connection', error: error.message });
    return false;
  }
}

// Test Schema Validation
async function testSchemas() {
  logSection('Testing Mongoose Schemas');

  const models = [
    { name: 'User', model: User, requiredFields: ['uniqueCode', 'email', 'password'] },
    { name: 'ChatSession', model: ChatSession, requiredFields: ['sessionId', 'targetUserId', 'interlocutorUserId', 'relation'] },
    { name: 'AssistRelation', model: AssistRelation, requiredFields: ['assistantId', 'targetId', 'relationshipType'] },
    { name: 'Question', model: Question, requiredFields: ['role', 'layer', 'order', 'question'] },
    { name: 'Answer', model: Answer, requiredFields: ['userId', 'targetUserId', 'questionId', 'questionLayer', 'answer'] },
    { name: 'Role', model: Role, requiredFields: ['name'] },
    { name: 'Permission', model: Permission, requiredFields: ['name'] }
  ];

  for (const { name, model, requiredFields } of models) {
    try {
      const schema = model.schema;
      const paths = schema.paths;

      const missingFields = requiredFields.filter(field => !paths[field]);
      const hasRequired = missingFields.length === 0;

      logTest(`${name} Schema`, hasRequired,
        hasRequired
          ? `All required fields present: ${requiredFields.join(', ')}`
          : `Missing fields: ${missingFields.join(', ')}`
      );

      testResults.schemas[name] = {
        passed: hasRequired,
        fields: Object.keys(paths),
        indexes: Object.keys(schema.indexes())
      };

      if (!hasRequired) {
        testResults.errors.push({
          test: `schema_${name}`,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }
    } catch (error) {
      logTest(`${name} Schema`, false, error.message);
      testResults.errors.push({ test: `schema_${name}`, error: error.message });
    }
  }
}

// Test CRUD Operations
async function testCRUD() {
  logSection('Testing CRUD Operations');

  const testIds = {};

  // Test 1: CREATE - Permission
  try {
    const permission = new Permission({
      name: `TEST_PERMISSION_${Date.now()}`,
      description: 'Test permission for MongoDB validation',
      category: 'test'
    });
    const saved = await permission.save();
    testIds.permission = saved._id;
    logTest('CREATE Permission', true, `ID: ${saved._id}`);
    testResults.crud.createPermission = true;
  } catch (error) {
    logTest('CREATE Permission', false, error.message);
    testResults.errors.push({ test: 'crud_create_permission', error: error.message });
  }

  // Test 2: CREATE - Role
  try {
    const role = new Role({
      name: `TEST_ROLE_${Date.now()}`,
      description: 'Test role for MongoDB validation',
      permissions: [testIds.permission]
    });
    const saved = await role.save();
    testIds.role = saved._id;
    logTest('CREATE Role', true, `ID: ${saved._id}`);
    testResults.crud.createRole = true;
  } catch (error) {
    logTest('CREATE Role', false, error.message);
    testResults.errors.push({ test: 'crud_create_role', error: error.message });
  }

  // Test 3: CREATE - User
  try {
    const uniqueCode = await User.generateUniqueCode();
    const user = new User({
      uniqueCode,
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      role: testIds.role
    });
    const saved = await user.save();
    testIds.user = saved._id;
    logTest('CREATE User', true, `ID: ${saved._id}, Code: ${uniqueCode}`);
    testResults.crud.createUser = true;
  } catch (error) {
    logTest('CREATE User', false, error.message);
    testResults.errors.push({ test: 'crud_create_user', error: error.message });
  }

  // Test 4: CREATE - Question
  try {
    const question = new Question({
      role: 'elder',
      layer: 'basic',
      order: 999,
      question: 'Test question for MongoDB validation?',
      active: true
    });
    const saved = await question.save();
    testIds.question = saved._id;
    logTest('CREATE Question', true, `ID: ${saved._id}`);
    testResults.crud.createQuestion = true;
  } catch (error) {
    logTest('CREATE Question', false, error.message);
    testResults.errors.push({ test: 'crud_create_question', error: error.message });
  }

  // Test 5: CREATE - Answer
  try {
    const answer = new Answer({
      userId: testIds.user,
      targetUserId: testIds.user,
      questionId: testIds.question,
      questionLayer: 'basic',
      answer: 'Test answer for MongoDB validation',
      isSelfAnswer: true
    });
    const saved = await answer.save();
    testIds.answer = saved._id;
    logTest('CREATE Answer', true, `ID: ${saved._id}`);
    testResults.crud.createAnswer = true;
  } catch (error) {
    logTest('CREATE Answer', false, error.message);
    testResults.errors.push({ test: 'crud_create_answer', error: error.message });
  }

  // Test 6: CREATE - AssistRelation
  try {
    const relation = new AssistRelation({
      assistantId: testIds.user,
      targetId: testIds.user,
      relationshipType: 'family',
      specificRelation: 'Test Relation'
    });
    const saved = await relation.save();
    testIds.relation = saved._id;
    logTest('CREATE AssistRelation', true, `ID: ${saved._id}`);
    testResults.crud.createAssistRelation = true;
  } catch (error) {
    logTest('CREATE AssistRelation', false, error.message);
    testResults.errors.push({ test: 'crud_create_assist_relation', error: error.message });
  }

  // Test 7: CREATE - ChatSession
  try {
    const session = new ChatSession({
      sessionId: `test_session_${Date.now()}`,
      targetUserId: testIds.user,
      interlocutorUserId: testIds.user,
      relation: 'stranger',
      sentimentScore: 50
    });
    const saved = await session.save();
    testIds.session = saved._id;
    logTest('CREATE ChatSession', true, `ID: ${saved._id}`);
    testResults.crud.createChatSession = true;
  } catch (error) {
    logTest('CREATE ChatSession', false, error.message);
    testResults.errors.push({ test: 'crud_create_chat_session', error: error.message });
  }

  // Test 8: READ - Find User
  try {
    const user = await User.findById(testIds.user);
    logTest('READ User', !!user, `Found: ${user?.email}`);
    testResults.crud.readUser = !!user;
  } catch (error) {
    logTest('READ User', false, error.message);
    testResults.errors.push({ test: 'crud_read_user', error: error.message });
  }

  // Test 9: READ - Find with Populate
  try {
    const user = await User.findById(testIds.user).populate('role');
    logTest('READ User (Populated)', !!user?.role, `Role: ${user?.role?.name}`);
    testResults.crud.readUserPopulated = !!user?.role;
  } catch (error) {
    logTest('READ User (Populated)', false, error.message);
    testResults.errors.push({ test: 'crud_read_user_populated', error: error.message });
  }

  // Test 10: UPDATE - User
  try {
    const result = await User.findByIdAndUpdate(
      testIds.user,
      { name: 'Updated Test User' },
      { new: true }
    );
    logTest('UPDATE User', result?.name === 'Updated Test User', `Name: ${result?.name}`);
    testResults.crud.updateUser = result?.name === 'Updated Test User';
  } catch (error) {
    logTest('UPDATE User', false, error.message);
    testResults.errors.push({ test: 'crud_update_user', error: error.message });
  }

  // Test 11: Static Methods - Answer Progress
  try {
    const progress = await Answer.getProgress(testIds.user, testIds.user, 'basic');
    logTest('STATIC Answer.getProgress', progress !== null,
      `Progress: ${progress?.answered}/${progress?.total} (${progress?.percentage}%)`);
    testResults.crud.answerProgress = progress !== null;
  } catch (error) {
    logTest('STATIC Answer.getProgress', false, error.message);
    testResults.errors.push({ test: 'crud_static_answer_progress', error: error.message });
  }

  // Test 12: Static Methods - User Unique Code
  try {
    const code = await User.generateUniqueCode();
    logTest('STATIC User.generateUniqueCode', !!code, `Generated: ${code}`);
    testResults.crud.userUniqueCode = !!code;
  } catch (error) {
    logTest('STATIC User.generateUniqueCode', false, error.message);
    testResults.errors.push({ test: 'crud_static_user_code', error: error.message });
  }

  // Test 13: DELETE - ChatSession
  try {
    const result = await ChatSession.findByIdAndDelete(testIds.session);
    logTest('DELETE ChatSession', !!result, `Deleted session: ${result?.sessionId}`);
    testResults.crud.deleteChatSession = !!result;
  } catch (error) {
    logTest('DELETE ChatSession', false, error.message);
    testResults.errors.push({ test: 'crud_delete_chat_session', error: error.message });
  }

  // Test 14: Error Handling - Duplicate Unique Code
  try {
    const user = new User({
      uniqueCode: (await User.findOne({})).uniqueCode,
      email: `duplicate_${Date.now()}@example.com`,
      password: 'TestPassword123!'
    });
    await user.save();
    logTest('ERROR Handling Duplicate', false, 'Should have thrown duplicate key error');
    testResults.errors.push({ test: 'crud_error_duplicate', error: 'No error thrown for duplicate' });
  } catch (error) {
    const isDuplicate = error.code === 11000 || error.message.includes('duplicate');
    logTest('ERROR Handling Duplicate', isDuplicate, `Correctly caught: ${error.code}`);
    testResults.crud.errorHandling = isDuplicate;
  }

  // Cleanup test data
  try {
    await Permission.deleteMany({ name: /TEST_PERMISSION_/ });
    await Role.deleteMany({ name: /TEST_ROLE_/ });
    await User.deleteMany({ email: /test_.*@example\.com/ });
    await Question.deleteMany({ order: 999 });
    await Answer.deleteMany({ answer: 'Test answer for MongoDB validation' });
    await AssistRelation.deleteMany({ specificRelation: 'Test Relation' });
    await ChatSession.deleteMany({ sessionId: /test_session_/ });
    log('Cleanup: Test data removed', 'yellow');
  } catch (error) {
    log(`Cleanup Warning: ${error.message}`, 'yellow');
  }

  return testIds;
}

// Test Indexes
async function testIndexes() {
  logSection('Testing Indexes');

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      const indexes = await db.collection(collection.name).indexes();
      log(`Collection: ${collection.name}`, 'blue');
      indexes.forEach(idx => {
        const key = JSON.stringify(idx.key);
        const unique = idx.unique ? ' [UNIQUE]' : '';
        log(`  - ${key}${unique}`, 'yellow');
      });
    }

    return true;
  } catch (error) {
    logTest('Index Verification', false, error.message);
    testResults.errors.push({ test: 'indexes', error: error.message });
    return false;
  }
}

// Print Summary
function printSummary() {
  logSection('Test Summary');

  const totalTests = Object.keys(testResults.crud).length + Object.keys(testResults.schemas).length + 1;
  const passedTests = Object.values(testResults.crud).filter(v => v === true).length +
                      Object.values(testResults.schemas).filter(v => v.passed === true).length +
                      (testResults.connection ? 1 : 0);
  const failedTests = totalTests - passedTests;

  log(`Total Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'yellow');

  if (testResults.errors.length > 0) {
    log('\nErrors:', 'red');
    testResults.errors.forEach(({ test, error }) => {
      log(`  - ${test}: ${error}`, 'red');
    });
  }

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  log(`\nSuccess Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');

  return passedTests === totalTests;
}

// Main Test Runner
async function runTests() {
  logSection('MongoDB 7.0.14 Connection and Schema Test');
  log(`Started at: ${new Date().toISOString()}`, 'blue');

  try {
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      log('\nFATAL: Cannot connect to MongoDB. Exiting.', 'red');
      process.exit(1);
    }

    // Test schemas
    await testSchemas();

    // Test CRUD
    await testCRUD();

    // Test indexes
    await testIndexes();

    // Print summary
    const allPassed = printSummary();

    // Close connection
    await mongoose.connection.close();
    log('\nMongoDB connection closed.', 'yellow');

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    log(`\nFATAL ERROR: ${error.message}`, 'red');
    console.error(error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run tests
runTests();
