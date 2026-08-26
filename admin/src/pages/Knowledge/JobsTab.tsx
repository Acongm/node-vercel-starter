import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Select, Space, Tag } from 'antd';
import { useEffect, useState } from 'react';
import AdminProTable from '@/components/AdminProTable';
import FilterSearch from '@/components/FilterSearch';
import JsonDrawer from '@/components/JsonDrawer';
import { fetchKbFailures, fetchKbJobs } from '@/services/api';
import type { SyncFailureRow, SyncJobRow } from '@/types';
import { formatDateTime, formatDurationMs, statusTagColor } from '@/utils/format';
import { stringParam } from '@/utils/table-query';

function sourceTag(source?: SyncJobRow['source']) {
  if (source === 'portal-static') {
    return <Tag color="green">Portal 静态索引</Tag>;
  }
  if (source === 'supabase') {
    return <Tag color="blue">Supabase</Tag>;
  }
  return null;
}

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
    title: '来源',
    dataIndex: 'source',
    width: 130,
    render: (_, record) => sourceTag(record.source),
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
    width: 200,
    ellipsis: true,
  },
];

const failureColumns: ProColumns<SyncFailureRow>[] = [
  { title: '路径', dataIndex: 'path', width: 260, ellipsis: true },
  { title: 'failure_code', dataIndex: 'failure_code', width: 140 },
  { title: '原因', dataIndex: 'reason', width: 200, ellipsis: true },
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
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [jobTypeFilter, setJobTypeFilter] = useState<string | undefined>();
  const [failurePath, setFailurePath] = useState('');

  useEffect(() => {
    fetchKbFailures({ page: 1, pageSize: 200 })
      .then((response) => {
        const unresolved = response.items.filter((item) => !item.resolved_at);
        setUnresolvedCount(unresolved.length);
      })
      .catch(() => setUnresolvedCount(0));
  }, []);

  const jobScrollX = jobColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);
  const failureScrollX = failureColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

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
        <>
          <FilterSearch
            placeholder="搜索失败路径"
            allowClear
            onSearch={setFailurePath}
            style={{ maxWidth: 360, marginBottom: 16 }}
          />
          <AdminProTable<SyncFailureRow>
            rowKey="id"
            columns={failureColumns}
            search={false}
            headerTitle="同步失败"
            style={{ marginBottom: 16 }}
            params={{ failurePath }}
            request={async (params) => {
              const response = await fetchKbFailures({
                page: params.current,
                pageSize: params.pageSize,
                path: stringParam(params.failurePath),
              });
              return {
                data: response.items.filter((item) => !item.resolved_at),
                total: response.total,
                success: true,
              };
            }}
            pagination={{ pageSize: 10 }}
            scroll={{ x: failureScrollX }}
            tableLayout="fixed"
          />
        </>
      ) : null}

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'succeeded', label: 'succeeded' },
            { value: 'failed', label: 'failed' },
            { value: 'running', label: 'running' },
            { value: 'pending', label: 'pending' },
          ]}
        />
        <Select
          allowClear
          placeholder="任务类型"
          style={{ width: 140 }}
          value={jobTypeFilter}
          onChange={setJobTypeFilter}
          options={[
            { value: 'pipeline', label: 'pipeline' },
            { value: 'sync', label: 'sync' },
          ]}
        />
      </Space>

      <AdminProTable<SyncJobRow>
        rowKey="id"
        columns={jobColumns}
        search={false}
        params={{ statusFilter, jobTypeFilter }}
        request={async (params) => {
          const response = await fetchKbJobs({
            page: params.current,
            pageSize: params.pageSize,
            status: stringParam(params.statusFilter),
            jobType: stringParam(params.jobTypeFilter),
          });
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: jobScrollX }}
        tableLayout="fixed"
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
                source: selectedJob.source,
              }
            : null
        }
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}
