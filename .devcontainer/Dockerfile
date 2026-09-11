# V-Flow EXAIS — development toolchain image.
#
# Toolchain only: no workspace source is COPYed in. The repo is bind-mounted at
# /workspace by compose.yaml, so this image stays valid while packages/ is still
# being populated by the G0 import tickets. The hermetic render image
# (docker/Dockerfile.render) is the one that COPYs an explicit package list for
# layer-cached, reproducible golden baselines.
#
# System dependencies mirror _sources/hyperframes-main/Dockerfile.test so that
# renders produced here match the production rendering environment.

# Pinned by digest, not by tag. A tag moves between builds, so
# `node:22-bookworm-slim` alone does not identify a reproducible base.
# This digest resolves to node v22.23.2 on Debian 12.15.
# Update deliberately: change the digest and re-record the toolchain in
# provenance/runtime-contract.json in the same commit.
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436

# ── System dependencies (kept identical to the upstream render environment) ───
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    bash \
    ffmpeg \
    chromium \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libcups2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libgtk-3-0 \
    # Font support — matches production. Rights for these Debian-packaged
    # families are satisfied at the image layer; see licenses/ for the policy.
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-noto-ui-core \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && fc-cache -fv

# Use the system Chromium for general browsing/preview work.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CONTAINER=true

# chrome-headless-shell drives deterministic BeginFrame rendering. PINNED, and
# it must stay pinned: each Chrome stable bump shifts pixel output enough to
# fail PSNR against the golden baselines. Bumping this version and regenerating
# the baselines belong in the same commit.
ARG CHROME_HEADLESS_SHELL_VERSION=148.0.7778.167
RUN npx --yes @puppeteer/browsers install chrome-headless-shell@${CHROME_HEADLESS_SHELL_VERSION} \
      --path /root/.cache/puppeteer \
    && find /root/.cache/puppeteer/chrome-headless-shell -name "chrome-headless-shell" -type f

# Bun runs the workspace. Pinned to the version upstream's lockfile was built with.
ARG BUN_VERSION=bun-v1.3.13
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL="/root/.bun" bash -s "${BUN_VERSION}"
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /workspace

# Verify the toolchain is actually present at build time rather than discovering
# a missing binary during a gate render.
RUN bun --version && node --version && ffmpeg -version | head -1 && ffprobe -version | head -1 \
    && chromium --version

CMD ["bash"]
