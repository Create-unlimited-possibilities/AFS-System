import userService from './service.js';

class UserController {
  async getAllUsers(req, res) {
    try {
      const { page, limit, search, role, isActive } = req.query;
      const result = await userService.getAllUsers({ page, limit, search, role, isActive });
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

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const user = await userService.updateUser(id, updateData);
      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const result = await userService.deleteUser(id);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async createUser(req, res) {
    try {
      const userData = req.body;
      const user = await userService.createUser(userData);
      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.toggleUserStatus(id);
      res.json({
        success: true,
        user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUserStats(req, res) {
    try {
      const stats = await userService.getUserStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.user.id;  // JWT 中使用的是 id，不是 _id
      const profile = await userService.getProfile(userId);
      res.json({
        success: true,
        profile
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.id;  // JWT 中使用的是 id，不是 _id
      const profileData = req.body;
      const user = await userService.updateProfile(userId, profileData);
      res.json({
        success: true,
        profile: user.profile,
        message: '个人档案已更新'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new UserController();
