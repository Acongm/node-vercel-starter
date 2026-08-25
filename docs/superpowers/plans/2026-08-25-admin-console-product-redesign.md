# Admin Console 产品化改版方案（v2，已按 Sol 审查修订）

> 规划：Fable 5 ｜ 审查：Sol（v1 → v2 修订记录见文末）｜ 实施/验证：Composer 2.5 + Grok 4.6
> 日期：2026-08-25 ｜ 分支：main（用户要求直接线上验证）

## 1. 产品背景

本产品是**个人知识库平台**：

- 知识库内容以 GitHub 仓库（portal `content/docs`）为唯一事实源
- 通过 LLM 流水线（Vercel 构建期 / sync jobs）生成摘要、关键词、chunks 索引
- 知识库站点内嵌 AI Chat（匿名 + 登录用户），对话可引用知识库来源
- 登录体系：auth.acongm.com SSO（邮箱 + GitHub/Google OAuth）+ 遗留本地账号

`https://api.acongm.com/fe` 是唯一的运维后台。当前问题：数据表页是"裸表浏览器"（动态列、JSON 塞满单元格、无业务语义），看板无重点。

## 2. 现状盘点（数据模型 → 是否有 API）

| 表 | 内容 | 现有 API | 差距 |
|----|------|---------|------|
| `chat_logs` | 每次 AI 问答（user_id/client_id/page_path/来源/tokens） | `GET /api/ai/chat/logs`（分页+过滤） | 无用户身份解析、无会话聚合、前端列混乱 |
| `chats` / `messages` / `chat_runs` | **权威**会话持久化（Chat v2，Supabase auth.uid 所有权） | 面向 C 端 `/api/chats` | 无管理员全量视图 |
| `chat_threads` / `chat_messages` | 遗留兼容表（勿用于新功能） | - | 忽略 |
| `auth_users` | 遗留本地用户 | 仅内部登录用 | 无列表 API |
| Supabase `auth.users` | 真实用户（OAuth/邮箱/匿名） | 无 | 无列表 API（需 service_role `auth.admin.listUsers`） |
| `kb_analysis` | 流水线生成的文档摘要/关键词 | **无** | 完全没有 API 模块 |
| `kb_chunks` | 文档分块索引 | **无** | 同上 |
| `sync_jobs` / `sync_failures` | 流水线执行记录 | **无** | 同上 |
| `document_versions` / `document_heads` | 文档版本 | 无 | 本期不做（Phase 3 DocHub） |
| （不存在） | 接口调用日志 | 仅 console `appLogger` | 需新表 `api_request_logs` |

## 3. 目标信息架构（前端 /fe，扁平化 + 多 Tabs）

```
/fe
├── /dashboard        概览（KPI 卡片：今日对话数、7日活跃用户、KB 文档数、最近流水线状态、24h 错误率）
├── /debug            接口调试（自动路由清单 + 请求构造器 + 调用历史）
├── /chat-insights    对话洞察
│   ├── Tab: 会话列表   （权威 chats 表：用户/匿名标记/页面/消息数/更新时间 → 点开看 messages 完整对话，含 chat_runs 错误）
│   ├── Tab: AI 调用流水（chat_logs 遥测：时间/用户/页面/问题/回答摘要/tokens/来源数；含无 conversation_id 的散记录）
│   └── Tab: 客户端标签 （clientId → 友好名维护，现有 client-labels CRUD）
├── /knowledge        知识库索引
│   ├── Tab: 流水线执行 （sync_jobs + sync_failures：类型/状态/触发源/耗时/结果与失败原因 → 详情抽屉）
│   ├── Tab: 索引内容   （kb_analysis：路径/标题/摘要/关键词/难度/类型 → 详情抽屉内嵌该路径 chunks 预览）
│   └── Tab: 知识使用   （三组指标：① 索引覆盖 kb_chunks 按 path 聚合；② 对话中使用的知识页 chat_logs context.pagePath 聚合；③ 外部引用 sources.url 规范化聚合）
├── /users            用户
│   ├── Tab: 平台用户   （Supabase auth.users：邮箱/Provider/角色/是否匿名/注册时间/最近登录）
│   └── Tab: 本地账号   （auth_users 遗留表）
├── /request-logs     接口日志（api_request_logs 准实时 tail，5s 轮询，按路径/状态码/耗时过滤）
└── /data             原始数据表（保留现有裸表浏览器，入口后移）
```

