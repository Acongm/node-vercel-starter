import { history } from '@umijs/max';
import { PageContainer, ProList } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { fetchJson } from '../../services/session';

interface AdminTableMeta {
  key: string;
  title: string;
  source: 'store' | 'supabase';
  description: string;
}

export default function DataIndexPage() {
  const [tables, setTables] = useState<AdminTableMeta[]>([]);

  useEffect(() => {
    void fetchJson<{ tables: AdminTableMeta[] }>('/api/admin/tables').then((result) => {
      if (result.ok && typeof result.body !== 'string') {
        setTables(result.body.tables);
      }
    });
  }, []);

  return (
    <PageContainer title="数据列表">
      <ProList<AdminTableMeta>
        rowKey="key"
        dataSource={tables}
        metas={{
          title: { dataIndex: 'title' },
          description: { dataIndex: 'description' },
          subTitle: {
            render: (_, row) => (
              <Tag color={row.source === 'store' ? 'blue' : 'purple'}>{row.source}</Tag>
            ),
          },
          actions: {
            render: (_, row) => [
              <Button key="open" type="link" onClick={() => history.push(`/data/${row.key}`)}>
                查看
              </Button>,
            ],
          },
        }}
      />
    </PageContainer>
  );
}
