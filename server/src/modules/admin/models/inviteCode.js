/**
 * InviteCode Model
 * Manages invitation codes for user registration
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';

const inviteCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 32,
    description: 'Unique invitation code'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    description: 'User who created the invite code'
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    description: 'User who used the invite code'
  },
  usedAt: {
    type: Date,
    description: 'Timestamp when the code was used'
  },
  expiresAt: {
    type: Date,
    description: 'Expiration date for the code'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether the code is active'
  },
  maxUses: {
    type: Number,
    default: 1,
    min: 1,
    description: 'Maximum number of times this code can be used'
  },
  useCount: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Number of times this code has been used'
  },
  description: {
    type: String,
    maxlength: 500,
    description: 'Purpose or description of the invite code'
  }
}, {
  timestamps: true
});

// Indexes
inviteCodeSchema.index({ code: 1 }, { unique: true });
inviteCodeSchema.index({ createdBy: 1, isActive: 1 });
inviteCodeSchema.index({ expiresAt: 1, isActive: 1 });
inviteCodeSchema.index({ usedBy: 1 });

// Virtual to check if code is expired
inviteCodeSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual to check if code is usable
inviteCodeSchema.virtual('isUsable').get(function() {
  return this.isActive &&
         !this.usedBy &&
         !this.isExpired &&
         (this.maxUses === null || this.useCount < this.maxUses);
});

// Pre-save middleware to update useCount
inviteCodeSchema.pre('save', function(next) {
  if (this.isModified('usedBy') && this.usedBy) {
    this.useCount = (this.useCount || 0) + 1;
    if (!this.usedAt) {
      this.usedAt = new Date();
    }
  }
  next();
});

// Static method: Generate a unique invite code
inviteCodeSchema.statics.generateCode = async function(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
  let code;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await this.findOne({ code });
    exists = !!existing;
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique code after ' + maxAttempts + ' attempts');
  }

  return code;
};

// Static method: Find active code
inviteCodeSchema.statics.findActiveCode = async function(code) {
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true
  });
};

// Static method: Validate code for use
inviteCodeSchema.statics.validateCode = async function(code) {
  const inviteCode = await this.findActiveCode(code);

  if (!inviteCode) {
    return { valid: false, reason: 'Code not found or inactive' };
  }

  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    return { valid: false, reason: 'Code has expired' };
  }

  if (inviteCode.usedBy) {
    return { valid: false, reason: 'Code has already been used' };
  }

  if (inviteCode.maxUses && inviteCode.useCount >= inviteCode.maxUses) {
    return { valid: false, reason: 'Code has reached maximum uses' };
  }

  return { valid: true, inviteCode };
};

// Static method: Mark code as used
inviteCodeSchema.statics.markAsUsed = async function(code, userId) {
  const inviteCode = await this.findOne({ code: code.toUpperCase() });

  if (!inviteCode) {
    throw new Error('Invite code not found');
  }

  if (inviteCode.usedBy) {
    throw new Error('Invite code has already been used');
  }

  inviteCode.usedBy = userId;
  inviteCode.usedAt = new Date();
  inviteCode.useCount = (inviteCode.useCount || 0) + 1;

  await inviteCode.save();
  return inviteCode;
};

// Static method: Clean up expired codes
inviteCodeSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      isActive: true
    },
    { isActive: false }
  );

  return {
    deactivated: result.modifiedCount
  };
};

// Instance method: Check if code is valid
inviteCodeSchema.methods.isValid = function() {
  return this.isActive &&
         !this.usedBy &&
         (!this.expiresAt || this.expiresAt > new Date()) &&
         (!this.maxUses || this.useCount < this.maxUses);
};

// Instance method: Deactivate code
inviteCodeSchema.methods.deactivate = async function() {
  this.isActive = false;
  return this.save();
};

export default mongoose.model('InviteCode', inviteCodeSchema);
