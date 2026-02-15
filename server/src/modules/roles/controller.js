import roleService from './service.js';

class RoleController {
  async getAllRoles(req, res) {
    try {
      const { page, limit, search } = req.query;
      const result = await roleService.getAllRoles({ page, limit, search });
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

  async getRoleById(req, res) {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(id);
      res.json({
        success: true,
        role
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async createRole(req, res) {
    try {
      const data = req.body;
      const role = await roleService.createRole(data);
      res.json({
        success: true,
        role
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const role = await roleService.updateRole(id, updateData);
      res.json({
        success: true,
        role
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const result = await roleService.deleteRole(id);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllPermissions(req, res) {
    try {
      const result = await roleService.getAllPermissions();
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

  async createPermission(req, res) {
    try {
      const data = req.body;
      const permission = await roleService.createPermission(data);
      res.json({
        success: true,
        permission
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const permission = await roleService.updatePermission(id, updateData);
      res.json({
        success: true,
        permission
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deletePermission(req, res) {
    try {
      const { id } = req.params;
      const result = await roleService.deletePermission(id);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async initializeDefaults(req, res) {
    try {
      const result = await roleService.initializeDefaultRoles();
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

export default new RoleController();
