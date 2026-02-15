import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { countTokens } from '../utils/tokens.js';

// 获取项目根目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

export default class FileStorage {
  constructor() {
    // 检测是否在 Docker 容器内运行
    // 方法1：检查 /.dockerenv 文件（标准Docker环境）
    // 方法2：检查环境变量
    const isDocker = fs.existsSync('/.dockerenv') || 
                     process.env.DOCKER_CONTAINER === 'true' ||
                     process.env.NODE_ENV === 'docker';
    
    // Docker 环境使用 /app/storage/userdata（挂载卷路径）
    // 本地环境使用相对路径 server/storage/userdata
    if (isDocker) {
      this.basePath = '/app/storage/userdata';
    } else {
      this.basePath = path.join(projectRoot, 'server', 'storage', 'userdata');
    }
  }

  async initialize() {
    await fsPromises.mkdir(this.basePath, { recursive: true });
  }

  async saveMemoryFile(answer) {
    await this.initialize();

    const { targetUserId, questionId, question, answer: text, questionLayer, questionRole, questionOrder, helperId, helperNickname } = answer;

    const userPath = path.join(this.basePath, String(targetUserId));

    // 修正文件夹命名以匹配文档规范
    const roleMap = {
      'elder': 'A_set',
      'family': 'Bste',
      'friend': 'Cste'
    };

    const dirName = roleMap[questionRole] || 'A_set';

    let folderPath;
    if (questionRole === 'elder') {
      // elder: A_set/basic|emotional （无self子目录）
      folderPath = path.join(userPath, dirName);
    } else {
      // 协助回答：使用 helperId 创建文件夹
      const helperFolder = helperId ? `helper_${helperId}` : `helper_${userId}`;
      folderPath = path.join(userPath, dirName, helperFolder);
    }

    const layerPath = path.join(folderPath, questionLayer);
    await fsPromises.mkdir(layerPath, { recursive: true });

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
      significance: question?.significance || '',
      tokenCount,
      importance,
      tags,
      createdAt: new Date().toISOString()
    };

    await fsPromises.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    console.log(`[FileStorage] 保存记忆文件: ${filePath}`);
    return memory;
  }

  async loadUserMemories(userId) {
    const memories = {
      A_set: [],
      Bste: [],
      Cste: []
    };

    const userPath = path.join(this.basePath, String(userId));

    try {
      // 加载 A_set (elder) - 直接从A_set/basic和A_set/emotional加载（无self子目录）
      const asetPath = path.join(userPath, 'A_set');
      const basicPath = path.join(asetPath, 'basic');
      const emotionalPath = path.join(asetPath, 'emotional');
      
      await this.loadMemoriesFromFolder(basicPath, memories.A_set);
      await this.loadMemoriesFromFolder(emotionalPath, memories.A_set);

      // 加载 Bste (family) - 从所有 helper 文件夹中加载
      const BstePath = path.join(userPath, 'Bste');
      const B_folders = await fsPromises.readdir(BstePath).catch(() => []);
      for (const folder of B_folders) {
        if (folder.startsWith('.')) continue;
        await this.loadMemoriesFromFolder(path.join(BstePath, folder), memories.Bste);
      }

      // 加载 Cste (friend) - 从所有 helper 文件夹中加载
      const CstePath = path.join(userPath, 'Cste');
      const C_folders = await fsPromises.readdir(CstePath).catch(() => []);
      for (const folder of C_folders) {
        if (folder.startsWith('.')) continue;
        await this.loadMemoriesFromFolder(path.join(CstePath, folder), memories.Cste);
      }

      console.log(`[FileStorage] 加载用户记忆: ${userId}, A:${memories.A_set.length}, B:${memories.Bste.length}, C:${memories.Cste.length}`);
    } catch (err) {
      console.warn(`[FileStorage] 加载用户记忆失败: ${userId}:`, err.message);
    }

    return memories;
  }

  async loadMemoriesFromFolder(folderPath, targetArray) {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(folderPath, entry.name);

        if (entry.isDirectory()) {
          await this.loadMemoriesFromFolder(fullPath, targetArray);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          const data = await fsPromises.readFile(fullPath, 'utf-8');
          const memory = JSON.parse(data);
          targetArray.push(memory);
        }
      }
    } catch (err) {
      console.warn(`[FileStorage] 跳过文件夹: ${folderPath}:`, err.message);
    }
  }

  calculateTokens(text) {
    return countTokens(text);
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
