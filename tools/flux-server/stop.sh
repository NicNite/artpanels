#!/usr/bin/env bash
# Stop the ArtPanels FLUX server
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/.server.pid"
PORT="${FLUX_PORT:-8000}"

stopped=0

# Kill tracked process
if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
        pkill -P "$PID" 2>/dev/null
        kill "$PID" 2>/dev/null
        echo "  Stopped PID $PID"
        stopped=1
    fi
    rm -f "$PIDFILE"
fi

# Wait briefly
if [ "$stopped" -eq 1 ]; then
    sleep 1
fi

# Fallback: kill anything on the port
if command -v fuser &>/dev/null && fuser "$PORT/tcp" >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" >/dev/null 2>&1
    echo "  Killed orphan process on port $PORT"
    stopped=1
fi

if [ "$stopped" -eq 0 ]; then
    echo "  FLUX server is not running"
else
    echo "  FLUX server stopped."
fi
