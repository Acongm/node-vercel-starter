import { Tag, Tooltip, Typography } from 'antd';
import { idPrefix } from '@/utils/format';

export type UserCellProps = {
  userEmail?: string | null;
  userId?: string | null;
  clientId?: string | null;
  isAnonymous?: boolean;
  clientLabel?: string | null;
  anonKey?: string | null;
  userAgent?: string | null;
  origin?: string | null;
};

function buildTooltip(props: UserCellProps): string {
  const parts: string[] = [];
  if (props.userId) {
    parts.push(`userId: ${props.userId}`);
  }
  if (props.clientId) {
    parts.push(`clientId: ${props.clientId}`);
  }
  if (props.anonKey) {
    parts.push(`anonKey: ${props.anonKey}`);
  }
  if (props.userAgent) {
    parts.push(`userAgent: ${props.userAgent}`);
  }
  if (props.origin) {
    parts.push(`origin: ${props.origin}`);
  }
  return parts.join('\n') || '-';
}

function resolveAnonymousDisplay(props: UserCellProps): string {
  if (props.clientLabel) {
    return props.clientLabel;
  }
  if (props.clientId) {
    return idPrefix(props.clientId);
  }
  if (props.anonKey) {
    return idPrefix(props.anonKey);
  }
  if (props.userId) {
    return idPrefix(props.userId);
  }
  return '-';
}

export default function UserCell(props: UserCellProps) {
  const tooltip = buildTooltip(props);

  if (props.isAnonymous || (!props.userEmail && (props.clientId || props.anonKey || props.userId))) {
    const display = resolveAnonymousDisplay(props);
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
