#!/bin/bash
# Transcode hero videos from .mov to web-optimised .mp4
# Output: public/hero-videos/*.mp4
# Settings: H.264 CRF 23, max 1080p, AAC audio stripped, faststart for streaming

set -e

INPUT_DIR="public/hero-videos"
OUT_DIR="public/hero-videos"

for f in "$INPUT_DIR"/*.mov; do
  base=$(basename "$f" .mov)
  out="$OUT_DIR/${base}.mp4"

  if [ -f "$out" ]; then
    echo "✓ Skipping $base (already transcoded)"
    continue
  fi

  echo "→ Transcoding $base ..."
  ffmpeg -i "$f" \
    -c:v libx264 \
    -crf 23 \
    -preset slow \
    -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" \
    -an \
    -movflags +faststart \
    -y \
    "$out"

  in_size=$(du -sh "$f" | cut -f1)
  out_size=$(du -sh "$out" | cut -f1)
  echo "   $in_size → $out_size"
done

echo ""
echo "Done. Update HeroVideoCarousel.tsx to use .mp4 extensions when ready."
