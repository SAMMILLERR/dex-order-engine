import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.server.env === 'production' ? 'info' : 'debug',
  transport:
    config.server.env !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
}) as any;
