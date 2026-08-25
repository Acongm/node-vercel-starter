import { Tag, Tooltip, Typography } from 'antd';
import { idPrefix } from '@/utils/format';

export type UserCellProps = {
  userEmail?: string | null;
  userId?: string | null;
  clientId?: string | null;
  isAnonymous?: boolean;
  clientLabel?: string | null;
};

function buildTooltip(props: UserCellProps): string {
  const parts: string[] = [];
  if (props.userId) {
    parts.push(`userId: ${props.userId}`);
  }
  if (props.clientId) {
    parts.push(`clientId: ${props.clientId}`);
  }
  return parts.join('\n') || '-';
}

export default function UserCell(props: UserCellProps) {
  const tooltip = buildTooltip(props);

  if (props.isAnonymous || (!props.userEmail && props.clientId)) {
    const display =
      props.clientLabel || (props.clientId ? idPrefix(props.clientId) : '-');
    return (
      <Tooltip title={tooltip}>
        <span>
          <Tag>匿名</Tag>
          <Typography.Text>{display}</Typography.Text>
        </span>
      </Tooltip>
    );
  }

  const display = props.userEmail || idPrefix(props.userId);
  return (
    <Tooltip title={tooltip}>
      <Typography.Text>{display}</Typography.Text>
    </Tooltip>
  );
}
