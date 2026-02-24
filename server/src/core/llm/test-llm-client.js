#!/usr/bin/env node
/**
 * LLM Client Integration Test Script
 * Tests all available LLM backends and fallback mechanisms
 *
 * Usage: node test-llm-client.js
 */

import LLMClient from './client.js';
import EmbeddingService from '../storage/embedding.js';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  testPrompt: 'Hello, please respond with just "OK" and nothing else.',
  testEmbedding: 'Test embedding generation for LLM client verification.'
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(testName) {
  console.log(`\n${colors.yellow}Testing:${colors.reset} ${testName}`);
}

function logResult(passed, message) {
  const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
  console.log(`  [${status}] ${message}`);
}

async function testOllamaBackend() {
  logSection('Ollama Backend Test');

  try {
    const client = new LLMClient('deepseek-r1:14b', {
      backend: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://modelserver:11434',
      timeout: TEST_CONFIG.timeout
    });

    logTest('Ollama Model Information');
    const modelInfo = client.getModelInfo();
    logResult(true, `Model: ${modelInfo.model}, Backend: ${modelInfo.baseUrl}`);

    logTest('Ollama Health Check');
    const isHealthy = await client.healthCheck();
    logResult(isHealthy, isHealthy ? 'Ollama service is healthy' : 'Ollama health check failed');

    if (isHealthy) {
      logTest('Ollama Text Generation');
      const response = await client.generate(TEST_CONFIG.testPrompt, { maxTokens: 10 });
      logResult(true, `Generated response: "${response.trim().substring(0, 50)}..."`);
    }

    return isHealthy;
  } catch (error) {
    logResult(false, `Ollama test failed: ${error.message}`);
    return false;
  }
}

async function testDeepSeekBackend() {
  logSection('DeepSeek API Backend Test');

  if (!process.env.DEEPSEEK_API_KEY) {
    logResult(false, 'DEEPSEEK_API_KEY not set');
    return false;
  }

  try {
    const client = new LLMClient('deepseek-chat', {
      backend: 'deepseek',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      timeout: TEST_CONFIG.timeout
    });

    logTest('DeepSeek Model Information');
    const modelInfo = client.getModelInfo();
    logResult(true, `Model: ${modelInfo.model}, Backend: ${modelInfo.baseUrl}`);

    logTest('DeepSeek Health Check');
    const isHealthy = await client.healthCheck();
    logResult(isHealthy, isHealthy ? 'DeepSeek service is healthy' : 'DeepSeek health check failed');

    if (isHealthy) {
      logTest('DeepSeek Text Generation');
      const response = await client.generate(TEST_CONFIG.testPrompt, { maxTokens: 10 });
      logResult(true, `Generated response: "${response.trim().substring(0, 50)}..."`);
    }

    return isHealthy;
  } catch (error) {
    logResult(false, `DeepSeek test failed: ${error.message}`);
    return false;
  }
}

async function testOpenAIBackend() {
  logSection('OpenAI API Backend Test');

  if (!process.env.OPENAI_API_KEY) {
    logResult(false, 'OPENAI_API_KEY not set');
    return false;
  }

  try {
    const client = new LLMClient('gpt-4o-mini', {
      backend: 'openai',
      timeout: TEST_CONFIG.timeout
    });

    logTest('OpenAI Health Check');
    const isHealthy = await client.healthCheck();
    logResult(isHealthy, isHealthy ? 'OpenAI service is healthy' : 'OpenAI health check failed');

    return isHealthy;
  } catch (error) {
    logResult(false, `OpenAI test failed: ${error.message}`);
    return false;
  }
}

