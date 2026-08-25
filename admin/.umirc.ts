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
      path: '/debug',
      name: '接口调试',
      icon: 'ApiOutlined',
      component: './Debug',
    },
    {
      path: '/chat-insights',
      name: '对话洞察',
      icon: 'MessageOutlined',
      component: './ChatInsights',
    },
    {
      path: '/knowledge',
      name: '知识库',
      icon: 'BookOutlined',
      component: './Knowledge',
    },
    {
      path: '/users',
      name: '用户',
      icon: 'TeamOutlined',
      component: './Users',
    },
    {
      path: '/request-logs',
      name: '接口日志',
      icon: 'FileTextOutlined',
      component: './RequestLogs',
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
  ],
  base: '/fe',
  outputPath: '../public/fe',
  publicPath: '/fe/',
  history: { type: 'browser' },
  npmClient: 'npm',
  hash: true,
  esbuildMinifyIIFE: true,
});
