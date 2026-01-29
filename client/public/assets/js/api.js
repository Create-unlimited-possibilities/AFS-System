// client/public/assets/js/api.js

// API基础URL配置
const API_BASE_URL = window.location.origin;

class AFS_API {
  constructor() {
    this.baseURL = '/api';
    this.translateCache = new Map(); // 缓存：key = `${text}|${targetLang}`
  }

  // 通用请求封装
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('[AFS API Error]', endpoint, err);
      throw err;
    }
  }

  // 实时翻译核心函数
    async translate(text, targetLang = 'ZH') {
        if (!text || typeof text !== 'string') return text;

        // 关键修复：只有当目标不是默认语言（ZH）时才翻译
        if (targetLang === 'ZH') return text;

        const cacheKey = `${text.trim()}|${targetLang}`;
        if (this.translateCache.has(cacheKey)) {
            return this.translateCache.get(cacheKey);
        }

        try {
            const data = await this.request('/translate', {
            method: 'POST',
            body: JSON.stringify({ text, target: targetLang })
            });
            const translated = data.translatedText || text;
            this.translateCache.set(cacheKey, translated);
            return translated;
        } catch (err) {
            console.warn('[翻译失败，回退原文]', text, '→', targetLang);
            this.translateCache.set(cacheKey, text);
            return text;
        }
    }


}

// 全局实例
window.afsAPI = new AFS_API();
