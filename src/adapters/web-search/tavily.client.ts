export interface WebSearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export type TavilySearchResult = {
  sources: WebSearchSource[];
  answer?: string;
};

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

export async function searchWithTavily(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<TavilySearchResult> {
  let response: Response;
  try {
    response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    return { sources: [] };
  }

  if (!response.ok) {
    return { sources: [] };
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: TavilyResult[];
  };

  const sources = (data.results || [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title as string,
      url: item.url as string,
      ...(item.content?.trim() ? { snippet: item.content.trim() } : {}),
    }));

  const answer =
    typeof data.answer === 'string' && data.answer.trim()
      ? data.answer.trim()
      : undefined;

  return { sources, answer };
}

export function formatWebSearchContext(input: TavilySearchResult): string {
  const lines = ['【联网检索结果】'];

  if (input.answer) {
    lines.push(`检索摘要：${input.answer}`);
  }

  for (const [index, source] of input.sources.entries()) {
    lines.push(`${index + 1}. ${source.title} - ${source.url}`);
    if (source.snippet) {
      lines.push(`   ${source.snippet}`);
    }
  }

  if (lines.length === 1) {
    lines.push(
      '（未检索到有效网页摘要。请结合已有知识简要回答，并说明实时信息可能不准确。）',
    );
  }

  return lines.join('\n');
}
