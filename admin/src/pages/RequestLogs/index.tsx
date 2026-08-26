import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Col, Drawer, Input, Row, Segmented, Select, Space, Spin, Statistic, Switch, Tag } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRequestLogStats, fetchRequestLogs } from '@/services/api';
import type {
  RequestLogCallSourceStat,
  RequestLogCallerKindStat,
  RequestLogPathSort,
  RequestLogPathStat,
  RequestLogRouteGroupStat,
  RequestLogRow,
  RequestLogSortOrder,
  RequestLogStats,
  RequestLogsResponse,
} from '@/types';
import { formatDateTime, formatPercent, httpStatusTagColor, idPrefix } from '@/utils/format';

const MAX_ROWS = 500;
const POLL_INTERVAL_MS = 5000;
const MIGRATION_PATH = 'supabase/migrations/20260825090000_api_request_logs.sql';
const STATS_FN_PATH = 'supabase/migrations/20260825153000_api_request_logs_stats_sort_order.sql';
const ROUTE_META_PATH = 'supabase/migrations/20260825143100_api_request_logs_route_meta.sql';

const PATH_COLUMN_TO_SORT: Record<string, RequestLogPathSort> = {
  count: 'count',
  avg_duration_ms: 'avg_duration',
  p95_ms: 'p95',
  max_duration_ms: 'max_duration',
  errors: 'errors',
};

