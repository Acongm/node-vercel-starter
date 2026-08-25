import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Alert, Button, Tag } from 'antd';
import { useEffect, useState } from 'react';
import JsonDrawer from '@/components/JsonDrawer';
import { fetchKbFailures, fetchKbJobs } from '@/services/api';
import type { SyncFailureRow, SyncJobRow } from '@/types';
import { formatDateTime, formatDurationMs, statusTagColor } from '@/utils/format';

const jobColumns: ProColumns<SyncJobRow>[] = [
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 180,
    render: (_, record) => formatDateTime(record.created_at),
  },
  {
    title: '类型',
    dataIndex: 'job_type',
    width: 120,
    render: (_, record) => <Tag>{record.job_type}</Tag>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (_, record) => (
      <Tag color={statusTagColor(record.status)}>{record.status}</Tag>
    ),
  },
  {
    title: '触发源',
    dataIndex: 'trigger_source',
    width: 120,
    ellipsis: true,
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    width: 100,
    align: 'right',
    render: (_, record) => formatDurationMs(record.started_at, record.finished_at),
  },
  {
    title: '错误',
    dataIndex: 'error',
    ellipsis: true,
  },
];

const failureColumns: ProColumns<SyncFailureRow>[] = [
  { title: '路径', dataIndex: 'path', ellipsis: true },
  { title: 'failure_code', dataIndex: 'failure_code', width: 140 },
  { title: '原因', dataIndex: 'reason', ellipsis: true },
  { title: '重试次数', dataIndex: 'retry_count', width: 90, align: 'right' },
  {
    title: '下次重试',
    dataIndex: 'next_retry_at',
    width: 180,
    render: (_, record) => formatDateTime(record.next_retry_at),
  },
];

export default function JobsTab() {
  const [selectedJob, setSelectedJob] = useState<SyncJobRow | null>(null);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [showFailures, setShowFailures] = useState(false);

  useEffect(() => {
    fetchKbFailures({ page: 1, pageSize: 200 })
      .then((response) => {
        const unresolved = response.items.filter((item) => !item.resolved_at);
        setUnresolvedCount(unresolved.length);
      })
      .catch(() => setUnresolvedCount(0));
  }, []);

  return (
    <>
      {unresolvedCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`存在 ${unresolvedCount} 条未解决的同步失败`}
          action={
            <Button size="small" onClick={() => setShowFailures((value) => !value)}>
              {showFailures ? '收起' : '查看'}
            </Button>
          }
        />
      ) : null}

      {showFailures ? (
        <ProTable<SyncFailureRow>
          rowKey="id"
          columns={failureColumns}
          search={false}
          headerTitle="同步失败"
          style={{ marginBottom: 16 }}
          request={async (params) => {
            const response = await fetchKbFailures({
              page: params.current,
              pageSize: params.pageSize,
            });
            return {
              data: response.items.filter((item) => !item.resolved_at),
              total: response.total,
              success: true,
            };
          }}
          pagination={{ pageSize: 10 }}
        />
      ) : null}

      <ProTable<SyncJobRow>
        rowKey="id"
        columns={jobColumns}
        search={false}
        request={async (params) => {
          const response = await fetchKbJobs({
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
        onRow={(record) => ({
          onClick: () => setSelectedJob(record),
          style: { cursor: 'pointer' },
        })}
      />

      <JsonDrawer
        open={Boolean(selectedJob)}
        title="流水线执行详情"
        data={
          selectedJob
            ? {
                payload: selectedJob.payload,
                result: selectedJob.result,
                error: selectedJob.error,
              }
            : null
        }
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}
