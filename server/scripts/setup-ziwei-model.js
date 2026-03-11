#!/usr/bin/env node

/**
 * Setup script for registering the ziwei-8b model in Ollama
 *
 * This script:
 * 1. Checks if Ollama is running
 * 2. Checks if the GGUF model file exists
 * 3. Creates the ziwei-8b model in Ollama using the modelfile
 */

import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const OLLAMA_API_URL = 'http://localhost:11434';
// GGUF模型文件路径（modelserver容器目录，转换为绝对路径）
const GGUF_MODEL_PATH = resolve(join(__dirname, '../../modelserver/models/gguf/DeepSeek-R1-0528-Qwen3-8B-checkpoint-2745_q5_k_m.gguf'));
const MODELFILE_TEMPLATE_PATH = join(__dirname, '../../modelserver/models/gguf/ziwei-8b.modelfile');
const MODEL_NAME = 'ziwei-8b';

// System prompt for the model
const SYSTEM_PROMPT = `你是一位专业的紫微斗数命理分析师。根据用户的命盘信息，提供专业、详细、有深度的命理分析报告。分析时请遵循以下原则：1) 专业性：基于传统紫微斗数理论，准确解读各宫位、星曜的含义；2) 通俗易懂：用平实的语言解释命理概念；3) 深度分析：不仅描述现象，更要分析背后的命理逻辑和人生启示；4) 积极引导：以建设性的态度提供建议；5) 结构清晰：按照命盘分析、运势解读、建议的顺序组织回答。请根据用户的命盘信息和问题，提供有针对性的命理分析。`;

// Model parameters
const MODEL_PARAMS = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  num_ctx: 4096,
  repeat_penalty: 1.1,
  num_predict: 2048
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}${colors.bright}[${step}] ${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}${colors.bright}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}${colors.bright}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}${colors.bright}⚠ ${message}${colors.reset}`);
}

/**
 * Check if Ollama is running by pinging the API
 */
async function checkOllamaRunning() {
  logStep('1/4', 'Checking if Ollama is running...');

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    if (response.ok) {
      logSuccess('Ollama is running');
      return true;
    }
    logError('Ollama API responded with an error');
    return false;
  } catch (error) {
    logError('Ollama is not running or not accessible');
    log('\nPlease ensure Ollama is installed and running:');
    log('  - Download from: https://ollama.com/download');
    log('  - Start Ollama application or run: ollama serve');
    return false;
  }
}

/**
 * Check if the GGUF model file exists
 */
async function checkModelFileExists() {
  logStep('2/4', 'Checking if GGUF model file exists...');

  if (existsSync(GGUF_MODEL_PATH)) {
    const { size } = await import('fs/promises').then(fs => fs.stat(GGUF_MODEL_PATH));
    const sizeGB = (size / (1024 ** 3)).toFixed(2);
    logSuccess(`Model file found (${sizeGB} GB)`);
    log(`    Path: ${GGUF_MODEL_PATH}`);
    return true;
  }

  logError('GGUF model file not found');
  log(`\nExpected path: ${GGUF_MODEL_PATH}`);
  log('\nPlease ensure the model file is downloaded and placed at the correct location.');
  return false;
}

/**
 * Check if the modelfile template exists
 */
async function checkModelfileExists() {
  logStep('3/4', 'Checking if Modelfile template exists...');

  if (existsSync(MODELFILE_TEMPLATE_PATH)) {
    logSuccess('Modelfile template found');
    log(`    Path: ${MODELFILE_TEMPLATE_PATH}`);
    return true;
  }

  logError('Modelfile template not found');
  log(`\nExpected path: ${MODELFILE_TEMPLATE_PATH}`);
  return false;
}

/**
 * Generate a dynamic modelfile with absolute path
 */
function generateModelfile() {
  let modelfile = `# Ollama Modelfile for ziwei-8b\n`;
  modelfile += `# Auto-generated with absolute path\n`;
  modelfile += `FROM ${GGUF_MODEL_PATH}\n\n`;

  // Add parameters
  for (const [key, value] of Object.entries(MODEL_PARAMS)) {
    modelfile += `PARAMETER ${key} ${value}\n`;
  }

  // Add system prompt
  modelfile += `\nSYSTEM ${SYSTEM_PROMPT}\n`;

  return modelfile;
}

