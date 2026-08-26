import { ProTable } from '@ant-design/pro-components';
import type { ProTableProps } from '@ant-design/pro-components';
import { Button } from 'antd';
import { preventNativeNavigation, SAFE_PRO_TABLE_FORM } from '@/utils/table-query';

type AdminProTableProps<Data, Params extends Record<string, unknown>> = ProTableProps<
  Data,
  Params
>;

function searchButtons(
  form?: { submit?: () => void; resetFields?: () => void },
) {
  return [
    <Button
      key="reset"
      htmlType="button"
      onClick={() => {
        form?.resetFields?.();
        form?.submit?.();
      }}
    >
      重置
    </Button>,
    <Button key="query" type="primary" htmlType="button" onClick={() => form?.submit?.()}>
      查询
    </Button>,
  ];
}

export default function AdminProTable<
  Data extends Record<string, unknown>,
  Params extends Record<string, unknown> = Record<string, unknown>,
>(props: AdminProTableProps<Data, Params>) {
  const search =
    props.search === false || props.search === undefined
      ? props.search ?? false
      : {
          ...props.search,
          optionRender: (
            _config: unknown,
            formProps: { form?: { submit?: () => void; resetFields?: () => void } },
          ) => searchButtons(formProps.form),
        };

  return (
    <div onSubmitCapture={preventNativeNavigation}>
      <ProTable<Data, Params>
        {...props}
        form={{ ...SAFE_PRO_TABLE_FORM, ...props.form }}
        search={search}
      />
    </div>
  );
}
