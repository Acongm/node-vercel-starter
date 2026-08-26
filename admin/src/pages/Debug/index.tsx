import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Input,
  List,
  Row,
  Select,
  Space,
  Tree,
  Typography,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAdminRoutes } from '@/services/api';
import { apiFetch } from '@/services/http';
import type { AdminRouteEntry, ApiResult } from '@/types';

const ROUTE_GROUP_ORDER = [
  'system',
  'auth',
  'ai',
  'chats',
  'users',
  'admin',
  'openai',
  'other',
] as const;

function groupSortIndex(group: string): number {
  const index = ROUTE_GROUP_ORDER.indexOf(group as typeof ROUTE_GROUP_ORDER[number]);
  return index === -1 ? ROUTE_GROUP_ORDER.length : index;
}

const { TextArea } = Input;
const HISTORY_KEY = 'admin-debug-history';
const MAX_HISTORY = 20;

type KeyValueRow = { key: string; value: string };
type DebugHistoryItem = {
  method: string;
  path: string;
  status: number;
  time: string;
  queryParams: KeyValueRow[];
  headers: KeyValueRow[];
  body: string;
  pathParams: Record<string, string>;
};

const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const;

function parsePathParams(path: string): string[] {
  const matches = path.match(/:([A-Za-z0-9_]+)/g);
  if (!matches) {
    return [];
  }
  return matches.map((segment) => segment.slice(1));
}

function buildUrl(
  path: string,
  pathParams: Record<string, string>,
  queryParams: KeyValueRow[],
): string {
  let resolved = path;
  for (const [key, value] of Object.entries(pathParams)) {
    resolved = resolved.replace(`:${key}`, encodeURIComponent(value));
  }
  const query = new URLSearchParams();
  for (const row of queryParams) {
    if (row.key.trim()) {
      query.set(row.key.trim(), row.value);
    }
  }
  const suffix = query.toString();
  return suffix ? `${resolved}?${suffix}` : resolved;
}

function buildCurl(
  method: string,
  url: string,
  headers: KeyValueRow[],
  body: string,
): string {
  const parts = [`curl -X ${method}`];
  for (const header of headers) {
    if (header.key.trim()) {
      parts.push(`-H '${header.key.trim()}: ${header.value}'`);
    }
  }
  if (method !== 'GET' && body.trim()) {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
  }
  parts.push(`'${window.location.origin}${url}'`);
  parts.push('--cookie "$(document.cookie)"');
  return parts.join(' ');
}

function loadHistory(): DebugHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as DebugHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items: DebugHistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function emptyRow(): KeyValueRow {
  return { key: '', value: '' };
}

function KeyValueEditor({
  rows,
  onChange,
  addLabel,
}: {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  addLabel: string;
}) {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {rows.map((row, index) => (
        <Space key={`${index}-${row.key}`} style={{ width: '100%' }}>
          <Input
            placeholder="Key"
            value={row.key}
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, key: event.target.value };
              onChange(next);
            }}
            style={{ width: 160 }}
          />
          <Input
            placeholder="Value"
            value={row.value}
            onChange={(event) => {
              const next = [...rows];
              next[index] = { ...row, value: event.target.value };
              onChange(next);
            }}
            style={{ flex: 1 }}
          />
          <Button
            icon={<DeleteOutlined />}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          />
        </Space>
      ))}
      <Button type="dashed" onClick={() => onChange([...rows, emptyRow()])}>
        {addLabel}
      </Button>
    </Space>
  );
}

