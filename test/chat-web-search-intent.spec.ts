import { inferWebSearchIntent } from '../src/common/chat-web-search-intent';

describe('inferWebSearchIntent', () => {
  it('detects weather questions without an explicit 联网 prefix', () => {
    expect(inferWebSearchIntent('今天深圳什么天气')).toBe(true);
    expect(inferWebSearchIntent('深圳今天会下雨吗')).toBe(true);
  });

  it('detects explicit search requests', () => {
    expect(inferWebSearchIntent('联网查询，今天深圳什么天气？')).toBe(true);
    expect(inferWebSearchIntent('搜一下 React 19 发布了没')).toBe(true);
  });

  it('does not force search for static knowledge questions', () => {
    expect(inferWebSearchIntent('解释一下 React Fiber')).toBe(false);
    expect(inferWebSearchIntent('什么是闭包')).toBe(false);
  });
});
