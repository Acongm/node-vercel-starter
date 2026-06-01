import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { ProxyRequestDto } from './dto/proxy-request.dto';

@Injectable()
export class ProxyService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async forward(provider: string, dto: ProxyRequestDto) {
    const baseUrl = this.config.proxyAllowlist[provider];
    if (!baseUrl) {
      throw new ForbiddenException(`Proxy provider "${provider}" is not allowed.`);
    }

    const path = dto.path?.startsWith('/') ? dto.path : `/${dto.path || ''}`;
    const url = `${baseUrl}${path}`;
    const method = dto.method || 'POST';

    const response = await fetch(url, {
      method,
      headers: this.safeHeaders(dto.headers),
      body: ['GET', 'DELETE'].includes(method) ? undefined : JSON.stringify(dto.body ?? {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return {
      ok: response.ok,
      status: response.status,
      provider,
      data,
    };
  }

  private safeHeaders(headers: Record<string, string> | undefined) {
    const safe: Record<string, string> = {
      'content-type': 'application/json',
      ...(headers || {}),
    };
    delete safe.host;
    delete safe.cookie;
    return safe;
  }
}
