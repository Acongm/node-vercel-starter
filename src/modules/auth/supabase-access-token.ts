import { createPublicKey } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';

export type SupabaseJwtClaims = {
  sub?: string;
  email?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type Jwk = {
  kid?: string;
  alg?: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  use?: string;
};

const jwtService = new JwtService();

export async function verifySupabaseJwt(
  token: string,
  options: { jwks?: Jwk[]; hs256Secret?: string },
): Promise<SupabaseJwtClaims | null> {
  const header = readJwtHeader(token);
  if (!header) return null;

  const jwk = selectJwk(options.jwks ?? [], header.kid);
  if (jwk) {
    const pem = jwkToPem(jwk);
    if (pem) {
      const claims = await tryVerify(token, pem, ['ES256', 'RS256']);
      if (claims) return claims;
    }
  }

  if (options.hs256Secret) {
    const claims = await tryVerify(token, options.hs256Secret, ['HS256']);
    if (claims) return claims;
  }

  return null;
}

export function readJwtHeader(token: string): JwtHeader | null {
  const [raw] = token.split('.');
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as JwtHeader;
  } catch {
    return null;
  }
}

function selectJwk(keys: Jwk[], kid?: string): Jwk | undefined {
  if (kid) {
    const matched = keys.find((key) => key.kid === kid);
    if (matched) return matched;
  }
  return keys.length === 1 ? keys[0] : undefined;
}

function jwkToPem(jwk: Jwk): string | null {
  try {
    return createPublicKey({
      format: 'jwk',
      key: {
        kty: jwk.kty,
        crv: jwk.crv,
        x: jwk.x,
        y: jwk.y,
        n: jwk.n,
        e: jwk.e,
      },
    })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  } catch {
    return null;
  }
}

async function tryVerify(
  token: string,
  secret: string,
  algorithms: Array<'ES256' | 'RS256' | 'HS256'>,
): Promise<SupabaseJwtClaims | null> {
  try {
    return await jwtService.verifyAsync<SupabaseJwtClaims>(token, {
      secret,
      algorithms,
    });
  } catch {
    return null;
  }
}
