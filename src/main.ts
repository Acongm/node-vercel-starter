import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './runtime/configure-app';
import { APP_CONFIG } from './common/tokens';
import { AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(join(process.cwd(), 'public'));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  console.log(`${config.appName} listening on http://localhost:${config.port}`);
}

void bootstrap();
