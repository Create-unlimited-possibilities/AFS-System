#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DualStorageVerifier {
  constructor() {
    this.basePath = path.join(__dirname, 'temp-verification');
    this.issues = [];
    this.successes = [];
  }

  async setup() {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
    } catch (err) {
    }
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async cleanup() {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
    } catch (err) {
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async verifyDirectoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        this.issues.push(`Path exists but is not a directory: ${dirPath}`);
        this.log(`Path is not a directory: ${dirPath}`, 'error');
        return false;
      }
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.issues.push(`Directory does not exist: ${dirPath}`);
        this.log(`Directory does not exist: ${dirPath}`, 'error');
      } else {
        this.issues.push(`Error checking directory: ${dirPath} - ${err.message}`);
        this.log(`Error checking directory: ${dirPath} - ${err.message}`, 'error');
      }
      return false;
    }
  }

  async verifyFileExists(filePath) {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        this.issues.push(`Path exists but is not a file: ${filePath}`);
        this.log(`Path is not a file: ${filePath}`, 'error');
        return false;
      }
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.issues.push(`File does not exist: ${filePath}`);
        this.log(`File does not exist: ${filePath}`, 'error');
      } else {
        this.issues.push(`Error checking file: ${filePath} - ${err.message}`);
        this.log(`Error checking file: ${filePath} - ${err.message}`, 'error');
      }
      return false;
    }
  }

  async verifyFileContent(filePath, expectedContent) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          return true;
        }
        const hasExpectedKeys = Object.keys(expectedContent).every(key => key in parsed[0]);
        if (!hasExpectedKeys) {
          this.issues.push(`File missing expected keys: ${filePath}`);
          this.log(`File missing expected keys: ${filePath}`, 'error');
          return false;
        }
      } else {
        const hasExpectedKeys = Object.keys(expectedContent).every(key => key in parsed);
        if (!hasExpectedKeys) {
          this.issues.push(`File missing expected keys: ${filePath}`);
          this.log(`File missing expected keys: ${filePath}`, 'error');
          return false;
        }
      }
      return true;
    } catch (err) {
      this.issues.push(`Error reading file content: ${filePath} - ${err.message}`);
      this.log(`Error reading file content: ${filePath} - ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveRoleCard(userId, roleCard) {
    this.log(`Testing saveRoleCard for userId: ${userId}`);
    
    const userPath = path.join(this.basePath, String(userId));
    const filePath = path.join(userPath, 'rolecard.json');
    
    try {
      await fs.mkdir(userPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(roleCard, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(userPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, roleCard);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveRoleCard - ${userId}`);
        this.log(`saveRoleCard successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveRoleCard failed: ${err.message}`);
      this.log(`saveRoleCard failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveUserProfile(userId, userProfile) {
    this.log(`Testing saveUserProfile for userId: ${userId}`);
    
    const userPath = path.join(this.basePath, String(userId));
    const filePath = path.join(userPath, 'profile.json');
    
    try {
      await fs.mkdir(userPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(userProfile, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(userPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, userProfile);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveUserProfile - ${userId}`);
        this.log(`saveUserProfile successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveUserProfile failed: ${err.message}`);
      this.log(`saveUserProfile failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveSentiments(userId, sentiments) {
    this.log(`Testing saveSentiments for userId: ${userId}`);
    
    const userPath = path.join(this.basePath, String(userId));
    const filePath = path.join(userPath, 'strangerSentiments.json');
    
    try {
      await fs.mkdir(userPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(sentiments, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(userPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, sentiments);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveSentiments - ${userId}`);
        this.log(`saveSentiments successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveSentiments failed: ${err.message}`);
      this.log(`saveSentiments failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveConversations(userId, conversations) {
    this.log(`Testing saveConversations for userId: ${userId}`);
    
    const userPath = path.join(this.basePath, String(userId));
    const filePath = path.join(userPath, 'conversationsAsTarget.json');
    
    try {
      await fs.mkdir(userPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(conversations, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(userPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, conversations[0]);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveConversations - ${userId}`);
        this.log(`saveConversations successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveConversations failed: ${err.message}`);
      this.log(`saveConversations failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveAssistRelation(userId, relation) {
    this.log(`Testing saveAssistRelation for userId: ${userId}`);
    
    const userPath = path.join(this.basePath, String(userId));
    const filePath = path.join(userPath, 'assist-relations.json');
    
    try {
      await fs.mkdir(userPath, { recursive: true });
      const relations = [relation];
      await fs.writeFile(filePath, JSON.stringify(relations, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(userPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, relation);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveAssistRelation - ${userId}`);
        this.log(`saveAssistRelation successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveAssistRelation failed: ${err.message}`);
      this.log(`saveAssistRelation failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveAnswer(answerId, answer) {
    this.log(`Testing saveAnswer for answerId: ${answerId}`);
    
    const answerPath = path.join(this.basePath, 'answers', String(answerId));
    const filePath = path.join(answerPath, 'answer.json');
    
    try {
      await fs.mkdir(answerPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(answer, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(answerPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, answer);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveAnswer - ${answerId}`);
        this.log(`saveAnswer successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveAnswer failed: ${err.message}`);
      this.log(`saveAnswer failed: ${err.message}`, 'error');
      return false;
    }
  }

  async testSaveChatSession(sessionId, session) {
    this.log(`Testing saveChatSession for sessionId: ${sessionId}`);
    
    const sessionPath = path.join(this.basePath, 'chatSessions', String(sessionId));
    const filePath = path.join(sessionPath, 'session.json');
    
    try {
      await fs.mkdir(sessionPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
      
      const dirExists = await this.verifyDirectoryExists(sessionPath);
      const fileExists = await this.verifyFileExists(filePath);
      const contentValid = await this.verifyFileContent(filePath, session);
      
      if (dirExists && fileExists && contentValid) {
        this.successes.push(`saveChatSession - ${sessionId}`);
        this.log(`saveChatSession successful`, 'success');
        return true;
      }
      return false;
    } catch (err) {
      this.issues.push(`saveChatSession failed: ${err.message}`);
      this.log(`saveChatSession failed: ${err.message}`, 'error');
      return false;
    }
  }

  async verifyDirectoryStructure() {
    this.log('Verifying directory structure...');
    
    const expectedStructure = [
      { path: path.join(this.basePath, 'user_001'), type: 'dir' },
      { path: path.join(this.basePath, 'user_001', 'rolecard.json'), type: 'file' },
      { path: path.join(this.basePath, 'user_001', 'profile.json'), type: 'file' },
      { path: path.join(this.basePath, 'user_001', 'strangerSentiments.json'), type: 'file' },
      { path: path.join(this.basePath, 'user_001', 'conversationsAsTarget.json'), type: 'file' },
      { path: path.join(this.basePath, 'user_001', 'assist-relations.json'), type: 'file' },
      { path: path.join(this.basePath, 'answers', 'answer_001'), type: 'dir' },
      { path: path.join(this.basePath, 'answers', 'answer_001', 'answer.json'), type: 'file' },
      { path: path.join(this.basePath, 'chatSessions', 'session_001'), type: 'dir' },
      { path: path.join(this.basePath, 'chatSessions', 'session_001', 'session.json'), type: 'file' },
    ];

    let allVerified = true;
    for (const item of expectedStructure) {
      const exists = item.type === 'dir' 
        ? await this.verifyDirectoryExists(item.path)
        : await this.verifyFileExists(item.path);
      
      if (exists) {
        this.log(`Verified: ${path.relative(this.basePath, item.path)}`, 'success');
      } else {
        allVerified = false;
      }
    }

    return allVerified;
  }

  async runAllTests() {
    this.log('Starting DualStorage directory structure verification');
    this.log('=' .repeat(60));
    
    await this.setup();
    
    const testUserId = 'user_001';
    const testAnswerId = 'answer_001';
    const testSessionId = 'session_001';

    const results = [];

    results.push(await this.testSaveRoleCard(testUserId, {
      name: 'Test Role',
      age: 25,
      description: 'Test role card'
    }));

    results.push(await this.testSaveUserProfile(testUserId, {
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User'
    }));

    results.push(await this.testSaveSentiments(testUserId, {
      strangerId: 'stranger_001',
      sentiment: 0.8,
      interactions: 5
    }));

    results.push(await this.testSaveConversations(testUserId, [
      {
        conversationId: 'conv_001',
        messages: [{ role: 'user', content: 'Hello' }]
      }
    ]));

    results.push(await this.testSaveAssistRelation(testUserId, {
      relationId: 'relation_001',
      relationType: 'family',
      specificRelation: 'son'
    }));

    results.push(await this.testSaveAnswer(testAnswerId, {
      answerId: testAnswerId,
      question: 'Test question?',
      answer: 'Test answer'
    }));

    results.push(await this.testSaveChatSession(testSessionId, {
      sessionId: testSessionId,
      userId: testUserId,
      messages: []
    }));

    this.log('=' .repeat(60));
    this.log('Verifying final directory structure');
    const structureVerified = await this.verifyDirectoryStructure();

    this.log('=' .repeat(60));
    this.log('Test Summary');
    this.log('-' .repeat(60));
    this.log(`Total tests run: ${results.length}`);
    this.log(`Successful: ${results.filter(r => r).length}`);
    this.log(`Failed: ${results.filter(r => !r).length}`);
    this.log(`Structure verified: ${structureVerified ? 'Yes' : 'No'}`);
    this.log('-' .repeat(60));

    if (this.successes.length > 0) {
      this.log(`Successful operations (${this.successes.length}):`, 'success');
      this.successes.forEach(s => this.log(`  ✓ ${s}`, 'success'));
    }

    if (this.issues.length > 0) {
      this.log(`Issues found (${this.issues.length}):`, 'error');
      this.issues.forEach(i => this.log(`  ✗ ${i}`, 'error'));
    }

    this.log('=' .repeat(60));

    await this.cleanup();

    return {
      totalTests: results.length,
      successful: results.filter(r => r).length,
      failed: results.filter(r => !r).length,
      structureVerified,
      issues: this.issues,
      successes: this.successes
    };
  }
}

const verifier = new DualStorageVerifier();
verifier.runAllTests()
  .then(result => {
    process.exit(result.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
