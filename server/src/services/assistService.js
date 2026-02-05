// server/src/services/assistService.js - 协助关系服务
import AssistRelation from '../models/AssistRelation.js';
import User from '../models/User.js';

class AssistService {
  /**
   * 验证并创建协助关系
   */
  async createRelation({ assistantId, targetCode, targetEmail, relationshipType, specificRelation, friendLevel }) {
    // 验证关系类型
    if (!['family', 'friend'].includes(relationshipType)) {
      throw new Error('无效的关系类型');
    }

    // 查找目标用户
    const targetUser = await User.findOne({ 
      uniqueCode: targetCode,
      email: targetEmail.toLowerCase()
    });

    if (!targetUser) {
      throw new Error('用户信息不匹配，请检查编号和邮箱');
    }

    // 不能协助自己
    if (targetUser._id.toString() === assistantId) {
      throw new Error('不能协助自己');
    }

    // 检查是否已存在协助关系
    const existingRelation = await AssistRelation.findOne({
      assistantId,
      targetId: targetUser._id
    });

    if (existingRelation) {
      throw new Error('已经建立了协助关系');
    }

    // 创建协助关系
    const relationData = {
      assistantId,
      targetId: targetUser._id,
      relationshipType
    };

    // 添加可选字段
    if (specificRelation && specificRelation.trim()) {
      relationData.specificRelation = specificRelation.trim();
      if (relationshipType === 'friend' && friendLevel) {
        relationData.friendLevel = friendLevel;
      }
    }

    const assistRelation = new AssistRelation(relationData);
    await assistRelation.save();

    return {
      targetUser: {
        id: targetUser._id,
        name: targetUser.name,
        uniqueCode: targetUser.uniqueCode
      },
      relationshipType,
      specificRelation: relationData.specificRelation,
      friendLevel: relationData.friendLevel
    };
  }

  /**
   * 获取用户的所有协助关系
   */
  async getRelations(userId) {
    return await AssistRelation.find({ 
      assistantId: userId, 
      isActive: true 
    }).populate('targetId', 'uniqueCode email name');
  }

  /**
   * 检查未填写具体关系的协助者（从target角度检查assistant是否填写）
   */
  async getIncompleteRelations(userId) {
    return await AssistRelation.find({
      targetId: userId,
      $or: [
        { specificRelation: { $exists: false } },
        { specificRelation: null },
        { specificRelation: '' }
      ],
      isActive: true
    }).populate('assistantId');
  }

  /**
   * 批量更新协助关系的具体信息
   */
  async batchUpdateRelations(relationsData) {
    if (!Array.isArray(relationsData) || relationsData.length === 0) {
      throw new Error('无效的请求格式');
    }

    const updateOperations = [];

    relationsData.forEach(item => {
      if (item.relationId && item.specificRelation) {
        updateOperations.push({
          updateOne: {
            filter: { _id: item.relationId },
            update: { $set: { specificRelation: item.specificRelation } }
          }
        });
      }
    });

    if (updateOperations.length === 0) {
      throw new Error('没有有效的更新数据');
    }

    const result = await AssistRelation.bulkWrite(updateOperations, { ordered: false });
    return result.modifiedCount;
  }
}

export default new AssistService();