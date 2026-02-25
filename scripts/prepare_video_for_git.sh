#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg が見つかりません。先に ffmpeg をインストールしてください。" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  cat >&2 <<USAGE
使い方:
  $(basename "$0") <input_video> [output_basename]

例:
  $(basename "$0") "assets/サンプル - HD 720p.mov" sample_720p
USAGE
  exit 1
fi

INPUT="$1"
BASENAME="${2:-}"

if [[ ! -f "$INPUT" ]]; then
  echo "入力ファイルが存在しません: $INPUT" >&2
  exit 1
fi

OUT_DIR="assets/git-ready"
CHUNK_DIR="$OUT_DIR/chunks"
mkdir -p "$OUT_DIR" "$CHUNK_DIR"

if [[ -z "$BASENAME" ]]; then
  filename="$(basename "$INPUT")"
  BASENAME="${filename%.*}"
fi

SAFE_NAME="$(printf '%s' "$BASENAME" | tr ' /' '__')"
COMPRESSED="$OUT_DIR/${SAFE_NAME}.mp4"

# Git 管理向けに軽量化: H.264 + AAC, 720p 上限, faststart で先頭メタデータ配置
ffmpeg -y -hide_banner -i "$INPUT" \
  -map 0:v:0 -map 0:a? \
  -c:v libx264 -preset veryfast -crf 24 \
  -vf "scale='min(1280,iw)':-2" \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac -b:a 128k \
  "$COMPRESSED"

# GitHub の 100MB 制限を避けるため 95MB で分割
PREFIX="$CHUNK_DIR/${SAFE_NAME}.part-"
rm -f "${PREFIX}"*
split -b 95m -d -a 3 "$COMPRESSED" "$PREFIX"

ORIGINAL_SIZE="$(du -h "$INPUT" | awk '{print $1}')"
COMPRESSED_SIZE="$(du -h "$COMPRESSED" | awk '{print $1}')"
PART_COUNT="$(ls -1 "${PREFIX}"* | wc -l | tr -d ' ')"

echo "完了"
echo "  入力: $INPUT ($ORIGINAL_SIZE)"
echo "  圧縮: $COMPRESSED ($COMPRESSED_SIZE)"
echo "  分割: ${PREFIX}*** (${PART_COUNT}ファイル)"
echo

echo "復元コマンド例:"
echo "  cat ${PREFIX}* > assets/${SAFE_NAME}.mp4"
