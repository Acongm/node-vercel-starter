import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: 'API Console',
    locale: false,
  },
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', layout: false, component: './Login' },
    {
      path: '/dashboard',
      name: '概览',
      icon: 'DashboardOutlined',
      component: './Dashboard',
    },
    {
      path: '/data',
      name: '数据表',
      icon: 'DatabaseOutlined',
      component: './Data',
    },
    {
      path: '/data/:tableKey',
      component: './Data/Table',
      hideInMenu: true,
    },
    {
      path: '/chat-logs',
      name: 'Chat Logs',
      icon: 'MessageOutlined',
      component: './ChatLogs',
    },
    {
      path: '/debug',
      name: '接口调试',
      icon: 'ApiOutlined',
      component: './Debug',
    },
  ],
  outputPath: '../public',
  publicPath: '/',
  history: { type: 'browser' },
  npmClient: 'npm',
  hash: true,
  esbuildMinifyIIFE: true,
});
