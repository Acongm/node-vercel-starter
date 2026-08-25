import { useMemo, useState } from 'react';
import { history, useParams } from '@umijs/max';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Drawer, Typography } from 'antd';
import { fetchJson } from '../../services/session';

interface TablePagePayload {
  table: string;
  title: string;
  source: string;
  available: boolean;
  list: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

function inferColumns(
  rows: Record<string, unknown>[],
): ProColumns<Record<string, unknown>>[] {
  const keys = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => keys.add(key));
  }
  const preferred = [
    'id',
    'user_id',
    'email',
    'title',
    'author',
    'createdAt',
    'created_at',
    'updatedAt',
    'updated_at',
  ];
  const ordered = [
    ...preferred.filter((key) => keys.has(key)),
    ...[...keys].filter((key) => !preferred.includes(key)),
  ];
  return ordered.slice(0, 8).map((key) => ({
    title: key,
    dataIndex: key,
    ellipsis: true,
    hideInSearch: true,
    render: (_, record) => {
      const value = record[key];
      if (value == null) return '-';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    },
  }));
}

export default function DataTablePage() {
  const params = useParams<{ table: string }>();
  const table = params.table || '';
  const [detail, setDetail] = useState<Record<string, unknown>>();
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [title, setTitle] = useState(table);

  const columns = useMemo(
    () => inferColumns(sampleRows),
    [sampleRows],
  );

  return (
    <PageContainer title={title} onBack={() => history.push('/data')}>
      <ProTable<Record<string, unknown>>
        key={columns.map((column) => String(column.dataIndex || '')).join('|')}
        rowKey={(row) => String(row.id ?? row.user_id ?? JSON.stringify(row))}
        search={{ labelWidth: 'auto' }}
        request={async (query) => {
          const search = new URLSearchParams({
            page: String(query.current || 1),
            pageSize: String(query.pageSize || 20),
          });
          const keyword = String(query.keyword || '').trim();
          if (keyword) {
            search.set('keyword', keyword);
          }
          const result = await fetchJson<TablePagePayload>(
            `/api/admin/tables/${encodeURIComponent(table)}?${search.toString()}`,
          );
          if (!result.ok || typeof result.body === 'string') {
            return { data: [], success: false, total: 0 };
          }
          setTitle(result.body.title || table);
          setSampleRows(result.body.list);
          return {
            data: result.body.list,
            success: true,
            total: result.body.total,
          };
        }}
        columns={[
          {
            title: '关键字',
            dataIndex: 'keyword',
            hideInTable: true,
          },
          ...columns,
          {
            title: '操作',
            valueType: 'option',
            hideInSearch: true,
            render: (_, record) => [
              <Button key="view" type="link" onClick={() => setDetail(record)}>
                详情
              </Button>,
            ],
          },
        ]}
        pagination={{ pageSize: 20 }}
        headerTitle={title}
        toolBarRender={() => [
          <Typography.Text key="hint" type="secondary">
            只读查看当前数据库 / 适配器中的数据
          </Typography.Text>,
        ]}
      />
      <Drawer
        title="行详情"
        open={Boolean(detail)}
        width={560}
        onClose={() => setDetail(undefined)}
      >
        <pre>{JSON.stringify(detail, null, 2)}</pre>
      </Drawer>
    </PageContainer>
  );
}
