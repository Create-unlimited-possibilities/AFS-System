import mongoose from 'mongoose';

/**
 * UnreadMessage Model
 *
 * Stores pending/unread messages when the role card is forced offline
 * during memory indexing (70% token threshold scenario).
 *
 * Flow:
 * 1. When token count reaches 70%, role card goes offline for memory indexing
 * 2. Incoming messages are stored as UnreadMessage with status 'pending'
 * 3. After indexing completes, status changes to 'indexed'
 * 4. When messages are delivered/shown to user, status changes to 'processed'
 */

const unreadMessageSchema = new mongoose.Schema({
  // Session identifier - links to ChatSession
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // Target user (the role card owner who is offline for indexing)
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The user who sent the message
  interlocutorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The message content
  content: {
    type: String,
    required: true
  },

  // When the message was originally sent
  timestamp: {
    type: Date,
    default: Date.now
  },

  // Message processing status
  status: {
    type: String,
    enum: ['pending', 'indexed', 'processed'],
    default: 'pending'
  },

  // When memory indexing completed for this message
  indexedAt: {
    type: Date
  }
});

// Compound indexes for efficient querying
// Find all pending messages for a target user
unreadMessageSchema.index({ targetUserId: 1, status: 1 });

// Find messages within a session, ordered by time
unreadMessageSchema.index({ sessionId: 1, timestamp: 1 });

// Find pending messages for a specific session
unreadMessageSchema.index({ sessionId: 1, status: 1 });

/**
 * Static method: Get all pending messages for a user
 * @param {ObjectId} targetUserId - The role card owner's user ID
 * @returns {Promise<Array>} - Array of pending messages
 */
unreadMessageSchema.statics.getPendingMessages = async function(targetUserId) {
  return this.find({
    targetUserId,
    status: 'pending'
  }).sort({ timestamp: 1 }).populate('interlocutorUserId', 'name uniqueCode');
};

/**
 * Static method: Mark messages as indexed
 * @param {Array<String>} messageIds - Array of message IDs to update
 * @returns {Promise<Object>} - Update result
 */
unreadMessageSchema.statics.markAsIndexed = async function(messageIds) {
  return this.updateMany(
    { _id: { $in: messageIds } },
    {
      status: 'indexed',
      indexedAt: new Date()
    }
  );
};

/**
 * Static method: Create a new pending message
 * @param {Object} data - Message data
 * @returns {Promise<Object>} - Created message
 */
unreadMessageSchema.statics.createPending = async function(data) {
  return this.create({
    sessionId: data.sessionId,
    targetUserId: data.targetUserId,
    interlocutorUserId: data.interlocutorUserId,
    content: data.content,
    status: 'pending'
  });
};

export default mongoose.model('UnreadMessage', unreadMessageSchema);
