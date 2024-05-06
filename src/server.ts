import express, { RequestHandler } from 'express';
import { stdout } from 'process';

import { smartapp } from './smartapp';

const PORT = 10000;
const PATH_HEALTH = '/healthz';
const PATH_API = '/api';

const healthMiddleware: RequestHandler = (_req, res) => {
  stdout.write('/healthz 200');
  res.sendStatus(200);
};

const webhookMiddleware: RequestHandler = (req, res) => {
  smartapp.handleHttpCallback(req, res);
};

export const server = express()
  .get(PATH_HEALTH, healthMiddleware)
  .post(PATH_API, express.json(), webhookMiddleware)
  .listen(PORT, () => stdout.write(`\nServer is up and running on port ${PORT}.`));
