import path from 'path';
import { fileURLToPath } from 'url';

export default class AutoHookRegistry {
  // 模块路径映射：模型名称 -> 模块路径
  static MODEL_PATHS = {
    'User': '../../modules/user/model.js',
    'Answer': '../../modules/qa/models/answer.js',
    'AssistRelation': '../../modules/assist/model.js',
    'ChatSession': '../../modules/chat/model.js'
  };
  static syncQueueClass = null;

  constructor(syncQueue) {
    this.syncQueue = syncQueue;
    this.hookedModels = new Set();
  }

  async registerAll() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const hookPromises = [];

    for (const [modelName, relativePath] of Object.entries(AutoHookRegistry.MODEL_PATHS)) {
      const modelPath = path.join(__dirname, relativePath);
      hookPromises.push(this.registerHook(modelName, modelPath));
    }

    await Promise.all(hookPromises);
  }

  async registerHook(modelName, modelPath) {
    if (this.hookedModels.has(modelName)) {
      console.log(`Already hooked: ${modelName}`);
      return;
    }

    try {
      const mongoose = await import('mongoose');
      const Model = mongoose.default.model(modelName);

      if (!Model) {
        console.warn(`Model not found: ${modelName}, attempting to load from file...`);
        const ModelFromFile = await this.getModel(modelPath);
        this.registerHooksToModel(ModelFromFile, modelName);
        this.hookedModels.add(modelName);
        return;
      }

      this.registerHooksToModel(Model, modelName);
      this.hookedModels.add(modelName);
    } catch (err) {
      console.error(`Failed to hook ${modelName}:`, err.message);
    }
  }

  registerHooksToModel(Model, modelName) {
    Model.schema.post('save', function(doc) {
      const syncQueueClass = AutoHookRegistry.syncQueueClass;
      if (syncQueueClass?.instance) {
        syncQueueClass.instance.enqueue(
          modelName,
          doc._id.toString(),
          'save',
          doc
        );
      }
    });

    Model.schema.post('deleteOne', { query: true, document: false }, function() {
      const syncQueueClass = AutoHookRegistry.syncQueueClass;
      if (syncQueueClass?.instance) {
        const filter = this.getFilter();
        syncQueueClass.instance.enqueue(
          modelName,
          filter._id,
          'delete'
        );
      }
    });
  }

  async getModel(modelPath) {
    const fileUrl = `file:///${modelPath.replace(/\\/g, '/')}`;
    const module = await import(fileUrl);
    return module.default;
  }

  static async getSyncQueueClass() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const syncQueuePath = path.join(__dirname, '../storage/syncQueue.js');
    const fileUrl = `file:///${syncQueuePath.replace(/\\/g, '/')}`;
    const module = await import(fileUrl);
    return module.default;
  }

  static async initSyncQueueClass() {
    if (!AutoHookRegistry.syncQueueClass) {
      AutoHookRegistry.syncQueueClass = await AutoHookRegistry.getSyncQueueClass();
    }
    return AutoHookRegistry.syncQueueClass;
  }
}