### 前端列表规范（解决"列表异常"）

1. **禁止动态列生成**——每张业务表定义显式 `ProColumns`，宽度固定，JSON/长文本一律进详情 Drawer
2. 每个列表默认按时间倒序，顶部为轻量过滤（不用重型 search form）
3. 身份显示统一组件 `<UserCell>`：登录用户显示 `邮箱(角色)`；匿名显示 `匿名·{clientId 前 8 位}`，有 client label 则显示 label
4. tokens、耗时、状态码等数值列右对齐 + Tag 着色

## 4. 后端设计

### 4.1 新模块 `admin-insights`（全部挂 `AdminAccessGuard`）

| Endpoint | 说明 |
|----------|------|
| `GET /api/admin/routes` | Nest `DiscoveryService` + 路由元数据输出全部注册路由（method/path/controller），供接口调试页自动同步新接口。含集成测试断言代表性 `/api`、`/v1` 路由存在 |
| `GET /api/admin/chat/conversations` | **权威 `chats` 表**分页：用户身份（含匿名标记）/页面/标题/消息数/更新时间 |
| `GET /api/admin/chat/conversations/:chatId` | 单会话完整 `messages`（parts 解析）+ 关联 `chat_runs` 状态/错误 |
| `GET /api/admin/chat/logs` | chat_logs 遥测流水：`?user=&clientId=&pagePath=&conversationId=&q=&from=&to=&page=`；**服务端分页过滤（Supabase query，不得全表拉回）**；join 用户身份（LRU 缓存 TTL 10min）+ client labels；无 conversation_id 的记录按独立条目展示（不聚合） |
| `GET /api/admin/kb/jobs` | sync_jobs 分页（status/job_type 过滤）+ payload/result/error |
| `GET /api/admin/kb/failures` | sync_failures 分页（未解决优先，含 retry_count/next_retry_at/context） |
| `GET /api/admin/kb/analysis` | kb_analysis 分页（path/关键词搜索） |
| `GET /api/admin/kb/chunks` | kb_chunks 分页（path 过滤，服务 analysis 详情抽屉） |
| `GET /api/admin/kb/usage` | 三组指标：`coverage`（kb_chunks 按 path 聚合 chunk 数/token 合计）、`chatPages`（chat_logs context.pagePath 聚合）、`citations`（sources.url 规范化去 fragment/tracking 参数后聚合）。`?days=30&limit=20` |
| `GET /api/admin/users` | Supabase `auth.admin.listUsers` 分页 + `is_anonymous` 标记 + app_metadata.role；service_role 缺失时返回 `{ enabled: false, reason }` |
| `GET /api/admin/users/local` | auth_users 表分页 |
| `GET /api/admin/request-logs` | api_request_logs tail：`?sinceId=&path=&status=&limit=100`；sink 未启用时返回 `{ enabled: false }` |
| `GET /api/admin/overview` | Dashboard KPI 一次拉齐（各表 count + 最近 job + 24h 错误率） |

实现要点（Sol 修订后）：

- 模块内部拆分 controller/service：`chat`、`kb`、`users`、`routes`、`request-logs`，共享导出 `SupabaseAdminClientService`（不复用 AdminDataService 私有方法）
- **所有列表均服务端分页/过滤**（现有 ChatLogsService 全表拉回的模式不得复制）
- service_role 判定显式化：`auth.admin.listUsers` 依赖真正的 `SUPABASE_SERVICE_ROLE_KEY`，不能只看 `supabase.apiKey`（有 `SUPABASE_API_KEY` 回退）；能力探测失败时接口返回结构化 `{ enabled: false }`，前端展示引导而非报错
- 匿名用户判定：`auth.users.is_anonymous`；无 user 记录回退 `client_id` 展示

