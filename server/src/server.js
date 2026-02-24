import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Memory scheduler
import { getScheduler } from './modules/memory/Scheduler.js';

// Admin system initialization
import { initializeAdminSystem } from './modules/admin/scripts/initAdmin.js';

// Module routes
import authRouter from './modules/auth/route.js';
import usersRouter from './modules/user/route.js';
import rolesRouter from './modules/roles/route.js';
import settingsRouter from './modules/settings/route.js';
import answersRouter from './modules/qa/routes/answers.js';
import questionsRouter from './modules/qa/routes/questions.js';
import chatRouter from './modules/chat/route.js';
import rolecardRouter from './modules/rolecard/route.js';
import sentimentRouter from './modules/sentiment/route.js';
import { regionsRouter } from './modules/common/china-regions/index.js';
import memoryRouter from './modules/memory/route.js';
import adminRouter from './modules/admin/route.js';
import adminAuthRouter from './modules/admin/authRoute.js';

// Auth middleware
import { protect } from './modules/auth/middleware.js';

// Logging
import logger, { requestLogger, apiLogger } from './core/utils/logger.js';

// Core services
import AutoHookRegistry from './core/hooks/registry.js';
import SimpleSyncQueue from './core/storage/syncQueue.js';
import dualStorage from './core/storage/dual.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use(requestLogger);

mongoose.connect(process.env.MONGO_URI)
  .catch(err => logger.error('MongoDB 连接失败:', { error: err.message }));

mongoose.connection.once('open', async () => {
  logger.info('MongoDB 已连接');

  // Initialize admin system (permissions, roles, default admin)
  try {
    await initializeAdminSystem();
    logger.info('Admin system initialized');
  } catch (error) {
    logger.warn('Admin system initialization skipped:', error.message);
  }

  const syncQueue = new SimpleSyncQueue(dualStorage);
  SimpleSyncQueue.instance = syncQueue;

  AutoHookRegistry.syncQueueClass = SimpleSyncQueue;

  const hookRegistry = new AutoHookRegistry(syncQueue);
  await hookRegistry.registerAll();

  logger.info('自动挂钩已注册');
});

app.use('/api/auth', authRouter);
app.use('/api/regions', regionsRouter);  // 中国行政区划（公开访问）

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AFS Backend',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', protect, answersRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/questions', protect, questionsRouter);
app.use('/api/chat', protect, chatRouter);
app.use('/api/rolecard', protect, rolecardRouter);
app.use('/api/sentiment', protect, sentimentRouter);
app.use('/api/memory', memoryRouter);
app.use('/admin-auth', adminAuthRouter);  // Public admin auth routes - completely separate path
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`后端运行中 → http://localhost:${PORT}`);

  // Start memory compression scheduler
  const scheduler = getScheduler();
  scheduler.start();
  logger.info('Memory compression scheduler started', {
    nextRunTime: scheduler.getStatus().nextRunTime
  });
});
