/**
 * ActivityLog Model
 * Manages activity logs for admin auditing and monitoring
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  operation: {
    type: String,
    required: true,
    description: 'The operation performed (e.g., create, update, delete, login, logout)'
  },
  category: {
    type: String,
    enum: ['user', 'memory', 'questionnaire', 'system', 'role'],
    required: true,
    index: true,
    description: 'Category of the operation'
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    description: 'ID of the user who performed the action'
  },
  actorName: {
    type: String,
    description: 'Name of the user who performed the action'
  },
  targetType: {
    type: String,
    description: 'Type of the target entity'
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    description: 'ID of the target entity'
  },
  targetName: {
    type: String,
    description: 'Name/identifier of the target entity'
  },
  description: {
    type: String,
    description: 'Human-readable description of the action'
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Additional details about the operation'
  },
  ipAddress: {
    type: String,
    description: 'IP address of the request'
  },
  userAgent: {
    type: String,
    description: 'User agent string of the request'
  },
  success: {
    type: Boolean,
    default: true,
    description: 'Whether the operation was successful'
  },
  errorMessage: {
    type: String,
    description: 'Error message if operation failed'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Timestamp when the action occurred'
  }
}, {
  timestamps: false // We only use createdAt, not updatedAt
});

// Compound indexes for common queries
activityLogSchema.index({ category: 1, operation: 1 });
activityLogSchema.index({ actorId: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ success: 1, createdAt: -1 });

// Static method: Create a new activity log
activityLogSchema.statics.logActivity = async function(data) {
  return this.create(data);
};

// Static method: Get logs by category
activityLogSchema.statics.getByCategory = function(category, options = {}) {
  const query = { category };
  if (options.limit) {
    return this.find(query).sort({ createdAt: -1 }).limit(options.limit).populate('actorId', 'email name');
  }
  return this.find(query).sort({ createdAt: -1 }).populate('actorId', 'email name');
};

// Static method: Get logs by actor
activityLogSchema.statics.getByActor = function(actorId, options = {}) {
  const query = { actorId };
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
  }
  if (options.limit) {
    return this.find(query).sort({ createdAt: -1 }).limit(options.limit);
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method: Get failed operations
activityLogSchema.statics.getFailedLogs = function(options = {}) {
  const query = { success: false };
  if (options.category) {
    query.category = options.category;
  }
  if (options.limit) {
    return this.find(query).sort({ createdAt: -1 }).limit(options.limit);
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method: Clean up old logs
activityLogSchema.statics.cleanupOldLogs = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate }
  });

  return {
    deletedCount: result.deletedCount
  };
};

// Instance method: Get summary
activityLogSchema.methods.getSummary = function() {
  return {
    id: this._id,
    operation: this.operation,
    category: this.category,
    actor: this.actorName || this.actorId,
    target: this.targetName || this.targetId,
    description: this.description,
    success: this.success,
    timestamp: this.createdAt
  };
};

export default mongoose.model('ActivityLog', activityLogSchema);
