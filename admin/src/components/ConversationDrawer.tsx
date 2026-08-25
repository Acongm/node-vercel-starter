import { Alert, Drawer, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchConversationDetail } from '@/services/api';
import type { ConversationDetail, ConversationListItem } from '@/types';
import { formatDateTime, getMessageModel } from '@/utils/format';
import UserCell from './UserCell';

type ConversationDrawerProps = {
  conversation: ConversationListItem | null;
  onClose: () => void;
};

function MessageBubble({
  role,
  text,
  createdAt,
  model,
}: {
  role: string;
  text: string;
  createdAt: string;
  model?: string;
}) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 8,
          background: isUser ? '#e6f4ff' : '#f5f5f5',
        }}
      >
        <Space size={4} style={{ marginBottom: 4 }}>
          <Tag color={isUser ? 'blue' : 'green'}>{role}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatDateTime(createdAt)}
          </Typography.Text>
          {model ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {model}
            </Typography.Text>
          ) : null}
        </Space>
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text || '(空)'}
        </Typography.Paragraph>
      </div>
    </div>
  );
}

export default function ConversationDrawer({
  conversation,
  onClose,
}: ConversationDrawerProps) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversation) {
      setDetail(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchConversationDetail(conversation.id)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [conversation]);

  const failedRuns =
    detail?.runs.filter(
      (run) => run.status === 'failed' || run.status === 'error' || run.error,
    ) ?? [];

  return (
    <Drawer
      open={Boolean(conversation)}
      title={conversation?.title || '会话详情'}
      width={800}
      onClose={onClose}
    >
      <Spin spinning={loading}>
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      {detail ? (
        <>
          {failedRuns.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              {failedRuns.map((run) => (
                <Alert
                  key={run.id}
                  type="error"
                  showIcon
                  message={`Run ${run.status}`}
                  description={run.error || '未知错误'}
                />
              ))}
            </Space>
          ) : null}

          <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
            <UserCell
              userEmail={detail.chat.userEmail}
              userId={detail.chat.userId}
              isAnonymous={detail.chat.isAnonymous}
            />
            <Typography.Text type="secondary">
              页面: {detail.chat.pagePath || '-'}
            </Typography.Text>
          </Space>

          <div>
            {detail.messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role}
                text={message.textPreview}
                createdAt={message.createdAt}
                model={getMessageModel(message.metadata)}
              />
            ))}
          </div>
        </>
      ) : null}
      </Spin>
    </Drawer>
  );
}
