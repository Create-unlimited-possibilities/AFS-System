/**
 * 紫微斗数 LLM 服务
 * 使用 Ollama 运行 8B 命理报告生成模型
 *
 * This service:
 * 1. Generates fortune-telling reports using Ollama ziwei-8b model
 * 2. Builds prompts from chart data and RAG context
 * 3. Handles Ollama API communication
 *
 * @author AFS Team
 * @version 1.0.0
 */

import logger from '../utils/logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const ZIWEI_MODEL = process.env.ZIWEI_MODEL || 'ziwei-8b';
const ZIWEI_TIMEOUT = parseInt(process.env.ZIWEI_TIMEOUT || '120000', 10);

/**
 * Ziwei LLM Service Class
 * Singleton pattern for managing Ollama connection
 */
class ZiweiLlmService {
  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
    this.model = ZIWEI_MODEL;
    this.timeout = ZIWEI_TIMEOUT;
  }

  /**
   * 生成命理报告
   * Generate fortune-telling report based on chart data and RAG context
   *
   * @param {Object} chartData - Natal chart data from iztro
   * @param {Array} ragContext - RAG retrieved context from ziwei books
   * @param {string} userQuestion - User's question
   * @returns {Promise<string>} Generated fortune report
   * @throws {Error} If generation fails
   *
   * @example
   * const report = await ziweiLlm.generateReport(
   *   { solarDate: '1990-05-15', palaces: [...] },
   *   [{ content: '命宫特点...' }],
   *   '我的事业发展如何'
   * );
   */
  async generateReport(chartData, ragContext = [], userQuestion = '') {
    const prompt = this.buildPrompt(chartData, ragContext, userQuestion);

    try {
      logger.info(`[ZiweiLlm] Generating report for chart: ${chartData?.solarDate}`);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeout),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 4096,
            num_predict: 2048
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const report = data.response || data.message || '';

      logger.info(`[ZiweiLlm] Report generated successfully (${report.length} chars)`);
      return report;
    } catch (error) {
      logger.error('[ZiweiLlmService] Generate report failed:', error);
      throw new Error(`Failed to generate fortune report: ${error.message}`);
    }
  }

  /**
   * 从预构建的prompt生成报告 (v2.0)
   * Generate report from a pre-built prompt string
   *
   * @param {string} prompt - Pre-built prompt string
   * @returns {Promise<string>} Generated fortune report
   */
  async generateReportFromPrompt(prompt) {
    try {
      logger.info(`[ZiweiLlm] Generating report from prompt (${prompt.length} chars)`);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeout),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 16384,  // Match the modelfile setting
            num_predict: 4096
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const report = data.response || data.message || '';

      logger.info(`[ZiweiLlm] Report from prompt generated (${report.length} chars)`);
      return report;
    } catch (error) {
      logger.error('[ZiweiLlmService] Generate from prompt failed:', error);
      throw new Error(`Failed to generate report from prompt: ${error.message}`);
    }
  }

  /**
   * 构建提示词
   * Build prompt for LLM from chart data, RAG context, and user question
   *
   * @param {Object} chartData - Natal chart data
   * @param {Array} ragContext - RAG context
   * @param {string} userQuestion - User's question
   * @returns {string} Formatted prompt for LLM
   */
  buildPrompt(chartData, ragContext, userQuestion) {
    let prompt = '以下是用户的紫微斗数命盘信息：\n\n';

    // 添加基本信息
    if (chartData?.solarDate) {
      prompt += `公历：${chartData.solarDate}\n`;
    }
    if (chartData?.lunarDate) {
      prompt += `农历：${chartData.lunarDate}\n`;
    }
    if (chartData?.chineseDate) {
      prompt += `四柱：${chartData.chineseDate}\n`;
    }
    if (chartData?.zodiac) {
      prompt += `生肖：${chartData.zodiac}\n`;
    }
    if (chartData?.sign) {
      prompt += `星座：${chartData.sign}\n`;
    }
    if (chartData?.fiveElementsClass) {
      prompt += `命主：${chartData.fiveElementsClass}\n`;
    }

    // 命宫和身宫
    if (chartData?.soul) {
      prompt += `命宫：${chartData.soul}\n`;
    }
    if (chartData?.body) {
      prompt += `身宫：${chartData.body}\n`;
    }

    prompt += '\n';

    // 添加十二宫位信息
    if (chartData?.palaces && chartData.palaces.length > 0) {
      prompt += '十二宫信息：\n';
      for (const palace of chartData.palaces) {
        const majorStars = palace.majorStars?.map(s => s.name).join('、') || '无主星';
        const minorStars = palace.minorStars?.length > 0 ? palace.minorStars.join('、') : '';
        const starsText = minorStars ? `${majorStars}、辅星：${minorStars}` : majorStars;
        prompt += `- ${palace.name}：${starsText}\n`;
      }
      prompt += '\n';
    }

    // 添加 RAG 上下文
    if (ragContext && ragContext.length > 0) {
      prompt += '参考紫微斗数书籍内容：\n';
      const maxContextItems = 3; // Limit to 3 most relevant chunks
      for (let i = 0; i < Math.min(ragContext.length, maxContextItems); i++) {
        const ctx = ragContext[i];
        prompt += `${i + 1}. ${ctx.content}\n`;
      }
      prompt += '\n';
    }

    // 添加用户问题
    if (userQuestion && userQuestion.trim()) {
      prompt += `用户问题：${userQuestion}\n\n`;
    }

    prompt += '请根据以上命盘信息，结合紫微斗数理论和参考书籍内容，提供专业、详细、有深度的命理分析报告。分析要包括：\n';
    prompt += '1. 命盘核心特点分析\n';
    prompt += '2. 优势与挑战\n';
    prompt += '3. 运势建议\n\n';
    prompt += '请用通俗易懂但保持专业性的语言来解释。';

    return prompt;
  }

  /**
   * Generate fortune report with streaming response
   * Useful for long reports that take time to generate
   *
   * @param {Object} chartData - Natal chart data
   * @param {Array} ragContext - RAG context
   * @param {string} userQuestion - User's question
   * @param {Function} onChunk - Callback for each chunk
   * @returns {Promise<string>} Complete report
   */
  async generateReportStream(chartData, ragContext = [], userQuestion = '', onChunk = null) {
    const prompt = this.buildPrompt(chartData, ragContext, userQuestion);

    try {
      logger.info(`[ZiweiLlm] Generating streaming report`);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.timeout),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_ctx: 4096,
            num_predict: 2048
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.response) {
              fullReport += data.response;
              if (onChunk) {
                onChunk(data.response);
              }
            }
          }
        }
      }

      logger.info(`[ZiweiLlm] Streaming report complete (${fullReport.length} chars)`);
      return fullReport;
    } catch (error) {
      logger.error('[ZiweiLlmService] Streaming generation failed:', error);
      throw error;
    }
  }

  /**
   * Health check for Ollama service
   * @returns {Promise<boolean>} True if service is healthy and model is available
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const hasModel = data.models?.some(m => m.name.includes(this.model));

      if (hasModel) {
        logger.info(`[ZiweiLlmService] Health check passed - model '${this.model}' is available`);
      } else {
        logger.warn(`[ZiweiLlmService] Health check failed - model '${this.model}' not found`);
      }

      return hasModel;
    } catch (error) {
      logger.warn('[ZiweiLlmService] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get available models from Ollama
   * @returns {Promise<Array>} List of available model names
   */
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.models?.map(m => m.name) || [];
    } catch (error) {
      logger.error('[ZiweiLlmService] Failed to get models:', error);
      return [];
    }
  }

  /**
   * Test connection to Ollama
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      logger.warn('[ZiweiLlmService] Connection test failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export default new ZiweiLlmService();
