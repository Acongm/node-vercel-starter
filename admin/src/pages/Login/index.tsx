import { Button, Card, Result, Spin } from 'antd';
import { useEffect } from 'react';
import { getAuthLoginUrl, getFeDashboardUrl } from '@/utils/auth';

export default function LoginPage() {
  useEffect(() => {
    window.location.href = getAuthLoginUrl(getFeDashboardUrl());
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 420 }}>
        <Result
          icon={<Spin size="large" />}
          title="正在跳转到 auth.acongm.com"
          subTitle="请使用白名单管理员账号登录后返回控制台。"
          extra={
            <Button
              type="primary"
              onClick={() => {
                window.location.href = getAuthLoginUrl(getFeDashboardUrl());
              }}
            >
              立即登录
            </Button>
          }
        />
      </Card>
    </div>
  );
}
