import QuestionRepository from '../repositories/question.js';

export default class QuestionService {
  constructor() {
    this.questionRepository = new QuestionRepository();
  }

  async getQuestionsByRoleAndLayer(role, layer) {
    const query = { active: true };

    if (role) {
      query.role = role;
    }

    if (layer) {
      query.layer = layer;
    }

    return await this.questionRepository.find(query);
  }

  async getProgressByLayer(userId, role, layer) {
    const totalQuestions = await this.questionRepository.countDocuments({
      role,
      layer,
      active: true
    });

    return {
      total: totalQuestions,
      answered: 0,
      progress: 0
    };
  }
}