function buildPathStatColumns(
  pathSort: RequestLogPathSort,
  pathSortOrder: RequestLogSortOrder,
): ProColumns<RequestLogPathStat>[] {
  const activeOrder = (field: RequestLogPathSort): SortOrder | undefined => {
    if (pathSort !== field) {
      return undefined;
    }
    return pathSortOrder === 'asc' ? 'ascend' : 'descend';
  };

  return [
    { title: 'Method', dataIndex: 'method', width: 80 },
    { title: '路径', dataIndex: 'path', ellipsis: true },
    {
      title: '请求数',
      dataIndex: 'count',
      width: 90,
      align: 'right',
      sorter: { compare: () => 0 },
      sortOrder: activeOrder('count'),
    },
    {
      title: 'Avg',
      dataIndex: 'avg_duration_ms',
      width: 90,
      align: 'right',
      sorter: { compare: () => 0 },
      sortOrder: activeOrder('avg_duration'),
      render: (_, record) => `${record.avg_duration_ms} ms`,
    },
    {
      title: 'P95',
      dataIndex: 'p95_ms',
      width: 90,
      align: 'right',
      sorter: { compare: () => 0 },
      sortOrder: activeOrder('p95'),
      render: (_, record) =>
        record.p95_ms != null ? (
          <Tag color={record.p95_ms >= 1000 ? 'red' : record.p95_ms >= 500 ? 'orange' : 'green'}>
            {record.p95_ms} ms
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Max',
      dataIndex: 'max_duration_ms',
      width: 90,
      align: 'right',
      sorter: { compare: () => 0 },
      sortOrder: activeOrder('max_duration'),
      render: (_, record) =>
        record.max_duration_ms != null ? `${record.max_duration_ms} ms` : '—',
    },
    {
      title: '5xx',
      dataIndex: 'errors',
      width: 70,
      align: 'right',
      sorter: { compare: () => 0 },
      sortOrder: activeOrder('errors'),
    },
  ];
}

type StatusClass = 'all' | '2xx' | '4xx' | '5xx';
type StatsWindow = RequestLogStats['window'];
type PageState =
  | { kind: 'loading' }
  | { kind: 'disabled'; reason?: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

const CALLER_KIND_LABELS: Record<string, string> = {
  guest: '访客',
  user: '用户',
  service: '服务',
  unknown: '未知',
};

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

function renderCallerKind(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return CALLER_KIND_LABELS[value] ?? value;
}

const logColumns: ProColumns<RequestLogRow>[] = [
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
    title: '分组',
    dataIndex: 'route_group',
    width: 80,
    render: (_, record) =>
      record.route_group ? <Tag>{record.route_group}</Tag> : '—',
  },
  {
    title: '流式',
    dataIndex: 'is_stream',
    width: 60,
    render: (_, record) =>
      record.is_stream ? <Tag color="purple">SSE</Tag> : '—',
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
    render: (_, record) => (
      <Tag>{renderCallerKind(record.caller_kind)}</Tag>
    ),
  },
  {
    title: '错误',
    dataIndex: 'error_message',
    width: 200,
    ellipsis: true,
  },
];

const routeGroupColumns: ProColumns<RequestLogRouteGroupStat>[] = [
  { title: '分组', dataIndex: 'route_group', width: 90 },
  { title: '请求数', dataIndex: 'count', width: 90, align: 'right' },
  {
    title: 'Avg',
    dataIndex: 'avg_duration_ms',
    width: 90,
    align: 'right',
    render: (_, record) => `${record.avg_duration_ms} ms`,
  },
  {
    title: 'P95',
    dataIndex: 'p95_ms',
    width: 90,
    align: 'right',
    render: (_, record) =>
      record.p95_ms != null ? (
        <Tag color={record.p95_ms >= 1000 ? 'red' : record.p95_ms >= 500 ? 'orange' : 'green'}>
          {record.p95_ms} ms
        </Tag>
      ) : (
        '—'
      ),
  },
  { title: '5xx', dataIndex: 'errors', width: 70, align: 'right' },
];

const callerKindColumns: ProColumns<RequestLogCallerKindStat>[] = [
  {
    title: '调用方',
    dataIndex: 'caller_kind',
    render: (_, record) => renderCallerKind(record.caller_kind),
  },
  { title: '请求数', dataIndex: 'count', width: 90, align: 'right' },
  {
    title: '平均耗时',
    dataIndex: 'avg_duration_ms',
    width: 100,
    align: 'right',
    render: (_, record) => `${record.avg_duration_ms} ms`,
  },
];

const callSourceColumns: ProColumns<RequestLogCallSourceStat>[] = [
  { title: '来源', dataIndex: 'call_source', ellipsis: true },
  { title: '请求数', dataIndex: 'count', width: 90, align: 'right' },
  {
    title: '平均耗时',
    dataIndex: 'avg_duration_ms',
    width: 100,
    align: 'right',
    render: (_, record) => `${record.avg_duration_ms} ms`,
  },
];

function RequestLogApmSummary({
  stats,
  window,
  excludeStream,
  pathSort,
  pathSortOrder,
  onWindowChange,
  onExcludeStreamChange,
  onPathSortChange,
}: {
  stats: RequestLogStats;
  window: StatsWindow;
  excludeStream: boolean;
  pathSort: RequestLogPathSort;
  pathSortOrder: RequestLogSortOrder;
  onWindowChange: (value: StatsWindow) => void;
  onExcludeStreamChange: (value: boolean) => void;
  onPathSortChange: (sort: RequestLogPathSort, order: RequestLogSortOrder) => void;
}) {
  const authGroup = stats.byRouteGroup?.find((row) => row.route_group === 'auth');
  const chatGroup = stats.byRouteGroup?.find((row) => row.route_group === 'chat');
  const pathStatColumns = useMemo(
    () => buildPathStatColumns(pathSort, pathSortOrder),
    [pathSort, pathSortOrder],
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', marginBottom: 16 }}>
      <Space wrap>
        <Segmented
          value={window}
          onChange={(value) => onWindowChange(value as StatsWindow)}
          options={[
            { label: '24 小时', value: '24h' },
            { label: '7 天', value: '7d' },
            { label: '30 天', value: '30d' },
          ]}
        />
        <Switch
          checkedChildren="排除流式"
          unCheckedChildren="含流式"
          checked={excludeStream}
          onChange={onExcludeStreamChange}
        />
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="请求总数" value={stats.total} />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="平均耗时" value={stats.avgDurationMs} suffix="ms" />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic
              title="Auth P95"
              value={authGroup?.p95_ms ?? '—'}
              suffix={authGroup?.p95_ms != null ? 'ms' : undefined}
              valueStyle={{
                color:
                  authGroup && authGroup.p95_ms != null && authGroup.p95_ms >= 1000
                    ? '#cf1322'
                    : undefined,
              }}
            />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic
              title="Chat P95"
              value={chatGroup?.p95_ms ?? '—'}
              suffix={chatGroup?.p95_ms != null ? 'ms' : undefined}
              valueStyle={{
                color:
                  chatGroup && chatGroup.p95_ms != null && chatGroup.p95_ms >= 1000
                    ? '#cf1322'
                    : undefined,
              }}
            />
          </ProCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="5xx 错误数" value={stats.errorCount} />
          </ProCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProCard>
            <Statistic title="错误率" value={formatPercent(stats.errorRate)} />
          </ProCard>
        </Col>
      </Row>

      <ProCard title="按分组（Auth / Chat 重点）" bordered>
        <ProTable<RequestLogRouteGroupStat>
          rowKey="route_group"
          columns={routeGroupColumns}
          search={false}
          dataSource={stats.byRouteGroup ?? []}
          pagination={false}
          toolBarRender={false}
          size="small"
        />
      </ProCard>

      <ProCard title="接口排行" bordered>
        <ProTable<RequestLogPathStat>
          rowKey={(row) => `${row.method}:${row.path}`}
          columns={pathStatColumns}
          search={false}
          dataSource={stats.byPath}
          pagination={false}
          toolBarRender={false}
          size="small"
          onChange={(_pagination, _filters, sorter) => {
            const active = Array.isArray(sorter) ? sorter[0] : sorter;
            if (!active?.field || !active.order) {
              return;
            }
            const mapped = PATH_COLUMN_TO_SORT[String(active.field)];
            if (!mapped) {
              return;
            }
            onPathSortChange(mapped, active.order === 'ascend' ? 'asc' : 'desc');
          }}
        />
      </ProCard>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ProCard title="按调用方" bordered>
            <ProTable<RequestLogCallerKindStat>
              rowKey="caller_kind"
              columns={callerKindColumns}
              search={false}
              dataSource={stats.byCallerKind}
              pagination={false}
              toolBarRender={false}
              size="small"
            />
          </ProCard>
        </Col>
        <Col xs={24} lg={12}>
          <ProCard title="按来源" bordered>
            <ProTable<RequestLogCallSourceStat>
              rowKey="call_source"
              columns={callSourceColumns}
              search={false}
              dataSource={stats.byCallSource}
              pagination={false}
              toolBarRender={false}
              size="small"
            />
          </ProCard>
        </Col>
      </Row>
    </Space>
  );
}

export default function RequestLogsPage() {
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [rows, setRows] = useState<RequestLogRow[]>([]);
  const [stats, setStats] = useState<RequestLogStats | null>(null);
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('24h');
  const [excludeStream, setExcludeStream] = useState(true);
  const [pathSort, setPathSort] = useState<RequestLogPathSort>('p95');
  const [pathSortOrder, setPathSortOrder] = useState<RequestLogSortOrder>('desc');
  const [pathFilter, setPathFilter] = useState('');
  const [statusClass, setStatusClass] = useState<StatusClass>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<RequestLogRow | null>(null);
  const maxIdRef = useRef(0);
  const skipStatsRefreshRef = useRef(true);

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

  const loadStats = useCallback(
    async (
      window: StatsWindow,
      streamExcluded: boolean,
      sort: RequestLogPathSort,
      sortOrder: RequestLogSortOrder,
    ) => {
      const response = await fetchRequestLogStats(window, {
        excludeStream: streamExcluded,
        pathSort: sort,
        pathSortOrder: sortOrder,
      });
      if (!response.enabled) {
        if (response.reason === 'stats_fn_missing') {
          setStats(null);
          return;
        }
        if (response.reason === 'migration_missing') {
          setPageState({ kind: 'disabled', reason: response.reason });
        }
        return;
      }
      setStats(response.stats);
    },
    [],
  );

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

  const reloadAll = useCallback(
    async (incrementalLogs: boolean) => {
      await Promise.all([
        loadStats(statsWindow, excludeStream, pathSort, pathSortOrder),
        loadLogs(incrementalLogs),
      ]);
    },
    [loadLogs, loadStats, statsWindow, excludeStream, pathSort, pathSortOrder],
  );

  const handlePathSortChange = useCallback(
    (sort: RequestLogPathSort, order: RequestLogSortOrder) => {
      setPathSort(sort);
      setPathSortOrder(order);
    },
    [],
  );

  const retryLoad = useCallback(() => {
    setPageState({ kind: 'loading' });
    reloadAll(false).catch((err: Error) => {
      setPageState({ kind: 'error', message: err.message });
    });
  }, [reloadAll]);

  useEffect(() => {
    retryLoad();
    // Initial load only — avoid full-page loading when stats sort/filter changes.
  }, []);

  useEffect(() => {
    if (skipStatsRefreshRef.current) {
      skipStatsRefreshRef.current = false;
      return;
    }
    loadStats(statsWindow, excludeStream, pathSort, pathSortOrder).catch((err: Error) => {
      setPageState({ kind: 'error', message: err.message });
    });
  }, [loadStats, statsWindow, excludeStream, pathSort, pathSortOrder]);

  useEffect(() => {
    if (!autoRefresh || paused || pageState.kind !== 'ready') {
      return;
    }
    const timer = window.setInterval(() => {
      reloadAll(true).catch((err: Error) => {
        setPageState({ kind: 'error', message: err.message });
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, paused, pageState.kind, reloadAll]);

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
  const scrollX = logColumns.reduce(
    (sum, col) => sum + (typeof col.width === 'number' ? col.width : 160),
    0,
  );

  return (
    <PageContainer title="接口日志" subTitle="简化 APM：聚合统计 + 准实时 tail">
      {stats ? (
        <RequestLogApmSummary
          stats={stats}
          window={statsWindow}
          excludeStream={excludeStream}
          pathSort={pathSort}
          pathSortOrder={pathSortOrder}
          onWindowChange={setStatsWindow}
          onExcludeStreamChange={setExcludeStream}
          onPathSortChange={handlePathSortChange}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="聚合统计函数尚未迁移"
          description={
            <>
              <p>实时 tail 仍可用。要启用聚合统计与 Auth/Chat P95，请依次执行：</p>
              <pre style={{ marginTop: 8 }}>{ROUTE_META_PATH}</pre>
              <pre style={{ marginTop: 8 }}>{STATS_FN_PATH}</pre>
            </>
          }
        />
      )}

      <ProCard title="实时请求 tail" bordered>
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
          columns={logColumns}
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
      </ProCard>

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
