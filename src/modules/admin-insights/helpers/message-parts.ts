interface MessagePart {
  type?: string;
  text?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessagePart(value: unknown): value is MessagePart {
  return isRecord(value) && typeof value.type === 'string';
}

/** Concatenate text from message parts where type === 'text'. */
export function extractTextPreviewFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter(isMessagePart)
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('');
}
