export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  techStack: string[];
  difficulty: string;
  contentType: string;
}

const FALLBACK_SUMMARY: SummaryResult = {
  summary: '暂无摘要',
  keyPoints: [],
  keywords: [],
  techStack: [],
  difficulty: '未分级',
  contentType: '综合',
};

function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    return fenced[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return trimmed;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function coerceSummaryObject(parsed: Record<string, unknown>): SummaryResult {
  let summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

  if (summary.startsWith('{') || summary.startsWith('[')) {
    try {
      const nested = JSON.parse(extractJsonString(summary)) as Record<
        string,
        unknown
      >;
      if (typeof nested.summary === 'string') {
        return coerceSummaryObject(nested);
      }
    } catch {
      // keep original summary text
    }
  }

  if (!summary || summary.startsWith('{') || summary.includes('"summary"')) {
    return { ...FALLBACK_SUMMARY };
  }

  return {
    summary,
    keyPoints: toStringArray(parsed.keyPoints),
    keywords: toStringArray(parsed.keywords),
    techStack: toStringArray(parsed.techStack),
    difficulty:
      typeof parsed.difficulty === 'string' && parsed.difficulty
        ? parsed.difficulty
        : '未分级',
    contentType:
      typeof parsed.contentType === 'string' && parsed.contentType
        ? parsed.contentType
        : '综合',
  };
}

function extractFieldWithRegex(raw: string, field: string): string {
  const pattern =
    field === 'summary'
      ? /"summary"\s*:\s*"((?:\\.|[^"\\])*)"/
      : new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = raw.match(pattern);
  if (!match) {
    return '';
  }

  return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
}

function extractArrayWithRegex(raw: string, field: string): string[] {
  const match = raw.match(new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((item) => item[1].replace(/\\"/g, '"').trim())
    .filter(Boolean);
}

export function parseSummaryResponse(raw: string): SummaryResult {
  if (!raw?.trim()) {
    return { ...FALLBACK_SUMMARY };
  }

  try {
    const parsed = JSON.parse(extractJsonString(raw)) as Record<string, unknown>;
    if (typeof parsed.summary === 'string') {
      return coerceSummaryObject(parsed);
    }
  } catch {
    // fall through
  }

  const summary = extractFieldWithRegex(raw, 'summary');
  if (summary) {
    return {
      summary,
      keyPoints: extractArrayWithRegex(raw, 'keyPoints'),
      keywords: extractArrayWithRegex(raw, 'keywords'),
      techStack: extractArrayWithRegex(raw, 'techStack'),
      difficulty: extractFieldWithRegex(raw, 'difficulty') || '未分级',
      contentType: extractFieldWithRegex(raw, 'contentType') || '综合',
    };
  }

  const plain = raw.trim();
  if (plain.startsWith('{') || plain.includes('"summary"')) {
    return { ...FALLBACK_SUMMARY };
  }

  return {
    ...FALLBACK_SUMMARY,
    summary: plain,
  };
}
