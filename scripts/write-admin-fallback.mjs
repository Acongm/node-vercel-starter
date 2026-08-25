import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/icon.png" type="image/png" sizes="32x32" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="any" />
    <meta http-equiv="refresh" content="0;url=/#/data/chat_logs" />
    <title>Chat Logs</title>
  </head>
  <body>
    <p>Chat Logs 已迁到后台看板，<a href="/#/data/chat_logs">点击进入</a>。</p>
  </body>
</html>
`;

writeFileSync(join(process.cwd(), 'public/chat-logs.html'), html);
console.log('wrote public/chat-logs.html redirect');
