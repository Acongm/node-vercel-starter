import { ProCard } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import AdminProTable from '@/components/AdminProTable';
import { Empty, Segmented } from 'antd';
import { useEffect, useState } from 'react';
import { fetchKbUsage } from '@/services/api';
import type { KbCountAggregate, KbCoverageItem } from '@/types';

const coverageColumns: ProColumns<KbCoverageItem>[] = [
  { title: '路径', dataIndex: 'path', width: 260, ellipsis: true },
  { title: 'Chunk 数', dataIndex: 'chunkCount', width: 100, align: 'right' },
  { title: 'Token 合计', dataIndex: 'tokenSum', width: 120, align: 'right' },
];

const chatPageColumns: ProColumns<KbCountAggregate>[] = [
  { title: '页面', dataIndex: 'key', width: 260, ellipsis: true },
  { title: '次数', dataIndex: 'count', width: 80, align: 'right' },
];

const citationColumns: ProColumns<KbCountAggregate>[] = [
  {
    title: 'URL',
    dataIndex: 'key',
    width: 260,
    ellipsis: true,
    render: (_, record) => (
      <a href={record.key} target="_blank" rel="noreferrer">
        {record.key}
      </a>
    ),
  },
  { title: '次数', dataIndex: 'count', width: 80, align: 'right' },
];

export default function UsageTab() {
  const [days, setDays] = useState<number>(30);
  const [coverage, setCoverage] = useState<KbCoverageItem[]>([]);
  const [chatPages, setChatPages] = useState<KbCountAggregate[]>([]);
  const [citations, setCitations] = useState<KbCountAggregate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchKbUsage({ days, limit: 20 })
      .then((response) => {
        setCoverage(response.coverage);
        setChatPages(response.chatPages);
        setCitations(response.citations);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const coverageScrollX = coverageColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);
  const chatScrollX = chatPageColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);
  const citationScrollX = citationColumns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

  return (
    <>
      <Segmented
        value={days}
        onChange={(value) => setDays(Number(value))}
        options={[
          { label: '7 天', value: 7 },
          { label: '30 天', value: 30 },
          { label: '90 天', value: 90 },
        ]}
        style={{ marginBottom: 16 }}
      />

      <ProCard split="horizontal" loading={loading}>
        <ProCard title="索引覆盖" colSpan="100%">
          {coverage.length === 0 ? (
            <Empty description="暂无 kb_chunks 入库数据（流水线尚未写入 Supabase）" />
          ) : (
            <AdminProTable<KbCoverageItem>
              rowKey="path"
              columns={coverageColumns}
              search={false}
              dataSource={coverage}
              pagination={false}
              toolBarRender={false}
              scroll={{ x: coverageScrollX }}
              tableLayout="fixed"
            />
          )}
        </ProCard>

        <ProCard split="vertical">
          <ProCard title="对话中使用的知识页" colSpan="50%">
            <AdminProTable<KbCountAggregate>
              rowKey="key"
              columns={chatPageColumns}
              search={false}
              dataSource={chatPages}
              pagination={false}
              toolBarRender={false}
              scroll={{ x: chatScrollX }}
              tableLayout="fixed"
            />
          </ProCard>

          <ProCard title="外部引用 Top" colSpan="50%">
            <AdminProTable<KbCountAggregate>
              rowKey="key"
              columns={citationColumns}
              search={false}
              dataSource={citations}
              pagination={false}
              toolBarRender={false}
              scroll={{ x: citationScrollX }}
              tableLayout="fixed"
            />
          </ProCard>
        </ProCard>
      </ProCard>
    </>
  );
}
