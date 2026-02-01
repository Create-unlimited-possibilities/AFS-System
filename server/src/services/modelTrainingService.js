// 模型训练服务 - 管理 Mode 2/3 的模型训练
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class ModelTrainingService {
  constructor() {
    this.trainingJobs = new Map();
    this.trainingDir = path.join(process.cwd(), 'userdata');
    this.configsDir = path.join(process.cwd(), 'modelserver', 'configs');
  }

  // 创建 SFT 微调任务
  async createSFTTask(userId, datasetPath) {
    const taskId = `task_${Date.now()}_${userId}`;
    
    const task = {
      taskId,
      userId,
      mode: 'mode2',
      status: 'queued',
      datasetPath,
      createdAt: new Date().toISOString(),
      config: {
        baseModel: 'Qwen/Qwen2.5-7B-Instruct',
        outputModel: `/userdata/${userId}/models/custom_model.gguf`,
        epochs: 3,
        batchSize: 4,
        learningRate: 2e-4,
        loraRank: 8
      },
      result: null,
      error: null
    };

    this.trainingJobs.set(taskId, task);

    return task;
  }

  // 创建继续预训练任务
  async createCPTTask(userId, datasetPath) {
    const taskId = `cpt_${Date.now()}_${userId}`;

    const task = {
      taskId,
      userId,
      mode: 'mode3_cpt',
      status: 'queued',
      datasetPath,
      createdAt: new Date().toISOString(),
      config: {
        baseModel: 'Qwen/Qwen2.5-14B',
        outputModel: `/userdata/${userId}/models/cpt_model.gguf`,
        epochs: 1,
        batchSize: 2,
        learningRate: 1e-4
      },
      result: null,
      error: null
    };

    this.trainingJobs.set(taskId, task);

    return task;
  }

  // 启动训练（Python 脚本）
  async startTraining(taskId) {
    const task = this.trainingJobs.get(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.status = 'training';

    try {
      // 根据模式选择训练脚本
      const script = task.mode === 'mode2' ? 'train_lora.py' : 'continue_pretrain.py';
      const scriptPath = path.join(process.cwd(), 'modelserver', 'scripts', script);

      // 验证脚本存在
      await fs.access(scriptPath);

      // 准备配置参数
      const args = [
        '--task_id', taskId,
        '--dataset', task.datasetPath,
        '--output', task.config.outputModel,
        '--base_model', task.config.baseModel,
        '--epochs', String(task.config.epochs),
        '--batch_size', String(task.config.batchSize)
      ];

      // 启动子进程
      this.process = spawn('python', [scriptPath, ...args], {
        cwd: path.join(process.cwd(), 'modelserver'),
        stdio: 'pipe'
      });

      // 监听输出
      this.process.stdout.on('data', (data) => {
        console.log(`[Model Training ${taskId}] ${data}`);
      });

      this.process.stderr.on('data', (data) => {
        console.error(`[Model Training ${taskId}] ${data}`);
      });

      // 结束处理
      this.process.on('close', async (code) => {
        if (code === 0) {
          task.status = 'completed';
          task.result = { success: true, modelPath: task.config.outputModel };
        } else {
          task.status = 'failed';
          task.error = `训练失败，退出码：${code}`;
        }

        this.trainingJobs.set(taskId, task);
      });

      return { success: true, message: '训练已启动' };

    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
      this.trainingJobs.set(taskId, task);
      throw err;
    }
  }

  // 获取任务状态
  getTaskStatus(taskId) {
    const task = this.trainingJobs.get(taskId);
    if (!task) {
      return null;
    }

    return {
      taskId: task.taskId,
      status: task.status,
      userId: task.userId,
      mode: task.mode,
      createdAt: task.createdAt,
      result: task.result,
      error: task.error
    };
  }

  // 取消训练
  async cancelTraining(taskId) {
    const task = this.trainingJobs.get(taskId);
    if (!task || task.status !== 'training') {
      throw new Error('任务不存在或未在训练中');
    }

    if (this.process) {
      this.process.kill('SIGTERM');
      task.status = 'cancelled';
      this.trainingJobs.set(taskId, task);
    }

    return { success: true, message: '训练已取消' };
  }

  // 导出 GGUF 格式
  async exportGGUF(modelPath, outputPath) {
    const taskId = `export_${Date.now()}`;
    const scriptPath = path.join(process.cwd(), 'modelserver', 'scripts', 'export_gguf.py');

    try {
      await fs.access(scriptPath);

      this.process = spawn('python', [scriptPath, '--model', modelPath, '--output', outputPath], {
        stdio: 'pipe'
      });

      // 监听输出
      this.process.stdout.on('data', (data) => {
        console.log(`[Export GGUF] ${data}`);
      });

      return new Promise((resolve, reject) => {
        this.process.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`导出失败，退出码：${code}`));
          }
        });
      });

    } catch (err) {
      throw new Error(`导出 GGUF 失败: ${err.message}`);
    }
  }

  // 注册 Ollama 模型
  async registerOllamaModel(userId, modelPath, modelName) {
    try {
      // 使用 Ollama CLI 注册模型
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const process = spawn('ollama', ['create', modelName, '--from', modelPath]);
        
        process.stdout.on('data', (data) => {
          console.log(`[Ollama] ${data}`);
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true });
          } else {
            reject(new Error(`Ollama 注册失败，退出码：${code}`));
          }
        });
      });

    } catch (err) {
      throw new Error(`Ollama 注册失败: ${err.message}`);
    }
  }
}

export default ModelTrainingService;