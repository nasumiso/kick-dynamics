#!/bin/bash
# Claude Code のクラウドセッションの開始時に依存をインストールする（docs/ai-workflow.md §4）。
# SessionStart フック（.claude/settings.json）から呼ばれる。ローカルでは何もしない。
# package.json・package-lock.json・本スクリプトが前回の成功時から変わっていなければ省く。

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud-setup.sha256
inputs=(scripts/cloud-setup.sh package.json package-lock.json packages/*/package.json)

if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  # 失敗したときに次回やり直すよう、先に古いハッシュを消す
  rm -f "$hashes"
  if npm ci; then
    sha256sum "${inputs[@]}" > "$hashes" || rm -f "$hashes"
  fi
fi
exit 0
