import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  elderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'training', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  startedAt: Date,
  finishedAt: Date,
  modelName: String, // e.g. "afs_elder_LXM19980312F_v1"
  error: String
});

export default mongoose.model('TrainingJob', jobSchema);