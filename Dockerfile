FROM ivangabriele/tauri:debian-bookworm-22 AS base
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      clang

COPY . .
RUN npm ci
RUN npm run build
RUN npx tauri build -b appimage
