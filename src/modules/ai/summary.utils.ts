export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  techStack: string[];
  difficulty: string;
  contentType: string;
}

export interface LiveSummaryResult extends DocumentSummary {
  source: 'live';
  generatedAt: string;
}

export const SUMMARY_SYSTEM_PROMPT = `你是一个技术文档分析专家。请对技术文档进行全面的内容提炼和分析。

输出要求：
1. 返回 JSON 格式
2. summary: 详细摘要（150-200字），包含核心概念、关键特性和应用场景
3. keyPoints: 3-5个核心要点，每个要点简洁明了
4. keywords: 3-5个关键技术词
5. techStack: 相关技术栈（如：React、TypeScript、Node.js等）
6. difficulty: 难度等级（入门/进阶/高级）
7. contentType: 内容类型（概念/实践/原理/工具）

返回格式示例：
{
  "summary": "React 16 引入了革命性的 Fiber 架构...",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "keywords": ["React", "Fiber", "Hooks"],
  "techStack": ["React", "JavaScript"],
  "difficulty": "进阶",
  "contentType": "原理 + 实践"
}`;

export function buildSummaryUserPrompt(content: string, title?: string): string {
  const titleLine = title ? `文档标题：${title}\n\n` : '';
  return `${titleLine}请分析以下技术文档并提炼关键信息，以 JSON 格式返回：\n\n${content}`;
}

export function parseSummaryResponse(rawContent: string): DocumentSummary {
  let jsonStr = rawContent.trim();
  const jsonMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr) as Partial<DocumentSummary>;
  if (!parsed.summary) {
    throw new Error('Missing summary field in AI response.');
  }

  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints || [],
    keywords: parsed.keywords || [],
    techStack: parsed.techStack || [],
    difficulty: parsed.difficulty || '未分级',
    contentType: parsed.contentType || '综合',
  };
}

export function createMockSummary(content: string, title?: string): LiveSummaryResult {
  const preview = content.slice(0, 120).replace(/\s+/g, ' ');
  const label = title || '当前文档';

  return {
    summary: `Mock 摘要（${label}）：${preview}${content.length > 120 ? '…' : ''}`,
    keyPoints: ['Mock 要点 1', 'Mock 要点 2'],
    keywords: ['Mock'],
    techStack: [],
    difficulty: '未分级',
    contentType: '综合',
    source: 'live',
    generatedAt: new Date().toISOString(),
  };
}
