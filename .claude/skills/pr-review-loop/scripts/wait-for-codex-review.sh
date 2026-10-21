#!/usr/bin/env bash
# Codex の PR レビューが、PR の現在の head コミットに対して終わるまで待つ。
#
# 使い方：wait-for-codex-review.sh <PR 番号> [待つ秒数（既定 540）]
# 出力（最後の行）：
#   REVIEWED <sha>     Codex が head に対するレビューを投稿した（指摘があるかは list-open-findings.sh で確かめる）
#   NO_FINDINGS <sha>  Codex が最新の「@codex review」のコメントに 👍 を付けた（指摘なし）
#   TIMEOUT <sha>      待つ秒数を過ぎた（終了コード 2）
set -euo pipefail

pr="$1"
timeout="${2:-540}"
bot='chatgpt-codex-connector[bot]'
repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
head="$(gh pr view "$pr" --json headRefOid -q .headRefOid)"
deadline=$((SECONDS + timeout))

while :; do
  # 要約コメントの codex-review-state（JSON）：head に対するレビューが終わっていれば、指摘の有無で判定する。
  # PR の作成時の自動レビューで指摘がない場合は、これ以外に完了の印が残らない（2026-10-21、#19）。
  state="$(gh api "repos/$repo/issues/$pr/comments" --paginate \
    --jq ".[] | select(.user.login == \"$bot\") | .body | capture(\"codex-review-state:v1 (?<s>\\\\{.*\\\\}) -->\") | .s" \
    | tail -n 1)"
  if [ -n "$state" ]; then
    verdict="$(printf '%s' "$state" | jq -r --arg head "$head" '
      .code_review | if .commit_sha == $head and .status == "completed"
        then (if .has_any_findings then "REVIEWED" else "NO_FINDINGS" end) else "" end')"
    if [ -n "$verdict" ]; then
      echo "$verdict $head"
      exit 0
    fi
  fi

  reviewed="$(gh api "repos/$repo/pulls/$pr/reviews" --paginate \
    --jq "[.[] | select(.user.login == \"$bot\" and .commit_id == \"$head\")] | length")"
  if [ "$reviewed" -gt 0 ]; then
    echo "REVIEWED $head"
    exit 0
  fi

  trigger="$(gh api "repos/$repo/issues/$pr/comments" --paginate \
    --jq '[.[] | select(.body | test("^@codex review"))] | last | .id // empty')"
  if [ -n "$trigger" ]; then
    thumbs="$(gh api "repos/$repo/issues/comments/$trigger/reactions" \
      --jq "[.[] | select(.user.login == \"$bot\" and .content == \"+1\")] | length")"
    if [ "$thumbs" -gt 0 ]; then
      echo "NO_FINDINGS $head"
      exit 0
    fi
  fi

  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "TIMEOUT $head"
    exit 2
  fi
  sleep 30
done
