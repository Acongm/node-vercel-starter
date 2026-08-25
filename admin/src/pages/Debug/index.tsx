import { ApiOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { useState } from 'react';
import { apiFetch, formatApiResult } from '@/services/http';
import type { ApiResult } from '@/types';

const { TextArea } = Input;

type DebugPanelProps = {
  title: string;
  method: string;
  path: string;
  defaultBody?: string;
  fields?: Array<{
    name: string;
    label: string;
    placeholder?: string;
    component?: 'input' | 'textarea';
  }>;
  buildRequest?: (values: Record<string, string>) => {
    url: string;
    options?: RequestInit;
  };
};

function DebugPanel({
  title,
  method,
  path,
  defaultBody,
  fields = [],
  buildRequest,
}: DebugPanelProps) {
  const [form] = Form.useForm();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const request = buildRequest
        ? buildRequest(values)
        : {
            url: path,
            options: {
              method,
              body:
                method === 'GET'
                  ? undefined
                  : defaultBody || values.body || undefined,
            },
          };

      const response = await apiFetch(request.url, request.options);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          <ApiOutlined />
          <span>{title}</span>
          <Typography.Text code>
            {method} {path}
          </Typography.Text>
        </Space>
      }
      extra={
        <Button type="primary" loading={loading} onClick={run}>
          发送请求
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          body: defaultBody,
        }}
      >
        {fields.map((field) => (
          <Form.Item key={field.name} name={field.name} label={field.label}>
            {field.component === 'textarea' ? (
              <TextArea rows={4} placeholder={field.placeholder} />
            ) : (
              <Input placeholder={field.placeholder} />
            )}
          </Form.Item>
        ))}
        {!fields.length && method !== 'GET' ? (
          <Form.Item name="body" label="Body (JSON)">
            <TextArea rows={6} />
          </Form.Item>
        ) : null}
      </Form>

      <Typography.Paragraph type="secondary">
        所有请求走同源 <Typography.Text code>/api/*</Typography.Text>，自动携带
        auth.acongm.com 会话 Cookie。
      </Typography.Paragraph>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          minHeight: 120,
          whiteSpace: 'pre-wrap',
        }}
      >
        {result ? formatApiResult(result) : '尚未请求。'}
      </pre>
    </Card>
  );
}

export default function DebugPage() {
  const tabItems = [
    {
      key: 'health',
      label: 'Health',
      children: (
        <DebugPanel title="Health" method="GET" path="/api/health" />
      ),
    },
    {
      key: 'auth',
      label: 'Auth',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <DebugPanel title="Auth Mode" method="GET" path="/api/auth/mode" />
          </Col>
          <Col span={12}>
            <DebugPanel title="Session" method="GET" path="/api/auth/session" />
          </Col>
          <Col span={12}>
            <DebugPanel title="Me" method="GET" path="/api/auth/me" />
          </Col>
          <Col span={12}>
            <DebugPanel
              title="Admin Check"
              method="GET"
              path="/api/auth/roles/admin-check"
            />
          </Col>
        </Row>
      ),
    },
    {
      key: 'comments',
      label: 'Comments',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <DebugPanel title="List Comments" method="GET" path="/api/comments" />
          </Col>
          <Col span={24}>
            <DebugPanel
              title="Create Comment"
              method="POST"
              path="/api/comments"
              fields={[
                { name: 'author', label: 'Author', placeholder: 'API Demo' },
                {
                  name: 'content',
                  label: 'Content',
                  component: 'textarea',
                  placeholder: 'Supabase CRUD test comment.',
                },
              ]}
              buildRequest={(values) => ({
                url: '/api/comments',
                options: {
                  method: 'POST',
                  body: JSON.stringify({
                    author: values.author || 'API Demo',
                    content: values.content || 'test',
                  }),
                },
              })}
            />
          </Col>
        </Row>
      ),
    },
    {
      key: 'ai',
      label: 'AI',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <DebugPanel
              title="AI Chat"
              method="POST"
              path="/api/ai/chat"
              fields={[
                {
                  name: 'prompt',
                  label: 'Prompt',
                  component: 'textarea',
                  placeholder: 'hello',
                },
              ]}
              buildRequest={(values) => ({
                url: '/api/ai/chat',
                options: {
                  method: 'POST',
                  body: JSON.stringify({ prompt: values.prompt || 'hello' }),
                },
              })}
            />
          </Col>
          <Col span={24}>
            <DebugPanel
              title="OpenAI Compatible"
              method="POST"
              path="/v1/chat/completions"
              defaultBody={JSON.stringify(
                { messages: [{ role: 'user', content: 'Hello' }] },
                null,
                2,
              )}
              fields={[
                {
                  name: 'body',
                  label: 'Messages JSON',
                  component: 'textarea',
                },
              ]}
              buildRequest={(values) => ({
                url: '/v1/chat/completions',
                options: {
                  method: 'POST',
                  body: values.body,
                },
              })}
            />
          </Col>
        </Row>
      ),
    },
    {
      key: 'user',
      label: 'User',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <DebugPanel title="User Me" method="GET" path="/api/user/me" />
          </Col>
          <Col span={12}>
            <DebugPanel title="User Info" method="GET" path="/api/user/info" />
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>接口调试</Typography.Title>
      <Typography.Paragraph type="secondary">
        按 Ant Design 卡片 + Tabs 组织原 debug console 能力，保留完整请求/响应预览。
      </Typography.Paragraph>
      <Tabs items={tabItems} />
    </div>
  );
}
