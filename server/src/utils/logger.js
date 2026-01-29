// server/src/utils/logger.js
export const log = (msg, type = 'info') => {
  const timestamp = new Date().toISOString();
  const colors = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
  console.log(`${colors[type] || ''}[${timestamp}] ${msg}\x1b[0m`);
};