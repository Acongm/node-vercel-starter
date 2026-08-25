import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Input, Modal, Radio, Space, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import UserCell from '@/components/UserCell';
import { fetchPlatformUsers, purgeGhostUsers } from '@/services/api';
import type { PlatformUserItem } from '@/types';
import { formatDateTime, idPrefix, roleTagColor } from '@/utils/format';

type AnonymousActivity = 'active' | 'ghost' | 'all';

function renderAnonymousStatus(record: PlatformUserItem) {
  if (record.hasChats) {
    return <Tag color="green">有对话</Tag>;
  }
  if (record.isGhost) {
    return <Tag color="orange">幽灵</Tag>;
  }
  return <Tag>浏览中</Tag>;
}

function LoginUsersTab() {
  const [search, setSearch] = useState('');
  const [disabled, setDisabled] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchPlatformUsers({ page: 1, pageSize: 1, anonymous: 'false' })
      .then((response) => {
        if (!response.enabled) {
          setDisabled(response.reason);
        }
      })
      .finally(() => setChecked(true));
  }, []);

  const columns: ProColumns<PlatformUserItem>[] = useMemo(
    () => [
      {
        title: '邮箱',
        dataIndex: 'email',
        width: 220,
        render: (_, record) => (
          <UserCell userEmail={record.email} userId={record.id} isAnonymous={false} />
        ),
      },
      {
        title: 'Provider',
        dataIndex: 'providers',
        width: 160,
        render: (_, record) => (
          <>
            {record.providers.map((provider) => (
              <Tag key={provider}>{provider}</Tag>
            ))}
          </>
        ),
      },
      {
        title: '角色',
        dataIndex: 'role',
        width: 100,
        render: (_, record) => (
          <Tag color={roleTagColor(record.role)}>{record.role}</Tag>
        ),
      },
      {
        title: '注册时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (_, record) => formatDateTime(record.createdAt),
      },
      {
        title: '最近登录',
        dataIndex: 'lastSignInAt',
        width: 180,
        render: (_, record) => formatDateTime(record.lastSignInAt),
      },
    ],
    [],
  );

  const scrollX = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

  if (!checked) {
    return null;
  }

  if (disabled) {
    return (
      <Alert
        type="info"
        showIcon
        message="平台用户列表未启用"
        description={
          <>
            <p>{disabled}</p>
            <p>请在环境变量中配置 SUPABASE_SERVICE_ROLE_KEY 后重试。</p>
          </>
        }
      />
    );
  }

  return (
    <>
      <Input.Search
        placeholder="搜索邮箱"
        allowClear
        onSearch={setSearch}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <ProTable<PlatformUserItem>
        rowKey="id"
        columns={columns}
        search={false}
        params={{ search }}
        request={async (params) => {
          const response = await fetchPlatformUsers({
            page: params.current,
            pageSize: params.pageSize,
            anonymous: 'false',
            q: params.search || undefined,
          });
          if (!response.enabled) {
            return { data: [], total: 0, success: true };
          }
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 50 }}
        scroll={{ x: scrollX }}
        tableLayout="fixed"
      />
    </>
  );
}

function AnonymousUsersTab() {
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<AnonymousActivity>('active');
  const [disabled, setDisabled] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ghostCount, setGhostCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [purging, setPurging] = useState(false);
  const actionRef = useRef<ActionType>();

  useEffect(() => {
    fetchPlatformUsers({ page: 1, pageSize: 1, anonymous: 'true', activity: 'all' })
      .then((response) => {
        if (!response.enabled) {
          setDisabled(response.reason);
          return;
        }
        setGhostCount(response.ghostCount ?? 0);
        setActiveCount(response.activeCount ?? 0);
      })
      .finally(() => setChecked(true));
  }, []);

  const columns: ProColumns<PlatformUserItem>[] = useMemo(
    () => [
      {
        title: 'Client ID',
        dataIndex: 'cid',
        width: 220,
        render: (_, record) => (
          <UserCell
            userId={record.id}
            clientId={record.cid}
            isAnonymous
          />
        ),
      },
      {
        title: 'Auth UID',
        dataIndex: 'id',
        width: 140,
        render: (_, record) => (
          <Tooltip title={record.id}>
            <Typography.Text copyable={{ text: record.id }}>
              {idPrefix(record.id)}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: '状态',
        dataIndex: 'hasChats',
        width: 120,
        render: (_, record) => renderAnonymousStatus(record),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 180,
        render: (_, record) => formatDateTime(record.createdAt),
      },
      {
        title: '最近活跃',
        dataIndex: 'lastSignInAt',
        width: 180,
        render: (_, record) => formatDateTime(record.lastSignInAt),
      },
    ],
    [],
  );

  const scrollX = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

  const handlePurge = () => {
    Modal.confirm({
      title: '删除无对话的幽灵匿名账号',
      content: `将删除 ${ghostCount} 个超过 15 分钟、从未发过对话的匿名 auth 用户。Client ID（cookie）不会被清掉，下次发消息会按需重建。`,
      okText: '删除幽灵账号',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setPurging(true);
        try {
          const result = await purgeGhostUsers();
          if (!result.enabled) {
            message.error(result.reason);
            return;
          }
          message.success(`已删除 ${result.deleted} 个幽灵账号${result.skipped ? `，跳过 ${result.skipped}` : ''}`);
          setGhostCount(Math.max(0, ghostCount - result.deleted));
          void actionRef.current?.reload();
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除失败');
        } finally {
          setPurging(false);
        }
      },
    });
  };

  if (!checked) {
    return null;
  }

  if (disabled) {
    return (
      <Alert
        type="info"
        showIcon
        message="匿名用户列表未启用"
        description={disabled}
      />
    );
  }

  return (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Radio.Group
          value={activity}
          onChange={(event) => setActivity(event.target.value)}
          optionType="button"
          options={[
            { label: `活跃 ${activeCount}`, value: 'active' },
            { label: `幽灵 ${ghostCount}`, value: 'ghost' },
            { label: '全部', value: 'all' },
          ]}
        />
        <Input.Search
          placeholder="搜索 Client ID / Auth UID"
          allowClear
          onSearch={setSearch}
          style={{ width: 280 }}
        />
        <Button danger disabled={ghostCount === 0} loading={purging} onClick={handlePurge}>
          清理幽灵账号
        </Button>
      </Space>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="匿名身份按 GA Client ID 识别，不再把每次打开页面都当成新用户。"
        description="浏览只写 acongm_cid cookie；第一次发消息才创建匿名 auth 用户。幽灵账号 = 超过 15 分钟且从未产生对话。"
      />
      <ProTable<PlatformUserItem>
        rowKey="id"
        columns={columns}
        search={false}
        params={{ search, activity }}
        request={async (params) => {
          const response = await fetchPlatformUsers({
            page: params.current,
            pageSize: params.pageSize,
            anonymous: 'true',
            activity,
            q: params.search || undefined,
          });
          if (!response.enabled) {
            return { data: [], total: 0, success: true };
          }
          setGhostCount(response.ghostCount ?? 0);
          setActiveCount(response.activeCount ?? 0);
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 50 }}
        scroll={{ x: scrollX }}
        tableLayout="fixed"
        actionRef={actionRef}
      />
    </>
  );
}

export default function UsersPage() {
  return (
    <PageContainer title="用户" subTitle="登录账号与按 Client ID 识别的匿名访客">
      <Tabs
        items={[
          { key: 'login', label: '登录账号', children: <LoginUsersTab /> },
          { key: 'anonymous', label: '匿名账号', children: <AnonymousUsersTab /> },
        ]}
      />
    </PageContainer>
  );
}
