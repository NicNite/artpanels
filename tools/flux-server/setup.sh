#!/usr/bin/env bash
# First-time setup for ArtPanels FLUX server
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="${FLUX_VENV:-$HOME/artpanels-flux-venv}"

echo "ArtPanels FLUX Server Setup"
echo "=========================="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "Error: python3 not found. Install Python 3.11+."
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "Python: $PYTHON_VERSION"

# Create venv
if [ -d "$VENV_DIR" ]; then
    echo "Venv already exists at $VENV_DIR"
else
    echo "Creating venv at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# Install core dependencies
echo ""
echo "Installing core dependencies..."
pip install -q -r "$SCRIPT_DIR/requirements.txt"

# Ask about GPU
echo ""
read -rp "Install GPU dependencies for FLUX.1? (requires ~24GB VRAM) [y/N]: " INSTALL_GPU
if [[ "$INSTALL_GPU" =~ ^[Yy]$ ]]; then
    echo "Installing GPU dependencies (this may take a while)..."
    pip install -q torch diffusers transformers accelerate safetensors sentencepiece huggingface-hub "gguf>=0.10.0"
    echo ""
    echo "GPU dependencies installed."
    echo "The FLUX model (~12.7 GB) will download on first generation."
else
    echo "Skipping GPU dependencies. Use --mock mode for development."
fi

# Create .env if not exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo ""
    echo "Created .env from template. Edit as needed."
fi

echo ""
echo "Setup complete!"
echo ""
echo "  Start (mock):  ./start.sh --mock"
echo "  Start (GPU):   ./start.sh"
echo "  Stop:          ./stop.sh"
echo "  Venv:          $VENV_DIR"
