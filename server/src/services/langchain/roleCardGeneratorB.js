import fs from 'fs/promises';
import path from 'path';
import { ChatOpenAI } from '@langchain/openai';
import { buildCompressPrompt } from '../langchain/prompts/compressPrompt.js';
import roleCardConfig from '../../config/roleCardConfig.js';
import ProgressTracker from '../../utils/ProgressTracker.js';

class RoleCardGeneratorB {
  constructor() {
    this.baseDir = path.join(process.cwd(), 'server', 'storage', 'userdata');
    this.llm = new ChatOpenAI({
      modelName: 'qwen2.5',
      temperature: roleCardConfig.methodB.temperature,
      maxTokens: roleCardConfig.methodB.maxTokens,
    });
  }

  async generateRoleCard(userId, progressCallback) {
    const allAnswers = await this.scanAllAnswers(userId);
    
    let totalQuestions = 0;
    Object.values(allAnswers).forEach(roleData => {
      Object.values(roleData).forEach(layerData => {
        totalQuestions += layerData.answerFiles.length;
      });
    });

    const tracker = new ProgressTracker(totalQuestions, userId);
    
    try {
      progressCallback('start', {
        userId,
        totalQuestions
      });

      if (totalQuestions === 0) {
        progressCallback('complete', {
          summary: {
            totalQuestions: 0,
            success: 0,
            failed: 0,
            duration: 0,
            stats: {}
          }
        });
        return { success: true, message: 'No questions found to process' };
      }

      await this.processRole(userId, 'A', tracker, progressCallback);
      await this.processRole(userId, 'B', tracker, progressCallback);
      await this.processRole(userId, 'C', tracker, progressCallback);

      const summary = tracker.getSummary();
      
      progressCallback('complete', {
        summary: {
          totalQuestions: summary.total,
          success: summary.success,
          failed: summary.failed,
          duration: summary.duration,
          stats: summary.stats
        }
      });

      return {
        success: true,
        message: `Role card generated successfully. Success: ${summary.success}, Failed: ${summary.failed}`
      };
    } catch (error) {
      progressCallback('error', {
        question: 'system',
        role: 'system',
        layer: 'system',
        error: error.message
      });
      throw error;
    }
  }

  async checkProgress(userId, role, layer) {
    if (role !== 'A') return true;

    const scanResult = await this.scanLayer(userId, role, layer);
    const totalExpected = scanResult.totalExpected;
    
    if (totalExpected === 0) return false;

    const completion = (scanResult.answerFiles.length / totalExpected) * 100;
    return completion >= 100;
  }

  async scanAllAnswers(userId) {
    const roles = ['A', 'B', 'C'];
    const layers = ['basic', 'emotional'];
    const allAnswers = {};

    for (const role of roles) {
      allAnswers[role] = {};
      for (const layer of layers) {
        const scanResult = await this.scanLayer(userId, role, layer);
        allAnswers[role][layer] = scanResult;
      }
    }

    return allAnswers;
  }

  async processRole(userId, role, tracker, progressCallback) {
    const layers = ['basic', 'emotional'];

    for (const layer of layers) {
      await this.processLayer(userId, role, layer, tracker, progressCallback);
    }
  }

  async processLayer(userId, role, layer, tracker, progressCallback) {
    const scanResult = await this.scanLayer(userId, role, layer);
    const answerFiles = scanResult.answerFiles;

    if (answerFiles.length === 0) {
      return;
    }

    if (role === 'A') {
      const hasCompleteProgress = await this.checkProgress(userId, role, layer);
      if (!hasCompleteProgress) {
        return;
      }
    }

    const outputDir = this.getOutputDir(userId, role, layer);
    const inputDir = path.join(this.baseDir, userId, `${role}_sets`, layer);
    
    await this.ensureDirectory(outputDir);

    await this.compressBatch(answerFiles, inputDir, outputDir, role, layer, tracker, progressCallback);
  }

