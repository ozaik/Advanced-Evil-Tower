#!/usr/bin/env bash

rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
set -euo pipefail

export SCREEN_WIDTH="${SCREEN_WIDTH:-1280}"
export SCREEN_HEIGHT="${SCREEN_HEIGHT:-720}"
export DISPLAY=":99"

Xvfb :99 -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -ac +extension RANDR &
sleep 0.4

x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -quiet &
sleep 0.2

websockify --web=/usr/share/novnc/ 6080 localhost:5900 &
sleep 0.2

node /app/server.js