### 4.2 新迁移 `20260825xxxxxx_api_request_logs.sql`

```sql
create table if not exists public.api_request_logs (
  id bigint generated always as identity primary key,
  request_id text,
  method text not null,
  path text not null,
  status_code integer not null,
  duration_ms integer not null,
  user_id text,
  client_id text,
  origin text,
  user_agent text,
  error_message text,
  created_at timestamptz not null default now()
);
create index on public.api_request_logs (created_at desc);
create index on public.api_request_logs (path, created_at desc);
-- RLS: service_role only（同 auth_users 模式）
```

写入（Sol 修订后）：

- 扩展 `httpRequestLogMiddleware`：`res.on('finish')` 内构造 insert Promise，**Vercel 环境用 `@vercel/functions` 的 `waitUntil()` 保证后台完成**；非 Vercel 环境直接异步执行并 catch 上报 console（不静默）
- 跳过 `/fe`、`/legacy`、静态资源、`/api/health`、`/api/admin/request-logs` 自身
- **query string 脱敏**：只存 pathname，不存 query；error_message 通过 `res.locals.errorMessage`（HttpExceptionFilter 写入）传递
- 保留策略：交给 Supabase pg_cron / 手动清理 SQL（写入路径不做概率删除）；迁移内附带清理语句注释
- 能力开关：`REQUEST_LOG_SINK=supabase|off`（默认 off；线上显式开启），sink 关闭时 `/api/admin/request-logs` 返回 `{ enabled: false }`（HTTP 200）

### 4.3 chat_logs 无 schema 变更

页面、用户、会话字段均已存在（`user_id`/`client_id`/`context.pagePath`/`conversation_id`/`sources`），只补查询逻辑。**不改表**。

## 5. 实施拆分

| 阶段 | 负责 | 内容 |
|------|------|------|
| A 后端 | Composer 2.5 | 迁移 SQL、admin-insights 模块（routes/chat/kb/users/request-logs/overview）、request-log 落库中间件、单测 |
| B 前端 | Composer 2.5 | /fe 信息架构重构：6 个页面 + 显式列定义 + UserCell + 详情 Drawer + Debug 页路由清单联动 |
| C 验证 | Grok 4.6 | typecheck、jest、build:admin、本地 e2e smoke（curl + 浏览器）、修复问题 |
| D 上线 | 主控 | 合入 main、push、线上 curl 验证 |

## 6. 风险与取舍

- `auth.admin.listUsers` 依赖真 service_role key；能力探测 + `{ enabled: false }` 优雅降级
- `kb/usage` 首版用 Node 聚合（近 30 天，上限 5000 行 chat_logs），量大后再迁 SQL RPC
- request-logs 用 `waitUntil` 保证 Vercel 后台写完成；QPS 低，单条 insert 可接受
- Debug 页不做 SSE/流式接口调试（后续版本）；支持 path 参数替换、自定义 header/body、复制 cURL、调用历史（localStorage）
- `/data` 裸表浏览器保留但降级为工具入口

## 7. Sol 审查修订记录（v1 → v2）

1. **会话数据源改为权威表**：`chats`/`messages`/`chat_runs`（chat_threads 为遗留表，不用）；chat_logs 降级为"AI 调用流水"遥测视图
2. **request-logs 写入可靠性**：waitUntil 替代 fire-and-forget；概率删除改为 cron/手动；query 脱敏；失败上报 console
3. **知识使用指标拆三组**：索引覆盖 / 对话知识页 / 外部引用（sources 主要是 web search 结果，不能代表 KB 索引命中）
4. **service_role 显式探测**：`SUPABASE_API_KEY` 回退不能证明 admin API 可用
5. **补 sync_failures 端点**；kb chunks 移入 analysis 详情抽屉；"热门索引"改名"知识使用"
6. **routes 用 DiscoveryService**（不依赖 Express `_router.stack` 私有结构），补集成测试
