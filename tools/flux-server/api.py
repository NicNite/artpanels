"""FastAPI server for ArtPanels image generation."""

import argparse
import base64
import io
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from config import load_config
from generator import create_generator

VERSION = "1.0.0"


class GenerateRequest(BaseModel):
    base_prompt: str
    variations: list[str] = []
    count: int = 4
    size: int = 512
    steps: int = 4
    seed: int | None = None


def create_app(mock: bool = False) -> FastAPI:
    config = load_config(mock_override=mock)
    app = FastAPI(title="ArtPanels FLUX Server", version=VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    device = config.resolved_device()
    generator = create_generator(
        mock=config.mock,
        device=device,
        hf_token=config.hf_token or None,
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/status")
    def status():
        return {
            "status": "running",
            "version": VERSION,
            "mode": "mock" if config.mock else "flux",
            "device": device,
            "model": config.model_id,
        }

    @app.post("/api/generate")
    async def generate(req: GenerateRequest):
        async def event_stream():
            for i in range(req.count):
                # Build prompt with variation if available
                if i < len(req.variations) and req.variations[i].strip():
                    prompt = f"{req.base_prompt}, {req.variations[i].strip()}"
                else:
                    prompt = req.base_prompt

                img_seed = (req.seed + i) if req.seed is not None else None

                try:
                    yield {"event": "progress", "data": f'{{"type":"progress","index":{i},"step":0,"total_steps":{req.steps}}}'}

                    result = generator.generate(
                        prompt=prompt,
                        size=req.size,
                        seed=img_seed,
                        num_steps=req.steps,
                    )

                    # Encode image as base64
                    buf = io.BytesIO()
                    result.image.save(buf, format="WebP", quality=90)
                    b64 = base64.b64encode(buf.getvalue()).decode()

                    yield {
                        "event": "image",
                        "data": f'{{"type":"image","index":{i},"image":"{b64}","seed":{result.seed}}}',
                    }
                except Exception as e:
                    yield {
                        "event": "error",
                        "data": f'{{"type":"error","index":{i},"message":"{str(e)}"}}',
                    }

            yield {"event": "done", "data": '{"type":"done"}'}

        return EventSourceResponse(event_stream())

    return app


# ── CLI entry point ──────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ArtPanels FLUX Server")
    parser.add_argument("--mock", action="store_true", help="Use mock generator (no GPU)")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=8000, help="Bind port")
    args = parser.parse_args()

    import uvicorn

    app = create_app(mock=args.mock)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
