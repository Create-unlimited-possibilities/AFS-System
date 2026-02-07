import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRouter from './routes/auth/index.js';
import answersRouter from './routes/answers.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import settingsRouter from './routes/settings.js';
import questionsRouter from './routes/questions.js';
import companionshipRouter from './routes/companionship.js';
import { protect } from './middleware/auth.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB 已连接'))
  .catch(err => console.error('MongoDB 连接失败:', err));

app.use('/api/auth', authRouter);

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
app.use('/api/companionship', companionshipRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`后端运行中 → http://localhost:${PORT}`);
});
