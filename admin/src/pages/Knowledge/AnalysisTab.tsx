import { Collapse, Drawer, Spin, Tag, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';
import AdminProTable from '@/components/AdminProTable';
import FilterSearch from '@/components/FilterSearch';
import { fetchKbAnalysis, fetchKbChunks } from '@/services/api';
import type { KbAnalysisRow, KbChunkRow } from '@/types';
import { formatDateTime, parseKeywords } from '@/utils/format';
import { stringParam } from '@/utils/table-query';

function sourceTag(source?: KbAnalysisRow['source']) {
  if (source === 'portal-static') {
    return <Tag color="green">Portal 静态索引</Tag>;
  }
  if (source === 'supabase') {
    return <Tag color="blue">Supabase</Tag>;
  }
  return null;
}

function AnalysisDetailDrawer({
  record,
  onClose,
}: {
  record: KbAnalysisRow | null;
  onClose: () => void;
}) {
  const [chunks, setChunks] = useState<KbChunkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const isPortalStatic = record?.source === 'portal-static';

  useEffect(() => {
    if (!record || isPortalStatic) {
      setChunks([]);
      return;
    }
    setLoading(true);
    fetchKbChunks({ path: record.path, pageSize: 200 })
      .then((response) => setChunks(response.items))
      .catch(() => setChunks([]))
      .finally(() => setLoading(false));
  }, [record, isPortalStatic]);

  if (!record) {
    return <Drawer open={false} width={800} title="详情" onClose={onClose} />;
  }

  const keywords = parseKeywords(record.keywords);
  const keyPoints = Array.isArray(record.key_points)
    ? record.key_points.filter((item): item is string => typeof item === 'string')
    : [];
  const techStack = Array.isArray(record.tech_stack)
    ? record.tech_stack.filter((item): item is string => typeof item === 'string')
    : [];

  return (
    <Drawer
      open={Boolean(record)}
      width={800}
      title={
        <span>
          {record.title || record.path} {sourceTag(record.source)}
        </span>
      }
      onClose={onClose}
    >
      <Spin spinning={loading}>
        <Typography.Paragraph>{record.summary || '-'}</Typography.Paragraph>

        {keyPoints.length > 0 ? (
          <>
            <Typography.Title level={5}>要点</Typography.Title>
            <ul>
              {keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </>
        ) : null}

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

        {techStack.length > 0 ? (
          <>
            <Typography.Title level={5}>技术栈</Typography.Title>
            <div style={{ marginBottom: 16 }}>
              {techStack.map((item) => (
                <Tag key={item}>{item}</Tag>
              ))}
            </div>
          </>
        ) : null}

        {!isPortalStatic ? (
          <>
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
          </>
        ) : null}
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
    width: 200,
    ellipsis: true,
  },
  {
    title: '来源',
    dataIndex: 'source',
    width: 130,
    render: (_, record) => sourceTag(record.source),
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
    width: 200,
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
  const [listSource, setListSource] = useState<KbAnalysisRow['source']>();
  const scrollX = columns.reduce((sum, col) => sum + (typeof col.width === 'number' ? col.width : 160), 0);

  return (
    <>
      <FilterSearch
        placeholder="搜索路径或标题"
        allowClear
        onSearch={setSearch}
        style={{ maxWidth: 360, marginBottom: 16 }}
      />
      {listSource ? (
        <div style={{ marginBottom: 12 }}>{sourceTag(listSource)}</div>
      ) : null}
      <AdminProTable<KbAnalysisRow>
        rowKey="id"
        columns={columns}
        search={false}
        params={{ search }}
        request={async (params) => {
          const response = await fetchKbAnalysis({
            page: params.current,
            pageSize: params.pageSize,
            search: stringParam(params.search),
          });
          setListSource(response.source ?? response.items[0]?.source);
          return {
            data: response.items,
            total: response.total,
            success: true,
          };
        }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: scrollX }}
        tableLayout="fixed"
        onRow={(record) => ({
          onClick: () => setDetail(record),
          style: { cursor: 'pointer' },
        })}
      />
      <AnalysisDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </>
  );
}
