/**
 * RecycleBin Model
 * Manages soft-deleted items with automatic expiration and restoration capabilities
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';

const recycleBinSchema = new mongoose.Schema({
  // Type of the deleted item
  itemType: {
    type: String,
    enum: ['questionnaire_answer', 'conversation_memory'],
    required: true,
    index: true,
    description: 'Type of the deleted item'
  },

  // Original ID of the item before deletion
  originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    description: 'Original ID of the deleted item'
  },

  // User who owns the deleted item
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    description: 'Owner of the deleted item'
  },

  // Target user (if applicable, e.g., for conversation memories about a specific user)
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Target user referenced in the deleted item'
  },

  // Partner user (e.g., for relationship-related items)
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'Partner user in a relationship context'
  },

  // User who performed the deletion
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    description: 'User who deleted the item'
  },

  // Timestamp when the item was deleted
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Timestamp of deletion'
  },

  // Expiration timestamp for automatic purging
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    description: 'When the item will be permanently purged'
  },

  // Snapshot of the original data for restoration
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    description: 'Complete data snapshot for restoration'
  },

  // Associated file paths to clean up on purge
  filePaths: {
    type: [String],
    default: [],
    description: 'File paths associated with the deleted item'
  },

  // Vector index IDs to clean up on purge
  vectorIndexIds: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'User ID for the vector index'
    },
    memoryId: {
      type: String,
      description: 'Memory ID for the vector index'
    }
  }],

  // Related entries (e.g., for batch operations)
  relatedEntries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecycleBin',
    description: 'Related recycle bin entries'
  }],

  // Current status of the recycle bin entry
  status: {
    type: String,
    enum: ['pending_purge', 'restored', 'purged'],
    default: 'pending_purge',
    index: true,
    description: 'Current status of the entry'
  },

  // User who restored the item
  restoredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    description: 'User who restored the item'
  },

  // Timestamp when the item was restored
  restoredAt: {
    type: Date,
    description: 'Timestamp of restoration'
  },

  // System or user who purged the item
  purgedBy: {
    type: String,
    description: 'Identifier of what/who purged the item'
  },

  // Timestamp when the item was permanently purged
  purgedAt: {
    type: Date,
    description: 'Timestamp of permanent deletion'
  }
}, {
  timestamps: true
});

// Indexes
recycleBinSchema.index({ itemType: 1, userId: 1 });
recycleBinSchema.index({ deletedAt: -1 });
recycleBinSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recycleBinSchema.index({ status: 1 });

// Virtual to check if entry is expired
recycleBinSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual to check if entry can be restored
recycleBinSchema.virtual('canRestore').get(function() {
  return this.status === 'pending_purge' && !this.isExpired;
});

// Virtual to check if entry is purged
recycleBinSchema.virtual('isPurged').get(function() {
  return this.status === 'purged';
});

// Virtual to check if entry is restored
recycleBinSchema.virtual('isRestored').get(function() {
  return this.status === 'restored';
});

// Pre-save middleware to update timestamps based on status
recycleBinSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'restored' && !this.restoredAt) {
      this.restoredAt = new Date();
    }
    if (this.status === 'purged' && !this.purgedAt) {
      this.purgedAt = new Date();
    }
  }
  next();
});

// Static method: Find entries by user
recycleBinSchema.statics.findByUser = function(userId, options = {}) {
  const { status = 'pending_purge', itemType } = options;
  const query = { userId };

  if (status) {
    query.status = status;
  }
  if (itemType) {
    query.itemType = itemType;
  }

  return this.find(query).sort({ deletedAt: -1 });
};

// Static method: Find expired entries
recycleBinSchema.statics.findExpired = function() {
  return this.find({
    status: 'pending_purge',
    expiresAt: { $lt: new Date() }
  });
};

// Static method: Find by original ID
recycleBinSchema.statics.findByOriginalId = function(itemType, originalId) {
  return this.findOne({
    itemType,
    originalId,
    status: 'pending_purge'
  });
};

// Static method: Mark as restored
recycleBinSchema.statics.markAsRestored = async function(entryId, restoredByUserId) {
  const entry = await this.findById(entryId);

  if (!entry) {
    throw new Error('Recycle bin entry not found');
  }

  if (entry.status !== 'pending_purge') {
    throw new Error('Cannot restore entry with status: ' + entry.status);
  }

  if (entry.isExpired) {
    throw new Error('Cannot restore expired entry');
  }

  entry.status = 'restored';
  entry.restoredBy = restoredByUserId;
  entry.restoredAt = new Date();

  await entry.save();
  return entry;
};

// Static method: Mark as purged
recycleBinSchema.statics.markAsPurged = async function(entryId, purgedBy = 'system') {
  const entry = await this.findById(entryId);

  if (!entry) {
    throw new Error('Recycle bin entry not found');
  }

  entry.status = 'purged';
  entry.purgedBy = purgedBy;
  entry.purgedAt = new Date();

  await entry.save();
  return entry;
};

// Static method: Clean up expired entries (for cron jobs)
recycleBinSchema.statics.cleanupExpired = async function() {
  const expiredEntries = await this.findExpired();

  const results = {
    processed: 0,
    failed: 0,
    errors: []
  };

  for (const entry of expiredEntries) {
    try {
      entry.status = 'purged';
      entry.purgedBy = 'system_cleanup';
      entry.purgedAt = new Date();
      await entry.save();
      results.processed++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        entryId: entry._id,
        error: error.message
      });
    }
  }

  return results;
};

// Static method: Get statistics
recycleBinSchema.statics.getStatistics = async function(userId = null) {
  const matchQuery = {};
  if (userId) {
    matchQuery.userId = userId;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pendingPurge: {
          $sum: { $cond: [{ $eq: ['$status', 'pending_purge'] }, 1, 0] }
        },
        restored: {
          $sum: { $cond: [{ $eq: ['$status', 'restored'] }, 1, 0] }
        },
        purged: {
          $sum: { $cond: [{ $eq: ['$status', 'purged'] }, 1, 0] }
        },
        byType: {
          $push: {
            itemType: '$itemType',
            status: '$status'
          }
        }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    pendingPurge: 0,
    restored: 0,
    purged: 0,
    byType: {}
  };

  // Count by type
  if (result.byType) {
    const typeCounts = {};
    ['questionnaire_answer', 'conversation_memory'].forEach(type => {
      typeCounts[type] = result.byType.filter(e => e.itemType === type).length;
    });
    result.byType = typeCounts;
  }

  return result;
};

// Instance method: Restore the entry
recycleBinSchema.methods.restore = async function(restoredByUserId) {
  if (this.status !== 'pending_purge') {
    throw new Error('Cannot restore entry with status: ' + this.status);
  }

  if (this.isExpired) {
    throw new Error('Cannot restore expired entry');
  }

  this.status = 'restored';
  this.restoredBy = restoredByUserId;
  this.restoredAt = new Date();

  await this.save();
  return this;
};

// Instance method: Purge the entry
recycleBinSchema.methods.purge = async function(purgedBy = 'system') {
  this.status = 'purged';
  this.purgedBy = purgedBy;
  this.purgedAt = new Date();

  await this.save();
  return this;
};

// Instance method: Extend expiration
recycleBinSchema.methods.extendExpiration = async function(days) {
  if (this.status !== 'pending_purge') {
    throw new Error('Cannot extend expiration for entry with status: ' + this.status);
  }

  const newExpiration = new Date();
  newExpiration.setDate(newExpiration.getDate() + days);
  this.expiresAt = newExpiration;

  await this.save();
  return this;
};

export default mongoose.model('RecycleBin', recycleBinSchema);
