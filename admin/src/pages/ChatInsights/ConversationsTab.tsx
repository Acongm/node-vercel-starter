import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
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
    ellipsis: true,
  },
  {
    title: '标题',
    dataIndex: 'title',
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

  return (
    <>
      <ProTable<ConversationListItem>
        rowKey="id"
        columns={columns}
        search={false}
        request={async (params) => {
          const response = await fetchConversations({
            page: params.current,
            pageSize: params.pageSize,
          });
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          style: { cursor: 'pointer' },
        })}
      />
      <ConversationDrawer conversation={selected} onClose={() => setSelected(null)} />
    </>
  );
}
