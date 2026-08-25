import { Drawer } from 'antd';

type JsonDrawerProps = {
  open: boolean;
  title: string;
  data: unknown;
  onClose: () => void;
  width?: number;
};

export default function JsonDrawer({
  open,
  title,
  data,
  onClose,
  width = 720,
}: JsonDrawerProps) {
  return (
    <Drawer open={open} title={title} width={width} onClose={onClose}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {data ? JSON.stringify(data, null, 2) : ''}
      </pre>
    </Drawer>
  );
}
