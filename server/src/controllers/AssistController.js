import assistService from '../services/assistService.js';
import AnswerService from '../services/AnswerService.js';
import User from '../models/User.js';
import AssistRelation from '../models/AssistRelation.js';

class AssistController {
  // 搜索用户
  async searchUser(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: '邮箱不能为空'
        });
      }

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: '未找到该用户'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            uniqueCode: user.uniqueCode
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // 删除协助关系
  async deleteRelation(req, res) {
    try {
      const { relationId } = req.params;
      const userId = req.user?.id || req.user?._id;

      const relation = await AssistRelation.findById(relationId);

      if (!relation) {
        return res.status(404).json({
          success: false,
          error: '协助关系不存在'
        });
      }

      // 检查权限：只有关系中的任一方可以删除
      if (relation.assistantId.toString() !== userId.toString() &&
          relation.targetId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: '无权限删除此关系'
        });
      }

      const answerService = new AnswerService();
      await answerService.deleteAssistAnswers(relation._id);
      await AssistRelation.findByIdAndDelete(relationId);

      res.json({
        success: true,
        message: '协助关系已删除'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async createRelation(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;
      const { targetCode, targetEmail, relationshipType = 'friend', specificRelation, friendLevel } = req.body;

      if (!targetCode || !targetEmail) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段'
        });
      }

      const result = await assistService.createRelation({
        assistantId: userId,
        targetCode,
        targetEmail,
        relationshipType,
        specificRelation,
        friendLevel
      });

      res.json({
        success: true,
        message: '协助关系创建成功',
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRelations(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;

      // 获取我协助的关系
      const assistedRelations = await AssistRelation.find({
        assistantId: userId,
        isActive: true
      }).populate('targetId', 'name email uniqueCode');

      // 获取协助我的关系
      const assistantRelations = await AssistRelation.find({
        targetId: userId,
        isActive: true
      }).populate('assistantId', 'name email uniqueCode');

      // 格式化为前端期望的格式
      const formattedRelations = [];

      // 添加我协助的关系
      assistedRelations.forEach(rel => {
        formattedRelations.push({
          _id: rel._id,
          assistedUser: {
            _id: rel.targetId._id.toString(),
            name: rel.targetId.name,
            email: rel.targetId.email
          },
          assistantUser: {
            _id: userId.toString(),
            name: req.user?.name || '我',
            email: req.user?.email || ''
          },
          status: 'accepted',
          createdAt: rel.createdAt
        });
      });

      // 添加协助我的关系
      assistantRelations.forEach(rel => {
        formattedRelations.push({
          _id: rel._id,
          assistedUser: {
            _id: userId.toString(),
            name: req.user?.name || '我',
            email: req.user?.email || ''
          },
          assistantUser: {
            _id: rel.assistantId._id.toString(),
            name: rel.assistantId.name,
            email: rel.assistantId.email
          },
          status: 'accepted',
          createdAt: rel.createdAt
        });
      });

      res.json({
        success: true,
        data: formattedRelations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getHelpers(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;

      // 只获取协助我的关系（真正的协助者）
      const assistantRelations = await AssistRelation.find({
        targetId: userId,
        isActive: true
      }).populate('assistantId', 'name email uniqueCode');

      res.json({
        success: true,
        data: assistantRelations.map(rel => ({
          _id: rel._id,
          assistant: {
            _id: rel.assistantId._id.toString(),
            name: rel.assistantId.name,
            email: rel.assistantId.email
          },
          relationshipType: rel.relationshipType,
          specificRelation: rel.specificRelation,
          friendLevel: rel.friendLevel,
          status: rel.status || 'accepted',
          createdAt: rel.createdAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getIncompleteRelations(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;
      const incompleteRelations = await assistService.getIncompleteRelations(userId);

      res.json({
        success: true,
        incompleteRelations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchUpdateRelations(req, res) {
    try {
      const { relations } = req.body;

      if (!relations || !Array.isArray(relations)) {
        return res.status(400).json({
          success: false,
          error: '请求数据格式错误'
        });
      }

      const modifiedCount = await assistService.batchUpdateRelations(relations);

      res.json({
        success: true,
        message: '关系更新成功',
        modifiedCount
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new AssistController();
