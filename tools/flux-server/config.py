"""Configuration for ArtPanels FLUX server."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_TOOL_DIR = Path(__file__).parent
load_dotenv(_TOOL_DIR / ".env")


def _detect_device() -> str:
    """Auto-detect the best available torch device."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except ImportError:
        pass
    return "cpu"


@dataclass(frozen=True)
class Config:
    hf_token: str = ""
    model_id: str = "black-forest-labs/FLUX.1-schnell"
    device: str = ""
    image_size: int = 512
    mock: bool = False

    def resolved_device(self) -> str:
        return self.device if self.device else _detect_device()


def load_config(*, mock_override: bool | None = None) -> Config:
    """Load configuration from environment variables."""
    mock_env = os.getenv("MOCK", "false").lower() in ("true", "1", "yes")
    mock = mock_override if mock_override is not None else mock_env

    return Config(
        hf_token=os.getenv("HF_TOKEN", ""),
        model_id=os.getenv("MODEL_ID", "black-forest-labs/FLUX.1-schnell"),
        device=os.getenv("DEVICE", ""),
        image_size=int(os.getenv("IMAGE_SIZE", "512")),
        mock=mock,
    )
