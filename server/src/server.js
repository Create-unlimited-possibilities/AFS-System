import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';

import translateRouter from './routes/translate.js';
import authRouter from './routes/auth.js';
import answersRouter from './routes/answers.js';
import chatRouter from './routes/chat.js';
import trainRouter from './routes/train.js';
import chatbetaRouter from './routes/chatbeta.js';
import { protect } from './middleware/auth.js';


dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

global.io = io;

io.on('connection', (socket) => {
  console.log('WebSocket 客户端已连接:', socket.id);
  socket.on('join-elder-room', (elderCode) => {
    socket.join(`elder_${elderCode}`);
    console.log(`用户 ${elderCode} 加入房间`);
  });
  socket.on('disconnect', () => {
    console.log('客户端断开:', socket.id);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB 已连接'))
  .catch(err => console.error('MongoDB 连接失败:', err));


app.use('/api', translateRouter);

// Auth routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api', protect, answersRouter);
app.use('/api/chat', protect, chatRouter);
app.use('/api/train', protect, trainRouter);
app.use('/api/chatbeta', protect, chatbetaRouter);


app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AFS Backend',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`后端运行中 → http://localhost:${PORT}`);
  console.log(`WebSocket 已就绪 (训练进度实时推送)`);
});
