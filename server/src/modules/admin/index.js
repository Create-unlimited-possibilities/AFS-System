/**
 * Admin Module
 * Administrative operations including invite code management
 *
 * @author AFS Team
 * @version 1.0.0
 */

import adminController from './controller.js';
import adminRoutes from './route.js';

export { default as adminController } from './controller.js';
export { default as adminRoutes } from './route.js';
export { default as InviteCode } from './models/inviteCode.js';

export default {
  controller: adminController,
  routes: adminRoutes
};
