// server/src/routes/train.js —— 最终修正版（2025-12-11）
import express from 'express';
import TrainingJob from '../models/TrainingJob.js';

const router = express.Router();

// POST /api/train/progress —— 接收 train-adapter.sh 的进度推送
router.post('/progress', async (req, res) => {
  try {
    const { code, progress, msg } = req.body;

    // 1. 更新数据库中的训练任务状态
    const job = await TrainingJob.findOne({ code }).sort({ createdAt: -1 });
    if (job) {
      job.progress = progress || job.progress;
      if (msg) job.status = msg.includes('完成') || msg.includes('就绪') ? 'completed' : 'training';
      await job.save();
    }

    // 2. 关键修改：房间名要和 server.js + 前端保持一致！
    // 我们之前在 server.js 中定义的是 `elder_${code}`，这里必须统一
    const roomName = `elder_${code}`;

    // 3. 推送方式优化：优先精准推送给该长者的房间，fallback 全局广播
    if (global.io) {
      global.io.to(roomName).emit('training-progress', {
        code,
        progress: progress || 0,
        msg: msg || `训练中...${progress}%`
      });

      // 如果有人没进房间（保险起见），再全局广播一次
      global.io.emit('training-progress', { code, progress, msg });
    }

    res.json({ success: true, msg: '进度已更新并推送' });
  } catch (err) {
    console.error('训练进度更新失败:', err);
    res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

export default router;
