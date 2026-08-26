/** Detect web-search intent from quick-tag prefix or natural language. */
export function inferWebSearchIntent(prompt: string | undefined): boolean {
  const value = String(prompt || '');
  if (value.includes('联网检索最新资料后，')) return true;
  return /(?:^|[\s，,])联网(?:检索|查询|搜索|[，,：:\s])/u.test(value);
}
