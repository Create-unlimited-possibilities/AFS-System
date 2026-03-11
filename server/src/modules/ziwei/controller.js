/**
 * ZiweiChart Controller
 *
 * HTTP request handlers for ziwei chart operations
 *
 * @author AFS Team
 * @version 1.0.0
 */

import ziweiChartService from './services/ziweiChartService.js';

class ZiweiChartController {
  /**
   * GET /api/ziwei/:userId/chart
   * Get ziwei chart by user ID
   */
  async getChart(req, res) {
    try {
      const { userId } = req.params;

      // Check if user is requesting their own chart or is admin
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only access your own chart'
        });
      }

      const chart = await ziweiChartService.getChart(userId);

      res.json({
        success: true,
        chart
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/ziwei/:userId/regenerate
   * Force regenerate ziwei chart for a user
   */
  async regenerateChart(req, res) {
    try {
      const { userId } = req.params;

      // Check if user is regenerating their own chart or is admin
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only regenerate your own chart'
        });
      }

      const profileData = req.body;

      // Validate profile data
      if (!profileData || !profileData.gender || !profileData.birthDate || profileData.birthHour === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: gender, birthDate, birthHour'
        });
      }

      const chart = await ziweiChartService.regenerateChart(userId, profileData);

      res.json({
        success: true,
        chart,
        message: 'Ziwei chart regenerated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/ziwei/:userId/horoscope
   * Get horoscope (运限) for a specific date - real-time calculation
   */
  async getHoroscope(req, res) {
    try {
      const { userId } = req.params;
      const { date } = req.query;

      // Check if user is requesting their own horoscope or is admin
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'You can only access your own horoscope'
        });
      }

      // Default to today if no date provided
      const targetDate = date || new Date().toISOString().split('T')[0];

      const result = await ziweiChartService.computeHoroscope(userId, targetDate);

      res.json({
        success: true,
        userId: result.userId,
        targetDate: result.targetDate,
        horoscope: result.horoscope
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/ziwei/status
   * Check if current user has a ziwei chart
   */
  async getChartStatus(req, res) {
    try {
      const userId = req.user.id;
      const hasChart = await ziweiChartService.hasChart(userId);

      res.json({
        success: true,
        hasChart
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/ziwei/chart
   * Get current user's ziwei chart (convenience endpoint)
   */
  async getMyChart(req, res) {
    try {
      const userId = req.user.id;
      const chart = await ziweiChartService.getChart(userId);

      res.json({
        success: true,
        chart
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/ziwei/chart/simplified
   * Get simplified chart data for display
   */
  async getSimplifiedChart(req, res) {
    try {
      const userId = req.user.id;
      const chart = await ziweiChartService.getSimplifiedChart(userId);

      res.json({
        success: true,
        chart
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/ziwei/chart/palace/:palaceName
   * Get specific palace information
   */
  async getPalace(req, res) {
    try {
      const userId = req.user.id;
      const { palaceName } = req.params;

      const palace = await ziweiChartService.getPalace(userId, palaceName);

      res.json({
        success: true,
        palace
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/ziwei/chart/generate
   * Manually generate ziwei chart (for testing)
   */
  async generateChart(req, res) {
    try {
      const userId = req.user.id;
      const profileData = req.body;

      const chart = await ziweiChartService.generateChart(userId, profileData);

      res.json({
        success: true,
        chart,
        message: 'Ziwei chart generated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * DELETE /api/ziwei/chart
   * Delete current user's ziwei chart
   */
  async deleteChart(req, res) {
    try {
      const userId = req.user.id;
      await ziweiChartService.deleteChart(userId);

      res.json({
        success: true,
        message: 'Ziwei chart deleted successfully'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new ZiweiChartController();
