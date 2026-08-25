import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Alert, Tag } from 'antd';
import { useEffect, useState } from 'react';
import UserCell from '@/components/UserCell';
import { fetchPlatformUsers } from '@/services/api';
import type { PlatformUserItem } from '@/types';
import { formatDateTime, roleTagColor } from '@/utils/format';

const columns: ProColumns<PlatformUserItem>[] = [
  {
    title: '邮箱',
    dataIndex: 'email',
    render: (_, record) => (
      <UserCell
        userEmail={record.email}
        userId={record.id}
        isAnonymous={record.isAnonymous}
      />
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
];

export default function PlatformUsersTab() {
  const [disabled, setDisabled] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetchPlatformUsers({ page: 1, perPage: 1 })
      .then((response) => {
        if (!response.enabled) {
          setDisabled(response.reason);
        }
      })
      .finally(() => setChecked(true));
  }, []);

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
    <ProTable<PlatformUserItem>
      rowKey="id"
      columns={columns}
      search={false}
      request={async (params) => {
        const response = await fetchPlatformUsers({
          page: params.current,
          perPage: params.pageSize,
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
    />
  );
}
