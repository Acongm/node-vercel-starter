import { useState } from 'react';
import { history, useModel } from '@umijs/max';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Alert, Button, Card, Space, Typography } from 'antd';
import {
  DEFAULT_LOGIN_URL,
  fetchJson,
  fetchSession,
  writeAdminToken,
} from '../../services/session';

type LoginFormValues = {
  username: string;
  password: string;
};

type LoginResult = {
  accessToken?: string;
};

export default function LoginPage() {
  const { setInitialState } = useModel('@@initialState');
  const [error, setError] = useState<string>();

  const loginUrl = DEFAULT_LOGIN_URL;

  const handleSso = () => {
    window.location.href = loginUrl;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 24,
      }}
    >
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          API Admin
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          后台看板只对白名单管理员开放。请先通过
          <code> auth.acongm.com </code>
          登录（
          <code>o.arvin.peng@gmail.com</code> / <code>acongm@126.com</code>
          ）。
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button type="primary" block size="large" onClick={handleSso}>
            使用 auth.acongm.com 登录
          </Button>
          <Typography.Text type="secondary">本地管理员账号（AUTH_ADMIN_*）</Typography.Text>
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <LoginForm<LoginFormValues>
            submitter={{ searchConfig: { submitText: '本地登录' } }}
            onFinish={async (values) => {
              setError(undefined);
              const result = await fetchJson<LoginResult>('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  username: values.username,
                  password: values.password,
                }),
              });
              if (!result.ok || typeof result.body === 'string' || !result.body.accessToken) {
                setError(
                  typeof result.body === 'string'
                    ? result.body
                    : '登录失败，请检查本地管理员账号。',
                );
                return false;
              }
              writeAdminToken(result.body.accessToken);
              const session = await fetchSession();
              await setInitialState({ session });
              if (!session.isAdmin) {
                history.replace('/403');
                return false;
              }
              history.replace('/dashboard');
              return true;
            }}
          >
            <ProFormText
              name="username"
              fieldProps={{ prefix: <UserOutlined /> }}
              placeholder="管理员用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{ prefix: <LockOutlined /> }}
              placeholder="管理员密码"
              rules={[{ required: true, message: '请输入密码' }]}
            />
          </LoginForm>
        </Space>
      </Card>
    </div>
  );
}
