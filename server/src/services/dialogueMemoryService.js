// 对话记忆服务 - 用于存储和管理对话记忆
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import memoryStorage from './memoryStorage.js';

export default class DialogueMemoryService {
  constructor() {
    this.basePath = path.join(process.cwd(), 'userdata');
    this.memStorage = memoryStorage;
  }

  async saveDialogueMemory(userId, dialogueData) {
    const { content, relationType, participants = [] } = dialogueData;

    const tokenCount = await this.memStorage.calculateTokens(content);
    const importance = 0.7; // 对话记忆的中等重要性
    const timestamp = new Date().toISOString();

    const memory = {
      memoryId: crypto.randomUUID(),
      source: 'dialogue',
      participants,
      content,
      tokenCount,
      importance,
      tags: this.extractTags(content),
      createdAt: timestamp
    };

    // 确定存储路径
    const relationPath = this.getRelationPath(relationType);
    if (!relationPath) {
      console.warn(`未知的关系类型: ${relationType}`);
      return null;
    }

    const userPath = path.join(this.basePath, String(userId), 'new_memories', relationPath);
    await fs.mkdir(userPath, { recursive: true });

    const timestampStr = Date.now();
    const filePath = path.join(userPath, `dialogue_${timestampStr}.json`);

    await fs.writeFile(filePath, JSON.stringify(memory, null, 2));

    return memory;
  }

  getRelationPath(relationType) {
    const pathMap = {
      'stranger': 'stranger',
      'family': 'family',
      'friend': 'friends'
    };

    const subMap = {
      'family': {
        'default': 'family',
        'son': 'family/son',
        'daughter': 'family/daughter',
        'wife': 'family/wife',
        'husband': 'family/husband'
      },
      'friend': {
        'casual': 'friends/casual',
        'close': 'friends/close',
        'intimate': 'friends/intimate'
      }
    };

    return pathMap[relationType] || 'stranger';
  }

  extractTags(text) {
    const tags = [];
    const keywords = [
      '日常', '爱好', '情感', '回忆', '家庭', '朋友', '工作',
      '健康', '天气', '食物', '旅行', '音乐', '电影', '新闻'
    ];

    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return tags.length > 0 ? tags : ['日常'];
  }

  async saveDialogueForParticipants(dialogueId, sourceUserId, targetUserId, content) {
    // 为双方都保存对话记忆
    const sourceMemory = await this.saveDialogueMemory(sourceUserId, {
      memoryId: dialogueId,
      content: `[与对方对话] ${content}`,
      relationType: 'family',
      participants: [sourceUserId, targetUserId]
    });

    const targetMemory = await this.saveDialogueMemory(targetUserId, {
      memoryId: dialogueId,
      content: `[与对方对话] ${content}`,
      relationType: 'family',
      participants: [sourceUserId, targetUserId]
    });

    // 更新双方的 token 总量
    const User = (await import('../models/User.js')).default;

    if (sourceMemory) {
      await User.findByIdAndUpdate(sourceUserId, {
        $inc: { 'chatBeta.memoryTokenCount': sourceMemory.tokenCount }
      });
    }

    if (targetMemory) {
      await User.findByIdAndUpdate(targetUserId, {
        $inc: { 'chatBeta.memoryTokenCount': targetMemory.tokenCount }
      });
    }

    return { sourceMemory, targetMemory };
  }

  async loadDialogueMemories(userId, relationType = null) {
    const memories = [];
    const newMemoriesPath = path.join(this.basePath, String(userId), 'new_memories');

    try {
      if (relationType) {
        const specificPath = path.join(newMemoriesPath, relationType);
        const files = await fs.readdir(specificPath).catch(() => []);
        
        for (const file of files) {
          if (file.startsWith('.') || !file.endsWith('.json')) continue;
          const filePath = path.join(specificPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          memories.push(JSON.parse(data));
        }
      } else {
        // 加载所有新记忆
        const typeFolders = await fs.readdir(newMemoriesPath).catch(() => []);
        
        for (const folder of typeFolders) {
          if (folder.startsWith('.')) continue;
          const folderPath = path.join(newMemoriesPath, folder);
          
          // 处理子文件夹
          const subFolders = await fs.readdir(folderPath).catch(() => []);
          for (const subFolder of subFolders) {
            if (subFolder.startsWith('.')) continue;
            const subFolderPath = path.join(folderPath, subFolder);
            const files = await fs.readdir(subFolderPath).catch(() => []);

            for (const file of files) {
              if (file.startsWith('.') || !file.endsWith('.json')) continue;
              const filePath = path.join(subFolderPath, file);
              const data = await fs.readFile(filePath, 'utf-8');
              memories.push(JSON.parse(data));
            }
          }
        }
      }
    } catch (err) {
      console.warn('加载对话记忆失败:', err.message);
    }

    return memories;
  }
}