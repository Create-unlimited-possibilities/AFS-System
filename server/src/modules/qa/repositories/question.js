import Question from '../models/question.js';

export default class QuestionRepository {
  async findOne(query) {
    return await Question.findOne(query);
  }

  async findById(id) {
    return await Question.findById(id);
  }

  async find(query) {
    return await Question.find(query).sort({ order: 1 }).lean();
  }

  async countDocuments(query) {
    return await Question.countDocuments(query);
  }

  async getQuestionsByLayer(layer) {
    return await Question.find({ layer, active: true }).sort({ order: 1 });
  }

  async getAllActiveQuestions() {
    return await Question.find({ active: true }).sort({ layer: 1, order: 1 });
  }
}
