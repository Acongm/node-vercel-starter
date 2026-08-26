const EXPLICIT_RE =
  /联网(?:检索|查询|搜索)?|检索最新资料|搜一下|查一下|搜索一下|google一下|百度一下/iu;

const REALTIME_RE =
  /天气|气温|温度|下雨|台风|空气质量|雾霾|预报|空气指数|pm\s*2\.5|股价|汇率|黄金|油价|比分|赛况|新闻|热点|限行|路况|停电|航班|火车|实时|最新消息/iu;

const TIMEFUL_RE = /今天|今日|现在|实时|最新|刚才|刚刚|昨天|明天|今晚|本周|近期/u;

const QUESTION_RE = /[？?吗呢]|什么|多少|几度|如何|怎么|哪/u;

/** Infer whether a user prompt needs live web search. */
export function inferWebSearchIntent(prompt: string | undefined): boolean {
  const value = String(prompt || '').trim();
  if (!value) return false;
  if (value.includes('联网检索最新资料后，')) return true;
  if (EXPLICIT_RE.test(value)) return true;
  if (REALTIME_RE.test(value)) return true;
  return TIMEFUL_RE.test(value) && QUESTION_RE.test(value);
}
