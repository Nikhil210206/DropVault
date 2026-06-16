import { Router } from 'express';
import { live, ready } from './health.controller';

export const healthRouter: Router = Router();

healthRouter.get('/', live);
healthRouter.get('/ready', ready);
