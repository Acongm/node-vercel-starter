import { history } from '@umijs/max';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Row, Tag, Typography } from 'antd';
import { ENDPOINT_GROUPS } from '../../constants/endpoints';

export default function ConsoleIndexPage() {
  return (
    <PageContainer title="接口调试">
      <Typography.Paragraph>
        按 Ant Design 表单 / 卡片整理原 API Debug Console。每个分组对应一组可执行接口。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {ENDPOINT_GROUPS.map((group) => (
          <Col key={group.key} xs={24} md={12} xl={8}>
            <Card
              hoverable
              title={group.title}
              extra={<Tag>{group.actions.length} 个操作</Tag>}
              onClick={() => history.push(`/console/${group.key}`)}
            >
              <Typography.Paragraph type="secondary">{group.description}</Typography.Paragraph>
              {group.paths.map((path) => (
                <div key={path}>
                  <Typography.Text code>{path}</Typography.Text>
                </div>
              ))}
            </Card>
          </Col>
        ))}
      </Row>
    </PageContainer>
  );
}
