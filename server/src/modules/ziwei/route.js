/**
 * ZiweiChart Routes
 *
 * API endpoints for ziwei chart operations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import express from 'express';
import controller from './controller.js';
import { protect } from '../auth/middleware.js';

const router = express.Router();

/**
 * @route   GET /api/ziwei/:userId/chart
 * @desc    Get ziwei chart by user ID
 * @access  Private
 */
router.get('/:userId/chart', protect, controller.getChart);

/**
 * @route   POST /api/ziwei/:userId/regenerate
 * @desc    Force regenerate ziwei chart for a user
 * @access  Private
 */
router.post('/:userId/regenerate', protect, controller.regenerateChart);

/**
 * @route   GET /api/ziwei/:userId/horoscope
 * @desc    Get horoscope (运限) for a specific date - real-time calculation
 * @access  Private
 * @query   date - Target date in YYYY-MM-DD format (default: today)
 */
router.get('/:userId/horoscope', protect, controller.getHoroscope);

/**
 * @route   GET /api/ziwei/status
 * @desc    Check if current user has a ziwei chart
 * @access  Private
 */
router.get('/status', protect, controller.getChartStatus);

/**
 * @route   GET /api/ziwei/chart
 * @desc    Get current user's ziwei chart (convenience endpoint)
 * @access  Private
 */
router.get('/chart', protect, controller.getMyChart);

/**
 * @route   GET /api/ziwei/chart/simplified
 * @desc    Get simplified chart data for display
 * @access  Private
 */
router.get('/chart/simplified', protect, controller.getSimplifiedChart);

/**
 * @route   GET /api/ziwei/chart/palace/:palaceName
 * @desc    Get specific palace information
 * @access  Private
 */
router.get('/chart/palace/:palaceName', protect, controller.getPalace);

/**
 * @route   POST /api/ziwei/chart/generate
 * @desc    Manually generate ziwei chart (for testing)
 * @access  Private
 */
router.post('/chart/generate', protect, controller.generateChart);

/**
 * @route   DELETE /api/ziwei/chart
 * @desc    Delete current user's ziwei chart
 * @access  Private
 */
router.delete('/chart', protect, controller.deleteChart);

export default router;
