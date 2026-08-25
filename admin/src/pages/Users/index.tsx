import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import LocalUsersTab from './LocalUsersTab';
import PlatformUsersTab from './PlatformUsersTab';

export default function UsersPage() {
  return (
    <PageContainer title="用户" subTitle="平台用户与本地账号">
      <Tabs
        items={[
          { key: 'platform', label: '平台用户', children: <PlatformUsersTab /> },
          { key: 'local', label: '本地账号', children: <LocalUsersTab /> },
        ]}
      />
    </PageContainer>
  );
}
