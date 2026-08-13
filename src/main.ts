import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './runtime/configure-app';
import { APP_CONFIG } from './common/tokens';
import { AppConfig } from './config/app-config';
import { logEvent } from './modules/logs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  configureApp(app);
  app.useStaticAssets(join(process.cwd(), 'public'));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  logEvent({
    event: 'app.started',
    module: 'bootstrap',
    message: `${config.appName} listening`,
    port: config.port,
    runtimeTarget: config.runtimeTarget,
  });
}

void bootstrap();
