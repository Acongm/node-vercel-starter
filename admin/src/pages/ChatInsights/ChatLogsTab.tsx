import { Collapse, Drawer, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useState } from 'react';
import UserCell from '@/components/UserCell';
import { fetchAdminChatLogs } from '@/services/api';
import type { AdminChatLogItem } from '@/types';
import { formatDateTime, parseSources } from '@/utils/format';

function ChatLogDetailDrawer({
  record,
  onClose,
}: {
  record: AdminChatLogItem | null;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }

  const sources = parseSources(record.sources);

  return (
    <Drawer open={Boolean(record)} width={720} title="AI 调用详情" onClose={onClose}>
      <Typography.Title level={5}>问题</Typography.Title>
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {record.userMessage}
      </Typography.Paragraph>

      <Typography.Title level={5}>回答</Typography.Title>
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {record.assistantMessage}
      </Typography.Paragraph>

      {sources.length > 0 ? (
        <>
          <Typography.Title level={5}>来源</Typography.Title>
          <ul>
            {sources.map((source, index) => (
              <li key={`${source.url ?? index}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title || source.url}
                  </a>
                ) : (
                  source.title || '(无链接)'
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Collapse
        items={[
          {
            key: 'meta',
            label: '元数据',
            children: (
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {JSON.stringify(
                  {
                    endpoint: record.endpoint,
                    conversationId: record.conversationId,
                    promptTokens: record.promptTokens,
                    completionTokens: record.completionTokens,
                    totalTokens: record.totalTokens,
                  },
                  null,
                  2,
                )}
              </pre>
            ),
          },
        ]}
      />
    </Drawer>
  );
}

const columns: ProColumns<AdminChatLogItem>[] = [
  {
    title: '时间',
    dataIndex: 'createdAt',
    width: 170,
    hideInSearch: true,
    render: (_, record) => formatDateTime(record.createdAt),
  },
  {
    title: 'userId',
    dataIndex: 'userId',
    hideInTable: true,
    fieldProps: { placeholder: '用户 ID' },
  },
  {
    title: 'clientId',
    dataIndex: 'clientId',
    hideInTable: true,
    fieldProps: { placeholder: '客户端 ID' },
  },
  {
    title: '页面',
    dataIndex: 'pagePath',
    width: 140,
    ellipsis: true,
    fieldProps: { placeholder: 'pagePath' },
  },
  {
    title: '关键词',
    dataIndex: 'q',
    hideInTable: true,
    fieldProps: { placeholder: '搜索问题/回答' },
  },
  {
    title: '时间范围',
    dataIndex: 'dateRange',
    valueType: 'dateTimeRange',
    hideInTable: true,
  },
  {
    title: '用户',
    dataIndex: 'userEmail',
    width: 180,
    hideInSearch: true,
    render: (_, record) => (
      <UserCell
        userEmail={record.userEmail}
        userId={record.userId}
        clientId={record.clientId}
        isAnonymous={record.isAnonymous}
        clientLabel={record.clientLabel}
      />
    ),
  },
  {
    title: '问题',
    dataIndex: 'userMessage',
    width: 240,
    ellipsis: true,
    hideInSearch: true,
  },
  {
    title: '回答',
    dataIndex: 'assistantMessage',
    width: 240,
    ellipsis: true,
    hideInSearch: true,
  },
  {
    title: 'tokens',
    dataIndex: 'totalTokens',
    width: 90,
    align: 'right',
    hideInSearch: true,
    render: (_, record) => record.totalTokens ?? '-',
  },
  {
    title: '来源数',
    dataIndex: 'sources',
    width: 70,
    align: 'right',
    hideInSearch: true,
    render: (_, record) => parseSources(record.sources).length,
  },
];

export default function ChatLogsTab() {
  const [detail, setDetail] = useState<AdminChatLogItem | null>(null);

  return (
    <>
      <ProTable<AdminChatLogItem>
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        request={async (params) => {
          const range = params.dateRange as [string, string] | undefined;
          const response = await fetchAdminChatLogs({
            page: params.current,
            pageSize: params.pageSize,
            userId: typeof params.userId === 'string' ? params.userId : undefined,
            clientId: typeof params.clientId === 'string' ? params.clientId : undefined,
            pagePath: typeof params.pagePath === 'string' ? params.pagePath : undefined,
            q: typeof params.q === 'string' ? params.q : undefined,
            from: range?.[0],
            to: range?.[1],
          });
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => setDetail(record),
          style: { cursor: 'pointer' },
        })}
      />
      <ChatLogDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </>
  );
}
