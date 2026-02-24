/**
 * Initialize Admin System
 * Creates default permissions, admin role, and initial admin user
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../../roles/models/role.js';
import Permission from '../../roles/models/permission.js';
import User from '../../user/model.js';
import logger from '../../../core/utils/logger.js';

// Load environment variables
dotenv.config();

// Define all system permissions
const SYSTEM_PERMISSIONS = [
  // User management
  { name: 'user:view', description: '查看用户列表', category: 'user' },
  { name: 'user:create', description: '创建用户', category: 'user' },
  { name: 'user:update', description: '更新用户信息', category: 'user' },
  { name: 'user:delete', description: '删除用户', category: 'user' },

  // Role management
  { name: 'role:view', description: '查看角色列表', category: 'role' },
  { name: 'role:create', description: '创建角色', category: 'role' },
  { name: 'role:update', description: '更新角色', category: 'role' },
  { name: 'role:delete', description: '删除角色', category: 'role' },

  // Permission management
  { name: 'permission:view', description: '查看权限列表', category: 'role' },

  // System settings
  { name: 'system:view', description: '查看系统设置', category: 'system' },
  { name: 'system:update', description: '更新系统设置', category: 'system' },

  // Questionnaire management
  { name: 'questionnaire:view', description: '查看问卷', category: 'content' },
  { name: 'questionnaire:create', description: '创建问卷问题', category: 'content' },
  { name: 'questionnaire:update', description: '更新问卷问题', category: 'content' },
  { name: 'questionnaire:delete', description: '删除问卷问题', category: 'content' },

  // Memory management
  { name: 'memory:view', description: '查看用户记忆', category: 'content' },
  { name: 'memory:manage', description: '管理用户记忆', category: 'content' },

  // Invite code management
  { name: 'invitecode:view', description: '查看邀请码', category: 'system' },
  { name: 'invitecode:create', description: '创建邀请码', category: 'system' },
  { name: 'invitecode:delete', description: '删除邀请码', category: 'system' },

  // Content management
  { name: 'content:manage', description: '管理内容', category: 'content' },

  // Conversation management
  { name: 'conversation:view', description: '查看对话', category: 'content' },
];

/**
 * Initialize all system permissions
 */
export async function initializePermissions() {
  try {
    logger.info('[InitAdmin] Initializing permissions...');

    let createdCount = 0;
    let existingCount = 0;

    for (const permData of SYSTEM_PERMISSIONS) {
      const existing = await Permission.findOne({ name: permData.name });
      if (!existing) {
        await Permission.create(permData);
        createdCount++;
        logger.info(`[InitAdmin] Created permission: ${permData.name}`);
      } else {
        existingCount++;
      }
    }

    logger.info(`[InitAdmin] Permissions initialized: ${createdCount} created, ${existingCount} existing`);
    return await Permission.find({});
  } catch (error) {
    logger.error('[InitAdmin] Failed to initialize permissions:', error);
    throw error;
  }
}

/**
 * Initialize Admin Role with all permissions
 */
export async function initializeAdminRole() {
  try {
    // First ensure all permissions exist
    const allPermissions = await initializePermissions();

    // Check if admin role exists
    let adminRole = await Role.findOne({ name: 'admin' });

    if (!adminRole) {
      logger.info('[InitAdmin] Creating default admin role with all permissions');

      adminRole = await Role.create({
        name: 'admin',
        description: 'System administrator with full access',
        isAdmin: true,
        isSystem: true,
        permissions: allPermissions.map(p => p._id)
      });

      logger.info('[InitAdmin] Admin role created successfully with ' + allPermissions.length + ' permissions');
    } else {
      // Update existing admin role with all permissions
      adminRole.isAdmin = true;
      adminRole.permissions = allPermissions.map(p => p._id);
      await adminRole.save();
      logger.info('[InitAdmin] Updated admin role with ' + allPermissions.length + ' permissions');
    }

    return adminRole;
  } catch (error) {
    logger.error('[InitAdmin] Failed to initialize admin role:', error);
    throw error;
  }
}

/**
 * Create initial admin user
 */
export async function createAdminUser(email, password, name = 'Administrator') {
  try {
    // First ensure admin role exists with all permissions
    const adminRole = await initializeAdminRole();

    // Check if admin user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info('[InitAdmin] Admin user already exists:', email);
      // Update existing user's role to ensure they have admin role
      existingUser.role = adminRole._id;
      existingUser.isActive = true;
      await existingUser.save();
      logger.info('[InitAdmin] Updated existing admin user with admin role');
      return existingUser;
    }

    // Generate unique code for admin user
    const uniqueCode = await User.generateUniqueCode();
    logger.info('[InitAdmin] Generated unique code for admin user');

    // Create admin user
    const adminUser = await User.create({
      uniqueCode,
      email,
      password, // Will be hashed by pre-save hook
      name,
      role: adminRole._id,
      isActive: true
    });

    logger.info('[InitAdmin] Admin user created successfully:', email);
    return adminUser;
  } catch (error) {
    logger.error('[InitAdmin] Failed to create admin user:', error);
    throw error;
  }
}

/**
 * Full initialization - call this on server startup
 */
export async function initializeAdminSystem() {
  try {
    logger.info('[InitAdmin] Starting admin system initialization...');

    const adminRole = await initializeAdminRole();

    // Create default admin user from env variables if provided
    const defaultEmail = process.env.ADMIN_EMAIL;
    const defaultPassword = process.env.ADMIN_PASSWORD;

    if (defaultEmail && defaultPassword) {
      await createAdminUser(defaultEmail, defaultPassword, 'System Administrator');
    }

    logger.info('[InitAdmin] Admin system initialization completed');
    return adminRole;
  } catch (error) {
    logger.error('[InitAdmin] Admin system initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_EMAIL || 'admin@afs-system.com';
  const password = args[1] || process.env.ADMIN_PASSWORD || 'admin123456';
  const name = args[2] || 'System Administrator';

  // Connect to MongoDB first
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongoserver:27017/afs_db';

  console.log('[InitAdmin] Connecting to MongoDB...');
  console.log(`[InitAdmin] URI: ${MONGO_URI}`);

  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('[InitAdmin] MongoDB connected successfully');
      return initializeAdminRole();
    })
    .then(() => createAdminUser(email, password, name))
    .then(() => {
      console.log('\n========================================');
      console.log('Admin initialization completed successfully!');
      console.log('========================================');
      console.log(`Email:    ${email}`);
      console.log(`Password: ${password}`);
      console.log('========================================');
      console.log('All permissions have been assigned to admin role.');
      console.log('========================================\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[InitAdmin] Initialization failed:', error.message);
      process.exit(1);
    });
}
