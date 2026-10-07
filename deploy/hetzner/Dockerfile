# Build context: the REPO ROOT.  docker build -f deploy/hetzner/Dockerfile .
FROM node:20-slim

# Chromium system dependencies (Puppeteer downloads its own Chrome for Testing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-color-emoji wget curl \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Chromium's sandbox needs privileges that are unavailable in an unprivileged
# container, so it is disabled here. Tradeoff: a browser exploit is no longer
# contained by the Chrome sandbox; the container itself (non-root user, no
# extra capabilities) and the SSRF/navigation policy are the remaining barriers.
ENV NODE_ENV=production \
    PUPPETEER_DISABLE_SANDBOX=true \
    PUPPETEER_CACHE_DIR=/home/streamer/.cache/puppeteer \
    PORT=10000

RUN useradd --create-home --shell /usr/sbin/nologin streamer
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./
RUN chown -R streamer:streamer /app
USER streamer
# Chrome is downloaded by puppeteer's postinstall as root; reinstall it for the runtime user
RUN npx puppeteer browsers install chrome

EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/ || exit 1
CMD ["node", "streamer-webrtc.js"]
