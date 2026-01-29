// 对话API路由
import express from 'express';
import Answer from '../models/Answer.js';
import User from '../models/User.js';
import RAGEngine from '../rag/rag_engine.js';

// 初始化RAG引擎
const ragEngine = new RAGEngine();
const router = express.Router();

// 验证用户编号
router.post('/verify-code', async (req, res) => {
    try {
        const { uniqueCode } = req.body;
        
        // 验证参数
        if (!uniqueCode) {
            return res.status(400).json({ error: 'Unique code is required' });
        }
        
        // 检查用户是否存在
        const user = await User.findOne({ uniqueCode });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 验证通过
        res.json({ 
            success: true, 
            userId: user._id,
            userName: user.username,
            uniqueCode: user.uniqueCode
        });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// RAG搜索接口
router.post('/search', async (req, res) => {
    try {
        const { query, targetUserCode, topK = 5, similarityThreshold = 0.5 } = req.body;
        
        // 验证参数
        if (!query || !targetUserCode) {
            return res.status(400).json({ error: 'Query and targetUserCode are required' });
        }
        
        // 检查目标用户是否存在
        const targetUser = await User.findOne({ uniqueCode: targetUserCode });
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }
        
        // 执行RAG搜索
        const searchResults = await ragEngine.search(
            query,
            targetUserCode,
            topK,
            similarityThreshold
        );
        
        res.json({
            success: true,
            query,
            results: searchResults,
            count: searchResults.length
        });
    } catch (error) {
        console.error('RAG search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// 对话主接口
router.post('/chat', async (req, res) => {
    try {
        const { 
            query, 
            targetUserCode, 
            userMessage, 
            conversationHistory = [],
            topK = 3,
            similarityThreshold = 0.5 
        } = req.body;
        
        // 验证参数
        if (!query || !targetUserCode) {
            return res.status(400).json({ error: 'Query and targetUserCode are required' });
        }
        
        // 验证目标用户
        const targetUser = await User.findOne({ uniqueCode: targetUserCode });
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }
        
        // 执行RAG搜索以获取相关上下文
        const contextResults = await ragEngine.search(
            query,
            targetUserCode,
            topK,
            similarityThreshold
        );
        
        // 准备AI模型的输入，包含检索到的上下文
        const aiInput = {
            query: query,
            context: contextResults.map(result => ({
                question: result.metadata.question,
                answer: result.metadata.answer,
                similarity: result.similarity
            })),
            conversationHistory,
            targetUserProfile: {
                username: targetUser.username,
                uniqueCode: targetUser.uniqueCode
            }
        };
        
        // 注意：这里我们只是返回模拟的AI响应
        // 在实际实现中，这里会调用AI模型生成回复
        const mockResponse = {
            response: `基于${contextResults.length}个相关问答对生成的回复：这是模拟的AI回复，实际实现中这里会调用AI模型。`,
            contextUsed: contextResults.slice(0, 2).map(result => ({
                question: result.metadata.question,
                answer: result.metadata.answer,
                similarity: result.similarity
            })),
            targetUserInfo: {
                username: targetUser.username,
                uniqueCode: targetUser.uniqueCode
            }
        };
        
        res.json({
            success: true,
            response: mockResponse.response,
            context: mockResponse.contextUsed,
            targetUser: mockResponse.targetUserInfo
        });
    } catch (error) {
        console.error('Conversation chat error:', error);
        res.status(500).json({ error: 'Conversation failed' });
    }
});

// 获取用户索引状态
router.get('/index-status/:uniqueCode', async (req, res) => {
    try {
        const { uniqueCode } = req.params;
        
        // 检查用户是否存在
        const user = await User.findOne({ uniqueCode });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 这里可以添加获取索引状态的逻辑
        // 暂时返回模拟的状态信息
        res.json({
            uniqueCode,
            status: 'indexed', // indexed, indexing, not_indexed
            vectorCount: 0, // 实际的向量数量
            lastUpdated: null // 最后更新时间
        });
    } catch (error) {
        console.error('Get index status error:', error);
        res.status(500).json({ error: 'Failed to get index status' });
    }
});

export default router;
