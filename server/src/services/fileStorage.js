import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export default class FileStorage {
  constructor() {
    this.basePath = '/app/storage/userdata';
  }

  async initialize() {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async saveMemoryFile(answer) {
    await this.initialize();

    const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder, helperId, helperNickname } = answer;
    const userPath = path.join(this.basePath, String(targetUserId));

    const roleMap = {
      'elder': 'A_set',
      'family': 'B_sets',
      'friend': 'C_sets'
    };

    const dirName = roleMap[questionRole] || 'A_set';
    
    let folderPath;
    if (questionRole === 'elder') {
      folderPath = path.join(userPath, dirName, 'self');
    } else {
      const helperFolder = helperNickname ? `${helperId}_${helperNickname}` : `helper_${helperId}`;
      folderPath = path.join(userPath, dirName, helperFolder);
    }

    const layerPath = path.join(folderPath, questionLayer);
    await fs.mkdir(layerPath, { recursive: true });

    const fileName = `question_${questionOrder}.json`;
    const filePath = path.join(layerPath, fileName);

    const tokenCount = this.calculateTokens(text);
    const importance = this.assessImportance(text, questionLayer);
    const tags = this.extractTags(question, text);

    const memory = {
      memoryId: crypto.randomUUID(),
      questionId: String(questionId),
      question,
      questionRole,
      questionLayer,
      questionOrder,
      answer: text,
      helperId,
      helperNickname,
      tokenCount,
      importance,
      tags,
      createdAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    console.log(`[FileStorage] 保存记忆文件: ${filePath}`);
    return memory;
  }

  async loadUserMemories(userId) {
    const memories = {
      A_set: [],
      B_sets: [],
      C_sets: []
    };

    const userPath = path.join(this.basePath, String(userId));

    try {
      await this.loadMemoriesFromFolder(path.join(userPath, 'A_set', 'self'), memories.A_set);
      
      const B_setsPath = path.join(userPath, 'B_sets');
      const B_folders = await fs.readdir(B_setsPath).catch(() => []);
      for (const folder of B_folders) {
        if (folder.startsWith('.')) continue;
        await this.loadMemoriesFromFolder(path.join(B_setsPath, folder), memories.B_sets);
      }

      const C_setsPath = path.join(userPath, 'C_sets');
      const C_folders = await fs.readdir(C_setsPath).catch(() => []);
      for (const folder of C_folders) {
        if (folder.startsWith('.')) continue;
        await this.loadMemoriesFromFolder(path.join(C_setsPath, folder), memories.C_sets);
      }

      console.log(`[FileStorage] 加载用户记忆: ${userId}, A:${memories.A_set.length}, B:${memories.B_sets.length}, C:${memories.C_sets.length}`);
    } catch (err) {
      console.warn(`[FileStorage] 加载用户记忆失败: ${userId}:`, err.message);
    }

    return memories;
  }

  async loadMemoriesFromFolder(folderPath, targetArray) {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          await this.loadMemoriesFromFolder(fullPath, targetArray);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          const data = await fs.readFile(fullPath, 'utf-8');
          const memory = JSON.parse(data);
          targetArray.push(memory);
        }
      }
    } catch (err) {
      console.warn(`[FileStorage] 跳过文件夹: ${folderPath}:`, err.message);
    }
  }

  calculateTokens(text) {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 0.65 + otherChars * 1.0);
  }

  assessImportance(answer, layer) {
    const baseScore = layer === 'emotional' ? 0.8 : 0.5;
    const lengthFactor = Math.min(answer.length / 200, 0.2);
    return Math.min(baseScore + lengthFactor, 1.0);
  }

  extractTags(question, answer) {
    const tags = [];
    const combined = question + answer;

    if (combined.includes('开心') || combined.includes('快乐') || combined.includes('幸福')) {
      tags.push('positive');
    }
    if (combined.includes('难过') || combined.includes('伤心') || combined.includes('痛苦')) {
      tags.push('negative');
    }
    if (combined.includes('家庭') || combined.includes('家人')) tags.push('family');
    if (combined.includes('工作') || combined.includes('事业')) tags.push('work');
    if (combined.includes('朋友') || combined.includes('同事')) tags.push('social');

    return tags.length > 0 ? tags : ['其他'];
  }
}
