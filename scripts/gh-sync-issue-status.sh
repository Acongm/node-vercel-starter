#!/usr/bin/env bash
# Sync GitHub issue state from docs/platform-issue-status.md recommendations.
# Requires: gh CLI with issues:write on Acongm/* repos.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMENT_CLOSE_52="$ROOT/../auth/docs/issue-status.md"
COMMENT_CLOSE_127="$ROOT/../portal/docs/issue-status.md"

close_if_open() {
  local repo=$1 num=$2 reason=$3 msg=$4
  state=$(gh issue view "$num" --repo "Acongm/$repo" --json state -q .state)
  if [[ "$state" == "OPEN" ]]; then
    gh issue close "$num" --repo "Acongm/$repo" -r "$reason" -c "$msg"
    echo "closed Acongm/$repo#$num"
  else
    echo "skip Acongm/$repo#$num (already $state)"
  fi
}

close_if_open auth 52 completed "getUserInfo 全端已合入 main。详见 node-vercel-starter/docs/platform-issue-status.md"
close_if_open portal 127 completed "PR #128 已合入 main，Portal Chat v2 Drawer 完成。详见 platform-issue-status.md"

echo "Done. For in-progress issues, edit bodies from /tmp/issue-*.md templates or docs/platform-issue-status.md AC tables."
