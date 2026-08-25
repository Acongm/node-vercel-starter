import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Drawer, Input, Select, Space, Switch, Tag } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRequestLogs } from '@/services/api';
import type { RequestLogRow, RequestLogsResponse } from '@/types';
import { formatDateTime, httpStatusTagColor, idPrefix } from '@/utils/format';

const MAX_ROWS = 500;
const POLL_INTERVAL_MS = 5000;

type StatusClass = 'all' | '2xx' | '4xx' | '5xx';

function matchesStatusClass(statusCode: number, statusClass: StatusClass): boolean {
  if (statusClass === 'all') {
    return true;
  }
  if (statusClass === '2xx') {
    return statusCode >= 200 && statusCode < 300;
  }
  if (statusClass === '4xx') {
    return statusCode >= 400 && statusCode < 500;
  }
  if (statusClass === '5xx') {
    return statusCode >= 500;
  }
  return true;
}

const columns: ProColumns<RequestLogRow>[] = [
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 170,
    render: (_, record) => formatDateTime(record.created_at),
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
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status_code',
    width: 80,
    align: 'right',
    render: (_, record) => (
      <Tag color={httpStatusTagColor(record.status_code)}>{record.status_code}</Tag>
    ),
  },
  {
    title: '耗时',
    dataIndex: 'duration_ms',
    width: 90,
    align: 'right',
    render: (_, record) => `${record.duration_ms} ms`,
  },
  {
    title: 'Client',
    dataIndex: 'client_id',
    width: 90,
    ellipsis: true,
    render: (_, record) => idPrefix(record.client_id),
  },
  {
    title: '错误',
    dataIndex: 'error_message',
    ellipsis: true,
  },
];

export default function RequestLogsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<RequestLogRow[]>([]);
  const [pathFilter, setPathFilter] = useState('');
  const [statusClass, setStatusClass] = useState<StatusClass>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<RequestLogRow | null>(null);
  const maxIdRef = useRef(0);

  const mergeRows = useCallback((incoming: RequestLogRow[], incremental: boolean) => {
    setRows((prev) => {
      const combined = incremental ? [...incoming, ...prev] : incoming;
      const deduped = new Map<number, RequestLogRow>();
      for (const row of combined) {
        deduped.set(row.id, row);
      }
      const sorted = [...deduped.values()].sort((a, b) => b.id - a.id);
      const trimmed = sorted.slice(0, MAX_ROWS);
      if (trimmed.length > 0) {
        maxIdRef.current = Math.max(...trimmed.map((row) => row.id));
      }
      return trimmed;
    });
  }, []);

  const loadLogs = useCallback(
    async (incremental: boolean) => {
      const response: RequestLogsResponse = await fetchRequestLogs({
        sinceId: incremental ? maxIdRef.current : undefined,
        path: pathFilter || undefined,
        limit: 100,
      });
      if (!response.enabled) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      mergeRows(response.items, incremental);
    },
    [mergeRows, pathFilter],
  );

  useEffect(() => {
    loadLogs(false).catch(() => setEnabled(false));
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh || paused || enabled === false) {
      return;
    }
    const timer = window.setInterval(() => {
      loadLogs(true).catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, paused, enabled, loadLogs]);

  if (enabled === false) {
    return (
      <PageContainer title="接口日志">
        <Alert
          type="info"
          showIcon
          message="REQUEST_LOG_SINK 未启用"
          description={
            <>
              <p>接口调用日志落库功能当前关闭。请在 .env 中配置：</p>
              <pre style={{ marginTop: 8 }}>
{`REQUEST_LOG_SINK=supabase
# 并确保 api_request_logs 表已迁移`}
              </pre>
            </>
          }
        />
      </PageContainer>
    );
  }

  const filteredRows = rows.filter((row) => matchesStatusClass(row.status_code, statusClass));

  return (
    <PageContainer title="接口日志" subTitle="api_request_logs 准实时 tail">
      <Space style={{ marginBottom: 16 }} wrap>
        <Switch
          checkedChildren="自动刷新"
          unCheckedChildren="自动刷新"
          checked={autoRefresh}
          onChange={setAutoRefresh}
        />
        <Switch
          checkedChildren="继续"
          unCheckedChildren="暂停"
          checked={!paused}
          onChange={(value) => setPaused(!value)}
        />
        <Select
          value={statusClass}
          onChange={setStatusClass}
          style={{ width: 120 }}
          options={[
            { value: 'all', label: '全部状态' },
            { value: '2xx', label: '2xx' },
            { value: '4xx', label: '4xx' },
            { value: '5xx', label: '5xx' },
          ]}
        />
        <Input
          placeholder="路径包含"
          value={pathFilter}
          onChange={(event) => setPathFilter(event.target.value)}
          onPressEnter={() => loadLogs(false).catch(() => undefined)}
          style={{ width: 200 }}
        />
      </Space>

      <ProTable<RequestLogRow>
        rowKey="id"
        columns={columns}
        search={false}
        dataSource={filteredRows}
        pagination={{ pageSize: 50 }}
        toolBarRender={false}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />

      <Drawer
        open={Boolean(selected)}
        title="请求日志详情"
        width={720}
        onClose={() => setSelected(null)}
      >
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {selected ? JSON.stringify(selected, null, 2) : ''}
        </pre>
      </Drawer>
    </PageContainer>
  );
}
