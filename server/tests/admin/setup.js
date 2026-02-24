/**
 * Admin E2E Tests Setup
 * Real database connections for admin panel end-to-end testing
 *
 * @author AFS Testing Team
 * @version 1.0.0
 */

import { vi } from 'vitest';

// Add vitest to global scope
global.jest = vi;

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-admin-e2e';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018/afs_test';
process.env.ADMIN_INVITE_CODE = 'TEST-ADMIN-INVITE-CODE-12345';

// Console logging for tests (reduce noise)
const originalConsole = { ...console };

beforeAll(() => {
  // Reduce console output during tests
  console.log = vi.fn();
  console.info = vi.fn();
});

afterAll(() => {
  // Restore original console
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Export test utilities
export const testUtils = {
  /**
   * Create admin test user data
   */
  createAdminData: (suffix = '') => ({
    username: `testadmin${suffix}`,
    password: 'TestAdmin123!',
    email: `testadmin${suffix}@afs-system.com`,
    inviteCode: process.env.ADMIN_INVITE_CODE
  }),

  /**
   * Create regular test user data
   */
  createUserData: (suffix = '') => ({
    username: `testuser${suffix}`,
    password: 'TestUser123!',
    email: `testuser${suffix}@afs-system.com`,
    uniqueCode: `TEST${suffix}123456789012`
  }),

  /**
   * Wait for async operations
   */
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random string
   */
  randomString: (length = 8) => {
    return Math.random().toString(36).substring(2, 2 + length);
  }
};
