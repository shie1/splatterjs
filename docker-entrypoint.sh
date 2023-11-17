#! /bin/bash
set -e

export DISPLAY=:99

export DBUS_SESSION_BUS_ADDRESS=/dev/null

echo "Starting X virtual framebuffer (Xvfb) in background..."

pkill "chrome" &

Xvfb -ac :99 -screen 0 1280x1024x16 > /dev/null 2>&1 &

exec "$@"