// server/src/utils/logger.js
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建 logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'afs-system' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level}: ${message}`;
        })
      )
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    })
  ]
});

// 兼容旧版接口
export const log = (msg, type = 'info') => {
  logger[type](msg);
};

// 新增方法
logger.question = (message, meta) => {
  logger.info(message, { ...meta, type: 'question' });
};

logger.answer = (message, meta) => {
  logger.info(message, { ...meta, type: 'answer' });
};

logger.assist = (message, meta) => {
  logger.info(message, { ...meta, type: 'assist' });
};

logger.auth = (message, meta) => {
  logger.info(message, { ...meta, type: 'auth' });
};

export default logger;