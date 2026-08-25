import { Button, Result } from 'antd';
import { useModel } from '@umijs/max';
import { DEFAULT_LOGIN_URL, writeAdminToken } from '../services/session';

export default function ForbiddenPage() {
  const { initialState } = useModel('@@initialState');
  const email = initialState?.session?.user?.email;
  const loginUrl = initialState?.session?.loginUrl || DEFAULT_LOGIN_URL;

  return (
    <Result
      status="403"
      title="没有管理员权限"
      subTitle={
        email
          ? `当前账号 ${email} 不在管理员白名单。仅 o.arvin.peng@gmail.com 与 acongm@126.com 可进入看板。`
          : '请使用白名单管理员账号通过 auth.acongm.com 登录。'
      }
      extra={
        <Button
          type="primary"
          onClick={() => {
            writeAdminToken(undefined);
            window.location.href = loginUrl;
          }}
        >
          切换账号登录
        </Button>
      }
    />
  );
}
