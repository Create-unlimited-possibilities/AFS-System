// 角色卡生成服务 - 用于从用户记忆生成角色卡
import MemoryLoader from './memoryLoader.js';
import memoryStorage from './memoryStorage.js';
import crypto from 'crypto';

export default class RoleCardGenerator {
  constructor() {
    this.memoryLoader = new MemoryLoader();
  }

  async generateRoleCard(userId) {
    const memories = await this.memoryLoader.loadUserMemories(userId);
    
    // 检查是否有足够的 A 套记忆
    const A_emotional = memories.A_set.filter(m => m.questionLayer === 'emotional');
    if (A_emotional.length < 10) {
      throw new Error('情感层次答案不足，请先完成至少 10 个情感问题');
    }

    // 分批处理记忆
    const selfCognition = await this.generateSelfCognition(memories);
    const familyScripts = await this.generateFamilyScripts(memories);
    const friendScripts = await this.generateFriendScripts(memories);

    return {
      roleCardId: crypto.randomUUID(),
      userId: String(userId),
      version: 1,
      createdAt: new Date().toISOString(),
      sections: {
        selfCognition,
        familyScripts,
        friendScripts
      }
    };
  }

  async generateSelfCognition(memories) {
    const allText = memories.A_set
      .filter(m => m.questionLayer === 'emotional')
      .map(m => `Q: ${m.question}\nA: ${m.answer}`)
      .join('\n\n');

    // 简化版本：实际应调用模型进行文本压缩
    const summary = allText.slice(0, 200) + '...';
    
    // 从答案中提取特质
    const traits = this.extractTraits(memories.A_set);
    const vulnerabilities = this.extractVulnerabilities(memories.A_set);

    return {
      summary: this.compressText(summary, 100),
      traits: traits.length > 0 ? traits.slice(0, 5) : ['温和', '善良'],
      vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities.slice(0, 3) : ['怕孤独']
    };
  }

  async generateFamilyScripts(memories) {
    const B_emotional = memories.B_sets.filter(m => m.questionLayer === 'emotional');
    
    if (B_emotional.length === 0) {
      return {
        children: '对子女关心爱护。',
        spouse: '对配偶温柔体贴。'
      };
    }

    const children = this.extractFamilyInsights(B_emotional, 'children');
    const spouse = this.extractFamilyInsights(B_emotional, 'spouse');

    return {
      children: children || '对子女关心爱护。',
      spouse: spouse || '对配偶温柔体贴。'
    };
  }

  async generateFriendScripts(memories) {
    const C_emotional = memories.C_sets.filter(m => m.questionLayer === 'emotional');
    
    if (C_emotional.length === 0) {
      return {
        casual: '和朋友相处礼貌客气。',
        close: '和好朋友会分享日常。',
        intimate: '和知己可以倾诉真心。'
      };
    }

    const casual = this.extractFriendInsights(C_emotional, 'casual');
    const close = this.extractFriendInsights(C_emotional, 'close');
    const intimate = this.extractFriendInsights(C_emotional, 'intimate');

    return {
      casual: casual || '和朋友相处礼貌客气。',
      close: close || '和好朋友会分享日常。',
      intimate: intimate || '和知己可以倾诉真心。'
    };
  }

  extractTraits(memories) {
    const traits = [];
    const keywords = ['诚实', '善良', '勇敢', '坚强', '温柔', '细心', '乐观', '谦虚'];
    const text = memories.map(m => m.answer).join(' ');

    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        traits.push(keyword);
      }
    });

    return [...new Set(traits)];
  }

  extractVulnerabilities(memories) {
    const vulnerabilities = [];
    const keywords = ['孤独', '寂寞', '迷茫', '失落', '焦虑', '担忧'];
    const text = memories.map(m => m.answer).join(' ');

    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        vulnerabilities.push(keyword);
      }
    });

    return [...new Set(vulnerabilities)];
  }

  extractFamilyInsights(memories, relation) {
    const text = memories.map(m => m.answer).join(' ');
    const patterns = {
      children: ['子女', '孩子', '儿子', '女儿'],
      spouse: ['妻子', '丈夫', '配偶', '老伴']
    };

    const keywords = patterns[relation] || [];
    const sentences = text.split(/[。！？，；]/);

    for (const sentence of sentences) {
      if (keywords.some(k => sentence.includes(k))) {
        return sentence.slice(0, 30) + '……';
      }
    }

    return null;
  }

  extractFriendInsights(memories, level) {
    const levels = {
      casual: ['朋友', '认识'],
      close: ['好朋友', '很好的朋友'],
      intimate: ['知己', '最好的朋友', '倾诉']
    };

    const keywords = levels[level] || [];
    const text = memories.map(m => m.answer).join(' ');
    const sentences = text.split(/[。！？，；]/);

    for (const sentence of sentences) {
      if (keywords.some(k => sentence.includes(k))) {
        return sentence.slice(0, 30) + '……';
      }
    }

    return null;
  }

  compressText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  async updateRoleCard(roleCard, newMemories) {
    roleCard.version += 1;
    roleCard.updatedAt = new Date().toISOString();

    // 将新记忆整合到对应部分
    // 这里简化处理，实际应重新生成相关部分

    return roleCard;
  }
}