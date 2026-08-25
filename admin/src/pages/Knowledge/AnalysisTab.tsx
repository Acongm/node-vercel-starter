import { Collapse, Drawer, Input, Spin, Tag, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import { fetchKbAnalysis, fetchKbChunks } from '@/services/api';
import type { KbAnalysisRow, KbChunkRow } from '@/types';
import { formatDateTime, parseKeywords } from '@/utils/format';

function AnalysisDetailDrawer({
  record,
  onClose,
}: {
  record: KbAnalysisRow | null;
  onClose: () => void;
}) {
  const [chunks, setChunks] = useState<KbChunkRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!record) {
      setChunks([]);
      return;
    }
    setLoading(true);
    fetchKbChunks({ path: record.path, pageSize: 200 })
      .then((response) => setChunks(response.items))
      .catch(() => setChunks([]))
      .finally(() => setLoading(false));
  }, [record]);

  if (!record) {
    return (
      <Drawer open={false} width={800} title="详情" onClose={onClose} />
    );
  }

  const keywords = parseKeywords(record.keywords);

  return (
    <Drawer
      open={Boolean(record)}
      width={800}
      title={record.title || record.path}
      onClose={onClose}
    >
      <Spin spinning={loading}>
      <Typography.Paragraph>{record.summary || '-'}</Typography.Paragraph>

      {keywords.length > 0 ? (
        <>
          <Typography.Title level={5}>关键词</Typography.Title>
          <div style={{ marginBottom: 16 }}>
            {keywords.map((keyword) => (
              <Tag key={keyword}>{keyword}</Tag>
            ))}
          </div>
        </>
      ) : null}

      <Typography.Title level={5}>Chunks</Typography.Title>
      <Collapse
        items={chunks.map((chunk) => ({
          key: chunk.id,
          label: `${chunk.heading || `Chunk ${chunk.chunk_index}`} · ${chunk.token_count ?? 0} tokens`,
          children: (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {chunk.content}
            </Typography.Paragraph>
          ),
        }))}
      />
      </Spin>
    </Drawer>
  );
}

const columns: ProColumns<KbAnalysisRow>[] = [
  {
    title: '路径',
    dataIndex: 'path',
    width: 260,
    ellipsis: true,
  },
  {
    title: '标题',
    dataIndex: 'title',
    ellipsis: true,
  },
  {
    title: '难度',
    dataIndex: 'difficulty',
    width: 100,
    render: (_, record) =>
      record.difficulty ? <Tag>{record.difficulty}</Tag> : '-',
  },
  {
    title: '类型',
    dataIndex: 'content_type',
    width: 100,
    render: (_, record) =>
      record.content_type ? <Tag>{record.content_type}</Tag> : '-',
  },
  {
    title: '关键词',
    dataIndex: 'keywords',
    render: (_, record) => {
      const keywords = parseKeywords(record.keywords).slice(0, 3);
      return keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>);
    },
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    width: 180,
    render: (_, record) => formatDateTime(record.updated_at),
  },
];

export default function AnalysisTab() {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<KbAnalysisRow | null>(null);

  return (
    <>
      <Input.Search
        placeholder="搜索路径或标题"
        allowClear
        onSearch={setSearch}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      <ProTable<KbAnalysisRow>
        rowKey="id"
        columns={columns}
        search={false}
        params={{ search }}
        request={async (params) => {
          const response = await fetchKbAnalysis({
            page: params.current,
            pageSize: params.pageSize,
            search: params.search,
          });
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => setDetail(record),
          style: { cursor: 'pointer' },
        })}
      />
      <AnalysisDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </>
  );
}
