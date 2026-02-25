#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  cat >&2 <<USAGE
使い方:
  $(basename "$0") <part_prefix> <output_file>

例:
  $(basename "$0") assets/git-ready/chunks/sample_720p.part- assets/sample_720p.mp4
USAGE
  exit 1
fi

PREFIX="$1"
OUTPUT="$2"

shopt -s nullglob
parts=("${PREFIX}"*)
shopt -u nullglob

if [[ ${#parts[@]} -eq 0 ]]; then
  echo "分割ファイルが見つかりません: ${PREFIX}*" >&2
  exit 1
fi

cat "${parts[@]}" > "$OUTPUT"
echo "復元しました: $OUTPUT"
