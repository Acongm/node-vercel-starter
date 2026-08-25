import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components';
import { Alert, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useModel } from '@umijs/max';
import { fetchAuthMode, fetchHealth } from '@/services/api';
import type { HealthResponse } from '@/types';

export default function DashboardPage() {
  const { initialState } = useModel('@@initialState');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [authMode, setAuthMode] = useState<Record<string, unknown> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchHealth(), fetchAuthMode()])
      .then(([healthResult, modeResult]) => {
        setHealth(healthResult);
        setAuthMode(modeResult);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const session = initialState?.session;

  return (
    <PageContainer
      title="API 控制台概览"
      subTitle="api.acongm.com 标准后台看板"
    >
      {error ? <Alert type="error" message={error} showIcon /> : null}

      <ProCard split="vertical" gutter={16} style={{ marginTop: 16 }}>
        <ProCard title="当前会话" colSpan="50%">
          <ProDescriptions column={1}>
            <ProDescriptions.Item label="邮箱">
              {session?.userInfo?.email || session?.user?.email || '-'}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="角色">
              <Tag color="gold">{session?.userInfo?.role || 'unknown'}</Tag>
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Tier">
              {session?.userInfo?.tier || '-'}
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProCard>

        <ProCard title="运行时" colSpan="50%">
          <ProDescriptions column={1}>
            <ProDescriptions.Item label="Health">
              <Tag color={health?.status === 'ok' ? 'success' : 'warning'}>
                {health?.status || 'loading'}
              </Tag>
            </ProDescriptions.Item>
            <ProDescriptions.Item label="DATA_MODE">
              {health?.dataMode || '-'}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="AI">
              {health?.aiProvider || '-'} / {health?.aiModel || '-'}
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProCard>
      </ProCard>

      <ProCard title="Auth 模式" style={{ marginTop: 16 }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {authMode ? JSON.stringify(authMode, null, 2) : '加载中...'}
        </pre>
      </ProCard>
    </PageContainer>
  );
}
