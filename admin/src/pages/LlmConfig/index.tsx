import { PageContainer } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { fetchPlatformConfig, updatePlatformConfig } from '@/services/api';
import type { PlatformRuntimeConfigView } from '@/types';

type FormValues = {
  chatProvider: 'mock' | 'openai' | 'custom';
  chatBaseUrl: string;
  chatModel: string;
  maxTokensDefault: number;
  thinkingMaxTokens: number;
  summariesUrl: string;
  portalServiceId: string;
  openApiEnabled: boolean;
  openApiCompletionsEnabled: boolean;
  webSearchEnabled: boolean;
  allowedCallSources: string;
  serviceCallerIds: string;
  llmApiKey: string;
  webSearchApiKey: string;
  portalServiceKey: string;
  serviceCallerKeys: string;
};

function toFormValues(view: PlatformRuntimeConfigView): FormValues {
  return {
    chatProvider: view.config.chat.provider,
    chatBaseUrl: view.config.chat.baseUrl,
    chatModel: view.config.chat.model,
    maxTokensDefault: view.config.chat.maxTokensDefault,
    thinkingMaxTokens: view.config.chat.thinkingMaxTokens,
    summariesUrl: view.config.knowledgeBase.summariesUrl,
    portalServiceId: view.config.knowledgeBase.portalServiceId,
    openApiEnabled: view.config.openApi.enabled,
    openApiCompletionsEnabled: view.config.openApi.completionsPathEnabled,
    webSearchEnabled: view.config.webSearch.enabled,
    allowedCallSources: view.config.callers.allowedCallSources.join(','),
    serviceCallerIds: view.config.callers.serviceCallers.map((c) => c.id).join(','),
    llmApiKey: '',
    webSearchApiKey: '',
    portalServiceKey: '',
    serviceCallerKeys: '',
  };
}

function buildPatch(values: FormValues): Parameters<typeof updatePlatformConfig>[0] {
  const serviceIds = values.serviceCallerIds
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const patch: Parameters<typeof updatePlatformConfig>[0] = {
    config: {
      chat: {
        provider: values.chatProvider,
        baseUrl: values.chatBaseUrl.trim(),
        model: values.chatModel.trim(),
        maxTokensDefault: values.maxTokensDefault,
        thinkingMaxTokens: values.thinkingMaxTokens,
      },
      knowledgeBase: {
        summariesUrl: values.summariesUrl.trim(),
        portalServiceId: values.portalServiceId.trim(),
      },
      openApi: {
        enabled: values.openApiEnabled,
        completionsPathEnabled: values.openApiCompletionsEnabled,
      },
      webSearch: {
        enabled: values.webSearchEnabled,
      },
      callers: {
        allowedCallSources: values.allowedCallSources
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        serviceCallers: serviceIds.map((id) => ({ id })),
      },
    },
    secrets: {},
    serviceCallerKeys: [],
  };

  if (values.llmApiKey.trim()) {
    patch.secrets!['llm.api_key'] = values.llmApiKey.trim();
  }
  if (values.webSearchApiKey.trim()) {
    patch.secrets!['web_search.api_key'] = values.webSearchApiKey.trim();
  }
  if (values.portalServiceKey.trim()) {
    patch.secrets!['kb.portal_service_key'] = values.portalServiceKey.trim();
  }

  const keyLines = values.serviceCallerKeys
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of keyLines) {
    const sep = line.indexOf(':');
    if (sep <= 0) continue;
    const id = line.slice(0, sep).trim();
    const key = line.slice(sep + 1).trim();
    if (!id || !key) continue;
    patch.serviceCallerKeys!.push({ id, key });
  }

  return patch;
}

function SecretHint({
  configured,
  preview,
}: {
  configured: boolean;
  preview: string | null;
}) {
  if (!configured) {
    return <Typography.Text type="secondary">未配置（使用环境变量回退）</Typography.Text>;
  }
  return (
    <Space>
      <Tag color="green">已配置</Tag>
      {preview ? <Typography.Text code>{preview}</Typography.Text> : null}
    </Space>
  );
}

