import authService from '../services/authService.js';

class AuthController {
  async register(req, res) {
    try {
      const { email, password, name } = req.body;
      
      // 添加参数验证
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数：邮箱、密码、姓名'
        });
      }

      // 添加格式验证
      if (typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({
          success: false,
          error: '邮箱格式不正确'
        });
      }

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          error: '密码长度至少为6位'
        });
      }

      const user = await authService.register({ email, password, name });
      const token = authService.generateToken(user);

      res.json({
        success: true,
        user,
        token
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // 添加参数验证
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数：邮箱、密码'
        });
      }

      // 添加格式验证
      if (typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({
          success: false,
          error: '邮箱格式不正确'
        });
      }

      if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({
          success: false,
          error: '密码不能为空'
        });
      }

      const user = await authService.login(email, password);
      const token = authService.generateToken(user);

      res.json({
        success: true,
        user,
        token
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async getMe(req, res) {
    try {
      const user = await authService.getUserById(req.user.id || req.user._id);
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
}

export default new AuthController();
