export default function access(initialState: {
  isAdmin?: boolean;
}) {
  return {
    canAdmin: Boolean(initialState?.isAdmin),
  };
}
