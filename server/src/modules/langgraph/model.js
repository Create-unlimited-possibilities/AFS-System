/**
 * LangGraph Configuration Model
 * Stores flow node configurations for prompt and LLM settings
 */

import mongoose from 'mongoose';

const llmConfigSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['ollama', 'api'],
    default: 'ollama'
  },
  model: {
    type: String,
    default: 'deepseek-r1:14b'
  },
  apiProvider: {
    type: String,
    enum: ['deepseek', 'openai', null],
    default: null
  },
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 2
  },
  maxTokens: {
    type: Number,
    default: 500
  }
}, { _id: false });

const dynamicSourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' }
}, { _id: false });

const nodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  nodeType: {
    type: String,
    enum: ['start', 'process', 'condition', 'end'],
    default: 'process'
  },
  promptType: {
    type: String,
    enum: ['static', 'dynamic', 'none'],
    default: 'none'
  },
  staticPrompt: { type: String, default: '' },
  dynamicSources: [dynamicSourceSchema],
  editableSection: { type: String, default: '' },
  llmEnabled: { type: Boolean, default: false },
  llmConfig: { type: llmConfigSchema, default: () => ({}) },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
  label: { type: String, default: '' },
  conditionType: {
    type: String,
    enum: ['always', 'conditional'],
    default: 'always'
  }
}, { _id: false });

const langGraphConfigSchema = new mongoose.Schema({
  flowId: {
    type: String,
    required: true,
    unique: true,
    enum: ['rolecard', 'xiaoshudong']
  },
  flowName: { type: String, required: true },
  description: { type: String, default: '' },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default mongoose.model('LangGraphConfig', langGraphConfigSchema);
