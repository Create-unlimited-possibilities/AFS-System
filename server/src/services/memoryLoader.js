// 记忆加载服务 - 用于加载用户记忆以便生成角色卡
import fs from 'fs/promises';
import path from 'path';

export default class MemoryLoader {
  constructor() {
    this.basePath = path.join(process.cwd(), 'userdata');
  }

  async loadUserMemories(userId) {
    const memories = {
      A_set: [],
      B_sets: [],
      C_sets: []
    };

    const userPath = path.join(this.basePath, String(userId), 'old_memories');

    try {
      // 加载 A_set
      const A_setPath = path.join(userPath, 'A_set', 'self');
      await this.loadMemoriesFromFolder(A_setPath, memories.A_set, 'basic');
      await this.loadMemoriesFromFolder(A_setPath, memories.A_set, 'emotional');

      // 加载 B_sets
      const B_setsPath = path.join(userPath, 'B_sets');
      const B_folders = await fs.readdir(B_setsPath).catch(() => []);
      for (const folder of B_folders) {
        if (folder.startsWith('.')) continue;
        const folderPath = path.join(B_setsPath, folder);
        await this.loadMemoriesFromFolder(folderPath, memories.B_sets, 'basic');
        await this.loadMemoriesFromFolder(folderPath, memories.B_sets, 'emotional');
      }

      // 加载 C_sets
      const C_setsPath = path.join(userPath, 'C_sets');
      const C_folders = await fs.readdir(C_setsPath).catch(() => []);
      for (const folder of C_folders) {
        if (folder.startsWith('.')) continue;
        const folderPath = path.join(C_setsPath, folder);
        await this.loadMemoriesFromFolder(folderPath, memories.C_sets, 'basic');
        await this.loadMemoriesFromFolder(folderPath, memories.C_sets, 'emotional');
      }

    } catch (err) {
      console.warn('加载用户记忆失败:', err.message);
    }

    return memories;
  }

  async loadMemoriesFromFolder(folderPath, targetArray, layer) {
    try {
      const layerPath = path.join(folderPath, layer);
      const files = await fs.readdir(layerPath).catch(() => []);

      for (const file of files) {
        if (file.startsWith('.') || !file.endsWith('.json')) continue;

        const filePath = path.join(layerPath, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const memory = JSON.parse(data);
        targetArray.push(memory);
      }
    } catch (err) {
      // 忽略文件夹不存在或文件错误
    }
  }

  async getAllTextByLayer(memories, layer = 'emotional') {
    const allMemories = [
      ...memories.A_set.filter(m => m.questionLayer === layer),
      ...memories.B_sets.filter(m => m.questionLayer === layer),
      ...memories.C_sets.filter(m => m.questionLayer === layer)
    ];

    return allMemories.map(m => ({
      question: m.question,
      answer: m.answer,
      role: m.questionRole,
      layer: m.questionLayer,
      importance: m.importance
    }));
  }
}