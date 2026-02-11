import logger from '../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.backend = process.env.EMBEDDING_BACKEND || 'ollama';
    this.client = null;
  }

  async initialize() {
    if (this.client) return;

    try {
      if (this.backend === 'ollama') {
        const { OllamaEmbeddings } = await import('@langchain/ollama');
        this.client = new OllamaEmbeddings({
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          model: process.env.EMBEDDING_MODEL || 'bge-m3'
        });
        logger.info('[EmbeddingService] Ollama embedding客户端初始化成功');
      } else if (this.backend === 'openai') {
        const { OpenAIEmbeddings } = await import('@langchain/openai');
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is required for OpenAI backend');
        }
        this.client = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: 'text-embedding-3-small'
        });
        logger.info('[EmbeddingService] OpenAI embedding客户端初始化成功');
      } else {
        throw new Error(`不支持的embedding后端: ${this.backend}`);
      }
    } catch (error) {
      logger.error('[EmbeddingService] 初始化失败:', error);
      throw error;
    }
  }

  async embedQuery(text) {
    await this.initialize();
    return this.client.embedQuery(text);
  }

  async embedDocuments(texts) {
    await this.initialize();
    return this.client.embedDocuments(texts);
  }

  async healthCheck() {
    try {
      await this.initialize();
      const testResult = await this.client.embedQuery('test');
      logger.info('[EmbeddingService] 健康检查通过');
      return true;
    } catch (error) {
      logger.warn('[EmbeddingService] 健康检查失败:', error.message);
      return false;
    }
  }
}

export default EmbeddingService;
