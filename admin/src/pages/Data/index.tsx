import { PageContainer } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Drawer, Tabs, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { history, useLocation } from '@umijs/max';
import AdminProTable from '@/components/AdminProTable';
import FilterSearch from '@/components/FilterSearch';
import { fetchAdminTableRows, fetchAdminTables } from '@/services/api';
import type { AdminTableDefinition } from '@/types';
import { buildDataTablePath, parseDataTableKey } from '@/utils/table-query';

const MAX_DATA_COLUMNS = 8;
const COLUMN_WIDTH = 160;
const PRIORITY_TAIL = ['id', 'created_at', 'updated_at'];

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function pickColumnKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key));
  });

  const allKeys = [...keys];
  const scalars = allKeys.filter((key) =>
    rows.some((row) => isScalar(row[key])),
  );
  const objects = allKeys.filter((key) => !scalars.includes(key));

  const tail = PRIORITY_TAIL.filter((key) => allKeys.includes(key));
  const middle = [...scalars, ...objects].filter((key) => !tail.includes(key));

  return [...middle, ...tail].slice(0, MAX_DATA_COLUMNS);
}

function buildColumns(
  rows: Record<string, unknown>[],
): ProColumns<Record<string, unknown>>[] {
  return pickColumnKeys(rows).map((key) => ({
    title: key,
    dataIndex: key,
    width: COLUMN_WIDTH,
    ellipsis: true,
    copyable: key === 'id' || key.endsWith('_id'),
    render: (_, record) => {
      const value = record[key];
      if (value === null || value === undefined) {
        return '-';
      }
      if (typeof value === 'object') {
        return <Tag>JSON</Tag>;
      }
      return String(value);
    },
  }));
}

function TablePanel({ tableKey }: { tableKey: string }) {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [columns, setColumns] = useState<ProColumns<Record<string, unknown>>[]>([]);

  const scrollX = useMemo(
    () => columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : COLUMN_WIDTH), 0) + 80,
    [columns],
  );

  return (
    <>
      <FilterSearch
        placeholder="模糊搜索"
        allowClear
        onSearch={setSearch}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <AdminProTable<Record<string, unknown>>
        rowKey={(row) => String(row.id || row.client_id || row.user_id || JSON.stringify(row))}
        search={false}
        params={{ search }}
        columns={columns}
        request={async (params) => {
          const response = await fetchAdminTableRows(tableKey, {
            page: params.current,
            pageSize: params.pageSize,
            search: typeof params.search === 'string' ? params.search : undefined,
          });
          setColumns(buildColumns(response.items));
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: scrollX || MAX_DATA_COLUMNS * COLUMN_WIDTH + 80 }}
        tableLayout="fixed"
        onRow={(record) => ({
          onClick: () => setDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      <Drawer
        width={640}
        title="行详情"
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : (
          <Alert message="未选择行" type="info" />
        )}
      </Drawer>
    </>
  );
}

export default function DataIndexPage() {
  const location = useLocation();
  const [tables, setTables] = useState<AdminTableDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string>('');

  useEffect(() => {
    fetchAdminTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tables.length === 0) {
      return;
    }
    const selected = parseDataTableKey(location.search);
    if (selected && tables.some((item) => item.key === selected)) {
      if (selected !== activeKey) {
        setActiveKey(selected);
      }
      return;
    }
    if (!activeKey) {
      setActiveKey(tables[0].key);
    }
  }, [location.search, tables, activeKey]);

  const handleTabChange = (key: string) => {
    setActiveKey(key);
    history.replace(buildDataTablePath(key));
  };

  return (
    <PageContainer title="数据表" subTitle="实时查看 Supabase 数据" loading={loading}>
      {tables.length === 0 ? (
        <Alert type="info" message="暂无可用数据表" />
      ) : (
        <Tabs
          activeKey={activeKey || tables[0]?.key}
          onChange={handleTabChange}
          items={tables.map((table) => ({
            key: table.key,
            label: table.label,
            children: <TablePanel tableKey={table.key} />,
          }))}
        />
      )}
    </PageContainer>
  );
}
