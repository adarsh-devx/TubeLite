# TubeLite backend - Render/Linux deployment
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

# FFmpeg is required for yt-dlp video merging / MP3 extraction.
# Python venv is used only to install the yt-dlp executable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
    && python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/pip install --no-cache-dir --upgrade pip "yt-dlp[default]" \
    && ln -s /opt/yt-dlp/bin/yt-dlp /usr/local/bin/yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV BACKEND_HOST=0.0.0.0
ENV YT_DLP_BINARY=/usr/local/bin/yt-dlp
ENV FFMPEG_BINARY=/usr/bin/ffmpeg
ENV NODE_BINARY=/usr/local/bin/node
ENV YT_DLP_TIMEOUT_MS=900000

CMD ["npm", "start"]
