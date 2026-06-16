import { env } from '../config/env';

/**
 * Base OpenAPI 3.1 document. Paths and schemas are generated from Zod DTOs as feature
 * modules are added in later phases; this is the bootstrap so /docs is live from day one.
 */
export const openapiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'DropVault API',
    version: '0.1.0',
    description: 'Secure file-sharing platform API.',
  },
  servers: [{ url: env.API_PREFIX }],
  paths: {
    '/': {
      get: {
        summary: 'API info',
        responses: { '200': { description: 'API name and version' } },
      },
    },
  },
};
