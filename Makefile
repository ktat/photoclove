build:
	rm -rf src-tauri/target
	pnpm build dev

licenses:
	pnpm dlx license-checker --json --production --out public/licenses-npm.json
	cd src-tauri && cargo license --json > ../public/licenses-rust.json

# Check for duplicate code
check-duplicate:
	pnpm dlx jscpd src src-tauri/src --min-lines 5 --min-tokens 50

check-duplicate-rust:
	pnpm dlx jscpd src-tauri/src --min-lines 5 --min-tokens 50

check-duplicate-js:
	pnpm dlx jscpd src --min-lines 5 --min-tokens 50

# Download AI model for AI Auto-Tagging feature
MODEL_DIR = src-tauri/models
MODEL_FILE = $(MODEL_DIR)/mobilenet-v3-large.onnx
MODEL_URL = https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx

download-model: $(MODEL_FILE)

$(MODEL_FILE):
	@mkdir -p $(MODEL_DIR)
	@echo "Downloading ONNX model..."
	curl -L -o $(MODEL_FILE) $(MODEL_URL)
	@echo "Model downloaded to $(MODEL_FILE)"

# Download ONNX Runtime library (Linux x64)
ONNX_VERSION = 1.23.0
ONNX_LIB_DIR = $(HOME)/.local/share/photoclove/lib
ONNX_LIB_FILE = $(ONNX_LIB_DIR)/libonnxruntime.so

download-onnxruntime: $(ONNX_LIB_FILE)

$(ONNX_LIB_FILE):
	@mkdir -p $(ONNX_LIB_DIR)
	@echo "Downloading ONNX Runtime $(ONNX_VERSION)..."
	curl -L -o /tmp/onnxruntime.tgz "https://github.com/microsoft/onnxruntime/releases/download/v$(ONNX_VERSION)/onnxruntime-linux-x64-$(ONNX_VERSION).tgz"
	tar xzf /tmp/onnxruntime.tgz -C /tmp
	cp /tmp/onnxruntime-linux-x64-$(ONNX_VERSION)/lib/libonnxruntime.so* $(ONNX_LIB_DIR)/
	rm -rf /tmp/onnxruntime.tgz /tmp/onnxruntime-linux-x64-$(ONNX_VERSION)
	@echo "ONNX Runtime installed to $(ONNX_LIB_DIR)"

# Setup AI tagging (download both model and runtime)
setup-ai: download-model download-onnxruntime
	@echo "AI Auto-Tagging setup complete!"

# Platform-specific build targets
build-linux:
	pnpm tauri build

build-macos:
	pnpm tauri build

# WSL2: strips Windows paths from PATH to avoid build conflicts
build-wsl:
	env PATH=$(shell echo $$PATH | perl -p -e 's{:/mnt/c.+:}{:}g') pnpm tauri build

# Clean downloaded AI files
clean-ai:
	rm -f $(MODEL_FILE)
	rm -f $(ONNX_LIB_DIR)/libonnxruntime.so*
