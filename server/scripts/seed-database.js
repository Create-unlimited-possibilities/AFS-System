#!/usr/bin/env node
/**
 * Database Seed Script
 * Seeds initial permissions, roles, and creates default admin invite codes
 *
 * Usage: node server/scripts/seed-database.js
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db';

// Import models
import User from '../src/modules/user/model.js';
import Role from '../src/modules/roles/models/role.js';
import Permission from '../src/modules/roles/models/permission.js';
import InviteCode from '../src/modules/admin/models/inviteCode.js';

// Seed data
const permissions = [
  // Admin permissions
  { name: 'admin:access', description: 'Access admin panel', category: 'system' },
  { name: 'invite-code:create', description: 'Create invitation codes', category: 'user' },
  { name: 'invite-code:view', description: 'View invitation codes', category: 'user' },
  { name: 'invite-code:delete', description: 'Delete invitation codes', category: 'user' },
  { name: 'invite-code:manage', description: 'Manage all invitation codes', category: 'user' },

  // Environment permissions
  { name: 'env:view', description: 'View environment configuration', category: 'system' },
  { name: 'env:update', description: 'Update environment configuration', category: 'system' },

  // Questionnaire permissions
  { name: 'questionnaire:create', description: 'Create questionnaire questions', category: 'content' },
  { name: 'questionnaire:update', description: 'Update questionnaire questions', category: 'content' },
  { name: 'questionnaire:delete', description: 'Delete questionnaire questions', category: 'content' },
  { name: 'questionnaire:view', description: 'View questionnaire data', category: 'content' },

  // Memory permissions
  { name: 'memory:view-all', description: 'View all user memories', category: 'content' },
  { name: 'memory:manage', description: 'Manage and moderate memories', category: 'content' },

  // Stats permissions
  { name: 'stats:view', description: 'View system statistics', category: 'system' },

  // User management permissions
  { name: 'user:create', description: 'Create new users', category: 'user' },
  { name: 'user:view', description: 'View user information', category: 'user' },
  { name: 'user:update', description: 'Update user information', category: 'user' },
  { name: 'user:delete', description: 'Delete users', category: 'user' },
  { name: 'user:manage', description: 'Full user management', category: 'user' },

  // Role management permissions
  { name: 'role:create', description: 'Create roles', category: 'role' },
  { name: 'role:view', description: 'View roles', category: 'role' },
  { name: 'role:update', description: 'Update roles', category: 'role' },
  { name: 'role:delete', description: 'Delete roles', category: 'role' },
  { name: 'role:assign', description: 'Assign roles to users', category: 'role' },

  // Chat permissions
  { name: 'chat:view-all', description: 'View all chat sessions', category: 'content' },
  { name: 'chat:moderate', description: 'Moderate chat sessions', category: 'content' }
];

const roleDefinitions = [
  {
    name: 'superadmin',
    description: 'Full system access with all permissions',
    isSystem: true,
    permissions: 'all' // Special flag to grant all permissions
  },
  {
    name: 'admin',
    description: 'Administrative access to manage users, content, and settings',
    isSystem: true,
    permissions: [
      'admin:access',
      'invite-code:create',
      'invite-code:view',
      'invite-code:delete',
      'invite-code:manage',
      'questionnaire:create',
      'questionnaire:update',
      'questionnaire:delete',
      'questionnaire:view',
      'memory:view-all',
      'memory:manage',
      'stats:view',
      'user:view',
      'user:update',
      'chat:view-all',
      'chat:moderate'
    ]
  },
  {
    name: 'moderator',
    description: 'Content moderation access',
    isSystem: true,
    permissions: [
      'questionnaire:view',
      'memory:view-all',
      'memory:manage',
      'stats:view',
      'user:view',
      'chat:view-all',
      'chat:moderate'
    ]
  },
  {
    name: 'user',
    description: 'Standard user with basic access',
    isSystem: true,
    permissions: []
  }
];

// Utility functions
function log(message, type = 'info') {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
  };

  const color = colors[type] || colors.reset;
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

async function seedPermissions() {
  log('Seeding permissions...', 'cyan');

  let created = 0;
  let updated = 0;

  for (const permData of permissions) {
    const existing = await Permission.findOne({ name: permData.name });

    if (existing) {
      // Update description if changed
      if (existing.description !== permData.description ||
          existing.category !== permData.category) {
        existing.description = permData.description;
        existing.category = permData.category;
        await existing.save();
        updated++;
        log(`Updated permission: ${permData.name}`, 'yellow');
      }
    } else {
      await Permission.create(permData);
      created++;
      log(`Created permission: ${permData.name}`, 'green');
    }
  }

  log(`Permissions seeded: ${created} created, ${updated} updated`, 'green');
  return { created, updated };
}

async function seedRoles() {
  log('Seeding roles...', 'cyan');

  let created = 0;
  let updated = 0;

  // Get all permissions
  const allPermissions = await Permission.find({});
  const permMap = new Map(allPermissions.map(p => [p.name, p._id]));

  for (const roleData of roleDefinitions) {
    const existing = await Role.findOne({ name: roleData.name });

    let permissionIds;

    if (roleData.permissions === 'all') {
      permissionIds = allPermissions.map(p => p._id);
    } else {
      permissionIds = roleData.permissions
        .map(name => permMap.get(name))
        .filter(id => id); // Filter out undefined
    }

    if (existing) {
      // Update permissions
      existing.permissions = permissionIds;
      existing.description = roleData.description;
      await existing.save();
      updated++;
      log(`Updated role: ${roleData.name} (${permissionIds.length} permissions)`, 'yellow');
    } else {
      await Role.create({
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
        permissions: permissionIds
      });
      created++;
      log(`Created role: ${roleData.name} (${permissionIds.length} permissions)`, 'green');
    }
  }

  log(`Roles seeded: ${created} created, ${updated} updated`, 'green');
  return { created, updated };
}

async function seedInviteCodes() {
  log('Seeding invite codes...', 'cyan');

  // Find or create superadmin user
  let superAdmin = await User.findOne({ email: 'admin@afs-system.com' });

  if (!superAdmin) {
    log('Creating default superadmin user...', 'yellow');
    const uniqueCode = await User.generateUniqueCode();
    superAdmin = await User.create({
      uniqueCode,
      email: 'admin@afs-system.com',
      password: 'Admin123!@#', // Should be changed on first login
      name: 'Super Admin',
      isActive: true
    });

    // Assign superadmin role
    const superAdminRole = await Role.findOne({ name: 'superadmin' });
    if (superAdminRole) {
      superAdmin.role = superAdminRole._id;
      await superAdmin.save();
    }

    log('Default superadmin user created (email: admin@afs-system.com, password: Admin123!@#)', 'green');
  }

  // Create some default invite codes
  const defaultCodes = [
    {
      description: 'Initial admin invite code',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    },
    {
      description: 'Beta tester access',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
    },
    {
      description: 'Early access code',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    }
  ];

  let created = 0;

  for (const codeData of defaultCodes) {
    const code = await InviteCode.generateCode();

    await InviteCode.create({
      code,
      createdBy: superAdmin._id,
      description: codeData.description,
      expiresAt: codeData.expiresAt,
      isActive: true,
      maxUses: 1
    });

    created++;
    log(`Created invite code: ${code} - ${codeData.description}`, 'green');
  }

  log(`Invite codes seeded: ${created} created`, 'green');
  return { created };
}

async function runSeeds() {
  log('Starting database seed...', 'cyan');
  log(`Connecting to MongoDB: ${MONGO_URI.replace(/:.*@/, ':****@')}`, 'blue');

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });

    log('Connected to MongoDB', 'green');

    const permResults = await seedPermissions();
    const roleResults = await seedRoles();
    const codeResults = await seedInviteCodes();

    log('\n=== Seed Summary ===', 'cyan');
    log(`Permissions: ${permResults.created} created, ${permResults.updated} updated`, 'blue');
    log(`Roles: ${roleResults.created} created, ${roleResults.updated} updated`, 'blue');
    log(`Invite Codes: ${codeResults.created} created`, 'blue');
    log('\nSeed completed successfully!', 'green');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    log(`Seed failed: ${error.message}`, 'red');
    console.error(error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run seeds
runSeeds();
