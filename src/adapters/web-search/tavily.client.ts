export interface WebSearchSource {
  title: string;
  url: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
}

export async function searchWithTavily(
  query: string,
  apiKey: string,
  maxResults = 3,
): Promise<WebSearchSource[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { results?: TavilyResult[] };
  return (data.results || [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title as string,
      url: item.url as string,
    }));
}
