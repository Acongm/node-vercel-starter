import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import AnalysisTab from './AnalysisTab';
import JobsTab from './JobsTab';
import UsageTab from './UsageTab';

export default function KnowledgePage() {
  return (
    <PageContainer title="知识库" subTitle="流水线、索引内容与知识使用">
      <Tabs
        items={[
          { key: 'jobs', label: '流水线执行', children: <JobsTab /> },
          { key: 'analysis', label: '索引内容', children: <AnalysisTab /> },
          { key: 'usage', label: '知识使用', children: <UsageTab /> },
        ]}
      />
    </PageContainer>
  );
}
