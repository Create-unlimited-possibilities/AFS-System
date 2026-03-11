#!/usr/bin/env node

/**
 * Migration Script: Generate Ziwei Charts for Existing Users
 *
 * This script generates ziwei natal charts for all existing users
 * who have complete birth data (gender + birthDate + birthHour).
 *
 * Usage:
 *   node server/scripts/migrateZiweiCharts.js [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  : Show what would be done without actually generating charts
 *   --force    : Re-generate charts even if they already exist
 *
 * @author AFS Team
 * @version 1.0.0
 */

import { fileURLToPath } from 'url';
import path from 'path';
import mongoose from 'mongoose';
import User from '../src/modules/user/model.js';
import ziweiChartService from '../src/modules/ziwei/services/ziweiChartService.js';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// MongoDB connection string
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/afs-system';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    force: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node server/scripts/migrateZiweiCharts.js [options]

Options:
  --dry-run  Show what would be done without actually generating charts
  --force    Re-generate charts even if they already exist
  --help, -h Show this help message

Examples:
  node server/scripts/migrateZiweiCharts.js              # Generate charts for all eligible users
  node server/scripts/migrateZiweiCharts.js --dry-run    # Preview what would be done
  node server/scripts/migrateZiweiCharts.js --force      # Re-generate all charts
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Find users eligible for ziwei chart generation
 */
async function findEligibleUsers(force = false) {
  const query = {
    'profile.gender': { $exists: true, $in: ['男', '女', 'male', 'female'] },
    'profile.birthDate': { $exists: true, $ne: null },
    'profile.birthHour': { $exists: true, $ne: null }
  };

  const users = await User.find(query)
    .select('_id uniqueCode name email profile')
    .lean();

  // Filter out users who already have charts (unless force is true)
  let eligibleUsers = users;
  if (!force) {
    const userIdsWithCharts = new Set();
    for (const user of users) {
      const hasChart = await ziweiChartService.hasChart(user._id);
      if (hasChart) {
        userIdsWithCharts.add(user._id.toString());
      }
    }
    eligibleUsers = users.filter(user => !userIdsWithCharts.has(user._id.toString()));
  }

  return eligibleUsers;
}

/**
 * Process users - generate or regenerate charts
 */
async function processUsers(users, force = false) {
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const user of users) {
    const { _id: userId, profile } = user;

    // Skip if profile incomplete
    if (!profile || !profile.gender || !profile.birthDate || profile.birthHour === undefined) {
      failed++;
      errors.push({
        userId,
        reason: 'Incomplete profile data'
      });
      continue;
    }

    try {
      if (force) {
        // Use regenerateChart to overwrite existing charts
        await ziweiChartService.regenerateChart(userId, profile);
        console.log(`  ✓ Regenerated chart for ${user.name}`);
      } else {
        // Use generateChart (will skip if exists)
        await ziweiChartService.generateChart(userId, profile);
        console.log(`  ✓ Generated chart for ${user.name}`);
      }
      success++;
    } catch (error) {
      failed++;
      errors.push({
        userId,
        reason: error.message
      });
      console.error(`  ✗ Failed for ${user.name}: ${error.message}`);
    }
  }

  return { total: users.length, success, failed, errors };
}

/**
 * Format user info for display
 */
function formatUserInfo(user) {
  return {
    id: user._id.toString(),
    uniqueCode: user.uniqueCode,
    name: user.name,
    email: user.email,
    gender: user.profile?.gender,
    birthDate: user.profile?.birthDate,
    birthHour: user.profile?.birthHour
  };
}

/**
 * Main migration function
 */
async function migrate() {
  const options = parseArgs();
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('Ziwei Chart Migration Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Force: ${options.force ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    // Find eligible users
    console.log('\nFinding eligible users...');
    const eligibleUsers = await findEligibleUsers(options.force);
    console.log(`Found ${eligibleUsers.length} eligible users`);

    if (eligibleUsers.length === 0) {
      console.log('\nNo users to process. Exiting.');
      await mongoose.disconnect();
      return;
    }

    // Show preview of users to process
    console.log('\nPreview of users to be processed:');
    console.log('-'.repeat(60));
    eligibleUsers.slice(0, 5).forEach(user => {
      console.log(`  - ${user.name} (${user.email})`);
      console.log(`    Gender: ${user.profile?.gender}, DOB: ${user.profile?.birthDate}, Hour: ${user.profile?.birthHour}`);
    });
    if (eligibleUsers.length > 5) {
      console.log(`  ... and ${eligibleUsers.length - 5} more`);
    }
    console.log('');

    if (options.dryRun) {
      console.log('DRY RUN: No charts will be generated');
      console.log('Run without --dry-run to actually generate charts');
      await mongoose.disconnect();
      return;
    }

    // Process users
    console.log('\nProcessing users...');
    console.log('-'.repeat(60));

    const result = await processUsers(eligibleUsers, options.force);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Results');
    console.log('='.repeat(60));
    console.log(`Total users:    ${result.total}`);
    console.log(`Successful:      ${result.success}`);
    console.log(`Failed:          ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => {
        console.log(`  - User ${err.userId}: ${err.reason}`);
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCompleted in ${duration} seconds`);

  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the migration
migrate();
