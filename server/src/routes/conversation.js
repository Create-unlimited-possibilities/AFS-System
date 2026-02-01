// 简化的 conversation 路由占位符
// 旧 RAG 模块的对话接口已被集成到 Chat-Beta

import express from 'express';

const router = express.Router();

// 老的对话接口（已集成到 Chat-Beta）
// 保留此路由以保持向后兼容，但功能已迁移到 chatbeta.js

router.get('/conversation/elder/:code', async (req, res) => {
  try {
    const { code } = req.params;
    res.json({
      success: true,
      message: '对话功能已迁移到 /api/chatbeta',
      redirect: '/chatbeta.html',
      code
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/conversation/elder/:code/chat', async (req, res) => {
  res.json({
    success: true,
    message: '此接口已弃用，请使用 /api/chatbeta 聊天接口'
  });
});

export default router;