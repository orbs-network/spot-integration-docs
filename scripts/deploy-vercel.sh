#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

export VERCEL_PROJECT_ID="prj_uMBZSztD2z9Oaoi0n4gMmznXj2cl"
export VERCEL_ORG_ID="team_t6YZC010wIUd8yFGN6mkglL9"

logout_after_deploy() {
  local status=$?
  trap - EXIT

  if ! vercel logout; then
    echo "Vercel logout failed. Run 'vercel logout' to finish signing out." >&2
    if [ "$status" -eq 0 ]; then
      status=1
    fi
  fi

  exit "$status"
}

trap logout_after_deploy EXIT

vercel deploy --prod --yes --archive=tgz --project "$VERCEL_PROJECT_ID"
