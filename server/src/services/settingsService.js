class SettingsService {
  async getAllSettings() {
    const settings = {
      site: {
        name: process.env.SITE_NAME || 'AFS System',
        description: process.env.SITE_DESCRIPTION || 'AFS 智能系统',
        logo: process.env.SITE_LOGO || '/logo.png'
      },
      system: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timezone: process.env.TZ || 'Asia/Shanghai'
      },
      features: {
        registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false',
        emailVerificationRequired: process.env.EMAIL_VERIFICATION === 'true',
        maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760'),
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/*,audio/*,application/pdf').split(',')
      },
      limits: {
        maxQuestionsPerUser: parseInt(process.env.MAX_QUESTIONS || '100'),
        maxAnswersPerUser: parseInt(process.env.MAX_ANSWERS || '1000'),
        maxRelationshipsPerUser: parseInt(process.env.MAX_RELATIONSHIPS || '50')
      },
      model: {
        defaultModel: process.env.DEFAULT_MODEL || 'gpt-3.5-turbo',
        maxTokens: parseInt(process.env.MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.TEMPERATURE || '0.7')
      }
    };
    return settings;
  }

  async updateSettings(category, data) {
    if (category === 'site') {
      if (data.name) process.env.SITE_NAME = data.name;
      if (data.description) process.env.SITE_DESCRIPTION = data.description;
      if (data.logo) process.env.SITE_LOGO = data.logo;
    } else if (category === 'features') {
      if (data.registrationEnabled !== undefined) {
        process.env.REGISTRATION_ENABLED = data.registrationEnabled.toString();
      }
      if (data.emailVerificationRequired !== undefined) {
        process.env.EMAIL_VERIFICATION = data.emailVerificationRequired.toString();
      }
      if (data.maxUploadSize) {
        process.env.MAX_UPLOAD_SIZE = data.maxUploadSize.toString();
      }
      if (data.allowedFileTypes) {
        process.env.ALLOWED_FILE_TYPES = Array.isArray(data.allowedFileTypes) 
          ? data.allowedFileTypes.join(',') 
          : data.allowedFileTypes;
      }
    } else if (category === 'limits') {
      if (data.maxQuestionsPerUser) {
        process.env.MAX_QUESTIONS = data.maxQuestionsPerUser.toString();
      }
      if (data.maxAnswersPerUser) {
        process.env.MAX_ANSWERS = data.maxAnswersPerUser.toString();
      }
      if (data.maxRelationshipsPerUser) {
        process.env.MAX_RELATIONSHIPS = data.maxRelationshipsPerUser.toString();
      }
    } else if (category === 'model') {
      if (data.defaultModel) process.env.DEFAULT_MODEL = data.defaultModel;
      if (data.maxTokens) process.env.MAX_TOKENS = data.maxTokens.toString();
      if (data.temperature !== undefined) {
        process.env.TEMPERATURE = data.temperature.toString();
      }
    }

    return await this.getAllSettings();
  }

  async getSystemInfo() {
    const User = (await import('../models/User.js')).default;
    const Question = (await import('../models/Question.js')).default;
    const Answer = (await import('../models/Answer.js')).default;

    const [userCount, questionCount, answerCount] = await Promise.all([
      User.countDocuments(),
      Question.countDocuments(),
      Answer.countDocuments()
    ]);

    const fs = await import('fs');
    const os = await import('os');
    
    const memoryUsage = process.memoryUsage();
    const diskUsage = fs.statSync('.').size;

    return {
      users: userCount,
      questions: questionCount,
      answers: answerCount,
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      platform: os.platform(),
      nodeVersion: process.version,
      diskUsage: Math.round(diskUsage / 1024 / 1024)
    };
  }

  async resetSystem() {
    return { message: '系统重置功能暂未实现' };
  }
}

export default new SettingsService();