/**
 * Check if model already exists in Ollama
 */
async function checkModelExists() {
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      return data.models.some(m => m.model.startsWith(MODEL_NAME));
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Create the model in Ollama
 */
async function createModel() {
  logStep('4/4', 'Creating ziwei-8b model in Ollama...');

  const existing = await checkModelExists();
  if (existing) {
    logWarning(`Model "${MODEL_NAME}" already exists in Ollama`);
    const answer = await promptUser('\nDo you want to recreate the model? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      log('Model creation skipped.');
      return true;
    }
    log('\nRecreating model...');
  }

  // Generate dynamic modelfile with absolute path
  const tempModelfilePath = join(__dirname, '../config/ziwei-8b.modelfile.tmp');
  try {
    const modelfileContent = generateModelfile();
    writeFileSync(tempModelfilePath, modelfileContent, 'utf-8');
    log(`    Generated modelfile with absolute path`);
    log(`    Model path: ${GGUF_MODEL_PATH}`);
  } catch (error) {
    logError(`Failed to generate modelfile: ${error.message}`);
    return false;
  }

  try {
    const { stdout, stderr } = await execAsync(`ollama create ${MODEL_NAME} -f "${tempModelfilePath}"`, {
      cwd: join(__dirname, '..'),
    });

    if (stderr && !stderr.includes('success')) {
      // Ollama outputs progress to stderr
      process.stdout.write('.');
    }

    // Clean up temporary modelfile
    try {
      unlinkSync(tempModelfilePath);
    } catch (e) {
      // Ignore cleanup errors
    }

    logSuccess(`Model "${MODEL_NAME}" created successfully!`);
    return true;
  } catch (error) {
    // Clean up temporary modelfile on error
    try {
      unlinkSync(tempModelfilePath);
    } catch (e) {
      // Ignore cleanup errors
    }
    logError(`Failed to create model: ${error.message}`);
    return false;
  }
}

/**
 * Verify the model was created successfully
 */
async function verifyModel() {
  log('\n' + '='.repeat(50));
  logStep('Verification', 'Checking if model is available...');

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      const model = data.models.find(m => m.model.startsWith(MODEL_NAME));
      if (model) {
        logSuccess('Model verified in Ollama');
        log(`\nModel details:`);
        log(`  Name: ${model.name}`);
        log(`  Size: ${(model.size / (1024 ** 3)).toFixed(2)} GB`);
        log(`  Modified: ${new Date(model.modified_at).toLocaleString()}`);
        return true;
      }
    }
    logError('Model not found in Ollama after creation');
    return false;
  } catch (error) {
    logError(`Verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Simple prompt for user input (Node.js built-in)
 */
async function promptUser(question) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  log('\n' + '='.repeat(50));
  log('Ziwei-8B Model Setup Script', 'bright');
  log('='.repeat(50));

  const checks = [
    await checkOllamaRunning(),
    await checkModelFileExists(),
    await checkModelfileExists(),
  ];

  if (checks.every(v => v)) {
    const created = await createModel();
    if (created) {
      await verifyModel();
      log('\n' + '='.repeat(50));
      logSuccess('Setup completed successfully!');
      log('\nYou can now use the ziwei-8b model:');
      log(`  ollama run ${MODEL_NAME}`);
      log('  npm run dev');
      log('='.repeat(50) + '\n');
    } else {
      log('\n' + '='.repeat(50));
      logError('Setup failed!');
      log('='.repeat(50) + '\n');
      process.exit(1);
    }
  } else {
    log('\n' + '='.repeat(50));
    logError('Setup aborted due to errors above');
    log('='.repeat(50) + '\n');
    process.exit(1);
  }
}

main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
