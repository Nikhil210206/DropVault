import web from '@dropvault/config-eslint/web';

/** Web lint: shared config (with browser/node globals) + ignore Next build output. */
export default [{ ignores: ['.next/**', 'next-env.d.ts'] }, ...web];
