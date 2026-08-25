import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Drawer, Input, Select, Space, Spin, Switch, Tag } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRequestLogs } from '@/services/api';
import type { RequestLogRow, RequestLogsResponse } from '@/types';
import { formatDateTime, httpStatusTagColor, idPrefix } from '@/utils/format';

const MAX_ROWS = 500;
const POLL_INTERVAL_MS = 5000;
const MIGRATION_PATH = 'supabase/migrations/20260825090000_api_request_logs.sql';

type StatusClass = 'all' | '2xx' | '4xx' | '5xx';
type PageState =
  | { kind: 'loading' }
  | { kind: 'disabled'; reason?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

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
    width: 260,
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
    title: '来源',
    dataIndex: 'call_source',
    width: 160,
    ellipsis: true,
  },
  {
    title: '调用方',
    dataIndex: 'caller_kind',
    width: 80,
    render: (_, record) =>
      record.caller_kind ? <Tag>{record.caller_kind}</Tag> : '—',
  },
  {
    title: '错误',
    dataIndex: 'error_message',
    width: 200,
    ellipsis: true,
  },
];

export default function RequestLogsPage() {
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
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
        setPageState({ kind: 'disabled', reason: response.reason });
        return;
      }
      setPageState({ kind: 'ready' });
      mergeRows(response.items, incremental);
    },
    [mergeRows, pathFilter],
  );

  const retryLoad = useCallback(() => {
    setPageState({ kind: 'loading' });
    loadLogs(false).catch((err: Error) => {
      setPageState({ kind: 'error', message: err.message });
    });
  }, [loadLogs]);

  useEffect(() => {
    retryLoad();
  }, [retryLoad]);

  useEffect(() => {
    if (!autoRefresh || paused || pageState.kind !== 'ready') {
      return;
    }
    const timer = window.setInterval(() => {
      loadLogs(true).catch((err: Error) => {
        setPageState({ kind: 'error', message: err.message });
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, paused, pageState.kind, loadLogs]);

  if (pageState.kind === 'loading') {
    return (
      <PageContainer title="接口日志">
        <Spin tip="加载中..." />
      </PageContainer>
    );
  }

  if (pageState.kind === 'error') {
    return (
      <PageContainer title="接口日志">
        <Alert
          type="error"
          showIcon
          message="加载接口日志失败"
          description={pageState.message}
          action={
            <Button size="small" onClick={retryLoad}>
              重试
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (pageState.kind === 'disabled') {
    if (pageState.reason === 'migration_missing') {
      return (
        <PageContainer title="接口日志">
          <Alert
            type="warning"
            showIcon
            message="尚未执行 api_request_logs 迁移"
            description={
              <>
                <p>请在 Supabase 中执行以下迁移文件：</p>
                <pre style={{ marginTop: 8 }}>{MIGRATION_PATH}</pre>
              </>
            }
          />
        </PageContainer>
      );
    }

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
# 或留空并在 DATA_MODE=supabase 时自动启用
# 并确保 api_request_logs 表已迁移`}
              </pre>
            </>
          }
        />
      </PageContainer>
    );
  }

  const filteredRows = rows.filter((row) => matchesStatusClass(row.status_code, statusClass));
  const scrollX = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

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
        scroll={{ x: scrollX }}
        tableLayout="fixed"
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
