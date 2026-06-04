#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
/usr/local/bin/node "$SCRIPT_DIR/obs-golf-scoreboard-control.js" double-eagle
