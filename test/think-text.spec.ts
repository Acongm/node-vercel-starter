import {
  createThinkSplitState,
  extractThinkFromText,
  flushThinkSplit,
  splitThinkDelta,
} from '../src/adapters/ai/think-text';

describe('think-text', () => {
  it('splits a complete think block from visible answer', () => {
    expect(
      extractThinkFromText('<think>先查天气</think>深圳今天多云。'),
    ).toEqual({
      thinking: '先查天气',
      text: '深圳今天多云。',
    });
  });

  it('handles think tags split across stream chunks', () => {
    const state = createThinkSplitState();
    const first = splitThinkDelta('<thi', state);
    const second = splitThinkDelta('nk>推理中</th', state);
    const third = splitThinkDelta('ink>可见回答', state);
    const leftover = flushThinkSplit(state);

    expect(`${first.thinking}${second.thinking}${third.thinking}${leftover.thinking}`).toBe(
      '推理中',
    );
    expect(`${first.text}${second.text}${third.text}${leftover.text}`).toBe('可见回答');
  });
});
