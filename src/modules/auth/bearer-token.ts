import { Request } from 'express';

export function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
}
