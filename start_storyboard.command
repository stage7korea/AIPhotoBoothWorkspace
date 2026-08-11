#!/bin/zsh
SCRIPT_DIR="${0:A:h}"
cd "$SCRIPT_DIR" || exit 1
PORT=4319
open "http://localhost:${PORT}/index.html"
AI_PHOTOBOOTH_STORYBOARD_PORT="$PORT" /usr/bin/env node storyboard-server.mjs
