#!/usr/bin/env bash
# Apply docs/issue-bodies/*.md to GitHub. Requires issues:write on Acongm/*.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BODIES="$ROOT/docs/issue-bodies"

edit_body() {
  local repo=$1 num=$2 file=$3
  local path="$BODIES/$file"
  if [[ ! -f "$path" ]]; then
    echo "missing $path" >&2
    return 1
  fi
  gh issue edit "$num" --repo "Acongm/$repo" --body-file "$path"
  echo "updated Acongm/$repo#$num"
}

# API
edit_body node-vercel-starter 37 nvs-37.md
edit_body node-vercel-starter 32 nvs-32.md
edit_body node-vercel-starter 55 nvs-55.md
edit_body node-vercel-starter 56 nvs-56.md
edit_body node-vercel-starter 57 nvs-57.md
edit_body node-vercel-starter 58 nvs-58.md
edit_body node-vercel-starter 59 nvs-59.md
edit_body node-vercel-starter 60 nvs-60.md
edit_body node-vercel-starter 61 nvs-61.md
edit_body node-vercel-starter 35 nvs-35.md
edit_body node-vercel-starter 47 nvs-47.md
edit_body node-vercel-starter 48 nvs-48.md
edit_body node-vercel-starter 49 nvs-49.md

# Auth
edit_body auth 48 auth-48.md
edit_body auth 28 auth-28.md
edit_body auth 29 auth-29.md
edit_body auth 25 auth-25.md
edit_body auth 26 auth-26.md
edit_body auth 27 auth-27.md
edit_body auth 50 auth-50.md
edit_body auth 16 auth-16.md

# Chat
edit_body chat 40 chat-40.md
edit_body chat 26 chat-26.md
edit_body chat 39 chat-39.md
edit_body chat 1 chat-1.md

# Portal
edit_body portal 129 portal-129.md
edit_body portal 117 portal-117.md
edit_body portal 116 portal-116.md
edit_body portal 1 portal-1.md

echo "Done. Closed-issue housekeeping is already applied (auth#51/#52, chat#41, portal#127/#130, nvs#43)."