export default function LlmConfigPage() {
  const [form] = Form.useForm<FormValues>();
  const [view, setView] = useState<PlatformRuntimeConfigView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPlatformConfig();
      setView(next);
      form.setFieldsValue(toFormValues(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const next = await updatePlatformConfig(buildPatch(values));
      setView(next);
      form.setFieldsValue(toFormValues(next));
      message.success('平台配置已保存，Chat 将立即使用新配置');
    } catch (err) {
      if (err instanceof Error && err.message) {
        message.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="LLM / 平台配置"
      subTitle="统一管理 Chat LLM、知识库调用密钥、OpenAPI 与联网检索（仅管理员）"
      extra={[
        <Button key="reload" onClick={() => void load()} disabled={loading}>
          刷新
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => void onSave()}>
          保存
        </Button>,
      ]}
    >
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
      {view ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            view.source === 'database'
              ? `当前读取自数据库（更新于 ${view.updatedAt ?? '未知'}）`
              : '当前读取自环境变量默认值；保存后将写入 Supabase'
          }
        />
      ) : null}

      <Form form={form} layout="vertical" disabled={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Chat LLM" size="small">
              <Form.Item name="chatProvider" label="Provider" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'mock', label: 'mock（本地调试）' },
                    { value: 'openai', label: 'openai' },
                    { value: 'custom', label: 'custom（OpenAI 兼容）' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="chatBaseUrl" label="Base URL" rules={[{ required: true }]}>
                <Input placeholder="https://api.openai.com/v1" />
              </Form.Item>
              <Form.Item name="chatModel" label="默认模型" rules={[{ required: true }]}>
                <Input placeholder="deepseek-v4-flash" />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="maxTokensDefault" label="默认 max_tokens">
                    <InputNumber min={1} max={8192} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="thinkingMaxTokens" label="思考模式 max_tokens">
                    <InputNumber min={1} max={8192} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="LLM API Key">
                <SecretHint
                  configured={Boolean(view?.secrets['llm.api_key']?.configured)}
                  preview={view?.secrets['llm.api_key']?.preview ?? null}
                />
              </Form.Item>
              <Form.Item name="llmApiKey" label="更新 LLM API Key">
                <Input.Password placeholder="留空表示不修改" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="知识库 / Service 调用" size="small">
              <Form.Item name="summariesUrl" label="Summaries URL" rules={[{ required: true }]}>
                <Input placeholder="https://www.acongm.com/summaries-v1.json" />
              </Form.Item>
              <Form.Item name="portalServiceId" label="Portal Service ID" rules={[{ required: true }]}>
                <Input placeholder="portal-ci" />
              </Form.Item>
              <Form.Item label="Portal Service Key">
                <SecretHint
                  configured={Boolean(view?.secrets['kb.portal_service_key']?.configured)}
                  preview={view?.secrets['kb.portal_service_key']?.preview ?? null}
                />
              </Form.Item>
              <Form.Item name="portalServiceKey" label="更新 Portal Service Key">
                <Input.Password placeholder="留空表示不修改" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="OpenAPI 兼容" size="small">
              <Form.Item name="openApiEnabled" label="启用 OpenAPI 能力" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                name="openApiCompletionsEnabled"
                label="开放 /v1/chat/completions"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="联网检索" size="small">
              <Form.Item name="webSearchEnabled" label="允许联网检索" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Web Search API Key">
                <SecretHint
                  configured={Boolean(view?.secrets['web_search.api_key']?.configured)}
                  preview={view?.secrets['web_search.api_key']?.preview ?? null}
                />
              </Form.Item>
              <Form.Item name="webSearchApiKey" label="更新 Web Search API Key">
                <Input.Password placeholder="Tavily 等；留空表示不修改" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24}>
            <Card title="调用方白名单" size="small">
              <Form.Item
                name="allowedCallSources"
                label="Allowed call sources（逗号分隔前缀）"
                rules={[{ required: true }]}
              >
                <Input placeholder="portal:,chat-site" />
              </Form.Item>
              <Form.Item
                name="serviceCallerIds"
                label="Service caller IDs（逗号分隔）"
                rules={[{ required: true }]}
              >
                <Input placeholder="portal-ci,portal-bff" />
              </Form.Item>
              {view?.serviceCallerSecrets?.length ? (
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary">当前 service key 状态：</Typography.Text>
                  <ul>
                    {view.serviceCallerSecrets.map((row) => (
                      <li key={row.id}>
                        <Typography.Text code>{row.id}</Typography.Text>
                        {' — '}
                        <SecretHint configured={row.configured} preview={row.preview} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Form.Item
                name="serviceCallerKeys"
                label="批量更新 service keys（每行 id:secret）"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="portal-ci:your-secret&#10;portal-bff:another-secret"
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </PageContainer>
  );
}
