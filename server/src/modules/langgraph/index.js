/**
 * LangGraph Module Entry
 */

import langGraphRouter from './route.js';
import configLoader from './configLoader.js';
import { ensureLangGraphPermission } from './migrations/addPermission.js';

export {
  langGraphRouter,
  configLoader,
  ensureLangGraphPermission
};

export default {
  router: langGraphRouter,
  configLoader,
  ensureLangGraphPermission
};
