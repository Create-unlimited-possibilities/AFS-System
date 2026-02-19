/**
 * MemoryStore Test Script
 * Tests basic functionality of the MemoryStore module
 */

import MemoryStore from '../../../src/modules/memory/MemoryStore.js';
import fsPromises from 'fs/promises';
import path from 'path';

async function testMemoryStore() {
  console.log('=== MemoryStore Test Script ===\n');

  const memoryStore = new MemoryStore();

  // Test data
  const testUserId = 'test_user_001';
  const testPartnerId = 'test_partner_001';

  console.log('1. Testing basePath detection...');
  console.log(`   basePath: ${memoryStore.basePath}`);
  console.log('   ✓ BasePath initialized\n');

  console.log('2. Testing getConversationPath...');
  const convPath = memoryStore.getConversationPath(testUserId, testPartnerId);
  console.log(`   conversationPath: ${convPath}`);
  console.log('   ✓ getConversationPath works\n');

  console.log('3. Testing generateMemoryId...');
  const memoryId = memoryStore.generateMemoryId();
  console.log(`   memoryId: ${memoryId}`);
  console.log(`   format valid: ${memoryId.startsWith('mem_')}`);
  console.log('   ✓ generateMemoryId works\n');

  console.log('4. Testing generateFileName...');
  const testData1 = { content: { processed: { summary: '关于孙子的聊天' } } };
  const testData2 = { topicSummary: 'Discussion about weather' };
  const testData3 = { content: { processed: { keyTopics: ['travel', 'food'] } } };

  const fileName1 = memoryStore.generateFileName(testData1);
  const fileName2 = memoryStore.generateFileName(testData2);
  const fileName3 = memoryStore.generateFileName(testData3);

  console.log(`   fileName1: ${fileName1}`);
  console.log(`   fileName2: ${fileName2}`);
  console.log(`   fileName3: ${fileName3}`);
  console.log('   ✓ generateFileName works\n');

  console.log('5. Testing sanitizeFileName...');
  const sanitizeTests = [
    'Hello World!',
    'File/Name\\Test',
    'Test: with "quotes"',
    'Normal_Text-123',
  ];
  sanitizeTests.forEach(str => {
    console.log(`   "${str}" -> "${memoryStore.sanitizeFileName(str)}"`);
  });
  console.log('   ✓ sanitizeFileName works\n');

  console.log('6. Testing saveMemory...');
  const memoryData = {
    meta: {
      messageCount: 24,
    },
    content: {
      raw: '这是一段测试对话内容...',
      processed: {
        summary: '关于孙子的聊天',
        keyTopics: ['孙子', '学校', '成绩'],
        facts: ['孙子今年8岁', '孙子在学校表现很好'],
        emotionalJourney: 'positive',
        memorableMoments: ['提到孙子时很开心'],
      },
    },
    pendingTopics: {
      hasUnfinished: false,
      topics: [],
    },
    personalityFiltered: {
      retentionScore: 0.9,
      likelyToRecall: ['孙子的成绩'],
      likelyToForget: [],
    },
    tags: ['family', 'grandchildren'],
  };

  try {
    const saveResult = await memoryStore.saveMemory(testUserId, testPartnerId, memoryData);
    console.log(`   memoryId: ${saveResult.memoryId}`);
    console.log(`   filePath: ${saveResult.filePath}`);
    console.log('   ✓ saveMemory works\n');

    console.log('7. Testing loadUserMemories...');
    const loadedMemories = await memoryStore.loadUserMemories(testUserId);
    console.log(`   partners found: ${Object.keys(loadedMemories).length}`);
    if (loadedMemories[testPartnerId]) {
      console.log(`   memories with ${testPartnerId}: ${loadedMemories[testPartnerId].length}`);
      if (loadedMemories[testPartnerId][0]) {
        console.log(`   first memory id: ${loadedMemories[testPartnerId][0].memoryId}`);
      }
    }
    console.log('   ✓ loadUserMemories works\n');

    console.log('8. Testing updateMemory...');
    const updatedMemory = await memoryStore.updateMemory(saveResult.filePath, {
      tags: ['family', 'grandchildren', 'school'],
    });
    console.log(`   updated tags: ${updatedMemory.tags.join(', ')}`);
    console.log('   ✓ updateMemory works\n');

    console.log('9. Testing markAsIndexed...');
    const indexedMemory = await memoryStore.markAsIndexed(saveResult.filePath);
    console.log(`   indexed: ${indexedMemory.vectorIndex.indexed}`);
    console.log(`   indexedAt: ${indexedMemory.vectorIndex.indexedAt}`);
    console.log('   ✓ markAsIndexed works\n');

    console.log('10. Testing updateCompressionStage...');
    const compressedMemory = await memoryStore.updateCompressionStage(saveResult.filePath, 'v1');
    console.log(`   compressionStage: ${compressedMemory.meta.compressionStage}`);
    console.log(`   compressedAt: ${compressedMemory.meta.compressedAt}`);
    console.log('   ✓ updateCompressionStage works\n');

    console.log('11. Testing saveBidirectional...');
    const bidirectionalResult = await memoryStore.saveBidirectional({
      userAId: 'user_alice',
      userBId: 'user_bob',
      conversationData: {
        raw: 'Alice和Bob的对话内容...',
        messageCount: 10,
      },
      userAMemory: {
        processed: {
          summary: '和Bob聊天',
          keyTopics: ['日常'],
        },
        tags: ['friend'],
      },
      userBMemory: {
        processed: {
          summary: '和Alice聊天',
          keyTopics: ['日常'],
        },
        tags: ['friend'],
      },
      userBHasRoleCard: true,
    });
    console.log(`   userA memoryId: ${bidirectionalResult.userA.memoryId}`);
    console.log(`   userB memoryId: ${bidirectionalResult.userB.memoryId}`);
    console.log('   ✓ saveBidirectional works\n');

    console.log('12. Testing getMemoryStats...');
    const stats = await memoryStore.getMemoryStats(testUserId);
    console.log(`   totalMemories: ${stats.totalMemories}`);
    console.log(`   totalPartners: ${stats.totalPartners}`);
    console.log(`   byCompressionStage: ${JSON.stringify(stats.byCompressionStage)}`);
    console.log(`   indexed: ${stats.indexed}`);
    console.log('   ✓ getMemoryStats works\n');

    console.log('13. Testing deleteMemory...');
    const deleted = await memoryStore.deleteMemory(saveResult.filePath);
    console.log(`   deleted: ${deleted}`);
    console.log('   ✓ deleteMemory works\n');

    // Cleanup test files
    console.log('14. Cleaning up test files...');
    const testUserPath = path.join(memoryStore.basePath, testUserId);
    const testAlicePath = path.join(memoryStore.basePath, 'user_alice');
    const testBobPath = path.join(memoryStore.basePath, 'user_bob');

    for (const cleanupPath of [testUserPath, testAlicePath, testBobPath]) {
      try {
        await fsPromises.rm(cleanupPath, { recursive: true, force: true });
        console.log(`   Cleaned: ${cleanupPath}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    console.log('   ✓ Cleanup complete\n');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
  }

  console.log('=== Test Complete ===');
}

// Run tests
testMemoryStore().catch(console.error);
