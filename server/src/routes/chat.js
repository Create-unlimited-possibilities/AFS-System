// server/src/routes/chat.js —— 传家之宝专属对话核心
import express from 'express';
import { exec } from 'child_process';
import TrainingJob from '../models/TrainingJob.js';
import User from '../models/User.js';

const router = express.Router();

// POST /api/chat —— 核心对话接口（已训练好的专属模型）
router.post('/', async (req, res) => {
  try {
    const { code, message } = req.body;
    if (!code || !message) {
      return res.status(400).json({ error: '缺少 code 或 message' });
    }

    // 1. 查找该长者的最新训练任务
    const job = await TrainingJob.findOne({ code }).sort({ createdAt: -1 });
    if (!job || job.status !== 'completed') {
      return res.status(400).json({
        reply: '传家之宝还在学习您的故事，请稍候再来聊天',
        training: true
      });
    }

    // 2. 调用 Ollama 推理（使用专属模型 afs_{code}_v1）
    const modelName = `afs_${code}_v1`;
    const ollamaCmd = `ollama run ${modelName} <<EOF
你是一个温暖的传家之宝AI，用亲切、鼓励的语气陪伴老人。
用户说：${message}
请用不超过120字的温暖回复。
EOF`;

    exec(ollamaCmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error || stderr) {
        console.error('Ollama 推理失败:', stderr || error);
        return res.status(500).json({ reply: '我现在有点害羞，等会儿再来陪您聊天好吗？' });
      }

      const reply = stdout.trim() || '爷爷/奶奶，听到您的话我心里暖暖的';

      // 3. 记录对话历史（可选）
      User.updateOne({ code }, { $push: { chatHistory: { user: message, ai: reply, time: new Date() } } }).exec();

      res.json({ reply });
    });

  } catch (err) {
    console.error('聊天接口错误:', err);
    res.status(500).json({ reply: '传家之宝暂时走神了，请稍后再来' });
  }
});

export default router;