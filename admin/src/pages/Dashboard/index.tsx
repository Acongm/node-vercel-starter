import { useEffect, useState } from 'react';
import { history, useModel } from '@umijs/max';
import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components';
import { Button, Space, Table, Tag, Typography } from 'antd';
import { fetchJson } from '../../services/session';
import { ENDPOINT_GROUPS } from '../../constants/endpoints';

interface HealthPayload {
  ok?: boolean;
  appName?: string;
  dataMode?: string;
  authMode?: string;
  aiProvider?: string;
  aiModel?: string;
  runtimeTarget?: string;
}

interface AdminTableMeta {
  key: string;
  title: string;
  source: 'store' | 'supabase';
  description: string;
}

export default function DashboardPage() {
  const { initialState } = useModel('@@initialState');
  const [health, setHealth] = useState<HealthPayload>();
  const [tables, setTables] = useState<AdminTableMeta[]>([]);

  useEffect(() => {
    void fetchJson<HealthPayload>('/api/health').then((result) => {
      if (result.ok && typeof result.body !== 'string') {
        setHealth(result.body);
      }
    });
    void fetchJson<{ tables: AdminTableMeta[] }>('/api/admin/tables').then((result) => {
      if (result.ok && typeof result.body !== 'string') {
        setTables(result.body.tables);
      }
    });
  }, []);

  const user = initialState?.session?.user;

  return (
    <PageContainer title="总览">
      <StatisticCard.Group direction="row">
        <StatisticCard
          statistic={{
            title: '登录账号',
            value: user?.email || user?.name || '-',
          }}
        />
        <StatisticCard
          statistic={{ title: '角色', value: initialState?.session?.role || '-' }}
        />
        <StatisticCard statistic={{ title: '数据模式', value: health?.dataMode || '-' }} />
        <StatisticCard statistic={{ title: 'AI 模型', value: health?.aiModel || '-' }} />
      </StatisticCard.Group>

      <ProCard title="运行时" style={{ marginTop: 16 }} extra={health?.ok ? <Tag color="green">healthy</Tag> : null}>
        <Typography.Paragraph>
          {health?.appName} · {health?.runtimeTarget} · auth={health?.authMode} ·
          provider={health?.aiProvider}
        </Typography.Paragraph>
        <Space>
          <Button type="primary" onClick={() => history.push('/data')}>
            查看数据表
          </Button>
          <Button onClick={() => history.push('/console')}>接口调试</Button>
        </Space>
      </ProCard>

      <ProCard title="可查看的数据表" style={{ marginTop: 16 }}>
        <Table
          rowKey="key"
          dataSource={tables}
          pagination={false}
          columns={[
            { title: '表', dataIndex: 'title' },
            { title: 'Key', dataIndex: 'key' },
            {
              title: '来源',
              dataIndex: 'source',
              render: (value: AdminTableMeta['source']) => (
                <Tag color={value === 'store' ? 'blue' : 'purple'}>{value}</Tag>
              ),
            },
            { title: '说明', dataIndex: 'description' },
            {
              title: '操作',
              render: (_, record) => (
                <Button type="link" onClick={() => history.push(`/data/${record.key}`)}>
                  打开
                </Button>
              ),
            },
          ]}
        />
      </ProCard>

      <ProCard title="接口调试分组" style={{ marginTop: 16 }}>
        <Table
          rowKey="key"
          dataSource={ENDPOINT_GROUPS}
          pagination={false}
          columns={[
            { title: '分组', dataIndex: 'title' },
            { title: '路径', dataIndex: 'paths', render: (paths: string[]) => paths.join(' · ') },
            {
              title: '操作',
              render: (_, record) => (
                <Button type="link" onClick={() => history.push(`/console/${record.key}`)}>
                  调试
                </Button>
              ),
            },
          ]}
        />
      </ProCard>
    </PageContainer>
  );
}
