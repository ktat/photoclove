#!/usr/bin/env python3
"""
Generate pre-computed text embeddings for PhotoClove AI tagging.

Usage:
    pip install transformers torch
    python scripts/generate_text_embeddings.py

Output:
    - siglip_text_embeddings.json (for SigLIP backend)
    - openclip_text_embeddings.json (for OpenCLIP backend, optional)
"""

import json
import torch
from pathlib import Path

# PhotoCloveのDEFAULT_CLIP_LABELS (clip_common.rs) と完全に一致させる
LABELS = [
    # People
    "a photo of a person",
    "a photo of people",
    "a photo of a face",
    "a group photo",
    "a selfie",
    # Animals
    "a photo of a dog",
    "a photo of a cat",
    "a photo of a bird",
    "a photo of fish",
    "a photo of a horse",
    "a photo of wildlife",
    "a photo of an insect",
    "a photo of a cow",
    # Nature
    "a photo of the ocean",
    "a photo of a beach",
    "a photo of mountains",
    "a photo of a forest",
    "a photo of a sunset",
    "a photo of the sky",
    "a photo of a lake",
    "a photo of a river",
    # Plants
    "a photo of flowers",
    "a photo of trees",
    "a photo of a garden",
    "a photo of plants",
    # Scenes
    "a photo of food",
    "a photo of a building",
    "a photo of a street",
    "an indoor photo",
    "an outdoor photo",
    "a night photo",
    # Events
    "a wedding photo",
    "a birthday party photo",
    "a travel photo",
    "a vacation photo",
]


def generate_siglip_embeddings() -> dict[str, list[float]]:
    """Generate embeddings using SigLIP model."""
    from transformers import AutoProcessor, AutoModel

    print("Loading SigLIP model...")
    model = AutoModel.from_pretrained("google/siglip-base-patch16-224")
    processor = AutoProcessor.from_pretrained("google/siglip-base-patch16-224")
    model.eval()

    embeddings = {}

    print(f"Generating embeddings for {len(LABELS)} labels...")
    with torch.no_grad():
        for i, label in enumerate(LABELS):
            inputs = processor(text=[label], return_tensors="pt", padding=True)
            text_features = model.get_text_features(**inputs)
            # L2 normalize
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            embeddings[label] = text_features[0].tolist()
            print(f"  [{i+1}/{len(LABELS)}] {label}")

    return embeddings


def generate_openclip_embeddings() -> dict[str, list[float]]:
    """Generate embeddings using OpenCLIP model."""
    import open_clip

    print("Loading OpenCLIP model...")
    model, _, _ = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    tokenizer = open_clip.get_tokenizer('ViT-B-32')
    model.eval()

    embeddings = {}

    print(f"Generating embeddings for {len(LABELS)} labels...")
    with torch.no_grad():
        for i, label in enumerate(LABELS):
            tokens = tokenizer([label])
            text_features = model.encode_text(tokens)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            embeddings[label] = text_features[0].tolist()
            print(f"  [{i+1}/{len(LABELS)}] {label}")

    return embeddings


def main():
    output_dir = Path(__file__).parent.parent / "src-tauri" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate SigLIP embeddings
    try:
        siglip_embeddings = generate_siglip_embeddings()
        siglip_path = output_dir / "siglip_text_embeddings.json"
        with open(siglip_path, "w") as f:
            json.dump(siglip_embeddings, f, indent=2)
        print(f"\nSaved SigLIP embeddings to {siglip_path}")
        print(f"  Labels: {len(siglip_embeddings)}")
        print(f"  Embedding dim: {len(list(siglip_embeddings.values())[0])}")
    except ImportError:
        print("Skipping SigLIP (transformers not installed)")
    except Exception as e:
        print(f"SigLIP generation failed: {e}")

    # Generate OpenCLIP embeddings (optional)
    try:
        openclip_embeddings = generate_openclip_embeddings()
        openclip_path = output_dir / "openclip_text_embeddings.json"
        with open(openclip_path, "w") as f:
            json.dump(openclip_embeddings, f, indent=2)
        print(f"\nSaved OpenCLIP embeddings to {openclip_path}")
        print(f"  Labels: {len(openclip_embeddings)}")
        print(f"  Embedding dim: {len(list(openclip_embeddings.values())[0])}")
    except ImportError:
        print("Skipping OpenCLIP (open_clip not installed)")
    except Exception as e:
        print(f"OpenCLIP generation failed: {e}")


if __name__ == "__main__":
    main()
