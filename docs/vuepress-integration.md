# VuePress Chat 集成指南

将 [`vuepress-chat-client.js`](./vuepress-chat-client.js) 复制到 VuePress 项目，例如：

```text
docs/.vuepress/utils/chat-client.js
```

## 请求头约定

| Header | 说明 |
|--------|------|
| `x-client-id` | 浏览器 localStorage 持久化的匿名用户 ID |
| `x-call-source` | 调用来源标识，每个入口必须唯一 |
| `x-conversation-id` | 同页面会话 ID，默认按 pagePath 存 sessionStorage |

## 调用示例

```javascript
import { chatRequest } from './utils/chat-client.js';

// 文章页侧边栏 — callSource: vuepress:article-sidebar
const response = await chatRequest('/api/ai/chat', {
  messages: [{ role: 'user', content: question }],
  context: {
    scope: 'article',
    pagePath: '/daily-news/2026-06-13.md',
    moduleKey: 'daily-news',
    title: '每日科技动态',
    tags: ['前端', 'AI'],
  },
  enableWebSearch: true,
}, 'vuepress:article-sidebar');
```

VuePress 客户端已集成于 [`~/code/github/vuepress`](../../vuepress)：

- [`docs/.vuepress/utils/chat-client.js`](../../vuepress/docs/.vuepress/utils/chat-client.js)
- [`docs/.vuepress/utils/chat-v1-stream.js`](../../vuepress/docs/.vuepress/utils/chat-v1-stream.js) — 自动附加请求头
- [`docs/.vuepress/components/ai/AIChatPanel.vue`](../../vuepress/docs/.vuepress/components/ai/AIChatPanel.vue) — 按 scope 选择 callSource

## callSource 命名

| callSource | 场景 |
|------------|------|
| `vuepress:article-panel` | 阅读助手，当前文章模式 |
| `vuepress:module-panel` | 阅读助手，本模块模式 |
| `vuepress:article-panel:web` | 当前文章 + 联网检索 |
| `vuepress:module-panel:web` | 本模块 + 联网检索 |

## 查找现有调用点

在 VuePress 项目中搜索：

```bash
rg "api\\.acongm\\.com|/api/ai/chat|/api/ai/v1/chat" .
```

将每个 `fetch()` / `axios.post()` 替换为 `chatRequest()`，并为该位置指定唯一 `callSource`。

## 查看记录

管理员访问 [https://api.acongm.com/chat-logs.html](https://api.acongm.com/chat-logs.html)，使用项目统一账号（`AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD`）登录后即可全量查看。
