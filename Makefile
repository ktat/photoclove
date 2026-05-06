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

# E2E test fixture DBs the running app writes to (updated_at, view counts, etc.).
# Listed explicitly so we don't accidentally `git checkout` user changes.
E2E_FIXTURE_DBS = example/import_to/photoclove.db example/import_to/.photoclove.db

# Reset E2E fixture DBs to their committed state. Tests mutate them as a
# side effect of the app running, so each fresh run should start from the
# committed snapshot rather than whatever drifted during the previous run.
reset-e2e-fixture:
	@for db in $(E2E_FIXTURE_DBS); do \
		if git ls-files --error-unmatch $$db >/dev/null 2>&1; then \
			git checkout -- $$db; \
		fi; \
	done

# Run the WebdriverIO E2E suite with the fixture freshly reset.
test-e2e: reset-e2e-fixture
	pnpm test:e2e

# Run all locally-runnable test layers.
test: reset-e2e-fixture
	pnpm test:run
	pnpm test:e2e

# Fast checks intended to be run from .git/hooks/pre-push. Mirrors the
# CI gates that most often surprise locally — backend rustfmt + clippy
# (-D warnings) and the Vitest unit suite — while deliberately leaving
# E2E out (too slow to run on every push).
pre-push:
	cd src-tauri && cargo fmt --check
	cd src-tauri && cargo clippy --all-targets -- -D warnings
	pnpm test:run
