import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['user', 'role', 'system', 'content', 'other'],
    default: 'other'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Permission', permissionSchema);
