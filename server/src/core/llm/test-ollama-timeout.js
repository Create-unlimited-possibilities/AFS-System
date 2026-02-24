#!/usr/bin/env node
/**
 * Test Ollama health check with configurable timeout
 */

// Set environment before importing
process.env.LLM_BACKEND = 'ollama';
process.env.OLLAMA_TIMEOUT = '30000';

import LLMClient from './client.js';

async function testOllamaTimeout() {
  console.log('Testing Ollama health check with configurable timeout...');
  console.log(`OLLAMA_TIMEOUT environment variable: ${process.env.OLLAMA_TIMEOUT}ms`);

  const client = new LLMClient('deepseek-r1:14b', {
    backend: 'ollama',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://modelserver:11434'
  });

  console.log('Client configuration:', client.getModelInfo());

  console.log('\nStarting health check...');
  const startTime = Date.now();

  try {
    const isHealthy = await client.healthCheck();
    const duration = Date.now() - startTime;

    console.log(`\nHealth Check Result: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Timeout used: ${process.env.OLLAMA_TIMEOUT}ms (30 seconds)`);

    if (!isHealthy && duration >= 25000) {
      console.log('\nNote: Health check took longer than expected but completed within timeout.');
      console.log('This is expected behavior for large models on shared GPU.');
    }

    process.exit(isHealthy ? 0 : 1);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\nHealth check failed after ${duration}ms:`, error.message);
    process.exit(1);
  }
}

testOllamaTimeout();
