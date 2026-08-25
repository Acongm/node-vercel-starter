import { PageContainer, ProCard, ProDescriptions } from '@ant-design/pro-components';
import { Alert, Col, Row, Statistic, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useModel } from '@umijs/max';
import { fetchOverview } from '@/services/api';
import type { AdminOverview } from '@/types';
import { formatDateTime, formatMetric, formatPercent, statusTagColor } from '@/utils/format';

export default function DashboardPage() {
  const { initialState } = useModel('@@initialState');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, []);

  const session = initialState?.session;
  const latestJob = overview?.latestSyncJob;
  const showErrorRate = overview?.requestLogErrorRate24h !== null;

  return (
    <PageContainer title="概览" subTitle="API 控制台 KPI 与运行状态">
      {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ProCard>
              <Statistic title="今日对话数" value={formatMetric(overview?.chatLogsTodayCount)} />
            </ProCard>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ProCard>
              <Statistic title="会话总数" value={formatMetric(overview?.chatsCount)} />
            </ProCard>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ProCard>
              <Statistic title="消息总数" value={formatMetric(overview?.messagesCount)} />
            </ProCard>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ProCard>
              <Statistic title="KB 文档数" value={formatMetric(overview?.kbAnalysisCount)} />
            </ProCard>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <ProCard>
              <Statistic title="KB Chunks 数" value={formatMetric(overview?.kbChunksCount)} />
            </ProCard>
          </Col>
          {showErrorRate ? (
            <Col xs={24} sm={12} md={8} lg={6}>
              <ProCard>
                <Statistic
                  title="24h 错误率"
                  value={formatPercent(overview?.requestLogErrorRate24h)}
                />
              </ProCard>
            </Col>
          ) : null}
      </Row>

      <ProCard split="vertical" gutter={16}>
        <ProCard title="最近流水线执行" colSpan="50%">
          {latestJob ? (
            <ProDescriptions column={1}>
              <ProDescriptions.Item label="类型">
                <Tag>{latestJob.job_type}</Tag>
              </ProDescriptions.Item>
              <ProDescriptions.Item label="状态">
                <Tag color={statusTagColor(latestJob.status)}>{latestJob.status}</Tag>
              </ProDescriptions.Item>
              <ProDescriptions.Item label="创建时间">
                {formatDateTime(latestJob.created_at)}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="完成时间">
                {formatDateTime(latestJob.finished_at)}
              </ProDescriptions.Item>
            </ProDescriptions>
          ) : (
            <span>-</span>
          )}
        </ProCard>

        <ProCard title="当前会话身份" colSpan="50%">
          <ProDescriptions column={1}>
            <ProDescriptions.Item label="邮箱">
              {session?.userInfo?.email || session?.user?.email || '-'}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="角色">
              <Tag color="gold">{session?.userInfo?.role || 'unknown'}</Tag>
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Tier">
              {session?.userInfo?.tier || '-'}
            </ProDescriptions.Item>
          </ProDescriptions>
        </ProCard>
      </ProCard>
    </PageContainer>
  );
}
