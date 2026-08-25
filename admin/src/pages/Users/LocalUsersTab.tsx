import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Tag } from 'antd';
import { fetchLocalUsers } from '@/services/api';
import type { LocalAuthUserRow } from '@/types';
import { formatDateTime, roleTagColor } from '@/utils/format';

const columns: ProColumns<LocalAuthUserRow>[] = [
  { title: '邮箱', dataIndex: 'email', width: 200 },
  { title: '用户名', dataIndex: 'username', width: 140 },
  {
    title: 'Provider',
    dataIndex: 'provider',
    width: 100,
    render: (_, record) => <Tag>{record.provider}</Tag>,
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
    title: '状态',
    dataIndex: 'disabled',
    width: 80,
    render: (_, record) => (
      <Tag color={record.disabled ? 'error' : 'success'}>
        {record.disabled ? '禁用' : '正常'}
      </Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    width: 180,
    render: (_, record) => formatDateTime(record.created_at),
  },
];

export default function LocalUsersTab() {
  return (
    <ProTable<LocalAuthUserRow>
      rowKey="id"
      columns={columns}
      search={false}
      request={async (params) => {
        const response = await fetchLocalUsers({
          page: params.current,
          pageSize: params.pageSize,
        });
        return {
          data: response.items,
          total: response.total,
          success: true,
        };
      }}
      pagination={{ pageSize: 20 }}
    />
  );
}
