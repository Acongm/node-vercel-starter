import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Input } from 'antd';
import { useState } from 'react';
import ConversationDrawer from '@/components/ConversationDrawer';
import UserCell from '@/components/UserCell';
import { fetchConversations } from '@/services/api';
import type { ConversationListItem } from '@/types';
import { formatDateTime } from '@/utils/format';

const columns: ProColumns<ConversationListItem>[] = [
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    width: 180,
    render: (_, record) => formatDateTime(record.updatedAt),
  },
  {
    title: '用户',
    dataIndex: 'userEmail',
    width: 180,
    render: (_, record) => (
      <UserCell
        userEmail={record.userEmail}
        userId={record.userId}
        isAnonymous={record.isAnonymous}
      />
    ),
  },
  {
    title: '页面',
    dataIndex: 'pagePath',
    width: 200,
    ellipsis: true,
  },
  {
    title: '标题',
    dataIndex: 'title',
    width: 200,
    ellipsis: true,
  },
  {
    title: '消息数',
    dataIndex: 'messageCount',
    width: 80,
    align: 'right',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 180,
    render: (_, record) => formatDateTime(record.createdAt),
  },
];

export default function ConversationsTab() {
  const [selected, setSelected] = useState<ConversationListItem | null>(null);
  const [search, setSearch] = useState('');
  const scrollX = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

  return (
    <>
      <Input.Search
        placeholder="标题/页面 搜索"
        allowClear
        onSearch={setSearch}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <ProTable<ConversationListItem>
        rowKey="id"
        columns={columns}
        search={false}
        params={{ search }}
        request={async (params) => {
          const response = await fetchConversations({
            page: params.current,
            pageSize: params.pageSize,
            search: params.search,
          });
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: scrollX }}
        tableLayout="fixed"
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <ConversationDrawer conversation={selected} onClose={() => setSelected(null)} />
    </>
  );
}
