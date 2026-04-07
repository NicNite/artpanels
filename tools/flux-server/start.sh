#!/usr/bin/env bash
# Start the ArtPanels FLUX server
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/.server.pid"
LOGFILE="$SCRIPT_DIR/.server.log"
PORT="${FLUX_PORT:-8000}"

# Check if already running
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null | grep -q 200; then
    echo "FLUX server is already running on port $PORT"
    exit 0
fi

# Activate venv
VENV_DIR="${FLUX_VENV:-$HOME/artpanels-flux-venv}"
if [ ! -d "$VENV_DIR" ]; then
    echo "Python venv not found at $VENV_DIR"
    echo "Run setup first: ./setup.sh"
    exit 1
fi
source "$VENV_DIR/bin/activate"

# Parse arguments
MOCK_FLAG=""
MODE="FLUX.1 Schnell"
HOST="127.0.0.1"
while [ $# -gt 0 ]; do
    case "$1" in
        --mock)   MOCK_FLAG="--mock"; MODE="Mock (placeholders)"; shift ;;
        --host)   HOST="$2"; shift 2 ;;
        --port)   PORT="$2"; shift 2 ;;
        *)        shift ;;
    esac
done

# Kill orphan on port
if command -v fuser &>/dev/null && fuser "$PORT/tcp" >/dev/null 2>&1; then
    fuser -k "$PORT/tcp" >/dev/null 2>&1
    sleep 1
fi

echo "Starting ArtPanels FLUX server..."
echo "  Mode: $MODE"
echo "  Host: $HOST:$PORT"

# Start server
cd "$SCRIPT_DIR"
nohup python api.py $MOCK_FLAG --host "$HOST" --port "$PORT" > "$LOGFILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PIDFILE"

# Wait for startup
if [ -n "$MOCK_FLAG" ]; then
    MAX_WAIT=15
else
    MAX_WAIT=120
fi

echo "  Waiting for server (up to ${MAX_WAIT}s)..."
for i in $(seq 1 $MAX_WAIT); do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo "  Server crashed during startup."
        echo "  Check: cat $LOGFILE"
        exit 1
    fi

    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null | grep -q 200; then
        echo ""
        echo "  FLUX server is running on http://localhost:$PORT"
        echo "  Stop with: ./stop.sh"
        exit 0
    fi

    if [ $((i % 10)) -eq 0 ]; then
        echo "  ... loading (${i}/${MAX_WAIT}s)"
    fi
    sleep 1
done

echo ""
echo "  Server did not respond within ${MAX_WAIT}s"
echo "  It may still be loading the model. Check: tail -f $LOGFILE"
exit 1
