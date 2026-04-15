#!/usr/bin/env bash
# Copies pixel art character sprites into public/sprites/ with normalized naming.
#
# Usage:
#   ./scripts/copy-sprites.sh /path/to/sprite/folder
#
# Expected source structure:
#   animations/Running-XXXXX/{direction}/frame_000-005.png
#   animations/Walking-XXXXX/{direction}/frame_000-005.png
#   rotations/{direction}.png
#
# Output structure in public/sprites/:
#   running/{direction}/frame_0.png … frame_5.png
#   walking/{direction}/frame_0.png … frame_5.png
#   idle/{direction}.png

set -e

SRC="${1%/}"  # strip trailing slash
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/sprites"

if [ -z "$SRC" ]; then
  echo "Usage: $0 /path/to/sprite/folder"
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "Error: source folder not found: $SRC"
  exit 1
fi

DIRECTIONS="east west north south north-east north-west south-east south-west"

copy_animation() {
  local label="$1"   # "running" or "walking"
  local src_dir="$2" # path to the animation folder

  if [ -z "$src_dir" ] || [ ! -d "$src_dir" ]; then
    echo "Warning: $label source not found, skipping"
    return
  fi

  for dir in $DIRECTIONS; do
    mkdir -p "$DEST/$label/$dir"
    for i in 0 1 2 3 4 5; do
      padded=$(printf "%03d" "$i")
      src_file="$src_dir/$dir/frame_$padded.png"
      if [ -f "$src_file" ]; then
        cp "$src_file" "$DEST/$label/$dir/frame_$i.png"
      else
        echo "Warning: missing $src_file"
      fi
    done
  done
  echo "$label frames copied to $DEST/$label/"
}

# Running
RUN_SRC=$(ls -d "$SRC"/animations/Running-* 2>/dev/null | head -1)
copy_animation "running" "$RUN_SRC"

# Walking
WALK_SRC=$(ls -d "$SRC"/animations/Walking-* 2>/dev/null | head -1)
copy_animation "walking" "$WALK_SRC"

# Idle rotations
ROTS_SRC="$SRC/rotations"
if [ -d "$ROTS_SRC" ]; then
  mkdir -p "$DEST/idle"
  for dir in $DIRECTIONS; do
    src_file="$ROTS_SRC/$dir.png"
    if [ -f "$src_file" ]; then
      cp "$src_file" "$DEST/idle/$dir.png"
    else
      echo "Warning: missing $src_file"
    fi
  done
  echo "Idle sprites copied to $DEST/idle/"
else
  echo "Warning: rotations folder not found, skipping idle sprites"
fi

echo ""
echo "Done. All sprites are in $DEST"
echo "Commit the public/sprites/ folder to include them in the repo."
