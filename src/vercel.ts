import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './runtime/configure-app';

let cachedServer: ReturnType<NestExpressApplication['getHttpAdapter']> extends infer T
  ? T extends { getInstance(): infer U }
    ? U
    : never
  : never;

export async function createVercelHandler() {
  if (!cachedServer) {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    configureApp(app);
    await app.init();
    cachedServer = app.getHttpAdapter().getInstance();
  }

  return cachedServer;
}