async function testEmbeddingServices() {
  logSection('Embedding Services Test');

  const results = {
    ollama: false,
    openai: false
  };

  // Test Ollama embeddings
  try {
    logTest('Ollama Embedding (bge-m3)');
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();

    const embedding = await embeddingService.embedQuery(TEST_CONFIG.testEmbedding);
    logResult(true, `Ollama embedding generated successfully. Dimension: ${embedding.length}`);
    results.ollama = true;
  } catch (error) {
    logResult(false, `Ollama embedding failed: ${error.message}`);
  }

  // Test OpenAI embeddings
  if (process.env.OPENAI_API_KEY) {
    try {
      logTest('OpenAI Embedding (text-embedding-3-small)');
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      const openaiEmbeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small'
      });

      const embedding = await openaiEmbeddings.embedQuery(TEST_CONFIG.testEmbedding);
      logResult(true, `OpenAI embedding generated successfully. Dimension: ${embedding.length}`);
      results.openai = true;
    } catch (error) {
      logResult(false, `OpenAI embedding failed: ${error.message}`);
    }
  } else {
    logResult(false, 'OpenAI embedding skipped (no API key)');
  }

  return results;
}

async function testFallbackMechanism() {
  logSection('Fallback Mechanism Test');

  logTest('Primary Backend (current configuration)');
  const primaryBackend = process.env.LLM_BACKEND || 'ollama';
  logResult(true, `Current LLM_BACKEND: ${primaryBackend}`);

  const availableBackends = [];
  const unavailableBackends = [];

  // Check each backend availability
  if (primaryBackend === 'ollama' || primaryBackend === 'deepseek') {
    try {
      const testClient = new LLMClient(undefined, { backend: primaryBackend, timeout: 5000 });
      const isHealthy = await testClient.healthCheck();
      if (isHealthy) {
        availableBackends.push(primaryBackend);
      } else {
        unavailableBackends.push(primaryBackend);
      }
    } catch (error) {
      unavailableBackends.push(primaryBackend);
    }
  }

  logTest('Available Backends');
  if (availableBackends.length > 0) {
    logResult(true, `Available: ${availableBackends.join(', ')}`);
  } else {
    logResult(false, 'No backends available');
  }

  if (unavailableBackends.length > 0) {
    logResult(false, `Unavailable: ${unavailableBackends.join(', ')}`);
  }

  return availableBackends.length > 0;
}

async function runAllTests() {
  log('AFS System LLM Client Integration Tests', 'cyan');
  log('Testing LLM and Embedding Services', 'blue');
  log(`Test started at: ${new Date().toISOString()}`, 'blue');

  const results = {
    ollama: await testOllamaBackend(),
    deepseek: await testDeepSeekBackend(),
    openai: await testOpenAIBackend(),
    embeddings: await testEmbeddingServices(),
    fallback: await testFallbackMechanism()
  };

  // Final summary
  logSection('Test Summary');

  const totalTests = 4;
  const passedTests = [
    results.ollama,
    results.deepseek,
    results.openai,
    results.fallback
  ].filter(r => r).length;

  log(`Ollama Backend: ${results.ollama ? 'PASS' : 'FAIL'}`, results.ollama ? 'green' : 'red');
  log(`DeepSeek Backend: ${results.deepseek ? 'PASS' : 'FAIL'}`, results.deepseek ? 'green' : 'red');
  log(`OpenAI Backend: ${results.openai ? 'PASS' : 'FAIL'}`, results.openai ? 'green' : 'red');
  log(`Embedding Services:`, 'blue');
  log(`  - Ollama (bge-m3): ${results.embeddings.ollama ? 'PASS' : 'FAIL'}`, results.embeddings.ollama ? 'green' : 'red');
  log(`  - OpenAI (text-embedding-3-small): ${results.embeddings.openai ? 'PASS' : 'FAIL'}`, results.embeddings.openai ? 'green' : 'red');
  log(`Fallback Mechanism: ${results.fallback ? 'PASS' : 'FAIL'}`, results.fallback ? 'green' : 'red');

  console.log('\n' + '='.repeat(60));
  log(`Tests Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Test completed at: ${new Date().toISOString()}`, 'blue');
  console.log('='.repeat(60) + '\n');

  return results;
}

// Run tests
runAllTests()
  .then(results => {
    const allPassed = results.ollama && results.deepseek && results.embeddings.ollama;
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
