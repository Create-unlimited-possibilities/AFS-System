import lockfile from 'proper-lockfile';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_DIR = path.join(__dirname, '../../.locks');
const RETRY_COUNT = 1;
const STALE_TIMEOUT = 5000;

function ensureLockDir() {
  if (!fs.existsSync(LOCK_DIR)) {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  }
}

function getLockKey(filePath) {
  const relativePath = path.relative(path.join(__dirname, '../..'), filePath);
  return path.normalize(relativePath).replace(/[^a-z0-9]/gi, '_');
}

/**
 * Acquires a file lock for the specified file path
 * @param {string} filePath - Path to the file to lock
 * @returns {Promise<Function>} Release function that should be called when done
 */
async function acquireLock(filePath) {
  ensureLockDir();
  const lockKey = getLockKey(filePath);
  const lockPath = path.join(LOCK_DIR, `${lockKey}.lock`);
  
  try {
    const release = await lockfile.lock(lockPath, { retries: RETRY_COUNT, stale: STALE_TIMEOUT, realpath: false });
    return release;
  } catch (err) {
    throw new Error(`Failed to acquire lock for ${filePath}: ${err.message}`);
  }
}

export { acquireLock };
