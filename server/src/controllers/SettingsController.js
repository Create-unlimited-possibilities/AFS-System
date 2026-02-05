import settingsService from '../services/settingsService.js';

class SettingsController {
  async getAllSettings(req, res) {
    try {
      const settings = await settingsService.getAllSettings();
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateSettings(req, res) {
    try {
      const { category } = req.params;
      const data = req.body;
      const settings = await settingsService.updateSettings(category, data);
      res.json({
        success: true,
        settings
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSystemInfo(req, res) {
    try {
      const info = await settingsService.getSystemInfo();
      res.json({
        success: true,
        info
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async resetSystem(req, res) {
    try {
      const result = await settingsService.resetSystem();
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new SettingsController();
