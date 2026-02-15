import AssistRelation from './model.js';

export default class AssistRelationRepository {
  async create(relationData) {
    const relation = new AssistRelation(relationData);
    return await relation.save();
  }

  async findOne(query) {
    return await AssistRelation.findOne(query).populate('targetId', 'uniqueCode email name');
  }

  async find(query) {
    return await AssistRelation.find(query).populate('targetId', 'uniqueCode email name');
  }

  async hasRelation(assistantId, targetId) {
    const relation = await this.findOne({
      assistantId,
      targetId,
      isActive: true
    });
    return !!relation;
  }

  async getAssistRelations(userId) {
    return await this.find({
      assistantId: userId,
      isActive: true
    });
  }
}
