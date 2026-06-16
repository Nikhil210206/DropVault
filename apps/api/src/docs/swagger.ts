import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiDocument } from './openapi';

/** Mounts interactive API docs (Swagger UI) at /docs. */
export function mountSwagger(app: Express): void {
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, { customSiteTitle: 'DropVault API Docs' }),
  );
}
