import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Input, Tabs, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import UserCell from '@/components/UserCell';
import { fetchPlatformUsers } from '@/services/api';
import type { PlatformUserItem } from '@/types';
import { formatDateTime, idPrefix, roleTagColor } from '@/utils/format';

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
  const [idFilter, setIdFilter] = useState('');
  const [disabled, setDisabled] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchPlatformUsers({ page: 1, pageSize: 1, anonymous: 'true' })
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
        title: '匿名ID',
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
      <Input.Search
        placeholder="搜索 ID（当前页过滤）"
        allowClear
        onSearch={setIdFilter}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <ProTable<PlatformUserItem>
        rowKey="id"
        columns={columns}
        search={false}
        request={async (params) => {
          const response = await fetchPlatformUsers({
            page: params.current,
            pageSize: params.pageSize,
            anonymous: 'true',
          });
          if (!response.enabled) {
            return { data: [], total: 0, success: true };
          }
          const term = idFilter.trim().toLowerCase();
          const items = term
            ? response.items.filter((item) => item.id.toLowerCase().includes(term))
            : response.items;
          return {
            data: items,
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

export default function UsersPage() {
  return (
    <PageContainer title="用户" subTitle="登录账号与匿名账号">
      <Tabs
        items={[
          { key: 'login', label: '登录账号', children: <LoginUsersTab /> },
          { key: 'anonymous', label: '匿名账号', children: <AnonymousUsersTab /> },
        ]}
      />
    </PageContainer>
  );
}
