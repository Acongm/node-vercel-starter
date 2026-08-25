import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Popconfirm, message } from 'antd';
import { useMemo, useRef, useState } from 'react';
import type { ActionType } from '@ant-design/pro-components';
import {
  createClientLabel,
  deleteClientLabel,
  fetchClientLabels,
  updateClientLabel,
} from '@/services/api';
import type { ClientLabelRecord } from '@/types';
import { formatDateTime } from '@/utils/format';

type LabelFormValues = {
  clientId: string;
  label: string;
  note?: string;
};

const baseColumns: ProColumns<ClientLabelRecord>[] = [
  {
    title: 'Client ID',
    dataIndex: 'clientId',
    width: 200,
    ellipsis: true,
  },
  {
    title: '标签',
    dataIndex: 'label',
    width: 160,
  },
  {
    title: '备注',
    dataIndex: 'note',
    width: 200,
    ellipsis: true,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    width: 180,
    render: (_, record) => formatDateTime(record.createdAt),
  },
];

export default function ClientLabelsTab() {
  const actionRef = useRef<ActionType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientLabelRecord | null>(null);
  const [filter, setFilter] = useState('');
  const [form] = Form.useForm<LabelFormValues>();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: ClientLabelRecord) => {
    setEditing(record);
    form.setFieldsValue({
      clientId: record.clientId,
      label: record.label,
      note: record.note,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateClientLabel(editing.clientId, {
        label: values.label,
        note: values.note,
      });
      message.success('已更新');
    } else {
      await createClientLabel(values);
      message.success('已创建');
    }
    setModalOpen(false);
    actionRef.current?.reload();
  };

  const tableColumns: ProColumns<ClientLabelRecord>[] = [
    ...baseColumns,
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, record) => [
        <Button key="edit" type="link" onClick={() => openEdit(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除？"
          onConfirm={async () => {
            await deleteClientLabel(record.clientId);
            message.success('已删除');
            actionRef.current?.reload();
          }}
        >
          <Button type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const scrollX = useMemo(
    () => tableColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0),
    [tableColumns],
  );

  return (
    <>
      <Input.Search
        placeholder="搜索 label / clientId"
        allowClear
        onSearch={setFilter}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <ProTable<ClientLabelRecord>
        actionRef={actionRef}
        rowKey="id"
        columns={tableColumns}
        search={false}
        params={{ filter }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={openCreate}>
            新建标签
          </Button>,
        ]}
        request={async (params) => {
          const items = await fetchClientLabels();
          const term = String(params.filter ?? '').trim().toLowerCase();
          const filtered = term
            ? items.filter(
                (item) =>
                  item.label.toLowerCase().includes(term) ||
                  item.clientId.toLowerCase().includes(term),
              )
            : items;
          return {
            data: filtered,
            total: filtered.length,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: scrollX }}
        tableLayout="fixed"
      />

      <Modal
        title={editing ? '编辑客户端标签' : '新建客户端标签'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="clientId"
            label="Client ID"
            rules={[{ required: true, message: '请输入 Client ID' }]}
          >
            <Input disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item
            name="label"
            label="标签"
            rules={[{ required: true, message: '请输入标签' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
