"""Image generator with FLUX.1 Schnell and mock mode for ArtPanels."""

from __future__ import annotations

import hashlib
import random
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


@dataclass
class GeneratedImage:
    """A single generated image with metadata."""

    image: Image.Image
    prompt: str
    seed: int
    index: int
    elapsed: float = 0.0


class MockGenerator:
    """Mock generator for development. No GPU needed.

    Generates colored gradient squares with prompt text overlay.
    """

    def generate(
        self,
        prompt: str,
        size: int = 512,
        seed: int | None = None,
        num_steps: int = 4,
    ) -> GeneratedImage:
        img_seed = seed if seed is not None else random.randint(0, 2**31)
        rng = random.Random(img_seed)
        t0 = time.time()

        # Gradient background
        c1 = tuple(rng.randint(40, 200) for _ in range(3))
        c2 = tuple(rng.randint(40, 200) for _ in range(3))

        img = Image.new("RGB", (size, size))
        for y in range(size):
            t = y / max(size - 1, 1)
            r = int(c1[0] * (1 - t) + c2[0] * t)
            g = int(c1[1] * (1 - t) + c2[1] * t)
            b = int(c1[2] * (1 - t) + c2[2] * t)
            for x in range(size):
                img.putpixel((x, y), (r, g, b))

        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size // 20)
        except (OSError, IOError):
            font = ImageFont.load_default()

        # Label
        label = f"MOCK #{img_seed % 1000:03d}"
        bbox = draw.textbbox((0, 0), label, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((size - tw) // 2, size - size // 10), label, fill="white", font=font)

        # Prompt hash for traceability
        short_hash = hashlib.md5(prompt.encode()).hexdigest()[:6]
        draw.text((8, 8), short_hash, fill="white", font=font)

        elapsed = time.time() - t0
        return GeneratedImage(image=img, prompt=prompt, seed=img_seed, index=0, elapsed=elapsed)


def _patch_flux_rope_for_mps():
    """Monkey-patch FLUX RoPE for MPS compatibility."""
    try:
        from diffusers.models.transformers import transformer_flux
    except ImportError:
        return

    _original_rope = getattr(transformer_flux, "rope", None)
    if _original_rope is None:
        return

    def _mps_safe_rope(pos, dim, theta):
        device = pos.device
        result = _original_rope(pos.to("cpu"), dim, theta)
        return result.to(device=device)

    transformer_flux.rope = _mps_safe_rope


class FluxGenerator:
    """Real generator using FLUX.1 Schnell (GGUF Q8) via diffusers.

    Uses a GGUF Q8_0 quantized transformer (~12.7 GB) for comfortable
    operation on 24 GB GPUs. T5-XXL text encoder offloaded to CPU.
    """

    MODEL_ID = "black-forest-labs/FLUX.1-schnell"
    GGUF_REPO = "city96/FLUX.1-schnell-gguf"
    GGUF_FILE = "flux1-schnell-Q8_0.gguf"
    NUM_STEPS = 4
    GUIDANCE_SCALE = 0.0
    MAX_SEQ_LEN = 256

    def __init__(self, device: str = "cuda", hf_token: str | None = None):
        import os
        import torch

        self.device = device
        self.num_steps = self.NUM_STEPS
        self.guidance_scale = self.GUIDANCE_SCALE
        self.max_seq_len = self.MAX_SEQ_LEN

        if device == "mps":
            _patch_flux_rope_for_mps()

        self.dtype = torch.bfloat16
        os.environ.setdefault("DIFFUSERS_GGUF_CUDA_KERNELS", "false")

        print(f"Loading {self.GGUF_REPO}/{self.GGUF_FILE} on {device}...")

        from diffusers import FluxPipeline, FluxTransformer2DModel, GGUFQuantizationConfig
        from huggingface_hub import hf_hub_download

        gguf_path = hf_hub_download(
            repo_id=self.GGUF_REPO,
            filename=self.GGUF_FILE,
            token=hf_token,
        )

        transformer = FluxTransformer2DModel.from_single_file(
            gguf_path,
            quantization_config=GGUFQuantizationConfig(compute_dtype=self.dtype),
            torch_dtype=self.dtype,
        )

        self.pipe = FluxPipeline.from_pretrained(
            self.MODEL_ID,
            transformer=transformer,
            torch_dtype=self.dtype,
            token=hf_token,
        )

        self.pipe.enable_model_cpu_offload()
        print(f"Model loaded (Q8 GGUF + CPU offload) — steps={self.num_steps}")

    def generate(
        self,
        prompt: str,
        size: int = 512,
        seed: int | None = None,
        num_steps: int | None = None,
    ) -> GeneratedImage:
        import torch

        steps = num_steps if num_steps is not None else self.num_steps
        img_seed = seed if seed is not None else random.randint(0, 2**31)

        gen_device = "cpu" if self.device == "mps" else self.device
        generator = torch.Generator(device=gen_device).manual_seed(img_seed)

        t0 = time.time()
        output = self.pipe(
            prompt=prompt,
            height=size,
            width=size,
            num_inference_steps=steps,
            generator=generator,
            guidance_scale=self.guidance_scale,
            max_sequence_length=self.max_seq_len,
        )
        elapsed = time.time() - t0
        pil_image = output.images[0]

        print(f"  Generated in {elapsed:.1f}s — {steps} steps, seed:{img_seed}")
        return GeneratedImage(image=pil_image, prompt=prompt, seed=img_seed, index=0, elapsed=elapsed)


def create_generator(
    *, mock: bool = False, device: str = "cuda", hf_token: str | None = None
) -> MockGenerator | FluxGenerator:
    """Factory: returns MockGenerator if mock=True, else FluxGenerator."""
    if mock:
        return MockGenerator()
    return FluxGenerator(device=device, hf_token=hf_token)
