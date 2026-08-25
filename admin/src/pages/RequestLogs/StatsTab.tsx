import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Alert, Col, Row, Select, Space, Statistic, Switch, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { fetchRequestLogStats } from '@/services/api';
import type { RequestLogRouteStat, RequestLogStatsResponse } from '@/types';

const MIGRATION_PATH =
  'supabase/migrations/20260825143000_api_request_logs_monitoring.sql';

const GROUP_LABELS: Record<RequestLogRouteStat['routeGroup'], string> = {
  auth: 'Auth',
  chat: 'Chat',
  admin: 'Admin',
  ai: 'AI',
  other: 'Other',
};

const GROUP_COLORS: Record<RequestLogRouteStat['routeGroup'], string> = {
  auth: 'blue',
  chat: 'purple',
  admin: 'cyan',
  ai: 'gold',
  other: 'default',
};

type StatsState =
  | { kind: 'loading' }
  | { kind: 'disabled'; reason?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: RequestLogStatsResponse };

function latencyTag(ms: number) {
  if (ms >= 1000) {
    return <Tag color="red">{ms} ms</Tag>;
  }
  if (ms >= 500) {
    return <Tag color="orange">{ms} ms</Tag>;
  }
  return <Tag color="green">{ms} ms</Tag>;
}

const routeColumns: ProColumns<RequestLogRouteStat>[] = [
  {
    title: '分组',
    dataIndex: 'routeGroup',
    width: 80,
    render: (_, record) => (
      <Tag color={GROUP_COLORS[record.routeGroup]}>
        {GROUP_LABELS[record.routeGroup]}
      </Tag>
    ),
  },
  {
    title: 'Method',
    dataIndex: 'method',
    width: 80,
    render: (_, record) => <Tag>{record.method}</Tag>,
  },
  {
    title: '路径',
    dataIndex: 'path',
    width: 280,
    ellipsis: true,
  },
  {
    title: '请求数',
    dataIndex: 'requestCount',
    width: 80,
    align: 'right',
  },
  {
    title: '错误数',
    dataIndex: 'errorCount',
    width: 80,
    align: 'right',
    render: (_, record) =>
      record.errorCount > 0 ? <Tag color="red">{record.errorCount}</Tag> : '0',
  },
  {
    title: 'Avg',
    dataIndex: 'avgMs',
    width: 90,
    align: 'right',
    render: (_, record) => latencyTag(record.avgMs),
  },
  {
    title: 'P50',
    dataIndex: 'p50Ms',
    width: 90,
    align: 'right',
    render: (_, record) => latencyTag(record.p50Ms),
  },
  {
    title: 'P95',
    dataIndex: 'p95Ms',
    width: 90,
    align: 'right',
    render: (_, record) => latencyTag(record.p95Ms),
  },
  {
    title: 'Max',
    dataIndex: 'maxMs',
    width: 90,
    align: 'right',
    render: (_, record) => latencyTag(record.maxMs),
  },
];

export default function StatsTab() {
  const [state, setState] = useState<StatsState>({ kind: 'loading' });
  const [hours, setHours] = useState(24);
  const [group, setGroup] = useState<'all' | RequestLogRouteStat['routeGroup']>(
    'all',
  );
  const [excludeStream, setExcludeStream] = useState(true);

  const loadStats = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetchRequestLogStats({
        hours,
        group: group === 'all' ? undefined : group,
        excludeStream,
        limit: 50,
      });
      if (!response.enabled) {
        setState({ kind: 'disabled', reason: response.reason });
        return;
      }
      setState({ kind: 'ready', data: response });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : '加载失败',
      });
    }
  }, [hours, group, excludeStream]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (state.kind === 'loading') {
    return <Alert type="info" message="加载统计中…" showIcon />;
  }

  if (state.kind === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message="加载接口统计失败"
        description={state.message}
        action={
          <a onClick={loadStats} style={{ marginLeft: 8 }}>
            重试
          </a>
        }
      />
    );
  }

  if (state.kind === 'disabled') {
    if (state.reason === 'migration_missing') {
      return (
        <Alert
          type="warning"
          showIcon
          message="尚未执行监控迁移"
          description={
            <>
              <p>请在 Supabase 中执行：</p>
              <pre style={{ marginTop: 8 }}>{MIGRATION_PATH}</pre>
            </>
          }
        />
      );
    }

    return (
      <Alert
        type="info"
        showIcon
        message="REQUEST_LOG_SINK 未启用"
        description="配置 REQUEST_LOG_SINK=supabase 并确保 api_request_logs 表已迁移。"
      />
    );
  }

  const data = state.data;
  if (!data.enabled) {
    return null;
  }

  const authGroup = data.groups.find((item) => item.routeGroup === 'auth');
  const chatGroup = data.groups.find((item) => item.routeGroup === 'chat');

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Select
          value={hours}
          onChange={setHours}
          style={{ width: 140 }}
          options={[
            { value: 24, label: '近 24 小时' },
            { value: 72, label: '近 3 天' },
            { value: 168, label: '近 7 天' },
          ]}
        />
        <Select
          value={group}
          onChange={setGroup}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: '全部分组' },
            { value: 'auth', label: 'Auth' },
            { value: 'chat', label: 'Chat' },
            { value: 'admin', label: 'Admin' },
            { value: 'ai', label: 'AI' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Switch
          checkedChildren="排除流式"
          unCheckedChildren="含流式"
          checked={excludeStream}
          onChange={setExcludeStream}
        />
        <Tag>
          样本 {data.sampleCount} · {data.source === 'rpc' ? 'DB 聚合' : '采样聚合'}
        </Tag>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Auth P95"
            value={authGroup?.p95Ms ?? '—'}
            suffix={authGroup ? 'ms' : undefined}
            valueStyle={{
              color: authGroup && authGroup.p95Ms >= 1000 ? '#cf1322' : undefined,
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="Chat P95"
            value={chatGroup?.p95Ms ?? '—'}
            suffix={chatGroup ? 'ms' : undefined}
            valueStyle={{
              color: chatGroup && chatGroup.p95Ms >= 1000 ? '#cf1322' : undefined,
            }}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic title="Auth 请求数" value={authGroup?.requestCount ?? 0} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Statistic title="Chat 请求数" value={chatGroup?.requestCount ?? 0} />
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="优化对比提示"
        description="记录优化前的 P95 数值，部署后再查看同时间窗口对比。流式接口（*/stream）默认排除，避免 LLM 生成时间拉高查询类平均耗时。"
      />

      <ProTable<RequestLogRouteStat>
        rowKey={(record) => `${record.method}:${record.path}`}
        columns={routeColumns}
        search={false}
        dataSource={data.routes}
        pagination={{ pageSize: 20 }}
        toolBarRender={false}
        scroll={{ x: 1100 }}
        tableLayout="fixed"
      />
    </Space>
  );
}
