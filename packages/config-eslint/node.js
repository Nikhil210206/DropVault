import globals from 'globals';
import base from './base.js';

/** Node-flavoured config: adds Node globals on top of the base. */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
