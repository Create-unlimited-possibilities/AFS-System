import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['elder', 'family', 'friend'],
    required: true,
    index: true
  },
  layer: { 
    type: String, 
    enum: ['basic', 'emotional'], 
    required: true,
    index: true
  },
  order: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  question: {
    type: String,
    required: true
  },
  significance: {
    type: String,
    default: '',
    description: '问题的意义说明，用于角色卡生成（最大200字）'
  },
  placeholder: {
    type: String,
    default: ''
  },
  type: { 
    type: String, 
    enum: ['text', 'textarea', 'voice'], 
    default: 'textarea' 
  },
  active: { 
    type: Boolean, 
    default: true 
  }
});

// 索引
questionSchema.index({ role: 1, layer: 1, order: 1 });
questionSchema.index({ layer: 1, order: 1 });

// 静态方法：获取特定层级的所有问题
questionSchema.statics.getQuestionsByLayer = async function(layer) {
  return this.find({ layer, active: true }).sort({ order: 1 });
};

// 静态方法：获取所有激活的问题
questionSchema.statics.getAllActiveQuestions = async function() {
  return this.find({ active: true }).sort({ layer: 1, order: 1 });
};

export default mongoose.model('Question', questionSchema);
