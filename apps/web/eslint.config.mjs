import globals from 'globals';
import base from '@dropvault/config-eslint/base';

/** Web lint: shared base + browser globals. Ignores Next build output. */
export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
