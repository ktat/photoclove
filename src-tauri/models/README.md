# AI Models for PhotoClove

This directory contains ONNX models for AI auto-tagging feature.

## Required Models

| File | Preset | Size | Source |
|------|--------|------|--------|
| `mobilenet-v3-small.onnx` | Light | ~5MB | MobileNetV3-Small |
| `mobilenet-v3-large.onnx` | Standard | ~15MB | MobileNetV3-Large |
| `efficientnet-lite4.onnx` | Accurate | ~50MB | EfficientNet-Lite4 |

## Download Instructions

### Option 1: Download from ONNX Model Zoo

```bash
# MobileNetV3-Large (Standard preset - recommended for first setup)
curl -L -o mobilenet-v3-large.onnx \
  "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx"
```

### Option 2: Convert from PyTorch

```python
import torch
import torchvision.models as models

# Load pretrained MobileNetV3
model = models.mobilenet_v3_large(pretrained=True)
model.eval()

# Export to ONNX
dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    "mobilenet-v3-large.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}}
)
```

### Option 3: Use Hugging Face

```bash
# Install optimum
pip install optimum[onnxruntime]

# Export MobileNetV3
optimum-cli export onnx --model google/mobilenet_v2_1.0_224 mobilenet-v3-large/
```

## Model Requirements

- Input: RGB image, 224x224 pixels, normalized with ImageNet mean/std
- Output: 1000-class ImageNet probabilities
- Format: ONNX opset version 12 or higher

## File Placement

Place the downloaded `.onnx` files directly in this directory:

```
src-tauri/models/
├── README.md
├── mobilenet-v3-small.onnx   (Light preset)
├── mobilenet-v3-large.onnx   (Standard preset - default)
└── efficientnet-lite4.onnx   (Accurate preset)
```

## Notes

- At minimum, `mobilenet-v3-large.onnx` is required for the Standard preset
- Models are loaded lazily (only when AI tagging is first used)
- Models are bundled with the application binary

## Development

For development, an empty placeholder file is included. Replace it with the actual
ONNX model file before testing AI tagging functionality:

```bash
# Download actual model (replaces placeholder)
curl -L -o src-tauri/models/mobilenet-v3-large.onnx \
  "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx"
```
