# PhotoClove CI image.
#
# Bakes in everything the Tests workflow needs so it doesn't have to run
# `apt-get install`, install Rust, install pnpm, and `cargo install
# tauri-driver --locked` on every CI run. Built and pushed to ghcr.io by
# .github/workflows/build-ci-image.yml; consumed by the jobs in
# .github/workflows/test.yml via `container:`.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    CARGO_HOME=/usr/local/cargo \
    RUSTUP_HOME=/usr/local/rustup \
    PNPM_HOME=/usr/local/pnpm \
    PATH=/usr/local/cargo/bin:/usr/local/pnpm:/usr/local/pnpm/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# ---- System packages ---------------------------------------------------
# Tauri build deps + libheif compile deps (libheif-rs has feature
# "compile-libheif" enabled in Cargo.toml, which builds it from source
# and needs cmake/nasm/numa) + WebKitWebDriver (used by tauri-driver) +
# xvfb (headless display for the E2E job).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        curl \
        git \
        libappindicator3-dev \
        libgtk-3-dev \
        libnuma-dev \
        librsvg2-dev \
        libsoup-3.0-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        nasm \
        patchelf \
        pkg-config \
        webkit2gtk-driver \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

# ---- Node 20 + pnpm ----------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@latest \
    && pnpm config set store-dir /usr/local/pnpm-store

# ---- Rust toolchain ----------------------------------------------------
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --default-toolchain stable --profile minimal \
            --component clippy --component rustfmt

# ---- tauri-driver (pre-compiled) --------------------------------------
RUN cargo install tauri-driver --locked

# Sanity check: surface versions in the image build log so a regression
# (e.g. tauri-driver bumped, Node missing) is obvious without bisecting.
RUN node --version && pnpm --version && rustc --version && \
    cargo --version && tauri-driver --help >/dev/null

WORKDIR /workspace
