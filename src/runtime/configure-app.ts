import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/http-exception.filter';
import { requestIdMiddleware } from '../common/request-id.middleware';

export function configureApp(app: INestApplication) {
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
