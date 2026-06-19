import globals from 'globals';
import base from './base.js';

/** Web config: shared base + browser & node globals (config files use Node). */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
