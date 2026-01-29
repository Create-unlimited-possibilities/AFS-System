// JSONL构建工具（扩展版，支持RAG优化格式）
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class JSONLBuilder {
  /**
   * 从MongoDB的Answer集合转换为RAG优化的JSONL格式
   * @param {Array} answers - 答案数据数组
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<string>} 生成的JSONL文件路径
   */
  static async buildRAGOptimizedJSONL(answers, uniqueCode) {
    try {
      // 创建训练数据目录
      const trainingDataDir = path.join(process.cwd(), 'training-data');
      await fs.mkdir(trainingDataDir, { recursive: true });

      // JSONL文件路径
      const jsonlPath = path.join(trainingDataDir, `${uniqueCode}.jsonl`);

      // 生成RAG优化的JSONL内容
      const jsonlLines = [];

      for (const answer of answers) {
        // 构建RAG优化的格式
        const line = {
          // 问答对作为主要内容
          question: answer.questionId?.question || '',
          answer: answer.answer || '',
          text: `问题: ${answer.questionId?.question || ''}\n答案: ${answer.answer || ''}`,
          metadata: {
            questionId: answer.questionId?._id || answer.questionId || '',
            questionText: answer.questionId?.question || '',
            questionLayer: answer.questionLayer || '',
            questionOrder: answer.questionId?.order || 0,
            userId: answer.userId?._id || answer.userId || '',
            userName: answer.userId?.name || answer.userId?.username || '',
            uniqueCode: answer.userId?.uniqueCode || '',
            targetUserId: answer.targetUserId || '',
            relationshipType: answer.relationshipType || '',
            isSelfAnswer: answer.isSelfAnswer || false,
            answeredBy: answer.userId?.name || 'Unknown',
            timestamp: answer.createdAt || new Date(),
            updatedAt: answer.updatedAt || new Date(),
            source: 'answer_record'
          }
        };

        jsonlLines.push(JSON.stringify(line));
      }

      // 写入文件
      await fs.writeFile(jsonlPath, jsonlLines.join('\n'), 'utf-8');

      console.log(`RAG优化的JSONL文件已生成: ${jsonlPath}, 包含 ${jsonlLines.length} 条记录`);
      return jsonlPath;
    } catch (err) {
      console.error('生成RAG优化JSONL文件失败:', err);
      throw err;
    }
  }

  /**
   * 构建传统格式的JSONL（用于模型训练）
   * @param {Array} answers - 答案数据数组
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<string>} 生成的JSONL文件路径
   */
  static async buildTrainingJSONL(answers, uniqueCode) {
    try {
      // 创建训练数据目录
      const trainingDataDir = path.join(process.cwd(), 'training-data');
      await fs.mkdir(trainingDataDir, { recursive: true });

      // JSONL文件路径
      const jsonlPath = path.join(trainingDataDir, `${uniqueCode}.jsonl`);

      // 生成传统的训练JSONL内容
      const jsonlLines = [];

      for (const answer of answers) {
        if (!answer.questionId) continue;

        const line = {
          messages: [
            {
              role: 'system',
              content: '你是一个帮助记录和整理个人回忆的AI助手。'
            },
            {
              role: 'user',
              content: answer.questionId.question
            },
            {
              role: 'assistant',
              content: answer.answer
            }
          ],
          metadata: {
            questionLayer: answer.questionLayer,
            questionOrder: answer.questionId.order,
            answeredBy: answer.userId?.name || 'Unknown',
            relationshipType: answer.relationshipType,
            timestamp: answer.createdAt,
            uniqueCode: answer.userId?.uniqueCode || ''
          }
        };

        jsonlLines.push(JSON.stringify(line));
      }

      // 写入文件
      await fs.writeFile(jsonlPath, jsonlLines.join('\n'), 'utf-8');

      console.log(`训练用JSONL文件已生成: ${jsonlPath}, 包含 ${jsonlLines.length} 条记录`);
      return jsonlPath;
    } catch (err) {
      console.error('生成训练JSONL文件失败:', err);
      throw err;
    }
  }

  /**
   * 从数据库查询构建JSONL文件
   * @param {Object} dbAnswers - 数据库查询结果
   * @param {string} uniqueCode - 用户唯一编码
   * @param {string} format - 格式类型 ('rag' 或 'training')
   * @returns {Promise<string>} 生成的JSONL文件路径
   */
  static async buildFromDatabase(dbAnswers, uniqueCode, format = 'rag') {
    // 将Mongoose查询结果转换为普通对象数组
    const answers = dbAnswers.map(answer => {
      return {
        _id: answer._id,
        userId: answer.userId ? (typeof answer.userId.toObject === 'function' ? answer.userId.toObject() : answer.userId) : null,
        targetUserId: answer.targetUserId,
        questionId: answer.questionId ? (typeof answer.questionId.toObject === 'function' ? answer.questionId.toObject() : answer.questionId) : null,
        questionLayer: answer.questionLayer,
        answer: answer.answer,
        isSelfAnswer: answer.isSelfAnswer,
        relationshipType: answer.relationshipType,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt
      };
    });

    if (format === 'rag') {
      return await this.buildRAGOptimizedJSONL(answers, uniqueCode);
    } else {
      return await this.buildTrainingJSONL(answers, uniqueCode);
    }
  }

  /**
   * 添加问答对到现有JSONL文件
   * @param {Object} answer - 单个答案对象
   * @param {string} uniqueCode - 用户唯一编码
   * @returns {Promise<boolean>} 是否成功添加
   */
  static async appendToJSONL(answer, uniqueCode) {
    try {
      const trainingDataDir = path.join(process.cwd(), 'training-data');
      await fs.mkdir(trainingDataDir, { recursive: true });

      const jsonlPath = path.join(trainingDataDir, `${uniqueCode}.jsonl`);

      // 构建RAG优化的行数据
      const line = {
        question: answer.questionId?.question || '',
        answer: answer.answer || '',
        text: `问题: ${answer.questionId?.question || ''}\n答案: ${answer.answer || ''}`,
        metadata: {
          questionId: answer.questionId?._id || answer.questionId || '',
          questionText: answer.questionId?.question || '',
          questionLayer: answer.questionLayer || '',
          questionOrder: answer.questionId?.order || 0,
          userId: answer.userId?._id || answer.userId || '',
          userName: answer.userId?.name || answer.userId?.username || '',
          uniqueCode: answer.userId?.uniqueCode || '',
          targetUserId: answer.targetUserId || '',
          relationshipType: answer.relationshipType || '',
          isSelfAnswer: answer.isSelfAnswer || false,
          answeredBy: answer.userId?.name || 'Unknown',
          timestamp: answer.createdAt || new Date(),
          updatedAt: answer.updatedAt || new Date(),
          source: 'answer_record'
        }
      };

      // 追加到文件
      const lineString = JSON.stringify(line) + '\n';
      await fs.appendFile(jsonlPath, lineString, 'utf-8');

      console.log(`问答对已追加到JSONL文件: ${jsonlPath}`);
      return true;
    } catch (err) {
      console.error('追加到JSONL文件失败:', err);
      return false;
    }
  }

  /**
   * 验证JSONL文件格式
   * @param {string} filePath - JSONL文件路径
   * @returns {Promise<boolean>} 文件是否有效
   */
  static async validateJSONL(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim() !== '');
      
      for (let i = 0; i < lines.length; i++) {
        try {
          const obj = JSON.parse(lines[i]);
          // 验证必要的字段
          if (!obj.text && !obj.messages) {
            console.warn(`第 ${i+1} 行缺少必要字段`);
            return false;
          }
        } catch (parseErr) {
          console.error(`第 ${i+1} 行JSON解析失败:`, parseErr.message);
          return false;
        }
      }

      console.log(`JSONL文件验证成功: ${filePath}, 共 ${lines.length} 行`);
      return true;
    } catch (err) {
      console.error('验证JSONL文件失败:', err);
      return false;
    }
  }
}

export default JSONLBuilder;