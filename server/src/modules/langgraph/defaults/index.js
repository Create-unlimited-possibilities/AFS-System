// server/src/modules/langgraph/defaults/index.js
import { xiaoshudongDefault } from './xiaoshudong.js';
import { rolecardDefault } from './rolecard.js';

export function getDefaultConfig(flowId) {
  switch (flowId) {
    case 'xiaoshudong':
      return xiaoshudongDefault;
    case 'rolecard':
      return rolecardDefault;
    default:
      throw new Error(`Unknown flowId: ${flowId}`);
  }
}

export { xiaoshudongDefault, rolecardDefault };