  async scanLayer(userId, role, layer) {
    const inputDir = path.join(
      this.baseDir,
      userId,
      `${role}_sets`,
      layer
    );

    let answerFiles = [];
    let totalExpected = 0;

    try {
      const files = await fs.readdir(inputDir);
      
      for (const file of files) {
        if (file.startsWith('question_') && file.endsWith('.json')) {
          const orderMatch = file.match(/question_(\d+)\.json/);
          if (orderMatch) {
            const order = parseInt(orderMatch[1]);
            answerFiles.push({ file, order });
            totalExpected = Math.max(totalExpected, order);
          }
        }
      }

      answerFiles.sort((a, b) => a.order - b.order);

      return { answerFiles, totalExpected };
    } catch (error) {
      return { answerFiles: [], totalExpected: 0 };
    }
  }

  async compressBatch(answerFiles, inputDir, outputDir, role, layer, tracker, progressCallback) {
    const batchSize = roleCardConfig.methodB.concurrentLimit;
    let useSequential = false;

    for (let i = 0; i < answerFiles.length; i += batchSize) {
      const batch = answerFiles.slice(i, i + batchSize);

      if (useSequential) {
        for (const { file } of batch) {
          await this.processSingleFile(file, inputDir, outputDir, role, layer, tracker, progressCallback);
        }
      } else {
        try {
          await Promise.all(
            batch.map(({ file }) => 
              this.processSingleFile(file, inputDir, outputDir, role, layer, tracker, progressCallback)
            )
          );
        } catch (error) {
          useSequential = true;
          for (const { file } of batch) {
            await this.processSingleFile(file, inputDir, outputDir, role, layer, tracker, progressCallback);
          }
        }
      }

      const progress = tracker.getProgress();
      const totalProcessed = Object.values(progress.stats).reduce((sum, stat) => sum + stat.total, 0);
      
      if (totalProcessed % 5 === 0 || totalProcessed === progress.total) {
        progressCallback('progress', {
          total: progress.total,
          processed: totalProcessed,
          success: progress.success,
          failed: progress.failed,
          percentage: Math.round((totalProcessed / progress.total) * 100)
        });
      }
    }
  }

  async processSingleFile(fileName, inputDir, outputDir, role, layer, tracker, progressCallback) {
    const answerFilePath = path.join(inputDir, fileName);

    const orderMatch = fileName.match(/question_(\d+)\.json/);
    if (!orderMatch) return;

    const order = orderMatch[1];
    const outputFilePath = path.join(outputDir, `question_${order}.txt`);
    const category = this.getCategory(role, layer);

    try {
      const data = await fs.readFile(answerFilePath, 'utf8');
      const jsonData = JSON.parse(data);
      
      const { question, significance, answer } = jsonData;

      if (!question || !answer) {
        throw new Error('Missing required fields');
      }

      const compressedText = await this.compressSingleQuestion(
        answerFilePath,
        outputFilePath,
        role,
        layer,
        tracker
      );

      await this.saveCompressedText(outputFilePath, compressedText);
      tracker.recordSuccess(category);
    } catch (error) {
      tracker.recordFailure(category);
      progressCallback('error', {
        question: path.basename(answerFilePath),
        role,
        layer,
        error: error.message
      });
    }
  }

  async compressSingleQuestion(answerFilePath, outputFilePath, role, layer, tracker) {
    const retryCount = roleCardConfig.methodB.retryCount;
    let lastError;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const data = await fs.readFile(answerFilePath, 'utf8');
        const jsonData = JSON.parse(data);
        
        const { question, significance, answer } = jsonData;
        return await this.compressContent(question, significance, answer);
      } catch (error) {
        lastError = error;
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError;
  }

  async compressContent(question, significance, answer) {
    const prompt = buildCompressPrompt(question, significance, answer);
    
    const response = await this.llm.invoke(prompt);
    return response.content.trim();
  }

  async saveCompressedText(filePath, compressedText) {
    await fs.writeFile(filePath, compressedText, 'utf8');
  }

  getOutputDir(userId, role, layer) {
    const roleMap = {
      'A': 'Aset',
      'B': 'Bset',
      'C': 'Cset'
    };

    const roleSetName = roleMap[role];
    
    return path.join(
      this.baseDir,
      userId,
      'rolecard',
      `${roleSetName}${userId}`,
      layer
    );
  }

  getCategory(role, layer) {
    const roleMap = {
      'A': 'Aset',
      'B': 'Bset',
      'C': 'Cset'
    };

    return `${roleMap[role]}_${layer}`;
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

export default RoleCardGeneratorB;
