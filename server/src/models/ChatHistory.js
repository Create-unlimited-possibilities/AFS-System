// server/src/models/ChatHistory.js
import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [{
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  exportedForTraining: { type: Boolean, default: false }
}, { timestamps: true });

// 导出 JSONL 钩子（后续训练时调用）
chatSchema.methods.exportToJSONL = function () {
  return this.messages.map(msg => JSON.stringify({
    text: `<|${msg.role}|>${msg.content}<|eot_id|>`
  })).join('\n');
};

export default mongoose.model('ChatHistory', chatSchema);