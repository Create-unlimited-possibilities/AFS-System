import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export default class MemoryStorage {
  constructor() {
    this.basePath = path.join(process.cwd(), 'userdata');
  }

  async initializeUserFolder(userId) {
    const userPath = path.join(this.basePath, String(userId));
    
    const folders = [
      path.join(userPath, 'long_term_memories'),
      path.join(userPath, 'short_term_memories'),
      path.join(userPath, 'old_memories', 'A_set'),
      path.join(userPath, 'old_memories', 'B_sets'),
      path.join(userPath, 'old_memories', 'C_sets'),
      path.join(userPath, 'new_memories', 'stranger'),
      path.join(userPath, 'new_memories', 'family', 'son'),
      path.join(userPath, 'new_memories', 'family', 'daughter'),
      path.join(userPath, 'new_memories', 'family', 'wife'),
      path.join(userPath, 'new_memories', 'friends', 'casual'),
      path.join(userPath, 'new_memories', 'friends', 'close'),
      path.join(userPath, 'new_memories', 'friends', 'intimate'),
      path.join(userPath, 'new_memories', 'others', 'lover'),
      path.join(userPath, 'indexes')
    ];

    for (const folder of folders) {
      await fs.mkdir(folder, { recursive: true });
    }

    await this.createIndexMetadata(userPath);
  }

  async createIndexMetadata(userPath) {
    const metadata = {
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      schema: {
        memoryFile: {
          timestamp: 'Date',
          content: 'String',
          relationType: 'String',
          importance: 'Number',
          tags: 'Array<String>'
        }
      }
    };

    const metadataPath = path.join(userPath, 'indexes', 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  async storeQuestionAnswer(targetUserId, question, answer, helper) {
    const { _id: questionId, role, layer, order } = question;
    const questionRoleMap = { elder: 'A_set', family: 'B_sets', friend: 'C_sets' };
    
    const dirName = questionRoleMap[role];
    const helperFolder = helper ? `${helper._id}_${helper.name}` : 'self';
    const fileName = `question_${order}.json`;
    
    const folderPath = path.join(
      this.basePath, 
      String(targetUserId),
      'old_memories',
      dirName
    );
    
    const helperPath = path.join(folderPath, layer);
    await fs.mkdir(helperPath, { recursive: true });
    
    const filePath = path.join(helperPath, fileName);
    const tokenCount = await this.calculateTokens(answer);
    
    const memory = {
      memoryId: crypto.randomUUID(),
      questionId: String(questionId),
      question: question.question,
      questionRole: role,
      questionLayer: layer,
      questionOrder: order,
      answer,
      helperId: helper ? String(helper._id) : null,
      helperNickname: helper?.name || null,
      tokenCount,
      importance: await this.assessImportance(answer, layer),
      tags: this.extractTags(question.question, answer),
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
    
    return memory;
  }

  async calculateTokens(text) {
    const chineseCharPattern = /[\u4e00-\u9fa5]/;
    const chineseCount = (text.match(chineseCharPattern) || []).length;
    const coefficient = chineseCount > 0 ? 0.65 : 1.0;
    return Math.ceil(text.length * coefficient);
  }

  async assessImportance(answer, layer) {
    const baseImportance = layer === 'emotional' ? 0.8 : 0.5;
    const variation = Math.random() * 0.2;
    return Math.min(1.0, baseImportance + variation);
  }

  extractTags(question, answer) {
    const tags = [];
    const keywords = ['性格', '习惯', '家庭', '朋友', '情感', '价值观', '经历'];
    const combined = question + answer;
    
    keywords.forEach(keyword => {
      if (combined.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags.length > 0 ? tags : ['其他'];
  }
}