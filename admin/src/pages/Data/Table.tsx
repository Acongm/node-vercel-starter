import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Drawer, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { history, useParams } from '@umijs/max';
import { fetchAdminTableRows } from '@/services/api';

function buildColumns(
  rows: Record<string, unknown>[],
): ProColumns<Record<string, unknown>>[] {
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key));
  });

  return [...keys].map((key) => ({
    title: key,
    dataIndex: key,
    ellipsis: true,
    copyable: key === 'id' || key.endsWith('_id'),
    width: key === 'content' || key === 'messages' ? 280 : 160,
    render: (_, record) => {
      const value = record[key];
      if (value === null || value === undefined) return '-';
      if (typeof value === 'object') {
        return (
          <Typography.Text ellipsis style={{ maxWidth: 240 }}>
            {JSON.stringify(value)}
          </Typography.Text>
        );
      }
      return String(value);
    },
  }));
}

export default function DataTablePage() {
  const { tableKey = '' } = useParams<{ tableKey: string }>();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [columns, setColumns] = useState<ProColumns<Record<string, unknown>>[]>(
    [],
  );

  const tableTitle = useMemo(() => tableKey.replace(/_/g, ' '), [tableKey]);

  return (
    <PageContainer
      title={tableTitle}
      subTitle={`表：${tableKey}`}
      onBack={() => history.back()}
    >
      <ProTable<Record<string, unknown>>
        rowKey={(row) => String(row.id || row.client_id || row.user_id)}
        search={{
          labelWidth: 'auto',
          optionRender: (_, __, dom) => dom.reverse(),
        }}
        form={{
          syncToUrl: false,
        }}
        toolBarRender={() => []}
        columns={[
          {
            title: '搜索',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { placeholder: '模糊搜索' },
          },
          ...columns,
        ]}
        request={async (params) => {
          const response = await fetchAdminTableRows(tableKey, {
            page: params.current,
            pageSize: params.pageSize,
            search: typeof params.keyword === 'string' ? params.keyword : undefined,
          });
          setColumns(buildColumns(response.items));
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
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
    </PageContainer>
  );
}
