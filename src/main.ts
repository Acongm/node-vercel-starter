import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './runtime/configure-app';
import { APP_CONFIG } from './common/tokens';
import { appLogger } from './common/app-logger';
import { AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(join(process.cwd(), 'public'));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  appLogger.info({
    event: 'app.start',
    appName: config.appName,
    port: config.port,
  });
}

void bootstrap();
