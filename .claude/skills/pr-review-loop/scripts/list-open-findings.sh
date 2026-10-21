#!/usr/bin/env bash
# Codex のレビューの指摘のうち、まだ返信していないもの（未対応）を JSON の行で出力する。
#
# 使い方：list-open-findings.sh <PR 番号>
# GitHub は古い指摘を新しいコミットに付け直して再表示することがあるため、
# 「返信の付いていないトップレベルの指摘」だけを未対応として扱う。
set -euo pipefail

pr="$1"
bot='chatgpt-codex-connector[bot]'
repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

gh api "repos/$repo/pulls/$pr/comments" --paginate --slurp | jq -c --arg bot "$bot" '
  add as $all
  | ($all | map(select(.in_reply_to_id != null) | .in_reply_to_id) | unique) as $replied
  | $all[]
  | select(.user.login == $bot and .in_reply_to_id == null)
  | select((.id as $id | $replied | index($id)) | not)
  | {id, path, line, commit: .commit_id[0:7], body}
'
