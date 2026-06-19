import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { APP_CONFIG } from '../common/tokens';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { requestIdMiddleware } from '../common/request-id.middleware';

export function configureApp(app: INestApplication) {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin, config.corsOrigins)) {
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
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}

function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
