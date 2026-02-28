/**
 * LangGraph Controller
 * HTTP request handlers for flow configuration
 */

import langGraphService from './service.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

class LangGraphController {
  async getFlows(req, res) {
    try {
      const flows = await langGraphService.getFlows();
      res.json({ success: true, data: flows });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getFlowById(req, res) {
    try {
      const { flowId } = req.params;
      const flow = await langGraphService.getFlowById(flowId);
      res.json({ success: true, data: flow });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async updateNodeConfig(req, res) {
    try {
      const { flowId, nodeId } = req.params;
      const updates = req.body;
      const updatedBy = req.user?.id;

      const result = await langGraphService.updateNodeConfig(flowId, nodeId, updates, updatedBy);

      res.json({
        success: true,
        message: '节点配置已更新，重启服务后生效',
        data: result
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getAvailableModels(req, res) {
    try {
      const models = await langGraphService.getAvailableModels(OLLAMA_BASE_URL);
      res.json({ success: true, data: models });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async resetFlowConfig(req, res) {
    try {
      const { flowId } = req.params;
      const config = await langGraphService.resetFlowConfig(flowId);
      res.json({
        success: true,
        message: `流程 ${flowId} 已重置为默认配置`,
        data: config
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export default new LangGraphController();
