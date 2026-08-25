export const DEFAULT_ALLOWED_CALL_SOURCES = ['portal:', 'chat-site'] as const;

export type CallerKind = 'user' | 'guest' | 'service' | 'unknown';

export type ServiceCaller = {
  id: string;
  key: string;
};

export type ResolvedCaller = {
  kind: CallerKind;
  callerId: string;
  callSource: string;
  requestId?: string;
};

export type CallerAccessDecision =
  | { ok: true }
  | { ok: false; code: 'CALLER_REQUIRED' | 'CALL_SOURCE_DENIED'; message: string };

export type ResolveCallerInput = {
  serviceId?: string;
  serviceKey?: string;
  userId?: string;
  isAnonymousUser?: boolean;
  clientId?: string;
  callSource?: string;
  requestId?: string;
  userAgent?: string;
  serviceCallers: ServiceCaller[];
};

export function parseServiceCallers(raw: string | undefined): ServiceCaller[] {
  if (!raw?.trim()) return [];
  const callers: ServiceCaller[] = [];
  for (const item of raw.split(',')) {
    const trimmed = item.trim();
    const sep = trimmed.indexOf(':');
    if (sep <= 0) continue;
    const id = trimmed.slice(0, sep).trim();
    const key = trimmed.slice(sep + 1).trim();
    if (!id || !key) continue;
    callers.push({ id, key });
  }
  return callers;
}

export function parseAllowedCallSources(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_ALLOWED_CALL_SOURCES];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isAllowedCallSource(
  source: string | undefined,
  allowedPrefixes: readonly string[],
): boolean {
  if (!source) return false;
  return allowedPrefixes.some(
    (prefix) => source === prefix || source.startsWith(prefix),
  );
}

export function matchServiceCaller(
  input: Pick<ResolveCallerInput, 'serviceId' | 'serviceKey' | 'serviceCallers'>,
): ServiceCaller | undefined {
  if (!input.serviceId || !input.serviceKey) return undefined;
  return input.serviceCallers.find(
    (caller) => caller.id === input.serviceId && caller.key === input.serviceKey,
  );
}

export function resolveCaller(input: ResolveCallerInput): ResolvedCaller {
  const callSource = input.callSource?.trim() || 'unknown';
  const requestId = input.requestId;
  const service = matchServiceCaller(input);
  if (service) {
    return {
      kind: 'service',
      callerId: service.id,
      callSource,
      requestId,
    };
  }

  if (input.userId && !input.isAnonymousUser) {
    return {
      kind: 'user',
      callerId: input.userId,
      callSource,
      requestId,
    };
  }

  const guestId = input.userId || input.clientId;
  if (guestId) {
    return {
      kind: 'guest',
      callerId: guestId,
      callSource,
      requestId,
    };
  }

  return {
    kind: 'unknown',
    callerId: 'unknown',
    callSource,
    requestId,
  };
}

export function decideAiCallerAccess(
  caller: ResolvedCaller,
  allowedPrefixes: readonly string[] = DEFAULT_ALLOWED_CALL_SOURCES,
): CallerAccessDecision {
  if (caller.kind === 'unknown') {
    return {
      ok: false,
      code: 'CALLER_REQUIRED',
      message: 'AI/chat calls require a user session, guest client id, or a whitelisted service caller.',
    };
  }
  if (!isAllowedCallSource(caller.callSource, allowedPrefixes)) {
    return {
      ok: false,
      code: 'CALL_SOURCE_DENIED',
      message: `Call source "${caller.callSource}" is not on the AI caller whitelist.`,
    };
  }
  return { ok: true };
}

export function displayCallerId(caller: ResolvedCaller): string {
  if (caller.kind === 'service') return `svc:${caller.callerId}`;
  return caller.callerId;
}

export type CallerHeaderBag = {
  header(name: string): string | undefined;
};

export function readOptionalHeader(
  req: CallerHeaderBag,
  name: string,
): string | undefined {
  const value = req.header(name)?.trim();
  return value ? value : undefined;
}

export function resolveCallerFromRequest(
  req: CallerHeaderBag,
  principal: { userId?: string | null; role?: string },
  serviceCallers: ServiceCaller[],
): ResolvedCaller {
  return resolveCaller({
    serviceId: readOptionalHeader(req, 'x-service-id'),
    serviceKey: readOptionalHeader(req, 'x-service-key'),
    userId: principal.userId ?? undefined,
    isAnonymousUser: !principal.userId || principal.role === 'anonymous',
    clientId: readOptionalHeader(req, 'x-client-id'),
    callSource: readOptionalHeader(req, 'x-call-source'),
    requestId: readOptionalHeader(req, 'x-request-id'),
    userAgent: readOptionalHeader(req, 'user-agent'),
    serviceCallers,
  });
}
