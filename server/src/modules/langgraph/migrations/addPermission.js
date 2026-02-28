/**
 * LangGraph Permission Migration
 * Ensures langgraph:edit permission exists
 */

import Permission from '../../roles/models/permission.js';
import logger from '../../../core/utils/logger.js';

const migrationLogger = {
  info: (msg, meta = {}) => logger.info(msg, { ...meta, module: 'LANGGRAPH_MIGRATION' }),
  error: (msg, meta = {}) => logger.error(msg, { ...meta, module: 'LANGGRAPH_MIGRATION' }),
};

export async function ensureLangGraphPermission() {
  try {
    const existing = await Permission.findOne({ name: 'langgraph:edit' });

    if (existing) {
      migrationLogger.info('langgraph:edit permission already exists');
      return existing;
    }

    const permission = await Permission.create({
      name: 'langgraph:edit',
      description: '编辑 LangGraph 流程配置',
      category: 'system'
    });

    migrationLogger.info('Created langgraph:edit permission');
    return permission;
  } catch (error) {
    migrationLogger.error('Failed to create langgraph:edit permission:', { error: error.message });
    throw error;
  }
}

export default ensureLangGraphPermission;
