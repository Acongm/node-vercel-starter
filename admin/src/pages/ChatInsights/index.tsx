import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import ChatLogsTab from './ChatLogsTab';
import ClientLabelsTab from './ClientLabelsTab';
import ConversationsTab from './ConversationsTab';

export default function ChatInsightsPage() {
  return (
    <PageContainer title="对话洞察" subTitle="会话、AI 调用流水与客户端标签">
      <Tabs
        items={[
          { key: 'conversations', label: '会话列表', children: <ConversationsTab /> },
          { key: 'logs', label: 'AI 调用流水', children: <ChatLogsTab /> },
          { key: 'labels', label: '客户端标签', children: <ClientLabelsTab /> },
        ]}
      />
    </PageContainer>
  );
}
