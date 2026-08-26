import { Input } from 'antd';
import type { SearchProps } from 'antd/es/input';
import { preventNativeSubmit } from '@/utils/table-query';

export default function FilterSearch(props: SearchProps) {
  return <Input.Search {...props} onPressEnter={preventNativeSubmit} />;
}
