import User from './model.js';

export default class UserRepository {
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async findOne(query) {
    return await User.findOne(query);
  }

  async findById(id) {
    return await User.findById(id);
  }

  async findByIdAndUpdate(id, update, options = {}) {
    return await User.findByIdAndUpdate(id, update, options);
  }

  async generateUniqueCode() {
    let code;
    let exists = true;

    while (exists) {
      code = User.generateUniqueCode();
      const user = await this.findOne({ uniqueCode: code });
      exists = !!user;
    }

    return code;
  }
}
