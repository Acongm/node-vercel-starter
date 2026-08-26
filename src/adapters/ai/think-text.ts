export type ThinkSplitState = {
  buffer: string;
  inThink: boolean;
};

const OPEN_RE = /<\s*think(?:ing)?\s*>|◁think▷/i;
const CLOSE_RE = /<\s*\/\s*think(?:ing)?\s*>|◁\/think▷/i;

function firstMatch(
  value: string,
  pattern: RegExp,
): { index: number; length: number } | null {
  const match = pattern.exec(value);
  if (!match) return null;
  return { index: match.index, length: match[0].length };
}

function maybeIncompleteTag(value: string): boolean {
  const tail = value.slice(-16);
  return /<\s*\/?\s*t?h?i?n?k?i?n?g?\s*>?$|◁\/?t?h?i?n?k?▷?$/i.test(tail);
}

export function createThinkSplitState(): ThinkSplitState {
  return { buffer: '', inThink: false };
}

export function splitThinkDelta(
  incoming: string,
  state: ThinkSplitState,
): { thinking: string; text: string } {
  state.buffer += incoming;
  let thinking = '';
  let text = '';

  while (state.buffer) {
    if (state.inThink) {
      const close = firstMatch(state.buffer, CLOSE_RE);
      if (!close) {
        if (maybeIncompleteTag(state.buffer)) break;
        thinking += state.buffer;
        state.buffer = '';
        break;
      }
      thinking += state.buffer.slice(0, close.index);
      state.buffer = state.buffer.slice(close.index + close.length);
      state.inThink = false;
      continue;
    }

    const open = firstMatch(state.buffer, OPEN_RE);
    if (!open) {
      if (maybeIncompleteTag(state.buffer)) break;
      text += state.buffer;
      state.buffer = '';
      break;
    }
    text += state.buffer.slice(0, open.index);
    state.buffer = state.buffer.slice(open.index + open.length);
    state.inThink = true;
  }

  return { thinking, text };
}

export function flushThinkSplit(state: ThinkSplitState): {
  thinking: string;
  text: string;
} {
  if (!state.buffer) return { thinking: '', text: '' };
  const leftover = state.buffer;
  state.buffer = '';
  return state.inThink
    ? { thinking: leftover, text: '' }
    : { thinking: '', text: leftover };
}

export function extractThinkFromText(value: string): {
  thinking: string;
  text: string;
} {
  const state = createThinkSplitState();
  const first = splitThinkDelta(value, state);
  const last = flushThinkSplit(state);
  return {
    thinking: `${first.thinking}${last.thinking}`,
    text: `${first.text}${last.text}`,
  };
}

export function reasoningFromDelta(delta: {
  reasoning_content?: unknown;
  reasoning?: unknown;
  thinking?: unknown;
  thought?: unknown;
}): string {
  for (const value of [
    delta.reasoning_content,
    delta.reasoning,
    delta.thinking,
    delta.thought,
  ]) {
    if (typeof value === 'string' && value) return value;
  }
  return '';
}
