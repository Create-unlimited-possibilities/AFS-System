/**
 * LangGraph Routes
 * API endpoints for flow configuration management
 */

import express from 'express';
import { protect, requirePermission } from '../admin/middleware.js';
import langGraphController from './controller.js';

const router = express.Router();

// All routes require authentication and langgraph:edit permission
router.use(protect);
router.use(requirePermission('langgraph:edit'));

/**
 * @route   GET /api/admin/langgraph/flows
 * @desc    Get all flows summary
 */
router.get('/flows', (req, res) => langGraphController.getFlows(req, res));

/**
 * @route   GET /api/admin/langgraph/flows/:flowId
 * @desc    Get flow detail by ID
 */
router.get('/flows/:flowId', (req, res) => langGraphController.getFlowById(req, res));

/**
 * @route   PUT /api/admin/langgraph/flows/:flowId/nodes/:nodeId
 * @desc    Update node config
 * @body    staticPrompt, editableSection, llmConfig
 */
router.put('/flows/:flowId/nodes/:nodeId', (req, res) => langGraphController.updateNodeConfig(req, res));

/**
 * @route   GET /api/admin/langgraph/models
 * @desc    Get available models (Ollama + API)
 */
router.get('/models', (req, res) => langGraphController.getAvailableModels(req, res));

export default router;
