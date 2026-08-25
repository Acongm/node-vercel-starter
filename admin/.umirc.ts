import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: 'API Admin',
  },
  history: { type: 'hash' },
  hash: false,
  outputPath: '../public',
  publicPath: '/',
  npmClient: 'npm',
  mfsu: false,
  title: 'API Admin · api.acongm.com',
  favicons: ['/favicon.ico'],
  links: [
    { rel: 'icon', href: '/icon.png', type: 'image/png', sizes: '32x32' },
  ],
  routes: [
    {
      path: '/user/login',
      layout: false,
      component: './user/Login',
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      name: '总览',
      path: '/dashboard',
      icon: 'DashboardOutlined',
      component: './Dashboard',
      access: 'canAdmin',
    },
    {
      name: '数据列表',
      path: '/data',
      icon: 'TableOutlined',
      access: 'canAdmin',
      routes: [
        { path: '/data', component: './data/index', hideInMenu: true },
        {
          path: '/data/:table',
          component: './data/TablePage',
          hideInMenu: true,
        },
      ],
    },
    {
      name: '接口调试',
      path: '/console',
      icon: 'ApiOutlined',
      access: 'canAdmin',
      routes: [
        { path: '/console', component: './console/index', hideInMenu: true },
        {
          path: '/console/:group',
          component: './console/Playground',
          hideInMenu: true,
        },
      ],
    },
    {
      path: '/403',
      layout: false,
      component: './403',
    },
  ],
});
