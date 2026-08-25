import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Response } from 'express';
import { RequestWithId } from './request-id.middleware';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    if (
      exception instanceof NotFoundException &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      !request.path.startsWith('/api') &&
      !request.path.startsWith('/v1') &&
      !request.path.startsWith('/legacy')
    ) {
      const publicDir = join(process.cwd(), 'public');

      if (request.path === '/' || request.path === '') {
        response.redirect(308, '/fe');
        return;
      }

      if (request.path.startsWith('/fe')) {
        const relativePath = request.path.replace(/^\/fe\/?/, '');
        const candidate = join(publicDir, 'fe', relativePath);
        if (relativePath && existsSync(candidate)) {
          response.sendFile(candidate);
          return;
        }

        response.sendFile(join(publicDir, 'fe', 'index.html'));
        return;
      }
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const details =
      typeof errorResponse === 'object' && errorResponse !== null
        ? (errorResponse as Record<string, unknown>)
        : undefined;

    const message = details?.message
      ? (details.message as string | string[])
      : exception instanceof Error
        ? exception.message
        : 'Unexpected error';

    const { message: _message, ...extra } = details || {};

    response.status(status).json({
      ok: false,
      statusCode: status,
      message,
      ...extra,
      path: request.url,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
