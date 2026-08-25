import { PageContainer, ProList } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { useEffect, useState } from 'react';
import { fetchAdminTables } from '@/services/api';
import type { AdminTableDefinition } from '@/types';

export default function DataIndexPage() {
  const [tables, setTables] = useState<AdminTableDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer title="数据表" subTitle="实时查看 Supabase 数据">
      <ProList<AdminTableDefinition>
        loading={loading}
        rowKey="key"
        dataSource={tables}
        metas={{
          title: { dataIndex: 'label' },
          description: { dataIndex: 'description' },
          subTitle: {
            render: (_, row) => row.table,
          },
        }}
        onRow={(record) => ({
          onClick: () => history.push(`/data/${record.key}`),
          style: { cursor: 'pointer' },
        })}
      />
    </PageContainer>
  );
}