export default function DebugPage() {
  const [routes, setRoutes] = useState<AdminRouteEntry[]>([]);
  const [routeSearch, setRouteSearch] = useState('');
  const [method, setMethod] = useState<string>('GET');
  const [path, setPath] = useState('/api/health');
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<KeyValueRow[]>([emptyRow()]);
  const [headers, setHeaders] = useState<KeyValueRow[]>([emptyRow()]);
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<DebugHistoryItem[]>(loadHistory);

  useEffect(() => {
    fetchAdminRoutes()
      .then(setRoutes)
      .catch(() => message.error('加载路由清单失败'));
  }, []);

  const pathParamNames = useMemo(() => parsePathParams(path), [path]);

  const treeData = useMemo(() => {
    const filtered = routes.filter((route) => {
      if (!routeSearch.trim()) {
        return true;
      }
      return route.path.toLowerCase().includes(routeSearch.trim().toLowerCase());
    });

    const grouped = new Map<string, { label: string; entries: AdminRouteEntry[] }>();
    for (const route of filtered) {
      const groupKey = route.group || route.controllerName;
      const groupLabel = route.groupLabel || route.controllerName;
      const bucket = grouped.get(groupKey) ?? { label: groupLabel, entries: [] };
      bucket.entries.push(route);
      grouped.set(groupKey, bucket);
    }

    const sortedGroups = [...grouped.entries()].sort((a, b) => {
      const orderDiff = groupSortIndex(a[0]) - groupSortIndex(b[0]);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a[1].label.localeCompare(b[1].label, 'zh-CN');
    });

    const nodes: DataNode[] = [];
    for (const [groupKey, bucket] of sortedGroups) {
      nodes.push({
        key: groupKey,
        title: `${bucket.label} (${bucket.entries.length})`,
        selectable: false,
        children: bucket.entries.map((entry) => ({
          key: `${entry.method}:${entry.path}`,
          title: (
            <Space size={4}>
              <Typography.Text code style={{ fontSize: 11 }}>
                {entry.method}
              </Typography.Text>
              <span>{entry.path}</span>
            </Space>
          ),
          isLeaf: true,
        })),
      });
    }
    return nodes;
  }, [routes, routeSearch]);

  const selectRoute = useCallback((route: AdminRouteEntry) => {
    setMethod(route.method);
    setPath(route.path);
    const params: Record<string, string> = {};
    for (const name of parsePathParams(route.path)) {
      params[name] = '';
    }
    setPathParams(params);
  }, []);

  const sendRequest = async () => {
    setLoading(true);
    try {
      const url = buildUrl(path, pathParams, queryParams);
      const headerRecord: Record<string, string> = {};
      for (const row of headers) {
        if (row.key.trim()) {
          headerRecord[row.key.trim()] = row.value;
        }
      }

      const options: RequestInit = {
        method,
        headers: headerRecord,
      };
      if (method !== 'GET' && body.trim()) {
        options.body = body;
      }

      const response = await apiFetch(url, options);
      setResult(response);

      const item: DebugHistoryItem = {
        method,
        path,
        status: response.status,
        time: new Date().toISOString(),
        queryParams,
        headers,
        body,
        pathParams,
      };
      const nextHistory = [item, ...history.filter((h) => h.path !== path || h.method !== method)];
      setHistory(nextHistory);
      saveHistory(nextHistory);
    } finally {
      setLoading(false);
    }
  };

  const restoreHistory = (item: DebugHistoryItem) => {
    setMethod(item.method);
    setPath(item.path);
    setPathParams(item.pathParams);
    setQueryParams(item.queryParams.length ? item.queryParams : [emptyRow()]);
    setHeaders(item.headers.length ? item.headers : [emptyRow()]);
    setBody(item.body);
  };

  const responseBody =
    result?.body === null || result?.body === undefined
      ? ''
      : typeof result.body === 'string'
        ? result.body
        : JSON.stringify(result.body, null, 2);

  const contentType =
    result && typeof result.body === 'object'
      ? 'application/json'
      : 'text/plain';

  return (
    <PageContainer title="接口调试" subTitle="路由清单 + 请求构造器">
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="路由清单" size="small">
            <Input.Search
              placeholder="按 path 过滤"
              allowClear
              onChange={(event) => setRouteSearch(event.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              <Tree
                treeData={treeData}
                defaultExpandAll
                onSelect={(_, info) => {
                  const key = String(info.node.key);
                  const route = routes.find((entry) => `${entry.method}:${entry.path}` === key);
                  if (route) {
                    selectRoute(route);
                  }
                }}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title="请求构造" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Space wrap>
                <Select
                  value={method}
                  onChange={setMethod}
                  options={HTTP_METHODS.map((value) => ({ value, label: value }))}
                  style={{ width: 100 }}
                />
                <Input
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="/api/..."
                  style={{ minWidth: 320 }}
                />
              </Space>

              {pathParamNames.length > 0 ? (
                <Card size="small" title="路径参数">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {pathParamNames.map((name) => (
                      <Input
                        key={name}
                        addonBefore={`:${name}`}
                        value={pathParams[name] ?? ''}
                        onChange={(event) =>
                          setPathParams({ ...pathParams, [name]: event.target.value })
                        }
                      />
                    ))}
                  </Space>
                </Card>
              ) : null}

              <div>
                <Typography.Text strong>Query 参数</Typography.Text>
                <KeyValueEditor
                  rows={queryParams}
                  onChange={setQueryParams}
                  addLabel="添加 Query"
                />
              </div>

              <div>
                <Typography.Text strong>Headers</Typography.Text>
                <KeyValueEditor rows={headers} onChange={setHeaders} addLabel="添加 Header" />
              </div>

              {method !== 'GET' ? (
                <div>
                  <Typography.Text strong>Body (JSON)</Typography.Text>
                  <TextArea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
                </div>
              ) : null}

              <Space>
                <Button type="primary" loading={loading} onClick={sendRequest}>
                  发送请求
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    const url = buildUrl(path, pathParams, queryParams);
                    const curl = buildCurl(method, url, headers, body);
                    void navigator.clipboard.writeText(curl);
                    message.success('cURL 已复制');
                  }}
                >
                  复制 cURL
                </Button>
              </Space>
            </Space>
          </Card>

          <Card title="响应" size="small" style={{ marginTop: 16 }}>
            {result ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text>
                  HTTP {result.status} {result.statusText} · {result.durationMs}ms ·{' '}
                  {contentType}
                </Typography.Text>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: 8,
                    minHeight: 120,
                    maxHeight: 400,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {responseBody || '(empty)'}
                </pre>
              </Space>
            ) : (
              <Typography.Text type="secondary">尚未请求</Typography.Text>
            )}
          </Card>

          <Card title="调用历史" size="small" style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={history}
              locale={{ emptyText: '暂无历史' }}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => restoreHistory(item)}
                >
                  <Space>
                    <Typography.Text code>{item.method}</Typography.Text>
                    <Typography.Text ellipsis style={{ maxWidth: 280 }}>
                      {item.path}
                    </Typography.Text>
                    <Typography.Text type={item.status >= 400 ? 'danger' : 'secondary'}>
                      {item.status}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {new Date(item.time).toLocaleString('zh-CN')}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
