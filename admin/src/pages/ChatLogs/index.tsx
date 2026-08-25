import { PageContainer, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Drawer } from 'antd';
import { useState } from 'react';
import { fetchChatLogs } from '@/services/api';

type ChatLogItem = Record<string, unknown>;

const columns: ProColumns<ChatLogItem>[] = [
  { title: '时间', dataIndex: 'createdAt', width: 180 },
  { title: 'Endpoint', dataIndex: 'endpoint', width: 180 },
  { title: 'Model', dataIndex: 'model', width: 140 },
  { title: 'Client', dataIndex: 'clientId', width: 160, ellipsis: true },
  { title: 'Status', dataIndex: 'status', width: 100 },
  { title: 'Latency', dataIndex: 'latencyMs', width: 100 },
];

export default function ChatLogsPage() {
  const [detail, setDetail] = useState<ChatLogItem | null>(null);

  return (
    <PageContainer title="Chat Logs" subTitle="管理员查看 AI 对话日志">
      <ProTable<ChatLogItem>
        rowKey="id"
        columns={columns}
        search={false}
        request={async (params) => {
          const response = (await fetchChatLogs({
            page: params.current,
          })) as {
            items?: ChatLogItem[];
            total?: number;
          };
          return {
            data: response.items ?? [],
            total: response.total ?? 0,
            success: true,
          };
        }}
        pagination={{ pageSize: 50 }}
        onRow={(record) => ({
          onClick: () => setDetail(record),
          style: { cursor: 'pointer' },
        })}
      />

      <Drawer
        width={720}
        title="Chat Log 详情"
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
      >
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {detail ? JSON.stringify(detail, null, 2) : ''}
        </pre>
      </Drawer>
    </PageContainer>
  );
}
