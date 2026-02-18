// server/src/core/utils/logger.js
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义格式：控制台输出
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, userId, requestId, ...meta }) => {
    const parts = [`[${timestamp}]`, `[${level}]`];
    if (module) parts.push(`[${module}]`);
    if (requestId) parts.push(`[${requestId.substring(0, 8)}]`);
    if (userId) parts.push(`[User:${userId.substring(0, 8)}]`);
    parts.push(message);
    if (Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }
    return parts.join(' ');
  })
);

// 自定义格式：文件输出
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 创建 logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'afs-system' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'debug.log'),
      level: 'debug'
    })
  ]
});

// ============ 模块专用日志器 ============
const createModuleLogger = (moduleName) => {
  return {
    info: (message, meta = {}) => logger.info(message, { ...meta, module: moduleName }),
    error: (message, meta = {}) => logger.error(message, { ...meta, module: moduleName }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, module: moduleName }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, module: moduleName }),
  };
};

// 预定义模块日志器
export const apiLogger = createModuleLogger('API');
export const authLogger = createModuleLogger('AUTH');
export const dbLogger = createModuleLogger('DB');
export const profileLogger = createModuleLogger('PROFILE');
export const rolecardLogger = createModuleLogger('ROLECARD');

// ============ HTTP 请求日志中间件 ============
export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.requestId = requestId;
  req.startTime = Date.now();

  // 记录请求
  apiLogger.info(`${req.method} ${req.originalUrl}`, {
    requestId,
    userId: req.user?._id,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  // 记录响应
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - req.startTime;
    apiLogger.info(`${req.method} ${req.originalUrl} → ${res.statusCode}`, {
      requestId,
      userId: req.user?._id,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    originalEnd.apply(res, args);
  };

  next();
};

// 生成请求 ID
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ============ 兼容旧版接口 ============
export const log = (msg, type = 'info') => {
  logger[type](msg);
};

// 旧版方法
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