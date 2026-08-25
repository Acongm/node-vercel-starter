import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../common/tokens';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { httpRequestLogMiddleware } from '../common/http-request-log.middleware';
import { requestIdMiddleware } from '../common/request-id.middleware';

export function configureApp(app: INestApplication) {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isCorsOriginAllowed(origin, config.corsOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-request-id',
      'x-client-id',
      'x-call-source',
      'x-conversation-id',
      'x-api-secret',
    ],
  });

  app.use(requestIdMiddleware);
  app.use(httpRequestLogMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

export function isCorsOriginAllowed(
  origin: string,
  allowedOrigins: string[],
): boolean {
  if (isLoopbackOrigin(origin)) {
    return true;
  }

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true;
    }

    if (!allowedOrigin.includes('*')) {
      return false;
    }

    const pattern = allowedOrigin
      .split('*')
      .map((part) => escapeRegExp(part))
      .join('[^.]+');
    return new RegExp(`^${pattern}$`).test(origin);
  });
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
