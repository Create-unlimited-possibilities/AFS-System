import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default class AutoHookRegistry {
  static TARGET_MODELS = ['User', 'Answer', 'AssistRelation', 'ChatSession'];
  static syncQueueClass = null;

  constructor(syncQueue) {
    this.syncQueue = syncQueue;
    this.hookedModels = new Set();
  }

  async registerAll() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const modelsDir = path.join(__dirname, '../models');

    const files = fs.readdirSync(modelsDir);
    const jsFiles = files.filter(file => 
      file.endsWith('.js') && !file.startsWith('.')
    );

    const hookPromises = [];

    jsFiles.forEach(file => {
      const modelName = path.basename(file, '.js');
      
      if (AutoHookRegistry.TARGET_MODELS.includes(modelName)) {
        const modelPath = path.join(modelsDir, file);
        hookPromises.push(this.registerHook(modelName, modelPath));
      }
    });

    await Promise.all(hookPromises);
  }

  async registerHook(modelName, modelPath) {
    if (this.hookedModels.has(modelName)) {
      console.log(`Already hooked: ${modelName}`);
      return;
    }

    try {
      const Model = await this.getModel(modelPath);
      
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

      this.hookedModels.add(modelName);
    } catch (err) {
      console.error(`Failed to hook ${modelName}:`, err.message);
    }
  }

  async getModel(modelPath) {
    const fileUrl = `file:///${modelPath.replace(/\\/g, '/')}`;
    const module = await import(fileUrl);
    return module.default;
  }

  static async getSyncQueueClass() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const syncQueuePath = path.join(__dirname, 'simpleSyncQueue.js');
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
