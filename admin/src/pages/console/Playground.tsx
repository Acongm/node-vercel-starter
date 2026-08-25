import { useMemo, useState } from 'react';
import { history, useParams } from '@umijs/max';
import { PageContainer, ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Button, Card, Result, Space, Tag, Typography, Upload } from 'antd';
import { findEndpointGroup, type EndpointAction } from '../../constants/endpoints';
import { fetchJson, readAdminToken } from '../../services/session';

interface PlayResult {
  actionId: string;
  status: number;
  statusText: string;
  durationMs: number;
  body: unknown;
}

export default function ConsolePlaygroundPage() {
  const params = useParams<{ group: string }>();
  const group = useMemo(() => findEndpointGroup(params.group || ''), [params.group]);
  const [result, setResult] = useState<PlayResult>();
  const [file, setFile] = useState<File>();

  if (!group) {
    return (
      <PageContainer>
        <Result
          status="404"
          title="未找到该调试分组"
          extra={<Button onClick={() => history.push('/console')}>返回</Button>}
        />
      </PageContainer>
    );
  }

  const runAction = async (action: EndpointAction, values: Record<string, string>) => {
    const built = action.build?.(values) ?? {};
    const path = built.path || action.path;
    const headers: Record<string, string> = { ...built.headers };
    const token = readAdminToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body: BodyInit | undefined;
    if (built.formData) {
      const form = new FormData();
      if (file) {
        form.append('file', file);
      }
      body = form;
    } else if (built.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(built.body);
    }

    const response = await fetchJson<unknown>(path, {
      method: action.method,
      headers,
      body,
    });
    setResult({
      actionId: action.id,
      status: response.status,
      statusText: response.statusText,
      durationMs: response.durationMs,
      body: response.body,
    });
  };

  return (
    <PageContainer title={group.title} onBack={() => history.push('/console')}>
      <Typography.Paragraph type="secondary">{group.description}</Typography.Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        {group.paths.map((path) => (
          <Tag key={path}>{path}</Tag>
        ))}
      </Space>
      <ProForm<Record<string, string>>
        submitter={false}
        initialValues={Object.fromEntries(
          group.fields
            .filter((field) => field.initialValue)
            .map((field) => [field.name, field.initialValue]),
        )}
        onFinish={async () => true}
      >
        {group.fields.map((field) => {
          if (field.type === 'file') {
            return (
              <ProForm.Item key={field.name} label={field.label} name={field.name}>
                <Upload
                  beforeUpload={(next) => {
                    setFile(next);
                    return false;
                  }}
                  maxCount={1}
                >
                  <Button>选择文件</Button>
                </Upload>
              </ProForm.Item>
            );
          }
          if (field.type === 'textarea' || field.type === 'json') {
            return (
              <ProFormTextArea
                key={field.name}
                name={field.name}
                label={field.label}
                placeholder={field.placeholder}
                fieldProps={{ rows: field.type === 'json' ? 6 : 3 }}
              />
            );
          }
          if (field.type === 'password') {
            return (
              <ProFormText.Password
                key={field.name}
                name={field.name}
                label={field.label}
                placeholder={field.placeholder}
              />
            );
          }
          return (
            <ProFormText
              key={field.name}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
            />
          );
        })}
        <ProForm.Item>
          <Space wrap>
            {group.actions.map((action) => (
              <ProForm.Item noStyle shouldUpdate key={action.id}>
                {(form) => (
                  <Button
                    type={action.danger ? 'primary' : 'default'}
                    danger={action.danger}
                    onClick={() => {
                      void runAction(action, form.getFieldsValue() as Record<string, string>);
                    }}
                  >
                    {action.method} {action.label}
                  </Button>
                )}
              </ProForm.Item>
            ))}
          </Space>
        </ProForm.Item>
      </ProForm>
      <Card title="响应" style={{ marginTop: 16 }}>
        {result ? (
          <pre>
            {`HTTP ${result.status} ${result.statusText}\nDuration: ${result.durationMs}ms\n\n${
              typeof result.body === 'string'
                ? result.body
                : JSON.stringify(result.body, null, 2)
            }`}
          </pre>
        ) : (
          <Typography.Text type="secondary">尚未请求。</Typography.Text>
        )}
      </Card>
    </PageContainer>
  );
}
